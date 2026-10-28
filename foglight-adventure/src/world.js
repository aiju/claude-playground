// Areas: an ASCII map parsed into a tile grid plus a list of entity spawns.
// The overworld, every cave, house and dungeon is one Area, made of screens
// of SW x SH tiles.

import { T, TILE, BASE_LEGEND, SW, SH } from './tiles.js';

const INFER = 255;
const GROUND_KINDS = new Set([T.GRASS, T.FLOWERS, T.PATH, T.SAND, T.PLAZA, T.FOREST, T.FLOOR, T.CAVE, T.WOOD, T.ICE, T.CARPET].map((t) => t.id));
const WALKABLE_INFER = new Set([...GROUND_KINDS]);

export class Area {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name || def.id;
    this.theme = def.theme || 'overworld';
    this.kind = def.kind || 'overworld';
    // Maps are either one big grid (def.map) or authored screen by screen
    // (def.screens[key].map), each screen with its own legend.
    let rows = def.map;
    const screenLegends = {};
    const baseLegend = { ...BASE_LEGEND, ...(def.legend || {}) };
    if (!rows) {
      const keys = Object.keys(def.screens).filter((k) => def.screens[k].map);
      const maxX = Math.max(...keys.map((k) => +k.split(',')[0])) + 1;
      const maxY = Math.max(...keys.map((k) => +k.split(',')[1])) + 1;
      const grid = Array.from({ length: maxY * SH }, () => Array(maxX * SW).fill(' '));
      for (const k of keys) {
        const [sx, sy] = k.split(',').map(Number);
        const sm = def.screens[k].map;
        if (sm.length !== SH) console.warn(`${def.id} screen ${k}: ${sm.length} rows`);
        sm.forEach((row, y) => {
          if (row.length !== SW) console.warn(`${def.id} screen ${k} row ${y}: ${row.length} cols: "${row}"`);
          for (let x = 0; x < SW; x++) grid[sy * SH + y][sx * SW + x] = row[x] ?? ' ';
        });
        screenLegends[k] = { ...baseLegend, ...(def.screens[k].legend || {}) };
      }
      rows = grid.map((r) => r.join(''));
    }
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.sw = Math.ceil(this.w / SW);
    this.sh = Math.ceil(this.h / SH);
    const n = this.w * this.h;
    this.tiles = new Uint8Array(n);
    this.ground = new Uint8Array(n);
    this.cliff = new Float32Array(n);
    this.spawns = [];
    const legend = baseLegend;
    const legendAt = (x, y) => screenLegends[`${Math.floor(x / SW)},${Math.floor(y / SH)}`] || legend;
    const defGround = (def.defaultGround || T.GRASS).id;

    for (let y = 0; y < this.h; y++) {
      const row = rows[y];
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] ?? ' ';
        const e = legendAt(x, y)[ch];
        const i = y * this.w + x;
        if (e === undefined) {
          console.warn(`${this.id}: unknown map char '${ch}' at ${x},${y}`);
          this.tiles[i] = defGround;
          continue;
        }
        if (e.id !== undefined) { this.tiles[i] = e.id; continue; }
        this.tiles[i] = e.tile ? e.tile.id : INFER;
        if (e.ent) this.spawns.push({ ...e.ent, tx: x, ty: y, ch });
        if (e.ents) for (const en of e.ents) this.spawns.push({ ...en, tx: x, ty: y, ch });
      }
    }
    // Tiles under entities take the most common walkable ground around them.
    const mostCommon = (x, y, set, diag) => {
      const count = new Map();
      const nb = diag ? [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dy] of nb) {
        const t = this.rawTile(x + dx, y + dy);
        if (set.has(t)) count.set(t, (count.get(t) || 0) + (Math.abs(dx) + Math.abs(dy) === 1 ? 2 : 1));
      }
      let best = -1, bc = 0;
      for (const [t, c] of count) if (c > bc) { best = t; bc = c; }
      return best;
    };
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.tiles[i] !== INFER) continue;
        const t = mostCommon(x, y, WALKABLE_INFER, pass > 0);
        if (t >= 0 || pass === 2) this.tiles[i] = t >= 0 ? t : defGround;
      }
    }
    // Ground under objects (trees, fences...) for drawing.
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x;
      const t = this.tiles[i];
      if (GROUND_KINDS.has(t)) { this.ground[i] = t; continue; }
      const g = mostCommon(x, y, GROUND_KINDS, true);
      this.ground[i] = g >= 0 ? g : defGround;
    }
    // Cliff heights: terraces rise with the distance from the cliff edge.
    const cliffish = (t) => t === T.CLIFF.id || t === T.ROCKWALL.id;
    let frontier = [];
    const dist = new Int32Array(n).fill(-1);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x;
      if (!cliffish(this.tiles[i])) continue;
      let edge = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const t = this.rawTile(x + dx, y + dy);
        if (!cliffish(t) && t !== T.VOID.id && t !== -1) edge = true;
      }
      if (edge) { dist[i] = 1; frontier.push(i); }
    }
    while (frontier.length) {
      const next = [];
      for (const i of frontier) {
        const x = i % this.w, y = (i / this.w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          const j = ny * this.w + nx;
          if (dist[j] === -1 && cliffish(this.tiles[j])) { dist[j] = dist[i] + 1; next.push(j); }
        }
      }
      frontier = next;
    }
    const base = def.cliffBase ?? 1.5, step = def.cliffStep ?? 0.9, maxD = def.cliffMax ?? 3;
    for (let i = 0; i < n; i++) {
      if (!cliffish(this.tiles[i])) continue;
      const d = dist[i] === -1 ? maxD : Math.min(dist[i], maxD);
      this.cliff[i] = base + (d - 1) * step;
    }
    this.structures = def.structures || [];
    this.screens = def.screens || {};
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  rawTile(x, y) { return this.inBounds(x, y) ? this.tiles[y * this.w + x] : -1; }
  tileAt(x, y) { return this.inBounds(x, y) ? this.tiles[y * this.w + x] : T.VOID.id; }
  tileDef(x, y) { return TILE[this.tileAt(x, y)]; }
  groundAt(x, y) { return this.inBounds(x, y) ? this.ground[y * this.w + x] : T.GRASS.id; }
  cliffAt(x, y) { return this.inBounds(x, y) ? this.cliff[y * this.w + x] : 0; }
  screenOf(x, z) { return [Math.floor(x / SW), Math.floor(z / SH)]; }
  screenKey(sx, sy) { return `${sx},${sy}`; }
  screenInfo(sx, sy) { return this.screens[`${sx},${sy}`] || {}; }
}

export { SW, SH };
