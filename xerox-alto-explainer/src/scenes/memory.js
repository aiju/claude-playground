// Half the memory is the screen: 606 x 808 one-bit pixels = 30,704 words
// (38 words per line x 808 lines) = 61,408 bytes of a 131,072-byte machine.

import { clear, rect, frameRect, text, patternRect, titleTab, caption } from '../lib/draw.js';

export function drawMemory(ctx, { fill = 1 } = {}) {
  clear(ctx);
  titleTab(ctx, 'MAIN MEMORY', 30, 40, { size: 16 });
  text(ctx, '64K words × 16 bits = 128 KB', 30, 80, { size: 16 });

  // Memory as a tall bar of 64 rows (1K words each).
  const bx = 60;
  const by = 130;
  const bw = 150;
  const rows = 64;
  const rh = 9;
  frameRect(ctx, bx - 4, by - 4, bw + 8, rows * rh + 8, 'ink', 2);
  const screenRows = 30.0; // 30,704 words ~ 30K
  for (let i = 0; i < rows; i++) {
    const y = by + i * rh;
    const isScreen = i >= rows - screenRows;
    const lit = isScreen && (rows - 1 - i) < screenRows * fill;
    if (lit) rect(ctx, bx, y, bw, rh - 1, 'blue');
    else patternRect(ctx, bx, y, bw, rh - 1, 'ink', i % 7 === 3 ? 'checker' : 'dots');
  }
  text(ctx, '0', bx + bw + 12, by - 2, { size: 13 });
  text(ctx, '177777', bx + bw + 12, by + rows * rh - 14, { size: 13 });

  // The portrait screen it becomes.
  const sx = 290;
  const sy = 300;
  const sw = 200;
  const sh = 267;
  rect(ctx, sx - 8, sy - 8, sw + 16, sh + 16, 'ink');
  rect(ctx, sx, sy, sw, sh, 'paper');
  for (let y = 6; y < sh * fill - 4; y += 4) rect(ctx, sx + 8, sy + y, 60 + ((y * 53) % 120), 2, 'ink');
  text(ctx, '606 × 808', sx + sw / 2, sy + sh + 20, { size: 16, align: 'center' });
  text(ctx, '1 bit per pixel', sx + sw / 2, sy + sh + 42, { size: 16, align: 'center' });

  // Arrow from the lit block to the screen.
  rect(ctx, bx + bw + 8, by + 48 * rh, 70, 3, 'blue');

  text(ctx, '61,408 bytes', 390, 150, { size: 22, align: 'center' });
  text(ctx, '= 47% of memory', 390, 180, { size: 22, align: 'center', colour: 'blue' });
  text(ctx, 'text terminal: ~2 KB', 390, 222, { size: 14, align: 'center' });

  caption(ctx, ['Every pixel is a bit', 'in main memory.'], 842);
}
