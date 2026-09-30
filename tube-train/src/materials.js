// The materials, shared by every car.
//
// Inside, the cars are lit by two long strips of lights along the ceiling.
// Rather than place dozens of lights, the interior materials add the light of
// two infinitely long line sources to their shading. Because the train runs
// along x and never leaves z = 0, that is the same for every car.

import * as THREE from 'three';
import { COLOURS } from './dims.js';
import { moquetteTexture, floorTexture, glowTexture } from './textures.js';
import { frontTextures, frontEmissive } from './nose.js';

export const lighting = {
  saloon: { value: 1.0 },             // brightness of the saloon lights
  lineY: { value: 2.66 },
  lineZ: { value: 0.60 },
};

// Adds extra light to a MeshStandardMaterial or MeshPhysicalMaterial. Each
// term has GLSL declarations and a body that adds irradiance to `extraIrr`
// from the world position `wp` and normal `wn`.
export function addLightTerms(material, terms) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    for (const t of terms) Object.assign(shader.uniforms, t.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vXtPos;\nvarying vec3 vXtNormal;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        {
          mat4 xm = modelMatrix;
          #ifdef USE_INSTANCING
            xm = modelMatrix * instanceMatrix;
          #endif
          vXtPos = (xm * vec4(transformed, 1.0)).xyz;
          vXtNormal = normalize(mat3(xm) * objectNormal);
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vXtPos;
        varying vec3 vXtNormal;
        ${terms.map(t => t.decl).join('\n')}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec3 wp = vXtPos;
          vec3 wn = normalize(vXtNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 extraIrr = vec3(0.0);
          ${terms.map(t => `{ ${t.body} }`).join('\n')}
          reflectedLight.indirectDiffuse += extraIrr * BRDF_Lambert(diffuseColor.rgb);
        }`);
  };
  const key = terms.map(t => t.key).join('+');
  material.customProgramCacheKey = () => key;
  return material;
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
  return m;
}

// redraw the front displays
export function setFrontDisplays(materials, opts) {
  const old = materials.nose.emissiveMap;
  materials.nose.emissiveMap = frontEmissive(opts);
  materials.nose.needsUpdate = true;
  old?.dispose();
}
