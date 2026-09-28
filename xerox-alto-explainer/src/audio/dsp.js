// DSP building blocks for the soundtrack, on plain Float32Arrays. Adapted
// from sunken-bell-song/src/dsp.js (copied, not imported: projects here stay
// self-contained), cut down to mono and 48 kHz.

export const RATE = 48000;
export const TAU = Math.PI * 2;

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const db = (d) => Math.pow(10, d / 20);
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// Deterministic PRNG (mulberry32) so every build is identical.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Table-lookup sine; phase in cycles.
const TABLE = 8192;
const SIN = new Float32Array(TABLE + 1);
for (let i = 0; i <= TABLE; i++) SIN[i] = Math.sin((TAU * i) / TABLE);
export function sin1(phase) {
  const p = phase - Math.floor(phase);
  const x = p * TABLE;
  const i = x | 0;
  return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i);
}

// PolyBLEP residual for band-limited saw/square.
export function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

// Band-limited oscillators; phase in cycles, dt = frequency / RATE.
export const saw = (p, dt) => 2 * p - 1 - blep(p, dt);
export function square(p, dt) {
  let v = p < 0.5 ? 1 : -1;
  v += blep(p, dt);
  const q = p + 0.5 - Math.floor(p + 0.5);
  return v - blep(q, dt);
}
export const tri = (p) => 1 - 4 * Math.abs(p - 0.5);

// Topology-preserving state variable filter (stable under modulation).
export class SVF {
  constructor(fc = 1000, q = 0.707) {
    this.ic1 = 0;
    this.ic2 = 0;
    this.set(fc, q);
  }
  set(fc, q = this.q) {
    this.q = q;
    fc = clamp(fc, 10, RATE * 0.45);
    const g = Math.tan((Math.PI * fc) / RATE);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  process(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.band = v1;
    this.high = v0 - this.k * v1 - v2;
    return (this.low = v2);
  }
}

// Small mono room (four combs into two allpasses, Freeverb-style), returned
// wet only. Short and dark, to glue the dry synth sounds without washing out
// the clicks.
export function room(input, { size = 0.55, damp = 0.35, gain = 0.25 } = {}) {
  const n = input.length;
  const out = new Float32Array(n);
  const len = [1557, 1617, 1491, 1422].map((l) => Math.round((l * RATE) / 44100));
  const [c0, c1, c2, c3] = len.map((l) => new Float32Array(l));
  const [l0, l1, l2, l3] = len;
  const a0 = new Float32Array(Math.round((556 * RATE) / 44100));
  const a1 = new Float32Array(Math.round((441 * RATE) / 44100));
  const fb = 0.7 + 0.28 * size;
  const u = 1 - damp;
  let i0 = 0, i1 = 0, i2 = 0, i3 = 0, j0 = 0, j1 = 0;
  let f0 = 0, f1 = 0, f2 = 0, f3 = 0;
  for (let s = 0; s < n; s++) {
    const x = input[s] * gain;
    const d0 = c0[i0], d1 = c1[i1], d2 = c2[i2], d3 = c3[i3];
    f0 = d0 * u + f0 * damp;
    f1 = d1 * u + f1 * damp;
    f2 = d2 * u + f2 * damp;
    f3 = d3 * u + f3 * damp;
    c0[i0] = x + f0 * fb;
    c1[i1] = x + f1 * fb;
    c2[i2] = x + f2 * fb;
    c3[i3] = x + f3 * fb;
    if (++i0 === l0) i0 = 0;
    if (++i1 === l1) i1 = 0;
    if (++i2 === l2) i2 = 0;
    if (++i3 === l3) i3 = 0;
    let y = d0 + d1 + d2 + d3;
    let d = a0[j0];
    a0[j0] = y + d * 0.5;
    if (++j0 === a0.length) j0 = 0;
    y = d - y;
    d = a1[j1];
    a1[j1] = y + d * 0.5;
    if (++j1 === a1.length) j1 = 0;
    out[s] = d - y;
  }
  return out;
}

// Loudness of a signal over time: a peak follower with separate attack and
// release, sampled every sample.
export function follow(input, { attack = 0.01, release = 0.3 } = {}) {
  const a = 1 - Math.exp(-1 / (attack * RATE));
  const r = 1 - Math.exp(-1 / (release * RATE));
  const env = new Float32Array(input.length);
  let e = 0;
  for (let i = 0; i < input.length; i++) {
    const x = Math.abs(input[i]);
    e += (x > e ? a : r) * (x - e);
    env[i] = e;
  }
  return env;
}

// Look-ahead peak limiter over the sum of several stems. The same gain goes
// on every stem, so the mix never clips and muting a stem in the player
// still leaves the others as they'd sound in the full mix.
export function limitTogether(stems, { ceiling = -1, lookahead = 0.004, release = 0.12 } = {}) {
  const n = stems[0].length;
  const c = db(ceiling);
  const la = Math.max(1, Math.round(lookahead * RATE));
  const sum = new Float32Array(n);
  for (const st of stems) for (let i = 0; i < n; i++) sum[i] += st[i];
  const req = new Float32Array(n);
  let over = false;
  for (let i = 0; i < n; i++) {
    const p = Math.abs(sum[i]);
    req[i] = p > c ? c / p : 1;
    over ||= p > c;
  }
  if (!over) return;
  // Sliding minimum over [i, i + la] with a monotonic deque.
  const gain = new Float32Array(n);
  const dq = new Int32Array(n + la + 1);
  let h = 0;
  let t = 0;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const end = Math.min(n - 1, i + la);
    while (j <= end) {
      while (t > h && req[dq[t - 1]] >= req[j]) t--;
      dq[t++] = j++;
    }
    while (dq[h] < i) h++;
    gain[i] = req[dq[h]];
  }
  // Instant attack, smooth release, then a moving average over the
  // look-ahead so the gain never steps.
  const ra = 1 - Math.exp(-1 / (release * RATE));
  let e = 1;
  for (let i = 0; i < n; i++) {
    const tg = gain[i];
    e = tg < e ? tg : e + (tg - e) * ra;
    gain[i] = e;
  }
  let acc = 0;
  const smooth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    acc += gain[i];
    if (i >= la) acc -= gain[i - la];
    smooth[i] = acc / Math.min(i + 1, la);
  }
  for (const st of stems) for (let i = 0; i < n; i++) st[i] *= smooth[i];
}
