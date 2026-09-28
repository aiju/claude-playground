// 2. The controllers that aren't there. Three device boards land; almost
// every chip greys out, leaving a small buffer on each; everything else is
// arrows into the one processor.
// N2: "The Alto's device boards are mostly buffers and shift registers. The
// rest — every disk word, every packet, every scanline — is microcode."

import { clear, rect, frameRect, text, header, ditherRect, arrow, titleTab } from '../lib/draw.js';
import { ramp, easeBack, easeOut, blink } from '../lib/time.js';
import { chip } from './common.js';

const BOARDS = [
  { name: 'DISK', colour: 'red', keep: [1, 2], label: ['1-word buffer', '+ shift register'], cue: 'disk' },
  { name: 'ETHERNET', colour: 'yellow', keep: [7, 8, 9], label: ['16-word FIFO + Manchester', '+ CRC'], cue: 'packet' },
  { name: 'DISPLAY', colour: 'blue', keep: [4, 5], label: ['16-word FIFO', '+ shift register'], cue: 'scanline' },
];
const BX = 30, BW = 300, BH = 104;
const BY = [170, 380, 590];
const COLS = 6, ROWS = 2;
const PX = 380, PY = 330, PW = 130, PH = 250; // the processor

function chipRect(i) {
  const cw = 38, ch = 26;
  const gx = (BW - 24 - COLS * cw) / (COLS - 1);
  return { x: 12 + (i % COLS) * (cw + gx), y: 20 + Math.floor(i / COLS) * (ch + 22), w: cw, h: ch };
}

export const boards = {
  draw(ctx, t, T) {
    clear(ctx);
    header(ctx, 'DEVICE CONTROLLERS', 'disk, Ethernet and display');
    const start = T.at('N2') - 0.1;
    const buffers = T.at('N2', 'buffers');
    const rest = T.at('N2', 'rest');
    const micro = T.at('N2', 'microcode');

    BOARDS.forEach((b, n) => {
      const land = start + n * 0.25;
      const k = easeBack(ramp(t, land, land + 0.4));
      if (k <= 0) return;
      const x = BX + (1 - k) * 560;
      const y = BY[n];
      titleTab(ctx, b.name, x, y - 22, { size: 13 });
      frameRect(ctx, x, y, BW, BH, 'ink', 3);
      // Edge connector along the bottom.
      for (let i = 0; i < 24; i++) rect(ctx, x + 20 + i * 11, y + BH - 1, 6, 6, 'ink');
      for (let i = 0; i < COLS * ROWS; i++) {
        const c = chipRect(i);
        const kept = b.keep.includes(i);
        const lit = kept && t >= buffers + n * 0.18;
        if (kept || t < rest) {
          chip(ctx, x + c.x, y + c.y, c.w, c.h, { colour: lit ? b.colour : 'ink' });
        } else {
          // The rest of the board fades out to a dither: that work moved into microcode.
          const fade = ramp(t, rest + i * 0.02, rest + 0.5 + i * 0.02);
          chip(ctx, x + c.x, y + c.y, c.w, c.h, { colour: 'ink' });
          ditherRect(ctx, x + c.x - 1, y + c.y - 4, c.w + 2, c.h + 8, 'paper', 0.25 + 0.6 * fade);
        }
      }
      if (t >= buffers + n * 0.18) {
        b.label.forEach((s, j) => text(ctx, s, x, y + BH + 10 + j * 16, { size: 13, colour: j ? 'ink' : 'ink' }));
      }
      // "every disk word, every packet, every scanline": each board flashes.
      const cue = T.at('N2', b.cue);
      if (t >= cue && t < cue + 0.6 && blink(t, cue, 0.2)) frameRect(ctx, x - 5, y - 5, BW + 10, BH + 10, b.colour, 4);
    });

    // The processor, and the arrows that replace the missing hardware.
    const pIn = ramp(t, rest - 0.2, rest + 0.3);
    if (pIn > 0) {
      const x = PX + (1 - easeOut(pIn)) * 200;
      chip(ctx, x, PY, PW, PH, { colour: 'ink' });
      text(ctx, 'PROCESSOR', x + PW / 2, PY + 90, { size: 15, colour: 'paper', align: 'center' });
      if (t >= micro) {
        const k = easeOut(ramp(t, micro, micro + 0.35));
        rect(ctx, x + 10, PY + 116, (PW - 20) * k, 26, 'paper');
        if (k > 0.8) text(ctx, 'microcode', x + PW / 2, PY + 121, { size: 14, align: 'center' });
      }
    }
    BOARDS.forEach((b, n) => {
      const from = T.at('N2', b.cue) + 0.15;
      const k = easeOut(ramp(t, from, from + 0.35));
      if (k <= 0) return;
      const y0 = BY[n] + BH / 2;
      const y1 = PY + 40 + n * 85;
      const x0 = BX + BW + 6;
      arrow(ctx, x0, y0, x0 + (PX - 8 - x0) * k, y0 + (y1 - y0) * k, b.colour, 4, 12);
    });
  },

  sounds(S, T) {
    const start = T.at('N2') - 0.1;
    for (let n = 0; n < 3; n++) S.clunk(start + n * 0.25 + 0.22, { gain: 0.22 });
    const buffers = T.at('N2', 'buffers');
    for (let n = 0; n < 3; n++) S.blip(buffers + n * 0.18, { freq: [880, 1108.73, 1318.51][n], dur: 0.05, gain: 0.04, wave: 'square', lp: 3000 });
    // Greying out: a descending blip.
    S.sweep(T.at('N2', 'rest'), { f0: 900, f1: 180, dur: 0.5, gain: 0.05, wave: 'square', lp: 1500 });
    for (const [cue, f] of [['disk', 1760], ['packet', 1318.51], ['scanline', 880]]) {
      S.blip(T.at('N2', cue) + 0.15, { freq: f, dur: 0.12, gain: 0.04, wave: 'tri', glide: 1.5 });
    }
    S.thunk(T.at('N2', 'microcode') + 0.1, { gain: 0.25, freq: 60 });
  },
};
