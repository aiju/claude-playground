// One 32-bit microinstruction, field by field (widths from ContrAlto's
// MicroInstruction.cs; to be re-checked against the hardware manual).

import { clear, rect, frameRect, text, titleTab, caption } from '../lib/draw.js';

export const FIELDS = [
  { name: 'RSEL', bits: 5, what: 'register' },
  { name: 'ALUF', bits: 4, what: 'ALU op' },
  { name: 'BS', bits: 3, what: 'bus source' },
  { name: 'F1', bits: 4, what: 'function' },
  { name: 'F2', bits: 4, what: 'function' },
  { name: 'T', bits: 1, what: 'load T' },
  { name: 'L', bits: 1, what: 'load L' },
  { name: 'NEXT', bits: 10, what: 'next address' },
];

const ACCENT = { NEXT: 'red', F1: 'yellow', F2: 'yellow', ALUF: 'blue' };

// Default line: the Nova ADD, straight from Xerox's 1979 Alto II microcode
// listing (altoIIcode3.mu, label G16; the listing writes ← as _).
export function drawMicroword(ctx, { line = 'L← ACDEST+T, TASK, :SHIFT;', highlight = 'NEXT' } = {}) {
  clear(ctx);
  titleTab(ctx, 'ONE MICROINSTRUCTION', 30, 40, { size: 16 });
  text(ctx, '32 bits · one every 170 ns', 30, 80, { size: 16 });

  // The source line, as it would appear in a listing.
  rect(ctx, 30, 130, 480, 50, 'ink');
  text(ctx, line, 44, 144, { size: 20, colour: 'paper' });

  // Bits: 32 cells in two rows of 16 so they stay readable in portrait.
  const cell = 28;
  const gap = 2;
  const x0 = (540 - 16 * (cell + gap)) / 2;
  let bit = 0;
  const rows = [240, 360];
  for (const f of FIELDS) {
    const colour = f.name === highlight ? 'red' : ACCENT[f.name] || 'ink';
    const start = bit;
    for (let i = 0; i < f.bits; i++, bit++) {
      const row = Math.floor(bit / 16);
      const x = x0 + (bit % 16) * (cell + gap);
      const y = rows[row];
      const on = ((bit * 2654435761) >>> 28) & 1;
      rect(ctx, x, y, cell, cell, on ? colour : 'paper');
      frameRect(ctx, x, y, cell, cell, colour, 2);
    }
    // Label under the first cell of each field (split fields label twice).
    const row = Math.floor(start / 16);
    const lx = x0 + (start % 16) * (cell + gap);
    text(ctx, f.name, lx, rows[row] + cell + 8, { size: 13, colour });
    if (Math.floor((bit - 1) / 16) !== row) {
      text(ctx, f.name, x0, rows[row + 1] + cell + 8, { size: 13, colour });
    }
  }

  // Field legend.
  let y = 470;
  for (const f of FIELDS) {
    const colour = f.name === highlight ? 'red' : ACCENT[f.name] || 'ink';
    rect(ctx, 40, y + 3, 14, 14, colour);
    text(ctx, `${f.name.padEnd(5)} ${String(f.bits).padStart(2)} bits  ${f.what}`, 66, y, { size: 16 });
    y += 30;
  }

  caption(ctx, ['No program counter:', 'every instruction names', 'the next one.'], 800);
}
