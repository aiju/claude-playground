// 1. First light. The Alto's screen warms up and a beam draws the first
// picture line by line (our pixel cookie standing in for the Cookie Monster
// sketch); then the one processor that feeds every pixel.
// N1: "April 1973. The first picture on a Xerox Alto: Cookie Monster. Every
// pixel, fed to the screen by its one and only processor."

import { clear, rect, frameRect, text, titleTab, ditherRect, line } from '../lib/draw.js';
import { ramp, easeBack, easeInOut } from '../lib/time.js';
import { altoScreen, COOKIE, chip } from './common.js';

const SX = 105, SY = 130, SW = 330, SH = 440; // the portrait screen, 3:4
const PX = 6; // cookie pixel size
const CX = SX + (SW - 40 * PX) / 2, CY = SY + 90; // the cookie, 40 x 40
const BEAM_FROM = 1.0;
const REFRESH = 0.45; // seconds per screen refresh once the picture is up

// Where the beam is (0–1 down the screen) at time t, or null when it's off.
function beam(t, T) {
  const done = T.at('N1', 'monster') + 0.15;
  if (t < BEAM_FROM) return null;
  if (t < done) return { k: easeInOut(ramp(t, BEAM_FROM, done)), first: true };
  const every = T.at('N1', 'every');
  if (t < every) return null;
  return { k: ((t - every) / REFRESH) % 1, first: false };
}

export const hook = {
  draw(ctx, t, T) {
    clear(ctx);

    // Header: the date types itself out, then what it was.
    const stamp = 'APRIL 1973';
    const typed = Math.floor(ramp(t, T.at('N1', 'april') - 0.1, T.at('N1', '1973') + 0.3) * stamp.length);
    if (typed > 0) titleTab(ctx, stamp.slice(0, typed), 30, 40, { size: 16 });
    const sub = 'first light on a Xerox Alto';
    const subTyped = Math.floor(ramp(t, T.at('N1', 'first'), T.at('N1', 'alto') + 0.3) * sub.length);
    if (subTyped > 0) text(ctx, sub.slice(0, subTyped), 30, 80, { size: 16 });

    // The screen warms up from dark.
    altoScreen(ctx, SX, SY, SW, SH, { glass: 'ink' });
    ditherRect(ctx, SX, SY, SW, SH, 'paper', ramp(t, 0.25, 0.95));

    const b = beam(t, T);
    const drawn = b && b.first ? SY + b.k * SH : t >= BEAM_FROM ? SY + SH : SY;
    for (const [x, y] of COOKIE) {
      const Y = CY + y * PX;
      if (Y < drawn) rect(ctx, CX + x * PX, Y, PX, PX, 'ink');
    }
    if (b) {
      const y = Math.round(SY + b.k * SH);
      rect(ctx, SX - 6, y - 1, SW + 12, 3, 'red');
    }
    if (t >= BEAM_FROM) {
      const n = b ? Math.min(807, Math.floor(b.k * 808)) : 807;
      text(ctx, `line ${String(n).padStart(3, '0')}`, SX + SW + 12, SY + SH + 24, { size: 14, align: 'right' });
    }
    if (t >= T.at('N1', 'cookie')) text(ctx, 'our stand-in drawing', SX - 12, SY + SH + 24, { size: 14, weight: 'normal' });

    // The processor, and the wire every pixel comes down.
    const fed = T.at('N1', 'fed') - 0.1;
    if (t >= fed) {
      const k = easeBack(ramp(t, fed, fed + 0.45));
      const y = 690 + (1 - k) * 170;
      const wireTop = SY + SH + 12;
      const wire = ramp(t, fed + 0.2, fed + 0.6);
      if (wire > 0) line(ctx, 270, y - 4, 270, y - 4 - (y - 4 - wireTop) * wire, 'ink', 3);
      // Bits stream up the wire once it's connected.
      if (wire >= 1) {
        const len = y - 16 - wireTop;
        for (let i = 0; i < 8; i++) {
          const p = ((t - fed) * 110 + i * 14) % len;
          const on = (i * 5 + Math.floor((t - fed) * 3)) % 3 !== 0;
          rect(ctx, 264, y - 16 - p, 12, 8, on ? 'ink' : 'paper');
          if (!on) frameRect(ctx, 264, y - 16 - p, 12, 8, 'ink', 2);
        }
      }
      chip(ctx, 170, y, 200, 64, { label: 'PROCESSOR', size: 16 });
      if (t >= T.at('N1', 'one')) {
        const s = easeBack(ramp(t, T.at('N1', 'one'), T.at('N1', 'one') + 0.3));
        const w = 190 * s;
        rect(ctx, 270 - w / 2, y + 84, w, 30, 'red');
        if (s > 0.9) text(ctx, 'ONE AND ONLY', 270, y + 90, { size: 16, colour: 'paper', align: 'center' });
      }
    }
  },

  sounds(S, T) {
    // Power on, and a disk spinning up under the whole scene.
    S.thunk(0.25, { gain: 0.3, freq: 48 });
    S.sweep(0.3, { f0: 70, f1: 520, dur: 6, gain: 0.012, wave: 'tri' });
    // The beam: a soft rising tone, and a tick for each of 16 bands.
    const done = T.at('N1', 'monster') + 0.15;
    S.sweep(BEAM_FROM, { f0: 300, f1: 1100, dur: done - BEAM_FROM, gain: 0.014, wave: 'sine' });
    for (let i = 0; i < 16; i++) {
      const k = i / 16;
      // Invert the ease so each tick sits where the beam crosses the band.
      let lo = 0, hi = 1;
      for (let j = 0; j < 20; j++) {
        const mid = (lo + hi) / 2;
        if (easeInOut(mid) < k) lo = mid;
        else hi = mid;
      }
      S.tick(BEAM_FROM + lo * (done - BEAM_FROM), { freq: 900 + 1500 * k, gain: 0.05, decay: 0.01, noise: 0.2 });
    }
    // Typing the date.
    const a = T.at('N1', 'april') - 0.1, b = T.at('N1', '1973') + 0.3;
    for (let i = 0; i < 10; i++) S.tick(a + ((i + 1) / 10) * (b - a), { freq: 4200, gain: 0.025, decay: 0.004, noise: 0.7 });
    // The processor lands; the stamp.
    S.clunk(T.at('N1', 'fed') + 0.25, { gain: 0.22 });
    S.blip(T.at('N1', 'one') + 0.05, { freq: 587.33, dur: 0.07, gain: 0.05, wave: 'square', lp: 2200 });
  },
};
