// The cross-section of the car body, and the mapping from the flat (u, v)
// coordinates the panels are laid out in to points on the body.
//
// The profile is half the cross-section, the right-hand side, running from the
// bottom edge of the body up the side and over the roof to the centre line.
// u is the position along the car, v the distance along the profile from its
// bottom edge, and d an offset along the body's outward normal (negative is
// inside). Tube trains are round-shouldered to fit the tunnels, so most of
// the upper half of the side is curved.

import { BODY } from './dims.js';

const HALF = BODY.width / 2;
const SHOULDER_EXP = 2.7;     // superellipse exponent of the shoulders and roof

function rawProfile() {
  const pts = [];
  // the bottom edge tucks in a little
  const tuck = 0.055, tuckH = 0.12;
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI / 2;
    pts.push([HALF - tuck * (1 - Math.sin(a)), BODY.bottom + tuckH * (1 - Math.cos(a))]);
  }
  // straight side
  const y0 = BODY.bottom + tuckH;
  for (let i = 1; i <= 20; i++) pts.push([HALF, y0 + (BODY.sideTop - y0) * (i / 20)]);
  // superellipse shoulder and roof, from the side top to the centre line
  const b = BODY.height - BODY.sideTop, n = SHOULDER_EXP;
  for (let i = 1; i <= 600; i++) {
    const t = (i / 600) * Math.PI / 2;
    const c = Math.cos(t), s = Math.sin(t);
    pts.push([HALF * Math.pow(c, 2 / n), BODY.sideTop + b * Math.pow(s, 2 / n)]);
  }
  return pts;
}

function build() {
  const raw = rawProfile();
  // resample evenly by arc length
  const cum = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const length = cum[cum.length - 1];
  const N = 2400;
  const z = new Float64Array(N + 1), y = new Float64Array(N + 1);
  let j = 0;
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * length;
    while (j < raw.length - 2 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    z[i] = raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f;
    y[i] = raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f;
  }
  // unit tangents (up and over), smoothed a little
  const tz = new Float64Array(N + 1), ty = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const a = Math.max(0, i - 3), b = Math.min(N, i + 3);
    const dz = z[b] - z[a], dy = y[b] - y[a], l = Math.hypot(dz, dy);
    tz[i] = dz / l; ty[i] = dy / l;
  }
  return { length, N, z, y, tz, ty };
}

const P = build();

export const PROFILE_LENGTH = P.length;

// point on the profile at arc length v, offset by d along the outward normal
export function profileAt(v, d = 0) {
  const f = Math.min(Math.max(v / P.length, 0), 1) * P.N;
  const i = Math.min(Math.floor(f), P.N - 1), t = f - i;
  const lerp = (a) => a[i] + (a[i + 1] - a[i]) * t;
  let tz = lerp(P.tz), ty = lerp(P.ty);
  const l = Math.hypot(tz, ty); tz /= l; ty /= l;
  // outward normal: the tangent turned clockwise
  const nz = ty, ny = -tz;
  return { z: lerp(P.z) + nz * d, y: lerp(P.y) + ny * d, nz, ny, tz, ty };
}

// arc length at which the profile reaches height y (it rises all the way)
export function vAtY(y) {
  let lo = 0, hi = P.length;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (profileAt(mid).y < y) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// half-width of the body at height y
export function halfWidthAt(y) {
  if (y <= BODY.bottom) return profileAt(0).z;
  return profileAt(vAtY(Math.min(y, BODY.height - 1e-4))).z;
}

// The body surface on one side (+1 right, -1 left): (u, v, d) -> 3D point and
// normal. The left side is the mirror image.
export function surfacePoint(side, u, v, d = 0) {
  const p = profileAt(v, d);
  return { pos: [u, p.y, side * p.z], normal: [0, p.ny, side * p.nz], tangentV: [0, p.ty, side * p.tz] };
}
