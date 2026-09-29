// Renders the video (or a stretch of it) to mp4 with headless Chromium and ffmpeg.
//
//   node tools/render.mjs                              # the whole song
//   node tools/render.mjs --from 212 --to 230 --out out/enso.mp4
//   options: --fps 30 --w 1920 --h 1080 --jobs 1 --gpu
//
// --jobs renders frames in several browsers at once (only worth it when the
// renderer isn't already using every core). --gpu renders on this machine's
// GPU in a visible browser window instead of on the CPU. Needs ffmpeg on PATH
// (or FFMPEG=/path/to/ffmpeg).

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { serve } from './serve.mjs';
import { launchOptions } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const from = +opt('--from', 0);
const to = +opt('--to', 257.8);
const fps = +opt('--fps', 30);
const w = +opt('--w', 1920), h = +opt('--h', 1080);
const jobs = +opt('--jobs', 1);
const out = opt('--out', 'out/heart-sutra.mp4');
const gpu = args.includes('--gpu');

const frames = Math.round((to - from) * fps);
await mkdir(dirname(out), { recursive: true });

const ffmpeg = spawn(process.env.FFMPEG || 'ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-ss', String(from), '-t', String(frames / fps), '-i', 'audio/song.m4a',
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffmpegDone = new Promise((resolve, reject) => ffmpeg.on('close', code => (code ? reject(new Error(`ffmpeg exited with ${code}`)) : resolve())));

const server = await serve(8766);
// one browser per job: tabs in the same browser share a single GPU process
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

// frames come back out of order from the tabs; hand them to ffmpeg in order
const done = new Map();
let waiting = null;
async function worker(k, page) {
  for (let i = k; i < frames; i += jobs) {
    const t = from + i / fps;
    const url = await page.evaluate(async t => {
      await window.mv.renderAt(t);
      return document.getElementById('view').toDataURL('image/jpeg', 0.95);
    }, t);
    done.set(i, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    if (waiting) waiting();
    // don't run far ahead of the writer
    while (i - next > jobs * 8) await new Promise(r => setTimeout(r, 50));
  }
}

let next = 0;
const pages = await Promise.all(Array.from({ length: jobs }, openPage));
const started = Date.now();
const workers = pages.map((page, k) => worker(k, page));
while (next < frames) {
  if (!done.has(next)) { await new Promise(r => { waiting = r; }); waiting = null; continue; }
  const buf = done.get(next);
  done.delete(next);
  if (!ffmpeg.stdin.write(buf)) await new Promise(r => ffmpeg.stdin.once('drain', r));
  next++;
  if (next % fps === 0 || next === frames) {
    const per = (Date.now() - started) / next / 1000;
    const eta = Math.round(per * (frames - next));
    console.log(`${next}/${frames} frames  ${per.toFixed(2)} s/frame  eta ${Math.floor(eta / 60)}m${String(eta % 60).padStart(2, '0')}s`);
  }
}
await Promise.all(workers);
ffmpeg.stdin.end();
await ffmpegDone;
await Promise.all(browsers.map(b => b.close()));
server.close();
console.log(`wrote ${out}`);
