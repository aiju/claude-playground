// The renderer. Each frame the game queues draw items (mesh + matrix + look),
// then render() runs: a shadow pass from the sun, the lit scene into a
// multisampled buffer, water, blob shadows and particles, and finally a
// tilt-shift and grading pass that gives the toy-diorama look.

import { createProgram, createTexture, createTarget, deleteTarget, Mesh } from './gl.js';
import { mat4, hexLin } from './math.js';

const MAX_LIGHTS = 12;
const SHADOW_SIZE = 2048;

const SWAY = `
vec3 sway(vec3 wp, float s) {
  float ph = u_time * 1.7 + wp.x * 0.55 + wp.z * 0.4;
  float gust = 0.7 + 0.3 * sin(u_time * 0.31 + wp.x * 0.05);
  wp.x += s * gust * (sin(ph) * 0.05 + sin(ph * 2.7 + 1.3) * 0.016);
  wp.z += s * gust * cos(ph * 0.83) * 0.03;
  return wp;
}`;

const LIT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec3 a_col;
layout(location=3) in vec2 a_ext;
uniform mat4 u_viewProj, u_model, u_lightMat;
uniform mat3 u_nmat;
uniform float u_time;
out vec3 v_wpos; out vec3 v_nrm; out vec3 v_col; out float v_emis; out vec4 v_lpos;
${SWAY}
void main() {
  vec4 wp = u_model * vec4(a_pos, 1.0);
  if (a_ext.y > 0.0) wp.xyz = sway(wp.xyz, a_ext.y);
  v_wpos = wp.xyz;
  v_nrm = u_nmat * a_nrm;
  v_col = a_col;
  v_emis = a_ext.x;
  v_lpos = u_lightMat * wp;
  gl_Position = u_viewProj * wp;
}`;

const COMMON_FS = `
uniform sampler2DShadow u_shadow;
uniform vec2 u_shadowTexel;
uniform vec3 u_sunDir, u_sunCol, u_skyCol, u_gndCol, u_fogCol, u_camPos;
uniform vec3 u_fog;
uniform float u_exposure;
uniform int u_nl;
uniform vec4 u_lp[${MAX_LIGHTS}];
uniform vec3 u_lc[${MAX_LIGHTS}];
float shadowAt(vec4 lp) {
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0;
  for (int i = -1; i <= 1; i++)
    for (int j = -1; j <= 1; j++)
      s += texture(u_shadow, vec3(p.xy + vec2(float(i), float(j)) * u_shadowTexel * 1.2, p.z - 0.0006));
  return s / 9.0;
}
vec3 pointLights(vec3 wpos, vec3 n) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= u_nl) break;
    vec3 L = u_lp[i].xyz - wpos;
    float d = length(L);
    float att = clamp(1.0 - d / u_lp[i].w, 0.0, 1.0);
    att *= att;
    acc += u_lc[i] * att * (max(dot(n, L / max(d, 0.001)), 0.0) * 0.75 + 0.25);
  }
  return acc;
}
vec3 finish(vec3 col, vec3 wpos) {
  float fd = length(u_camPos - wpos);
  float f = clamp((fd - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0) * u_fog.z;
  col = mix(col, u_fogCol, f);
  col *= u_exposure;
  // linear up to 0.8, then a soft shoulder so glows don't clip harshly
  vec3 over = max(col - 0.8, 0.0);
  col = min(col, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
  return pow(col, vec3(1.0 / 2.2));
}`;

const LIT_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_wpos; in vec3 v_nrm; in vec3 v_col; in float v_emis; in vec4 v_lpos;
uniform vec4 u_tint;
uniform float u_alpha, u_emisBoost, u_rim;
out vec4 o;
${COMMON_FS}
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int k = i.x + i.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[k] + 0.5) / 16.0;
}
void main() {
  if (u_alpha < 0.999 && u_alpha < bayer4(gl_FragCoord.xy)) discard;
  vec3 n = normalize(v_nrm);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(u_camPos - v_wpos);
  float ndl = dot(n, u_sunDir);
  float sh = ndl > 0.0 ? shadowAt(v_lpos) : 0.0;
  vec3 amb = mix(u_gndCol, u_skyCol, n.y * 0.5 + 0.5);
  vec3 light = amb + u_sunCol * max(ndl, 0.0) * sh + pointLights(v_wpos, n);
  vec3 col = v_col * light;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * u_rim;
  col += rim * (u_skyCol + u_sunCol * 0.3) * 0.6;
  col += v_col * (v_emis + u_emisBoost) * 1.6;
  col = mix(col, u_tint.rgb, u_tint.a);
  o = vec4(finish(col, v_wpos), 1.0);
}`;

const SHADOW_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=3) in vec2 a_ext;
uniform mat4 u_lightMat, u_model;
uniform float u_time;
${SWAY}
void main() {
  vec4 wp = u_model * vec4(a_pos, 1.0);
  if (a_ext.y > 0.0) wp.xyz = sway(wp.xyz, a_ext.y);
  gl_Position = u_lightMat * wp;
}`;
const SHADOW_FS = `#version 300 es
precision mediump float;
void main() {}`;

// Water: a semi-transparent animated surface over the lake/river bed.
// Colour channel r carries "shore" (1 at the bank, 0 in open water).
const WATER_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=2) in vec3 a_col;
uniform mat4 u_viewProj, u_lightMat;
uniform float u_time;
out vec3 v_wpos; out float v_shore; out vec4 v_lpos;
void main() {
  vec3 p = a_pos;
  p.y += sin(u_time * 1.4 + p.x * 1.1 + p.z * 0.7) * 0.02;
  v_wpos = p; v_shore = a_col.r;
  v_lpos = u_lightMat * vec4(p, 1.0);
  gl_Position = u_viewProj * vec4(p, 1.0);
}`;
const WATER_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_wpos; in float v_shore; in vec4 v_lpos;
uniform float u_time;
uniform vec3 u_deep, u_shallow;
out vec4 o;
${COMMON_FS}
float hgt(vec2 p) {
  float t = u_time;
  return sin(p.x * 2.1 + t * 1.3) * 0.5 + sin(p.y * 1.7 + t * 1.1 + p.x * 0.6) * 0.5
       + sin((p.x + p.y) * 3.7 - t * 2.1) * 0.22 + sin((p.x - p.y * 0.7) * 5.3 + t * 2.7) * 0.12;
}
void main() {
  vec2 p = v_wpos.xz;
  float e = 0.05;
  float h0 = hgt(p);
  vec3 n = normalize(vec3(-(hgt(p + vec2(e, 0.0)) - h0) / e * 0.06, 1.0, -(hgt(p + vec2(0.0, e)) - h0) / e * 0.06));
  vec3 V = normalize(u_camPos - v_wpos);
  float sh = shadowAt(v_lpos);
  vec3 base = mix(u_deep, u_shallow, smoothstep(0.0, 1.0, v_shore));
  vec3 amb = mix(u_gndCol, u_skyCol, 0.8);
  vec3 col = base * (amb + u_sunCol * (0.35 + 0.65 * sh) * max(dot(n, u_sunDir), 0.0)) + base * pointLights(v_wpos, n) * 0.6;
  float spec = pow(max(dot(reflect(-u_sunDir, n), V), 0.0), 90.0) * sh;
  col += u_sunCol * spec * 1.6;
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  col += u_skyCol * fres * 0.5;
  // shoreline foam that laps in and out
  float lap = sin(u_time * 1.6 - v_shore * 7.0 + hgt(p * 0.5) * 1.5);
  float foam = smoothstep(0.86, 0.97, v_shore + 0.05 * lap);
  float ring = v_shore + 0.06 * lap;
  foam += smoothstep(0.68, 0.7, ring) * (1.0 - smoothstep(0.7, 0.74, ring)) * 0.5;
  // sparkly caustic flecks
  float fl = smoothstep(0.92, 1.0, sin(p.x * 9.0 + h0 * 3.0 + u_time) * sin(p.y * 8.0 - h0 * 2.0 - u_time * 0.8));
  col += vec3(1.0) * fl * 0.25 * sh;
  col = mix(col, vec3(0.95, 0.98, 1.0) * (amb + u_sunCol * 0.6), clamp(foam, 0.0, 1.0) * 0.85);
  float a = mix(0.86, 0.6, v_shore) + foam * 0.4 + spec * 0.5;
  o = vec4(finish(col, v_wpos), clamp(a, 0.0, 1.0));
}`;

// Flat-colour program: blob shadows under actors and the hero's silhouette
// when hidden behind walls.
const FLAT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj, u_model;
out vec2 v_lp;
void main() {
  v_lp = a_pos.xz;
  gl_Position = u_viewProj * u_model * vec4(a_pos, 1.0);
}`;
const FLAT_FS = `#version 300 es
precision highp float;
in vec2 v_lp;
uniform vec4 u_color;
uniform float u_soft;
out vec4 o;
void main() {
  float a = u_color.a;
  if (u_soft > 0.0) a *= smoothstep(1.0, 0.35, length(v_lp));
  o = vec4(u_color.rgb, a);
}`;

// Point-sprite particles.
const SPRITE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
layout(location=2) in vec2 a_misc;
uniform mat4 u_viewProj;
uniform float u_pxScale;
out vec4 v_col; flat out float v_shape;
void main() {
  gl_Position = u_viewProj * vec4(a_pos, 1.0);
  gl_PointSize = max(a_misc.x * u_pxScale / gl_Position.w, 1.0);
  v_col = a_col; v_shape = a_misc.y;
}`;
const SPRITE_FS = `#version 300 es
precision highp float;
in vec4 v_col; flat in float v_shape;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a;
  if (v_shape < 0.5) a = smoothstep(1.0, 0.0, r);                 // soft glow
  else if (v_shape < 1.5) a = smoothstep(1.0, 0.8, r);            // solid dot
  else if (v_shape < 2.5) {                                       // twinkle star
    float s = max(1.0 - abs(d.x) * 9.0 - abs(d.y) * 1.6, 1.0 - abs(d.y) * 9.0 - abs(d.x) * 1.6);
    a = clamp(s, 0.0, 1.0) + smoothstep(0.5, 0.0, r) * 0.6;
  } else a = smoothstep(1.0, 0.6, r) * (0.6 + 0.4 * smoothstep(0.0, 1.0, r)); // puff ring
  o = vec4(v_col.rgb, v_col.a * a);
}`;

const POST_VS = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 v_uv;
void main() { vec2 p = P[gl_VertexID]; v_uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const TILT = `
uniform float u_tilt, u_focus;
float tiltRadius(float y) {
  // blur the far (top) part of the view more than the near part
  float d = y - u_focus;
  return (d > 0.0 ? smoothstep(0.22, 0.55, d) : smoothstep(0.38, 0.6, -d) * 0.6) * u_tilt;
}`;

const BLUR_H_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
out vec4 o;
${TILT}
void main() {
  float r = tiltRadius(v_uv.y);
  if (r < 0.05) { o = texture(u_tex, v_uv); return; }
  vec4 acc = vec4(0.0); float wsum = 0.0;
  for (int i = -4; i <= 4; i++) {
    float w = exp(-float(i * i) / 8.0);
    acc += texture(u_tex, v_uv + vec2(float(i) * r * 0.5 * u_texel.x, 0.0)) * w;
    wsum += w;
  }
  o = acc / wsum;
}`;

const FINAL_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_time, u_fade, u_gloom, u_vignette, u_aspect;
uniform vec4 u_flash;
uniform vec3 u_gloomCol;
uniform vec2 u_scroll;
out vec4 o;
${TILT}
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main() {
  float r = tiltRadius(v_uv.y);
  vec3 col;
  if (r < 0.05) col = texture(u_tex, v_uv).rgb;
  else {
    vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = -4; i <= 4; i++) {
      float w = exp(-float(i * i) / 8.0);
      acc += texture(u_tex, v_uv + vec2(0.0, float(i) * r * 0.5 * u_texel.y)).rgb * w;
      wsum += w;
    }
    col = acc / wsum;
  }
  vec2 sp = vec2((v_uv.x - 0.5) * u_aspect, v_uv.y - 0.5);
  // drifting gloom mist, anchored to the world so it scrolls with the camera
  if (u_gloom > 0.0) {
    vec2 q = sp * 2.2 + u_scroll;
    float m = fbm(q + vec2(u_time * 0.05, u_time * 0.02) + fbm(q * 0.7 - u_time * 0.03));
    float edge = smoothstep(0.25, 0.85, length(sp * vec2(0.8, 1.15)));
    float amt = clamp(u_gloom * (smoothstep(0.35, 0.8, m) * 0.7 + edge * 0.9), 0.0, 1.0);
    col = mix(col, u_gloomCol, amt * 0.75);
  }
  float vig = smoothstep(0.95, 0.25, length(sp * vec2(0.9, 1.2)));
  col *= mix(1.0 - u_vignette, 1.0, vig);
  col = mix(col, u_flash.rgb, u_flash.a);
  col *= 1.0 - u_fade;
  col += (h21(v_uv * 1000.0 + u_time) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.lit = createProgram(gl, LIT_VS, LIT_FS, 'lit');
    this.shadowProg = createProgram(gl, SHADOW_VS, SHADOW_FS, 'shadow');
    this.waterProg = createProgram(gl, WATER_VS, WATER_FS, 'water');
    this.flat = createProgram(gl, FLAT_VS, FLAT_FS, 'flat');
    this.spriteProg = createProgram(gl, SPRITE_VS, SPRITE_FS, 'sprite');
    this.blurH = createProgram(gl, POST_VS, BLUR_H_FS, 'blurH');
    this.final = createProgram(gl, POST_VS, FINAL_FS, 'final');
    this.emptyVao = gl.createVertexArray();

    // Shadow map
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Sprite buffer
    this.spriteData = new Float32Array(4096 * 9);
    this.spriteVao = gl.createVertexArray();
    this.spriteBuf = gl.createBuffer();
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.spriteData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 28);
    gl.bindVertexArray(null);

    // Unit disc for blob shadows (radius 1, in xz)
    const disc = [];
    const seg = 20;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      disc.push(0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0);
      disc.push(Math.cos(a1), 0, Math.sin(a1), 0, 1, 0, 0, 0, 0, 0, 0);
      disc.push(Math.cos(a0), 0, Math.sin(a0), 0, 1, 0, 0, 0, 0, 0, 0);
    }
    this.discMesh = new Mesh(gl, new Float32Array(disc));

    this.items = [];
    this.nItems = 0;
    this.water = [];
    this.blobs = [];
    this.silhouettes = [];
    this.sprites = { add: [], alpha: [] };
    this.lights = [];
    this.m = mat4.create();
    this.mstack = [];
    this.view = mat4.create();
    this.proj = mat4.create();
    this.viewProj = mat4.create();
    this.lightMat = mat4.create();
    this.nmat = new Float32Array(9);
    this.camPos = [0, 10, 10];
    this.camTarget = [0, 0, 0];
    this.shadowCenter = [0, 0, 0];
    this.shadowRadius = 14;
    this.time = 0;
    this.post = { fade: 0, flash: [1, 1, 1, 0], tilt: 2.2, focus: 0.5, gloom: 0, gloomCol: [0.62, 0.66, 0.72], vignette: 0.35, scroll: [0, 0] };
    this.setEnv({});
    this.resize();
  }

  setEnv(e) {
    const sd = e.sunDir || [-0.42, 1, 0.38];
    const l = Math.hypot(sd[0], sd[1], sd[2]);
    this.env = {
      sunDir: [sd[0] / l, sd[1] / l, sd[2] / l],
      sunCol: e.sunCol || [0.82, 0.76, 0.64],
      skyCol: e.skyCol || [0.34, 0.39, 0.48],
      gndCol: e.gndCol || [0.17, 0.15, 0.12],
      fogCol: e.fogCol || [0.6, 0.72, 0.85],
      fog: e.fog || [16, 40, 0.45],
      exposure: e.exposure ?? 1.0,
      rim: e.rim ?? 0.25,
      deep: e.deep || hexLin(0x1d6f8a),
      shallow: e.shallow || hexLin(0x5cc6c9),
      clear: e.clear || [0.05, 0.06, 0.08],
    };
  }

  resize() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    let h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    // keep the fill-rate sane on huge screens
    const maxPx = 2560 * 1440;
    if (w * h > maxPx) { const s = Math.sqrt(maxPx / (w * h)); w = Math.floor(w * s); h = Math.floor(h * s); }
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    if (this.msaaFb) {
      gl.deleteFramebuffer(this.msaaFb);
      gl.deleteRenderbuffer(this.msaaColor);
      gl.deleteRenderbuffer(this.msaaDepth);
      deleteTarget(gl, this.sceneT);
      deleteTarget(gl, this.blurT);
    }
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    this.msaaFb = gl.createFramebuffer();
    this.msaaColor = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaColor);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    this.msaaDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH24_STENCIL8, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msaaColor);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.msaaDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.sceneT = createTarget(gl, w, h);
    this.blurT = createTarget(gl, w, h);
  }

  // ---- camera ----
  setCamera(eye, target, fovy) {
    this.camPos = eye;
    this.camTarget = target;
    this.fovy = fovy;
    mat4.lookAt(this.view, eye, target, [0, 1, 0]);
    mat4.perspective(this.proj, fovy, this.w / this.h, 1, 120);
    mat4.mul(this.viewProj, this.proj, this.view);
  }

  // World position -> CSS pixel position on the canvas (for UI anchoring).
  project(x, y, z) {
    const p = mat4.transformPoint(this.viewProj, x, y, z);
    return [(p[0] * 0.5 + 0.5) * this.canvas.clientWidth, (0.5 - p[1] * 0.5) * this.canvas.clientHeight];
  }

  // ---- matrix stack used while queueing models ----
  reset() { mat4.identity(this.m); this.mstack.length = 0; return this; }
  push() { this.mstack.push(new Float32Array(this.m)); return this; }
  pop() { this.m = this.mstack.pop(); return this; }
  translate(x, y, z) { mat4.translate(this.m, this.m, x, y, z); return this; }
  rotX(a) { mat4.rotate(this.m, this.m, 0, a); return this; }
  rotY(a) { mat4.rotate(this.m, this.m, 1, a); return this; }
  rotZ(a) { mat4.rotate(this.m, this.m, 2, a); return this; }
  scale(x, y = x, z = x) { mat4.scale(this.m, this.m, x, y, z); return this; }

  // Queue a mesh with the current matrix.
  // opts: tint [r,g,b,a] (a = mix toward rgb), alpha (dithered), emis, shadow (cast), rim
  draw(mesh, opts) {
    if (!mesh || !mesh.count) return;
    let it = this.items[this.nItems];
    if (!it) { it = { m: new Float32Array(16) }; this.items[this.nItems] = it; }
    this.nItems++;
    it.mesh = mesh;
    it.m.set(this.m);
    it.tint = opts?.tint || null;
    it.alpha = opts?.alpha ?? 1;
    it.emis = opts?.emis ?? 0;
    it.cast = opts?.shadow ?? true;
    it.rim = opts?.rim ?? this.env.rim;
    it.stencil = opts?.stencil ?? false;
  }
  drawAt(mesh, x, y, z, ry = 0, s = 1, opts) {
    this.push(); this.translate(x, y, z); if (ry) this.rotY(ry); if (s !== 1) this.scale(s);
    this.draw(mesh, opts);
    this.pop();
  }

  drawWater(mesh) { if (mesh && mesh.count) this.water.push(mesh); }
  blob(x, y, z, r, a = 0.35) { this.blobs.push([x, y, z, r, a]); }
  silhouette(mesh, m) { this.silhouettes.push([mesh, new Float32Array(m || this.m)]); }
  // shape: 0 glow, 1 dot, 2 star, 3 puff
  sprite(x, y, z, size, r, g, b, a, shape = 0, additive = true) {
    (additive ? this.sprites.add : this.sprites.alpha).push(x, y, z, r, g, b, a, size, shape);
  }
  light(x, y, z, radius, r, g, b) { this.lights.push([x, y, z, radius, r, g, b]); }

  _setCommon(prog) {
    const gl = this.gl, u = prog.u, e = this.env;
    gl.uniform3fv(u.u_sunDir, e.sunDir);
    gl.uniform3fv(u.u_sunCol, e.sunCol);
    gl.uniform3fv(u.u_skyCol, e.skyCol);
    gl.uniform3fv(u.u_gndCol, e.gndCol);
    gl.uniform3fv(u.u_fogCol, e.fogCol);
    gl.uniform3fv(u.u_fog, e.fog);
    gl.uniform3fv(u.u_camPos, this.camPos);
    gl.uniform1f(u.u_exposure, e.exposure);
    gl.uniform2f(u.u_shadowTexel, 1 / SHADOW_SIZE, 1 / SHADOW_SIZE);
    gl.uniformMatrix4fv(u.u_lightMat, false, this.lightMat);
    gl.uniformMatrix4fv(u.u_viewProj, false, this.viewProj);
    gl.uniform1f(u.u_time, this.time);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.u_shadow, 0);
    // pick the lights nearest the camera target
    const tx = this.camTarget[0], tz = this.camTarget[2];
    const ls = this.lights.length > MAX_LIGHTS
      ? this.lights.slice().sort((a, b) => Math.hypot(a[0] - tx, a[2] - tz) - Math.hypot(b[0] - tx, b[2] - tz)).slice(0, MAX_LIGHTS)
      : this.lights;
    const lp = new Float32Array(MAX_LIGHTS * 4), lc = new Float32Array(MAX_LIGHTS * 3);
    ls.forEach((l, i) => {
      lp[i * 4] = l[0]; lp[i * 4 + 1] = l[1]; lp[i * 4 + 2] = l[2]; lp[i * 4 + 3] = l[3];
      lc[i * 3] = l[4]; lc[i * 3 + 1] = l[5]; lc[i * 3 + 2] = l[6];
    });
    gl.uniform1i(u.u_nl, ls.length);
    gl.uniform4fv(u.u_lp, lp);
    gl.uniform3fv(u.u_lc, lc);
  }

  render(dt) {
    const gl = this.gl;
    this.time += dt;
    const e = this.env;

    // ---- shadow pass ----
    const sc = this.shadowCenter, R = this.shadowRadius;
    const lv = mat4.create(), lp = mat4.create();
    const sd = e.sunDir;
    mat4.lookAt(lv, [sc[0] + sd[0] * 30, sc[1] + sd[1] * 30, sc[2] + sd[2] * 30], sc, [0, 1, 0]);
    mat4.ortho(lp, -R, R, -R, R, 1, 70);
    mat4.mul(this.lightMat, lp, lv);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 3.0);
    gl.useProgram(this.shadowProg.program);
    gl.uniformMatrix4fv(this.shadowProg.u.u_lightMat, false, this.lightMat);
    gl.uniform1f(this.shadowProg.u.u_time, this.time);
    for (let i = 0; i < this.nItems; i++) {
      const it = this.items[i];
      if (!it.cast || it.alpha < 0.5) continue;
      gl.uniformMatrix4fv(this.shadowProg.u.u_model, false, it.m);
      it.mesh.draw();
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // ---- main pass ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFb);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(e.clear[0], e.clear[1], e.clear[2], 1);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const L = this.lit;
    gl.useProgram(L.program);
    this._setCommon(L);
    // Stencil marks pixels where the hero is visible, so the silhouette pass
    // only shows the parts hidden behind something else.
    gl.enable(gl.STENCIL_TEST);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    let stencilRef = -1;
    for (let i = 0; i < this.nItems; i++) {
      const it = this.items[i];
      const ref = it.stencil ? 1 : 0;
      if (ref !== stencilRef) { gl.stencilFunc(gl.ALWAYS, ref, 0xff); stencilRef = ref; }
      gl.uniformMatrix4fv(L.u.u_model, false, it.m);
      mat4.normalMat(this.nmat, it.m);
      gl.uniformMatrix3fv(L.u.u_nmat, false, this.nmat);
      const t = it.tint;
      gl.uniform4f(L.u.u_tint, t ? t[0] : 0, t ? t[1] : 0, t ? t[2] : 0, t ? t[3] : 0);
      gl.uniform1f(L.u.u_alpha, it.alpha);
      gl.uniform1f(L.u.u_emisBoost, it.emis);
      gl.uniform1f(L.u.u_rim, it.rim);
      it.mesh.draw();
    }
    gl.disable(gl.STENCIL_TEST);

    // ---- blob shadows ----
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    const F = this.flat;
    gl.useProgram(F.program);
    gl.uniformMatrix4fv(F.u.u_viewProj, false, this.viewProj);
    if (this.blobs.length) {
      gl.uniform1f(F.u.u_soft, 1);
      const m = mat4.create();
      for (const [x, y, z, r, a] of this.blobs) {
        mat4.identity(m); mat4.translate(m, m, x, y + 0.02, z); mat4.scale(m, m, r, 1, r * 0.85);
        gl.uniformMatrix4fv(F.u.u_model, false, m);
        gl.uniform4f(F.u.u_color, 0.02, 0.03, 0.05, a);
        this.discMesh.draw();
      }
    }

    // ---- water ----
    if (this.water.length) {
      const W = this.waterProg;
      gl.useProgram(W.program);
      this._setCommon(W);
      gl.uniform3fv(W.u.u_deep, e.deep);
      gl.uniform3fv(W.u.u_shallow, e.shallow);
      for (const m of this.water) m.draw();
    }

    // ---- hero silhouette through walls ----
    if (this.silhouettes.length) {
      gl.useProgram(F.program);
      gl.uniform1f(F.u.u_soft, 0);
      gl.depthFunc(gl.GREATER);
      gl.enable(gl.STENCIL_TEST);
      gl.stencilFunc(gl.EQUAL, 0, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      gl.uniform4f(F.u.u_color, 0.35, 0.75, 1.0, 0.45);
      for (const [mesh, m] of this.silhouettes) {
        gl.uniformMatrix4fv(F.u.u_model, false, m);
        mesh.draw();
      }
      gl.disable(gl.STENCIL_TEST);
      gl.depthFunc(gl.LESS);
    }

    // ---- particles ----
    const P = this.spriteProg;
    gl.useProgram(P.program);
    gl.uniformMatrix4fv(P.u.u_viewProj, false, this.viewProj);
    gl.uniform1f(P.u.u_pxScale, this.h / (2 * Math.tan(this.fovy / 2)));
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    for (const [list, additive] of [[this.sprites.alpha, false], [this.sprites.add, true]]) {
      if (!list.length) continue;
      if (additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const n = Math.min(list.length / 9, 4096);
      const d = this.spriteData;
      for (let i = 0; i < n; i++) {
        const s = i * 9;
        d[s] = list[s]; d[s + 1] = list[s + 1]; d[s + 2] = list[s + 2];
        d[s + 3] = list[s + 3]; d[s + 4] = list[s + 4]; d[s + 5] = list[s + 5]; d[s + 6] = list[s + 6];
        d[s + 7] = list[s + 7]; d[s + 8] = list[s + 8];
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 9);
      gl.drawArrays(gl.POINTS, 0, n);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // ---- resolve MSAA, then post ----
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaaFb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.sceneT.fb);
    gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.emptyVao);
    const pp = this.post;
    const tiltPx = pp.tilt * (this.h / 1080);
    // horizontal blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurT.fb);
    gl.useProgram(this.blurH.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneT.tex);
    gl.uniform1i(this.blurH.u.u_tex, 0);
    gl.uniform2f(this.blurH.u.u_texel, 1 / this.w, 1 / this.h);
    gl.uniform1f(this.blurH.u.u_tilt, tiltPx);
    gl.uniform1f(this.blurH.u.u_focus, pp.focus);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // vertical blur + grading to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const U = this.final.u;
    gl.useProgram(this.final.program);
    gl.bindTexture(gl.TEXTURE_2D, this.blurT.tex);
    gl.uniform1i(U.u_tex, 0);
    gl.uniform2f(U.u_texel, 1 / this.w, 1 / this.h);
    gl.uniform1f(U.u_tilt, tiltPx);
    gl.uniform1f(U.u_focus, pp.focus);
    gl.uniform1f(U.u_time, this.time);
    gl.uniform1f(U.u_fade, pp.fade);
    gl.uniform1f(U.u_gloom, pp.gloom);
    gl.uniform3fv(U.u_gloomCol, pp.gloomCol);
    gl.uniform2fv(U.u_scroll, pp.scroll);
    gl.uniform1f(U.u_vignette, pp.vignette);
    gl.uniform1f(U.u_aspect, this.w / this.h);
    gl.uniform4fv(U.u_flash, pp.flash);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);

    // clear queues
    this.nItems = 0;
    this.water.length = 0;
    this.blobs.length = 0;
    this.silhouettes.length = 0;
    this.sprites.add.length = 0;
    this.sprites.alpha.length = 0;
    this.lights.length = 0;
  }
}
