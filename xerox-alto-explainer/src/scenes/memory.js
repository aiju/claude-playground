// 6a. The screen eats the machine: 606 x 808 one-bit pixels are 30,704
// words (38 words a line x 808 lines), 47% of the 64K-word memory.
// N9: "The screen is a 606 by 808 bitmap — nearly half of main memory."

import { clear, rect, frameRect, text, header, patternRect, arrow } from '../lib/draw.js';
import { ramp, easeOut, easeBack } from '../lib/time.js';
import { altoScreen } from './common.js';

const BX = 50, BY = 140, BW = 150, ROWS = 64, RH = 9; // memory: 64 rows of 1K words
const SCREEN_ROWS = 30; // 30,704 words ≈ 30K
const SX = 300, SY = 250, SW = 195, SH = 260; // the screen, 3:4

export const memory = {
  draw(ctx, t, T, shot) {
    clear(ctx);
    header(ctx, 'MAIN MEMORY', '64K words × 16 bits = 128 KB');
    const t0 = shot.from;
    const fillFrom = T.at('N9', 'bitmap'), fillTo = T.at('N9', 'half') + 0.2;
    const fill = ramp(t, fillFrom, fillTo);

    // Memory as a tall bar of 64 rows, 1K words each; the screen's share
    // fills in blue from the top of memory down.
    const rows = Math.floor(ramp(t, t0, t0 + 0.4) * ROWS);
    frameRect(ctx, BX - 4, BY - 4, BW + 8, ROWS * RH + 8, 'ink', 2);
    for (let i = 0; i < rows; i++) {
      const y = BY + i * RH;
      const screenRow = ROWS - 1 - i < SCREEN_ROWS;
      const lit = screenRow && ROWS - 1 - i < SCREEN_ROWS * fill;
      if (lit) rect(ctx, BX, y, BW, RH - 1, 'blue');
      else patternRect(ctx, BX, y, BW, RH - 1, 'ink', i % 7 === 3 ? 'checker' : 'dots');
    }
    text(ctx, '0', BX + BW + 10, BY - 4, { size: 13 });
    text(ctx, '177777', BX + BW + 10, BY + ROWS * RH - 12, { size: 13 });

    // The screen, sized as it's named.
    const s = easeBack(ramp(t, T.at('N9', 'screen'), T.at('N9', 'screen') + 0.35));
    if (s > 0) {
      const w = SW * s, h = SH * s;
      const x = SX + (SW - w) / 2, y = SY + (SH - h) / 2;
      altoScreen(ctx, x, y, w, h, { bezel: 8 });
      if (s >= 1) {
        // Bits fill the glass line by line, in step with memory.
        for (let yy = 4; yy < SH * fill - 3; yy += 3) {
          rect(ctx, SX + 6, SY + yy, 40 + ((yy * 53) % (SW - 60)), 1, 'blue');
        }
      }
    }
    const w606 = easeOut(ramp(t, T.at('N9', '606'), T.at('N9', '606') + 0.3));
    if (w606 > 0) {
      const y = SY - 26;
      rect(ctx, SX, y, SW * w606, 2, 'ink');
      rect(ctx, SX, y - 5, 2, 12, 'ink');
      if (w606 >= 1) rect(ctx, SX + SW - 2, y - 5, 2, 12, 'ink');
      text(ctx, '606', SX + SW / 2, y - 26, { size: 20, align: 'center' });
    }
    const h808 = easeOut(ramp(t, T.at('N9', '808'), T.at('N9', '808') + 0.3));
    if (h808 > 0) {
      const x = SX + SW + 20;
      rect(ctx, x, SY, 2, SH * h808, 'ink');
      rect(ctx, x - 5, SY, 12, 2, 'ink');
      if (h808 >= 1) rect(ctx, x - 5, SY + SH - 2, 12, 2, 'ink');
      text(ctx, '808', x - 8, SY + SH + 14, { size: 20 });
    }
    if (t >= fillFrom) {
      arrow(ctx, BX + BW + 12, BY + (ROWS - SCREEN_ROWS / 2) * RH, SX - 14, SY + SH / 2, 'blue', 3, 12);
      text(ctx, '1 bit per pixel', SX + SW / 2, SY + SH + 44, { size: 15, align: 'center' });
    }
    if (t >= T.at('N9', 'nearly')) {
      const k = easeBack(ramp(t, T.at('N9', 'nearly'), T.at('N9', 'nearly') + 0.3));
      text(ctx, '30,704 words', 400, 640, { size: 20 * k + 1, align: 'center' });
      text(ctx, '= 61,408 bytes', 400, 670, { size: 16 * k + 1, align: 'center' });
    }
    if (t >= T.at('N9', 'half')) {
      const k = easeBack(ramp(t, T.at('N9', 'half'), T.at('N9', 'half') + 0.3));
      rect(ctx, 400 - 95 * k, 710, 190 * k, 46, 'blue');
      if (k > 0.9) text(ctx, '47%', 400, 718, { size: 30, colour: 'paper', align: 'center' });
      text(ctx, 'of all memory', 400, 766, { size: 16, align: 'center' });
    }
  },

  sounds(S, T) {
    S.blip(T.at('N9', 'screen'), { freq: 440, dur: 0.06, gain: 0.04, wave: 'square', lp: 2500 });
    S.tick(T.at('N9', '606') + 0.3, { freq: 1500, gain: 0.05 });
    S.tick(T.at('N9', '808') + 0.3, { freq: 1800, gain: 0.05 });
    const a = T.at('N9', 'bitmap'), b = T.at('N9', 'half') + 0.2;
    for (let i = 0; i < SCREEN_ROWS; i++) S.task('display', a + (i / SCREEN_ROWS) * (b - a), 0.025, 0.7);
    S.bell(T.at('N9', 'half'), { freq: 880, gain: 0.04, dur: 1.2 });
  },
};
