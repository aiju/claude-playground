// Low-level DSP: oscillators, filters, FFT convolution, synthetic impulse responses,
// delay, dynamics and a WAV writer. Everything works on Float32Arrays at SR.

export const SR = 44100;
export const TAU = Math.PI * 2;

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const db = (x) => Math.pow(10, x / 20);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// Small deterministic PRNG (mulberry32) so every render is identical.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Equal-power pan, p in [-1, 1].
export function panGains(p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

export function stereo(n) {
  return { L: new Float32Array(n), R: new Float32Array(n) };
}

// ---- oscillators -------------------------------------------------------------------

// PolyBLEP residual for band-limited discontinuities. t = phase in [0,1), dt = freq/SR.
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

export const sawBL = (ph, dt) => 2 * ph - 1 - blep(ph, dt);

export function squareBL(ph, dt, pw = 0.5) {
  let v = ph < pw ? 1 : -1;
  v += blep(ph, dt);
  let p2 = ph - pw;
  if (p2 < 0) p2 += 1;
  v -= blep(p2, dt);
  return v;
}

// Single-cycle wavetable built from harmonic amplitudes (and optional phases).
export const TABLE = 2048;
export function makeTable(amps, phases) {
  const t = new Float32Array(TABLE + 1);
  for (let h = 1; h < amps.length; h++) {
    const a = amps[h];
    if (!a) continue;
    const p = phases ? phases[h] : 0;
    for (let i = 0; i < TABLE; i++) t[i] += a * Math.sin((TAU * h * i) / TABLE + p);
  }
  let peak = 0;
  for (let i = 0; i < TABLE; i++) peak = Math.max(peak, Math.abs(t[i]));
  if (peak > 0) for (let i = 0; i < TABLE; i++) t[i] /= peak;
  t[TABLE] = t[0];
  return t;
}

export function readTable(t, ph) {
  const x = ph * TABLE;
  const i = x | 0;
  const f = x - i;
  return t[i] + (t[i + 1] - t[i]) * f;
}

// ---- filters -----------------------------------------------------------------------

// Topology-preserving state variable filter (Zavalishin). Cutoff can move every sample.
export class SVF {
  constructor() {
    this.ic1 = 0;
    this.ic2 = 0;
    this.g = 0;
    this.k = 1;
    this.a1 = 0;
    this.a2 = 0;
    this.a3 = 0;
    this.lp = 0;
    this.bp = 0;
    this.hp = 0;
  }
  set(fc, q = 0.707) {
    this.g = Math.tan((Math.PI * clamp(fc, 10, SR * 0.49)) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
  }
  tick(x) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - this.k * v1 - v2;
    return v2;
  }
}

// RBJ biquad, processed in place over a whole buffer.
export function biquad(buf, type, fc, q = 0.707, gainDb = 0) {
  const w = (TAU * fc) / SR;
  const cs = Math.cos(w);
  const sn = Math.sin(w);
  const alpha = sn / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp':
      b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case 'hp':
      b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case 'bp':
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
      break;
    case 'peak':
      b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A;
      break;
    case 'lowshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cs + s); b1 = 2 * A * (A - 1 - (A + 1) * cs);
      b2 = A * (A + 1 - (A - 1) * cs - s); a0 = A + 1 + (A - 1) * cs + s;
      a1 = -2 * (A - 1 + (A + 1) * cs); a2 = A + 1 + (A - 1) * cs - s;
      break;
    }
    case 'highshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cs + s); b1 = -2 * A * (A - 1 + (A + 1) * cs);
      b2 = A * (A + 1 + (A - 1) * cs - s); a0 = A + 1 - (A - 1) * cs + s;
      a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - s;
      break;
    }
    default:
      throw new Error('biquad type ' + type);
  }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

export function eqStereo(s, type, fc, q, g) {
  biquad(s.L, type, fc, q, g);
  biquad(s.R, type, fc, q, g);
}

// ---- FFT and convolution -----------------------------------------------------------

export function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

// Mono input x convolved with a stereo IR, using one complex FFT per block:
// the IR is packed as hL + i*hR, so the real part of the result is the left output
// and the imaginary part the right one. Results are added into outL / outR.
export function convolveStereoIR(x, hL, hR, outL, outR, gain = 1) {
  const L = hL.length;
  let M = 1;
  while (M < 2 * L) M <<= 1;
  const B = M - L + 1;
  const Hr = new Float64Array(M);
  const Hi = new Float64Array(M);
  for (let i = 0; i < L; i++) { Hr[i] = hL[i]; Hi[i] = hR[i]; }
  fft(Hr, Hi);
  const re = new Float64Array(M);
  const im = new Float64Array(M);
  const N = x.length;
  for (let pos = 0; pos < N; pos += B) {
    const n = Math.min(B, N - pos);
    let any = false;
    for (let i = 0; i < n; i++) if (x[pos + i] !== 0) { any = true; break; }
    if (!any) continue;
    re.fill(0); im.fill(0);
    for (let i = 0; i < n; i++) re[i] = x[pos + i];
    fft(re, im);
    for (let k = 0; k < M; k++) {
      const a = re[k], b = im[k];
      re[k] = a * Hr[k] - b * Hi[k];
      im[k] = a * Hi[k] + b * Hr[k];
    }
    fft(re, im, true);
    const lim = Math.min(M, outL.length - pos);
    for (let i = 0; i < lim; i++) {
      outL[pos + i] += re[i] * gain;
      outR[pos + i] += im[i] * gain;
    }
  }
}

// True-stereo reverb: each input channel feeds its own pair of decorrelated IRs.
export function reverb(input, ir, out, gain = 1) {
  convolveStereoIR(input.L, ir.LL, ir.LR, out.L, out.R, gain);
  convolveStereoIR(input.R, ir.RL, ir.RR, out.L, out.R, gain);
}

// Synthetic room impulse response: band-split noise, each band decaying with its own
// RT60, a smooth build-up, a pre-delay and a handful of early reflections.
// rt: array of [freq, rt60] pairs, low to high.
export function roomIR({ seconds, rt, predelay = 0.02, early = 8, earlySpan = 0.08, build = 0.03, seed = 9, width = 1 }) {
  const n = Math.round(seconds * SR);
  const make = (s, side) => {
    const r = rng(s);
    const out = new Float32Array(n);
    const pd = Math.round(predelay * SR);
    for (let b = 0; b < rt.length; b++) {
      const [fc, t60] = rt[b];
      const band = new Float32Array(n);
      for (let i = pd; i < n; i++) band[i] = r() * 2 - 1;
      if (b === 0) biquad(band, 'lp', fc * 1.4, 0.6);
      else if (b === rt.length - 1) biquad(band, 'hp', rt[b - 1][0] * 1.4, 0.6);
      else { biquad(band, 'hp', fc / 1.41, 0.7); biquad(band, 'lp', fc * 1.41, 0.7); }
      const k = -6.91 / (t60 * SR);
      for (let i = pd; i < n; i++) {
        const t = i - pd;
        const env = Math.exp(k * t) * (1 - Math.exp(-t / (build * SR)));
        out[i] += band[i] * env;
      }
    }
    for (let e = 0; e < early; e++) {
      const t = pd * 0.4 + Math.pow(r(), 0.7) * earlySpan * SR;
      const i = Math.round(t);
      if (i < n) out[i] += (r() < 0.5 ? -1 : 1) * (0.5 + 0.5 * r()) * (1 - t / (earlySpan * SR + pd)) * 1.6 * (side ? 0.8 : 1);
    }
    return out;
  };
  const LL = make(seed, 0), RR = make(seed + 101, 0);
  const LR = make(seed + 202, 1), RL = make(seed + 303, 1);
  // Cross terms are quieter; width < 1 blends them toward the direct ones.
  const cross = 0.55 * width;
  for (let i = 0; i < n; i++) { LR[i] *= cross; RL[i] *= cross; }
  let e = 0;
  for (let i = 0; i < n; i++) e += LL[i] * LL[i] + LR[i] * LR[i];
  const g = 1 / Math.sqrt(e);
  for (const a of [LL, RR, LR, RL]) for (let i = 0; i < n; i++) a[i] *= g;
  return { LL, LR, RL, RR };
}

// ---- time-based effects ------------------------------------------------------------

// Ping-pong delay with a darkening feedback path. Returns only the wet signal.
export function pingPong(input, out, { time, feedback = 0.4, tone = 3500, hp = 300, gain = 1 }) {
  const d = Math.round(time * SR);
  const n = input.L.length;
  const bufL = new Float32Array(d);
  const bufR = new Float32Array(d);
  let w = 0;
  const lpL = new SVF(), lpR = new SVF(), hpL = new SVF(), hpR = new SVF();
  lpL.set(tone); lpR.set(tone); hpL.set(hp); hpR.set(hp);
  for (let i = 0; i < n; i++) {
    const yl = bufL[w];
    const yr = bufR[w];
    const inMono = (input.L[i] + input.R[i]) * 0.5;
    // The left tap feeds the right line and vice versa.
    let fl = inMono + yr * feedback;
    let fr = yl * feedback;
    lpL.tick(fl); hpL.tick(lpL.lp); fl = hpL.hp;
    lpR.tick(fr); hpR.tick(lpR.lp); fr = hpR.hp;
    bufL[w] = fl;
    bufR[w] = fr;
    out.L[i] += yl * gain;
    out.R[i] += yr * gain;
    if (++w >= d) w = 0;
  }
}

// ---- dynamics ----------------------------------------------------------------------

// Feed-forward stereo compressor with RMS detection, applied in place.
export function compress(s, { threshold = -18, ratio = 3, attack = 0.01, release = 0.15, makeup = 0, knee = 6 }) {
  const n = s.L.length;
  const aA = Math.exp(-1 / (attack * SR));
  const aR = Math.exp(-1 / (release * SR));
  const aRms = Math.exp(-1 / (0.005 * SR));
  let rms = 0, gr = 0;
  const mk = db(makeup);
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(s.L[i]), Math.abs(s.R[i]));
    rms = aRms * rms + (1 - aRms) * x * x;
    const lvl = 10 * Math.log10(rms + 1e-12);
    const over = lvl - threshold;
    let target = 0;
    if (over > knee / 2) target = over * (1 - 1 / ratio);
    else if (over > -knee / 2) target = ((over + knee / 2) ** 2 / (2 * knee)) * (1 - 1 / ratio);
    gr = target > gr ? aA * gr + (1 - aA) * target : aR * gr + (1 - aR) * target;
    const g = db(-gr) * mk;
    s.L[i] *= g;
    s.R[i] *= g;
  }
}

// Look-ahead brickwall limiter (peak), applied in place.
export function limit(s, { ceiling = -1, lookahead = 0.005, release = 0.08 }) {
  const n = s.L.length;
  const la = Math.round(lookahead * SR);
  const c = db(ceiling);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(s.L[i]), Math.abs(s.R[i]));
    need[i] = p > c ? c / p : 1;
  }
  // m[j] = min(need[j .. j+la]), via a monotonic deque running backwards.
  const m = new Float32Array(n);
  const dq = new Int32Array(n);
  let h = 0, t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && need[dq[t - 1]] >= need[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + la) h++;
    m[i] = need[dq[h]];
  }
  // Instant attack (it is already ahead of the peak), exponential release...
  const aR = Math.exp(-1 / (release * SR));
  let r = 1;
  for (let i = 0; i < n; i++) {
    r = m[i] < r ? m[i] : m[i] + (r - m[i]) * aR;
    m[i] = r;
  }
  // ...then a box filter over the look-ahead length smooths the attack. At a peak every
  // value in the window is already at or below the needed gain, so so is the average.
  let acc = 0;
  const hist = new Float32Array(la);
  for (let i = 0; i < la; i++) hist[i] = 1;
  acc = la;
  for (let i = 0; i < n; i++) {
    const k = i % la;
    acc += m[i] - hist[k];
    hist[k] = m[i];
    const g = acc / la;
    s.L[i] *= g;
    s.R[i] *= g;
  }
}

export function softClip(x) {
  return x / Math.sqrt(1 + x * x);
}

// ---- output ------------------------------------------------------------------------

export function encodeWav(s, bits = 16) {
  const n = s.L.length;
  const bytes = bits / 8;
  const buf = Buffer.alloc(44 + n * 2 * bytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2 * bytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2 * bytes, 28);
  buf.writeUInt16LE(2 * bytes, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2 * bytes, 40);
  // TPDF dither on the way down to 16 bits.
  const r = rng(4242);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const ch of [s.L, s.R]) {
      const d = (r() - r()) / 32768;
      const v = Math.round(clamp(ch[i] + d, -1, 1) * 32767);
      buf.writeInt16LE(v, o);
      o += 2;
    }
  }
  return buf;
}
