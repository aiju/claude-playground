// Small drawing vocabulary shared by all scenes. Everything works in virtual
// pixels (540 x 960) and assumes the frame is quantized afterwards.

import { css } from './palette.js';

export const MONO = '"DejaVu Sans Mono", monospace';
export const SANS = '"DejaVu Sans", sans-serif';

export function clear(ctx, colour = 'paper') {
  ctx.fillStyle = css(colour);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function rect(ctx, x, y, w, h, colour) {
  ctx.fillStyle = css(colour);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function frameRect(ctx, x, y, w, h, colour = 'ink', lw = 2) {
  rect(ctx, x, y, w, lw, colour);
  rect(ctx, x, y + h - lw, w, lw, colour);
  rect(ctx, x, y, lw, h, colour);
  rect(ctx, x + w - lw, y, lw, h, colour);
}

export function text(ctx, s, x, y, { size = 16, colour = 'ink', font = MONO, weight = 'bold', align = 'left', baseline = 'top' } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = css(colour);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(s, Math.round(x), Math.round(y));
  return ctx.measureText(s).width;
}

// Fill a rectangle with a 1-bit pattern: 'solid', 'stripes', 'dots', 'checker'.
export function patternRect(ctx, x, y, w, h, colour, pattern = 'solid', bg = 'paper') {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  if (pattern === 'solid') return rect(ctx, x, y, w, h, colour);
  rect(ctx, x, y, w, h, bg);
  ctx.fillStyle = css(colour);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const X = x + i;
      const Y = y + j;
      let on = false;
      if (pattern === 'stripes') on = (X + Y) % 4 < 2;
      else if (pattern === 'dots') on = X % 3 === 0 && Y % 3 === 0;
      else if (pattern === 'checker') on = (X + Y) % 2 === 0;
      if (on) ctx.fillRect(X, Y, 1, 1);
    }
  }
}

// The Alto/Smalltalk window look: an inverted title tab sitting on a frame.
export function titleTab(ctx, s, x, y, { size = 14, colour = 'ink', fg = 'paper' } = {}) {
  ctx.font = `bold ${size}px ${MONO}`;
  const w = Math.ceil(ctx.measureText(s).width) + 12;
  const h = size + 8;
  rect(ctx, x, y, w, h, colour);
  text(ctx, s, x + 6, y + 4, { size, colour: fg });
  return { w, h };
}

// Draw a 1-bit sprite given as an array of strings ('#' = ink, 'r'/'y'/'b' =
// accent, anything else = transparent).
export function sprite(ctx, rows, x, y, px = 1) {
  const map = { '#': 'ink', r: 'red', y: 'yellow', b: 'blue', '.': null, ' ': null };
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const c = map[ch];
      if (c) rect(ctx, x + i * px, y + j * px, px, px, c);
    });
  });
}

// A caption box in the lower third, like burned-in subtitles.
export function caption(ctx, lines, y = 820) {
  const size = 22;
  lines.forEach((s, i) => {
    text(ctx, s, 270, y + i * (size + 8), { size, align: 'center', font: SANS });
  });
}
