// Reads glyph outlines straight from the brush font's TrueType data, so the
// Japanese lyrics can be drawn from the font's own contours, and so the
// writing (writing.js) knows which parts of a character the font draws as
// separate pieces. A piece is an outer contour with the holes inside it.
// Pieces can overlap, as where 夕 meets 口 in 名.
//
// Handles what the subset font uses: a (3,1) format 4 cmap and simple glyf
// outlines (no composite glyphs).

let font = null;
const shapes = new Map();

export function setOutlineFont(buffer) {
  font = parseFont(buffer);
  shapes.clear();
}

export const hasOutline = ch => !!font && font.glyphIndex(ch) > 0;

// Fill character ch at the origin of ctx, centred on its em box, size pixels
// to the em; only piece `piece` if given.
export function drawGlyph(ctx, ch, size, piece = null) {
  const g = glyphShape(ch);
  const k = size / font.upm;
  ctx.save();
  ctx.scale(k, -k);
  ctx.translate(-g.adv / 2, -font.mid);
  ctx.fill(piece == null ? g.path : g.pieces[piece], 'nonzero');
  ctx.restore();
}

export const pieceCount = ch => glyphShape(ch).pieces.length;

// Where a character sits: its advance width, units per em and the height of
// the em box's middle, all in font units, to map font coordinates onto the
// way drawGlyph places the character.
export function glyphMetrics(ch) { return { adv: glyphShape(ch).adv, upm: font.upm, mid: font.mid }; }

function glyphShape(ch) {
  if (shapes.has(ch)) return shapes.get(ch);
  const gi = font.glyphIndex(ch);
  const { contours, adv } = font.glyph(gi);
  const polys = contours.map(flatten);
  const area = polys.map(p => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0) / 2);
  // A contour is a hole when it winds the other way from a contour that
  // wholly contains it; it belongs to the smallest such contour.
  const owner = polys.map((p, i) => {
    let best = -1;
    polys.forEach((q, j) => {
      if (i === j || Math.sign(area[j]) === Math.sign(area[i]) || Math.abs(area[j]) <= Math.abs(area[i])) return;
      if (!p.every(pt => inside(pt, q))) return;
      if (best < 0 || Math.abs(area[j]) < Math.abs(area[best])) best = j;
    });
    return best;
  });
  const path = new Path2D();
  const pieces = [];
  const pieceOf = new Map();
  contours.forEach((c, i) => {
    trace(path, c);
    if (owner[i] >= 0) return;
    const p = new Path2D();
    trace(p, c);
    pieceOf.set(i, p);
    pieces.push(p);
  });
  contours.forEach((c, i) => { if (owner[i] >= 0 && pieceOf.has(owner[i])) trace(pieceOf.get(owner[i]), c); });
  const shape = { path, pieces, adv };
  shapes.set(ch, shape);
  return shape;
}

// ---------------------------------------------------------------- contours

// TrueType contours are quadratic: between two off-curve points there is an
// implied on-curve point halfway.
function segments(c) {
  const n = c.length;
  let s = c.findIndex(p => p.on);
  const pts = [];
  if (s < 0) { pts.push({ x: (c[0].x + c[1 % n].x) / 2, y: (c[0].y + c[1 % n].y) / 2, on: true }); s = 0; }
  for (let k = 0; k <= n; k++) pts.push(c[(s + k) % n]);
  const out = [];   // [start, control or null, end]
  let start = pts[0], ctrl = null;
  for (let k = 1; k < pts.length; k++) {
    const p = pts[k];
    if (p.on) { out.push([start, ctrl, p]); start = p; ctrl = null; }
    else if (ctrl) { const mid = { x: (ctrl.x + p.x) / 2, y: (ctrl.y + p.y) / 2 }; out.push([start, ctrl, mid]); start = mid; ctrl = p; }
    else ctrl = p;
  }
  if (ctrl) out.push([start, ctrl, pts[0]]);
  return out;
}

function trace(path, c) {
  const segs = segments(c);
  if (!segs.length) return;
  path.moveTo(segs[0][0].x, segs[0][0].y);
  for (const [, q, e] of segs) q ? path.quadraticCurveTo(q.x, q.y, e.x, e.y) : path.lineTo(e.x, e.y);
  path.closePath();
}

function flatten(c) {
  const out = [];
  for (const [a, q, e] of segments(c)) {
    if (!q) { out.push([a.x, a.y]); continue; }
    for (let k = 0; k < 6; k++) {
      const t = k / 6, u = 1 - t;
      out.push([u * u * a.x + 2 * u * t * q.x + t * t * e.x, u * u * a.y + 2 * u * t * q.y + t * t * e.y]);
    }
  }
  return out;
}

function inside([x, y], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// ---------------------------------------------------------------- TrueType

function parseFont(buffer) {
  const v = new DataView(buffer);
  const tables = {};
  const n = v.getUint16(4);
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    tables[String.fromCharCode(v.getUint8(r), v.getUint8(r + 1), v.getUint8(r + 2), v.getUint8(r + 3))] = v.getUint32(r + 8);
  }
  const head = tables.head, upm = v.getUint16(head + 18), longLoca = v.getInt16(head + 50) === 1;
  const numGlyphs = v.getUint16(tables.maxp + 4);
  const numHMetrics = v.getUint16(tables.hhea + 34);
  const os2 = tables['OS/2'];
  const ascent = v.getInt16(os2 + 68), descent = v.getInt16(os2 + 70);   // typographic: the em box

  // cmap: the Windows Unicode BMP subtable, format 4
  const cmap = tables.cmap;
  let sub = -1;
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const r = cmap + 4 + i * 8;
    if (v.getUint16(r) === 3 && v.getUint16(r + 2) === 1) sub = cmap + v.getUint32(r + 4);
  }
  if (sub < 0 || v.getUint16(sub) !== 4) throw new Error('outlines: no format 4 cmap');
  const segX2 = v.getUint16(sub + 6);
  const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
  function glyphIndex(ch) {
    const code = ch.codePointAt(0);
    for (let i = 0; i < segX2; i += 2) {
      if (code > v.getUint16(ends + i)) continue;
      const start = v.getUint16(starts + i);
      if (code < start) return 0;
      const ro = v.getUint16(ranges + i);
      if (!ro) return (code + v.getInt16(deltas + i)) & 0xffff;
      const g = v.getUint16(ranges + i + ro + (code - start) * 2);
      return g ? (g + v.getInt16(deltas + i)) & 0xffff : 0;
    }
    return 0;
  }

  const loca = i => (longLoca ? v.getUint32(tables.loca + i * 4) : v.getUint16(tables.loca + i * 2) * 2);
  function glyph(gi) {
    const adv = v.getUint16(tables.hmtx + Math.min(gi, numHMetrics - 1) * 4);
    const off = tables.glyf + loca(gi);
    if (gi >= numGlyphs || loca(gi + 1) === loca(gi)) return { contours: [], adv };
    const nc = v.getInt16(off);
    if (nc < 0) throw new Error('outlines: composite glyphs aren\'t supported');
    const endPts = [];
    for (let i = 0; i < nc; i++) endPts.push(v.getUint16(off + 10 + i * 2));
    const np = nc ? endPts[nc - 1] + 1 : 0;
    let p = off + 10 + nc * 2;
    p += 2 + v.getUint16(p);   // skip the instructions
    const flags = [];
    while (flags.length < np) {
      const f = v.getUint8(p++);
      flags.push(f);
      if (f & 8) { let r = v.getUint8(p++); while (r--) flags.push(f); }
    }
    const coord = (short, same) => {
      const out = [];
      let c = 0;
      for (const f of flags) {
        if (f & short) { const d = v.getUint8(p++); c += f & same ? d : -d; }
        else if (!(f & same)) { c += v.getInt16(p); p += 2; }
        out.push(c);
      }
      return out;
    };
    const xs = coord(2, 16), ys = coord(4, 32);
    const contours = [];
    let s = 0;
    for (const e of endPts) {
      const c = [];
      for (let i = s; i <= e; i++) c.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) });
      contours.push(c);
      s = e + 1;
    }
    return { contours, adv };
  }

  return { upm, mid: (ascent + descent) / 2, glyphIndex, glyph };
}
