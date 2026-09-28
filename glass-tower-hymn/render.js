// Renders the score to out/glass-tower.wav (and .mp3 if lamejs is installed).
//   node render.js [--stems] [--from BAR --to BAR] [--out DIR]

import fs from 'fs';
import path from 'path';
import { SR, mtof, rng, eq, reverb, pingPong, compress, limit, encodeWav, db, panGains } from './src/dsp.js';
import * as I from './src/instruments.js';
import { buildScore, TEMPO, END_BAR, SECTIONS } from './src/score.js';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const STEMS = args.includes('--stems');
const OUT = opt('--out', 'out');
const FROM = parseFloat(opt('--from', '0'));
const TO = parseFloat(opt('--to', String(END_BAR)));
fs.mkdirSync(OUT, { recursive: true });

// ---- tempo map ----------------------------------------------------------------
const pts = TEMPO.map((p) => ({ beat: p.bar * 4, bpm: p.bpm }));
function beatToSec(b) {
  let t = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[i + 1];
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

const t0 = beatToSec(FROM * 4);
const songSec = beatToSec(TO * 4) - t0 + (TO >= END_BAR ? 6 : 1.5);
const LEN = Math.round(songSec * SR);
const smp = (beat) => Math.round((beatToSec(beat) - t0) * SR);

// ---- events -> samples ------------------------------------------------------------
const rand = rng(2024);
const DRUMS = new Set(['kick', 'snare', 'hat', 'ohat', 'crash', 'revcym', 'tomH', 'tomM', 'tomL', 'tomF', 'taiko', 'timp', 'doum', 'tek', 'ka', 'frame', 'shaker', 'riser', 'boom']);
const LEADS = new Set(['violin', 'whistle', 'vox']);
const score = buildScore();
const events = [];
for (const e of score) {
  if (e.t < FROM * 4 - 8 || e.t >= TO * 4) continue;
  const jitter = LEADS.has(e.inst) ? 0 : (rand() - 0.5) * (DRUMS.has(e.inst) ? 0.006 : 0.012);
  const s = Math.round((beatToSec(e.t) - t0 + jitter) * SR);
  const n = Math.max(1, smp(e.t + e.d) - smp(e.t));
  // partial renders: skip notes that end before the window, and lead notes that start before it
  if (s + n <= 0 || (LEADS.has(e.inst) && s < 0)) continue;
  const vScale = LEADS.has(e.inst) ? 1 : 1 + (rand() - 0.5) * 0.08;
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

// ---- instruments -------------------------------------------------------------------
const HARPSI = { strings: [-3, 3.5], b: 0.88, t60: 2.2, pos: 0.1, exciteFc: 12000, dampOnRelease: true, dampT60: 0.09 };
const HARP = { b: 0.62, t60: 4, pos: 0.27, excite: 'soft', exciteFc: 3000, ring: 3.5 };
const SANTUR = { strings: [-4, 0, 4.5], b: 0.8, t60: 2.6, pos: 0.14, excite: 'hammer', ring: 2.5 };
const PIZZ = { b: 0.5, t60: 1.2, pos: 0.2, excite: 'soft', exciteFc: 1500, dampOnRelease: true, dampT60: 0.25 };
const TOMS = { tomH: 210, tomM: 160, tomL: 118, tomF: 84 };

const RENDER = {
  strings: (b, n) => I.strings(b, n, n.o),
  lowstr: (b, n) => I.strings(b, n, { voices: 5, detune: 8, bright: 0.6, attack: 0.25, spread: 0.5, vib: 6, ...n.o }),
  spic: (b, n) => I.spiccato(b, n, n.o),
  harpsi: (b, n) => I.pluck(b, n, HARPSI),
  harp: (b, n) => I.pluck(b, n, HARP),
  santur: (b, n) => I.pluck(b, n, SANTUR),
  pizz: (b, n) => I.pluck(b, n, PIZZ),
  piano: (b, n) => I.piano(b, n, n.o),
  musicbox: (b, n) => I.musicBox(b, n, n.o),
  glock: (b, n) => I.glock(b, n, n.o),
  bass: (b, n) => I.bass(b, n, n.o),
  brass: (b, n) => I.brass(b, n, n.o),
  kick: (b, n) => I.kick(b, n),
  snare: (b, n) => I.snare(b, n),
  hat: (b, n) => I.hat(b, n),
  ohat: (b, n) => I.hat(b, n, { open: true }),
  crash: (b, n) => I.cymbal(b, { ...n, pan: 0 }),
  revcym: (b, n) => I.cymbal(b, n, { reverse: true, dur: 1.6, tau: 0.6 }),
  tomH: (b, n) => I.tom(b, { ...n, pan: 0.35 }, { f: TOMS.tomH }),
  tomM: (b, n) => I.tom(b, { ...n, pan: 0.1 }, { f: TOMS.tomM }),
  tomL: (b, n) => I.tom(b, { ...n, pan: -0.15 }, { f: TOMS.tomL }),
  tomF: (b, n) => I.tom(b, { ...n, pan: -0.35 }, { f: TOMS.tomF }),
  taiko: (b, n) => I.taiko(b, n),
  timp: (b, n) => I.timpani(b, n),
  doum: (b, n) => I.darbuka(b, n, { type: 'doum' }),
  tek: (b, n) => I.darbuka(b, n, { type: 'tek' }),
  ka: (b, n) => I.darbuka(b, n, { type: 'ka' }),
  frame: (b, n) => I.frameDrum(b, n),
  shaker: (b, n) => I.shaker(b, n),
  riser: (b, n) => I.riser(b, n),
  boom: (b, n) => I.boom(b, n),
};

// Bus layout: which instruments feed each bus, plus mix settings.
const BUSES = [
  { name: 'strings', inst: ['strings'], gain: 0.2, rev: 0.5, eq: [['hp', 110, 0.7], ['peak', 350, 1, 1.5], ['peak', 2800, 1, 1.5]] },
  { name: 'lowstr', inst: ['lowstr'], gain: 0.22, rev: 0.3, eq: [['hp', 32, 0.7], ['peak', 250, 1, 2]] },
  { name: 'spic', inst: ['spic'], gain: 0.25, rev: 0.3, eq: [['hp', 100, 0.7]] },
  { name: 'harpsi', inst: ['harpsi'], gain: 1.2, rev: 0.35, eq: [['hp', 180, 0.7], ['peak', 3000, 1, 2]], pan: 0.3 },
  { name: 'harp', inst: ['harp'], gain: 0.9, rev: 0.5, pan: -0.3 },
  { name: 'santur', inst: ['santur'], gain: 1.8, rev: 0.35, eq: [['hp', 150, 0.7], ['peak', 900, 1, 2]], pan: -0.1 },
  { name: 'pizz', inst: ['pizz'], gain: 1.5, rev: 0.25, eq: [['hp', 35, 0.7]] },
  { name: 'piano', inst: ['piano'], gain: 0.7, rev: 0.45, eq: [['hp', 45, 0.7]] },
  { name: 'musicbox', inst: ['musicbox'], gain: 0.9, rev: 0.55, pan: 0.12, eq: [['hp', 200, 0.7]] },
  { name: 'glock', inst: ['glock'], gain: 0.55, rev: 0.45, pan: 0.3 },
  { name: 'choir', inst: ['choir'], gain: 0.42, rev: 0.6, eq: [['hp', 90, 0.7], ['peak', 3000, 1, 2]] },
  { name: 'violin', inst: ['violin'], gain: 0.75, rev: 0.38, delay: 0.16 },
  { name: 'vox', inst: ['vox'], gain: 0.5, rev: 0.5 },
  { name: 'whistle', inst: ['whistle'], gain: 0.85, rev: 0.42, delay: 0.18 },
  { name: 'bass', inst: ['bass'], gain: 0.55, rev: 0.02, eq: [['hp', 28, 0.7], ['lp', 3500, 0.7]] },
  { name: 'brass', inst: ['brass'], gain: 0.3, rev: 0.45, eq: [['hp', 90, 0.7]] },
  { name: 'kit', inst: ['kick', 'snare', 'hat', 'ohat', 'tomH', 'tomM', 'tomL', 'tomF'], gain: 0.55, rev: 0.12 },
  { name: 'cymbals', inst: ['crash', 'revcym'], gain: 0.42, rev: 0.18 },
  { name: 'perc', inst: ['doum', 'tek', 'ka', 'frame', 'shaker'], gain: 0.5, rev: 0.22 },
  { name: 'epic', inst: ['taiko', 'timp', 'boom'], gain: 0.5, rev: 0.35 },
  { name: 'fx', inst: ['riser'], gain: 0.22, rev: 0.5 },
];

// Default per-lead phrasing.
const LEAD_OPTS = {
  violin: { attack: 0.07, release: 0.2, glide: 0.011, vibDepth: 26, vibRate: 5.7, scoop: 20 },
  whistle: { attack: 0.03, release: 0.12, glide: 0.008, vibDepth: 12, vibRate: 5.0, vibDelay: 0.25 },
  vox: { attack: 0.1, release: 0.25, glide: 0.018, vibDepth: 30, vibRate: 5.3 },
};
const SCALE_UP = (m) => {
  const pcs = [2, 4, 5, 7, 9, 10, 1];
  let u = m + 1;
  while (!pcs.includes(u % 12)) u++;
  return u;
};

function renderBus(spec) {
  const bus = { L: new Float32Array(LEN), R: new Float32Array(LEN) };
  const evs = events.filter((e) => spec.inst.includes(e.inst));
  if (spec.name === 'choir') {
    const voices = { S: 'soprano', A: 'alto', T: 'tenor', B: 'bass' };
    for (const [part, voice] of Object.entries(voices)) {
      const notes = evs.filter((e) => e.part === part);
      if (!notes.length) continue;
      // vowel track with 0.3 s crossfades
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
      I.choirSection(bus, notes, { voice, vowel: vowelAt, seed: part.charCodeAt(0), voices: part === 'B' ? 3 : 4 });
    }
  } else if (LEADS.has(spec.name)) {
    const notes = evs.map((e) => ({
      ...e,
      grace: e.grace ? e.grace.map(mtof) : null,
      trill: e.trill ? mtof(SCALE_UP(e.m)) : null,
    }));
    const phrases = I.leadPhrases(notes, LEAD_OPTS[spec.name]);
    if (spec.name === 'violin') I.violin(bus, phrases, { gain: 0.5 });
    if (spec.name === 'whistle') I.whistle(bus, phrases, { gain: 0.5 });
    if (spec.name === 'vox') I.voxLead(bus, phrases, { gain: 1.4, voice: 'alto' });
  } else {
    for (const e of evs) RENDER[e.inst](bus, e);
  }
  if (spec.eq) {
    eq(bus.L, spec.eq);
    eq(bus.R, spec.eq);
  }
  if (spec.pan) {
    // balance-style pan of a stereo bus
    const [gl, gr] = panGains(spec.pan);
    const k = Math.SQRT2;
    for (let i = 0; i < LEN; i++) {
      bus.L[i] *= gl * k;
      bus.R[i] *= gr * k;
    }
  }
  const g = spec.gain;
  for (let i = 0; i < LEN; i++) {
    bus.L[i] *= g;
    bus.R[i] *= g;
  }
  return bus;
}

// ---- mix -------------------------------------------------------------------------
const mL = new Float32Array(LEN);
const mR = new Float32Array(LEN);
const rvL = new Float32Array(LEN);
const rvR = new Float32Array(LEN);
const dlL = new Float32Array(LEN);
const dlR = new Float32Array(LEN);
const stats = {};
const sectionSpans = SECTIONS.map((s, i) => ({
  name: s.name + '@' + s.bar,
  a: Math.max(0, smp(s.bar * 4)),
  b: Math.min(LEN, smp((SECTIONS[i + 1] ? SECTIONS[i + 1].bar : END_BAR) * 4)),
})).filter((s) => s.b > s.a);

for (const spec of BUSES) {
  const tb = Date.now();
  const bus = renderBus(spec);
  const rms = {};
  for (const sp of sectionSpans) {
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
  console.log(`${spec.name.padEnd(9)} ${String(Date.now() - tb).padStart(6)} ms`);
}

const beat = 60 / 150;
const [dL, dR] = pingPong(dlL, dlR, { time: beat * 0.75, feedback: 0.32 });
for (let i = 0; i < LEN; i++) {
  rvL[i] += dL[i] * 0.3;
  rvR[i] += dR[i] * 0.3;
  mL[i] += dL[i];
  mR[i] += dR[i];
}
const [wL, wR] = reverb(rvL, rvR, { rt60: 2.9, size: 1.3, damp: 5500, predelay: 0.03 });
for (let i = 0; i < LEN; i++) {
  mL[i] += wL[i] * 0.9;
  mR[i] += wR[i] * 0.9;
}

// master: gentle EQ, glue compression, limiting
eq(mL, [['hp', 25, 0.7], ['lowshelf', 120, 0.7, 1], ['highshelf', 9000, 0.7, 1.5]]);
eq(mR, [['hp', 25, 0.7], ['lowshelf', 120, 0.7, 1], ['highshelf', 9000, 0.7, 1.5]]);
let peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(mL[i]), Math.abs(mR[i]));
const pre = db(-4) / peak;
for (let i = 0; i < LEN; i++) {
  mL[i] *= pre;
  mR[i] *= pre;
}
compress(mL, mR, { threshold: -15, ratio: 1.8, attack: 0.03, release: 0.3, knee: 8, makeup: 3 });
limit(mL, mR, { ceiling: -1, lookahead: 0.004, release: 0.1 });
// fade the very end
const fade = Math.round(1.0 * SR);
for (let i = 0; i < fade; i++) {
  mL[LEN - 1 - i] *= i / fade;
  mR[LEN - 1 - i] *= i / fade;
}

let acc = 0;
for (let i = 0; i < LEN; i++) acc += mL[i] * mL[i] + mR[i] * mR[i];
console.log('master RMS', (10 * Math.log10(acc / (2 * LEN))).toFixed(1), 'dBFS; length', songSec.toFixed(1), 's; pre-gain', (20 * Math.log10(pre)).toFixed(1), 'dB');
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 1));
fs.writeFileSync(path.join(OUT, 'glass-tower.wav'), encodeWav(mL, mR));

// note data for the visualiser
if (FROM === 0 && TO >= END_BAR) {
  const notes = events
    .filter((e) => !DRUMS.has(e.inst))
    .map((e) => [e.inst, +(e.s / SR).toFixed(3), +(e.n / SR).toFixed(3), e.m, +e.v.toFixed(2)]);
  const hits = events.filter((e) => DRUMS.has(e.inst)).map((e) => [e.inst, +(e.s / SR).toFixed(3), +e.v.toFixed(2)]);
  const sections = SECTIONS.map((s) => ({ name: s.name, t: +beatToSec(s.bar * 4).toFixed(3) }));
  fs.writeFileSync(path.join(OUT, 'notes.json'), JSON.stringify({ duration: songSec, sections, notes, hits }));
}

// optional mp3
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
  fs.writeFileSync(path.join(OUT, 'glass-tower.mp3'), Buffer.concat(chunks));
  console.log('wrote mp3');
} catch (e) {
  console.log('(mp3 skipped: ' + e.message.split('\n')[0] + ')');
}
