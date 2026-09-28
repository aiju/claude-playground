// Frames are drawn on a small "virtual" canvas, snapped to the five-colour
// palette (which turns anti-aliased edges into crisp pixels), then scaled up
// with nearest-neighbour sampling. The result looks like a 1-bit display
// with a few coloured inks, at any output size.

import { PALETTE_LIST } from './palette.js';

export const VW = 540; // virtual width
export const VH = 960; // virtual height (9:16)
export const FPS = 30;

export function makeVirtual(canvas) {
  const c = canvas || document.createElement('canvas');
  c.width = VW;
  c.height = VH;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

// Which palette entry a colour snaps to. Weighted RGB distance keeps yellow
// from swallowing light greys, and unsaturated pixels (anti-aliased text and
// lines) snap to ink or paper by brightness, so edges never pick up a stray
// accent colour.
function nearest(r, g, b) {
  const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 48;
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < PALETTE_LIST.length; k++) {
    if (neutral && k > 1) break;
    const [pr, pg, pb] = PALETTE_LIST[k];
    const dist = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (dist < bd) {
      bd = dist;
      best = k;
    }
  }
  return best;
}

// A lookup table over all 2^24 colours, filled in as colours turn up, so a
// frame costs one table read per pixel. Entries hold palette index + 1.
let LUT = null;
const OUT = new Uint32Array(PALETTE_LIST.length + 1);
PALETTE_LIST.forEach(([r, g, b], k) => (OUT[k + 1] = (255 << 24) | (b << 16) | (g << 8) | r));

export function quantize(ctx) {
  LUT ||= new Uint8Array(1 << 24);
  const img = ctx.getImageData(0, 0, VW, VH);
  // Little-endian RGBA: the low three bytes of each word are R, G, B.
  const px = new Uint32Array(img.data.buffer);
  for (let i = 0; i < px.length; i++) {
    const key = px[i] & 0xffffff;
    let k = LUT[key];
    if (k === 0) k = LUT[key] = nearest(key & 255, (key >> 8) & 255, key >> 16) + 1;
    px[i] = OUT[k];
  }
  ctx.putImageData(img, 0, 0);
}

export function present(virtual, out) {
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(virtual, 0, 0, out.width, out.height);
}
