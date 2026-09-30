// Sets up the renderer, the two scenes (the depot and the tunnel) and the
// controls, and runs the loop. The controls panel talks to it through `app`.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMaterials, lighting, setFrontDisplays } from './materials.js';
import { trackMaterials } from './track.js';
import { buildTrain } from './train.js';
import { buildDepot } from './depot.js';
import { buildTunnel } from './tunnel.js';
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

const sound = createSound(train.wheelXs);

const state = {
  scene: null,
  view: null,
  distance: +(params.get('t') || 0) * 15,
  speed: 0,
  accel: 0,
  targetSpeed: 15,                  // m/s; 54 km/h
  doors: params.get('doors') === 'open' ? 1 : 0,
  doorTarget: params.get('doors') === 'open' ? 1 : 0,
  lights: true,
  destination: params.get('dest') || 'Walthamstow Central',
  trackside: false,
  tween: null,
};
train.setDoors(state.doors, state.doors);
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
  // in the tunnel the train is running, in the depot it stands with its doors as they are
  if (name === 'tunnel') {
    state.doorTarget = 0;
    state.speed = still ? state.targetSpeed : Math.max(state.speed, 0);
  } else state.speed = 0;
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
  const sceneChange = v.scene !== state.scene;
  state.view = name;
  setScene(v.scene);
  state.trackside = !!v.trackside;
  const pos = new THREE.Vector3(...v.pos), target = new THREE.Vector3(...v.target);
  if (v.trackside) placeTrackside(pos, target);
  if (animate && !sceneChange) {
    state.tween = { t: 0, from: { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov }, to: { pos, target, fov: v.fov || 45 }, v };
  } else {
    state.tween = null;
    camera.position.copy(pos);
    controls.target.copy(target);
    camera.fov = v.fov || 45;
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

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const app = {
  state,
  views: VIEWS,
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
    ui?.refresh();
  },
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
  // speed: pull away or brake gently towards the chosen speed
  const before = state.speed;
  if (state.scene === 'tunnel') {
    const d = state.targetSpeed - state.speed;
    const a = d > 0 ? Math.min(1.1, d / dt) : Math.max(-1.2, d / dt);
    state.speed = Math.max(0, state.speed + a * dt);
  } else state.speed = 0;
  state.accel = dt > 0 ? (state.speed - before) / dt : 0;
  const step = state.speed * dt;
  state.distance += step;
  train.roll(state.distance);

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
    train.setDoors(state.doors, state.doors);
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
  const names = Object.keys(VIEWS);
  if (/^[1-9]$/.test(e.key) || e.key === '0') {
    const i = e.key === '0' ? 9 : +e.key - 1;
    if (names[i]) setView(names[i]);
  } else if (e.key === 'd') app.toggleDoors();
  else if (e.key === 'l') app.setLights(!state.lights);
  else if (e.key === 's') app.setSound(!sound.on);
  else if (e.key === 'ArrowUp' && state.scene === 'tunnel') { app.setSpeedKmh(Math.min(80, Math.round(state.targetSpeed * 3.6) + 5)); e.preventDefault(); }
  else if (e.key === 'ArrowDown' && state.scene === 'tunnel') { app.setSpeedKmh(Math.max(0, Math.round(state.targetSpeed * 3.6) - 5)); e.preventDefault(); }
  else if (e.key === 'h') document.body.classList.toggle('bare');
  else if (e.key === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
});

window.tubeTrain = { stillReady: false, app, state, train, materials, lighting, scene, camera, renderer };
document.getElementById('status')?.remove();
requestAnimationFrame(frame);
