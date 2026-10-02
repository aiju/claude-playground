// The depot: a maintenance shed like the Victoria line's at Northumberland
// Park, with the train standing on track set into a green painted floor,
// under steel roof trusses and rows of strip lights.

import * as THREE from 'three';
import { buildTrack } from './track.js';
import { MeshBuilder, matrixFrom } from './geom.js';
import { noiseTexture } from './textures.js';

const SHED = { halfWidth: 9, height: 7.2, bay: 6.0, x0: -150, x1: 24 };

function box(b, size, pos, rot) { b.addGeometry(new THREE.BoxGeometry(...size), matrixFrom(pos, rot)); }

// the floor paint: green, with a yellow walkway line either side of the track
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#4e7a63';
  g.fillRect(0, 0, 64, 1024);
  // across the shed: v runs over z from -halfWidth to +halfWidth
  const zToPx = (z) => (1 - (z + SHED.halfWidth) / (2 * SHED.halfWidth)) * 1024;
  g.fillStyle = '#6b6d6f';                           // the concrete track bed
  g.fillRect(0, zToPx(1.7), 64, zToPx(-1.7) - zToPx(1.7));
  g.fillStyle = '#e8b923';
  for (const z of [2.05, -2.05]) g.fillRect(0, zToPx(z) - 3, 64, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function buildDepot(trackMats, trainLength) {
  const group = new THREE.Group();
  group.name = 'depot';
  const { halfWidth: HW, height: H, bay, x0, x1 } = SHED;
  const length = x1 - x0;

  // floor, level with the tops of the sleepers
  const wear = noiseTexture(256, 5, 6, [0.75, 1.0]);
  wear.repeat.set(length / 12, 2);
  const floorTex = floorTexture();
  floorTex.repeat.set(length / 4, 1);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, roughnessMap: wear, metalness: 0, envMapIntensity: 0.6 });
  const floorGeo = new THREE.PlaneGeometry(length, 2 * HW).rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set((x0 + x1) / 2, -0.155, 0);
  floor.receiveShadow = true;
  group.add(floor);
  group.add(buildTrack(x0, x1, trackMats, { sleeper: 'concrete', pitch: 0.7, conductors: false }));

  // steel: columns down both sides, trusses across, purlins along
  const steel = new MeshBuilder(), light = new MeshBuilder(), wall = new MeshBuilder(), glass = new MeshBuilder();
  for (let x = x0 + 3; x < x1; x += bay) {
    for (const s of [1, -1]) {
      box(steel, [0.3, H, 0.3], [x, H / 2 - 0.15, s * (HW - 0.4)]);
      box(steel, [0.5, 0.2, 0.5], [x, -0.05, s * (HW - 0.4)]);
    }
    // a truss: bottom and top chords with diagonals between
    const chord = (y0, y1) => {
      const dz = 2 * HW, dy = y1 - y0;
      const len = Math.hypot(dz / 2, dy);
      for (const s of [1, -1]) box(steel, [0.14, 0.14, len], [x, (y0 + y1) / 2, s * HW / 2], [s * Math.atan2(dy, dz / 2), 0, 0]);
    };
    box(steel, [0.16, 0.18, 2 * HW], [x, H - 0.8, 0]);
    chord(H - 0.3, H + 0.9);
    for (let k = -3; k <= 3; k++) {
      const z = k * HW / 3.5, top = H - 0.3 + 1.2 * (1 - Math.abs(z) / HW);
      box(steel, [0.08, top - (H - 0.8), 0.08], [x, (top + H - 0.8) / 2, z]);
    }
  }
  for (const z of [-HW + 0.4, -4, 0, 4, HW - 0.4]) box(steel, [length, 0.14, 0.12], [(x0 + x1) / 2, H - 0.7, z]);
  // strip lights hung under the trusses
  for (const z of [-5.5, -2.6, 2.6, 5.5]) {
    for (let x = x0 + 5; x < x1 - 2; x += 3.2) {
      box(steel, [2.4, 0.08, 0.26], [x, H - 1.25, z]);
      box(light, [2.3, 0.02, 0.18], [x, H - 1.30, z]);
    }
  }
  // walls: blockwork to shoulder height, then windows
  for (const s of [1, -1]) {
    box(wall, [length, 2.6, 0.25], [(x0 + x1) / 2, 1.15, s * HW]);
    box(glass, [length, 3.2, 0.1], [(x0 + x1) / 2, 4.1, s * HW]);
    for (let x = x0; x < x1; x += 1.5) box(steel, [0.06, 3.2, 0.14], [x, 4.1, s * HW]);
  }
  // roof panels
  const roof = new MeshBuilder();
  for (const s of [1, -1]) {
    const len = Math.hypot(HW, 1.2);
    box(roof, [length, 0.05, len + 0.4], [(x0 + x1) / 2, H + 0.3 + 0.6, s * HW / 2], [s * Math.atan2(1.2, HW), 0, 0]);
  }
  const mats = {
    steel: new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.6, metalness: 0.3 }),
    light: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe0ea, emissive: 0xdfeaf2, emissiveIntensity: 0.9, roughness: 0.2 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.8, side: THREE.DoubleSide }),
  };
  for (const [b, m] of [[steel, mats.steel], [light, mats.light], [wall, mats.wall], [glass, mats.glass], [roof, mats.roof]]) {
    const mesh = new THREE.Mesh(b.geometry(), m);
    // the key light stands for the lamps under the roof, so the shed itself
    // casts no shadows
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // a soft dark patch under the train, for the light it keeps off the floor
  const ao = document.createElement('canvas');
  ao.width = 4; ao.height = 128;
  const ag = ao.getContext('2d');
  const grad = ag.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.35)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.5)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ag.fillStyle = grad;
  ag.fillRect(0, 0, 4, 128);
  const aoMesh = new THREE.Mesh(new THREE.PlaneGeometry(trainLength + 0.6, 4.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ao), transparent: true, depthWrite: false }));
  aoMesh.position.set(-trainLength / 2, -0.138, 0);
  group.add(aoMesh);

  const hemi = new THREE.HemisphereLight(0xf2f5f8, 0x4c5a52, 0.8);
  // the shed's lights, as one soft light from high above one side
  const sun = new THREE.DirectionalLight(0xfff8ee, 2.6);
  sun.position.set(10, 15, 11);
  sun.target.position.set(-6, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  group.add(hemi, sun, sun.target);

  return {
    group,
    background: new THREE.Color(0xd9dde0),
    fog: new THREE.Fog(0xd9dde0, 70, 190),
    envIntensity: 0.9,
    exposure: 1.0,
    // keep the sharp shadows around what the camera is looking at
    follow(target) {
      sun.target.position.set(target.x, 0, 0);
      sun.position.set(target.x + 10, 15, 11);
    },
  };
}
