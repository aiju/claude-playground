// Renders the score to out/sunken-bell.wav (and .mp3 if lamejs is installed).
//   node render.js [--stems] [--from BEAT --to BEAT] [--out DIR]

import fs from 'fs';
import path from 'path';
import {
  SR, mtof, rng, eq, pingPong, compress, limit, encodeWav, db, panGains,
  hallIR, convolve, duckEnvelope, saturate, autoLowpass, width,
} from './src/dsp.js';
import * as I from './src/instruments.js';
import * as V from './src/voices.js';
import { buildScore, TEMPO, END_BEAT, FORM, UNDERWATER } from './src/score.js';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const STEMS = args.includes('--stems');
const OUT = opt('--out', 'out');
const FROM = parseFloat(opt('--from', '0'));
const TO = parseFloat(opt('--to', String(END_BEAT)));
fs.mkdirSync(OUT, { recursive: true });

// ---- tempo map (linear bpm ramps between points, in beats) ---------------------------
function beatToSec(b) {
  let t = 0;
  for (let i = 0; i < TEMPO.length; i++) {
    const p = TEMPO[i];
    const q = TEMPO[i + 1];
    const end = q ? Math.min(b, q.beat) : b;
    if (end <= p.beat) break;
    const bpm1 = q ? q.bpm : p.bpm;
    const k = q ? (bpm1 - p.bpm) / (q.beat - p.beat) : 0;
    const x = end - p.beat;
    t += Math.abs(k) < 1e-9 ? (60 * x) / p.bpm : (60 / k) * Math.log((p.bpm + k * x) / p.bpm);
    if (!q || b <= q.beat) break;
  }
  return t;
}

const t0 = beatToSec(FROM);
const songSec = beatToSec(TO) - t0 + (TO >= END_BEAT ? 9 : 2);
const LEN = Math.round(songSec * SR);
const smp = (beat) => Math.round((beatToSec(beat) - t0) * SR);

// ---- events -> samples --------------------------------------------------------------
const rand = rng(777);
const PERC = new Set(['kick', 'snare', 'ghost', 'hat', 'ohat', 'clap', 'crash', 'revcym', 'tomH', 'tomM', 'tomL', 'tomF', 'taiko', 'timp', 'boom', 'doum', 'tek', 'ka', 'frame', 'riq', 'shaker', 'zill', 'riser', 'water']);
const LEADS = new Set(['duduk', 'erhu', 'flute']);
const LINES = new Set(['cline', 'sline']);
const score = buildScore();
const events = [];
for (const e of score) {
  if (e.t < FROM - 16 || e.t >= TO) continue;
  const tight = LEADS.has(e.inst) || LINES.has(e.inst);
  const jitter = tight ? 0 : (rand() - 0.5) * (PERC.has(e.inst) ? 0.006 : 0.012);
  const s = Math.round((beatToSec(e.t) - t0 + jitter) * SR);
  const n = Math.max(1, smp(e.t + e.d) - smp(e.t));
  if (s + n <= 0 || (tight && s < 0)) continue;
  const vScale = tight ? 1 : 1 + (rand() - 0.5) * 0.08;
  events.push({
    ...e,
    s,
    n,
    f: mtof(e.m),
    v: Math.min(1, (e.v / 127) * vScale),
    v1: e.v1 !== undefined ? Math.min(1, e.v1 / 127) : undefined,
    seed: Math.floor(rand() * 1e9),
  });
}
events.sort((a, b) => a.s - b.s);

// ---- instruments ------------------------------------------------------------------------
const KANUN = { strings: [-2.5, 0, 2.5], b: 0.78, t60: 1.8, pos: 0.11, exciteFc: 9000, ring: 2.2 };
const PIZZ = { b: 0.5, t60: 1.1, pos: 0.2, excite: 'soft', exciteFc: 1500, dampOnRelease: true, dampT60: 0.3 };
const PAD = { voices: 7, detune: 24, vib: 2, attack: 0.5, release: 0.8, bright: 0.65, spread: 1 };
const TOMS = { tomH: 205, tomM: 155, tomL: 115, tomF: 82 };

const RENDER = {
  strings: (b, n) => I.strings(b, n, n.o),
  pad: (b, n) => I.strings(b, n, { ...PAD, ...n.o }),
  spic: (b, n) => I.spiccato(b, n, n.o),
  horns: (b, n) => I.brass(b, n, { bright: 0.8, ...n.o }),
  oud: (b, n) => V.oudTrem(b, n, n.o?.single ? { rate: 99, exciteFc: 3200, b: 0.62 } : {}),
  kanun: (b, n) => I.pluck(b, n, KANUN),
  pizz: (b, n) => I.pluck(b, n, PIZZ),
  piano: (b, n) => I.piano(b, n, n.o),
  celesta: (b, n) => I.musicBox(b, n, { decay: 1.6 }),
  synth: (b, n) => V.synthPluck(b, n, { q: 3.2 }),
  sub: (b, n) => V.sub(b, n),
  bell: (b, n) => V.bell(b, n, { lowpass: 1500, wobble: 8 }),
  tbell: (b, n) => V.bell(b, n, { decay: 0.22, gain: 0.3 }),
  kick: (b, n) => I.kick(b, n),
  snare: (b, n) => I.snare(b, n, { long: true }),
  ghost: (b, n) => I.snare(b, n),
  clap: (b, n) => V.clap(b, n),
  hat: (b, n) => I.hat(b, n),
  ohat: (b, n) => I.hat(b, n, { open: true }),
  crash: (b, n) => I.cymbal(b, { ...n, pan: 0 }),
  revcym: (b, n) => I.cymbal(b, n, { reverse: true, dur: 1.8, tau: 0.6 }),
  tomH: (b, n) => I.tom(b, { ...n, pan: 0.35 }, { f: TOMS.tomH }),
  tomM: (b, n) => I.tom(b, { ...n, pan: 0.1 }, { f: TOMS.tomM }),
  tomL: (b, n) => I.tom(b, { ...n, pan: -0.15 }, { f: TOMS.tomL }),
  tomF: (b, n) => I.tom(b, { ...n, pan: -0.35 }, { f: TOMS.tomF }),
  taiko: (b, n) => I.taiko(b, n),
  timp: (b, n) => I.timpani(b, n),
  boom: (b, n) => I.boom(b, n),
  doum: (b, n) => I.darbuka(b, n, { type: 'doum' }),
  tek: (b, n) => I.darbuka(b, n, { type: 'tek' }),
  ka: (b, n) => I.darbuka(b, n, { type: 'ka' }),
  frame: (b, n) => I.frameDrum(b, n),
  riq: (b, n) => V.riq(b, n, { skin: n.v > 0.7 }),
  shaker: (b, n) => I.shaker(b, n),
  zill: (b, n) => V.zill(b, n),
  riser: (b, n) => I.riser(b, n),
  water: (b, n) => V.water(b, n),
};

const LEAD_OPTS = {
  duduk: { attack: 0.09, release: 0.28, glide: 0.014, vibDepth: 20, vibRate: 5.0, vibDelay: 0.32, vibRamp: 0.5, slideCents: 300 },
  erhu: { attack: 0.06, release: 0.22, glide: 0.022, vibDepth: 30, vibRate: 6.3, vibDelay: 0.18, slideCents: 350 },
  flute: { attack: 0.04, release: 0.15, glide: 0.01, vibDepth: 12, vibRate: 5.2, vibDelay: 0.25 },
};
const LEAD_TONE = {
  duduk: { spectrum: 'duduk', breath: 0.035, attackNoise: 0.1, eq: [['hp', 140, 0.7]], gain: 0.5 },
  erhu: { spectrum: 'erhu', breath: 0.02, noiseCenter: 3000, noiseQ: 0.8, attackNoise: 0.2, eq: [['hp', 240, 0.7]], gain: 0.42, pan: 0.18 },
  flute: { spectrum: 'flute', breath: 0.09, noiseQ: 1.5, attackNoise: 0.35, eq: [['hp', 250, 0.7]], gain: 0.4, pan: -0.2 },
};

const underwater = (() => {
  const pts = UNDERWATER.map(([b, hz]) => [smp(b), Math.log(hz)]);
  return (i) => {
    let k = 0;
    while (k + 1 < pts.length && pts[k + 1][0] <= i) k++;
    const a = pts[k];
    const b = pts[k + 1];
    if (!b) return Math.round(Math.exp(a[1]));
    const u = Math.min(1, Math.max(0, (i - a[0]) / Math.max(1, b[0] - a[0])));
    return Math.round(Math.exp(a[1] + (b[1] - a[1]) * u) / 10) * 10;
  };
})();

// Bus layout.
const BUSES = [
  { name: 'duduk', inst: ['duduk'], gain: 1.0, rev: 0.32, delay: 0.1 },
  { name: 'erhu', inst: ['erhu'], gain: 0.8, rev: 0.34, delay: 0.1 },
  { name: 'flute', inst: ['flute'], gain: 0.95, rev: 0.45, delay: 0.14 },
  { name: 'cline', inst: ['cline'], gain: 0.85, rev: 0.5, eq: [['peak', 3000, 1, 2]] },
  { name: 'choir', inst: ['choir'], gain: 0.34, rev: 0.6, eq: [['hp', 90, 0.7], ['peak', 3000, 1, 2]] },
  { name: 'chant', inst: ['chant'], gain: 1.1, rev: 0.35 },
  { name: 'sline', inst: ['sline'], gain: 0.28, rev: 0.4 },
  { name: 'strings', inst: ['strings'], gain: 0.16, rev: 0.55, eq: [['hp', 150, 0.7], ['peak', 3000, 1, 1.5]] },
  { name: 'spic', inst: ['spic'], gain: 0.2, rev: 0.3, eq: [['hp', 110, 0.7]], pan: -0.2 },
  { name: 'horns', inst: ['horns'], gain: 0.28, rev: 0.5, eq: [['hp', 90, 0.7]], pan: 0.2 },
  { name: 'oud', inst: ['oud'], gain: 1.5, rev: 0.3, pan: -0.25 },
  { name: 'kanun', inst: ['kanun'], gain: 0.95, rev: 0.4, eq: [['hp', 200, 0.7]], pan: 0.3 },
  { name: 'piano', inst: ['piano'], gain: 0.6, rev: 0.45, eq: [['hp', 50, 0.7]] },
  { name: 'celesta', inst: ['celesta'], gain: 0.5, rev: 0.5, pan: 0.25, eq: [['hp', 300, 0.7]] },
  { name: 'pizz', inst: ['pizz'], gain: 1.3, rev: 0.25, eq: [['hp', 40, 0.7]] },
  { name: 'bell', inst: ['bell'], gain: 0.9, rev: 0.6 },
  { name: 'tbell', inst: ['tbell'], gain: 0.5, rev: 0.5, pan: 0.15 },
  { name: 'synth', inst: ['synth'], gain: 0.5, rev: 0.25, delay: 0.25, duck: 0.35, under: true, width: 1.3 },
  { name: 'pad', inst: ['pad'], gain: 0.13, rev: 0.4, duck: 0.5, under: true, eq: [['hp', 180, 0.7]] },
  { name: 'sub', inst: ['sub'], gain: 0.55, rev: 0, duck: 0.6, under: true, eq: [['lp', 220, 0.7]] },
  { name: 'kit', inst: ['kick', 'snare', 'ghost', 'clap', 'hat', 'ohat', 'tomH', 'tomM', 'tomL', 'tomF'], gain: 0.44, rev: 0.12, under: true, sat: 1.6 },
  { name: 'perc', inst: ['doum', 'tek', 'ka', 'frame', 'riq', 'shaker', 'zill'], gain: 0.4, rev: 0.25, under: true },
  { name: 'epic', inst: ['taiko', 'timp', 'boom'], gain: 0.36, rev: 0.35, sat: 1.3 },
  { name: 'cymbals', inst: ['crash', 'revcym'], gain: 0.38, rev: 0.2 },
  { name: 'fx', inst: ['riser', 'water'], gain: 0.17, rev: 0.45 },
];

const kickHits = events.filter((e) => e.inst === 'kick').map((e) => ({ s: e.s, v: Math.min(1, e.v * 1.2) }));
const duckCache = {};
const duckEnv = (depth) => (duckCache[depth] ??= duckEnvelope(LEN, kickHits, { depth, release: 0.17 }));

function groupBy(list, key) {
  const m = new Map();
  for (const e of list) {
    const k = key(e);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  return m;
}

function renderBus(spec) {
  const bus = { L: new Float32Array(LEN), R: new Float32Array(LEN) };
  const evs = events.filter((e) => spec.inst.includes(e.inst));
  if (!evs.length) return bus;
  const name = spec.name;
  if (name === 'choir') {
    const voices = { S: 'soprano', A: 'alto', T: 'tenor', B: 'bass' };
    for (const [part, voice] of Object.entries(voices)) {
      const notes = evs.filter((e) => e.part === part);
      if (!notes.length) continue;
      const track = [];
      for (const nt of notes) if (!track.length || track[track.length - 1].v !== nt.vowel) track.push({ s: nt.s, v: nt.vowel });
      const xf = 0.3 * SR;
      const vowelAt = (i) => {
        let k = 0;
        while (k + 1 < track.length && track[k + 1].s <= i) k++;
        const cur = track[k];
        if (k === 0 || i - cur.s >= xf) return cur.v;
        const u = Math.round(((i - cur.s) / xf) * 8) / 8;
        const prev = track[k - 1].v;
        if (u >= 1) return cur.v;
        if (u <= 0) return prev;
        return { [prev]: 1 - u, [cur.v]: u };
      };
      I.choirSection(bus, notes, { voice, vowel: vowelAt, seed: part.charCodeAt(0), voices: part === 'B' ? 4 : 5, pan: { S: -0.15, A: 0.15, T: -0.1, B: 0.1 }[part] });
    }
  } else if (name === 'chant') {
    for (const [voice, notes] of groupBy(evs, (e) => e.voice ?? 'tenor')) V.chant(bus, notes, { voice, voices: 5 });
  } else if (name === 'cline') {
    let k = 0;
    for (const [, notes] of groupBy(evs, (e) => e.grp)) {
      V.choirLine(bus, notes, { voice: notes[0].voice ?? 'alto', vowel: notes[0].vowel ?? 'a', voices: 6, seed: 50 + k++ });
    }
  } else if (name === 'sline') {
    let k = 0;
    for (const [grp, notes] of groupBy(evs, (e) => e.grp)) {
      const low = Math.min(...notes.map((n) => n.m)) < 48;
      V.stringLine(bus, notes, { voices: 6, pan: notes[0].pan ?? (low ? 0.3 : 0.1), seed: 70 + k++, vib: low ? 6 : 14, bright: low ? 0.7 : 1, hp: low ? 30 : 80, gain: grp.includes('drone') ? 0.8 : 1 });
    }
  } else if (LEADS.has(name)) {
    const notes = evs.map((e) => ({
      ...e,
      grace: e.grace ? e.grace.map(mtof) : null,
      trill: e.trillM ? mtof(e.trillM) : null,
    }));
    V.additiveLead(bus, I.leadPhrases(notes, LEAD_OPTS[name]), { ...LEAD_TONE[name], seed: name.length * 17 });
  } else {
    for (const e of evs) RENDER[e.inst](bus, e);
  }
  if (spec.eq) {
    eq(bus.L, spec.eq);
    eq(bus.R, spec.eq);
  }
  if (spec.sat) {
    saturate(bus.L, spec.sat);
    saturate(bus.R, spec.sat);
  }
  if (spec.width) width(bus.L, bus.R, spec.width);
  if (spec.pan) {
    const [gl, gr] = panGains(spec.pan);
    const k = Math.SQRT2;
    for (let i = 0; i < LEN; i++) {
      bus.L[i] *= gl * k;
      bus.R[i] *= gr * k;
    }
  }
  if (spec.duck) {
    const env = duckEnv(spec.duck);
    for (let i = 0; i < LEN; i++) {
      bus.L[i] *= env[i];
      bus.R[i] *= env[i];
    }
  }
  if (spec.under) autoLowpass(bus.L, bus.R, underwater, 1.1);
  const g = spec.gain;
  for (let i = 0; i < LEN; i++) {
    bus.L[i] *= g;
    bus.R[i] *= g;
  }
  return bus;
}

// ---- mix ----------------------------------------------------------------------------------
const mL = new Float32Array(LEN);
const mR = new Float32Array(LEN);
const rvL = new Float32Array(LEN);
const rvR = new Float32Array(LEN);
const dlL = new Float32Array(LEN);
const dlR = new Float32Array(LEN);
const stats = {};
const spans = FORM.map((s) => ({ name: s.name, a: Math.max(0, smp(s.beat)), b: Math.min(LEN, smp(s.beat + s.bars * s.barLen)) })).filter((s) => s.b > s.a);

for (const spec of BUSES) {
  const tb = Date.now();
  const bus = renderBus(spec);
  const rms = {};
  for (const sp of spans) {
    let acc = 0;
    for (let i = sp.a; i < sp.b; i++) acc += bus.L[i] * bus.L[i] + bus.R[i] * bus.R[i];
    const r = Math.sqrt(acc / (2 * (sp.b - sp.a)));
    rms[sp.name] = r > 1e-6 ? +(20 * Math.log10(r)).toFixed(1) : null;
  }
  stats[spec.name] = rms;
  for (let i = 0; i < LEN; i++) {
    mL[i] += bus.L[i];
    mR[i] += bus.R[i];
    rvL[i] += bus.L[i] * spec.rev;
    rvR[i] += bus.R[i] * spec.rev;
    if (spec.delay) {
      dlL[i] += bus.L[i] * spec.delay;
      dlR[i] += bus.R[i] * spec.delay;
    }
  }
  if (STEMS) fs.writeFileSync(path.join(OUT, `stem-${spec.name}.wav`), encodeWav(bus.L, bus.R));
  console.log(`${spec.name.padEnd(8)} ${String(Date.now() - tb).padStart(6)} ms`);
}

const beat = 60 / 138;
const [dL, dR] = pingPong(dlL, dlR, { time: beat * 0.75, feedback: 0.3, highcut: 4500 });
for (let i = 0; i < LEN; i++) {
  rvL[i] += dL[i] * 0.4;
  rvR[i] += dR[i] * 0.4;
  mL[i] += dL[i];
  mR[i] += dR[i];
}
{
  const tb = Date.now();
  const [hl, hr] = hallIR({ seconds: 3.6, rt60: 2.8 });
  const wL = convolve(rvL, hl);
  const wR = convolve(rvR, hr);
  for (let i = 0; i < LEN; i++) {
    mL[i] += wL[i] * 0.55;
    mR[i] += wR[i] * 0.55;
  }
  console.log(`reverb   ${String(Date.now() - tb).padStart(6)} ms`);
}

// master
eq(mL, [['hp', 24, 0.7], ['peak', 320, 0.8, -1], ['highshelf', 9000, 0.7, 1.5]]);
eq(mR, [['hp', 24, 0.7], ['peak', 320, 0.8, -1], ['highshelf', 9000, 0.7, 1.5]]);
let peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(mL[i]), Math.abs(mR[i]));
const pre = db(-4) / peak;
for (let i = 0; i < LEN; i++) {
  mL[i] *= pre;
  mR[i] *= pre;
}
compress(mL, mR, { threshold: -16, ratio: 2, attack: 0.03, release: 0.3, knee: 8, makeup: 3.5 });
limit(mL, mR, { ceiling: -1, lookahead: 0.004, release: 0.1 });
const fade = Math.round(1.5 * SR);
for (let i = 0; i < fade; i++) {
  mL[LEN - 1 - i] *= i / fade;
  mR[LEN - 1 - i] *= i / fade;
}

let acc = 0;
for (let i = 0; i < LEN; i++) acc += mL[i] * mL[i] + mR[i] * mR[i];
console.log('master RMS', (10 * Math.log10(acc / (2 * LEN))).toFixed(1), 'dBFS; length', songSec.toFixed(1), 's; pre-gain', (20 * Math.log10(pre)).toFixed(1), 'dB');
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 1));
fs.writeFileSync(path.join(OUT, 'sunken-bell.wav'), encodeWav(mL, mR));

if (FROM === 0 && TO >= END_BEAT) {
  const notes = events.filter((e) => !PERC.has(e.inst)).map((e) => [e.inst, +(e.s / SR).toFixed(3), +(e.n / SR).toFixed(3), e.m, +e.v.toFixed(2)]);
  const hits = events.filter((e) => PERC.has(e.inst) && e.inst !== 'water').map((e) => [e.inst, +(e.s / SR).toFixed(3), +e.v.toFixed(2)]);
  const sections = FORM.map((s) => ({ name: s.name, t: +beatToSec(s.beat).toFixed(3), meter: s.barLen === 4 ? '4/4' : '7/8' }));
  fs.writeFileSync(path.join(OUT, 'notes.json'), JSON.stringify({ duration: songSec, sections, notes, hits }));
}

try {
  const lame = await import('@breezystack/lamejs');
  const enc = new lame.Mp3Encoder(2, SR, 192);
  const toI16 = (x) => {
    const o = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) o[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
    return o;
  };
  const l16 = toI16(mL);
  const r16 = toI16(mR);
  const chunks = [];
  for (let i = 0; i < LEN; i += 1152) {
    const b = enc.encodeBuffer(l16.subarray(i, i + 1152), r16.subarray(i, i + 1152));
    if (b.length) chunks.push(Buffer.from(b));
  }
  chunks.push(Buffer.from(enc.flush()));
  fs.writeFileSync(path.join(OUT, 'sunken-bell.mp3'), Buffer.concat(chunks));
  console.log('wrote mp3');
} catch (e) {
  console.log('(mp3 skipped: ' + e.message.split('\n')[0] + ')');
}
