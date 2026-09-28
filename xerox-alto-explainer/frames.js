// Grabs single frames from the preview in headless Chromium, for checking
// the pictures without rendering the video.
//   node frames.js 12.5 47.2            frames at those times: out/frames/t0012.50.png
//   node frames.js --sheet [--every 1] [--from 40 --to 70]
//                                       a contact sheet: out/frames/sheet.png
//   node frames.js --perf               drawing time per frame over the whole video

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { serve } from './serve.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out', 'frames');
fs.mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : fallback;
};

const server = await serve(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
page.on('console', (m) => m.type() === 'error' && console.error('page:', m.text()));
page.on('pageerror', (e) => console.error('page:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.framesReady === true, null, { timeout: 60000 });
const duration = await page.evaluate(() => document.getElementById('scrub').getAttribute('aria-valuemax')).then(Number);

// The canvas's pixels at 540 x 960, as a PNG data URL.
const grab = (t) => page.evaluate((t) => {
  window.renderAt(t);
  return document.getElementById('video').toDataURL('image/png');
}, t);
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

if (argv.includes('--perf')) {
  const r = await page.evaluate((d) => {
    const times = [];
    for (let t = 0; t < d; t += 1 / 30) {
      const t0 = performance.now();
      window.renderAt(t);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return { frames: times.length, median: times[times.length >> 1], p95: times[Math.floor(times.length * 0.95)], max: times.at(-1) };
  }, duration);
  console.log(`${r.frames} frames: median ${r.median.toFixed(1)} ms, 95th percentile ${r.p95.toFixed(1)} ms, worst ${r.max.toFixed(1)} ms`);
} else if (argv.includes('--sheet')) {
  const every = opt('every', 2);
  const from = opt('from', 0);
  const to = Math.min(duration, opt('to', duration));
  const times = [];
  for (let t = from; t <= to + 1e-6; t += every) times.push(Math.round(t * 100) / 100);
  const shots = [];
  for (const t of times) shots.push([t, await grab(t)]);
  // Lay the frames out at half size with their times under them.
  const sheet = await page.evaluate(async (shots) => {
    const cols = Math.min(10, shots.length);
    const w = 270, h = 480, lab = 22;
    const c = document.createElement('canvas');
    c.width = cols * w;
    c.height = Math.ceil(shots.length / cols) * (h + lab);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = true;
    for (let i = 0; i < shots.length; i++) {
      const img = new Image();
      img.src = shots[i][1];
      await img.decode();
      const x = (i % cols) * w, y = Math.floor(i / cols) * (h + lab);
      g.drawImage(img, x, y, w - 4, h);
      g.fillStyle = '#000';
      g.font = 'bold 16px monospace';
      const t = shots[i][0];
      g.fillText(`${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`, x + 4, y + h + 17);
    }
    return c.toDataURL('image/png');
  }, shots);
  save(path.join(OUT, 'sheet.png'), sheet);
  console.log(`wrote out/frames/sheet.png (${times.length} frames, ${from}–${to} s every ${every} s)`);
} else {
  for (const a of argv) {
    const t = Number(a);
    if (Number.isNaN(t)) continue;
    const file = path.join(OUT, `t${t.toFixed(2).padStart(7, '0')}.png`);
    save(file, await grab(t));
    console.log(`wrote ${path.relative(here, file)}`);
  }
}

await browser.close();
server.close();
