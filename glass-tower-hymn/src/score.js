// The composition: "Hymn of the Glass Tower" (硝子の塔の讃歌).
// D minor, 150 bpm, final chorus modulates up to E minor.
//
// Form (bars):
//   0  Intro      music box states the theme over a hushed choir
//   8  Riff       orchestral hit, 16th-note string ostinato, theme on violin + choir
//   16 Verse      low whistle over harp, darbuka and pizzicato
//   32 Pre        violin, rising strings, build and break
//   40 Chorus     full orchestra, choir, harpsichord, rock kit
//   56 Riff       theme again
//   64 Solo       santur in A Phrygian dominant over a drone
//   72 Breakdown  music box + piano, violin rejoins, snare/timpani build
//   80 Chorus     up a whole step to E minor, extended ending
//   100 Outro     riff in E minor, final hit
//   108 Coda      music box alone, ritardando

import { mel, chart, voice, pcAbove, midi } from './theory.js';

export const TEMPO = [
  { bar: 0, bpm: 150 },
  { bar: 108, bpm: 150 },
  { bar: 112, bpm: 96 },
];
export const END_BAR = 113;

export const SECTIONS = [
  { bar: 0, name: 'Intro' },
  { bar: 8, name: 'Riff' },
  { bar: 16, name: 'Verse' },
  { bar: 32, name: 'Pre-chorus' },
  { bar: 40, name: 'Chorus' },
  { bar: 56, name: 'Riff' },
  { bar: 64, name: 'Santur solo' },
  { bar: 72, name: 'Breakdown' },
  { bar: 80, name: 'Final chorus' },
  { bar: 100, name: 'Outro' },
  { bar: 108, name: 'Coda' },
];

const B = (bar) => bar * 4;

// ---- melodies -----------------------------------------------------------------

const THEME =
  'D5:4. E5:8 F5:4 A5:4 | G5:4. F5:8 D5:2 | E5:4. F5:8 G5:4 E5:4 | C#5:4 D5:8 E5:8 A4:2 | ' +
  'D5:4. E5:8 F5:4 D6:4 | C6:4. Bb5:8 A5:4 G5:4 | A5:4 G5:8 F5:8 E5:4 C#5:4 | D5:1';
const THEME_CH = 'Dm | Bb | C | A | Dm | Gm | A | Dm';

const VERSE =
  'r:8 A4:8 D5:8 E5:8 (G5)F5:4 E5:8 D5:8 | E5:4. D5:8 A4:2 | r:8 A4:8 D5:8 E5:8 F5:4 G5:8 F5:8 | F5:4 D5:8 C5:8 D5:2 | ' +
  'r:8 G4:8 Bb4:8 D5:8 (A5)G5:4. F5:8 | F5:8 E5:8 D5:8 C5:8 D5:2 | C#5:4. D5:8 E5:4 G5:4 | F5:8 E5:8 D5:8 C#5:8 E5:2* | ' +
  'r:8 A4:8 D5:8 E5:8 (G5)F5:4 E5:8 D5:8 | (Bb5)A5:4. G5:8 F5:4 E5:4 | D5:4. F5:8 Bb5:4 A5:8 G5:8 | G5:4. E5:8 C5:2 | ' +
  'r:8 C5:8 F5:8 G5:8 A5:4 G5:8 F5:8 | G5:4. D5:8 Bb4:2 | Bb4:4 Eb5:4 G5:4 F5:8 Eb5:8 | C#5:4 Bb4:8 C#5:8 E5:2';
const VERSE_CH = 'Dm | Dm | Bb | Bb | Gm | Gm | A | A | Dm | Dm | Bb | C | F | Gm | Eb | A';

const PRE =
  'r:8 D5:8 F5:8 Bb5:4. A5:8 G5:8 | G5:4. E5:8 C5:2 | r:8 C5:8 E5:8 A5:4. G5:8 E5:8 | F5:4. E5:8 D5:2 | ' +
  'r:8 D5:8 G5:8 Bb5:4. A5:8 G5:8 | C6:4. Bb5:8 A5:8 G5:8 E5:4 | D6:2 E6:4 D6:4 | C#6:2.* r:4';
const PRE_CH = 'Bb | C | Am | Dm | Gm | C | Asus4 | A';

const CHORUS =
  'r:8 F5:8 Bb5:8 C6:8 D6:4. C6:8~ | C6:4 Bb5:8 A5:8 G5:4. E5:8 | E5:4 A5:4 G5:8 A5:8 C6:4 | A5:4. F5:8 D5:2 | ' +
  'r:8 F5:8 Bb5:8 C6:8 D6:4. D6:8 | E6:4. D6:8 C6:4 G5:4 | Bb5:4. A5:8 G5:4 D5:4 | A5:2 G5:8 F5:8 E5:4 | ' +
  'r:8 F5:8 Bb5:8 C6:8 D6:4. C6:8~ | C6:4 Bb5:8 A5:8 G5:4. E5:8 | E5:4 A5:4 C6:4 E6:4 | (G6)F6:4. E6:8 D6:2 | ' +
  'D6:4. C6:8 Bb5:4 G5:4 | C#6:4. D6:8 E6:4 C#6:8 A5:8 | D6:1~ | D6:2 r:2';
const CHORUS_CH = 'Bb | C | Am | Dm | Bb | C | Gm | A | Bb | C | Am | Dm | Gm | A | Dm | Dm';

const EXT = 'r:8 G5:8 C6:8 D6:8 E6:4. D6:8~ | D6:4 C6:8 B5:8 A5:4. F#5:8 | F#6:4. E6:8 D#6:2 | E6:1';
const EXT_CH = 'C | D | Bsus4:2 B:2 | Em';

const SOLO =
  'A4:16 Bb4 C#5 D5 E5 D5 C#5 Bb4 A4 Bb4 C#5 E5 A5 G5 F5 E5 | ' +
  'F5:16 E5 D5 C#5 D5 Bb4 F4 Bb4 D5 F5 Bb5 A5 G5 F5 E5 D5 | ' +
  'C#5:16 D5 E5 F5 E5 D5 C#5 Bb4 C#5 A4 Bb4 C#5 E5 F5 G5 A5 | ' +
  'Bb5:16 A5 G5 F5 G5 F5 E5 D5 F5 E5 D5 C#5 D5 Bb4 A4 Bb4 | ' +
  'G5:8 D5:8 Bb4:8 D5:16 G5:16 Bb5:8 A5:16 G5:16 F5:8 E5:16 D5:16 | ' +
  'E5:8 C#5:16 D5:16 E5:8 A5:8 G5:16 F5:16 E5:16 D5:16 C#5:8 Bb4:8 | ' +
  'D5:16 F5 Bb5 D6 C#6 D6 Bb5 F5 D5 F5 E5 D5 C#5 Bb4 A4 G4 | ' +
  'A4:8 C#5:8 E5:8 A5:8 C#6:8 E6:8 A6:4';
const SOLO_CH = 'A | Bb | A | Bb | Gm | A | Bb | A';

const BREAK_CH = 'Dm | Bb | C | A | Dm | Gm | Am | B7sus4:2 B7:2';

// 16th-note ostinato figures per chord (written at violin pitch).
const RIFF = {
  Dm: 'D5:16 A4 F4 A4 D5 A4 F4 A4 E5 A4 F4 A4 F5 A4 F4 A4',
  Bb: 'F5:16 D5 Bb4 D5 F5 D5 Bb4 D5 G5 D5 Bb4 D5 F5 D5 Bb4 D5',
  C: 'E5:16 C5 G4 C5 E5 C5 G4 C5 F5 C5 G4 C5 G5 C5 G4 C5',
  A: 'E5:16 C#5 A4 C#5 E5 C#5 A4 C#5 F5 C#5 A4 C#5 E5 C#5 A4 C#5',
  Gm: 'G5:16 D5 Bb4 D5 G5 D5 Bb4 D5 A5 D5 Bb4 D5 Bb5 D5 Bb4 D5',
};

// ---- helpers ------------------------------------------------------------------

export function buildScore() {
  const E = [];
  // Adds notes to the score in place (so callers can keep tweaking them).
  const put = (inst, notes, extra = {}) => {
    for (const n of notes) E.push(Object.assign(n, { inst }, extra));
    return notes;
  };
  const hit = (inst, t, v = 100, extra = {}) => E.push({ inst, t, d: 0.25, m: 60, v, ...extra });
  const M = (s, bar, o = {}) => mel(s, B(bar), { name: `bar ${bar}`, ...o });
  const C = (s, bar, tr = 0) => chart(s, B(bar), { transpose: tr });

  // Sustained voicings with smooth voice leading; ties repeated pitches.
  // v may be a number or a function of beat time.
  function pad(inst, ch, n, lo, hi, v, extra = {}) {
    const vf = typeof v === 'function' ? v : () => v;
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

  // Choir: bass part on the root, three upper parts voiced closely.
  function choir(ch, v, vowel, { bass = true, lo = 57, hi = 76, parts = ['T', 'A', 'S'] } = {}) {
    const upper = pad('choir', ch, parts.length, lo, hi, v, { vowel });
    for (const nt of upper) nt.part = parts[nt.voiceIdx];
    if (bass) {
      for (const seg of ch) {
        const vf = typeof v === 'function' ? v : () => v;
        E.push({ inst: 'choir', part: 'B', t: seg.t, d: seg.d, m: pcAbove(seg.c.bass, 43), v: vf(seg.t), v1: vf(seg.t + seg.d), vowel });
      }
    }
  }

  // Low strings: root in two octaves.
  function lowStrings(ch, v, lo = 36, extra = {}) {
    const vf = typeof v === 'function' ? v : () => v;
    for (const seg of ch) {
      const r = pcAbove(seg.c.bass, lo);
      for (const m of [r, r + 12]) E.push({ inst: 'lowstr', t: seg.t, d: seg.d, m, v: vf(seg.t), v1: vf(seg.t + seg.d), ...extra });
    }
  }

  // Ascending chord-tone ladder from the bass (open voicing).
  function ladder(c, lo) {
    const r = pcAbove(c.bass, lo);
    const out = [r];
    let cur = r;
    while (out.length < 12) {
      cur++;
      const pc = cur % 12;
      if (!c.pcs.includes(pc)) continue;
      if (cur < r + 12 && c.iv.length > 2 && pc === c.pcs[1] && c.iv[1] < 5) continue;
      out.push(cur);
    }
    return out;
  }

  function arp(inst, ch, pattern, lo, v, step = 0.5, extra = {}) {
    const vf = typeof v === 'function' ? v : () => v;
    for (const seg of ch) {
      const lad = ladder(seg.c, lo);
      for (let k = 0; k * step < seg.d - 1e-6; k++) {
        const t = seg.t + k * step;
        E.push({ inst, t, d: step, m: lad[pattern[k % pattern.length]], v: vf(t) * (k % 2 ? 0.85 : 1), ...extra });
      }
    }
  }

  // Bass pattern per bar in 8ths: x root, o octave, f fifth, '.' rest.
  function bassline(inst, ch, pat, lo, v, extra = {}) {
    for (const seg of ch) {
      const steps = Math.round(seg.d / 0.5);
      const off = Math.round((seg.t % 4) / 0.5);
      for (let k = 0; k < steps; k++) {
        const c = pat[(k + off) % pat.length];
        if (c === '.') continue;
        const r = pcAbove(seg.c.bass, lo);
        const m = c === 'o' ? r + 12 : c === 'f' ? r + 7 : r;
        E.push({ inst, t: seg.t + k * 0.5, d: 0.45, m, v: v * (k % 2 ? 0.85 : 1), ...extra });
      }
    }
  }

  function chug(ch, lo, hi, v) {
    const vf = typeof v === 'function' ? v : () => v;
    let prev = null;
    for (const seg of ch) {
      const vc = voice(seg.c, 3, lo, hi, prev);
      prev = vc;
      for (let t = seg.t; t < seg.t + seg.d - 1e-6; t += 0.5) {
        const acc = Math.abs((t % 1)) < 1e-6 ? 1 : 0.8;
        for (const m of vc) E.push({ inst: 'spic', t, d: 0.4, m, v: vf(t) * acc });
      }
    }
  }

  const VEL = { X: 118, x: 96, o: 62, g: 40 };
  function drums(bar, pats, scale = 1) {
    for (const [inst, p] of Object.entries(pats)) {
      const step = 4 / p.length;
      for (let i = 0; i < p.length; i++) {
        const c = p[i];
        if (c === '.' || c === ' ') continue;
        E.push({ inst, t: B(bar) + i * step, d: step, m: 60, v: VEL[c] * scale });
      }
    }
  }

  // Rolls: strokes overlap and ring, so timpani strokes are played much softer.
  function roll(inst, t0, t1, rate, v0, v1, m = 60, extra = {}) {
    const k = inst === 'timp' ? 0.42 : 1;
    for (let t = t0; t < t1 - 1e-6; t += rate) {
      const u = (t - t0) / (t1 - t0);
      E.push({ inst, t, d: rate, m, v: (v0 + (v1 - v0) * u) * k, ...extra });
    }
  }

  // Silence everything except `keep` between t0 and t1 (a band "break").
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

  const ramp = (t0, t1, v0, v1) => (t) => v0 + (v1 - v0) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));

  // ---- big hit ------------------------------------------------------------------
  function impact(t, rootMidi, v = 120) {
    hit('crash', t, v);
    hit('boom', t, v * 0.6);
    hit('taiko', t, v);
    E.push({ inst: 'timp', t, d: 1, m: rootMidi, v });
  }

  // ---- sections -------------------------------------------------------------------

  function riff(bar, tr, { final = false, lead = true } = {}) {
    const ch = C(THEME_CH, bar, tr);
    impact(B(bar), pcAbove((ch[0].c.root), 38), 122);
    // ostinato
    for (let b = 0; b < 8; b++) {
      if (final && b === 7) break;
      const sym = THEME_CH.split('|')[b].trim();
      const notes = M(RIFF[sym], bar + b, { transpose: tr });
      notes.forEach((n, i) => {
        n.v = i % 4 === 0 ? 100 : 78;
      });
      put('spic', notes.map((n) => ({ ...n, m: n.m - 12 })));
      put('harpsi', notes.map((n) => ({ ...n, v: n.v * 0.75 })));
    }
    if (lead) {
      const th = M(THEME, bar, { transpose: tr, vel: 108 });
      if (final) {
        th[th.length - 1].d = 2;
      }
      put('violin', th);
      put('vox', th.map((n) => ({ ...n, m: n.m - 12, v: 80 })));
      put('glock', th.filter((n) => n.d >= 1).map((n) => ({ ...n, m: n.m + 12, v: 48 })));
    }
    const chP = final ? ch.slice(0, 7) : ch;
    choir(chP, 78, 'a');
    lowStrings(chP, 85);
    pad('brass', chP, 3, 50 + tr, 67 + tr, 72);
    pad('strings', chP, 4, 62 + tr, 81 + tr, 62);
    bassline('bass', chP, 'xxxxxxxo', 33, 92);
    for (let b = 0; b < 8; b++) {
      const br = bar + b;
      if (final && b === 7) break;
      const fillBar = final ? 6 : 7;
      drums(br, {
        kick: 'x.....x.x.....x.',
        snare: b === fillBar ? '....x.......xxxx' : '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        taiko: b % 2 === 0 ? 'x.......o.o.....' : 'x...............',
      });
      E.push({ inst: 'timp', t: B(br), d: 1, m: pcAbove(ch[b].c.root, 38), v: 66 });
      if (b === 4) hit('crash', B(br), 105);
      if (b === fillBar) {
        ['tomH', 'tomH', 'tomM', 'tomM', 'tomL', 'tomL', 'tomF', 'tomF'].forEach((tm, i) => hit(tm, B(br) + 2 + i * 0.25, 90 + i * 3));
      }
    }
    if (final) {
      // final hit on the last bar
      const t = B(bar + 7);
      const root = ch[7].c.root;
      impact(t, pcAbove(root, 38), 127);
      const endCh = [{ t, d: 2.5, c: ch[7].c }];
      choir(endCh, 100, 'a');
      lowStrings(endCh, 110);
      pad('brass', endCh, 4, 50 + tr, 70 + tr, 100);
      pad('strings', endCh, 5, 55 + tr, 86 + tr, 100);
      E.push({ inst: 'bass', t, d: 2.5, m: pcAbove(root, 33), v: 110 });
      roll('timp', t + 0.5, t + 2.5, 0.125, 70, 105, pcAbove(root, 38));
      hit('crash', t + 2.5, 70);
    }
  }

  function chorus(bar, tr, { big = 0 } = {}) {
    const ch = C(CHORUS_CH, bar, tr);
    const mel_ = M(CHORUS, bar, { transpose: tr, vel: 104 + big });
    put('violin', mel_);
    put('vox', mel_.map((n) => ({ ...n, m: n.m - 12, v: 82 + big })));
    put('glock', mel_.filter((n) => (big ? true : n.t >= B(bar + 8))).map((n) => ({ ...n, m: n.m + 12, v: 44 })));
    if (big) put('whistle', mel_.filter((n) => n.t >= B(bar + 8)).map((n) => ({ ...n, m: n.m + 12, v: 70 })));
    choir(ch, 72 + big, 'a');
    pad('strings', ch, 4, 62 + tr, 84 + tr, 74 + big);
    lowStrings(ch, 82 + big);
    chug(ch, 48 + tr, 64 + tr, 70 + big);
    pad('brass', ch, 3, 50 + tr, 67 + tr, 70 + big);
    arp('harpsi', ch, [1, 2, 3, 4, 5, 4, 3, 2], 48 + tr, 72);
    bassline('bass', ch, 'xxxxxxxo', 33, 92);
    for (let b = 0; b < 16; b++) {
      const br = bar + b;
      const last = b === 15;
      drums(br, {
        kick: last ? 'x.....x.x.......' : 'x.....x.x.....x.',
        snare: last ? '....x.......xxxx' : b === 7 ? '....x.......x.xx' : '....x.......x...',
        hat: 'x.x.x.x.x.x.x.x.',
        ohat: '..............x.',
      });
      E.push({ inst: 'timp', t: B(br), d: 1, m: pcAbove(ch[b].c.root, 38), v: 56 });
      if (b % 4 === 0) {
        hit('crash', B(br), b === 0 ? 118 : 100);
        hit('taiko', B(br), 100);
      }
      if (last) ['tomH', 'tomH', 'tomM', 'tomM', 'tomL', 'tomL', 'tomF', 'tomF'].forEach((tm, i) => hit(tm, B(br) + 2 + i * 0.25, 92 + i * 3));
    }
    hit('boom', B(bar), 110);
  }

  // ---- Intro (0-7) ----------------------------------------------------------------
  {
    const th = M(THEME, 0, { vel: 92 });
    th[th.length - 1].d = 2;
    put('musicbox', th.map((n) => ({ ...n, m: n.m + 12 })));
    const ch = C('Dm | Bb | C | A | Dm | Gm | A | Dm:2 A:2', 0);
    for (const seg of ch.slice(0, 8)) {
      const lad = ladder(seg.c, 50);
      [lad[0], lad[1], lad[3], lad[1]].forEach((m, i) => {
        if (seg.t + i < B(7) + 2) E.push({ inst: 'musicbox', t: seg.t + i, d: 1, m, v: i === 0 ? 62 : 48 });
      });
    }
    choir(ch, ramp(0, B(8), 28, 62), 'u', { bass: false, lo: 50, hi: 72 });
    lowStrings(ch.slice(4), ramp(B(4), B(8), 30, 95));
    pad('strings', C('Dm | Gm | A | Dm:2 A:2', 4), 4, 55, 76, ramp(B(4), B(8), 25, 100), { o: { attack: 0.6 } });
    E.push({ inst: 'strings', t: B(7) + 2, d: 2, m: midi('A5'), v: 60, v1: 105, o: { tremolo: 1 } });
    E.push({ inst: 'strings', t: B(7) + 2, d: 2, m: midi('C#6'), v: 60, v1: 105, o: { tremolo: 1 } });
    arp('harp', C('Dm | Gm | A | Dm', 4), [0, 1, 2, 3, 4, 3, 2, 1], 43, 58);
    roll('timp', B(7) + 2, B(8), 0.125, 30, 110, midi('A2'));
    E.push({ inst: 'riser', t: B(6), d: 8, m: 60, v: 80 });
    hit('revcym', B(8), 100);
  }

  // ---- Riff (8-15) ------------------------------------------------------------------
  riff(8, 0);

  // ---- Verse (16-31) ----------------------------------------------------------------
  {
    const ch = C(VERSE_CH, 16);
    put('whistle', M(VERSE, 16, { vel: 96 }));
    arp('harp', ch, [0, 1, 2, 3, 4, 3, 2, 1], 43, 70);
    bassline('pizz', ch, 'x...f...', 36, 84);
    pad('strings', ch, 3, 50, 67, (t) => (t < B(24) ? 40 : 52), { o: { attack: 0.5 } });
    pad('piano', C('Dm | Dm | Bb | C | F | Gm | Eb | A', 24), 3, 55, 72, 50, { o: { pedal: true } });
    for (const seg of C('Dm | Dm | Bb | C | F | Gm | Eb | A', 24)) E.push({ inst: 'piano', t: seg.t, d: seg.d, m: pcAbove(seg.c.bass, 36), v: 55, o: { pedal: true } });
    for (let b = 16; b < 32; b++) {
      drums(b, {
        doum: 'x.......x.......',
        tek: '..x...x.....x...',
        ka: b >= 20 ? '..........o...o.' : '..............o.',
        shaker: b >= 20 ? 'oggoogogoggoogog' : '................',
        kick: b >= 24 ? 'o.......o.......' : '................',
        frame: b % 2 === 0 ? 'x...............' : '................',
      });
    }
    hit('revcym', B(32), 80);
  }

  // ---- Pre-chorus (32-39) -------------------------------------------------------------
  {
    const ch = C(PRE_CH, 32);
    put('violin', M(PRE, 32, { vel: 98 }));
    pad('strings', ch, 4, 57, 79, ramp(B(32), B(39), 50, 100));
    chug(ch, 48, 64, ramp(B(32), B(39), 58, 92));
    arp('harp', ch, [0, 1, 2, 3, 4, 3, 2, 1], 43, 62);
    choir(C('Gm | C | Asus4 | A', 36), ramp(B(36), B(39), 45, 90), 'o');
    lowStrings(ch, ramp(B(32), B(39), 55, 95));
    bassline('bass', ch, 'xxxxxxxx', 33, 80);
    for (let b = 32; b < 40; b++) {
      const p = {
        kick: 'x...x...x...x...',
        hat: '..x...x...x...x.',
      };
      if (b >= 36) p.snare = '....x.......x...';
      if (b === 38) p.snare = 'o.o.o.o.x.x.x.x.';
      if (b === 39) {
        p.snare = 'xxxxXXXX........';
        p.kick = 'x...x...........';
        p.hat = '................';
      }
      drums(b, p);
    }
    hit('crash', B(32), 80);
    roll('timp', B(39), B(39) + 2, 0.125, 70, 115, midi('A2'));
    breakAt(B(39) + 2, B(40), ['violin', 'timp', 'kick', 'snare']);
    hit('crash', B(39) + 2, 110);
    E.push({ inst: 'riser', t: B(38), d: 8, m: 60, v: 70 });
    hit('revcym', B(40), 110);
  }

  // ---- Chorus (40-55) ------------------------------------------------------------------
  chorus(40, 0);

  // ---- Riff 2 (56-63) --------------------------------------------------------------------
  riff(56, 0);

  // ---- Santur solo (64-71) ---------------------------------------------------------------
  {
    const ch = C(SOLO_CH, 64);
    put('santur', M(SOLO, 64, { vel: 100 }).map((n, i) => ({ ...n, v: n.v * (i % 4 === 0 ? 1 : 0.82) })));
    pad('strings', ch, 3, 52, 69, 50, { o: { attack: 0.4 } });
    E.push({ inst: 'lowstr', t: B(64), d: 32, m: midi('A1'), v: 70 });
    E.push({ inst: 'lowstr', t: B(64), d: 32, m: midi('A2'), v: 70 });
    E.push({ inst: 'lowstr', t: B(64), d: 32, m: midi('E3'), v: 50 });
    choir(ch, 40, 'o', { bass: false, lo: 55, hi: 72 });
    bassline('pizz', ch, 'x..x..x.', 36, 90);
    for (let b = 64; b < 72; b++) {
      drums(b, {
        doum: 'x.......x.......',
        tek: '..x...x.....x...',
        ka: '...o.o....o.o.oo',
        shaker: 'xoooxooox oo xoo'.replace(/ /g, 'o'),
        kick: 'o.......o.......',
        frame: 'x.......x.......',
        taiko: b % 2 ? '................' : 'x...............',
      });
    }
    roll('timp', B(71) + 2, B(72), 0.125, 50, 90, midi('A2'));
  }

  // ---- Breakdown (72-79) -------------------------------------------------------------------
  {
    const ch = C(BREAK_CH, 72);
    const th = M(THEME, 72, { vel: 88 }).filter((n) => n.t < B(78));
    put('musicbox', th.map((n) => ({ ...n, m: n.m + 12 })));
    for (const seg of ch.slice(0, 6)) {
      const lad = ladder(seg.c, 50);
      E.push({ inst: 'musicbox', t: seg.t, d: 2, m: lad[0], v: 55 });
      E.push({ inst: 'musicbox', t: seg.t + 2, d: 2, m: lad[3], v: 45 });
    }
    pad('piano', ch, 3, 55, 72, 42, { o: { pedal: true } });
    for (const seg of ch) E.push({ inst: 'piano', t: seg.t, d: seg.d, m: pcAbove(seg.c.bass, 36), v: 48, o: { pedal: true } });
    choir(ch, ramp(B(72), B(80), 30, 75), 'u', { bass: false, lo: 55, hi: 74 });
    put('violin', M('D5:4. E5:8 F5:4 D6:4 | C6:4. Bb5:8 A5:4 G5:4 | A5:4. G5:8 E5:4 C6:4 | B5:2 D#6:2', 76, { vel: 92 }));
    pad('strings', C('Dm | Gm', 76), 4, 55, 76, ramp(B(76), B(78), 35, 60));
    pad('strings', C('Am | B7sus4:2 B7:2', 78), 4, 57, 81, ramp(B(78), B(80), 55, 112), { o: { tremolo: 0.8 } });
    lowStrings(C('Dm | Gm | Am | B7sus4:2 B7:2', 76), ramp(B(76), B(80), 40, 105));
    roll('snare', B(78), B(79), 0.25, 25, 60);
    roll('snare', B(79), B(80), 0.125, 60, 115);
    roll('timp', B(78), B(79), 0.125, 40, 80, midi('A2'));
    roll('timp', B(79), B(80), 0.125, 80, 118, midi('B2'));
    ['tomH', 'tomM', 'tomL', 'tomF'].forEach((tm, i) => hit(tm, B(79) + 3 + i * 0.25, 105));
    E.push({ inst: 'riser', t: B(78), d: 8, m: 60, v: 90 });
    hit('revcym', B(80), 120);
  }

  // ---- Final chorus in E minor (80-99) --------------------------------------------------------
  chorus(80, 2, { big: 10 });
  {
    const ch = C(EXT_CH, 96);
    const m_ = M(EXT, 96, { vel: 116 });
    put('violin', m_);
    put('vox', m_.map((n) => ({ ...n, m: n.m - 12, v: 92 })));
    put('whistle', m_.map((n) => ({ ...n, m: n.m + 12, v: 72 })));
    put('glock', m_.map((n) => ({ ...n, m: n.m + 12, v: 46 })));
    choir(ch, 90, 'a');
    pad('strings', ch, 4, 64, 86, 90);
    lowStrings(ch, 95);
    chug(ch, 50, 66, 84);
    pad('brass', ch, 3, 52, 69, 88);
    arp('harpsi', ch, [1, 2, 3, 4, 5, 4, 3, 2], 50, 76);
    bassline('bass', ch, 'xxxxxxxo', 33, 96);
    for (let b = 96; b < 100; b++) {
      drums(b, {
        kick: b === 99 ? 'x.......x.......' : 'x.....x.x.....x.',
        snare: b === 99 ? '....x...xxxxXXXX' : '....x.......x...',
        hat: b === 99 ? 'x.x.x.x.........' : 'x.x.x.x.x.x.x.x.',
        ohat: '..............x.',
      });
      E.push({ inst: 'timp', t: B(b), d: 1, m: pcAbove(ch[Math.min(b - 96, ch.length - 1)].c.root, 38), v: 85 });
    }
    hit('crash', B(96), 118);
    hit('taiko', B(96), 110);
    hit('crash', B(98), 110);
    hit('taiko', B(98), 110);
    ['tomH', 'tomH', 'tomM', 'tomM', 'tomL', 'tomL', 'tomF', 'tomF'].forEach((tm, i) => hit(tm, B(99) + 2 + i * 0.25, 100 + i * 3));
  }

  // ---- Outro riff in E minor (100-107) ----------------------------------------------------------
  riff(100, 2, { final: true });

  // ---- Coda (108-112) ----------------------------------------------------------------------------
  {
    put('musicbox', M('E6:4. F#6:8 G6:4 B6:4 | A6:4. G6:8 E6:2 | r:4 B5:4 E6:2', 109, { vel: 82 }));
    for (const [bar, m] of [[109, 'E4'], [110, 'C4'], [111, 'E4']]) {
      E.push({ inst: 'musicbox', t: B(bar), d: 2, m: midi(m), v: 50 });
      E.push({ inst: 'musicbox', t: B(bar) + 2, d: 2, m: midi(m) + 7, v: 40 });
    }
    choir(C('Em | C | Em | Em', 109), (t) => (t < B(111) ? 34 : 28), 'u', { bass: false, lo: 52, hi: 71 });
  }

  return E;
}
