// Sets up the renderer, the two scenes (the depot, and underground: the
// tunnel with a station on it) and the controls, and runs the loop. The
// controls panel talks to it through `app`.
//
// The train runs along a path: a straight road in the depot, the curving
// line underground. Cameras ride with a car, stand in the station, or stand
// at the trackside; each frame a riding camera is moved the way its car (or
// the station) moved, so it goes round the curves with it.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMaterials, lighting, setFrontDisplays, station as stationLight } from './materials.js';
import { trackMaterials } from './track.js';
import { buildTrain } from './train.js';
import { buildDepot } from './depot.js';
import { buildTunnel } from './tunnel.js';
import { buildStation, STATION } from './station.js';
import { createService, route, stationStart, stopAt, SPACING } from './service.js';
import { LinePath, StraightPath, Frame } from './path.js';
import { createSound } from './sound.js';
import { VIEWS, DEFAULT_VIEW } from './views.js';
import { buildUI } from './ui.js';
import { createMinimap } from './minimap.js';
import { createPeople } from './people.js';

const params = new URLSearchParams(location.search);
const still = params.has('still');
if (still) document.body.classList.add('still');

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = !still;
controls.dampingFactor = 0.08;
controls.maxDistance = 140;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const materials = createMaterials();
const train = buildTrain(materials);
scene.add(train.group);

const depotPath = new StraightPath();
const line = new LinePath({ stationStart, stationLength: STATION.length, spacing: SPACING });

const scenes = {
  depot: buildDepot(trackMaterials(), train.length),
  tunnel: buildTunnel(train, line),
};
for (const s of Object.values(scenes)) scene.add(s.group);
// one station, moved along to wherever the train is going next
const station = buildStation();
station.group.matrixAutoUpdate = false;
scenes.tunnel.group.add(station.group);
const service = createService(train.length);
// passengers: on the platform and in the cars, underground only
const people = createPeople({ train, station });
scenes.tunnel.group.add(people.group);

const sound = createSound(train.wheelXs);

const state = {
  scene: null,
  view: null,
  distance: +(params.get('s') || 0),
  speed: 0,
  accel: 0,
  targetSpeed: 15,                  // m/s; 54 km/h
  doors: params.get('doors') === 'open' ? 1 : 0,
  doorTarget: params.get('doors') === 'open' ? 1 : 0,
  lights: true,
  destination: params.get('dest') || 'Walthamstow Central',
  stops: true,                      // stop at stations
  anchor: null,                     // what the camera moves with: { kind: 'car' | 'station' | 'world', ... }
  tracksideS: 0,                    // where along the line the trackside camera stands
  focusS: 0,                        // and the camera's distance along the line
  stationIndex: -1,                 // which station is shown
  indicator: '',
  tween: null,
};
if (params.get('dest')) setFrontDisplays(materials, { destination: state.destination });

const frontS = () => (state.scene === 'depot' ? 0 : state.distance);
const pathNow = () => (state.scene === 'depot' ? depotPath : line);

function placeTrain() {
  train.place(pathNow(), frontS());
  train.group.updateMatrixWorld();
}

function setScene(name) {
  if (state.scene === name) return;
  state.scene = name;
  const s = scenes[name];
  for (const [k, v] of Object.entries(scenes)) v.group.visible = k === name;
  scene.background = s.background;
  scene.fog = s.fog;
  scene.environmentIntensity = s.envIntensity;
  renderer.toneMappingExposure = s.exposure;
  // the depot has a key light with shadows; the tunnel only its own lights
  renderer.shadowMap.enabled = name === 'depot';
  for (const l of train.headlights) l.visible = name === 'tunnel';
  // headlight glare shows in the dark, much less in a lit shed
  materials.headGlow.opacity = name === 'tunnel' ? 0.9 : 0.25;
  materials.tailGlow.opacity = name === 'tunnel' ? 0.9 : 0.35;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  stationLight.uStOn.value = name === 'tunnel' ? 1 : 0;
  // underground the train is in service; in the depot it stands with its
  // doors as they are
  if (name === 'tunnel') {
    state.doorTarget = service.phase === 'dwell' ? 1 : 0;
    if (still && service.phase !== 'dwell') state.speed = state.targetSpeed;
  } else state.speed = 0;
}

// Presets are framed for a landscape screen; on a narrower one, widen the
// vertical field of view so that the width of the view stays the same.
function fovFor(presetFov) {
  const aspect = camera.aspect, wide = 1.6;
  if (aspect >= wide) return presetFov;
  const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(presetFov) / 2) * wide / aspect);
  return Math.min(THREE.MathUtils.radToDeg(2 * half), 95);
}

function applyLook(v) {
  // look views: turn on the spot, around a target just in front of the camera
  controls.enableZoom = controls.enablePan = !v.look;
  controls.rotateSpeed = v.look ? -0.35 : 1;
  controls.minDistance = v.look ? 0.01 : 0.6;
  if (v.look) {
    const dir = new THREE.Vector3().subVectors(state.tween?.to.target ?? controls.target, camera.position).normalize();
    controls.target.copy(camera.position).addScaledVector(dir, 0.05);
  }
}

// what a riding camera moves with: a car, the station, or a point on the
// track a fixed distance from the front of the train
function anchorMatrix(a) {
  if (a.kind === 'car') return a.car.group.matrix;
  if (a.kind === 'station') return station.group.matrix;
  if (a.kind === 'track') return pathNow().frame(frontS() + a.offset, a.frame).matrix(a.m);
  return null;
}

function setView(name, animate = !still) {
  const v = VIEWS[name] || VIEWS.front;
  const from = VIEWS[state.view];
  const sceneChange = v.scene !== state.scene;
  state.view = name;
  setScene(v.scene);
  // arriving at a station from elsewhere: bring the train in to it, unless
  // it is already standing there or nearly in
  if (v.anchor === 'station' && from?.anchor !== 'station' && !still) {
    const k = service.nextStop(state.distance);
    if (service.phase !== 'dwell' && stopAt(k) - state.distance > 300) service.approach(state, k);
  }
  placeTrain();
  updateStation();
  // the preset in the world, and what the camera will move with
  let pos = new THREE.Vector3(...v.pos), target = new THREE.Vector3(...v.target), anchor;
  if (v.anchor === 'station') {
    pos.applyMatrix4(station.group.matrix);
    target.applyMatrix4(station.group.matrix);
    anchor = { kind: 'station', last: station.group.matrix.clone() };
    state.focusS = stationStart(state.stationIndex) + v.pos[0];
  } else if (v.trackside) {
    placeTrackside(pos, target);
    anchor = { kind: 'world' };
  } else if (v.follow === 'track') {
    // x is along the track from the front of the train, y and z across it
    pathNow().frame(frontS() + v.pos[0]).apply(0, v.pos[1], v.pos[2], pos);
    pathNow().frame(frontS() + v.target[0]).apply(0, v.target[1], v.target[2], target);
    anchor = { kind: 'track', offset: v.pos[0], frame: new Frame(), m: new THREE.Matrix4() };
    anchor.last = anchorMatrix(anchor).clone();
    state.focusS = frontS() + v.pos[0];
  } else {
    const car = train.carAt(v.pos[0]);
    pos = train.toCar(car, pos).applyMatrix4(car.group.matrix);
    target = train.toCar(car, target).applyMatrix4(car.group.matrix);
    anchor = { kind: 'car', car, last: car.group.matrix.clone() };
    state.focusS = frontS() + v.pos[0];
  }
  // cameras riding with the train can glide from one view to another
  const rides = (a) => a?.kind === 'car' || a?.kind === 'track';
  const jump = sceneChange || anchor.kind === 'world' || (anchor.kind !== state.anchor?.kind && !(rides(anchor) && rides(state.anchor)));
  state.anchor = anchor;
  if (animate && !jump) {
    state.tween = { t: 0, from: { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov }, to: { pos, target, fov: fovFor(v.fov || 45) }, v };
  } else {
    state.tween = null;
    camera.position.copy(pos);
    controls.target.copy(target);
    camera.fov = fovFor(v.fov || 45);
    camera.updateProjectionMatrix();
    applyLook(v);
  }
  controls.update();
  ui?.refresh();
}

// The trackside camera stands in the tunnel ahead of the train, watches it
// come and go by, and then moves on ahead of it again.
const tf = new Frame();
function placeTrackside(pos, target) {
  const s = frontS() + (still ? 38 : 70);
  state.tracksideS = state.focusS = s;
  line.frame(s, tf).apply(0, 0.9, 1.3, pos);
  line.frame(s - 30, tf).apply(0, 1.3, 0, target);
}

// Moves a camera that rides with something the way that thing moved.
const delta = new THREE.Matrix4(), inv = new THREE.Matrix4();
function followAnchor() {
  const a = state.anchor;
  const M = a && anchorMatrix(a);
  if (!M) return;
  delta.copy(M).multiply(inv.copy(a.last).invert());
  a.last.copy(M);
  const pts = [camera.position, controls.target];
  if (state.tween) pts.push(state.tween.from.pos, state.tween.from.target, state.tween.to.pos, state.tween.to.target);
  for (const p of pts) p.applyMatrix4(delta);
}

// Station k's name: the stops on the way to the destination, starting a few
// short of it, then round again.
function stationName(k) {
  const stops = route(state.destination);
  return stops[(Math.max(0, stops.length - 4) + k) % stops.length];
}

// Shows the station the train is at or coming to, at its place on the line.
const sf = new Frame();
function updateStation() {
  const k = service.shownStation(state.distance);
  if (k !== state.stationIndex) {
    state.stationIndex = k;
    station.setName(stationName(k));
    people.newStation();
  }
  line.frame(stationStart(k), sf).matrix(station.group.matrix);
  station.group.matrixWorldNeedsUpdate = true;
  stationLight.uStInv.value.copy(station.group.matrix).invert();
}

// the train indicator: when the train will be in, or that it is here
function indicatorText() {
  const k = service.nextStop(state.distance);
  let when = '';
  if (k === state.stationIndex) {
    if (service.phase === 'dwell') when = '';
    else {
      const d = stopAt(k) - state.distance;
      const secs = d / Math.max(state.speed, 6) + 6;
      when = d < 150 ? 'due' : `${Math.ceil(secs / 60)} min`;
    }
  } else when = `${Math.ceil((stopAt(state.stationIndex) - state.distance) / 12 / 60) + 1} min`;
  const second = service.phase === 'dwell' && k === state.stationIndex ? 'Train at platform' : 'Stand behind the yellow line';
  return [`1 ${state.destination}\t${when}`, second];
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (state?.view && !state.tween) camera.fov = fovFor(VIEWS[state.view].fov || 45);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const app = {
  state,
  views: VIEWS,
  // where: 'depot', 'tunnel' or 'station'
  setScene(name) { setView(DEFAULT_VIEW[name]); },
  setView,
  toggleDoors() {
    if (state.scene !== 'depot') return;
    state.doorTarget = state.doorTarget ? 0 : 1;
    sound.doors(state.doorTarget === 1);
    ui?.refresh();
  },
  setSpeedKmh(kmh) { state.targetSpeed = kmh / 3.6; ui?.refresh(); },
  setDestination(name) {
    state.destination = name;
    setFrontDisplays(materials, { destination: name });
    state.stationIndex = -1;
    ui?.refresh();
  },
  setStops(on) { state.stops = on; ui?.refresh(); },
  setLights(on) {
    state.lights = on;
    lighting.saloon.value = on ? 1 : 0.06;
    materials.lamp.emissiveIntensity = on ? materials.lamp.userData.baseEmissive : 0.02;
    scenes.tunnel.winUniforms.uWinGain.value = on ? 5 : 0.3;
    ui?.refresh();
  },
  async setSound(on) { await sound.enable(on); ui?.refresh(); },
  get soundOn() { return sound.on; },
};

const ui = still ? null : buildUI(app);
const minimap = still ? null : createMinimap({
  canvas: document.getElementById('minimap'), line, train, stationStart, stationLength: STATION.length, stationName,
});
// for stills: ?stopped stands the train at the first station
if (params.has('stopped')) { service.standAt(state, 0); state.doors = state.doorTarget = 1; }
setView(params.get('view') || 'front', false);
train.setDoors(state.doors, state.scene === 'depot' ? state.doors : 0);
// for stills of a train standing at a station: a few seconds of people
// getting off and on (?board=seconds)
if (params.has('stopped') && state.scene === 'tunnel') {
  people.doorsOpen();
  const secs = +(params.get('board') || 3.5);
  for (let t = 0; t < secs; t += 0.05) people.update(0.05, { doors: 1, phase: 'dwell', time: t });
}
// ?cam=x,y,z&at=x,y,z puts the camera anywhere, for checking details
if (params.get('cam')) {
  camera.position.set(...params.get('cam').split(',').map(Number));
  if (params.get('at')) controls.target.set(...params.get('at').split(',').map(Number));
  controls.update();
}

const stationLocal = new THREE.Vector3();
const smooth = (a, b, v) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
let frames = 0, lastTime = null;
// Moves everything on by dt seconds: the train, the station, the people,
// the doors and the camera. `time` is the clock, in seconds.
function simulate(dt, time) {
  // underground, the train runs its service; in the depot it stands
  const before = state.speed;
  if (state.scene === 'tunnel') {
    const event = service.update(state, dt, state.stops);
    if (event) {
      state.doorTarget = event === 'open' ? 1 : 0;
      sound.doors(event === 'open');
      if (event === 'open') people.doorsOpen(); else people.doorsClosing();
    }
  } else state.speed = 0;
  state.accel = dt > 0 ? (state.speed - before) / dt : 0;
  train.roll(frontS());
  placeTrain();
  const shown = state.stationIndex;
  updateStation();
  // a camera in the station moves on with it to the next one
  if (state.anchor?.kind === 'station' && shown !== state.stationIndex) state.focusS += stationStart(state.stationIndex) - stationStart(shown);
  followAnchor();

  if (state.tween) {
    const tw = state.tween;
    tw.t = Math.min(1, tw.t + dt / 1.1);
    const e = tw.t * tw.t * (3 - 2 * tw.t);
    camera.position.lerpVectors(tw.from.pos, tw.to.pos, e);
    controls.target.lerpVectors(tw.from.target, tw.to.target, e);
    camera.fov = tw.from.fov + (tw.to.fov - tw.from.fov) * e;
    camera.updateProjectionMatrix();
    if (tw.t >= 1) { state.tween = null; applyLook(tw.v); }
  }
  // the trackside camera goes on ahead once the train has gone by
  if (state.anchor?.kind === 'world' && frontS() - train.length > state.tracksideS + 25) {
    placeTrackside(camera.position, controls.target);
  }
  if (state.doors !== state.doorTarget) {
    const k = dt / 2.2;
    state.doors = state.doorTarget > state.doors ? Math.min(state.doorTarget, state.doors + k) : Math.max(state.doorTarget, state.doors - k);
    // in a station only the doors on the platform side open
    train.setDoors(state.doors, state.scene === 'depot' ? state.doors : 0);
  }
  controls.update();
  if (state.scene === 'tunnel') {
    people.update(dt, { doors: state.doors, phase: service.phase, time, accel: state.accel });
    state.focusS = line.nearest(camera.position, state.focusS);
    scenes.tunnel.update(frontS(), state.focusS, still ? 999 : 3);
    // brighter, and less murky, in the station
    stationLocal.copy(camera.position).applyMatrix4(stationLight.uStInv.value);
    const inside = smooth(-25, 5, stationLocal.x) * (1 - smooth(STATION.length - 5, STATION.length + 25, stationLocal.x)) * (Math.abs(stationLocal.z - 1) < 8 ? 1 : 0);
    scene.environmentIntensity = scenes.tunnel.envIntensity + 0.45 * inside;
    scene.fog.density = 0.018 - 0.013 * inside;
    const text = indicatorText();
    if (text.join('|') !== state.indicator) { state.indicator = text.join('|'); station.setIndicator(text); }
  } else {
    scenes.depot.follow(controls.target);
  }
}

function frame(time) {
  const dt = lastTime === null ? 1 / 60 : Math.min(Math.max((time - lastTime) / 1000, 0), 0.1);
  lastTime = time;
  simulate(dt, time / 1000);
  sound.update({ speed: state.speed, accel: state.accel, distance: state.distance, listener: state.scene === 'tunnel' ? state.focusS - frontS() : camera.position.x, tunnel: state.scene === 'tunnel' });
  ui?.tick();
  if (minimap && state.scene === 'tunnel' && !document.body.classList.contains('nomap')) {
    const k = service.nextStop(state.distance);
    minimap.draw({ s: state.distance, camera, nextStop: k, toNext: service.phase === 'dwell' ? 0 : stopAt(k) - state.distance, dt });
  }
  renderer.render(scene, camera);
  frames++;
  if (still && frames === 3) window.tubeTrain.stillReady = true;
  if (!still || frames < 3) requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const here = VIEWS[state.view].group;
  const names = Object.keys(VIEWS).filter(n => VIEWS[n].group === here);
  if (/^[1-9]$/.test(e.key)) {
    if (names[+e.key - 1]) setView(names[+e.key - 1]);
  } else if (e.key === 'd') app.toggleDoors();
  else if (e.key === 'l') app.setLights(!state.lights);
  else if (e.key === 's') app.setSound(!sound.on);
  else if (e.key === 'ArrowUp' && state.scene === 'tunnel') { app.setSpeedKmh(Math.min(80, Math.round(state.targetSpeed * 3.6) + 5)); e.preventDefault(); }
  else if (e.key === 'ArrowDown' && state.scene === 'tunnel') { app.setSpeedKmh(Math.max(0, Math.round(state.targetSpeed * 3.6) - 5)); e.preventDefault(); }
  else if (e.key === 'h') document.body.classList.toggle('bare');
  else if (e.key === 'm') document.body.classList.toggle('nomap');
  else if (e.key === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
});

// for checking: run the world on by some seconds without drawing it
let clock = 0;
function fastForward(seconds, step = 0.05) {
  for (let t = 0; t < seconds; t += step) simulate(step, (clock += step));
}

window.tubeTrain = { stillReady: false, app, state, service, line, train, people, materials, lighting, scene, camera, renderer, fastForward };
document.getElementById('status')?.remove();
requestAnimationFrame(frame);
