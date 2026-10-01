// Renders stills of the model in a headless browser, to check it without
// opening a window. WebGL runs on the CPU (SwiftShader), so each still takes
// a few seconds.
//
//   node tools/stills.mjs [view ...] [--size=1600x900] [--gpu]
//
// Views are the camera presets in src/views.js (front, side, cab, saloon,
// tunnel, trackside, platform, …); by default it renders a handful of them. Each still
// can also carry URL options after a colon, e.g. `front:doors=open`,
// `platform:stopped`, `cab:s=880&dest=Brixton` (s is how far along the line
// the train is) or `front:cam=2,1.5,4&at=0,1.4,0` (a camera position and what
// it looks at). Stills go to out/stills/.

import { chromium } from 'playwright-core';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(PROJECT, 'out', 'stills');
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const args = process.argv.slice(2);
const gpu = args.includes('--gpu');
const sizeArg = args.find(a => a.startsWith('--size='));
const [width, height] = sizeArg ? sizeArg.slice(7).split('x').map(Number) : [1600, 900];
const views = args.filter(a => !a.startsWith('--'));
if (!views.length) views.push('front', 'side', 'along', 'bogie', 'saloon', 'cab', 'tunnel', 'trackside', 'platform:stopped', 'doorway:stopped');

await mkdir(OUT, { recursive: true });
const port = 8000 + Math.floor(Math.random() * 1000);
const server = await serve(port);
const exe = process.env.CHROMIUM || (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : null);
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : { channel: 'chrome' }),
  headless: !gpu,
  args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

try {
  const page = await browser.newPage({ viewport: { width, height } });
  // the page loads three.js from a CDN; serve it from node_modules instead,
  // so that stills work offline and match the pinned version
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, async (route) => {
    const rest = route.request().url().replace(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, '');
    try {
      const body = await readFile(join(PROJECT, 'node_modules', 'three', rest));
      await route.fulfill({ body, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
    } catch {
      await route.fulfill({ status: 404, body: `three.js file not found: ${rest} (run npm install)` });
    }
  });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  for (const spec of views) {
    const [view, opts = ''] = spec.split(':');
    const query = new URLSearchParams({ view, still: '1' });
    for (const kv of opts.split('&').filter(Boolean)) {
      const [k, v = '1'] = kv.split('=');
      query.set(k, v);
    }
    const started = Date.now();
    await page.goto(`http://127.0.0.1:${port}/?${query}`);
    await page.waitForFunction(() => window.tubeTrain?.stillReady, null, { timeout: 180000, polling: 250 });
    const file = join(OUT, `${spec.replace(/[^a-z0-9=-]+/gi, '_').slice(0, 80)}.png`);
    await page.locator('#view').screenshot({ path: file });
    console.log(`${file}  (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
} finally {
  await browser.close();
  server.close();
}
