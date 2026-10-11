// Passengers: little people waiting on the platform, riding in the cars,
// getting off and walking out through the passages, and getting on and
// finding a seat or a rail to hold.
//
// Each person is a few rounded parts (thighs, shins, upper arms, forearms, a
// torso, a head and hands, hair, sometimes a backpack or a phone), posed from
// a handful of angles every frame. Every kind of part is one instanced mesh
// for the whole crowd, coloured per person, so a couple of hundred people
// cost ten draw calls.
//
// A person lives in a "space": the station (its own coordinates, see
// station.js) or one of the cars of either train (the car's own
// coordinates), and moves with it. On the platforms, people keep to the one
// they are on (0, ours, or 1, the other track's); where they go there is
// worked out in that platform's half-local coordinates, the same for both. They walk along a list of waypoints, each in a space of its own; when
// they step from the platform into a car, or out of it, their position is
// carried over from one space to the other.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addLightTerms, stationTerm, lighting } from './materials.js';
import { STATION, EXITS, ARCH, CORRIDOR, MID, BENCHES, toStation } from './station.js';
import { seatLayout } from './interior.js';
import { rng } from './textures.js';

const MAX = 440;                       // people at once
const PLATFORM_Y = STATION.platform;
const WALL_Z = STATION.cz + Math.sqrt(STATION.radius ** 2 - (STATION.platform - STATION.cy) ** 2);
const LEN = STATION.length;

// body sizes for someone 1.72 m tall, before their own scale
const B = {
  hip: 0.93, hipX: 0.095, thigh: 0.45, shin: 0.44,
  torso: 0.6, shoulderY: 0.53, shoulderX: 0.215, neck: 0.6, head: 0.105,
  upper: 0.3, fore: 0.27,
};

const SKIN = ['#f3d2b8', '#e8b994', '#d29b74', '#b47a54', '#8d5a3b', '#6a4129', '#4a2c1c'];
const HAIR = ['#1d1612', '#2e2018', '#4a3020', '#6b4a2c', '#a0703f', '#c9a066', '#8a8a86', '#d8d4cc', '#7a2c1c'];
const COAT = ['#20263a', '#1c1c1f', '#3b3f45', '#a6824e', '#5a6142', '#6e2433', '#c49a2c', '#245e63', '#7d8288', '#d8cfbd',
  '#b8352e', '#3c5f8c', '#8a5a7d', '#e3dfd6', '#30473a'];
const TROUSERS = ['#1b1c22', '#27324a', '#3b3d42', '#5a6070', '#8b7d66', '#4a3a2c', '#2f4058'];
const BAGS = ['#1f2023', '#33415c', '#7a3b2e', '#556b4f', '#c4a76a', '#8f2f4a'];
const BEANIES = ['#d1452f', '#e0b23a', '#3a7bd5', '#2f9c6a', '#e5e1d8'];

// ---- the parts, each with its pivot at the origin and hanging down -y ----

const flat = (g) => (g.index ? g.toNonIndexed() : g);

// a tapered rounded limb from y = 0 down to y = -len
function limb(len, r0, r1) {
  const g = new THREE.CylinderGeometry(r0, r1, len, 6, 1, true);
  g.translate(0, -len / 2, 0);
  const cap0 = new THREE.SphereGeometry(r0, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap1 = new THREE.SphereGeometry(r1, 6, 2, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); cap1.translate(0, -len, 0);
  return mergeGeometries([g, cap0, cap1].map(flat));
}

// paint a geometry one colour, for the parts with more than one
function tint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[3 * i] = c.r; a[3 * i + 1] = c.g; a[3 * i + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

function partGeometries() {
  const shin = tint(limb(B.shin - 0.05, 0.056, 0.046), '#ffffff');
  const shoe = tint(flat(new RoundedBoxGeometry(0.1, 0.07, 0.25, 1, 0.03)).translate(0, -B.shin + 0.02, 0.045), '#2a2420');
  const torso = new RoundedBoxGeometry(0.36, B.torso, 0.22, 1, 0.08);
  torso.translate(0, B.torso / 2, 0);
  const capShort = flat(new THREE.SphereGeometry(B.head + 0.012, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.52));
  capShort.rotateX(-0.25).translate(0, 0.01, -0.012);
  const back = flat(new RoundedBoxGeometry(0.21, 0.27, 0.07, 1, 0.03)).translate(0, -0.06, -0.075);
  const capLong = mergeGeometries([capShort.clone(), back]);
  const bag = new RoundedBoxGeometry(0.28, 0.34, 0.13, 1, 0.04);
  bag.translate(0, 0.32, -0.18);
  const phone = new THREE.BoxGeometry(0.07, 0.13, 0.012);
  return {
    thigh: limb(B.thigh, 0.075, 0.06),
    shin: mergeGeometries([shin, shoe]),
    upper: limb(B.upper, 0.052, 0.046),
    fore: limb(B.fore, 0.045, 0.04),
    torso,
    skin: new THREE.SphereGeometry(1, 10, 7),
    hairShort: capShort,
    hairLong: capLong,
    bag,
    phone,
  };
}

// light for people in a lit car: they get the saloon's light, as the seats do
function glowTerm() {
  return {
    key: 'person-glow',
    uniforms: { uSaloon: lighting.saloon },
    vdecl: 'attribute float instGlow;\nvarying float vGlow;',
    vbody: 'vGlow = instGlow;',
    decl: 'varying float vGlow;\nuniform float uSaloon;',
    body: 'extraIrr += vec3(1.0, 0.97, 0.92) * vGlow * uSaloon * 1.1;',
  };
}

// ---- poses ----

// Matrices that can be moved along and turned about x in their own frame
// (the same as multiplying by a translation or a rotation, with a fraction
// of the arithmetic, which matters for a few hundred people a frame).
function moveBy(x, y, z) {
  const e = this.elements;
  for (let i = 0; i < 4; i++) e[12 + i] += e[i] * x + e[4 + i] * y + e[8 + i] * z;
  return this;
}
function turnX(a) {
  const e = this.elements, c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < 4; i++) {
    const y = e[4 + i], z = e[8 + i];
    e[4 + i] = y * c + z * s;
    e[8 + i] = z * c - y * s;
  }
  return this;
}
const M = () => Object.assign(new THREE.Matrix4(), { moveBy, turnX });
const tmp = { a: M(), b: M(), c: M(), d: M(), root: M(), hip: M(), torso: M(), neck: M(), sh: M() };
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function createPeople({ trains, station }) {
  const group = new THREE.Group();
  group.name = 'people';
  const geos = partGeometries();
  const counts = { thigh: 2, shin: 2, upper: 2, fore: 2, torso: 1, skin: 3, hairShort: 1, hairLong: 1, bag: 1, phone: 1 };
  const parts = Object.entries(counts);
  const meshes = {}, glow = {};
  for (const [k, n] of Object.entries(counts)) {
    const mat = new THREE.MeshStandardMaterial({ roughness: k === 'skin' ? 0.6 : 0.85, vertexColors: k === 'shin', color: 0xffffff });
    if (k === 'phone') { mat.color.set(0x15171a); mat.emissive.set(0x9fc4ff); mat.emissiveIntensity = 0.25; mat.roughness = 0.3; }
    addLightTerms(mat, [stationTerm(), glowTerm()]);
    const geo = geos[k];
    const mesh = new THREE.InstancedMesh(geo, mat, MAX * n);
    const g = new Float32Array(MAX * n);
    geo.setAttribute('instGlow', new THREE.InstancedBufferAttribute(g, 1));
    for (let i = 0; i < MAX * n; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, new THREE.Color(0xffffff)); }
    mesh.frustumCulled = false;
    meshes[k] = mesh;
    glow[k] = geo.attributes.instGlow;
    group.add(mesh);
  }

  // the cars of both trains, their layouts and which seats are taken; `t`
  // is the train, and the platform it calls at
  const cars = trains.flatMap((train, t) => train.cars.map(car => {
    const lay = seatLayout(car.spec);
    // the doors on the platform side: the car's own z on that side
    const side = car.turned ? -1 : 1;
    return { t, car, lay, side, seatTaken: lay.seats.map(() => null) };
  }));
  cars.forEach((c, i) => { c.i = i; });

  const people = [];
  const free = [];
  for (let i = MAX - 1; i >= 0; i--) free.push(i);
  let seed = 1;
  const r = rng(20261001);

  // ---- spaces ----
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), seen = new THREE.Sphere(new THREE.Vector3(), 1.3);
  const spaceMatrix = (space) => (space === 'station' ? station.group.matrix : cars[space].car.group.matrix);
  const inv = M(), v = new THREE.Vector3(), dir = new THREE.Vector3();
  function moveTo(p, space) {
    if (p.space === space) return;
    v.copy(p.pos).applyMatrix4(spaceMatrix(p.space)).applyMatrix4(inv.copy(spaceMatrix(space)).invert());
    dir.set(Math.sin(p.heading), 0, Math.cos(p.heading)).transformDirection(spaceMatrix(p.space)).transformDirection(inv);
    p.pos.copy(v);
    p.heading = Math.atan2(dir.x, dir.z);
    p.space = space;
  }

  // ---- making people ----
  const pick = (a) => a[Math.floor(r() * a.length)];
  function spawn(space, x, y, z, heading) {
    if (!free.length) return null;
    const slot = free.pop();
    const hairStyle = r() < 0.08 ? 0 : r() < 0.45 ? 2 : 1;
    const beanie = r() < 0.1;
    const p = {
      slot, space, pos: new THREE.Vector3(x, y, z), heading,
      sc: 0.9 + r() * 0.17, wide: 0.9 + r() * 0.25,
      skin: pick(SKIN), hair: beanie ? pick(BEANIES) : pick(HAIR), hairStyle: beanie ? 1 : hairStyle,
      coat: pick(COAT), trousers: pick(TROUSERS), bag: r() < 0.35 ? pick(BAGS) : null,
      speed: 1.15 + r() * 0.35,
      path: [], phase: r() * 6.28, walk: 0, sit: 0, hold: 0, phoneT: 0,
      likesPhone: r() < 0.35, seed: seed++, role: 'wait', seat: null, wait: 0,
    };
    people.push(p);
    paint(p);
    return p;
  }

  function paint(p) {
    const c = new THREE.Color();
    const set = (k, n, hex) => { c.set(hex); for (let j = 0; j < n; j++) meshes[k].setColorAt(p.slot * n + j, c); };
    set('thigh', 2, p.trousers); set('shin', 2, p.trousers);
    set('upper', 2, p.coat); set('fore', 2, p.coat); set('torso', 1, p.coat);
    set('skin', 3, p.skin); set('hairShort', 1, p.hair); set('hairLong', 1, p.hair);
    set('bag', 1, p.bag || '#000000');
    for (const k of Object.keys(meshes)) meshes[k].instanceColor.needsUpdate = true;
  }

  // takes someone out of the picture (they keep their slot)
  function hide(p) {
    for (const [k, n] of parts) for (let j = 0; j < n; j++) meshes[k].setMatrixAt(p.slot * n + j, ZERO);
  }

  function remove(p) {
    hide(p);
    if (p.seat) { cars[p.seat.car].seatTaken[p.seat.i] = null; p.seat = null; }
    free.push(p.slot);
    people.splice(people.indexOf(p), 1);
  }

  // ---- where to go ----
  const way = (space, x, y, z, extra = {}) => ({ space, x, y, z, ...extra });
  const floorY = (space) => (space === 'station' ? PLATFORM_Y : cars[space].lay.floor);

  // a point on platform `plat` given in its half-local coordinates
  const at = (plat, x, z, extra) => { const [sx, sz] = toStation(plat, x, z); return way('station', sx, PLATFORM_Y, sz, extra); };
  const local = (p) => toStation(p.plat, p.pos.x, p.pos.z);

  // a free spot on platform `plat` to wait at (near `near`, if given, in
  // half-local x), away from the edge, the benches, the passages and the
  // other people; in station coordinates
  function waitingSpot(plat, near = null, spread = 30) {
    let x, z;
    for (let tries = 0; tries < 40; tries++) {
      x = near === null ? 5 + r() * (LEN - 10) : THREE.MathUtils.clamp(near + (r() * 2 - 1) * spread, 5, LEN - 5);
      z = 2.35 + r() * 1.8;
      if (BENCHES.some(b => Math.abs(b - x) < 1.3) && z > 3.6) continue;
      if ([36, 70, 104].some(e => Math.abs(e - x) < 1.8) && z > 3.2) continue;
      // keep clear of where everyone else is standing, or going to stand
      const [sx, sz] = toStation(plat, x, z);
      if (people.some(o => {
        if (o.space !== 'station' || o.role === 'leave') return false;
        const end = o.path.length ? o.path[o.path.length - 1] : o.pos;
        return Math.hypot(end.x - sx, end.z - sz) < 0.85;
      })) continue;
      break;
    }
    const [sx, sz] = toStation(plat, x, z);
    return { x: sx, z: sz };
  }

  // standing still, facing somewhere sensible: the track, or up the tunnel
  // the train comes from
  function settle(p, how) {
    p.role = how;
    p.path = [];
    const kind = r();
    p.pose = p.likesPhone ? 'phone' : 'stand';
    if (how === 'wait') p.face = (kind < 0.6 ? Math.PI + (r() - 0.5) * 1.2 : -Math.PI / 2 + (r() - 0.5) * 0.8) + p.plat * Math.PI;
  }

  // the nearest door of train `t` to a point on its platform, in station
  // coordinates, with the car it belongs to
  function nearestDoor(t, x) {
    let best = null;
    inv.copy(station.group.matrix).invert();
    for (const c of cars) {
      if (c.t !== t) continue;
      for (const dx of c.lay.doors) {
        v.set(dx, c.lay.floor, c.side * 1.3).applyMatrix4(c.car.group.matrix).applyMatrix4(inv);
        const d = Math.abs(v.x - x);
        if (!best || d < best.d) best = { d, car: c.i, dx, sx: v.x };
      }
    }
    return best;
  }

  function freeSeatNear(ci, x) {
    const c = cars[ci];
    let best = -1, bd = 1e9;
    c.lay.seats.forEach((s, i) => {
      if (c.seatTaken[i]) return;
      const d = Math.abs(s.x - x) + r() * 1.5;
      if (d < bd && d < 7) { bd = d; best = i; }
    });
    return best;
  }

  // ---- the start: people riding the train, and waiting at the station ----
  for (const c of cars) {
    c.lay.seats.forEach((s, i) => {
      if (r() > 0.36) return;
      const p = spawn(c.i, s.x, c.lay.floor, s.z, s.s > 0 ? Math.PI : 0);
      if (!p) return;
      p.sit = 1; p.role = 'seated'; p.seat = { car: c.i, i }; c.seatTaken[i] = p;
      p.pose = p.likesPhone && r() < 0.6 ? 'phone' : 'stand';
    });
    for (const dx of c.lay.doors) {
      if (r() < 0.45) continue;
      const z = (r() < 0.5 ? 1 : -1) * 0.5;
      const p = spawn(c.i, dx + (r() - 0.5) * 0.8, c.lay.floor, z, z > 0 ? 0 : Math.PI);
      if (p) { p.role = 'hold'; p.hold = 1; p.pose = 'hold'; p.heading = r() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
    }
  }

  function populateStation(n) {
    for (const p of [...people]) if (p.space === 'station') remove(p);
    for (const plat of [0, 1]) {
      for (let i = 0; i < n[plat]; i++) {
        // a few on the benches
        if (i < 4 && r() < 0.7) {
          const [bx, bz] = toStation(plat, BENCHES[i] + (r() - 0.5) * 1.2, WALL_Z - 0.45);
          const p = spawn('station', bx, PLATFORM_Y, bz, Math.PI + plat * Math.PI);
          if (p) { p.plat = plat; p.sit = 1; p.role = 'bench'; p.seatH = 0.45; }
          continue;
        }
        const s = waitingSpot(plat);
        const p = spawn('station', s.x, PLATFORM_Y, s.z, 0);
        if (p) { p.plat = plat; settle(p, 'wait'); p.heading = p.face; }
      }
    }
  }

  // ---- what people do when the doors of train `t` open and close ----
  function doorsOpen(t) {
    // some riders get off: they stand, go to the nearest platform-side door,
    // step out and make for the nearest way out
    for (const p of people) {
      if (typeof p.space !== 'number' || cars[p.space].t !== t || r() > 0.27) continue;
      const c = cars[p.space];
      const near = c.lay.doors.reduce((a, b) => (Math.abs(b - p.pos.x) < Math.abs(a - p.pos.x) ? b : a));
      p.role = 'alight';
      p.delay = 0.3 + r() * 1.6;
      p.path = [
        way(c.i, near + (r() - 0.5) * 0.5, c.lay.floor, c.side * 0.55),
        way(c.i, near + (r() - 0.5) * 0.4, c.lay.floor, c.side * 1.45, { cross: 'station', gate: true }),
      ];
    }
    // people waiting on its platform get on, once the others are off
    for (const p of people) {
      if (p.space !== 'station' || p.plat !== t || (p.role !== 'wait' && p.role !== 'bench') || r() > 0.88) continue;
      const d = nearestDoor(t, p.pos.x);
      if (!d) continue;
      p.delay = 2.4 + r() * 2.2 + (p.role === 'bench' ? 0.8 : 0);
      p.role = 'board';
      const z = (zl) => toStation(t, 0, zl)[1];
      p.path = [
        way('station', d.sx + (r() < 0.5 ? -1 : 1) * (0.55 + r() * 0.35), PLATFORM_Y, z(STATION.edge + 0.55 + r() * 0.3)),
        way('station', d.sx + (r() - 0.5) * 0.3, PLATFORM_Y, z(STATION.edge + 0.1), { gate: true, train: t }),
        way('station', d.sx + (r() - 0.5) * 0.3, PLATFORM_Y, z(STATION.edge - 0.15), { cross: d.car }),
      ];
    }
  }

  function doorsClosing(t) {
    for (const p of people) {
      // anyone still on the platform waits for the next one
      if (p.role === 'board' && p.space === 'station' && p.plat === t) {
        const s = waitingSpot(p.plat, local(p)[0], 4);
        p.path = [way('station', s.x, PLATFORM_Y, s.z, { then: 'wait' })];
        p.role = 'stroll';
      }
      // anyone still on the train stays on
      if (p.role === 'alight' && typeof p.space === 'number' && cars[p.space].t === t) { p.path = []; p.role = 'hold'; p.pose = 'hold'; }
    }
  }

  // someone has just stepped into a car: find them a seat, or a rail
  function boarded(p) {
    const c = cars[p.space];
    const i = freeSeatNear(c.i, p.pos.x);
    if (i >= 0 && r() < 0.85) {
      const s = c.lay.seats[i];
      c.seatTaken[i] = p;
      p.seat = { car: c.i, i };
      p.path = [
        way(c.i, p.pos.x, c.lay.floor, c.side * 0.45),
        way(c.i, s.x, c.lay.floor, s.z - s.s * 0.5, { then: 'sit', seatAt: [s.x, s.z], face: s.s > 0 ? Math.PI : 0 }),
      ];
    } else {
      const z = (r() < 0.5 ? 1 : -1) * 0.5;
      p.path = [way(c.i, p.pos.x + (r() - 0.5) * 2, c.lay.floor, z, { then: 'hold' })];
    }
    p.role = 'find';
  }

  // the way out from a cross-passage, in half-local coordinates: into the
  // passage, round into the corridor towards the nearer end, and along it
  const cdirOf = (e) => (e < LEN / 2 ? -1 : 1);
  const corridorMouth = (e, lane) => [e + cdirOf(e) * (ARCH.width / 2 + 0.7), MID + lane * 0.35];
  const corridorEnd = (e, lane) => [e + cdirOf(e) * (ARCH.width / 2 + CORRIDOR.length - 0.6), MID + lane * 0.35];

  // someone has just stepped off: head for the nearest way out
  function alighted(p) {
    const [xl] = local(p);
    const e = EXITS.reduce((a, b) => (Math.abs(b - xl) < Math.abs(a - xl) ? b : a));
    const lane = (r() - 0.5) * 1.4;
    p.path = [
      at(p.plat, xl + (e > xl ? 1 : -1) * 0.8, STATION.edge + 1.2 + r() * 0.6),
      at(p.plat, e + lane * 0.5, 3.6),
      at(p.plat, e + lane * 0.3, MID - 0.7),
      at(p.plat, ...corridorMouth(e, lane)),
      at(p.plat, ...corridorEnd(e, lane), { then: 'gone' }),
    ];
    p.role = 'leave';
  }

  // new people arrive from the way out from time to time, on either platform
  let arrivalTimer = 2;
  function arrivals(dt, busy) {
    arrivalTimer -= dt;
    if (arrivalTimer > 0) return;
    arrivalTimer = 1 + r() * 2.5;
    const plat = r() < 0.5 ? 0 : 1;
    const waiting = people.filter(p => p.space === 'station' && p.plat === plat && (p.role === 'wait' || p.role === 'stroll')).length;
    if (waiting > 22 || busy[plat]) return;
    const e = pick(EXITS), lane = (r() - 0.5) * 1.4;
    const [sx, sz] = toStation(plat, ...corridorEnd(e, lane));
    const p = spawn('station', sx, PLATFORM_Y, sz, 0);
    if (!p) return;
    p.plat = plat;
    const s = waitingSpot(plat, e);
    p.path = [
      at(plat, ...corridorMouth(e, lane)),
      at(plat, e + lane * 0.3, MID - 0.7),
      at(plat, e + lane * 0.5, 3.4),
      way('station', s.x, PLATFORM_Y, s.z, { then: 'wait' }),
    ];
    p.role = 'stroll';
  }

  // ---- moving ----
  function step(p, dt, doors) {
    if (p.delay > 0) { p.delay -= dt; p.walk = Math.max(0, p.walk - dt * 4); return; }
    const w = p.path[0];
    if (!w) { p.walk = Math.max(0, p.walk - dt * 4); return; }
    // wait at the door until it is open (the doors of the train boarding, or
    // of the one getting off)
    const t = w.train ?? (typeof p.space === 'number' ? cars[p.space].t : 0);
    if (w.gate && doors[t] < 0.9) { p.walk = Math.max(0, p.walk - dt * 4); return; }
    // standing up first
    if (p.sit > 0 && !p.sitting) {
      p.sit = Math.max(0, p.sit - dt * 1.8);
      if (p.seat && p.sit <= 0) { cars[p.seat.car].seatTaken[p.seat.i] = null; p.seat = null; }
      if (p.sit > 0) return;
    }
    p.hold = Math.max(0, p.hold - dt * 3);
    if (w.space !== p.space) moveTo(p, w.space);
    const dx = w.x - p.pos.x, dz = w.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    const speed = p.speed * (typeof p.space === 'number' ? 0.75 : 1);
    if (d > 0.02) {
      const want = Math.atan2(dx, dz);
      let dh = want - p.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      p.heading += Math.sign(dh) * Math.min(Math.abs(dh), dt * 6);
      const s = Math.min(d, speed * dt * Math.max(0.2, Math.cos(dh)));
      p.pos.x += dx / d * s;
      p.pos.z += dz / d * s;
      p.pos.y = floorY(p.space);
      p.phase += s / (1.25 * p.sc) * Math.PI * 2;
      p.walk = Math.min(1, p.walk + dt * 4);
    }
    if (d <= 0.06) {
      p.path.shift();
      if (w.cross !== undefined) {
        if (w.cross === 'station') p.plat = cars[p.space].t;
        moveTo(p, w.cross);
        if (w.cross === 'station') alighted(p); else boarded(p);
        return;
      }
      if (w.then === 'gone') { p.gone = true; return; }
      if (w.then === 'sit') { p.sitting = { at: w.seatAt, face: w.face, t: 0 }; p.role = 'sitting'; return; }
      if (w.then === 'hold') { p.role = 'hold'; p.pose = 'hold'; p.turnTo = r() < 0.5 ? Math.PI / 2 : -Math.PI / 2; return; }
      if (w.then === 'wait') { settle(p, 'wait'); p.turnTo = p.face; }
    }
  }

  // turning and sitting down, once there
  function settleStep(p, dt) {
    if (p.turnTo !== undefined && !p.path.length) {
      let dh = p.turnTo - p.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      p.heading += Math.sign(dh) * Math.min(Math.abs(dh), dt * 3);
      if (Math.abs(dh) < 0.01) p.turnTo = undefined;
    }
    if (p.sitting) {
      const st = p.sitting;
      let dh = st.face - p.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      p.heading += Math.sign(dh) * Math.min(Math.abs(dh), dt * 5);
      if (Math.abs(dh) < 0.05) {
        st.t = Math.min(1, st.t + dt * 1.6);
        p.pos.x += (st.at[0] - p.pos.x) * Math.min(1, dt * 5);
        p.pos.z += (st.at[1] - p.pos.z) * Math.min(1, dt * 5);
        p.sit = st.t;
        if (st.t >= 1) { p.sitting = null; p.role = 'seated'; }
      }
    }
    if (p.role === 'hold' && !p.path.length) p.hold = Math.min(1, p.hold + dt * 2);
    const phoneWanted = p.pose === 'phone' && p.walk < 0.3 && p.hold < 0.1 ? 1 : 0;
    p.phoneT += (phoneWanted - p.phoneT) * Math.min(1, dt * 3);
  }

  // ---- drawing: compose each part's matrix from the pose ----
  const glowOf = (p) => (typeof p.space === 'number' ? 1 : 0);
  function pose(p, time, accel) {
    const sm = spaceMatrix(p.space);
    const sc = p.sc;
    const seatH = (p.seatH ?? 0.47);
    const sit = p.sit * p.sit * (3 - 2 * p.sit);
    const walk = p.walk;
    const phi = p.phase;
    const idle = Math.sin(time * 0.9 + p.seed) * 0.025 * (1 - walk) * (1 - sit);
    const bob = 0.018 * walk * Math.abs(Math.sin(phi));
    // standing in a moving car, people sway with the train
    const sway = typeof p.space === 'number' && sit < 0.5 ? THREE.MathUtils.clamp(-accel * 0.04, -0.08, 0.08) : 0;
    const hipY = (B.hip - bob) * (1 - sit) + (seatH / sc) * sit;
    tmp.root.makeRotationY(p.heading);
    tmp.root.setPosition(p.pos.x, p.pos.y, p.pos.z);
    tmp.root.premultiply(sm);
    tmp.root.multiply(tmp.a.makeScale(sc, sc, sc));
    if (sit > 0.01) tmp.root.moveBy(0, 0, -0.08 * sit);
    const set = (k, j, m) => meshes[k].setMatrixAt(p.slot * counts[k] + j, m);

    // legs: thighs swing forward (positive) and fold up to sit; knees bend
    for (const [j, side] of [[0, 1], [1, -1]]) {
      const ph = phi + (j ? Math.PI : 0);
      const swing = 0.42 * Math.sin(ph) * walk;
      const knee = (0.06 + 0.8 * Math.max(0, Math.cos(ph)) ** 1.5) * walk;
      const thighA = swing * (1 - sit) + (Math.PI / 2) * sit;
      const kneeA = knee * (1 - sit) + (Math.PI / 2 - 0.05) * sit;
      tmp.hip.copy(tmp.root).moveBy(side * B.hipX * p.wide, hipY, 0).turnX(-thighA);
      set('thigh', j, tmp.hip);
      tmp.c.copy(tmp.hip).moveBy(0, -B.thigh, 0).turnX(kneeA);
      set('shin', j, tmp.c);
    }
    // the body, leaning back a little when seated
    const lean = -0.12 * sit + idle + sway;
    tmp.torso.copy(tmp.root).moveBy(0, hipY - 0.06, 0).turnX(lean)
      .multiply(tmp.c.makeScale(p.wide, 1, 1));
    set('torso', 0, tmp.torso);
    tmp.torso.copy(tmp.root).moveBy(0, hipY - 0.06, 0).turnX(lean);
    // head, looking down at a phone
    const nod = 0.35 * p.phoneT;
    tmp.neck.copy(tmp.torso).moveBy(0, B.neck, 0).turnX(nod);
    tmp.c.copy(tmp.neck).moveBy(0, B.head + 0.005, 0.01);
    set('skin', 0, tmp.d.copy(tmp.c).multiply(tmp.b.makeScale(B.head, B.head * 1.1, B.head)));
    set('hairShort', 0, p.hairStyle === 1 ? tmp.c : ZERO);
    set('hairLong', 0, p.hairStyle === 2 ? tmp.c : ZERO);
    set('bag', 0, p.bag && sit < 0.5 ? tmp.torso : ZERO);
    // arms: swinging, holding the rail overhead, on a phone, or in the lap
    for (const [j, side] of [[0, 1], [1, -1]]) {
      const ph = phi + (j ? 0 : Math.PI);
      let upper = 0.32 * Math.sin(ph) * walk + 0.05;
      let elbow = 0.25 + 0.2 * Math.max(0, Math.sin(ph)) * walk;
      let out = 0.06;
      // the right hand (j = 1) holds the rail or the phone
      if (j === 1) {
        upper += (2.75 - upper) * p.hold;
        elbow += (0.15 - elbow) * p.hold;
        out += 0.12 * p.hold;
      }
      upper += (0.25 - upper) * p.phoneT;
      elbow += (1.55 - elbow) * p.phoneT;
      out += (-0.18 - out) * p.phoneT * 0.6;
      upper += (0.5 - upper) * sit * (1 - p.phoneT);
      elbow += (0.9 - elbow) * sit * (1 - p.phoneT);
      tmp.sh.copy(tmp.torso).moveBy(side * B.shoulderX * p.wide, B.shoulderY, 0)
        .multiply(tmp.b.makeRotationZ(side * out)).turnX(-upper);
      set('upper', j, tmp.sh);
      tmp.d.copy(tmp.sh).moveBy(0, -B.upper, 0).turnX(-elbow);
      set('fore', j, tmp.d);
      tmp.c.copy(tmp.d).moveBy(0, -B.fore - 0.02, 0).multiply(tmp.b.makeScale(0.045, 0.05, 0.045));
      set('skin', 1 + j, tmp.c);
      if (j === 1) {
        if (p.phoneT > 0.3) {
          tmp.c.copy(tmp.d).moveBy(-0.02 * side, -B.fore - 0.03, 0.04).turnX(1.2);
          set('phone', 0, tmp.c);
        } else set('phone', 0, ZERO);
      }
    }
    const g = glowOf(p);
    for (const [k, n] of parts) for (let j = 0; j < n; j++) glow[k].array[p.slot * n + j] = g;
  }

  return {
    group,
    // a new station: a new crowd on both its platforms
    newStation() { populateStation([14 + Math.floor(r() * 9), 10 + Math.floor(r() * 9)]); arrivalTimer = 1; },
    doorsOpen,
    doorsClosing,
    // dt: time step; doors: how open each train's doors are; busy: whether
    // each train is standing at its platform; accel: our train's
    // acceleration. With `camera` (its matrices up to date), only the people
    // in its view are posed, which is most of the work.
    update(dt, { doors, busy, time, accel = 0, camera = null }) {
      arrivals(dt, busy);
      for (const p of [...people]) {
        step(p, dt, doors);
        settleStep(p, dt);
        if (p.gone) { remove(p); continue; }
      }
      if (camera) frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      let top = 0;
      for (const p of people) {
        top = Math.max(top, p.slot + 1);
        if (camera) {
          seen.center.set(p.pos.x, p.pos.y + 0.9, p.pos.z).applyMatrix4(spaceMatrix(p.space));
          if (!frustum.intersectsSphere(seen)) {
            if (!p.hidden) hide(p);
            p.hidden = true;
            continue;
          }
        }
        p.hidden = false;
        pose(p, time, accel);
      }
      // draw only up to the highest slot in use
      for (const [k, n] of parts) {
        meshes[k].count = top * n;
        for (const a of [meshes[k].instanceMatrix, glow[k]]) {
          a.clearUpdateRanges();
          a.addUpdateRange(0, top * n * a.itemSize);
          a.needsUpdate = true;
        }
      }
    },
    get count() { return people.length; },
    // what everyone is doing, for checking
    census() {
      const out = {};
      for (const p of people) { const k = `${typeof p.space === 'number' ? 'car' : 'station'}:${p.role}`; out[k] = (out[k] || 0) + 1; }
      return out;
    },
  };
}
