// Additive pipe organ. Every stop is a rank of pipes with its own pitch (footage),
// harmonic recipe, speech time and slightly imperfect tuning. Notes get a breathy
// "chiff" as the pipes speak, a shared wind wobble, an optional tremulant, and are
// panned to the C or C# side of the case as the pipes stand on a real organ.

import { SR, TAU, mtof, rng, makeTable, readTable, panGains, clamp, SVF } from './dsp.js';

// Harmonic recipes. f is the frequency of the harmonic in Hz, n its number.
const TIMBRES = {
  // Diapason: the backbone of the organ sound.
  principal: (n, f) => {
    const base = [0, 1, 0.55, 0.38, 0.24, 0.19, 0.12, 0.09, 0.07][n] ?? 0.07 * Math.pow(8 / n, 1.7);
    return base * hiRoll(f, 6500);
  },
  flute: (n) => [0, 1, 0.22, 0.08, 0.03, 0.015][n] ?? 0,
  // Stopped pipes are closed at the top, so odd harmonics dominate.
  stopped: (n) => [0, 1, 0.04, 0.2, 0.02, 0.06, 0.01, 0.02][n] ?? 0,
  string: (n, f) => (n === 1 ? 0.45 : 0.6 * Math.pow(n, -0.55) * (1 + 0.2 * Math.sin(n * 2.3))) * hiRoll(f, 7000),
  // Trumpet-like reed: weak fundamental, bright formant around 1.5-2.5 kHz.
  reed: (n, f) => {
    const form = 1 + 1.4 * Math.exp(-Math.pow(Math.log2(f / 1900), 2) / 0.6);
    return (n === 1 ? 0.55 : Math.pow(n, -0.45)) * form * hiRoll(f, 5500);
  },
};

function hiRoll(f, fc) {
  return f < fc ? 1 : Math.exp(-(f - fc) / (fc * 0.5));
}

// mult: pitch relative to 8' (written pitch). breakHz: mixture ranks drop an octave
// once they pass this frequency, as real mixtures "break back".
export const STOPS = {
  principal16: { mult: 0.5, timbre: 'principal', gain: 0.35, speak: 0.07 },
  principal8: { mult: 1, timbre: 'principal', gain: 1, speak: 0.045 },
  octave4: { mult: 2, timbre: 'principal', gain: 0.7, speak: 0.035 },
  twelfth: { mult: 3, timbre: 'principal', gain: 0.32, speak: 0.03 },
  fifteenth: { mult: 4, timbre: 'principal', gain: 0.45, speak: 0.025 },
  mixture: { ranks: [6, 8, 12, 16], timbre: 'principal', gain: 0.1, speak: 0.02, breakHz: 2800 },
  bourdon16: { mult: 0.5, timbre: 'stopped', gain: 0.6, speak: 0.06 },
  gedackt8: { mult: 1, timbre: 'stopped', gain: 0.7, speak: 0.04 },
  flute8: { mult: 1, timbre: 'flute', gain: 0.8, speak: 0.04 },
  flute4: { mult: 2, timbre: 'flute', gain: 0.55, speak: 0.03 },
  nazard: { mult: 3, timbre: 'flute', gain: 0.4, speak: 0.03 },
  piccolo: { mult: 4, timbre: 'flute', gain: 0.4, speak: 0.025 },
  tierce: { mult: 5, timbre: 'flute', gain: 0.32, speak: 0.025 },
  gamba: { mult: 1, timbre: 'string', gain: 0.45, speak: 0.07 },
  celeste: { mult: 1, timbre: 'string', gain: 0.45, speak: 0.07, cents: 6 },
  trumpet: { mult: 1, timbre: 'reed', gain: 0.6, speak: 0.012, reed: true },
  clairon: { mult: 2, timbre: 'reed', gain: 0.28, speak: 0.01, reed: true },
  bombarde16: { mult: 0.5, timbre: 'reed', gain: 0.45, speak: 0.02, reed: true },
  // Pedal: 16' + 10 2/3' together give a "resultant" 32' difference tone.
  subbass16: { mult: 0.5, timbre: 'stopped', gain: 0.75, speak: 0.08 },
  quint10: { mult: 0.75, timbre: 'stopped', gain: 0.3, speak: 0.08 },
  octave8p: { mult: 1, timbre: 'principal', gain: 0.7, speak: 0.05 },
  choral4p: { mult: 2, timbre: 'principal', gain: 0.4, speak: 0.04 },
};

export const REG = {
  soft: ['flute8', 'gamba', 'celeste'],
  flutes: ['flute8', 'flute4'],
  cornet: ['gedackt8', 'flute4', 'nazard', 'piccolo', 'tierce'],
  principals: ['principal8', 'octave4', 'flute8'],
  plenum: ['principal8', 'octave4', 'twelfth', 'fifteenth', 'mixture'],
  full: ['principal16', 'principal8', 'octave4', 'twelfth', 'fifteenth', 'mixture', 'trumpet'],
  reedSolo: ['trumpet', 'flute8', 'octave4'],
  pedalSoft: ['subbass16', 'octave8p'],
  pedal: ['subbass16', 'quint10', 'octave8p', 'choral4p'],
  pedalFull: ['subbass16', 'quint10', 'octave8p', 'choral4p', 'bombarde16'],
};

const tableCache = new Map();
const phaseSets = {};
function tableFor(timbre, f) {
  // Quantize to a quarter tone so neighbouring notes share tables.
  const q = Math.round(24 * Math.log2(f / 440));
  const key = timbre + q;
  let t = tableCache.get(key);
  if (t) return t;
  const fq = 440 * Math.pow(2, q / 24);
  const nmax = Math.max(1, Math.min(80, Math.floor(16000 / fq)));
  if (!phaseSets[timbre]) {
    const r = rng(timbre.length * 7919);
    phaseSets[timbre] = Array.from({ length: 81 }, () => r() * TAU);
  }
  const amps = new Float32Array(nmax + 1);
  for (let n = 1; n <= nmax; n++) amps[n] = TIMBRES[timbre](n, fq * n);
  t = makeTable(amps, phaseSets[timbre]);
  tableCache.set(key, t);
  return t;
}

// Fixed per-pipe tuning error in cents, so a repeated note always sounds the same.
function pipeCents(m, rank) {
  const r = rng(m * 131 + rank * 17 + 5);
  return (r() + r() - 1) * 2.2;
}

function expandRanks(stops, m) {
  const ranks = [];
  let ri = 0;
  for (const name of stops) {
    const s = STOPS[name];
    if (!s) throw new Error('no stop ' + name);
    const mults = s.ranks || [s.mult];
    for (let mult of mults) {
      if (s.breakHz) while (mtof(m) * mult > s.breakHz) mult /= 2;
      const f = mtof(m) * mult * Math.pow(2, ((s.cents || 0) + pipeCents(m, ri)) / 1200);
      if (f > 15000) continue;
      // Bigger pipes speak more slowly.
      const speak = s.speak * clamp(Math.pow(220 / f, 0.35), 0.6, 2.2);
      ranks.push({ f, table: tableFor(s.timbre, f), gain: s.gain, speak, reed: !!s.reed, flue: !s.reed, ph: rng(m * 7 + ri)() });
      ri++;
    }
  }
  return ranks;
}

// Shared wind supply: a slow, slightly irregular wobble of pitch and pressure.
function wind(t) {
  return 1 + 0.00035 * Math.sin(TAU * 0.53 * t) + 0.00025 * Math.sin(TAU * 1.31 * t + 1.2);
}

// Render one organ note. s: start sample, n: held length in samples.
// t0: absolute time of the start in seconds (keeps wind and tremulant continuous).
export function organNote(out, s, n, { m, vel = 1, stops, pan = null, trem = 0, t0 = 0, release = null }) {
  const ranks = expandRanks(stops, m);
  if (!ranks.length) return;
  const f0 = mtof(m);
  const rel = release ?? clamp(0.05 + 0.1 * Math.pow(110 / f0, 0.5), 0.05, 0.16);
  const relN = Math.round(rel * SR * 5);
  const total = n + relN;
  const side = m % 2 ? 1 : -1;
  const p = pan ?? side * (0.15 + 0.5 * clamp((m - 40) / 44, 0, 1));
  const [gl, gr] = panGains(p);
  const norm = vel * 0.16;

  // Breath noise for the chiff, band-passed around the 3rd-5th harmonic.
  const hasFlue = ranks.some((r) => r.flue);
  const chiff = new SVF();
  chiff.set(clamp(f0 * 4, 700, 7000), 1.6);
  const nr = rng(m * 997 + s);
  const chiffAmt = hasFlue ? 0.75 * clamp(Math.pow(300 / f0, 0.25), 0.6, 1.4) : 0;
  // A faint steady breath of wind through the pipe mouths while the note sounds.
  const breath = new SVF();
  breath.set(clamp(f0 * 6, 1500, 9000), 0.9);
  const breathAmt = hasFlue ? 0.05 : 0;

  const relK = Math.exp(-1 / (rel * SR));
  const k = ranks.length;
  const att = ranks.map((r) => Math.exp(-1 / ((r.speak / 3) * SR)));
  const env = new Float64Array(k);
  const ph = new Float64Array(k);
  for (let j = 0; j < k; j++) ph[j] = ranks[j].ph;
  let relEnv = 1;
  const dtBase = 1 / SR;
  const lim = Math.min(total, out.L.length - s);
  for (let i = Math.max(0, -s); i < lim; i++) {
    const t = i * dtBase;
    const ta = t0 + t;
    let w = wind(ta);
    let am = 1;
    if (trem) {
      const tr = Math.sin(TAU * 4.8 * ta);
      w *= 1 + trem * 0.002 * tr;
      am = 1 + trem * 0.07 * tr;
    }
    if (i >= n) relEnv *= relK;
    let y = 0;
    for (let j = 0; j < k; j++) {
      const r = ranks[j];
      env[j] = 1 - (1 - env[j]) * att[j];
      let f = r.f * w;
      if (r.reed) f *= 1 + 0.012 * Math.exp(-t / 0.012);
      ph[j] += f * dtBase;
      ph[j] -= ph[j] | 0;
      y += readTable(r.table, ph[j]) * env[j] * r.gain;
    }
    if (chiffAmt && t < 0.12) {
      const e = Math.exp(-t / 0.018) * (1 - Math.exp(-t / 0.002));
      y += chiff.tick((nr() * 2 - 1) * e) * chiffAmt * 3;
      y += Math.sin(TAU * 2 * f0 * t) * e * 0.25;
    }
    if (breathAmt) y += breath.tick(nr() * 2 - 1) * breathAmt * env[0];
    y *= norm * relEnv * am;
    const idx = s + i;
    out.L[idx] += y * gl;
    out.R[idx] += y * gr;
    if (i >= n && relEnv < 1e-4) break;
  }
}
