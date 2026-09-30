// Sets up the renderer, the two scenes (the depot, and underground: the
// tunnel with a station on it) and the controls, and runs the loop. The
// controls panel talks to it through `app`.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMaterials, lighting, setFrontDisplays, station as stationLight } from './materials.js';
import { trackMaterials } from './track.js';
import { buildTrain } from './train.js';
import { buildDepot } from './depot.js';
import { buildTunnel } from './tunnel.js';
import { buildStation, STATION } from './station.js';
import { createService, route, stationStart, stopAt } from './service.js';
import { createSound } from './sound.js';
import { VIEWS, DEFAULT_VIEW } from './views.js';
import { buildUI } from './ui.js';

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

const scenes = {
  depot: buildDepot(trackMaterials(), train.length),
  tunnel: buildTunnel(train),
};
for (const s of Object.values(scenes)) scene.add(s.group);
// one station, moved along to wherever the train is going next
const station = buildStation();
scenes.tunnel.group.add(station.group);
const service = createService(train.length);

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
  trackside: false,
  anchor: null,                     // 'station' when the camera stands in the station
  stationIndex: -1,                 // which station is shown
  stationX: 0,                      // and where it is, in world x
  indicator: '',
  tween: null,
};
if (params.get('dest')) setFrontDisplays(materials, { destination: state.destination });

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
    const dir = new THREE.Vector3(...v.target).sub(new THREE.Vector3(...v.pos)).normalize();
    controls.target.copy(camera.position).addScaledVector(dir, 0.05);
  }
}

function setView(name, animate = !still) {
  const v = VIEWS[name] || VIEWS.front;
  const from = VIEWS[state.view];
  const sceneChange = v.scene !== state.scene;
  const jump = sceneChange || (v.anchor === 'station') !== (from?.anchor === 'station');
  state.view = name;
  setScene(v.scene);
  // arriving at a station from elsewhere: bring the train in to it, unless
  // it is already standing there or nearly in
  if (v.anchor === 'station' && from?.anchor !== 'station' && !still) {
    const k = service.nextStop(state.distance);
    if (service.phase !== 'dwell' && stopAt(k) - state.distance > 300) service.approach(state, k);
    updateStation();
  }
  state.trackside = !!v.trackside;
  state.anchor = v.anchor || null;
  const pos = new THREE.Vector3(...v.pos), target = new THREE.Vector3(...v.target);
  if (v.trackside) placeTrackside(pos, target);
  if (v.anchor === 'station') { pos.x += state.stationX; target.x += state.stationX; }
  animate = animate && !jump;
  if (animate) {
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
function placeTrackside(pos, target) {
  const ahead = still ? 38 : 70;
  pos.set(ahead, 0.9, 1.3);
  target.set(ahead - 30, 1.3, 0);
}

// Shows the station the train is at or coming to, and moves it (and a
// camera standing in it) along as the train runs.
function updateStation() {
  const k = service.shownStation(state.distance);
  if (k !== state.stationIndex) {
    state.stationIndex = k;
    const stops = route(state.destination);
    station.setName(stops[(Math.max(0, stops.length - 4) + k) % stops.length]);
  }
  const x = stationStart(k) - state.distance;
  const moved = x - state.stationX;
  state.stationX = x;
  station.group.position.x = x;
  stationLight.uStX0.value = x;
  stationLight.uStX1.value = x + STATION.length;
  return moved;
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
// for stills: ?stopped stands the train at the first station
if (params.has('stopped')) { service.standAt(state, 0); state.doors = state.doorTarget = 1; }
train.setDoors(state.doors, (VIEWS[params.get('view')] || VIEWS.front).scene === 'depot' ? state.doors : 0);
updateStation();
setView(params.get('view') || 'front', false);
// ?cam=x,y,z&at=x,y,z puts the camera anywhere, for checking details
if (params.get('cam')) {
  camera.position.set(...params.get('cam').split(',').map(Number));
  if (params.get('at')) controls.target.set(...params.get('at').split(',').map(Number));
  controls.update();
}

let frames = 0, lastTime = null;
function frame(time) {
  const dt = lastTime === null ? 1 / 60 : Math.min(Math.max((time - lastTime) / 1000, 0), 0.1);
  lastTime = time;
  // underground, the train runs its service; in the depot it stands
  const before = state.speed, was = state.distance;
  if (state.scene === 'tunnel') {
    const event = service.update(state, dt, state.stops);
    if (event) {
      state.doorTarget = event === 'open' ? 1 : 0;
      sound.doors(event === 'open');
    }
  } else state.speed = 0;
  state.accel = dt > 0 ? (state.speed - before) / dt : 0;
  const step = state.distance - was;
  train.roll(state.distance);
  const moved = updateStation();
  if (state.anchor === 'station') {
    camera.position.x += moved;
    controls.target.x += moved;
    if (state.tween) for (const p of [state.tween.to.pos, state.tween.to.target, state.tween.from.pos, state.tween.from.target]) p.x += moved;
  }
  if (state.scene === 'tunnel') {
    // brighter, and less murky, in the station
    const x = camera.position.x;
    const s0 = state.stationX, s1 = s0 + STATION.length;
    const smooth = (a, b, v) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
    const inside = smooth(s0 - 25, s0 + 5, x) * (1 - smooth(s1 - 5, s1 + 25, x));
    scene.environmentIntensity = scenes.tunnel.envIntensity + 0.45 * inside;
    scene.fog.density = 0.018 - 0.013 * inside;
    const text = indicatorText();
    if (text.join('|') !== state.indicator) { state.indicator = text.join('|'); station.setIndicator(text); }
  }

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
  if (state.trackside) {
    camera.position.x -= step;
    controls.target.x -= step;
    if (state.tween) { state.tween.to.pos.x -= step; state.tween.to.target.x -= step; state.tween.from.pos.x -= step; state.tween.from.target.x -= step; }
    if (camera.position.x < -train.length - 25) {
      const p = new THREE.Vector3(), t = new THREE.Vector3();
      placeTrackside(p, t);
      camera.position.copy(p);
      controls.target.copy(t);
    }
  }
  if (state.doors !== state.doorTarget) {
    const k = dt / 2.2;
    state.doors = state.doorTarget > state.doors ? Math.min(state.doorTarget, state.doors + k) : Math.max(state.doorTarget, state.doors - k);
    // in a station only the doors on the platform side open
    train.setDoors(state.doors, state.scene === 'depot' ? state.doors : 0);
  }
  controls.update();
  scenes[state.scene].update?.(state.distance, camera);
  scenes[state.scene].follow?.(controls.target);
  sound.update({ speed: state.speed, accel: state.accel, distance: state.distance, listener: camera.position.x, tunnel: state.scene === 'tunnel' });
  ui?.tick();
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
  else if (e.key === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
});

window.tubeTrain = { stillReady: false, app, state, service, train, materials, lighting, scene, camera, renderer };
document.getElementById('status')?.remove();
requestAnimationFrame(frame);
