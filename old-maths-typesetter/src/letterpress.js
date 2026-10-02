// How inked metal type meets paper.
//
// A letterpress page is not a clean vector drawing. Under pressure the ink
// is squeezed a little past the edge of each letter, so corners round off and
// the brackets of serifs fill in; the paper's fibres make that edge ragged;
// no two pieces of type (sorts) stand at exactly the same height or take
// exactly the same ink, so some letters print darker, some lighter or even
// broken; the rollers lay ink unevenly across the forme; and the paper's tooth
// leaves small specks the ink never reached. Thin book paper also lets the
// other side of the leaf show through faintly.
//
// The per-sort differences are worked out here with a seeded random number
// generator, so a page always prints the same way. Everything else happens
// in SVG filters. The glyphs are drawn with their sort's ink density in the
// red channel and its height in the green; the ink filter spreads those
// values a little around each glyph and uses them, then paints the result in
// the ink colour.

// Small, fast, seedable PRNG (mulberry32).
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Roughly normal, mean 0, standard deviation 1.
function gauss(rand) {
  return (rand() + rand() + rand() + rand() - 2) * 1.732;
}

// One sort's quirks: how far it is out of true, how much ink it took and how
// high it stands (0.5 = type-high; lower prints lighter and may break up).
export function sortQuirks(rand, lp) {
  const worn = rand() < lp.worn;
  return {
    dx: gauss(rand) * lp.jitter,
    dy: gauss(rand) * lp.jitter * 1.4,
    rotate: gauss(rand) * lp.twist,
    density: Math.max(0.55, Math.min(1, 1 - Math.abs(gauss(rand)) * lp.inkVariation - (worn ? 0.12 : 0))),
    height: worn ? 0.12 : Math.max(0.15, Math.min(0.85, 0.5 + gauss(rand) * lp.heightVariation)),
  };
}

export function encodeSort(q) {
  return `rgb(${Math.round(q.density * 255)},${Math.round(q.height * 255)},0)`;
}

const n = (v) => +v.toFixed(4);

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// gray image (v,v,v,1) from one channel of the input
const channel = (input, c, result) => {
  const row = [0, 0, 0, 0, 0];
  row[c] = 1;
  const r = row.join(" ");
  return `<feColorMatrix in="${input}" type="matrix" values="${r} ${r} ${r} 0 0 0 0 1" result="${result}"/>`;
};

const noise = (freq, octaves, seed, result) =>
  `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="${result}"/>`;

// result = a * (1 + k * (b - 0.5)): a nudge in proportion to a, so that it
// moves edges about without putting ink where there was none
const nudge = (a, b, k, result) =>
  `<feComposite in="${a}" in2="${b}" operator="arithmetic" k1="${n(k)}" k2="${n(1 - k / 2)}" k3="0" k4="0" result="${result}"/>`;

// result = a + k * (b - 0.5), on images whose alpha is 1
const addCentred = (a, b, k, result) =>
  `<feComposite in="${a}" in2="${b}" operator="arithmetic" k1="0" k2="1" k3="${n(k)}" k4="${n(-k / 2)}" result="${result}"/>`;

const multiply = (a, b, result) => `<feComposite in="${a}" in2="${b}" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="${result}"/>`;

// v -> slope * (v - at) + 0.5 on the colour channels, alpha forced to 1
const cut = (input, slope, at, result) => {
  const f = `type="linear" slope="${n(slope)}" intercept="${n(0.5 - slope * at)}"`;
  return `<feComponentTransfer in="${input}" result="${result}"><feFuncR ${f}/><feFuncG ${f}/><feFuncB ${f}/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>`;
};

// v -> 1 - k * v, alpha forced to 1
const lessen = (input, k, result) => {
  const f = `type="linear" slope="${n(-k)}" intercept="1"`;
  return `<feComponentTransfer in="${input}" result="${result}"><feFuncR ${f}/><feFuncG ${f}/><feFuncB ${f}/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>`;
};

// Standard normal distribution function (Abramowitz and Stegun 7.1.26).
function phi(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// Inverse of phi, by bisection (only used to build lookup tables).
function phiInverse(p) {
  let lo = -8;
  let hi = 8;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (phi(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// After a Gaussian blur of width `blur`, a point at distance d inside a long
// straight edge has the value phi(d / blur). This table turns that value
// back into how much ink the point gets: full ink from `spread` outside the
// type's edge inwards, fading to none over `ramp`.
function edgeTable(blur, spread, ramp, steps = 64) {
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const v = k / steps;
    const d = v <= 0 ? -Infinity : v >= 1 ? Infinity : blur * phiInverse(v);
    out.push(n(Math.min(1, Math.max(0, 0.5 + (d + spread) / ramp))));
  }
  return out.join(" ");
}

const table = (input, values, result) => {
  const f = `type="table" tableValues="${values}"`;
  return `<feComponentTransfer in="${input}" result="${result}"><feFuncR ${f}/><feFuncG ${f}/><feFuncB ${f}/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>`;
};

// The ink filter. All lengths are in points (the page's user units), so the
// texture is fixed to the paper and doesn't change as the page is zoomed.
//
// `px` is how many device pixels a point will cover. Filters work at device
// resolution, so detail finer than a pixel can't be drawn: an ink edge
// sharper than a pixel would come out jagged and fibres smaller than a pixel
// would break the hairlines up. Below that scale the filter softens the edge
// and fades the fine texture out, as the eye would at that distance.
export function inkFilter(id, lp, ink, width, height, seed, px = 4) {
  const i = lp.impression; // 0 = a kiss, 1 = heavy
  const blur = Math.max(lp.squeeze, 0.45 / px); // pushes ink about, rounding corners
  const spread = lp.spread * (0.25 + 1.5 * i); // how far the ink passes the type's edge
  const ramp = Math.max(lp.edge, 1.1 / px); // width of the ink's edge
  const detail = Math.min(1, Math.max(0.15, (px - 1) / 5));
  const [r, g, b] = hexToRgb(ink);
  return [
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB">`,
    // the ink's edge: blurred shape, roughened by the paper and by each
    // sort's height, then cut again at the level the ink reaches
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(blur)}" result="soft"/>`,
    channel("soft", 3, "softV"),
    noise(lp.fibre, 2, seed, "fibreRaw"),
    channel("fibreRaw", 0, "fibre"),
    `<feMorphology in="SourceGraphic" operator="dilate" radius="${lp.reach}" result="sorts"/>`,
    channel("sorts", 1, "heightV"),
    nudge("softV", "fibre", lp.roughness * detail, "rough1"),
    nudge("rough1", "heightV", lp.heightEffect, "rough"),
    table("rough", edgeTable(blur, spread, ramp), "shape"),
    // how dark: each sort's ink, the rollers' unevenness, the squeeze that
    // leaves stroke middles a shade lighter than their edges, and the specks
    channel("sorts", 0, "densityV"),
    noise(`${lp.mottle} ${lp.mottle * 1.6}`, 2, seed + 1, "mottleRaw"),
    channel("mottleRaw", 0, "mottle"),
    addCentred("densityV", "mottle", lp.mottleAmount, "dens1"),
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(lp.squeezeRing)}" result="deep"/>`,
    channel("deep", 3, "deepV"),
    lessen("deepV", lp.ringAmount * (0.5 + i) * detail, "ring"),
    multiply("dens1", "ring", "dens2"),
    noise(lp.saltFrequency, 1, seed + 2, "saltRaw"),
    cut("saltRaw", 12, lp.saltLevel, "saltV"),
    lessen("saltV", lp.saltAmount * detail, "salt"),
    multiply("dens2", "salt", "dens3"),
    multiply("shape", "dens3", "alpha"),
    `<feColorMatrix in="alpha" type="matrix" values="0 0 0 0 ${n(r)} 0 0 0 0 ${n(g)} 0 0 0 0 ${n(b)} 1 0 0 0 0"/>`,
    `</filter>`,
  ].join("");
}

// Paper: a faint grain of fibres running with the machine direction, and a
// cloudier unevenness at a larger scale.
export function paperFilter(id, lp, paper, width, height, seed) {
  const [r, g, b] = hexToRgb(paper);
  const a = lp.paperGrain;
  return [
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB">`,
    noise("0.35 1.1", 3, seed + 3, "grainRaw"),
    channel("grainRaw", 0, "grain"),
    noise("0.008 0.013", 3, seed + 4, "cloudRaw"),
    channel("cloudRaw", 0, "cloud"),
    `<feComposite in="grain" in2="cloud" operator="arithmetic" k2="0.55" k3="0.45" result="mix"/>`,
    `<feColorMatrix in="mix" type="matrix" values="${n(a)} 0 0 0 ${n(r - a / 2)} ${n(a)} 0 0 0 ${n(g - a / 2)} ${n(a * 0.9)} 0 0 0 ${n(b - a * 0.45)} 0 0 0 0 1"/>`,
    `</filter>`,
  ].join("");
}

// The other side of the leaf, seen through the paper: soft and faint.
export function throughFilter(id, lp) {
  return `<filter id="${id}" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="${n(lp.throughBlur)}"/></filter>`;
}
