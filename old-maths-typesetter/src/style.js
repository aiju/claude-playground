// The house style: a mathematics book from the Clarendon Press, Oxford, in
// the late 1940s, set in Monotype Modern on a royal octavo page. Measured
// from G. H. Hardy's "Divergent Series" (1949). All lengths in points.

export const clarendon = {
  page: { width: 450, height: 720 }, // royal octavo, 6¼ × 10 in
  textWidth: 324, // 27 picas
  linesPerPage: 39,
  margins: { top: 84, inner: 56 }, // top: to the running head's baseline
  headSep: 17.5, // running head baseline to first text baseline
  topSkip: 10,
  maxDepth: 5, // how far the last line may hang below the page's last baseline

  size: 10.5,
  leading: 13,
  parIndent: 12,
  lineSkipLimit: 1,
  lineSkip: 2, // clearance when tall formulae would collide

  footnote: { size: 8.5, leading: 10, indent: 8, sep: 17, between: 1.5 },

  head: { size: 9.5, tracking: 0.12 }, // running heads: spaced capitals
  folioSize: 10.5,
  signature: { size: 8.5, drop: 26 }, // gathering letters at the foot

  chapter: { sink: 2.5, numeralSize: 12, titleSize: 12, afterNumeral: 20, afterTitle: 10 },
  section: { before: 6.5, beforeStretch: 3, afterHead: 6 },

  // Hardy's displays have hardly any space of their own; the page is filled
  // out by stretching it
  display: {
    above: 3,
    aboveStretch: 3,
    aboveShrink: 1.5,
    below: 3,
    belowStretch: 3,
    belowShrink: 1.5,
    jot: 3, // extra space between lines of a multi-line display
    numberGap: 1.2, // em: equation number to formula, at least
    columnGap: 1.8, // em: the same, for equations set side by side
  },

  // line breaking, as in plain TeX
  pretolerance: 100,
  tolerance: 400,
  emergencyStretch: 12,
  linePenalty: 10,
  hyphenPenalty: 50,
  exHyphenPenalty: 50,
  adjDemerits: 10000,
  doubleHyphenDemerits: 10000,
  finalHyphenDemerits: 5000,
  clubPenalty: 150,
  widowPenalty: 150,
  brokenPenalty: 100,

  // ink and paper: a brown-black ink on a cream stock that has aged a little
  paper: "#ece2c8",
  ink: "#21170e",

  // How the type prints; see letterpress.js. null draws clean digital type.
  // Lengths in points, frequencies per point. Calibrated against a 400 ppi
  // colour scan of Hardy's "Some famous problems of the theory of numbers"
  // (Clarendon Press, 1920) with tools/measure-ink.py: the ink's edge goes
  // from 10% to 90% over 0.9pt, hairlines print at about 40% of the darkness
  // of stems, and the paper's texture has a standard deviation of about 3
  // levels in 255.
  letterpress: {
    impression: 0.55, // 0 a light kiss, 1 heavy: how much ink is squeezed out
    spread: 0.16, // how far past the type's edge the ink is squeezed
    squeeze: 0.23, // how far the ink is pushed about, which rounds corners
    edge: 0.4, // width of the ink's edge
    feather: 0.17, // how far ink wicks into the paper
    reach: 0.6, // how far round a sort its own ink and height apply
    fibre: 1.25, // fineness of the paper fibres that roughen the edge
    roughness: 0.85,
    heightVariation: 0.12, // sorts don't all stand quite type-high...
    heightEffect: 0.35, // ...and a low one prints thinner and may break up
    inkVariation: 0.06, // nor take quite the same ink
    worn: 0.006, // share of sorts that are worn or set low
    jitter: 0.035, // how far a sort sits out of place
    twist: 0.25, // degrees
    mottle: 0.025, // the rollers' unevenness across the page
    mottleAmount: 0.14,
    squeezeRing: 0.45, // the squeeze leaves stroke middles lighter than edges
    ringAmount: 0.06,
    saltFrequency: 2.6, // specks of paper the ink missed
    saltLevel: 0.7,
    saltAmount: 0.35,
    paperGrain: 0.2,
    paperFlecks: 0.3, // stray dark fibres in the paper
    showThrough: 0.012, // the other side of the leaf, seen through the paper
    throughBlur: 0.6,
  },
};
