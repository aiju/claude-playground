// Eurobeat synthesizers: supersaw lead, brass, octave bass, arpeggio pluck, house
// piano, string pad, orchestra hit and noise risers.

import { SR, TAU, mtof, rng, sawBL, squareBL, panGains, clamp, SVF } from './dsp.js';

function write(out, idx, y, gl, gr) {
  out.L[idx] += y * gl;
  out.R[idx] += y * gr;
}

// ADSR value at time t (s) for a note held for `hold` seconds.
function adsr(t, hold, a, d, sus, r) {
  let v;
  if (t < a) v = t / a;
  else if (t < a + d) v = 1 - (1 - sus) * ((t - a) / d);
  else v = sus;
  if (t > hold) {
    const held = hold < a ? hold / a : hold < a + d ? 1 - (1 - sus) * ((hold - a) / d) : sus;
    v = held * Math.exp(-(t - hold) / r);
  }
  return v;
}

// ---- monophonic leads ---------------------------------------------------------------

// Walks a monophonic phrase sample by sample. The envelope carries its level from note
// to note (no restart from zero, so no clicks); connected notes glide, notes after a
// gap start fresh. Calls fn(idx, midiPitch, env, vel, tInNote, holdSeconds).
// notes: [{s, n, m, v, bend}] in samples, sorted. bend: semitones of scoop into the note.
function walkPhrase(notes, outLen, { attack, decay, sus, release, glide, vib, vibDepth = 0.18 }, fn) {
  if (!notes.length) return;
  const relK = Math.exp(-1 / (release * SR));
  const decK = Math.exp(-1 / ((decay / 3) * SR));
  const last = notes[notes.length - 1];
  const stop = Math.min(outLen, last.s + last.n + Math.round(release * 7 * SR));
  let k = -1, lvl = 0, from = notes[0].m, cur = notes[0].m, attackFrom = 0;
  for (let idx = Math.max(0, notes[0].s); idx < stop; idx++) {
    while (k + 1 < notes.length && notes[k + 1].s <= idx) {
      k++;
      const prev = notes[k - 1];
      const connected = prev && prev.s + prev.n >= notes[k].s - SR * 0.012;
      from = connected ? cur : notes[k].m;
      attackFrom = lvl;
    }
    if (k < 0) continue;
    const nt = notes[k];
    const t = (idx - nt.s) / SR;
    const holdS = nt.n / SR;
    let m = nt.m + (from - nt.m) * Math.exp(-t / glide);
    if (nt.bend) m -= nt.bend * Math.exp(-t / 0.06);
    if (vib && t > 0.22 && holdS > 0.3) m += vib * vibDepth * Math.min(1, (t - 0.22) / 0.25) * Math.sin(TAU * 5.6 * t);
    cur = m;
    if (t < holdS) {
      if (t < attack) lvl = attackFrom + (1 - attackFrom) * (t / attack);
      else lvl = sus + (lvl - sus) * decK;
    } else lvl *= relK;
    fn(idx, m, lvl, (nt.v ?? 100) / 100, t, holdS);
  }
}

// Supersaw lead: seven detuned saws spread across the stereo field, each doubled an
// octave below, with glide, delayed vibrato and a bright filter that opens on attacks.
export function supersawPhrase(out, notes, { voices = 7, detune = 0.22, cutoff = 7000, q = 0.8, gain = 1, octave = 0.6, glide = 0.035, width = 0.9, attack = 0.004, release = 0.09, vib = 1, sub = 0 } = {}) {
  if (!notes.length) return;
  const spread = [0, -0.11, 0.11, -0.39, 0.39, -0.75, 0.75, -1, 1].slice(0, voices);
  const amps = spread.map((x, i) => (i === 0 ? 1 : 0.62));
  const gains = spread.map((x) => panGains(x * width));
  const ratios = spread.map((x) => Math.pow(2, (x * detune) / 12));
  const r = rng(notes[0].s + 11);
  const ph = spread.map(() => r());
  const ph2 = spread.map(() => r());
  let subPh = 0;
  const fL = new SVF(), fR = new SVF();
  walkPhrase(notes, out.L.length, { attack, decay: 0.15, sus: 0.85, release, glide, vib }, (idx, m, env, vel, t) => {
    const f = mtof(m);
    let l = 0, rr = 0;
    for (let j = 0; j < spread.length; j++) {
      const dt = (f * ratios[j]) / SR;
      ph[j] += dt; if (ph[j] >= 1) ph[j] -= 1;
      let y = sawBL(ph[j], dt) * amps[j];
      if (octave) {
        const dt2 = dt * 0.5;
        ph2[j] += dt2; if (ph2[j] >= 1) ph2[j] -= 1;
        y += sawBL(ph2[j], dt2) * amps[j] * octave;
      }
      l += y * gains[j][0];
      rr += y * gains[j][1];
    }
    if (sub) {
      subPh += f / 2 / SR; if (subPh >= 1) subPh -= 1;
      const sq = squareBL(subPh, f / 2 / SR) * sub;
      l += sq; rr += sq;
    }
    const fc = clamp(cutoff * (0.55 + 0.45 * env) * (1 + 0.5 * Math.exp(-t / 0.05)), 200, 16000);
    fL.set(fc, q); fR.set(fc, q);
    const a = env * vel * gain * 0.09;
    out.L[idx] += fL.tick(l) * a;
    out.R[idx] += fR.tick(rr) * a;
  });
}

// Square/pulse lead for the verse, a softer voice than the supersaw.
export function pulsePhrase(out, notes, { gain = 1, pw = 0.32, cutoff = 4200, glide = 0.03, pan = 0, vib = 0.8 } = {}) {
  const [gl, gr] = panGains(pan);
  const flt = new SVF();
  let ph1 = 0, ph2 = 0.3;
  walkPhrase(notes, out.L.length, { attack: 0.006, decay: 0.2, sus: 0.75, release: 0.08, glide, vib, vibDepth: 0.19 }, (idx, m, env, vel, t) => {
    const f = mtof(m);
    const d1 = f / SR, d2 = (f * 1.004) / SR;
    ph1 += d1; if (ph1 >= 1) ph1 -= 1;
    ph2 += d2; if (ph2 >= 1) ph2 -= 1;
    const pwm = pw + 0.08 * Math.sin(TAU * 0.7 * (idx / SR));
    let y = squareBL(ph1, d1, pwm) + 0.7 * squareBL(ph2, d2, 1 - pwm);
    flt.set(cutoff * (0.6 + 0.6 * Math.exp(-t / 0.08)), 1.1);
    y = flt.tick(y) * env * vel * gain * 0.11;
    write(out, idx, y, gl, gr);
  });
}

// ---- polyphonic voices -------------------------------------------------------------

// Synth brass: five detuned saws per note spread across the stereo field, with a
// swelling filter envelope. fall: semitones of pitch drop at the end (a brass "fall").
const BRASS_DET = [0, 0.1, -0.12, 0.2, -0.22];
const BRASS_PAN = BRASS_DET.map((d, j) => panGains(j === 0 ? 0 : (j % 2 ? 0.7 : -0.7)));
export function brass(out, s, n, { m, v = 100, gain = 1, pan = 0, fall = 0, bright = 1 }) {
  const f0 = mtof(m);
  const r = rng(s + m);
  const ph = BRASS_DET.map(() => r());
  const fL = new SVF(), fR = new SVF();
  const hold = n / SR;
  const total = Math.min(n + Math.round(0.35 * SR), out.L.length - s);
  const vel = v / 100;
  const pg = panGains(pan);
  for (let i = Math.max(0, -s); i < total; i++) {
    const t = i / SR;
    let bend = 0;
    if (fall && t > hold - 0.12) bend = -fall * Math.pow(clamp((t - hold + 0.12) / 0.25, 0, 1), 2);
    let l = 0, rr = 0;
    for (let j = 0; j < BRASS_DET.length; j++) {
      const f = f0 * Math.pow(2, (BRASS_DET[j] + bend) / 12) * (1 + 0.002 * Math.exp(-t / 0.03));
      const dt = f / SR;
      ph[j] += dt; if (ph[j] >= 1) ph[j] -= 1;
      const y = sawBL(ph[j], dt);
      l += y * BRASS_PAN[j][0];
      rr += y * BRASS_PAN[j][1];
    }
    const env = adsr(t, hold, 0.012, 0.25, 0.7, 0.07);
    const fenv = Math.min(1, t / 0.035) * (0.55 + 0.45 * Math.exp(-t / 0.18));
    const fc = clamp((300 + 2800 * bright * fenv * vel) * (t > hold ? Math.exp(-(t - hold) / 0.1) : 1), 120, 16000);
    fL.set(fc, 0.9); fR.set(fc, 0.9);
    const a = env * vel * gain * 0.05;
    out.L[s + i] += fL.tick(l) * a * pg[0] * 1.41;
    out.R[s + i] += fR.tick(rr) * a * pg[1] * 1.41;
  }
}

// Octave-jumping eurobeat bass note: saw + square with a fast filter pluck.
export function bass(out, s, n, { m, v = 100, gain = 1 }) {
  const f0 = mtof(m);
  const flt = new SVF();
  const sub = new SVF();
  sub.set(140, 0.7);
  let p1 = 0, p2 = 0.5, p3 = 0;
  const hold = n / SR;
  const total = Math.min(n + Math.round(0.22 * SR), out.L.length - s);
  const vel = v / 100;
  for (let i = Math.max(0, -s); i < total; i++) {
    const t = i / SR;
    const f = f0 * (1 + 0.006 * Math.exp(-t / 0.01));
    const d1 = f / SR, d2 = (f * 1.003) / SR, d3 = f / 2 / SR;
    p1 += d1; if (p1 >= 1) p1 -= 1;
    p2 += d2; if (p2 >= 1) p2 -= 1;
    p3 += d3; if (p3 >= 1) p3 -= 1;
    let y = sawBL(p1, d1) * 0.6 + squareBL(p2, d2, 0.5) * 0.4;
    flt.set(clamp(f0 * 1.5 + 2600 * Math.exp(-t / 0.07) * vel, 60, 12000), 1.6);
    y = flt.tick(y);
    // A clean sine at the fundamental gives low notes weight without more buzz.
    const subAmt = clamp((60 - m) / 18, 0, 0.6);
    y += Math.sin(TAU * p3 * 2) * subAmt * 0.5;
    const env = adsr(t, hold, 0.002, 0.12, 0.75, 0.025);
    y = y * env * vel * gain * 0.32;
    out.L[s + i] += y;
    out.R[s + i] += y;
  }
}

// Short pulse pluck for 16th-note arpeggios.
export function pluck(out, s, n, { m, v = 100, gain = 1, pan = 0, decay = 0.14, bright = 1 }) {
  const f0 = mtof(m);
  const [gl, gr] = panGains(pan);
  const flt = new SVF();
  let p1 = 0, p2 = 0.25;
  const total = Math.min(Math.round((decay * 6 + 0.02) * SR), out.L.length - s);
  const vel = v / 100;
  for (let i = Math.max(0, -s); i < total; i++) {
    const t = i / SR;
    const d1 = f0 / SR, d2 = (f0 * 1.006) / SR;
    p1 += d1; if (p1 >= 1) p1 -= 1;
    p2 += d2; if (p2 >= 1) p2 -= 1;
    let y = squareBL(p1, d1, 0.3) + 0.6 * sawBL(p2, d2);
    flt.set(clamp(f0 * 2 + 5000 * bright * Math.exp(-t / 0.05), 100, 15000), 1.4);
    y = flt.tick(y) * Math.exp(-t / decay) * Math.min(1, t / 0.0015) * vel * gain * 0.07;
    write(out, s + i, y, gl, gr);
  }
}

// "House" piano in the M1 tradition: bright, percussive, slightly metallic.
export function housePiano(out, s, n, { m, v = 100, gain = 1, pan = 0 }) {
  const f0 = mtof(m);
  const [gl, gr] = panGains(pan);
  const B = 0.0004;
  const parts = [];
  for (let h = 1; h <= 14; h++) {
    const f = f0 * h * Math.sqrt(1 + B * h * h);
    if (f > 16000) break;
    parts.push({ f, a: Math.pow(h, -1.1) * (h === 2 ? 1.3 : 1) * (1 + 0.3 * Math.sin(h * 1.9)), d: 1.6 / (1 + 0.45 * h) * Math.pow(261 / f0, 0.3) });
  }
  const hold = n / SR;
  const total = Math.min(Math.round((hold + 0.25) * SR), Math.round(3 * SR), out.L.length - s);
  const vel = v / 100;
  const r = rng(s ^ m);
  const ph = parts.map(() => r() * TAU);
  for (let i = Math.max(0, -s); i < total; i++) {
    const t = i / SR;
    let y = 0;
    for (let j = 0; j < parts.length; j++) {
      const p = parts[j];
      y += Math.sin(TAU * p.f * t + ph[j]) * p.a * Math.exp(-t / p.d);
    }
    y += (r() * 2 - 1) * Math.exp(-t / 0.004) * 0.3;
    const off = t > hold ? Math.exp(-(t - hold) / 0.07) : 1;
    y *= Math.min(1, t / 0.002) * off * vel * gain * 0.07;
    write(out, s + i, y, gl, gr);
  }
}

// String ensemble pad: six detuned saws per note, slow attack, gentle filter.
export function strings(out, s, n, { m, v = 90, gain = 1, pan = 0, attack = 0.25, release = 0.6, cutoff = 3200 }) {
  const f0 = mtof(m);
  const r = rng(s * 3 + m);
  const det = [-0.14, -0.07, -0.02, 0.03, 0.08, 0.13];
  const ph = det.map(() => r());
  const lfoPh = det.map(() => r() * TAU);
  const fL = new SVF(), fR = new SVF();
  fL.set(cutoff, 0.6); fR.set(cutoff, 0.6);
  const hold = n / SR;
  const total = Math.min(n + Math.round(release * 5 * SR), out.L.length - s);
  const vel = v / 100;
  for (let i = Math.max(0, -s); i < total; i++) {
    const t = i / SR;
    let l = 0, rr = 0;
    for (let j = 0; j < det.length; j++) {
      const f = f0 * Math.pow(2, (det[j] + 0.04 * Math.sin(TAU * 0.3 * t + lfoPh[j])) / 12);
      const dt = f / SR;
      ph[j] += dt; if (ph[j] >= 1) ph[j] -= 1;
      const y = sawBL(ph[j], dt);
      if (j % 2) l += y; else rr += y;
    }
    const env = t < hold ? 1 - Math.exp(-t / (attack / 3)) : (1 - Math.exp(-hold / (attack / 3))) * Math.exp(-(t - hold) / release);
    const a = env * vel * gain * 0.03;
    const [gl, gr] = panGains(pan);
    out.L[s + i] += fL.tick(l) * a * gl * 1.4;
    out.R[s + i] += fR.tick(rr) * a * gr * 1.4;
    if (t > hold && env < 1e-4) break;
  }
}

// Orchestra hit: a brass/string chord stab, a timpani thump and a cymbal splash,
// then crushed to 12 bits at 22 kHz like a vintage sampler would.
export function orchHit(out, s, { root, v = 110, gain = 1 }) {
  const len = Math.round(0.9 * SR);
  const buf = new Float32Array(len);
  const r = rng(s + 77);
  // Root, fifths and octaves only, so the same hit works over major and minor chords.
  const notes = [root - 12, root, root + 7, root + 12, root + 19, root + 24];
  const flt = new SVF();
  const nz = new SVF();
  const phs = notes.map(() => [r(), r(), r()]);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let y = 0;
    for (let k = 0; k < notes.length; k++) {
      const f0 = mtof(notes[k]) * (1 - 0.03 * Math.min(1, t / 0.5));
      for (let j = 0; j < 3; j++) {
        const dt = (f0 * (1 + (j - 1) * 0.004)) / SR;
        phs[k][j] += dt; if (phs[k][j] >= 1) phs[k][j] -= 1;
        y += sawBL(phs[k][j], dt) * (k === 0 ? 0.8 : 0.5);
      }
    }
    flt.set(800 + 7000 * Math.exp(-t / 0.08), 0.8);
    y = flt.tick(y) * 0.12 * Math.exp(-t / 0.22) * Math.min(1, t / 0.003);
    y += Math.sin(TAU * (60 + 70 * Math.exp(-t / 0.05)) * t) * Math.exp(-t / 0.25) * 0.9;
    nz.set(5000, 0.5);
    nz.tick(r() * 2 - 1);
    y += nz.hp * Math.exp(-t / 0.15) * 0.25;
    buf[i] = y;
  }
  // Sample-and-hold to 22.05 kHz and 12-bit quantization.
  for (let i = 0; i < len; i += 2) {
    const q = Math.round(buf[i] * 2048) / 2048;
    buf[i] = q;
    if (i + 1 < len) buf[i + 1] = q;
  }
  const vel = (v / 110) * gain;
  for (let i = 0; i < len; i++) {
    const idx = s + i;
    if (idx < 0 || idx >= out.L.length) continue;
    out.L[idx] += buf[i] * vel;
    out.R[idx] += buf[i] * vel;
  }
}

// Noise riser (up) or downlifter (down) over n samples.
export function sweep(out, s, n, { dir = 'up', gain = 1, from = 300, to = 9000 }) {
  const fL = new SVF(), fR = new SVF();
  const r = rng(s + 5);
  const total = Math.min(n, out.L.length - s);
  for (let i = Math.max(0, -s); i < total; i++) {
    const x = i / n;
    const p = dir === 'up' ? x : 1 - x;
    const fc = from * Math.pow(to / from, p);
    fL.set(fc, 1.1); fR.set(fc * 1.05, 1.1);
    const amp = dir === 'up' ? Math.pow(x, 1.8) : Math.pow(1 - x, 2);
    const a = amp * gain * 0.25;
    out.L[s + i] += fL.tick(r() * 2 - 1) * a;
    out.R[s + i] += fR.tick(r() * 2 - 1) * a;
  }
}
