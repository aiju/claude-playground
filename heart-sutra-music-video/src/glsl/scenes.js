// One GLSL function per scene. Each scene is compiled into its own shader
// program (together with the next scene during a transition), so only the
// code that is on screen runs.
//
// Each scene function gets the screen position p, the time t
// in seconds since the scene started (negative while it fades in early),
// a variant number for scenes that are reused, and its beats: the moments
// it acts on, listed with the scene in timeline.js. k0 holds the start of
// beats 0..3 and k1 their ends, both in scene time. It paints into P.
//
// Uniforms available here: uTime (song time), uLevel (loudness 0..1),
// uPulse (decaying hit envelope 0..1), uBeat (beat phase 0..1),
// uHits[i] = (seconds since hit, strength) for the last few drum hits,
// newest first.

// Helpers more than one scene uses.
export const shared = /* glsl */ `
// ---------------------------------------------------------------- shared motifs

// A standing figure in a robe; origin at the feet, about 1 unit tall.
float sdFigure(vec2 q) {
  float head = sdEllipse(q - vec2(0.01, 0.9), vec2(0.082, 0.098));
  float neck = sdSeg(q, vec2(0.0, 0.8), vec2(0.0, 0.73)) - 0.04;
  // robe narrow at the shoulders, flaring to an uneven hem
  float robe = sdTaper(q, vec2(0.0, 0.68), vec2(0.02, 0.02), 0.13, 0.27);
  robe = max(robe, -(q.y - 0.015 * sin(q.x * 20.0)));
  // wide sleeves hanging from the shoulders
  float sleeves = sdTaper(vec2(abs(q.x), q.y), vec2(0.11, 0.66), vec2(0.21, 0.3), 0.05, 0.1);
  return smin(smin(smin(head, neck, 0.03), robe, 0.05), sleeves, 0.04);
}

// A small boat: a crescent hull with the traveller standing in it.
float sdBoat(vec2 q) {
  float hull = max(sdCircle(q - vec2(0.0, 0.3), 0.4), q.y + 0.03);
  hull = max(hull, -sdCircle(q - vec2(0.0, 0.34), 0.39) - 0.012 + step(0.0, -q.y - 0.03) * 0.0);
  float man = sdFigure((q - vec2(0.05, -0.03)) / 0.22) * 0.22;
  float pole = sdSeg(q, vec2(-0.2, -0.16), vec2(0.12, 0.3)) - 0.006;
  return min(min(hull, man), pole);
}

// Ink splash thrown by a drum hit: spiky body, satellite droplets.
float sdSplash(vec2 q, float seed, float size) {
  float r = length(q), a = atan(q.y, q.x);
  float body = 0.55 + 0.3 * fbm3(vec2(a * 1.3, seed));
  float rays = pow(max(0.0, gnoise(vec2(a * 5.0, seed * 1.7))), 2.5) * 1.1;
  float d = r - size * (body + rays);
  float sat = splatter(q / size + seed, seed, 2.6, 0.13, 0.4) * size;
  d = min(d, sat + smoothstep(size * 0.8, size * 2.0, r) * 1.0);
  return d + edgeWobble(q / size, seed, 0.03) * size;
}

// A bamboo stalk in three shades of sumi: segments with small gaps at the nodes.
void bamboo(inout Paint P, vec2 p, float x0, float w, float lean, float seg, float dens, float seed) {
  float x = p.x - x0 - lean * p.y;
  if (abs(x) > w * 2.0 + 0.02) return;
  float yy = p.y / seg + hash11(seed) * 3.0;
  float f = fract(yy);
  float gap = smoothstep(0.0, 0.025, f) * smoothstep(1.0, 0.975, f);
  float shade = 0.7 + 0.35 * smoothstep(0.3, 0.0, f) + 0.25 * smoothstep(0.75, 1.0, f);
  float body = abs(x) - w * (1.0 + 0.08 * gnoise(vec2(yy * 3.0, seed)));
  float s = wash(body + edgeWobble(p * vec2(4.0, 0.6), seed, 0.003), p, seed, w * 0.35) * gap;
  float streak = 0.72 + 0.4 * (gnoise(vec2(x * 180.0 / w * 0.02, yy * 2.0 + seed)) * 0.5 + 0.5);
  float side = 0.8 + 0.45 * smoothstep(-w, w, x);
  P.od += od(SUMI) * s * dens * shade * streak * side;
  float dy = min(f, 1.0 - f) * seg;
  float mark = smoothstep(0.007, 0.002, dy) * step(abs(x), w * 1.35);
  P.od += od(SUMI) * mark * dens * 0.9;
}

void bambooLeaves(inout Paint P, vec2 p, vec2 base, float dir, float len, float dens, float seed, float t) {
  if (length(p - base) > len * 2.3 + 0.05) return;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ang = dir * (0.5 + fi * 0.42) + 0.05 * sin(t * 0.8 + fi + seed);
    float L = len * (0.75 + 0.35 * hash11(fi + seed));
    vec2 q = rot(-ang) * (p - base) - vec2(0.0, -L);
    float d = sdVesica(q, L, L * 0.16);
    P.od += od(SUMI) * wash(d + edgeWobble(q * 2.0, fi + seed, 0.004), q, seed, 0.012) * dens * (1.1 + 0.3 * smoothstep(0.0, L, q.y + L));
  }
}

void seaBase(vec2 p, float t, inout Paint P, float darkness) {
  konshi(P, p, 1.05 + darkness);
  float up = smoothstep(-0.9, 1.25, p.y);
  lift(P, up * 0.5);
  // light shafts from far above
  float sh = 0.5 + 0.5 * sin((p.x + p.y * 0.38) * 5.0 + fbm3(vec2(p.x * 1.5, t * 0.05)) * 2.5 + t * 0.08);
  sh = pow(sh, 3.0) * up;
  lift(P, sh * 0.35);
  addPig(P, TURQUOISE, 0.35 * up + 0.15 * sh);
  addPig(P, CERULEAN, 0.25 * sh);
  // drifting strata of pigment
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = 0.45 - fi * 0.42 + 0.1 * sin(t * 0.07 + fi);
    float d = abs(p.y - y + 0.12 * fbm3(vec2(p.x * 0.9 + t * 0.03 + fi * 5.0, fi))) - 0.09;
    P.od += od(mix(PRUSSIAN, TURQUOISE, 0.5 + 0.5 * sin(fi * 2.0))) * softWash(d, p, fi, 0.1) * 0.35;
  }
}
`;

export const scenes = {
  0: { fn: 'sBowl', src: /* glsl */ `
// ================================================================ 0 · 鈴 singing bowl
void sBowl(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  konshi(P, p, 1.3);
  // a dark bloom breathing at the centre, under the ॐ
  float d = blotSDF(p * 1.5, 3.0, 0.75 + 0.08 * sin(t * 0.6), t, 0.9);
  P.od += od(PRUSSIAN) * softWash(d, p, 2.0, 0.15) * 0.6;
  // bowl strikes: rings of lifted water and gold dust
  for (int i = 0; i < 4; i++) {
    float age = t - k0[i];
    if (age < 0.0) continue;
    float r = 0.1 + age * 0.26;
    float w = 0.012 + age * 0.014;
    float wob = 0.02 * fbm3(p * 3.0 + float(i));
    float band_ = exp(-pow((length(p) - r + wob) / w, 2.0));
    float k = exp(-age * 0.33);
    lift(P, band_ * 0.22 * k);
    addPig(P, CERULEAN, band_ * 0.1 * k);
    addOpaque(P, goldCol(p, t) * 0.8, band_ * k * 0.08);
    addOpaque(P, goldCol(p * 2.0, t), goldFlakes(p, 150.0, float(i), 0.45) * band_ * k);
  }
  // scattered cut gold leaf, rising slowly
  vec2 q = p + vec2(0.0, -t * 0.012);
  addOpaque(P, goldCol(q, t), goldFlakes(q, 18.0, 7.0, 0.07) * 0.85);
  addOpaque(P, goldCol(q, t), goldFlakes(q, 70.0, 3.0, 0.05) * 0.7);
}
` },
  1: { fn: 'sPrajna', src: /* glsl */ `
// ================================================================ 1 · 般若 prajñā
void sPrajna(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  konshi(P, p, 1.3);
  float g = 0.75 + 0.3 * easeOut(t / 9.0) + 0.05 * uPulse;
  vec2 q = p * 1.1 - vec2(0.0, 0.1);
  float d = blotSDF(q, 21.0, g, t, 1.0);
  float body = wash(d, q, 21.0, 0.025);
  lift(P, body * 0.7);
  addPig(P, TURQUOISE, body * 0.3);
  addPig(P, VIOLET, body * smoothstep(0.1, -0.4, q.y) * 0.2);
  addPig(P, ULTRA, softWash(d - 0.05, q, 22.0, 0.06) * 0.35);
  P.od += od(PRUSSIAN) * exp(-max(-d, 0.0) / 0.015) * smoothstep(0.004, -0.004, d) * 0.6;
  addOpaque(P, goldCol(p, t), inkLine(d, q, 0.003, 22.0) * 0.75);
  // gold dust rising in the pulse
  vec2 r = p + vec2(0.012 * sin(p.y * 4.0 + t), -t * 0.05);
  addOpaque(P, goldCol(r, t), goldFlakes(r, 60.0, 23.0, 0.06) * 0.9);
  addOpaque(P, goldCol(r, t), goldFlakes(r * 1.7, 120.0, 24.0, 0.05) * (0.5 + 0.5 * uPulse));
}
` },
  2: { fn: 'sDescent', src: /* glsl */ `
// ================================================================ 2 · 沈む descent
void sDescent(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  konshi(P, p, 1.25);
  float up = smoothstep(-1.0, 1.4, p.y);
  lift(P, up * 0.25);
  // the bloom: a jellyfish drifting down past us
  vec2 c = vec2(-0.35, 0.2 - 0.01 * t + 0.02 * sin(t * 0.9));
  vec2 q = p - c;
  float pulse = 1.0 + 0.05 * sin(t * 2.2) + 0.04 * uPulse;
  vec2 bq = q / vec2(pulse, 2.0 - pulse);
  float dome = sdEllipse(bq, vec2(0.46, 0.34));
  float scallop = bq.y + 0.03 - 0.03 * abs(sin(bq.x * 13.0 + 0.3 * sin(t)));
  float bell = max(dome, -scallop) + edgeWobble(bq * 1.5, 31.0, 0.02);
  float b = wash(bell, q, 31.0, 0.035);
  lift(P, b * 0.75);
  addPig(P, TURQUOISE, b * 0.25);
  addPig(P, CERULEAN, b * smoothstep(0.0, 0.3, bq.y) * 0.15);
  addPig(P, VIOLET, softWash(bell - 0.03, q, 33.0, 0.08) * 0.3);
  // four petals inside the bell, folded like an inkblot
  float inner = blotSDF((bq - vec2(0.0, 0.14)) * 3.4, 32.0, 0.75, t, 0.55);
  float ib = wash(inner, bq, 32.0, 0.01) * smoothstep(0.004, -0.004, bell);
  lift(P, ib * 0.3);
  addPig(P, ROSE, ib * 0.4);
  addPig(P, VIOLET, ib * 0.15);
  addOpaque(P, goldCol(q, t), inkLine(bell, q, 0.003, 34.0) * 0.75);
  // frilled oral arms and fine tendrils trailing below, mirrored
  vec2 m = vec2(abs(q.x), q.y);
  float below = smoothstep(0.0, -0.08, m.y);
  float arm = abs(m.x - 0.06 - 0.035 * sin(m.y * 9.0 + t * 1.4)) - 0.022 * (1.0 + 0.5 * gnoise(vec2(m.y * 30.0, t))) * smoothstep(-0.95, -0.2, m.y);
  float ab = wash(arm + edgeWobble(m * 3.0, 38.0, 0.006), m, 38.0, 0.008) * below * smoothstep(-0.95, -0.55, m.y);
  lift(P, ab * 0.4);
  addPig(P, ROSE, ab * 0.35);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x0 = 0.14 + fi * 0.065;
    float wave = 0.03 * sin(m.y * 7.0 + t * 1.3 + fi * 1.7) + 0.012 * sin(m.y * 17.0 - t * 2.0 + fi);
    float d = abs(m.x - x0 - wave * smoothstep(0.0, -0.4, m.y));
    float len = 0.5 + 0.35 * hash11(fi + 3.0);
    float on = below * smoothstep(-len, -len * 0.4, m.y);
    float line = inkLine(d, q + fi, 0.0035, 35.0 + fi) * on;
    lift(P, line * 0.35);
    addPig(P, CERULEAN, line * 0.3);
    addOpaque(P, goldCol(q, t), line * 0.3);
  }
  // marine snow rising as we sink
  vec2 r = p + vec2(0.015 * sin(t * 0.4 + p.y * 3.0), -t * 0.04);
  addOpaque(P, vec3(0.9, 0.93, 0.92), goldFlakes(r, 90.0, 36.0, 0.05) * 0.5);
  addOpaque(P, goldCol(r, t), goldFlakes(r * 1.3, 38.0, 37.0, 0.06) * 0.85);
}
` },
  3: { fn: 'sSeaFloor', src: /* glsl */ `
// ================================================================ 3 · 海の底 sea floor
void sSeaFloor(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  vec2 cp = p + vec2(0.0, -t * 0.012);    // sinking slowly
  seaBase(cp, t, P, 0.0);
  // something luminous stirring in the dark: the eye, not yet open
  vec2 q = (p - vec2(0.0, 0.05)) * 1.8;
  float d = blotSDF(q, 41.0, 0.55 + 0.25 * easeOut(t / 6.0), t, 0.8);
  float b = softWash(d, q, 41.0, 0.05);
  lift(P, b * 0.35);
  addPig(P, TURQUOISE, b * 0.2);
  addOpaque(P, goldCol(q, t), inkLine(d, q, 0.0025, 42.0) * 0.4 * easeOut(t / 4.0));
  // kelp swaying up from the floor
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x0 = -1.5 + fi * 0.72 + 0.2 * hash11(fi);
    float sway = (0.05 * sin(cp.y * 3.0 + t * 0.7 + fi) + 0.02 * sin(cp.y * 11.0 + t * 1.3 + fi * 2.0)) * smoothstep(-0.7, 0.2, cp.y);
    float h = -0.15 + 0.3 * hash11(fi + 7.0);
    float kd = abs(cp.x - x0 - sway) - (0.008 + 0.012 * (0.5 + 0.5 * sin(cp.y * 16.0 + fi))) * smoothstep(h + 0.05, -0.6, cp.y);
    float on = smoothstep(h, h - 0.15, cp.y);
    float kb = wash(kd + edgeWobble(cp * 3.0, fi, 0.004), cp, fi, 0.005) * on;
    P.od += od(PRUSSIAN) * kb * 0.45;
    addPig(P, SAPGREEN, kb * 0.25);
  }
  // the sea floor: dunes of dark pigment with a gold ridge line
  float ridge = -0.66 + 0.07 * sin(cp.x * 1.8 + 1.0) + 0.05 * fbm3(vec2(cp.x * 2.5, 3.0));
  float fd = cp.y - ridge;
  P.od += od(PRUSSIAN) * wash(fd + edgeWobble(cp, 4.0, 0.03), cp, 4.0, 0.02) * gran(cp, 0.6) * 0.9;
  addOpaque(P, goldCol(cp, t), inkLine(fd, cp, 0.0035, 5.0) * 0.8);
  float ridge2 = -0.5 + 0.05 * sin(cp.x * 2.6 + 3.0) + 0.04 * fbm3(vec2(cp.x * 3.0, 8.0));
  P.od += od(INDIGO) * wash(cp.y - ridge2 + edgeWobble(cp, 9.0, 0.03), cp, 9.0, 0.03) * 0.35;
  // marine snow
  vec2 s = p + vec2(0.02 * sin(t * 0.3 + p.y * 3.0), t * 0.03);
  addOpaque(P, vec3(0.92, 0.94, 0.9), goldFlakes(s, 90.0, 2.0, 0.05) * 0.55);
  addOpaque(P, goldCol(s, t), goldFlakes(s * 1.3, 40.0, 5.0, 0.06) * 0.8);
}
` },
  4: { fn: 'sEye', src: /* glsl */ `
// ================================================================ 4 · 目を開く the eye
void sEye(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  seaBase(p, t, P, 0.25);
  float open = easeOut(span01(t, k0.x, k1.x)) * (0.92 + 0.08 * sin(t * 0.7));
  vec2 e = p - vec2(0.0, 0.02);
  // lids: Rorschach blots folded above and below the eye
  float lidT = blotSDF(vec2(e.x * 0.8, e.y - 0.36 - 0.16 * open) * 1.3, 11.0, 0.85, t, 1.0);
  float lidB = blotSDF(vec2(e.x * 0.8, -e.y - 0.32 - 0.14 * open) * 1.4, 12.0, 0.75, t, 1.0);
  float lids = min(lidT, lidB);
  P.od += od(PRUSSIAN) * wash(lids, e, 13.0, 0.025) * gran(e, 0.8) * 0.9;
  P.od += od(ULTRA) * softWash(lids - 0.04, e, 14.0, 0.08) * 0.35;
  // the opening: a lens between the lids
  float lens = sdVesica(e.yx, 0.8, max(0.001, 0.34 * open)) + edgeWobble(e, 15.0, 0.02);
  float inside = smoothstep(0.004, -0.004, lens);
  float sclera = 0.5 + 0.25 * fbm3(e * 3.0 + 2.0);
  lift(P, inside * sclera);
  addPig(P, CERULEAN, inside * (0.1 + 0.15 * fbm3(e * 2.0 + 9.0)));
  P.od += od(PRUSSIAN) * exp(-max(-lens, 0.0) / 0.04) * inside * 0.45;
  // iris
  float r = length(e);
  float ang = atan(e.y, e.x);
  float irisD = r - 0.24 + 0.012 * gnoise(vec2(ang * 4.0, 1.0));
  float iris = smoothstep(0.004, -0.004, irisD) * inside;
  float fibres = 0.5 + 0.5 * gnoise(vec2(ang * 28.0, r * 6.0 + t * 0.1));
  P.od += (od(TURQUOISE) * (0.5 + 0.5 * fibres) + od(COBALT) * smoothstep(0.1, 0.24, r) * 0.6) * iris * 1.1;
  P.od += od(PRUSSIAN) * iris * exp(-max(-irisD, 0.0) / 0.018) * 0.8;
  addOpaque(P, goldCol(e * 3.0, t), iris * smoothstep(0.18, 0.1, r) * smoothstep(0.075, 0.1, r) * (0.25 + 0.5 * fibres));
  float pupil = smoothstep(0.004, -0.004, r - 0.085 - 0.01 * open + 0.004 * gnoise(e * 30.0)) * inside;
  P.od += od(INDIGO) * pupil * 2.2;
  addOpaque(P, vec3(0.97, 0.95, 0.9), smoothstep(0.03, 0.02, length(e - vec2(0.07, 0.07)) + 0.004 * gnoise(e * 50.0)) * inside * 0.8);
  // the outline of the eye in gold ink
  addOpaque(P, goldCol(e, t), inkLine(lens, e, 0.006, 16.0) * smoothstep(0.02, 0.1, open));
  // ink running from the lower lid
  vec2 q = vec2(abs(e.x), e.y);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float x = 0.2 + fi * 0.26;
    float len = (0.08 + 0.1 * hash11(fi + 3.0)) * easeOut(span01(t, k0.y, k1.y));
    vec2 a = vec2(x, -0.33 - 0.03 * fi), b = a + vec2(0.01 * sin(fi * 3.0), -len);
    vec2 dq = q + vec2(0.005 * sin(q.y * 35.0 + fi * 2.0), 0.0);
    float drip = sdTaper(dq, a, b, 0.009, 0.004);
    drip = smin(drip, length(dq - b) - 0.009, 0.008);
    P.od += od(PRUSSIAN) * wash(drip, e, fi, 0.008) * 0.8;
  }
  addOpaque(P, goldCol(p, t), goldFlakes(p + vec2(0.0, t * 0.02), 45.0, 21.0, 0.05) * 0.8);
}
` },
  5: { fn: 'sSand', src: /* glsl */ `
// ================================================================ 5 · 風の砂 wind and sand
void sSand(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  konshi(P, p, 1.0);
  float up = smoothstep(-0.2, 1.2, p.y);
  lift(P, 0.55 + 0.25 * up);
  addPig(P, GAMBOGE, 0.2 * up);
  addPig(P, ROSE, 0.12 * smoothstep(0.3, 1.0, p.y));
  // wind: long horizontal streaks of lifted pigment and ochre, blowing right
  vec2 w = vec2(p.x - t * 0.18, p.y);
  float streak = fbm(vec2(w.x * 0.7, w.y * 7.0)) * 0.5 + 0.5;
  float gust = smoothstep(0.5, 0.8, streak);
  lift(P, gust * 0.3);
  addPig(P, OCHRE, gust * 0.35 * gran(p, 1.2));
  // dunes, each a granulating wash of ochre and sienna with a gold ridge
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = 0.05 - fi * 0.3;
    float drift = t * (0.02 + fi * 0.02);
    float ridge = y + 0.13 * sin(p.x * (1.2 + fi * 0.4) + fi * 2.0 + drift) + 0.06 * fbm3(vec2(p.x * 2.0 + drift, fi));
    float d = p.y - ridge;
    float dune = wash(d + edgeWobble(p, fi + 50.0, 0.02), p, fi + 50.0, 0.03);
    float shade = 0.6 + 0.6 * smoothstep(0.0, -0.25, d);
    lift(P, dune * 0.35);
    P.od += od(mix(OCHRE, SIENNA, fi / 2.5)) * dune * shade * gran(p * (1.0 + fi * 0.3), 1.4) * (0.6 + fi * 0.2);
    // sand blowing off each crest
    float blow = smoothstep(0.12, 0.0, abs(d - 0.03)) * smoothstep(0.3, 0.7, gnoise(vec2((p.x - t * 0.4) * 3.0, p.y * 40.0 + fi)) * 0.5 + 0.5);
    addPig(P, OCHRE, blow * 0.3);
    addOpaque(P, goldCol(p, t), inkLine(d, p + fi, 0.0025, 51.0 + fi) * dryBrush(p + fi, 52.0, 0.1) * 0.85);
  }
  // grains streaming on the wind
  vec2 g = vec2(p.x - t * 0.5, p.y) * vec2(0.4, 1.0);
  addOpaque(P, goldCol(p, t), goldFlakes(g, 80.0, 53.0, 0.05) * 0.8);
  addPig(P, SIENNA, goldFlakes(g * 1.5 + 3.0, 90.0, 54.0, 0.06) * 0.5);
}
` },
  6: { fn: 'sFiveLights', src: /* glsl */ `
// ================================================================ 6 · 五つのひかり five lights
vec2 lightPos(int i) { float a = PI * 0.5 + float(i) * TAU / 5.0; return vec2(0.0, 0.02) + 0.42 * vec2(cos(a), sin(a)); }

void sFiveLights(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  konshi(P, p, 1.25);
  vec3 cols[5] = vec3[5](ROSE, GAMBOGE, TURQUOISE, VIOLET, CERULEAN);
  float unravel = smoothstep(k0.x, k1.x, t);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = lightPos(i);
    vec2 q = p - c;
    float r = length(q);
    float appear = easeOut((t + 0.3 - fi * 0.35) / 1.5);
    float size = 0.17 * appear * (1.0 - 0.55 * unravel) * (1.0 + 0.05 * sin(t * 1.5 + fi));
    float d = r - size + edgeWobble(q * 1.5, fi * 9.0, 0.03);
    float b = wash(d, q, fi * 9.0, 0.02);
    lift(P, b * 0.75 + softWash(d - 0.08, q, fi, 0.1) * 0.25 * appear);
    addPig(P, cols[i], b * 0.55 + softWash(d - 0.05, q, fi, 0.08) * 0.2 * appear);
    addOpaque(P, goldCol(q, t), inkLine(d, q, 0.0025, fi * 3.0) * 0.6 * appear);
    // threads spiralling out of each light as it comes undone
    float a = atan(q.y, q.x);
    float reach = 0.15 + unravel * 0.9;
    float u = a * 7.0 / TAU + r * 2.4 - t * 0.12 + 0.3 * fbm3(q * 3.0 + fi);
    float line = abs(fract(u) - 0.5);
    float wline = 0.07 * (1.0 - smoothstep(0.0, reach, r));
    float th = smoothstep(wline, wline * 0.3, line) * smoothstep(reach, reach * 0.5, r) * smoothstep(size * 0.8, size + 0.04, r) * unravel;
    lift(P, th * 0.5);
    addPig(P, cols[i], th * 0.35);
    addOpaque(P, goldCol(q * 2.0, t), th * 0.3);
  }
  addOpaque(P, goldCol(p, t), goldFlakes(p + vec2(0.0, -t * 0.015), 50.0, 61.0, 0.05) * 0.8);
}
` },
  7: { fn: 'sFullEmpty', src: /* glsl */ `
// ================================================================ 7 · 満ちて 空っぽで full and empty
void sFullEmpty(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  // the indigo starts to rinse away from the centre before the chorus
  float rinse = smoothstep(k0.z, k1.z, t);
  float rr = length(p * vec2(0.8, 1.0)) + 0.25 * fbm(p * 1.4 + 71.0);
  float front = rinse * 2.4;
  float dyed = smoothstep(front - 0.05, front + 0.05, rr);
  konshi(P, p, 1.25 * dyed);
  P.od += od(INDIGO) * exp(-pow((rr - front) / 0.03, 2.0)) * 0.9 * step(0.001, rinse);
  // drum hits drop ink that blooms and spreads (mirrored)
  for (int i = 0; i < 6; i++) {
    float age = uHits[i].x;
    if (age > 6.0 || age > t) continue;
    float ht = uTime - age;
    vec2 h = hash22(vec2(floor(ht * 50.0), 3.0));
    vec2 c = vec2(0.25 + h.x * 1.2, (h.y - 0.5) * 1.5);
    vec2 q = vec2(abs(p.x), p.y) - c;
    float rad = 0.04 + 0.16 * sqrt(age) * uHits[i].y;
    float d = length(q) - rad + edgeWobble(q * 2.0, ht, 0.03);
    float b = wash(d, q, ht, 0.015) * exp(-age * 0.35);
    lift(P, b * 0.5 * dyed);
    addPig(P, CERULEAN, b * 0.3);
    addOpaque(P, goldCol(q, t), inkLine(d, q, 0.002, ht) * exp(-age * 0.5) * 0.6);
  }
  // the bowl: fills (満ちて) and empties (空っぽで)
  vec2 c = p - vec2(0.0, 0.0);
  float R = 0.38;
  float fill = smoothstep(k0.x, k1.x, t) * (1.0 - smoothstep(k0.y, k1.y, t));
  float level = -R + 2.0 * R * fill + 0.015 * sin(c.x * 12.0 + t * 2.0);
  float disc = length(c) - R;
  float water = max(disc, c.y - level) + edgeWobble(c, 72.0, 0.01);
  float wv = wash(water, c, 72.0, 0.02);
  lift(P, wv * 0.55);
  addPig(P, TURQUOISE, wv * 0.4);
  addOpaque(P, goldCol(c, t), inkLine(abs(disc) - 0.0, c, 0.004, 73.0) * 0.85 * easeOut(t / 1.5));
  addOpaque(P, goldCol(p, t), goldFlakes(p + vec2(0.0, -t * 0.02), 45.0, 74.0, 0.05) * 0.8 * dyed);
}
` },
  8: { fn: 'sBloom', src: /* glsl */ `
// ================================================================ 8 · 色即是空 chorus bloom
void sBloom(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  // bursts open on the downbeat, then keeps creeping outwards, breathing
  // slowly and swelling a little on each drum hit
  float g = 0.25 + 0.85 * easeOut(t / 1.4) + 0.012 * t + 0.035 * sin(t * 0.9) + 0.06 * uPulse;
  float bright = v;  // 1 for the final chorus
  float tw = t * 2.5;                   // the wet edges crawl
  vec2 q = p * (0.95 + 0.1 * bright);
  vec2 flow = vec2(0.0, -t * 0.015);    // pigment settling inside the washes
  // fold crease
  P.od += od(PAYNE) * exp(-abs(p.x) / 0.004) * 0.06;
  // five pigments, each its own blot, glazed over each other
  float d1 = blotSDF(q * 1.05, 1.0 + bright * 40.0, g, tw, 1.1);
  P.od += od(ROSE) * wash(d1, q + flow, 1.0, 0.03) * gran(q, 0.3) * 0.8;
  float d2 = blotSDF((q - vec2(0.0, -0.18)) * 1.25, 2.0 + bright * 40.0, g * 0.95, tw, 1.0);
  P.od += od(mix(ULTRA, COBALT, 0.4 + 0.3 * bright)) * wash(d2, q + flow, 2.0, 0.025) * gran(q, 0.9) * 0.75;
  float d3 = blotSDF((q - vec2(0.0, 0.2)) * 1.7, 3.0 + bright * 40.0, g, tw, 0.9);
  P.od += od(GAMBOGE) * wash(d3, q + flow, 3.0, 0.03) * 0.8;
  float d4 = blotSDF((q - vec2(0.0, -0.5)) * 1.9, 4.0 + bright * 40.0, g * 0.9, tw, 1.0);
  P.od += od(mix(SAPGREEN, TURQUOISE, bright)) * wash(d4, q + flow, 4.0, 0.02) * gran(q, 0.5) * 0.65;
  float d5 = blotSDF((q - vec2(0.0, 0.5)) * 2.1, 5.0 + bright * 40.0, g, tw, 1.1);
  P.od += od(VIOLET) * wash(d5, q + flow, 5.0, 0.02) * gran(q, 0.7) * 0.7;
  // backruns where the washes met while wet
  float anyW = smoothstep(0.02, -0.02, min(min(d1, d2), min(d3, d5)));
  P.od += od(ROSE) * backrun(q, 7.0, 3.5) * anyW * 0.35;
  // a few drops thrown out by the fold
  vec2 sq = vec2(abs(q.x), q.y);
  float spread = smoothstep(1.05, 0.55, length(sq * vec2(0.9, 1.0))) * smoothstep(0.2, 0.9, g);
  float sp1 = splatter(sq, 9.0, 6.0, 0.03, 0.12) + edgeWobble(sq * 3.0, 9.0, 0.006);
  float sp2 = splatter(sq + 0.3, 19.0, 13.0, 0.016, 0.1) + edgeWobble(sq * 4.0, 19.0, 0.004);
  P.od += od(ROSE) * wash(sp1, sq, 9.0, 0.006) * spread * 0.8;
  P.od += od(ULTRA) * wash(sp2, sq, 19.0, 0.005) * spread * 0.8;
  if (bright > 0.5) addOpaque(P, goldCol(p, t), goldFlakes(p + vec2(0.0, -t * 0.02), 40.0, 31.0, 0.06) * 0.8);
}
` },
  9: { fn: 'sPalm', src: /* glsl */ `
// ================================================================ 9 · 掌の宇宙 universe in a palm
float sdHand(vec2 q) {
  float palm = sdBox(q - vec2(0.0, -0.12), vec2(0.24, 0.26)) - 0.08;
  float d = palm;
  d = smin(d, sdTaper(q, vec2(-0.21, 0.12), vec2(-0.29, 0.64), 0.068, 0.056), 0.04);
  d = smin(d, sdTaper(q, vec2(-0.07, 0.16), vec2(-0.08, 0.76), 0.07, 0.058), 0.04);
  d = smin(d, sdTaper(q, vec2(0.08, 0.14), vec2(0.13, 0.69), 0.068, 0.056), 0.04);
  d = smin(d, sdTaper(q, vec2(0.21, 0.08), vec2(0.32, 0.5), 0.062, 0.05), 0.04);
  d = smin(d, sdTaper(q, vec2(-0.24, -0.24), vec2(-0.52, 0.1), 0.085, 0.064), 0.06);
  d = smin(d, sdTaper(q, vec2(0.0, -0.45), vec2(0.0, -1.4), 0.24, 0.27), 0.08);
  return d;
}

void sPalm(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  // what remains of the chorus bloom, faded
  float d0 = blotSDF(p * 0.9, 1.0, 1.1, t, 1.1);
  P.od += od(ROSE) * wash(d0, p, 1.0, 0.03) * 0.12;
  float s = 0.95;
  vec2 c = vec2(-0.3, -0.02 + 0.01 * sin(t * 0.5));
  vec2 q = (p - c) / s;
  float d = sdHand(q) * s;
  float inside = smoothstep(0.004, -0.004, d + edgeWobble(q, 81.0, 0.006));
  // the galaxy seen through the hand
  vec2 g = q - vec2(-0.02, 0.0);
  float r = length(g), a = atan(g.y, g.x);
  float arms = 0.5 + 0.5 * cos(2.0 * (a + log(r + 0.03) * 2.3 - t * 0.12) + fbm3(g * 4.0) * 1.8);
  float core = smoothstep(0.55, 0.0, r);
  P.od += (od(INDIGO) * 1.1 + od(VIOLET) * 0.4 * (1.0 - arms)) * inside * (0.8 + 0.3 * fbm3(g * 2.0));
  lift(P, inside * (core * 0.8 * (0.4 + 0.6 * arms) + 0.15 * arms * smoothstep(1.0, 0.3, r)));
  addPig(P, ROSE, inside * arms * smoothstep(0.7, 0.15, r) * 0.25);
  addPig(P, GAMBOGE, inside * smoothstep(0.2, 0.0, r) * 0.35);
  addPig(P, CERULEAN, inside * arms * smoothstep(0.9, 0.4, r) * 0.2);
  addOpaque(P, vec3(0.98, 0.97, 0.94), goldFlakes(g + 5.0, 130.0, 82.0, 0.07) * inside * 0.9);
  addOpaque(P, vec3(0.98, 0.97, 0.94), goldFlakes(g * 0.7, 45.0, 83.0, 0.04) * inside);
  addOpaque(P, goldCol(g, t), goldFlakes(g * 1.3 + 2.0, 70.0, 84.0, 0.05) * inside * 0.8);
  // the hand itself: a loose line of sumi, and a pale shadow wash beside it
  P.od += od(SUMI) * inkLine(d, q, 0.007, 85.0) * 0.95;
  P.od += od(PAYNE) * softWash(abs(d + 0.02) - 0.02, q, 86.0, 0.03) * 0.12;
}
` },
  10: { fn: 'sWheel', src: /* glsl */ `
// ================================================================ 10 · 光は巡る wheel of light
void sWheel(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float bright = v;
  vec3 cols[8] = vec3[8](ROSE, VERMILION, GAMBOGE, SAPGREEN, TURQUOISE, COBALT, ULTRA, VIOLET);
  float spin = t * 0.08;
  float grow = easeOut((t + 0.5) / 2.5);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float a = fi * TAU / 8.0 + spin;
    vec2 c = 0.42 * vec2(cos(a), sin(a));
    vec2 q = rot(a) * (p - c);
    float d = sdVesica(q.yx * vec2(1.0, 1.0), 0.26 * grow, 0.13 * grow) + edgeWobble(q * 1.5, fi * 5.0, 0.03);
    float b = wash(d, q, fi * 5.0, 0.02);
    P.od += od(cols[i]) * b * (0.55 + 0.2 * bright) * gran(q, 0.5);
  }
  // the centre: a gold sun with fine rays
  float r = length(p);
  float ang = atan(p.y, p.x);
  float sun = smoothstep(0.004, -0.004, r - 0.12 - 0.01 * gnoise(vec2(ang * 5.0, t)));
  addOpaque(P, goldCol(p * 2.0, t), sun * 0.95);
  float rays = smoothstep(0.93, 1.0, abs(sin(ang * 12.0 + t * 0.2))) * smoothstep(0.7, 0.15, r) * step(0.13, r);
  addOpaque(P, goldCol(p, t), rays * 0.5);
  P.od += od(PAYNE) * inkLine(r - 0.62, p, 0.003, 91.0) * 0.4;
  if (bright > 0.5) addOpaque(P, goldCol(p, t), goldFlakes(rot(t * 0.05) * p, 45.0, 92.0, 0.07) * 0.8);
}
` },
  11: { fn: 'sTaiko', src: /* glsl */ `
// ================================================================ 11 · 尺八と太鼓 shakuhachi and taiko
void sTaiko(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  // mist and a pale vermilion sun behind the grove
  float sd = length(p - vec2(0.75, 0.42)) - 0.3 + edgeWobble(p, 101.0, 0.02);
  P.od += od(VERMILION) * wash(sd, p, 101.0, 0.03) * 0.38;
  P.od += od(PAYNE) * softWash(-0.6 - p.y + 0.15 * fbm3(vec2(p.x * 0.8 + t * 0.02, 1.0)), p, 102.0, 0.25) * 0.12;
  P.od += od(PAYNE) * softWash(p.y - 0.7 + 0.15 * fbm3(vec2(p.x * 0.7 - t * 0.02, 2.0)), p, 103.0, 0.3) * 0.06;
  // bamboo, three depths, drifting past at different speeds
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float x0 = -1.9 + fi * 0.72 + 0.2 * hash11(fi) - t * 0.01;
    bamboo(P, p, x0, 0.014, 0.03, 0.34, 0.22, fi + 110.0);
  }
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x0 = -1.5 + fi * 1.05 + 0.3 * hash11(fi + 20.0) - t * 0.02;
    bamboo(P, p, x0, 0.024, -0.04, 0.42, 0.5, fi + 120.0);
  }
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float x0 = (i == 0 ? -1.25 : 1.35) - t * 0.035;
    bamboo(P, p, x0, 0.042, 0.05, 0.55, 1.0, fi + 130.0);
    bambooLeaves(P, p, vec2(x0 + 0.05, 0.55 - fi * 0.9), 1.0 - fi * 2.0, 0.24, 0.95, fi + 131.0, t);
    bambooLeaves(P, p, vec2(x0 - 0.04, 0.1 + fi * 0.3), -1.0 + fi * 2.0, 0.2, 0.9, fi + 133.0, t);
  }
  // the shakuhachi: one breath of ink drifting across
  float bx = -2.0 + t * 0.3;
  float by = 0.2 + 0.1 * sin(p.x * 1.7 + t * 0.4) + 0.03 * sin(p.x * 5.0 - t);
  float breath = inkLine(p.y - by, p, 0.004, 104.0) * smoothstep(bx, bx - 0.4, p.x) * smoothstep(bx - 2.4, bx - 1.4, p.x);
  P.od += od(PAYNE) * breath * 0.7;
  // taiko: each hit throws a splash of ink, the loudest ones in vermilion
  for (int i = 0; i < 8; i++) {
    float age = uHits[i].x;
    if (age > 5.0 || age > t) continue;
    float ht = uTime - age;
    vec2 h = hash22(vec2(floor(ht * 60.0), 11.0));
    vec2 c = vec2((h.x - 0.5) * 2.6, (h.y - 0.5) * 1.3);
    float size = (0.06 + 0.12 * uHits[i].y) * easeOut(age * 8.0);
    if (length((p - c) * vec2(1.0, 0.5)) > size * 2.4 + 0.02) continue;
    float d = sdSplash(p - c, h.x * 40.0, size);
    float fade = exp(-age * 0.45);
    vec3 col = uHits[i].y > 0.75 ? VERMILION : SUMI;
    P.od += od(col) * wash(d, p, h.y * 30.0, 0.008) * fade * 0.95;
    // drips
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      float dx = (hash11(ht + fk) - 0.5) * size * 1.2;
      float len = size * (0.6 + hash11(ht * 2.0 + fk)) * easeOut(age / 1.5);
      vec2 da = c + vec2(dx, -size * 0.3), db = da + vec2(0.0, -len);
      vec2 dp = p + vec2(0.002 * sin(p.y * 60.0 + fk), 0.0);
      float dd = smin(sdTaper(dp, da, db, size * 0.07, size * 0.035), length(dp - db) - size * 0.06, 0.01);
      P.od += od(col) * wash(dd, p, fk, 0.004) * fade * 0.85;
    }
  }
}
` },
  12: { fn: 'sChains', src: /* glsl */ `
// ================================================================ 12 · さかさまの夢 chains, upside down
void landscape(inout Paint P, vec2 p, float t, float k, float hz) {
  P.od += od(CERULEAN) * band(p, hz, 1.3, 141.0, 0.1) * 0.3 * k;
  float m1 = hz + 0.3 + 0.18 * smoothstep(1.6, 0.0, abs(p.x + 0.4)) * (0.7 + 0.3 * fbm3(vec2(p.x * 1.5, 1.0))) + 0.04 * gnoise(vec2(p.x * 6.0, 2.0));
  P.od += od(mix(ULTRA, PAYNE, 0.5)) * wash(p.y - m1, p, 142.0, 0.02) * step(hz, p.y) * 0.45 * k;
  float m2 = hz + 0.14 + 0.1 * fbm3(vec2(p.x * 2.2, 3.0)) + 0.03 * gnoise(vec2(p.x * 12.0, 4.0));
  P.od += od(PAYNE) * wash(p.y - m2, p, 143.0, 0.015) * step(hz, p.y) * 0.6 * k;
  // pines on the near shore, dabbed in sumi
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 b = vec2(0.5 + fi * 0.28, hz + 0.02);
    vec2 q = p - b;
    float trunk = sdSeg(q, vec2(0.0), vec2(0.02 * sin(fi), 0.28 + 0.08 * fi)) - 0.008;
    float crown = 1e3;
    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      vec2 cc = vec2((hash11(fj + fi * 5.0) - 0.5) * 0.14, 0.13 + fj * 0.055 + 0.03 * fi);
      crown = smin(crown, sdEllipse(q - cc, vec2(0.075 - fj * 0.01, 0.032)), 0.03);
    }
    crown += 0.02 * fbm3(q * 14.0 + fi) + 0.008 * gnoise(q * 60.0);
    float tree = min(trunk, crown);
    P.od += od(SUMI) * wash(tree, q, fi, 0.008) * 0.85 * k;
  }
}

void sChains(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float hz = -0.24;
  if (p.y > hz) {
    landscape(P, p, t, 1.0, hz);
  } else {
    // the reflection, rippled and paler, with a moon that is not in the sky
    vec2 r = vec2(p.x + 0.006 * sin(p.y * 90.0 + t * 1.5) * smoothstep(hz, -1.0, p.y), 2.0 * hz - p.y);
    landscape(P, r, t, 0.55, hz);
    float moon = length(r - vec2(-0.7, 0.45)) - 0.12;
    float mw = wash(moon + edgeWobble(r, 145.0, 0.01), r, 145.0, 0.02);
    addOpaque(P, goldCol(r, t), mw * 0.45);
    P.od += od(CERULEAN) * (0.35 + 0.2 * dryBrush(p, 146.0, 0.0));
    P.od += od(ULTRA) * smoothstep(hz, -1.0, p.y) * 0.3;
  }
  P.od += od(PAYNE) * inkLine(p.y - hz, p, 0.002, 147.0) * 0.5;
  // chains across the foreground, dissolving from 溶けてゆく
  vec2 dir = normalize(vec2(1.0, -0.55));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 o = vec2(-2.0, 0.85);
  float along = dot(p - o, dir), across = dot(p - o, nrm);
  float link = 0.17;
  float idx = floor(along / link);
  for (int k = 0; k < 2; k++) {
    float ii = idx + float(k) - 0.5;
    float cen = (ii + 0.5) * link;
    vec2 q = vec2(along - cen, across + 0.01 * sin(ii));
    float faceOn = mod(ii, 2.0);
    float ring = faceOn > 0.5
      ? abs(sdEllipse(q, vec2(0.105, 0.06))) - 0.014
      : sdBox(q, vec2(0.1, 0.012)) - 0.006;
    float dissolve = smoothstep(k0.x + ii * 0.12, k0.x + 2.5 + ii * 0.12, t);
    float soft = mix(0.004, 0.05, dissolve);
    float body = smoothstep(soft, -soft, ring + edgeWobble(q * 4.0, ii, 0.006 + 0.03 * dissolve));
    float keep = (1.0 - dissolve) * (1.0 - 0.6 * smoothstep(0.3, 0.7, fbm3(q * 8.0 + ii) * 0.5 + 0.5) * dissolve);
    P.od += (od(PAYNE) * 0.9 + od(SIENNA) * 0.35 * (fbm3(q * 12.0 + ii) * 0.5 + 0.5)) * body * keep * 1.1;
    P.od += od(SIENNA) * softWash(ring - 0.03, q, ii, 0.06) * dissolve * (1.0 - dissolve) * 0.5;
  }
}
` },
  13: { fn: 'sFarShore', src: /* glsl */ `
// ================================================================ 13 · 向こう岸 the far shore
void sFarShore(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float bank = 0.22;
  // sky, pale
  P.od += od(OCHRE) * band(p, bank, 1.3, 151.0, 0.1) * 0.12;
  // the river in long strokes
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float y0 = bank - 0.3 * (fi + 1.0), y1 = bank - 0.3 * fi + 0.02;
    float b = band(p, y0, y1, 152.0 + fi, 0.05) * (0.5 + 0.5 * dryBrush(p + fi, 153.0 + fi, 0.1 - fi * 0.05));
    P.od += od(mix(CERULEAN, ULTRA, fi / 4.0)) * b * (0.35 + fi * 0.08);
  }
  // mist on the water
  addOpaque(P, vec3(0.95, 0.94, 0.9), softWash(abs(p.y - bank + 0.08) - 0.04, p, 154.0, 0.08) * 0.35);
  // the far bank: a low line of grass and trees
  float shore = bank + 0.02 * fbm3(vec2(p.x * 3.0, 1.0)) + 0.05 * smoothstep(0.6, 1.0, fbm3(vec2(p.x * 2.0, 5.0)) * 0.5 + 0.5);
  P.od += od(PAYNE) * wash(p.y - shore, p, 155.0, 0.01) * step(bank - 0.025, p.y) * 0.55;
  // someone on the far bank, calling
  vec2 fp = vec2(0.42, bank + 0.015);
  float fig = sdFigure((p - fp) / 0.1) * 0.1;
  P.od += od(SUMI) * wash(fig + edgeWobble(p * 5.0, 156.0, 0.002), p, 156.0, 0.005) * 0.95;
  // their voice crossing the water as ripples
  for (int i = 0; i < 4; i++) {
    float age = mod(t - float(i) * 1.6, 6.4);
    vec2 q = (p - fp) * vec2(0.45, 1.8);
    float R = 0.04 + age * 0.14;
    float ring = abs(length(q) - R);
    float on = step(p.y, bank - 0.02) * exp(-age * 0.4);
    P.od += od(ULTRA) * inkLine(ring, p, 0.003, 157.0 + float(i)) * on * 0.6;
  }
  // reeds along the near bank
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float x = -1.8 + fi * 0.2 + 0.1 * hash11(fi + 3.0);
    float h = 0.25 + 0.3 * hash11(fi + 9.0);
    float k = clamp((p.y + 1.05) / h, 0.0, 1.0);
    float bend = (0.06 + 0.05 * sin(t * 0.6 + fi)) * k * k;
    float rd = abs(p.x - x - bend) - 0.006 * (1.0 - k) - 0.001;
    float on = step(p.y, -1.05 + h) * step(-1.1, p.y);
    P.od += od(PAYNE) * wash(rd, p, fi, 0.003) * on * 0.7;
  }
  // the riser: light pulling upward
  float rise = smoothstep(k0.x, k1.x, t);
  vec2 rq = vec2(p.x, p.y - t * 0.5);
  float streak = smoothstep(0.75, 0.95, gnoise(vec2(rq.x * 14.0, rq.y * 1.2)) * 0.5 + 0.5) * rise;
  lift(P, streak * 0.6);
  addOpaque(P, goldCol(p, t), goldFlakes(rq, 70.0, 158.0, 0.06) * rise * 0.9);
}
` },
  14: { fn: 'sNeither', src: /* glsl */ `
// ================================================================ 14 · 不生不滅 neither / nor
void sNeither(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float seg = t < k0.y ? 0.0 : t < k0.z ? 1.0 : 2.0;
  float segEnd = seg < 0.5 ? k0.y : seg < 1.5 ? k0.z : k1.z;
  float u = clamp(span01(t, k0[int(seg)], segEnd) * 1.1, 0.0, 1.0);
  bool left = p.x < 0.0;
  // the left side runs forward, the mirror side runs backward in time
  float k = left ? u : 1.0 - u;
  vec2 q = vec2(abs(p.x) - 0.85, p.y + 0.22);
  float grow = 0.15 + 0.9 * ease(k);
  float d = blotSDF(q * 1.35, 161.0 + seg * 7.0, grow, t, 0.9);
  float b = wash(d, q, 161.0 + seg, 0.025);
  vec3 cL, cR;
  if (seg < 0.5) { cL = SUMI; cR = VERMILION; }
  else if (seg < 1.5) { cL = mix(SIENNA, CERULEAN, ease(u)); cR = mix(CERULEAN, SIENNA, ease(u)); }
  else { cL = INDIGO; cR = ROSE; }
  vec3 col = left ? cL : cR;
  float mud = seg > 0.5 && seg < 1.5 ? (left ? 1.0 - ease(u) : ease(u)) : 0.0;
  P.od += od(col) * b * (0.7 + 0.2 * (1.0 - float(seg > 0.5 && seg < 1.5))) * gran(q, 0.4 + mud * 1.2);
  P.od += od(SUMI) * b * mud * 0.25 * (fbm3(q * 5.0) * 0.5 + 0.5);
  // the fold between them
  P.od += od(PAYNE) * exp(-abs(p.x) / 0.004) * 0.12;
  P.od += od(PAYNE) * softWash(abs(p.x) - 0.01, p, 162.0, 0.03) * 0.05;
}
` },
  15: { fn: 'sCrossing', src: /* glsl */ `
// ================================================================ 15 · 羯諦 crossing
void sCrossing(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float warm = smoothstep(k0.x, k1.x, t);
  float speed = 0.2 + t * 0.06;
  float hz = 0.15;
  // sky warming as the other shore comes near
  P.od += od(mix(CERULEAN, GAMBOGE, warm)) * band(p, hz, 1.3, 171.0, 0.1) * (0.25 + 0.2 * warm);
  P.od += od(mix(ULTRA, ROSE, warm)) * band(p, hz + 0.45, 1.3, 172.0, 0.12) * 0.3 * warm;
  // the far shore on the right, catching light
  float fs = hz + 0.08 * smoothstep(0.0, 1.8, p.x) * (0.8 + 0.4 * fbm3(vec2(p.x * 2.0, 1.0)));
  P.od += od(mix(PAYNE, VIOLET, warm)) * wash(p.y - fs, p, 173.0, 0.015) * step(hz - 0.01, p.y) * 0.6;
  // water: rushing dry-brush strokes, faster and faster
  float water = step(p.y, hz);
  vec2 wq = vec2(p.x + t * speed, p.y);
  float streaks = dryBrush(wq, 174.0, 0.05 + 0.1 * warm);
  P.od += od(mix(ULTRA, ROSE, warm * 0.7)) * water * (0.15 + 0.35 * streaks);
  P.od += od(mix(CERULEAN, GAMBOGE, warm)) * water * (0.25 + 0.15 * streaks);
  // speed lines of sumi flying past, on the beat
  float fly = smoothstep(0.8, 0.95, gnoise(vec2(wq.x * 0.8 + t * speed * 2.0, p.y * 18.0)) * 0.5 + 0.5);
  P.od += od(SUMI) * fly * water * (0.3 + 0.5 * uPulse);
  // the boat, crossing left to right
  vec2 bp = vec2(-1.3 + 1.9 * ease(span01(t, k0.x, k1.x)), -0.32 + 0.015 * sin(t * 2.5));
  vec2 bq = rot(0.03 * sin(t * 2.0)) * (p - bp) / 0.8;
  float boat = sdBoat(bq) * 0.8;
  P.od += od(SUMI) * wash(boat + edgeWobble(bq * 3.0, 175.0, 0.003), p, 175.0, 0.006) * 0.95;
  // its wake
  float wake = abs(p.y - bp.y + 0.05 + 0.02 * (bp.x - p.x)) - 0.004;
  P.od += od(PAYNE) * inkLine(wake, p, 0.003, 176.0) * smoothstep(bp.x, bp.x - 0.9, p.x) * step(p.x, bp.x) * 0.5;
}
` },
  16: { fn: 'sClimax', src: /* glsl */ `
// ================================================================ 16 · 彼岸 climax sunrise
void sClimax(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float rise = easeOut(span01(t, k0.x, k1.x));
  float hz = -0.28;                      // horizon
  float sky = step(hz, p.y);
  // sky in overlapping wet bands: gamboge at the horizon, then rose, then violet
  P.od += od(GAMBOGE) * band(p, hz - 0.1, hz + 0.7, 181.0, 0.2) * 0.55 * sky;
  P.od += od(ROSE) * softWash(hz + 0.5 - p.y + 0.2 * fbm3(p * 1.2 + 4.0), p, 182.0, 0.2) * 0.6 * sky;
  P.od += od(VIOLET) * softWash(hz + 0.95 - p.y + 0.25 * fbm3(p * 1.1 + 8.0), p, 183.0, 0.25) * 0.8 * sky;
  P.od += od(INDIGO) * softWash(hz + 1.25 - p.y + 0.2 * fbm3(p * 1.3 + 2.0), p, 187.0, 0.25) * 0.6 * sky;
  P.od += od(ROSE) * backrun(p, 184.0, 1.6) * smoothstep(hz + 0.3, hz + 1.1, p.y) * 0.15 * sky;
  // the sun, rising out of the far shore
  vec2 sc = vec2(0.0, hz - 0.1 + 0.42 * rise);
  float r = length(p - sc);
  float sd = r - 0.36 + edgeWobble(p, 2.0, 0.025);
  float sun = wash(sd, p, 2.0, 0.035) * sky;
  P.od += od(VERMILION) * sun * (0.4 + 0.9 * smoothstep(0.0, 0.36, r));
  P.od += od(GAMBOGE) * sun * 0.5;
  P.od += od(GAMBOGE) * softWash(sd - 0.12, p, 3.0, 0.12) * 0.3 * sky;
  // light breaking outward on every accent
  for (int i = 0; i < 3; i++) {
    float age = uHits[i].x;
    float ring = exp(-pow((r - 0.4 - age * 0.9) / (0.03 + age * 0.05), 2.0)) * exp(-age * 1.2) * uHits[i].y;
    addOpaque(P, goldCol(p * 2.0, t), goldFlakes(p, 110.0, float(i) + floor(uTime), 0.5) * ring);
  }
  // far shore mountains
  float m = hz + 0.1 + 0.12 * smoothstep(1.4, 0.2, abs(p.x)) * (0.6 + 0.4 * fbm3(vec2(p.x * 2.0, 1.0))) + 0.03 * gnoise(vec2(p.x * 9.0, 2.0));
  float md = p.y - m;
  P.od += od(VIOLET) * wash(md, p, 3.0, 0.02) * step(hz - 0.002, p.y) * 0.75 * gran(p, 0.8);
  P.od += od(ULTRA) * wash(md + 0.05, p, 4.0, 0.02) * step(hz - 0.002, p.y) * 0.25;
  // water, with the sun's reflection broken into strokes
  float water = 1.0 - sky;
  float refl = smoothstep(0.45, 0.0, abs(p.x - sc.x) + 0.2 * fbm3(p * 4.0)) * dryBrush(p, 185.0, 0.05);
  P.od += od(CERULEAN) * water * (0.35 + 0.35 * dryBrush(p + 3.0, 186.0, 0.15));
  P.od += od(ULTRA) * water * smoothstep(hz, -1.0, p.y) * 0.45;
  lift(P, water * refl * 0.6);
  P.od += od(GAMBOGE) * water * refl * 0.45;
  P.od += od(VERMILION) * water * refl * 0.2;
  // lotus, opening in the foreground
  vec2 lp = p - vec2(0.0, -1.0);
  float open = easeOut(span01(t, k0.y, k1.y));
  float petals = 1e3;
  float vein = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i) - 2.0;
    float a = fi * (0.28 + 0.2 * open);
    vec2 q = rot(-a) * lp - vec2(0.0, 0.42);
    float pd = sdVesica(q, 0.34 - abs(fi) * 0.03, 0.13) + edgeWobble(q * 2.0, fi + 7.0, 0.008);
    if (pd < petals) { petals = pd; vein = abs(sin(q.x * 55.0 + 0.3 * gnoise(q * 8.0))) * smoothstep(0.004, -0.02, pd); }
  }
  float inP = smoothstep(0.004, -0.004, petals);
  float tip = smoothstep(0.3, 0.8, length(lp));
  P.od *= 1.0 - 0.85 * inP;  // petals are opaque over the water
  P.od += od(ROSE) * wash(petals, lp, 5.0, 0.03) * mix(0.35, 1.0, tip);
  P.od += od(ROSE) * inP * (1.0 - smoothstep(0.0, 0.08, vein)) * 0.15 * tip;
  P.od += od(GAMBOGE) * inP * smoothstep(0.45, 0.2, length(lp)) * 0.2;
  addOpaque(P, goldCol(lp, t), inkLine(petals, lp, 0.0035, 6.0) * 0.8);
  addOpaque(P, goldCol(p, t), goldFlakes(p + vec2(0.0, -t * 0.03), 35.0, 41.0, 0.06) * 0.9);
}
` },
  18: { fn: 'sUnravel', src: /* glsl */ `
// ================================================================ 18 · ほどける unravelling
void sUnravel(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  // a soft dawn: the other shore's colours, paled
  P.od += od(GAMBOGE) * softWash(abs(p.y + 0.05 + 0.15 * fbm3(p + 1.0)) - 0.35, p, 191.0, 0.2) * 0.3;
  P.od += od(ROSE) * softWash(0.35 - p.y + 0.2 * fbm3(p * 1.2 + 3.0), p, 192.0, 0.25) * 0.3;
  P.od += od(CERULEAN) * band(p, -1.3, -0.42, 193.0, 0.15) * 0.25;
  // the figure, coming undone in the wind from its right side
  vec2 fp = vec2(-0.45, -0.72);
  vec2 q = (p - fp) / 1.15;
  float fig = sdFigure(q) * 1.15;
  float front = 0.45 - 0.9 * ease(span01(t, k0.x, k1.x));   // the wind eats in from the right
  float erode = smoothstep(front + 0.04, front - 0.04, (p.x - fp.x) + 0.2 * fbm(p * 3.0));
  float body = wash(fig + edgeWobble(q * 2.0, 194.0, 0.01), p, 194.0, 0.02);
  float tone = 0.5 + 0.5 * fbm3(q * 3.0 + 4.0);
  P.od += (od(INDIGO) * 0.5 + od(VIOLET) * 0.3 * tone + od(SUMI) * 0.25 * (1.0 - tone)) * body * erode;
  P.od += od(SUMI) * inkLine(fig, p, 0.004, 195.0) * erode * 0.7;
  // what comes loose streams away as petals of colour
  vec3 cols[4] = vec3[4](ROSE, GAMBOGE, VIOLET, TURQUOISE);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 w = p - vec2(t * (0.25 + fi * 0.08), 0.04 * sin(p.x * 2.0 + t + fi));
    vec2 cell = floor(w * (7.0 + fi * 4.0));
    vec2 f = fract(w * (7.0 + fi * 4.0)) - 0.5;
    vec2 h = hash22(cell + fi * 17.0);
    float on = step(0.72, h.x);
    vec2 lq = rot(h.y * TAU + t * (h.x - 0.5) * 2.0) * (f - (h - 0.5) * 0.4);
    float pd = sdVesica(lq, 0.3, 0.1);
    // petals only downwind of the figure
    float zone = smoothstep(fp.x + front - 0.1, fp.x + front + 0.4, p.x) * smoothstep(1.1, 0.0, abs(p.y + 0.15 - 0.25 * (p.x - fp.x)));
    vec3 col = cols[int(mod(cell.x + cell.y + fi, 4.0))];
    P.od += od(col) * smoothstep(0.02, -0.02, pd) * on * zone * smoothstep(k0.x - 1.0, k0.x + 0.5, t) * 0.7;
  }
}
` },
  20: { fn: 'sEnso', src: /* glsl */ `
// ================================================================ 20 · 円相 outro ensō
void sEnso(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  vec2 c = p - vec2(0.0, 0.05);
  float prog = easeOut(span01(t, k0.x, k1.x));
  float a0 = radians(235.0), span = radians(335.0);
  float ang = atan(c.y, c.x);
  float s = mod(a0 - ang, TAU) / span;         // 0 at the start of the stroke
  float r = length(c);
  float r0 = 0.56 + 0.015 * sin(s * 5.0);
  float press = smoothstep(0.0, 0.04, s);      // the brush settling onto the paper
  float w = mix(0.085, 0.028, pow(s, 0.8)) * (0.85 + 0.15 * press) * (1.0 + 0.15 * gnoise(vec2(s * 7.0, 1.0)));
  float dr = r - r0 - 0.02 * s;
  float edge = abs(dr) - w + 0.006 * gnoise(c * 40.0) + 0.004 * gnoise(c * 110.0);
  float drawn = smoothstep(0.004, -0.004, (s - prog) * span * r0) * step(s, 1.0);
  float body = smoothstep(0.003, -0.003, edge) * drawn;
  // bristle streaks along the stroke; they open into flying white (飛白) as the brush runs dry
  float bristle = gnoise(vec2(dr * 150.0, s * 2.5)) * 0.5 + 0.5;
  float dry = smoothstep(0.3, 1.0, s) * 0.95;
  float ink = body * smoothstep(dry - 0.12, dry + 0.12, bristle + 0.12);
  float tone = 0.8 + 0.25 * fbm3(vec2(s * 8.0, dr * 30.0)) + 0.15 * bristle;
  // the wet head where the brush first touched: a rounded pool of ink
  vec2 head = (r0 + 0.004) * vec2(cos(a0), sin(a0));
  float hd = length((c - head) * vec2(1.0, 1.08)) - 0.085 + 0.007 * gnoise(c * 45.0);
  float pool = smoothstep(0.003, -0.003, hd) * step(0.0, prog) * step(s, 0.25);
  P.od += od(SUMI) * (max(ink * tone, pool * 0.95) + body * exp(-max(-edge, 0.0) / 0.006) * 0.25 * (1.0 - dry)) * 1.1;
  // faint bleed around the wet part
  P.od += od(PAYNE) * exp(-max(edge, 0.0) / 0.03) * smoothstep(0.0, -0.02, edge + 0.02) * drawn * (1.0 - s) * 0.1;
  // bells: faint tide-mark rings on the paper
  for (int i = 0; i < 3; i++) {
    float age = uHits[i].x;
    float R = 0.1 + age * 0.3;
    float wob = 0.01 * fbm3(c * 4.0 + float(i));
    float ring = exp(-pow((r - R + wob) / 0.004, 2.0)) + 0.2 * smoothstep(R, R - 0.03, r) * smoothstep(R - 0.15, R - 0.03, r);
    P.od += od(PAYNE) * ring * exp(-age * 0.5) * uHits[i].y * 0.1;
  }
}
` },
};
