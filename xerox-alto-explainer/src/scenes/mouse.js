// 7a. Memory refresh is a task too, and on its way it reads the mouse.
// N12: "Even DRAM refresh is microcode — and on its way through, that task
// counts the mouse."
// MRT (task 10) runs once per scanline; about 11 of its microinstructions
// read one of 9 possible moves and add ±1 to X and Y at 424₈ and 425₈. The
// buttons are bits in memory. (µcode L556–574; Thacker79 §3.5.)

import { clear, rect, frameRect, text, header, ditherRect, titleTab } from '../lib/draw.js';
import { ramp, easeOut, easeBack, hash } from '../lib/time.js';
import { chip, oct } from './common.js';
import { tickIndex } from '../audio/music.js';

const CHIP = { x: 70, y: 150, w: 400, h: 280 };
const COLS = 16, ROWS = 10, CELL = 20, GAP = 3;
const PAD = { x: 50, y: 560, cell: 48 };
const ARROWS = ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'];

// The mouse's move on tick k: one of the 9 cells of the pad.
const move = (k) => Math.floor(hash(k, 77) * 9);
function position(k0, k) {
  let x = 0o433, y = 0o267;
  for (let i = k0; i <= k; i++) {
    const m = move(i);
    x += (m % 3) - 1;
    y += Math.floor(m / 3) - 1;
  }
  return { x, y };
}

export const mouse = {
  draw(ctx, t, T, shot, clock) {
    clear(ctx);
    header(ctx, 'MEMORY REFRESH', 'task 10 (MRT), once per scanline');
    const tick = tickIndex(clock, t);
    const t0 = shot.from;

    // The DRAM: each tick the refresh task re-reads one row; rows fade the
    // longer they go unread.
    const inK = easeBack(ramp(t, t0, t0 + 0.35));
    const cx = CHIP.x + (CHIP.w * (1 - inK)) / 2, cw = CHIP.w * inK;
    chip(ctx, cx, CHIP.y, cw, CHIP.h, { colour: 'paper' });
    frameRect(ctx, cx, CHIP.y, cw, CHIP.h, 'ink', 3);
    if (inK >= 1) {
      text(ctx, 'DRAM', CHIP.x + 14, CHIP.y + 12, { size: 14 });
      const gx = CHIP.x + (CHIP.w - COLS * (CELL + GAP)) / 2;
      const gy = CHIP.y + 44;
      const cur = ((tick % ROWS) + ROWS) % ROWS;
      for (let r = 0; r < ROWS; r++) {
        const age = (cur - r + ROWS) % ROWS; // ticks since this row was refreshed
        for (let c = 0; c < COLS; c++) {
          const x = gx + c * (CELL + GAP), y = gy + r * (CELL + GAP);
          if (hash(r, c, 3) > 0.45) rect(ctx, x, y, CELL, CELL, 'ink');
          else frameRect(ctx, x, y, CELL, CELL, 'ink', 1);
          if (age > 0) ditherRect(ctx, x, y, CELL, CELL, 'paper', (age / ROWS) * 0.75);
        }
        if (r === cur) frameRect(ctx, gx - 6, y0(gy, r) - 4, COLS * (CELL + GAP) + 9, CELL + 8, 'yellow', 4);
      }
      text(ctx, 'rows fade unless re-read', CHIP.x, CHIP.y + CHIP.h + 16, { size: 13, weight: 'normal' });
    }
    const micro = T.at('N12', 'microcode');
    if (t >= micro) {
      const k = easeBack(ramp(t, micro, micro + 0.3));
      rect(ctx, 300, CHIP.y + CHIP.h + 10, 170 * k, 26, 'yellow');
      if (k > 0.9) text(ctx, 'by microcode', 385, CHIP.y + CHIP.h + 15, { size: 14, align: 'center' });
    }

    // On its way through: the mouse.
    const way = T.at('N12', 'way');
    if (t < way) return;
    const k0 = tickIndex(clock, way);
    const m = move(tick);
    const inM = easeOut(ramp(t, way, way + 0.3));
    titleTab(ctx, 'MOUSE', PAD.x, PAD.y - 44, { size: 14 });
    for (let i = 0; i < 9; i++) {
      const x = PAD.x + (i % 3) * PAD.cell, y = PAD.y + Math.floor(i / 3) * PAD.cell;
      const lit = i === m;
      rect(ctx, x, y, (PAD.cell - 4) * inM, PAD.cell - 4, lit ? 'yellow' : 'paper');
      frameRect(ctx, x, y, (PAD.cell - 4) * inM, PAD.cell - 4, 'ink', 2);
      if (inM >= 1) text(ctx, ARROWS[i], x + PAD.cell / 2 - 2, y + 12, { size: 20, align: 'center' });
    }
    text(ctx, '1 of 9 moves per scanline', PAD.x, PAD.y + 3 * PAD.cell + 6, { size: 13, weight: 'normal' });
    const pos = position(k0, tick);
    const counts = T.at('N12', 'counts');
    [['424', 'X', pos.x], ['425', 'Y', pos.y]].forEach(([addr, name, v], j) => {
      const y = PAD.y + j * 64;
      text(ctx, addr, 250, y + 10, { size: 15, weight: 'normal' });
      rect(ctx, 300, y, 190, 44, t >= counts ? 'ink' : 'paper');
      frameRect(ctx, 300, y, 190, 44, 'ink', 2);
      text(ctx, `${name} = ${oct(v, 4)}`, 395, y + 10, { size: 20, align: 'center', colour: t >= counts ? 'paper' : 'ink' });
    });
    text(ctx, 'memory words, ±1 each time', 250, PAD.y + 128, { size: 13, weight: 'normal' });
    // The buttons are just bits.
    const btn = T.at('N12', 'mouse');
    if (t >= btn - 0.2) {
      ['RED', 'YELLOW', 'BLUE'].forEach((b, i) => {
        const on = hash(tick, i, 9) > 0.55;
        const x = 250 + i * 82, y = 760;
        const colour = ['red', 'yellow', 'blue'][i];
        rect(ctx, x, y, 74, 30, on ? colour : 'paper');
        frameRect(ctx, x, y, 74, 30, colour === 'yellow' ? 'ink' : colour, 2);
        text(ctx, b, x + 37, y + 8, { size: 12, align: 'center', colour: on && colour !== 'yellow' ? 'paper' : 'ink' });
      });
    }
  },

  sounds(S, T, shot, clock) {
    const a = shot.from + 0.3, b = T.at('N13') - 0.4;
    const way = T.at('N12', 'way');
    for (let k = clock.ticks.findIndex((x) => x >= a); k >= 0 && clock.ticks[k] < b; k++) {
      S.task('refresh', clock.ticks[k], 0.02, 0.8);
      if (clock.ticks[k] >= way) S.tick(clock.ticks[k] + 0.03, { freq: 5200, gain: 0.02, decay: 0.004, noise: 0.5 });
    }
    S.blip(T.at('N12', 'microcode'), { freq: 1318.51, dur: 0.08, gain: 0.04, wave: 'tri' });
    S.blip(T.at('N12', 'counts'), { freq: 987.77, dur: 0.06, gain: 0.04, wave: 'square', lp: 2500 });
  },
};

const y0 = (gy, r) => gy + r * (CELL + GAP);
