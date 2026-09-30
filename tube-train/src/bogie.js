// Under the car: two bogies, the equipment cases hung between them, and the
// couplers. Each car type's underframe is built once and cloned.
//
// The bogies have outside frames: the axleboxes and the frame are outside the
// wheels, with rubber primary springs over the axleboxes and air springs
// carrying the body. Cars with shoegear (the driving cars and the D cars) have
// a shoe beam each side for the positive rail and a shoe in the middle for the
// negative one.

import * as THREE from 'three';
import { BOGIE, BODY, TRACK } from './dims.js';
import { MeshBuilder, matrixFrom } from './geom.js';
import { rng } from './textures.js';

const R = BOGIE.wheelRadius;
const HALF_WB = BOGIE.wheelbase / 2;
const GAUGE_HALF = TRACK.gauge / 2;

// one wheel as a lathe profile, the flange on the inside (towards z = 0)
function wheelGeometry() {
  // (radius, z) pairs from the hub to the tread, for a wheel at +z; z is
  // measured outwards from the back of the flange
  const pts = [
    [0.075, 0.03], [0.11, 0.0], [0.17, 0.02], [0.30, 0.02], [0.335, 0.0], [R + 0.03, 0.0],
    [R + 0.032, 0.012], [R + 0.012, 0.03], [R, 0.04], [R - 0.004, 0.135], [R - 0.03, 0.14],
    [0.31, 0.12], [0.20, 0.12], [0.12, 0.16], [0.075, 0.16],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const g = new THREE.LatheGeometry(pts, 48);
  // lathe turns around y; we want the axle along z
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

// A bogie frame side: a plate beam, dipped in the middle, as a shape in (x, y)
function sideFrameShape() {
  const s = new THREE.Shape();
  const top = 0.60, bot = 0.44, dipTop = 0.48, dipBot = 0.30;
  s.moveTo(-1.35, bot + 0.02);
  s.lineTo(-1.35, top - 0.03);
  s.lineTo(-1.30, top);
  s.lineTo(-0.72, top);
  s.bezierCurveTo(-0.55, top, -0.52, dipTop, -0.40, dipTop);
  s.lineTo(0.40, dipTop);
  s.bezierCurveTo(0.52, dipTop, 0.55, top, 0.72, top);
  s.lineTo(1.30, top);
  s.lineTo(1.35, top - 0.03);
  s.lineTo(1.35, bot + 0.02);
  s.lineTo(1.25, bot);
  s.lineTo(0.78, bot);
  s.bezierCurveTo(0.60, bot, 0.58, dipBot, 0.42, dipBot);
  s.lineTo(-0.42, dipBot);
  s.bezierCurveTo(-0.58, dipBot, -0.60, bot, -0.78, bot);
  s.lineTo(-1.25, bot);
  s.closePath();
  return s;
}

function extrudeZ(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function box(b, w, h, d, pos, rot) {
  b.addGeometry(new THREE.BoxGeometry(w, h, d), matrixFrom(pos, rot));
}
function cyl(b, r, len, pos, rot, seg = 16, r2 = r) {
  b.addGeometry(new THREE.CylinderGeometry(r, r2, len, seg), matrixFrom(pos, rot));
}

// A wheelset: two wheels on an axle, with a gearbox if motored. It turns
// about its own z axis.
function wheelsetGroup(materials, motored) {
  const steel = new MeshBuilder(), dark = new MeshBuilder();
  const wheel = wheelGeometry();
  const back = GAUGE_HALF - 0.04;       // back of the flange
  for (const s of [1, -1]) {
    const m = matrixFrom([0, 0, s * back], [0, s > 0 ? 0 : Math.PI, 0]);
    steel.addGeometry(wheel, m);
    // bolts round the hub, so the wheels are seen to turn
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      cyl(dark, 0.014, 0.03, [Math.cos(a) * 0.14, Math.sin(a) * 0.14, s * (back + 0.13)], [Math.PI / 2, 0, 0], 8);
    }
  }
  cyl(steel, 0.072, 2.0, [0, 0, 0], [Math.PI / 2, 0, 0], 20);
  if (motored) {
    cyl(dark, 0.21, 0.16, [0, 0, 0.36], [Math.PI / 2, 0, 0], 24);
  }
  const g = new THREE.Group();
  for (const [b, mat] of [[steel, materials.wheel], [dark, materials.bogie]]) {
    const mesh = new THREE.Mesh(b.geometry(), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  g.position.y = R;
  g.userData.wheelset = true;
  g.userData.radius = R;
  return g;
}

// One bogie, centred at x = 0.
function bogieGroup(materials, { motored, shoes }) {
  const frame = new MeshBuilder(), dark = new MeshBuilder(), rubber = new MeshBuilder(), steel = new MeshBuilder(), yellow = new MeshBuilder(), wood = new MeshBuilder();
  const side = extrudeZ(sideFrameShape(), 0.13);
  const fz = 1.0;                       // frame sides
  for (const s of [1, -1]) {
    frame.addGeometry(side, matrixFrom([0, 0, s * fz]));
    for (const a of [-HALF_WB, HALF_WB]) {
      // axlebox and primary spring
      box(dark, 0.26, 0.2, 0.16, [a, R + 0.02, s * fz]);
      cyl(dark, 0.09, 0.08, [a, R, s * (fz + 0.1)], [Math.PI / 2, 0, 0], 20);
      box(rubber, 0.18, 0.1, 0.12, [a, R + 0.17, s * fz]);
      // brake unit working on the tread
      box(dark, 0.18, 0.2, 0.16, [a + Math.sign(a) * (R + 0.1), R + 0.03, s * (GAUGE_HALF + 0.05)]);
      box(frame, 0.1, 0.08, 0.3, [a + Math.sign(a) * (R + 0.12), R + 0.14, s * (GAUGE_HALF + 0.2)]);
    }
    // air spring and its seat
    cyl(rubber, 0.2, 0.16, [0, 0.58, s * 0.98], [0, 0, 0], 28, 0.22);
    cyl(dark, 0.24, 0.03, [0, 0.49, s * 0.98], [0, 0, 0], 28);
    // damper
    cyl(steel, 0.03, 0.34, [0.3, 0.55, s * 1.16], [0, 0, 0.35], 10);
  }
  // transoms
  for (const tx of [-0.3, 0.3]) box(frame, 0.2, 0.18, 2.0, [tx, 0.40, 0]);
  if (motored) {
    // traction motors hung inboard of each axle
    for (const a of [-1, 1]) {
      cyl(dark, 0.2, 0.62, [a * 0.55, R + 0.02, -0.12], [Math.PI / 2, 0, 0], 24);
      cyl(frame, 0.18, 0.64, [a * 0.55, R + 0.02, -0.12], [Math.PI / 2, 0, 0], 24);
    }
  }
  if (shoes) {
    for (const s of [1, -1]) {
      // shoe beam from axlebox to axlebox, and the shoe on the positive rail
      box(wood, 2.5, 0.09, 0.07, [0, R + 0.02, s * 1.14]);
      box(dark, 0.3, 0.05, 0.1, [0, TRACK.positiveTop + 0.025, s * -TRACK.positiveZ]);
      box(dark, 0.06, 0.26, 0.05, [0.08, 0.2, s * -TRACK.positiveZ]);
      box(yellow, 0.2, 0.03, 0.02, [0, R - 0.04, s * 1.18]);
    }
    // the negative shoe, in the middle
    box(wood, 0.12, 0.07, 1.9, [0.9, R - 0.05, 0]);
    box(dark, 0.3, 0.05, 0.12, [0.9, TRACK.negativeTop + 0.025, 0]);
    box(dark, 0.06, 0.26, 0.05, [0.9, 0.18, 0]);
  }
  const g = new THREE.Group();
  for (const [b, mat] of [[frame, materials.bogie], [dark, materials.underframe], [rubber, materials.rubber], [steel, materials.steel], [yellow, materials.yellow], [wood, materials.shoeBeam]]) {
    if (b.empty) continue;
    const mesh = new THREE.Mesh(b.geometry(), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  for (const a of [-HALF_WB, HALF_WB]) {
    const ws = wheelsetGroup(materials, motored);
    ws.position.x = a;
    g.add(ws);
  }
  return g;
}

// Everything under one car type.
export function buildUnderframe(type, spec, materials) {
  const L = spec.length;
  const group = new THREE.Group();
  group.name = 'underframe';
  const motored = type !== 'B';                 // the trailers have no motors
  const bogieXs = spec.bogies.map(d => L / 2 - d);
  for (const x of bogieXs) {
    const b = bogieGroup(materials, { motored, shoes: spec.shoes });
    b.position.x = x;
    group.add(b);
  }
  // equipment cases between the bogies
  const cases = new MeshBuilder(), grille = new MeshBuilder(), pipes = new MeshBuilder();
  const r = rng(type === 'A' ? 21 : 34);
  const x0 = Math.min(...bogieXs) + 1.7, x1 = Math.max(...bogieXs) - 1.7;
  let x = x0;
  while (x < x1 - 0.4) {
    const len = Math.min(0.6 + r() * 1.8, x1 - x);
    const depth = 0.22 + r() * 0.2;
    const width = 0.8 + r() * 0.9;
    const offset = (r() - 0.5) * 0.6;
    const b = r() < 0.3 ? grille : cases;
    box(b, len - 0.08, depth, width, [x + len / 2, BODY.bottom - depth / 2, offset]);
    if (r() < 0.5) box(cases, len * 0.7, depth * 0.8, 0.5, [x + len / 2, BODY.bottom - depth * 0.4, -offset * 0.5 + (r() - 0.5)]);
    x += len + 0.05 + r() * 0.35;
  }
  // pipes and cable runs along the underside
  for (const z of [-1.05, -0.95, 1.0]) cyl(pipes, 0.022, x1 - x0 + 2.4, [(x0 + x1) / 2, BODY.bottom - 0.05, z], [0, 0, Math.PI / 2], 8);
  // body bolsters over the bogies
  for (const bx of bogieXs) box(cases, 0.5, 0.06, 2.3, [bx, BODY.bottom - 0.03, 0]);
  // couplers and the rubber barriers between cars
  const ends = type === 'A' ? [-1] : [-1, 1];
  for (const e of ends) {
    box(cases, 0.34, 0.12, 0.16, [e * (L / 2 - 0.05), 0.52, 0]);
    box(grille, 0.08, 0.2, 0.26, [e * (L / 2 + 0.09), 0.52, 0]);
    for (const s of [1, -1]) box(pipes, 0.1, 1.2, 0.03, [e * (L / 2 + 0.05), 1.25, s * 1.02]);
  }
  for (const [b, mat] of [[cases, materials.underframe], [grille, materials.frame], [pipes, materials.rubber]]) {
    const mesh = new THREE.Mesh(b.geometry(), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group };
}
