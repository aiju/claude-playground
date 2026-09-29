// Renders the final video for YouTube on this machine's GPU, and writes
// everything that goes up with it into out/youtube/:
//   heart-sutra-4k60.mp4    3840x2160, 60 fps, H.264 High, BT.709, AAC 384 kbps
//   heart-sutra.ja.srt      captions: the lyrics, Sanskrit romanized
//   heart-sutra.en.srt      captions: romanized lyrics over an English translation
//   description.txt         chapters and credits
//   lyrics.txt, thumbnail.jpg
//
//   node tools/render-youtube.mjs --test    # 12 s (the rinse into the chorus), to check speed and look
//   node tools/render-youtube.mjs           # the whole video
//
// Options: --jobs 2 (browser windows rendering side by side), --from/--to
// (seconds), --w/--h/--fps, --crf 16, --audio file, --audio-offset s,
// --thumbnail 77.8 (the frame to use), --cpu (render in software without a
// window: slow, for trying the pipeline out).
//
// Audio: uses the song's lossless master if there's one at
// audio/master.{wav,flac,aif,aiff} (kept out of git), else audio/song.m4a.
// The master is lined up with song.m4a, which all the timings were measured
// against, by cross-correlating the two; the offset found is printed.
//
// The render goes in 20 s chunks into out/youtube/chunks-*; if it stops,
// run the same command again and it carries on from the last finished chunk.
// Needs Google Chrome, ffmpeg (with libx264) and `npm install`.

import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';
import { launchOptions } from './browser.mjs';
import { writeExtras } from './youtube-extras.mjs';
import { DURATION, SONG_END } from '../src/timeline.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const test = args.includes('--test');
const from = +opt('--from', test ? 74 : 0);
const to = +opt('--to', test ? 86 : DURATION);
const fps = +opt('--fps', 60);
const w = +opt('--w', 3840), h = +opt('--h', 2160);
const jobs = +opt('--jobs', 2);
const crf = opt('--crf', '16');
const gpu = !args.includes('--cpu');
const thumbAt = +opt('--thumbnail', 77.8);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const dir = 'out/youtube';
const out = `${dir}/${test ? 'test' : 'heart-sutra-4k60'}.mp4`;
const chunkSec = 20;

const total = Math.round((to - from) * fps);
const perChunk = chunkSec * fps;
const chunkCount = Math.ceil(total / perChunk);
const chunkDir = `${dir}/chunks-${from}-${to}-${w}x${h}-${fps}-crf${crf}`;
await mkdir(chunkDir, { recursive: true });

// ---------------------------------------------------------------- checks

const probe = spawnSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
if (probe.error) throw new Error(`can't run ffmpeg (${FFMPEG}): install it (brew install ffmpeg) or set FFMPEG`);
if (!/libx264/.test(probe.stdout)) throw new Error('this ffmpeg has no libx264 encoder');

// ---------------------------------------------------------------- audio

function decode(file, secs, rate) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-t', String(secs), '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status) throw new Error(`ffmpeg couldn't read ${file}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}

// Pearson correlation of a against b shifted by lag samples, over [s, e) of a.
function corr(a, b, lag, s, e) {
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (let i = s; i < e; i++) {
    const j = i + lag;
    if (j < 0 || j >= b.length) continue;
    const x = a[i], y = b[j];
    sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; n++;
  }
  const va = saa - sa * sa / n, vb = sbb - sb * sb / n;
  return va > 0 && vb > 0 ? (sab - sa * sb / n) / Math.sqrt(va * vb) : 0;
}

// Where song.m4a's start falls in the master, in seconds: roughly from the
// loudness envelopes (10 ms steps, within ±5 s), then to the sample on the
// waveforms (8 kHz, within ±20 ms of that).
function findOffset(master) {
  const rate = 8000, secs = 70;
  const ref = decode('audio/song.m4a', secs, rate), mas = decode(master, secs + 5, rate);
  const env = x => { const hop = rate / 100, e = new Float32Array(Math.floor(x.length / hop)); for (let k = 0; k < e.length; k++) { let s = 0; for (let i = 0; i < hop; i++) s += x[k * hop + i] ** 2; e[k] = Math.sqrt(s / hop); } return e; };
  const er = env(ref), em = env(mas);
  let best = 0, bestC = -1;
  for (let lag = -500; lag <= 500; lag++) { const c = corr(er, em, lag, 200, 6000); if (c > bestC) { bestC = c; best = lag; } }
  const coarse = best * rate / 100;
  best = coarse; bestC = -1;
  for (let lag = coarse - 160; lag <= coarse + 160; lag++) { const c = corr(ref, mas, lag, 5 * rate, 35 * rate); if (c > bestC) { bestC = c; best = lag; } }
  return { offset: best / rate, confidence: bestC };
}

const masters = ['wav', 'flac', 'aif', 'aiff'].map(e => `audio/master.${e}`).filter(existsSync);
const audio = opt('--audio', masters[0] || 'audio/song.m4a');
let offset = 0;
if (opt('--audio-offset') != null) offset = +opt('--audio-offset');
else if (audio !== 'audio/song.m4a') {
  const found = findOffset(audio);
  console.log(`audio: ${audio}, lined up with song.m4a at ${(found.offset * 1000).toFixed(1)} ms (match ${found.confidence.toFixed(3)})`);
  if (found.confidence < 0.6) {
    console.error(`That match is weak: is ${audio} the same mix as audio/song.m4a? If it is, give the offset with --audio-offset (seconds).`);
    process.exit(1);
  }
  offset = found.offset;
} else console.log('audio: audio/song.m4a (put the lossless master at audio/master.wav to use it instead)');

// ---------------------------------------------------------------- extras

console.log((await writeExtras(dir)).map(f => `wrote ${f}`).join('\n'));

// ---------------------------------------------------------------- frames

const server = await serve(8766);
const browsers = [];
async function openPage() {
  const browser = await chromium.launch(launchOptions({ gpu }));
  browsers.push(browser);
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.setDefaultTimeout(0);
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(`http://127.0.0.1:8766/index.html?capture&w=${w}&h=${h}`);
  await page.evaluate(() => window.mv.ready);
  return page;
}
const pages = await Promise.all(Array.from({ length: jobs }, openPage));
const renderer = await pages[0].evaluate(() => {
  const gl = document.getElementById('view').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log(`rendering on: ${renderer}`);
if (gpu && /swiftshader|llvmpipe|software/i.test(renderer)) {
  console.error('Chrome is rendering in software, not on the GPU. Is the Chrome window visible? Stopping.');
  process.exit(1);
}
const frameAt = (page, t, q = 0.97) => page.evaluate(async ([t, q]) => {
  await window.mv.renderAt(t);
  return document.getElementById('view').toDataURL('image/jpeg', q);
}, [t, q]).then(url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));

// the thumbnail: one frame, scaled to 1280x720 (YouTube's limit is 2 MB)
if (!existsSync(`${dir}/thumbnail.jpg`) || args.includes('--thumbnail')) {
  writeFileSync(`${chunkDir}/thumb-full.jpg`, await frameAt(pages[0], thumbAt));
  spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', `${chunkDir}/thumb-full.jpg`, '-vf', 'scale=1280:720:flags=lanczos+accurate_rnd+full_chroma_int', '-q:v', '3', `${dir}/thumbnail.jpg`]);
  console.log(`wrote ${dir}/thumbnail.jpg (frame at ${thumbAt} s)`);
}

// The frames come out of Chrome as sRGB JPEGs, which decode as full-range
// BT.601 YCbCr; YouTube expects BT.709 in limited range, tagged as such.
// (With ffmpeg's default rounding the picture comes out 2-4 levels darker:
// accurate_rnd keeps it true.) Keyframes every half second in closed GOPs,
// as YouTube recommends.
const encodeArgs = file => [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-vf', 'scale=in_range=full:out_range=limited:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high', '-level:v', '5.2',
  '-g', String(fps / 2), '-keyint_min', String(fps / 2), '-sc_threshold', '0', '-bf', '2', '-flags', '+cgop',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-an', file,
];

let rendered = 0;
const started = Date.now();
const todo = Array.from({ length: chunkCount }, (_, c) => c).filter(c => !existsSync(`${chunkDir}/${String(c).padStart(3, '0')}.mp4`));
if (todo.length < chunkCount) console.log(`${chunkCount - todo.length} of ${chunkCount} chunks already done, carrying on`);
const todoFrames = todo.reduce((n, c) => n + Math.min(perChunk, total - c * perChunk), 0);

for (const c of todo) {
  const first = c * perChunk, count = Math.min(perChunk, total - first);
  const file = `${chunkDir}/${String(c).padStart(3, '0')}.mp4`, part = file.replace(/\.mp4$/, '.part.mp4');
  const ff = spawn(FFMPEG, encodeArgs(part), { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((resolve, reject) => ff.on('close', code => (code ? reject(new Error(`ffmpeg exited with ${code}`)) : resolve())));
  // frames come back out of order from the windows; hand them over in order
  const done = new Map();
  let next = 0, waiting = null;
  const worker = async (k, page) => {
    for (let i = k; i < count; i += jobs) {
      done.set(i, await frameAt(page, from + (first + i) / fps));
      if (waiting) waiting();
      while (i - next > jobs * 8) await new Promise(r => setTimeout(r, 20));
    }
  };
  const workers = pages.map((page, k) => worker(k, page));
  while (next < count) {
    if (!done.has(next)) { await new Promise(r => { waiting = r; }); waiting = null; continue; }
    const buf = done.get(next);
    done.delete(next);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    next++; rendered++;
    if (rendered % fps === 0) {
      const per = (Date.now() - started) / rendered / 1000, eta = Math.round(per * (todoFrames - rendered));
      console.log(`chunk ${c + 1}/${chunkCount}  ${rendered}/${todoFrames} frames  ${per.toFixed(3)} s/frame  eta ${Math.floor(eta / 3600)}h${String(Math.floor(eta / 60) % 60).padStart(2, '0')}m`);
    }
  }
  await Promise.all(workers);
  ff.stdin.end();
  await ffDone;
  renameSync(part, file);
}
await Promise.all(browsers.map(b => b.close()));
server.close();

// ---------------------------------------------------------------- assemble

// join the chunks, then add the sound: from `from` in the song, lined up,
// faded out as the song ends and silent under the credits
const list = `${chunkDir}/list.txt`;
writeFileSync(list, readdirSync(chunkDir).filter(f => /^\d{3}\.mp4$/.test(f)).sort().map(f => `file '${f}'`).join('\n') + '\n');
const video = `${chunkDir}/video.mp4`;
const join = spawnSync(FFMPEG, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video], { stdio: 'inherit' });
if (join.status) throw new Error('joining the chunks failed');

const start = from + offset;
const audioIn = start >= 0 ? ['-ss', start.toFixed(6), '-i', audio] : ['-i', audio];
const filters = [];
if (start < 0) filters.push(`adelay=delays=${Math.round(-start * 1000)}:all=1`);
const endIn = SONG_END - from;
if (endIn > 0.05 && endIn < to - from) filters.push(`afade=t=out:st=${(endIn - 0.05).toFixed(3)}:d=0.05`, `atrim=end=${endIn.toFixed(3)}`);
filters.push('apad');
const mux = spawnSync(FFMPEG, [
  '-y', '-v', 'error', '-i', video, ...audioIn,
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
  '-af', filters.join(','), '-c:a', 'aac', '-b:a', '384k', '-ar', '48000',
  '-t', (total / fps).toFixed(6), '-movflags', '+faststart', out,
], { stdio: 'inherit' });
if (mux.status) throw new Error('adding the audio failed');
const mins = (Date.now() - started) / 60000;
console.log(`wrote ${out} (${(statSync(out).size / 1e9).toFixed(2)} GB) in ${mins.toFixed(0)} min`);
if (test) console.log('Test done. Check the look and the speed above; the chunks are in', chunkDir);
else console.log(`The chunks in ${chunkDir} can be deleted now.`);
