// 3b. No program counter. The 1,024-word PROM as a grid; a lit cell hops
// from each microinstruction to the one it names, then a branch ORs a bit
// into the NEXT address and the hop swings between two neighbours.
// N4: "There's no program counter to increment. Every instruction names its
// successor, and a branch just ORs a bit into that address."
// The path is the emulator's real main loop (µcode L692–694, octal
// addresses): START 020 → START1 525 → 576, whose NEXT is MAYBE (526); the
// BUS=0 test ORs in the low bit, giving NOINT (527).

import { clear, rect, frameRect, text, header, dotted, line } from '../lib/draw.js';
import { ramp, easeOut, easeBack } from '../lib/time.js';
import { promGrid, promCell, oct, PROM } from './common.js';

const PATH = [0o20, 0o525, 0o576];
const MAYBE = 0o526, NOINT = 0o527;
const LABELS = { [0o20]: 'START', [0o525]: 'START1', [MAYBE]: 'MAYBE', [NOINT]: 'NOINT' };
const PANEL = 660;

// A label on a PROM cell: right, left, above or below it.
function tag(ctx, a, s, colour = 'ink', side = 'right') {
  const c = promCell(a);
  const w = s.length * 8 + 8;
  const x = side === 'right' ? c.x + c.w + 3 : side === 'left' ? c.x - w - 3 : c.x + c.w / 2 - w / 2;
  const y = side === 'above' ? c.y - 20 : side === 'below' ? c.y + c.h + 3 : c.y - 2;
  rect(ctx, x, y, w, 17, colour);
  text(ctx, s, x + 4, y + 2, { size: 12, colour: 'paper' });
}

// Hop times: one hop per path step, spread over "every instruction names its successor".
function hops(T) {
  const a = T.at('N4', 'every'), b = T.at('N4', 'branch') - 0.2;
  return PATH.map((_, i) => a + (i * (b - a)) / PATH.length);
}

export const prom = {
  draw(ctx, t, T, shot) {
    clear(ctx);
    header(ctx, 'MICROCODE PROM', '1,024 words · 32 × 32');
    const t0 = shot.from;
    // Rows cascade in.
    const shown = Math.floor(ramp(t, t0, t0 + 0.5) * 32);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, PROM.y - 2, 540, shown * 15 + 2);
    ctx.clip();
    promGrid(ctx, () => null);
    ctx.restore();

    // No program counter: the familiar PC + 1, struck out.
    const inc = T.at('N4', 'increment');
    const every = T.at('N4', 'every');
    if (t >= T.at('N4', 'program') && t < every) {
      frameRect(ctx, 150, PANEL + 10, 240, 60, 'ink', 3);
      text(ctx, 'PC ← PC + 1', 270, PANEL + 28, { size: 22, align: 'center' });
      if (t >= inc) {
        const k = easeOut(ramp(t, inc, inc + 0.2));
        line(ctx, 140, PANEL, 140 + 260 * k, PANEL + 80 * k, 'red', 6);
        line(ctx, 400, PANEL, 400 - 260 * k, PANEL + 80 * k, 'red', 6);
        if (k >= 1) text(ctx, 'no incrementer', 270, PANEL + 96, { size: 15, align: 'center', colour: 'red' });
      }
    }

    // Each instruction names its successor.
    const ht = hops(T);
    const branch = T.at('N4', 'branch') - 0.2;
    let at = null;
    PATH.forEach((a, i) => {
      if (t < ht[i]) return;
      at = i;
      const c = promCell(a);
      if (i > 0) {
        const p = promCell(PATH[i - 1]);
        dotted(ctx, p.x + 6, p.y + 6, c.x + 6, c.y + 6, 'red', 5, 3);
      }
    });
    PATH.forEach((a, i) => {
      if (t < ht[i]) return;
      const c = promCell(a);
      rect(ctx, c.x, c.y, c.w, c.h, i === at ? 'red' : 'ink');
      tag(ctx, a, LABELS[a] || oct(a), i === at ? 'red' : 'ink', a === 0o20 ? 'above' : a === 0o525 ? 'left' : 'right');
    });
    if (at !== null && t < branch + 0.1) {
      const a = PATH[at];
      const next = PATH[at + 1] ?? MAYBE;
      text(ctx, `@${oct(a)}   NEXT = ${oct(next)}`, 270, PANEL + 30, { size: 22, align: 'center' });
      text(ctx, 'each word names the next one', 270, PANEL + 70, { size: 15, align: 'center', weight: 'normal' });
    }

    // The branch: NEXT = 526, and the condition ORs into its low bit.
    if (t >= branch + 0.1) {
      const ors = T.at('N4', 'ors');
      const cell = 32, gap = 3, bx = 270 - (10 * (cell + gap)) / 2;
      const bits = MAYBE.toString(2).padStart(10, '0');
      const orTaken = t >= ors + 0.35;
      // After the OR, the condition flips back and forth to show both
      // outcomes: 1 → 527 NOINT, 0 → 526 MAYBE.
      const cond = !orTaken || Math.floor((t - ors - 0.35) / 0.7) % 2 === 0 ? 1 : 0;
      const low = orTaken ? cond : 0;
      text(ctx, 'NEXT of 576 = 526', bx, PANEL - 6, { size: 15 });
      for (let i = 0; i < 10; i++) {
        const x = bx + i * (cell + gap);
        const v = i === 9 ? String(low) : bits[i];
        const last = i === 9;
        rect(ctx, x, PANEL + 22, cell, cell, v === '1' ? (last ? 'red' : 'ink') : 'paper');
        frameRect(ctx, x, PANEL + 22, cell, cell, last ? 'red' : 'ink', 2);
        text(ctx, v, x + cell / 2, PANEL + 29, { size: 17, align: 'center', colour: v === '1' ? 'paper' : last ? 'red' : 'ink' });
      }
      // The condition bit drops onto the low bit.
      const lx = bx + 9 * (cell + gap);
      if (t >= ors - 0.3) {
        const drop = easeBack(ramp(t, ors, ors + 0.35));
        const y = PANEL - 30 + drop * 20;
        text(ctx, `OR  BUS=0 → ${cond}`, lx + cell, y + 1, { size: 13, align: 'right', colour: 'red' });
      }
      const target = low ? NOINT : MAYBE;
      if (orTaken) text(ctx, `= ${oct(target)} ${LABELS[target]}`, 270, PANEL + 72, { size: 22, align: 'center', colour: 'red' });
      // On the grid: both neighbours, the one that runs lit.
      for (const a of [MAYBE, NOINT]) {
        const c = promCell(a);
        rect(ctx, c.x, c.y, c.w, c.h, a === target && orTaken ? 'red' : 'paper');
        frameRect(ctx, c.x, c.y, c.w, c.h, 'red', 2);
      }
      if (orTaken) {
        const from = promCell(0o576), to = promCell(target);
        dotted(ctx, from.x + 6, from.y + 6, to.x + 6, to.y + 6, 'red', 4, 3);
      }
      tag(ctx, MAYBE, 'MAYBE 526', target === MAYBE && orTaken ? 'red' : 'ink', 'above');
      tag(ctx, NOINT, 'NOINT 527', target === NOINT && orTaken ? 'red' : 'ink', 'below');
    }
  },

  sounds(S, T, shot) {
    S.noise(shot.from, { dur: 0.5, gain: 0.03, fc: 1200, fcEnd: 5000, q: 1.2 });
    S.blip(T.at('N4', 'increment') + 0.05, { freq: 110, dur: 0.18, gain: 0.07, wave: 'square', lp: 900 });
    hops(T).forEach((h, i) => S.tick(h, { freq: 1400 + i * 300, gain: 0.07, decay: 0.02, noise: 0.15 }));
    const ors = T.at('N4', 'ors');
    S.flip(ors + 0.3);
    // The swing: alternate pitches for the two targets.
    for (let k = 0; ors + 0.35 + k * 0.7 < T.end('N4') + 0.4; k++) {
      S.tick(ors + 0.35 + k * 0.7, { freq: k % 2 ? 1568 : 1760, gain: 0.05, decay: 0.015, noise: 0.1 });
    }
  },
};
