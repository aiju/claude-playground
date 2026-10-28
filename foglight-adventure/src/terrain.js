// Builds the static mesh for one screen of an area: ground, cliffs, water
// beds, trees, walls and the rest. Everything is derived from tile positions
// with deterministic noise, so neighbouring screens line up seamlessly.

import { MeshBuilder } from './mesh.js';
import { T, TILE, SW, SH } from './tiles.js';
import { hexLin, hash2, hash3, noise3, mixCol, lerp, scaleCol } from './math.js';

const C = hexLin;

export const THEMES = {
  overworld: {
    rock: [C(0xa08c72), C(0x8f7b63), C(0xb09c80)], rockTop: [C(0x74b84c), C(0x64a843)],
    floor: [C(0xb9b2a2), C(0xaea796)], grout: C(0x6b665c),
    wall: [C(0x9c968a), C(0x8e887c)], wallTop: C(0x4d4a44),
    bed: C(0x2f8f8c), bank: C(0x8a6d4c),
  },
  shrine: {
    rock: [C(0x6f8f8a), C(0x5f7f7a), C(0x7f9f99)], rockTop: [C(0x4f6f6a), C(0x48655f)],
    floor: [C(0x9ab7b0), C(0x8eaaa3)], grout: C(0x2f4442),
    wall: [C(0x6e918c), C(0x62857f), C(0x7a9d97)], wallTop: C(0x263634), trim: C(0xd9b44a),
    bed: C(0x1d5f6a), bank: C(0x4f6f6a),
  },
  cave: {
    rock: [C(0x7b6550), C(0x6c5744), C(0x88715a)], rockTop: [C(0x4a3b2e), C(0x433528)],
    floor: [C(0x9a8670), C(0x8c785f)], grout: C(0x3d3226), cave: [C(0x8f7a62), C(0x84705a)],
    wall: [C(0x7b6550), C(0x6c5744)], wallTop: C(0x2e251c),
    bed: C(0x245a62), bank: C(0x5a4636),
  },
  house: {
    rock: [C(0x8a7a66), C(0x7a6a56), C(0x9a8a76)], rockTop: [C(0x5a4a3a), C(0x504232)],
    floor: [C(0xc8a272), C(0xbb9464)], grout: C(0x6a4a2a), wood: [C(0xc99c66), C(0xb88c58), C(0xd6aa74)],
    wall: [C(0xefe2c6), C(0xe6d7b8)], wallTop: C(0x5a4030), trim: C(0x8a5a36),
    bed: C(0x2f8f8c), bank: C(0x8a6d4c),
  },
  lighthouse: {
    rock: [C(0x8c8f96), C(0x7c7f86), C(0x9c9fa6)], rockTop: [C(0x4a4d54), C(0x42454c)],
    floor: [C(0xc4a47c), C(0xb5956c)], grout: C(0x5a4632), wood: [C(0xc4a074), C(0xb39066), C(0xd0ac80)],
    wall: [C(0xf0ece4), C(0xe6e0d6)], wallTop: C(0x3a3d44), trim: C(0xc8463c),
    bed: C(0x1d5f6a), bank: C(0x6a6d74),
  },
};

const SOFT = {
  [T.GRASS.id]: [C(0x82c653), C(0x6fb64a)],
  [T.FLOWERS.id]: [C(0x86c957), C(0x74ba4c)],
  [T.PATH.id]: [C(0xe0c08a), C(0xd3b17b)],
  [T.SAND.id]: [C(0xf3e2ad), C(0xe9d49a)],
  [T.FOREST.id]: [C(0x5aa64b), C(0x4c9541)],
};

// Paths and sand are drawn as overlays on top of the grass, with edges that
// are pulled in by noise wherever they meet a different kind of ground.
const OVERLAY = { [T.PATH.id]: { y: 0.014, over: [T.PATH.id] }, [T.SAND.id]: { y: 0.007, over: [T.SAND.id, T.PATH.id] } };

function softColor(area, tx, ty) {
  const g = area.groundAt(tx, ty);
  const pal = SOFT[g] || (area.theme === 'cave' ? THEMES.cave.cave : null);
  if (!pal) return null;
  const n = noise3(tx * 0.31, ty * 0.31, 3.7) * 0.7 + hash2(tx, ty) * 0.3;
  return mixCol(pal[0], pal[1], n);
}

function isSoft(area, tx, ty) {
  const g = area.groundAt(tx, ty);
  return !!SOFT[g] || (area.theme === 'cave' && g === T.CAVE.id);
}

const tallOccluder = (t) => t === T.CLIFF.id || t === T.ROCKWALL.id || t === T.WALL.id || t === T.TREE.id || t === T.PINE.id || t === T.HOUSE.id || t === T.PALM.id;

// Colour of the soft ground at a vertex. Vertices inside a tile take its own
// colour; vertices on a tile boundary blend the touching tiles with a noisy
// weight, so paths and beaches get soft, slightly irregular edges.
function softVertex(area, x, z, fallback) {
  const xs = Number.isInteger(x) ? [x - 1, x] : [Math.floor(x)];
  const zs = Number.isInteger(z) ? [z - 1, z] : [Math.floor(z)];
  let r = 0, g = 0, b = 0, n = 0, occ = 0;
  for (const tz of zs) for (const tx of xs) {
    const t = area.tileAt(tx, tz);
    if (tallOccluder(t)) occ++;
    if (!TILE[t].ground && !TILE[t].solid) continue;
    if (!isSoft(area, tx, tz) || OVERLAY[area.groundAt(tx, tz)]) continue;
    const c = softColor(area, tx, tz);
    r += c[0]; g += c[1]; b += c[2]; n++;
  }
  let c = n ? [r / n, g / n, b / n] : fallback;
  const j = 1 + (hash2(Math.round(x * 4) + 911, Math.round(z * 4) - 37) - 0.5) * 0.07;
  const ao = 1 - occ * 0.08;
  return [c[0] * j * ao, c[1] * j * ao, c[2] * j * ao];
}

// ---- small decorations ----

function grassTuft(b, x, z, seed, base) {
  const n = 3 + Math.floor(hash2(seed, 7) * 3);
  for (let i = 0; i < n; i++) {
    const a = hash2(seed, i * 13) * Math.PI * 2;
    const ox = x + Math.cos(a) * 0.08, oz = z + Math.sin(a) * 0.08;
    const h = 0.16 + hash2(seed, i * 7 + 1) * 0.14;
    const lean = (hash2(seed, i * 3 + 2) - 0.5) * 0.12;
    const w = 0.035;
    const c0 = scaleCol(base, 0.75), c1 = scaleCol(base, 1.25);
    const dx = Math.cos(a + 1.57) * w, dz = Math.sin(a + 1.57) * w;
    b.tri([ox - dx, 0, oz - dz], [ox + dx, 0, oz + dz], [ox + lean, h, oz + lean * 0.5], c0, c0, c1, [0, 0, 0.6]);
  }
}

const FLOWER_COLS = [C(0xffffff), C(0xffe35c), C(0xff9ec2), C(0xb7a4ff), C(0xff7a5c)];
function flower(b, x, z, seed) {
  const h = 0.14 + hash2(seed, 3) * 0.1;
  const stem = C(0x4f9a3a);
  b.tri([x - 0.012, 0, z], [x + 0.012, 0, z], [x, h, z], stem, stem, stem, [0, 0, 0.5]);
  const col = FLOWER_COLS[Math.floor(hash2(seed, 5) * FLOWER_COLS.length)];
  const r = 0.075;
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2, a1 = ((i + 0.5) / 5) * Math.PI * 2;
    b.tri([x, h, z], [x + Math.cos(a0) * r, h, z + Math.sin(a0) * r], [x + Math.cos(a1) * r * 0.6, h + 0.01, z + Math.sin(a1) * r * 0.6], col, col, col, [0.5, 0.5, 0.5]);
  }
  const ctr = C(0xffc83a);
  b.tri([x - 0.015, h + 0.012, z - 0.015], [x + 0.015, h + 0.012, z - 0.015], [x, h + 0.012, z + 0.02], ctr, ctr, ctr, [0.5, 0.5, 0.5]);
}

export function treeModel(b, x, z, seed, opts = {}) {
  const s = (opts.scale ?? 1) * (0.9 + hash2(seed, 1) * 0.25);
  const trunk = C(0x7a5236);
  b.push();
  b.color(trunk).cylinder(x, 0, z, 0.17 * s, 0.11 * s, 0.95 * s, 6);
  // roots
  for (let i = 0; i < 3; i++) {
    const a = hash2(seed, i + 9) * 6.28;
    b.color(trunk).cone(x + Math.cos(a) * 0.12 * s, 0, z + Math.sin(a) * 0.12 * s, 0.09 * s, 0.25 * s, 4);
  }
  const greens = opts.colors || [C(0x3f9c45), C(0x4cab4f), C(0x358d3d), C(0x5ab655)];
  const k = Math.floor(hash2(seed, 2) * greens.length);
  b.sway = 0.55;
  const clumps = [[0, 1.45, 0, 0.72], [-0.32, 1.2, 0.12, 0.5], [0.3, 1.25, -0.1, 0.52], [0.05, 1.85, -0.05, 0.45]];
  clumps.forEach(([cx, cy, cz, r], i) => {
    const col = greens[(k + i) % greens.length];
    b.color(col).sphere(x + cx * s, cy * s, z + cz * s, r * s, 7, 5, { jitter: 0.35, seed: seed + i * 3.1 });
  });
  // a few fruit or blossoms
  if (opts.fruit || hash2(seed, 4) < 0.25) {
    const fc = opts.fruit ? C(opts.fruit) : C(0xff6a5a);
    for (let i = 0; i < 4; i++) {
      const a = hash2(seed, i * 5 + 11) * 6.28;
      b.color(fc).sphere(x + Math.cos(a) * 0.62 * s, 1.35 * s + hash2(seed, i) * 0.3, z + Math.sin(a) * 0.62 * s, 0.07 * s, 5, 4);
    }
  }
  b.pop();
}

export function pineModel(b, x, z, seed) {
  const s = 0.9 + hash2(seed, 1) * 0.3;
  b.push();
  b.color(C(0x6b4a30)).cylinder(x, 0, z, 0.12 * s, 0.08 * s, 0.6 * s, 5);
  const cols = [C(0x2f7d4a), C(0x37895a), C(0x2a6f43)];
  b.sway = 0.35;
  const rot = hash2(seed, 3);
  [[0.4, 0.68, 0.85], [0.95, 0.52, 0.75], [1.45, 0.36, 0.7]].forEach(([y, r, h], i) => {
    b.color(cols[i % 3]).cone(x, y * s, z, r * s, h * s, 7, { rot: rot + i * 0.4 });
  });
  b.pop();
}

export function palmModel(b, x, z, seed) {
  const lean = 0.3 + hash2(seed, 1) * 0.3, dir = hash2(seed, 2) * 6.28;
  const lx = Math.cos(dir) * lean, lz = Math.sin(dir) * lean;
  b.push();
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const c = i % 2 ? C(0x9a7a4a) : C(0x8a6a3e);
    const x0 = x + lx * t0 * t0, z0 = z + lz * t0 * t0, x1 = x + lx * t1 * t1, z1 = z + lz * t1 * t1;
    b.push().translate(x0, t0 * 1.9, z0);
    b.color(c).cylinder(0, 0, 0, 0.13 - t0 * 0.04, 0.11 - t1 * 0.04, 1.9 / segs + 0.02, 6, { rot: Math.atan2(x1 - x0, z1 - z0) });
    b.pop();
  }
  const tx = x + lx, tz = z + lz, ty = 1.9;
  b.sway = 0.6;
  const greens = [C(0x4caf50), C(0x3f9c45), C(0x5ab655)];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.28 + hash2(seed, 3);
    const ca = Math.cos(a), sa = Math.sin(a);
    const L = 0.95, w = 0.17;
    const tip = [tx + ca * L, ty - 0.45, tz + sa * L], mid = [tx + ca * L * 0.5, ty + 0.12, tz + sa * L * 0.5];
    const px = -sa * w, pz = ca * w;
    const c = greens[i % 3];
    b.color(c).tri([tx, ty, tz], [mid[0] + px, mid[1], mid[2] + pz], mid, c, c, c, [0.2, 0.6, 0.6]);
    b.color(c).tri([tx, ty, tz], mid, [mid[0] - px, mid[1], mid[2] - pz], c, c, c, [0.2, 0.6, 0.6]);
    b.color(c).tri([mid[0] + px, mid[1], mid[2] + pz], tip, mid, c, c, c, [0.6, 1, 0.6]);
    b.color(c).tri([mid[0] - px, mid[1], mid[2] - pz], mid, tip, c, c, c, [0.6, 1, 0.6]);
  }
  b.sway = 0;
  for (let i = 0; i < 3; i++) b.color(C(0x7a5a2a)).sphere(tx + Math.cos(i * 2.1) * 0.12, ty - 0.12, tz + Math.sin(i * 2.1) * 0.12, 0.08, 5, 4);
  b.pop();
}

function rockLump(b, x, y, z, r, col, seed) {
  b.color(col).sphere(x, y, z, r, 6, 4, { jitter: 0.45, seed, sy: 0.75 });
}

// ---- main builder ----

export function buildScreen(gl, area, sx, sy, flags = {}) {
  const b = new MeshBuilder();
  const wb = new MeshBuilder();
  const lights = [];
  const theme = THEMES[area.theme] || THEMES.overworld;
  const x0 = sx * SW, y0 = sy * SH;
  for (let ty = y0; ty < y0 + SH; ty++) {
    for (let tx = x0; tx < x0 + SW; tx++) {
      if (!area.inBounds(tx, ty)) continue;
      buildTile(b, wb, area, theme, tx, ty, lights);
    }
  }
  for (const s of area.structures) {
    if (Math.floor(s.x / SW) === sx && Math.floor(s.y / SH) === sy) buildStructure(b, area, { ...s, lit: s.litFlag ? !!flags[s.litFlag] : s.lit }, lights);
  }
  return { mesh: b.build(gl), water: wb.build(gl), lights };
}

function groundSoft(b, area, tx, ty, decorate) {
  const g0 = area.groundAt(tx, ty);
  const ov = OVERLAY[g0];
  const grassy = SOFT[T.GRASS.id];
  const fallback = ov ? mixCol(grassy[0], grassy[1], 0.5) : (softColor(area, tx, ty) || C(0x7cc24f));
  // base layer
  const v = (i, j) => [tx + i / 2, 0, ty + j / 2];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const a = v(i, j + 1), bb = v(i + 1, j + 1), c = v(i + 1, j), d = v(i, j);
    const ca = softVertex(area, a[0], a[2], fallback), cb = softVertex(area, bb[0], bb[2], fallback);
    const cc = softVertex(area, c[0], c[2], fallback), cd = softVertex(area, d[0], d[2], fallback);
    b.quad(a, bb, c, d, ca, cb, cc, cd);
  }
  if (ov) {
    // does the neighbour continue this overlay? (non-ground neighbours count as yes, so
    // sand runs right up to the water and paths to cliffs)
    const cont = (dx, dy) => {
      const nt = TILE[area.tileAt(tx + dx, ty + dy)];
      if (!nt.ground && !nt.solid) return true;
      if (nt === T.CLIFF || nt === T.ROCKWALL || nt === T.WALL || nt === T.HOUSE) return true;
      return ov.over.includes(area.groundAt(tx + dx, ty + dy)) || (OVERLAY[area.groundAt(tx + dx, ty + dy)] && g0 === T.SAND.id);
    };
    const L = cont(-1, 0), R = cont(1, 0), U = cont(0, -1), D = cont(0, 1);
    const inset = (x, z) => 0.12 + noise3(x * 3.1, z * 3.1, 7.7) * 0.2;
    const N = 3;
    const pal = SOFT[g0];
    const pts = [];
    for (let j = 0; j <= N; j++) {
      pts.push([]);
      for (let i = 0; i <= N; i++) {
        let x = tx + i / N, z = ty + j / N;
        const d = inset(x, z);
        let edge = false;
        const corner = (i === 0 || i === N) && (j === 0 || j === N);
        const H = i === 0 ? L : R, V = j === 0 ? U : D;
        const Dg = corner ? cont(i === 0 ? -1 : 1, j === 0 ? -1 : 1) : false;
        const insetX = (i === 0 || i === N) && !H && !(corner && V && Dg);
        const insetZ = (j === 0 || j === N) && !V && !(corner && H && Dg);
        if (insetX) { x += i === 0 ? d : -d; edge = true; }
        if (insetZ) { z += j === 0 ? d : -d; edge = true; }
        const base = mixCol(pal[0], pal[1], noise3(x * 0.8, z * 0.8, 2.2) * 0.8 + hash2(Math.round(x * 6), Math.round(z * 6)) * 0.2);
        pts[j].push({ p: [x, ov.y, z], c: edge ? scaleCol(base, 0.9) : base });
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = pts[j + 1][i], bb = pts[j + 1][i + 1], c = pts[j][i + 1], d = pts[j][i];
      b.quad(a.p, bb.p, c.p, d.p, a.c, bb.c, c.c, d.c);
    }
  }
  if (!decorate) return;
  const g = area.groundAt(tx, ty);
  const seed = tx * 131 + ty * 977;
  if (g === T.GRASS.id || g === T.FOREST.id) {
    if (hash2(tx, ty) < 0.45) {
      const n = 1 + Math.floor(hash2(ty, tx) * 2);
      for (let k = 0; k < n; k++) grassTuft(b, tx + 0.2 + hash2(seed, k) * 0.6, ty + 0.2 + hash2(seed, k + 5) * 0.6, seed + k, fallback);
    }
  } else if (g === T.FLOWERS.id) {
    const n = 3 + Math.floor(hash2(tx, ty) * 3);
    for (let k = 0; k < n; k++) flower(b, tx + 0.15 + hash2(seed, k) * 0.7, ty + 0.15 + hash2(seed, k + 9) * 0.7, seed + k);
    grassTuft(b, tx + 0.5, ty + 0.5, seed, fallback);
  } else if (g === T.PATH.id && hash2(tx, ty) < 0.3) {
    b.color(C(0xb8a68c)).sphere(tx + hash2(seed, 1), 0.01, ty + hash2(seed, 2), 0.05, 5, 3, { sy: 0.5 });
  } else if (g === T.SAND.id && hash2(tx, ty) < 0.12) {
    // little shells
    b.color(C(0xffc4c4)).sphere(tx + 0.3 + hash2(seed, 1) * 0.4, 0.01, ty + 0.3 + hash2(seed, 2) * 0.4, 0.06, 6, 3, { sy: 0.45 });
  }
}

function slab(b, cx, cz, w, d, col, grout, h = 0.08) {
  b.color(grout).box(cx, -0.04, cz, w + 0.06, 0.08, d + 0.06, { faces: { bottom: false } });
  b.color(col).bevelBox(cx, -h / 2 + 0.005, cz, w, h, d, 0.025);
}

function groundSlab(b, area, theme, tx, ty, kind) {
  const seed = tx * 37 + ty * 101;
  const h = hash2(tx, ty);
  if (kind === T.PLAZA.id) {
    const cols = [C(0xd2cab8), C(0xc4bca9), C(0xb9b19d)];
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const c = cols[Math.floor(hash2(tx * 2 + i, ty * 2 + j) * 3)];
      slab(b, tx + 0.25 + i * 0.5, ty + 0.25 + j * 0.5, 0.44, 0.44, c, C(0x8f8878), 0.06);
    }
  } else if (kind === T.FLOOR.id) {
    const checker = (tx + ty) & 1;
    let c = mixCol(theme.floor[checker], theme.floor[1 - checker], h * 0.3);
    slab(b, tx + 0.5, ty + 0.5, 0.92, 0.92, c, theme.grout);
    if (area.theme === 'shrine' && hash2(ty, tx) < 0.12) {
      // moss patch
      b.color(C(0x6f9a52)).sphere(tx + 0.2 + h * 0.6, 0.005, ty + 0.3 + hash2(seed, 1) * 0.4, 0.16, 6, 3, { sy: 0.12, jitter: 0.4 });
    }
  } else if (kind === T.WOOD.id) {
    const cols = theme.wood || THEMES.house.wood;
    for (let k = 0; k < 4; k++) {
      const c = cols[Math.floor(hash2(tx * 4 + k, ty) * cols.length)];
      const off = (hash2(ty, k) - 0.5) * 0.4;
      b.color(c).box(tx + 0.5 + off * 0, -0.03, ty + 0.125 + k * 0.25, 0.99, 0.06, 0.235);
    }
  } else if (kind === T.CARPET.id) {
    b.color(C(0x7a5a3a)).box(tx + 0.5, -0.03, ty + 0.5, 1, 0.06, 1);
    const edge = (dx, dy) => area.tileAt(tx + dx, ty + dy) !== T.CARPET.id;
    const red = C(0xb8463e), gold = C(0xe0b040);
    b.color(red).box(tx + 0.5, 0.005, ty + 0.5, 1, 0.012, 1);
    if (edge(0, -1)) b.color(gold).box(tx + 0.5, 0.012, ty + 0.12, 1, 0.012, 0.06);
    if (edge(0, 1)) b.color(gold).box(tx + 0.5, 0.012, ty + 0.88, 1, 0.012, 0.06);
    if (edge(-1, 0)) b.color(gold).box(tx + 0.12, 0.012, ty + 0.5, 0.06, 0.012, 1);
    if (edge(1, 0)) b.color(gold).box(tx + 0.88, 0.012, ty + 0.5, 0.06, 0.012, 1);
  } else if (kind === T.ICE.id) {
    const c = mixCol(C(0xbfe6f5), C(0xa6d8ee), h);
    slab(b, tx + 0.5, ty + 0.5, 0.96, 0.96, c, C(0x6fa8c0), 0.06);
    b.color(C(0xffffff)).box(tx + 0.3 + h * 0.3, 0.004, ty + 0.5, 0.35, 0.004, 0.03);
  } else {
    slab(b, tx + 0.5, ty + 0.5, 0.92, 0.92, theme.floor[(tx + ty) & 1], theme.grout);
  }
}

function buildTile(b, wb, area, theme, tx, ty, lights) {
  const t = area.tileAt(tx, ty);
  const def = TILE[t];
  const g = area.groundAt(tx, ty);
  const seed = tx * 7919 + ty * 104729;

  // ground under the tile
  const needsGround = def.ground && t !== T.CLIFF.id && t !== T.ROCKWALL.id && t !== T.WALL.id && t !== T.VOID.id;
  if (needsGround) {
    if (SOFT[g] || (area.theme === 'cave' && g === T.CAVE.id)) groundSoft(b, area, tx, ty, def === TILE[g]);
    else groundSlab(b, area, theme, tx, ty, g);
  }

  switch (t) {
    case T.CLIFF.id:
    case T.ROCKWALL.id:
      buildCliff(b, area, theme, tx, ty);
      break;
    case T.TREE.id:
      if (area.groundAt(tx, ty) === T.FOREST.id) treeModel(b, tx + 0.5, ty + 0.5, seed, { colors: [C(0x2f8a3c), C(0x3a9844), C(0x2a7a36), C(0x47a24a)], scale: 1.08 });
      else treeModel(b, tx + 0.5, ty + 0.5, seed);
      break;
    case T.PINE.id:
      pineModel(b, tx + 0.5, ty + 0.5, seed);
      break;
    case T.PALM.id:
      palmModel(b, tx + 0.5, ty + 0.5, seed);
      break;
    case T.FENCE.id:
      buildFence(b, area, tx, ty);
      break;
    case T.LEDGE.id:
      buildLedge(b, area, tx, ty);
      break;
    case T.WATER.id:
    case T.BRIDGE_H.id:
    case T.BRIDGE_V.id:
    case T.DOCK.id:
    case T.BOAT.id:
      buildWater(b, wb, area, theme, tx, ty);
      if (t === T.BRIDGE_H.id || t === T.BRIDGE_V.id || t === T.DOCK.id) buildBridge(b, area, tx, ty, t);
      if (t === T.BOAT.id) buildBoat(b, tx, ty);
      break;
    case T.SHALLOW.id:
      b.color(C(0xd8c890)).box(tx + 0.5, -0.12, ty + 0.5, 1, 0.04, 1);
      wb.data.push(...waterQuad(area, tx, ty, -0.03));
      break;
    case T.PIT.id:
      buildPit(b, area, theme, tx, ty);
      break;
    case T.WALL.id:
      buildWall(b, area, theme, tx, ty);
      break;
    case T.STATUE.id:
      buildStatue(b, area, theme, tx, ty);
      break;
    case T.SPIKES.id:
      groundSlab(b, area, theme, tx, ty, T.FLOOR.id);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++)
        b.color(C(0xc8ccd4)).cone(tx + 0.2 + i * 0.3, 0, ty + 0.2 + j * 0.3, 0.09, 0.32, 4);
      break;
    case T.BOOKSHELF.id: {
      b.color(C(0x7a5232)).box(tx + 0.5, 1.0, ty + 0.55, 0.96, 2.0, 0.7);
      const bookCols = [0xc0463e, 0x3e7ac0, 0x4aa05a, 0xe0b040, 0x8a5ac0, 0xe08a40];
      for (let shelf = 0; shelf < 4; shelf++) {
        let x = tx + 0.08;
        while (x < tx + 0.9) {
          const w = 0.06 + hash2(Math.floor(x * 50), shelf + ty) * 0.06;
          const h = 0.28 + hash2(shelf, Math.floor(x * 50)) * 0.12;
          b.color(bookCols[Math.floor(hash2(Math.floor(x * 37), shelf * 3 + tx) * 6)]).box(x + w / 2, 0.15 + shelf * 0.46 + h / 2, ty + 0.92, w * 0.9, h, 0.06);
          x += w;
        }
      }
      break;
    }
    case T.COUNTER.id:
      b.color(C(0x9a6a40)).bevelBox(tx + 0.5, 0.45, ty + 0.5, 1.0, 0.9, 0.8, 0.05, { topColor: 0xc0905a });
      break;
    case T.LAMP.id: {
      const st = C(0xb8b4a8);
      b.color(st).cylinder(tx + 0.5, 0, ty + 0.5, 0.22, 0.18, 0.15, 6);
      b.color(st).cylinder(tx + 0.5, 0.15, ty + 0.5, 0.08, 0.08, 0.55, 6);
      b.color(st).box(tx + 0.5, 0.75, ty + 0.5, 0.42, 0.08, 0.42);
      b.push(); b.emis = 1.2; b.color(C(0xffd27a)).box(tx + 0.5, 0.93, ty + 0.5, 0.26, 0.28, 0.26); b.pop();
      b.color(st).cone(tx + 0.5, 1.07, ty + 0.5, 0.36, 0.3, 4, { rot: Math.PI / 4 });
      lights.push({ x: tx + 0.5, y: 1.0, z: ty + 0.5, r: 3.2, col: [1.6, 1.1, 0.5] });
      break;
    }
    case T.GRAVE.id:
      b.color(C(0x9a9aa2)).bevelBox(tx + 0.5, 0.35, ty + 0.45, 0.6, 0.7, 0.18, 0.08);
      b.color(C(0x7a7a82)).box(tx + 0.5, 0.04, ty + 0.62, 0.7, 0.08, 0.4);
      break;
    case T.WELL.id: {
      const st = C(0xa8a49a);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        b.color(i & 1 ? st : C(0x98948a)).box(tx + 0.5 + Math.cos(a) * 0.4, 0.28, ty + 0.5 + Math.sin(a) * 0.4, 0.26, 0.56, 0.2);
      }
      b.color(C(0x10202a)).disc(tx + 0.5, 0.3, ty + 0.5, 0.32, 10);
      b.color(C(0x7a5236)).box(tx + 0.1, 0.9, ty + 0.5, 0.08, 1.2, 0.08);
      b.color(C(0x7a5236)).box(tx + 0.9, 0.9, ty + 0.5, 0.08, 1.2, 0.08);
      b.color(C(0xb8504a)).prism([[tx - 0.05, ty + 0.1], [tx + 1.05, ty + 0.1], [tx + 1.05, ty + 0.9], [tx - 0.05, ty + 0.9]], 1.45, 1.55);
      b.color(C(0x7a5236)).box(tx + 0.5, 1.3, ty + 0.5, 0.9, 0.06, 0.06);
      break;
    }
    case T.STUMP.id:
      b.color(C(0x7a5236)).cylinder(tx + 0.5, 0, ty + 0.5, 0.36, 0.32, 0.38, 8, { topColor: 0xd8b07a });
      b.color(C(0xb08050)).disc(tx + 0.5, 0.385, ty + 0.5, 0.18, 8);
      break;
  }
}

function buildCliff(b, area, theme, tx, ty) {
  let h = area.cliffAt(tx, ty);
  // indoors, rock walls on the bottom row of a room are cut down like dungeon walls
  if (isLowWall(area, tx, ty)) h = 0.5;
  const isRock = area.tileAt(tx, ty) === T.ROCKWALL.id || area.theme !== 'overworld';
  const rock = theme.rock;
  const topPal = isRock ? theme.rockTop : [C(0x76ba4e), C(0x67ab45)];
  const amp = 0.17;
  b.push();
  b.displace = (x, y, z) => {
    if (y < -0.05) return [x, y, z];
    const k = Math.min(1, (y + 0.05) / 0.4);
    return [
      x + (noise3(x * 1.9, y * 1.4, z * 1.9) - 0.5) * amp * 2 * k,
      y + (y > 0.3 ? (noise3(x * 2.3 + 9, y, z * 2.3) - 0.5) * 0.12 : 0),
      z + (noise3(x * 1.9 + 41, y * 1.4, z * 1.9 + 17) - 0.5) * amp * 2 * k,
    ];
  };
  // top (2x2)
  const topCol = (x, z) => {
    const n = noise3(x * 0.6, z * 0.6, 5.1);
    const c = mixCol(topPal[0], topPal[1], n);
    return scaleCol(c, 0.95 + hash2(Math.round(x * 2), Math.round(z * 2)) * 0.1);
  };
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const p = (a, c) => [tx + a / 2, h, ty + c / 2];
    const a = p(i, j + 1), bb = p(i + 1, j + 1), c = p(i + 1, j), d = p(i, j);
    b.quad(a, bb, c, d, topCol(a[0], a[2]), topCol(bb[0], bb[2]), topCol(c[0], c[2]), topCol(d[0], d[2]));
  }
  // a little shrub or rock on top
  if (!isRock && hash2(tx + 5, ty) < 0.25) {
    b.push(); b.sway = 0.3;
    b.color(C(0x4f9e45)).sphere(tx + 0.3 + hash2(tx, ty) * 0.4, h + 0.12, ty + 0.5, 0.22, 6, 4, { jitter: 0.4, sy: 0.7 });
    b.pop();
  }
  // sides: wherever the neighbour is lower
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dx, dy] of dirs) {
    const nt = area.tileAt(tx + dx, ty + dy);
    let nh = (nt === T.CLIFF.id || nt === T.ROCKWALL.id) ? (isLowWall(area, tx + dx, ty + dy) ? 0.5 : area.cliffAt(tx + dx, ty + dy)) : (nt === T.VOID.id ? h : 0);
    if (nt === T.WATER.id || TILE[nt].bridge) nh = -0.55;
    if (nt === T.PIT.id) nh = -3;
    if (nh >= h) continue;
    const y0 = nh - 0.1;
    // edge endpoints, going counter-clockwise when seen from outside
    let ax, az, bx, bz;
    if (dy === 1) { ax = tx; az = ty + 1; bx = tx + 1; bz = ty + 1; }
    else if (dy === -1) { ax = tx + 1; az = ty; bx = tx; bz = ty; }
    else if (dx === 1) { ax = tx + 1; az = ty + 1; bx = tx + 1; bz = ty; }
    else { ax = tx; az = ty; bx = tx; bz = ty + 1; }
    const vs = Math.max(2, Math.ceil((h - y0) / 0.42));
    const sideCol = (x, y, z) => {
      if (y > h - 0.14 && !isRock) return mixCol(topPal[1], C(0x5a9a40), 0.4);
      const band = Math.floor(y * 2.6 + noise3(x * 1.3, y * 0.5, z * 1.3) * 1.6);
      let c = rock[((band % 3) + 3) % 3];
      const shade = 0.7 + 0.3 * Math.min(1, (y - y0) / 0.8);
      return scaleCol(c, shade * (0.94 + hash3(Math.round(x * 4), Math.round(y * 4), Math.round(z * 4)) * 0.12));
    };
    for (let s = 0; s < vs; s++) {
      const ya = y0 + ((h - y0) * s) / vs, yb = y0 + ((h - y0) * (s + 1)) / vs;
      for (let k = 0; k < 2; k++) {
        const fa = k / 2, fb = (k + 1) / 2;
        const p0 = [lerp(ax, bx, fa), ya, lerp(az, bz, fa)];
        const p1 = [lerp(ax, bx, fb), ya, lerp(az, bz, fb)];
        const p2 = [lerp(ax, bx, fb), yb, lerp(az, bz, fb)];
        const p3 = [lerp(ax, bx, fa), yb, lerp(az, bz, fa)];
        b.quad(p0, p1, p2, p3, sideCol(...p0), sideCol(...p1), sideCol(...p2), sideCol(...p3));
      }
    }
  }
  b.pop();
}

function waterQuad(area, tx, ty, y) {
  const out = [];
  const isW = (x, z) => { const t = TILE[area.tileAt(x, z)]; return t.water || t.bridge || t === T.BOAT || t === T.SHALLOW; };
  const shore = (x, z) => {
    let best = 9;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz;
      if (isW(cx, cz) || area.tileAt(cx, cz) === T.VOID.id) continue;
      const ddx = Math.max(cx - x, 0, x - (cx + 1)), ddz = Math.max(cz - z, 0, z - (cz + 1));
      best = Math.min(best, Math.hypot(ddx, ddz));
    }
    return Math.max(0, 1 - best / 2.4);
  };
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const pts = [[i, j + 1], [i + 1, j + 1], [i + 1, j], [i, j + 1], [i + 1, j], [i, j]];
    for (const [a, c] of pts) {
      const x = tx + a / 2, z = ty + c / 2;
      out.push(x, y, z, 0, 1, 0, shore(x, z), 0, 0, 0, 0);
    }
  }
  return out;
}

function buildWater(b, wb, area, theme, tx, ty) {
  const bed = theme.bed;
  const sand = C(0xcdbb88);
  const isW = (x, z) => { const t = TILE[area.tileAt(x, z)]; return t.water || t.bridge || t === T.BOAT || t === T.SHALLOW; };
  // bed, shallower and sandier near the banks
  const depthAt = (x, z) => {
    let near = false;
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) if (!isW(Math.floor(x + dx), Math.floor(z + dz))) near = true;
    return near;
  };
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const pts = [[i, j + 1], [i + 1, j + 1], [i + 1, j], [i, j]].map(([a, c]) => [tx + a / 2, 0, ty + c / 2]);
    const cols = pts.map((p) => {
      const near = depthAt(p[0], p[2]);
      p[1] = near ? -0.45 : -0.62;
      return near ? mixCol(sand, bed, 0.35) : scaleCol(bed, 0.85 + hash2(Math.round(p[0] * 2), Math.round(p[2] * 2)) * 0.2);
    });
    b.quad(pts[0], pts[1], pts[2], pts[3], cols[0], cols[1], cols[2], cols[3]);
  }
  // banks
  const bank = theme.bank;
  const walls = [[0, 1, [tx, ty + 1], [tx + 1, ty + 1]], [0, -1, [tx + 1, ty], [tx, ty]], [1, 0, [tx + 1, ty + 1], [tx + 1, ty]], [-1, 0, [tx, ty], [tx, ty + 1]]];
  for (const [dx, dz, a, c] of walls) {
    const nt = area.tileAt(tx + dx, ty + dz);
    if (isW(tx + dx, ty + dz) || nt === T.VOID.id) continue;
    if (nt === T.CLIFF.id || nt === T.ROCKWALL.id) continue; // cliff draws down into the water
    const top = 0.0, bot = -0.64;
    const cTop = scaleCol(bank, 1.0), cBot = scaleCol(bank, 0.55);
    b.quad([a[0], bot, a[1]], [c[0], bot, c[1]], [c[0], top, c[1]], [a[0], top, a[1]], cBot, cBot, cTop, cTop);
  }
  wb.data.push(...waterQuad(area, tx, ty, -0.14));
  // lily pads and reeds near shore in the overworld
  if (area.theme === 'overworld' && area.tileAt(tx, ty) === T.WATER.id) {
    const h = hash2(tx * 3, ty * 5);
    if (h < 0.08) {
      b.push(); b.sway = 0.15;
      b.color(C(0x4f9e45)).cylinder(tx + 0.3 + h * 4, -0.11, ty + 0.6, 0.2, 0.2, 0.02, 9, { caps: true });
      if (h < 0.03) b.color(C(0xffb4d0)).sphere(tx + 0.35 + h * 4, -0.05, ty + 0.58, 0.07, 6, 4);
      b.pop();
    }
  }
}

function buildBridge(b, area, tx, ty, t) {
  const along = t === T.BRIDGE_H.id ? 'x' : t === T.BRIDGE_V.id ? 'z' : (TILE[area.tileAt(tx - 1, ty)].bridge || TILE[area.tileAt(tx + 1, ty)].bridge ? 'x' : 'z');
  const cols = [C(0xb8875a), C(0xa87a4e), C(0xc4956a)];
  const isB = (x, z) => TILE[area.tileAt(x, z)].bridge;
  for (let k = 0; k < 4; k++) {
    const c = cols[Math.floor(hash2(tx * 4 + k, ty * 3) * 3)];
    if (along === 'x') b.color(c).box(tx + 0.125 + k * 0.25, -0.04, ty + 0.5, 0.22, 0.08, 1.0);
    else b.color(c).box(tx + 0.5, -0.04, ty + 0.125 + k * 0.25, 1.0, 0.08, 0.22);
  }
  // support posts and rails
  const post = C(0x7a5236);
  if (t !== T.DOCK.id) {
    if (along === 'x') {
      for (const z of [ty + 0.06, ty + 0.94]) {
        b.color(post).box(tx + 0.5, 0.33, z, 1.0, 0.07, 0.07);
        b.color(post).box(tx + 0.1, 0.0, z, 0.1, 0.8, 0.1);
      }
    } else {
      for (const x of [tx + 0.06, tx + 0.94]) {
        b.color(post).box(x, 0.33, ty + 0.5, 0.07, 0.07, 1.0);
        b.color(post).box(x, 0.0, ty + 0.1, 0.1, 0.8, 0.1);
      }
    }
  } else {
    if (!isB(tx, ty + 1) && TILE[area.tileAt(tx, ty + 1)].water) b.color(post).cylinder(tx + 0.5, -0.6, ty + 0.92, 0.07, 0.07, 0.8, 6);
  }
}

function buildBoat(b, tx, ty) {
  const hull = C(0x9a6440);
  b.push();
  b.translate(tx + 0.5, -0.12, ty + 0.5);
  b.color(hull).prism([[-0.25, -0.45], [0.25, -0.45], [0.32, 0.1], [0, 0.5], [-0.32, 0.1]], -0.05, 0.25);
  b.color(C(0xd8b080)).box(0, 0.2, 0, 0.5, 0.04, 0.12);
  b.pop();
}

function buildPit(b, area, theme, tx, ty) {
  const depth = -3.2;
  const top = theme.wall ? theme.wall[0] : C(0x777777);
  b.color([0, 0, 0]).box(tx + 0.5, depth, ty + 0.5, 1, 0.05, 1, { faces: { bottom: false } });
  const walls = [[0, 1, [tx, ty + 1], [tx + 1, ty + 1]], [0, -1, [tx + 1, ty], [tx, ty]], [1, 0, [tx + 1, ty + 1], [tx + 1, ty]], [-1, 0, [tx, ty], [tx, ty + 1]]];
  for (const [dx, dz, a, c] of walls) {
    if (area.tileAt(tx + dx, ty + dz) === T.PIT.id) continue;
    const cA = scaleCol(top, area.theme === 'lighthouse' || area.theme === 'house' ? 0.22 : 0.45), cB = [0, 0, 0];
    b.quad([a[0], depth, a[1]], [c[0], depth, c[1]], [c[0], 0, c[1]], [a[0], 0, a[1]], cB, cB, cA, cA);
  }
}

function isWallLike(area, x, y) {
  const t = area.tileAt(x, y);
  return t === T.WALL.id || t === T.VOID.id || t === T.ROCKWALL.id || t === T.BOOKSHELF.id;
}

const wallish = (area, x, y) => {
  const t = area.tileAt(x, y);
  return t === T.WALL.id || t === T.VOID.id || t === T.ROCKWALL.id || t === T.BOOKSHELF.id;
};
// Walls along the south edge of a room are cut down so they don't hide the
// floor from the camera. A wall is "south" when there is floor above it in
// its column and none below it, within the same screen.
function lowCol(area, x, y) {
  if (!wallish(area, x, y)) return false;
  const top = Math.floor(y / SH) * SH, bottom = top + SH - 1;
  for (let yy = y + 1; yy <= bottom; yy++) if (!wallish(area, x, yy)) return false;
  for (let yy = y - 1; yy >= top; yy--) if (!wallish(area, x, yy)) return true;
  return false;
}
export function isLowWall(area, x, y) {
  if (area.kind === 'overworld') return false;
  if (lowCol(area, x, y)) return true;
  const top = Math.floor(y / SH) * SH, bottom = top + SH - 1;
  for (let yy = y + 1; yy <= bottom; yy++) if (!wallish(area, x, yy)) return false;
  return lowCol(area, x - 1, y) || lowCol(area, x + 1, y);
}
export function wallHeight(area, tx, ty) {
  return isLowWall(area, tx, ty) ? 0.5 : 2.1;
}

function buildWall(b, area, theme, tx, ty) {
  const H = wallHeight(area, tx, ty);
  const cols = theme.wall;
  const base = cols[Math.floor(hash2(tx, ty) * cols.length)];
  b.color(base).box(tx + 0.5, H / 2 - 0.05, ty + 0.5, 1, H + 0.1, 1, { topColor: theme.wallTop });
  const exposed = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => !isWallLike(area, tx + dx, ty + dy));
  if (H < 1) {
    // low wall: chunky capstone
    b.color(scaleCol(base, 1.1)).bevelBox(tx + 0.5, H + 0.06, ty + 0.5, 1.02, 0.14, 1.02, 0.04);
    return;
  }
  const isHouse = area.theme === 'house' || area.theme === 'lighthouse';
  for (const [dx, dy] of exposed) {
    // brick courses, or plaster with a wooden skirting in houses
    const fx = tx + 0.5 + dx * 0.5, fz = ty + 0.5 + dy * 0.5;
    const alongX = dy !== 0;
    if (isHouse) {
      const trim = theme.trim;
      b.color(trim).box(fx + dx * 0.02, 0.15, fz + dy * 0.02, alongX ? 1 : 0.06, 0.3, alongX ? 0.06 : 1);
      b.color(trim).box(fx + dx * 0.02, H - 0.1, fz + dy * 0.02, alongX ? 1 : 0.06, 0.12, alongX ? 0.06 : 1);
      if (area.theme === 'lighthouse') {
        b.color(C(0xc8463c)).box(fx + dx * 0.015, 1.1, fz + dy * 0.015, alongX ? 1 : 0.04, 0.35, alongX ? 0.04 : 1);
      }
      continue;
    }
    const rows = 4, rh = H / rows;
    for (let r = 0; r < rows; r++) {
      const off = r & 1 ? 0.25 : 0;
      for (let k = -1; k < 2; k++) {
        let s0 = k * 0.5 + off, s1 = s0 + 0.5;
        s0 = Math.max(s0, 0); s1 = Math.min(s1, 1);
        if (s1 - s0 < 0.05) continue;
        const mid = (s0 + s1) / 2 - 0.5, len = s1 - s0 - 0.04;
        const c = scaleCol(cols[Math.floor(hash3(tx * 4 + k, ty, r) * cols.length)], 0.92 + hash3(tx, ty * 3 + k, r) * 0.16);
        const y = r * rh + rh / 2;
        if (alongX) b.color(c).box(fx - 0.5 + mid + 0.5, y, fz + dy * 0.025, len, rh - 0.05, 0.05);
        else b.color(c).box(fx + dx * 0.025, y, fz - 0.5 + mid + 0.5, 0.05, rh - 0.05, len);
      }
    }
    if (theme.trim && area.theme === 'shrine') {
      b.push(); b.emis = 0.05;
      b.color(theme.trim).box(fx + dx * 0.04, H - 0.12, fz + dy * 0.04, alongX ? 1 : 0.06, 0.08, alongX ? 0.06 : 1);
      b.pop();
    }
  }
}

function buildStatue(b, area, theme, tx, ty) {
  const st = area.theme === 'shrine' ? C(0x8fb0aa) : C(0xb0aca2);
  const x = tx + 0.5, z = ty + 0.5;
  b.color(scaleCol(st, 0.8)).bevelBox(x, 0.2, z, 0.8, 0.4, 0.8, 0.05);
  // a stylised owl
  b.color(st).sphere(x, 0.75, z, 0.32, 8, 6, { sy: 1.15 });
  b.color(st).sphere(x, 1.18, z, 0.25, 8, 6);
  b.color(st).cone(x - 0.14, 1.32, z, 0.07, 0.16, 4);
  b.color(st).cone(x + 0.14, 1.32, z, 0.07, 0.16, 4);
  b.push(); b.emis = area.theme === 'shrine' ? 0.6 : 0;
  b.color(area.theme === 'shrine' ? C(0x6ff0e0) : C(0x55524c)).sphere(x - 0.09, 1.2, z + 0.21, 0.06, 5, 4);
  b.color(area.theme === 'shrine' ? C(0x6ff0e0) : C(0x55524c)).sphere(x + 0.09, 1.2, z + 0.21, 0.06, 5, 4);
  b.pop();
  b.color(C(0xd8b048)).cone(x, 1.08, z + 0.24, 0.05, 0.1, 4);
}

function buildFence(b, area, tx, ty) {
  const wood = C(0xc9a06e), dark = C(0xa57e50);
  const x = tx + 0.5, z = ty + 0.5;
  b.color(dark).box(x, 0.3, z, 0.12, 0.6, 0.12);
  b.color(wood).cone(x, 0.6, z, 0.09, 0.08, 4, { rot: Math.PI / 4 });
  const isF = (dx, dy) => area.tileAt(tx + dx, ty + dy) === T.FENCE.id;
  if (isF(1, 0)) for (const y of [0.22, 0.45]) b.color(wood).box(x + 0.5, y, z, 1, 0.07, 0.05);
  if (isF(0, 1)) for (const y of [0.22, 0.45]) b.color(wood).box(x, y, z + 0.5, 0.05, 0.07, 1);
}

function buildLedge(b, area, tx, ty) {
  b.push();
  b.displace = (x, y, z) => [x + (noise3(x * 2, y, z * 2) - 0.5) * 0.12, y, z + (noise3(x * 2 + 5, y, z * 2) - 0.5) * 0.1];
  const top = C(0x76ba4e), side = C(0x9a8670);
  b.box(tx + 0.5, 0.2, ty + 0.62, 1, 0.4, 0.5, { topColor: top, sideColor: side });
  b.pop();
}

// ---- multi-tile structures ----

function buildStructure(b, area, s, lights) {
  if (s.type === 'house') buildHouse(b, s, lights);
  else if (s.type === 'lighthouse') buildLighthouse(b, s, lights);
  else if (s.type === 'shrine') buildShrineEntrance(b, s, lights);
  else if (s.type === 'cave') buildCaveMouth(b, area, s);
  else if (s.type === 'shop') buildHouse(b, { ...s, shop: true }, lights);
}

function buildHouse(b, s, lights) {
  const { x, y, w, h } = s;
  const wall = C(s.wall ?? 0xf3e6c8), roof = C(s.roof ?? 0xd0564a), wood = C(0x8a5a36);
  const wallH = 1.5;
  const cx = x + w / 2, cz = y + h / 2;
  // stone base and walls
  b.color(C(0xa8a094)).box(cx, 0.12, cz, w - 0.1, 0.24, h - 0.1);
  b.color(wall).box(cx, wallH / 2 + 0.12, cz, w - 0.3, wallH, h - 0.3);
  // timber corners and beams
  for (const [px, pz] of [[x + 0.15, y + 0.15], [x + w - 0.15, y + 0.15], [x + 0.15, y + h - 0.15], [x + w - 0.15, y + h - 0.15]]) {
    b.color(wood).box(px, wallH / 2 + 0.12, pz, 0.16, wallH, 0.16);
  }
  b.color(wood).box(cx, wallH + 0.08, y + h - 0.15, w - 0.2, 0.12, 0.16);
  // door
  const dx = s.door ?? Math.floor(w / 2);
  const doorX = x + dx + 0.5;
  b.color(C(0x6a3e22)).box(doorX, 0.62, y + h - 0.13, 0.62, 1.0, 0.06);
  b.color(C(0xe0b040)).sphere(doorX + 0.18, 0.6, y + h - 0.09, 0.04, 4, 3);
  b.color(wood).box(doorX, 1.16, y + h - 0.12, 0.8, 0.1, 0.1);
  // windows with warm light
  const winXs = [];
  for (let i = 0; i < w; i++) if (i !== dx && i > 0 && i < w - 1 || (w <= 3 && i !== dx)) winXs.push(x + i + 0.5);
  for (const wx of winXs.slice(0, 2)) {
    b.color(wood).box(wx, 0.95, y + h - 0.12, 0.56, 0.56, 0.06);
    b.push(); b.emis = 0.5; b.color(C(0xffd890)).box(wx, 0.95, y + h - 0.1, 0.42, 0.42, 0.04); b.pop();
    b.color(wood).box(wx, 0.95, y + h - 0.08, 0.04, 0.42, 0.03);
    b.color(wood).box(wx, 0.95, y + h - 0.08, 0.42, 0.04, 0.03);
    // flower box
    b.color(C(0x9a6a40)).box(wx, 0.62, y + h - 0.02, 0.56, 0.12, 0.16);
    for (let k = 0; k < 3; k++) b.color(FLOWER_COLS[(k + Math.floor(wx)) % FLOWER_COLS.length]).sphere(wx - 0.16 + k * 0.16, 0.72, y + h - 0.02, 0.06, 5, 4);
  }
  // gabled roof running east-west
  const rx0 = x - 0.2, rx1 = x + w + 0.2, rz0 = y - 0.25, rz1 = y + h + 0.25;
  const ry0 = wallH + 0.12, ry1 = ry0 + Math.min(1.6, h * 0.55);
  const rzm = (rz0 + rz1) / 2;
  const roofD = scaleCol(roof, 0.8);
  // two slopes with shingle rows
  const rowsN = 4;
  for (let r = 0; r < rowsN; r++) {
    const t0 = r / rowsN, t1 = (r + 1) / rowsN;
    const c = r & 1 ? roof : scaleCol(roof, 0.9);
    // south slope
    const za = lerp(rz1, rzm, t0), zb = lerp(rz1, rzm, t1), ya = lerp(ry0, ry1, t0), yb = lerp(ry0, ry1, t1);
    b.color(c).quad([rx0, ya, za], [rx1, ya, za], [rx1, yb + 0.03, zb], [rx0, yb + 0.03, zb]);
    b.color(c).quad([rx0, ya - 0.08, za], [rx1, ya - 0.08, za], [rx1, ya, za], [rx0, ya, za]);
    // north slope
    const za2 = lerp(rz0, rzm, t0), zb2 = lerp(rz0, rzm, t1);
    b.color(roofD).quad([rx1, ya, za2], [rx0, ya, za2], [rx0, yb + 0.03, zb2], [rx1, yb + 0.03, zb2]);
  }
  // gable ends
  b.color(wall).tri([x + 0.15, ry0, y + 0.15], [x + 0.15, ry0, y + h - 0.15], [x + 0.15, ry1 - 0.1, rzm]);
  b.color(wall).tri([x + w - 0.15, ry0, y + h - 0.15], [x + w - 0.15, ry0, y + 0.15], [x + w - 0.15, ry1 - 0.1, rzm]);
  b.color(scaleCol(roof, 0.7)).box((rx0 + rx1) / 2, ry1 + 0.03, rzm, rx1 - rx0, 0.12, 0.16);
  // chimney
  b.color(C(0xb0a090)).box(x + w - 0.8, ry1 - 0.1, rzm - 0.5, 0.4, 1.0, 0.4, { topColor: 0x3a3030 });
  if (s.shop) {
    // striped awning and a sign
    for (let i = 0; i < 6; i++) {
      b.color(i & 1 ? C(0xffffff) : C(0x3e8ec0)).quad(
        [x + 0.3 + i * (w - 0.6) / 6, 1.62, y + h - 0.12], [x + 0.3 + (i + 1) * (w - 0.6) / 6, 1.62, y + h - 0.12],
        [x + 0.3 + (i + 1) * (w - 0.6) / 6, 1.32, y + h + 0.35], [x + 0.3 + i * (w - 0.6) / 6, 1.32, y + h + 0.35]);
    }
  }
  if (s.lamp !== false) {
    b.push(); b.emis = 1.4; b.color(C(0xffd27a)).box(doorX + 0.55, 1.22, y + h - 0.05, 0.14, 0.18, 0.14); b.pop();
    lights.push({ x: doorX + 0.55, y: 1.25, z: y + h + 0.2, r: 2.6, col: [1.2, 0.85, 0.4] });
  }
}

function buildLighthouse(b, s, lights) {
  const cx = s.x + s.w / 2, cz = s.y + s.h / 2;
  const red = C(0xd0463c), white = C(0xf4f0e8);
  b.color(C(0x8c8f96)).cylinder(cx, 0, cz, 1.45, 1.4, 0.4, 12);
  const H = 6.4, seg = 5;
  for (let i = 0; i < seg; i++) {
    const r0 = lerp(1.25, 0.85, i / seg), r1 = lerp(1.25, 0.85, (i + 1) / seg);
    b.color(i & 1 ? red : white).cylinder(cx, 0.4 + (H * i) / seg, cz, r0, r1, H / seg, 14, { smooth: true });
  }
  // door and windows
  b.color(C(0x5a3a22)).box(cx, 0.95, cz + 1.18, 0.6, 1.1, 0.14);
  b.push(); b.emis = 0.4; b.color(C(0xffd890)).box(cx, 3.0, cz + 1.02, 0.3, 0.45, 0.1); b.pop();
  // gallery and lantern room
  const top = 0.4 + H;
  b.color(C(0x3a3d44)).cylinder(cx, top, cz, 1.2, 1.2, 0.12, 14);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.color(C(0x3a3d44)).box(cx + Math.cos(a) * 1.12, top + 0.32, cz + Math.sin(a) * 1.12, 0.05, 0.5, 0.05);
  }
  b.color(C(0x3a3d44)).cylinder(cx, top + 0.55, cz, 1.14, 1.14, 0.05, 14, { caps: false });
  b.push();
  b.emis = s.lit ? 2.5 : 0.0;
  b.color(s.lit ? C(0xfff0b0) : C(0x8aa0b0)).cylinder(cx, top + 0.12, cz, 0.6, 0.6, 0.9, 10);
  b.pop();
  b.color(red).cone(cx, top + 1.02, cz, 0.85, 0.8, 10);
  b.color(C(0x3a3d44)).sphere(cx, top + 1.85, cz, 0.12, 6, 4);
}

function buildShrineEntrance(b, s, lights) {
  // a half-sunken temple front of teal stone with a gold sun disc
  const { x, y, w, h } = s;
  const st = C(0x7f9f99), dark = C(0x4f6f6a), gold = C(0xd9b44a);
  const cx = x + w / 2;
  b.color(dark).box(cx, 0.15, y + h / 2, w, 0.3, h);
  b.color(st).box(cx, 1.4, y + h / 2 - 0.2, w - 0.4, 2.5, h - 0.6, { topColor: 0x5f7f7a });
  // stepped roof
  b.color(scaleCol(st, 0.9)).box(cx, 2.8, y + h / 2 - 0.2, w - 0.1, 0.3, h - 0.3);
  b.color(scaleCol(st, 0.8)).box(cx, 3.1, y + h / 2 - 0.2, w - 0.9, 0.3, h - 0.9);
  // pillars
  for (const px of [x + 0.5, x + w - 0.5]) {
    b.color(st).cylinder(px, 0.3, y + h - 0.45, 0.28, 0.24, 2.4, 8);
    b.color(gold).cylinder(px, 2.6, y + h - 0.45, 0.32, 0.32, 0.12, 8);
  }
  // doorway (dark) and sun disc
  b.color(C(0x0a1214)).box(cx, 0.95, y + h - 0.48, 1.0, 1.3, 0.1);
  b.color(st).box(cx, 1.68, y + h - 0.47, 1.25, 0.18, 0.14);
  b.push(); b.emis = 0.35;
  b.color(gold).cylinder(cx, 2.25, y + h - 0.47, 0.42, 0.42, 0.08, 12, { rot: 0 });
  b.pop();
  b.color(C(0x6f9a52)).sphere(x + 0.4, 2.8, y + h - 0.5, 0.35, 6, 4, { jitter: 0.5, sy: 0.6 });
  b.color(C(0x6f9a52)).sphere(x + w - 0.6, 3.1, y + 0.6, 0.4, 6, 4, { jitter: 0.5, sy: 0.6 });
}

function buildCaveMouth(b, area, s) {
  // a dark archway set into a cliff face (the door tile is at s.x, s.y)
  const x = s.x + 0.5, z = s.y + 0.5;
  const rock = C(0x8a7660);
  b.color(C(0x07090b)).box(x, 0.55, z - 0.05, 0.86, 1.1, 0.9);
  b.push();
  b.displace = (px, py, pz) => [px + (noise3(px * 3, py * 3, pz * 3) - 0.5) * 0.12, py, pz + (noise3(px * 3 + 3, py * 3, pz * 3) - 0.5) * 0.08];
  b.color(rock).box(x - 0.5, 0.65, z + 0.42, 0.24, 1.3, 0.2);
  b.color(rock).box(x + 0.5, 0.65, z + 0.42, 0.24, 1.3, 0.2);
  b.color(rock).box(x, 1.3, z + 0.42, 1.24, 0.26, 0.22);
  b.pop();
}
