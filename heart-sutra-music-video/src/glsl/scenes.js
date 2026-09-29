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
// uAccents[i] is the same for the accents, the strong hits at least 0.25 s
// apart: use these for anything drawn per hit, or a busy bar of drums
// throws several things a second about the frame, which reads as flicker.
// uHits[i] = (seconds since hit, strength, keep, seed) for the last sixteen
// drum hits, newest first; keep fades from 1 to 0 before a hit drops off the
// list, so anything drawn for a hit should be multiplied by it; seed is the
// hit's number in the song, to place what's drawn for it (never derive that
// from uTime - age, which wobbles from frame to frame in 32-bit floats).

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
    float band_ = exp(-sq((length(p) - r + wob) / w));
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
  2: { fn: 'sDescent', src: /* glsl */ `
// ================================================================ 2 · 般若 · 沈む prajñā, and the descent
// One continuous shot, so there's no seam between the chant and the sea.
// A folded blot rises out of the indigo in the shape of a stupa (beat 0).
// Then the light of a water surface comes down from above and floods over
// it, and the stupa melts into the sea like wet ink, while a jellyfish
// rises from below (beat 1). We sink: the surface falls away, bubbles and
// drifting pigment stream up past us (beat 2), and on the choir chant a
// shoal of gold fish gathers into a ring folded like an inkblot (beat 3).

// A small fish swimming along dir, centred at c.
float sdFish(vec2 p, vec2 c, vec2 dir, float size, float wag) {
  vec2 q = (p - c) / size;
  q = vec2(dot(q, vec2(dir.y, -dir.x)), dot(q, dir));    // y along the fish, head first
  q.x += 0.12 * sin(q.y * 5.0 + wag) * smoothstep(0.2, -0.6, q.y);
  float body = sdVesica(q - vec2(0.0, 0.05), 0.5, 0.16);
  float tail = sdTaper(q, vec2(0.0, -0.4), vec2(0.0, -0.72), 0.02, 0.2);
  tail = max(tail, -(length(q - vec2(0.0, -0.95)) - 0.26));   // forked
  return min(body, tail) * size;
}

// A stupa standing on y = 0, about 1.17 tall: stepped terraces, the dome,
// the harmika, a spire of stacked parasols and a finial. rings is the
// distance to the parasols alone.
float sdStupa(vec2 q, out float rings) {
  q.x = abs(q.x);
  float d = sdBox(q - vec2(0.0, 0.04), vec2(0.6, 0.04)) - 0.01;
  d = smin(d, sdBox(q - vec2(0.0, 0.115), vec2(0.5, 0.035)) - 0.01, 0.015);
  d = smin(d, sdBox(q - vec2(0.0, 0.18), vec2(0.42, 0.03)) - 0.01, 0.015);
  d = smin(d, max(sdEllipse(q - vec2(0.0, 0.2), vec2(0.34, 0.32)), 0.2 - q.y), 0.02);
  d = smin(d, sdBox(q - vec2(0.0, 0.56), vec2(0.085, 0.045)) - 0.005, 0.01);
  d = min(d, sdBox(q - vec2(0.0, 0.615), vec2(0.115, 0.012)) - 0.004);
  d = min(d, sdSeg(q, vec2(0.0, 0.62), vec2(0.0, 1.08)) - 0.012);
  rings = 1e3;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    rings = min(rings, sdEllipse(q - vec2(0.0, 0.67 + fi * 0.058), vec2(0.088 - fi * 0.01, 0.017)));
  }
  d = min(d, rings);
  d = smin(d, min(length(q - vec2(0.0, 1.11)) - 0.03, sdTaper(q, vec2(0.0, 1.1), vec2(0.0, 1.18), 0.018, 0.002)), 0.01);
  return d;
}

void sDescent(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float flood = span01(t, k0.y, k1.y);
  float sub = smoothstep(k0.y, k0.y + 1.5, t);                 // how far into the water we are
  float sink = 0.04 * max(0.0, t - k0.z) + 0.9 * ease(span01(t, k0.z, k1.z));
  float deep = smoothstep(k0.z - 1.0, k1.w, t);
  konshi(P, p, 1.0 + 0.3 * deep + 0.15 * (1.0 - sub));
  // the water comes in from above: a wet front sweeps down the page, and
  // behind it we're under the surface, with its web of light overhead
  float fy = mix(1.25, -1.35, easeOut(flood)) + 0.1 * fbm3(vec2(p.x * 1.3, t * 0.15));
  // it fades in as it comes, at full strength 0.7 s after it starts (0:20)
  float wa = ease(span01(t, k0.y, k0.y + 0.7));
  float uw = smoothstep(fy - 0.1, fy + 0.1, p.y) * wa;                     // the water has reached here
  float edge = exp(-sq((p.y - fy) / 0.05)) * wa * (1.0 - flood);
  lift(P, edge * 0.35);
  P.od += od(PRUSSIAN) * exp(-sq((p.y - fy + 0.06) / 0.012)) * wa * (1.0 - flood) * 0.5;   // its tide line
  float sy = 0.5 + 1.1 * sink;                                             // the surface, falling away as we sink
  vec2 wq = vec2(p.x * 2.2, (p.y - sy) * 5.0);
  float web = abs(fbm3(wq + vec2(t * 0.35, t * 0.2)) + 0.4 * fbm3(wq * 1.9 - t * 0.3));
  float near = smoothstep(sy - 1.1, sy - 0.05, p.y) * uw;
  lift(P, (smoothstep(0.12, 0.0, web) * 0.55 + 0.35) * near);
  addPig(P, TURQUOISE, near * 0.25);
  // light shafts, dimming as we go down
  float sh = 0.5 + 0.5 * sin(p.x * 3.6 + (p.y - sy) * 0.9 + 1.4 * fbm3(vec2(p.x * 0.8, t * 0.05)) + t * 0.1);
  sh = pow(sh, 4.0) * smoothstep(-1.4, sy, p.y) * (1.0 - 0.75 * deep) * uw * sub;
  lift(P, sh * 0.45);
  addPig(P, CERULEAN, sh * 0.2);

  // the stupa: a folded blot that rises from its terraces up to its finial
  // while प्रज्ञापारमिता is sung, breathing with the pulse
  {
    float build = ease(span01(t, k0.x - 0.4, k0.y - 0.7));      // complete by 0:18.6
    vec2 base = vec2(0.0, -0.42 + 1.1 * sink);
    float sc = 0.9 * (1.0 + 0.012 * sin(t * 1.3) + 0.02 * uPulse);
    vec2 q = (p - base) / sc;
    q += 0.03 * warp2(q * 1.7 + 21.0 + t * 0.02);
    q.x /= 0.3 + 0.7 * ease(build * 1.6);                 // unfolding from the crease
    float rings;
    float ds = sdStupa(q, rings);
    float env = -ds / 0.06 - 3.0 * smoothstep(-0.06, 0.06, q.y - (build * 1.25 - 0.06));
    float n = fbm(vec2(abs(q.x), q.y) * 2.6 + 21.0 + vec2(0.0, t * 0.03)) * 0.45 + gnoise(vec2(abs(q.x), q.y) * 11.0 + 21.0) * 0.1;
    float d = -(env + n - 0.1) * 0.06;
    // as the water arrives it melts, from the top down: the edge softens and
    // spreads, and it fades, gone by the time the water is at full strength (0:20)
    float dis = ease(span01(t, k0.y - 0.3 + 0.35 * clamp(0.6 - p.y, 0.0, 1.0), k0.y + 0.7));
    float crisp = wash(d, q, 21.0, 0.025);
    float melt = softWash(d - 0.07 * dis, q + vec2(0.0, 0.05 * dis), 21.0, 0.02 + 0.09 * dis);
    float body = mix(crisp, melt, dis) * (1.0 - 0.85 * dis);
    lift(P, body * 0.95 + softWash(d - 0.09, q, 25.0, 0.1) * 0.3 * (1.0 - dis) * step(0.001, build));   // it glows
    addPig(P, TURQUOISE, body * 0.26);
    addPig(P, VIOLET, body * smoothstep(0.35, 0.0, q.y) * 0.2);
    addPig(P, GAMBOGE, softWash(length((q - vec2(0.0, 0.33)) * vec2(1.0, 1.3)) - 0.13, q, 23.0, 0.08) * body * 0.4);   // a light inside the dome
    addPig(P, ULTRA, softWash(d - 0.05, q, 22.0, 0.06) * 0.35 * (1.0 - dis) * step(0.001, build));
    P.od += od(PRUSSIAN) * exp(-max(-d, 0.0) / 0.012) * smoothstep(0.004, -0.004, d) * 0.55 * (1.0 - dis);
    addOpaque(P, goldCol(q, t), inkLine(d, q, 0.003, 22.0) * 0.8 * (1.0 - dis) * step(0.001, build));
    addOpaque(P, goldCol(q * 2.0, t), smoothstep(0.004, -0.004, rings + 0.004) * smoothstep(0.02, -0.02, d) * 0.7 * (1.0 - dis));
    // the gold of its outline drifting up off it as it goes
    vec2 fq = q + vec2(0.01 * sin(q.y * 9.0 + t), -dis * 0.25 - t * 0.02);
    addOpaque(P, goldCol(fq, t), goldFlakes(fq, 70.0, 24.0, 0.3) * smoothstep(0.08, 0.0, abs(d)) * dis * (1.0 - dis) * 2.0);
  }

  // strata of suspended pigment streaming upwards, the nearest fastest
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float speed = 0.5 + 0.45 * fi;
    float yy = (p.y - sink * speed - t * 0.01) / (0.55 - fi * 0.1) + fi * 0.37;
    float f = fract(yy) - 0.5;
    float wisp = abs(f + 0.18 * fbm3(vec2(p.x * (0.9 + fi * 0.4) + floor(yy) * 3.1, fi))) - (0.035 + 0.02 * fi);
    float wb = softWash(wisp, p + fi, fi + 20.0, 0.06) * uw * sub;
    P.od += od(mix(PRUSSIAN, VIOLET, fi * 0.35)) * wb * (0.12 + 0.05 * fi);
  }
  // bubbles rising in a few loose columns, faster than we sink
  if (sub > 0.0) {
    float cw = 0.32;
    float col = floor((p.x + 2.0) / cw);
    vec2 hc = hash22(vec2(col, 5.0));
    if (hc.x > 0.6) {
      float bx = (col + 0.5) * cw - 2.0 + (hc.y - 0.5) * 0.15;
      float yy = (p.y - sink * 1.4 - t * (0.22 + 0.12 * hc.y)) * 7.0 + hc.y * 10.0;
      float cell = floor(yy);
      float hb = hash11(cell + col * 7.0);
      float rad = 0.01 + 0.018 * hb;
      vec2 bq = vec2(p.x - bx - 0.03 * sin(yy * 0.7 + col), (fract(yy) - 0.5) / 7.0);
      float on = step(0.4, hb) * uw * sub;
      float ring = abs(length(bq) - rad);
      lift(P, smoothstep(0.004, 0.0, ring) * on * 0.5 + smoothstep(rad, 0.0, length(bq)) * on * 0.15);
      addOpaque(P, vec3(0.92, 0.95, 0.95), smoothstep(rad * 0.35, 0.0, length(bq - vec2(-rad, rad) * 0.4)) * on * 0.6);
    }
  }

  // the jellyfish, rising from below the frame and on past us on the left
  float tj = t - (k1.y - 1.0);
  vec2 c = vec2(-0.72, -0.85 + 0.12 * tj + 0.25 * sink + 0.02 * sin(t * 0.9));
  vec2 q = (p - c) / 0.78;
  float pulse = 1.0 + 0.06 * sin(t * 2.2) + 0.05 * uLevel;
  vec2 bq = q / vec2(pulse, 2.0 - pulse);
  float dome = sdEllipse(bq, vec2(0.46, 0.34));
  float scallop = bq.y + 0.03 - 0.03 * abs(sin(bq.x * 13.0 + 0.3 * sin(t)));
  float bell = max(dome, -scallop) + edgeWobble(bq * 1.5, 31.0, 0.02);
  float b = wash(bell, q, 31.0, 0.035);
  lift(P, b * 0.75);
  addPig(P, TURQUOISE, b * 0.25);
  addPig(P, CERULEAN, b * smoothstep(0.0, 0.3, bq.y) * 0.15);
  addPig(P, VIOLET, softWash(bell - 0.03, q, 33.0, 0.08) * 0.3);
  float inner = blotSDF((bq - vec2(0.0, 0.14)) * 3.4, 32.0, 0.75, t, 0.55);
  float ib = wash(inner, bq, 32.0, 0.01) * smoothstep(0.004, -0.004, bell);
  lift(P, ib * 0.3);
  addPig(P, ROSE, ib * 0.4);
  addOpaque(P, goldCol(q, t), inkLine(bell, q, 0.004, 34.0) * 0.75);
  vec2 m = vec2(abs(q.x), q.y);
  float below = smoothstep(0.0, -0.08, m.y);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x0 = 0.1 + fi * 0.07;
    float wave = 0.04 * sin(m.y * 6.0 + t * 1.6 + fi * 1.7) + 0.015 * sin(m.y * 15.0 - t * 2.3 + fi);
    float d = abs(m.x - x0 - wave * smoothstep(0.0, -0.4, m.y));
    float len = 0.55 + 0.4 * hash11(fi + 3.0);
    float on = below * smoothstep(-len, -len * 0.4, m.y);
    float line = inkLine(d, q + fi, 0.004, 35.0 + fi) * on;
    lift(P, line * 0.35);
    addPig(P, ROSE, line * 0.2);
    addOpaque(P, goldCol(q, t), line * 0.3);
  }

  // the shoal: a school of gold fish swimming up past us in a loose S, with
  // its mirror image like a folded blot. Each fish wanders about its place,
  // the school breathes and shears as it goes, and on the chant it picks up
  // speed and leaves through the top of the frame before the sea floor.
  vec2 sp = vec2(abs(p.x), p.y);
  float kw = k0.w - (k1.y - 1.0);    // the chant, on the school's clock
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 7.0));
    float st = tj + fi * 0.04 + (h.x - 0.5) * 0.6;          // some lead, some straggle
    float late = max(0.0, st - kw);
    vec2 school = vec2(0.85 + 0.35 * sin(st * 0.6) - 0.12 * smoothstep(0.0, 9.0, st), -1.25 + 0.17 * st + 0.004 * late * late);
    vec2 vel = vec2(0.21 * cos(st * 0.6), 0.17 + 0.008 * late);
    vec2 off = rot(0.3 * sin(st * 0.25 + fi)) * (h - 0.5) * vec2(0.55, 0.4) * (1.0 + 0.2 * sin(st * 0.5 + fi * 1.3));
    float f1 = 1.4 + h.x, f2 = 1.1 + h.y;
    vec2 wander = 0.05 * vec2(sin(st * f1 + fi * 2.1), cos(st * f2 + fi * 1.3));
    vel += 0.04 * vec2(f1 * cos(st * f1 + fi * 2.1), -f2 * sin(st * f2 + fi * 1.3));
    vec2 c = school + off + wander;
    vec2 dir = normalize(vel);
    float fade = 1.0;
    float size = 0.075 * (0.8 + 0.4 * h.y);
    if (length(sp - c) > size * 1.2) continue;
    float fd = sdFish(sp, c, dir, size, t * (8.0 + 3.0 * h.x) + fi * 2.0);
    float body = smoothstep(0.003, -0.003, fd) * fade;
    addPig(P, TURQUOISE, softWash(fd - 0.006, sp, fi, 0.01) * fade * 0.3);
    addOpaque(P, goldCol(sp * 3.0 + fi, t), body * 0.85);
  }

  // gold dust rising through the indigo, which becomes marine snow in the water
  vec2 r = p + vec2(0.015 * sin(t * 0.4 + p.y * 3.0), -sink * 0.7 - t * 0.03);
  addOpaque(P, vec3(0.9, 0.93, 0.92), goldFlakes(r, 90.0, 36.0, 0.05) * 0.5 * uw * sub);
  addOpaque(P, goldCol(r, t), goldFlakes(r * 1.3, 38.0, 37.0, 0.06) * 0.85);
  vec2 r2 = p + vec2(0.012 * sin(p.y * 4.0 + t), -t * 0.05);
  addOpaque(P, goldCol(r2, t), goldFlakes(r2 * 1.7, 120.0, 24.0, 0.05) * (0.5 + 0.5 * uPulse) * (1.0 - uw * sub));
}
` },
  3: { fn: 'sSeaFloor', src: /* glsl */ `
// ================================================================ 3 · 海の底 sea floor
void sSeaFloor(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  vec2 cp = p + vec2(0.0, -t * 0.012);    // sinking slowly
  seaBase(cp, t, P, 0.0);
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
  // a few bubbles rising from the floor, wobbling as they go (drawn like
  // the descent's), some in pairs; clear of the lyrics on the right
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 33.0));
    float x0 = -1.55 + 2.45 * fract(fi * 0.618 + h.x * 0.3);
    float speed = 0.2 + 0.08 * h.y;
    for (int j = 0; j < 2; j++) {
      float fj = float(j);
      if (j == 1 && h.y < 0.45) break;
      float y = -0.62 + mod(t * speed + h.x * 2.0 - fj * 0.09, 2.0);
      vec2 bq = p - vec2(x0 + 0.025 * sin(y * 7.0 + fi * 2.0 + fj), y);
      if (length(bq) > 0.07) continue;
      float rad = (0.02 + 0.014 * h.x) * (1.0 - 0.45 * fj) * (0.75 + 0.25 * (y + 0.62) / 2.0);
      float on = smoothstep(-0.62, -0.52, y);
      float ring = abs(length(bq) - rad);
      lift(P, smoothstep(0.005, 0.0, ring) * on * 0.7 + smoothstep(rad, 0.0, length(bq)) * on * 0.2);
      addPig(P, TURQUOISE, smoothstep(0.005, 0.0, ring) * on * 0.3);
      addOpaque(P, vec3(0.92, 0.95, 0.95), smoothstep(rad * 0.35, 0.0, length(bq - vec2(-rad, rad) * 0.4)) * on * 0.7);
    }
  }
  // marine snow
  vec2 s = p + vec2(0.02 * sin(t * 0.3 + p.y * 3.0), t * 0.03);
  addOpaque(P, vec3(0.92, 0.94, 0.9), goldFlakes(s, 90.0, 2.0, 0.05) * 0.55);
  addOpaque(P, goldCol(s, t), goldFlakes(s * 1.3, 40.0, 5.0, 0.06) * 0.8);
}
` },
  4: { fn: 'sEye', src: /* glsl */ `
// ================================================================ 4 · 目を開く the eye
// An eye painted on, then becoming real, like a statue's eyes at its 開眼
// (eye-opening). While 観る者は and 静かに are sung, two black brushstrokes
// are painted (beats 0 and 1): a slim almond that needn't be an eye yet. On
// 目を開く (beat 2) it opens, and the gold, the white and the iris show
// inside; it's never a single line. The lower stroke is still wet enough to
// run (beat 3).

// Height of the eye's upper edge at x, for an opening of half-height w: the
// lens is two circle arcs meeting at x = ±0.8.
float lidArc(float x, float w) {
  float r = (0.64 + w * w) / (2.0 * w);
  return w - x * x / (r + sqrt(max(r * r - x * x, 0.0)));
}

void sEye(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  seaBase(p, t, P, 0.25);
  float open = easeOut(span01(t, k0.z, k1.z)) * (0.92 + 0.08 * sin(t * 0.7));
  vec2 e = p - vec2(0.0, 0.02);
  float w = mix(0.08, 0.34, open);
  // the water pales around it as it's painted, and more as it opens
  lift(P, softWash(length(e * vec2(0.5, 1.0)) - 0.5, e, 20.0, 0.3) * (0.3 * span01(t, k0.x - 0.5, k1.x) + 0.45 * open));
  // the upper lid: one stroke from left to right, landing with a press,
  // swelling, then lifting off dry just past the outer corner
  float x0 = -0.78, x1 = 0.86;
  float head = mix(-0.05, 1.05, ease(span01(t, k0.x, k1.x)));
  float xu = clamp(e.x, x0, x1);
  float uu = (xu - x0) / (x1 - x0);
  float yu = lidArc(xu, w) + 0.024 + 0.35 * max(0.0, xu - 0.55) * max(0.0, xu - 0.55);
  float wu = 0.034 * (0.8 + 0.2 * sin(uu * PI)) * (1.0 - 0.92 * smoothstep(0.6, 1.0, uu)) * (0.85 + 0.3 * gnoise(vec2(e.x * 4.0, 18.0)));
  float du = length(vec2(e.x - xu, e.y - yu)) - wu;
  float fly = dryBrush(vec2(e.x * 0.5 + 18.0, (e.y - yu) / max(wu, 0.004) * 0.12), 18.0, 0.25 - 0.45 * uu);
  float upper = wash(du + edgeWobble(e * 2.0, 18.0, 0.004), e, 18.0, 0.01) * smoothstep(head, head - 0.03, uu) * mix(1.0, fly, smoothstep(0.5, 0.95, uu));
  P.od += od(SUMI) * upper * 0.95;
  // the lower lid, lighter, also from left to right, tapering at both ends
  float x2 = -0.76, x3 = 0.8;
  float headL = mix(-0.05, 1.05, ease(span01(t, k0.y, k1.y)));
  float xl = clamp(e.x, x2, x3);
  float ul = (xl - x2) / (x3 - x2);
  float yl = -lidArc(xl, w) - 0.016;
  float wl = 0.022 * pow(max(sin(ul * PI), 0.0), 0.6) * (0.8 + 0.4 * gnoise(vec2(e.x * 5.0, 19.0)));
  float dl = length(vec2(e.x - xl, e.y - yl)) - wl;
  float lower = wash(dl + edgeWobble(e * 2.0, 19.0, 0.003), e, 19.0, 0.007) * smoothstep(headL, headL - 0.03, ul);
  P.od += od(SUMI) * lower * 0.85;
  // the opening: a lens between the lids
  float lens = sdVesica(e.yx, 0.8, w);
  float inside = smoothstep(0.004, -0.004, lens) * smoothstep(0.0, 0.3, open);
  float sclera = 0.5 + 0.25 * fbm3(e * 3.0 + 2.0);
  lift(P, inside * sclera);
  addPig(P, CERULEAN, inside * (0.1 + 0.15 * fbm3(e * 2.0 + 9.0)));
  P.od += od(PRUSSIAN) * exp(-max(-lens, 0.0) / 0.04) * inside * 0.45;
  // iris, round (its fibres are sampled around a circle, so they have no
  // seam where the angle wraps round). It's drawn in its own units, scaled
  // by 1.115, which leaves about 0.03 between it and the lids while the eye
  // is seen fully open (it breathes: then it's near its narrowest).
  vec2 ie = e / 1.115;
  float r = length(ie);
  vec2 dir = ie / max(r, 1e-4);
  float irisD = r - 0.24;
  float iris = smoothstep(0.004, -0.004, irisD) * inside;
  float fibres = 0.5 + 0.5 * gnoise(dir * 28.0 + r * 6.0 + t * 0.1);
  P.od += (od(TURQUOISE) * (0.5 + 0.5 * fibres) + od(COBALT) * smoothstep(0.1, 0.24, r) * 0.6) * iris * 1.1;
  P.od += od(PRUSSIAN) * iris * exp(-max(-irisD, 0.0) / 0.018) * 0.8;
  addOpaque(P, goldCol(ie * 3.0, t), iris * smoothstep(0.18, 0.1, r) * smoothstep(0.075, 0.1, r) * (0.25 + 0.5 * fibres));
  float pupil = smoothstep(0.004, -0.004, r - 0.085 - 0.01 * open) * inside;
  P.od += od(INDIGO) * pupil * 2.2;
  addOpaque(P, vec3(0.97, 0.95, 0.9), smoothstep(0.03, 0.02, length(ie - vec2(0.07, 0.07))) * inside * 0.8);
  // the outline of the eye in gold: a clean, even line
  float gold = smoothstep(0.0055, 0.003, abs(lens)) + exp(-abs(lens) / 0.012) * 0.12;
  addOpaque(P, goldCol(e, t), min(gold, 1.0) * smoothstep(0.0, 0.2, open));
  // the wet lower stroke runs in a few places
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = -0.32 + fi * 0.36 + 0.06 * hash11(fi + 3.0);
    float start = k0.w + 0.3 * fi;
    float len = (0.07 + 0.09 * hash11(fi + 5.0)) * easeOut(span01(t, start, start + 2.5));
    vec2 a = vec2(x, -lidArc(x, w) - 0.02), b = a + vec2(0.008 * sin(fi * 3.0), -len);
    vec2 dq = e + vec2(0.004 * sin(e.y * 35.0 + fi * 2.0), 0.0);
    float drip = sdTaper(dq, a, b, 0.007, 0.004);
    drip = smin(drip, length(dq - b) - 0.008, 0.008);
    P.od += od(SUMI) * wash(drip, e, fi, 0.008) * 0.7 * step(0.001, len);
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
// A gold moon over a night sea. It waxes slowly from a thin crescent, then
// the rest of the way to full on 満ちて, and wanes on 空っぽで until only its
// outline is left, an empty circle; then the indigo rinses
// away for the chorus, and where it has gone the empty circle has a corona,
// like the sun's in a total eclipse. The moon neither gains nor loses
// anything: only the light on it moves.
void sFullEmpty(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float rinse = smoothstep(k0.z, k1.z, t);
  float rr = length(p * vec2(0.8, 1.0)) + 0.25 * fbm(p * 1.4 + 71.0);
  float front = rinse * 2.4;
  float dyed = smoothstep(front - 0.05, front + 0.05, rr);
  konshi(P, p, 1.25 * dyed);
  P.od += od(INDIGO) * exp(-sq((rr - front) / 0.03)) * 0.9 * step(0.001, rinse);

  float hz = -0.34;
  vec2 mc = vec2(0.0, 0.3 + 0.04 * easeOut(t / 4.0));   // rising a little at first
  float R = 0.27;
  // phase: a thin crescent creeping towards half from the start, then on
  // 満ちて the rest of the way to full, carrying on at the pace it had (a
  // Hermite curve from 0.3 with the slow part's slope, to 1 at rest); it
  // wanes to nothing on 空っぽで
  float u = span01(t, k0.x, k1.x);
  float s = 0.3 * (k1.x - k0.x) / max(k0.x, 1e-3);
  float wax = t < k0.x ? 0.3 * span01(t, 0.0, k0.x)
    : (2.0 * u * u * u - 3.0 * u * u + 1.0) * 0.3 + (u * u * u - 2.0 * u * u + u) * s + (3.0 * u * u - 2.0 * u * u * u);
  float wane = ease(span01(t, k0.y, k1.y));
  vec2 m = p - mc;
  float disc = length(m) - R;
  float half_ = sqrt(max(R * R - m.y * m.y, 0.0));
  float k = mix(0.72, -1.0, wax);                     // waxing: the lit part grows from the right
  float litWax = smoothstep(-0.006, 0.006, m.x - k * half_);
  float litWane = smoothstep(-0.006, 0.006, (1.0 - 2.0 * wane) * half_ - m.x);   // waning: it shrinks to the left
  float lit = (wane > 0.0 ? litWane : litWax) * smoothstep(0.004, -0.004, disc);
  // the moonlight: gold leaf, with a soft glow in the sky around it
  float glow = exp(-max(disc, 0.0) / 0.12) * (0.25 + 0.75 * (wax - wane * wax)) * (1.0 - step(disc, 0.0) * 0.6);
  lift(P, glow * 0.35 * dyed * step(hz, p.y));
  addPig(P, CERULEAN, glow * 0.12 * dyed);
  vec3 gold = goldCol(m * 2.0, t);
  float maria = 0.8 + 0.2 * fbm3(m * 7.0 + 3.0);      // the dark seas on its face
  addOpaque(P, gold * maria, lit * 0.92);
  // the dark part of the disc: faint earthshine, then the gold outline that
  // stays when all the light has gone
  P.od += od(PRUSSIAN) * smoothstep(0.004, -0.004, disc) * (1.0 - lit) * 0.35 * dyed;
  // the corona, shown where the indigo has rinsed away: a few long
  // streamers and fine rays in gold, drifting outwards and shimmering (all
  // sampled around a circle, so there's no seam where the angle wraps)
  float cOn = (1.0 - dyed) * smoothstep(k0.z, k0.z + 1.2, t);
  if (cOn > 0.0) {
    float cr = length(m);
    vec2 cd = m / max(cr, 1e-4);
    float x = max(cr - R, 0.0);
    float lobes = 0.5 + 0.5 * gnoise(cd * 2.2 + vec2(t * 0.12, t * 0.25) + 81.0);    // streamers lengthen and shorten
    float reach = (0.05 + 0.32 * lobes * lobes) * (0.8 + 0.4 * (0.5 + 0.5 * gnoise(cd * 5.0 + vec2(-t * 1.1, t * 0.9) + 85.0)));   // their tips flare
    // (gnoise can stray a little past ±1: clamped, as pow() of a negative
    // number is NaN on some GPUs, which drew a line across the screen)
    float rays = pow(clamp(0.5 + 0.5 * gnoise(cd * 38.0 + t * 0.03 + 82.0), 0.0, 1.0), 2.5);
    rays *= clamp(0.5 + 0.5 * gnoise(cd * 19.0 + vec2(t * 1.6, -t * 1.3) + 84.0), 0.0, 1.0);   // rays brighten and fade
    rays *= clamp(0.55 + 0.45 * gnoise(cd * 12.0 + vec2(x * 6.0 - t * 1.2, 83.0)), 0.0, 1.0);  // knots flowing out along them
    float shimmer = 0.72 + 0.25 * gnoise(cd * 6.0 + vec2(t * 1.4, -t * 1.1)) + 0.12 * gnoise(cd * 15.0 + vec2(-t * 3.0, t * 2.6));
    float outside = smoothstep(-0.003, 0.003, cr - R);
    float corona = (exp(-x / 0.03) * 0.6 + exp(-x / reach) * (0.2 + 1.0 * rays)) * shimmer * outside;
    P.od += od(GAMBOGE) * exp(-x / (reach * 1.4)) * 0.25 * shimmer * outside * cOn;
    addOpaque(P, goldCol(m * 2.0, t), clamp(corona, 0.0, 1.0) * 0.85 * cOn);
  }
  addOpaque(P, goldCol(m, t), inkLine(disc, m, 0.0035, 73.0) * (0.35 + 0.6 * wane) * smoothstep(0.0, 1.5, t));

  // the sea: slow swells, and the moon's path broken into strokes of gold
  float water = smoothstep(hz + 0.004, hz - 0.004, p.y + 0.004 * sin(p.x * 9.0 + t));
  float swell = 0.5 + 0.5 * sin(p.y * 40.0 / (max(hz - p.y, 0.0) + 0.15) + p.x * 1.5 + t * 0.6 + 0.8 * fbm3(p * 3.0));
  P.od += od(PRUSSIAN) * water * (0.25 + 0.2 * swell) * dyed;
  float path = smoothstep(0.28 + 0.25 * (hz - p.y), 0.0, abs(p.x - 0.02 * sin(p.y * 30.0)) + 0.12 * fbm3(p * vec2(3.0, 12.0) + vec2(0.0, t * 0.2)));
  float strokes = dryBrush(vec2(p.x * 3.0 + t * 0.05, p.y * 1.5), 75.0, 0.05);
  float moonlight = wax * (1.0 - wane) + 0.15;
  addOpaque(P, goldCol(p * 3.0, t), water * path * strokes * moonlight * 0.75 * dyed);
  // the tide comes in and goes out with it: a wet line creeping up the sand
  float tide = hz - 0.45 + 0.12 * wax - 0.12 * wane + 0.015 * sin(p.x * 4.0 + t * 0.8);
  P.od += od(PAYNE) * inkLine(p.y - tide - 0.02 * fbm3(vec2(p.x * 3.0, 2.0)), p, 0.003, 76.0) * 0.5 * dyed;
  P.od += od(OCHRE) * smoothstep(tide + 0.01, tide - 0.02, p.y) * 0.25 * dyed;
  // drum hits: rings spreading on the water
  for (int i = 0; i < 4; i++) {
    float age = uAccents[i].x;
    if (age > 2.5 || age > t) continue;
    vec2 h = hash22(vec2(uAccents[i].w, 3.0));
    vec2 c = vec2((h.x - 0.5) * 2.8, hz - 0.08 - h.y * 0.35);
    vec2 q = (p - c) * vec2(0.45, 1.6);
    float ring = abs(length(q) - (0.02 + age * 0.08));
    float on = water * exp(-age * 1.6) * uAccents[i].y * uAccents[i].z * smoothstep(2.5, 1.5, age);
    addOpaque(P, goldCol(q, t), smoothstep(0.01, 0.0, ring) * on * 0.35 * dyed);
  }
  addOpaque(P, goldCol(p, t), goldFlakes(p + vec2(0.0, -t * 0.01), 45.0, 74.0, 0.03) * 0.6 * dyed * step(hz, p.y));
}
` },
  8: { fn: 'sBloom', src: /* glsl */ `
// ================================================================ 8 · 色即是空 chorus bloom
// A folded blot that bursts open on 色即是空 and unfolds a second time on
// 空即是色. It never holds still: the layers of pigment slide and breathe
// against each other, their wet edges crawl, tide lines ripple outwards
// from each wash, and the drums throw fresh drops that spread and fade.
void sBloom(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float g = 0.25 + 0.85 * easeOut(t / 1.4) + 0.012 * t + 0.035 * sin(t * 0.9) + 0.06 * uPulse;
  float g2 = easeOut(span01(t, k0.y, k1.y));           // the second unfolding
  g += 0.08 * g2 * (1.0 - 0.5 * span01(t, k1.y, k1.y + 3.0));
  float bright = v;  // 1 for the final chorus
  float tw = t * 4.0;                                   // the wet edges crawl
  // the page drifts slowly towards us
  vec2 q = p * (0.95 + 0.1 * bright) * (1.0 - 0.05 * easeOut(t / 9.0));
  vec2 flow = vec2(0.02 * sin(t * 0.3 + p.y * 2.0), -t * 0.02);    // pigment settling and swirling
  // fold crease
  P.od += od(PAYNE) * exp(-abs(p.x) / 0.004) * 0.06;
  // each layer breathes at its own pace, so they slide over one another
  vec2 o1 = vec2(0.0, 0.03 * sin(t * 0.45)), o2 = vec2(0.0, 0.04 * sin(t * 0.37 + 1.3));
  vec2 o3 = vec2(0.0, 0.035 * sin(t * 0.52 + 2.1)), o4 = vec2(0.0, 0.03 * sin(t * 0.33 + 3.3));
  vec2 o5 = vec2(0.0, 0.04 * sin(t * 0.41 + 4.4));
  float s1 = 1.0 + 0.05 * sin(t * 0.61), s2 = 1.0 + 0.06 * sin(t * 0.43 + 1.0), s3 = 1.0 + 0.05 * sin(t * 0.57 + 2.0);
  float d1 = blotSDF((q - o1) * 1.05 * s1, 1.0 + bright * 40.0, g, tw, 1.1);
  P.od += od(mix(ROSE, VERMILION, 0.25 + 0.25 * sin(t * 0.2))) * wash(d1, q + flow, 1.0, 0.03) * gran(q, 0.3) * 0.8;
  float d2 = blotSDF((q - vec2(0.0, -0.18) - o2) * 1.25 * s2 / (1.0 + 0.3 * g2), 2.0 + bright * 40.0, g * 0.95, tw, 1.0);
  P.od += od(mix(ULTRA, COBALT, 0.4 + 0.3 * bright)) * wash(d2, q + flow, 2.0, 0.025) * gran(q, 0.9) * 0.75;
  float d3 = blotSDF((q - vec2(0.0, 0.2) - o3) * 1.7 * s3, 3.0 + bright * 40.0, g, tw, 0.9);
  P.od += od(GAMBOGE) * wash(d3, q + flow, 3.0, 0.03) * 0.8;
  float d4 = blotSDF((q - vec2(0.0, -0.5) - o4) * 1.9 / (1.0 + 0.25 * g2), 4.0 + bright * 40.0, g * 0.9, tw, 1.0);
  P.od += od(mix(SAPGREEN, TURQUOISE, bright)) * wash(d4, q + flow, 4.0, 0.02) * gran(q, 0.5) * 0.65;
  float d5 = blotSDF((q - vec2(0.0, 0.5) - o5) * 2.1, 5.0 + bright * 40.0, g, tw, 1.1);
  P.od += od(VIOLET) * wash(d5, q + flow, 5.0, 0.02) * gran(q, 0.7) * 0.7;
  // the second unfolding: a glaze of turquoise opens up and down the fold
  // behind the rest, and everything swells once more
  float d6 = blotSDF(q * vec2(1.45, 0.9), 6.0 + bright * 40.0, 0.15 + 1.0 * g2, tw, 1.0);
  P.od += od(mix(TURQUOISE, CERULEAN, 0.4)) * wash(d6, q + flow, 6.0, 0.025) * gran(q, 0.6) * 0.45 * step(0.001, g2);
  // tide lines: water still spreading out from each wash
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float front = mod(t * 0.035 + fi * 0.04, 0.12);
    float fade = (1.0 - front / 0.12) * smoothstep(0.0, 0.02, front);
    float dd = i == 0 ? d1 : i == 1 ? d2 : d5;
    vec3 col = i == 0 ? ROSE : i == 1 ? ULTRA : VIOLET;
    P.od += od(col) * exp(-sq((dd - front) / 0.004)) * fade * 0.3;
  }
  // backruns where the washes met while wet, spreading as they dry
  float anyW = smoothstep(0.02, -0.02, min(min(d1, d2), min(d3, d5)));
  P.od += od(ROSE) * backrun(q + flow, 7.0, 3.5 - 0.6 * easeOut(t / 8.0)) * anyW * 0.35;
  // a few drops thrown out by the fold
  vec2 sq = vec2(abs(q.x), q.y);
  float spread = smoothstep(1.05, 0.55, length(sq * vec2(0.9, 1.0))) * smoothstep(0.2, 0.9, g);
  float sp1 = splatter(sq, 9.0, 6.0, 0.03, 0.12) + edgeWobble(sq * 3.0, 9.0, 0.006);
  float sp2 = splatter(sq + 0.3, 19.0, 13.0, 0.016, 0.1) + edgeWobble(sq * 4.0, 19.0, 0.004);
  P.od += od(ROSE) * wash(sp1, sq, 9.0, 0.006) * spread * 0.8;
  P.od += od(ULTRA) * wash(sp2, sq, 19.0, 0.005) * spread * 0.8;
  // and fresh ones on the drums, mirrored, spreading as they soak in
  for (int i = 0; i < 6; i++) {
    float age = uAccents[i].x;
    if (age > 4.0 || age > t) continue;
    float ht = uAccents[i].w;
    vec2 h = hash22(vec2(ht, 8.0));
    vec2 c = vec2(0.55 + h.x * 0.9, (h.y - 0.5) * 1.5);
    vec2 dq = sq - c;
    float rad = (0.012 + 0.03 * uAccents[i].y) * (0.6 + 0.8 * easeOut(age / 1.2)) * easeOut(age * 5.0);
    float d = length(dq) - rad + edgeWobble(dq * 6.0, ht, 0.006);
    float fade = uAccents[i].z * smoothstep(4.0, 1.5, age);
    vec3 col = h.y > 0.5 ? ROSE : h.x > 0.5 ? ULTRA : GAMBOGE;
    P.od += od(col) * wash(d, dq, ht, 0.006) * fade * 0.7;
  }
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
  // the hand drifts up a little and turns, as if held out to us
  float s = 0.93 + 0.04 * easeOut(t / 6.0);
  vec2 c = vec2(-0.3 + 0.03 * sin(t * 0.3), -0.06 + 0.05 * easeOut(t / 5.0) + 0.012 * sin(t * 0.7));
  vec2 q = rot(-0.05 + 0.04 * sin(t * 0.35)) * (p - c) / s;
  float d = sdHand(q) * s;
  float inside = smoothstep(0.004, -0.004, d + edgeWobble(q, 81.0, 0.006));
  float well = ease(span01(t, k0.x, k1.x));    // 宇宙が透ける: the universe shows through, and spills out
  // the galaxy seeps into the hand from the palm outwards
  vec2 g = q - vec2(-0.02, 0.0);
  float r = length(g), a = atan(g.y, g.x);
  float seep = smoothstep(0.0, 0.08, 0.15 + 1.4 * ease(span01(t, 0.3, 3.2)) - r - 0.1 * fbm3(g * 3.0 + t * 0.2));
  float fill = inside * seep;
  float spin = t * 0.28;
  float arms = 0.5 + 0.5 * cos(2.0 * (a + log(r + 0.03) * 2.3 - spin) + fbm3(g * 4.0 + vec2(t * 0.05, 0.0)) * 1.8);
  float core = smoothstep(0.55, 0.0, r) * (0.9 + 0.1 * sin(t * 1.3));
  // beyond the edge of the hand once it spills: a faint nebula reaching out
  float out_ = well * smoothstep(0.45, 0.0, d) * (1.0 - inside) * (0.5 + 0.5 * fbm3(g * 2.5 - t * 0.15));
  float cosmos = fill + out_ * 0.6;
  P.od += (od(INDIGO) * 1.1 + od(VIOLET) * 0.4 * (1.0 - arms)) * cosmos * (0.8 + 0.3 * fbm3(g * 2.0));
  lift(P, cosmos * (core * 0.8 * (0.4 + 0.6 * arms) + 0.15 * arms * smoothstep(1.0, 0.3, r)));
  addPig(P, ROSE, cosmos * arms * smoothstep(0.7, 0.15, r) * 0.25);
  addPig(P, GAMBOGE, fill * smoothstep(0.2, 0.0, r) * 0.35);
  addPig(P, CERULEAN, cosmos * arms * smoothstep(0.9, 0.4, r) * 0.2);
  // stars turning with the galaxy, drifting outwards when it spills
  vec2 gs = rot(spin * 0.15) * g / (1.0 + 0.25 * well);
  addOpaque(P, vec3(0.98, 0.97, 0.94), goldFlakes(gs + 5.0, 130.0, 82.0, 0.07) * cosmos * 0.9);
  addOpaque(P, vec3(0.98, 0.97, 0.94), goldFlakes(gs * 0.7, 45.0, 83.0, 0.04) * cosmos);
  addOpaque(P, goldCol(g, t), goldFlakes(gs * 1.3 + 2.0, 70.0, 84.0, 0.05) * cosmos * 0.8);
  // a comet crossing the palm
  vec2 cp = g - vec2(-0.6 + 1.2 * fract(t * 0.12), 0.35 - 0.3 * fract(t * 0.12));
  float comet = smoothstep(0.012, 0.0, length(cp * vec2(1.0, 3.0) + vec2(0.0, 0.0))) + exp(-abs(cp.y + 0.25 * cp.x) / 0.004) * smoothstep(0.0, 0.25, cp.x) * smoothstep(0.35, 0.1, cp.x);
  addOpaque(P, vec3(0.98, 0.96, 0.9), comet * fill * 0.7);
  // the hand itself: a loose line of sumi, brushed in first, growing fainter
  // as the hand turns to sky; and a pale shadow wash beside it
  float brushed = smoothstep(0.0, 0.06, easeOut(span01(t, -0.4, 1.6)) * 1.1 - fract((atan(q.x, -q.y) + PI) / TAU));
  P.od += od(SUMI) * inkLine(d, q, 0.007, 85.0) * brushed * (0.95 - 0.45 * well);
  P.od += od(PAYNE) * softWash(abs(d + 0.02) - 0.02, q, 86.0, 0.03) * 0.12 * (1.0 - well);
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
// Call and response in a bamboo grove: the drums play a bar, then rest while
// the shakuhachi answers. Each answer is a breath of ink drawn across the
// grove (beats 0-2); each drum hit throws a splash, big and sometimes
// vermilion for the strong ones, a small spatter for the lighter ones. When
// the drums play on without resting (beat 3) the grove shakes and leaves
// come down.

// One breath: a long brushstroke drawn across the page from the left while
// the flute plays (a..b), running dry towards its end, then soaking away.
float breath(vec2 p, float t, float a, float b, float y0, float seed) {
  float prog = span01(t, a - 0.1, b);
  float fade = 1.0 - smoothstep(b + 0.8, b + 4.0, t);
  if (prog <= 0.0 || fade <= 0.0) return 0.0;
  float x0 = -2.0, x1 = 1.95;
  float head = mix(x0, x1, easeOut(prog));
  float along = clamp((p.x - x0) / (x1 - x0), 0.0, 1.0);
  float y = y0 + 0.12 * sin(p.x * 1.2 + seed) + 0.05 * sin(p.x * 3.1 + seed * 2.0) + 0.012 * sin(p.x * 9.0 + t * 0.6);
  float w = (0.006 + 0.022 * pow(max(sin(min(along * 1.15, 1.0) * PI), 0.0), 0.7)) * (0.8 + 0.3 * gnoise(vec2(p.x * 2.5, seed)));
  float d = abs(p.y - y) - w;
  float drawn = smoothstep(head, head - 0.06, p.x);
  float fly = dryBrush(vec2(p.x * 0.5 + seed, (p.y - y) / max(w, 0.004) * 0.12), seed, 0.25 - 0.45 * along);
  return smoothstep(0.003, -0.003, d) * drawn * fade * mix(1.0, fly, smoothstep(0.35, 0.95, along));
}

// The time since -infinity that smoothstep(a, a + f, s) has been on, up to t.
float onFor(float t, float a, float f) {
  float u = clamp((t - a) / f, 0.0, 1.0);
  return f * (u * u * u - 0.5 * u * u * u * u) + max(t - a - f, 0.0);
}

void sTaiko(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  // how much the flute is sounding right now (the drums are resting), and
  // how long it has sounded so far
  float rest = 0.0, restFor = 0.0;
  for (int i = 0; i < 3; i++) {
    rest = max(rest, win(t, k0[i], k1[i], 0.3, 0.6));
    restFor += onFor(t, k0[i], 0.3) - onFor(t, k1[i] - 0.6, 0.6);
  }
  float drums = smoothstep(k0.w, k0.w + 0.5, t);
  // mist and a pale vermilion sun behind the grove; the mist rises in the rests
  float sd = length(p - vec2(0.75, 0.42)) - 0.3 + edgeWobble(p, 101.0, 0.02);
  P.od += od(VERMILION) * wash(sd, p, 101.0, 0.03) * 0.38;
  P.od += od(PAYNE) * softWash(-0.6 - p.y + 0.15 * fbm3(vec2(p.x * 0.8 + t * 0.03, 1.0)), p, 102.0, 0.25) * 0.12;
  P.od += od(PAYNE) * softWash(p.y - 0.7 + 0.15 * fbm3(vec2(p.x * 0.7 - t * 0.02, 2.0)), p, 103.0, 0.3) * 0.06;
  // bamboo, three depths, drifting past; the wind moves it in the rests, and
  // it sways a little more while the drums play on (smoothly: jolting it on
  // every hit made it jitter)
  float sway = 0.015 * sin(t * 1.1) * rest + 0.008 * sin(t * 2.3) * drums * (0.5 + 0.5 * uLevel);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float x0 = -1.9 + fi * 0.72 + 0.2 * hash11(fi) - t * 0.01;
    bamboo(P, p, x0, 0.014, 0.03 + sway * 0.5, 0.34, 0.22, fi + 110.0);
  }
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x0 = -1.5 + fi * 1.05 + 0.3 * hash11(fi + 20.0) - t * 0.02;
    bamboo(P, p, x0, 0.024, -0.04 + sway, 0.42, 0.5, fi + 120.0);
  }
  // the mist lifts over the middle distance while the flute plays
  addOpaque(P, vec3(0.95, 0.94, 0.9), softWash(abs(p.y + 0.35 + 0.1 * fbm3(vec2(p.x * 0.6 + t * 0.05, 7.0))) - 0.18, p, 105.0, 0.2) * rest * 0.35);
  // the near leaves stir three times as fast in the rests (their clock runs
  // faster, rather than being scaled: t * (1 + 2 * rest) jumps ahead
  // by seconds as rest comes up, and the leaves thrashed)
  float leafT = t + 2.0 * restFor;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float x0 = (i == 0 ? -1.25 : 1.35) - t * 0.035;
    bamboo(P, p, x0, 0.042, 0.05 + sway * 1.5, 0.55, 1.0, fi + 130.0);
    bambooLeaves(P, p, vec2(x0 + 0.05, 0.55 - fi * 0.9), 1.0 - fi * 2.0, 0.24, 0.95, fi + 131.0, leafT);
    bambooLeaves(P, p, vec2(x0 - 0.04, 0.1 + fi * 0.3), -1.0 + fi * 2.0, 0.2, 0.9, fi + 133.0, leafT);
  }
  // the shakuhachi's answers: a breath of ink for each rest
  float br = breath(p, t, k0.x, k1.x, 0.3, 104.0) + breath(p, t, k0.y, k1.y, -0.05, 107.0) + breath(p, t, k0.z, k1.z, 0.5, 109.0);
  br = min(br, 1.0);
  P.od += od(SUMI) * br * 0.85;
  // taiko: each drum hit throws a splash of ink, sized by how hard it was
  // hit, the loudest in vermilion; it spreads over a quarter of a second and
  // soaks away slowly, so the splashes gather while the drums play
  for (int i = 0; i < 16; i++) {
    float age = uHits[i].x;
    float str = uHits[i].y;
    if (age > 4.0 || age > t || str < 0.45) continue;
    float hs = t - age;    // when it was hit, in scene time: nothing splashes in the rests
    if ((hs > k0.x && hs < k1.x) || (hs > k0.y && hs < k1.y) || (hs > k0.z && hs < k1.z)) continue;
    float ht = uHits[i].w;
    vec2 h = hash22(vec2(ht, 11.0));
    vec2 c = vec2((h.x - 0.5) * 2.8, (h.y - 0.5) * 1.3);
    float size = (0.02 + 0.14 * str * str) * easeOut(age * 4.0);
    if (length((p - c) * vec2(1.0, 0.5)) > size * 2.4 + 0.02) continue;
    float d = sdSplash(p - c, h.x * 40.0, size);
    float fade = uHits[i].z * (1.0 - smoothstep(1.5, 4.0, age)) * smoothstep(0.0, 0.06, age);
    vec3 col = str > 0.9 ? VERMILION : SUMI;
    P.od += od(col) * wash(d, p, h.y * 30.0, 0.008) * fade * 0.95;
    if (str < 0.65) continue;    // only the bigger splashes run
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
  // leaves shaken down while the drums play on
  if (drums > 0.0) {
    vec2 lq = vec2(p.x + 0.1 * sin(p.y * 2.0 + t), p.y + (t - k0.w) * 0.22) * 3.5;
    vec2 g = floor(lq), f = fract(lq) - 0.5;
    vec2 h = hash22(g + 140.0);
    float on = step(0.72, h.x) * drums * smoothstep(0.0, 1.5, (t - k0.w) - h.y * 1.5);
    // (kept well inside its cell, so turning never clips its tips)
    vec2 leafq = rot(h.y * TAU + t * (h.x - 0.8) * 3.0) * (f - (h - 0.5) * 0.2);
    float leaf = sdVesica(leafq, 0.18, 0.04);
    P.od += od(SUMI) * wash(leaf / 3.5, p, h.y * 9.0, 0.004) * on * 0.8;
  }
}
` },
  17: { fn: 'sCranes', src: /* glsl */ `
// ================================================================ 17 · 鶴 cranes over the mountains
// After the drums, one long held note: mountains in layers of mist, the
// sun from the grove sinking behind them, and three red-crowned cranes
// crossing slowly in a loose V, while a far flock crosses the other way
// low over the middle ranges.

// A crane in flight facing left, about 0.8 wide; flap is the wing phase.
// Returns distances to its white parts (x), its black parts (y) and its
// red crown (z).
vec3 sdCrane(vec2 q, float flap) {
  float body = sdEllipse(q - vec2(0.02, 0.0), vec2(0.15, 0.045));
  float neck = sdTaper(q, vec2(-0.1, 0.012), vec2(-0.29, 0.035), 0.016, 0.01);
  float head = length(q - vec2(-0.3, 0.036)) - 0.019;
  float beak = sdTaper(q, vec2(-0.31, 0.034), vec2(-0.39, 0.024), 0.007, 0.0015);
  float legs = min(sdTaper(q, vec2(0.12, -0.012), vec2(0.36, -0.03), 0.005, 0.003),
                   sdTaper(q, vec2(0.12, -0.02), vec2(0.35, -0.045), 0.005, 0.003));
  float tail = sdTaper(q, vec2(0.13, 0.0), vec2(0.2, -0.004), 0.025, 0.012);
  // the near wing, a broad sweep from the shoulder; its trailing feathers are black
  float up = sin(flap);
  vec2 sh = vec2(-0.02, 0.02);
  vec2 tip = sh + vec2(0.16 - 0.06 * abs(up), 0.38 * up);
  float wing = sdTaper(q, sh + vec2(0.03, 0.0), tip, 0.085, 0.035) + 0.008 * sin(dot(q, vec2(9.0, 40.0)));
  vec2 ax = normalize(tip - sh);
  float across = dot(q - sh, vec2(ax.y, -ax.x)) * sign(up + 1e-3);
  float black = max(wing, 0.012 - across);    // the half towards the tail
  float white = min(min(body, head), max(wing, -black));
  float dark = min(min(min(neck, beak), min(legs, tail)), black);
  float crown = length(q - vec2(-0.298, 0.05)) - 0.009;
  return vec3(white, dark, crown);
}

// Height of mountain range i (0 far .. 3 near) at x: ridged peaks of
// varying height over a gentle swell.
float rangeH(float x, float fi) {
  float base = 0.05 - fi * 0.22;
  float r = 1.0 - abs(gnoise(vec2(x * (1.1 + fi * 0.3), fi * 5.0)));
  r = r * r * (0.6 + 0.4 * (1.0 - abs(gnoise(vec2(x * 2.7 + 1.3, fi * 3.0)))));
  float swell = 0.55 + 0.45 * sin(x * (0.6 + fi * 0.2) + fi * 1.7);
  return base + (0.34 - fi * 0.05) * r * swell + 0.02 * gnoise(vec2(x * 11.0, fi * 2.0));
}

// The far flock: six small, hazy cranes in a loose, uneven line, flying
// left to right low over the middle ranges. They're slower than the cranes
// above; the first comes in at the left edge as the scene opens, and the two
// flocks pass each other late in the note. Drawn among the ranges: the
// nearer ones hide them and the mist below veils them.
void farFlock(inout Paint P, vec2 p, float t, float pan) {
  vec2 lead = vec2(-1.9 + 0.32 * t, -0.16 + 0.015 * sin(t * 0.35));
  if (p.x > lead.x + 0.2 || p.x < lead.x - 1.25 || abs(p.y - lead.y + 0.04) > 0.2) return;
  float ink = 0.0, dark = 0.0;
  for (int j = 0; j < 6; j++) {
    float fj = float(j);
    vec2 h = hash22(vec2(fj, 231.0));
    float sc = 0.22 + 0.06 * h.y;
    // trailing back and a little down from the lead, each drifting in its
    // place; small birds beat their wings faster, each in its own time
    vec2 c = lead + vec2(-fj * 0.18 - 0.05 * h.x + 0.03 * sin(t * 0.4 + fj * 1.7),
                         -0.012 * fj + 0.05 * (h.y - 0.5) + 0.012 * sin(t * 0.55 + fj * 2.3));
    float flap = t * TAU / (0.8 + 0.2 * h.x) + h.y * TAU;
    c.y -= 0.02 * sc * sin(flap);
    vec2 q = (p - c) / sc;
    q.x = -q.x;    // facing right
    if (length(q) > 0.6) continue;
    vec3 d = sdCrane(q, flap) * sc;
    ink = max(ink, smoothstep(0.002, -0.002, min(d.x, d.y)));
    dark = max(dark, smoothstep(0.002, -0.002, d.y));
  }
  if (ink <= 0.0) return;
  float occ = 1.0;
  for (int i = 2; i < 4; i++) {
    float fi = float(i);
    float x = p.x + pan * (0.4 + fi * 0.6) + fi * 3.7;
    float base = 0.05 - fi * 0.22;
    occ *= 1.0 - smoothstep(0.004, -0.004, p.y - rangeH(x, fi)) * smoothstep(base - 0.2, base + 0.12, p.y);
  }
  P.od += od(PAYNE) * ink * occ * 0.3;
  P.od += od(SUMI) * dark * occ * 0.5;
}

void sCranes(vec2 p, float t, float v, vec4 k0, vec4 k1, inout Paint P) {
  float pan = t * 0.02;
  // morning sky, and the sun sinking behind the far range
  P.od += od(GAMBOGE) * softWash(-p.y + 0.1 + 0.1 * fbm3(p * 1.1 + 3.0), p, 201.0, 0.3) * 0.18;
  P.od += od(ROSE) * softWash(p.y - 0.75 + 0.1 * fbm3(p * 1.3), p, 202.0, 0.3) * 0.1;
  float sd = length(p - vec2(0.8, 0.38 - 0.05 * t / 7.0)) - 0.26 + edgeWobble(p, 203.0, 0.02);
  P.od += od(VERMILION) * wash(sd, p, 203.0, 0.03) * 0.3;
  // mountain ranges, far to near, each paler at its foot where the mist lies
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x = p.x + pan * (0.4 + fi * 0.6) + fi * 3.7;
    float base = 0.05 - fi * 0.22;
    float h = rangeH(x, fi);
    float d = p.y - h;
    float body = wash(d + edgeWobble(p * vec2(1.0, 2.0), 204.0 + fi, 0.01), p, 204.0 + fi, 0.012);
    float foot = smoothstep(base - 0.2, base + 0.12, p.y);    // fading into the mist below
    float k = (0.2 + fi * 0.2) * foot;
    P.od += od(mix(PAYNE, SUMI, fi / 3.0)) * body * k * gran(p, 0.4);
    P.od += od(ULTRA) * body * foot * 0.06 * (3.0 - fi);
    // dry-brush texture strokes on the slopes (皴)
    P.od += od(SUMI) * dryBrush(rot(0.5) * p * vec2(2.5, 1.0) + fi, 205.0 + fi, -0.1) * smoothstep(0.0, -0.06, d) * smoothstep(-0.2, -0.02, d) * foot * 0.07 * (fi + 1.0) / 4.0;
    if (i == 1) farFlock(P, p, t, pan);
    // mist drifting between the ranges
    addOpaque(P, vec3(0.955, 0.935, 0.885), softWash(abs(p.y - base + 0.1 + 0.05 * fbm3(vec2(p.x * 0.7 - t * 0.04, fi))) - 0.05, p, 206.0 + fi, 0.08) * 0.55);
  }
  // pines on the nearest ridge
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float bx = -1.3 + fi * 0.16;
    vec2 b = vec2(bx - pan * 2.2, rangeH(bx + 3.0 * 3.7, 3.0) - 0.02);   // standing on the near range as it drifts
    vec2 q = p - b;
    float trunk = sdSeg(q, vec2(0.0), vec2(0.03 * sin(fi * 2.0), 0.25 + 0.05 * fi)) - 0.006;
    float crown = 1e3;
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      crown = smin(crown, sdEllipse(q - vec2((hash11(fj + fi * 4.0) - 0.5) * 0.12, 0.12 + fj * 0.06), vec2(0.07 - fj * 0.012, 0.026)), 0.03);
    }
    crown += 0.015 * fbm3(q * 14.0 + fi);
    P.od += od(SUMI) * wash(min(trunk, crown), q, fi + 207.0, 0.008) * 0.8;
  }
  // three cranes in a loose V, crossing right to left
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 off = vec2(fi * 0.36, -fi * 0.1 + (i == 2 ? 0.2 : 0.0));
    float flap = t * TAU / 1.4 + fi * 1.1;
    vec2 c = vec2(1.85 - (t - k0.x) * 0.5, 0.42 - 0.03 * t / 7.0) + off;
    c.y -= 0.02 * sin(flap);                      // the body rises as the wings come down
    float sc = 0.85 - fi * 0.1;
    vec2 q = (p - c) / sc;
    if (length(q) > 0.6) continue;
    vec3 d = sdCrane(q, flap) * sc;
    float white = smoothstep(0.003, -0.003, d.x + edgeWobble(q * 3.0, fi, 0.002));
    float dark = smoothstep(0.003, -0.003, d.y + edgeWobble(q * 5.0, fi + 3.0, 0.002));
    addOpaque(P, vec3(0.97, 0.965, 0.94), white * 0.95);
    P.od += od(PAYNE) * softWash(d.x + 0.012, q, fi, 0.02) * white * smoothstep(0.02, -0.04, q.y) * 0.35 * (1.0 - P.ga);
    addOpaque(P, vec3(0.2, 0.2, 0.22) * (0.4 + 0.2 * fbm3(q * 20.0)), dark * 0.95);
    addOpaque(P, vec3(0.3, 0.3, 0.33), inkLine(d.x, q, 0.0022, fi * 5.0) * (1.0 - dark) * 0.7);
    addOpaque(P, VERMILION, smoothstep(0.002, -0.002, d.z) * 0.95);
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
  // a chain hanging steeply through the middle of the page, clear of the
  // lyrics on either side; it dissolves link by link on 溶けてゆく, from the
  // top down, and is gone by the end of the line
  vec2 o = vec2(-0.95, 1.15), e = vec2(0.95, -1.15);
  vec2 dir = normalize(e - o);
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = dot(p - o, dir), across = dot(p - o, nrm) - 0.05 * sin(along * 1.7 + 0.5);
  float total = length(e - o);
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
    float sAl = clamp(cen / total, 0.0, 1.0);
    float dur = k1.x - k0.x;
    float dissolve = smoothstep(k0.x + sAl * dur * 0.55, k0.x + sAl * dur * 0.55 + dur * 0.45, t);
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
    float age = uAccents[i].x;
    float ring = exp(-sq((r - 0.4 - age * 0.9) / (0.03 + age * 0.05))) * exp(-age * 1.2) * uAccents[i].y * uAccents[i].z;
    addOpaque(P, goldCol(p * 2.0, t), goldFlakes(p, 110.0, uAccents[i].w * 3.7, 0.5) * ring);
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
  // on the right the green shore rises into a mountain, faint at first and
  // clearer as the figure comes undone: mountains are mountains again.
  // Its foot follows the shore's edge (as band() draws it), with a long
  // slope to the left and a steeper one to the right.
  float shore = -0.42 + 0.15 * (fbm3(vec2(p.x * 1.1 - 193.0, 386.0)) + 0.6 * fbm3(vec2(p.x * 0.35 + 193.0, 5.0)));
  float mx = p.x - 1.0;
  float ms = sqrt(mx * mx + 0.004) / mix(0.95, 0.5, smoothstep(-0.1, 0.1, mx));
  float mh = pow(max(0.0, 1.0 - ms), 1.6);
  float ridge = shore + 0.34 * mh + 0.015 * fbm3(vec2(p.x * 6.0, 196.0)) * mh;
  float mount = wash(max(p.y - ridge, shore - p.y), p, 196.0, 0.02);
  P.od += od(mix(CERULEAN, TURQUOISE, 0.3)) * mount * 0.22 * mix(0.4, 1.0, ease(span01(t, k0.x, k1.x)));
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
  // high on the page, with the last lines written beneath it
  vec2 c = p - vec2(0.0, 0.2);
  float prog = easeOut(span01(t, k0.x, k1.x));
  float a0 = radians(235.0), span = radians(335.0);
  float ang = atan(c.y, c.x);
  float s = mod(a0 - ang, TAU) / span;         // 0 at the start of the stroke
  float r = length(c);
  float r0 = 0.47 + 0.013 * sin(s * 5.0);
  float press = smoothstep(0.0, 0.04, s);      // the brush settling onto the paper
  float w = mix(0.075, 0.025, pow(s, 0.8)) * (0.85 + 0.15 * press) * (1.0 + 0.15 * gnoise(vec2(s * 7.0, 1.0)));
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
  float hd = length((c - head) * vec2(1.0, 1.08)) - 0.075 + 0.007 * gnoise(c * 45.0);
  float pool = smoothstep(0.003, -0.003, hd) * step(0.0, prog) * step(s, 0.25);
  P.od += od(SUMI) * (max(ink * tone, pool * 0.95) + body * exp(-max(-edge, 0.0) / 0.006) * 0.25 * (1.0 - dry)) * 1.1;
  // faint bleed around the wet part
  P.od += od(PAYNE) * exp(-max(edge, 0.0) / 0.03) * smoothstep(0.0, -0.02, edge + 0.02) * drawn * (1.0 - s) * 0.1;
  // bells: faint tide-mark rings on the paper
  for (int i = 0; i < 3; i++) {
    float age = uAccents[i].x;
    float R = 0.1 + age * 0.3;
    float wob = 0.01 * fbm3(c * 4.0 + float(i));
    float ring = exp(-sq((r - R + wob) / 0.004)) + 0.2 * smoothstep(R, R - 0.03, r) * smoothstep(R - 0.15, R - 0.03, r);
    P.od += od(PAYNE) * ring * exp(-age * 0.5) * uAccents[i].y * uAccents[i].z * 0.1;
  }
}
` },
};
