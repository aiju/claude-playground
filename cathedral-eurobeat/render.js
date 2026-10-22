// Renders the score to out/cathedral-overdrive.wav (and .mp3 if ffmpeg or lamejs is
// available).
//   node render.js [--stems] [--from BEAT --to BEAT] [--out DIR]

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { SR, stereo, roomIR, reverb, pingPong, compress, limit, encodeWav, db, eqStereo, softClip, rng } from './src/dsp.js';
import { organNote } from './src/organ.js';
import * as S from './src/synths.js';
import * as P from './src/percussion.js';
import { buildScore, TEMPO, END_BEAT, FORM } from './src/score.js';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const STEMS = args.includes('--stems');
const OUT = opt('--out', 'out');
const FROM = parseFloat(opt('--from', '0'));
const TO = parseFloat(opt('--to', String(END_BEAT)));
const NAME = 'cathedral-overdrive';
fs.mkdirSync(OUT, { recursive: true });

// ---- tempo map: constant or linearly ramping bpm between points ---------------------
function beatToSec(b) {
  let t = 0;
  for (let i = 0; i < TEMPO.length; i++) {
    const p = TEMPO[i];
    const q = TEMPO[i + 1];
    if (b <= p.beat) break;
    const end = q ? Math.min(b, q.beat) : b;
    const x = end - p.beat;
    if (p.ramp && q) {
      const k = (q.bpm - p.bpm) / (q.beat - p.beat);
      t += (60 / k) * Math.log((p.bpm + k * x) / p.bpm);
    } else t += (60 * x) / p.bpm;
  }
  return t;
}

const t0 = beatToSec(FROM);
const tail = TO >= END_BEAT ? 9 : 2.5;
const LEN = Math.round((beatToSec(TO) - t0 + tail) * SR);
const smp = (beat) => Math.round((beatToSec(beat) - t0) * SR);
const secs = (n) => n / SR;

// ---- buses --------------------------------------------------------------------------
// gain: fader. cath/hall/delay: send levels. duck: sidechain depth from the kick.
const BUS = {
  organ: { gain: 0.62, dry: 0.42, cath: 1.5 },
  organBand: { gain: 0.95, dry: 1.0, cath: 0.4, hall: 0.15, duck: 0.15 },
  bells: { gain: 1.0, dry: 0.6, cath: 1.2 },
  timp: { gain: 0.55, dry: 0.8, cath: 0.6, hall: 0.1 },
  harpsi: { gain: 1.25, cath: 0.15, hall: 0.22, duck: 0.15 },
  lead: { gain: 0.66, hall: 0.4, cath: 0.18, delay: 0.3, duck: 0.15 },
  pulse: { gain: 0.95, hall: 0.35, delay: 0.35, duck: 0.1 },
  brass: { gain: 0.95, hall: 0.4, cath: 0.06, duck: 0.3 },
  strings: { gain: 0.75, hall: 0.45, cath: 0.1, duck: 0.4 },
  arp: { gain: 0.75, hall: 0.22, delay: 0.18, duck: 0.35 },
  piano: { gain: 0.8, hall: 0.32, duck: 0.25 },
  bass: { gain: 0.62, duck: 0.45 },
  kick: { gain: 0.55 },
  snare: { gain: 1.15, hall: 0.4, cath: 0.1 },
  hats: { gain: 1.0, hall: 0.08 },
  cym: { gain: 0.6, hall: 0.15 },
  orch: { gain: 0.8, hall: 0.3, cath: 0.08 },
  finale: { gain: 0.8, hall: 0.3, cath: 1.0 },
  fx: { gain: 0.7, hall: 0.3 },
};

const DEFAULT_BUS = {
  organ: 'organ', bell: 'bells', timp: 'timp', timproll: 'timp', harpsi: 'harpsi', lead: 'lead', pulse: 'pulse',
  brass: 'brass', bass: 'bass', pluck: 'arp', piano: 'piano', strings: 'strings', orch: 'orch',
  sweep: 'fx', revcym: 'cym', kick: 'kick', snare: 'snare', clap: 'snare', tom: 'snare', hat: 'hats', ohat: 'hats', crash: 'cym',
};

const phrase = (e) =>
  e.notes.map((n) => {
    const s = smp(n.t);
    const len = Math.max(1, smp(n.t + n.d * (n.stacc ? 0.5 : 1)) - s);
    return { s, n: len, m: n.m, v: n.v, bend: n.bend };
  });

const INST = {
  organ: (o, s, n, e) => organNote(o, s, n, { m: e.m, vel: e.vel ?? 1, stops: e.stops, pan: e.pan ?? null, trem: e.trem || 0, t0: secs(s) + t0 }),
  bell: (o, s, n, e) => P.churchBell(o, s, { m: e.m, v: e.v, pan: e.pan || 0, len: Math.max(4, secs(n)) }),
  timp: (o, s, n, e) => P.timpani(o, s, e),
  timproll: (o, s, n, e) => P.timpaniRoll(o, s, n, e),
  harpsi: (o, s, n, e) => P.harpsichord(o, s, n, e),
  lead: (o, s, n, e) => S.supersawPhrase(o, phrase(e), e.opts),
  pulse: (o, s, n, e) => S.pulsePhrase(o, phrase(e), e.opts),
  brass: (o, s, n, e) => S.brass(o, s, n, e),
  bass: (o, s, n, e) => S.bass(o, s, n, e),
  pluck: (o, s, n, e) => S.pluck(o, s, n, e),
  piano: (o, s, n, e) => S.housePiano(o, s, n, e),
  strings: (o, s, n, e) => S.strings(o, s, n, e),
  orch: (o, s, n, e) => S.orchHit(o, s, e),
  sweep: (o, s, n, e) => S.sweep(o, s, n, e),
  kick: (o, s, n, e) => P.kick(o, s, e),
  snare: (o, s, n, e) => P.snare(o, s, e),
  clap: (o, s, n, e) => P.clap(o, s, e),
  tom: (o, s, n, e) => P.tom(o, s, e),
  hat: (o, s, n, e) => P.hat(o, s, e),
  ohat: (o, s, n, e) => P.openHat(o, s, e),
  crash: (o, s, n, e) => P.crash(o, s, e),
  revcym: (o, s, n, e) => P.revCymbal(o, s, n, e),
};

// ---- render -------------------------------------------------------------------------
const started = Date.now();
const score = buildScore();
console.log(`${score.length} events, ${(LEN / SR).toFixed(1)} s`);
for (const [name, b] of FORM) console.log(`  ${beatToSec(b).toFixed(1).padStart(6)} s  ${name}`);

const byBus = {};
for (const e of score) {
  if (e.t >= TO || e.t + e.d < FROM - 24) continue;
  const bus = e.bus || DEFAULT_BUS[e.inst];
  if (!BUS[bus]) throw new Error(`no bus ${bus} for ${e.inst}`);
  (byBus[bus] ||= []).push(e);
}

// Sidechain envelope from the kick: fast attack, ~140 ms recovery.
const side = new Float32Array(LEN);
for (const e of byBus.kick || []) {
  const s = smp(e.t);
  const amt = Math.min(1, (e.v ?? 100) / 105);
  for (let i = 0; i < 0.5 * SR; i++) {
    const idx = s + i;
    if (idx < 0) continue;
    if (idx >= LEN) break;
    const t = i / SR;
    const v = amt * Math.min(1, t / 0.004) * Math.exp(-t / 0.11);
    if (v > side[idx]) side[idx] = v;
  }
}

const dry = stereo(LEN);
const sends = { cath: stereo(LEN), hall: stereo(LEN), delay: stereo(LEN) };
const human = rng(31337);
// Sequenced parts get a little velocity variation so repeated notes aren't identical.
const LOOSE_VEL = new Set(['hat', 'ohat', 'pluck', 'brass', 'piano', 'bass', 'harpsi', 'clap', 'strings', 'snare']);

for (const [bus, evs] of Object.entries(byBus)) {
  const t = Date.now();
  const out = stereo(LEN);
  for (const e of evs) {
    // Organ and harpsichord are played by hand: a few ms of looseness.
    const loose = e.inst === 'organ' || e.inst === 'harpsi' ? (human() - 0.5) * 0.008 * SR : 0;
    const s = smp(e.t) + Math.round(loose);
    const n = Math.max(1, smp(e.t + e.d) - smp(e.t));
    const ev = LOOSE_VEL.has(e.inst) && e.v ? { ...e, v: e.v * (0.93 + 0.14 * human()) } : e;
    INST[e.inst](out, s, n, ev);
  }
  const cfg = BUS[bus];
  if (cfg.duck) for (let i = 0; i < LEN; i++) {
    const g = 1 - cfg.duck * side[i];
    out.L[i] *= g;
    out.R[i] *= g;
  }
  if (bus === 'bass') eqStereo(out, 'hp', 38, 0.7);
  if (bus === 'kick') eqStereo(out, 'hp', 35, 0.7);
  if (bus === 'organ') {
    // Heard from the nave: some air absorption takes the edge off the mixtures.
    eqStereo(out, 'hp', 24, 0.7);
    eqStereo(out, 'lowshelf', 70, 0.7, -1.5);
    eqStereo(out, 'peak', 3200, 0.8, -3);
    eqStereo(out, 'highshelf', 5000, 0.7, -3.5);
  }
  if (bus === 'organBand') {
    // In the band the synth bass owns the low end.
    eqStereo(out, 'hp', 110, 0.7);
    eqStereo(out, 'peak', 400, 0.9, -2);
    eqStereo(out, 'peak', 900, 0.8, -2);
    eqStereo(out, 'peak', 3200, 0.8, -3);
    eqStereo(out, 'highshelf', 6000, 0.7, -2.5);
  }
  if (bus === 'hats' || bus === 'cym') eqStereo(out, 'hp', 3000, 0.7);
  if (bus === 'lead') {
    eqStereo(out, 'peak', 3500, 0.9, -3);
    eqStereo(out, 'highshelf', 6500, 0.7, -2);
  }
  if (bus === 'brass') eqStereo(out, 'peak', 3500, 0.8, -3.5);
  for (let i = 0; i < LEN; i++) {
    const l = out.L[i] * cfg.gain;
    const r = out.R[i] * cfg.gain;
    dry.L[i] += l * (cfg.dry ?? 1);
    dry.R[i] += r * (cfg.dry ?? 1);
    for (const k of ['cath', 'hall', 'delay']) if (cfg[k]) {
      sends[k].L[i] += l * cfg[k];
      sends[k].R[i] += r * cfg[k];
    }
  }
  if (STEMS) fs.writeFileSync(path.join(OUT, `stem-${bus}.wav`), encodeWav(out));
  let peak = 0;
  for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(out.L[i] * cfg.gain), Math.abs(out.R[i] * cfg.gain));
  console.log(`  ${bus.padEnd(10)} ${String(evs.length).padStart(5)} events  peak ${(20 * Math.log10(peak + 1e-9)).toFixed(1).padStart(6)} dB  ${((Date.now() - t) / 1000).toFixed(1)} s`);
}

// ---- effects ------------------------------------------------------------------------
const wet = stereo(LEN);
{
  const t = Date.now();
  const cathedral = roomIR({
    seconds: 7.5,
    rt: [[90, 7.2], [180, 6.8], [350, 6.2], [700, 5.4], [1400, 4.4], [2800, 3.2], [5600, 2.1], [11000, 1.2]],
    predelay: 0.045, early: 14, earlySpan: 0.12, build: 0.05, seed: 21,
  });
  eqStereo(sends.cath, 'hp', 60, 0.7);
  reverb(sends.cath, cathedral, wet, 1.0);
  const hall = roomIR({
    seconds: 2.6,
    rt: [[120, 1.9], [500, 1.7], [1500, 1.5], [4000, 1.1], [9000, 0.7]],
    predelay: 0.02, early: 8, earlySpan: 0.05, build: 0.012, seed: 7,
  });
  eqStereo(sends.hall, 'hp', 180, 0.7);
  reverb(sends.hall, hall, wet, 0.9);
  pingPong(sends.delay, wet, { time: (60 / 156) * 0.75, feedback: 0.38, tone: 3800, hp: 400, gain: 0.8 });
  console.log(`  reverb and delay ${((Date.now() - t) / 1000).toFixed(1)} s`);
}

// ---- master -------------------------------------------------------------------------
const mix = stereo(LEN);
for (let i = 0; i < LEN; i++) {
  mix.L[i] = dry.L[i] + wet.L[i];
  mix.R[i] = dry.R[i] + wet.R[i];
}
eqStereo(mix, 'hp', 26, 0.7);
eqStereo(mix, 'lowshelf', 80, 0.7, -1.5);
eqStereo(mix, 'highshelf', 9000, 0.7, 1.5);

// Level so the loud sections sit around -11 dBFS RMS before the bus compressor.
function rmsPercentile(s, pct) {
  const win = Math.round(0.4 * SR);
  const vals = [];
  for (let i = 0; i + win < s.L.length; i += win) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += s.L[j] * s.L[j] + s.R[j] * s.R[j];
    vals.push(Math.sqrt(e / (2 * win)));
  }
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length * pct)] || 1e-9;
}
const loud = rmsPercentile(mix, 0.95);
const pre = db(-13) / loud;
for (let i = 0; i < LEN; i++) {
  mix.L[i] *= pre;
  mix.R[i] *= pre;
}
compress(mix, { threshold: -16, ratio: 2, attack: 0.02, release: 0.2, makeup: 2.5, knee: 8 });
// Only the very top of the waveform is rounded off; the limiter does the rest.
const knee = 0.85;
const clip = (x) => {
  const a = Math.abs(x);
  if (a <= knee) return x;
  return Math.sign(x) * (knee + (1 - knee) * softClip((a - knee) / (1 - knee)));
};
for (let i = 0; i < LEN; i++) {
  mix.L[i] = clip(mix.L[i]);
  mix.R[i] = clip(mix.R[i]);
}
limit(mix, { ceiling: -1, lookahead: 0.005, release: 0.12 });

// Fade the very end so the reverb tail lands on silence.
const fade = Math.round(1.5 * SR);
for (let i = 0; i < fade; i++) {
  const g = Math.cos((i / fade) * Math.PI * 0.5);
  mix.L[LEN - fade + i] *= g;
  mix.R[LEN - fade + i] *= g;
}

const wavPath = path.join(OUT, `${NAME}.wav`);
fs.writeFileSync(wavPath, encodeWav(mix));
console.log(`wrote ${wavPath} (${((Date.now() - started) / 1000).toFixed(1)} s)`);

// ---- mp3 ----------------------------------------------------------------------------
const mp3Path = path.join(OUT, `${NAME}.mp3`);
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-codec:a', 'libmp3lame', '-q:a', '2', mp3Path]);
  console.log(`wrote ${mp3Path}`);
} catch {
  try {
    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const enc = new Mp3Encoder(2, SR, 192);
    const toI16 = (a) => Int16Array.from(a, (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767))));
    const L = toI16(mix.L), R = toI16(mix.R);
    const chunks = [];
    for (let i = 0; i < LEN; i += 1152) chunks.push(Buffer.from(enc.encodeBuffer(L.subarray(i, i + 1152), R.subarray(i, i + 1152))));
    chunks.push(Buffer.from(enc.flush()));
    fs.writeFileSync(mp3Path, Buffer.concat(chunks));
    console.log(`wrote ${mp3Path} (lamejs)`);
  } catch {
    console.log('no mp3 encoder found (install ffmpeg, or run npm install for lamejs)');
  }
}
