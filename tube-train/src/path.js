// The line's path through the ground, as a function of distance along it.
//
// A frame at distance s along a path gives the point on the track (the top of
// the rails, half way between them) and three directions: t forwards, u up
// and r to the right. Everything built along the line is built in these
// frames, with x forwards, y up and z to the right, as in the rest of the
// model.
//
// The underground line is made up as it goes, one block per station: a level
// straight through the station, then a bend or an S-bend and a dip down to
// the next one.
// Like the Victoria line's, the stations sit on humps, so trains run downhill
// as they pull away and uphill as they brake.

import * as THREE from 'three';
import { rng } from './textures.js';

const DS = 0.5;                       // sample spacing along the path

export class Frame {
  constructor() {
    this.pos = new THREE.Vector3();
    this.t = new THREE.Vector3(1, 0, 0);
    this.u = new THREE.Vector3(0, 1, 0);
    this.r = new THREE.Vector3(0, 0, 1);
  }
  // a frame from a position, a heading (radians, turning right is positive)
  // and a gradient (rise per metre)
  set(x, y, z, heading, grade) {
    this.pos.set(x, y, z);
    const c = Math.cos(heading), s = Math.sin(heading);
    this.t.set(c, grade, s).normalize();
    this.r.set(-s, 0, c);
    this.u.crossVectors(this.r, this.t);
    return this;
  }
  matrix(m = new THREE.Matrix4()) {
    return m.makeBasis(this.t, this.u, this.r).setPosition(this.pos);
  }
  // a point given in this frame's (x forwards, y up, z right)
  apply(x, y, z, out = new THREE.Vector3()) {
    return out.copy(this.pos).addScaledVector(this.t, x).addScaledVector(this.u, y).addScaledVector(this.r, z);
  }
}

// The depot road: straight and level along x.
export class StraightPath {
  frame(s, out = new Frame()) { return out.set(s, 0, 0, 0, 0); }
}

// The line underground. stationStart(k) is where station k's platform
// tunnel starts, and block k runs from 40 m before station k to 40 m before
// the next. Block -1 is the run-in to the first station: the train starts
// there, standing on a bend.
export class LinePath {
  constructor({ stationStart, stationLength, spacing }) {
    this.stationStart = stationStart;
    this.stationLength = stationLength;
    this.spacing = spacing;
    this.b0 = stationStart(0) - 40;
    this.blocks = [];                 // block k is blocks[k + 1]
  }

  blockStart(k) { return this.b0 + k * this.spacing; }

  // The curvature and the dip between stations, made up for each block:
  // a bend or an S-bend in every gap between stations, eased in and out.
  layout(k) {
    const r = rng(k * 7919 + 13);
    const curves = [];
    let g0;
    if (k < 0) {
      // the run-in: an S-bend, the train standing in the first curve of it
      // (its front at u = 180, its back at about u = 47)
      g0 = 0;
      curves.push({ start: 10, ease: 30, hold: 140, k: -1 / 160 }, { start: 250, ease: 30, hold: 90, k: 1 / 210 });
    } else {
      g0 = 40 + this.stationLength + 40;          // the station straight
      const G = this.spacing - g0;
      const radius = () => 150 + r() * 170;
      const side = r() < 0.5 ? -1 : 1;
      if (r() < 0.4) {
        const ease = 25 + r() * 10, hold = 70 + r() * 80;
        const len = 2 * ease + hold;
        curves.push({ start: g0 + 10 + r() * (G - 25 - len), ease, hold, k: side / radius() });
      } else {
        const a = { ease: 25, hold: 40 + r() * 40, k: side / radius() };
        const b = { ease: 25, hold: 40 + r() * 40, k: -side / radius() };
        const gap = 5 + r() * 15;
        const len = 4 * 25 + a.hold + b.hold + gap;
        a.start = g0 + 10 + r() * Math.max(0, G - 25 - len);
        b.start = a.start + 50 + a.hold + gap;
        curves.push(a, b);
      }
    }
    const G = this.spacing - g0;
    // up to about 1 in 30, the Victoria line's steepest
    const depth = 1.5 + r() * 1.6;
    return {
      curvature(u) {
        let c = 0;
        for (const q of curves) {
          const x = u - q.start;
          if (x <= 0 || x >= 2 * q.ease + q.hold) continue;
          const f = x < q.ease ? x / q.ease : x < q.ease + q.hold ? 1 : (2 * q.ease + q.hold - x) / q.ease;
          c += q.k * f;
        }
        return c;
      },
      height(u) {
        if (u <= g0) return [0, 0];
        const t = (u - g0) / G;
        return [-depth * Math.sin(Math.PI * t) ** 2, -depth * Math.PI / G * Math.sin(2 * Math.PI * t)];
      },
    };
  }

  block(k) {
    while (this.blocks.length <= k + 1) {
      const i = this.blocks.length - 1;
      const prev = this.blocks[i];
      const n = Math.round(this.spacing / DS);
      const b = { x: new Float64Array(n + 1), y: new Float64Array(n + 1), z: new Float64Array(n + 1), h: new Float64Array(n + 1), g: new Float64Array(n + 1) };
      b.x[0] = prev ? prev.x[n] : this.blockStart(-1);
      b.z[0] = prev ? prev.z[n] : 0;
      b.h[0] = prev ? prev.h[n] : 0;
      const L = this.layout(i);
      for (let j = 0; j <= n; j++) {
        const u = j * DS;
        [b.y[j], b.g[j]] = L.height(u);
        if (j === 0) continue;
        // heading by the curvature, position by the heading (midpoint rule)
        const hm = b.h[j - 1] + L.curvature(u - DS / 2) * DS / 2;
        b.h[j] = b.h[j - 1] + L.curvature(u - DS / 2) * DS;
        b.x[j] = b.x[j - 1] + Math.cos(hm) * DS;
        b.z[j] = b.z[j - 1] + Math.sin(hm) * DS;
      }
      this.blocks.push(b);
    }
    return this.blocks[k + 1];
  }

  frame(s, out = new Frame()) {
    if (s < this.blockStart(-1)) return out.set(s, 0, 0, 0, 0);
    const k = Math.floor((s - this.b0) / this.spacing);
    const b = this.block(k);
    const f = (s - this.blockStart(k)) / DS;
    const i = Math.min(Math.floor(f), b.x.length - 2), t = f - i;
    const L = (a) => a[i] + (a[i + 1] - a[i]) * t;
    return out.set(L(b.x), L(b.y), L(b.z), L(b.h), L(b.g));
  }

  // the distance along the path nearest to a point, starting from a guess
  nearest(p, guess) {
    const f = new Frame(), d = new THREE.Vector3();
    let s = guess;
    for (let i = 0; i < 6; i++) {
      this.frame(s, f);
      const step = d.subVectors(p, f.pos).dot(f.t);
      s += step;
      if (Math.abs(step) < 0.01) break;
    }
    return s;
  }
}

StraightPath.prototype.nearest = function (p) { return p.x; };
