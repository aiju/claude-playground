// The hero visual: one visible scanline as 224 microcycles of 170 ns, each
// slot coloured by the task that owned it. The schedule here is a placeholder
// with roughly the right proportions; the real budget comes from the research.

import { clear, rect, frameRect, text, patternRect, titleTab, caption, SANS } from '../lib/draw.js';

export const TASKS = {
  DHT: { label: 'display horizontal', colour: 'blue', pattern: 'stripes' },
  DWT: { label: 'display word', colour: 'blue', pattern: 'solid' },
  CURT: { label: 'cursor', colour: 'blue', pattern: 'dots' },
  MRT: { label: 'memory refresh + mouse', colour: 'yellow', pattern: 'solid' },
  KWD: { label: 'disk word', colour: 'red', pattern: 'solid' },
  ETH: { label: 'Ethernet', colour: 'yellow', pattern: 'stripes' },
  EMU: { label: 'task 0: YOUR PROGRAM', colour: 'ink', pattern: 'solid' },
};

export function placeholderSchedule() {
  const s = [];
  const push = (task, n) => {
    for (let i = 0; i < n; i++) s.push(task);
  };
  push('DHT', 11);
  push('CURT', 2);
  let words = 0;
  while (s.length < 224) {
    if (words < 38) {
      push('DWT', 3);
      words++;
      if (words === 20) push('MRT', 12);
      if (words % 6 === 0) push('KWD', 2);
    }
    push('EMU', 2);
  }
  return s.slice(0, 224);
}

export function drawScanline(ctx, { schedule = placeholderSchedule(), shown = 224 } = {}) {
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
  for (const key of ['DWT', 'DHT', 'CURT', 'MRT', 'KWD', 'EMU']) {
    const spec = TASKS[key];
    patternRect(ctx, 40, ly, 22, 22, spec.colour, spec.pattern);
    frameRect(ctx, 40, ly, 22, 22, spec.colour, 1);
    const pct = Math.round((100 * (counts[key] || 0)) / schedule.length);
    text(ctx, spec.label, 74, ly + 3, { size: 16 });
    text(ctx, `${pct}%`, 500, ly + 3, { size: 16, align: 'right' });
    ly += 30;
  }

  caption(ctx, ['Your program runs', 'in the gaps.'], 842);
  text(ctx, 'style frame – placeholder schedule', 270, 936, { size: 11, align: 'center', font: SANS, weight: 'normal' });
}
