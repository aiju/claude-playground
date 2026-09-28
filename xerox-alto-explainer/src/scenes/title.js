// Title card: a portrait Alto screen draws its first picture scanline by
// scanline. (The real first picture was a sketch of Cookie Monster; we name it
// in the narration and show our own pixel cookie instead.)

import { clear, rect, frameRect, text, SANS } from '../lib/draw.js';

// Procedural 1-bit cookie with a bite out of the top right.
function cookiePixels(n) {
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
  const chips = [
    [0.3, 0.3], [0.55, 0.42], [0.28, 0.62], [0.62, 0.7], [0.45, 0.2], [0.75, 0.48], [0.42, 0.8],
  ];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const chip = chips.some(([u, v]) => Math.hypot(x - u * n, y - v * n) < n * 0.05);
      const speckle = ((x * 73856093) ^ (y * 19349663)) % 17 === 0;
      if (edge || chip || speckle) px.push([x, y]);
    }
  }
  // crumbs by the bite
  [[0.9, 0.42], [0.95, 0.36], [0.98, 0.47]].forEach(([u, v]) => px.push([Math.round(u * n), Math.round(v * n)]));
  return px;
}

export function drawTitle(ctx, t = 1) {
  clear(ctx);

  // The Alto screen: portrait, 606 x 808, so 3:4.
  const sw = 300;
  const sh = 400;
  const sx = (540 - sw) / 2;
  const sy = 150;
  rect(ctx, sx - 14, sy - 14, sw + 28, sh + 28, 'ink');
  rect(ctx, sx, sy, sw, sh, 'paper');

  // Scan the cookie in: only rows above the beam are visible.
  const n = 40;
  const px = 5;
  const cx = sx + (sw - n * px) / 2;
  const cy = sy + 90;
  const beam = sy + t * sh;
  for (const [x, y] of cookiePixels(n)) {
    const Y = cy + y * px;
    if (Y < beam) rect(ctx, cx + x * px, Y, px, px, 'ink');
  }
  if (t < 1) rect(ctx, sx, Math.round(beam), sw, 2, 'red');

  text(ctx, 'April 1973', sx + sw / 2, sy + 330, { size: 16, align: 'center' });

  text(ctx, 'TASK ZERO', 270, 620, { size: 56, align: 'center', font: SANS });
  text(ctx, 'inside the Xerox Alto’s', 270, 695, { size: 20, align: 'center', font: SANS, weight: 'normal' });
  text(ctx, 'one-processor computer', 270, 722, { size: 20, align: 'center', font: SANS, weight: 'normal' });

  // Three mouse buttons as the only colour on the card.
  const bw = 34;
  ['red', 'yellow', 'blue'].forEach((c, i) => rect(ctx, 270 - 1.5 * bw - 6 + i * (bw + 6), 790, bw, 14, c));
  frameRect(ctx, 270 - 1.5 * bw - 12, 784, 3 * bw + 24, 26, 'ink', 2);
}
