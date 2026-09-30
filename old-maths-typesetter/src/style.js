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

  // ink and paper
  paper: "#fbf9f3",
  ink: "#141210",
  inkSpread: 0.24, // letterpress squeezes a little ink beyond the type's edge
};
