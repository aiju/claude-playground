// Drum machine (909-flavoured kick, snare, clap, metallic hats, crash, toms) and the
// cathedral's percussion: timpani and a minor-third church bell. Also the harpsichord.

import { SR, TAU, mtof, rng, squareBL, panGains, clamp, SVF } from './dsp.js';

function add(out, idx, y, gl, gr) {
  if (idx < 0 || idx >= out.L.length) return;
  out.L[idx] += y * gl;
  out.R[idx] += y * gr;
}

export function kick(out, s, { v = 100, gain = 1 }) {
  const len = Math.round(0.4 * SR);
  const vel = (v / 100) * gain;
  const r = rng(s);
  const click = new SVF();
  click.set(4000, 0.9);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 54 + 150 * Math.exp(-t / 0.035) + 100 * Math.exp(-t / 0.004);
    ph += f / SR;
    let y = Math.sin(TAU * ph) * Math.exp(-t / 0.17) * Math.min(1, t / 0.0006);
    y = Math.tanh(y * 2.2) * 0.85;
    // Beater: a short burst of band-passed noise and a 1.6 kHz blip.
    click.tick(r() * 2 - 1);
    y += click.bp * Math.exp(-t / 0.004) * 0.6;
    y += Math.sin(TAU * 1600 * t) * Math.exp(-t / 0.0015) * 0.15;
    add(out, s + i, y * vel * 0.8, 1, 1);
  }
}

// 909-style snare with a gated-reverb burst behind it, as on 80s/90s dance records.
export function snare(out, s, { v = 100, gain = 1, pan = 0, tone = 1, gate = 1 }) {
  const len = Math.round(0.35 * SR);
  const vel = (v / 100) * gain;
  const [gl, gr] = panGains(pan);
  const r = rng(s + 1);
  const hp = new SVF(), bp = new SVF(), gbp = new SVF();
  hp.set(1400, 0.7);
  bp.set(5000, 0.9);
  gbp.set(2200, 0.5);
  let p1 = 0, p2 = 0;
  const r2 = rng(s + 99);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    p1 += (190 * (1 + 0.3 * Math.exp(-t / 0.012))) / SR;
    p2 += (340 * (1 + 0.2 * Math.exp(-t / 0.01))) / SR;
    const body = (Math.sin(TAU * p1) * 1.0 + Math.sin(TAU * p2) * 0.45) * Math.exp(-t / 0.075) * tone;
    const n = r() * 2 - 1;
    hp.tick(n);
    bp.tick(n);
    const noise = (hp.hp * 0.7 + bp.bp * 0.5) * Math.exp(-t / 0.13);
    // Gate: dense noise that swells in, holds, then is cut off at ~190 ms.
    const ge = t < 0.012 ? t / 0.012 : t < 0.17 ? 1 - (t - 0.012) * 1.6 : Math.max(0, (1 - 0.157 * 1.6) * (1 - (t - 0.17) / 0.02));
    const gn = gbp.tick(r2() * 2 - 1) * ge * 0.45 * gate;
    const l = (body * 0.9 + noise) * Math.min(1, t / 0.0006);
    add(out, s + i, (l + gn) * vel * 0.55, gl, gr);
  }
}

// Hand clap: a few quick noise bursts then a short tail.
export function clap(out, s, { v = 100, gain = 1, pan = 0 }) {
  const len = Math.round(0.3 * SR);
  const vel = (v / 100) * gain;
  const [gl, gr] = panGains(pan);
  const r = rng(s + 2);
  const bp = new SVF();
  bp.set(1300, 1.3);
  const bursts = [0, 0.009, 0.018, 0.027];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let e = 0;
    for (const b of bursts) if (t >= b) e = Math.max(e, Math.exp(-(t - b) / (b === 0.027 ? 0.09 : 0.006)));
    const y = bp.tick(r() * 2 - 1) * e;
    add(out, s + i, y * vel * 0.9, gl, gr);
  }
}

// 808/909-style metal: six detuned square waves, band-passed.
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.72);
function metal(out, s, len, { v, gain, pan, decay, hpHz, seed, noiseAmt = 0.2 }) {
  const vel = (v / 100) * gain;
  const [gl, gr] = panGains(pan);
  const r = rng(seed);
  const ph = METAL.map(() => r());
  const bp = new SVF(), hp = new SVF();
  bp.set(10000, 1.2);
  hp.set(hpHz, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let y = 0;
    for (let j = 0; j < 6; j++) {
      const dt = METAL[j] / SR;
      ph[j] += dt; if (ph[j] >= 1) ph[j] -= 1;
      y += squareBL(ph[j], dt);
    }
    y = y / 6 + (r() * 2 - 1) * noiseAmt;
    bp.tick(y);
    hp.tick(bp.bp);
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.0005);
    add(out, s + i, hp.hp * env * vel * 0.5, gl, gr);
  }
}

export function hat(out, s, { v = 80, gain = 1, pan = 0.25 }) {
  metal(out, s, Math.round(0.12 * SR), { v, gain, pan, decay: 0.028, hpHz: 7000, seed: s });
}

export function openHat(out, s, { v = 80, gain = 1, pan = 0.25 }) {
  metal(out, s, Math.round(0.6 * SR), { v, gain, pan, decay: 0.16, hpHz: 6500, seed: s });
}

export function crash(out, s, { v = 100, gain = 1, pan = -0.3 }) {
  metal(out, s, Math.round(3 * SR), { v, gain: gain * 0.9, pan, decay: 0.7, hpHz: 4500, seed: s, noiseAmt: 0.9 });
}

// Reversed crash: the cymbal's wash swelling up to a cut-off, used to suck into downbeats.
export function revCymbal(out, s, n, { v = 100, gain = 1, pan = 0.2 }) {
  const vel = (v / 100) * gain;
  const [gl, gr] = panGains(pan);
  const r = rng(s + 3);
  const ph = METAL.map(() => r());
  const hp = new SVF();
  hp.set(4000, 0.7);
  for (let i = 0; i < n; i++) {
    const x = i / n;
    let y = 0;
    for (let j = 0; j < 6; j++) {
      const dt = METAL[j] / SR;
      ph[j] += dt; if (ph[j] >= 1) ph[j] -= 1;
      y += squareBL(ph[j], dt);
    }
    y = y / 6 + (r() * 2 - 1) * 0.9;
    hp.tick(y);
    const env = Math.pow(x, 3) * (x > 0.985 ? (1 - x) / 0.015 : 1);
    add(out, s + i, hp.hp * env * vel * 0.4, gl, gr);
  }
}

export function tom(out, s, { m = 45, v = 100, gain = 1, pan = 0 }) {
  const f0 = mtof(m);
  const len = Math.round(0.5 * SR);
  const vel = (v / 100) * gain;
  const [gl, gr] = panGains(pan);
  const r = rng(s);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += (f0 * (1 + 0.6 * Math.exp(-t / 0.03))) / SR;
    const y = (Math.sin(TAU * ph) * Math.exp(-t / 0.18) + (r() * 2 - 1) * Math.exp(-t / 0.01) * 0.3) * Math.min(1, t / 0.0008);
    add(out, s + i, y * vel * 0.6, gl, gr);
  }
}

// ---- cathedral percussion ----------------------------------------------------------

// Timpani: membrane modes with a felt-mallet noise onset. Partial ratios after Rossing.
const TIMP = [[0.62, 0.9, 0.09], [1, 1, 2.2], [1.5, 0.6, 1.6], [1.98, 0.4, 1.2], [2.44, 0.25, 0.9], [2.9, 0.14, 0.7], [3.36, 0.07, 0.5]];
export function timpani(out, s, { m = 38, v = 100, gain = 1, pan = 0 }) {
  const f0 = mtof(m);
  const len = Math.round(3.5 * SR);
  const vel = (v / 100) * gain;
  const [gl, gr] = panGains(pan);
  const r = rng(s + m);
  const lp = new SVF();
  lp.set(1600, 0.6);
  const ph = TIMP.map(() => r());
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let y = 0;
    for (let j = 0; j < TIMP.length; j++) {
      const [ratio, a, d] = TIMP[j];
      ph[j] += (f0 * ratio * (1 + 0.03 * Math.exp(-t / 0.12))) / SR;
      y += Math.sin(TAU * ph[j]) * a * Math.exp(-t / (d * (v > 90 ? 1 : 0.8)));
    }
    y += lp.tick(r() * 2 - 1) * Math.exp(-t / 0.012) * 1.6;
    add(out, s + i, y * Math.min(1, t / 0.0015) * vel * 0.45, gl, gr);
  }
}

// A timpani roll as one sustained event: the membrane keeps ringing while each stroke
// re-excites it, so overlapping single hits would overstate the level.
export function timpaniRoll(out, s, n, { m = 45, v0 = 40, v1 = 110, gain = 1, pan = 0, rate = 13 }) {
  const f0 = mtof(m);
  const len = n + Math.round(1.8 * SR);
  const [gl, gr] = panGains(pan);
  const r = rng(s + m * 5);
  const lp = new SVF();
  lp.set(700, 0.7);
  const ph = TIMP.map(() => r());
  let amp = 0;
  let next = 0;
  let stroke = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const x = Math.min(1, i / n);
    const target = i < n ? (v0 + (v1 - v0) * x) / 100 : 0;
    if (i < n && i >= next) {
      next = i + Math.round((SR / rate) * (0.9 + 0.2 * r()));
      stroke = target;
    }
    // Strokes push the ringing level toward the target; it decays in between.
    amp += (stroke - amp) * 0.0025;
    stroke *= 0.9996;
    let y = 0;
    for (let j = 0; j < TIMP.length; j++) {
      const [ratio, a, d] = TIMP[j];
      if (d < 0.2) continue; // the thud mode dies too fast to sustain in a roll
      ph[j] += (f0 * ratio) / SR;
      y += Math.sin(TAU * ph[j]) * a;
    }
    const noise = lp.tick(r() * 2 - 1) * stroke * 0.25;
    const tailEnv = i < n ? 1 : Math.exp(-(i - n) / (0.6 * SR));
    add(out, s + i, (y * amp + noise) * tailEnv * gain * 0.4, gl, gr);
  }
}

// Church bell with a minor-third (tierce) partial. Each partial is a beating pair.
// [ratio to strike note, amplitude, decay seconds]
const BELL = [
  [0.5, 0.9, 16], [1, 0.6, 10], [1.19, 0.55, 7.5], [1.48, 0.22, 5], [2, 0.9, 5.5],
  [2.5, 0.28, 3], [2.67, 0.25, 2.6], [3, 0.3, 2.2], [3.35, 0.15, 1.8], [4, 0.2, 1.6], [4.6, 0.12, 1.2],
  [5.33, 0.12, 1], [6.1, 0.08, 0.7],
  // The clang of the clapper: short, high, inharmonic.
  [7.27, 0.2, 0.25], [8.93, 0.16, 0.18], [10.6, 0.12, 0.12], [12.9, 0.09, 0.08],
];
export function churchBell(out, s, { m = 50, v = 100, gain = 1, pan = 0, len = 12 }) {
  const f0 = mtof(m);
  const n = Math.round(len * SR);
  const vel = (v / 100) * gain;
  const [gl, gr] = panGains(pan);
  const r = rng(s + m * 3);
  const parts = [];
  for (const [ratio, a, d] of BELL) {
    const f = f0 * ratio * (1 + (r() - 0.5) * 0.01);
    if (f > 15000) continue;
    const beat = 0.4 + r() * 1.6;
    parts.push({ f, a, d, beat, ph: r() * TAU });
  }
  const hp = new SVF();
  hp.set(2500, 0.8);
  const thud = new SVF();
  thud.set(f0 * 0.8, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let y = thud.tick(r() * 2 - 1) * Math.exp(-t / 0.04) * 2.5;
    for (const p of parts) {
      const w = 1 - 0.35 * (0.5 + 0.5 * Math.cos(TAU * p.beat * t));
      y += Math.sin(TAU * p.f * t + p.ph) * p.a * w * Math.exp(-t / p.d);
    }
    hp.tick(r() * 2 - 1);
    y += hp.hp * Math.exp(-t / 0.006) * 0.6;
    const fadeOut = i > n - SR ? (n - i) / SR : 1;
    add(out, s + i, y * vel * 0.15 * Math.min(1, t / 0.001) * fadeOut, gl, gr);
  }
}

// ---- harpsichord -------------------------------------------------------------------

// Karplus-Strong string with a plectrum-position comb and a bright loop filter. Two
// strings per note (8' and 4') as on a two-manual instrument.
export function harpsichord(out, s, n, { m, v = 90, gain = 1, pan = 0, four = 0.45 }) {
  const [gl, gr] = panGains(pan);
  const vel = (v / 100) * gain;
  const total = Math.round(Math.min(n / SR + 0.3, 4.2) * SR);
  const strings = [{ m, a: 1 }, ...(four ? [{ m: m + 12, a: four }] : [])];
  const r = rng(s + m);
  for (const st of strings) {
    const f = mtof(st.m) * (1 + (r() - 0.5) * 0.0015);
    const bright = 0.82;
    // The loop filter delays by (1 - bright) samples; the allpass takes up the rest.
    const P = SR / f - (1 - bright);
    let N = Math.floor(P);
    let frac = P - N;
    if (frac < 0.15) { N -= 1; frac += 1; }
    const line = new Float32Array(N + 2);
    // Plucked excitation: noise, then a comb notch at 1/8 of the string length.
    for (let i = 0; i < N; i++) line[i] = r() * 2 - 1;
    const pos = Math.max(1, Math.round(N / 8));
    const ex = Float32Array.from(line);
    for (let i = 0; i < N; i++) line[i] = ex[i] - 0.9 * ex[(i + pos) % N];
    let mean = 0;
    for (let i = 0; i < N; i++) mean += line[i];
    mean /= N;
    for (let i = 0; i < N; i++) line[i] -= mean;
    // Allpass for the fractional part of the delay keeps high notes in tune.
    const c = (1 - frac) / (1 + frac);
    let apX = 0, apY = 0;
    let w = 0;
    let prev = 0;
    const loss = Math.pow(0.5, 1 / (f * clamp(2.2 * Math.pow(220 / f, 0.5), 0.6, 4)));
    const damp = Math.exp(-1 / (0.03 * SR));
    let off = 1;
    for (let i = 0; i < total; i++) {
      const x = line[w];
      // Loop filter: mostly pass-through, a little averaging.
      let y = bright * x + (1 - bright) * prev;
      prev = x;
      const ap = c * y + apX - c * apY;
      apX = y;
      apY = ap;
      if (i > n) off *= damp;
      line[w] = ap * loss * (i > n ? off : 1);
      w = (w + 1) % N;
      add(out, s + i, x * st.a * vel * 0.14, gl, gr);
    }
  }
}
