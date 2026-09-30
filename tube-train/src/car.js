// One car: the body shell with its windows and doorways, the door leaves,
// the ends, the floor and the inside lining. Everything is built once per car
// type and shared by every car of that type.

import * as THREE from 'three';
import { BODY, A_CAR, B_CAR } from './dims.js';
import { profileAt, vAtY, PROFILE_LENGTH } from './profile.js';
import { Builders, RoundedRect, IntervalShape, meshPanel, meshRim, bodyMap } from './geom.js';
import { noseGeometry, noseDepth, rake, chinParts } from './nose.js';
import { lighting } from './materials.js';

export const V = {
  floor: vAtY(BODY.floor),
  blue: vAtY(BODY.blueTop),
  roof: vAtY(BODY.roofLine),
  top: PROFILE_LENGTH,
  leafBottom: vAtY(BODY.leafBottom),
  leafTop: vAtY(BODY.doorTop),
  opening: vAtY(BODY.openingTop),
  win0: vAtY(BODY.window.sill),
  win1: vAtY(BODY.window.head),
  dwin0: vAtY(BODY.doorWindow.sill),
  dwin1: vAtY(BODY.doorWindow.head),
};

const WALL = BODY.wall;
const GASKET = 0.024;

// the lining is the body profile moved in by the wall thickness
export function liningAt(v) { return profileAt(v, -WALL); }

// v on the lining where it is `z` from the centre line, up on the ceiling
export function liningVAtZ(z) {
  let lo = V.opening - 0.6, hi = V.top;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (liningAt(mid).z > z) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// The saloon light strips run along the ceiling here; the interior shading
// uses the same line.
const LIGHT_V = liningVAtZ(0.60);
{
  const p = liningAt(LIGHT_V);
  lighting.lineY.value = p.y - 0.03;
  lighting.lineZ.value = p.z - 0.02;
}

// a flat ring between two shapes, standing `d` off the body
function ring(builder, side, d, outer, inner) {
  meshPanel(builder, bodyMap(side, d, 1), outer, [inner]);
}

// the paint colour for a strip of the side at height v
function skinPicker(B) {
  return (v) => v < V.blue ? B.get('blue') : v < V.roof ? B.get('white') : B.get('roof');
}

// A window in the body side: gasket, reveal, glass.
function addWindow(B, side, rect) {
  const outer = rect.grow(GASKET);
  ring(B.get('rubber'), side, 0.004, outer, rect);
  meshRim(B.get('rubber'), side, outer.outline(), 0, 0.004, 1);
  meshRim(B.get('rubber'), side, rect.outline(), 0.004, -0.024, -1);
  meshRim(B.get('lining'), side, rect.outline(), -0.024, -WALL, -1);
  meshPanel(B.get('glass'), bodyMap(side, -0.02, 1), rect);
}

// A door leaf, on its own builders so that it can slide. `lead` is the
// edge that closes against the other leaf or the door frame.
function addLeaf(B, side, x0, x1, win, dirX, colour) {
  const lead = dirX > 0 ? x0 : x1;
  const big = 0.10, small = 0.02;
  const r = dirX > 0 ? { bl: 0.015, br: 0.015, tl: small, tr: big } : { bl: 0.015, br: 0.015, tl: big, tr: small };
  const leaf = new RoundedRect(x0, x1, V.leafBottom, V.leafTop, r);
  const proud = BODY.leafProud;
  // the rubber seal along the leading edge
  const sealW = 0.024;
  const face = dirX > 0
    ? new RoundedRect(x0 + sealW, x1, V.leafBottom, V.leafTop, { ...r, bl: 0, tl: 0 })
    : new RoundedRect(x0, x1 - sealW, V.leafBottom, V.leafTop, { ...r, br: 0, tr: 0 });
  const seal = dirX > 0
    ? new RoundedRect(x0, x0 + sealW, V.leafBottom, V.leafTop, { bl: 0.01, tl: small, br: 0, tr: 0 })
    : new RoundedRect(x1 - sealW, x1, V.leafBottom, V.leafTop, { br: 0.01, tr: small, bl: 0, tl: 0 });
  const w = new RoundedRect(win[0], win[1], V.dwin0, V.dwin1, BODY.doorWindow.radius);
  const wg = w.grow(0.02);
  meshPanel(B.get(colour), bodyMap(side, proud, 1), face, [wg]);
  meshPanel(B.get('rubber'), bodyMap(side, proud + 0.004, 1), seal);
  meshRim(B.get('rubber'), side, seal.outline(), proud, proud + 0.004, 1);
  ring(B.get('rubber'), side, proud + 0.003, wg, w);
  meshRim(B.get('rubber'), side, wg.outline(), proud, proud + 0.003, 1);
  meshRim(B.get('rubber'), side, w.outline(), proud + 0.003, 0.004, -1);
  meshRim(B.get('rubber'), side, leaf.outline(), 0.004, proud, 1);
  meshPanel(B.get('doorInside'), bodyMap(side, 0.004, -1), leaf, [w]);
  meshPanel(B.get('glass'), bodyMap(side, 0.016, 1), w);
  void lead;
}

// An end of the car at x = end * L / 2: the outside face, the inside face
// and the window in the end door.
function addEnd(B, L, end) {
  const outline = (d, v0) => {
    const pts = [];
    const n = 120;
    for (let i = 0; i <= n; i++) { const p = profileAt(v0 + (V.top - v0) * i / n, d); pts.push(new THREE.Vector2(p.z, p.y)); }
    for (let i = n - 1; i >= 0; i--) { const p = profileAt(v0 + (V.top - v0) * i / n, d); pts.push(new THREE.Vector2(-p.z, p.y)); }
    return pts;
  };
  const win = new RoundedRect(-0.24, 0.24, 1.58, 2.26, 0.06);
  const winPts = win.outline().map(([z, y]) => new THREE.Vector2(z, y));
  const face = (pts, hole, x, nx, key) => {
    const contour = pts.slice();
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    const h = hole.slice();
    if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
    const tris = THREE.ShapeUtils.triangulateShape(contour, [h]);
    const all = [...contour, ...h];
    const b = B.get(key), n = [nx, 0, 0];
    for (const [a, c, d] of tris) {
      const P = (k) => [x, all[k].y, all[k].x];
      b.tri(P(a), P(c), P(d), n, n, n);
    }
  };
  const xo = end * L / 2, xi = end * (L / 2 - WALL);
  face(outline(0, 0), winPts, xo, end, 'endPaint');
  face(outline(-WALL, V.floor), winPts, xi, -end, 'liningGrey');
  // window reveal and glass
  const b = B.get('rubber');
  for (let i = 0; i < winPts.length; i++) {
    const p = winPts[i], q = winPts[(i + 1) % winPts.length];
    const du = q.x - p.x, dv = q.y - p.y, l = Math.hypot(du, dv);
    const n = [0, du / l, -dv / l];
    // point the normal into the window
    const mid = [(p.x + q.x) / 2, (p.y + q.y) / 2];
    if (n[2] * -mid[0] + n[1] * (1.92 - mid[1]) < 0) { n[1] = -n[1]; n[2] = -n[2]; }
    b.quad([xo, p.y, p.x], [xo, q.y, q.x], [xi, q.y, q.x], [xi, p.y, p.x], n, n, n, n);
  }
  const g = B.get('glass');
  const tris = THREE.ShapeUtils.triangulateShape(winPts, []);
  const xg = end * (L / 2 - 0.02);
  for (const [a, c, d] of tris) {
    const P = (k) => [xg, winPts[k].y, winPts[k].x];
    g.tri(P(a), P(c), P(d), [end, 0, 0], [end, 0, 0], [end, 0, 0]);
  }
  // the end door's outline, a rubber frame standing just off the face
  const door = new RoundedRect(-0.34, 0.34, 0.78, 2.44, 0.07);
  const doorIn = door.grow(-0.025);
  const fr = B.get('rubber');
  const endMap = (z, y) => ({ pos: [end * (L / 2 + 0.004), y, z], normal: [end, 0, 0] });
  meshPanel(fr, endMap, door, [doorIn], { step: 0.2 });
}

// The bumper under the cab front, the anticlimber and the coupler.
function buildChin(xFront, materials) {
  const g = new THREE.Group();
  const chin = new THREE.Mesh(chinParts(xFront), materials.red);
  const add = (mat, size, pos) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...pos);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  chin.castShadow = chin.receiveShadow = true;
  g.add(chin);
  // anticlimber: a black block with ribs across it
  add(materials.frame, [0.1, 0.27, 0.86], [xFront + 0.08, 0.615, 0]);
  for (let k = 0; k < 5; k++) add(materials.underframe, [0.04, 0.022, 0.84], [xFront + 0.145, 0.51 + k * 0.05, 0]);
  // coupler head with yellow and black warning plates
  add(materials.underframe, [0.3, 0.16, 0.34], [xFront + 0.1, 0.40, 0]);
  add(materials.frame, [0.08, 0.2, 0.22], [xFront + 0.22, 0.40, 0]);
  for (const s of [1, -1]) {
    add(materials.yellow, [0.02, 0.05, 0.16], [xFront + 0.265, 0.34, s * 0.3]);
    for (let k = 0; k < 3; k++) add(materials.rubber, [0.022, 0.05, 0.022], [xFront + 0.266, 0.34, s * 0.3 - 0.05 + k * 0.05]);
  }
  return g;
}

// Build a car type. Returns a group of static meshes and the door leaves,
// grouped by the side they are on and the way they slide.
export function buildCarType(type, materials) {
  const spec = type === 'A' ? A_CAR : B_CAR;
  const L = spec.length;
  const X = (d) => L / 2 - d;                 // distance from the front end -> x
  const span = (a, b) => [X(b), X(a)];
  const B = new Builders();
  const leafBuilders = new Map();             // `${side}:${dirX}` -> Builders
  const leafB = (side, dirX) => {
    const k = `${side}:${dirX}`;
    if (!leafBuilders.has(k)) leafBuilders.set(k, new Builders());
    return leafBuilders.get(k);
  };

  const cab = type === 'A';
  const doors = [...spec.doors];
  const windows = spec.windows.map(([a, b]) => span(a, b));
  const doorways = doors.map(d => span(...d.doorway));
  const cabDoorway = cab ? span(...spec.cabDoor.doorway) : null;

  const winRect = ([a, b]) => new RoundedRect(a, b, V.win0, V.win1, BODY.window.radius);
  const doorwayRect = ([a, b]) => new RoundedRect(a, b, V.floor, V.opening, { bl: 0, br: 0, tl: 0.06, tr: 0.06 });
  const winHoles = windows.map(w => winRect(w).grow(GASKET));
  const doorHoles = [...doorways, ...(cab ? [cabDoorway] : [])].map(doorwayRect);

  for (const side of [1, -1]) {
    // outside skin
    const redFrom = cab ? X(0.78) : L / 2;
    const skinOuter = new RoundedRect(-L / 2, redFrom, 0, V.top);
    meshPanel(skinPicker(B), bodyMap(side, 0, 1), skinOuter, [...winHoles, ...doorHoles], { extraCuts: [V.blue, V.roof] });
    if (cab) {
      const seam = (v) => L / 2 - noseDepth(v) + rake(profileAt(v).y);
      const red = new IntervalShape(0, V.top, (v) => [redFrom, seam(v)]);
      meshPanel(B.get('red'), bodyMap(side, 0, 1), red, [], { step: 0.02 });
    }
    // inside lining
    const saloonEnd = cab ? X(spec.cabBack) : L / 2 - WALL;
    const liningHoles = [...windows.map(winRect), ...doorHoles];
    meshPanel(B.get('lining'), bodyMap(side, -WALL, -1), new RoundedRect(-L / 2 + WALL, saloonEnd, V.floor, V.top), liningHoles);
    // the cab is lined in dark grey, so the windscreens don't reflect it
    if (cab) meshPanel(B.get('cabLining'), bodyMap(side, -WALL, -1), new RoundedRect(saloonEnd, L / 2 - 0.56, V.floor, V.top), liningHoles);
    // windows
    for (const w of windows) addWindow(B, side, winRect(w));
    // doorway reveals
    for (const hole of doorHoles) meshRim(B.get('frame'), side, hole.outline(), 0, -WALL, -1);
    // door leaves
    for (const door of doors) {
      for (const leaf of door.leaves) {
        const [x0, x1] = span(...leaf.span);
        addLeaf(leafB(side, -leaf.opens), side, x0, x1, span(...leaf.window), -leaf.opens, 'red');
      }
    }
    if (cab) {
      const leaf = spec.cabDoor.leaves[0];
      const [x0, x1] = span(...leaf.span);
      addLeaf(B, side, x0, x1, span(...leaf.window), -leaf.opens, 'white');
    }
    // light strips along the ceiling
    const lightEnd = cab ? X(spec.cabBack) - 0.25 : L / 2 - 0.45;
    meshPanel(B.get('lamp'), bodyMap(side, -WALL - 0.006, -1), new RoundedRect(-L / 2 + 0.45, lightEnd, LIGHT_V - 0.065, LIGHT_V + 0.065, 0.02));
  }

  // ends
  addEnd(B, L, -1);
  if (!cab) addEnd(B, L, 1);

  // floor, thresholds and underside
  const floorZ = liningAt(V.floor).z;
  const floorEnd = cab ? L / 2 - 0.35 : L / 2 - WALL;
  {
    const f = B.get('floor'), y = BODY.floor, up = [0, 1, 0], s = 1 / 1.2;
    const x0 = -L / 2 + WALL, x1 = cab ? X(spec.cabBack) : floorEnd;
    f.quad([x0, y, -floorZ], [x1, y, -floorZ], [x1, y, floorZ], [x0, y, floorZ], up, up, up, up,
      [x0 * s, -floorZ * s], [x1 * s, -floorZ * s], [x1 * s, floorZ * s], [x0 * s, floorZ * s]);
    if (cab) B.get('cabFloor').quad([x1, y, -floorZ], [floorEnd, y, -floorZ], [floorEnd, y, floorZ], [x1, y, floorZ], up, up, up, up);
    const t = B.get('steel'), skinZ = profileAt(V.floor).z;
    for (const [a, b] of [...doorways, ...(cab ? [cabDoorway] : [])]) {
      for (const side of [1, -1]) {
        t.quad([a, y, side * floorZ], [b, y, side * floorZ], [b, y, side * skinZ], [a, y, side * skinZ], up, up, up, up);
      }
    }
    const u = B.get('underframe'), down = [0, -1, 0], zb = profileAt(0).z, yb = BODY.bottom;
    u.quad([-L / 2, yb, -zb], [L / 2 - (cab ? 0.3 : 0), yb, -zb], [L / 2 - (cab ? 0.3 : 0), yb, zb], [-L / 2, yb, zb], down, down, down, down);
  }

  const group = B.toGroup(materials, `car-${type}`);
  // the destination display above the middle window on each side
  {
    const [a, b] = span(...spec.windows[1]);
    const y = 2.27, p = profileAt(vAtY(y), 0.004);
    for (const side of [1, -1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.085), materials.sideDisplay);
      d.position.set((a + b) / 2, p.y, side * p.z);
      d.rotation.set(-Math.asin(p.ny) * 1, side < 0 ? Math.PI : 0, 0, 'YXZ');
      group.add(d);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.13), materials.rubber);
      frame.position.copy(d.position).addScaledVector(new THREE.Vector3(0, p.ny, side * p.nz), -0.001);
      frame.rotation.copy(d.rotation);
      group.add(frame);
    }
  }
  if (cab) {
    const nose = new THREE.Mesh(noseGeometry(L / 2), materials.nose);
    nose.name = 'nose';
    nose.castShadow = nose.receiveShadow = true;
    const glass = new THREE.Mesh(nose.geometry, materials.noseGlass);
    glass.name = 'nose-glass';
    const inside = new THREE.Mesh(nose.geometry, materials.noseInside);
    inside.name = 'nose-inside';
    group.add(nose, glass, inside);
    group.add(buildChin(L / 2, materials));
  }
  const leaves = [];
  for (const [k, lb] of leafBuilders) {
    const [side, dirX] = k.split(':').map(Number);
    const g = lb.toGroup(materials, `leaves ${k}`);
    group.add(g);
    leaves.push({ group: g, side, dirX });
  }
  return { group, leaves, spec, length: L };
}
