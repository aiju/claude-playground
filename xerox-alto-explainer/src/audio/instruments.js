// Synthesised sounds. Each one adds itself into a Float32Array at a time in
// seconds, so scenes can place sounds exactly where their pictures move.

import { RATE, sin1, saw, square, tri, SVF, rng, mtof } from './dsp.js';

// Sample range for a sound starting at t lasting dur, clipped to the buffer.
function span(out, t, dur) {
  const i0 = Math.max(0, Math.round(t * RATE));
  const i1 = Math.min(out.length, Math.round((t + dur) * RATE));
  return [i0, i1, Math.round(t * RATE)];
}

const osc = { sine: (p) => sin1(p), tri: (p) => tri(p), saw, square };

// A short click with a pitched ring: the heartbeat and most UI ticks.
export function tick(out, t, { freq = 3200, gain = 0.1, decay = 0.012, noise = 0.35, seed = 1 } = {}) {
  const [i0, i1, start] = span(out, t, decay * 7);
  const r = rng(seed + start);
  const k = Math.exp(-1 / (decay * RATE));
  const kn = Math.exp(-1 / (0.002 * RATE));
  const w = freq / RATE;
  let e = gain * (1 - noise);
  let en = gain * noise;
  for (let i = i0; i < i1; i++) {
    out[i] += e * sin1(w * (i - start)) + (en > 1e-6 ? en * (r() * 2 - 1) : 0);
    e *= k;
    en *= kn;
  }
}

// A pitched note with a quick attack and release; optional glide to
// freq * glide and a low-pass filter.
export function blip(out, t, { freq = 880, dur = 0.06, gain = 0.12, wave = 'square', glide = 1, attack = 0.002, release = 0.02, lp = 0 } = {}) {
  const [i0, i1, start] = span(out, t, dur + release);
  const f = lp ? new SVF(lp, 0.8) : null;
  const fn = osc[wave];
  let p = 0;
  for (let i = start; i < i1; i++) {
    const s = (i - start) / RATE;
    const fr = freq * Math.pow(glide, Math.min(1, s / dur));
    const dt = fr / RATE;
    p += dt;
    if (p >= 1) p -= 1;
    if (i < i0) continue;
    const env = Math.min(1, s / attack) * (s < dur ? 1 : Math.max(0, 1 - (s - dur) / release));
    let v = fn(p, dt) * env;
    if (f) v = f.process(v);
    out[i] += gain * v;
  }
}

// A held note (used for the task tones and the beam): like blip, but with a
// gentler envelope and a little vibrato so long notes don't sound dead.
export function tone(out, t, { freq = 220, dur = 0.5, gain = 0.08, wave = 'tri', attack = 0.01, release = 0.05, lp = 0, vib = 0 } = {}) {
  const [i0, i1, start] = span(out, t, dur + release);
  const f = lp ? new SVF(lp, 0.7) : null;
  const fn = osc[wave];
  let p = 0;
  for (let i = start; i < i1; i++) {
    const s = (i - start) / RATE;
    const dt = (freq * (1 + vib * sin1(5.5 * s))) / RATE;
    p += dt;
    if (p >= 1) p -= 1;
    if (i < i0) continue;
    const env = Math.min(1, s / attack) * (s < dur ? 1 : Math.max(0, 1 - (s - dur) / release));
    let v = fn(p, dt) * env;
    if (f) v = f.process(v);
    out[i] += gain * v;
  }
}

// A glide from f0 to f1 (exponential), for the scanning beam and blips that
// rise or fall.
export function sweep(out, t, { f0 = 200, f1 = 800, dur = 0.5, gain = 0.06, wave = 'sine', lp = 0 } = {}) {
  blip(out, t, { freq: f0, glide: f1 / f0, dur, gain, wave, lp, attack: 0.01, release: 0.04 });
}

// Filtered noise with a moving cutoff: breaths, chirps, whooshes.
export function noise(out, t, { dur = 0.1, gain = 0.1, fc = 3000, fcEnd = fc, q = 2, mode = 'band', attack = 0.003, decay = 0, seed = 7 } = {}) {
  const [i0, i1, start] = span(out, t, dur);
  const r = rng(seed + start);
  const f = new SVF(fc, q);
  for (let i = i0; i < i1; i++) {
    const s = (i - start) / RATE;
    const k = s / dur;
    if ((i & 31) === 0) f.set(fc * Math.pow(fcEnd / fc, k), q);
    f.process(r() * 2 - 1);
    const v = mode === 'band' ? f.band : mode === 'high' ? f.high : f.low;
    const env = Math.min(1, s / attack) * (decay ? Math.exp(-s / decay) : Math.min(1, (dur - s) / 0.02));
    out[i] += gain * v * env;
  }
}

// A relay pulling in: a dull knock, then the armature's smaller bounce.
export function clunk(out, t, { gain = 0.35 } = {}) {
  for (const [dt, g] of [[0, 1], [0.019, 0.45]]) {
    const [i0, i1, start] = span(out, t + dt, 0.12);
    const r = rng(start);
    const f = new SVF(900, 1.2);
    const snap = new SVF(3200, 2);
    for (let i = i0; i < i1; i++) {
      const s = (i - start) / RATE;
      const body = sin1((95 - 45 * Math.min(1, s / 0.05)) * s) * Math.exp(-s / 0.03);
      const n = r() * 2 - 1;
      const click = f.process(n) * Math.exp(-s / 0.006);
      snap.process(n);
      out[i] += gain * g * (0.8 * body + 1.4 * click + 1.1 * snap.band * Math.exp(-s / 0.0025));
    }
  }
}

// A low, soft thud: something settling into place.
export function thunk(out, t, { gain = 0.35, freq = 55 } = {}) {
  const [i0, i1, start] = span(out, t, 0.4);
  let p = 0;
  for (let i = i0; i < i1; i++) {
    const s = (i - start) / RATE;
    p += (freq * (1 + 1.2 * Math.exp(-s / 0.025))) / RATE;
    out[i] += gain * sin1(p) * Math.exp(-s / 0.12) * Math.min(1, s / 0.002);
  }
}

// A cartoon collision, for the Ethernet.
export function bonk(out, t, { gain = 0.18 } = {}) {
  blip(out, t, { freq: 330, glide: 0.55, dur: 0.11, gain, wave: 'square', lp: 1400, release: 0.05 });
  tick(out, t, { freq: 900, gain: gain * 0.8, decay: 0.02, noise: 0.6 });
}

// Two quick clicks, rising: a bit flipping.
export function flip(out, t, { gain = 0.14 } = {}) {
  tick(out, t, { freq: 1800, gain, decay: 0.008, noise: 0.2 });
  tick(out, t + 0.03, { freq: 2700, gain, decay: 0.01, noise: 0.2 });
}

// The disk head stepping: a sharp click with a metallic ping.
export function headClick(out, t, { gain = 0.2 } = {}) {
  noise(out, t, { dur: 0.012, gain: gain * 1.6, fc: 4000, q: 0.8, mode: 'high', decay: 0.003 });
  tone(out, t, { freq: 1180, dur: 0.01, gain: gain * 0.5, wave: 'sine', release: 0.06 });
}

// Renders a sound at RATE / D into a scratch buffer and adds it to out with
// linear interpolation: for sounds with nothing above a few kHz.
function atLowRate(out, t, dur, D, fill) {
  const n = Math.ceil(dur * (RATE / D)) + 2;
  const low = new Float32Array(n);
  fill(low, RATE / D);
  const start = Math.round(t * RATE);
  const end = Math.min(out.length, start + (n - 1) * D);
  for (let i = Math.max(0, start); i < end; i++) {
    const x = (i - start) / D;
    const j = x | 0;
    out[i] += low[j] + (low[j + 1] - low[j]) * (x - j);
  }
}

// The bass: seven of these to a bar. A plucked saw with a closing filter,
// over a sine an octave down. Computed at half rate (the filter tops out
// near 2 kHz).
export function bass(out, t, { note = 38, dur = 0.3, gain = 0.16, bright = 1 } = {}) {
  atLowRate(out, t, dur + 0.08, 2, (low, R) => {
    const dt = mtof(note) / R;
    const f = new SVF(1800, 1.4);
    const kAmp = Math.exp(-1 / (0.16 * R));
    const rel = Math.round(dur * R);
    let p = 0;
    let q = 0;
    let e = gain;
    for (let s = 0; s < low.length; s++) {
      p += dt;
      if (p >= 1) p -= 1;
      q += dt / 2;
      if (q >= 1) q -= 1;
      // The SVF assumes the full rate, so cutoffs are doubled to match.
      if ((s & 15) === 0) f.set(2 * (220 + 1300 * bright * Math.exp(-s / (0.06 * R))), 1.2);
      const v = f.process(saw(p, dt));
      low[s] = e * Math.min(1, s / (0.012 * R)) * (s < rel ? 1 : Math.max(0, 1 - (s - rel) / (0.08 * R))) * (0.8 * v + 0.55 * sin1(q));
      e *= kAmp;
    }
  });
}

// A soft chord: two slightly detuned saws per note, low-passed, with slow
// attack and release. It's all below 2 kHz, so it's computed at a quarter of
// the sample rate.
export function pad(out, t0, t1, { notes = [], gain = 0.035, attack = 0.9, release = 1.4, lp = 1300 } = {}) {
  const dur = t1 - t0;
  atLowRate(out, t0, dur + release, 4, (low, R) => {
    const f = new SVF(lp * 4, 0.6); // cutoff scaled for the quarter rate
    const oscs = notes.flatMap((m, k) => [-0.06, 0.06].map((d, j) => ({ dt: mtof(m + d) / R, p: ((k * 7 + j * 3) % 10) / 10 })));
    for (let i = 0; i < low.length; i++) {
      const s = i / R;
      let v = 0;
      for (let o = 0; o < oscs.length; o++) {
        const osc = oscs[o];
        osc.p += osc.dt;
        if (osc.p >= 1) osc.p -= 1;
        v += saw(osc.p, osc.dt);
      }
      const env = Math.min(1, s / attack) * (s < dur ? 1 : Math.max(0, 1 - (s - dur) / release));
      low[i] = gain * env * f.process(v);
    }
  });
}

// A small FM bell for accents and the last chord.
export function bell(out, t, { freq = 880, gain = 0.1, dur = 2.5, ratio = 3.5, index = 2.2 } = {}) {
  const [i0, i1, start] = span(out, t, dur);
  for (let i = i0; i < i1; i++) {
    const s = (i - start) / RATE;
    const mod = index * Math.exp(-s / 0.35) * sin1(freq * ratio * s);
    out[i] += gain * Math.exp(-s / (dur / 4)) * Math.min(1, s / 0.002) * sin1(freq * s + mod / (2 * Math.PI));
  }
}

// The five tasks' voices, used wherever a picture shows the schedule (the
// same colour always makes the same sound).
export const TASK_SOUND = {
  // Kept low-passed and quiet: it sits under the voice's own range.
  display: (out, t, dur, g = 1) => tone(out, t, { freq: 220, dur, gain: 0.03 * g, wave: 'square', lp: 1300, attack: 0.006, release: 0.03 }),
  horizontal: (out, t, dur, g = 1) => tone(out, t, { freq: 330, dur, gain: 0.027 * g, wave: 'square', lp: 1200, attack: 0.006, release: 0.03 }),
  refresh: (out, t, dur, g = 1) => tick(out, t, { freq: 2637, gain: 0.07 * g, decay: 0.01, noise: 0.1 }),
  disk: (out, t, dur, g = 1) => blip(out, t, { freq: 1760, dur: Math.min(dur, 0.04), gain: 0.07 * g, wave: 'square', lp: 5000 }),
  ethernet: (out, t, dur, g = 1) => noise(out, t, { dur: Math.max(0.05, dur), gain: 0.18 * g, fc: 2600, fcEnd: 4200, q: 5 }),
  emulator: (out, t, dur, g = 1) => {
    tone(out, t, { freq: 73.42, dur, gain: 0.12 * g, wave: 'tri', attack: 0.02, release: 0.08 });
    tone(out, t, { freq: 146.83, dur, gain: 0.04 * g, wave: 'sine', attack: 0.02, release: 0.08 });
  },
};
