// A deep-level tube tunnel: rings of cast-iron segments with their flanges
// facing in, a concrete invert with the track set into it, cable runs along
// the walls and the odd working light.
//
// The tunnel follows the line's path (path.js), round its curves and down its
// dips. It is built in pieces a couple of periods long, wherever the train
// and the camera are, and taken down again behind them. The rings, sleepers
// and cables are instanced along the path; the rails and the invert are swept
// along it.
//
// Light from the train's windows falls on the walls: the tunnel's materials
// add it in their shaders, from a strip of texture that marks where along the
// train the windows are, looked up by each point's distance along the line.

import * as THREE from 'three';
import { trackMaterials, RAIL_PROFILE, BAR_PROFILE } from './track.js';
import { addLightTerms, stationTerm, clipTerm, station, inStationLocal } from './materials.js';
import { MeshBuilder, matrixFrom } from './geom.js';
import { noiseTexture } from './textures.js';
import { TRACK } from './dims.js';
import { Frame } from './path.js';

export const TUNNEL = {
  radius: 1.83,          // to the inside of the flanges
  skin: 1.95,            // to the segments' inner skin
  centreY: 1.25,         // above the top of the rails
  bed: -0.20,            // top of the concrete the sleepers sit in
  ring: 0.508,           // 20 inches
};
export const PERIOD = 30 * TUNNEL.ring;     // a working light every period
const CHUNK = 2 * PERIOD;                   // the tunnel is built in pieces this long
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

// The light that the train's windows throw on to the tunnel. The tunnel's
// meshes carry their place along the line (`vPath`: distance along it, height
// and offset to the right) and their normal in the line's frame (`vPathN`):
// instanced ones from the instance's distance and the local geometry, swept
// ones as attributes.
function windowTerm(u) {
  return {
    key: 'train-windows',
    uniforms: u,
    vdecl: `
      attribute vec3 pathCoord;
      attribute vec3 pathNormal;
      #ifdef USE_INSTANCING
        attribute float instS;
      #endif
      varying vec3 vPath;
      varying vec3 vPathN;`,
    vbody: `
      #ifdef USE_INSTANCING
        vPath = vec3(instS + position.x, position.y, position.z);
        vPathN = objectNormal;
      #else
        vPath = pathCoord;
        vPathN = pathNormal;
      #endif`,
    decl: `
      uniform sampler2D uWinTex;
      uniform float uWinX0, uWinX1, uWinGain, uTrainS;
      varying vec3 vPath;
      varying vec3 vPathN;
      // p is relative to the front of the train, along the line
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
    body: `
      vec3 pn = normalize(vPathN) * (gl_FrontFacing ? 1.0 : -1.0);
      extraIrr += trainWindows(vec3(vPath.x - uTrainS, vPath.y, vPath.z), pn) * uWinGain * vec3(1.0, 0.95, 0.86);`,
  };
}

// Geometry swept along the path: a cross-section (in z, y) carried through
// frames, with each vertex's place along the line and its normal in the
// line's frame as attributes for the shaders.
class Sweep {
  constructor() { this.pos = []; this.nrm = []; this.pc = []; this.pn = []; }
  // `frames` are [s, Frame] pairs; `pts` the section; `ref` a point the
  // faces should look towards
  add(frames, pts, { closed = false, ref = [0, 1.25], origin }) {
    const n = pts.length, edges = closed ? n : n - 1;
    for (let e = 0; e < edges; e++) {
      const [za, ya] = pts[e], [zb, yb] = pts[(e + 1) % n];
      const len = Math.hypot(zb - za, yb - ya);
      if (len < 1e-6) continue;
      let ny = (zb - za) / len, nz = -(yb - ya) / len;
      const mz = (za + zb) / 2, my = (ya + yb) / 2;
      if (nz * (ref[0] - mz) + ny * (ref[1] - my) < 0) { ny = -ny; nz = -nz; }
      for (let i = 0; i < frames.length - 1; i++) {
        const [s0, f0] = frames[i], [s1, f1] = frames[i + 1];
        const P = (f, z, y) => f.apply(0, y, z).sub(origin);
        const quad = [[f0, s0, za, ya], [f1, s1, za, ya], [f1, s1, zb, yb], [f0, s0, zb, yb]];
        const v = quad.map(([f, , z, y]) => P(f, z, y));
        const N = quad.map(([f]) => new THREE.Vector3().copy(f.u).multiplyScalar(ny).addScaledVector(f.r, nz));
        // wind the two triangles to face the way the normal points
        const face = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0]));
        const order = face.dot(N[0]) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const k of order) {
          this.pos.push(v[k].x, v[k].y, v[k].z);
          this.nrm.push(N[k].x, N[k].y, N[k].z);
          this.pc.push(quad[k][1], quad[k][3], quad[k][2]);
          this.pn.push(0, ny, nz);
        }
      }
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('pathCoord', new THREE.Float32BufferAttribute(this.pc, 3));
    g.setAttribute('pathNormal', new THREE.Float32BufferAttribute(this.pn, 3));
    g.computeBoundingSphere();
    return g;
  }
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

// `lights`: give the working lights nearest the camera real light, and fill
// the tunnel with a faint ambient light (only one tunnel needs either).
export function buildTunnel(train, path, { lights = true } = {}) {
  const group = new THREE.Group();
  group.name = 'tunnel';

  const pattern = windowPattern(train);
  const winUniforms = {
    uWinTex: { value: pattern.tex }, uWinX0: { value: pattern.x0 }, uWinX1: { value: pattern.x1 },
    uWinGain: { value: 5.0 }, uTrainS: { value: 0 },
  };
  // the tunnel is cut away where a station is, and near one the station's
  // lights spill into it
  const lit = (m) => addLightTerms(m, [windowTerm(winUniforms), stationTerm(), clipTerm()]);

  const grime = noiseTexture(256, 17, 5, [0.55, 1.0]);
  grime.repeat.set(1, 3);
  const ironMat = lit(new THREE.MeshStandardMaterial({ color: 0x6a6159, roughness: 0.9, metalness: 0.15, map: grime }));
  const bedMat = lit(new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.95 }));
  const cableMat = lit(new THREE.MeshStandardMaterial({ color: 0x1c1c1d, roughness: 0.6 }));
  const glowMat = addLightTerms(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 4 }), [clipTerm()]);
  const tm = trackMaterials();
  // the track runs on through the stations
  for (const m of Object.values(tm)) addLightTerms(m, [windowTerm(winUniforms), stationTerm()]);
  tm.timber.color.set(0x2c241f);

  // the pieces every stretch of tunnel is made of, in the line's frame
  const lampZ = -(Math.sqrt(R * R - (LAMP_Y - CY) ** 2) - 0.08);
  const base = {
    ring: ringGeometry(),
    sleeper: new THREE.BoxGeometry(0.25, 0.14, 2.45).translate(0, -TRACK.railHeight - 0.07, 0),
    lampBody: new THREE.BoxGeometry(0.34, 0.12, 0.12).translate(0, LAMP_Y, lampZ),
    lampGlow: new THREE.BoxGeometry(0.26, 0.06, 0.02).translate(0, LAMP_Y - 0.02, lampZ + 0.065),
    insulators: [[TRACK.positiveZ, TRACK.positiveTop], [0, TRACK.negativeTop]].map(([z, top]) => {
      const h = top - 0.065 + 0.17;
      return new THREE.CylinderGeometry(0.045, 0.06, h, 16).translate(0, top - 0.065 - h / 2, z);
    }),
    cables: [[[0.95, 1.01, 1.07, 1.13, 1.19], 1], [[1.38, 1.44, 1.5], -1], [[2.35, 2.41], 1]].map(([h, side]) => cableSpanGeometry(h, side)),
  };
  const zEdge = Math.sqrt(RS * RS - (BED - CY) ** 2) + 0.02;
  const BED_PROFILE = [[-zEdge, BED], [-0.18, BED], [-0.16, BED - 0.16], [0.16, BED - 0.16], [0.18, BED], [zEdge, BED]];
  const railHalf = TRACK.gauge / 2 + TRACK.railHead / 2;
  const shift = (pts, dz, dy) => pts.map(([z, y]) => [z + dz, y + dy]);

  const f = new Frame(), m = new THREE.Matrix4(), colour = new THREE.Color();
  const chunks = new Map();

  // an instanced mesh of `geo` at each distance in `ss`, in a piece whose
  // origin is `origin`
  function instanced(geo, mat, ss, origin, tint) {
    const g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, a);
    if (geo.index) g.setIndex(geo.index);
    const inst = new Float32Array(ss.length);
    const mesh = new THREE.InstancedMesh(g, mat, ss.length);
    ss.forEach((s, i) => {
      path.frame(s, f).matrix(m);
      m.setPosition(f.pos.x - origin.x, f.pos.y - origin.y, f.pos.z - origin.z);
      mesh.setMatrixAt(i, m);
      inst[i] = s;
      if (tint) mesh.setColorAt(i, tint(s, colour));
    });
    g.setAttribute('instS', new THREE.InstancedBufferAttribute(inst, 1));
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    return mesh;
  }

  // a stretch of tunnel from c * CHUNK to (c + 1) * CHUNK
  function buildChunk(c) {
    const s0 = c * CHUNK, s1 = s0 + CHUNK;
    const g = new THREE.Group();
    const origin = path.frame(s0).pos.clone();
    g.position.copy(origin);
    const every = (step, phase = 0) => { const out = []; for (let s = s0 + phase; s < s1 - 1e-6; s += step) out.push(s); return out; };
    // rings, each a slightly different shade of grime
    g.add(instanced(base.ring, ironMat, every(W), origin, (s, col) => {
      const k = Math.round(s / W);
      const shade = 0.75 + 0.35 * ((k * 7919) % 30) / 30 + 0.05 * Math.sin(k);
      return col.setRGB(shade, shade * (0.97 + 0.03 * Math.sin(k * 3)), shade * 0.94);
    }));
    g.add(instanced(base.sleeper, tm.timber, every(PERIOD / 24, PERIOD / 48), origin));
    for (const geo of base.insulators) g.add(instanced(geo, tm.insulator, every(PERIOD / 5, PERIOD / 10), origin));
    for (const geo of base.cables) g.add(instanced(geo, cableMat, every(PERIOD / 10), origin));
    const lamps = every(PERIOD, LAMP_PHASE);
    g.add(instanced(base.lampBody, cableMat, lamps, origin), instanced(base.lampGlow, glowMat, lamps, origin));
    const glows = lamps.map(s => {
      const sprite = new THREE.Sprite(train.materials.lampGlow);
      sprite.scale.setScalar(0.9);
      path.frame(s, f).apply(0, LAMP_Y - 0.02, lampZ + 0.1, sprite.position).sub(origin);
      g.add(sprite);
      return sprite;
    });
    // the swept parts: rails, conductor rails and the invert
    const frames = [];
    for (let i = 0; i <= 60; i++) { const s = s0 + CHUNK * i / 60; frames.push([s, path.frame(s)]); }
    const sweeps = { rail: new Sweep(), railTop: new Sweep(), conductor: new Sweep(), bed: new Sweep() };
    for (const side of [1, -1]) {
      sweeps.rail.add(frames, shift(RAIL_PROFILE, side * railHalf, 0), { closed: true, ref: [side * railHalf, -0.07], origin });
      sweeps.railTop.add(frames, [[side * railHalf - 0.029, 0.0006], [side * railHalf + 0.029, 0.0006]], { ref: [side * railHalf, 1], origin });
    }
    for (const [z, top] of [[TRACK.positiveZ, TRACK.positiveTop], [0, TRACK.negativeTop]]) {
      sweeps.conductor.add(frames, shift(BAR_PROFILE, z, top), { closed: true, ref: [z, top - 0.03], origin });
    }
    sweeps.bed.add(frames, BED_PROFILE, { ref: [0, BED + 1], origin });
    for (const [k, mat] of [['rail', tm.rail], ['railTop', tm.railTop], ['conductor', tm.conductor], ['bed', bedMat]]) {
      const mesh = new THREE.Mesh(sweeps[k].geometry(), mat);
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    group.add(g);
    return { group: g, glows };
  }

  // Takes a piece down. Its instanced meshes share their shapes with every
  // other piece, so only their own attribute (instS) and instance data are
  // freed; the swept meshes are the piece's own.
  function dropChunk(c) {
    const ch = chunks.get(c);
    group.remove(ch.group);
    ch.group.traverse(o => {
      if (o.isInstancedMesh) {
        const g = o.geometry;
        for (const k of Object.keys(g.attributes)) if (k !== 'instS') g.deleteAttribute(k);
        g.setIndex(null);
        g.dispose();
        o.dispose();
      } else if (o.isMesh) o.geometry.dispose();
    });
    chunks.delete(c);
  }

  // the working lights nearest the camera get real lights
  const lampLights = [];
  if (lights) {
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffd4a0, 2.2, 14, 1.6);
      group.add(l);
      lampLights.push(l);
    }
    group.add(new THREE.HemisphereLight(0x9aa4b0, 0x302a26, 0.05));
  }

  const local = new THREE.Vector3();
  const inStation = (p) => station.uStOn.value > 0.5 && inStationLocal(local.copy(p).applyMatrix4(station.uStInv.value));
  const world = new THREE.Vector3();

  return {
    group,
    background: new THREE.Color(0x000000),
    fog: new THREE.FogExp2(0x000000, 0.018),
    envIntensity: 0.05,
    exposure: 1.25,
    winUniforms,
    // Builds the tunnel round the train and the camera (focusS is the
    // camera's distance along the line), takes it down elsewhere, and moves
    // the real lights to the lamps nearest the camera. Builds at most
    // `budget` pieces at a time, so a long jump doesn't stall a frame.
    // `range`, if given, is the stretch to build instead.
    update(trainS, focusS, budget = 3, range = null) {
      winUniforms.uTrainS.value = trainS;
      const lo = Math.floor((range ? range[0] : Math.min(focusS, trainS - train.length) - 190) / CHUNK);
      const hi = Math.floor((range ? range[1] : Math.max(focusS, trainS) + 230) / CHUNK);
      for (const c of [...chunks.keys()]) if (c < lo - 1 || c > hi + 1) dropChunk(c);
      // nearest the camera first
      const want = [];
      for (let c = lo; c <= hi; c++) if (!chunks.has(c)) want.push(c);
      want.sort((a, b) => Math.abs(a * CHUNK - focusS) - Math.abs(b * CHUNK - focusS));
      for (const c of want.slice(0, budget)) chunks.set(c, buildChunk(c));
      const left = Math.max(0, want.length - budget);
      for (const ch of chunks.values()) for (const s of ch.glows) s.visible = !inStation(world.copy(s.position).add(ch.group.position));
      const k0 = Math.round((focusS - LAMP_PHASE) / PERIOD);
      lampLights.forEach((l, i) => {
        const k = k0 + [0, 1, -1, 2][i];
        path.frame(k * PERIOD + LAMP_PHASE, f).apply(0, LAMP_Y - 0.12, lampZ + 0.2, l.position);
        l.visible = !inStation(l.position);
      });
      return left;
    },
  };
}
