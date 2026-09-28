// 3a. One microinstruction: 32 bits, field by field, lit as each is named.
// The bits flicker with the heartbeat, one new microinstruction per tick.
// N3: "Every 170 nanoseconds, it runs one 32-bit microinstruction: register,
// ALU op, bus source, two functions… and the address of the next one."
// Field widths: HW79 §2 and ContrAlto's MicroInstruction.cs.

import { clear, rect, frameRect, text, header, ditherRect } from '../lib/draw.js';
import { ramp, easeOut, hash, blink } from '../lib/time.js';
import { tickIndex } from '../audio/music.js';

const FIELDS = [
  { name: 'RSEL', bits: 5, what: 'register', colour: 'ink', cue: 'register' },
  { name: 'ALUF', bits: 4, what: 'ALU op', colour: 'blue', cue: 'alu' },
  { name: 'BS', bits: 3, what: 'bus source', colour: 'ink', cue: 'bus' },
  { name: 'F1', bits: 4, what: 'function', colour: 'yellow', cue: 'two' },
  { name: 'F2', bits: 4, what: 'function', colour: 'yellow', cue: 'functions' },
  { name: 'T', bits: 1, what: 'load T', colour: 'ink', cue: null },
  { name: 'L', bits: 1, what: 'load L', colour: 'ink', cue: null },
  { name: 'NEXT', bits: 10, what: 'next address', colour: 'red', cue: 'address' },
];
const CELL = 28, GAP = 2, X0 = (540 - 16 * (CELL + GAP)) / 2;
const ROWS = [300, 380];
const cueOf = (f, T) => (f.cue ? T.at('N3', f.cue) : T.at('N3', 'next') + 0.15);

export const microword = {
  draw(ctx, t, T, shot, clock) {
    clear(ctx);
    const tick = tickIndex(clock, t);
    header(ctx, 'ONE MICROINSTRUCTION', null);
    const sub = 'one every 170 ns';
    const typed = Math.floor(ramp(t, T.at('N3', '170'), T.at('N3', 'nanoseconds') + 0.2) * sub.length);
    if (typed) text(ctx, sub.slice(0, typed), 30, 80, { size: 16 });

    // The clock: a square wave that steps one period per heartbeat tick. It
    // starts big in the middle and moves up out of the way once the
    // microinstruction arrives.
    const clk = ramp(t, T.at('N3', '170'), T.at('N3', '170') + 0.5);
    if (clk > 0) {
      const up = easeOut(ramp(t, T.at('N3', 'runs') - 0.3, T.at('N3', 'runs') + 0.2));
      const period = Math.round(80 - 50 * up);
      const amp = Math.round(60 - 40 * up);
      const y = Math.round(420 - 300 * up);
      const off = (tick * period) % (2 * period);
      const w = 480 * clk;
      for (let x = 0; x < w; x += 1) {
        const hi = Math.floor((x + off) / (period / 2)) % 2 === 0;
        rect(ctx, 30 + x, hi ? y : y + amp, 1, 3, 'ink');
        if ((x + off) % (period / 2) === 0) rect(ctx, 30 + x, y, 3, amp + 3, 'ink');
      }
      const size = Math.round(28 - 16 * up);
      text(ctx, '170 ns', 30, y + amp + 10, { size, weight: up > 0.5 ? 'normal' : 'bold' });
      if (up < 1) text(ctx, '5.88 MHz', 510, y + amp + 10, { size, align: 'right', weight: 'normal' });
    }

    // A real line from Xerox's listing: the ADD instruction's key step.
    const runs = T.at('N3', 'runs');
    if (t >= runs) {
      const k = easeOut(ramp(t, runs, runs + 0.3));
      rect(ctx, 30, 180, 480 * k, 44, 'ink');
      const src = 'G16: L← ACDEST+T, TASK, :SHIFT;';
      const n = Math.floor(ramp(t, runs + 0.1, runs + 0.6) * src.length);
      text(ctx, src.slice(0, n), 42, 192, { size: 18, colour: 'paper' });
      if (k >= 1) text(ctx, 'Xerox microcode listing, 1979 (from ADD)', 30, 232, { size: 12, weight: 'normal' });
    }

    // The 32 bits, two rows of 16.
    const born = T.at('N3', '32bit');
    let bit = 0;
    FIELDS.forEach((f, fi) => {
      const lit = t >= cueOf(f, T);
      const start = bit;
      for (let i = 0; i < f.bits; i++, bit++) {
        const appear = born + bit * 0.015;
        if (t < appear) continue;
        const x = X0 + (bit % 16) * (CELL + GAP);
        const y = ROWS[Math.floor(bit / 16)];
        const on = hash(bit, Math.max(0, tick)) > 0.5;
        const colour = lit ? f.colour : 'ink';
        rect(ctx, x, y, CELL, CELL, on ? colour : 'paper');
        frameRect(ctx, x, y, CELL, CELL, colour, 2);
        if (!lit) ditherRect(ctx, x, y, CELL, CELL, 'paper', 0.5);
      }
      if (!lit) return;
      const k = ramp(t, cueOf(f, T), cueOf(f, T) + 0.25);
      const row = Math.floor(start / 16);
      text(ctx, f.name, X0 + (start % 16) * (CELL + GAP), ROWS[row] + CELL + 8, { size: 13, colour: f.colour === 'yellow' ? 'ink' : f.colour });
      if (Math.floor((bit - 1) / 16) !== row) text(ctx, f.name, X0, ROWS[row + 1] + CELL + 8, { size: 13, colour: f.colour });
      // Legend line.
      const ly = 480 + fi * 36;
      rect(ctx, 30, ly + 2, 18 * k, 18, f.colour);
      frameRect(ctx, 30, ly + 2, 18, 18, f.colour === 'yellow' ? 'ink' : f.colour, 1);
      text(ctx, `${f.name.padEnd(5)}${String(f.bits).padStart(3)} bits  ${f.what}`, 60, ly + 2, { size: 17, colour: f.name === 'NEXT' ? 'red' : 'ink' });
    });

    // The next address: the point of the whole thing.
    const nx = T.at('N3', 'next');
    if (t >= nx && blink(t, nx, 0.5)) frameRect(ctx, X0 + 6 * (CELL + GAP) - 4, ROWS[1] - 4, 10 * (CELL + GAP) + 6, CELL + 8, 'red', 3);
  },

  sounds(S, T) {
    S.noise(T.at('N3', 'runs') + 0.1, { dur: 0.5, gain: 0.03, fc: 5000, q: 1.5 });
    const born = T.at('N3', '32bit');
    for (let b = 0; b < 32; b++) S.tick(born + b * 0.015, { freq: 2000 + b * 60, gain: 0.025, decay: 0.004, noise: 0.3 });
    const notes = [587.33, 659.25, 698.46, 783.99, 880];
    FIELDS.filter((f) => f.cue && f.name !== 'NEXT').forEach((f, i) => S.blip(T.at('N3', f.cue), { freq: notes[i], dur: 0.07, gain: 0.036, wave: 'square', lp: 2500 }));
    S.flip(T.at('N3', 'address'));
    S.blip(T.at('N3', 'next'), { freq: 1174.66, dur: 0.12, gain: 0.05, wave: 'tri' });
  },
};
