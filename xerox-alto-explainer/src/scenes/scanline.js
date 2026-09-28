// The hero visual: one visible, full-width scanline as 224 microcycles of
// 170 ns, each slot coloured by the task that owned it.
//
// The schedule comes from a cycle-level model of the Alto II microcode (see
// the display notes in research_notes/Alto processor deep dive): the FIFO is
// flushed at horizontal retrace, the display word task (DWT) refills it two
// words per six cycles, the horizontal task (DHT) sets up the next line when
// DWT blocks, and memory refresh (MRT) wakes at retrace (ContrAlto's
// convention; the real wakeup point within the line is unconfirmed). The
// per-task totals don't depend on those assumptions.

import { clear, rect, frameRect, text, patternRect, titleTab, caption } from '../lib/draw.js';

export const TASKS = {
  DWT: { label: 'display word', colour: 'blue', pattern: 'solid' },
  DHT: { label: 'display horizontal', colour: 'blue', pattern: 'stripes' },
  CURT: { label: 'cursor', colour: 'blue', pattern: 'dots' },
  MRT: { label: 'refresh + mouse', colour: 'yellow', pattern: 'solid' },
  KWD: { label: 'disk word', colour: 'red', pattern: 'solid' },
  ETH: { label: 'Ethernet', colour: 'yellow', pattern: 'stripes' },
  EMU: { label: 'task 0: YOUR PROGRAM', colour: 'ink', pattern: 'solid' },
};

// C = cursor, W = display word, M = refresh, H = display horizontal, . = emulator
const MODEL_LINE =
  'CCWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMWWWWWWMMMWWWWWWMMMMWWWWWW' +
  'MMMWWWWWWMMMWWWWWWMMMMWWWWWWWHHHHHHHHHHHM.......................................................................';
const CODE = { C: 'CURT', W: 'DWT', M: 'MRT', H: 'DHT', '.': 'EMU' };

export function modelSchedule() {
  return [...MODEL_LINE].map((ch) => CODE[ch]);
}

export function drawScanline(ctx, { schedule = modelSchedule(), shown = 224 } = {}) {
  clear(ctx);

  titleTab(ctx, 'ONE SCANLINE', 30, 40, { size: 16 });
  text(ctx, '38.08 µs = 224 cycles × 170 ns', 30, 80, { size: 16 });

  // Miniature Alto screen with the current line picked out in red.
  const mx = 400;
  const my = 30;
  rect(ctx, mx - 6, my - 6, 90 + 12, 120 + 12, 'ink');
  rect(ctx, mx, my, 90, 120, 'paper');
  for (let y = 0; y < 120; y += 3) rect(ctx, mx + 6, my + y, 40 + ((y * 37) % 38), 1, 'ink');
  rect(ctx, mx - 10, my + 56, 110, 3, 'red');

  // 224 slots as 14 rows of 16.
  const cols = 16;
  const cell = 28;
  const gap = 2;
  const gx = (540 - cols * (cell + gap)) / 2;
  const gy = 180;
  schedule.slice(0, shown).forEach((task, i) => {
    const x = gx + (i % cols) * (cell + gap);
    const y = gy + Math.floor(i / cols) * (cell + gap);
    const spec = TASKS[task];
    patternRect(ctx, x, y, cell, cell, spec.colour, spec.pattern);
    if (spec.pattern !== 'solid') frameRect(ctx, x, y, cell, cell, spec.colour, 1);
  });

  // Legend with the share of this line each task took.
  const counts = {};
  schedule.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  let ly = gy + 14 * (cell + gap) + 24;
  for (const key of Object.keys(TASKS).filter((k) => counts[k])) {
    const spec = TASKS[key];
    patternRect(ctx, 40, ly, 22, 22, spec.colour, spec.pattern);
    frameRect(ctx, 40, ly, 22, 22, spec.colour, 1);
    const pct = Math.round((100 * (counts[key] || 0)) / schedule.length);
    text(ctx, spec.label, 74, ly + 3, { size: 16 });
    text(ctx, `${pct}%`, 500, ly + 3, { size: 16, align: 'right' });
    ly += 30;
  }

  caption(ctx, ['Your program gets', 'what\u2019s left.'], 842);
}
