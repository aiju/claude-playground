// Makes lyrics write themselves.
//
// For every glyph we build a "time map": for each pixel, the moment (0..1)
// the brush reaches it. Japanese characters use KanjiVG stroke order: each
// stroke is a brush moving along its KanjiVG path over the brush-font glyph,
// so strokes appear in the right order and direction and the finished
// character is exactly the font. Devanagari has no stroke data, so ink
// flows through each letter from left to right, and the headline
// (शिरोरेखा) appears along with the letters beneath it.
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

// Euclidean distance from every pixel to the nearest pixel where seed[i] is
// set (Felzenszwalb and Huttenlocher's two-pass transform).
function distanceTo(seed, w, h) {
  const INF = 1e10, n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const g = new Float64Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = seed[i] ? 0 : INF;
  const line = (len, off, stride) => {
    for (let q = 0; q < len; q++) f[q] = g[off + q * stride];
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s;
      while ((s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])) <= z[k]) k--;
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    for (let q = 0; q < len; q++) g[off + q * stride] = d[q];
  };
  for (let x = 0; x < w; x++) line(h, x, w);
  for (let y = 0; y < h; y++) line(w, y * w, 1);
  const out = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) out[i] = Math.sqrt(g[i]);
  return out;
}

// ---------------------------------------------------------------- time maps

// Place the KanjiVG strokes (on their 109 grid) over the brush-font glyph.
// Start by fitting the strokes' extent to the ink's, then nudge the scale and
// offset of each axis to bring the strokes onto the ink and cover as much of
// it as they can. Returns the transform as [ax, cx, ay, cy]:
// x' = cx + (x - 54.5) * ax, y' = cy + (y - 54.5) * ay.
function fitStrokes(lines, m, w, h, box) {
  let kx0 = 1e9, ky0 = 1e9, kx1 = -1e9, ky1 = -1e9;
  for (const l of lines) for (const [x, y] of l.pts) { kx0 = Math.min(kx0, x); ky0 = Math.min(ky0, y); kx1 = Math.max(kx1, x); ky1 = Math.max(ky1, y); }
  const pad = 3.5;  // half a KanjiVG stroke width
  kx0 -= pad; ky0 -= pad; kx1 += pad; ky1 += pad;
  const em = MAP_FONT / 109;
  const axis = (k0, k1, i0, i1, centre) => {
    // fit the axis to the ink box unless the stroke extent is too thin to trust
    if (k1 - k0 < 22) return [em, centre];
    const s = (i1 - i0 + 1) / (k1 - k0);
    return [s, i0 + (54.5 - k0) * s];
  };
  const start = [...axis(kx0, kx1, box.x0, box.x1, w / 2), ...axis(ky0, ky1, box.y0, box.y1, h / 2)];

  const inked = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) if (m[i] > 100) inked[i] = 1;
  const toInk = distanceTo(inked, w, h);
  const pts = [];
  for (const l of lines) for (let k = 0; k < l.pts.length; k += 2) pts.push(l.pts[k][0], l.pts[k][1]);
  // coverage is judged on a half-size grid, which is plenty and four times faster
  const hw = w >> 1, hh = h >> 1;
  const inkHalf = [];
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) if (inked[(2 * y) * w + 2 * x] || inked[(2 * y + 1) * w + 2 * x + 1]) inkHalf.push(y * hw + x);
  const hit = new Uint8Array(hw * hh);
  const cost = ([ax, cx, ay, cy]) => {
    // strokes should lie on the ink ...
    let off = 0;
    hit.fill(0);
    for (let k = 0; k < pts.length; k += 2) {
      const fx = cx + (pts[k] - 54.5) * ax, fy = cy + (pts[k + 1] - 54.5) * ay;
      const x = Math.round(fx), y = Math.round(fy);
      if (x < 0 || y < 0 || x >= w || y >= h) { off += 20; continue; }
      off += toInk[y * w + x];
      hit[Math.min(hh - 1, fy >> 1) * hw + Math.min(hw - 1, fx >> 1)] = 1;
    }
    // ... and the ink should be near a stroke
    const toStroke = distanceTo(hit, hw, hh);
    let bare = 0;
    for (const i of inkHalf) bare += toStroke[i];
    return off / (pts.length / 2) + bare / inkHalf.length;
  };
  let best = start.slice(), bestCost = cost(best);
  const step = [start[0] * 0.04, 1.5, start[2] * 0.04, 1.5];
  for (let round = 0; round < 60 && step[1] > 0.2; round++) {
    let moved = false;
    for (let p = 0; p < 4; p++) for (const dir of [1, -1]) {
      const cand = best.slice();
      cand[p] += dir * step[p];
      if (p % 2 === 0 && Math.abs(cand[p] / start[p] - 1) > 0.2) continue;
      const c = cost(cand);
      if (c < bestCost - 1e-4) { best = cand; bestCost = c; moved = true; }
    }
    if (!moved) for (let p = 0; p < 4; p++) step[p] /= 2;
  }
  return best;
}

// Stroke-order time map for one Japanese character.
//
// Each stroke is a brush of the glyph's stroke width moving along the
// KanjiVG path; a pixel gets the moment the first brush to pass over it
// reaches it. Where strokes cross, the earlier one inks the crossing. Ink
// the font has but the strokes don't reach (the font and KanjiVG never
// agree exactly) fills in from the nearest inked part as the brush passes.
function strokeMap(ch, paint) {
  const w = MAP_SIZE, h = MAP_SIZE;
  const m = mask(w, h, paint);
  const box = inkBox(m, w, h);
  const strokes = STROKES[ch];
  if (!box || !strokes) return flowMap(m, w, h, false);

  const lines = strokes.map(d => resample(samplePath(d), 1.0));
  const [ax, cx, ay, cy] = fitStrokes(lines, m, w, h, box);
  // the strokes in map pixels, with arc length in map pixels
  const paths = lines.map(l => {
    const xs = [], ys = [], as = [];
    let a = 0;
    l.pts.forEach(([x, y], k) => {
      const px = cx + (x - 54.5) * ax, py = cy + (y - 54.5) * ay;
      if (k) a += Math.hypot(px - xs[k - 1], py - ys[k - 1]);
      xs.push(px); ys.push(py); as.push(a);
    });
    return { xs, ys, as, len: a,
      x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const pause = 7 * (ax + ay) / 2;   // the brush lifting between strokes
  let total = 0;
  const starts = paths.map(p => { const s = total; total += p.len + pause; return s; });
  total -= pause;

  // how wide the brush is: the ink's half-width along the strokes
  const inked = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) inked[i] = m[i] > 100 ? 0 : 1;
  const depth = distanceTo(inked, w, h);   // distance to the nearest un-inked pixel
  const widths = [];
  for (const p of paths) for (let k = 0; k < p.xs.length; k += 3) {
    const x = Math.round(p.xs[k]), y = Math.round(p.ys[k]);
    if (x >= 0 && y >= 0 && x < w && y < h && depth[y * w + x] > 0.5) widths.push(depth[y * w + x]);
  }
  widths.sort((a, b) => a - b);
  const half = Math.max(2, widths.length ? widths[widths.length >> 1] : 4);
  const brush = half * 1.3;         // the brush tip reaches a little ahead of its centre
  const tie = Math.max(1.5, 0.4 * half);
  const reach = 2.2 * half + 3;     // ink further than this from any stroke waits to be filled in

  const u = new Float32Array(w * h).fill(FAR);
  const label = new Int16Array(w * h).fill(-1);
  const ds = new Float32Array(paths.length), as = new Float32Array(paths.length);
  const timeOf = (s, d, a) => (starts[s] + Math.max(0, a - Math.sqrt(Math.max(0, brush * brush - d * d)))) / total;
  const nearest = (s, px, py) => {
    // distance from (px, py) to stroke s, and the arc length at the closest point
    const p = paths[s];
    let bd = 1e9, ba = 0;
    for (let k = 1; k < p.xs.length; k++) {
      const x0 = p.xs[k - 1], y0 = p.ys[k - 1], ex = p.xs[k] - x0, ey = p.ys[k] - y0;
      const ll = ex * ex + ey * ey;
      const t = ll > 0 ? Math.min(1, Math.max(0, ((px - x0) * ex + (py - y0) * ey) / ll)) : 0;
      const dx = x0 + ex * t - px, dy = y0 + ey * t - py, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; ba = p.as[k - 1] + t * (p.as[k] - p.as[k - 1]); }
    }
    ds[s] = Math.sqrt(bd); as[s] = ba;
  };
  for (let i = 0; i < m.length; i++) {
    if (m[i] <= 30) continue;
    const px = i % w, py = (i / w) | 0;
    let dmin = 1e9;
    for (let s = 0; s < paths.length; s++) {
      const p = paths[s];
      const bx = Math.max(p.x0 - px, 0, px - p.x1), by = Math.max(p.y0 - py, 0, py - p.y1);
      if (Math.hypot(bx, by) > Math.min(dmin + tie, reach) + brush) { ds[s] = 1e9; continue; }
      nearest(s, px, py);
      dmin = Math.min(dmin, ds[s]);
    }
    if (dmin > reach) continue;
    // of the strokes that pass over this pixel, the earliest inks it
    let bt = 2, bs = -1;
    for (let s = 0; s < paths.length; s++) {
      if (ds[s] > dmin + tie && ds[s] > 0.75 * half) continue;
      const t = timeOf(s, ds[s], as[s]);
      if (t < bt) { bt = t; bs = s; }
    }
    u[i] = bt; label[i] = bs;
  }

  // tidy the edges between strokes: a pixel surrounded by another stroke's
  // pixels joins that stroke
  const around = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  for (let pass = 0; pass < 2; pass++) {
    const next = label.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, own = label[i];
      if (own < 0) continue;
      let bl = own, bc = 0;
      for (let a = 0; a < 8; a++) {
        const l = label[i + around[a]];
        if (l < 0 || l === own || l === bl) continue;
        let c = 0;
        for (let b = 0; b < 8; b++) if (label[i + around[b]] === l) c++;
        if (c > bc) { bc = c; bl = l; }
      }
      if (bl !== own && bc >= 5) next[i] = bl;
    }
    for (let i = 0; i < label.length; i++) {
      if (next[i] === label[i]) continue;
      label[i] = next[i];
      nearest(next[i], i % w, (i / w) | 0);
      u[i] = timeOf(next[i], ds[next[i]], as[next[i]]);
    }
  }

  // the rest of the ink fills in from its inked neighbours at brush speed
  const heap = [];
  const push = (t, i) => {
    heap.push([t, i]);
    for (let k = heap.length - 1; k > 0;) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]]; k = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const l = 2 * k + 1, r = l + 1;
        let s = k;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === k) break;
        [heap[s], heap[k]] = [heap[k], heap[s]]; k = s;
      }
    }
    return top;
  };
  for (let i = 0; i < u.length; i++) if (u[i] !== FAR) push(u[i], i);
  const stepT = 1 / total;
  while (heap.length) {
    const [t, i] = pop();
    if (t > u[i] && u[i] !== FAR) continue;
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (m[j] <= 30) continue;
      const tj = t + c * stepT;
      if (u[j] === FAR || tj < u[j] - 1e-6) {
        if (label[j] >= 0) continue;   // inked by a stroke already
        u[j] = tj; push(tj, j);
      }
    }
  }
  // ink cut off from every stroke (a separate speck of the font) comes with
  // the nearest inked pixel
  const lost = [];
  for (let i = 0; i < u.length; i++) if (m[i] > 30 && u[i] === FAR) lost.push(i);
  if (lost.length) {
    const have = [];
    for (let i = 0; i < u.length; i++) if (u[i] !== FAR) have.push(i);
    for (const i of lost) {
      const x = i % w, y = (i / w) | 0;
      let bd = 1e9, bt = 1;
      for (const j of have) { const d = (j % w - x) ** 2 + (((j / w) | 0) - y) ** 2; if (d < bd) { bd = d; bt = u[j]; } }
      u[i] = bt;
    }
  }

  // a pixel far ahead of or behind all its neighbours would flicker on alone:
  // give it their median
  const fixed = u.slice();
  const nb = new Float32Array(8);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (u[i] === FAR) continue;
    let n = 0, lo = 2, hi = -1;
    for (let a = 0; a < 8; a++) {
      const v = u[i + around[a]];
      if (v !== FAR) { nb[n++] = v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    if (n < 3 || (u[i] > lo - 0.06 && u[i] < hi + 0.06)) continue;
    fixed[i] = nb.subarray(0, n).sort()[n >> 1];
  }
  u.set(fixed);
  dilate(u, w, h, 5);
  return { u, w, h, debug: { paths, half } };
}

// Flowing time map for text without stroke data: ink spreads through each
// connected piece of the glyph from its top-left, pieces left to right (or
// largest first for a lone symbol like ॐ). A Devanagari headline appears
// along with the letters that hang from it.
function flowMap(m, w, h, headline, bySize = false) {
  const u = new Float32Array(w * h).fill(FAR);
  const ink = i => m[i] > 60;
  const box = inkBox(m, w, h);
  if (!box) return { u, w, h };

  const isHead = new Uint8Array(w * h);
  let head = null;
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
      head = { y0, y1 };
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
    const dur = weight[k] / sum;
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
  if (head) {
    // each column of the headline appears when the letter beneath it starts
    // to: the earliest ink below it, smoothed along the line
    const col = new Float32Array(w).fill(FAR);
    for (let x = box.x0; x <= box.x1; x++) {
      let first = FAR;
      for (let y = head.y1 + 1; y <= Math.min(box.y1, head.y1 + (head.y1 - head.y0) * 6 + 4); y++) {
        const v = u[y * w + x];
        if (v !== FAR && (first === FAR || v < first)) first = v;
      }
      col[x] = first;
    }
    // columns with nothing under them take their neighbours' time
    let last = FAR;
    for (let x = box.x0; x <= box.x1; x++) { if (col[x] === FAR) col[x] = last; else last = col[x]; }
    last = FAR;
    for (let x = box.x1; x >= box.x0; x--) { if (col[x] === FAR) col[x] = last; else last = col[x]; }
    const smooth = new Float32Array(w);
    const r = Math.round(MAP_FONT * 0.12);
    for (let x = box.x0; x <= box.x1; x++) {
      let s = 0, n = 0;
      for (let k = Math.max(box.x0, x - r); k <= Math.min(box.x1, x + r); k++) if (col[k] !== FAR) { s += col[k]; n++; }
      smooth[x] = n ? s / n : 0;
    }
    for (let i = 0; i < u.length; i++) if (isHead[i]) u[i] = smooth[i % w];
  }
  dilate(u, w, h, 5);
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
// long the ink has had to dry since the brush passed. Pixels away from the
// glyph stay at zero, so neighbouring glyphs can be combined by taking the
// larger value ('lighten').
export function writeControl(map, img, prog, presence, dry) {
  const { u } = map, d = img.data;
  const soft = 0.035;
  for (let i = 0; i < u.length; i++) {
    const v = u[i];
    let r, g;
    if (v === FAR) { r = 0; g = 0; }
    else {
      const ahead = prog * (1 + soft) - v;   // everything is fully inked at prog = 1
      r = ahead <= 0 ? 0 : ahead >= soft ? 1 : ahead / soft;
      g = ahead <= 0 ? 0 : Math.exp(-ahead / 0.18) * (1 - dry) + 0.25 * (1 - dry);
    }
    d[i * 4] = r * presence * 255;
    d[i * 4 + 1] = Math.min(1, g) * 255;
    d[i * 4 + 2] = 0;
    d[i * 4 + 3] = 255;
  }
}
