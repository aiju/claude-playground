// A spectrogram of the vocal range for the timing checker: about 100
// columns a second, rows log-spaced from 110 Hz (bottom) to 3.5 kHz (top),
// values 0..255.

export const SPEC_ROWS = 96;
const F_LO = 110, F_HI = 3500;

function fftSetup(n) {
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(-2 * Math.PI * i / n); sin[i] = Math.sin(-2 * Math.PI * i / n); }
  return { n, rev, cos, sin };
}

// In-place radix-2 FFT of (re, im).
function fft({ n, rev, cos, sin }, re, im) {
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step], wi = sin[k * step];
        const a = start + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}

export async function spectrogram(buffer, onProgress = () => {}) {
  // mono, averaged down to about 12 kHz
  const factor = Math.max(1, Math.round(buffer.sampleRate / 12000));
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const len = Math.floor(buffer.length / factor);
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (const c of chans) for (let k = 0; k < factor; k++) s += c[i * factor + k];
    x[i] = s / (factor * chans.length);
  }
  const fs = buffer.sampleRate / factor;
  const N = 512, hop = Math.round(fs / 100);
  const frames = Math.max(0, Math.floor((len - N) / hop));
  const setup = fftSetup(N);
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  // which FFT bins feed each row
  const rowBins = [];
  for (let r = 0; r < SPEC_ROWS; r++) {
    const f0 = F_LO * Math.pow(F_HI / F_LO, r / SPEC_ROWS), f1 = F_LO * Math.pow(F_HI / F_LO, (r + 1) / SPEC_ROWS);
    const b0 = Math.floor(f0 / fs * N), b1 = Math.max(b0 + 1, Math.ceil(f1 / fs * N));
    rowBins.push([b0, b1]);
  }
  const db = new Float32Array(frames * SPEC_ROWS);
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let f = 0; f < frames; f++) {
    const o = f * hop;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(setup, re, im);
    for (let r = 0; r < SPEC_ROWS; r++) {
      let m = 0;
      for (let b = rowBins[r][0]; b < rowBins[r][1]; b++) m = Math.max(m, re[b] * re[b] + im[b] * im[b]);
      db[f * SPEC_ROWS + (SPEC_ROWS - 1 - r)] = 10 * Math.log10(m + 1e-10);
    }
    if (f % 2000 === 1999) { onProgress(f / frames); await new Promise(r => setTimeout(r, 0)); }
  }
  // map a robust range of levels onto 0..255
  const sample = [];
  for (let i = 0; i < db.length; i += 37) sample.push(db[i]);
  sample.sort((a, b) => a - b);
  const lo = sample[Math.floor(sample.length * 0.3)], hi = sample[Math.floor(sample.length * 0.997)];
  const data = new Uint8Array(db.length);
  for (let i = 0; i < db.length; i++) data[i] = Math.max(0, Math.min(255, 255 * (db[i] - lo) / (hi - lo)));
  onProgress(1);
  return { data, frames, rows: SPEC_ROWS, rate: fs / hop };
}
