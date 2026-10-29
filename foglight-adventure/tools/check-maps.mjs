// Sanity checks for the hand-drawn maps. Run with: node tools/check-maps.mjs
//  - every screen is 16 x 11 and uses known characters
//  - tiles you can walk on line up across screen edges (or you'd get stuck after scrolling)
//  - every warp lands on a walkable tile, inside an existing area
//  - dungeon doors come in pairs

import { AREA_DEFS } from '../src/data/index.js';
import { Area } from '../src/world.js';
import { TILE, SW, SH, T } from '../src/tiles.js';

let problems = 0;
const warn = console.warn;
console.warn = (...a) => { problems++; warn('  !', ...a); };
const bad = (...a) => { problems++; console.log('  ✗', ...a); };

const areas = {};
for (const [id, def] of Object.entries(AREA_DEFS)) {
  console.log(`${id}`);
  areas[id] = new Area(def);
}

const walkable = (a, x, y) => {
  const d = TILE[a.tileAt(x, y)];
  return !d.solid && d !== T.VOID;
};

for (const [id, a] of Object.entries(areas)) {
  const exists = (sx, sy) => !!a.def.screens?.[`${sx},${sy}`]?.map || (!!a.def.map);
  // Crossing a screen edge walks you a little way into the next screen; that
  // spot must be walkable. (Edges where one side is solid can't be crossed.)
  const depth = a.kind === 'overworld' ? 1 : 2;
  for (let sy = 0; sy < a.sh; sy++) for (let sx = 0; sx < a.sw; sx++) {
    if (!exists(sx, sy)) continue;
    if (sx + 1 < a.sw && exists(sx + 1, sy)) {
      const x = (sx + 1) * SW - 1;
      for (let y = sy * SH; y < (sy + 1) * SH; y++) {
        if (!walkable(a, x, y) || !walkable(a, x + 1, y)) continue;
        for (let d = 1; d <= depth; d++) {
          if (!walkable(a, x + d, y)) bad(`${id}: walking east from ${sx},${sy} at row ${y % SH} lands on ${TILE[a.tileAt(x + d, y)].name}`);
          if (!walkable(a, x + 1 - d, y)) bad(`${id}: walking west from ${sx + 1},${sy} at row ${y % SH} lands on ${TILE[a.tileAt(x + 1 - d, y)].name}`);
        }
      }
    }
    if (sy + 1 < a.sh && exists(sx, sy + 1)) {
      const y = (sy + 1) * SH - 1;
      for (let x = sx * SW; x < (sx + 1) * SW; x++) {
        if (!walkable(a, x, y) || !walkable(a, x, y + 1)) continue;
        for (let d = 1; d <= depth; d++) {
          if (!walkable(a, x, y + d)) bad(`${id}: walking south from ${sx},${sy} at col ${x % SW} lands on ${TILE[a.tileAt(x, y + d)].name}`);
          if (!walkable(a, x, y + 1 - d)) bad(`${id}: walking north from ${sx},${sy + 1} at col ${x % SW} lands on ${TILE[a.tileAt(x, y + 1 - d)].name}`);
        }
      }
    }
  }
  for (const s of a.spawns) {
    if (s.type === 'warp' || s.type === 'stairs') {
      const t = s.to;
      if (typeof t === 'function') continue;
      const b = areas[t.area];
      if (!b) { bad(`${id}: warp at ${s.tx},${s.ty} goes to unknown area ${t.area}`); continue; }
      if (!walkable(b, Math.floor(t.x), Math.floor(t.z))) bad(`${id}: warp at ${s.tx},${s.ty} lands on ${TILE[b.tileAt(Math.floor(t.x), Math.floor(t.z))].name} in ${t.area} at ${t.x},${t.z}`);
    }
    if (s.type === 'door') {
      const lx = s.tx % SW, ly = s.ty % SH;
      const out = ly === 0 ? [0, -1] : ly === SH - 1 ? [0, 1] : lx === 0 ? [-1, 0] : [1, 0];
      const partner = a.spawns.find((o) => o.type === 'door' && o.tx === s.tx + out[0] && o.ty === s.ty + out[1]);
      if (!partner) bad(`${id}: door at ${s.tx},${s.ty} (screen ${Math.floor(s.tx / SW)},${Math.floor(s.ty / SH)}) has no partner`);
    }
  }
}
console.log(problems ? `\n${problems} problem(s)` : '\nall maps look fine');
process.exit(problems ? 1 : 0);
