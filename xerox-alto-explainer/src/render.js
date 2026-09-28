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

// Burned-in captions in the bottom band: the current line on cards of up to
// two rows, with the words not yet spoken faded. Cards break at the ends of
// sentences and clauses where they can, so a card reads as a phrase.
const CAPTION_SIZE = 20;
const CAPTION_WIDTH = 480;
const chunkCache = new WeakMap();

export function captionCards(ctx, line) {
  let cards = chunkCache.get(line);
  if (cards) return cards;
  const opts = { size: CAPTION_SIZE, font: SANS };
  const space = textWidth(ctx, ' ', opts);
  const words = line.words.map((w) => ({ ...w, width: textWidth(ctx, w.cap, opts) }));
  const wrap = (ws) => {
    const rows = [];
    let row = [];
    let w = 0;
    for (const word of ws) {
      if (row.length && w + space + word.width > CAPTION_WIDTH) {
        rows.push(row);
        row = [];
        w = 0;
      }
      row.push(word);
      w += (row.length > 1 ? space : 0) + word.width;
    }
    if (row.length) rows.push(row);
    return rows;
  };
  const splitAfter = (ws, re) => {
    const out = [];
    let cur = [];
    for (const w of ws) {
      cur.push(w);
      if (re.test(w.cap)) {
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length) out.push(cur);
    return out;
  };
  // Pack whole sentences onto cards. A sentence too long for one card is
  // split at dashes, colons and ellipses, then at commas, then two rows at
  // a time.
  const BREAKS = [/[.?!]$/, /[:…—]$/, /,$/];
  cards = [];
  let card = [];
  const flush = () => {
    if (card.length) cards.push(wrap(card));
    card = [];
  };
  const pack = (units, level) => {
    for (const u of units) {
      if (wrap([...card, ...u]).length <= 2) {
        card.push(...u);
        continue;
      }
      flush();
      if (wrap(u).length <= 2) card.push(...u);
      else if (level + 1 < BREAKS.length) pack(splitAfter(u, BREAKS[level + 1]), level + 1);
      else wrap(u).forEach((row, i, rows) => i % 2 === 0 && cards.push(rows.slice(i, i + 2)));
    }
  };
  pack(splitAfter(words, BREAKS[0]), 0);
  flush();
  chunkCache.set(line, cards);
  return cards;
}

function drawCaptions(ctx, t, T) {
  const hit = T.wordAt(t);
  if (!hit) return;
  const list = captionCards(ctx, hit.line);
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
      text(ctx, w.cap, x, y0 + r * 30, opts);
      // Words not yet spoken are faded with a dither.
      if (w.start > t) ditherRect(ctx, x - 1, y0 + r * 30 - 2, w.width + 2, CAPTION_SIZE + 6, 'paper', 0.7);
      x += w.width + space;
    }
  });
}
