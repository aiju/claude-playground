// The soundtrack. Tunes are note strings ("A4.4" = A4 for four 16th-notes,
// "-" a rest, "+" a chord); accompaniment is generated from chord charts.

const CHORDS = {
  Am: ['A3', 'C4', 'E4'], G: ['G3', 'B3', 'D4'], Em: ['E3', 'G3', 'B3'], E: ['E3', 'G#3', 'B3'],
  Dm: ['D3', 'F3', 'A3'], C: ['C4', 'E4', 'G4'], F: ['F3', 'A3', 'C4'], Bb: ['Bb3', 'D4', 'F4'],
  Gm: ['G3', 'Bb3', 'D4'], C7: ['C4', 'E4', 'Bb4'], A: ['A3', 'C#4', 'E4'], B7: ['B3', 'D#4', 'A4'],
  Dm9: ['D4', 'F4', 'A4', 'C5', 'E5'], Cmaj7: ['C4', 'E4', 'G4', 'B4'], Bbmaj7: ['Bb3', 'D4', 'F4', 'A4'], Am7: ['A3', 'C4', 'E4', 'G4'],
  Cm: ['C4', 'Eb4', 'G4'], Ab: ['Ab3', 'C4', 'Eb4'], Fm: ['F3', 'Ab3', 'C4'], Gs: ['G3', 'B3', 'D4'], Eb: ['Eb3', 'G3', 'Bb3'],
};
const ROOT = { Am: 'A', G: 'G', Em: 'E', E: 'E', Dm: 'D', C: 'C', F: 'F', Bb: 'Bb', Gm: 'G', C7: 'C', A: 'A', B7: 'B', Dm9: 'D', Cmaj7: 'C', Bbmaj7: 'Bb', Am7: 'A', Cm: 'C', Ab: 'Ab', Fm: 'F', Gs: 'G', Eb: 'Eb' };
const FIFTH = { A: 'E', G: 'D', E: 'B', D: 'A', C: 'G', F: 'C', Bb: 'F', B: 'F#', Ab: 'Eb', Eb: 'Bb' };

const up = (n, k = 1) => n.replace(/-?\d$/, (o) => String(+o + k));
const rep = (s, n) => Array(n).fill(s).join(' ');

// bass: root / fifth / octave / fifth in quarter notes (bar = 16 steps) or a waltz (bar = 12)
function bass(chords, oct = 2, style = 'walk') {
  return chords.map((c) => {
    const r = ROOT[c] + oct, f = (FIFTH[ROOT[c]] || ROOT[c]) + oct, o = ROOT[c] + (oct + 1);
    if (style === 'walk') return `${r}.4 ${f}.4 ${o}.4 ${f}.4`;
    if (style === 'whole') return `${r}.16`;
    if (style === 'waltz') return `${r}.4 -.8`;
    if (style === 'drive') return rep(`${r}.2`, 6) + ` ${o}.2 ${r}.2`;
    if (style === 'pulse') return `${r}.2 -.2 ${r}.2 -.2 ${r}.2 -.2 ${f}.2 ${o}.2`;
    return `${r}.16`;
  }).join(' ');
}
// arpeggio over each chord: `pattern` indexes chord tones (+ octave above)
function arp(chords, pattern, len = 2, oct = 0) {
  return chords.map((c) => {
    const tones = CHORDS[c].map((n) => up(n, oct));
    const ext = [...tones, ...tones.map((n) => up(n, 1))];
    return pattern.map((i) => `${ext[i % ext.length]}.${len}`).join(' ');
  }).join(' ');
}
function block(chords, len = 16, oct = 0) { return chords.map((c) => CHORDS[c].map((n) => up(n, oct)).join('+') + '.' + len).join(' '); }
function waltzChords(chords) { return chords.map((c) => `-.4 ${CHORDS[c].map((n) => up(n, 1)).join('+')}.4 ${CHORDS[c].map((n) => up(n, 1)).join('+')}.4`).join(' '); }
function drums(bars, kick, snare, hat, len = 16) {
  const k = [], s = [], h = [];
  for (let b = 0; b < bars; b++) {
    for (let i = 0; i < len; i++) {
      k.push(kick.includes(i) ? 'C2.1' : '-.1');
      s.push(snare.includes(i) ? 'C3.1' : '-.1');
      h.push(hat && i % hat === 0 ? 'C5.1' : '-.1');
    }
  }
  return { k: k.join(' '), s: s.join(' '), h: h.join(' ') };
}

// ------------------------------------------------------------------ overworld
const OW_A = `A4.4 E5.4 D5.2 C5.2 B4.2 C5.2  D5.6 C5.2 B4.4 G4.4  A4.4 E5.4 G5.2 F5.2 E5.2 D5.2  E5.12 -.4
  F5.4 E5.2 D5.2 C5.4 D5.4  E5.4 D5.2 C5.2 B4.4 A4.4  C5.4 B4.2 A4.2 G#4.4 B4.4  A4.12 -.4`;
const OW_B = `G4.2 C5.2 E5.2 G5.6 F5.2 E5.2  F5.4 A5.4 G5.4 E5.4  D5.2 E5.2 F5.2 A5.6 G5.2 F5.2  E5.12 -.4
  C5.2 D5.2 E5.2 F5.6 E5.2 D5.2  E5.4 G5.4 C6.4 B5.4  A5.6 G5.2 F5.2 E5.2 D5.4  E5.8 G#4.4 B4.4`;
const OW_CH_A = ['Am', 'G', 'Am', 'E', 'Dm', 'Am', 'E', 'Am'];
const OW_CH_B = ['C', 'F', 'Dm', 'C', 'F', 'C', 'Dm', 'E'];
const owDr = drums(16, [0, 8, 10], [4, 12], 2);

// ------------------------------------------------------------------ village (3/4)
const VIL = `A4.4 C5.4 F5.4  E5.4 D5.4 C5.4  D5.4 Bb4.4 G4.4  A4.8 C5.4
  A4.4 C5.4 F5.4  G5.4 F5.4 E5.4  F5.4 E5.2 D5.2 C5.4  F5.12
  Bb4.4 D5.4 F5.4  A5.6 G5.2 F5.4  G4.4 C5.4 E5.4  G5.6 F5.2 E5.4
  F5.4 D5.4 Bb4.4  A4.4 C5.4 F5.4  E5.4 G5.4 Bb4.4  F5.12`;
const VIL_CH = ['F', 'C', 'Gm', 'F', 'F', 'C', 'C7', 'F', 'Bb', 'F', 'C', 'C', 'Bb', 'F', 'C7', 'F'];

// ------------------------------------------------------------------ shop
const SHOP_M = `C5.2 E5.2 G5.2 E5.2 F5.2 A5.2 G5.4  E5.2 C5.2 D5.2 E5.2 D5.4 G4.4
  C5.2 E5.2 G5.2 E5.2 F5.2 A5.2 C6.4  B5.2 G5.2 D5.2 F5.2 E5.4 C5.4`;
const SHOP_CH = ['C', 'G', 'C', 'G'];

// ------------------------------------------------------------------ shrine (D dorian)
const SHR_CH = ['Dm9', 'Cmaj7', 'Bbmaj7', 'Am7'];
const SHR_FL = `-.8 A5.4 G5.4  E5.16  -.8 F5.4 E5.4  D5.12 -.4  -.8 A5.4 C6.4  B5.8 G5.8  F5.8 E5.4 D5.4  E5.16`;

// ------------------------------------------------------------------ battle
const BOSS_M = `D5.4 F5.4 A5.4 G#5.4  A5.8 F5.8  G5.4 Bb5.4 A5.4 G5.4  F5.8 E5.8
  D5.4 F5.4 A5.4 D6.4  C#6.8 A5.8  Bb5.4 A5.4 G5.4 F5.4  E5.8 C#5.8`;
const BOSS_CH = ['Dm', 'Dm', 'Gm', 'A', 'Dm', 'A', 'Gm', 'A'];
const bossDr = drums(8, [0, 6, 8, 14], [4, 12], 2);

const MINI_M = `E5.2 -.2 E5.2 G5.2 -.2 E5.2 A5.4  G5.2 F#5.2 E5.2 D5.2 E5.8
  E5.2 -.2 E5.2 G5.2 -.2 B5.2 A5.4  G5.2 A5.2 F#5.2 D#5.2 E5.8`;
const MINI_CH = ['Em', 'Em', 'Em', 'B7'];
const miniDr = drums(4, [0, 8], [4, 12], 2);

const FIN_M = `C5.4 Eb5.4 G5.4 F#5.4  G5.8 Eb5.8  Ab5.4 G5.4 F5.4 Eb5.4  D5.8 B4.8
  C5.4 Eb5.4 G5.4 C6.4  B5.8 G5.8  Ab5.4 G5.4 F5.4 D5.4  Eb5.8 D5.8`;
const FIN_CH = ['Cm', 'Cm', 'Fm', 'Gs', 'Cm', 'Gs', 'Ab', 'Gs'];
const finDr = drums(8, [0, 3, 8, 11], [4, 12], 1);

// ------------------------------------------------------------------ lighthouse
const LH_CH = ['Em', 'C', 'Am', 'B7'];
const LH_M = `-.8 B4.4 E5.4  G5.12 F#5.4  E5.8 C5.8  D#5.16  -.8 B4.4 E5.4  B5.12 A5.4  G5.8 E5.8  F#5.16`;

export const SONGS = {
  title: {
    bpm: 80, reverb: 1.4,
    tracks: [
      { inst: 'musicbox', vol: 0.9, notes: OW_A },
      { inst: 'pad', vol: 0.8, notes: block(OW_CH_A, 16, 0) },
      { inst: 'bass', vol: 0.4, notes: bass(OW_CH_A, 2, 'whole') },
    ],
  },
  overworld: {
    bpm: 112,
    tracks: [
      { inst: 'lead', vol: 0.55, notes: OW_A + ' ' + OW_B },
      { inst: 'pluck', vol: 0.45, notes: arp([...OW_CH_A, ...OW_CH_B], [0, 1, 2, 3, 2, 1, 0, 1], 2, 0) },
      { inst: 'bass', vol: 0.55, notes: bass([...OW_CH_A, ...OW_CH_B], 2, 'walk') },
      { inst: 'pad', vol: 0.35, notes: block([...OW_CH_A, ...OW_CH_B], 16, 0) },
      { inst: 'kick', vol: 0.35, notes: owDr.k },
      { inst: 'snare', vol: 0.25, notes: owDr.s },
      { inst: 'shaker', vol: 0.5, notes: owDr.h },
    ],
  },
  village: {
    bpm: 100,
    tracks: [
      { inst: 'flute', vol: 0.6, notes: VIL },
      { inst: 'bass', vol: 0.5, notes: bass(VIL_CH, 2, 'waltz') },
      { inst: 'marimba', vol: 0.45, notes: waltzChords(VIL_CH) },
    ],
  },
  house: {
    bpm: 84, reverb: 1.3,
    tracks: [
      { inst: 'musicbox', vol: 0.8, notes: VIL },
      { inst: 'pad', vol: 0.5, notes: VIL_CH.map((c) => CHORDS[c].join('+') + '.12').join(' ') },
    ],
  },
  shop: {
    bpm: 128,
    tracks: [
      { inst: 'marimba', vol: 0.7, notes: SHOP_M },
      { inst: 'bass', vol: 0.5, notes: bass(SHOP_CH, 2, 'pulse') },
      { inst: 'marimba', vol: 0.3, notes: arp(SHOP_CH, [0, 2, 1, 2, 0, 2, 1, 2], 2, 0) },
      { inst: 'shaker', vol: 0.4, notes: drums(4, [], [], 2).h },
    ],
  },
  cave: {
    bpm: 66, reverb: 1.6,
    tracks: [
      { inst: 'pad', vol: 0.55, notes: 'A2+E3.32 F2+C3.32 D2+A2.32 E2+B2.32' },
      { inst: 'bell', vol: 0.35, notes: '-.6 E5.2 -.10 B4.2 -.12 C5.2 -.6 -.10 A5.2 -.12 E5.2 -.8 F5.2 -.14 G5.2 -.10 B4.2 -.24' },
      { inst: 'bass', vol: 0.4, notes: 'A1.8 -.24 F1.8 -.24 D1.8 -.24 E1.8 -.24' },
    ],
  },
  shrine: {
    bpm: 88, reverb: 1.5,
    tracks: [
      { inst: 'bell', vol: 0.5, notes: arp(SHR_CH, [0, 2, 3, 4, 5, 4, 3, 2], 2, 0) },
      { inst: 'flute', vol: 0.45, notes: SHR_FL },
      { inst: 'bass', vol: 0.5, notes: 'D2.16 C2.16 Bb1.16 A1.16' },
      { inst: 'pad', vol: 0.3, notes: block(SHR_CH, 16, 0) },
      { inst: 'shaker', vol: 0.35, notes: rep('-.2 C5.2', 32) },
    ],
  },
  miniboss: {
    bpm: 140,
    tracks: [
      { inst: 'lead', vol: 0.5, notes: MINI_M },
      { inst: 'bass', vol: 0.6, notes: bass(MINI_CH, 2, 'drive') },
      { inst: 'pluck', vol: 0.35, notes: arp(MINI_CH, [0, 1, 2, 1, 0, 1, 2, 3], 2, 0) },
      { inst: 'kick', vol: 0.5, notes: miniDr.k },
      { inst: 'snare', vol: 0.4, notes: miniDr.s },
      { inst: 'hat', vol: 0.5, notes: miniDr.h },
    ],
  },
  boss: {
    bpm: 150,
    tracks: [
      { inst: 'lead', vol: 0.5, notes: BOSS_M },
      { inst: 'bass', vol: 0.65, notes: bass(BOSS_CH, 2, 'drive') },
      { inst: 'organ', vol: 0.5, notes: block(BOSS_CH, 16, 0) },
      { inst: 'kick', vol: 0.55, notes: bossDr.k },
      { inst: 'snare', vol: 0.45, notes: bossDr.s },
      { inst: 'hat', vol: 0.5, notes: bossDr.h },
    ],
  },
  lighthouse: {
    bpm: 100, reverb: 1.3,
    tracks: [
      { inst: 'pluck', vol: 0.5, notes: arp(LH_CH, [0, 1, 2, 3, 4, 3, 2, 1], 2, 0) + ' ' + arp(LH_CH, [0, 1, 2, 3, 4, 3, 2, 1], 2, 0) },
      { inst: 'flute', vol: 0.45, notes: LH_M },
      { inst: 'bass', vol: 0.5, notes: bass([...LH_CH, ...LH_CH], 2, 'whole') },
      { inst: 'pad', vol: 0.3, notes: block([...LH_CH, ...LH_CH], 16, 0) },
    ],
  },
  final: {
    bpm: 138,
    tracks: [
      { inst: 'lead', vol: 0.5, notes: FIN_M },
      { inst: 'organ', vol: 0.55, notes: block(FIN_CH, 16, 0) },
      { inst: 'bass', vol: 0.6, notes: bass(FIN_CH, 2, 'drive') },
      { inst: 'pad', vol: 0.35, notes: block(FIN_CH, 16, 1) },
      { inst: 'kick', vol: 0.55, notes: finDr.k },
      { inst: 'snare', vol: 0.45, notes: finDr.s },
      { inst: 'shaker', vol: 0.5, notes: finDr.h },
    ],
  },
  victory: {
    bpm: 120, loop: false,
    tracks: [
      { inst: 'lead', vol: 0.6, notes: 'G4.2 C5.2 E5.2 G5.6 E5.2 G5.2 C6.12 -.4 -.16' },
      { inst: 'bass', vol: 0.6, notes: 'C3.8 G2.8 C3.16 -.16' },
      { inst: 'pad', vol: 0.5, notes: 'C4+E4+G4.16 C4+F4+A4.8 C4+E4+G4.24' },
    ],
  },
  ending: {
    bpm: 92, reverb: 1.3,
    tracks: [
      { inst: 'flute', vol: 0.6, notes: OW_B + ' ' + OW_B.replace('E5.8 G#4.4 B4.4', 'C5.16') },
      { inst: 'pad', vol: 0.5, notes: block([...OW_CH_B, ...OW_CH_B.slice(0, 7), 'C'], 16, 0) },
      { inst: 'bass', vol: 0.5, notes: bass([...OW_CH_B, ...OW_CH_B.slice(0, 7), 'C'], 2, 'walk') },
      { inst: 'bell', vol: 0.3, notes: arp([...OW_CH_B, ...OW_CH_B.slice(0, 7), 'C'], [0, 2, 4, 2], 4, 0) },
    ],
  },
};
