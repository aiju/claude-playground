// Track: two running rails on sleepers, and London's fourth-rail
// electrification: a positive conductor rail outside the running rails and a
// negative one between them, both on white insulators.

import * as THREE from 'three';
import { TRACK } from './dims.js';
import { rng } from './textures.js';

// a rail's cross-section in (z, y), foot to head, centred on z = 0, its
// top at y = 0
const H = TRACK.railHeight;
export const RAIL_PROFILE = [
  [-0.066, -H], [0.066, -H], [0.066, -H + 0.012], [0.012, -H + 0.03], [0.009, -0.045],
  [0.034, -0.035], [0.035, -0.004], [0.031, 0], [-0.031, 0], [-0.035, -0.004], [-0.034, -0.035],
  [-0.009, -0.045], [-0.012, -H + 0.03], [-0.066, -H + 0.012],
];
// a conductor rail's, a flat-topped steel bar
export const BAR_PROFILE = [[-0.037, -0.065], [0.037, -0.065], [0.037, -0.006], [0.031, 0], [-0.031, 0], [-0.037, -0.006]];

function shapeOf(pts) {
  const s = new THREE.Shape();
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  return s;
}
const railShape = () => shapeOf(RAIL_PROFILE);

// a straight extrusion of a shape in (z, y) along x from x0 to x1
function extrudeX(shape, x0, x1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, steps: 1, curveSegments: 4 });
  // the shape's (x, y) is our (-z, y) and its extrusion runs along +z; a
  // rotation, so the faces stay the right way out (the shapes are symmetric)
  g.applyMatrix4(new THREE.Matrix4().set(
    0, 0, 1, x0,
    0, 1, 0, 0,
    -1, 0, 0, 0,
    0, 0, 0, 1));
  g.computeVertexNormals();
  return g;
}

export function trackMaterials() {
  return {
    rail: new THREE.MeshStandardMaterial({ color: 0x5a4a3e, roughness: 0.75, metalness: 0.5 }),
    railTop: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.22, metalness: 1.0 }),
    conductor: new THREE.MeshStandardMaterial({ color: 0x77787a, roughness: 0.45, metalness: 0.85 }),
    insulator: new THREE.MeshStandardMaterial({ color: 0xf0eee6, roughness: 0.25, metalness: 0 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9c9a94, roughness: 0.9 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x3b3029, roughness: 0.95 }),
  };
}

// Track from x0 to x1. Sleepers are `sleeper` ('concrete' or 'timber'),
// every `pitch` metres, and the conductor rails' insulators every
// `insulatorPitch` (depot roads inside the shed have no conductor rails).
export function buildTrack(x0, x1, mats, { sleeper = 'concrete', pitch = 0.7, insulatorPitch = 3.0, seed = 1, conductors = true } = {}) {
  const group = new THREE.Group();
  group.name = 'track';
  const half = TRACK.gauge / 2 + TRACK.railHead / 2;
  const railGeo = extrudeX(railShape(), x0, x1);
  const topGeo = new THREE.PlaneGeometry(x1 - x0, 0.058).rotateX(-Math.PI / 2);
  for (const s of [1, -1]) {
    const rail = new THREE.Mesh(railGeo, mats.rail);
    rail.position.z = s * half;
    const top = new THREE.Mesh(topGeo, mats.railTop);
    top.position.set((x0 + x1) / 2, 0.0005, s * half);
    rail.castShadow = rail.receiveShadow = true;
    top.receiveShadow = true;
    group.add(rail, top);
  }
  // conductor rails: a steel bar on insulators
  const barGeo = extrudeX(shapeOf(BAR_PROFILE), x0, x1);
  const insGeo = new THREE.CylinderGeometry(0.045, 0.06, 1, 16);
  const nIns = Math.floor((x1 - x0) / insulatorPitch);
  for (const [z, top] of conductors ? [[TRACK.positiveZ, TRACK.positiveTop], [0, TRACK.negativeTop]] : []) {
    const b = new THREE.Mesh(barGeo, mats.conductor);
    b.position.set(0, top, z);
    b.castShadow = b.receiveShadow = true;
    group.add(b);
    const h = top - 0.065 + 0.17;
    const ins = new THREE.InstancedMesh(insGeo, mats.insulator, nIns);
    const m = new THREE.Matrix4();
    for (let i = 0; i < nIns; i++) {
      m.compose(new THREE.Vector3(x0 + insulatorPitch / 2 + i * insulatorPitch, top - 0.065 - h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
      ins.setMatrixAt(i, m);
    }
    ins.castShadow = ins.receiveShadow = true;
    group.add(ins);
  }
  // sleepers
  const n = Math.floor((x1 - x0) / pitch);
  const timber = sleeper === 'timber';
  const sGeo = timber ? new THREE.BoxGeometry(0.25, 0.14, 2.45) : new THREE.BoxGeometry(0.24, 0.18, 2.5);
  const sl = new THREE.InstancedMesh(sGeo, timber ? mats.timber : mats.concrete, n);
  const r = rng(seed);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (r() - 0.5) * 0.02);
    m.compose(new THREE.Vector3(x0 + (i + 0.5) * pitch, -TRACK.railHeight - (timber ? 0.07 : 0.09), (r() - 0.5) * 0.03), q, new THREE.Vector3(1, 1, 1));
    sl.setMatrixAt(i, m);
  }
  sl.castShadow = sl.receiveShadow = true;
  group.add(sl);
  return group;
}
