// Makes lyrics write themselves.
//
// For every glyph we build a "time map": for each pixel, the moment (0..1)
// the brush reaches it. Japanese characters use KanjiVG stroke order: each
// pixel of the brush-font glyph is claimed by the nearest point on the
// nearest stroke, so strokes appear in the right order and direction and the
// finished character is exactly the font. Devanagari has no stroke data, so
// ink flows through each letter from left to right and the headline
// (शिरोरेखा) is drawn across last, as it is by hand.
//
// Each frame, writeControl() turns a time map and a progress value into the
// control image the shader reads (r = inked, g = still wet).

import { STROKES } from './strokes.js';

export const MAP_SIZE = 128;     // time maps are MAP_SIZE pixels tall
export const MAP_FONT = 86;      // font size the time maps are drawn at

const FAR = -1;

// ---------------------------------------------------------------- SVG paths

// Sample a KanjiVG path (M, C, S, L, Z and their relative forms) into points.
function samplePath(d) {
  const tok = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  const pts = [];
  let i = 0, cmd = 'M', x = 0, y = 0, sx = 0, sy = 0, cx2 = null, cy2 = null;
  const num = () => parseFloat(tok[i++]);
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    for (let k = 1; k <= 16; k++) {
      const t = k / 16, u = 1 - t;
      pts.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
                u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
    cx2 = x2; cy2 = y2; x = x3; y = y3;
  };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': x = ox + num(); y = oy + num(); sx = x; sy = y; pts.push([x, y]); cmd = rel ? 'l' : 'L'; cx2 = null; break;
      case 'L': x = ox + num(); y = oy + num(); pts.push([x, y]); cx2 = null; break;
      case 'C': { const a = ox + num(), b = oy + num(), c = ox + num(), e = oy + num(), f = ox + num(), g = oy + num(); cubic(a, b, c, e, f, g); break; }
      case 'S': {
        const a = cx2 == null ? x : 2 * x - cx2, b = cy2 == null ? y : 2 * y - cy2;
        const c = ox + num(), e = oy + num(), f = ox + num(), g = oy + num();
        cubic(a, b, c, e, f, g); break;
      }
      case 'Z': x = sx; y = sy; pts.push([x, y]); break;
      default: i++;  // anything else KanjiVG doesn't use
    }
  }
  return pts;
}

// Resample a polyline every `step` units; returns points with arc length.
function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1], 0]];
  let len = 0, carry = 0;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
    const seg = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t, len + d]);
      d += step;
    }
    carry = seg - (d - step);
    len += seg;
  }
  const [lx, ly] = pts[pts.length - 1];
  out.push([lx, ly, len]);
  return { pts: out, len };
}

// ---------------------------------------------------------------- glyph masks

function mask(width, height, paint) {
  const cv = new OffscreenCanvas(width, height);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(width / 2, height / 2);
  paint(ctx, MAP_FONT);
  const a = ctx.getImageData(0, 0, width, height).data;
  const m = new Uint8Array(width * height);
  for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3];
  return m;
}

function inkBox(m, w, h, thresh = 60) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (m[y * w + x] > thresh) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// Give pixels just outside the ink the time of the nearest inked pixel, so
// the bleed around a stroke appears with it.
function dilate(u, w, h, radius) {
  let frontier = [];
  for (let i = 0; i < u.length; i++) if (u[i] !== FAR) frontier.push(i);
  for (let r = 0; r < radius && frontier.length; r++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (u[j] === FAR) { u[j] = u[i]; next.push(j); }
      }
    }
    frontier = next;
  }
}

// ---------------------------------------------------------------- time maps

// Stroke-order time map for one Japanese character.
function strokeMap(ch, paint) {
  const w = MAP_SIZE, h = MAP_SIZE;
  const m = mask(w, h, paint);
  const u = new Float32Array(w * h).fill(FAR);
  const box = inkBox(m, w, h);
  const strokes = STROKES[ch];
  if (!box || !strokes) return flowMap(m, w, h, false);

  // strokes on the 109 grid, then fitted onto the glyph's ink box
  const pause = 9;  // the brush lifting between strokes, in grid units
  const lines = strokes.map(d => resample(samplePath(d), 1.2));
  let total = 0;
  const starts = lines.map(l => { const s = total; total += l.len + pause; return s; });
  total -= pause;
  let kx0 = 1e9, ky0 = 1e9, kx1 = -1e9, ky1 = -1e9;
  for (const l of lines) for (const [x, y] of l.pts) { kx0 = Math.min(kx0, x); ky0 = Math.min(ky0, y); kx1 = Math.max(kx1, x); ky1 = Math.max(ky1, y); }
  const pad = 3.5;  // half a KanjiVG stroke width
  kx0 -= pad; ky0 -= pad; kx1 += pad; ky1 += pad;
  const em = MAP_FONT / 109;
  const fit = (k0, k1, i0, i1, centre) => {
    // fit the axis to the ink box unless the stroke extent is too thin to trust
    if (k1 - k0 < 22) return v => centre + (v - 54.5) * em;
    const s = (i1 - i0 + 1) / (k1 - k0);
    return v => i0 + (v - k0) * s;
  };
  const fx = fit(kx0, kx1, box.x0, box.x1, w / 2);
  const fy = fit(ky0, ky1, box.y0, box.y1, h / 2);
  const samples = [];
  lines.forEach((l, si) => { for (const [x, y, a] of l.pts) samples.push(fx(x), fy(y), (starts[si] + a) / total); });

  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) near[y * w + x] = m[y * w + x] > 0 ? 1 : 0;
  for (let i = 0; i < u.length; i++) {
    if (!near[i]) continue;
    const px = i % w, py = (i / w) | 0;
    let best = 1e9, bu = 0;
    for (let k = 0; k < samples.length; k += 3) {
      const dx = samples[k] - px, dy = samples[k + 1] - py, d = dx * dx + dy * dy;
      if (d < best) { best = d; bu = samples[k + 2]; }
    }
    u[i] = bu;
  }
  dilate(u, w, h, 10);
  return { u, w, h };
}

// Flowing time map for text without stroke data: ink spreads through each
// connected piece of the glyph from its top-left, pieces left to right (or
// largest first for a lone symbol like ॐ), and a Devanagari headline last.
function flowMap(m, w, h, headline, bySize = false) {
  const u = new Float32Array(w * h).fill(FAR);
  const ink = i => m[i] > 60;
  const box = inkBox(m, w, h);
  if (!box) return { u, w, h };

  const isHead = new Uint8Array(w * h);
  let letters = 1;
  if (headline) {
    const rows = [];
    let best = 0, bestRow = 0;
    for (let y = box.y0; y <= box.y1; y++) {
      let c = 0;
      for (let x = box.x0; x <= box.x1; x++) if (ink(y * w + x)) c++;
      rows[y] = c;
      if (c > best) { best = c; bestRow = y; }
    }
    if (best > 0.5 * (box.x1 - box.x0)) {
      let y0 = bestRow, y1 = bestRow;
      while (y0 > box.y0 && rows[y0 - 1] > best * 0.55) y0--;
      while (y1 < box.y1 && rows[y1 + 1] > best * 0.55) y1++;
      for (let y = y0; y <= y1; y++) for (let x = box.x0; x <= box.x1; x++) if (ink(y * w + x)) isHead[y * w + x] = 1;
      letters = 0.82;
    }
  }

  // connected pieces (without the headline)
  const comp = new Int32Array(w * h).fill(-1);
  const pieces = [];
  for (let i = 0; i < u.length; i++) {
    if (!ink(i) || isHead[i] || comp[i] >= 0) continue;
    const id = pieces.length, list = [i];
    comp[i] = id;
    for (let q = 0; q < list.length; q++) {
      const x = list[q] % w, y = (list[q] / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (ink(j) && !isHead[j] && comp[j] < 0) { comp[j] = id; list.push(j); }
      }
    }
    let minX = w;
    for (const j of list) minX = Math.min(minX, j % w);
    pieces.push({ list, minX });
  }
  pieces.sort(bySize ? (a, b) => b.list.length - a.list.length : (a, b) => a.minX - b.minX);

  const weight = pieces.map(p => Math.sqrt(p.list.length));
  const sum = weight.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  pieces.forEach((p, k) => {
    const dur = letters * weight[k] / sum;
    // geodesic distance from the piece's top-left pixel
    let start = p.list[0], sb = 1e9;
    for (const j of p.list) { const s = (j % w) + ((j / w) | 0) * 0.7; if (s < sb) { sb = s; start = j; } }
    const dist = new Map([[start, 0]]);
    const queue = [start];
    let far = 1;
    for (let q = 0; q < queue.length; q++) {
      const j = queue[q], x = j % w, y = (j / w) | 0, dj = dist.get(j);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (comp[n] === comp[start] && !dist.has(n)) { dist.set(n, dj + 1); far = Math.max(far, dj + 1); queue.push(n); }
      }
    }
    for (const [j, d] of dist) u[j] = t + dur * (d / far);
    t += dur;
  });
  if (letters < 1) {
    for (let i = 0; i < u.length; i++) if (isHead[i]) u[i] = letters + (1 - letters) * ((i % w) - box.x0) / (box.x1 - box.x0 + 1);
  }
  dilate(u, w, h, 10);
  return { u, w, h };
}

const cache = new Map();

// Time map for a Japanese character drawn by paint(ctx, size).
export function charMap(ch, paint) {
  const key = `ja:${ch}`;
  if (!cache.has(key)) cache.set(key, strokeMap(ch, paint));
  return cache.get(key);
}

// Time map for a whole Devanagari line; width is measured in font units.
export function lineMap(text, paint, widthEm) {
  const key = `sa:${text}`;
  if (!cache.has(key)) {
    const w = Math.ceil(widthEm * MAP_FONT + MAP_FONT * 0.6), h = Math.ceil(MAP_FONT * 1.9);
    const m = mask(w, h, paint);
    const lone = [...text].length === 1;
    cache.set(key, flowMap(m, w, h, !lone, lone));
  }
  return cache.get(key);
}

// ---------------------------------------------------------------- per frame

// Fill `img` (ImageData the size of the map) for progress prog (0..1).
// presence scales everything down as the line dissolves; dry (0..1) says how
// long the ink has had to dry since the brush passed.
export function writeControl(map, img, prog, presence, dry) {
  const { u } = map, d = img.data;
  const soft = 0.035;
  const done = prog >= 1;
  for (let i = 0; i < u.length; i++) {
    const v = u[i];
    let r, g;
    if (v === FAR) { r = done ? 1 : 0; g = 0; }
    else {
      const ahead = prog - v;
      r = ahead <= 0 ? 0 : ahead >= soft ? 1 : ahead / soft;
      g = ahead <= 0 ? 0 : Math.exp(-ahead / 0.18) * (1 - dry) + 0.25 * (1 - dry);
    }
    d[i * 4] = r * presence * 255;
    d[i * 4 + 1] = Math.min(1, g) * 255;
    d[i * 4 + 2] = 0;
    d[i * 4 + 3] = 255;
  }
}
