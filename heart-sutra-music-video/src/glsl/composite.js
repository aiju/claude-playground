// Builds the fragment shader that makes a frame: paints the current scene
// (and the next one during a transition), lays it on paper, then inks the
// lyrics on top. One program is built per scene, or per pair of scenes
// while one hands over to the next.

import lib from './lib.js';
import { shared, scenes } from './scenes.js';

export const vertex = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const header = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uTA, uTB, uVarA, uVarB, uMix;
uniform vec4 uBeatA0, uBeatA1, uBeatB0, uBeatB1;   // each scene's beats (see scenes.js)
uniform int uTrans;
uniform float uLevel, uPulse, uBeat;
uniform vec2 uHits[8];
uniform float uFade;          // 0 = paper white, 1 = full picture (start and end)
uniform sampler2D uText;      // lyric glyphs: colour + alpha
uniform sampler2D uTextCtl;   // r: how much is written, g: how wet it is
`;

const main = /* glsl */ `
float transMask(vec2 p, float m, int style) {
  float aspect = uRes.x / uRes.y;
  float n;
  if (style == 1) n = (p.x / aspect) * 0.5 + 0.5;          // wash in from the left
  else if (style == 2) n = 0.5 - p.y * 0.5;                 // flood down from the top
  else if (style == 3) n = length(p) * 0.45;                // bloom out from the centre
  else n = 0.5;                                             // soak through evenly
  n = n * 0.7 + 0.3 * (fbm(p * 1.6 + 17.0) * 0.5 + 0.5);
  float edge = m * 1.25 - 0.12;
  return smoothstep(n - 0.05, n + 0.05, edge);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);

  Paint P = sceneA(p, uTA, uVarA);
#ifdef TRANSITION
  float m = transMask(p, uMix, uTrans);
  if (m > 0.0) {
    Paint B = sceneB(p, uTB, uVarB);
    P.od = mix(P.od, B.od, m);
    P.gc = mix(P.gc, B.gc, m);
    P.ga = mix(P.ga, B.ga, m);
  }
#endif

  // pigment never lies perfectly even: flocculation and a little granulation everywhere
  P.od *= (0.86 + 0.28 * (fbm3(p * 3.5 + 5.0) * 0.5 + 0.5)) * gran(p * 0.8, 0.12);

  // lyrics
  vec2 tuv = vec2(vUv.x, 1.0 - vUv.y);
  vec4 ctl = texture(uTextCtl, tuv);
  vec4 tc = texture(uText, tuv);
  if (tc.a > 0.001 || ctl.g > 0.001) {
    vec2 wob = warp2(p * 7.0 + uTime * 0.3) * ctl.g * 0.0025;
    tc = texture(uText, tuv + wob);
    float blurA = textureLod(uText, tuv, 2.5).a;
    float n = 0.28 + 0.4 * (fbm3(p * 14.0) * 0.5 + 0.5);
    float vis = smoothstep(n - 0.06, n + 0.06, ctl.r);
    float a = tc.a * vis;
    float rim = clamp(tc.a - blurA, 0.0, 1.0) * vis;
    float bleed = blurA * vis * (0.12 + 0.35 * ctl.g);
    float grain = 0.86 + 0.14 * tooth(p * 1.1);
    vec3 ink = tc.rgb;   // uploaded with straight (not premultiplied) alpha
    // fresh ink is darker and glossier until it soaks in
    vec3 col = ink * (1.0 - 0.35 * rim) * (1.0 - 0.3 * ctl.g);
    vec3 halo = ink;
    bool gold = ink.r - ink.b > 0.3 && ink.g > 0.5;
    if (gold) {
      col = mix(goldCol(p * 1.5, uTime), ink, 0.25) * (1.0 - 0.4 * rim) * (1.0 + 0.2 * ctl.g);
      halo = vec3(0.3, 0.2, 0.07);
    }
    addOpaque(P, halo, bleed * 0.5);
    addOpaque(P, col, clamp(a * grain, 0.0, 1.0));
  }

  vec3 c = paper(p) * exp(-P.od);
  c = c * (1.0 - P.ga) + P.gc;

  // vignette like the edge of a sheet under lamplight
  float vig = smoothstep(2.4, 0.6, length(p * vec2(0.8, 1.0)));
  c *= mix(0.86, 1.0, vig);
  c = mix(paper(p), c, uFade);
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

// Fragment shader for scene a, handing over to scene b if given.
export function fragmentFor(a, b = null) {
  const A = scenes[a];
  if (!A) throw new Error(`no scene ${a}`);
  const B = b == null ? null : scenes[b];
  let src = header + (B ? '#define TRANSITION\n' : '') + lib + shared + A.src;
  if (B && b !== a) src += B.src;
  src += `
Paint sceneA(vec2 p, float t, float v) { Paint P = noPaint(); ${A.fn}(p, t, v, uBeatA0, uBeatA1, P); return P; }
`;
  if (B) src += `
Paint sceneB(vec2 p, float t, float v) { Paint P = noPaint(); ${B.fn}(p, t, v, uBeatB0, uBeatB1, P); return P; }
`;
  return src + main;
}
