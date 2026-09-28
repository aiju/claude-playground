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

export function textWidth(ctx, s, { size = 16, font = MONO, weight = 'bold' } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  return ctx.measureText(s).width;
}

// 1-bit fill patterns, anchored to the canvas so neighbouring shapes line up.
// Each is a small tile: [width, height, (x, y) => on].
const PATTERNS = {
  stripes: [4, 4, (x, y) => (x + y) % 4 < 2],
  dots: [3, 3, (x, y) => x % 3 === 0 && y % 3 === 0],
  checker: [2, 2, (x, y) => (x + y) % 2 === 0],
  hlines: [1, 3, (x, y) => y % 3 === 0],
};

// Ordered (Bayer) dither: fills a fraction of the pixels in an even pattern.
// Used instead of fades, since there are no in-between colours.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayerOn = (level) => (x, y) => BAYER[(y % 4) * 4 + (x % 4)] < Math.round(level * 16);

const tiles = new Map();
function tile(ctx, key, [w, h, on], colour, bg) {
  const id = `${key}/${colour}/${bg}`;
  let p = tiles.get(id);
  if (!p) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const t = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fill = on(x, y) ? colour : bg;
        if (!fill) continue;
        t.fillStyle = css(fill);
        t.fillRect(x, y, 1, 1);
      }
    }
    p = ctx.createPattern(c, 'repeat');
    tiles.set(id, p);
  }
  return p;
}

// Fill a rectangle with a 1-bit pattern: 'solid', 'stripes', 'dots',
// 'checker' or 'hlines'. bg null leaves the gaps transparent.
export function patternRect(ctx, x, y, w, h, colour, pattern = 'solid', bg = 'paper') {
  if (pattern === 'solid') return rect(ctx, x, y, w, h, colour);
  ctx.fillStyle = tile(ctx, pattern, PATTERNS[pattern], colour, bg);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Cover a rectangle with a fraction (0–1) of its pixels in one colour.
export function ditherRect(ctx, x, y, w, h, colour, level) {
  level = Math.max(0, Math.min(1, level));
  if (level <= 0) return;
  if (level >= 1) return rect(ctx, x, y, w, h, colour);
  const q = Math.round(level * 16);
  ctx.fillStyle = tile(ctx, `bayer${q}`, [4, 4, bayerOn(q / 16)], colour, null);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Straight line of square pixels (Bresenham-free: steps along the long axis).
export function line(ctx, x0, y0, x1, y1, colour = 'ink', lw = 2) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  ctx.fillStyle = css(colour);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    ctx.fillRect(Math.round(x - lw / 2), Math.round(y - lw / 2), lw, lw);
  }
}

// Dotted line: a dot every `step` pixels.
export function dotted(ctx, x0, y0, x1, y1, colour = 'ink', step = 6, size = 2) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  ctx.fillStyle = css(colour);
  for (let d = 0; d <= len; d += step) {
    const x = x0 + ((x1 - x0) * d) / len;
    const y = y0 + ((y1 - y0) * d) / len;
    ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }
}

// Arrow with a pixel head, pointing from (x0, y0) to (x1, y1).
export function arrow(ctx, x0, y0, x1, y1, colour = 'ink', lw = 3, head = 10) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  line(ctx, x0, y0, x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6, colour, lw);
  ctx.fillStyle = css(colour);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.5) * head, y1 - Math.sin(a - 0.5) * head);
  ctx.lineTo(x1 - Math.cos(a + 0.5) * head, y1 - Math.sin(a + 0.5) * head);
  ctx.closePath();
  ctx.fill();
}

export function disc(ctx, x, y, r, colour = 'ink') {
  ctx.fillStyle = css(colour);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function ring(ctx, x, y, r, colour = 'ink', lw = 2) {
  ctx.strokeStyle = css(colour);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
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

// Scene header: a title tab and a subtitle line under it, in the same place
// in every scene.
export function header(ctx, title, sub, { colour = 'ink' } = {}) {
  titleTab(ctx, title, 30, 40, { size: 16, colour });
  if (sub) text(ctx, sub, 30, 80, { size: 16 });
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
