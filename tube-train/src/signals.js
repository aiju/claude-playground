// Signals: the Underground's two-aspect colour lights, red over green, on
// the tunnel wall on the driver's side (the left), each with a train stop
// beside the right-hand rail.
//
// They work as automatic signals do. A signal guards the line as far as the
// next signal, and a little beyond (the overlap); while any part of a train
// is in that stretch it shows red, and its train stop is raised to trip the
// brakes of a train that tried to pass it. So a signal turns red as a train
// goes by, and green again once the train is clear of the next one. A
// station's starting signal, just past the end of its platform, is also held
// at red while a train that is stopping there runs in and stands, and clears
// shortly before the train is due to leave; the trains wait for it.
//
// Our track has a home signal before each station, the starting signal at
// its end and another between stations. The other track's are only round
// the station on screen, since that's the only place its tunnel is.

import * as THREE from 'three';
import { STATION } from './station.js';
import { stationStart, SPACING, DWELL } from './service.js';
import { PERIOD } from './tunnel.js';
import { TRACK } from './dims.js';
import { addLightTerms, stationTerm } from './materials.js';
import { MeshBuilder, matrixFrom } from './geom.js';
import { Frame } from './path.js';

const OVERLAP = 15;                      // how far past the next signal a signal guards
const RELEASE = DWELL.close + 2.5;       // a starting signal clears this long into a stop
const L = STATION.length;

// Signals stand clear of the working lights (every PERIOD, half way
// between), which are on the same wall.
function clearOfLamps(s) {
  const d = (((s - PERIOD / 2) % PERIOD) + PERIOD) % PERIOD;
  return d < 1.5 ? s + 1.5 - d : d > PERIOD - 1.5 ? s - (d - (PERIOD - 1.5)) : s;
}

// where our track's signals are, round station k
const home = (k) => clearOfLamps(stationStart(k) - 35);
const starter = (k) => clearOfLamps(stationStart(k) + L + 6);
const middle = (k) => clearOfLamps((starter(k) + home(k + 1)) / 2);
// and the other track's, in its own distances (it runs the other way)
const homeB = (track, k) => clearOfLamps(track.betaAt(stationStart(k) + L + 35));
const starterB = (track, k) => clearOfLamps(track.betaAt(stationStart(k) - 6));

// our track's signals from about s0 to s1, in order, each with the next
// one after it (which ends the stretch it guards)
function oursBetween(s0, s1) {
  const out = [];
  const k0 = Math.max(0, Math.floor((s0 - stationStart(0)) / SPACING) - 1);
  const k1 = Math.ceil((s1 - stationStart(0)) / SPACING) + 1;
  // one more on the way in to the first station
  if (k0 === 0) out.push({ id: 'run-in', s: home(0) - 170, next: home(0) });
  for (let k = k0; k <= k1; k++) {
    out.push(
      { id: `home ${k}`, s: home(k), next: starter(k) },
      { id: `starter ${k}`, s: starter(k), next: middle(k), starter: k },
      { id: `middle ${k}`, s: middle(k), next: home(k + 1) },
    );
  }
  return out.filter(x => x.s > s0 && x.s < s1);
}

function othersAt(track, k) {
  const sb = starterB(track, k);
  return [
    { id: `other home ${k}`, s: homeB(track, k), next: sb },
    { id: `other starter ${k}`, s: sb, next: sb + 170, starter: k },
  ];
}

// ---- what a signal looks like, in the track's frame at the signal (x
// along the line, y up, z to the right), facing the trains coming to it ----

const HEAD = { y: 1.86, z: -1.6 };       // on the left wall, above the cable run
const LENS = { red: 1.99, green: 1.73, r: 0.055 };
const STOP_Z = TRACK.gauge / 2 + TRACK.railHead + 0.06;

function shapes() {
  const head = new MeshBuilder();
  head.addGeometry(new THREE.BoxGeometry(0.14, 0.56, 0.24), matrixFrom([0, HEAD.y, HEAD.z]));
  // a hood over each lens
  for (const y of [LENS.red, LENS.green]) {
    const hood = new THREE.CylinderGeometry(0.078, 0.078, 0.11, 16, 1, true, 0, Math.PI);
    head.addGeometry(hood, matrixFrom([-0.125, y, HEAD.z], [0, 0, Math.PI / 2]));
  }
  // the bracket it hangs from
  head.addGeometry(new THREE.BoxGeometry(0.08, 0.05, 0.14), matrixFrom([0.02, HEAD.y + 0.3, HEAD.z - 0.05]));
  const stop = new MeshBuilder();
  stop.addGeometry(new THREE.BoxGeometry(0.46, 0.1, 0.17), matrixFrom([0.28, -0.085, STOP_Z + 0.13]));
  return {
    head: head.geometry(),
    lens: new THREE.CircleGeometry(LENS.r, 20).rotateY(-Math.PI / 2),
    stop: stop.geometry(),
    // the train stop's arm, from its pivot back towards the signal
    arm: new THREE.BoxGeometry(0.24, 0.028, 0.04).translate(-0.12, 0, 0),
  };
}

export function createSignals({ line, otherTrack, trainLength, materials }) {
  const group = new THREE.Group();
  group.name = 'signals';
  const groupB = new THREE.Group();       // the other track's, shown with its tunnel
  group.add(groupB);
  const geo = shapes();
  const lit = (m) => addLightTerms(m, [stationTerm()]);
  const mats = {
    head: lit(new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.55, side: THREE.DoubleSide })),
    stop: lit(new THREE.MeshStandardMaterial({ color: 0x45474a, roughness: 0.5, metalness: 0.6 })),
    redOff: lit(new THREE.MeshStandardMaterial({ color: 0x2a0806, roughness: 0.15 })),
    greenOff: lit(new THREE.MeshStandardMaterial({ color: 0x062414, roughness: 0.15 })),
    redOn: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2a12, emissiveIntensity: 5 }),
    greenOn: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x2cff9a, emissiveIntensity: 4 }),
  };
  const glow = (color) => new THREE.SpriteMaterial({ map: materials.lampGlow.map, color, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glows = { red: glow(0xff3010), green: glow(0x30ff9a) };

  // A little of each lamp's light falls on the walls round it: two lights
  // go to the lit signals nearest the camera. There are always two, turned
  // down when not needed, as a change in the number of lights would have
  // every shader built again.
  const lamps = [0, 1].map(() => {
    const l = new THREE.PointLight(0xff3010, 0, 5, 2);
    group.add(l);
    return l;
  });

  const signals = new Map();             // by id, round the trains
  const f = new Frame(), v = new THREE.Vector3();

  function make(spec, track, parent) {
    const sig = { ...spec, track, red: false, arm: 0 };
    track.frame(spec.s, f);
    sig.pos = f.apply(0, HEAD.y, HEAD.z);
    sig.facing = f.t.clone().negate();
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    f.matrix(g.matrix);
    const mesh = (geometry, material) => { const m = new THREE.Mesh(geometry, material); g.add(m); return m; };
    mesh(geo.head, mats.head);
    mesh(geo.stop, mats.stop);
    sig.lens = { red: mesh(geo.lens, mats.redOff), green: mesh(geo.lens, mats.greenOff) };
    sig.lens.red.position.set(-0.071, LENS.red, HEAD.z);
    sig.lens.green.position.set(-0.071, LENS.green, HEAD.z);
    sig.pivot = new THREE.Group();
    sig.pivot.position.set(0.06, -0.035, STOP_Z);
    sig.pivot.add(new THREE.Mesh(geo.arm, mats.stop));
    g.add(sig.pivot);
    sig.glow = new THREE.Sprite(glows.green);
    sig.glow.scale.setScalar(0.42);
    g.add(sig.glow);
    parent.add(g);
    sig.group = g;
    show(sig);
    return sig;
  }

  function show(sig) {
    sig.lens.red.material = sig.red ? mats.redOn : mats.redOff;
    sig.lens.green.material = sig.red ? mats.greenOff : mats.greenOn;
    sig.glow.material = sig.red ? glows.red : glows.green;
    sig.glow.position.set(-0.13, sig.red ? LENS.red : LENS.green, HEAD.z);
  }

  function drop(sig) {
    sig.group.removeFromParent();
    signals.delete(sig.id);
  }

  // keeps a signal for each spec on a track, made if new, and drops the
  // track's others
  function keep(specs, track, parent) {
    const ids = new Set(specs.map(x => x.id));
    for (const sig of [...signals.values()]) if (sig.track === track && !ids.has(sig.id)) drop(sig);
    return specs.map(spec => signals.get(spec.id) || signals.set(spec.id, make(spec, track, parent)).get(spec.id));
  }

  // a train on a track, from its front back: does it touch the stretch from
  // a to b?
  const touches = (front, a, b) => front > a && front - trainLength < b;
  const held = (sig, t) => sig.starter !== undefined && sig.starter === t.stopping && (t.dwell === null || t.dwell < RELEASE);

  // the signals round where the train starts, so that their shaders are
  // built with the rest
  keep(oursBetween(-400, 900), line, group);

  return {
    group,
    groupB,
    // Sets every signal from where the trains are, and keeps signals round
    // them. `ours` and `other` are each { front, stopping, dwell }: where the
    // train's front is along its track, the station it is stopping at (or
    // null), and how long it has stood there (or null). `station` is the
    // station on screen; `camera` is for the glows and the lights on the
    // walls.
    update({ ours, other, station, camera, dt }) {
      const near = keep(oursBetween(ours.front - 400, ours.front + 700), line, group);
      const farther = otherTrack ? keep(othersAt(otherTrack, station), otherTrack, groupB) : [];
      for (const [list, t] of [[near, ours], [farther, other]]) {
        for (const sig of list) {
          const red = touches(t.front, sig.s, sig.next + OVERLAP) || held(sig, t);
          if (red !== sig.red) { sig.red = red; show(sig); }
          // the train stop rises in a second or so, and falls as quickly
          sig.arm += Math.max(-dt / 0.9, Math.min(dt / 0.9, (red ? 1 : 0) - sig.arm));
          sig.pivot.rotation.z = -0.7 * sig.arm * sig.arm * (3 - 2 * sig.arm);
        }
      }
      // glows only from in front, and the two lights at the nearest lamps
      const cam = camera.position;
      const seen = [];
      for (const sig of signals.values()) {
        const front = v.subVectors(cam, sig.pos).dot(sig.facing) > 0;
        sig.glow.visible = front;
        const d = sig.pos.distanceTo(cam);
        if (front && d < 45 && (sig.track === line || groupB.visible)) seen.push([d, sig]);
      }
      seen.sort((a, b) => a[0] - b[0]);
      lamps.forEach((l, i) => {
        const sig = seen[i]?.[1];
        if (!sig) { l.intensity = 0; return; }
        sig.track.frame(sig.s, f).apply(-0.35, sig.red ? LENS.red : LENS.green, HEAD.z + 0.12, l.position);
        l.color.set(sig.red ? 0xff3010 : 0x30ff9a);
        l.intensity = sig.red ? 0.9 : 0.7;
      });
    },
    // where the first red signal ahead of our train is (Infinity if there's
    // none within reach), for it to stop short of
    redAhead(front, reach = 400) {
      let best = Infinity;
      for (const sig of signals.values()) {
        if (sig.track === line && sig.red && sig.s > front && sig.s < front + reach && sig.s < best) best = sig.s;
      }
      return best;
    },
    // our track's signals from s0 to s1 and the other's round the station,
    // for the map: { x, z } in the world, and whether each is red
    forMap(s0, s1) {
      const out = [];
      for (const spec of oursBetween(s0, s1)) {
        const sig = signals.get(spec.id);
        line.frame(spec.s, f);
        out.push({ x: f.pos.x, z: f.pos.z, rx: f.r.x, rz: f.r.z, red: sig ? sig.red : false });
      }
      for (const sig of signals.values()) {
        if (sig.track !== otherTrack) continue;
        otherTrack.frame(sig.s, f);
        out.push({ x: f.pos.x, z: f.pos.z, rx: f.r.x, rz: f.r.z, red: sig.red });
      }
      return out;
    },
  };
}
