// 7b. The disk word task: one microinstruction stores the word and folds it
// into the checksum.
// N13: "The disk task stores a word and updates the checksum in one
// microinstruction."
// `MD← L← KDATA XOR T, TASK, :RW1;` — the bus carries the disk word to
// memory while the ALU XORs it into the checksum, which starts at 521₈
// (µcode L2003, L1990).

import { clear, rect, frameRect, text, header, line, disc, ring, arrow } from '../lib/draw.js';
import { ramp, easeOut, easeBack, blink } from '../lib/time.js';
import { oct } from './common.js';

const WORD = 0o131615;
const SEED = 0o521;
const SR = { x: 62, y: 330, cell: 24, gap: 2 };
const MEM = { x: 60, y: 470, w: 170 };
const SUM = { x: 290, y: 600, w: 200 };

export const disk = {
  draw(ctx, t, T, shot) {
    clear(ctx);
    header(ctx, 'DISK WORD TASK', 'task 16: every word, in microcode');
    const t0 = shot.from;
    const stores = T.at('N13', 'stores');
    const updates = T.at('N13', 'updates');
    const one = T.at('N13', 'one');

    // The platter spinning under the head.
    const spin = (t - t0) * 9;
    disc(ctx, 130, 220, 88, 'ink');
    ring(ctx, 130, 220, 60, 'paper', 1);
    ring(ctx, 130, 220, 36, 'paper', 1);
    disc(ctx, 130, 220, 14, 'paper');
    for (let i = 0; i < 12; i++) {
      const a = spin + (i / 12) * Math.PI * 2;
      rect(ctx, 130 + Math.cos(a) * 74 - 2, 220 + Math.sin(a) * 74 - 2, 4, 4, 'paper');
    }
    line(ctx, 300, 160, 190, 214, 'ink', 6);
    rect(ctx, 180, 208, 18, 14, 'red');
    text(ctx, 'head', 306, 150, { size: 13, weight: 'normal' });

    // Bits shift in until a whole word has arrived.
    const bits = WORD.toString(2).padStart(16, '0');
    const n = Math.min(16, Math.floor(ramp(t, t0 + 0.2, stores - 0.1) * 17));
    text(ctx, 'shift register', SR.x, SR.y - 22, { size: 13, weight: 'normal' });
    for (let i = 0; i < 16; i++) {
      const x = SR.x + i * (SR.cell + SR.gap);
      const v = i < n ? bits[16 - n + i] : null;
      const leaving = t >= stores;
      rect(ctx, x, SR.y, SR.cell, SR.cell, v === '1' && !leaving ? 'red' : 'paper');
      frameRect(ctx, x, SR.y, SR.cell, SR.cell, 'ink', 2);
      if (v && !leaving) text(ctx, v, x + SR.cell / 2, SR.y + 4, { size: 14, align: 'center', colour: v === '1' ? 'paper' : 'ink' });
    }

    // The word drops out and splits: memory on one side, checksum on the other.
    const drop = easeOut(ramp(t, stores, stores + 0.45));
    const value = oct(WORD, 6);
    rect(ctx, MEM.x, MEM.y, MEM.w, 240, 'paper');
    frameRect(ctx, MEM.x, MEM.y, MEM.w, 240, 'ink', 2);
    text(ctx, 'MEMORY', MEM.x, MEM.y - 20, { size: 13 });
    for (let i = 0; i < 5; i++) text(ctx, oct((WORD * (i + 3) * 2654435761) >>> 16 & 0xffff, 6), MEM.x + MEM.w / 2, MEM.y + 12 + i * 30, { size: 16, align: 'center', weight: 'normal' });
    const sumLanded = t >= stores + 0.45;
    frameRect(ctx, SUM.x, SUM.y, SUM.w, 44, 'yellow', 4);
    text(ctx, 'CHECKSUM', SUM.x, SUM.y - 20, { size: 13 });
    const sum = sumLanded ? SEED ^ WORD : SEED;
    text(ctx, oct(sum, 6), SUM.x + SUM.w / 2, SUM.y + 10, { size: 22, align: 'center' });
    // XOR gate.
    ring(ctx, 390, 520, 18, 'ink', 3);
    rect(ctx, 389, 504, 3, 33, 'ink');
    rect(ctx, 374, 519, 33, 3, 'ink');
    if (t >= stores) {
      const sx = SR.x + 8 * (SR.cell + SR.gap);
      if (drop < 1) {
        const ax = sx + (MEM.x + MEM.w / 2 - sx) * drop, ay = SR.y + 30 + (MEM.y + 165 - SR.y - 30) * drop;
        const bx = sx + (390 - sx) * drop, by = SR.y + 30 + (520 - SR.y - 30) * drop;
        rect(ctx, ax - 50, ay, 100, 22, 'red');
        rect(ctx, bx - 50, by, 100, 22, 'red');
      } else {
        rect(ctx, MEM.x + 4, MEM.y + 160, MEM.w - 8, 26, 'red');
        text(ctx, value, MEM.x + MEM.w / 2, MEM.y + 165, { size: 16, align: 'center', colour: 'paper' });
        arrow(ctx, 390, 540, 390, SUM.y - 6, 'ink', 3, 10);
      }
      text(ctx, value, 440, 470, { size: 14, weight: 'normal' });
      if (sumLanded && t < updates + 0.8 && blink(t, stores + 0.45, 0.25)) frameRect(ctx, SUM.x - 4, SUM.y - 4, SUM.w + 8, 52, 'red', 3);
      if (sumLanded) text(ctx, `521 XOR ${value}`, SUM.x + SUM.w / 2, SUM.y + 52, { size: 13, align: 'center', weight: 'normal' });
    }

    // The single microinstruction that did both.
    if (t >= one - 0.1) {
      const k = easeBack(ramp(t, one - 0.1, one + 0.25));
      rect(ctx, 30, 740, 480 * k, 44, 'ink');
      if (k > 0.9) text(ctx, 'MD← L← KDATA XOR T, TASK, :RW1;', 270, 752, { size: 16, colour: 'paper', align: 'center' });
      if (k > 0.9) {
        titleTab(ctx, '1 microinstruction = 170 ns', 30, 794, 'red');
      }
    }
  },

  sounds(S, T, shot) {
    S.tone(shot.from, { freq: 55, dur: T.at('N14') - shot.from - 0.3, gain: 0.03, wave: 'tri', attack: 0.2, release: 0.3 });
    const stores = T.at('N13', 'stores');
    for (let i = 0; i < 16; i++) S.tick(shot.from + 0.2 + (i / 17) * (stores - 0.3 - shot.from), { freq: 2600, gain: 0.02, decay: 0.004, noise: 0.4 });
    S.headClick(shot.from + 0.15);
    S.task('disk', stores + 0.45, 0.04, 1);
    S.flip(stores + 0.45);
    S.bell(T.at('N13', 'one'), { freq: 1567.98, gain: 0.04, dur: 1 });
  },
};

function titleTab(ctx, s, x, y, colour) {
  ctx.font = 'bold 15px "DejaVu Sans Mono", monospace';
  const w = ctx.measureText(s).width + 12;
  rect(ctx, x, y, w, 24, colour);
  text(ctx, s, x + 6, y + 4, { size: 15, colour: 'paper' });
}
