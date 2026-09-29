// Turns a forced-alignment result into src/alignment.js.
//
//   node tools/import-alignment.mjs path/to/lines-aligned.json
//
// The input is what the alignment run produced: for every lyric line its
// sung text, start and end, a confidence, and per-syllable onsets ("units"),
// plus lines sung that aren't on the lyric sheet ("extra_sung") and singing
// without lyrics ("non_lyric_vocals"). Lines are keyed by their sung text
// and how many times that text has come before, so the result survives
// edits to layout and wording elsewhere in lyrics.js.

import { readFile } from 'node:fs/promises';
import { writeAlignment } from './alignment-file.mjs';

const [file] = process.argv.slice(2);
if (!file) throw new Error('usage: node tools/import-alignment.mjs lines-aligned.json');
const data = JSON.parse(await readFile(file, 'utf8'));

const r2 = x => Math.round(x * 100) / 100;
const lines = [...data.lines, ...data.extra_sung.map(e => ({ ...e, extra: true }))].sort((a, b) => a.start - b.start);
const seen = {};
const entries = [];
for (const l of lines) {
  const key = l.sung.replace(/\s+/g, ' ').trim();
  seen[key] = (seen[key] || 0) + 1;
  const units = l.units || [];
  const entry = { start: r2(l.start), end: r2(l.end), conf: l.confidence };
  if (l.alt_start != null && Math.abs(l.alt_start - l.start) > 0.05) entry.alt = r2(l.alt_start);
  if (units.length) {
    // each syllable runs until the next one starts; the last until the line ends
    entry.sylls = units.map((u, i) => [r2(u.start), r2(i + 1 < units.length ? units[i + 1].start : u.end)]);
    const unsure = units.map((u, i) => (u.agree === false ? i : -1)).filter(i => i >= 0);
    if (unsure.length) entry.unsure = unsure;
  }
  if (l.extra) entry.extra = true;
  if (l.note) entry.note = l.note;
  entries.push([`${key}#${seen[key]}`, entry]);
}

await writeAlignment('src/alignment.js', entries, data.non_lyric_vocals.map(v => ({ t: r2(v.start), t1: r2(v.end), label: v.what })));
console.log(`${entries.length} lines, ${data.non_lyric_vocals.length} passages of other singing -> src/alignment.js`);
