// 6c. The hero shot: one visible scanline as 224 microcycles, filled cycle
// by cycle in the modelled schedule order, and heard as it fills. Then the
// line shrinks into place and repeats down a whole screen.
// N11: "On each visible line, the display takes sixty percent of the
// cycles, memory refresh about a tenth — and your program gets the rest:
// about a third."
// Schedule: cycle-level model of the Alto II microcode (display notes §2.7).
// The totals are solid; where refresh falls in the line is an assumption.

import { clear, rect, frameRect, text, header } from '../lib/draw.js';
import { ramp, easeInOut, easeOut, blink } from '../lib/time.js';
import { SCANLINE, SHARES, TASKS, taskCell, altoScreen } from './common.js';

const COLS = 16, CELL = 28, GAP = 2;
const GX = (540 - COLS * (CELL + GAP)) / 2, GY = 150;
// The slab of task 0 starts after the last display/refresh slot.
const EMU_FROM = SCANLINE.indexOf('EMU');

// When slot i fills: the display part across "the display takes … a tenth",
// the ink slab across "your program gets the rest".
function slotTime(i, T) {
  if (i < EMU_FROM) {
    const a = T.at('N11', 'line'), b = T.at('N11', 'tenth') + 0.1;
    return a + (i / EMU_FROM) * (b - a);
  }
  const a = T.at('N11', 'your'), b = T.at('N11', 'rest') + 0.1;
  return a + ((i - EMU_FROM) / (224 - EMU_FROM)) * (b - a);
}

const LEGEND = [
  { key: 'display', label: 'display', swatch: 'DWT', count: SHARES.display, cue: 'sixty' },
  { key: 'refresh', label: 'memory refresh', swatch: 'MRT', count: SHARES.refresh, cue: 'tenth' },
  { key: 'emulator', label: 'your program', swatch: 'EMU', count: SHARES.emulator, cue: 'third' },
];

export const scanline = {
  draw(ctx, t, T, shot) {
    clear(ctx);
    const done = T.end('N11') + 0.2;
    const shrink = easeInOut(ramp(t, done, done + 0.7));
    const field = ramp(t, done + 0.7, done + 1.8);

    if (shrink <= 0) {
      header(ctx, 'ONE SCANLINE', '224 cycles × 170 ns = 38.08 µs');
      // The Alto's screen in miniature with this line picked out.
      altoScreen(ctx, 424, 36, 72, 96, { bezel: 5 });
      for (let y = 0; y < 96; y += 3) rect(ctx, 430, 36 + y, 20 + ((y * 37) % 40), 1, 'ink');
      rect(ctx, 414, 80, 92, 3, 'red');
      SCANLINE.forEach((task, i) => {
        const at = slotTime(i, T);
        if (t < at) return;
        const x = GX + (i % COLS) * (CELL + GAP);
        const y = GY + Math.floor(i / COLS) * (CELL + GAP);
        taskCell(ctx, x, y, CELL, CELL, task);
      });
      // The rest glows once it's named.
      const third = T.at('N11', 'third');
      if (t >= third && blink(t, third, 0.6)) {
        const r0 = Math.floor(EMU_FROM / COLS);
        frameRect(ctx, GX - 4, GY + r0 * (CELL + GAP) - 4, COLS * (CELL + GAP) + 6, (14 - r0) * (CELL + GAP) + 6, 'red', 3);
      }
      // Legend with shares that count up as they're named.
      LEGEND.forEach((l, j) => {
        const at = T.at('N11', l.cue) - 0.3;
        if (t < at - 0.6) return;
        const y = GY + 14 * (CELL + GAP) + 26 + j * 40;
        taskCell(ctx, 40, y, 26, 26, l.swatch);
        text(ctx, l.label, 80, y + 3, { size: 20, colour: l.key === 'emulator' ? 'ink' : 'ink' });
        const pct = Math.round((100 * l.count * ramp(t, at, at + 0.5)) / SHARES.total);
        text(ctx, `${pct}%`, 500, y + 1, { size: 24, align: 'right', colour: l.key === 'emulator' ? 'red' : 'ink' });
      });
      return;
    }

    // The grid shrinks to one line at the top of a screen, then repeats
    // down it: every visible line looks like this.
    header(ctx, 'EVERY LINE', 'the whole screen, every field');
    const SX = 120, SY = 170, SW = 300, SH = 400;
    altoScreen(ctx, SX, SY, SW, SH, { bezel: 12 });
    const lineAt = (y) => {
      for (let i = 0; i < 224; i++) {
        const x0 = SX + Math.floor((i * SW) / 224);
        const x1 = SX + Math.floor(((i + 1) * SW) / 224);
        const task = SCANLINE[i];
        const spec = TASKS[task];
        if (spec.pattern === 'solid' || (i + y) % 2 === 0) rect(ctx, x0, y, x1 - x0, 2, spec.colour);
      }
    };
    if (shrink < 1) {
      // The grid, squashed towards the first line.
      const h = (14 * (CELL + GAP)) * (1 - shrink) + 2 * shrink;
      const w = COLS * (CELL + GAP) * (1 - shrink) + SW * shrink;
      const x = GX * (1 - shrink) + SX * shrink;
      const y = GY * (1 - shrink) + SY * shrink;
      SCANLINE.forEach((task, i) => {
        const cx = x + ((i % COLS) / COLS) * w;
        const cy = y + (Math.floor(i / COLS) / 14) * h;
        taskCell(ctx, cx, cy, Math.max(1, w / COLS - 2 * (1 - shrink)), Math.max(1, h / 14 - 2 * (1 - shrink)), task);
      });
      return;
    }
    const lines = Math.floor(field * (SH / 3));
    for (let j = 0; j <= lines; j++) lineAt(SY + j * 3);
    if (field >= 1) {
      text(ctx, 'blue: the display   ink: your program', 270, SY + SH + 30, { size: 14, align: 'center' });
    }
  },

  sounds(S, T) {
    // The fill, sonified: each run of one task is one note in its voice.
    let i = 0;
    while (i < SCANLINE.length) {
      let j = i;
      while (j + 1 < SCANLINE.length && SCANLINE[j + 1] === SCANLINE[i]) j++;
      const a = slotTime(i, T), b = slotTime(j + 1 < SCANLINE.length ? j + 1 : j, T) + (j + 1 < SCANLINE.length ? 0 : 0.05);
      S.task(TASKS[SCANLINE[i]].sound, a, Math.max(0.03, b - a), 0.7);
      i = j + 1;
    }
    const done = T.end('N11') + 0.2;
    S.sweep(done, { f0: 1200, f1: 300, dur: 0.7, gain: 0.03, wave: 'square', lp: 2000 });
    // The field: the line's chord, sped up.
    for (let k = 0; k < 12; k++) {
      const t = done + 0.7 + k * 0.09;
      S.task('display', t, 0.05, 0.6);
      S.task('emulator', t + 0.055, 0.03, 0.5);
    }
  },
};
