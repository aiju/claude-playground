// 4a. The computer is a program. The Nova-like instruction set programmers
// saw dissolves into the PROM as task 0's microcode; then one ADD runs
// through its eight microinstructions, timed against a real Nova 1200.
// N5: "Even the instruction set programmers saw — a Data General Nova
// lookalike — is just a microcode program. An ADD is eight
// microinstructions: 1.36 microseconds. A real Nova 1200 took 1.35."
// ADD path: our trace of the 1979 listing (micromachine notes §3.3).
// Nova 1200 timing: Data General, How to Use the Nova Computers (1974), D12.

import { clear, rect, frameRect, text, header, dotted, ditherRect, titleTab } from '../lib/draw.js';
import { ramp, easeOut } from '../lib/time.js';
import { promGrid, promCell, oct, PROM } from './common.js';

export const ADD_PATH = [0o20, 0o525, 0o576, 0o527, 0o535, 0o612, 0o556, 0o533];
const OPS = [
  ['LDA', 'STA', 'JMP', 'JSR'],
  ['ISZ', 'DSZ', 'COM', 'NEG'],
  ['MOV', 'INC', 'ADC', 'SUB'],
  ['ADD', 'AND', 'SKP', 'SZC'],
  ['CYCLE', 'BLT', 'BITBLT', 'CONVERT'],
];
// Task 0's words, drawn as one block: 628 of the 1,024 (micromachine notes §3.1).
const EMULATOR_WORDS = 628;
const BAR = { x: 70, w: 400, y: 700 };

function steps(T) {
  const a = T.at('N5', 'eight'), b = T.at('N5', '136') - 0.1;
  return ADD_PATH.map((_, i) => a + (i * (b - a)) / (ADD_PATH.length - 1));
}

export const add = {
  draw(ctx, t, T) {
    clear(ctx);
    const micro = T.at('N5', 'microcode');
    const addAt = T.at('N5', 'add');
    if (t < addAt) header(ctx, 'THE INSTRUCTION SET', 'what programmers saw');
    else {
      titleTab(ctx, 'ADD 1,2', 30, 34, { size: 28 });
      text(ctx, 'AC2 ← AC2 + AC1', 200, 44, { size: 16 });
      text(ctx, 'as microcode', 30, 84, { size: 16 });
    }

    // The instruction set as a listing card, until it turns into microcode.
    const dissolve = ramp(t, micro, micro + 0.7);
    if (dissolve < 1) {
      rect(ctx, PROM.x, PROM.y, 480, 480, 'ink');
      OPS.forEach((row, j) => row.forEach((op, i) => {
        const appear = T.at('N5', 'instruction') + (j * 4 + i) * 0.04;
        if (t >= appear) text(ctx, op, PROM.x + 60 + i * 110, PROM.y + 60 + j * 70, { size: op.length > 4 ? 16 : 26, colour: 'paper', align: 'center' });
      }));
      if (t >= T.at('N5', 'data')) {
        const k = easeOut(ramp(t, T.at('N5', 'data'), T.at('N5', 'data') + 0.3));
        rect(ctx, PROM.x + 40, PROM.y + 400, 400 * k, 44, 'paper');
        if (k >= 1) text(ctx, '≈ Data General Nova', 270, PROM.y + 411, { size: 20, align: 'center' });
      }
    }
    if (dissolve > 0) {
      ctx.save();
      // Reveal the PROM through the dissolving card with an ordered dither.
      promGrid(ctx, (a) => (a < EMULATOR_WORDS ? 'dim' : null));
      ctx.restore();
      if (dissolve < 1) ditherRect(ctx, PROM.x, PROM.y, 480, 480, 'ink', 1 - dissolve);
      if (t >= micro + 0.5 && t < addAt + 0.2) {
        rect(ctx, 60, PROM.y + 500, 420, 30, 'ink');
        text(ctx, `task 0: the Nova emulator, ${EMULATOR_WORDS} words`, 270, PROM.y + 506, { size: 15, colour: 'paper', align: 'center' });
      }
    }

    // The eight microinstructions of one ADD.
    const st = steps(T);
    let n = 0;
    ADD_PATH.forEach((a, i) => {
      if (t < st[i]) return;
      n = i + 1;
      if (i > 0) {
        const p = promCell(ADD_PATH[i - 1]), c = promCell(a);
        dotted(ctx, p.x + 6, p.y + 6, c.x + 6, c.y + 6, 'red', 5, 3);
      }
    });
    ADD_PATH.forEach((a, i) => {
      if (t < st[i]) return;
      const c = promCell(a);
      rect(ctx, c.x - 2, c.y - 2, c.w + 4, c.h + 4, i === n - 1 ? 'red' : 'ink');
      text(ctx, String(i + 1), c.x + c.w / 2, c.y + 1, { size: 11, colour: 'paper', align: 'center' });
    });
    if (n > 0) {
      text(ctx, `${n} of 8 microinstructions   @${oct(ADD_PATH[n - 1])}`, 30, 650, { size: 16 });
      // The Alto's time: eight 170 ns cycles.
      const segW = BAR.w / 8;
      for (let i = 0; i < n; i++) {
        rect(ctx, BAR.x + i * segW, BAR.y, segW - 3, 26, 'red');
      }
      frameRect(ctx, BAR.x - 3, BAR.y - 3, BAR.w + 3, 32, 'ink', 1);
      text(ctx, 'Alto', BAR.x - 8, BAR.y + 5, { size: 14, align: 'right' });
      if (t >= T.at('N5', '136')) text(ctx, '8 × 170 ns = 1.36 µs', BAR.x + BAR.w, BAR.y + 36, { size: 16, align: 'right', colour: 'red' });
    }
    // A real Nova 1200, for comparison: its bar runs like a stopwatch.
    const real = T.at('N5', 'real');
    if (t >= real) {
      const k = ramp(t, real, T.at('N5', '135') + 0.1);
      const w = (BAR.w * 1.35) / 1.36;
      const y = BAR.y + 70;
      rect(ctx, BAR.x, y, w * k, 26, 'ink');
      frameRect(ctx, BAR.x - 3, y - 3, BAR.w + 3, 32, 'ink', 1);
      text(ctx, 'Nova', BAR.x - 8, y + 5, { size: 14, align: 'right' });
      text(ctx, `Nova 1200: ${(1.35 * k).toFixed(2)} µs`, BAR.x + BAR.w, y + 36, { size: 16, align: 'right' });
    }
  },

  sounds(S, T) {
    const inst = T.at('N5', 'instruction');
    for (let i = 0; i < 20; i++) S.tick(inst + i * 0.04, { freq: 3000 + (i % 4) * 400, gain: 0.02, decay: 0.004, noise: 0.5 });
    S.noise(T.at('N5', 'microcode'), { dur: 0.7, gain: 0.05, fc: 4000, fcEnd: 500, q: 1.5 });
    const notes = [587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66];
    steps(T).forEach((s, i) => S.blip(s, { freq: notes[i], dur: 0.06, gain: 0.04, wave: 'square', lp: 3000 }));
    S.bell(T.at('N5', '136'), { freq: 1174.66, gain: 0.04, dur: 1.2 });
    const real = T.at('N5', 'real');
    S.sweep(real, { f0: 300, f1: 600, dur: T.at('N5', '135') + 0.1 - real, gain: 0.015, wave: 'tri' });
    S.bell(T.at('N5', '135') + 0.1, { freq: 1108.73, gain: 0.04, dur: 1.2 });
  },
};
