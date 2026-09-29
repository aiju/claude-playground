// Renders single frames to PNG with headless Chromium.
//
//   node tools/stills.mjs 83.5 150 212      # frames at those times
//   node tools/stills.mjs --storyboard      # one frame per storyboard shot
//   options: --out dir (default out/stills), --w 1920 --h 1080, --gpu
//

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve } from './serve.mjs';
import { launchOptions } from './browser.mjs';

export const STORYBOARD = [
  [6.0, 'singing-bowl'],
  [18.5, 'prajna'],
  [31.0, 'descent'],
  [40.5, 'sea-floor'],
  [47.8, 'the-eye'],
  [53.0, 'wind-and-sand'],
  [60.5, 'five-lights'],
  [70.5, 'full-and-empty'],
  [84.0, 'form-is-emptiness'],
  [94.0, 'universe-in-a-palm'],
  [102.0, 'wheel-of-light'],
  [114.2, 'shakuhachi-and-taiko'],
  [125.5, 'cranes'],
  [138.0, 'chains-upside-down'],
  [148.5, 'far-shore'],
  [156.5, 'neither-nor'],
  [165.5, 'crossing'],
  [173.5, 'other-shore'],
  [187.5, 'form-is-emptiness-ii'],
  [196.5, 'unravelling'],
  [204.0, 'wheel-of-light-ii'],
  [247.8, 'enso'],
  [259.2, 'credits'],
];

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : def; };
const out = opt('--out', 'out/stills');
const w = +opt('--w', 1920), h = +opt('--h', 1080);
const board = args.includes('--storyboard');
const shots = board ? STORYBOARD : args.filter(a => !a.startsWith('--')).map(t => [+t, `t${(+t).toFixed(1)}`]);

await mkdir(out, { recursive: true });
const server = await serve(8765);
const browser = await chromium.launch(launchOptions({ gpu: args.includes('--gpu') }));
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.error('[page error]', e.message));
await page.goto(`http://127.0.0.1:8765/index.html?capture&w=${w}&h=${h}`);
await page.evaluate(() => window.mv.ready);

page.setDefaultTimeout(0);
for (const [t, name] of shots) {
  const t0 = Date.now();
  const url = await page.evaluate(async t => {
    await window.mv.renderAt(t);
    return document.getElementById('view').toDataURL('image/png');
  }, t);
  const file = `${out}/${String(Math.floor(t)).padStart(3, '0')}-${name}.png`;
  await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${file}  (${Date.now() - t0} ms)`);
}
await browser.close();
server.close();
