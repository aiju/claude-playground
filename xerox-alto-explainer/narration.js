// Joins the TTS clips from tts.js into one narration track, with short gaps
// between lines and longer ones between the sections of script.md.
//   node narration.js [--voice out/voice] [--out out/narration]
//
// Writes <out>.wav and <out>.json, which gives each line's start and end in
// seconds. That's a first timeline for the video, before the pictures get any
// say in the pacing.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseWav, wav } from './src/audio/wav.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const VOICE = path.resolve(here, arg('voice', 'out/voice'));
const OUT = path.resolve(here, arg('out', 'out/narration'));

const LEAD_IN = 0.5;       // before the first line
const LINE_GAP = 0.35;     // between lines in the same section
const SECTION_GAP = 0.8;   // between sections
const TAIL = 1.0;          // after the last line
const PAD = [0.04, 0.12];  // silence kept around each clip's speech

// Which section each line is in, from the "### 3. …" headings.
const sections = {};
let section = 0;
for (const l of fs.readFileSync(path.join(here, 'script.md'), 'utf8').split('\n')) {
  const h = /^### (\d+)\./.exec(l);
  if (h) section = Number(h[1]);
  const n = /^> \*\*(N\d+)\*\*/.exec(l);
  if (n) sections[n[1]] = section;
}

const manifest = JSON.parse(fs.readFileSync(path.join(VOICE, 'manifest.json'), 'utf8'));
const ids = Object.keys(sections);
const missing = ids.filter((id) => !manifest.lines[id]);
if (missing.length) throw new Error(`no clip for ${missing.join(', ')}; run tts.js first`);

let rate = 0;
const clips = ids.map((id) => {
  const audio = parseWav(fs.readFileSync(path.join(VOICE, `${id}.wav`)));
  rate ||= audio.rate;
  if (audio.rate !== rate) throw new Error(`${id}.wav is ${audio.rate} Hz, the others ${rate} Hz`);
  const { speechStart, speechEnd } = manifest.lines[id];
  const from = Math.max(0, Math.round((speechStart - PAD[0]) * rate));
  const to = Math.min(audio.samples.length, Math.round((speechEnd + PAD[1]) * rate));
  return { id, section: sections[id], samples: audio.samples.subarray(from, to) };
});

const timeline = [];
let t = LEAD_IN;
clips.forEach((c, i) => {
  if (i) t += c.section === clips[i - 1].section ? LINE_GAP : SECTION_GAP;
  c.at = Math.round(t * rate);
  t = (c.at + c.samples.length) / rate;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  timeline.push({ id: c.id, section: c.section, start: r3(c.at / rate + PAD[0]), end: r3(t - PAD[1]) });
});
const total = Math.round((t + TAIL) * rate);

const samples = new Int16Array(total);
for (const c of clips) samples.set(c.samples, c.at);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(`${OUT}.wav`, wav({ rate, samples }));
fs.writeFileSync(`${OUT}.json`, JSON.stringify({ duration: Math.round((total / rate) * 1000) / 1000, lines: timeline }, null, 2) + '\n');

const mmss = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
for (const l of timeline) console.log(`${l.id.padEnd(3)}  §${l.section}  ${mmss(l.start)}–${mmss(l.end)}`);
console.log(`wrote ${path.relative(here, OUT)}.wav and .json: ${mmss(total / rate)}`);
