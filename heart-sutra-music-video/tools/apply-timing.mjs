// Writes timings from the timing editor back into the source files:
// syllables into src/alignment.js, when lines are on screen into
// src/lyrics.js, and scenes, beats and sections into src/timeline.js.
//
//   node tools/apply-timing.mjs timings.json
//
// The input is what the editor's "Download" button saves, or the `values`
// of its database state: { lines, scenes, sections, other } as described
// in src/edits.js. Units it leaves out keep their current values. Numbers
// are only rewritten where they changed, so the diff shows just the edits.
// Afterwards it loads the files again and checks they give the same values.

import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { ALIGN } from '../src/alignment.js';
import { CUES } from '../src/lyrics.js';
import { SCENES } from '../src/timeline.js';
import { getValues, round } from '../src/edits.js';
import { writeAlignment } from './alignment-file.mjs';

const [file] = process.argv.slice(2);
if (!file) throw new Error('usage: node tools/apply-timing.mjs timings.json');
const input = JSON.parse(await readFile(file, 'utf8'));
const values = input.values || input;
const want = { ...getValues(), ...values, lines: { ...getValues().lines, ...values.lines }, scenes: { ...getValues().scenes, ...values.scenes } };

const r = x => round(x);
const norm = v => JSON.stringify(v, (k, x) => (typeof x === 'number' ? r(x) : x));
const num = x => (Number.isInteger(r(x)) ? r(x).toFixed(1) : String(r(x)));
// replace the number in `m` (a matched 'name: 12.3') if it changed
const renum = (text, name, v) => text.replace(new RegExp(`(${name}: )(-?[\\d.]+)`), (m, a, old) => (v == null || r(+old) === r(v) ? m : a + num(v)));

// ---------------------------------------------------------------- alignment.js
{
  const now = getValues();
  const order = ['start', 'end', 'conf', 'checked', 'alt', 'sylls', 'unsure', 'extra', 'note'];
  const entries = Object.entries(ALIGN).map(([key, e]) => {
    const v = want.lines[key];
    if (!v || !v.sylls || norm(v) === norm(now.lines[key])) return [key, e];
    const sylls = v.sylls.map(([a, b]) => [r(a), r(b)]);
    const out = { ...e, start: sylls[0][0], end: sylls[sylls.length - 1][1], sylls };
    if (v.checked) out.checked = true; else delete out.checked;
    return [key, Object.fromEntries(Object.keys(out).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(k => [k, out[k]]))];
  });
  const other = want.other.map(o => ({ t: r(o.t), t1: r(o.t1), label: o.label }));
  await writeAlignment('src/alignment.js', entries, other);
}

// ---------------------------------------------------------------- lyrics.js
{
  let src = await readFile('src/lyrics.js', 'utf8');
  const lines = src.split('\n');
  const at = lines.map((l, i) => (/^\s*\{ t0: [\d.]+, t1: [\d.]+,/.test(l) ? i : -1)).filter(i => i >= 0);
  if (at.length !== CUES.length) throw new Error(`lyrics.js: found ${at.length} cue lines for ${CUES.length} cues`);
  CUES.forEach((cue, n) => {
    const v = want.lines[cue.key];
    lines[at[n]] = renum(renum(lines[at[n]], 't0', v.t0), 't1', v.t1);
  });
  await writeFile('src/lyrics.js', lines.join('\n'));
}

// ---------------------------------------------------------------- timeline.js
{
  let src = await readFile('src/timeline.js', 'utf8');
  const a = src.indexOf('export const SCENES = [');
  const z = src.indexOf('\n];', a);
  let block = src.slice(a, z);
  const starts = [...block.matchAll(/\{ name: '/g)].map(m => m.index);
  if (starts.length !== SCENES.length) throw new Error(`timeline.js: found ${starts.length} scenes for ${SCENES.length}`);
  const parts = starts.map((s, i) => block.slice(s, starts[i + 1] ?? block.length));
  const head = block.slice(0, starts[0]);
  block = head + parts.map((part, i) => {
    const v = want.scenes[SCENES[i].name];
    if (!part.startsWith(`{ name: '${SCENES[i].name.replace(/'/g, "\\'")}'`)) throw new Error(`timeline.js: scene ${i} isn't ${SCENES[i].name}`);
    let [before, beats = ''] = part.split(/(?=beats: \[)/);
    before = renum(renum(before, 't0', v.t0), 'tr', v.tr);
    let k = 0;
    beats = beats.replace(/\{ t: (-?[\d.]+)(, t1: (-?[\d.]+))?/g, m => {
      const b = v.beats[k++];
      return b ? renum(renum(m, 't', b.t), 't1', b.t1) : m;
    });
    if (k !== v.beats.length) throw new Error(`timeline.js: ${SCENES[i].name} has ${k} beats, the edits ${v.beats.length}`);
    return before + beats;
  }).join('');
  src = src.slice(0, a) + block + src.slice(z);

  const s0 = src.indexOf('export const SECTIONS = [');
  const s1 = src.indexOf('\n];', s0);
  const q = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const sections = want.sections.map(s => `  { t0: ${num(s.t0)}, name: ${q(s.name)} },`).join('\n');
  src = `${src.slice(0, s0)}export const SECTIONS = [\n${sections}${src.slice(s1)}`;
  await writeFile('src/timeline.js', src);
}

// ---------------------------------------------------------------- check
const got = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
  "import { getValues } from './src/edits.js'; process.stdout.write(JSON.stringify(getValues()));"], { encoding: 'utf8' }));
const bad = [];
for (const [key, v] of Object.entries(want.lines)) if (norm(got.lines[key]) !== norm(v)) bad.push(`line ${key}`);
for (const [name, v] of Object.entries(want.scenes)) if (norm(got.scenes[name]) !== norm(v)) bad.push(`scene ${name}`);
if (norm(got.sections) !== norm(want.sections)) bad.push('sections');
if (norm(got.other) !== norm(want.other)) bad.push('other singing');
if (bad.length) { console.error(`written, but these don't read back the same: ${bad.join(', ')}`); process.exit(1); }
console.log('wrote src/alignment.js, src/lyrics.js and src/timeline.js; they read back the same');
