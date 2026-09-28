// Draws one frame of the video at time t. Shared by the player and the final
// renderer, so the preview is the video.

import { quantize, VW } from './lib/frame.js';
import { rect, text, textWidth, ditherRect, SANS } from './lib/draw.js';
import { ramp, easeInOut } from './lib/time.js';
import { musicClock } from './audio/music.js';

export const WIPE = 0.4; // seconds for a beam wipe between shots

// The shot on screen at time t (the last one that has started).
export const shotAt = (shots, t) => {
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].from <= t) i++;
  return i;
};

// The music's clock, so pictures can move on the heartbeat. Built once per
// timeline.
const clocks = new WeakMap();
const clockFor = (T) => {
  if (!clocks.has(T)) clocks.set(T, musicClock(T));
  return clocks.get(T);
};

export function renderFrame(ctx, t, T, shots, { captions = false } = {}) {
  const clock = clockFor(T);
  const i = shotAt(shots, t);
  const shot = shots[i];
  const k = shot.wipe && i > 0 ? ramp(t, shot.from, shot.from + WIPE) : 1;
  if (k < 1) {
    // A red beam sweeps down like the Alto's own raster: the new shot above
    // it, the old one still below.
    const y = Math.round(easeInOut(k) * ctx.canvas.height);
    shots[i - 1].scene.draw(ctx, t, T, shots[i - 1], clock);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VW, y);
    ctx.clip();
    shot.scene.draw(ctx, t, T, shot, clock);
    ctx.restore();
    rect(ctx, 0, y - 2, VW, 3, 'red');
  } else {
    shot.scene.draw(ctx, t, T, shot, clock);
  }
  if (captions) drawCaptions(ctx, t, T);
  quantize(ctx);
}

// Burned-in captions in the bottom band: the current line in chunks of up to
// two rows, with the words not yet spoken faded.
const CAPTION_SIZE = 20;
const CAPTION_WIDTH = 480;
const chunkCache = new WeakMap();

function chunks(ctx, line) {
  let c = chunkCache.get(line);
  if (c) return c;
  const opts = { size: CAPTION_SIZE, font: SANS };
  const space = textWidth(ctx, ' ', opts);
  const rows = [];
  let row = [];
  let w = 0;
  for (const word of line.words) {
    const ww = textWidth(ctx, word.w, opts);
    if (row.length && w + space + ww > CAPTION_WIDTH) {
      rows.push(row);
      row = [];
      w = 0;
    }
    row.push({ ...word, width: ww });
    w += (row.length > 1 ? space : 0) + ww;
  }
  if (row.length) rows.push(row);
  c = [];
  for (let r = 0; r < rows.length; r += 2) c.push(rows.slice(r, r + 2));
  chunkCache.set(line, c);
  return c;
}

function drawCaptions(ctx, t, T) {
  const hit = T.wordAt(t);
  if (!hit) return;
  const list = chunks(ctx, hit.line);
  const chunk = list.find((ch) => ch.flat().some((w) => w.start === hit.word.start)) || list[0];
  const opts = { size: CAPTION_SIZE, font: SANS };
  const space = textWidth(ctx, ' ', opts);
  const y0 = 856;
  rect(ctx, 0, y0 - 14, VW, 104, 'paper');
  rect(ctx, 30, y0 - 14, VW - 60, 2, 'ink');
  chunk.forEach((row, r) => {
    const width = row.reduce((s, w) => s + w.width, 0) + space * (row.length - 1);
    let x = (VW - width) / 2;
    for (const w of row) {
      text(ctx, w.w, x, y0 + r * 30, opts);
      // Words not yet spoken are faded with a dither.
      if (w.start > t) ditherRect(ctx, x - 1, y0 + r * 30 - 2, w.width + 2, CAPTION_SIZE + 6, 'paper', 0.7);
      x += w.width + space;
    }
  });
}
