// Shared GLSL: noise, signed distance functions and the watercolour
// primitives every scene paints with.
//
// Screen space: p.y runs from -1 (bottom) to 1 (top), p.x from -ASPECT to
// ASPECT. Scenes accumulate paint into a Paint struct:
//   od  optical density of transparent pigment (subtractive, like glazing)
//   gc  premultiplied colour of opaque paint on top (gold, white gouache)
//   ga  its coverage

export default /* glsl */ `
#define PI 3.14159265
#define TAU 6.28318531

struct Paint { vec3 od; vec3 gc; float ga; };

Paint noPaint() { return Paint(vec3(0.0), vec3(0.0), 0.0); }

// ---------------------------------------------------------------- noise

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

// Gradient noise, roughly -1..1.
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i) * 2.0 - 1.0, f);
  float b = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return 1.7 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * gnoise(p); p = ROT * p * 2.03 + vec2(3.1, 1.7); a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * gnoise(p); p = ROT * p * 2.03 + vec2(3.1, 1.7); a *= 0.5; }
  return s;
}
vec2 warp2(vec2 p) { return vec2(fbm3(p), fbm3(p + vec2(5.2, 1.3))); }

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// ---------------------------------------------------------------- shapes

float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// Tapered capsule from a (radius ra) to b (radius rb).
float sdTaper(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdEllipse(vec2 p, vec2 ab) { float k = length(p / ab); return (k - 1.0) * min(ab.x, ab.y); }
// Lens shape (an eye, a petal, a leaf): two circle arcs, width w, length h.
float sdVesica(vec2 p, float h, float w) {
  p = abs(p);
  float r = (h * h + w * w) / (2.0 * w), d = r - w;
  return ((p.y - h) * d > p.x * h) ? length(p - vec2(0.0, h)) : length(p - vec2(-d, 0.0)) - r;
}
// Arc of radius r from angle a0 to a1 (radians, counter-clockwise from +x).
float sdArc(vec2 p, float r, float a0, float a1) {
  float a = atan(p.y, p.x);
  float mid = 0.5 * (a0 + a1), half_ = 0.5 * (a1 - a0);
  float da = mod(a - mid + PI, TAU) - PI;
  if (abs(da) <= half_) return abs(length(p) - r);
  vec2 e0 = r * vec2(cos(a0), sin(a0)), e1 = r * vec2(cos(a1), sin(a1));
  return min(length(p - e0), length(p - e1));
}

// ---------------------------------------------------------------- pigments
// Reflectance of each pigment at full strength; od() turns it into density.

vec3 od(vec3 c) { return -log(clamp(c, 0.02, 1.0)); }

const vec3 INDIGO     = vec3(0.16, 0.19, 0.36);
const vec3 PRUSSIAN   = vec3(0.06, 0.22, 0.34);
const vec3 ULTRA      = vec3(0.22, 0.28, 0.74);
const vec3 COBALT     = vec3(0.25, 0.45, 0.82);
const vec3 CERULEAN   = vec3(0.35, 0.66, 0.86);
const vec3 TURQUOISE  = vec3(0.12, 0.62, 0.62);
const vec3 SAPGREEN   = vec3(0.38, 0.58, 0.22);
const vec3 GAMBOGE    = vec3(0.96, 0.76, 0.16);
const vec3 OCHRE      = vec3(0.82, 0.60, 0.28);
const vec3 SIENNA     = vec3(0.72, 0.36, 0.18);
const vec3 VERMILION  = vec3(0.92, 0.26, 0.14);
const vec3 ROSE       = vec3(0.92, 0.34, 0.52);
const vec3 VIOLET     = vec3(0.46, 0.26, 0.62);
const vec3 PAYNE      = vec3(0.22, 0.26, 0.32);
const vec3 SUMI       = vec3(0.07, 0.07, 0.08);

// ---------------------------------------------------------------- paper

float tooth(vec2 p) { return 0.5 + 0.35 * gnoise(p * 95.0) + 0.15 * gnoise(p * 260.0); }

vec3 paper(vec2 p) {
  float f1 = gnoise(rot(0.35) * p * vec2(240.0, 12.0));
  float f2 = gnoise(rot(-1.2) * p * vec2(170.0, 9.0));
  float fib = smoothstep(0.55, 0.95, abs(f1)) * 0.5 + smoothstep(0.6, 0.95, abs(f2)) * 0.4;
  float mott = fbm3(p * 2.2 + 7.0) * 0.5 + 0.5;
  vec3 c = vec3(0.958, 0.93, 0.872) * (1.0 - 0.04 * mott - 0.035 * tooth(p));
  return c + fib * vec3(0.022, 0.02, 0.014);
}

// Granulation: pigment settles into the valleys of the paper.
float gran(vec2 p, float amt) { return max(0.0, 1.0 + amt * (0.9 - 1.8 * tooth(p * 1.3 + 3.0))); }

// ---------------------------------------------------------------- watercolour

// Bumpy, organic edge offset for any shape.
float edgeWobble(vec2 p, float seed, float amt) {
  return amt * (0.8 * fbm3(p * 3.2 + seed) + 0.2 * gnoise(p * 16.0 + seed * 1.7));
}

// A wash filling d < 0: crisp dried edge, pigment pooled at the rim,
// mottled interior. rim is the width of the dark edge in screen units.
float wash(float d, vec2 p, float seed, float rim) {
  float body = smoothstep(0.004, -0.003, d);
  float pool = exp(-max(-d, 0.0) / rim);
  float mott = 0.62 + 0.5 * fbm3(p * 2.4 + seed);
  return body * (mott * 0.55 + pool * 0.8);
}

// Wet-in-wet: soft feathered edge, no rim.
float softWash(float d, vec2 p, float seed, float w) {
  float e = d + w * 0.6 * fbm3(p * 5.0 + seed);
  return smoothstep(w, -w, e) * (0.7 + 0.4 * fbm3(p * 2.0 + seed * 2.0));
}

// A horizontal band of wash between two wobbly edges (bottom y0, top y1),
// laid like one pass of a loaded brush across the page.
float band(vec2 p, float y0, float y1, float seed, float wob) {
  float e0 = y0 + wob * (fbm3(vec2(p.x * 1.3 + seed, seed)) + 0.6 * fbm3(vec2(p.x * 0.4 - seed, 3.0)));
  float e1 = y1 + wob * (fbm3(vec2(p.x * 1.1 - seed, seed * 2.0)) + 0.6 * fbm3(vec2(p.x * 0.35 + seed, 5.0)));
  float d = max(e0 - p.y, p.y - e1);
  return wash(d, p, seed, 0.022);
}

// Streaks of a dry brush dragged along x: 1 where pigment caught the paper.
float dryBrush(vec2 p, float seed, float amount) {
  float n = gnoise(vec2(p.x * 1.4 + seed, p.y * 34.0)) * 0.6 + gnoise(vec2(p.x * 4.0, p.y * 90.0 + seed)) * 0.4;
  return smoothstep(0.35 - amount, 0.55 - amount, n * 0.5 + 0.5);
}

// Dried backrun ("cauliflower") lines inside a wash.
float backrun(vec2 p, float seed, float k) {
  float n = fbm3(p * k + seed);
  return smoothstep(0.035, 0.0, abs(n - 0.12)) * 0.6;
}

// A loose brushed outline along the zero set of d. w is the stroke half-width.
float inkLine(float d, vec2 p, float w, float seed) {
  float press = 0.45 + 0.8 * smoothstep(-0.6, 0.7, gnoise(p * 1.6 + seed));
  float ww = w * press;
  float dry = smoothstep(-0.5, 0.3, gnoise(p * 10.0 + seed * 2.3));
  float core = smoothstep(ww, ww * 0.3, abs(d));
  float halo = exp(-abs(d) / (ww * 4.0)) * 0.15;
  return core * mix(0.35, 1.0, dry) + halo;
}

// Splatter: distance to the nearest of a field of random droplets.
float splatter(vec2 p, float seed, float cells, float rmax, float prob) {
  vec2 g = floor(p * cells), f = fract(p * cells);
  float d = 1e3;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = vec2(float(i), float(j));
    vec2 h = hash22(g + c + seed);
    float on = step(1.0 - prob, hash12(g + c + seed * 1.37));
    float r = rmax * (0.2 + 0.8 * h.x * h.x) * on;
    d = min(d, length(c + h - f) / cells - r + (1.0 - on) * 10.0);
  }
  return d;
}

// Symmetric (Rorschach) blot, mirrored about x = 0: a few elliptical lobes
// hugging the fold give the overall shape, and a noise field thresholded
// against them gives the fractal edge, holes and stray islands of a real
// folded-paper blot. Returns an approximate signed distance.
// grow scales the lobes; t makes the edge crawl slowly.
float blotSDF(vec2 p, float seed, float grow, float t, float spread) {
  vec2 q = vec2(abs(p.x), p.y);
  q += 0.08 * warp2(q * 1.7 + seed + t * 0.02);
  float env = -1.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 h = hash22(vec2(seed * 1.3 + fi * 7.13, fi * 3.7 - seed));
    vec2 c = vec2(h.x * h.x * 0.5, (h.y - 0.5) * 1.1) * spread;
    vec2 ax = vec2(0.1 + 0.22 * hash12(vec2(fi, seed)), 0.07 + 0.17 * hash12(vec2(seed, fi * 2.1))) * grow;
    vec2 dq = rot((h.y - 0.5) * 2.4) * (q - c);
    env = max(env, 1.0 - length(dq / ax));
  }
  float n = fbm(q * 2.4 + seed * 1.7) * 0.6 + gnoise(q * 11.0 + seed) * 0.1;
  float f = env + n - 0.08;
  return -f * 0.13;
}

// Gold leaf and dust (切箔・砂子): a sparse field of flakes.
float goldFlakes(vec2 p, float cells, float seed, float prob) {
  vec2 g = floor(p * cells), f = fract(p * cells);
  vec2 h = hash22(g + seed);
  float on = step(1.0 - prob, hash12(g * 1.7 + seed));
  vec2 d = rot(h.y * TAU) * (f - (0.25 + 0.5 * h));
  float s = max(abs(d.x), abs(d.y) * 1.3);
  float r = 0.06 + 0.2 * h.x;
  return on * smoothstep(r, r * 0.55, s);
}

vec3 goldCol(vec2 p, float t) {
  float s = fbm3(p * 5.0 + vec2(t * 0.07, -t * 0.05)) * 0.5 + 0.5;
  return mix(vec3(0.58, 0.42, 0.16), vec3(1.0, 0.87, 0.55), smoothstep(0.25, 0.85, s));
}

void addPig(inout Paint P, vec3 pigment, float amount) { P.od += od(pigment) * amount; }
void addOpaque(inout Paint P, vec3 col, float a) {
  a = clamp(a, 0.0, 1.0);
  P.gc = col * a + P.gc * (1.0 - a);
  P.ga = a + P.ga * (1.0 - a);
}
// Lift pigment off the page (scrubbing back towards the paper).
void lift(inout Paint P, float amount) { P.od *= 1.0 - clamp(amount, 0.0, 1.0); }

// 紺紙: the page dyed deep indigo, for the gold-on-indigo sections.
void konshi(inout Paint P, vec2 p, float dens) {
  float v = fbm3(p * 1.3 + 11.0) * 0.2 + gnoise(rot(0.2) * p * vec2(90.0, 6.0)) * 0.05;
  P.od += od(INDIGO) * dens * (1.0 + v);
}

// x * x: pow(x, 2.0) is undefined for x < 0 in GLSL, and some GPUs return NaN.
float sq(float x) { return x * x; }
// 0 before a, 1 after b, linear between.
float span01(float t, float a, float b) { return clamp((t - a) / max(b - a, 1e-3), 0.0, 1.0); }
float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float easeOut(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - (1.0 - x) * (1.0 - x); }
float win(float t, float a, float b, float fa, float fb) { return smoothstep(a, a + fa, t) * (1.0 - smoothstep(b - fb, b, t)); }
`;
