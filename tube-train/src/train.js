// The whole train: eight cars in two units, coupled back to back.
//
// The leading car's front is at x = 0 and the train runs back along -x. The
// second unit's cars are turned round, so its driving car faces the other way.

import * as THREE from 'three';
import { FORMATION, BODY, BOGIE } from './dims.js';
import { buildCarType } from './car.js';
import { buildInterior } from './interior.js';
import { buildUnderframe } from './bogie.js';
import { labelTexture } from './textures.js';
import { addLightTerms, stationTerm } from './materials.js';
import { profileAt, vAtY } from './profile.js';

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

export function buildTrain(materials) {
  const types = {};
  for (const t of ['A', 'B']) {
    const type = buildCarType(t, materials);
    type.group.add(buildInterior(t, type.spec, materials));
    type.underframe = buildUnderframe(t, type.spec, materials);
    types[t] = type;
  }
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
    car.position.x = x - L / 2;
    if (turned) car.rotation.y = Math.PI;
    const under = type.underframe.group.clone();
    car.add(under);
    group.add(car);
    const leaves = type.leaves.map(l => ({ group: car.getObjectByName(l.group.name), side: l.side, dirX: l.dirX }));
    under.traverse(o => { if (o.userData.wheelset) wheels.push({ mesh: o, sign: turned ? -1 : 1 }); });
    cars.push({ group: car, type: t, turned, length: L, leaves, centre: x - L / 2, spec: type.spec });
    // car numbers: 11xxx for A cars, 12xxx for B and so on, the unit's
    // number after
    const number = `${{ A: 11, B: 12, C: 13, D: 14 }[t]}0${turned ? 48 : 47}`;
    addNumbers(car, type, number, t);
    if (t === 'A' && turned) car.getObjectByName('nose').material = materials.noseFor(number);
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

  return { group, cars, length, wheelXs, setDoors, roll, materials };
}
