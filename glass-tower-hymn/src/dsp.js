// Low-level DSP building blocks: oscillators, filters, noise, reverb, dynamics.
// Everything works on plain Float32Arrays at a fixed sample rate.

export const SR = 44100;
export const TAU = Math.PI * 2;

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const db = (d) => Math.pow(10, d / 20);
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// Deterministic PRNG (mulberry32) so every render is identical.
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

// Topology-preserving state variable filter (stable under modulation).
export class SVF {
  constructor(fc = 1000, q = 0.707) {
    this.ic1 = 0;
    this.ic2 = 0;
    this.low = 0;
    this.band = 0;
    this.high = 0;
    this.set(fc, q);
  }
  set(fc, q) {
    fc = clamp(fc, 10, SR * 0.45);
    const g = Math.tan((Math.PI * fc) / SR);
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
    this.low = v2;
    this.high = v0 - this.k * v1 - v2;
    return v2;
  }
}

// RBJ cookbook biquad.
export class Biquad {
  constructor(type, f, q = 0.707, gainDb = 0) {
    this.z1 = 0;
    this.z2 = 0;
    this.set(type, f, q, gainDb);
  }
  set(type, f, q = 0.707, gainDb = 0) {
    const w0 = (TAU * clamp(f, 5, SR * 0.49)) / SR;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = sw / (2 * q);
    const A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'lp':
        b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0;
        a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
        break;
      case 'hp':
        b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0;
        a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
        break;
      case 'bp': // 0 dB peak gain
        b0 = alpha; b1 = 0; b2 = -alpha;
        a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
        break;
      case 'peak':
        b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
        a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
        break;
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 - (A - 1) * cw + s);
        b1 = 2 * A * (A - 1 - (A + 1) * cw);
        b2 = A * (A + 1 - (A - 1) * cw - s);
        a0 = A + 1 + (A - 1) * cw + s;
        a1 = -2 * (A - 1 + (A + 1) * cw);
        a2 = A + 1 + (A - 1) * cw - s;
        break;
      }
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 + (A - 1) * cw + s);
        b1 = -2 * A * (A - 1 + (A + 1) * cw);
        b2 = A * (A + 1 + (A - 1) * cw - s);
        a0 = A + 1 - (A - 1) * cw + s;
        a1 = 2 * (A - 1 - (A + 1) * cw);
        a2 = A + 1 - (A - 1) * cw - s;
        break;
      }
      default:
        throw new Error('unknown biquad type ' + type);
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    return this;
  }
  process(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  run(buf, from = 0, to = buf.length) {
    for (let i = from; i < to; i++) buf[i] = this.process(buf[i]);
    return buf;
  }
}

// Apply a chain of [type, f, q, gain] filter specs to a buffer in place.
export function eq(buf, specs) {
  for (const s of specs) new Biquad(...s).run(buf);
  return buf;
}

export class OnePole {
  constructor(fc) {
    this.y = 0;
    this.set(fc);
  }
  set(fc) {
    this.a = 1 - Math.exp((-TAU * fc) / SR);
  }
  process(x) {
    return (this.y += this.a * (x - this.y));
  }
}

// Smooth random signal in [-1, 1] (interpolated noise), for drift/jitter.
export class Drift {
  constructor(rate, rand) {
    this.rand = rand;
    this.step = rate / SR;
    this.pos = 0;
    this.a = rand() * 2 - 1;
    this.b = rand() * 2 - 1;
  }
  next() {
    this.pos += this.step;
    if (this.pos >= 1) {
      this.pos -= 1;
      this.a = this.b;
      this.b = this.rand() * 2 - 1;
    }
    const t = this.pos * this.pos * (3 - 2 * this.pos);
    return this.a + (this.b - this.a) * t;
  }
}

// Equal-power pan gains for pan in [-1, 1].
export function panGains(pan) {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

// Add a mono signal into a stereo bus at an offset.
export function addMono(bus, src, start, pan = 0, gain = 1) {
  const [gl, gr] = panGains(pan);
  const L = bus.L;
  const R = bus.R;
  const n = Math.min(src.length, L.length - start);
  for (let i = Math.max(0, -start); i < n; i++) {
    const s = src[i] * gain;
    L[start + i] += s * gl;
    R[start + i] += s * gr;
  }
}

export class Allpass {
  constructor(len, g) {
    this.buf = new Float32Array(len);
    this.i = 0;
    this.g = g;
  }
  process(x) {
    const d = this.buf[this.i];
    const v = x + this.g * d;
    this.buf[this.i] = v;
    if (++this.i >= this.buf.length) this.i = 0;
    return d - this.g * v;
  }
}

// 8-line feedback delay network hall reverb with modulated taps.
export function reverb(inL, inR, opts = {}) {
  const {
    rt60 = 2.8,
    size = 1.25,
    damp = 5200,
    predelay = 0.028,
    lowcut = 220,
    highcut = 9500,
    seed = 7,
  } = opts;
  const n = inL.length;
  const rand = rng(seed);
  const base = [1117, 1277, 1429, 1571, 1789, 1951, 2113, 2311];
  const N = 8;
  const len = base.map((l) => Math.round(l * size));
  const lines = len.map((l) => new Float32Array(l + 32));
  const widx = new Int32Array(N);
  const gain = len.map((l) => Math.pow(10, (-3 * l) / (SR * rt60)));
  const lp = new Float64Array(N);
  const lpa = 1 - Math.exp((-TAU * damp) / SR);
  const modRate = base.map(() => 0.07 + rand() * 0.25);
  const modPh = base.map(() => rand());
  const modDepth = 6;
  const sign = [1, -1, 1, -1, -1, 1, -1, 1];
  const apL = [142, 107, 379, 277].map((l) => new Allpass(l, 0.62));
  const apR = [151, 113, 389, 263].map((l) => new Allpass(l, 0.62));
  const hpL = new Biquad('hp', lowcut, 0.6);
  const hpR = new Biquad('hp', lowcut, 0.6);
  const lpL = new Biquad('lp', highcut, 0.6);
  const lpR = new Biquad('lp', highcut, 0.6);
  const pd = Math.round(predelay * SR);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const o = new Float64Array(N);
  for (let i = 0; i < n; i++) {
    let xl = i >= pd ? inL[i - pd] : 0;
    let xr = i >= pd ? inR[i - pd] : 0;
    xl = lpL.process(hpL.process(xl));
    xr = lpR.process(hpR.process(xr));
    for (let k = 0; k < 4; k++) {
      xl = apL[k].process(xl);
      xr = apR[k].process(xr);
    }
    let sum = 0;
    for (let j = 0; j < N; j++) {
      const buf = lines[j];
      const size_ = buf.length;
      const d = len[j] - modDepth * (1 + sin1(modPh[j] + (i * modRate[j]) / SR));
      let rp = widx[j] - d;
      if (rp < 0) rp += size_;
      const ri = rp | 0;
      const fr = rp - ri;
      const a = buf[ri];
      const b = buf[ri + 1 < size_ ? ri + 1 : 0];
      let v = a + (b - a) * fr;
      lp[j] += lpa * (v - lp[j]);
      v = lp[j] * gain[j];
      o[j] = v;
      sum += v;
    }
    const s = (sum * 2) / N;
    for (let j = 0; j < N; j++) {
      const inj = (j & 1 ? xr : xl) * sign[j] * 0.5;
      const buf = lines[j];
      buf[widx[j]] = o[j] - s + inj;
      if (++widx[j] >= buf.length) widx[j] = 0;
    }
    outL[i] = (o[0] - o[2] + o[4] - o[6] + 0.5 * (o[1] - o[5])) * 0.55;
    outR[i] = (o[1] - o[3] + o[5] - o[7] + 0.5 * (o[2] - o[6])) * 0.55;
  }
  return [outL, outR];
}

// Stereo ping-pong delay (returns wet only).
export function pingPong(inL, inR, { time = 0.3, feedback = 0.35, lowcut = 400, highcut = 5000 } = {}) {
  const n = inL.length;
  const d = Math.round(time * SR);
  const bufL = new Float32Array(d);
  const bufR = new Float32Array(d);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const hp = new Biquad('hp', lowcut, 0.7);
  const lp = new OnePole(highcut);
  let w = 0;
  for (let i = 0; i < n; i++) {
    const dl = bufL[w];
    const dr = bufR[w];
    const x = lp.process(hp.process((inL[i] + inR[i]) * 0.5));
    bufL[w] = x + dr * feedback;
    bufR[w] = dl * feedback;
    outL[i] = dl;
    outR[i] = dr;
    if (++w >= d) w = 0;
  }
  return [outL, outR];
}

// Feed-forward stereo-linked compressor, in place.
export function compress(L, R, { threshold = -18, ratio = 2.5, attack = 0.01, release = 0.15, knee = 6, makeup = 0 } = {}) {
  const aa = Math.exp(-1 / (attack * SR));
  const ra = Math.exp(-1 / (release * SR));
  let env = 0;
  const mk = db(makeup);
  for (let i = 0; i < L.length; i++) {
    const x = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    env = x > env ? aa * env + (1 - aa) * x : ra * env + (1 - ra) * x;
    const lvl = 20 * Math.log10(env + 1e-9);
    const over = lvl - threshold;
    let gr = 0;
    if (over > knee / 2) gr = over * (1 - 1 / ratio);
    else if (over > -knee / 2) gr = ((over + knee / 2) ** 2 / (2 * knee)) * (1 - 1 / ratio);
    const g = db(-gr) * mk;
    L[i] *= g;
    R[i] *= g;
  }
}

// Look-ahead brickwall limiter, in place.
export function limit(L, R, { ceiling = -1, lookahead = 0.004, release = 0.12 } = {}) {
  const n = L.length;
  const c = db(ceiling);
  const la = Math.max(1, Math.round(lookahead * SR));
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    req[i] = p > c ? c / p : 1;
  }
  // sliding min over [i, i + la] with a monotonic deque
  const tmin = new Float32Array(n);
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
    tmin[i] = req[dq[h]];
  }
  const ra = 1 - Math.exp(-1 / (release * SR));
  let e = 1;
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tg = tmin[i];
    e = tg < e ? tg : e + (tg - e) * ra;
    env[i] = e;
  }
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += env[i];
    if (i >= la) acc -= env[i - la];
    const g = acc / Math.min(i + 1, la);
    L[i] = Math.max(-c, Math.min(c, L[i] * g));
    R[i] = Math.max(-c, Math.min(c, R[i] * g));
  }
}

export function encodeWav(L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  const r = rng(99);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const dl = (r() - r()) / 32768;
    const dr = (r() - r()) / 32768;
    buf.writeInt16LE(Math.round(clamp(L[i] + dl, -1, 1) * 32767), o);
    buf.writeInt16LE(Math.round(clamp(R[i] + dr, -1, 1) * 32767), o + 2);
    o += 4;
  }
  return buf;
}
