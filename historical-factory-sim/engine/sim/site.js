// The physical site: buildings, floors, rooms, spots and the walking graph.
//
// Coordinates are in feet: x runs east, z runs south, y is height. Buildings
// are axis-aligned boxes with their long axis along x; each floor has a
// central aisle along x, and everything on that floor joins the aisle.
//
// A scenario describes the site declaratively (see scenarios/*/site.js); this
// module turns that into nodes, edges and spots, and finds paths.

const AISLE_STEP = 12;

export class Site {
  constructor(spec) {
    this.spec = spec;
    this.nodes = new Map();
    this.adj = new Map();
    this.buildings = new Map();
    this.rooms = new Map();
    this.spots = new Map();
    this.pathCache = new Map();

    for (const n of spec.yard.nodes) this.addNode(n.id, { x: n.x, y: 0, z: n.z, kind: n.kind || 'yard', label: n.label });
    for (const [a, b, opts] of spec.yard.edges) this.connect(a, b, opts);
    for (const b of spec.buildings) this.addBuilding(b);
    for (const s of spec.spots || []) this.addSpot(s);
  }

  addNode(id, props) {
    if (this.nodes.has(id)) throw new Error(`duplicate node ${id}`);
    const node = { id, x: 0, y: 0, z: 0, kind: 'point', ...props };
    this.nodes.set(id, node);
    this.adj.set(id, []);
    return node;
  }

  node(id) {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`no node ${id}`);
    return n;
  }

  // kind: 'walk' (anyone), 'stairs' (people only), 'hoist' (goods only)
  connect(a, b, { kind = 'walk', cost } = {}) {
    const na = this.node(a);
    const nb = this.node(b);
    const len = Math.hypot(na.x - nb.x, na.z - nb.z) + Math.abs(na.y - nb.y) * (kind === 'stairs' ? 3 : 1);
    const c = cost ?? len;
    this.adj.get(a).push({ to: b, cost: c, kind });
    this.adj.get(b).push({ to: a, cost: c, kind });
  }

  addBuilding(b) {
    const floors = b.floors || 1;
    const fh = b.floorHeight || 14;
    const zc = b.z + b.d / 2;
    const building = { ...b, floors, floorHeight: fh, aisleZ: zc, aisle: [] };
    this.buildings.set(b.id, building);

    for (let f = 0; f < floors; f++) {
      const y = f * fh;
      const xs = new Set();
      for (let x = b.x + 4; x <= b.x + b.w - 4; x += AISLE_STEP) xs.add(Math.round(x));
      xs.add(Math.round(b.x + b.w - 4));
      for (const s of b.stairs || []) xs.add(s);
      for (const h of b.hoists || []) xs.add(h);
      for (const door of b.doors || []) if ((door.floor || 0) === f) xs.add(door.x);
      const sorted = [...xs].sort((p, q) => p - q);
      const ids = sorted.map((x) => {
        const id = aisleId(b.id, f, x);
        this.addNode(id, { x, y, z: zc, kind: 'aisle', building: b.id, floor: f });
        return id;
      });
      for (let i = 1; i < ids.length; i++) this.connect(ids[i - 1], ids[i]);
      building.aisle[f] = sorted;
    }

    for (const s of b.stairs || []) {
      for (let f = 1; f < floors; f++) this.connect(aisleId(b.id, f - 1, s), aisleId(b.id, f, s), { kind: 'stairs' });
    }
    for (const h of b.hoists || []) {
      for (let f = 1; f < floors; f++) this.connect(aisleId(b.id, f - 1, h), aisleId(b.id, f, h), { kind: 'hoist', cost: fh * 2 });
    }
    for (const door of b.doors || []) {
      const f = door.floor || 0;
      const z = door.side === 'N' ? b.z : b.z + b.d;
      const id = door.id || `${b.id}:door:${door.side}${door.x}`;
      this.addNode(id, { x: door.x, y: f * fh, z, kind: 'door', building: b.id, floor: f });
      this.connect(id, aisleId(b.id, f, door.x));
      this.connect(id, door.to);
    }
    for (const r of b.rooms || []) {
      const room = { ...r, building: b.id, z0: r.z0 ?? b.z, z1: r.z1 ?? b.z + b.d, y: r.floor * fh };
      this.rooms.set(r.id, room);
    }
  }

  // The aisle node on a building floor nearest to x.
  nearestAisle(buildingId, floor, x) {
    const b = this.buildings.get(buildingId);
    const xs = b.aisle[floor];
    let best = xs[0];
    for (const v of xs) if (Math.abs(v - x) < Math.abs(best - x)) best = v;
    return aisleId(buildingId, floor, best);
  }

  // A spot is somewhere a person stands or a thing sits: a lathe, a desk, a
  // bin. It is a node joined to the aisle (or to a given node).
  addSpot({ id, room, x, z, type, facing = 0, joinTo, label }) {
    const r = this.rooms.get(room);
    if (!r) throw new Error(`spot ${id}: no room ${room}`);
    const node = this.addNode(id, { x, y: r.y, z, kind: 'spot', building: r.building, floor: r.floor, room, type, facing, label });
    this.connect(id, joinTo || this.nearestAisle(r.building, r.floor, x));
    this.spots.set(id, node);
    return node;
  }

  // Lay out `count` spots in rows along a room, either side of the aisle.
  // Returns the new spot ids.
  fillRoom(roomId, { prefix, type, count, rows = 2, margin = 4, x0, x1, gap = 7, rowGap = 9, label }) {
    const r = this.rooms.get(roomId);
    const b = this.buildings.get(r.building);
    const lo = (x0 ?? r.x0) + margin;
    const hi = (x1 ?? r.x1) - margin;
    const zc = b.aisleZ;
    const offsets = [];
    for (let i = 0; i < rows; i++) {
      const k = Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      offsets.push(side * (gap + k * rowGap));
    }
    const perRow = Math.ceil(count / rows);
    const step = (hi - lo) / perRow;
    const ids = [];
    let n = 0;
    for (let row = 0; row < rows && n < count; row++) {
      const dz = offsets[row];
      for (let i = 0; i < perRow && n < count; i++, n++) {
        const id = `${prefix}${n + 1}`;
        const x = lo + step * (i + 0.5);
        this.addSpot({ id, room: roomId, x: Math.round(x * 10) / 10, z: zc + dz, type, facing: dz < 0 ? Math.PI : 0, label });
        ids.push(id);
      }
    }
    return ids;
  }

  roomAt(nodeId) {
    const n = this.node(nodeId);
    if (n.room) return this.rooms.get(n.room);
    if (n.building === undefined) return null;
    for (const r of this.rooms.values()) {
      if (r.building === n.building && r.floor === n.floor && n.x >= r.x0 && n.x <= r.x1) return r;
    }
    return null;
  }

  // Shortest path as a list of node ids. People may not ride the goods
  // hoist; goods may not be carried up stairs.
  path(from, to, mode = 'person') {
    if (from === to) return [from];
    const key = `${mode}|${from}|${to}`;
    const cached = this.pathCache.get(key);
    if (cached) return cached;
    const forbid = mode === 'person' ? 'hoist' : 'stairs';
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const heap = [[0, from]];
    const done = new Set();
    while (heap.length) {
      const [dcur, u] = heapPop(heap);
      if (done.has(u)) continue;
      done.add(u);
      if (u === to) break;
      for (const e of this.adj.get(u)) {
        if (e.kind === forbid) continue;
        const nd = dcur + e.cost;
        if (nd < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, nd);
          prev.set(e.to, u);
          heapPush(heap, [nd, e.to]);
        }
      }
    }
    if (!prev.has(to)) throw new Error(`no ${mode} path from ${from} to ${to}`);
    const out = [to];
    let cur = to;
    while (cur !== from) {
      cur = prev.get(cur);
      out.push(cur);
    }
    out.reverse();
    if (this.pathCache.size > 20000) this.pathCache.clear();
    this.pathCache.set(key, out);
    return out;
  }
}

export function aisleId(building, floor, x) {
  return `${building}:${floor}:${x}`;
}

function heapPush(h, item) {
  h.push(item);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p][0] <= item[0]) break;
    h[i] = h[p];
    i = p;
  }
  h[i] = item;
}

function heapPop(h) {
  const top = h[0];
  const last = h.pop();
  if (h.length) {
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      let mv = last;
      if (l < h.length && h[l][0] < mv[0]) { m = l; mv = h[l]; }
      if (r < h.length && h[r][0] < mv[0]) { m = r; mv = h[r]; }
      if (m === i) break;
      h[i] = h[m];
      i = m;
    }
    h[i] = last;
  }
  return top;
}
