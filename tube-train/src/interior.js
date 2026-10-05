// Inside a car: the longitudinal seats in each bay between the doors, the
// draught screens beside the doorways, the blue grab poles and rails, and on
// a driving car the cab behind the front.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BODY } from './dims.js';
import { Builders, matrixFrom } from './geom.js';
import { V, liningAt, liningVAtZ } from './car.js';
import { profileAt } from './profile.js';
import { frontSurfaceX } from './nose.js';

const FLOOR = BODY.floor;
const POLE_R = 0.019;

// height of the ceiling (the lining) at distance z from the centre line
function ceilingY(z) { return liningAt(liningVAtZ(Math.abs(z))).y; }

function pole(b, a, c, r = POLE_R) {
  const d = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, 14, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), q, new THREE.Vector3(1, 1, 1));
  b.addGeometry(g, m);
}

function box(b, size, pos, rot) { b.addGeometry(new THREE.BoxGeometry(...size), matrixFrom(pos, rot)); }

// Where the seats are in a car, in the car's own coordinates: each seat's
// middle along the car (x), its side (s, +1 or -1 in z) and the wall behind
// it; and the rails along the ceiling that standing passengers hold.
export function seatLayout(spec) {
  const L = spec.length;
  const X = (d) => L / 2 - d;
  const zWall = liningAt(vAtHeight(1.4)).z;
  const railZ = 0.80, railY = ceilingY(railZ) - 0.13;
  const bays = [];
  const seats = [];
  for (const [d0, d1] of spec.seatBays) {
    const x0 = X(d1), x1 = X(d0);
    const run0 = x0 + 0.07, run1 = x1 - 0.07;
    const n = Math.max(1, Math.round((run1 - run0) / 0.52));
    const w = (run1 - run0) / n;
    bays.push({ x0, x1, run0, run1, n, w });
    for (const s of [1, -1]) for (let i = 0; i < n; i++) seats.push({ x: run0 + (i + 0.5) * w, s, z: s * (zWall - 0.22) });
  }
  // the middles of the doorways, along the car
  const doors = spec.doors.map(d => X((d.doorway[0] + d.doorway[1]) / 2));
  return { L, zWall, railZ, railY, bays, seats, doors, floor: FLOOR, seatHeight: FLOOR + 0.47 };
}

export function buildInterior(type, spec, materials) {
  const L = spec.length;
  const X = (d) => L / 2 - d;
  const B = new Builders();
  const { zWall, railZ, railY } = seatLayout(spec);
  const cushion = (w) => new RoundedBoxGeometry(w, 0.1, 0.46, 2, 0.04);
  const back = (w) => new RoundedBoxGeometry(w, 0.52, 0.09, 2, 0.04);

  for (const [d0, d1] of spec.seatBays) {
    const x0 = X(d1), x1 = X(d0);
    for (const s of [1, -1]) {
      const run0 = x0 + 0.07, run1 = x1 - 0.07;
      const n = Math.max(1, Math.round((run1 - run0) / 0.52));
      const w = (run1 - run0) / n;
      // plinth under the seats
      box(B.get('seatFrame'), [run1 - run0, 0.36, 0.36], [(run0 + run1) / 2, FLOOR + 0.18, s * (zWall - 0.2)]);
      for (let i = 0; i < n; i++) {
        const cx = run0 + (i + 0.5) * w;
        B.get('seat').addGeometry(cushion(w - 0.035), matrixFrom([cx, FLOOR + 0.42, s * (zWall - 0.25)]));
        B.get('seat').addGeometry(back(w - 0.035), matrixFrom([cx, FLOOR + 0.76, s * (zWall - 0.06)], [s * -0.09, 0, 0]));
        // armrests between seats
        if (i > 0) box(B.get('seatFrame'), [0.03, 0.05, 0.36], [run0 + i * w, FLOOR + 0.58, s * (zWall - 0.24)]);
      }
      // poles at the front edge of the seats, up to the rail along the ceiling
      for (const f of [1 / 3, 2 / 3]) {
        const px = run0 + Math.round(n * f) * w;
        pole(B.get('pole'), [px, FLOOR + 0.47, s * railZ], [px, railY, s * railZ]);
      }
      pole(B.get('pole'), [x0 + 0.05, railY, s * railZ], [x1 - 0.05, railY, s * railZ]);
      for (const hx of [x0 + 0.25, (x0 + x1) / 2, x1 - 0.25]) {
        pole(B.get('pole'), [hx, railY, s * railZ], [hx, ceilingY(railZ) + 0.02, s * railZ], 0.012);
      }
      // draught screens at both ends of the bay, with a pole along the edge
      // (the wall curves in above the windows, so the screen's top rail
      // stops where the wall is at that height)
      const screenTop = FLOOR + 1.42, wallAtTop = liningAt(vAtHeight(screenTop)).z - 0.01;
      for (const [ex, dir] of [[x0 + 0.03, 1], [x1 - 0.03, -1]]) {
        const zi = zWall - 0.6;
        B.get('screen').addGeometry(new THREE.BoxGeometry(0.012, screenTop - FLOOR - 0.24, wallAtTop - zi), matrixFrom([ex, (screenTop + FLOOR + 0.24) / 2, s * (wallAtTop + zi) / 2]));
        pole(B.get('pole'), [ex, FLOOR, s * zi], [ex, railY, s * zi]);
        pole(B.get('pole'), [ex, screenTop, s * wallAtTop], [ex, screenTop, s * zi]);
        pole(B.get('pole'), [ex, railY, s * zi], [ex + dir * 0.1, railY, s * railZ]);
      }
    }
  }
  // a pole in the middle of each double doorway, offset to one side
  spec.doors.filter(d => d.leaves.length === 2).forEach((d, i) => {
    const x = X((d.doorway[0] + d.doorway[1]) / 2);
    const z = i % 2 ? -0.32 : 0.32;
    pole(B.get('pole'), [x, FLOOR, z], [x, ceilingY(z) + 0.02, z], 0.021);
  });
  // perches against the car ends
  const ends = type === 'A' ? [-1] : [-1, 1];
  for (const e of ends) {
    for (const s of [1, -1]) {
      B.get('seat').addGeometry(new RoundedBoxGeometry(0.4, 0.12, 0.3, 2, 0.04), matrixFrom([e * (L / 2 - 0.35), FLOOR + 0.72, s * (zWall - 0.2)]));
    }
  }

  if (type === 'A') addCab(B, spec, L, materials);

  const group = B.toGroup(materials, `interior-${type}`);
  if (type === 'A') addLamps(group, L, materials);
  return group;
}

function vAtHeight(y) {
  let lo = 0, hi = V.top;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (profileAt(m).y < y) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// The cab: the bulkhead behind it, the desk, the driver's seat, and the
// black boxes behind the windscreens that hold the lamps.
function addCab(B, spec, L, materials) {
  const xb = L / 2 - spec.cabBack;
  // bulkhead: the body outline, with a doorway in the middle
  const outline = [];
  const n = 60;
  for (let i = 0; i <= n; i++) { const p = liningAt(V.floor + (V.top - V.floor) * i / n); outline.push(new THREE.Vector2(p.z, p.y)); }
  for (let i = n - 1; i >= 0; i--) { const p = liningAt(V.floor + (V.top - V.floor) * i / n); outline.push(new THREE.Vector2(-p.z, p.y)); }
  const hole = [[-0.33, FLOOR + 0.02], [-0.33, 2.55], [0.33, 2.55], [0.33, FLOOR + 0.02]].map(([z, y]) => new THREE.Vector2(z, y));
  const tris = THREE.ShapeUtils.triangulateShape(outline, [hole]);
  const all = [...outline, ...hole];
  for (const [key, x, nx] of [['lining', xb - 0.001, -1], ['liningGrey', xb + 0.03, 1]]) {
    const b = B.get(key);
    for (const [a, c, d] of tris) {
      const P = (k) => [x, all[k].y, all[k].x];
      b.tri(P(a), P(c), P(d), [nx, 0, 0], [nx, 0, 0], [nx, 0, 0]);
    }
  }
  // the cab door in the bulkhead: grey, with a window
  box(B.get('doorInside'), [0.03, 1.78, 0.64], [xb + 0.015, FLOOR + 0.9 + 0.02, 0]);
  box(B.get('screen'), [0.035, 0.6, 0.4], [xb + 0.015, 2.05, 0]);
  // desk across the front, the driver's side on the left (-z)
  const xd = L / 2 - 0.62;
  box(B.get('frame'), [0.55, 0.62, 2.1], [xd, FLOOR + 0.31, 0]);
  box(B.get('frame'), [0.5, 0.06, 2.0], [xd + 0.03, FLOOR + 0.64, 0], [0, 0, 0.18]);
  box(B.get('mask'), [0.02, 0.2, 0.34], [xd - 0.2, FLOOR + 0.78, -0.5], [0, 0, 0.5]);
  box(B.get('mask'), [0.02, 0.18, 0.3], [xd - 0.2, FLOOR + 0.77, -0.95], [0, 0, 0.5]);
  // seat
  B.get('seatFrame').addGeometry(new RoundedBoxGeometry(0.46, 0.1, 0.46, 2, 0.04), matrixFrom([L / 2 - 1.3, FLOOR + 0.55, -0.55]));
  B.get('seatFrame').addGeometry(new RoundedBoxGeometry(0.46, 0.62, 0.1, 2, 0.04), matrixFrom([L / 2 - 1.55, FLOOR + 0.9, -0.55], [0, Math.PI / 2, 0.12]));
  pole(B.get('frame'), [L / 2 - 1.3, FLOOR, -0.55], [L / 2 - 1.3, FLOOR + 0.5, -0.55], 0.04);
  // lamp boxes behind the lower corners of the windscreens
  for (const s of [1, -1]) {
    box(B.get('rubber'), [0.4, 0.24, 0.62], [L / 2 - 0.42, 1.5, s * 0.78]);
  }
  void materials;
}

// Headlights and tail lights, behind the glass at the bottom of each
// windscreen. Their materials are set per car, lit or not.
function addLamps(group, L, materials) {
  const lamp = (r, y, z, name) => {
    const x = frontSurfaceX(L / 2, y, z) - 0.035;
    const g = new THREE.CircleGeometry(r, 32);
    g.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(g, materials.lampOff);
    m.position.set(x, y, z);
    m.name = name;
    group.add(m);
    const rim = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.018, 32).rotateY(Math.PI / 2), materials.steel);
    rim.position.set(x + 0.001, y, z);
    group.add(rim);
    // the glare round it when it's lit
    const glow = new THREE.Sprite(name === 'headlamp' ? materials.headGlow : materials.tailGlow);
    glow.name = name === 'headlamp' ? 'headglow' : 'tailglow';
    glow.scale.setScalar(name === 'headlamp' ? 1.1 : 0.45);
    glow.position.set(x + 0.06, y, z);
    glow.visible = false;
    group.add(glow);
  };
  for (const s of [1, -1]) {
    lamp(0.085, 1.54, s * 0.87, 'headlamp');
    lamp(0.042, 1.54, s * 0.64, 'taillamp');
  }
  // the round marker lamps low on the mask
  for (const s of [1, -1]) {
    const y = 1.04, z = s * 0.66;
    const x = frontSurfaceX(L / 2, y, z);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), materials.lampOff);
    lens.scale.set(0.4, 1, 1);
    lens.position.set(x - 0.005, y, z);
    lens.name = 'marker';
    group.add(lens);
  }
}
