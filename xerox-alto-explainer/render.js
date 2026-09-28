// Renders the final video: every frame drawn in headless Chromium by the
// same code as the preview, the soundtrack built the same way (mix.js), and
// ffmpeg encoding both to an H.264/AAC MP4 at 1080 x 1920, 30 fps.
//   node render.js [--out out/task-zero.mp4] [--from 40 --to 50] [--crf 16]
//
// Needs `npm install` (Playwright) and ffmpeg.

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { once } from 'events';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { serve } from './serve.js';
import { buildMix, writeWav } from './mix.js';
import { FPS } from './src/lib/frame.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const OUT = path.resolve(here, opt('out', 'out/task-zero.mp4'));
const CRF = opt('crf', '16');
const BATCH = 30; // frames per round trip to the page

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const started = performance.now();

// The soundtrack, as one WAV for ffmpeg.
const { T, mixed } = buildMix();
const from = Number(opt('from', 0));
const to = Math.min(T.duration, Number(opt('to', T.duration)));
const first = Math.round(from * FPS);
const last = Math.ceil(to * FPS);
const audio = path.join(here, 'out', 'render-audio.wav');
writeWav(audio, mixed);

// The page, in render mode (it skips building its own sound).
const server = await serve(0);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
page.on('pageerror', (e) => console.error('page:', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?render`);
await page.waitForFunction(() => window.framesReady === true, null, { timeout: 60000 });

// PNG frames at 540 x 960 go in; ffmpeg scales them up 2x with
// nearest-neighbour (so the chroma blocks line up with the pixels) and
// converts to BT.709 video.
const ff = spawn('ffmpeg', [
  '-v', 'error', '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-ss', String(first / FPS), '-t', String((last - first) / FPS), '-i', audio,
  '-vf', 'scale=1080:1920:flags=neighbor:out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', CRF,
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
  '-movflags', '+faststart',
  OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = once(ff, 'exit');

for (let i = first; i < last; i += BATCH) {
  const frames = await page.evaluate(([a, b, fps]) => {
    const out = [];
    const canvas = document.getElementById('video');
    for (let k = a; k < b; k++) {
      window.renderAt(k / fps);
      out.push(canvas.toDataURL('image/png'));
    }
    return out;
  }, [i, Math.min(last, i + BATCH), FPS]);
  for (const url of frames) {
    if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await once(ff.stdin, 'drain');
  }
  const n = Math.min(last, i + BATCH) - first;
  process.stdout.write(`\r${n}/${last - first} frames`);
}
ff.stdin.end();
const [code] = await done;
await browser.close();
server.close();
fs.rmSync(audio);
if (code) {
  console.error(`\nffmpeg failed (exit ${code})`);
  process.exit(1);
}
const mb = fs.statSync(OUT).size / 1e6;
console.log(`\nwrote ${path.relative(here, OUT)}: ${((last - first) / FPS).toFixed(1)} s, ${mb.toFixed(1)} MB, in ${((performance.now() - started) / 1000).toFixed(0)} s`);
