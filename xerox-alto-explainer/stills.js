// Renders style frames to out/stills/*.png at 1080 x 1920.
//   node stills.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out', 'stills');
fs.mkdirSync(OUT, { recursive: true });

const STILLS = [
  ['title-scanning', 'title', 0.62],
  ['title', 'title', 1],
  ['memory', 'memory', { fill: 1 }],
  ['microword', 'microword', {}],
  ['scanline', 'scanline', {}],
];

// Serve src/ from a fake origin so the page can use ES modules.
const ORIGIN = 'http://alto.local/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.route(`${ORIGIN}**`, (route) => {
  const rel = new URL(route.request().url()).pathname.slice(1) || 'page.html';
  const file = path.join(here, 'src', rel);
  route.fulfill({ body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
});
await page.goto(`${ORIGIN}page.html`);
await page.waitForFunction(() => window.ready === true);
await page.evaluate(() => document.fonts.ready);

for (const [file, scene, arg] of STILLS) {
  await page.evaluate(([s, a]) => window.renderStill(s, a), [scene, arg]);
  await page.locator('#out').screenshot({ path: path.join(OUT, `${file}.png`) });
  console.log(`wrote out/stills/${file}.png`);
}
await browser.close();
