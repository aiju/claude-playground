// Builds the soundtrack in Node, the same way the player does, and writes it
// to out/soundtrack.wav (plus one file per stem with --stems), for checking
// levels without a browser.
//   node mix.js [--stems]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTimeline } from './src/timeline.js';
import { makeShots } from './src/scenes/index.js';
import { buildSoundtrack, RATE } from './src/audio/soundtrack.js';
import { readMp3 } from './src/audio/mp3.js';
import { wav } from './src/audio/wav.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'voice/manifest.json'), 'utf8'));
const T = buildTimeline(manifest);
const shots = makeShots(T);

const clips = {};
for (const id of Object.keys(T.lines)) {
  const { samples } = readMp3(path.join(here, 'voice', `${id}.mp3`), RATE);
  clips[id] = Float32Array.from(samples, (s) => s / 32768);
}

const t0 = performance.now();
const stems = buildSoundtrack({ T, shots, clips });
console.log(`built in ${((performance.now() - t0) / 1000).toFixed(2)} s`);

const toPcm = (f) => Int16Array.from(f, (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767))));
const dbfs = (x) => (20 * Math.log10(x + 1e-9)).toFixed(1);
const mixed = new Float32Array(stems.voice.length);
for (const s of Object.values(stems)) for (let i = 0; i < mixed.length; i++) mixed[i] += s[i];

fs.mkdirSync(path.join(here, 'out'), { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(here, 'out', `${name}.wav`), wav({ rate: RATE, samples: toPcm(data) }));
write('soundtrack', mixed);
if (process.argv.includes('--stems')) for (const [k, s] of Object.entries(stems)) write(`soundtrack-${k}`, s);

for (const [k, s] of Object.entries({ ...stems, mix: mixed })) {
  let peak = 0, ss = 0;
  for (const x of s) {
    peak = Math.max(peak, Math.abs(x));
    ss += x * x;
  }
  console.log(`${k.padEnd(6)} peak ${dbfs(peak)} dBFS, rms ${dbfs(Math.sqrt(ss / s.length))} dBFS`);
}
console.log(`wrote out/soundtrack.wav (${(mixed.length / RATE).toFixed(1)} s)`);
