// MeshBuilder: accumulates low-poly geometry with per-vertex colours, used for
// both the static terrain of each screen and every character and prop model.

import { mat4, hexLin, noise3 } from './math.js';
import { STRIDE, Mesh } from './gl.js';

export class MeshBuilder {
  constructor() {
    this.data = [];
    this.stack = [];
    this.m = mat4.create();
    this.nm = new Float32Array(9);
    mat4.normalMat(this.nm, this.m);
    this.col = [1, 1, 1];
    this.emis = 0;
    this.sway = 0;
    this.colorFn = null; // optional (x, y, z, baseColour) -> colour, in world space
    this.displace = null; // optional (x, y, z) -> [x, y, z], in world space
  }

  color(c) { this.col = typeof c === 'number' ? hexLin(c) : c; return this; }

  push() { this.stack.push([new Float32Array(this.m), this.col, this.emis, this.sway, this.colorFn, this.displace]); return this; }
  pop() {
    const s = this.stack.pop();
    this.m = s[0]; this.col = s[1]; this.emis = s[2]; this.sway = s[3]; this.colorFn = s[4]; this.displace = s[5];
    mat4.normalMat(this.nm, this.m);
    return this;
  }
  translate(x, y, z) { mat4.translate(this.m, this.m, x, y, z); return this; }
  rotateX(a) { mat4.rotate(this.m, this.m, 0, a); mat4.normalMat(this.nm, this.m); return this; }
  rotateY(a) { mat4.rotate(this.m, this.m, 1, a); mat4.normalMat(this.nm, this.m); return this; }
  rotateZ(a) { mat4.rotate(this.m, this.m, 2, a); mat4.normalMat(this.nm, this.m); return this; }
  scale(x, y = x, z = x) { mat4.scale(this.m, this.m, x, y, z); mat4.normalMat(this.nm, this.m); return this; }

  _xf(p) {
    const m = this.m;
    let x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    let y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    let z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
    if (this.displace) [x, y, z] = this.displace(x, y, z);
    return [x, y, z];
  }
  _xn(n) {
    const m = this.nm;
    const x = m[0] * n[0] + m[3] * n[1] + m[6] * n[2];
    const y = m[1] * n[0] + m[4] * n[1] + m[7] * n[2];
    const z = m[2] * n[0] + m[5] * n[1] + m[8] * n[2];
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }
  _push(p, n, c, sway) {
    const col = this.colorFn ? this.colorFn(p[0], p[1], p[2], c) : c;
    this.data.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], this.emis, sway ?? this.sway);
  }

  // Flat-shaded triangle from local points; optional per-vertex colours.
  tri(a, b, c, ca, cb, cc, sw) {
    const p0 = this._xf(a), p1 = this._xf(b), p2 = this._xf(c);
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    const n = [nx / l, ny / l, nz / l];
    this._push(p0, n, ca || this.col, sw && sw[0]);
    this._push(p1, n, cb || this.col, sw && sw[1]);
    this._push(p2, n, cc || this.col, sw && sw[2]);
    return this;
  }
  quad(a, b, c, d, ca, cb, cc, cd) {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
    return this;
  }
  // Triangle with explicit (local) normals, for smooth shading.
  triN(a, b, c, na, nb, nc, ca, cb, cc) {
    this._push(this._xf(a), this._xn(na), ca || this.col);
    this._push(this._xf(b), this._xn(nb), cb || this.col);
    this._push(this._xf(c), this._xn(nc), cc || this.col);
    return this;
  }

  // Axis-aligned box centred at (x, y, z) with full sizes (w, h, d).
  // opts.faces can skip faces: {top:false, bottom:false, ...}
  box(x, y, z, w, h, d, opts = {}) {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2, z0 = z - d / 2, z1 = z + d / 2;
    const f = opts.faces || {};
    const top = opts.topColor, side = opts.sideColor;
    const ct = top ? (typeof top === 'number' ? hexLin(top) : top) : null;
    const cs = side ? (typeof side === 'number' ? hexLin(side) : side) : null;
    const T = ct, S = cs;
    if (f.top !== false) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], T, T, T, T);
    if (f.bottom !== false && f.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], S, S, S, S);
    if (f.front !== false) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], S, S, S, S);
    if (f.back !== false) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], S, S, S, S);
    if (f.left !== false) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], S, S, S, S);
    if (f.right !== false) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], S, S, S, S);
    return this;
  }

  // Box with chamfered (bevelled) top edges, for a softer toy-like look.
  bevelBox(x, y, z, w, h, d, bev = 0.08, opts = {}) {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2, z0 = z - d / 2, z1 = z + d / 2;
    const b = bev;
    const ct = opts.topColor ? hexLin(opts.topColor) : null;
    const xi0 = x0 + b, xi1 = x1 - b, zi0 = z0 + b, zi1 = z1 - b, yb = y1 - b;
    // top
    this.quad([xi0, y1, zi1], [xi1, y1, zi1], [xi1, y1, zi0], [xi0, y1, zi0], ct, ct, ct, ct);
    // bevels
    this.quad([x0, yb, z1], [x1, yb, z1], [xi1, y1, zi1], [xi0, y1, zi1]);
    this.quad([x1, yb, z0], [x0, yb, z0], [xi0, y1, zi0], [xi1, y1, zi0]);
    this.quad([x0, yb, z0], [x0, yb, z1], [xi0, y1, zi1], [xi0, y1, zi0]);
    this.quad([x1, yb, z1], [x1, yb, z0], [xi1, y1, zi0], [xi1, y1, zi1]);
    // sides
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, yb, z1], [x0, yb, z1]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, yb, z0], [x1, yb, z0]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, yb, z1], [x0, yb, z0]);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, yb, z0], [x1, yb, z1]);
    if (opts.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    return this;
  }

  // Cylinder / cone / frustum along +y from y to y+h.
  cylinder(x, y, z, r0, r1, h, seg = 8, opts = {}) {
    const caps = opts.caps ?? true;
    const smoothSides = opts.smooth ?? false;
    const ct = opts.topColor ? hexLin(opts.topColor) : null;
    const rot = opts.rot ?? 0;
    for (let i = 0; i < seg; i++) {
      const a0 = rot + (i / seg) * Math.PI * 2, a1 = rot + ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p00 = [x + c0 * r0, y, z + s0 * r0], p01 = [x + c1 * r0, y, z + s1 * r0];
      const p10 = [x + c0 * r1, y + h, z + s0 * r1], p11 = [x + c1 * r1, y + h, z + s1 * r1];
      if (smoothSides) {
        const slope = (r0 - r1) / h;
        const n0 = [c0, slope, s0], n1 = [c1, slope, s1];
        if (r1 > 0.0001) {
          this.triN(p00, p10, p11, n0, n0, n1);
          this.triN(p00, p11, p01, n0, n1, n1);
        } else {
          this.triN(p00, p10, p01, n0, [(c0 + c1) / 2, slope, (s0 + s1) / 2], n1);
        }
      } else if (r1 > 0.0001) {
        this.quad(p00, p10, p11, p01);
      } else {
        this.tri(p00, p10, p01);
      }
      if (caps) {
        if (r1 > 0.0001) this.tri([x, y + h, z], p11, p10, ct, ct, ct);
        if (opts.bottomCap) this.tri([x, y, z], p00, p01);
      }
    }
    return this;
  }

  cone(x, y, z, r, h, seg = 8, opts = {}) { return this.cylinder(x, y, z, r, 0, h, seg, opts); }

  // Low-poly sphere (UV-style, flat or smooth), centred at (x, y, z).
  sphere(x, y, z, r, segU = 8, segV = 6, opts = {}) {
    const sx = opts.sx ?? 1, sy = opts.sy ?? 1, sz = opts.sz ?? 1;
    const smoothS = opts.smooth ?? false;
    const jitter = opts.jitter ?? 0;
    const seed = opts.seed ?? 0;
    const pt = (i, j) => {
      const u = (i / segU) * Math.PI * 2, v = (j / segV) * Math.PI;
      let nx = Math.sin(v) * Math.cos(u), ny = Math.cos(v), nz = Math.sin(v) * Math.sin(u);
      let rr = r;
      if (jitter && j > 0 && j < segV) rr *= 1 + (noise3(nx * 2.3 + seed, ny * 2.3, nz * 2.3) - 0.5) * jitter;
      return { p: [x + nx * rr * sx, y + ny * rr * sy, z + nz * rr * sz], n: [nx / sx, ny / sy, nz / sz] };
    };
    const grid = [];
    for (let j = 0; j <= segV; j++) {
      grid.push([]);
      for (let i = 0; i <= segU; i++) grid[j].push(pt(i % segU, j));
    }
    // make seam and poles consistent
    for (let j = 0; j <= segV; j++) grid[j][segU] = grid[j][0];
    const colAt = opts.colorFn;
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
        const cA = colAt ? colAt(a.p) : null, cB = colAt ? colAt(b.p) : null, cC = colAt ? colAt(c.p) : null, cD = colAt ? colAt(d.p) : null;
        if (smoothS) {
          if (j > 0) this.triN(a.p, b.p, d.p, a.n, b.n, d.n, cA, cB, cD);
          if (j < segV - 1) this.triN(b.p, c.p, d.p, b.n, c.n, d.n, cB, cC, cD);
        } else {
          if (j > 0) this.tri(a.p, b.p, d.p, cA, cB, cD);
          if (j < segV - 1) this.tri(b.p, c.p, d.p, cB, cC, cD);
        }
      }
    }
    return this;
  }

  // Flat disc facing up.
  disc(x, y, z, r, seg = 12) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      this.tri([x, y, z], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r]);
    }
    return this;
  }

  // Extruded flat polygon (points in local xz, extruded along y).
  prism(points, y0, y1) {
    const n = points.length;
    for (let i = 1; i < n - 1; i++) {
      this.tri([points[0][0], y1, points[0][1]], [points[i + 1][0], y1, points[i + 1][1]], [points[i][0], y1, points[i][1]]);
      this.tri([points[0][0], y0, points[0][1]], [points[i][0], y0, points[i][1]], [points[i + 1][0], y0, points[i + 1][1]]);
    }
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[(i + 1) % n];
      this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]);
    }
    return this;
  }

  build(gl) { return new Mesh(gl, new Float32Array(this.data)); }
  get vertexCount() { return this.data.length / STRIDE; }
}
