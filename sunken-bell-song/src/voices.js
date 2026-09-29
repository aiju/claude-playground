// Additional voices for this piece: additive ethnic leads, ensemble lines,
// chant, oud tremolo, synths, bells, hand percussion and water.

import { SR, TAU, sin1, blep, SVF, Biquad, OnePole, Drift, rng, clamp, panGains, addMono } from './dsp.js';
import { leadPhrases, formantFilter, susEnv, mixStereo, newStereo, C2R } from './instruments.js';

// ---------------------------------------------------------------------------
// Additive leads. The spectrum depends on frequency, harmonic number and
// dynamic (0..1), so louder notes get brighter the way real instruments do.
const SPECTRA = {
  duduk(fk, k, dyn) {
    let a = 1 / Math.pow(k, 1.9 - 0.9 * dyn);
    a *= 1 + 1.4 * Math.exp(-(((fk - 720) / 380) ** 2)) + 0.7 * Math.exp(-(((fk - 1550) / 520) ** 2));
    if (k % 2 === 0) a *= 0.72;
    a /= 1 + (fk / (2200 + 2600 * dyn)) ** 4;
    return a;
  },
  erhu(fk, k, dyn) {
    let a = 1 / Math.pow(k, 1.05 - 0.25 * dyn);
    a *= 1 + 2.2 * Math.exp(-(((fk - 950) / 280) ** 2)) + 1.3 * Math.exp(-(((fk - 2500) / 650) ** 2));
    a *= 1 - 0.55 * Math.exp(-(((fk - 1600) / 250) ** 2));
    a /= 1 + (fk / (4500 + 3500 * dyn)) ** 4;
    return a;
  },
  flute(fk, k, dyn) {
    const base = [0, 1, 0.32 + 0.2 * dyn, 0.12 + 0.12 * dyn, 0.05 + 0.06 * dyn, 0.02, 0.01][k] ?? 0;
    return base / (1 + (fk / 5000) ** 4);
  },
};

export function additiveLead(bus, phrases, o = {}) {
  const spec = SPECTRA[o.spectrum ?? 'duduk'];
  const rand = rng(o.seed ?? 21);
  const K = o.harmonics ?? 30;
  const BLK = 64;
  const breath = o.breath ?? 0.03;
  const noiseCenter = o.noiseCenter ?? 0; // 0 = track pitch
  for (const p of phrases) {
    const { len, f0, amp, art } = p;
    const x = new Float32Array(len);
    const aPrev = new Float32Array(K + 1);
    const aNext = new Float32Array(K + 1);
    const nb = new SVF(1000, o.noiseQ ?? 2);
    const air = new Biquad('hp', 3000, 0.7);
    let ph = rand();
    const compute = (arr, i) => {
      const j = Math.min(i, len - 1);
      const f = f0[j];
      const dyn = clamp(amp[j] / (o.refAmp ?? 0.8), 0, 1);
      let norm = 0;
      for (let k = 1; k <= K; k++) {
        const fk = f * k;
        const v = fk < 15000 ? spec(fk, k, dyn) : 0;
        arr[k] = v;
        norm += v * v;
      }
      const g = 1 / Math.sqrt(norm || 1);
      for (let k = 1; k <= K; k++) arr[k] *= g;
    };
    compute(aPrev, 0);
    const shimmer = new Drift(9, rand);
    for (let i0 = 0; i0 < len; i0 += BLK) {
      compute(aNext, i0 + BLK);
      const end = Math.min(len, i0 + BLK);
      nb.set(noiseCenter || f0[i0] * 1.5, o.noiseQ ?? 2);
      for (let i = i0; i < end; i++) {
        const u = (i - i0) / BLK;
        ph += f0[i] / SR;
        if (ph >= 1) ph -= 1;
        let s = 0;
        for (let k = 1; k <= K; k++) {
          const ak = aPrev[k] + (aNext[k] - aPrev[k]) * u;
          if (ak > 1e-4) s += ak * sin1(k * ph);
        }
        const a = amp[i] * (1 + 0.025 * shimmer.next());
        const n = rand() * 2 - 1;
        nb.process(n);
        const noise = (nb.band * nb.k * 0.8 + air.process(n) * 0.25) * (breath + (o.attackNoise ?? 0.12) * art[i]);
        x[i] = (s + noise) * a;
      }
      aPrev.set(aNext);
    }
    if (o.eq) for (const e of o.eq) new Biquad(...e).run(x);
    addMono(bus, x, p.s, o.pan ?? 0, o.gain ?? 0.5);
  }
}

// ---------------------------------------------------------------------------
// Ensemble lines: several slightly different performers following one melody.
function ensembleSources(notes, o, voiceFn) {
  const voices = o.voices ?? 5;
  const rand = rng(o.seed ?? 31);
  let s0 = Infinity;
  let s1 = 0;
  for (const nt of notes) {
    s0 = Math.min(s0, nt.s);
    s1 = Math.max(s1, nt.s + nt.n);
  }
  s0 = Math.max(0, s0 - Math.round(0.15 * SR));
  const len = s1 - s0 + Math.round(1.2 * SR);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const spread = o.spread ?? 0.7;
  for (let k = 0; k < voices; k++) {
    const u = voices > 1 ? (2 * k) / (voices - 1) - 1 : 0;
    const off = Math.round((rand() - 0.5) * (o.looseness ?? 0.04) * SR);
    const det = Math.exp((u * (o.detune ?? 8) + (rand() - 0.5) * 5) * C2R);
    const shifted = notes.map((n) => ({ ...n, s: Math.max(0, n.s + off), f: n.f * det, grace: n.grace ? n.grace.map((g) => g * det) : null, trill: n.trill ? n.trill * det : null }));
    const phrases = leadPhrases(shifted, {
      ...(o.lead || {}),
      seed: (o.seed ?? 31) * 7 + k * 13,
      vibDepth: (o.vib ?? 20) * (0.6 + rand() * 0.8),
      vibRate: (o.vibRate ?? 5.3) * (0.9 + rand() * 0.2),
    });
    const [gl, gr] = panGains(spread * u + (o.pan ?? 0));
    for (const p of phrases) voiceFn(p, L, R, p.s - s0, gl, gr, rand);
  }
  return { L, R, s0, voices };
}

function sawVoice(breath) {
  return (p, L, R, off, gl, gr, rand) => {
    let ph = rand();
    for (let i = 0; i < p.len; i++) {
      const j = off + i;
      if (j < 0 || j >= L.length) continue;
      const dt = p.f0[i] / SR;
      ph += dt;
      if (ph >= 1) ph -= 1;
      const s = ((2 * ph - 1 - blep(ph, dt)) + (rand() * 2 - 1) * breath) * p.amp[i];
      L[j] += s * gl;
      R[j] += s * gr;
    }
  };
}

// Legato choir line ("aah"), formant filtered.
export function choirLine(bus, notes, o = {}) {
  if (!notes.length) return;
  const { L, R, s0, voices } = ensembleSources(notes, { vib: 22, ...o, lead: { attack: 0.12, release: 0.35, glide: 0.03, vibDelay: 0.25, ...(o.lead || {}) } }, sawVoice(0.14));
  const vowelAt = typeof o.vowel === 'function' ? (i) => o.vowel(i + s0) : () => o.vowel ?? 'a';
  const fl = formantFilter(L, o.voice ?? 'alto', vowelAt);
  const fr = formantFilter(R, o.voice ?? 'alto', vowelAt);
  new Biquad('hp', 160, 0.7).run(fl);
  new Biquad('hp', 160, 0.7).run(fr);
  mixStereo(bus, { L: fl, R: fr }, s0, (o.gain ?? 1) / Math.sqrt(voices));
}

// Legato string section line (for counter-melodies and bass lines).
export function stringLine(bus, notes, o = {}) {
  if (!notes.length) return;
  const { L, R, s0, voices } = ensembleSources(notes, { vib: 14, detune: 7, ...o, lead: { attack: 0.09, release: 0.3, glide: 0.02, vibDelay: 0.18, ...(o.lead || {}) } }, sawVoice(0.02));
  const top = Math.max(...notes.map((n) => n.f));
  const fc = clamp(top * 4 + 1500, 1200, 8000) * (o.bright ?? 1);
  for (const ch of [L, R]) {
    const a = new SVF(fc, 0.6);
    const b = new SVF(fc * 1.4, 0.7);
    for (let i = 0; i < ch.length; i++) ch[i] = b.process(a.process(ch[i]));
    new Biquad('peak', 300, 1.2, 3).run(ch);
    new Biquad('peak', 2600, 1, 2).run(ch);
    new Biquad('hp', o.hp ?? 60, 0.7).run(ch);
  }
  mixStereo(bus, { L, R }, s0, (o.gain ?? 1) / Math.sqrt(voices));
}

// Staccato chant ("ta"/"ha"): short formant notes with a consonant burst.
export function chant(bus, notes, o = {}) {
  if (!notes.length) return;
  const voices = o.voices ?? 4;
  const rand = rng(o.seed ?? 41);
  let s0 = Infinity;
  let s1 = 0;
  for (const nt of notes) {
    s0 = Math.min(s0, nt.s);
    s1 = Math.max(s1, nt.s + nt.n);
  }
  s0 = Math.max(0, s0 - 1000);
  const len = s1 - s0 + Math.round(0.6 * SR);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const cL = new Float32Array(len);
  const cR = new Float32Array(len);
  for (const nt of notes) {
    const hold = Math.min(nt.n * 0.6, 0.14 * SR);
    const nlen = Math.round(hold + 0.35 * SR);
    for (let k = 0; k < voices; k++) {
      const u = voices > 1 ? (2 * k) / (voices - 1) - 1 : 0;
      const f = nt.f * Math.exp((u * 10 + (rand() - 0.5) * 6) * C2R);
      const [gl, gr] = panGains(0.8 * u * (k % 2 ? 1 : -1));
      const off = nt.s - s0 + Math.round(rand() * 0.018 * SR);
      let ph = rand();
      const aS = 0.012 * SR;
      for (let i = 0; i < nlen && off + i < len; i++) {
        const e = (i < aS ? i / aS : 1) * (i < hold ? 1 : Math.exp(-(i - hold) / (0.05 * SR))) * nt.v;
        const dt = f / SR;
        ph += dt;
        if (ph >= 1) ph -= 1;
        const s = ((2 * ph - 1 - blep(ph, dt)) + (rand() * 2 - 1) * 0.1) * e;
        L[off + i] += s * gl;
        R[off + i] += s * gr;
      }
    }
    // consonant: a short burst of hiss
    const bp = new Biquad('bp', o.consonantHz ?? 4200, 1.3);
    const cn = Math.round(0.018 * SR);
    const off = nt.s - s0;
    for (let i = 0; i < cn && off + i < len; i++) {
      const s = bp.process(rand() * 2 - 1) * Math.exp(-i / (0.005 * SR)) * nt.v * (o.consonant ?? 0.9);
      cL[off + i] += s;
      cR[off + i] += s * 0.9;
    }
  }
  const fl = formantFilter(L, o.voice ?? 'tenor', () => o.vowel ?? 'a');
  const fr = formantFilter(R, o.voice ?? 'tenor', () => o.vowel ?? 'a');
  for (let i = 0; i < len; i++) {
    fl[i] += cL[i];
    fr[i] += cR[i];
  }
  mixStereo(bus, { L: fl, R: fr }, s0, (o.gain ?? 1) / Math.sqrt(voices));
}

// ---------------------------------------------------------------------------
// Oud tremolo: one plucked string re-excited by a fast plectrum.
export function oudTrem(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const rate = (o.rate ?? 0.058) * SR;
  const len = nt.n + Math.round(0.9 * SR);
  const x = new Float32Array(len);
  const N = SR / nt.f;
  const Nn = Math.max(2, Math.round(N));
  // plectrum excitation
  const exc = new Float32Array(Nn);
  const lp = new OnePole(o.exciteFc ?? 5500);
  for (let i = 0; i < Nn; i++) exc[i] = lp.process(rand() * 2 - 1);
  const P = Math.max(1, Math.round(0.18 * Nn));
  for (let i = Nn - 1; i >= P; i--) exc[i] -= exc[i - P];
  let mean = 0;
  for (let i = 0; i < Nn; i++) mean += exc[i] / Nn;
  let pk = 1e-9;
  for (let i = 0; i < Nn; i++) pk = Math.max(pk, Math.abs((exc[i] -= mean)));
  for (let i = 0; i < Nn; i++) exc[i] /= pk;
  // pick schedule
  const picks = [];
  for (let t = 0, k = 0; t < nt.n; t += rate * (0.92 + rand() * 0.16), k++) picks.push([Math.round(t), (k % 2 ? 0.7 : 0.95) * (0.85 + rand() * 0.3)]);
  for (const c of o.strings ?? [-3, 3]) {
    const f = nt.f * Math.exp(c * C2R);
    const Nf = SR / f;
    const b = o.b ?? 0.7;
    const D = Nf - (1 - b);
    const M = Math.ceil(Nf) + 4;
    const buf = new Float32Array(M);
    const g = Math.pow(0.001, 1 / (f * (o.t60 ?? 1.6)));
    const gd = Math.pow(0.001, 1 / (f * 0.35));
    let w = 0;
    let prev = 0;
    let pi = 0;
    for (let i = 0; i < len; i++) {
      while (pi + 1 < picks.length && picks[pi + 1][0] <= i) pi++;
      let e = 0;
      const [ps, pg] = picks[pi] || [0, 0];
      if (i >= ps && i - ps < Nn) e = exc[i - ps] * pg;
      let rp = w - D;
      if (rp < 0) rp += M;
      const i0 = rp | 0;
      const fr = rp - i0;
      const xa = buf[i0];
      const xb = buf[i0 + 1 < M ? i0 + 1 : 0];
      const xv = xa + (xb - xa) * fr;
      const y = (i < nt.n ? g : gd) * (b * xv + (1 - b) * prev);
      prev = xv;
      buf[w] = y + e;
      if (++w >= M) w = 0;
      x[i] += y + e;
    }
  }
  const fade = Math.round(0.05 * SR);
  for (let i = 0; i < fade; i++) x[len - 1 - i] *= i / fade;
  for (const e of [['hp', 90, 0.7], ['peak', 190, 1.2, 4], ['peak', 480, 1.5, 2], ['peak', 3000, 1, 2]]) new Biquad(...e).run(x);
  addMono(bus, x, nt.s, nt.pan ?? o.pan ?? 0, nt.v * (o.gain ?? 0.18));
}

// ---------------------------------------------------------------------------
// Synths.
export function synthPluck(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const rel = 0.06;
  const len = nt.n + Math.round(rel * SR);
  const x = new Float32Array(len);
  let p1 = rand();
  let p2 = rand();
  const f = new SVF(1000, o.q ?? 3);
  const cut = nt.cut ?? o.cut ?? 2000;
  const dt1 = nt.f / SR;
  const dt2 = (nt.f * Math.exp(7 * C2R)) / SR;
  for (let i = 0; i < len; i++) {
    p1 += dt1;
    if (p1 >= 1) p1 -= 1;
    p2 += dt2;
    if (p2 >= 1) p2 -= 1;
    const saw = 2 * p1 - 1 - blep(p1, dt1);
    let sq = p2 < 0.5 ? 1 : -1;
    sq += blep(p2, dt2);
    sq -= blep((p2 + 0.5) % 1, dt2);
    const t = i / SR;
    const env = (t < 0.002 ? t / 0.002 : 1) * (0.65 + 0.35 * Math.exp(-t / 0.08)) * (i < nt.n ? 1 : Math.exp(-(i - nt.n) / (0.015 * SR)));
    if ((i & 15) === 0) f.set(clamp(cut * (0.45 + 1.4 * Math.exp(-t / 0.05)), 80, 16000), o.q ?? 3);
    x[i] = f.process(saw * 0.6 + sq * 0.4) * env;
  }
  addMono(bus, x, nt.s, nt.pan ?? 0, nt.v * (o.gain ?? 0.3));
}

export function sub(bus, nt) {
  const len = nt.n + Math.round(0.05 * SR);
  const x = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += (nt.f * (1 + 0.04 * Math.exp(-t / 0.02))) / SR;
    const env = (t < 0.004 ? t / 0.004 : 1) * (i < nt.n ? 1 : Math.exp(-(i - nt.n) / (0.012 * SR)));
    x[i] = (sin1(ph) + 0.18 * sin1(2 * ph)) * env;
  }
  addMono(bus, x, nt.s, 0, nt.v * 0.6);
}

// ---------------------------------------------------------------------------
// Church bell; nt.f is the strike (prime) pitch.
const BELL = [
  [0.5, 0.55, 30],
  [1.0, 0.5, 16],
  [1.19, 0.5, 12],
  [1.5, 0.3, 8],
  [2.0, 0.85, 7],
  [2.51, 0.3, 4.5],
  [2.66, 0.2, 4],
  [3.01, 0.28, 3],
  [4.07, 0.18, 2.2],
  [5.33, 0.1, 1.4],
  [6.8, 0.07, 1.0],
];
export function bell(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const scale = o.decay ?? 1;
  const len = Math.round(Math.min(16, 30 * scale * 0.7) * SR);
  const x = new Float32Array(len);
  const wob = o.wobble ?? 0;
  for (const [r, a, T] of BELL) {
    const fk = nt.f * r;
    if (fk > 16000) continue;
    for (const d of [-0.12, 0.12]) {
      let ph = rand();
      const dd = Math.exp(-6.9 / (T * scale * SR));
      let e = a * 0.5;
      for (let i = 0; i < len; i++) {
        const w = wob ? 1 + wob * 0.0006 * sin1((i * 0.37) / SR + r) : 1;
        ph += ((fk + d) * w) / SR;
        if (ph >= 1) ph -= 1;
        x[i] += sin1(ph) * e;
        e *= dd;
      }
    }
  }
  const bp = new Biquad('bp', 3200, 1.5);
  const cn = Math.round(0.03 * SR);
  for (let i = 0; i < cn; i++) x[i] += bp.process(rand() * 2 - 1) * 0.5 * Math.exp(-i / (0.006 * SR));
  const aS = Math.round(0.002 * SR);
  for (let i = 0; i < aS; i++) x[i] *= i / aS;
  const fade = Math.round(1.5 * SR);
  for (let i = 0; i < fade; i++) x[len - 1 - i] *= i / fade;
  if (o.lowpass) new Biquad('lp', o.lowpass, 0.7).run(x);
  addMono(bus, x, nt.s, nt.pan ?? o.pan ?? 0, nt.v * (o.gain ?? 0.35));
}

// ---------------------------------------------------------------------------
// Hand percussion.
export function riq(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const len = Math.round(0.35 * SR);
  const x = new Float32Array(len);
  const parts = [4700, 6100, 7300, 8600, 10200].map((f) => f * (0.97 + rand() * 0.06));
  for (const f of parts) {
    let ph = rand();
    const T = 0.06 + rand() * 0.08;
    for (let i = 0; i < len; i++) {
      ph += f / SR;
      x[i] += sin1(ph) * 0.18 * Math.exp(-i / (T * SR));
    }
  }
  const hp = new Biquad('hp', 5500, 0.7);
  for (let i = 0; i < len; i++) x[i] += hp.process(rand() * 2 - 1) * 0.5 * Math.exp(-i / (0.05 * SR));
  if (o.skin) {
    let ph = 0;
    for (let i = 0; i < 0.05 * SR; i++) {
      ph += 330 / SR;
      x[i] += sin1(ph) * 0.6 * Math.exp(-i / (0.012 * SR));
    }
  }
  const fade = Math.round(0.03 * SR);
  for (let i = 0; i < fade; i++) x[len - 1 - i] *= i / fade;
  addMono(bus, x, nt.s, nt.pan ?? 0.35, nt.v * 0.45);
}

export function clap(bus, nt) {
  const rand = rng(nt.seed);
  const len = Math.round(0.3 * SR);
  const x = new Float32Array(len);
  const bp = new Biquad('bp', 1150, 1.2);
  const hp = new Biquad('hp', 500, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let e = 0;
    for (const o of [0, 0.009, 0.018]) if (t >= o) e = Math.max(e, Math.exp(-(t - o) / 0.004));
    if (t >= 0.022) e = Math.max(e, 0.55 * Math.exp(-(t - 0.022) / 0.07));
    x[i] = hp.process(bp.process(rand() * 2 - 1)) * e;
  }
  addMono(bus, x, nt.s, nt.pan ?? 0, nt.v * 1.2);
}

export function zill(bus, nt) {
  const rand = rng(nt.seed);
  const len = Math.round(2 * SR);
  const x = new Float32Array(len);
  for (const [f, T] of [[3150, 1.3], [4870, 1.0], [6420, 0.8], [7890, 0.6], [9300, 0.45]]) {
    let ph = rand();
    const ff = f * (0.98 + rand() * 0.04);
    for (let i = 0; i < len; i++) {
      ph += ff / SR;
      x[i] += sin1(ph) * 0.2 * Math.exp(-i / ((T / 3) * SR));
    }
  }
  const fade = Math.round(0.2 * SR);
  for (let i = 0; i < fade; i++) x[len - 1 - i] *= i / fade;
  addMono(bus, x, nt.s, nt.pan ?? -0.4, nt.v * 0.3);
}

// ---------------------------------------------------------------------------
// Water: slow surf plus random bubbles, for nt.n samples.
export function water(bus, nt) {
  const rand = rng(nt.seed);
  const len = nt.n;
  const out = newStereo(len);
  for (const ch of ['L', 'R']) {
    const x = out[ch];
    const lp = new Biquad('lp', 520, 0.7);
    const lp2 = new OnePole(900);
    const sw = new Drift(0.18, rand);
    const sw2 = new Drift(0.6, rand);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      brown = brown * 0.995 + (rand() * 2 - 1) * 0.1;
      const e = 0.35 + 0.35 * sw.next() + 0.15 * sw2.next();
      x[i] = lp.process(lp2.process(brown)) * Math.max(0, e) * 2;
    }
  }
  // bubbles
  let t = rand() * 0.3 * SR;
  while (t < len) {
    const f0 = 350 + rand() * 1400;
    const bl = Math.round((0.03 + rand() * 0.05) * SR);
    const [gl, gr] = panGains(rand() * 1.6 - 0.8);
    const a = 0.08 + rand() * 0.12;
    let ph = 0;
    for (let i = 0; i < bl && t + i < len; i++) {
      const u = i / bl;
      ph += (f0 * (1 + 1.2 * u)) / SR;
      const s = sin1(ph) * a * Math.exp(-u * 5) * Math.min(1, i / 40);
      out.L[t + i] += s * gl;
      out.R[t + i] += s * gr;
    }
    t += Math.round((0.08 + rand() * rand() * 0.9) * SR);
  }
  const fade = Math.min(len >> 1, Math.round(2 * SR));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out.L[i] *= g;
    out.R[i] *= g;
    out.L[len - 1 - i] *= g;
    out.R[len - 1 - i] *= g;
  }
  mixStereo(bus, out, nt.s, nt.v);
}
