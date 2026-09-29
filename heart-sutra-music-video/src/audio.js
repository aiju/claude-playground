// Loads the song and works out a few features for the visuals to react to:
// loudness, drum/bowl hits and the beat grid. Everything is precomputed at
// load time so a frame depends only on the song time, which keeps the
// offline render deterministic.

import { BPM } from './timeline.js';

const RATE = 100;   // feature frames per second

// Tries each url in turn until one fetches and decodes (not every browser
// decodes Opus, so a preview build may ship an mp3 instead).
export async function loadAudio(urls) {
  let last;
  for (const url of [].concat(urls)) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      const ctx = new OfflineAudioContext(2, 48000, 48000);
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch (e) { last = e; }
  }
  throw new Error(`couldn't load the song (${last && last.message})`);
}

// Direct-form biquad, in place.
function biquad(x, b0, b1, b2, a1, a2) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
}
function lowpass(x, sr, f) {
  const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * 0.707), a0 = 1 + al;
  biquad(x, (1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - al) / a0);
}
function highpass(x, sr, f) {
  const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * 0.707), a0 = 1 + al;
  biquad(x, (1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - al) / a0);
}

function envelope(x, sr) {
  const hop = sr / RATE, n = Math.floor(x.length / hop), e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const a = Math.floor(i * hop), b = Math.floor((i + 1) * hop);
    for (let j = a; j < b; j++) s += x[j] * x[j];
    e[i] = Math.sqrt(s / (b - a));
  }
  return e;
}

// Positive jumps in log energy, i.e. how hard something was just hit.
function onsets(env) {
  const o = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) {
    o[i] = Math.max(0, Math.log(env[i] + 1e-5) - Math.log(env[i - 1] + 1e-5));
  }
  return o;
}

function pickPeaks(o, minGap, k) {
  const hits = [];
  const w = 50;  // half a second each way for the adaptive threshold
  let last = -1e9;
  for (let i = 1; i < o.length - 1; i++) {
    if (o[i] < o[i - 1] || o[i] < o[i + 1]) continue;
    let m = 0, c = 0;
    for (let j = Math.max(0, i - w); j < Math.min(o.length, i + w); j++) { m += o[j]; c++; }
    m /= c;
    if (o[i] > m * k + 0.05 && i - last >= minGap * RATE) {
      hits.push({ t: i / RATE, s: o[i] });
      last = i;
    }
  }
  const top = hits.map(h => h.s).sort((a, b) => a - b)[Math.floor(hits.length * 0.95)] || 1;
  for (const h of hits) h.s = Math.min(1, h.s / top);
  return hits;
}

function normalise(e) {
  const sorted = Float32Array.from(e).sort();
  const lo = sorted[Math.floor(e.length * 0.05)], hi = sorted[Math.floor(e.length * 0.98)];
  return e.map(v => Math.min(1, Math.max(0, (v - lo) / (hi - lo))));
}

export function analyse(buffer) {
  const sr = buffer.sampleRate;
  const n = buffer.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / buffer.numberOfChannels;
  }
  const level = normalise(envelope(mono, sr));
  const low = Float32Array.from(mono); lowpass(low, sr, 160); lowpass(low, sr, 160);
  const lowOn = onsets(envelope(low, sr));
  const hits = pickPeaks(lowOn, 0.12, 2.2);

  // smooth the loudness a little
  const smooth = new Float32Array(level.length);
  let acc = level[0];
  for (let i = 0; i < level.length; i++) { acc += (level[i] - acc) * 0.08; smooth[i] = acc; }

  // beat phase: choose the offset that lines the grid up with the hits
  const period = 60 / BPM;
  let best = 0, bestScore = -1;
  for (let off = 0; off < period; off += 0.005) {
    let s = 0;
    for (const h of hits) {
      const ph = ((h.t - off) / period) % 1;
      s += h.s * Math.cos(2 * Math.PI * ph);
    }
    if (s > bestScore) { bestScore = s; best = off; }
  }
  return { level: smooth, hits, accents: pickAccents(hits), beatOffset: best, period, duration: n / sr };
}

// The accents: the strong hits, at least a quarter of a second apart (the
// stronger one wins). Scenes that draw something for a hit use these: with
// every hit, a busy bar of drums throws several things a second at random
// places, which reads as flicker.
function pickAccents(hits) {
  const out = [];
  for (const h of hits) {
    if (h.s < 0.7) continue;
    const last = out[out.length - 1];
    if (last && h.t - last.t < 0.25) { if (h.s > last.s) out[out.length - 1] = h; continue; }
    out.push(h);
  }
  return out;
}

// Feature values at time t, ready to become uniforms.
export function featuresAt(f, t) {
  const i = Math.min(f.level.length - 1, Math.max(0, Math.floor(t * RATE)));
  const level = f.level[i] || 0;
  // The last 16 hits before t (and the last 8 accents), newest first, as
  // [age, strength, keep, seed]. A
  // hit drops off the list when the 16th hit after it comes (the 8th for
  // accents), so keep fades it out over the half second before that:
  // whatever a scene draws for it can fade too, rather than vanish. seed is the hit's number in the song,
  // for scenes to place what they draw for it: it has to come from here,
  // because working the hit's time out again on the GPU (time - age, in 32-bit
  // floats) comes out slightly different every frame, and anything random
  // built on it would jump about while playing.
  const hits = recent(f.hits, t, 16), accents = recent(f.accents, t, 8);
  // a pulse on every hit: it rises over a few hundredths of a second rather
  // than jumping (anything sized or brightened by it would jitter at the
  // drum rate), peaks at 1 and dies away over about a third of a second
  let pulse = 0;
  for (const [age, s] of hits) pulse = Math.max(pulse, 2.2 * s * (1 - Math.exp(-age / 0.06)) * Math.exp(-age * 6));
  pulse = Math.min(1, pulse);
  const beat = (((t - f.beatOffset) / f.period) % 1 + 1) % 1;
  return { level, pulse, beat, hits, accents };
}

function recent(list, t, n) {
  let lo = 0, hi = list.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].t <= t) lo = m + 1; else hi = m; }
  const out = [];
  for (let k = lo - 1; k >= 0 && out.length < n; k--) {
    const next = list[k + n];
    const keep = next ? Math.min(1, Math.max(0, (next.t - t) / 0.5)) : 1;
    out.push([t - list[k].t, list[k].s, keep, k]);
  }
  while (out.length < n) out.push([99, 0, 0, 0]);
  return out;
}
