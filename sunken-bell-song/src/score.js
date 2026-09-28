// The composition: "The Sunken Bell" (沈鐘, chinshō).
// C minor, 138 bpm, with a 7/8 Hijaz dance in the middle and a Picardy ending.
//
// A bell has sunk into the sea and still tolls under the water. The piece
// moves between that underwater world (bell, water, muffled pulse) and a
// dense hybrid of orchestra, layered choir, ethnic soloists and electronics.

import { mel, chart, voice, pcAbove, midi, scaleUp, SCALES } from './theory.js';

export const FORM = [
  { id: 'prologue', name: 'Prologue', bars: 6, barLen: 4 },
  { id: 'awaken', name: 'Awakening', bars: 8, barLen: 4 },
  { id: 'theme', name: 'Theme', bars: 16, barLen: 4 },
  { id: 'verse', name: 'Verse', bars: 16, barLen: 4 },
  { id: 'pre', name: 'Pre-chorus', bars: 8, barLen: 4 },
  { id: 'chorus', name: 'Chorus', bars: 16, barLen: 4 },
  { id: 'bridge', name: 'Hijaz dance', bars: 16, barLen: 3.5 },
  { id: 'halftime', name: 'Choir', bars: 4, barLen: 4 },
  { id: 'breakdown', name: 'Underwater', bars: 8, barLen: 4 },
  { id: 'final', name: 'Final chorus', bars: 16, barLen: 4 },
  { id: 'outro', name: 'Outro', bars: 12, barLen: 4 },
  { id: 'coda', name: 'Coda', bars: 3, barLen: 4 },
];
{
  let b = 0;
  for (const s of FORM) {
    s.beat = b;
    b += s.bars * s.barLen;
  }
}
export const SEC = Object.fromEntries(FORM.map((s) => [s.id, s]));
export const END_BEAT = FORM[FORM.length - 1].beat + FORM[FORM.length - 1].bars * 4;

const at = (id, bar = 0, beat = 0) => SEC[id].beat + bar * SEC[id].barLen + beat;

export const TEMPO = [
  { beat: 0, bpm: 92 },
  { beat: SEC.awaken.beat - 0.001, bpm: 92 },
  { beat: SEC.awaken.beat, bpm: 138 },
  { beat: at('outro', 8), bpm: 138 },
  { beat: at('outro', 11), bpm: 104 },
  { beat: END_BEAT, bpm: 96 },
];

// Low-pass cutoff (Hz) for the groove instruments: they sink "under water"
// in the breakdown and resurface for the final chorus.
export const UNDERWATER = [
  [0, 20000],
  [at('breakdown', 0), 20000],
  [at('breakdown', 0, 1), 420],
  [at('breakdown', 6), 420],
  [at('final', 0), 20000],
];

export const SECTIONS = FORM.map((s) => ({ name: s.name, beat: s.beat }));

// ---- material ---------------------------------------------------------------------

const THEME_A =
  'C5:8 G5:4.s G5:8 Ab5:8 G5:8 F5:8 | Eb5:4. D5:8 C5:4 B4:4 | r:8 C5:8 Eb5:8 G5:8 C6:4.s Bb5:8 | A5:4. G5:8 F5:4 C5:4 | ' +
  'Ab5:4. G5:8 F5:8 Eb5:8 D5:8 C5:8 | Eb5:4. D5:8 Eb5:8 F5:8 G5:4 | Ab5:4 F5:8 C6:8~ C6:4 Bb5:8 Ab5:8 | B5:4m Ab5:8 G5:8 F5:8 Eb5:8 D5:8 B4:8';
const THEME_B =
  'C5:8 G5:4.s G5:8 Ab5:8 G5:8 F5:8 | Eb5:4. D5:8 C5:4 B4:4 | r:8 C5:8 Eb5:8 G5:8 C6:4.s Bb5:8 | A5:4. G5:8 F5:4 C5:4 | ' +
  'Ab5:4. G5:8 F5:8 Eb5:8 D5:8 C5:8 | D5:4. Eb5:8 F5:8 Ab5:8 G5:8 F5:8 | G5:4. F5:8 Eb5:8 D5:8 B4:8 D5:8 | C5:1';
const THEME_CH_A = 'Cm | Cm/B | Cm/Bb | F/A | Fm/Ab | Cm/G | Dbmaj7 | G7b9';
const THEME_CH_B = 'Cm | Cm/B | Cm/Bb | F/A | Fm/Ab | G7b9 | Cm | Cm';

const PROLOGUE =
  'r:2 G4:4s Ab4:8 G4:8 | C5:2.s Db5:8 C5:8 | B4:8 C5:8 Eb5:4. D5:8 C5:8 B4:8 | C5:1 | r:4 Eb5:8s F5:8 G5:4. Ab5:8 | G5:2 F5:8 Eb5:8 D5:8 B4:8';

const VERSE =
  'r:4 G4:8 C5:8 D5:4.s Eb5:8 | D5:2 r:2 | r:4 G4:8 C5:8 Eb5:4. D5:8 | C5:2 r:2 | ' +
  'r:4 F4:8 Bb4:8 D5:4. F5:8 | Eb5:4. D5:8 C5:2 | r:8 G4:8 Bb4:8 C5:8 Eb5:4 G5:4s | F5:8 Eb5:8 D5:8 C5:8 D5:2f | ' +
  'r:4 C5:8 F5:8 G5:4.s Ab5:8 | G5:2 r:4 F5:8 G5:8 | Ab5:4. G5:8 F5:4 C5:4 | Eb5:8 F5:8 Eb5:8 Db5:8 C5:2 | ' +
  'r:8 Eb5:8 Ab5:8 C6:8 Bb5:4.s Ab5:8 | G5:4 F5:8 Eb5:8 F5:2 | r:8 D5:8 F5:8 Bb5:8 Ab5:4 G5:4 | F5:8 Eb5:8 D5:8 B4:8 Ab4:8 G4:8 B4:4';
const VERSE_CH = 'Cm9 | Cm9 | Abmaj7/C | Abmaj7/C | Bb/C | Bb/C | Cm7 | Cm7 | Fm9 | Fm9 | Dbmaj7 | Dbmaj7 | Ab/C | Bbsus4 | Bb | G7b9';
const VERSE_FLUTE =
  'r:1 | r:2 G5:16 F5:16 Eb5:16 D5:16 C5:8 G4:8 | r:1 | r:2 Eb5:16 D5:16 C5:16 Bb4:16 G4:4 | r:1 | r:2 F5:16 G5:16 F5:16 D5:16 Bb4:4 | r:1 | r:1 | ' +
  'r:1 | r:2 C6:16 Bb5:16 Ab5:16 G5:16 r:4 | r:1 | r:2 Ab5:16 G5:16 F5:16 Eb5:16 Db5:4 | r:1 | r:1 | r:1 | r:1';
const VERSE_CELLO = 'C4:2 Eb4:2 | Ab4:1 | Ab4:2 G4:2 | F4:1 | Eb4:2 G4:2 | F4:2 Eb4:2 | D4:2 F4:2 | Ab4:2 B3:2';

const PRE =
  'C5:4. Eb5:8 Ab5:4 G5:4 | F5:4. D5:8 Bb4:2 | Bb4:4. D5:8 G5:4 F5:4 | Eb5:4. G5:8 C6:2s | ' +
  'Ab5:4. C6:8 Eb6:4 C6:4 | Bb5:4. C6:8 Eb6:2 | D6:4. B5:8 Ab5:4 F5:4 | G5:2.* r:4';
const PRE_CH = 'Ab | Bb/Ab | Gm7 | Cm7 | Fm7 | Ab/Bb | Bdim7 | G7b9';

const CHORUS =
  'r:8 Eb5:8 Ab5:8 Bb5:8 C6:2 | D6:4. C6:8 Bb5:8 C6:8 D6:4 | Eb6:4. D6:8 C6:4 Bb5:8 G5:8 | Bb5:2 Ab5:8 G5:8 F5:8 Eb5:8 | ' +
  'r:8 C5:8 F5:8 G5:8 Ab5:4. G5:8 | F5:4 G5:8 Ab5:8 C6:4 Bb5:8 Ab5:8 | G5:2 C6:2s | B5:4. Ab5:8 G5:8 F5:8 D5:4 | ' +
  'r:8 Eb5:8 Ab5:8 Bb5:8 C6:2 | D6:4. C6:8 Bb5:8 C6:8 F6:4s | Eb6:4. D6:8 C6:8 Bb5:8 C6:4 | Bb5:2. G5:8 Bb5:8 | ' +
  'C6:4. Eb6:8 F6:2s | Eb6:8 F6:8 Eb6:8 C6:8 Ab5:4 G5:4 | G5:4 C6:4 B5:4 Ab5:8 F5:8 | D5:8 Eb5:8 D5:8 B4:8 C5:2';
const CHORUS_CH =
  'Abmaj7 | Bb/D | Cm7 | Eb/G | Fm9 | Dbmaj7#11 | Gsus4 | G7b9 | Abmaj7 | Bb/D | Cm7 | Eb/Bb | Fm9 | Dbmaj7#11 | Gsus4:2 G7b9:2 | Cmadd9';
const CHORUS_CELLO = 'Ab3:2 C4:4 Eb4:4 | D4:2 F4:2 | Eb4:2 G4:4 Bb4:4 | Bb4:2. G4:4 | Ab4:2 G4:4 F4:4 | F4:2 Ab4:2 | C5:1 | B4:2 D5:4 F5:4';
const CHORUS_COUNTER = 'Eb5:2 r:8 C5:8 Eb5:8 G5:8 | F5:2 D5:2 | G4:2 Bb4:4 C5:4 | Bb4:8 C5:8 D5:8 Eb5:8 D5:4 Bb4:4 | Ab4:2 C5:4 Eb5:4 | F5:1 | C5:2 B4:4 D5:4 | Eb4:2 G4:2';

const BRIDGE_CH = 'C | C | Db | C | Bbm | Bbm | Db | C | C | C | Db | C | Bbm | C | Db | C';
const RIFF7 =
  'C4:8 Db4:8 E4:8 F4:8 G4:8 F4:8 E4:8 | G4:8 F4:8 E4:8 Db4:8 E4:8 Db4:8 C4:8 | Db4:8 F4:8 Ab4:8 F4:8 Db4:8 E4:8 F4:8 | E4:8 Db4:8 C4:8 E4:8 G4:8 F4:8 E4:8 | ' +
  'F4:8 Db4:8 Bb3:8 Db4:8 F4:8 E4:8 Db4:8 | Bb3:8 Db4:8 F4:8 Bb4:8 Ab4:8 G4:8 F4:8 | Ab4:8 F4:8 Db4:8 F4:8 E4:8 Db4:8 C4:8 | C4:8 E4:8 G4:8 C5:8 Bb4:8 Ab4:8 G4:8';
const REST7 = 'r:2. r:8';
const BRIDGE_DUDUK =
  `G4:4s Ab4:8 G4:8 F4:8 E4:4 | F4:8 G4:8 Ab4:4. G4:8 F4:8 | E4:8 F4:8 Ab4:4 Db5:4. | C5:4 Bb4:8 Ab4:8 G4:4. | ${REST7} | ${REST7} | ${REST7} | ${REST7} | ` +
  'C5:8 Db5:8 E5:8 F5:8 G5:4. | F5:8 E5:8 Db5:8 C5:8 Db5:4. | Db5:4 F5:8 Ab5:8 F5:4. | E5:8 F5:8 E5:8 Db5:8 C5:4. | ' +
  'F5:4.s Db5:8 Bb4:8 C5:8 Db5:8 | E5:4. F5:8 G5:8 Ab5:8 Bb5:8 | Ab5:8 G5:8 F5:8 E5:8 Db5:8 C5:8 Db5:8 | C5:2.* r:8';
const BRIDGE_ERHU =
  `${REST7} | ${REST7} | ${REST7} | ${REST7} | ` +
  'Bb4:4s C5:8 Db5:8 F5:4. | E5:8 F5:8 Db5:8 C5:8 Bb4:4. | Ab4:8 Bb4:8 C5:8 Db5:8 E5:8 F5:8 Ab5:8 | G5:2.f r:8 | ' +
  'E5:8 F5:8 G5:8 Ab5:8 Bb5:4. | Ab5:8 G5:8 F5:8 E5:8 F5:4. | F5:4 Ab5:8 Db6:8 Ab5:4. | G5:8 Ab5:8 G5:8 F5:8 E5:4. | ' +
  'F5:4.s Db5:8 Bb4:8 C5:8 Db5:8 | E5:4. F5:8 G5:8 Ab5:8 Bb5:8 | Ab5:8 G5:8 F5:8 E5:8 Db5:8 C5:8 Db5:8 | C5:2.* r:8';

const OUTRO =
  THEME_A +
  ' | Ab5:4. G5:8 F5:8 Eb5:8 D5:8 C5:8 | D5:4. Eb5:8 F5:8 Ab5:8 G5:8 F5:8 | G5:4. F5:8 E5:8 D5:8 B4:8 D5:8 | C5:1';
const OUTRO_CH = THEME_CH_A + ' | Fm/Ab | G7b9 | C | C';

// ---- builder --------------------------------------------------------------------------

export function buildScore() {
  const E = [];
  const put = (inst, notes, extra = {}) => {
    for (const n of notes) E.push(Object.assign(n, { inst }, extra));
    return notes;
  };
  const hit = (inst, t, v = 100, extra = {}) => E.push({ inst, t, d: 0.25, m: 60, v, ...extra });
  const M = (s, id, bar = 0, o = {}) => mel(s, at(id, bar), { name: `${id} bar ${bar}`, barLen: SEC[id].barLen, ...o });
  const C = (s, id, bar = 0) => chart(s, at(id, bar), { barLen: SEC[id].barLen });
  const vfn = (v) => (typeof v === 'function' ? v : () => v);
  const ramp = (t0, t1, v0, v1) => (t) => v0 + (v1 - v0) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));

  // lead helpers: resolve trills/mordents against a scale
  function lead(inst, notes, scale, extra = {}) {
    for (const n of notes) {
      if (n.trill) n.trillM = scaleUp(n.m, scale);
      if (n.mordent) n.grace = [n.m, scaleUp(n.m, scale)];
    }
    return put(inst, notes, extra);
  }
  // heterophony: add a player's own ornaments to long notes
  let orng = 12345;
  const orand = () => ((orng = (orng * 1103515245 + 12345) % 2147483648) / 2147483648);
  function ornament(notes, scale, p = 0.5) {
    return notes.map((n, i) => {
      const c = { ...n, t: n.t + (i > 0 ? (orand() - 0.3) * 0.06 : 0) };
      if (n.d >= 0.75 && !n.grace && orand() < p) {
        const r = orand();
        if (r < 0.4 && !(i > 0 && notes[i - 1].m === n.m)) c.slide = true;
        else if (r < 0.75) c.grace = [scaleUp(n.m, scale)];
        else c.mordent = true;
      }
      return c;
    });
  }
  const shift = (notes, semis, extra = {}) => notes.map((n) => ({ ...n, m: n.m + semis, grace: n.grace ? n.grace.map((g) => g + semis) : null, ...extra }));

  function pad(inst, ch, n, lo, hi, v, extra = {}) {
    const vf = vfn(v);
    let prev = null;
    const open = new Array(n).fill(null);
    const out = [];
    for (const seg of ch) {
      const vc = voice(seg.c, n, lo, hi, prev);
      prev = vc;
      vc.forEach((m, i) => {
        const o = open[i];
        if (o && o.m === m && Math.abs(o.t + o.d - seg.t) < 1e-6) {
          o.d += seg.d;
          o.v1 = vf(o.t + o.d);
        } else {
          const note = { t: seg.t, d: seg.d, m, v: vf(seg.t), v1: vf(seg.t + seg.d), voiceIdx: i, ...extra };
          out.push(note);
          open[i] = note;
        }
      });
    }
    return put(inst, out);
  }

  function choir(ch, v, vowel, { bass = true, lo = 57, hi = 77, parts = ['T', 'A', 'S'] } = {}) {
    const upper = pad('choir', ch, parts.length, lo, hi, v, { vowel });
    for (const nt of upper) nt.part = parts[nt.voiceIdx];
    if (bass) {
      const vf = vfn(v);
      for (const seg of ch) E.push({ inst: 'choir', part: 'B', t: seg.t, d: seg.d, m: pcAbove(seg.c.bass, 43), v: vf(seg.t), v1: vf(seg.t + seg.d), vowel });
    }
  }

  // Bass line as a legato string line (cellos + basses in octaves).
  function bassLine(ch, v, lo = 36, grp = 'basses') {
    const vf = vfn(v);
    const notes = [];
    for (const seg of ch) {
      const m = pcAbove(seg.c.bass, lo);
      const last = notes[notes.length - 1];
      if (last && last.m === m && Math.abs(last.t + last.d - seg.t) < 1e-6) last.d += seg.d;
      else notes.push({ t: seg.t, d: seg.d, m, v: vf(seg.t) });
    }
    put('sline', notes, { grp: grp + '-lo' });
    put('sline', notes.map((n) => ({ ...n, m: n.m + 12, v: n.v * 0.8 })), { grp: grp + '-hi' });
  }

  function ladder(c, lo) {
    const r = pcAbove(c.bass, lo);
    const out = [r];
    let cur = r;
    while (out.length < 14) {
      cur++;
      const pc = cur % 12;
      if (!c.pcs.includes(pc)) continue;
      if (cur < r + 12 && c.iv.length > 2 && pc === c.pcs[1] && c.iv[1] < 5) continue;
      out.push(cur);
    }
    return out;
  }

  function arp(inst, ch, pattern, lo, v, step = 0.5, extra = {}) {
    const vf = vfn(v);
    for (const seg of ch) {
      const lad = ladder(seg.c, lo);
      for (let k = 0; k * step < seg.d - 1e-6; k++) {
        const t = seg.t + k * step;
        const ex = typeof extra === 'function' ? extra(t) : extra;
        E.push({ inst, t, d: step, m: lad[pattern[k % pattern.length]], v: vf(t) * (k % 2 ? 0.82 : 1), ...ex });
      }
    }
  }

  // Repeated-note bass/sub pattern per 8th: x root, o octave, '.' rest.
  function pulse(inst, ch, pat, lo, v, dur = 0.42) {
    const vf = vfn(v);
    for (const seg of ch) {
      const steps = Math.round(seg.d / 0.5);
      for (let k = 0; k < steps; k++) {
        const c = pat[k % pat.length];
        if (c === '.') continue;
        const r = pcAbove(seg.c.bass, lo);
        E.push({ inst, t: seg.t + k * 0.5, d: dur, m: c === 'o' ? r + 12 : r, v: vf(seg.t + k * 0.5) });
      }
    }
  }

  // Syncopated string ostinato on a two-note voicing (3+3+2 accents).
  function ostinato(ch, lo, hi, v, pat = 'X..x..x.x..X..x.') {
    const vf = vfn(v);
    let prev = null;
    for (const seg of ch) {
      const vc = voice(seg.c, 3, lo, hi, prev);
      prev = vc;
      const steps = Math.round(seg.d / 0.25);
      for (let k = 0; k < steps; k++) {
        const c = pat[k % pat.length];
        if (c === '.') continue;
        const t = seg.t + k * 0.25;
        const acc = c === 'X' ? 1 : 0.72;
        for (const m of [vc[0], vc[2]]) E.push({ inst: 'spic', t, d: 0.22, m, v: vf(t) * acc });
      }
    }
  }

  const VEL = { X: 120, x: 98, o: 66, g: 40 };
  function drums(id, bar, pats, scale = 1) {
    const len = SEC[id].barLen;
    for (const [inst, p] of Object.entries(pats)) {
      const step = len / p.length;
      for (let i = 0; i < p.length; i++) {
        const c = p[i];
        if (c === '.' || c === ' ') continue;
        E.push({ inst, t: at(id, bar) + i * step, d: step, m: 60, v: VEL[c] * scale });
      }
    }
  }

  function roll(inst, t0, t1, rate, v0, v1, m = 60) {
    const k = inst === 'timp' ? 0.42 : 1;
    for (let t = t0; t < t1 - 1e-6; t += rate) {
      const u = (t - t0) / (t1 - t0);
      E.push({ inst, t, d: rate, m, v: (v0 + (v1 - v0) * u) * k });
    }
  }

  function breakAt(t0, t1, keep) {
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i];
      if (keep.includes(e.inst)) continue;
      if (e.t >= t0 - 1e-6 && e.t < t1 - 1e-6) E.splice(i, 1);
      else if (e.t < t0 && e.t + e.d > t0) {
        if (e.v1 !== undefined) e.v1 = e.v + (e.v1 - e.v) * ((t0 - e.t) / e.d);
        e.d = t0 - e.t;
      }
    }
  }

  function impact(t, root, v = 120) {
    hit('crash', t, v);
    hit('boom', t, v * 0.6);
    hit('taiko', t, v);
    E.push({ inst: 'timp', t, d: 1, m: pcAbove(root, 36), v: v * 0.8 });
  }

  const cutRamp = (t0, t1, c0, c1) => (t) => ({ cut: c0 * Math.pow(c1 / c0, Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))) });
  const ARP = [0, 2, 1, 3, 2, 4, 3, 5, 4, 3, 2, 4, 3, 2, 1, 2];

  // ---- the groove & orchestra for theme-like sections ----------------------------------
  function themeSection(id, bar0, bars, chStr, melStr, { big = 0, leadMode = 'theme' } = {}) {
    const ch = C(chStr, id, bar0);
    const m = M(melStr, id, bar0, { vel: 100 + big });
    lead('duduk', m, SCALES.cHarmonic);
    lead('erhu', ornament(m, SCALES.cHarmonic, 0.85).map((n) => ({ ...n, v: n.v * 0.8 })), SCALES.cHarmonic);
    put('cline', shift(m, -12, { v: 78 + big }), { grp: id + '-themeLow', voice: 'tenor', vowel: 'a' });
    if (big) put('cline', shift(m, 0, { v: 60 + big }), { grp: id + '-themeHigh', voice: 'soprano', vowel: 'a' });
    choir(ch, 62 + big, 'a');
    bassLine(ch, 88 + big);
    ostinato(ch, 55, 72, 84 + big);
    pad('strings', ch, 3, 67, 84, 58 + big, { o: { attack: 0.3 } });
    pad('horns', ch, 3, 53, 67, (t) => 58 + big + 18 * ((t % 8) / 8));
    for (const seg of ch) E.push({ inst: 'oud', t: seg.t, d: seg.d, m: voice(seg.c, 1, 62, 70)[0], v: 70 + big });
    arp('kanun', ch, [0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 6, 5, 4, 3], 48, 52, 0.25);
    arp('synth', ch, ARP, 48, 62 + big, 0.25, { cut: 3200 + big * 60 });
    pad('pad', ch, 4, 55, 79, 48 + big);
    pulse('sub', ch, 'x.x.x.x.', 24, 92);
    for (let b = 0; b < bars; b++) {
      const br = bar0 + b;
      const fill = b === bars - 1;
      drums(id, br, {
        kick: fill ? 'x.....x.x.......' : 'x.....x...x..x..',
        snare: fill ? '........X.xxXXXX' : '........X.......',
        ghost: '...g.......g..g.',
        hat: 'xoxoxoxoxoxoxoxo',
        clap: fill ? '................' : '........x.......',
        taiko: 'X..x..x.X.....x.',
        riq: 'gogxgogxgogxgogx',
        doum: 'x.......x.......',
        tek: '...x..x....x..x.',
      });
      E.push({ inst: 'timp', t: at(id, br), d: 1, m: pcAbove(ch[b].c.root, 36), v: 50 });
      if (b % 8 === 0) {
        hit('crash', at(id, br), 112);
        E.push({ inst: 'tbell', t: at(id, br), d: 4, m: midi('C4'), v: 80 });
      }
      if (b % 4 === 3 && !fill) hit('crash', at(id, br, 3.5), 60);
      if (fill) ['tomH', 'tomH', 'tomM', 'tomM', 'tomL', 'tomL', 'tomF', 'tomF'].forEach((tm, i) => hit(tm, at(id, br, 2 + i * 0.25), 92 + i * 3));
    }
    return ch;
  }

  function chorusSection(id, { big = 0 } = {}) {
    const ch = C(CHORUS_CH, id);
    const m = M(CHORUS, id, 0, { vel: 104 + big });
    lead('erhu', m, SCALES.cHarmonic);
    lead('duduk', ornament(shift(m, -12), SCALES.cHarmonic, 0.5).map((n) => ({ ...n, v: n.v * 0.68 })), SCALES.cHarmonic);
    put('cline', shift(m, -12, { v: 80 + big }), { grp: id + '-melLow', voice: 'alto', vowel: 'a' });
    put('cline', shift(m, 0, { v: 58 + big }).filter((n) => big || n.t >= at(id, 8)), { grp: id + '-melHigh', voice: 'soprano', vowel: 'a' });
    // counter-melodies
    put('sline', M(CHORUS_CELLO, id, 0, { vel: 90 + big }), { grp: id + '-cello', pan: 0.45 });
    put('sline', M(CHORUS_COUNTER, id, 8, { vel: 86 + big }), { grp: id + '-violas', pan: 0.15 });
    put('cline', M(CHORUS_COUNTER, id, 8, { vel: 78 + big }), { grp: id + '-counter', voice: 'alto', vowel: 'o' });
    put('horns', M(CHORUS_COUNTER, id, 8, { vel: 70 + big }).map((n) => ({ ...n, m: n.m - 12 })));
    if (big) put('flute', M(CHORUS_COUNTER, id, 8, { transpose: 12, vel: 70 }));
    choir(ch, 68 + big, 'a');
    bassLine(ch, 92 + big);
    ostinato(ch, 60, 77, 80 + big, 'X.xxX.xxX.xxX.x.');
    pad('strings', ch, 4, 67, 88, 66 + big, { o: { attack: 0.35 } });
    pad('horns', ch.slice(0, 8), 3, 53, 67, 70 + big);
    for (const seg of ch) E.push({ inst: 'oud', t: seg.t, d: seg.d, m: voice(seg.c, 1, 64, 72)[0], v: 72 + big });
    arp('kanun', ch, [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 3, 4, 5, 6, 7], 50, 55, 0.25);
    arp('piano', ch, [1, 2, 3, 4, 5, 4, 3, 2], 48, 50, 0.5, { o: { pedal: true } });
    arp('synth', ch, ARP, 48, 64 + big, 0.25, { cut: 4200 });
    pad('pad', ch, 4, 55, 81, 52 + big);
    pulse('sub', ch, 'x.x.x.xo', 24, 95);
    for (let b = 0; b < 16; b++) {
      const last = b === 15;
      drums(id, b, {
        kick: last ? 'x.....x.x.......' : 'x.....x.x.x...x.',
        snare: last ? '....X.......XXXX' : '....X.......X...',
        ghost: '..g.....g.g...g.',
        clap: last ? '................' : '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        ohat: '..x...x...x...x.',
        taiko: 'X.......x.x.....',
        riq: 'gogxgogxgogxgogx',
        tek: '..x.....x.....x.',
      });
      E.push({ inst: 'timp', t: at(id, b), d: 1, m: pcAbove(ch[b].c.root, 36), v: 52 });
      if (b % 4 === 0) {
        hit('crash', at(id, b), b === 0 ? 120 : 104);
        E.push({ inst: 'tbell', t: at(id, b), d: 4, m: pcAbove(ch[b].c.root, 60), v: 70 });
      }
      if (b % 4 === 0) hit('zill', at(id, b), 90);
      if (last) ['tomH', 'tomH', 'tomM', 'tomM', 'tomL', 'tomL', 'tomF', 'tomF'].forEach((tm, i) => hit(tm, at(id, b, 2 + i * 0.25), 96 + i * 3));
    }
    impact(at(id), ch[0].c.root, 118 + big * 0.5);
    return ch;
  }

  // ---- Prologue --------------------------------------------------------------------------
  {
    lead('duduk', M(PROLOGUE, 'prologue', 0, { vel: 84 }), SCALES.cHarmonic);
    E.push({ inst: 'water', t: 0, d: SEC.awaken.beat + 8, m: 60, v: 70 });
    E.push({ inst: 'bell', t: 0, d: 4, m: midi('C3'), v: 100 });
    E.push({ inst: 'bell', t: at('prologue', 3), d: 4, m: midi('C3'), v: 80 });
    const ch = C('C5 | C5 | C5 | C5 | C5 | Gsus4:2 G:2', 'prologue');
    choir(ch, ramp(0, at('prologue', 6), 30, 55), 'u', { bass: false, lo: 43, hi: 60, parts: ['B', 'T'] });
    bassLine(C('C5 | C5 | C5 | G', 'prologue', 2), ramp(at('prologue', 2), at('prologue', 6), 30, 60), 24);
    E.push({ inst: 'kanun', t: at('prologue', 5, 3), d: 0.1, m: midi('G3'), v: 50 });
    [0, 1, 2, 3, 4, 5, 6, 7].forEach((k) => E.push({ inst: 'kanun', t: at('prologue', 5, 3) + k * 0.0625, d: 0.1, m: [55, 56, 59, 60, 62, 63, 67, 68][k], v: 40 + k * 4 }));
  }

  // ---- Awakening ---------------------------------------------------------------------------
  {
    const id = 'awaken';
    const ch = C('Cm9 | Cm9 | Abmaj7/C | Abmaj7/C | Fm9/C | Fm9/C | Dbmaj7 | G7sus4:2 G7b9:2', id);
    lead('duduk', M('C5:1f | r:1 | r:1 | r:1 | r:1 | r:1 | r:1 | r:1', id, 0, { vel: 86 }), SCALES.cHarmonic);
    E.push({ inst: 'bell', t: at(id), d: 4, m: midi('C3'), v: 90 });
    arp('synth', ch, ARP, 48, ramp(at(id), at(id, 8), 45, 70), 0.25, cutRamp(at(id), at(id, 8), 260, 3200));
    arp('celesta', ch.slice(2), [4, 6, 5, 6, 4, 6, 5, 7], 60, 44, 0.5);
    choir(ch, ramp(at(id), at(id, 8), 30, 78), 'o');
    pad('pad', ch, 4, 55, 79, ramp(at(id), at(id, 8), 25, 55));
    pulse('sub', ch.slice(4), 'x...x...', 24, 88);
    pad('strings', ch.slice(4), 2, 79, 91, ramp(at(id, 4), at(id, 8), 30, 80), { o: { tremolo: 0.7, attack: 0.5 } });
    bassLine(ch, ramp(at(id), at(id, 8), 45, 85), 24);
    for (let b = 4; b < 8; b++) drums(id, b, { kick: b < 6 ? 'x.......x.......' : 'x...x...x...x...', riq: b >= 6 ? 'gogogogogogogogo' : '................' });
    drums(id, 7, { snare: '....o.o.x.x.xxxx', taiko: 'x.......x...x.x.' });
    roll('timp', at(id, 6), at(id, 8), 0.125, 30, 110, midi('G2'));
    E.push({ inst: 'riser', t: at(id, 4), d: 16, m: 60, v: 80 });
    hit('revcym', at('theme'), 110);
  }

  // ---- Theme -----------------------------------------------------------------------------
  impact(at('theme'), 0, 124);
  themeSection('theme', 0, 8, THEME_CH_A, THEME_A);
  themeSection('theme', 8, 8, THEME_CH_B, THEME_B);

  // ---- Verse -------------------------------------------------------------------------------
  {
    const id = 'verse';
    const ch = C(VERSE_CH, id);
    lead('erhu', M(VERSE, id, 0, { vel: 94 }), SCALES.cMinor);
    lead('flute', M(VERSE_FLUTE, id, 0, { vel: 80 }), SCALES.cMinor);
    put('sline', M(VERSE_CELLO, id, 8, { vel: 80 }), { grp: 'verse-cello', pan: 0.45 });
    arp('piano', ch, [0, 2, 3, 4, 5, 4, 3, 2], 36, (t) => (t < at(id, 8) ? 52 : 58), 0.5, { o: { pedal: true } });
    arp('celesta', ch, [5, 6, 7, 6], 60, 34, 1);
    pad('strings', ch, 3, 55, 72, (t) => (t < at(id, 8) ? 36 : 46), { o: { attack: 0.6 } });
    E.push({ inst: 'strings', t: at(id), d: 52, m: midi('G5'), v: 26, o: { attack: 2 } });
    choir(ch, 34, 'u', { bass: false, lo: 43, hi: 60, parts: ['B', 'T'] });
    pulse('pizz', ch, 'x...x...', 36, 80);
    arp('synth', ch, ARP, 48, 40, 0.25, { cut: 700 });
    pulse('sub', ch, 'x.......', 24, 52, 1.8);
    for (let b = 0; b < 16; b++) {
      drums(id, b, {
        frame: 'x.......x..o....',
        doum: b >= 4 ? 'x..........x....' : '................',
        tek: b >= 4 ? '....x..o....x...' : '................',
        riq: b >= 8 ? 'g.g.o.g.g.g.o.g.' : '................',
        shaker: 'ogogogogogogogog',
        kick: b >= 8 ? 'o.......o.......' : '................',
      }, 0.9);
      if (b % 4 === 0) hit('zill', at(id, b), 80);
    }
    E.push({ inst: 'bell', t: at(id, 8), d: 4, m: midi('C3'), v: 55 });
    hit('revcym', at('pre'), 80);
  }

  // ---- Pre-chorus --------------------------------------------------------------------------
  {
    const id = 'pre';
    const ch = C(PRE_CH, id);
    const m = M(PRE, id, 0, { vel: 100 });
    lead('duduk', m, SCALES.cHarmonic);
    put('cline', shift(m, -12, { v: 72 }).filter((n) => n.t >= at(id, 4)), { grp: 'pre-low', voice: 'tenor', vowel: 'a' });
    lead('erhu', ornament(m, SCALES.cHarmonic, 0.5).filter((n) => n.t >= at(id, 4)).map((n) => ({ ...n, v: n.v * 0.75 })), SCALES.cHarmonic);
    const cr = ramp(at(id), at(id, 7), 0, 1);
    choir(ch, (t) => 44 + 40 * cr(t), 'o');
    bassLine(ch, (t) => 70 + 25 * cr(t));
    ostinato(ch, 55, 72, (t) => 60 + 36 * cr(t), 'x.xxx.xxx.xxx.xx');
    pad('strings', ch, 4, 64, 86, (t) => 50 + 50 * cr(t), { o: { tremolo: 0.5 } });
    pad('horns', ch, 3, 53, 67, (t) => 45 + 45 * cr(t));
    arp('kanun', ch, [0, 1, 2, 3, 4, 5, 4, 3], 48, 50, 0.25);
    arp('synth', ch, ARP, 48, (t) => 50 + 20 * cr(t), 0.25, cutRamp(at(id), at(id, 7), 900, 6000));
    pad('pad', ch, 4, 55, 79, (t) => 40 + 20 * cr(t));
    pulse('sub', ch, 'x.x.x.x.', 24, 88);
    const chant4 = [];
    for (let b = 4; b < 8; b++) for (let k = 0; k < 8; k++) chant4.push({ t: at(id, b, k * 0.5), d: 0.4, m: [48, 55][k % 2], v: (k % 4 === 0 ? 96 : 70) * (0.7 + 0.3 * cr(at(id, b))) });
    put('chant', chant4, { voice: 'tenor' });
    for (let b = 0; b < 8; b++) {
      const p = { kick: b < 4 ? 'x.......x.......' : 'x...x...x...x...', riq: 'gogogogogogogogo', taiko: b >= 4 ? 'x...x...x...x...' : 'x.......x.......' };
      if (b >= 4) p.snare = '....x.......x...';
      if (b === 6) p.snare = 'o.o.o.o.x.x.x.x.';
      if (b === 7) {
        p.snare = 'xxxxXXXX........';
        p.kick = 'x...x...........';
        p.taiko = 'X.x.X.x.........';
      }
      drums(id, b, p);
    }
    roll('timp', at(id, 7), at(id, 7, 2), 0.125, 70, 115, midi('G2'));
    breakAt(at(id, 7, 2), at('chorus'), ['duduk', 'timp', 'kick', 'snare', 'taiko']);
    hit('crash', at(id, 7, 2), 112);
    E.push({ inst: 'riser', t: at(id, 6), d: 8, m: 60, v: 70 });
    hit('revcym', at('chorus'), 115);
  }

  // ---- Chorus ------------------------------------------------------------------------------
  chorusSection('chorus');

  // ---- Hijaz dance in 7/8 --------------------------------------------------------------------
  {
    const id = 'bridge';
    const ch = C(BRIDGE_CH, id);
    const riffB = RIFF7.split('|').map((b, i) => (i === 5 ? RIFF7.split('|')[3] : b)).join('|');
    const riff = M(RIFF7 + ' | ' + riffB, id, 0, { vel: 92 });
    put('oud', riff.map((n) => ({ ...n, o: { single: true } })));
    put('kanun', shift(riff, 12, { v: 70 }));
    put('pizz', shift(riff, -12, { v: 58 }));
    lead('duduk', M(BRIDGE_DUDUK, id, 0, { vel: 100 }), SCALES.cHijaz);
    lead('erhu', M(BRIDGE_ERHU, id, 0, { vel: 94 }), SCALES.cHijaz);
    lead('flute', M(BRIDGE_DUDUK, id, 0, { vel: 74, transpose: 12 }).filter((n) => n.t >= at(id, 12)), SCALES.cHijaz);
    put('cline', M(BRIDGE_DUDUK, id, 0, { vel: 76, transpose: -12 }).filter((n) => n.t >= at(id, 12)), { grp: 'bridge-low', voice: 'tenor', vowel: 'a' });
    E.push({ inst: 'sline', grp: 'bridge-drone-lo', t: at(id), d: 56, m: midi('C2'), v: 70 });
    E.push({ inst: 'sline', grp: 'bridge-drone-hi', t: at(id), d: 56, m: midi('G2'), v: 60 });
    choir(ch.slice(8), 60, 'a', { lo: 55, hi: 72 });
    pad('strings', ch.slice(12), 3, 72, 88, ramp(at(id, 12), at(id, 16), 50, 95), { o: { tremolo: 0.8 } });
    pad('horns', ch.slice(8), 3, 53, 67, 62);
    const chantN = [];
    for (let b = 0; b < 16; b++) {
      for (const [k, v] of [[0, 100], [2, 80], [4, 90]]) chantN.push({ t: at(id, b, k * 0.5), d: 0.4, m: [48, 55][k % 4 === 0 ? 0 : 1], v: b < 8 ? v * 0.75 : v });
      if (b >= 8) chantN.push({ t: at(id, b, 3), d: 0.4, m: 55, v: 70 });
    }
    put('chant', chantN, { voice: 'tenor' });
    for (const seg of ch) E.push({ inst: 'sub', t: seg.t, d: 1.9, m: pcAbove(seg.c.root, 24), v: 90 });
    for (const seg of ch) for (const k of [0, 4]) E.push({ inst: 'synth', t: seg.t + k * 0.5, d: 0.3, m: pcAbove(seg.c.root, 48) + (k ? 7 : 0), v: 58, cut: 2500 });
    for (let b = 0; b < 16; b++) {
      const late = b >= 8;
      drums(id, b, {
        doum: 'x.......x.....',
        tek: '....x.....x.x.',
        ka: '..o...o....o.o',
        riq: 'xogoxogoxogogo',
        clap: late ? 'x...x...x.....' : '..............',
        kick: 'x.......x.....',
        snare: late ? '....X.........' : '..............',
        hat: late ? 'x.x.x.x.x.x.x.' : '..............',
        taiko: b >= 12 ? 'X...x...x.x.x.' : 'x.............',
        frame: 'x.......x.....',
      });
      if (b % 4 === 0) hit('zill', at(id, b), 95);
      if (b % 8 === 0) hit('crash', at(id, b), 100);
    }
    roll('snare', at(id, 15), at(id, 16), 0.125, 50, 115);
  }

  // ---- Half-time choir -------------------------------------------------------------------------
  {
    const id = 'halftime';
    const ch = C('Ab | Bb | Db | G7sus4:2 G7b9:2', id);
    impact(at(id), 8, 124);
    choir(ch, 100, 'a');
    put('cline', M('Ab5:1 | G5:2 F5:2 | Ab5:2 C6:2 | C6:2 B5:2', id, 0, { vel: 86 }), { grp: 'ht-sop', voice: 'soprano', vowel: 'a' });
    put('cline', M('C5:1 | D5:2 D5:2 | F5:2 Ab5:2 | G5:2 F5:2', id, 0, { vel: 78 }), { grp: 'ht-alto', voice: 'alto', vowel: 'a' });
    pad('strings', ch, 4, 64, 88, 96, { o: { attack: 0.2 } });
    pad('horns', ch, 4, 50, 70, 100);
    bassLine(ch, 105);
    pulse('sub', ch, 'x.......', 24, 100, 1.9);
    for (let b = 0; b < 4; b++) {
      drums(id, b, { kick: 'x.....x.........', snare: '........X.......', taiko: 'X.....x.X.......', hat: 'x.x.x.x.x.x.x.x.' });
      hit('crash', at(id, b), 108);
      E.push({ inst: 'timp', t: at(id, b), d: 1, m: pcAbove(ch[Math.min(b, ch.length - 1)].c.root, 36), v: 90 });
    }
    E.push({ inst: 'tbell', t: at(id), d: 4, m: midi('Ab3'), v: 90 });
    E.push({ inst: 'tbell', t: at(id, 2), d: 4, m: midi('Db4'), v: 90 });
    ['tomH', 'tomM', 'tomL', 'tomF'].forEach((tm, i) => hit(tm, at(id, 3, 3 + i * 0.25), 105));
  }

  // ---- Underwater breakdown ---------------------------------------------------------------------
  {
    const id = 'breakdown';
    const ch = C(THEME_CH_A, id);
    E.push({ inst: 'water', t: at(id), d: 34, m: 60, v: 55 });
    E.push({ inst: 'bell', t: at(id), d: 4, m: midi('C3'), v: 95 });
    E.push({ inst: 'bell', t: at(id, 4), d: 4, m: midi('C3'), v: 75 });
    lead('flute', M(THEME_A, id, 0, { vel: 80 }).filter((n) => n.t < at(id, 6)), SCALES.cHarmonic);
    arp('piano', ch, [0, 2, 3, 4, 5, 4, 3, 2], 36, 48, 0.5, { o: { pedal: true } });
    arp('celesta', ch, [4, 5, 6, 5], 60, 36, 1);
    choir(ch, ramp(at(id), at(id, 8), 26, 56), 'u', { bass: false, lo: 55, hi: 74 });
    // the groove keeps going, filtered as if heard from under the sea
    arp('synth', ch, ARP, 48, 60, 0.25, { cut: 3000 });
    pulse('sub', ch, 'x.x.x.x.', 24, 90);
    pad('pad', ch, 4, 55, 79, 55);
    for (let b = 0; b < 8; b++) drums(id, b, { kick: 'x...x...x...x...', hat: b >= 4 ? '..x...x...x...x.' : '................' }, 0.6);
    pad('strings', C('Dbmaj7 | G7b9', id, 6), 4, 60, 84, ramp(at(id, 6), at(id, 8), 45, 110), { o: { tremolo: 0.8 } });
    bassLine(C('Dbmaj7 | G7b9', id, 6), ramp(at(id, 6), at(id, 8), 50, 100));
    roll('snare', at(id, 6), at(id, 7), 0.25, 30, 70);
    roll('snare', at(id, 7), at(id, 8), 0.125, 70, 118);
    roll('timp', at(id, 7), at(id, 8), 0.125, 50, 118, midi('G2'));
    E.push({ inst: 'riser', t: at(id, 6), d: 8, m: 60, v: 95 });
    ['tomH', 'tomM', 'tomL', 'tomF'].forEach((tm, i) => hit(tm, at(id, 7, 3 + i * 0.25), 108));
    hit('revcym', at('final'), 122);
  }

  // ---- Final chorus -------------------------------------------------------------------------------
  chorusSection('final', { big: 10 });

  // ---- Outro --------------------------------------------------------------------------------------
  {
    const id = 'outro';
    const ch = C(OUTRO_CH, id);
    impact(at(id), 0, 124);
    const m = M(OUTRO, id, 0, { vel: 110 });
    m[m.length - 1].d = 3;
    lead('duduk', m, SCALES.cHarmonic);
    lead('erhu', ornament(m, SCALES.cHarmonic, 0.5).map((n) => ({ ...n, v: n.v * 0.8 })), SCALES.cHarmonic);
    put('cline', shift(m, -12, { v: 86 }), { grp: 'outro-low', voice: 'tenor', vowel: 'a' });
    put('cline', shift(m, 0, { v: 66 }), { grp: 'outro-high', voice: 'soprano', vowel: 'a' });
    const band = ch.slice(0, 11);
    choir(band, 76, 'a');
    bassLine(band, 96);
    ostinato(band, 55, 72, 92);
    pad('strings', band, 3, 67, 84, 70);
    pad('horns', band, 3, 53, 67, 76);
    for (const seg of band) E.push({ inst: 'oud', t: seg.t, d: seg.d, m: voice(seg.c, 1, 62, 70)[0], v: 78 });
    arp('kanun', band, [0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 6, 5, 4, 3], 48, 55, 0.25);
    arp('synth', band, ARP, 48, 66, 0.25, { cut: 4000 });
    pad('pad', band, 4, 55, 79, 56);
    pulse('sub', band, 'x.x.x.x.', 24, 95);
    for (let b = 0; b < 11; b++) {
      const fill = b === 10;
      drums(id, b, {
        kick: fill ? 'x.......x.x.x.x.' : 'x.....x...x..x..',
        snare: fill ? '....x...xxxxXXXX' : '........X.......',
        ghost: '...g.......g..g.',
        hat: 'xoxoxoxoxoxoxoxo',
        taiko: fill ? 'X...X...X.X.XXXX' : 'X..x..x.X.....x.',
        riq: 'gogxgogxgogxgogx',
      });
      E.push({ inst: 'timp', t: at(id, b), d: 1, m: pcAbove(ch[b].c.root, 36), v: 55 });
      if (b % 4 === 0) hit('crash', at(id, b), 110);
    }
    // final Picardy chord on C major
    const t = at(id, 11);
    const endCh = [{ t, d: 4, c: ch[11].c }];
    impact(t, 0, 127);
    choir(endCh, 105, 'a');
    pad('strings', endCh, 5, 55, 88, 100, { o: { release: 2.5 } });
    pad('horns', endCh, 4, 48, 67, 100, { o: { release: 1.5 } });
    bassLine(endCh, 108);
    E.push({ inst: 'sub', t, d: 3, m: midi('C1'), v: 100 });
    E.push({ inst: 'oud', t, d: 3, m: midi('E4'), v: 80 });
    E.push({ inst: 'bell', t, d: 4, m: midi('C3'), v: 110 });
    E.push({ inst: 'tbell', t, d: 4, m: midi('C4'), v: 100 });
    roll('timp', t + 0.5, t + 3.5, 0.125, 90, 40, midi('C2'));
    hit('zill', t, 100);
  }

  // ---- Coda: the bell under the water -----------------------------------------------------------------
  {
    const id = 'coda';
    E.push({ inst: 'water', t: at('outro', 11), d: 20, m: 60, v: 60 });
    choir(C('C | C | C', id), (t) => 40 - 12 * ((t - at(id)) / 12), 'u', { bass: false, lo: 43, hi: 64, parts: ['B', 'T', 'A'] });
    E.push({ inst: 'bell', t: at(id, 1), d: 4, m: midi('C3'), v: 70 });
  }

  return E;
}
