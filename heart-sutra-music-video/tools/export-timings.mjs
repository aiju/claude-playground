// Writes syllable-timings.json from the timing editor's edits: for every
// sung line, each syllable's text with its start and end, and whether the
// line has been checked by ear.
//
//   node tools/export-timings.mjs edits.json [syllable-timings.json]
//
// The input is what the editor's "Download edits" button saves, or its
// database state document ({ values } or { data: { values } }).

import { readFile, writeFile } from 'node:fs/promises';
import { CUES } from '../src/lyrics.js';
import { plain } from '../src/schedule.js';
import { scheduleCue } from '../src/schedule.js';
import { getValues, setValues, sung, round } from '../src/edits.js';

const [file, out = 'syllable-timings.json'] = process.argv.slice(2);
if (!file) throw new Error('usage: node tools/export-timings.mjs edits.json [syllable-timings.json]');
const input = JSON.parse(await readFile(file, 'utf8'));
const values = input.values || (input.data && input.data.values);
if (!values) throw new Error(`${file} has no timing values`);

const before = getValues();
const unknown = setValues(values);
if (unknown.length) console.warn(`not in the lyrics any more, left out: ${unknown.join(', ')}`);

const lines = [];
for (const cue of CUES) {
  const entry = { text: plain(cue.text) };
  const was = before.lines[cue.key];
  if (sung(cue)) {
    entry.checked = !!(cue.align && cue.align.checked);
    entry.sylls = scheduleCue(cue).syllables.map(y => [y.text, round(y.t0), round(y.t1)]);
  }
  // when it's on screen, only where that changed
  if (cue.t0 !== was.t0 || cue.t1 !== was.t1) entry.shown = [round(cue.t0), round(cue.t1)];
  if (entry.sylls || entry.shown) lines.push([cue.key, entry]);
}

const edits = (input.log || []).filter(e => e.kind === 'edit').length;
const about = `Syllable timings corrected by ear in the timing editor (timing.html), exported ${new Date().toISOString().slice(0, 10)}${edits ? ` after ${edits} edits` : ''}. `
  + 'Keys are the line keys of src/alignment.js (and src/lyrics.js cue.key). sylls: [syllable, start, end] in song seconds, in the order '
  + 'schedule.js splits the line (kana morae; Sanskrit syllables of the hyphenated roman). checked: corrected by ear. '
  + 'shown: [t0, t1], when the line is on screen, given only where it changed from src/lyrics.js.';
await writeFile(out, `{\n  "about": ${JSON.stringify(about)},\n  "lines": {\n${lines.map(([k, e]) => `    ${JSON.stringify(k)}: ${JSON.stringify(e)}`).join(',\n')}\n  }\n}\n`);
console.log(`${lines.length} lines -> ${out}`);
