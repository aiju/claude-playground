// Downloads the two fonts, subset to exactly the characters the lyrics (and the credits) use,
// from the Google Fonts API. Both fonts are under the SIL Open Font License.
//
//   node tools/fetch-fonts.mjs            # the fonts the video uses
//   node tools/fetch-fonts.mjs "Yuji Boku" ja   # try another family
//
// Re-run after changing the lyrics in src/lyrics.js.

import { writeFile, mkdir } from 'node:fs/promises';
import { charset } from '../src/lyrics.js';

export const FONTS = [
  { family: 'Yuji Syuku', script: 'ja', file: 'fonts/brush-ja.ttf' },
  { family: 'Yatra One', script: 'sa', file: 'fonts/devanagari.ttf' },
];

async function fetchSubset(family, text, file) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`;
  // An old user agent gets a plain TTF rather than woff2 slices.
  const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/4.0' } })).text();
  const m = css.match(/src:\s*url\(([^)]+)\)/);
  if (!m) throw new Error(`no font url for ${family}:\n${css}`);
  const buf = Buffer.from(await (await fetch(m[1])).arrayBuffer());
  await writeFile(file, buf);
  console.log(`${family} -> ${file} (${(buf.length / 1024).toFixed(0)} KB, ${[...text].length} chars)`);
}

await mkdir('fonts', { recursive: true });
const [family, script] = process.argv.slice(2);
if (family) {
  const extra = script === 'ja' ? 'あいうえお永' : 'अआकखग';
  await fetchSubset(family, charset(script) + extra, `fonts/try-${family.replace(/\s+/g, '-').toLowerCase()}.ttf`);
} else {
  for (const f of FONTS) await fetchSubset(f.family, charset(f.script), f.file);
}
