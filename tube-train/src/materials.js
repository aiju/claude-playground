// The materials, shared by every car.
//
// Inside, the cars are lit by two long strips of lights along the ceiling.
// Rather than place dozens of lights, the interior materials add the light of
// two infinitely long line sources to their shading. Because the train runs
// along x and never leaves z = 0, that is the same for every car.

import * as THREE from 'three';
import { COLOURS } from './dims.js';
import { moquetteTexture, floorTexture, glowTexture, ledTexture } from './textures.js';
import { frontTextures, frontEmissive } from './nose.js';

export const lighting = {
  saloon: { value: 1.0 },             // brightness of the saloon lights
  lineY: { value: 2.66 },
  lineZ: { value: 0.60 },
};

// Adds extra light to a MeshStandardMaterial or MeshPhysicalMaterial. Each
// term has GLSL declarations and a body that adds irradiance to `extraIrr`
// from the world position `wp` and normal `wn` (or discards the fragment),
// and can pass more from the vertex shader (`vdecl`, `vbody`). Terms
// accumulate: a material can be given more of them later.
export function addLightTerms(material, terms) {
  const all = material.userData.lightTerms;
  if (all) {
    for (const t of terms) if (!all.some(a => a.key === t.key)) all.push(t);
    return material;
  }
  material.userData.lightTerms = [...terms];
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    const list = material.userData.lightTerms;
    for (const t of list) Object.assign(shader.uniforms, t.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vXtPos;
        varying vec3 vXtNormal;
        ${[...new Set(list.flatMap(t => [].concat(t.vdecl || [])))].join('\n')}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        {
          mat4 xm = modelMatrix;
          #ifdef USE_INSTANCING
            xm = modelMatrix * instanceMatrix;
          #endif
          vXtPos = (xm * vec4(transformed, 1.0)).xyz;
          vXtNormal = normalize(mat3(xm) * objectNormal);
          ${list.map(t => t.vbody || '').join('\n')}
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vXtPos;
        varying vec3 vXtNormal;
        ${[...new Set(list.flatMap(t => [].concat(t.decl)))].join('\n')}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec3 wp = vXtPos;
          vec3 wn = normalize(vXtNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 extraIrr = vec3(0.0);
          ${list.map(t => `{ ${t.body} }`).join('\n')}
          reflectedLight.indirectDiffuse += extraIrr * BRDF_Lambert(diffuseColor.rgb);
        }`);
  };
  material.customProgramCacheKey = () => material.userData.lightTerms.map(t => t.key).join('+');
  return material;
}

// The station: where it is (as the inverse of its frame, taking world
// positions into the station's own: x from 0 to uStLen along the platform,
// y up, z to the right, where the platform is) and whether its lights are on
// (they are off in the depot). Station materials, the tunnel near it and the
// train's outside all take its light.
export const station = {
  uStInv: { value: new THREE.Matrix4() },
  uStLen: { value: 140 },
  uStOn: { value: 0 },
};

const STATION_UNIFORMS = `
  uniform mat4 uStInv;
  uniform float uStLen, uStOn;
  vec3 stationLocal(vec3 p) { return (uStInv * vec4(p, 1.0)).xyz; }`;

// Light in the station: two long light troughs, one over the platform (on
// the +z side) and one over the track, plus the light bouncing off the tiles.
export function stationTerm() {
  return {
    key: 'station-light',
    uniforms: station,
    decl: [STATION_UNIFORMS, `
      float stationLine(vec3 p, vec3 n, vec2 at) {
        vec2 d = at - p.yz;
        float dist = max(length(d), 0.15);
        vec2 l = d / dist;
        float facing = max(dot(n.yz, l), 0.0) * 0.8 + 0.2;
        float lobe = 0.35 + 0.65 * max(-l.x, 0.0);
        return facing * lobe / (dist + 0.6);
      }
      float stationInside(vec3 p) {
        float along = smoothstep(-10.0, 3.0, p.x) * (1.0 - smoothstep(uStLen - 3.0, uStLen + 10.0, p.x));
        return along * step(abs(p.z - 1.0), 8.0) * step(abs(p.y - 1.5), 8.0);
      }`],
    body: `
      vec3 sp = stationLocal(wp);
      float inside = stationInside(sp) * uStOn;
      if (inside > 0.001) {
        vec3 sn = normalize(mat3(uStInv) * wn);
        float e = 2.6 * stationLine(sp, sn, vec2(3.95, 3.0)) + 1.6 * stationLine(sp, sn, vec2(4.45, 0.3));
        float bounce = 0.35 + 0.15 * max(sn.y, 0.0);
        extraIrr += (e + bounce) * inside * vec3(1.0, 0.96, 0.9);
      }`,
  };
}

// Cuts the running tunnel away where the station is.
export function clipTerm() {
  return {
    key: 'station-clip',
    uniforms: station,
    decl: STATION_UNIFORMS,
    body: `{
      vec3 sp = stationLocal(wp);
      if (uStOn > 0.5 && sp.x > 0.01 && sp.x < uStLen - 0.01 && abs(sp.z - 1.0) < 6.0 && sp.y > -3.0 && sp.y < 7.0) discard;
    }`,
  };
}

// The saloon lights: two line lights along x, shining down and inwards.
export function saloonTerm({ gain = 1.5, ambient = 0.28 } = {}) {
  return {
    key: `saloon-${gain}-${ambient}`,
    uniforms: { uSaloon: lighting.saloon, uLineY: lighting.lineY, uLineZ: lighting.lineZ },
    decl: `
      uniform float uSaloon, uLineY, uLineZ;
      float saloonLine(vec3 p, vec3 n, float z) {
        vec2 d = vec2(uLineY, z) - p.yz;
        float dist = max(length(d), 0.08);
        vec2 l = d / dist;
        float facing = max(dot(n.yz, l), 0.0) * 0.85 + 0.15;
        vec2 emit = normalize(vec2(-1.0, -0.45 * sign(z)));
        float lobe = max(dot(-l, emit), 0.0);
        return facing * lobe / (dist + 0.35);
      }`,
    body: `
      float e = saloonLine(wp, wn, uLineZ) + saloonLine(wp, wn, -uLineZ);
      extraIrr += vec3(e * ${gain.toFixed(3)} + ${ambient.toFixed(3)}) * uSaloon * vec3(1.0, 0.97, 0.92);`,
  };
}

export function withSaloonLight(material, opts) { return addLightTerms(material, [saloonTerm(opts)]); }

// Glass that you see through, darkened, with reflections added on top
// rather than faded out with the opacity.
function glass({ tint = 0x0a1418, opacity = 0.3, roughness = 0.04 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: tint, roughness, metalness: 0, transparent: true, opacity,
    depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.0,
    specularIntensity: 1, ior: 1.5,
  });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  return m;
}

export function createMaterials() {
  const paint = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.38, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.12, ...extra,
  });
  const matte = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

  const moquette = moquetteTexture();
  moquette.repeat.set(2, 2);
  const floor = floorTexture();

  const m = {
    // outside
    white: paint(COLOURS.white),
    red: paint(COLOURS.red),
    blue: paint(COLOURS.blue),
    roof: paint(COLOURS.roof, { roughness: 0.55, clearcoat: 0.2 }),
    mask: paint(COLOURS.mask, { roughness: 0.25, clearcoat: 0.8 }),
    rubber: matte(0x111213, 0.75),
    glass: glass(),
    frame: matte(0x2a2c2f, 0.55, { metalness: 0.3 }),
    underframe: matte(0x26292b, 0.7, { metalness: 0.2 }),
    bogie: matte(0x2f3336, 0.65, { metalness: 0.25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9da3a8, roughness: 0.32, metalness: 0.95 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0x4d4f52, roughness: 0.5, metalness: 0.7 }),
    yellow: paint(0xf2c200, { clearcoat: 0.1, roughness: 0.5 }),
    shoeBeam: matte(0x2b221c, 0.9),
    // inside
    lining: withSaloonLight(matte(0xe9e9e4, 0.6, { envMapIntensity: 0.25 })),
    liningGrey: withSaloonLight(matte(0x9ea3a8, 0.6, { envMapIntensity: 0.25 })),
    doorInside: withSaloonLight(matte(0xc9ccd0, 0.5, { envMapIntensity: 0.25 })),
    floor: withSaloonLight(matte(0xffffff, 0.85, { map: floor, envMapIntensity: 0.2 })),
    seat: withSaloonLight(matte(0xffffff, 0.95, { map: moquette, envMapIntensity: 0.15 })),
    seatFrame: withSaloonLight(matte(0x5c6168, 0.5, { metalness: 0.3, envMapIntensity: 0.3 })),
    pole: withSaloonLight(new THREE.MeshStandardMaterial({ color: COLOURS.pole, roughness: 0.3, metalness: 0.2, envMapIntensity: 0.5 })),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6ea, emissiveIntensity: 1.6, roughness: 0.4 }),
    screen: glass({ tint: 0x40484e, opacity: 0.1 }),
    cabLining: matte(0x2e3134, 0.75, { envMapIntensity: 0.3 }),
    cabFloor: matte(0x1f2023, 0.9),
  };
  m.lamp.userData.baseEmissive = 1.6;
  m.endPaint = m.white;
  // lamps, lit and unlit
  m.lampOff = new THREE.MeshPhysicalMaterial({ color: 0x1a1c1f, roughness: 0.15, clearcoat: 1, metalness: 0.3 });
  m.headLit = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 6 });
  m.tailLit = new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff1a0a, emissiveIntensity: 5 });
  const glow = glowTexture();
  const sprite = (color, opacity) => new THREE.SpriteMaterial({ map: glow, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  m.headGlow = sprite(0xe8f0ff, 0.9);
  m.tailGlow = sprite(0xff2410, 0.9);
  m.lampGlow = sprite(0xffc27a, 0.8);

  // the cab front: paint with the glass cut out, and the glass
  const front = frontTextures();
  m.nose = new THREE.MeshPhysicalMaterial({
    map: front.paint, alphaTest: 0.5, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.1,
    emissive: 0xffffff, emissiveMap: frontEmissive(), emissiveIntensity: 1.4,
  });
  // the inside of the cab front, dark, with the same holes for the glass
  m.noseInside = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, map: front.paint, alphaTest: 0.5, roughness: 0.85, side: THREE.BackSide });
  m.noseGlass = glass({ opacity: 0.32 });
  m.noseGlass.alphaMap = front.glass;
  m.noseGlass.alphaTest = 0.1;
  // everything on the outside of the train is lit by a station it stands in
  for (const k of ['white', 'red', 'blue', 'roof', 'mask', 'rubber', 'frame', 'underframe', 'bogie', 'steel', 'wheel', 'yellow', 'shoeBeam', 'nose', 'lampOff']) {
    addLightTerms(m[k], [stationTerm()]);
  }
  // each driving car has its own number on the front
  const noses = new Map([['11047', m.nose]]);
  m.noseFor = (number) => {
    if (!noses.has(number)) {
      const n = m.nose.clone();
      n.userData = {};
      n.map = frontTextures({ number }).paint;
      addLightTerms(n, [stationTerm()]);
      noses.set(number, n);
    }
    return noses.get(number);
  };
  // the destination display on each side of each car
  m.sideDisplay = new THREE.MeshBasicMaterial({ map: sideDisplayTexture('Walthamstow Central'), toneMapped: false });
  return m;
}

function sideDisplayTexture(text) {
  return ledTexture(text, { cols: 96, rows: 12, font: 'bold 10px Arial, sans-serif', dot: 6 });
}

// redraw the destination displays, on the fronts and the sides
export function setFrontDisplays(materials, opts) {
  const old = materials.nose.emissiveMap;
  const map = frontEmissive(opts);
  for (const number of ['11047', '11048']) {
    const n = materials.noseFor(number);
    n.emissiveMap = map;
    n.needsUpdate = true;
  }
  old?.dispose();
  materials.sideDisplay.map.dispose();
  materials.sideDisplay.map = sideDisplayTexture(opts.destination);
}
