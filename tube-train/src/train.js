// The whole train: eight cars in two units, coupled back to back.
//
// Laid out straight, the leading car's front is at x = 0 and the train runs
// back along -x ("train-local" x). The second unit's cars are turned round,
// so its driving car faces the other way. On a curved path each car is set
// on its two bogies, so it runs as a chord of the curve with its ends
// swinging out, and the bogies turn under it to follow the rails.

import * as THREE from 'three';
import { FORMATION, BODY, BOGIE } from './dims.js';
import { buildCarType } from './car.js';
import { buildInterior } from './interior.js';
import { buildUnderframe } from './bogie.js';
import { labelTexture } from './textures.js';
import { addLightTerms, stationTerm } from './materials.js';
import { profileAt, vAtY } from './profile.js';
import { Frame } from './path.js';

export const CAR_GAP = 0.24;       // between the bodies of coupled cars

// The car's number on each side, low down under a window near one end.
function addNumbers(car, type, number, t) {
  const tex = labelTexture(number, { w: 256, h: 64, font: '600 44px "Helvetica Neue", Arial, sans-serif', colour: '#1c2a5a' });
  const mat = addLightTerms(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }), [stationTerm()]);
  const L = type.length, spec = type.spec;
  const w = spec.windows[t === 'A' ? 2 : 0];
  const x = L / 2 - (w[0] + w[1]) / 2;
  const z = profileAt(vAtY(1.36)).z + 0.002;
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), mat);
    m.position.set(x, 1.36, s * z);
    if (s < 0) m.rotation.y = Math.PI;
    car.add(m);
  }
}

// The two kinds of car (driving and not), built once for every train.
export function buildCarTypes(materials) {
  const types = {};
  for (const t of ['A', 'B']) {
    const type = buildCarType(t, materials);
    type.group.add(buildInterior(t, type.spec, materials));
    type.underframe = buildUnderframe(t, type.spec, materials);
    types[t] = type;
  }
  return types;
}

// A train. `units` are the numbers of its two units (the cars are numbered
// 11xxx to 14xxx after them); `sideDisplay` is the material of the
// destination displays on its sides; `headlights` gives it real lights.
export function buildTrain(materials, { types = buildCarTypes(materials), units = [47, 48], sideDisplay = null, headlights: withLights = true } = {}) {
  const group = new THREE.Group();
  group.name = 'train';
  const cars = [];
  const wheels = [];
  let x = 0;
  FORMATION.forEach((t, i) => {
    const type = types[t === 'A' ? 'A' : 'B'];
    const L = type.length;
    const car = type.group.clone();
    car.name = `car ${i + 1} (${t})`;
    const turned = i >= FORMATION.length / 2;

    const under = type.underframe.group.clone();
    car.add(under);
    group.add(car);
    const leaves = type.leaves.map(l => ({ group: car.getObjectByName(l.group.name), side: l.side, dirX: l.dirX }));
    under.traverse(o => { if (o.userData.wheelset) wheels.push({ mesh: o, sign: turned ? -1 : 1 }); });
    const sign = turned ? -1 : 1;
    const bogies = [];
    car.traverse(o => { if (o.name === 'bogie') bogies.push({ group: o, x: x - L / 2 + sign * o.position.x }); });
    bogies.sort((a, b) => b.x - a.x);
    car.matrixAutoUpdate = false;
    cars.push({ group: car, type: t, turned, length: L, leaves, centre: x - L / 2, spec: type.spec, bogies });
    // car numbers: 11xxx for A cars, 12xxx for B and so on, the unit's
    // number after
    const number = `${{ A: 11, B: 12, C: 13, D: 14 }[t]}0${turned ? units[1] : units[0]}`;
    addNumbers(car, type, number, t);
    if (t === 'A') car.getObjectByName('nose').material = materials.noseFor(number);
    if (sideDisplay) car.traverse(o => { if (o.name === 'sideDisplay') o.material = sideDisplay; });
    // headlights on the leading cab, tail lights on the trailing one
    if (t === 'A') {
      car.traverse(o => {
        if (o.name === 'headlamp') o.material = turned ? materials.lampOff : materials.headLit;
        if (o.name === 'taillamp') o.material = turned ? materials.tailLit : materials.lampOff;
        if (o.name === 'headglow') o.visible = !turned;
        if (o.name === 'tailglow') o.visible = turned;
      });
    }
    x -= L + CAR_GAP;
  });
  const length = -x - CAR_GAP;

  // where every wheel is along the train, for the sound of the rail joints
  const wheelXs = [];
  for (const car of cars) {
    for (const d of car.spec.bogies) {
      const bx = car.centre + (car.turned ? -1 : 1) * (car.length / 2 - d);
      wheelXs.push(bx - BOGIE.wheelbase / 2, bx + BOGIE.wheelbase / 2);
    }
  }

  // doors: open fraction on the train's right (+z) and left (-z) sides
  function setDoors(right, left) {
    for (const car of cars) {
      for (const l of car.leaves) {
        const worldSide = l.side * (car.turned ? -1 : 1);
        const f = worldSide > 0 ? right : left;
        const e = f * f * (3 - 2 * f);
        l.group.position.x = l.dirX * BODY.doorTravel * e;
      }
    }
  }

  // turn the wheels for a distance travelled
  function roll(distance) {
    for (const w of wheels) w.mesh.rotation.z = -w.sign * distance / w.mesh.userData.radius;
  }

  // headlights, on the leading car
  const headlights = [];
  if (withLights) {
    const lead = cars[0], L = lead.length;
    for (const s of [1, -1]) {
      const spot = new THREE.SpotLight(0xf2f6ff, 40, 0, 0.36, 0.85, 1.35);
      spot.position.set(L / 2 + 0.15, 1.54, s * 0.87);
      spot.target.position.set(L / 2 + 60, 1.0, s * 0.1);
      spot.visible = false;
      lead.group.add(spot, spot.target);
      headlights.push(spot);
    }
  }

  // Puts the train on `path` with its front at distance sFront along it.
  const fa = new Frame(), fb = new Frame(), fq = new Frame();
  const F = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3(), O = new THREE.Vector3();
  const lx = new THREE.Vector3(), lz = new THREE.Vector3(), cross = new THREE.Vector3();
  function place(path, sFront) {
    for (const car of cars) {
      const [a, b] = car.bogies;
      path.frame(sFront + a.x, fa);
      path.frame(sFront + b.x, fb);
      F.subVectors(fa.pos, fb.pos).normalize();
      U.addVectors(fa.u, fb.u);
      U.addScaledVector(F, -U.dot(F)).normalize();
      R.crossVectors(F, U);
      // the car's middle sits between its bogies' points on the rails
      O.addVectors(fa.pos, fb.pos).multiplyScalar(0.5).addScaledVector(F, car.centre - (a.x + b.x) / 2);
      const s = car.turned ? -1 : 1;
      lx.copy(F).multiplyScalar(s);
      lz.copy(R).multiplyScalar(s);
      car.group.matrix.makeBasis(lx, U, lz).setPosition(O);
      car.group.matrixWorldNeedsUpdate = true;
      // each bogie turns to lie along the rails under it
      for (const bg of car.bogies) {
        path.frame(sFront + bg.x, fq);
        cross.crossVectors(F, fq.t);
        bg.group.rotation.y = Math.atan2(cross.dot(U), F.dot(fq.t));
      }
    }
  }

  // the car a train-local x falls in, and that point in the car's own
  // coordinates
  function carAt(x) {
    let best = cars[0];
    for (const car of cars) if (Math.abs(x - car.centre) < Math.abs(x - best.centre)) best = car;
    return best;
  }
  function toCar(car, p) {
    const s = car.turned ? -1 : 1;
    return new THREE.Vector3(s * (p.x - car.centre), p.y, s * p.z);
  }

  const numbers = [`110${units[0]}`, `110${units[1]}`];
  return { group, cars, length, wheelXs, setDoors, roll, place, carAt, toCar, headlights, materials, types, numbers };
}
