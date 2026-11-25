// Screenshot helper: node tools/shot.js out.png [width] [height] [seconds] [js-to-eval]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [out, w, h, secs, js, scheme] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w || 1280, height: +h || 800 }, deviceScaleFactor: 1, colorScheme: scheme || 'light' });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);
  if (js) await page.evaluate(js);
  await page.waitForTimeout((+secs || 3) * 1000);
  await page.screenshot({ path: out });
  console.log(JSON.stringify(await page.evaluate(() => window.__world().stats)));
  await browser.close();
})();
