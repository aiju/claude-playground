// Pieces several scenes share: the Alto screen, the task colour key, the
// microcode PROM grid, chips, gears and the modelled scanline.

import { rect, frameRect, patternRect, text, disc } from '../lib/draw.js';
import { css } from '../lib/palette.js';

export const oct = (n, digits = 3) => n.toString(8).padStart(digits, '0');

// The colour key, used the same way in every scene (script.md): blue for the
// display tasks, red for the disk, yellow for refresh and (striped) the
// Ethernet, ink for task 0. Patterns tell apart tasks that share a colour.
// `n` is the task number (priority) from the microcode's reset table.
export const TASKS = {
  EMU: { n: 0o0, name: 'NOVEM', label: 'your program', colour: 'ink', pattern: 'solid', sound: 'emulator' },
  KSEC: { n: 0o4, name: 'KSEC', label: 'disk sector', colour: 'red', pattern: 'stripes', sound: 'disk' },
  ETH: { n: 0o7, name: 'EREST', label: 'Ethernet', colour: 'yellow', pattern: 'stripes', sound: 'ethernet' },
  MRT: { n: 0o10, name: 'MRT', label: 'refresh + mouse', colour: 'yellow', pattern: 'solid', sound: 'refresh' },
  DWT: { n: 0o11, name: 'DWT', label: 'display word', colour: 'blue', pattern: 'solid', sound: 'display' },
  CURT: { n: 0o12, name: 'CURT', label: 'cursor', colour: 'blue', pattern: 'dots', sound: 'display' },
  DHT: { n: 0o13, name: 'DHT', label: 'display horizontal', colour: 'blue', pattern: 'stripes', sound: 'horizontal' },
  DVT: { n: 0o14, name: 'DVT', label: 'display vertical', colour: 'blue', pattern: 'checker', sound: 'horizontal' },
  PART: { n: 0o15, name: 'PART', label: 'parity', colour: 'ink', pattern: 'dots', sound: 'refresh' },
  KWD: { n: 0o16, name: 'KWDX', label: 'disk word', colour: 'red', pattern: 'solid', sound: 'disk' },
};
export const TASK_BY_NUMBER = Object.fromEntries(Object.entries(TASKS).map(([k, v]) => [v.n, k]));

// A task-coloured cell with a thin outline when patterned, so stripes and
// dots still read as a solid block.
export function taskCell(ctx, x, y, w, h, key) {
  const spec = TASKS[key];
  patternRect(ctx, x, y, w, h, spec.colour, spec.pattern);
  if (spec.pattern !== 'solid') frameRect(ctx, x, y, w, h, spec.colour, 1);
}

// One visible scanline: 224 microcycles, each owned by a task. From a
// cycle-level model of the Alto II display microcode (display notes in
// research_notes/Alto processor deep dive): the cursor's two cycles, the
// display word task refilling the FIFO after retrace with refresh cycles
// slotted in, the horizontal task setting up the next line, then task 0.
// C = cursor, W = display word, M = refresh, H = display horizontal, . = task 0
const MODEL_LINE =
  'CCWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMWWWWWWMMMWWWWWWMMMMWWWWWW' +
  'MMMWWWWWWMMMWWWWWWMMMMWWWWWWWHHHHHHHHHHHM.......................................................................';
const CODE = { C: 'CURT', W: 'DWT', M: 'MRT', H: 'DHT', '.': 'EMU' };
export const SCANLINE = [...MODEL_LINE].map((ch) => CODE[ch]);

// Shares of the line (display = all four display tasks).
export const SHARES = (() => {
  const c = {};
  for (const k of SCANLINE) c[k] = (c[k] || 0) + 1;
  const display = (c.CURT || 0) + (c.DWT || 0) + (c.DHT || 0);
  return { display, refresh: c.MRT, emulator: c.EMU, total: SCANLINE.length };
})();

// The portrait Alto display (3:4) with its dark bezel.
export function altoScreen(ctx, x, y, w, h, { bezel = 12, glass = 'paper' } = {}) {
  rect(ctx, x - bezel, y - bezel, w + 2 * bezel, h + 2 * bezel, 'ink');
  rect(ctx, x, y, w, h, glass);
}

// A 1-bit cookie with a bite out of it: our stand-in for the Cookie Monster
// sketch that was the Alto's first picture.
export function cookiePixels(n) {
  const px = [];
  const c = n / 2;
  const r = n / 2 - 1;
  const bite = { x: n * 0.86, y: n * 0.18, r: n * 0.2 };
  const inside = (x, y) => {
    const dx = x + 0.5 - c;
    const dy = y + 0.5 - c;
    const bx = x + 0.5 - bite.x;
    const by = y + 0.5 - bite.y;
    return dx * dx + dy * dy <= r * r && bx * bx + by * by > bite.r * bite.r;
  };
  const chips = [[0.3, 0.3], [0.55, 0.42], [0.28, 0.62], [0.62, 0.7], [0.45, 0.2], [0.75, 0.48], [0.42, 0.8]];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const chip = chips.some(([u, v]) => Math.hypot(x - u * n, y - v * n) < n * 0.05);
      const speckle = ((x * 73856093) ^ (y * 19349663)) % 17 === 0;
      if (edge || chip || speckle) px.push([x, y]);
    }
  }
  [[0.9, 0.42], [0.95, 0.36], [0.98, 0.47]].forEach(([u, v]) => px.push([Math.round(u * n), Math.round(v * n)]));
  return px;
}
export const COOKIE = cookiePixels(40);

// The 1,024-word microcode PROM as a 32 x 32 grid; address a sits at row
// a / 32, column a % 32. Same place in every scene that shows it.
export const PROM = { x: 30, y: 150, cell: 13, gap: 2 };
export function promCell(a, g = PROM) {
  const pitch = g.cell + g.gap;
  return { x: g.x + (a % 32) * pitch, y: g.y + Math.floor(a / 32) * pitch, w: g.cell, h: g.cell };
}
export function promGrid(ctx, fill = () => null, g = PROM) {
  for (let a = 0; a < 1024; a++) {
    const c = promCell(a, g);
    const f = fill(a);
    if (!f) frameRect(ctx, c.x, c.y, c.w, c.h, 'ink', 1);
    else if (TASKS[f]) taskCell(ctx, c.x, c.y, c.w, c.h, f);
    else patternRect(ctx, c.x, c.y, c.w, c.h, f === 'dim' ? 'ink' : f, f === 'dim' ? 'dots' : 'solid');
  }
}

// A DIP chip seen from above, with pins along the long edges.
export function chip(ctx, x, y, w, h, { colour = 'ink', pattern = 'solid', label = '', labelColour = 'paper', size = 11 } = {}) {
  const pinColour = colour === 'paper' ? 'ink' : colour;
  const along = Math.max(w, h);
  const pins = Math.max(2, Math.floor(along / 8));
  for (let i = 0; i < pins; i++) {
    const p = 4 + (i * (along - 8)) / (pins - 1) - 1;
    if (w >= h) {
      rect(ctx, x + p, y - 3, 2, 3, pinColour);
      rect(ctx, x + p, y + h, 2, 3, pinColour);
    } else {
      rect(ctx, x - 3, y + p, 3, 2, pinColour);
      rect(ctx, x + w, y + p, 3, 2, pinColour);
    }
  }
  patternRect(ctx, x, y, w, h, colour, pattern);
  if (pattern !== 'solid') frameRect(ctx, x, y, w, h, colour, 1);
  if (label) text(ctx, label, x + w / 2, y + h / 2 - size / 2, { size, colour: labelColour, align: 'center' });
}

// A spur gear: `teeth` teeth around radius r, turned by `angle` radians.
export function gear(ctx, cx, cy, r, teeth, angle, colour = 'ink') {
  const depth = Math.min(10, r * 0.22);
  ctx.fillStyle = css(colour);
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = angle + (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    const pts = [
      [a0, r - depth],
      [a0 + step * 0.2, r],
      [a0 + step * 0.5, r],
      [a0 + step * 0.7, r - depth],
    ];
    for (const [a, rr] of pts) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  disc(ctx, cx, cy, Math.max(4, r * 0.28), 'paper');
  disc(ctx, cx, cy, Math.max(2, r * 0.1), colour);
}

// A mouse-button bar: the three buttons were named RED, YELLOW and BLUE.
export function mouseBars(ctx, cx, y, bw = 34) {
  ['red', 'yellow', 'blue'].forEach((c, i) => rect(ctx, cx - 1.5 * bw - 6 + i * (bw + 6), y, bw, 14, c));
  frameRect(ctx, cx - 1.5 * bw - 12, y - 6, 3 * bw + 24, 26, 'ink', 2);
}
