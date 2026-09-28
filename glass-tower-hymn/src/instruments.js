// Instrument voices. Each takes a bus {L, R} and a note
// {s: start sample, n: length in samples, f: Hz, m: midi, v: 0..1, pan, seed}
// and mixes its sound into the bus.

import {
  SR, TAU, sin1, blep, SVF, Biquad, OnePole, Drift, rng, clamp, panGains, addMono, db,
} from './dsp.js';

const C2R = Math.LN2 / 1200; // cents -> ratio exponent

function newStereo(len) {
  return { L: new Float32Array(len), R: new Float32Array(len) };
}

function mixStereo(bus, src, start, gain = 1) {
  const n = Math.min(src.L.length, bus.L.length - start);
  for (let i = Math.max(0, -start); i < n; i++) {
    bus.L[start + i] += src.L[i] * gain;
    bus.R[start + i] += src.R[i] * gain;
  }
}

// Sustained envelope with optional dynamic change (v -> v1) and release tail.
function susEnv(len, n, attack, release, v0, v1, curve = 1) {
  const env = new Float32Array(len);
  const aS = Math.max(1, attack * SR);
  const relTau = (release * SR) / 5;
  let last = 0;
  for (let i = 0; i < len; i++) {
    if (i < n) {
      const a = i < aS ? Math.pow(Math.sin((0.5 * Math.PI * i) / aS), curve) : 1;
      last = a * (v0 + (v1 - v0) * (i / n));
      env[i] = last;
    } else env[i] = last * Math.exp(-(i - n) / relTau);
  }
  return env;
}

// ---------------------------------------------------------------------------
// Bowed string ensemble (legato / pads / tremolo)
export function strings(bus, nt, o = {}) {
  const attack = o.attack ?? 0.22;
  const release = o.release ?? 0.5;
  const voices = o.voices ?? 6;
  const det = o.detune ?? 11;
  const spread = o.spread ?? 0.75;
  const trem = o.tremolo ?? 0;
  const rand = rng(nt.seed);
  const len = nt.n + Math.round(release * SR);
  const out = newStereo(len);
  const env = susEnv(len, nt.n, attack, release, nt.v, nt.v1 ?? nt.v);
  for (let k = 0; k < voices; k++) {
    const u = voices > 1 ? (2 * k) / (voices - 1) - 1 : 0;
    const cents = det * u + (rand() - 0.5) * 4;
    const f = nt.f * Math.exp(cents * C2R);
    const vibRate = 4.6 + rand() * 1.4;
    const vibDepth = (o.vib ?? 8) * (0.6 + rand() * 0.8);
    const vibPh = rand();
    const drift = new Drift(0.6 + rand(), rand);
    const [gl, gr] = panGains(spread * u + (nt.pan || 0));
    const tremPh = rand();
    const tremRate = 11 + rand() * 5;
    const delay = Math.round(rand() * 0.012 * SR);
    let ph = rand();
    for (let i = delay; i < len; i++) {
      const c = vibDepth * sin1(vibPh + (i * vibRate) / SR) + 5 * drift.next();
      const dt = (f * (1 + c * C2R)) / SR;
      ph += dt;
      if (ph >= 1) ph -= 1;
      let s = 2 * ph - 1 - blep(ph, dt);
      if (trem) s *= 1 - trem * 0.5 * (1 + sin1(tremPh + (i * tremRate) / SR));
      s *= env[i - delay];
      out.L[i] += s * gl;
      out.R[i] += s * gr;
    }
  }
  const bright = o.bright ?? 1;
  const fc = clamp((1400 + nt.f * 2.6) * bright * (0.55 + 0.7 * Math.max(nt.v, nt.v1 ?? 0)), 500, 11000);
  for (const ch of [out.L, out.R]) {
    const a = new SVF(fc, 0.55);
    const b = new SVF(fc * 1.3, 0.7);
    for (let i = 0; i < len; i++) ch[i] = b.process(a.process(ch[i]));
  }
  mixStereo(bus, out, nt.s, 1 / Math.sqrt(voices));
}

// Short bowed notes for ostinati.
export function spiccato(bus, nt, o = {}) {
  const voices = o.voices ?? 4;
  const rand = rng(nt.seed);
  const noteSec = nt.n / SR;
  const decay = o.decay ?? Math.min(0.11, 0.35 * noteSec + 0.03);
  const len = Math.round((noteSec + 0.25) * SR);
  const out = newStereo(len);
  const env = new Float32Array(len);
  const aS = 0.004 * SR;
  const hold = Math.min(nt.n * 0.3, 0.03 * SR);
  for (let i = 0; i < len; i++) {
    const a = i < aS ? i / aS : 1;
    const d = i < hold ? 1 : Math.exp(-(i - hold) / (decay * SR));
    env[i] = a * d * nt.v;
  }
  for (let k = 0; k < voices; k++) {
    const u = voices > 1 ? (2 * k) / (voices - 1) - 1 : 0;
    const f = nt.f * Math.exp((7 * u + (rand() - 0.5) * 3) * C2R);
    const [gl, gr] = panGains(0.6 * u + (nt.pan || 0));
    let ph = rand();
    const dt = f / SR;
    const delay = Math.round(rand() * 0.006 * SR);
    for (let i = delay; i < len; i++) {
      ph += dt;
      if (ph >= 1) ph -= 1;
      const s = (2 * ph - 1 - blep(ph, dt)) * env[i - delay];
      out.L[i] += s * gl;
      out.R[i] += s * gr;
    }
  }
  // bow scratch
  const nb = new Biquad('bp', 2800, 1.2);
  const nlen = Math.round(0.02 * SR);
  for (let i = 0; i < nlen; i++) {
    const s = nb.process(rand() * 2 - 1) * (1 - i / nlen) * 0.35 * nt.v;
    out.L[i] += s;
    out.R[i] += s;
  }
  const bright = o.bright ?? 1;
  for (const ch of [out.L, out.R]) {
    const f = new SVF(1000, 0.7);
    for (let i = 0; i < len; i++) {
      if ((i & 31) === 0) f.set((900 + nt.f * 2 + 5000 * env[i] * bright) * (0.6 + 0.5 * nt.v), 0.7);
      ch[i] = f.process(ch[i]);
    }
  }
  mixStereo(bus, out, nt.s, 1 / Math.sqrt(voices));
}

// ---------------------------------------------------------------------------
// Formant choir. Formant data from the Csound manual (F Hz, amp dB, BW Hz).
const FORMANTS = {
  soprano: {
    a: [[800, 1150, 2900, 3900, 4950], [0, -6, -32, -20, -50], [80, 90, 120, 130, 140]],
    o: [[450, 800, 2830, 3800, 4950], [0, -11, -22, -22, -50], [70, 80, 100, 130, 135]],
    u: [[325, 700, 2700, 3800, 4950], [0, -16, -35, -40, -60], [50, 60, 170, 180, 200]],
    e: [[350, 2000, 2800, 3600, 4950], [0, -20, -15, -40, -56], [60, 100, 120, 150, 200]],
  },
  alto: {
    a: [[800, 1150, 2800, 3500, 4950], [0, -4, -20, -36, -60], [80, 90, 120, 130, 140]],
    o: [[450, 800, 2830, 3500, 4950], [0, -9, -16, -28, -55], [70, 80, 100, 130, 135]],
    u: [[325, 700, 2530, 3500, 4950], [0, -12, -30, -40, -64], [50, 60, 170, 180, 200]],
    e: [[400, 1600, 2700, 3300, 4950], [0, -24, -30, -35, -60], [60, 80, 120, 150, 200]],
  },
  tenor: {
    a: [[650, 1080, 2650, 2900, 3250], [0, -6, -7, -8, -22], [80, 90, 120, 130, 140]],
    o: [[400, 800, 2600, 2800, 3000], [0, -10, -12, -12, -26], [40, 80, 100, 120, 120]],
    u: [[350, 600, 2700, 2900, 3300], [0, -20, -17, -14, -26], [40, 60, 100, 120, 120]],
    e: [[400, 1700, 2600, 3200, 3580], [0, -14, -12, -14, -20], [70, 80, 100, 120, 120]],
  },
  bass: {
    a: [[600, 1040, 2250, 2450, 2750], [0, -7, -9, -9, -20], [60, 70, 110, 120, 130]],
    o: [[400, 750, 2400, 2600, 2900], [0, -11, -21, -20, -40], [40, 80, 100, 120, 120]],
    u: [[350, 600, 2400, 2675, 2950], [0, -20, -32, -28, -36], [40, 80, 100, 120, 120]],
    e: [[400, 1620, 2400, 2800, 3100], [0, -12, -9, -12, -18], [40, 80, 100, 120, 120]],
  },
};

function vowelParams(voice, v) {
  if (typeof v === 'string') return FORMANTS[voice][v];
  // blend {a: w, o: w, ...}
  const out = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  let tot = 0;
  for (const [k, w] of Object.entries(v)) {
    const p = FORMANTS[voice][k];
    for (let j = 0; j < 5; j++) {
      out[0][j] += p[0][j] * w;
      out[1][j] += p[1][j] * w;
      out[2][j] += p[2][j] * w;
    }
    tot += w;
  }
  for (let r = 0; r < 3; r++) for (let j = 0; j < 5; j++) out[r][j] /= tot;
  return out;
}

// Apply a (possibly time-varying) vowel filter bank to a mono buffer.
// vowelAt(i) returns a vowel name or blend for local sample index i.
function formantFilter(src, voice, vowelAt, shift = 1) {
  const n = src.length;
  const out = new Float32Array(n);
  const bq = [0, 1, 2, 3, 4].map(() => new Biquad('bp', 1000, 5));
  const gains = new Float32Array(5);
  let key = null;
  for (let i0 = 0; i0 < n; i0 += 64) {
    const v = vowelAt(i0);
    const k = JSON.stringify(v);
    if (k !== key) {
      key = k;
      const p = vowelParams(voice, v);
      for (let j = 0; j < 5; j++) {
        const f = p[0][j] * shift;
        bq[j].set('bp', f, f / p[2][j]);
        gains[j] = db(p[1][j]);
      }
    }
    const end = Math.min(n, i0 + 64);
    for (let i = i0; i < end; i++) {
      const x = src[i];
      let y = 0;
      for (let j = 0; j < 5; j++) y += bq[j].process(x) * gains[j];
      out[i] = y;
    }
  }
  return out;
}

// Render all notes of one choir section, then filter once (the filter is linear).
// notes: [{s, n, f, v}], o: {voice, vowel (name or fn(absSample)), voices, spread, attack, release}
export function choirSection(bus, notes, o = {}) {
  if (!notes.length) return;
  const voice = o.voice ?? 'soprano';
  const voices = o.voices ?? 4;
  const attack = o.attack ?? 0.3;
  const release = o.release ?? 0.6;
  const spread = o.spread ?? 0.8;
  const rand = rng(o.seed ?? 11);
  let s0 = Infinity;
  let s1 = 0;
  for (const nt of notes) {
    s0 = Math.min(s0, nt.s);
    s1 = Math.max(s1, nt.s + nt.n);
  }
  s0 = Math.max(0, s0 - Math.round(0.05 * SR));
  const len = s1 - s0 + Math.round(release * SR) + 100;
  const srcL = new Float32Array(len);
  const srcR = new Float32Array(len);
  for (const nt of notes) {
    const nlen = nt.n + Math.round(release * SR);
    const env = susEnv(nlen, nt.n, attack, release, nt.v, nt.v1 ?? nt.v, 1.5);
    for (let k = 0; k < voices; k++) {
      const u = voices > 1 ? (2 * k) / (voices - 1) - 1 : 0;
      const cents = 9 * u + (rand() - 0.5) * 6;
      const f = nt.f * Math.exp(cents * C2R);
      const vibRate = 5 + rand() * 1.1;
      const vibDepth = (o.vib ?? 22) * (0.7 + rand() * 0.6);
      const vibPh = rand();
      const jit = new Drift(7, rand);
      const wander = new Drift(0.5, rand);
      const shimmer = new Drift(3, rand);
      const [gl, gr] = panGains(spread * u * (k % 2 ? 1 : -1) * 0.9 + (o.pan || 0));
      const off = nt.s - s0 + Math.round(rand() * 0.035 * SR);
      const vibOn = 0.25 * SR;
      let ph = rand();
      for (let i = 0; i < nlen && off + i < len; i++) {
        const vr = i < vibOn ? 0.25 : Math.min(1, 0.25 + (i - vibOn) / (0.4 * SR));
        const c = vibDepth * vr * sin1(vibPh + (i * vibRate) / SR) + 5 * jit.next() + 7 * wander.next();
        const dt = (f * (1 + c * C2R)) / SR;
        ph += dt;
        if (ph >= 1) ph -= 1;
        const e = env[i] * (1 + 0.08 * shimmer.next());
        const s = (2 * ph - 1 - blep(ph, dt)) * e + (rand() * 2 - 1) * e * 0.12;
        srcL[off + i] += s * gl;
        srcR[off + i] += s * gr;
      }
    }
  }
  const vowelAt = typeof o.vowel === 'function' ? (i) => o.vowel(i + s0) : () => o.vowel ?? 'a';
  const L = formantFilter(srcL, voice, vowelAt);
  const R = formantFilter(srcR, voice, vowelAt);
  mixStereo(bus, { L, R }, s0, 1.6 / Math.sqrt(voices));
}

// ---------------------------------------------------------------------------
// Monophonic expressive lead: builds pitch/amp control curves for phrases.
// notes: [{s, n, f, v, grace: [Hz], trill: Hz|null, stacc}]
export function leadPhrases(notes, o = {}) {
  const gapJoin = (o.gapJoin ?? 0.06) * SR;
  const phrases = [];
  let cur = [];
  for (const nt of notes) {
    const prev = cur[cur.length - 1];
    if (prev && nt.s - (prev.s + prev.n) > gapJoin) {
      phrases.push(cur);
      cur = [];
    }
    cur.push(nt);
  }
  if (cur.length) phrases.push(cur);
  return phrases.map((ph) => leadControl(ph, o));
}

function leadControl(ph, o) {
  const rand = rng(o.seed ?? ph[0].s);
  const attack = (o.attack ?? 0.06) * SR;
  const release = (o.release ?? 0.18) * SR;
  const glide = o.glide ?? 0.035;
  const vibDelay = (o.vibDelay ?? 0.2) * SR;
  const vibRamp = (o.vibRamp ?? 0.35) * SR;
  const vibDepth = o.vibDepth ?? 24; // cents
  const vibRate = o.vibRate ?? 5.6;
  const scoop = o.scoop ?? 0; // cents below at articulated onsets
  const pre = Math.round(0.03 * SR);
  const s0 = Math.max(0, ph[0].s - pre);
  const last = ph[ph.length - 1];
  const end = last.s + last.n;
  const len = end - s0 + Math.round(release * 1.5) + 10;
  const tgt = new Float32Array(len); // log2 frequency target
  const amp = new Float32Array(len);
  const art = new Float32Array(len);
  const vib = new Float32Array(len); // vibrato depth envelope (0..1)
  // targets
  for (let k = 0; k < ph.length; k++) {
    const nt = ph[k];
    const a = nt.s - s0;
    const b = k + 1 < ph.length ? ph[k + 1].s - s0 : len;
    let i = a;
    if (nt.grace) {
      const gd = Math.round(Math.min(0.05 * SR, nt.n * 0.18));
      for (const g of nt.grace) {
        const lg = Math.log2(g);
        for (let j = 0; j < gd && i < b; j++) tgt[i++] = lg;
      }
    }
    const lf = Math.log2(nt.f);
    const lt = nt.trill ? Math.log2(nt.trill) : lf;
    const trillStep = Math.round(SR / 15);
    for (; i < b; i++) {
      if (nt.trill && i - a < nt.n * 0.8) tgt[i] = Math.floor((i - a) / trillStep) % 2 ? lt : lf;
      else tgt[i] = lf;
    }
    const noteLen = nt.n;
    if (noteLen > 0.3 * SR && !nt.trill) {
      for (let j = a; j < b && j < len; j++) {
        const x = j - a;
        vib[j] = x < vibDelay ? 0 : Math.min(1, (x - vibDelay) / vibRamp);
      }
    } else {
      for (let j = a; j < b && j < len; j++) vib[j] = 0.15;
    }
  }
  for (let i = 0; i < ph[0].s - s0; i++) tgt[i] = tgt[ph[0].s - s0];
  // amplitude
  for (let k = 0; k < ph.length; k++) {
    const nt = ph[k];
    const a = nt.s - s0;
    const nextS = k + 1 < ph.length ? ph[k + 1].s - s0 : end - s0;
    const prev = ph[k - 1];
    const articulated = k === 0 || !prev || prev.m === nt.m || nt.stacc || (prev.s + prev.n < nt.s - 0.01 * SR);
    const swellLen = nextS - a;
    for (let i = a; i < nextS && i < len; i++) {
      const x = (i - a) / Math.max(1, swellLen);
      let e = nt.v * (1 + (swellLen > 0.5 * SR ? 0.12 * Math.sin(Math.PI * x) : 0));
      if (nt.stacc && i - a > nt.n * 0.5) e *= Math.exp(-(i - a - nt.n * 0.5) / (0.03 * SR));
      amp[i] = e;
    }
    if (articulated) {
      for (let j = 0; j < 0.025 * SR && a + j < len; j++) art[a + j] = Math.max(art[a + j], Math.exp(-j / (0.008 * SR)));
      if (scoop && k > 0) for (let j = 0; j < 0.06 * SR && a + j < len; j++) tgt[a + j] -= (scoop / 1200) * (1 - j / (0.06 * SR));
    }
    // dip at note changes
    const dip = k === 0 ? 0 : articulated ? 0.45 : 0.85;
    if (k > 0) {
      const w = Math.round(0.03 * SR);
      for (let j = -w; j < w; j++) {
        const i = a + j;
        if (i >= 0 && i < len) amp[i] *= 1 - (1 - dip) * (1 - Math.abs(j) / w);
      }
    }
  }
  // attack & release
  const a0 = ph[0].s - s0;
  for (let i = 0; i < len; i++) {
    if (i < a0) amp[i] = 0;
    else if (i < a0 + attack) amp[i] *= Math.sin((0.5 * Math.PI * (i - a0)) / attack);
  }
  const e0 = end - s0;
  const endAmp = amp[Math.max(0, e0 - 1)];
  for (let i = e0; i < len; i++) amp[i] = endAmp * Math.exp(-(i - e0) / (release / 4));
  // smooth amplitude (bow/breath inertia)
  const as = new OnePole(40);
  as.y = 0;
  for (let i = 0; i < len; i++) amp[i] = as.process(amp[i]);
  // pitch: glide (2x one-pole in log domain) + vibrato + jitter
  const f0 = new Float32Array(len);
  const gA = new OnePole(1 / (TAU * glide));
  const gB = new OnePole(1 / (TAU * glide));
  gA.y = gB.y = tgt[0];
  const jit = new Drift(8, rand);
  const wan = new Drift(0.7, rand);
  const vr = new Drift(0.4, rand);
  let vph = rand();
  const vs = new OnePole(3);
  for (let i = 0; i < len; i++) {
    const lg = gB.process(gA.process(tgt[i]));
    vph += (vibRate + 0.4 * vr.next()) / SR;
    const vd = vs.process(vib[i]);
    const cents = vibDepth * vd * sin1(vph) + 3 * jit.next() + 4 * wan.next();
    f0[i] = Math.pow(2, lg + cents / 1200);
  }
  return { s: s0, len, f0, amp, art };
}

export function violin(bus, phrases, o = {}) {
  const rand = rng(o.seed ?? 3);
  for (const p of phrases) {
    const { len, f0, amp, art } = p;
    const x = new Float32Array(len);
    let ph = rand();
    let ph2 = rand();
    const lp = new SVF(4000, 0.6);
    const nf = new Biquad('bp', 3500, 0.9);
    const ens = o.ensemble ?? 0;
    for (let i = 0; i < len; i++) {
      const dt = f0[i] / SR;
      ph += dt;
      if (ph >= 1) ph -= 1;
      let s = 2 * ph - 1 - blep(ph, dt);
      if (ens) {
        const dt2 = dt * 1.0045;
        ph2 += dt2;
        if (ph2 >= 1) ph2 -= 1;
        s += ens * (2 * ph2 - 1 - blep(ph2, dt2));
      }
      const a = amp[i];
      s = s * a + nf.process(rand() * 2 - 1) * (0.03 * a + 0.12 * art[i] * a);
      if ((i & 31) === 0) lp.set(1800 + 5200 * Math.min(1, a) * (o.bright ?? 1) + f0[i] * 1.5, 0.6);
      x[i] = lp.process(s);
    }
    const body = [
      ['hp', 190, 0.7],
      ['peak', 280, 2.5, 5],
      ['peak', 480, 3, 3.5],
      ['peak', 900, 1.5, -3],
      ['peak', 2600, 1.1, 6],
      ['peak', 4200, 2, 2],
      ['lp', 7500, 0.7],
    ];
    for (const b of body) new Biquad(...b).run(x);
    addMono(bus, x, p.s, o.pan ?? 0, o.gain ?? 0.5);
  }
}

export function whistle(bus, phrases, o = {}) {
  const rand = rng(o.seed ?? 5);
  for (const p of phrases) {
    const { len, f0, amp, art } = p;
    const x = new Float32Array(len);
    let ph = 0;
    const bp = new SVF(1000, 7);
    const air = new Biquad('hp', 3500, 0.7);
    const chiff = new SVF(2000, 2);
    for (let i = 0; i < len; i++) {
      const f = f0[i];
      ph += f / SR;
      if (ph >= 1) ph -= 1;
      const tone = sin1(ph) + 0.13 * sin1(2 * ph + 0.1) + 0.05 * sin1(3 * ph + 0.3);
      if ((i & 15) === 0) {
        bp.set(f, 6);
        chiff.set(f * 2.5, 1.5);
      }
      const n = rand() * 2 - 1;
      bp.process(n);
      chiff.process(n);
      const a = amp[i];
      x[i] = a * (tone * 0.9 + bp.band * bp.k * 0.22 + air.process(n) * 0.012) + chiff.band * chiff.k * art[i] * 0.5 * a;
    }
    new Biquad('hp', 250, 0.7).run(x);
    addMono(bus, x, p.s, o.pan ?? 0, o.gain ?? 0.5);
  }
}

// Wordless sung lead ("aah"), formant filtered.
export function voxLead(bus, phrases, o = {}) {
  const rand = rng(o.seed ?? 9);
  for (const p of phrases) {
    const { len, f0, amp } = p;
    const src = new Float32Array(len);
    let ph = rand();
    for (let i = 0; i < len; i++) {
      const dt = f0[i] / SR;
      ph += dt;
      if (ph >= 1) ph -= 1;
      src[i] = ((2 * ph - 1 - blep(ph, dt)) + (rand() * 2 - 1) * 0.1) * amp[i];
    }
    const y = formantFilter(src, o.voice ?? 'soprano', () => o.vowel ?? 'a');
    new Biquad('hp', 220, 0.7).run(y);
    addMono(bus, y, p.s, o.pan ?? 0, o.gain ?? 0.5);
  }
}

// ---------------------------------------------------------------------------
// Karplus-Strong plucked / hammered strings.
function ksRender(len, f, o, rand, exc) {
  const out = new Float32Array(len);
  const N = SR / f;
  const b = o.b ?? 0.5;
  const D = N - (1 - b);
  const M = Math.ceil(N) + 4;
  const g = Math.pow(0.001, 1 / (f * (o.t60 ?? 3)));
  const gd = Math.pow(0.001, 1 / (f * (o.dampT60 ?? 0.15)));
  const damp = o.damp ?? Infinity;
  const buf = new Float32Array(M);
  let w = 0;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    let rp = w - D;
    if (rp < 0) rp += M;
    const i0 = rp | 0;
    const fr = rp - i0;
    const a = buf[i0];
    const c = buf[i0 + 1 < M ? i0 + 1 : 0];
    const x = a + (c - a) * fr;
    const y = (i < damp ? g : gd) * (b * x + (1 - b) * prev);
    prev = x;
    const e = i < exc.length ? exc[i] : 0;
    buf[w] = y + e;
    if (++w >= M) w = 0;
    out[i] = y + e;
  }
  return out;
}

function excitation(f, o, rand) {
  const N = Math.max(2, Math.round(SR / f));
  const type = o.excite ?? 'noise';
  const e = new Float32Array(N);
  if (type === 'hammer') {
    const w = Math.max(2, Math.round((o.hammerMs ?? 0.8) * 0.001 * SR));
    for (let i = 0; i < Math.min(w, N); i++) e[i] = 0.5 - 0.5 * Math.cos((TAU * i) / w);
    for (let i = 0; i < N; i++) e[i] += (rand() * 2 - 1) * 0.15;
  } else {
    const lp = new OnePole(o.exciteFc ?? 8000);
    for (let i = 0; i < N; i++) e[i] = lp.process(rand() * 2 - 1);
    if (type === 'soft') {
      const lp2 = new OnePole(o.exciteFc ?? 2500);
      for (let i = 0; i < N; i++) e[i] = lp2.process(e[i]);
    }
  }
  // pluck position comb
  const P = Math.max(1, Math.round((o.pos ?? 0.13) * N));
  const c = new Float32Array(N);
  for (let i = 0; i < N; i++) c[i] = e[i] - (i >= P ? e[i - P] : 0);
  let mean = 0;
  for (let i = 0; i < N; i++) mean += c[i];
  mean /= N;
  let peak = 1e-9;
  for (let i = 0; i < N; i++) {
    c[i] -= mean;
    peak = Math.max(peak, Math.abs(c[i]));
  }
  for (let i = 0; i < N; i++) c[i] /= peak;
  return c;
}

export function pluck(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const ring = o.ring ?? 3;
  const damped = o.dampOnRelease ?? false;
  const len = Math.round((damped ? nt.n / SR + (o.dampT60 ?? 0.15) : ring) * SR);
  const exc = excitation(nt.f, o, rand);
  const detunes = o.strings ?? [0];
  const x = new Float32Array(len);
  const oo = { ...o, damp: damped ? nt.n : Infinity };
  for (const c of detunes) {
    const y = ksRender(len, nt.f * Math.exp(c * C2R), oo, rand, exc);
    for (let i = 0; i < len; i++) x[i] += y[i];
  }
  // gentle fade at the end of the buffer
  const fade = Math.min(len, Math.round(0.05 * SR));
  for (let i = 0; i < fade; i++) x[len - 1 - i] *= i / fade;
  addMono(bus, x, nt.s, nt.pan ?? o.pan ?? 0, (nt.v / detunes.length) * (o.gain ?? 0.5));
}

// ---------------------------------------------------------------------------
// Additive piano with inharmonic, individually decaying partials.
export function piano(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const f0 = nt.f;
  const m = nt.m;
  const B = 0.00008 * Math.pow(2, (m - 48) / 16);
  const nPart = Math.min(28, Math.floor(10000 / f0));
  const pedal = o.pedal ?? false;
  const ringSec = pedal ? Math.min(6, 9 * Math.pow(2, -(m - 40) / 20)) : nt.n / SR + 0.35;
  const len = Math.round(ringSec * SR);
  const x = new Float32Array(len);
  const baseT = 7 * Math.pow(2, -(m - 40) / 17);
  const hard = 0.35 + 0.65 * nt.v;
  const offS = pedal ? Infinity : nt.n;
  const offK = Math.exp(-1 / (0.09 * SR));
  for (let k = 1; k <= nPart; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    if (fk > 16000) break;
    let a = Math.abs(Math.sin((Math.PI * k) / 7.3)) / Math.pow(k, 1.05 - 0.35 * hard);
    a *= Math.exp(-k * (0.13 - 0.09 * hard));
    const Ts = baseT / (1 + 0.1 * Math.pow(k, 1.4));
    const Tf = Ts / 7;
    const df = Math.exp(-1 / (Tf * SR));
    const ds = Math.exp(-1 / (Ts * SR));
    for (let st = 0; st < 2; st++) {
      const det = st === 0 ? 1 : Math.exp((0.6 + rand() * 0.9) * C2R);
      const inc = (fk * det) / SR;
      let ph = rand();
      let ef = 0.55 * a * 0.5;
      let es = 0.45 * a * 0.5;
      let off = 1;
      for (let i = 0; i < len; i++) {
        ph += inc;
        if (ph >= 1) ph -= 1;
        if (i >= offS) off *= offK;
        x[i] += sin1(ph) * (ef + es) * off;
        ef *= df;
        es *= ds;
      }
    }
  }
  // hammer knock
  const hl = new OnePole(1200 + 2500 * nt.v);
  const hn = Math.round(0.018 * SR);
  for (let i = 0; i < hn && i < len; i++) x[i] += hl.process(rand() * 2 - 1) * 0.25 * (1 - i / hn) * nt.v;
  const aS = Math.round(0.002 * SR);
  for (let i = 0; i < aS; i++) x[i] *= i / aS;
  const fade = Math.min(len, Math.round(0.03 * SR));
  for (let i = 0; i < fade; i++) x[len - 1 - i] *= i / fade;
  const pan = nt.pan ?? clamp((m - 60) / 40, -0.5, 0.5);
  addMono(bus, x, nt.s, pan, nt.v * (o.gain ?? 0.45));
}

// Music box: cantilevered tine partials + tiny click.
export function musicBox(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const f0 = nt.f;
  const T = (o.decay ?? 1.3) * Math.pow(2, -(nt.m - 84) / 24);
  const len = Math.round(Math.min(8, T * 5) * SR);
  const x = new Float32Array(len);
  const parts = [
    [1, 1, T],
    [1.0015, 0.35, T * 0.9],
    [2, 0.06, T * 0.4],
    [5.4, 0.08, T * 0.12],
    [6.27, 0.14, T * 0.1],
    [17.55, 0.05, 0.03],
  ];
  for (const [r, a, t] of parts) {
    const fk = f0 * r;
    if (fk > 18000) continue;
    const d = Math.exp(-1 / (t * SR));
    let e = a;
    let ph = rand();
    const inc = fk / SR;
    for (let i = 0; i < len; i++) {
      ph += inc;
      if (ph >= 1) ph -= 1;
      x[i] += sin1(ph) * e;
      e *= d;
    }
  }
  const cl = Math.round(0.002 * SR);
  for (let i = 0; i < cl; i++) x[i] += (rand() * 2 - 1) * 0.15 * (1 - i / cl);
  const aS = Math.round(0.001 * SR);
  for (let i = 0; i < aS; i++) x[i] *= i / aS;
  tailFade(x, 0.3);
  addMono(bus, x, nt.s, nt.pan ?? o.pan ?? 0, nt.v * (o.gain ?? 0.3));
}

export function glock(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const f0 = nt.f;
  const T = (o.decay ?? 0.9) * Math.pow(2, -(nt.m - 84) / 30);
  const len = Math.round(T * 5 * SR);
  const x = new Float32Array(len);
  const parts = [
    [1, 1, T],
    [2.756, 0.4, T * 0.35],
    [5.404, 0.22, T * 0.15],
    [8.933, 0.1, T * 0.06],
  ];
  for (const [r, a, t] of parts) {
    const fk = f0 * r;
    if (fk > 18000) continue;
    const d = Math.exp(-1 / (t * SR));
    let e = a;
    let ph = rand();
    const inc = fk / SR;
    for (let i = 0; i < len; i++) {
      ph += inc;
      if (ph >= 1) ph -= 1;
      x[i] += sin1(ph) * e;
      e *= d;
    }
  }
  const aS = Math.round(0.0008 * SR);
  for (let i = 0; i < aS; i++) x[i] *= i / aS;
  tailFade(x, 0.3);
  addMono(bus, x, nt.s, nt.pan ?? o.pan ?? 0, nt.v * (o.gain ?? 0.3));
}

// ---------------------------------------------------------------------------
// Synth bass: saw + sub sine through an enveloped low-pass.
export function bass(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const rel = 0.06;
  const len = nt.n + Math.round(rel * SR);
  const x = new Float32Array(len);
  let ph = rand();
  let ph2 = 0;
  const f = new SVF(500, 0.9);
  const dt = nt.f / SR;
  const aS = 0.004 * SR;
  const relTau = (rel * SR) / 4;
  for (let i = 0; i < len; i++) {
    ph += dt;
    if (ph >= 1) ph -= 1;
    ph2 += dt;
    if (ph2 >= 1) ph2 -= 1;
    const env = (i < aS ? i / aS : 1) * (i < nt.n ? 1 - 0.25 * Math.min(1, i / (0.4 * SR)) : 0.75 * Math.exp(-(i - nt.n) / relTau));
    const fenv = Math.exp(-i / (0.07 * SR));
    if ((i & 15) === 0) f.set(nt.f * 2 + (o.cut ?? 700) * (0.3 + fenv) * nt.v, 0.9);
    const s = (2 * ph - 1 - blep(ph, dt)) * 0.7;
    x[i] = (f.process(s) + sin1(ph2) * 0.6) * env;
  }
  addMono(bus, x, nt.s, 0, nt.v * (o.gain ?? 0.5));
}

// Brass section (horns / trombones): swelling low-pass saws.
export function brass(bus, nt, o = {}) {
  const rand = rng(nt.seed);
  const attack = o.attack ?? 0.09;
  const release = o.release ?? 0.3;
  const len = nt.n + Math.round(release * SR);
  const env = susEnv(len, nt.n, attack, release, nt.v, nt.v1 ?? nt.v);
  const out = newStereo(len);
  const voices = 3;
  for (let k = 0; k < voices; k++) {
    const u = k - 1;
    const f = nt.f * Math.exp((5 * u + (rand() - 0.5) * 2) * C2R);
    const [gl, gr] = panGains(0.4 * u);
    const flt = new SVF(800, 0.8);
    const vd = new Drift(4, rand);
    let ph = rand();
    for (let i = 0; i < len; i++) {
      const c = 4 * vd.next() + (i > 0.4 * SR ? 10 * sin1((i * 5.2) / SR) * Math.min(1, (i - 0.4 * SR) / (0.5 * SR)) : 0);
      const dt = (f * (1 + c * C2R)) / SR;
      ph += dt;
      if (ph >= 1) ph -= 1;
      const e = env[i];
      if ((i & 15) === 0) {
        const bite = Math.exp(-i / (0.12 * SR));
        flt.set(nt.f * (1.2 + 3.5 * e * (o.bright ?? 1)) + 1500 * bite * nt.v, 0.8);
      }
      const s = flt.process(2 * ph - 1 - blep(ph, dt)) * e;
      out.L[i] += s * gl;
      out.R[i] += s * gr;
    }
  }
  mixStereo(bus, out, nt.s, (o.gain ?? 0.5) / Math.sqrt(voices));
}

// ---------------------------------------------------------------------------
// Drums & percussion. Each renders one hit at nt.s with velocity nt.v.
function hitBuf(sec) {
  return new Float32Array(Math.round(sec * SR));
}

// Fade out the last `sec` seconds so truncated ringing never clicks.
function tailFade(x, sec = 0.08) {
  const n = Math.min(x.length, Math.round(sec * SR));
  for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n;
  return x;
}

export function kick(bus, nt) {
  const x = hitBuf(0.6);
  const rand = rng(nt.seed);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = 44 + 120 * Math.exp(-t / 0.03) + 30 * Math.exp(-t / 0.2);
    ph += f / SR;
    const e = Math.exp(-t / 0.28) * (t < 0.002 ? t / 0.002 : 1);
    x[i] = Math.tanh(1.6 * sin1(ph) * e);
  }
  const cl = new Biquad('hp', 2500, 0.7);
  for (let i = 0; i < 0.006 * SR; i++) x[i] += cl.process(rand() * 2 - 1) * 0.35 * (1 - i / (0.006 * SR));
  tailFade(x, 0.1);
  addMono(bus, x, nt.s, 0, nt.v);
}

export function snare(bus, nt, o = {}) {
  const len = o.long ? 0.7 : 0.4;
  const x = hitBuf(len);
  const rand = rng(nt.seed);
  const hp = new Biquad('hp', 1200, 0.7);
  const lp = new Biquad('lp', 9000, 0.7);
  const pk = new Biquad('peak', 4500, 1, 4);
  let p1 = 0;
  let p2 = 0;
  const tau = o.long ? 0.28 : 0.17;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    p1 += (185 * (1 + 0.3 * Math.exp(-t / 0.01))) / SR;
    p2 += (330 * (1 + 0.2 * Math.exp(-t / 0.01))) / SR;
    const tone = (sin1(p1) * 0.8 + sin1(p2) * 0.45) * Math.exp(-t / 0.07);
    const n = pk.process(lp.process(hp.process(rand() * 2 - 1))) * Math.exp(-t / tau);
    x[i] = (tone * 0.7 + n * 0.9) * (t < 0.001 ? t / 0.001 : 1);
  }
  tailFade(x, 0.1);
  addMono(bus, x, nt.s, nt.pan ?? 0, nt.v * 0.8);
}

// Metallic oscillator bank (808-ish) shared by hats and cymbals.
function metal(len, scale, rand) {
  const fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * scale * (1 + (rand() - 0.5) * 0.02));
  const ph = fr.map(() => rand());
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let k = 0; k < 6; k++) {
      ph[k] += fr[k] / SR;
      if (ph[k] >= 1) ph[k] -= 1;
      s += ph[k] < 0.5 ? 1 : -1;
    }
    x[i] = s / 6;
  }
  return x;
}

export function hat(bus, nt, o = {}) {
  const open = o.open ?? false;
  const x = hitBuf(open ? 0.5 : 0.12);
  const rand = rng(nt.seed);
  const m = metal(x.length, 1.6, rand);
  const hp = new Biquad('hp', 7000, 0.7);
  const bp = new Biquad('peak', 10500, 1, 5);
  const tau = open ? 0.16 : 0.028;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = bp.process(hp.process(m[i] * 0.6 + (rand() * 2 - 1) * 0.7)) * Math.exp(-t / tau);
  }
  tailFade(x, 0.03);
  addMono(bus, x, nt.s, nt.pan ?? 0.3, nt.v * 0.5);
}

export function cymbal(bus, nt, o = {}) {
  const dur = o.dur ?? 3.2;
  const len = Math.round(dur * SR);
  const rand = rng(nt.seed);
  const out = newStereo(len);
  for (const ch of ['L', 'R']) {
    const m = metal(len, 2.3 + rand() * 0.3, rand);
    const hp = new Biquad('hp', 4200, 0.7);
    const pk = new Biquad('peak', 7500, 0.8, 4);
    const lp = new OnePole(15000);
    const x = out[ch];
    const tau = (o.tau ?? 0.9) * (0.9 + rand() * 0.2);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const e = (Math.exp(-t / tau) * 0.8 + Math.exp(-t / 0.05) * 0.6) * (t < 0.003 ? t / 0.003 : 1);
      x[i] = lp.process(pk.process(hp.process(m[i] * 0.5 + (rand() * 2 - 1)))) * e;
    }
    const fade = Math.round(0.2 * SR);
    for (let i = 0; i < fade; i++) x[len - 1 - i] *= i / fade;
  }
  if (o.reverse) {
    out.L.reverse();
    out.R.reverse();
    // a reversed cymbal ends at nt.s
    mixStereo(bus, out, nt.s - len, nt.v * 0.5);
  } else mixStereo(bus, out, nt.s, nt.v * 0.5);
}

export function tom(bus, nt, o = {}) {
  const f0 = o.f ?? nt.f ?? 120;
  const x = hitBuf(0.7);
  const rand = rng(nt.seed);
  const lp = new OnePole(3000);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += (f0 * (1 + 0.5 * Math.exp(-t / 0.04))) / SR;
    const e = Math.exp(-t / (0.25 * Math.sqrt(120 / f0)));
    x[i] = (sin1(ph) * 0.9 + lp.process(rand() * 2 - 1) * 0.3 * Math.exp(-t / 0.02)) * e;
  }
  tailFade(x, 0.15);
  addMono(bus, x, nt.s, nt.pan ?? 0, nt.v * 0.8);
}

export function taiko(bus, nt, o = {}) {
  const f0 = o.f ?? 62;
  const x = hitBuf(2.4);
  const rand = rng(nt.seed);
  const lp = new Biquad('lp', 900, 0.7);
  let ph = 0;
  let ph2 = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += (f0 * (1 + 0.7 * Math.exp(-t / 0.05))) / SR;
    ph2 += (f0 * 2.3 * (1 + 0.4 * Math.exp(-t / 0.03))) / SR;
    const e = Math.exp(-t / 0.45) * (t < 0.003 ? t / 0.003 : 1);
    const skin = lp.process(rand() * 2 - 1) * Math.exp(-t / 0.06);
    x[i] = Math.tanh(1.3 * (sin1(ph) + 0.25 * sin1(ph2) * Math.exp(-t / 0.15) + skin * 0.9) * e);
  }
  tailFade(x, 0.4);
  addMono(bus, x, nt.s, nt.pan ?? -0.1, nt.v * 0.9);
}

// Timpani: tuned membrane modes. nt.f is the principal pitch.
export function timpani(bus, nt) {
  const rand = rng(nt.seed);
  const len = Math.round(4.5 * SR);
  const x = new Float32Array(len);
  const modes = [
    [1, 1, 2.2],
    [1.5, 0.5, 1.3],
    [1.98, 0.32, 1.0],
    [2.44, 0.2, 0.7],
    [2.97, 0.12, 0.5],
    [0.62, 0.35, 0.25],
  ];
  for (const [r, a, T] of modes) {
    let ph = rand();
    const d = Math.exp(-1 / (T * 0.45 * SR));
    let e = a;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      ph += (nt.f * r * (1 + 0.015 * Math.exp(-t / 0.08))) / SR;
      x[i] += sin1(ph) * e;
      e *= d;
    }
  }
  const lp = new OnePole(1800);
  for (let i = 0; i < 0.03 * SR; i++) x[i] += lp.process(rand() * 2 - 1) * 0.8 * (1 - i / (0.03 * SR));
  const aS = Math.round(0.002 * SR);
  for (let i = 0; i < aS; i++) x[i] *= i / aS;
  tailFade(x, 0.6);
  addMono(bus, x, nt.s, nt.pan ?? 0.2, nt.v * 0.55);
}

export function darbuka(bus, nt, o = {}) {
  const type = o.type ?? 'doum';
  const rand = rng(nt.seed);
  const x = hitBuf(type === 'doum' ? 0.5 : 0.15);
  if (type === 'doum') {
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      ph += (95 * (1 + 0.25 * Math.exp(-t / 0.03))) / SR;
      x[i] = sin1(ph) * Math.exp(-t / 0.18) + (rand() * 2 - 1) * 0.1 * Math.exp(-t / 0.01);
    }
  } else {
    const bp = new Biquad('bp', type === 'tek' ? 3200 : 2200, 1.2);
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      ph += 520 / SR;
      x[i] = bp.process(rand() * 2 - 1) * 1.6 * Math.exp(-t / 0.022) + sin1(ph) * 0.35 * Math.exp(-t / 0.03);
    }
  }
  tailFade(x, 0.05);
  addMono(bus, x, nt.s, nt.pan ?? -0.3, nt.v * 0.7);
}

export function frameDrum(bus, nt) {
  const rand = rng(nt.seed);
  const x = hitBuf(0.9);
  const bp = new Biquad('bp', 1600, 0.8);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += (72 * (1 + 0.3 * Math.exp(-t / 0.04))) / SR;
    x[i] = sin1(ph) * Math.exp(-t / 0.3) + bp.process(rand() * 2 - 1) * 0.35 * Math.exp(-t / 0.12);
  }
  tailFade(x, 0.2);
  addMono(bus, x, nt.s, nt.pan ?? 0.25, nt.v * 0.8);
}

export function shaker(bus, nt) {
  const rand = rng(nt.seed);
  const x = hitBuf(0.12);
  const bp = new Biquad('bp', 6500, 1.5);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const e = t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) / 0.035);
    x[i] = bp.process(rand() * 2 - 1) * e;
  }
  tailFade(x, 0.02);
  addMono(bus, x, nt.s, nt.pan ?? 0.45, nt.v * 0.6);
}

// Rising filtered noise sweep ending at nt.s + nt.n.
export function riser(bus, nt) {
  const rand = rng(nt.seed);
  const len = nt.n;
  const out = newStereo(len);
  for (const ch of ['L', 'R']) {
    const f = new SVF(300, 2);
    const x = out[ch];
    for (let i = 0; i < len; i++) {
      const u = i / len;
      if ((i & 31) === 0) f.set(250 * Math.pow(40, u), 2.5);
      f.process(rand() * 2 - 1);
      x[i] = f.band * Math.pow(u, 2.2);
    }
  }
  mixStereo(bus, out, nt.s, nt.v * 0.6);
}

// Sub "boom" for big impacts.
export function boom(bus, nt) {
  const x = hitBuf(2.5);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += (38 + 40 * Math.exp(-t / 0.15)) / SR;
    x[i] = sin1(ph) * Math.exp(-t / 0.8) * (t < 0.005 ? t / 0.005 : 1);
  }
  tailFade(x, 0.5);
  addMono(bus, x, nt.s, 0, nt.v);
}
