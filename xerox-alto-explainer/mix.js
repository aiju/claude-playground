// Builds the soundtrack in Node, the same way the player does, and writes it
// to out/soundtrack.wav (plus one file per stem with --stems), for checking
// levels without a browser. render.js uses buildMix for the final video.
//   node mix.js [--stems]

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { buildTimeline } from './src/timeline.js';
import { makeShots } from './src/scenes/index.js';
import { buildSoundtrack, RATE } from './src/audio/soundtrack.js';
import { readMp3 } from './src/audio/mp3.js';
import { wav } from './src/audio/wav.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function buildMix() {
  const manifest = JSON.parse(fs.readFileSync(path.join(here, 'voice/manifest.json'), 'utf8'));
  const T = buildTimeline(manifest);
  const clips = {};
  for (const id of Object.keys(T.lines)) {
    const { samples } = readMp3(path.join(here, 'voice', `${id}.mp3`), RATE);
    clips[id] = Float32Array.from(samples, (s) => s / 32768);
  }
  const stems = buildSoundtrack({ T, shots: makeShots(T), clips });
  const mixed = new Float32Array(stems.voice.length);
  for (const s of Object.values(stems)) for (let i = 0; i < mixed.length; i++) mixed[i] += s[i];
  return { T, stems, mixed };
}

const toPcm = (f) => Int16Array.from(f, (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767))));
export const writeWav = (file, data) => fs.writeFileSync(file, wav({ rate: RATE, samples: toPcm(data) }));

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t0 = performance.now();
  const { stems, mixed } = buildMix();
  console.log(`built in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  fs.mkdirSync(path.join(here, 'out'), { recursive: true });
  writeWav(path.join(here, 'out', 'soundtrack.wav'), mixed);
  if (process.argv.includes('--stems')) for (const [k, s] of Object.entries(stems)) writeWav(path.join(here, 'out', `soundtrack-${k}.wav`), s);
  const dbfs = (x) => (20 * Math.log10(x + 1e-9)).toFixed(1);
  for (const [k, s] of Object.entries({ ...stems, mix: mixed })) {
    let peak = 0, ss = 0;
    for (const x of s) {
      peak = Math.max(peak, Math.abs(x));
      ss += x * x;
    }
    console.log(`${k.padEnd(6)} peak ${dbfs(peak)} dBFS, rms ${dbfs(Math.sqrt(ss / s.length))} dBFS`);
  }
  console.log(`wrote out/soundtrack.wav (${(mixed.length / RATE).toFixed(1)} s)`);
}
