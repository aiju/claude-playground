// A deep-level tube tunnel: rings of cast-iron segments with their flanges
// facing in, a concrete invert with the track set into it, cable runs along
// the walls and the odd working light.
//
// The train stays put and the tunnel slides past it. Everything in the tunnel
// repeats every PERIOD metres (30 rings), so it only ever has to move by less
// than one period before jumping back.
//
// Light from the train's windows falls on the walls: the tunnel's materials
// add it in their shaders, from a strip of texture that marks where along the
// train the windows are.

import * as THREE from 'three';
import { buildTrack, trackMaterials } from './track.js';
import { addLightTerms } from './materials.js';
import { MeshBuilder, matrixFrom } from './geom.js';
import { noiseTexture, rng } from './textures.js';
import { BODY } from './dims.js';

export const TUNNEL = {
  radius: 1.83,          // to the inside of the flanges
  skin: 1.95,            // to the segments' inner skin
  centreY: 1.25,         // above the top of the rails
  bed: -0.20,            // top of the concrete the sleepers sit in
  ring: 0.508,           // 20 inches
};
export const PERIOD = 30 * TUNNEL.ring;
// whole periods, so the lamps sit at k * PERIOD + LAMP_PHASE
const EXTENT = [-12 * PERIOD, 12 * PERIOD];
const LAMP_PHASE = PERIOD / 2;
const LAMP_Y = 2.25;

const { radius: R, skin: RS, centreY: CY, bed: BED, ring: W } = TUNNEL;
const PHI_BED = Math.asin((BED - CY) / RS);           // where the skin meets the invert
const PHI0 = PHI_BED, PHI1 = Math.PI - PHI_BED;

const at = (r, phi) => [r * Math.cos(phi), CY + r * Math.sin(phi)];  // (z, y)

// One ring of segments, from x = 0 to W.
function ringGeometry() {
  const iron = new MeshBuilder();
  const N = 84;
  const flangeT = 0.025, longT = 0.02;
  const colourAt = [];
  const push = (b, shade) => { colourAt.push([b.pos.length, shade]); };
  void push;
  // skin between the flanges, facing the axis
  for (let i = 0; i < N; i++) {
    const a = PHI0 + (PHI1 - PHI0) * i / N, b = PHI0 + (PHI1 - PHI0) * (i + 1) / N;
    const [za, ya] = at(RS, a), [zb, yb] = at(RS, b);
    const na = [0, -Math.sin(a), -Math.cos(a)], nb = [0, -Math.sin(b), -Math.cos(b)];
    iron.quad([flangeT, ya, za], [W - flangeT, ya, za], [W - flangeT, yb, zb], [flangeT, yb, zb], na, na, nb, nb,
      [0, i / N], [1, i / N], [1, (i + 1) / N], [0, (i + 1) / N]);
  }
  // the circumferential flange at x = 0 (two flanges bolted together) and
  // the half of the next one at x = W
  for (const [x0, x1] of [[0, flangeT], [W - flangeT, W]]) {
    for (let i = 0; i < N; i++) {
      const a = PHI0 + (PHI1 - PHI0) * i / N, b = PHI0 + (PHI1 - PHI0) * (i + 1) / N;
      const [zai, yai] = at(R, a), [zbi, ybi] = at(R, b), [zao, yao] = at(RS, a), [zbo, ybo] = at(RS, b);
      // faces
      if (x1 === flangeT) iron.quad([x1, yai, zai], [x1, yao, zao], [x1, ybo, zbo], [x1, ybi, zbi], [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]);
      if (x0 === W - flangeT) iron.quad([x0, yai, zai], [x0, yao, zao], [x0, ybo, zbo], [x0, ybi, zbi], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0]);
      // inner edge
      const na = [0, -Math.sin(a), -Math.cos(a)], nb = [0, -Math.sin(b), -Math.cos(b)];
      iron.quad([x0, yai, zai], [x1, yai, zai], [x1, ybi, zbi], [x0, ybi, zbi], na, na, nb, nb, [0, 0.5], [0.1, 0.5], [0.1, 0.5], [0, 0.5]);
    }
  }
  // longitudinal flanges at the joints between segments
  for (let k = -1; k <= 4; k++) {
    const phi = (-22.5 + 45 * k) * Math.PI / 180;
    if (phi < PHI0 + 0.05 || phi > PHI1 - 0.05) continue;
    for (const s of [1, -1]) {
      const p = phi + s * longT / RS;
      const [zi, yi] = at(R, p), [zo, yo] = at(RS, p);
      const t = [0, Math.cos(p) * s, -Math.sin(p) * s];      // facing along the circle
      iron.quad([flangeT, yi, zi], [W - flangeT, yi, zi], [W - flangeT, yo, zo], [flangeT, yo, zo], t, t, t, t);
    }
    const [z1, y1] = at(R, phi - longT / RS), [z2, y2] = at(R, phi + longT / RS);
    const n = [0, -Math.sin(phi), -Math.cos(phi)];
    iron.quad([flangeT, y1, z1], [W - flangeT, y1, z1], [W - flangeT, y2, z2], [flangeT, y2, z2], n, n, n, n);
    // bolts along the joint
    for (const bx of [0.12, 0.25, 0.38]) {
      const [zb, yb] = at(R + 0.005, phi);
      iron.addGeometry(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6), matrixFrom([bx, yb, zb], [phi - Math.PI / 2, 0, 0]));
    }
  }
  return iron.geometry();
}

// A cable run: a few cables sagging between brackets PERIOD / 10 apart.
function cableSpanGeometry(heights, side) {
  const span = PERIOD / 10;
  const b = new MeshBuilder();
  heights.forEach((y, i) => {
    const r = 0.011 + (i % 3) * 0.004;
    const z = side * (Math.sqrt(R * R - (y - CY) ** 2) - 0.1 - (i % 2) * 0.02);
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push(new THREE.Vector3(t * span, y - 0.035 * 4 * t * (1 - t), z));
    }
    b.addGeometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, r, 6, false));
  });
  // the bracket
  const top = Math.max(...heights), bottom = Math.min(...heights);
  const zb = side * (Math.sqrt(R * R - ((top + bottom) / 2 - CY) ** 2) - 0.07);
  b.addGeometry(new THREE.BoxGeometry(0.03, top - bottom + 0.1, 0.03), matrixFrom([0, (top + bottom) / 2, zb]));
  for (const y of heights) b.addGeometry(new THREE.BoxGeometry(0.025, 0.012, 0.16), matrixFrom([0, y - 0.022, zb - side * 0.05]));
  return b.geometry();
}

// The light that the train's windows throw on to the tunnel. `pattern` is a
// strip of texture along the train, 1 where there is a window.
function windowTerm(u) {
  return {
    key: 'train-windows',
    uniforms: u,
    decl: `
      uniform sampler2D uWinTex;
      uniform float uWinX0, uWinX1, uWinGain;
      float trainWindows(vec3 p, vec3 n) {
        float total = 0.0;
        for (int i = 0; i < 2; i++) {
          float s = i == 0 ? 1.0 : -1.0;
          vec2 src = vec2(1.86, s * 1.28);
          vec2 d = src - p.yz;
          float dist = max(length(d), 0.05);
          vec2 l = d / dist;
          float recv = max(dot(n.yz, l), 0.0) * 0.9 + 0.1 * max(dot(n.yz, l) + 0.5, 0.0);
          float emit = max(dot(-l, vec2(0.15, s)), 0.0);
          float u = (p.x - uWinX0) / (uWinX1 - uWinX0);
          float lod = log2(max(dist * 1.2, 0.034) / 0.034);
          float pat = textureLod(uWinTex, vec2(u, 0.5), lod).r;
          total += pat * recv * emit / (dist * dist + 0.4);
        }
        return total;
      }`,
    body: `extraIrr += trainWindows(wp, wn) * uWinGain * vec3(1.0, 0.95, 0.86);`,
  };
}

// a strip of texture along the train marking its windows, lit or not
function windowPattern(train) {
  const size = 4096;
  const x0 = -train.length - 3, x1 = 3;
  const data = new Uint8Array(size * 4);
  const mark = (a, b, v) => {
    const i0 = Math.max(0, Math.floor((a - x0) / (x1 - x0) * size));
    const i1 = Math.min(size - 1, Math.ceil((b - x0) / (x1 - x0) * size));
    for (let i = i0; i <= i1; i++) data[i * 4] = Math.min(255, data[i * 4] + v);
  };
  for (const car of train.cars) {
    const L = car.length, spec = car.spec;
    const toWorld = (d) => car.centre + (car.turned ? -1 : 1) * (L / 2 - d);
    const span = ([a, b]) => { const p = toWorld(a), q = toWorld(b); return [Math.min(p, q), Math.max(p, q)]; };
    for (const w of spec.windows) mark(...span(w), 150);
    for (const door of spec.doors) for (const leaf of door.leaves) mark(...span(leaf.window), 255);
  }
  for (let i = 0; i < size; i++) data[i * 4 + 3] = 255;
  const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, x0, x1 };
}

export function buildTunnel(train) {
  const group = new THREE.Group();
  group.name = 'tunnel';
  const scroller = new THREE.Group();
  group.add(scroller);

  const pattern = windowPattern(train);
  const winUniforms = {
    uWinTex: { value: pattern.tex }, uWinX0: { value: pattern.x0 }, uWinX1: { value: pattern.x1 }, uWinGain: { value: 5.0 },
  };
  const lit = (m) => addLightTerms(m, [windowTerm(winUniforms)]);

  const grime = noiseTexture(256, 17, 5, [0.55, 1.0]);
  grime.repeat.set(1, 3);
  const ironMat = lit(new THREE.MeshStandardMaterial({ color: 0x6a6159, roughness: 0.9, metalness: 0.15, map: grime }));
  const bedMat = lit(new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.95 }));
  const cableMat = lit(new THREE.MeshStandardMaterial({ color: 0x1c1c1d, roughness: 0.6 }));
  const tm = trackMaterials();
  for (const m of Object.values(tm)) lit(m);
  tm.timber.color.set(0x2c241f);

  // rings, instanced along the tunnel
  const nRings = Math.ceil((EXTENT[1] - EXTENT[0] + PERIOD) / W);
  const rings = new THREE.InstancedMesh(ringGeometry(), ironMat, nRings);
  const r = rng(99);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < nRings; i++) {
    m.makeTranslation(EXTENT[0] + i * W, 0, 0);
    rings.setMatrixAt(i, m);
    // every thirtieth ring matches, so the pattern repeats with the period
    const k = i % 30;
    const shade = 0.75 + 0.35 * ((k * 7919) % 30) / 30 + 0.05 * Math.sin(k);
    c.setRGB(shade, shade * (0.97 + 0.03 * Math.sin(k * 3)), shade * 0.94);
    rings.setColorAt(i, c);
  }
  void r;
  rings.receiveShadow = true;
  scroller.add(rings);

  // the invert: concrete up to the sleepers, with a drain down the middle
  const bedShape = new THREE.Shape();
  const zEdge = Math.sqrt(RS * RS - (BED - CY) ** 2) + 0.02;
  bedShape.moveTo(-zEdge, BED);
  bedShape.lineTo(-0.18, BED);
  bedShape.lineTo(-0.16, BED - 0.16);
  bedShape.lineTo(0.16, BED - 0.16);
  bedShape.lineTo(0.18, BED);
  bedShape.lineTo(zEdge, BED);
  bedShape.lineTo(zEdge, BED - 0.4);
  bedShape.lineTo(-zEdge, BED - 0.4);
  bedShape.closePath();
  const bedGeo = new THREE.ExtrudeGeometry(bedShape, { depth: EXTENT[1] - EXTENT[0] + PERIOD, bevelEnabled: false });
  bedGeo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, EXTENT[0], 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
  bedGeo.computeVertexNormals();
  const bed = new THREE.Mesh(bedGeo, bedMat);
  bed.receiveShadow = true;
  scroller.add(bed);

  // track: sleepers and insulators spaced to divide the period
  scroller.add(buildTrack(EXTENT[0], EXTENT[1] + PERIOD, tm, { sleeper: 'timber', pitch: PERIOD / 24, insulatorPitch: PERIOD / 5, seed: 4 }));

  // cable runs on both walls
  const nSpans = Math.ceil((EXTENT[1] - EXTENT[0] + PERIOD) / (PERIOD / 10));
  for (const [heights, side] of [[[0.95, 1.01, 1.07, 1.13, 1.19], 1], [[1.38, 1.44, 1.5], -1], [[2.35, 2.41], 1]]) {
    const cables = new THREE.InstancedMesh(cableSpanGeometry(heights, side), cableMat, nSpans);
    for (let i = 0; i < nSpans; i++) { m.makeTranslation(EXTENT[0] + i * PERIOD / 10, 0, 0); cables.setMatrixAt(i, m); }
    scroller.add(cables);
  }

  // working lights on the left wall, one a period, and a few real lights
  // that follow the nearest of them
  const lampZ = -(Math.sqrt(R * R - (LAMP_Y - CY) ** 2) - 0.08);
  const nLamps = Math.ceil((EXTENT[1] - EXTENT[0] + PERIOD) / PERIOD);
  const lampBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), cableMat, nLamps);
  const lampGlow = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.06, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 4 }), nLamps);
  for (let i = 0; i < nLamps; i++) {
    const x = EXTENT[0] + i * PERIOD + LAMP_PHASE;
    m.makeTranslation(x, LAMP_Y, lampZ);
    lampBody.setMatrixAt(i, m);
    m.makeTranslation(x, LAMP_Y - 0.02, lampZ + 0.065);
    lampGlow.setMatrixAt(i, m);
  }
  scroller.add(lampBody, lampGlow);
  for (let i = 0; i < nLamps; i++) {
    const glow = new THREE.Sprite(train.materials.lampGlow);
    glow.scale.setScalar(0.9);
    glow.position.set(EXTENT[0] + i * PERIOD + LAMP_PHASE, LAMP_Y - 0.02, lampZ + 0.1);
    scroller.add(glow);
  }
  const lampLights = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xffd4a0, 2.2, 14, 1.6);
    group.add(l);
    lampLights.push(l);
  }

  // headlights
  const headlights = [];
  for (const s of [1, -1]) {
    const spot = new THREE.SpotLight(0xf2f6ff, 40, 0, 0.36, 0.85, 1.35);
    spot.position.set(0.15, 1.54, s * 0.87);
    spot.target.position.set(60, 1.0, s * 0.1);
    group.add(spot, spot.target);
    headlights.push(spot);
  }
  const ambient = new THREE.HemisphereLight(0x9aa4b0, 0x302a26, 0.05);
  group.add(ambient);

  return {
    group,
    background: new THREE.Color(0x000000),
    fog: new THREE.FogExp2(0x000000, 0.018),
    envIntensity: 0.05,
    exposure: 1.25,
    winUniforms,
    update(distance, camera) {
      const shift = ((distance % PERIOD) + PERIOD) % PERIOD;
      scroller.position.x = -shift;
      // the lamps nearest the camera get real lights
      const cx = camera.position.x;
      const base = Math.floor((cx + shift - LAMP_PHASE) / PERIOD);
      lampLights.forEach((l, i) => {
        const k = base + [0, 1, -1, 2][i];
        l.position.set(k * PERIOD + LAMP_PHASE - shift, LAMP_Y - 0.12, lampZ + 0.2);
      });
    },
    follow() {},
  };
}
