// Crowd pathfinding simulation core. No DOM in here, so it runs the same in
// the browser and under node (see test/soak.js).
//
// Units: one grid cell is 1.0 wide. Agents are discs of radius R.
//
// Three layers, from far-sighted to near-sighted:
//   1. Flow fields. One Dijkstra distance field per goal cell, shared by every
//      agent heading there. Edge costs include live congestion and counter-flow,
//      so routes shift away from jams and opposing streams sort themselves
//      onto different routes.
//   2. Single-lane signals. A corridor one cell wide cannot hold two-way
//      traffic, so each one gets a token, like a single-track railway.
//   3. ORCA (optimal reciprocal collision avoidance) for the last metre, with
//      walls as hard constraints and right-of-way decided by rank.
(function (root) {
  'use strict';

  const R = 0.3;            // body radius
  const RO = 0.29;          // avoidance radius: a hair under R, so a packed crowd is not "colliding"
  const SPEED = 3.2;        // cells per second
  const NEIGH_DIST = 3.0;
  const MAX_NEIGH = 10;
  const TAU = 0.6;          // agent-agent look-ahead, seconds
  const TAU_WALL = 0.12;    // wall look-ahead, seconds
  const EPS = 1e-5;
  const ARRIVE_R = 0.75;
  const LOOKAHEAD = 10;     // cells of path to try to shortcut
  const SEG_LOOK = 3;       // how far ahead a signal is noticed
  const K_CONG = 0.9;       // path cost per unit congestion
  const K_LEFT = 0.5;       // path cost for walking with a wall on your left
  const K_FLOW = 1.3;       // path cost per unit counter-flow
  const FIELD_PERIOD = 0.8; // seconds between refreshes of each field

  // E, SE, S, SW, W, NW, N, NE (y grows downwards)
  const DX = [1, 1, 0, -1, -1, -1, 0, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];
  const DLEN = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

  const MOVE = 0, IDLE = 1;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- ORCA LP
  // Straight port of the linear programs from RVO2 (van den Berg et al.).
  // A line is (point, direction); velocities to its left are allowed.
  const MAXL = 96;
  const Lpx = new Float64Array(MAXL), Lpy = new Float64Array(MAXL);
  const Ldx = new Float64Array(MAXL), Ldy = new Float64Array(MAXL);
  const Ppx = new Float64Array(MAXL), Ppy = new Float64Array(MAXL);
  const Pdx = new Float64Array(MAXL), Pdy = new Float64Array(MAXL);
  let rx = 0, ry = 0;

  function lp1(PX, PY, DXa, DYa, no, radius, ox, oy, dirOpt) {
    const px = PX[no], py = PY[no], dx = DXa[no], dy = DYa[no];
    const dot = px * dx + py * dy;
    const disc = dot * dot + radius * radius - (px * px + py * py);
    if (disc < 0) return false;
    const sq = Math.sqrt(disc);
    let tL = -dot - sq, tR = -dot + sq;
    for (let i = 0; i < no; i++) {
      const den = dx * DYa[i] - dy * DXa[i];
      const num = DXa[i] * (py - PY[i]) - DYa[i] * (px - PX[i]);
      if (Math.abs(den) <= EPS) {
        if (num < 0) return false;
        continue;
      }
      const t = num / den;
      if (den >= 0) { if (t < tR) tR = t; } else if (t > tL) tL = t;
      if (tL > tR) return false;
    }
    let t;
    if (dirOpt) t = (ox * dx + oy * dy > 0) ? tR : tL;
    else {
      t = dx * (ox - px) + dy * (oy - py);
      if (t < tL) t = tL; else if (t > tR) t = tR;
    }
    rx = px + t * dx; ry = py + t * dy;
    return true;
  }

  function lp2(PX, PY, DXa, DYa, n, radius, ox, oy, dirOpt) {
    if (dirOpt) { rx = ox * radius; ry = oy * radius; }
    else {
      const l2 = ox * ox + oy * oy;
      if (l2 > radius * radius) { const l = Math.sqrt(l2); rx = ox / l * radius; ry = oy / l * radius; }
      else { rx = ox; ry = oy; }
    }
    for (let i = 0; i < n; i++) {
      if (DXa[i] * (PY[i] - ry) - DYa[i] * (PX[i] - rx) > 0) {
        const tx = rx, ty = ry;
        if (!lp1(PX, PY, DXa, DYa, i, radius, ox, oy, dirOpt)) { rx = tx; ry = ty; return i; }
      }
    }
    return n;
  }

  function lp3(n, numObst, begin, radius) {
    let distance = 0;
    for (let i = begin; i < n; i++) {
      if (Ldx[i] * (Lpy[i] - ry) - Ldy[i] * (Lpx[i] - rx) > distance) {
        let m = 0;
        for (let j = 0; j < numObst; j++) {
          Ppx[m] = Lpx[j]; Ppy[m] = Lpy[j]; Pdx[m] = Ldx[j]; Pdy[m] = Ldy[j]; m++;
        }
        for (let j = numObst; j < i; j++) {
          const det = Ldx[i] * Ldy[j] - Ldy[i] * Ldx[j];
          let qx, qy;
          if (Math.abs(det) <= EPS) {
            if (Ldx[i] * Ldx[j] + Ldy[i] * Ldy[j] > 0) continue;
            qx = 0.5 * (Lpx[i] + Lpx[j]); qy = 0.5 * (Lpy[i] + Lpy[j]);
          } else {
            const t = (Ldx[j] * (Lpy[i] - Lpy[j]) - Ldy[j] * (Lpx[i] - Lpx[j])) / det;
            qx = Lpx[i] + t * Ldx[i]; qy = Lpy[i] + t * Ldy[i];
          }
          let ddx = Ldx[j] - Ldx[i], ddy = Ldy[j] - Ldy[i];
          const l = Math.hypot(ddx, ddy) || 1;
          Ppx[m] = qx; Ppy[m] = qy; Pdx[m] = ddx / l; Pdy[m] = ddy / l; m++;
        }
        const tx = rx, ty = ry;
        if (lp2(Ppx, Ppy, Pdx, Pdy, m, radius, -Ldy[i], Ldx[i], true) < m) { rx = tx; ry = ty; }
        distance = Ldx[i] * (Lpy[i] - ry) - Ldy[i] * (Lpx[i] - rx);
      }
    }
  }

  // ------------------------------------------------------------- binary heap
  class Heap {
    constructor(cap) { this.k = new Float32Array(cap); this.v = new Int32Array(cap); this.n = 0; }
    push(key, val) {
      if (this.n >= this.k.length) {
        const k2 = new Float32Array(this.n * 2); k2.set(this.k); this.k = k2;
        const v2 = new Int32Array(this.n * 2); v2.set(this.v); this.v = v2;
      }
      const k = this.k, v = this.v;
      let i = this.n++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= key) break;
        k[i] = k[p]; v[i] = v[p]; i = p;
      }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v;
      const top = v[0];
      this.topKey = k[0];
      const n = --this.n;
      if (n > 0) {
        const key = k[n], val = v[n];
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && k[c + 1] < k[c]) c++;
          if (k[c] >= key) break;
          k[i] = k[c]; v[i] = v[c]; i = c;
        }
        k[i] = key; v[i] = val;
      }
      return top;
    }
  }

  // ------------------------------------------------------------------ world
  class World {
    constructor(W, H, seed) {
      this.W = W; this.H = H; this.N = W * H;
      const N = this.N;
      this.wall = new Uint8Array(N);
      this.wallPen = new Float32Array(N);
      this.narrow = new Uint8Array(N);
      this.nbMask = new Uint8Array(N);
      this.segOf = new Int16Array(N).fill(-1);
      this.segs = [];
      this.cong = new Float32Array(N);
      this.flowX = new Float32Array(N);
      this.flowY = new Float32Array(N);
      this.accC = new Float32Array(N);
      this.accX = new Float32Array(N);
      this.accY = new Float32Array(N);
      this.head = new Int32Array(N);
      this.link = new Int32Array(1024);
      this.heap = new Heap(N * 4);
      this.agents = [];
      this.fields = new Map();
      this.fieldList = [];
      this.fieldCursor = 0;
      this.pool = [];
      this.markers = [];
      this.events = [];
      this.time = 0; this.tick = 0;
      this.opts = { reroute: true, signals: true };
      this.rng = mulberry32(seed || 1);
      this.pattern = null;
      this.patternId = '';
      this.targetCount = 0;
      this.staticDirty = true;
      this.wallVersion = 0;
      this.nextId = 1;
      this.arrivalTimes = [];
      this.stats = { agents: 0, perMin: 0, pace: 1, stuck: 0, waiting: 0 };
      this.neigh = new Array(MAX_NEIGH);
      this.neighD = new Float64Array(MAX_NEIGH);
      this.pathBuf = new Int32Array(LOOKAHEAD + 1);
    }

    get portrait() { return this.H > this.W; }

    // Long-axis/short-axis fractions -> cell coordinates, so the same layout
    // works whether the floor is landscape or portrait.
    place(u, v) {
      const W = this.W, H = this.H;
      const x = this.portrait ? v * W : u * W, y = this.portrait ? u * H : v * H;
      return [Math.max(0, Math.min(W - 1, Math.floor(x))), Math.max(0, Math.min(H - 1, Math.floor(y)))];
    }

    blocked(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H || this.wall[x + y * this.W] === 1; }
    solidAt(px, py) { return this.blocked(Math.floor(px), Math.floor(py)); }
    cellOf(a) {
      const W = this.W, H = this.H;
      let x = a.x | 0, y = a.y | 0;
      if (x < 0) x = 0; else if (x >= W) x = W - 1;
      if (y < 0) y = 0; else if (y >= H) y = H - 1;
      return x + y * W;
    }

    passable(c, k) {
      const W = this.W, x = c % W, y = (c / W) | 0;
      const nx = x + DX[k], ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= W || ny >= this.H) return -1;
      const n = nx + ny * W;
      if (this.wall[n]) return -1;
      if ((k & 1) && (this.wall[nx + y * W] || this.wall[x + ny * W])) return -1;
      return n;
    }

    // ---------------------------------------------------------- map edits
    setWall(x, y, v) {
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) return false;
      const c = x + y * this.W;
      v = v ? 1 : 0;
      if (this.wall[c] === v) return false;
      if (v) for (const m of this.markers) if (m.cell === c) return false;
      this.wall[c] = v;
      this.staticDirty = true;
      return true;
    }

    setWalls(arr) { this.wall.set(arr); this.staticDirty = true; this.rebuildStatic(); }

    rebuildStatic() {
      const W = this.W, H = this.H, N = this.N, wall = this.wall;
      this.staticDirty = false;
      this.wallVersion++;
      // Hugging a wall costs a little extra, so routes keep to the middle.
      for (let c = 0; c < N; c++) {
        let mask = 0;
        const x = c % W, y = (c / W) | 0;
        for (let k = 0; k < 8; k++) if (this.blocked(x + DX[k], y + DY[k])) mask |= 1 << k;
        this.nbMask[c] = mask;
        this.wallPen[c] = mask && !wall[c] ? 0.35 : 0;
      }
      // Single-lane segments: straight runs of cells walled on both flanks.
      const old = this.segs;
      this.segs = [];
      this.segOf.fill(-1);
      this.narrow.fill(0);
      const nH = (x, y) => !this.blocked(x, y) && this.blocked(x, y - 1) && this.blocked(x, y + 1) &&
        !(this.blocked(x - 1, y) && this.blocked(x + 1, y));
      const nV = (x, y) => !this.blocked(x, y) && this.blocked(x - 1, y) && this.blocked(x + 1, y) &&
        !(this.blocked(x, y - 1) && this.blocked(x, y + 1));
      const add = (axis, fixed, lo, hi) => {
        const s = { id: this.segs.length, axis, fixed, lo, hi, len: hi - lo + 1, dir: 0, since: this.time,
          draining: false, inside: [0, 0], want: [0, 0], queue: [0, 0] };
        for (const o of old) {
          if (o.axis === axis && o.fixed === fixed && o.lo === lo && o.hi === hi) {
            s.dir = o.dir; s.since = o.since; s.draining = o.draining;
          }
        }
        for (let i = lo; i <= hi; i++) {
          const c = axis === 0 ? i + fixed * W : fixed + i * W;
          this.segOf[c] = s.id; this.narrow[c] = 1;
        }
        this.segs.push(s);
      };
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!nH(x, y)) continue;
          let x1 = x; while (x1 + 1 < W && nH(x1 + 1, y)) x1++;
          add(0, y, x, x1); x = x1;
        }
      }
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
          if (!nV(x, y)) continue;
          let y1 = y; while (y1 + 1 < H && nV(x, y1 + 1)) y1++;
          add(1, x, y, y1); y = y1;
        }
      }
      for (const m of this.markers) this.snapMarker(m);
      for (const f of this.fieldList) f.dirty = true;
      for (const a of this.agents) if (wall[this.cellOf(a)]) this.eject(a);
    }

    // Nearest open cell to c (optionally avoiding single-lane cells).
    nearestFree(c, avoidNarrow) {
      const W = this.W, N = this.N;
      const ok = (i) => !this.wall[i] && !(avoidNarrow && this.narrow[i]);
      if (ok(c)) return c;
      const seen = new Uint8Array(N), q = [c];
      seen[c] = 1;
      for (let h = 0; h < q.length; h++) {
        const u = q[h], x = u % W, y = (u / W) | 0;
        for (let k = 0; k < 8; k += 2) {
          const nx = x + DX[k], ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= this.H) continue;
          const n = nx + ny * W;
          if (seen[n]) continue;
          seen[n] = 1;
          if (ok(n)) return n;
          q.push(n);
        }
      }
      return avoidNarrow ? this.nearestFree(c, false) : c;
    }

    eject(a) {
      const c = this.nearestFree(this.cellOf(a), false);
      a.x = (c % this.W) + 0.5; a.y = ((c / this.W) | 0) + 0.5;
      a.vx = a.vy = 0;
    }

    // ------------------------------------------------------------ markers
    addMarker(id, label, team, u, v) {
      const [x, y] = this.place(u, v);
      const m = { id, label, team, cell: x + y * this.W, x: x + 0.5, y: y + 0.5, zone: [] };
      this.markers.push(m);
      this.snapMarker(m);
      return m;
    }
    marker(id) { return this.markers.find((m) => m.id === id); }

    snapMarker(m) {
      const W = this.W;
      m.cell = this.nearestFree(m.cell, true);
      m.x = (m.cell % W) + 0.5; m.y = ((m.cell / W) | 0) + 0.5;
      // The zone is the patch of floor around the marker that counts as "there".
      const zone = [m.cell], seen = new Set(zone);
      const mx = m.cell % W, my = (m.cell / W) | 0;
      for (let h = 0; h < zone.length; h++) {
        for (let k = 0; k < 8; k += 2) {
          const n = this.passable(zone[h], k);
          if (n < 0 || seen.has(n) || this.narrow[n]) continue;
          const dx = (n % W) - mx, dy = ((n / W) | 0) - my;
          if (dx * dx + dy * dy > 4.2) continue;
          seen.add(n); zone.push(n);
        }
      }
      const changed = !m.zone || m.zone.length !== zone.length || m.zone.some((c, i) => c !== zone[i]);
      m.zone = zone;
      if (changed) {
        for (const a of this.agents) {
          if (a.target === m.id && a.state === MOVE && !zone.includes(a.goal)) this.sendTo(a, m);
        }
      }
    }

    moveMarker(id, x, y) {
      const m = this.marker(id);
      if (!m || x < 0 || y < 0 || x >= this.W || y >= this.H) return;
      const c = this.nearestFree(x + y * this.W, true);
      if (c === m.cell) return;
      m.cell = c;
      this.snapMarker(m);
      if (this.pattern.markerMoved) this.pattern.markerMoved(this, m);
    }

    sendTo(a, m) {
      a.target = m.id;
      this.setGoal(a, m.zone[(this.rng() * m.zone.length) | 0]);
    }

    // ------------------------------------------------------------- fields
    setGoal(a, cell) {
      const f = this.getField(cell);
      f.refs++;
      if (a.field) this.release(a.field);
      a.field = f; a.goal = cell;
      a.gx = (cell % this.W) + 0.5; a.gy = ((cell / this.W) | 0) + 0.5;
      a.state = MOVE; a.lost = 0;
    }

    getField(cell) {
      let f = this.fields.get(cell);
      if (!f) {
        f = this.pool.pop() || { dist: new Float32Array(this.N), next: new Int8Array(this.N) };
        f.goal = cell; f.refs = 0; f.dirty = false;
        this.fields.set(cell, f);
        this.fieldList.push(f);
        this.computeField(f);
      }
      return f;
    }

    release(f) {
      if (--f.refs > 0) return;
      this.fields.delete(f.goal);
      const i = this.fieldList.indexOf(f);
      const last = this.fieldList.pop();
      if (i < this.fieldList.length) this.fieldList[i] = last;
      this.pool.push(f);
    }

    // Dijkstra outwards from the goal. dist[c] is the cost to walk from c to
    // the goal and next[c] the direction of the first step.
    computeField(f) {
      const W = this.W, H = this.H, wall = this.wall, wallPen = this.wallPen;
      const cong = this.cong, fx = this.flowX, fy = this.flowY, nbMask = this.nbMask;
      const dist = f.dist, next = f.next, heap = this.heap;
      const live = this.opts.reroute;
      dist.fill(Infinity); next.fill(-1);
      f.dirty = false;
      if (wall[f.goal]) return;
      heap.n = 0;
      dist[f.goal] = 0;
      heap.push(0, f.goal);
      while (heap.n > 0) {
        const u = heap.pop(), d = heap.topKey;
        if (d > dist[u]) continue;
        const x = u % W, y = (u / W) | 0;
        // Stepping INTO u from a neighbour v: the walker moves against (DX,DY).
        const base = 1 + wallPen[u];
        const cg = live ? K_CONG * cong[u] : 0;
        for (let k = 0; k < 8; k++) {
          const nx = x + DX[k], ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const v = nx + ny * W;
          if (wall[v]) continue;
          if ((k & 1) && (wall[nx + y * W] || wall[x + ny * W])) continue;
          let cost = DLEN[k] * base + cg;
          // Keep right: the walker heads in direction k+4, so its left is k+2.
          if ((nbMask[u] >> ((k + 2) & 7)) & 1) cost += K_LEFT;
          if (live) {
            const against = (fx[u] * DX[k] + fy[u] * DY[k]) / DLEN[k];
            if (against > 0) cost += K_FLOW * against;
          }
          const nd = d + cost;
          if (nd < dist[v]) { dist[v] = nd; next[v] = (k + 4) & 7; heap.push(nd, v); }
        }
      }
    }

    refreshFields(dt) {
      const list = this.fieldList;
      if (!list.length) return;
      let dirtyBudget = 40;
      for (let i = 0; i < list.length && dirtyBudget > 0; i++) {
        if (list[i].dirty) { this.computeField(list[i]); dirtyBudget--; }
      }
      if (!this.opts.reroute) return;
      // Each field is refreshed about every FIELD_PERIOD, but never more
      // than ~150 a second in total: with hundreds of goals they take turns.
      this.fieldDebt = (this.fieldDebt || 0) + Math.min(150, list.length / FIELD_PERIOD) * dt;
      while (this.fieldDebt >= 1) {
        this.fieldDebt -= 1;
        this.fieldCursor = (this.fieldCursor + 1) % list.length;
        this.computeField(list[this.fieldCursor]);
      }
    }

    // Is the straight walk from (x0,y0) to (x1,y1) clear for a body?
    los(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (len < 1e-6) return true;
      const n = Math.ceil(len / 0.3), ox = -dy / len * 0.27, oy = dx / len * 0.27;
      for (let i = 1; i <= n; i++) {
        const t = i / n, px = x0 + dx * t, py = y0 + dy * t;
        // The check starts thin: someone brushing a wall can still see ahead.
        const wd = Math.min(1, t * len / 0.9);
        if (this.solidAt(px + ox * wd, py + oy * wd) || this.solidAt(px - ox * wd, py - oy * wd)) return false;
      }
      return true;
    }

    // Cells along an agent's route, for drawing. Returns [x0,y0,x1,y1,...].
    routeOf(a, max) {
      const out = [a.x, a.y], f = a.field;
      if (!f) return out;
      let c = this.cellOf(a);
      for (let i = 0; i < (max || 400); i++) {
        const k = f.next[c];
        if (k < 0) break;
        c += DX[k] + DY[k] * this.W;
        out.push((c % this.W) + 0.5, ((c / this.W) | 0) + 0.5);
      }
      return out;
    }

    // ------------------------------------------------------------- agents
    spawn(x, y, team) {
      const a = {
        id: this.nextId++, x, y, vx: 0, vy: 0, pvx: 0, pvy: 0, dx: 1, dy: 0,
        hx: 1, hy: 0, team: team | 0, hue: 0, speed: SPEED * (0.9 + 0.2 * this.rng()),
        state: IDLE, field: null, goal: -1, gx: x, gy: y, target: null,
        rank: 1, pri: this.rng() * 0.4, waiting: false, yieldT: 0, conflict: false, flushed: false, stuck: 0, lost: 0, born: this.time,
        tripStart: this.time, seg: -1, data: null,
      };
      this.agents.push(a);
      return a;
    }

    remove(a) {
      const i = this.agents.indexOf(a);
      if (i < 0) return;
      if (a.field) this.release(a.field);
      a.field = null; a.dead = true;
      const last = this.agents.pop();
      if (i < this.agents.length) this.agents[i] = last;
    }

    // Is there room for a new body at (x,y)? Uses last tick's hash.
    roomAt(x, y, gap) {
      const W = this.W, H = this.H, cx = x | 0, cy = y | 0, g2 = (gap || 0.64) ** 2;
      for (let yy = Math.max(0, cy - 1); yy <= Math.min(H - 1, cy + 1); yy++) {
        for (let xx = Math.max(0, cx - 1); xx <= Math.min(W - 1, cx + 1); xx++) {
          for (let i = this.head[xx + yy * W]; i >= 0; i = this.link[i]) {
            const b = this.agents[i];
            if (b && (b.x - x) ** 2 + (b.y - y) ** 2 < g2) return false;
          }
        }
      }
      return true;
    }

    // Open cells ordered by walking distance from c: where a crowd musters.
    musterCells(c, count) {
      const out = [c], seen = new Set(out);
      for (let h = 0; h < out.length && out.length < count * 2; h++) {
        for (let k = 0; k < 8; k += 2) {
          const n = this.passable(out[h], k);
          if (n >= 0 && !seen.has(n)) { seen.add(n); out.push(n); }
        }
      }
      return out.filter((i) => !this.narrow[i]).slice(0, count);
    }

    randomFreeCell() {
      for (let i = 0; i < 400; i++) {
        const c = (this.rng() * this.N) | 0;
        if (!this.wall[c] && !this.narrow[c]) return c;
      }
      return this.nearestFree((this.N / 2) | 0, false);
    }

    buildHash() {
      const agents = this.agents, head = this.head;
      if (this.link.length < agents.length) this.link = new Int32Array(agents.length * 2);
      head.fill(-1);
      for (let i = 0; i < agents.length; i++) {
        const c = this.cellOf(agents[i]);
        agents[i].cell = c;
        this.link[i] = head[c]; head[c] = i;
      }
    }

    // ------------------------------------------------------------ pattern
    setPattern(id, count) {
      while (this.agents.length) this.remove(this.agents[this.agents.length - 1]);
      this.markers = [];
      this.events = [];
      this.arrivalTimes = [];
      this.patternId = id;
      this.pattern = PATTERNS[id];
      this.targetCount = count;
      this.cong.fill(0); this.flowX.fill(0); this.flowY.fill(0);
      if (this.staticDirty) this.rebuildStatic();
      this.head.fill(-1);
      this.pattern.init(this, count);
      this.buildHash();
    }

    setCount(n) {
      this.targetCount = n;
      if (this.pattern.fixed) this.setPattern(this.patternId, n);
    }

    arrived(a) {
      this.arrivalTimes.push(this.time);
      this.pattern.arrive(this, a);
    }

    // --------------------------------------------------------------- step
    step(dt) {
      if (this.staticDirty) this.rebuildStatic();
      this.time += dt; this.tick++;
      const agents = this.agents;

      // population follows the slider
      if (!this.pattern.fixed) {
        while (agents.length > this.targetCount) this.remove(agents[agents.length - 1]);
        for (let i = 0; i < 3 && agents.length < this.targetCount; i++) {
          if (!this.pattern.spawnOne(this)) break;
        }
      }
      if (this.pattern.tick) this.pattern.tick(this, dt);

      this.buildHash();
      if (this.tick % 6 === 0) this.updateTraffic();
      this.refreshFields(dt);

      for (const s of this.segs) {
        s.queue[0] = s.want[0]; s.queue[1] = s.want[1];
        s.inside[0] = s.inside[1] = 0; s.want[0] = s.want[1] = 0;
      }
      for (let i = 0; i < agents.length; i++) this.plan(agents[i]);
      this.updateSignals(dt);
      for (let i = 0; i < agents.length; i++) this.avoid(agents[i], dt);

      const blend = 1 - Math.exp(-dt * 16);
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        a.vx += (a.nvx - a.vx) * blend; a.vy += (a.nvy - a.vy) * blend;
        a.x += a.vx * dt; a.y += a.vy * dt;
      }
      this.collide();

      let stuck = 0, waiting = 0, pace = 0, movers = 0;
      for (let i = agents.length - 1; i >= 0; i--) {
        const a = agents[i];
        const sp = Math.hypot(a.vx, a.vy);
        if (sp > 0.4) {
          const t = Math.min(1, dt * 10);
          a.hx += (a.vx / sp - a.hx) * t; a.hy += (a.vy / sp - a.hy) * t;
        }
        if (a.state !== MOVE) continue;
        movers++;
        pace += Math.min(1, sp / a.speed);
        if (a.waiting) { waiting++; a.stuck = Math.max(0, a.stuck - dt); }
        else if (sp < 0.22 * a.speed) a.stuck += dt;
        else a.stuck = Math.max(0, a.stuck - 3 * dt);
        if (a.stuck > 6) stuck++;
        // Random back-off, as on an Ethernet: in a stand-off, someone gives way.
        if (a.yieldT > 0) a.yieldT -= dt;
        else if (a.conflict && a.stuck > 2 + a.pri * 12 && a.seg < 0) {
          a.yieldT = 1 + this.rng() * 1.6; a.stuck = 0.8; a.pri = this.rng() * 0.4;
        }
        if (a.lost > 0) {
          if (this.pattern.lost && a.lost > 1) this.pattern.lost(this, a);
          continue;
        }
        const done = this.pattern.check ? this.pattern.check(this, a)
          : (a.x - a.gx) ** 2 + (a.y - a.gy) ** 2 < ARRIVE_R * ARRIVE_R;
        if (done) this.arrived(a);
      }

      const at = this.arrivalTimes;
      while (at.length && at[0] < this.time - 15) at.shift();
      const st = this.stats;
      st.agents = agents.length;
      st.perMin = at.length * 4;
      st.pace = movers ? pace / movers : 1;
      st.stuck = stuck; st.waiting = waiting;
    }

    // Smoothed per-cell crowding and prevailing direction, sampled at 10 Hz.
    updateTraffic() {
      const { accC, accX, accY, cong, flowX, flowY, agents, N } = this;
      accC.fill(0); accX.fill(0); accY.fill(0);
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i], c = a.cell;
        const sp = Math.hypot(a.vx, a.vy);
        // A jam that will not clear weighs more and more, until those at its
        // edges find it cheaper to go round.
        accC[c] += a.state === IDLE ? 1 : (1 - Math.min(1, sp / a.speed)) * (1 + Math.min(4, a.stuck * 0.5));
        accX[c] += a.vx / SPEED; accY[c] += a.vy / SPEED;
      }
      for (let c = 0; c < N; c++) {
        cong[c] += (accC[c] - cong[c]) * 0.12;
        flowX[c] += (accX[c] - flowX[c]) * 0.12;
        flowY[c] += (accY[c] - flowY[c]) * 0.12;
      }
    }

    // Decide what each agent wants this tick: a preferred velocity and a rank.
    plan(a) {
      const W = this.W;
      a.waiting = false; a.flushed = false; a.seg = -1;
      a.pvx = a.pvy = 0;
      if (a.state === IDLE) { a.rank = 0.5; return; }
      a.rank = 1 + a.pri + Math.min(0.5, a.stuck / 12);
      const f = a.field, c = a.cell;
      if (!f || !(f.dist[c] < Infinity)) { a.lost += 1 / 60; a.rank = 0; return; }
      a.lost = 0;

      if (this.opts.signals) {
        const sid = this.segOf[c];
        if (sid >= 0) {
          // Inside a single-lane corridor.
          const s = this.segs[sid], k = f.next[c];
          const d = k < 0 ? 0 : (s.axis === 0 ? DX[k] : DY[k]);
          if (d !== 0) s.inside[d > 0 ? 1 : 0]++;
          a.seg = sid;
          a.rank = 2.5;
          if (s.dir !== 0 && d !== 0 && d !== s.dir) {
            // Facing the wrong way under someone else's green: back out.
            a.flushed = true;
            const v = a.speed * 0.9;
            a.pvx = s.axis === 0 ? s.dir * v : (s.fixed + 0.5 - a.x) * 2;
            a.pvy = s.axis === 1 ? s.dir * v : (s.fixed + 0.5 - a.y) * 2;
            a.dx = s.axis === 0 ? -s.dir : 0; a.dy = s.axis === 1 ? -s.dir : 0;
            return;
          }
        } else {
          // Coming up to one? Ask for the token, and hold back without it.
          // The longer the queue, the further back the waiting starts.
          let cc = c;
          for (let i = 1; i <= SEG_LOOK + 6; i++) {
            const k = f.next[cc];
            if (k < 0) break;
            const n = cc + DX[k] + DY[k] * W;
            const ns = this.segOf[n];
            if (ns >= 0) {
              const s = this.segs[ns];
              const d = s.axis === 0 ? DX[k] : DY[k];
              if (d === 0) break;
              const side = d > 0 ? 1 : 0;
              if (i > SEG_LOOK + 0.8 * Math.sqrt(s.queue[side])) break;
              s.want[side]++;
              // Next in line goes first, so the mouth does not clog.
              if (i <= 4) a.rank = 3.1 - 0.5 * i + a.pri * 0.5;
              if (s.dir !== d || s.draining) {
                a.waiting = true;
                a.rank = 0;
                const ex = (n % W) + 0.5 - a.x, ey = ((n / W) | 0) + 0.5 - a.y;
                const el = Math.hypot(ex, ey) || 1;
                a.dx = ex / el; a.dy = ey / el;
                // Stand clear of the doors: leave a channel in front of the
                // mouth for whoever is coming out.
                const out = -(s.axis === 0 ? ex : ey) * -d, lat = s.axis === 0 ? -ey : -ex;
                if (out > -0.2 && out < 5.5 && Math.abs(lat) < 1.15) {
                  const sgn = Math.abs(lat) > 0.12 ? Math.sign(lat) : (s.axis === 0 ? d : -d);
                  const v = a.speed * 0.6;
                  if (s.axis === 0) a.pvy = sgn * v; else a.pvx = sgn * v;
                  if (el < 1.4) { a.pvx -= a.dx * v; a.pvy -= a.dy * v; }
                }
                return;
              }
              break;
            }
            cc = n;
          }
        }
      }

      // Steer for the farthest cell of the route that can be walked to directly.
      const path = this.pathBuf;
      let m = 0, cc = c;
      while (m < LOOKAHEAD) {
        const k = f.next[cc];
        if (k < 0) break;
        cc += DX[k] + DY[k] * W;
        path[m++] = cc;
      }
      let tx = a.gx, ty = a.gy, final = true;
      if (m > 0) {
        let i = m - 1;
        for (; i > 0; i--) {
          const px = (path[i] % W) + 0.5, py = ((path[i] / W) | 0) + 0.5;
          if (this.los(a.x, a.y, px, py)) break;
        }
        if (path[i] !== a.goal) { tx = (path[i] % W) + 0.5; ty = ((path[i] / W) | 0) + 0.5; final = false; }
      }
      let ddx = tx - a.x, ddy = ty - a.y;
      const dl = Math.hypot(ddx, ddy);
      if (dl > 1e-4) { ddx /= dl; ddy /= dl; a.dx = ddx; a.dy = ddy; }
      else { ddx = 0; ddy = 0; }
      const v = final ? Math.min(a.speed, dl * 8) : a.speed;
      a.pvx = ddx * v; a.pvy = ddy * v;
      if (a.yieldT > 0 && a.seg < 0) {
        // "After you": step back and let the other side through.
        a.rank = 0.2;
        a.pvx = -ddx * a.speed * 0.45; a.pvy = -ddy * a.speed * 0.45;
      }
    }

    // One token per single-lane corridor, handed over when the green has run
    // long enough and someone is waiting at the other end.
    updateSignals(dt) {
      if (!this.opts.signals) return;
      for (const s of this.segs) {
        const demand = [s.want[0] + s.inside[0], s.want[1] + s.inside[1]];
        if (s.dir === 0) {
          if (demand[0] + demand[1] > 0) {
            s.dir = demand[1] >= demand[0] ? 1 : -1; s.since = this.time; s.draining = false;
          }
          continue;
        }
        const mine = s.dir > 0 ? 1 : 0, other = 1 - mine;
        const flip = () => { s.dir = -s.dir; s.since = this.time; s.draining = false; };
        if (s.inside[mine] === 0 && (s.draining || demand[mine] === 0)) {
          if (demand[other] > 0) flip();
          else if (demand[mine] === 0) { s.dir = 0; s.draining = false; }
          else s.draining = false;
        } else if (!s.draining && s.want[other] > 0 && this.time - s.since > 2.5 + 0.35 * s.len) {
          s.draining = true;
        }
      }
    }

    // ORCA: pick the velocity closest to the preferred one that keeps clear
    // of walls and of everyone nearby for the next TAU seconds.
    avoid(a, dt) {
      const W = this.W, H = this.H, wall = this.wall, agents = this.agents;
      let n = 0;

      // Walls: one half-plane per exposed face or true corner nearby.
      const reach = R + SPEED * TAU_WALL;
      const cx = a.x | 0, cy = a.y | 0;
      for (let yy = cy - 1; yy <= cy + 1; yy++) {
        for (let xx = cx - 1; xx <= cx + 1; xx++) {
          if (xx === cx && yy === cy) continue;
          if (!this.blocked(xx, yy)) continue;
          const sx = a.x < xx ? -1 : (a.x > xx + 1 ? 1 : 0);
          const sy = a.y < yy ? -1 : (a.y > yy + 1 ? 1 : 0);
          if (sx === 0 && sy === 0) continue;
          if (sx !== 0 && sy !== 0 && (this.blocked(xx + sx, yy) || this.blocked(xx, yy + sy))) continue;
          const qx = sx < 0 ? xx : (sx > 0 ? xx + 1 : a.x);
          const qy = sy < 0 ? yy : (sy > 0 ? yy + 1 : a.y);
          let nx = a.x - qx, ny = a.y - qy;
          const d = Math.hypot(nx, ny);
          if (d > reach || d < 1e-6) continue;
          nx /= d; ny /= d;
          const lim = -(d - R) / TAU_WALL;
          Lpx[n] = nx * lim; Lpy[n] = ny * lim; Ldx[n] = ny; Ldy[n] = -nx; n++;
        }
      }
      const numObst = n;

      // Nearest neighbours.
      let cnt = 0;
      const neigh = this.neigh, nd = this.neighD;
      const r = Math.ceil(NEIGH_DIST);
      const x0 = Math.max(0, cx - r), x1 = Math.min(W - 1, cx + r);
      const y0 = Math.max(0, cy - r), y1 = Math.min(H - 1, cy + r);
      let oncoming = false, conflict = false;
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const cell = xx + yy * W;
          if (wall[cell]) continue;
          for (let i = this.head[cell]; i >= 0; i = this.link[i]) {
            const b = agents[i];
            if (b === a) continue;
            const ex = b.x - a.x, ey = b.y - a.y, d2 = ex * ex + ey * ey;
            if (d2 > NEIGH_DIST * NEIGH_DIST) continue;
            if (d2 < 6.5 && b.rank > 0.6) {
              const ahead = ex * a.dx + ey * a.dy, side = Math.abs(ex * a.dy - ey * a.dx);
              const same = b.dx * a.dx + b.dy * a.dy;
              if (ahead > 0.2 && side < 0.9 && same < -0.3) oncoming = true;
              if (ahead > 0.2 && side < 0.75 && d2 < 1.7 && same < 0.3) conflict = true;
            }
            let j;
            if (cnt < MAX_NEIGH) j = cnt++;
            else if (d2 < nd[MAX_NEIGH - 1]) j = MAX_NEIGH - 1;
            else continue;
            while (j > 0 && nd[j - 1] > d2) { nd[j] = nd[j - 1]; neigh[j] = neigh[j - 1]; j--; }
            nd[j] = d2; neigh[j] = b;
          }
        }
      }

      const invT = 1 / TAU, comb = RO * 2, comb2 = comb * comb;
      for (let i = 0; i < cnt; i++) {
        const b = neigh[i];
        const px = b.x - a.x, py = b.y - a.y;
        const vx = a.vx - b.vx, vy = a.vy - b.vy;
        const d2 = px * px + py * py;
        let ux, uy, dxl, dyl;
        if (d2 > comb2) {
          const wx = vx - invT * px, wy = vy - invT * py;
          const w2 = wx * wx + wy * wy;
          const dot1 = wx * px + wy * py;
          if (dot1 < 0 && dot1 * dot1 > comb2 * w2) {
            const wl = Math.sqrt(w2) || 1e-9, nx = wx / wl, ny = wy / wl;
            dxl = ny; dyl = -nx;
            ux = (comb * invT - wl) * nx; uy = (comb * invT - wl) * ny;
          } else {
            const leg = Math.sqrt(d2 - comb2);
            if (px * wy - py * wx > 0) {
              dxl = (px * leg - py * comb) / d2; dyl = (px * comb + py * leg) / d2;
            } else {
              dxl = -(px * leg + py * comb) / d2; dyl = -(-px * comb + py * leg) / d2;
            }
            const dot2 = vx * dxl + vy * dyl;
            ux = dot2 * dxl - vx; uy = dot2 * dyl - vy;
          }
        } else {
          // Already inside each other's personal space: ease apart.
          const invDt = 1 / Math.max(dt, 0.15);
          const wx = vx - invDt * px, wy = vy - invDt * py;
          const wl = Math.hypot(wx, wy) || 1e-9, nx = wx / wl, ny = wy / wl;
          dxl = ny; dyl = -nx;
          ux = (comb * invDt - wl) * nx; uy = (comb * invDt - wl) * ny;
        }
        // Right of way: the lower-ranked of the pair does more of the dodging.
        // Among walkers going the same way, whoever is behind does it.
        let share = 0.5 - 0.3 * (a.rank - b.rank);
        if (a.rank > 0 && b.rank > 0) {
          if (a.field === b.field && a.field) {
            let q = a.field.dist[a.cell] - a.field.dist[b.cell];
            if (q > 1.5) q = 1.5; else if (q < -1.5) q = -1.5;
            share += 0.2 * q;
          }
          const sim = a.dx * b.dx + a.dy * b.dy;
          if (sim > 0) share += 0.15 * sim * (px * (a.dx + b.dx) + py * (a.dy + b.dy)) / (Math.sqrt(d2) || 1);
        }
        if (share < 0.08) share = 0.08; else if (share > 0.92) share = 0.92;
        Lpx[n] = a.vx + share * ux; Lpy[n] = a.vy + share * uy; Ldx[n] = dxl; Ldy[n] = dyl; n++;
      }

      // Preferred velocity, nudged to the right of oncoming traffic so that
      // two-way streams settle into lanes instead of meeting nose to nose.
      let pvx = a.pvx, pvy = a.pvy;
      if (oncoming && !a.flushed) {
        const rxn = -a.dy, ryn = a.dx;
        if (a.waiting) { pvx += rxn * a.speed * 0.45; pvy += ryn * a.speed * 0.45; }
        else {
          const sp = Math.hypot(pvx, pvy);
          let qx = a.dx + 0.32 * rxn, qy = a.dy + 0.32 * ryn;
          const ql = Math.hypot(qx, qy) || 1;
          pvx = qx / ql * sp; pvy = qy / ql * sp;
        }
      }
      a.conflict = conflict || oncoming;
      if (a.stuck > 3 && oncoming && !a.waiting && !a.flushed && a.yieldT <= 0) {
        // Fidget out of a symmetric stand-off.
        const ang = a.id * 2.4 + this.time * 1.9;
        pvx += Math.cos(ang) * a.speed * 0.6; pvy += Math.sin(ang) * a.speed * 0.6;
      }

      const fail = lp2(Lpx, Lpy, Ldx, Ldy, n, a.speed, pvx, pvy, false);
      if (fail < n) lp3(n, numObst, fail, a.speed);
      a.nvx = rx; a.nvy = ry;
    }

    // Last line of defence: bodies never overlap each other or the walls.
    collide() {
      const W = this.W, H = this.H, agents = this.agents;
      const min = R * 2, min2 = min * min;
      for (let iter = 0; iter < 6; iter++) {
        for (let i = 0; i < agents.length; i++) {
          const a = agents[i], cx = a.cell % W, cy = (a.cell / W) | 0;
          for (let yy = Math.max(0, cy - 1); yy <= Math.min(H - 1, cy + 1); yy++) {
            for (let xx = Math.max(0, cx - 1); xx <= Math.min(W - 1, cx + 1); xx++) {
              for (let j = this.head[xx + yy * W]; j >= 0; j = this.link[j]) {
                if (j <= i) continue;
                const b = agents[j];
                let ex = b.x - a.x, ey = b.y - a.y;
                const d2 = ex * ex + ey * ey;
                if (d2 >= min2) continue;
                let d = Math.sqrt(d2);
                if (d < 1e-6) { ex = Math.cos(a.id); ey = Math.sin(a.id); d = 1; }
                const push = (min - d) / d;
                let wa = 0.5 - 0.15 * (a.rank - b.rank);
                if (wa < 0.25) wa = 0.25; else if (wa > 0.75) wa = 0.75;
                a.x -= ex * push * wa; a.y -= ey * push * wa;
                b.x += ex * push * (1 - wa); b.y += ey * push * (1 - wa);
              }
            }
          }
        }
        for (let i = 0; i < agents.length; i++) this.collideWalls(agents[i]);
      }
    }

    collideWalls(a) {
      const W = this.W, H = this.H;
      if (a.x < R) a.x = R; else if (a.x > W - R) a.x = W - R;
      if (a.y < R) a.y = R; else if (a.y > H - R) a.y = H - R;
      const cx = a.x | 0, cy = a.y | 0;
      if (this.wall[cx + cy * W]) { this.eject(a); return; }
      for (let yy = cy - 1; yy <= cy + 1; yy++) {
        for (let xx = cx - 1; xx <= cx + 1; xx++) {
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || !this.wall[xx + yy * W]) continue;
          const qx = a.x < xx ? xx : (a.x > xx + 1 ? xx + 1 : a.x);
          const qy = a.y < yy ? yy : (a.y > yy + 1 ? yy + 1 : a.y);
          const ex = a.x - qx, ey = a.y - qy, d2 = ex * ex + ey * ey;
          if (d2 >= R * R || d2 < 1e-12) continue;
          const d = Math.sqrt(d2), push = (R - d) / d;
          a.x += ex * push; a.y += ey * push;
        }
      }
    }
  }

  // --------------------------------------------------------------- patterns
  // A pattern decides where everyone starts and where they go next.
  function musterAt(w, m, count, team, sendToMarker) {
    const cells = w.musterCells(m.cell, count);
    for (let i = 0; i < count; i++) {
      const c = cells[i % cells.length];
      const a = w.spawn((c % w.W) + 0.3 + 0.4 * w.rng(), ((c / w.W) | 0) + 0.3 + 0.4 * w.rng(), team);
      a.data = { home: m.id, away: sendToMarker.id };
      w.sendTo(a, sendToMarker);
    }
  }

  function spawnInZone(w, m, team) {
    for (let tries = 0; tries < 6; tries++) {
      const c = m.zone[(w.rng() * m.zone.length) | 0];
      const x = (c % w.W) + 0.25 + 0.5 * w.rng(), y = ((c / w.W) | 0) + 0.25 + 0.5 * w.rng();
      if (w.roomAt(x, y)) return w.spawn(x, y, team);
    }
    return null;
  }

  function thereAndBack(w, a) {
    const d = a.data, t = d.home; d.home = d.away; d.away = t;
    a.tripStart = w.time;
    w.sendTo(a, w.marker(d.away));
  }

  const PATTERNS = {
    stream: {
      name: 'A → B',
      blurb: 'A steady stream out of A, into B.',
      init(w) { w.addMarker('A', 'A', 0, 0.06, 0.5); w.addMarker('B', 'B', 1, 0.94, 0.5); },
      spawnOne(w) {
        const a = spawnInZone(w, w.marker('A'), 0);
        if (!a) return null;
        w.sendTo(a, w.marker('B'));
        w.events.push({ type: 'in', x: a.x, y: a.y, team: 0 });
        return a;
      },
      arrive(w, a) { w.events.push({ type: 'out', x: a.x, y: a.y, team: 1 }); w.remove(a); },
    },

    headon: {
      name: 'A ⇄ B',
      blurb: 'Two crowds swap ends, forever.',
      init(w, n) {
        const A = w.addMarker('A', 'A', 0, 0.06, 0.5), B = w.addMarker('B', 'B', 1, 0.94, 0.5);
        musterAt(w, A, Math.ceil(n / 2), 0, B);
        musterAt(w, B, Math.floor(n / 2), 1, A);
      },
      spawnOne(w) {
        const t = w.agents.length & 1, ids = ['A', 'B'];
        const a = spawnInZone(w, w.marker(ids[t]), t);
        if (!a) return null;
        a.data = { home: ids[t], away: ids[1 - t] };
        w.sendTo(a, w.marker(ids[1 - t]));
        return a;
      },
      arrive: thereAndBack,
    },

    cross: {
      name: 'Crossroads',
      blurb: 'Four crowds, each bound for the far side.',
      ids: ['W', 'E', 'N', 'S'],
      init(w, n) {
        // Ids follow the long axis; the letters shown follow the compass.
        const lab = w.portrait ? ['N', 'S', 'W', 'E'] : ['W', 'E', 'N', 'S'];
        const W = w.addMarker('W', lab[0], 0, 0.06, 0.5), E = w.addMarker('E', lab[1], 1, 0.94, 0.5);
        const N = w.addMarker('N', lab[2], 2, 0.5, 0.08), S = w.addMarker('S', lab[3], 3, 0.5, 0.92);
        const q = Math.floor(n / 4);
        musterAt(w, W, n - 3 * q, 0, E); musterAt(w, E, q, 1, W);
        musterAt(w, N, q, 2, S); musterAt(w, S, q, 3, N);
      },
      spawnOne(w) {
        const t = w.agents.length & 3, ids = this.ids, o = t ^ 1;
        const a = spawnInZone(w, w.marker(ids[t]), t);
        if (!a) return null;
        a.data = { home: ids[t], away: ids[o] };
        w.sendTo(a, w.marker(ids[o]));
        return a;
      },
      arrive: thereAndBack,
    },

    circle: {
      name: 'Antipodes',
      blurb: 'Everyone on a ring, each heading for the point opposite.',
      fixed: true,
      init(w, n) {
        const W = w.W, H = w.H, cx = W / 2, cy = H / 2;
        const used = new Set();
        let ring = 0, placed = 0;
        const spots = [];
        while (placed < n && ring < 6) {
          const rxr = W / 2 - 1.5 - ring * 1.6, ryr = H / 2 - 1.5 - ring * 1.6;
          if (rxr < 3 || ryr < 3) break;
          const per = Math.PI * (rxr + ryr);
          const k = Math.min(n - placed, Math.max(2, Math.floor(per / 1.25) & ~1));
          for (let i = 0; i < k; i++) {
            const th = (i / k) * Math.PI * 2 + ring * 0.2;
            const px = cx + Math.cos(th) * rxr, py = cy + Math.sin(th) * ryr;
            let c = w.nearestFree(Math.floor(px) + Math.floor(py) * W, true);
            spots.push({ c, th, i, k, ring });
          }
          placed += k; ring++;
        }
        // Pair each spot with the one half a turn round the same ring.
        const byRing = {};
        for (const s of spots) (byRing[s.ring] = byRing[s.ring] || []).push(s);
        for (const s of spots) {
          const peers = byRing[s.ring], o = peers[(s.i + (s.k >> 1)) % s.k];
          if (used.has(s.c)) { s.c = w.nearestFree(s.c, true); }
          used.add(s.c);
          const a = w.spawn((s.c % W) + 0.5, ((s.c / W) | 0) + 0.5, 0);
          a.hue = s.th / (Math.PI * 2);
          a.data = { home: s.c, away: o.c };
          w.setGoal(a, o.c);
        }
      },
      arrive(w, a) {
        const d = a.data, t = d.home; d.home = d.away; d.away = t;
        w.setGoal(a, d.away);
      },
      lost(w, a) { const d = a.data, t = d.home; d.home = d.away; d.away = t; w.setGoal(a, d.away); a.lost = 0.5; },
    },

    wander: {
      name: 'Wander',
      blurb: 'Random start, random destination, repeat.',
      init(w, n) { for (let i = 0; i < n; i++) this.spawnOne(w, true); },
      pick(w, a) {
        for (let i = 0; i < 8; i++) {
          const g = w.randomFreeCell();
          w.setGoal(a, g);
          if (a.field.dist[w.cellOf(a)] < Infinity && g !== w.cellOf(a)) return;
        }
      },
      spawnOne(w, force) {
        let c = -1;
        for (let i = 0; i < 12; i++) {
          const t = w.randomFreeCell();
          if (force || w.roomAt((t % w.W) + 0.5, ((t / w.W) | 0) + 0.5)) { c = t; break; }
        }
        if (c < 0) return null;
        const a = w.spawn((c % w.W) + 0.5, ((c / w.W) | 0) + 0.5, (w.rng() * 6) | 0);
        this.pick(w, a);
        return a;
      },
      arrive(w, a) { this.pick(w, a); },
      lost(w, a) { this.pick(w, a); },
    },

    rally: {
      name: 'Follow the flag',
      blurb: 'Everyone gathers at the flag. Move it and they follow.',
      init(w, n) {
        const m = w.addMarker('F', '⚑', 4, 0.68, 0.36);
        m.zone = [m.cell];
        w.rallyCount = 0; w.rallyHold = 0; w.autoFlag = true;
        for (let i = 0; i < n; i++) this.spawnOne(w, true);
      },
      spawnOne(w, force) {
        const c = w.randomFreeCell();
        const x = (c % w.W) + 0.5, y = ((c / w.W) | 0) + 0.5;
        if (!force && !w.roomAt(x, y)) return null;
        const a = w.spawn(x, y, 4);
        a.hue = w.rng();
        a.target = 'F';
        w.setGoal(a, w.marker('F').cell);
        return a;
      },
      markerMoved(w, m) {
        m.zone = [m.cell];
        w.rallyCount = 0; w.rallyHold = 0;
        for (const a of w.agents) { a.target = 'F'; w.setGoal(a, m.cell); }
      },
      // The crowd settles in a disc that grows as it fills.
      check(w, a) {
        const d2 = (a.x - a.gx) ** 2 + (a.y - a.gy) ** 2;
        const r = 0.6 + 0.36 * Math.sqrt(w.rallyCount);
        return d2 < r * r && w.los(a.x, a.y, a.gx, a.gy);
      },
      arrive(w, a) { a.state = IDLE; w.rallyCount++; },
      tick(w, dt) {
        const m = w.marker('F');
        if (m.zone.length !== 1 || m.zone[0] !== m.cell) m.zone = [m.cell];
        // Stragglers who can't reach the disc settle beside someone who has.
        if (w.tick % 20 === 0) {
          for (const a of w.agents) {
            if (a.state !== MOVE || a.stuck < 1.5) continue;
            const cx = a.cell % w.W, cy = (a.cell / w.W) | 0;
            let near = false;
            for (let yy = Math.max(0, cy - 1); yy <= Math.min(w.H - 1, cy + 1) && !near; yy++) {
              for (let xx = Math.max(0, cx - 1); xx <= Math.min(w.W - 1, cx + 1) && !near; xx++) {
                for (let i = w.head[xx + yy * w.W]; i >= 0; i = w.link[i]) {
                  const b = w.agents[i];
                  if (b && b.state === IDLE && (b.x - a.x) ** 2 + (b.y - a.y) ** 2 < 0.8) { near = true; break; }
                }
              }
            }
            if (near) { a.state = IDLE; w.rallyCount++; w.arrivalTimes.push(w.time); }
          }
        }
        if (!w.autoFlag) return;
        if (w.rallyCount >= w.agents.length * 0.92) w.rallyHold += dt; else w.rallyHold = 0;
        if (w.rallyHold > 2.2) {
          for (let i = 0; i < 30; i++) {
            const c = w.randomFreeCell();
            const dx = (c % w.W) + 0.5 - m.x, dy = ((c / w.W) | 0) + 0.5 - m.y;
            if (dx * dx + dy * dy > (Math.max(w.W, w.H) * 0.35) ** 2) { w.moveMarker('F', c % w.W, (c / w.W) | 0); break; }
          }
          w.rallyHold = 0;
        }
      },
      lost() {},
    },
  };

  // ------------------------------------------------------------------- maps
  // Each generator draws onto a landscape L x S grid; portrait floors get the
  // transpose, so every layout keeps its long axis between A and B.
  function generate(id, L, S, rng) {
    const g = new Uint8Array(L * S);
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < L && y < S) g[x + y * L] = v; };
    const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, v); };
    const disc = (cx, cy, r, v) => {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) set(x, y, v);
        }
      }
    };
    const mx = L >> 1, my = S >> 1;
    switch (id) {
      case 'boulders': {
        const k = Math.round(L * S / 95);
        for (let i = 0; i < k; i++) {
          const cx = 7 + rng() * (L - 14), cy = 1 + rng() * (S - 2);
          disc(cx, cy, 0.9 + rng() * 1.9, 1);
          if (rng() < 0.5) disc(cx + rng() * 2 - 1, cy + rng() * 2 - 1, 0.8 + rng() * 1.2, 1);
        }
        break;
      }
      case 'bridge':
        rect(mx - 4, 0, mx + 4, S, 1);
        rect(mx - 4, my, mx + 4, my + 1, 0);
        break;
      case 'bridges':
        rect(mx - 4, 0, mx + 4, S, 1);
        rect(mx - 4, Math.round(S * 0.27), mx + 4, Math.round(S * 0.27) + 1, 0);
        rect(mx - 4, Math.round(S * 0.73), mx + 4, Math.round(S * 0.73) + 1, 0);
        break;
      case 'doors': {
        rect(mx - 1, 0, mx + 1, S, 1);
        const a = Math.round(S * 0.18), b = Math.round(S * 0.5) - 1, c = Math.round(S * 0.8) - 1;
        rect(mx - 1, a, mx + 1, a + 1, 0);
        rect(mx - 1, b, mx + 1, b + 2, 0);
        rect(mx - 1, c, mx + 1, c + 3, 0);
        break;
      }
      case 'blocks': {
        const bw = 5, bh = 4, st = 2;
        const nx = Math.floor((L - 10 + st) / (bw + st)), ny = Math.floor((S - 4 + st) / (bh + st));
        const ox = Math.floor((L - (nx * (bw + st) - st)) / 2), oy = Math.floor((S - (ny * (bh + st) - st)) / 2);
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) {
            if (rng() < 0.08) continue;
            const x = ox + i * (bw + st), y = oy + j * (bh + st);
            rect(x, y, x + bw, y + bh, 1);
            if (rng() < 0.22) rect(x + 1, y + 1, x + bw - 1, y + bh - 1, 1);
          }
        }
        break;
      }
      case 'maze': {
        // Corridors two cells wide, so traffic can pass itself; then knock
        // through extra walls so there is always more than one way round.
        const M = Math.floor((L - 9) / 3), K = Math.floor((S - 1) / 3);
        const ox = Math.floor((L - (M * 3 + 1)) / 2), oy = Math.floor((S - (K * 3 + 1)) / 2);
        rect(ox, oy, ox + M * 3 + 1, oy + K * 3 + 1, 1);
        const seen = new Uint8Array(M * K), stack = [0];
        seen[0] = 1;
        const open = (i, j) => rect(ox + 1 + 3 * i, oy + 1 + 3 * j, ox + 3 + 3 * i, oy + 3 + 3 * j, 0);
        const link = (i, j, di, dj) => {
          if (di) rect(ox + 3 * (i + (di > 0 ? 1 : 0)), oy + 1 + 3 * j, ox + 3 * (i + (di > 0 ? 1 : 0)) + 1, oy + 3 + 3 * j, 0);
          else rect(ox + 1 + 3 * i, oy + 3 * (j + (dj > 0 ? 1 : 0)), ox + 3 + 3 * i, oy + 3 * (j + (dj > 0 ? 1 : 0)) + 1, 0);
        };
        open(0, 0);
        while (stack.length) {
          const cur = stack[stack.length - 1], i = cur % M, j = (cur / M) | 0;
          const opts = [];
          if (i > 0 && !seen[cur - 1]) opts.push([-1, 0]);
          if (i < M - 1 && !seen[cur + 1]) opts.push([1, 0]);
          if (j > 0 && !seen[cur - M]) opts.push([0, -1]);
          if (j < K - 1 && !seen[cur + M]) opts.push([0, 1]);
          if (!opts.length) { stack.pop(); continue; }
          const [di, dj] = opts[(rng() * opts.length) | 0];
          link(i, j, di, dj); open(i + di, j + dj);
          seen[cur + di + dj * M] = 1; stack.push(cur + di + dj * M);
        }
        for (let j = 0; j < K; j++) {
          for (let i = 0; i < M; i++) {
            if (i < M - 1 && rng() < 0.3) link(i, j, 1, 0);
            if (j < K - 1 && rng() < 0.3) link(i, j, 0, 1);
          }
        }
        // doors in the outer wall
        for (let j = 0; j < K; j++) if (j % 2 === (K >> 1) % 2) { rect(ox, oy + 1 + 3 * j, ox + 1, oy + 3 + 3 * j, 0); rect(ox + M * 3, oy + 1 + 3 * j, ox + M * 3 + 1, oy + 3 + 3 * j, 0); }
        for (let i = 0; i < M; i++) if (i % 3 === (M >> 1) % 3) { rect(ox + 1 + 3 * i, oy, ox + 3 + 3 * i, oy + 1, 0); rect(ox + 1 + 3 * i, oy + K * 3, ox + 3 + 3 * i, oy + K * 3 + 1, 0); }
        break;
      }
      case 'pillars':
        for (let j = 0, y = 2; y < S - 2; y += 3, j++) {
          for (let x = 7 + (j & 1) * 2; x < L - 7; x += 4) set(x, y, 1);
        }
        break;
      default:
        break;
    }
    // Keep the four plazas where the crowds muster clear.
    if (id !== 'blank') {
      disc(Math.floor(L * 0.06) + 0.5, Math.floor(S * 0.5) + 0.5, 2.3, 0);
      disc(Math.floor(L * 0.94) + 0.5, Math.floor(S * 0.5) + 0.5, 2.3, 0);
      if (id !== 'bridge' && id !== 'bridges' && id !== 'doors') {
        disc(Math.floor(L * 0.5) + 0.5, Math.floor(S * 0.08) + 0.5, 1.6, 0);
        disc(Math.floor(L * 0.5) + 0.5, Math.floor(S * 0.92) + 0.5, 1.6, 0);
      }
    }
    return g;
  }

  function buildMap(id, W, H, seed) {
    const rng = mulberry32(seed || 7);
    if (W >= H) return generate(id, W, H, rng);
    const g = generate(id, H, W, rng), out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[x + y * W] = g[y + x * H];
    return out;
  }

  const MAPS = [
    { id: 'bridges', name: 'Two bridges', blurb: 'Two one-lane bridges. Watch each settle into a direction.' },
    { id: 'bridge', name: 'One bridge', blurb: 'A single one-lane bridge, shared by signal.' },
    { id: 'doors', name: 'Three doors', blurb: 'One wall, doors one, two and three wide.' },
    { id: 'blocks', name: 'City blocks', blurb: 'A street grid.' },
    { id: 'maze', name: 'Maze', blurb: 'A braided maze with two-lane corridors.' },
    { id: 'pillars', name: 'Pillar hall', blurb: 'A forest of columns.' },
    { id: 'boulders', name: 'Boulders', blurb: 'Open ground, scattered rocks.' },
    { id: 'blank', name: 'Blank', blurb: 'Empty floor. Draw your own.' },
  ];

  const Sim = { World, PATTERNS, MAPS, buildMap, R, SPEED, MOVE, IDLE, DX, DY };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.Sim = Sim;
})(typeof self !== 'undefined' ? self : this);
