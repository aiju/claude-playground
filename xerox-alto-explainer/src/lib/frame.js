// Frames are drawn on a small "virtual" canvas, snapped to the five-colour
// palette (which turns anti-aliased edges into crisp pixels), then scaled up
// with nearest-neighbour sampling. The result looks like a 1-bit display
// with a few coloured inks, at any output size.

import { PALETTE_LIST } from './palette.js';

export const VW = 540; // virtual width
export const VH = 960; // virtual height (9:16)

export function makeVirtual() {
  const c = document.createElement('canvas');
  c.width = VW;
  c.height = VH;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

// Snap every pixel to the nearest palette colour. Weighted RGB distance keeps
// yellow from swallowing light greys.
export function quantize(ctx) {
  const img = ctx.getImageData(0, 0, VW, VH);
  const d = img.data;
  const pal = PALETTE_LIST;
  const cache = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let best = cache.get(key);
    if (best === undefined) {
      // Unsaturated pixels (anti-aliased text and lines) snap to ink or paper
      // by brightness, so edges never pick up a stray accent colour.
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const neutral = mx - mn < 48;
      let bd = Infinity;
      for (let k = 0; k < pal.length; k++) {
        if (neutral && k > 1) break;
        const p = pal[k];
        const dr = d[i] - p[0];
        const dg = d[i + 1] - p[1];
        const db = d[i + 2] - p[2];
        const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (dist < bd) {
          bd = dist;
          best = k;
        }
      }
      cache.set(key, best);
    }
    const p = pal[best];
    d[i] = p[0];
    d[i + 1] = p[1];
    d[i + 2] = p[2];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function present(virtual, out) {
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(virtual, 0, 0, out.width, out.height);
}
