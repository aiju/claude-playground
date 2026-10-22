// The composition. Everything is placed in beats; render.js turns beats into time
// through the tempo map, so the toccata can accelerate into the eurobeat tempo and the
// coda can slow back down into the cathedral.

import { seq, chord, voice, pcAbove, transposeChord, midi } from './theory.js';
import { REG } from './organ.js';

// ---- form --------------------------------------------------------------------------

const E0 = 60; // first beat at eurobeat tempo (bar 0 of the band)
export const bar = (n) => E0 + n * 4;

export const TEMPO = [
  { beat: 0, bpm: 60 },
  { beat: 8, bpm: 66 },
  { beat: 24, bpm: 66, ramp: true },
  { beat: 26, bpm: 40 },
  { beat: 28, bpm: 84, ramp: true },
  { beat: 52, bpm: 156 },
  { beat: bar(136), bpm: 156, ramp: true },
  { beat: bar(137), bpm: 66 },
  { beat: bar(143), bpm: 66, ramp: true },
  { beat: bar(144), bpm: 30 },
];

export const END_BEAT = bar(144);

export const FORM = [
  ['Bells', 0],
  ['Chorale', 8],
  ['Toccata (accelerando)', 28],
  ['Riff', bar(0)],
  ['Verse', bar(16)],
  ['Pre-chorus', bar(32)],
  ['Chorus', bar(40)],
  ['Riff', bar(56)],
  ['Passacaglia', bar(64)],
  ['Hybrid: organ and band', bar(88)],
  ['Duel', bar(96)],
  ['Pre-chorus (to E minor)', bar(104)],
  ['Final chorus', bar(112)],
  ['Riff', bar(128)],
  ['Coda', bar(136)],
];

// ---- material ----------------------------------------------------------------------

// The main riff. Its 3+3+2 rhythm runs through the whole piece; the toccata, the arp
// and the harpsichord all fill the gaps between its notes with chord tones.
const RIFF = [
  'D6:3 C#6:3 D6:2 A5:3 F5:3 A5:2 |',
  'Bb5:3 A5:3 Bb5:2 D6:3 F6:3 E6:2 |',
  'C6:3 Bb5:3 C6:2 E6:3 G6:3 F6:2 |',
  'E6:3 F6:3 E6:2 C#6:3 Bb5:3 A5:2 |',
];
const RIFF_TURN = 'E6:3 F6:3 G6:2 A6:3 G6:3 E6:2 |';
const RIFF8 = [...RIFF, ...RIFF.slice(0, 3), RIFF_TURN].join(' ');
const RIFF_CH = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'];

// Call and response: the same syncopated two-bar call, answered lower then higher.
const VERSE_CALL = 'r:2 D5:2 D5:2 E5:2 F5:3 E5:1 D5:2 A4:2 | C5:3 D5:1 E5:4 r:8 |';
const VERSE_ANSWER = 'r:2 D5:2 D5:2 E5:2 F5:3 G5:1 F5:2 D5:2 |';
const VERSE = [
  VERSE_CALL,
  VERSE_ANSWER,
  'E5:3 C#5:1 A4:4 r:8 |',
  'r:2 A5:2 A5:2 G5:2 F5:3 E5:1 F5:2 A5:2 |',
  'G5:3 F5:1 E5:4 r:4 C5:2 D5:2 |',
  'F5:3 E5:1 D5:2 Bb4:2 D5:4 F5:2 G5:2 |',
  'A5:6 G5:1 F5:1 E5:4 r:4 |',
];
const VERSE2 = [
  VERSE_CALL,
  VERSE_ANSWER,
  'E5:3 C#5:1 A4:4 C#5:2 D5:2 E5:4 |',
  'r:2 D6:2 D6:2 C6:2 A5:3 G5:1 F5:2 A5:2 |',
  'G5:3 F5:1 E5:4 r:4 E5:2 F5:2 |',
  'G5:3 F5:1 D5:2 Bb4:2 D5:2 F5:2 G5:2 A5:2 |',
  'A5:4 G5:2 F5:2 E5:4 C#5:4 |',
];
const VERSE_CH = ['Dm', 'C', 'Bb', 'A'];

const PRE = [
  'D5:6 G5:6 F5:2 D5:2 |',
  'E5:6 A5:6 G5:2 E5:2 |',
  'F5:6 Bb5:6 A5:2 F5:2 |',
  'G5:6 C6:6 Bb5:2 G5:2 |',
  'Bb5:4 A5:4 G5:4 D6:4 |',
  'C6:4 Bb5:4 A5:4 E6:4 |',
];
const PRE_END = ['D6:4 C6:4 Bb5:4 D6:4 |', 'C#6:8 E6:4 r:4 |'];
const PRE2_END = ['E6:4 C6:4 D6:4 F#6:4 |', 'D#6:8 F#6:4 r:4 |'];
const PRE_CH = ['Gm', 'Am', 'Bb', 'C', 'Gm', 'Am', 'Bb', 'A'];
const PRE2_CH = ['Gm', 'Am', 'Bb', 'C', 'Gm', 'Am', 'C D', 'B'];

const CHORUS_A = [
  'D5:2 F5:2 Bb5:3 A5:3 Bb5:2 F5:4 |',
  'E5:2 G5:2 C6:3 Bb5:3 C6:2 G5:4 |',
  'F5:2 A5:2 D6:3 C#6:3 D6:2 A5:4 |',
  'C6:6 A5:2 F5:2 G5:2 A5:2 C6:2 |',
];
const CHORUS = [
  ...CHORUS_A,
  'D6:6 C6:2 Bb5:4 A5:2 Bb5:2 |',
  'C6:6 Bb5:2 A5:4 G5:2 E5:2 |',
  'A5:3 C#6:3 E6:2 A6:4 G6:2 F6:2 |',
  'E6:12 r:4 |',
  ...CHORUS_A,
  'D6:6 C6:2 Bb5:2 C6:2 D6:2 G6:2 |',
  'F6:4 E6:4 C#6:2 D6:2 E6:4 |',
  'D6:16 |',
  'r:16 |',
].join(' ');
const CHORUS_CH = ['Bb', 'C', 'Dm', 'F', 'Bb', 'C', 'A', 'A', 'Bb', 'C', 'Dm', 'F', 'Gm', 'A', 'Dm', 'Dm'];

// Passacaglia ground and its variations.
const GROUND = ['Dm', 'C', 'Bb', 'A', 'Gm', 'Eb', 'A7', 'A'];
const GROUND_BASS = ['D3', 'C3', 'Bb2', 'A2', 'G2', 'Eb2', 'A2', 'A2'];
const CORNET = [
  'D5:6 C#5:6 D5:4 |',
  'E5:6 D5:6 C5:4 |',
  'D5:6 C5:6 Bb4:4 |',
  'C#5:6 Bb4:6 A4:4 |',
  'D5:4 G5:8 F5:4 |',
  'Eb5:6 D5:2 C5:4 Bb4:4 |',
  'C#5:4 E5:4 G5:4 Bb5:4 |',
  'A5:16 |',
].join(' ');
const PLENUM_8THS = [
  'A5:2 G5:2 F5:2 E5:2 F5:2 D5:2 A5:2 D6:2 |',
  'C6:2 Bb5:2 A5:2 G5:2 A5:2 E5:2 G5:2 C6:2 |',
  'Bb5:2 A5:2 G5:2 F5:2 G5:2 D5:2 F5:2 Bb5:2 |',
  'A5:2 G5:2 F5:2 E5:2 F5:2 C#5:2 E5:2 A5:2 |',
  'Bb5:2 A5:2 G5:2 D5:2 G5:2 A5:2 Bb5:2 D6:2 |',
  'Eb6:2 D6:2 C6:2 Bb5:2 G5:2 Bb5:2 Eb5:2 G5:2 |',
  'C#6:2 E6:2 G6:2 E6:2 C#6:2 Bb5:2 G5:2 E5:2 |',
  'A5:4 E5:4 C#5:4 A4:4 |',
].join(' ');
const ORGAN_THEME = [
  'D5:3 C#5:3 D5:2 A5:3 G5:3 F5:2 |',
  'E5:3 D5:3 E5:2 G5:3 F5:3 E5:2 |',
  'D5:3 C5:3 D5:2 F5:3 E5:3 D5:2 |',
  'C#5:3 Bb4:3 C#5:2 E5:3 G5:3 Bb5:2 |',
  'Bb5:3 A5:3 G5:2 D6:3 C6:3 Bb5:2 |',
  'G5:3 F5:3 Eb5:2 G5:3 Bb5:3 Eb6:2 |',
  'C#6:3 Bb5:3 G5:2 E5:3 C#5:3 Bb4:2 |',
  'A4:4 C#5:4 E5:4 A5:4 |',
].join(' ');
// The duel: synth and organ trade phrases over the ground, then play together.
const DUEL = [
  ['synth', 'D6:2 E6:1 F6:1 E6:2 D6:1 C#6:1 D6:2 A5:2 F5:2 A5:2 |'],
  ['synth', 'G5:1 A5:1 Bb5:1 C6:1 D6:1 E6:1 F6:1 G6:1 E6:4 C6:4 |'],
  ['organ', 'Bb5:2 F5:1 D5:1 Bb4:2 D5:1 F5:1 Bb5:2 D6:2 F6:4 |'],
  ['organ', 'E6:1 D6:1 C#6:1 Bb5:1 A5:1 G5:1 F5:1 E5:1 C#5:4 A4:4 |'],
  ['synth', 'G5:2 Bb5:2 D6:2 G6:2 F6:1 G6:1 F6:1 E6:1 D6:2 Bb5:2 |'],
  ['synth', 'Eb6:2 G6:2 Bb6:4 A6:1 G6:1 F6:1 Eb6:1 D6:4 |'],
  ['both', 'C#6:2 E6:2 G6:2 Bb6:2 A6:1 G6:1 F6:1 E6:1 D6:1 C#6:1 Bb5:1 A5:1 |'],
  ['both', 'A5:12 r:4 |'],
];

// ---- event helpers -----------------------------------------------------------------

let EV = [];
const push = (inst, t, d, p = {}) => EV.push({ inst, t, d, ...p });

// A progression array (one entry per bar, "C D" = two chords in the bar) as a lookup.
function chordsAt(prog, start, tr = 0) {
  const list = [];
  prog.forEach((p, i) => {
    const parts = p.split(' ');
    parts.forEach((sym, j) => list.push({ t: start + i * 4 + (j * 4) / parts.length, c: chord(transposeChord(sym, tr)) }));
  });
  return (t) => {
    let c = list[0].c;
    for (const x of list) if (x.t <= t + 1e-6) c = x.c;
    return c;
  };
}

function eachChord(prog, start, tr, fn) {
  prog.forEach((p, i) => {
    const parts = p.split(' ');
    parts.forEach((sym, j) => {
      const len = 4 / parts.length;
      fn(chord(transposeChord(sym, tr)), start + i * 4 + j * len, len, i);
    });
  });
}

// Toccata figuration: every melody note is followed by chord tones stepping down from
// it, one per 16th, until the next melody note.
function toccata(notes, chordAt, { lo = 50 } = {}) {
  const out = [];
  for (const n of notes) {
    const steps = Math.round(n.d * 4);
    out.push({ t: n.t, d: 0.25, m: n.m, v: n.v, acc: true });
    let cur = n.m;
    for (let k = 1; k < steps; k++) {
      const t = n.t + k * 0.25;
      const c = chordAt(t);
      let m = cur - 1;
      while (!c.pcs.includes(((m % 12) + 12) % 12) || n.m - m < 3) m--;
      if (m < lo) m += 12;
      out.push({ t, d: 0.25, m, v: n.v - 18, acc: false });
      cur = m;
    }
  }
  return out;
}

function organLine(notes, stops, { bus = 'organ', vel = 1, tr = 0, legato = 0.97, trem = 0 } = {}) {
  for (const n of notes) push('organ', n.t, n.d * legato, { m: n.m + tr, stops, vel: vel * (n.acc ? 1.05 : 1), bus, trem });
}

function organChord(t, d, ms, stops, { bus = 'organ', vel = 1, trem = 0 } = {}) {
  for (const m of ms) push('organ', t, d, { m, stops, vel, bus, trem });
}

function lead(notes, opts = {}, inst = 'lead') {
  if (!notes.length) return;
  push(inst, notes[0].t, notes[notes.length - 1].t + notes[notes.length - 1].d - notes[0].t, { notes, opts });
}

// Eurobeat octave bass: low-high 8ths, choosing the low note near the last one.
let lastBass = 38;
function octaveBass(prog, start, tr = 0, { style = 'oct', v = 100, skipLast = 0 } = {}) {
  eachChord(prog, start, tr, (c, t, len) => {
    let lo = pcAbove(c.bass, 33);
    if (Math.abs(lo + 12 - lastBass) < Math.abs(lo - lastBass) && lo + 12 <= 45) lo += 12;
    lastBass = lo;
    const steps = Math.round(len * 2);
    for (let k = 0; k < steps; k++) {
      const tt = t + k * 0.5;
      if (skipLast && tt >= start + prog.length * 4 - skipLast) continue;
      const m = style === 'oct' ? (k % 2 ? lo + 12 : lo) : lo;
      push('bass', tt, 0.4, { m, v: k % 2 ? v - 14 : v });
    }
  });
}

let lastVoicing = {};
function padChords(inst, prog, start, tr, { lo, hi, n = 4, v = 80, rhythm = null, bus, extra = {} }) {
  eachChord(prog, start, tr, (c, t, len) => {
    const vc = voice(c, { lo, hi, n, prev: lastVoicing[inst] });
    lastVoicing[inst] = vc;
    const hits = rhythm ? rhythm(len) : [[0, len]];
    for (const [off, d] of hits) {
      const accent = off % 1 === 0 ? 4 : 0;
      vc.forEach((m, j) => push(inst, t + off, d, { m, v: v + accent - (j === 0 ? 4 : 0) - ((t * 7 + off * 13) % 5), pan: (j / (n - 1) - 0.5) * 0.9, bus, ...extra }));
    }
  });
}

// Drum helpers (bars counted from E0).
function fourFloor(b0, b1, v = 105) {
  for (let b = b0; b < b1; b++) for (let k = 0; k < 4; k++) push('kick', bar(b) + k, 0.1, { v });
}
function backbeat(b0, b1, { snare = true, clap = true, v = 100 } = {}) {
  for (let b = b0; b < b1; b++)
    for (const k of [1, 3]) {
      if (snare) push('snare', bar(b) + k, 0.1, { v });
      if (clap) push('clap', bar(b) + k, 0.1, { v: v - 10 });
    }
}
function offHats(b0, b1, v = 85) {
  for (let b = b0; b < b1; b++) for (let k = 0; k < 4; k++) push('ohat', bar(b) + k + 0.5, 0.1, { v });
}
function hats(b0, b1, { sixteenths = true, v = 60 } = {}) {
  for (let b = b0; b < b1; b++)
    for (let s = 0; s < 16; s++) {
      if (s % 4 === 2) continue; // open hat's place
      if (!sixteenths && s % 2) continue;
      push('hat', bar(b) + s / 4, 0.05, { v: s % 4 === 0 ? v + 10 : v - (s % 2) * 12 });
    }
}
function fill(b, kind = 'snare') {
  const t = bar(b) + 3;
  const toms = [50, 47, 45, 43];
  for (let s = 0; s < 4; s++) {
    if (kind === 'tom') push('tom', t + s * 0.25, 0.2, { m: toms[s], v: 95 + s * 4, pan: 0.4 - s * 0.25 });
    else push('snare', t + s * 0.25, 0.1, { v: 80 + s * 8 });
  }
}
function roll(t0, t1, { v0 = 50, v1 = 115, inst = 'snare' } = {}) {
  let t = t0;
  let k = 0;
  while (t < t1 - 1e-6) {
    const x = (t - t0) / (t1 - t0);
    // Crescendo, with the hits on the beat leaning in and a little unevenness.
    const accent = Math.abs(t - Math.round(t)) < 1e-6 ? 8 : 0;
    push(inst, t, 0.1, { v: v0 + (v1 - v0) * x + accent - ((k++ * 37) % 9) });
    t += x < 0.5 ? 0.5 : x < 0.8 ? 0.25 : 0.125;
  }
}
function timpRoll(t0, t1, m, { v0 = 40, v1 = 110 } = {}) {
  push('timproll', t0, t1 - t0, { m, v0, v1 });
}

const brassRhythm = (len) => (len >= 4 ? [[0, 0.5], [0.75, 0.5], [1.5, 0.75], [2.5, 0.5], [3, 0.75]] : [[0, 0.5], [0.75, 0.75]]);
const riffBrassRhythm = (len) => (len >= 4 ? [[0, 0.6], [0.75, 0.6], [1.5, 0.4], [2, 0.6], [2.75, 0.6], [3.5, 0.4]] : [[0, len * 0.8]]);
const offbeatStabs = (len) => Array.from({ length: Math.round(len) }, (_, k) => [k + 0.5, 0.3]);

// ---- sections ----------------------------------------------------------------------

function prologue() {
  // Three tolls of the great bell; the pedal creeps in underneath.
  push('bell', 0, 12, { m: midi('D3'), v: 110, pan: -0.1 });
  push('bell', 3, 12, { m: midi('D3'), v: 95, pan: -0.1 });
  push('bell', 6, 12, { m: midi('A2'), v: 100, pan: 0.15 });
  push('organ', 2, 6, { m: midi('D2'), stops: REG.pedalSoft, vel: 0.8 });

  // Chorale: the riff in augmentation over a rising bass, D minor to A major.
  const P = REG.plenum, PED = REG.pedal;
  const sop = seq('D5:6 C#5:6 D5:4 | A5:6 F5:6 A5:4 | Bb5:6 A5:6 Bb5:4 | D6:6 F6:6 E6:4 |', 8, { name: 'chorale' });
  organLine(sop, [...P, 'trumpet'], { legato: 0.98 });
  const inner = [
    [8, 1.5, ['D4', 'F4', 'A4']], [9.5, 1.5, ['E4', 'G4', 'A4']], [11, 1, ['D4', 'F4', 'A4']],
    [12, 4, ['F4', 'A4', 'C5']],
    [16, 4, ['G4', 'Bb4', 'D5']],
    [20, 1.5, ['A4', 'D5', 'E5']], [21.5, 1.5, ['A4', 'D5', 'F5']], [23, 1, ['A4', 'C#5', 'E5']],
  ];
  for (const [t, d, ns] of inner) organChord(t, d * 0.98, ns.map(midi), P);
  [['D2', 8], ['F2', 12], ['G2', 16], ['A2', 20]].forEach(([n, t]) => push('organ', t, 3.95, { m: midi(n), stops: PED }));

  // Cadenza: a run down two octaves of D harmonic minor into a full A major chord.
  const run = 'E6 D6 C#6 Bb5 A5 G5 F5 E5 D5 C#5 Bb4 A4 G4 F4 E4 C#4'.split(' ');
  run.forEach((n, k) => push('organ', 24 + k * 0.125, 0.12, { m: midi(n), stops: REG.full }));
  organChord(26, 1.6, ['A3', 'E4', 'A4', 'C#5', 'E5', 'A5'].map(midi), REG.full);
  push('organ', 26, 1.6, { m: midi('A2'), stops: REG.pedalFull });
  push('timp', 26, 0.2, { m: midi('A2'), v: 115 });
  push('bell', 26, 10, { m: midi('A3'), v: 70, pan: 0.3 });
}

function toccataSection() {
  // The riff as a toccata, an octave down, accelerating while stops are drawn.
  const t0 = 28;
  const ch = chordsAt(RIFF_CH, t0);
  const fig = toccata(seq(RIFF8, t0, { tr: -12, name: 'toccata' }), ch, { lo: 52 });
  const regs = [REG.flutes, REG.flutes, REG.principals, REG.principals, REG.plenum, REG.plenum, REG.full, REG.full];
  for (const n of fig) {
    const b = Math.floor((n.t - t0) / 4);
    const soften = b >= 6 ? 0.85 : 1;
    push('organ', n.t, 0.24, { m: n.m, stops: regs[b], vel: (n.acc ? 1 : 0.85) * soften });
  }
  // Left hand chords and pedal.
  RIFF_CH.forEach((c, i) => {
    const t = t0 + i * 4;
    const vc = voice(c, { lo: 50, hi: 64, n: 3 });
    organChord(t, 3.9, vc, regs[i], { vel: 0.8 });
    const root = pcAbove(chord(c).root, 43);
    if (i < 4) push('organ', t, 3.9, { m: root, stops: i < 2 ? REG.pedalSoft : REG.pedal });
    else for (let k = 0; k < 8; k++) push('organ', t + k * 0.5, 0.45, { m: k % 2 ? root + 12 : root, stops: i < 6 ? REG.pedal : REG.pedalFull });
  });
  // The band arrives early: a heartbeat kick, then a snare roll, timpani and a riser.
  for (let k = 16; k < 32; k++) push('kick', t0 + k, 0.1, { v: 50 + (k - 16) * 3.5 });
  roll(t0 + 24, t0 + 31.5, { v0: 40, v1: 118 });
  timpRoll(t0 + 24, t0 + 31.5, midi('A2'), { v0: 30, v1: 105 });
  push('sweep', t0 + 20, 11.5, { dir: 'up', gain: 0.8 });
  push('revcym', t0 + 30, 2, { v: 110 });
}

function riff(b0, tr, { organ = false, brassRiff = true, intro = false } = {}) {
  const t0 = bar(b0);
  const ch = chordsAt(RIFF_CH, t0, tr);
  const prog = RIFF_CH.map((c) => transposeChord(c, tr));
  const mel = seq(RIFF8, t0, { tr, name: 'riff' });
  lead(mel, { cutoff: 6200 });
  // Under the first riff the organ holds open fifths, so the cathedral carries on.
  if (intro) eachChord(prog, t0, 0, (c, t, len) => {
    const r = pcAbove(c.root, 50);
    organChord(t, len * 0.98, [r, r + 7, r + 12, r + 19], REG.plenum, { bus: 'organBand', vel: 0.55 });
    push('organ', t, len * 0.98, { m: pcAbove(c.root, 38), stops: REG.pedal, vel: 0.6, bus: 'organBand' });
  });
  const fig = toccata(seq(RIFF8, t0, { tr: tr - 12 }), ch, { lo: 52 });
  fig.forEach((n, k) => push('pluck', n.t, 0.2, { m: n.m, v: n.acc ? 95 : 72, pan: k % 2 ? 0.6 : -0.6 }));
  if (organ) for (const n of fig) push('organ', n.t, 0.24, { m: n.m, stops: REG.plenum, vel: 0.5, bus: 'organBand' });
  octaveBass(prog, t0, 0);
  if (brassRiff) padChords('brass', prog, t0, 0, { lo: 55, hi: 74, n: 4, v: 95, rhythm: riffBrassRhythm });
  else padChords('brass', prog, t0, 0, { lo: 55, hi: 74, n: 4, v: 90, rhythm: (len) => [[0, 1.5], [1.5, 0.4]] });
  if (!intro) padChords('strings', prog, t0, 0, { lo: 57, hi: 81, n: 4, v: 70 });
  fourFloor(b0, b0 + 8);
  backbeat(b0, b0 + 8);
  offHats(b0, b0 + 8);
  hats(b0, b0 + 8);
  fill(b0 + 7, intro ? 'snare' : 'tom');
  push('crash', t0, 1, { v: 110 });
  push('orch', t0, 1, { root: midi('D4') + tr });
}

function verse(b0) {
  const t0 = bar(b0);
  const prog = [...VERSE_CH, ...VERSE_CH, ...VERSE_CH, ...VERSE_CH];
  const notes = seq([...VERSE, ...VERSE2].join(' '), t0, { name: 'verse', vel: 92 });
  lead(notes, {}, 'pulse');
  octaveBass(prog, t0);
  padChords('piano', prog, t0, 0, { lo: 57, hi: 76, n: 4, v: 85, rhythm: offbeatStabs });
  padChords('strings', prog, t0, 0, { lo: 50, hi: 69, n: 3, v: 55, extra: { attack: 0.6 } });
  fourFloor(b0, b0 + 16, 100);
  backbeat(b0, b0 + 8, { snare: false, clap: true, v: 95 });
  backbeat(b0 + 8, b0 + 16);
  hats(b0, b0 + 8, { sixteenths: false, v: 62 });
  hats(b0 + 8, b0 + 16);
  offHats(b0 + 8, b0 + 16, 78);
  push('crash', t0, 1, { v: 100 });
  push('crash', bar(b0 + 8), 1, { v: 90 });
  // Harpsichord broken chords in the second half keep the gothic colour.
  const ch = chordsAt(prog, t0);
  for (let s = 0; s < 8 * 16; s++) {
    const t = bar(b0 + 8) + s / 4;
    const c = ch(t);
    const vc = voice(c, { lo: 50, hi: 67, n: 3 });
    const pat = [0, 1, 2, 1];
    push('harpsi', t, 0.25, { m: vc[pat[s % 4]], v: s % 4 === 0 ? 72 : 58, pan: -0.5 });
  }
  fill(b0 + 15, 'snare');
}

function prechorus(b0, { second = false } = {}) {
  const t0 = bar(b0);
  const prog = second ? PRE2_CH : PRE_CH;
  const notes = seq([...PRE, ...(second ? PRE2_END : PRE_END)].join(' '), t0, { name: 'pre', vel: 92 });
  lead(notes, { cutoff: 5200, octave: 0.3 });
  padChords('strings', prog, t0, 0, { lo: 55, hi: 79, n: 4, v: 85 });
  padChords('brass', prog, t0, 0, { lo: 55, hi: 72, n: 4, v: 80, rhythm: (len) => (len >= 4 ? [[0, 1.8], [2, 1.8]] : [[0, len * 0.9]]) });
  octaveBass(prog.slice(0, 4), t0);
  octaveBass(prog.slice(4), bar(b0 + 4), 0, { style: 'root', skipLast: 2 });
  fourFloor(b0, b0 + 7);
  for (let k = 0; k < 2; k++) push('kick', bar(b0 + 7) + k, 0.1, { v: 105 });
  backbeat(b0, b0 + 4);
  hats(b0, b0 + 7, { sixteenths: false });
  offHats(b0, b0 + 7);
  roll(bar(b0 + 4), bar(b0 + 7) + 2, { v0: 50, v1: 120 });
  push('sweep', bar(b0 + 4), 14, { dir: 'up' });
  push('revcym', bar(b0 + 7) + 1, 3, { v: 110 });
  push('crash', t0, 1, { v: 95 });
  if (second) {
    organChord(bar(b0 + 7), 2, ['B3', 'D#4', 'F#4', 'B4'].map(midi), REG.full, { bus: 'organBand', vel: 0.8 });
    fill(b0 + 7, 'tom');
  }
}

function chorus(b0, tr, { final = false } = {}) {
  const t0 = bar(b0);
  const prog = CHORUS_CH.map((c) => transposeChord(c, tr));
  const notes = seq(CHORUS, t0, { tr, name: 'chorus', vel: 100 });
  lead(notes, { cutoff: 6800, sub: 0.25 });
  // A pulse an octave down thickens the melody, as a second synth would on the records.
  lead(notes.map((n) => ({ ...n, m: n.m - 12 })), { gain: 0.6, cutoff: 3200 }, 'pulse');
  padChords('brass', prog, t0, 0, { lo: 55, hi: 74, n: 4, v: 92, rhythm: brassRhythm });
  padChords('strings', prog, t0, 0, { lo: 57, hi: 84, n: 5, v: 70, extra: { cutoff: 2600 } });
  octaveBass(prog, t0);
  // 16th arpeggio of chord tones.
  eachChord(prog, t0, 0, (c, t, len) => {
    const vc = voice(c, { lo: 64, hi: 84, n: 4 });
    const pat = [0, 1, 2, 3, 2, 1, 2, 3];
    for (let s = 0; s < len * 4; s++) push('pluck', t + s / 4, 0.2, { m: vc[pat[s % 8]], v: s % 4 === 0 ? 85 : 68, pan: s % 2 ? 0.4 : -0.4, decay: 0.1 });
  });
  fourFloor(b0, b0 + 16);
  backbeat(b0, b0 + 16);
  offHats(b0, b0 + 16, 88);
  hats(b0, b0 + 16);
  for (const b of [0, 8]) push('orch', bar(b0 + b), 1, { root: chord(prog[b]).root + 60 });
  for (const b of [0, 4, 8, 12]) push('crash', bar(b0 + b), 1, { v: b % 8 ? 95 : 112 });
  fill(b0 + 7, 'snare');
  fill(b0 + 15, 'tom');
  if (final) {
    padChords('organ', prog, t0, 0, { lo: 55, hi: 72, n: 4, bus: 'organBand', extra: { stops: REG.plenum, vel: 0.42 } });
    eachChord(prog, t0, 0, (c, t, len) => push('organ', t, len * 0.97, { m: pcAbove(c.bass, 40), stops: REG.pedal, vel: 0.7, bus: 'organBand' }));
    push('bell', t0, 8, { m: midi('E3'), v: 90 });
    push('bell', bar(b0 + 8), 8, { m: midi('B2'), v: 85 });
  }
}

function passacaglia(b0) {
  const t0 = bar(b0);
  push('bell', t0, 12, { m: midi('D3'), v: 105 });

  // Variation 1: celeste and tremulant, with the theme on a cornet.
  organLine(seq(CORNET, t0, { name: 'cornet' }), REG.cornet, { vel: 1.1 });
  GROUND.forEach((c, i) => {
    const vc = voice(c, { lo: 53, hi: 67, n: 3, prev: i ? lastVoicing.g : null });
    lastVoicing.g = vc;
    organChord(t0 + i * 4, 3.95, vc, REG.soft, { trem: 1, vel: 0.9 });
    push('organ', t0 + i * 4, 3.95, { m: midi(GROUND_BASS[i]), stops: REG.pedalSoft, vel: 0.9 });
  });

  // Variation 2: plenum, running 8ths, timpani on the D and A bars.
  const t1 = bar(b0 + 8);
  organLine(seq(PLENUM_8THS, t1, { name: 'plenum8' }), REG.plenum, { legato: 0.92 });
  GROUND.forEach((c, i) => {
    const t = t1 + i * 4;
    const vc = voice(c, { lo: 53, hi: 67, n: 3, prev: lastVoicing.g });
    lastVoicing.g = vc;
    organChord(t, 1.95, vc, REG.plenum, { vel: 0.85 });
    organChord(t + 2, 1.95, vc, REG.plenum, { vel: 0.85 });
    push('organ', t, 3.95, { m: midi(GROUND_BASS[i]), stops: REG.pedal });
    const r = chord(c).root;
    if (r === 2 || r === 9) push('timp', t, 0.2, { m: r === 2 ? midi('D2') : midi('A2'), v: 100 });
  });

  // Variation 3: full organ toccata over pedal octaves; the drums come back.
  const t2 = bar(b0 + 16);
  const fig = toccata(seq(ORGAN_THEME, t2), chordsAt(GROUND, t2), { lo: 55 });
  for (const n of fig) push('organ', n.t, 0.24, { m: n.m, stops: REG.full, vel: n.acc ? 1 : 0.85 });
  GROUND.forEach((c, i) => {
    const t = t2 + i * 4;
    organChord(t, 3.95, voice(c, { lo: 50, hi: 62, n: 3 }), REG.plenum, { vel: 0.75 });
    const root = midi(GROUND_BASS[i]);
    for (let k = 0; k < 8; k++) push('organ', t + k * 0.5, 0.45, { m: k % 2 ? root + 12 : root, stops: REG.pedalFull });
  });
  fourFloor(b0 + 16, b0 + 24, 95);
  backbeat(b0 + 20, b0 + 23);
  hats(b0 + 20, b0 + 24, { sixteenths: false });
  roll(bar(b0 + 22), bar(b0 + 23) + 3.5, { v0: 45, v1: 120 });
  timpRoll(bar(b0 + 22), bar(b0 + 23) + 3.5, midi('A2'));
  push('sweep', bar(b0 + 20), 15.5, { dir: 'up' });
  push('revcym', bar(b0 + 23) + 2, 2, { v: 110 });
}

function hybrid(b0) {
  const t0 = bar(b0);
  const prog = [...GROUND, ...GROUND];
  // Organ takes the lead with the theme; harpsichord runs the toccata underneath.
  organLine(seq(ORGAN_THEME, t0), REG.full, { bus: 'organBand', vel: 0.72 });
  const fig = toccata(seq(ORGAN_THEME, t0, { tr: -12 }), chordsAt(GROUND, t0), { lo: 50 });
  fig.forEach((n) => push('harpsi', n.t, 0.25, { m: n.m, v: n.acc ? 105 : 88, pan: -0.45 }));
  const fig2 = toccata(seq(ORGAN_THEME, bar(b0 + 8), { tr: -12 }), chordsAt(GROUND, bar(b0 + 8)), { lo: 50 });
  fig2.forEach((n) => push('harpsi', n.t, 0.25, { m: n.m, v: n.acc ? 95 : 78, pan: -0.45 }));

  // The duel.
  DUEL.forEach(([who, s], i) => {
    const t = bar(b0 + 8 + i);
    const notes = seq(s, t, { name: 'duel', vel: 100 });
    if (who !== 'organ') lead(notes, { cutoff: 8000, glide: 0.02, gain: 0.8 });
    if (who !== 'synth') organLine(notes, REG.full, { bus: 'organBand', vel: who === 'both' ? 0.9 : 1.25, tr: who === 'both' ? -12 : 0 });
  });

  padChords('brass', prog, t0, 0, { lo: 55, hi: 74, n: 4, v: 88, rhythm: riffBrassRhythm });
  padChords('strings', prog, t0, 0, { lo: 50, hi: 74, n: 4, v: 70 });
  octaveBass(prog, t0);
  fourFloor(b0, b0 + 16);
  backbeat(b0, b0 + 16);
  offHats(b0, b0 + 16);
  hats(b0, b0 + 16);
  for (const b of [0, 8]) {
    push('crash', bar(b0 + b), 1, { v: 110 });
    push('orch', bar(b0 + b), 1, { root: midi('D4') });
  }
  push('timp', t0, 0.2, { m: midi('D2'), v: 120 });
  fill(b0 + 7, 'tom');
  fill(b0 + 15, 'snare');
}

function coda(b0) {
  const t0 = bar(b0);
  // Last hit, then the band stops and the cathedral is left ringing.
  // The hit goes to the cathedral too, so its splash carries into the chorale.
  push('orch', t0, 1, { root: midi('E4'), bus: 'finale' });
  push('crash', t0, 1, { v: 115, bus: 'finale' });
  push('kick', t0, 0.1, { v: 115 });
  push('timp', t0, 0.2, { m: midi('E2'), v: 120, bus: 'finale' });
  organChord(t0, 3.9, ['E3', 'B3', 'E4', 'G4', 'B4', 'E5'].map(midi), REG.full);
  push('organ', t0, 3.9, { m: midi('E2'), stops: REG.pedalFull });
  push('bell', t0, 14, { m: midi('E3'), v: 110 });

  // Chorale in E minor: the riff's opening again, down the Andalusian bass, to a
  // Picardy E major.
  const t1 = bar(b0 + 1);
  const sop = seq('E5:6 D#5:6 E5:4 | F#5:6 E5:6 D5:4 | E5:6 D5:6 C5:4 | D#5:6 C5:6 B4:4 | E5:8 A5:8 | B5:4 A5:4 F#5:4 D#5:4 | E5:16 |', t1, { name: 'coda' });
  organLine(sop, [...REG.plenum, 'trumpet'], { legato: 0.98 });
  const inner = [
    [0, 1.5, ['G4', 'B4']], [1.5, 1.5, ['F#4', 'A4']], [3, 1, ['G4', 'B4']],
    [4, 4, ['D4', 'F#4', 'A4']],
    [8, 4, ['C4', 'E4', 'G4']],
    [12, 4, ['B3', 'D#4', 'F#4']],
    [16, 4, ['A3', 'C4', 'E4']],
    [20, 4, ['B3', 'D#4', 'F#4', 'A4']],
    [24, 4, ['E3', 'B3', 'E4', 'G#4', 'B4']],
  ];
  for (const [t, d, ns] of inner) organChord(t1 + t, d * 0.98, ns.map(midi), t >= 24 ? REG.full : REG.plenum);
  [['E2', 0], ['D2', 4], ['C2', 8], ['B1', 12], ['A1', 16], ['B1', 20], ['E1', 24]].forEach(([n, t]) =>
    push('organ', t1 + t, 3.95, { m: midi(n) + 12, stops: t >= 24 ? REG.pedalFull : REG.pedal }),
  );
  push('bell', t1 + 24, 14, { m: midi('E3'), v: 100, pan: -0.1 });
  push('bell', t1 + 26, 14, { m: midi('B2'), v: 80, pan: 0.2 });
  push('timp', t1 + 24, 0.2, { m: midi('E2'), v: 100 });
}

// ---- assembly ----------------------------------------------------------------------

export function buildScore() {
  EV = [];
  lastBass = 38;
  lastVoicing = {};
  prologue();
  toccataSection();
  // The drop: full organ chord on the downbeat rings out over the band.
  organChord(bar(0), 2, ['D3', 'A3', 'D4', 'F4', 'A4', 'D5'].map(midi), REG.full, { vel: 0.8 });
  push('organ', bar(0), 2, { m: midi('D2'), stops: REG.pedalFull });
  riff(0, 0, { brassRiff: false, intro: true });
  riff(8, 0);
  verse(16);
  prechorus(32);
  chorus(40, 0);
  riff(56, 0, { organ: true });
  // Everything stops for the bell.
  passacaglia(64);
  hybrid(88);
  prechorus(104, { second: true });
  chorus(112, 2, { final: true });
  riff(128, 2, { organ: true });
  coda(136);
  // A half-beat of silence from the band before the final hit.
  const BAND = new Set(['kick', 'snare', 'clap', 'hat', 'ohat', 'bass', 'pluck', 'brass', 'tom']);
  EV = EV.filter((e) => !(BAND.has(e.inst) && e.t >= bar(136) - 0.5 && e.t < bar(136)));
  return EV.sort((a, b) => a.t - b.t);
}
