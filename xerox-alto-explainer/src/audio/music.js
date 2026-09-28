// The music bed: a 7 : 24 polyrhythm, because the Alto's CPU and pixel
// clocks are locked at 7 cycles to 24 pixels. Each bar has 24 soft high
// ticks (the heartbeat) against 7 bass notes, over slow chords in D dorian.
//
// The tempo follows the story: slow while the first picture draws, steady
// through the middle, faster once the screen is switched off, and the last
// bar lands exactly on the title card with one chord.

import { tick, bass, pad, bell } from './instruments.js';

// Chords, two bars each: [bass root, pad voicing, bass intervals for the 7 notes].
const PROG = [
  { name: 'Dm9', root: 38, pad: [53, 57, 60, 64], walk: [0, 7, 12, 7, 10, 7, 14] },
  { name: 'G13', root: 43, pad: [53, 59, 64, 69], walk: [0, 7, 12, 7, 10, 7, 9] },
  { name: 'B♭maj7♯11', root: 34, pad: [57, 62, 64, 65], walk: [0, 7, 12, 7, 11, 7, 14] },
  { name: 'A7sus4', root: 33, pad: [55, 57, 62, 64], walk: [0, 7, 12, 7, 10, 5, 7] },
];
const FINAL = { root: 26, pad: [54, 57, 61, 64, 66] }; // Dmaj9

// Bars in time. Bar length changes only at bar lines; the last bar before the
// end is stretched or squeezed so the final downbeat lands on the title card.
export function musicClock(T) {
  const fast = T.at('N15', 'off');
  const end = T.end('N16') + 0.6;
  const barLen = (t) => (t < T.at('N2') - 0.6 ? 3.0 : t < fast ? 2.6 : 1.9);
  const bars = [];
  let t = 0;
  while (t < end) {
    let len = barLen(t);
    if (t + len > end - len * 0.5) len = end - t; // last bar: land on the end
    bars.push({ start: t, len, chord: PROG[Math.floor(bars.length / 2) % PROG.length] });
    t += len;
  }
  const ticks = bars.flatMap((b) => Array.from({ length: 24 }, (_, k) => b.start + (k * b.len) / 24));
  const pulses = bars.flatMap((b) => Array.from({ length: 7 }, (_, k) => b.start + (k * b.len) / 7));
  return { bars, ticks, pulses, end, fast };
}

// Index of the last heartbeat tick at or before t (for pictures that change
// on the beat).
export function tickIndex(clock, t) {
  const { ticks } = clock;
  let lo = 0, hi = ticks.length - 1;
  if (t < ticks[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ticks[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function renderMusic(out, T, clock = musicClock(T)) {
  const bassIn = T.at('N2') - 0.6;
  const padIn = T.at('N1', 'every');
  const { fast, end } = clock;

  clock.bars.forEach((b, n) => {
    // Heartbeat: fades in over the first bar and a half.
    for (let k = 0; k < 24; k++) {
      const t = b.start + (k * b.len) / 24;
      const fade = Math.min(1, t / 4.5);
      const accent = k === 0 ? 1 : k % 6 === 0 ? 0.55 : 0.32;
      tick(out, t, { freq: k === 0 ? 1800 : 2600, gain: 0.032 * accent * fade, decay: 0.007, noise: 0.2, seed: n * 24 + k });
    }
    // Bass: seven to the bar, brighter on the downbeat.
    if (b.start >= bassIn - 0.01) {
      const step = b.len / 7;
      b.chord.walk.forEach((iv, k) => {
        bass(out, b.start + k * step, { note: b.chord.root + iv, dur: step * 0.7, gain: k === 0 ? 0.13 : 0.1, bright: k === 0 ? 1 : 0.6 });
      });
    }
    // Pad: one chord per two bars, from the first "every pixel" until the
    // screen goes off.
    const chordStart = n % 2 === 0;
    if (chordStart && b.start + b.len > padIn && b.start < fast) {
      const from = Math.max(b.start, padIn);
      const to = Math.min(b.start + b.len * 2, fast);
      pad(out, from, to, { notes: b.chord.pad, gain: 0.028, attack: from === padIn ? 2 : 0.6, release: to === fast ? 0.4 : 0.9 });
    }
  });

  // A bell at the start of each section after the first, on its first downbeat.
  for (let s = 2; s <= 8; s++) {
    const first = Object.values(T.lines).find((l) => l.section === s);
    const bar = clock.bars.find((b) => b.start >= first.start - 1.2);
    if (bar && bar.start < end - 0.1) bell(out, bar.start, { freq: 1174.66, gain: 0.035, dur: 1.8 });
  }

  // The ending: one long Dmaj9 with a bell, where both rhythms land.
  bass(out, end, { note: FINAL.root, dur: 3.2, gain: 0.16, bright: 0.8 });
  pad(out, end, end + 2.2, { notes: FINAL.pad, gain: 0.04, attack: 0.02, release: 1.6, lp: 1800 });
  [1174.66, 1479.98, 1760].forEach((f, k) => bell(out, end + k * 0.04, { freq: f, gain: 0.05, dur: 3.2, index: 1.6 }));
}
