// 7c. The Ethernet: a bit every two cycles, and dice made from the refresh
// clock.
// N14: "Ethernet sends a bit every two cycles — hence 2.94 megabits — and
// its random backoff is read off the refresh counter."
// Bit time 2 × 170 ns (HW79 §7.2). Backoff = (refresh tick count mod 256)
// AND a mask that gains a 1 per collision (µcode L398–424).

import { clear, rect, frameRect, text, header, titleTab } from '../lib/draw.js';
import { ramp, easeBack, hash, blink } from '../lib/time.js';
import { tickIndex } from '../audio/music.js';

const RUNG = 24; // one microcycle on the ladder
const LADDER = { x: 30, w: 480, y: 250, h: 110 };
const WAVE = { y: 150, h: 50 };

// Manchester: every bit has a transition in its middle.
const bitAt = (i) => (hash(i, 5) > 0.5 ? 1 : 0);

export const ether = {
  draw(ctx, t, T, shot, clock) {
    clear(ctx);
    header(ctx, 'ETHERNET', 'task 7: a bit every two cycles');
    const t0 = shot.from;
    const tick = tickIndex(clock, t);
    // The ladder scrolls one rung per heartbeat tick (smoothly in between).
    const ti = clock.ticks[Math.max(0, tick)], tn = clock.ticks[Math.max(0, tick) + 1] ?? ti + 0.1;
    const frac = Math.min(1, (t - ti) / (tn - ti));
    const shift = (tick + frac) * RUNG;
    ctx.save();
    ctx.beginPath();
    ctx.rect(LADDER.x, 120, LADDER.w, 280);
    ctx.clip();
    const first = Math.floor(shift / RUNG);
    for (let r = first - 1; r < first + LADDER.w / RUNG + 2; r++) {
      const x = LADDER.x + r * RUNG - shift;
      const bitEdge = r % 2 === 0;
      rect(ctx, x, LADDER.y, bitEdge ? 3 : 1, LADDER.h, 'ink');
      // Manchester waveform: bit b spans rungs 2b..2b+2, flipping in the middle.
      if (bitEdge) {
        const b = bitAt(r / 2);
        const hiFirst = b === 0;
        rect(ctx, x, hiFirst ? WAVE.y : WAVE.y + WAVE.h, RUNG, 3, 'yellow');
        rect(ctx, x + RUNG, hiFirst ? WAVE.y + WAVE.h : WAVE.y, RUNG, 3, 'yellow');
        rect(ctx, x + RUNG, WAVE.y, 3, WAVE.h + 3, 'yellow');
        if (bitAt(r / 2 + 1) === b) rect(ctx, x + 2 * RUNG, WAVE.y, 3, WAVE.h + 3, 'yellow');
        text(ctx, String(b), x + RUNG, WAVE.y + WAVE.h + 12, { size: 14, align: 'center' });
      }
    }
    rect(ctx, LADDER.x, LADDER.y, LADDER.w, 2, 'ink');
    rect(ctx, LADDER.x, LADDER.y + LADDER.h - 2, LADDER.w, 2, 'ink');
    ctx.restore();
    text(ctx, 'cycles (170 ns)', LADDER.x, LADDER.y + LADDER.h + 8, { size: 13, weight: 'normal' });
    text(ctx, 'Manchester-coded bits', LADDER.x, WAVE.y - 24, { size: 13, weight: 'normal' });
    const two = T.at('N14', 'two');
    if (t >= two) {
      const k = easeBack(ramp(t, two, two + 0.3));
      rect(ctx, 510 - 230 * k, LADDER.y + LADDER.h + 30, 230 * k, 26, 'ink');
      if (k > 0.9) text(ctx, '1 bit = 2 × 170 ns', 500, LADDER.y + LADDER.h + 35, { size: 14, colour: 'paper', align: 'right' });
    }
    const mb = T.at('N14', '294');
    if (t >= mb) {
      const k = easeBack(ramp(t, mb, mb + 0.3));
      text(ctx, '= 2.94 Mbit/s', 510, LADDER.y + LADDER.h + 64, { size: 26 * k + 1, align: 'right', colour: 'ink' });
    }

    // Backoff: the refresh task's tick count, ANDed with a growing mask.
    const rnd = T.at('N14', 'random');
    if (t < rnd - 0.2) return;
    const collisions = [rnd, T.at('N14', 'backoff'), T.at('N14', 'read')];
    const hits = collisions.filter((c) => t >= c).length;
    const counter = ((tick * 37) % 256 + 256) % 256;
    const mask = (1 << Math.max(1, hits)) - 1;
    const row = (label, v, y, colour, sub) => {
      text(ctx, label, 30, y + 6, { size: 14 });
      for (let i = 0; i < 8; i++) {
        const bit = (v >> (7 - i)) & 1;
        const x = 200 + i * 38;
        rect(ctx, x, y, 34, 34, bit ? colour : 'paper');
        frameRect(ctx, x, y, 34, 34, colour === 'yellow' ? 'ink' : colour, 2);
        text(ctx, String(bit), x + 17, y + 8, { size: 16, align: 'center', colour: bit && colour !== 'yellow' ? 'paper' : 'ink' });
      }
      if (sub) text(ctx, sub, 30, y + 26, { size: 11, weight: 'normal' });
    };
    const refresh = T.at('N14', 'refresh');
    row('tick count', counter, 500, 'ink', t >= refresh - 0.2 ? 'from the refresh task' : null);
    text(ctx, 'AND', 30, 548, { size: 14, colour: 'muted' in {} ? 'ink' : 'ink' });
    row('mask', mask, 570, 'yellow', `${hits} collision${hits === 1 ? '' : 's'}`);
    const wait = counter & mask;
    row('wait', wait, 640, 'red', null);
    // The countdown bar: one cell per 38 µs tick of the refresh clock.
    rect(ctx, 200, 700, 38 * 8 - 4, 30, 'paper');
    frameRect(ctx, 200, 700, 38 * 8 - 4, 30, 'red', 2);
    rect(ctx, 204, 704, ((38 * 8 - 12) * wait) / Math.max(1, mask), 22, 'red');
    text(ctx, 'backoff', 30, 706, { size: 14 });
    const last = collisions.filter((c) => t >= c).pop();
    if (last && t - last < 0.5 && blink(t, last, 0.2)) titleTab(ctx, 'COLLISION', 390, 466, { size: 15, colour: 'red' });
  },

  sounds(S, T, shot, clock) {
    const a = shot.from, b = T.at('N15') - 0.4;
    // A soft chirp per bit (every other tick).
    for (let k = clock.ticks.findIndex((x) => x >= a); k >= 0 && clock.ticks[k] < b; k += 2) S.task('ethernet', clock.ticks[k], 0.05, 0.35);
    S.bell(T.at('N14', '294'), { freq: 1174.66, gain: 0.04, dur: 1.2 });
    for (const w of ['random', 'backoff', 'read']) S.bonk(T.at('N14', w));
  },
};
