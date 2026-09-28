// 6b. Clocks. The CPU and pixel clocks are geared 7 : 24, so a scanline is
// exactly 224 microcycles; then the display word task's six-instruction
// loop moves two words (32 pixels) into the FIFO per pass.
// N10: "The clock was picked so a scanline is exactly 224 cycles. And
// memory's too slow for single words, so the display reads two at a time:
// thirty-two pixels every six microinstructions."
// Clocks: CSL79 §3.4 and the display schematic (29.4 MHz ÷ 5 = 5.88 MHz;
// pixels 20.16 MHz). The loop is DWT in the 1979 listing.

import { clear, rect, frameRect, text, header, ditherRect } from '../lib/draw.js';
import { ramp, easeOut, easeBack } from '../lib/time.js';
import { gear } from './common.js';
import { tickIndex } from '../audio/music.js';

const LOOP = [
  'NOTAB:  MAR← T← DWA;',
  '        L← AECL-T-1;',
  '        ALUCY, L← 2+T;',
  '        DWA← L, :XNOMORE;',
  'DOMORE: DDR← MD, TASK;',
  '        DDR← MD, :NOTAB;',
];
const RULER = { x: 30, w: 480, y: 360 };
const FIFO = { x: 400, y: 520, w: 100, slot: 16 };
const LIST = { x: 30, y: 540, lh: 26 };

export const clocks = {
  draw(ctx, t, T, shot, clock) {
    clear(ctx);
    header(ctx, 'TWO CLOCKS, ONE GEAR RATIO', 'CPU : pixels = 7 : 24');
    const t0 = shot.from;

    // The gears: the CPU's 24-tooth wheel turns 7/24 as fast as the pixels' 7-tooth one.
    const g = easeBack(ramp(t, t0, t0 + 0.4));
    const spin = (t - t0) * 0.9;
    const R1 = 84, R2 = 26;
    if (g > 0) {
      gear(ctx, 150, 225, R1 * g, 24, -spin * (7 / 24) * Math.PI * 2 / 7, 'ink');
      gear(ctx, 150 + R1 + R2 - 8, 225, R2 * g, 7, spin * Math.PI * 2 / 7 + 0.2, 'blue');
      text(ctx, 'CPU', 150, 320, { size: 15, align: 'center' });
      text(ctx, '5.88 MHz', 150, 338, { size: 13, align: 'center', weight: 'normal' });
      text(ctx, 'pixels', 360, 150, { size: 15 });
      text(ctx, '20.16 MHz', 360, 170, { size: 13, weight: 'normal' });
      text(ctx, '24 teeth : 7 teeth', 360, 215, { size: 13, weight: 'normal' });
      text(ctx, '29.4 MHz ÷ 5', 360, 240, { size: 13, weight: 'normal' });
    }

    // One scanline, as a ruler of 224 cycles.
    const r = ramp(t, T.at('N10', 'scanline'), T.at('N10', 'cycles') + 0.2);
    if (r > 0) {
      const n = Math.floor(r * 224);
      for (let i = 0; i < n; i++) {
        const x = RULER.x + Math.round((i * RULER.w) / 224);
        const h = i % 16 === 0 ? 22 : i % 8 === 0 ? 14 : 8;
        rect(ctx, x, RULER.y + 22 - h, 1, h, 'ink');
      }
      rect(ctx, RULER.x, RULER.y + 22, RULER.w * r, 2, 'ink');
      text(ctx, String(n).padStart(3, ' '), RULER.x + RULER.w * r, RULER.y - 22, { size: 14, align: r > 0.9 ? 'right' : 'left' });
    }
    if (t >= T.at('N10', '224')) {
      const k = easeBack(ramp(t, T.at('N10', '224'), T.at('N10', '224') + 0.3));
      rect(ctx, 270 - 240 * k, RULER.y + 36, 480 * k, 30, 'ink');
      if (k > 0.9) text(ctx, '1 scanline = 224 × 170 ns = 38.08 µs', 270, RULER.y + 43, { size: 15, colour: 'paper', align: 'center' });
    }

    // Memory is too slow for one word at a time, so the display reads pairs.
    const mem = T.at('N10', 'memorys');
    if (t < mem - 0.2) return;
    const tick = tickIndex(clock, t);
    const two = T.at('N10', 'two');
    rect(ctx, FIFO.x - 10, 450, FIFO.w + 20, 40, 'ink');
    text(ctx, 'MEMORY', FIFO.x + FIFO.w / 2, 462, { size: 15, colour: 'paper', align: 'center' });
    // The FIFO: 16 slots, filled two at a time, drained one per three ticks.
    frameRect(ctx, FIFO.x - 4, FIFO.y - 4, FIFO.w + 8, 16 * FIFO.slot + 8, 'ink', 3);
    text(ctx, 'FIFO', FIFO.x + FIFO.w / 2, FIFO.y + 16 * FIFO.slot + 10, { size: 13, align: 'center' });
    const passes = Math.max(0, tick - tickIndex(clock, two));
    const level = t < two ? 6 : 6 + (Math.floor(passes / 6) * 2) - Math.floor(passes / 3) + (passes % 6 >= 5 ? 2 : passes % 6 >= 4 ? 1 : 0);
    const lv = Math.max(2, Math.min(16, level));
    for (let i = 0; i < lv; i++) {
      const y = FIFO.y + (15 - i) * FIFO.slot;
      rect(ctx, FIFO.x + 4, y + 2, FIFO.w - 8, FIFO.slot - 4, 'blue');
    }
    // Before "two at a time": one word trickling slowly.
    if (t < two) {
      const k = ((t - mem) / 0.9) % 1;
      rect(ctx, FIFO.x + 30, 492 + k * 40, 40, 10, 'blue');
      text(ctx, 'one word… too slow', FIFO.x - 24, 464, { size: 14, align: 'right', colour: 'red' });
    } else {
      const k = ((t - two) / 0.35) % 1;
      rect(ctx, FIFO.x + 8, 492 + k * 30, 40, 10, 'blue');
      rect(ctx, FIFO.x + 52, 492 + k * 30, 40, 10, 'blue');
      text(ctx, 'two at a time', FIFO.x - 24, 464, { size: 14, align: 'right', colour: 'blue' });
    }

    // The display word task's loop, stepping one instruction per tick.
    const disp = T.at('N10', 'display');
    if (t >= disp) {
      const k = easeOut(ramp(t, disp, disp + 0.3));
      rect(ctx, LIST.x - 6, LIST.y - 30, 340 * k, LOOP.length * LIST.lh + 40, 'ink');
      text(ctx, 'DWT, the display word task', LIST.x, LIST.y - 24, { size: 12, colour: 'paper', weight: 'normal' });
      const cur = ((tick - tickIndex(clock, disp)) % 6 + 6) % 6;
      LOOP.forEach((l, i) => {
        const y = LIST.y + i * LIST.lh;
        if (i === cur && k >= 1) rect(ctx, LIST.x - 6, y - 3, 340, LIST.lh - 2, 'blue');
        if (k >= 1) text(ctx, l, LIST.x, y, { size: 14, colour: 'paper' });
      });
    }
    const px = T.at('N10', 'thirtytwo');
    if (t >= px) {
      const k = easeBack(ramp(t, px, px + 0.3));
      text(ctx, '2 words = 32 pixels', LIST.x, LIST.y + LOOP.length * LIST.lh + 24, { size: 17 * k + 1 });
    }
    const six = T.at('N10', 'six');
    if (t >= six) {
      const k = easeBack(ramp(t, six, six + 0.3));
      text(ctx, 'per 6 microinstructions', LIST.x, LIST.y + LOOP.length * LIST.lh + 50, { size: 17 * k + 1, colour: 'blue' });
    }
  },

  sounds(S, T, shot, clock) {
    S.clunk(shot.from + 0.3, { gain: 0.22 });
    const a = T.at('N10', 'scanline'), b = T.at('N10', 'cycles') + 0.2;
    S.sweep(a, { f0: 200, f1: 900, dur: b - a, gain: 0.02, wave: 'tri' });
    S.bell(T.at('N10', '224'), { freq: 1318.51, gain: 0.04, dur: 1.2 });
    // The loop: a display buzz on each DDR← MD, as the words land.
    const disp = T.at('N10', 'display');
    const first = clock.ticks.findIndex((x) => x >= disp);
    for (let k = first; k < clock.ticks.length && clock.ticks[k] < T.at('N11') - 0.4; k++) {
      const step = (k - first) % 6;
      if (step === 4 || step === 5) S.task('display', clock.ticks[k], 0.05, 0.9);
    }
  },
};
