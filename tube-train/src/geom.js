// Geometry helpers: a mesh builder, and panels laid onto the curved body.
//
// A panel is a region of the (u, v) plane (see profile.js): an outer shape
// with holes cut in it. It is meshed in thin horizontal strips, so that it
// follows the curve of the body, and each shape is described by the interval
// of u it covers at each v. That keeps rounded window corners exact without a
// general triangulator.

import * as THREE from 'three';
import { surfacePoint } from './profile.js';

const EPS = 1e-7;

export class MeshBuilder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; }

  // A triangle with per-vertex normals. It is wound so that it faces the way
  // its normals point, which saves thinking about winding everywhere else.
  tri(a, b, c, na, nb, nc, ta = [0, 0], tb = [0, 0], tc = [0, 0]) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const fx = e1[1] * e2[2] - e1[2] * e2[1], fy = e1[2] * e2[0] - e1[0] * e2[2], fz = e1[0] * e2[1] - e1[1] * e2[0];
    if (fx * fx + fy * fy + fz * fz < 1e-14) return;
    const dot = fx * (na[0] + nb[0] + nc[0]) + fy * (na[1] + nb[1] + nc[1]) + fz * (na[2] + nb[2] + nc[2]);
    if (dot < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [tb, tc] = [tc, tb]; }
    this.pos.push(...a, ...b, ...c);
    this.nrm.push(...na, ...nb, ...nc);
    this.uv.push(...ta, ...tb, ...tc);
  }

  quad(a, b, c, d, na, nb, nc, nd, ta, tb, tc, td) {
    this.tri(a, b, c, na, nb, nc, ta, tb, tc);
    this.tri(a, c, d, na, nc, nd, ta, tc, td);
  }

  // add a whole BufferGeometry (non-indexed or indexed), transformed by a matrix
  addGeometry(geo, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const t = g.attributes.uv ? g.attributes.uv.array : null;
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nrm.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) this.uv.push(t ? t[2 * i] : 0, t ? t[2 * i + 1] : 0);
    g.dispose();
  }

  get empty() { return this.pos.length === 0; }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

// A set of builders keyed by material name.
export class Builders {
  constructor() { this.map = new Map(); }
  get(key) {
    if (!this.map.has(key)) this.map.set(key, new MeshBuilder());
    return this.map.get(key);
  }
  // one mesh per material, in a group
  toGroup(materials, name) {
    const group = new THREE.Group();
    group.name = name || '';
    for (const [key, b] of this.map) {
      if (b.empty) continue;
      const mat = materials[key];
      if (!mat) throw new Error(`no material ${key}`);
      const mesh = new THREE.Mesh(b.geometry(), mat);
      mesh.name = key;
      mesh.castShadow = mesh.receiveShadow = !mat.transparent;
      group.add(mesh);
    }
    return group;
  }
}

// ---- shapes in the (u, v) plane ----

// A rectangle with rounded corners; r is a number or {bl, br, tl, tr}.
export class RoundedRect {
  constructor(u0, u1, v0, v1, r = 0) {
    this.u0 = u0; this.u1 = u1; this.v0 = v0; this.v1 = v1;
    const rr = typeof r === 'number' ? { bl: r, br: r, tl: r, tr: r } : r;
    const lim = Math.min((u1 - u0) / 2, (v1 - v0) / 2);
    this.r = Object.fromEntries(Object.entries(rr).map(([k, x]) => [k, Math.min(x, lim)]));
  }

  // how far a corner of radius r pulls the edge in at height dv from its end
  static inset(r, dv) {
    if (r <= 0 || dv >= r) return 0;
    const t = r - dv;
    return r - Math.sqrt(Math.max(r * r - t * t, 0));
  }

  interval(v) {
    const { bl, br, tl, tr } = this.r;
    const db = v - this.v0, dt = this.v1 - v;
    const left = Math.max(RoundedRect.inset(bl, db), RoundedRect.inset(tl, dt));
    const right = Math.max(RoundedRect.inset(br, db), RoundedRect.inset(tr, dt));
    return [this.u0 + left, this.u1 - right];
  }

  // v values the strip mesher should cut at: the ends and along the corners
  breaks() {
    const out = [this.v0, this.v1];
    const { bl, br, tl, tr } = this.r;
    for (const r of new Set([bl, br])) if (r > 0) for (let i = 1; i < 10; i++) out.push(this.v0 + r * (1 - Math.cos((i / 10) * Math.PI / 2)));
    for (const r of new Set([tl, tr])) if (r > 0) for (let i = 1; i < 10; i++) out.push(this.v1 - r * (1 - Math.cos((i / 10) * Math.PI / 2)));
    return out;
  }

  // the outline, anticlockwise in (u, v), as [u, v] points
  outline(steps = 10) {
    const { bl, br, tl, tr } = this.r, pts = [];
    const arc = (cu, cv, r, a0) => {
      if (r <= 0) { pts.push([cu, cv]); return; }
      for (let i = 0; i <= steps; i++) {
        const a = a0 + (i / steps) * Math.PI / 2;
        pts.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
      }
    };
    arc(this.u0 + bl, this.v0 + bl, bl, Math.PI);
    arc(this.u1 - br, this.v0 + br, br, 1.5 * Math.PI);
    arc(this.u1 - tr, this.v1 - tr, tr, 0);
    arc(this.u0 + tl, this.v1 - tl, tl, 0.5 * Math.PI);
    return pts;
  }

  grow(d) {
    const { bl, br, tl, tr } = this.r;
    return new RoundedRect(this.u0 - d, this.u1 + d, this.v0 - d, this.v1 + d,
      { bl: bl + d, br: br + d, tl: tl + d, tr: tr + d });
  }
}

// A general shape given by its u interval at each v, for outlines that are
// not rectangles (the side of a cab car ends where the nose starts).
export class IntervalShape {
  constructor(v0, v1, interval, breaks = []) {
    this.v0 = v0; this.v1 = v1; this.interval = interval; this._breaks = breaks;
  }
  breaks() { return [this.v0, this.v1, ...this._breaks]; }
}

// v values for strips: the shapes' own breaks plus even steps to follow the curve
function stripBreaks(outer, holes, step) {
  const vs = [...outer.breaks()];
  for (const h of holes) for (const v of h.breaks()) vs.push(v);
  const n = Math.ceil((outer.v1 - outer.v0) / step);
  for (let i = 1; i < n; i++) vs.push(outer.v0 + (i / n) * (outer.v1 - outer.v0));
  const inside = vs.filter(v => v >= outer.v0 - EPS && v <= outer.v1 + EPS).sort((a, b) => a - b);
  const out = [];
  for (const v of inside) if (!out.length || v - out[out.length - 1] > 1e-5) out.push(v);
  return out;
}

// Mesh a panel onto a surface. `map(u, v)` returns {pos, normal}; `extraCuts`
// are more v values to cut at (colour boundaries, say). The callback `pick`
// can choose a builder per strip, by its middle v.
export function meshPanel(builderOrPick, map, outer, holes = [], { step = 0.05, extraCuts = [], uvScale = 1 } = {}) {
  const vs = stripBreaks(outer, holes, step);
  for (const c of extraCuts) if (c > outer.v0 && c < outer.v1) vs.push(c);
  vs.sort((a, b) => a - b);
  const pick = typeof builderOrPick === 'function' ? builderOrPick : () => builderOrPick;
  for (let i = 0; i < vs.length - 1; i++) {
    const va = vs[i], vb = vs[i + 1];
    if (vb - va < 1e-6) continue;
    const vm = (va + vb) / 2;
    const b = pick(vm);
    if (!b) continue;
    const oa = outer.interval(va), ob = outer.interval(vb);
    // holes that cross this strip, clipped to the outer shape
    const clip = (iv, o) => [Math.max(iv[0], o[0]), Math.min(iv[1], o[1])];
    const active = holes.filter(h => h.v0 <= vm && h.v1 >= vm)
      .map(h => ({ a: clip(h.interval(va), oa), b: clip(h.interval(vb), ob) }))
      .filter(h => h.a[1] - h.a[0] > EPS || h.b[1] - h.b[0] > EPS)
      .sort((p, q) => (p.a[0] + p.b[0]) - (q.a[0] + q.b[0]));
    let left = [oa[0], ob[0]];
    const spans = [];
    for (const h of active) {
      spans.push([left, [h.a[0], h.b[0]]]);
      left = [h.a[1], h.b[1]];
    }
    spans.push([left, [oa[1], ob[1]]]);
    for (const [[la, lb], [ra, rb]] of spans) {
      if (ra - la <= EPS && rb - lb <= EPS) continue;
      const P = [[la, va], [ra, va], [rb, vb], [lb, vb]].map(([u, v]) => ({ ...map(u, v), u, v }));
      const uvs = P.map(p => [p.u * uvScale, p.v * uvScale]);
      if (ra - la <= EPS) b.tri(P[0].pos, P[2].pos, P[3].pos, P[0].normal, P[2].normal, P[3].normal, uvs[0], uvs[2], uvs[3]);
      else if (rb - lb <= EPS) b.tri(P[0].pos, P[1].pos, P[2].pos, P[0].normal, P[1].normal, P[2].normal, uvs[0], uvs[1], uvs[2]);
      else b.quad(P[0].pos, P[1].pos, P[2].pos, P[3].pos, P[0].normal, P[1].normal, P[2].normal, P[3].normal, uvs[0], uvs[1], uvs[2], uvs[3]);
    }
  }
}

// The wall around the edge of a shape, between two offsets from the body
// surface: a window's reveal or the edge of a door leaf. `facing` is +1 for
// an edge facing out of the shape (a leaf's edge) and -1 for one facing into
// it (a hole's reveal).
export function meshRim(builder, side, outline, d0, d1, facing) {
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const p = outline[i], q = outline[(i + 1) % n];
    const du = q[0] - p[0], dv = q[1] - p[1];
    const l = Math.hypot(du, dv);
    if (l < 1e-6) continue;
    // for an anticlockwise outline, (dv, -du) points out of the shape
    const nu = (dv / l) * facing, nv = (-du / l) * facing;
    const normalAt = (pt) => {
      const s = surfacePoint(side, pt[0], pt[1], 0);
      return [nu, s.tangentV[1] * nv, s.tangentV[2] * nv];
    };
    const np = normalAt(p), nq = normalAt(q);
    const a = surfacePoint(side, p[0], p[1], d0).pos, b = surfacePoint(side, q[0], q[1], d0).pos;
    const c = surfacePoint(side, q[0], q[1], d1).pos, d = surfacePoint(side, p[0], p[1], d1).pos;
    builder.quad(a, b, c, d, np, nq, nq, np, [0, 0], [l, 0], [l, 1], [0, 1]);
  }
}

// map (u, v) onto one side of the body at offset d, facing out (+1) or in (-1)
export function bodyMap(side, d, facing = 1) {
  return (u, v) => {
    const s = surfacePoint(side, u, v, d);
    return { pos: s.pos, normal: facing > 0 ? s.normal : s.normal.map(x => -x) };
  };
}

export function matrixFrom(position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
  return m;
}
