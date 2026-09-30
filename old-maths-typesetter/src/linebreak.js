// Knuth and Plass's total-fit line breaking ("Breaking paragraphs into
// lines", 1981), the algorithm TeX uses: it considers every way of breaking
// the whole paragraph and picks the one with the fewest demerits, rather
// than filling one line at a time.

import { INF_BAD } from "./nodes.js";

const isBox = (n) => n.t === "glyph" || n.t === "rule" || n.t === "hbox" || n.t === "vbox" || n.t === "kern";

function badness(r) {
  if (r < -1) return Infinity;
  const b = 100 * Math.abs(r) ** 3;
  return Math.min(b, INF_BAD);
}

// Fitness class: 0 very loose, 1 loose, 2 decent, 3 tight.
function fitness(r) {
  if (r < -0.5) return 3;
  if (r <= 0.5) return 2;
  if (r <= 1) return 1;
  return 0;
}

export function breakParagraph(items, opts) {
  const passes = [
    { tolerance: opts.pretolerance ?? 100, hyphens: false },
    { tolerance: opts.tolerance ?? 200, hyphens: true },
    { tolerance: INF_BAD, hyphens: true, emergency: opts.emergencyStretch ?? 0, final: true },
  ];
  for (const pass of passes) {
    const r = tryBreak(items, { ...opts, ...pass });
    if (r) return r;
  }
  throw new Error("line breaking failed");
}

function tryBreak(items, o) {
  const lineWidth = typeof o.width === "function" ? o.width : () => o.width;
  const linePenalty = o.linePenalty ?? 10;
  const adjDemerits = o.adjDemerits ?? 10000;
  const doubleHyphenDemerits = o.doubleHyphenDemerits ?? 10000;
  const finalHyphenDemerits = o.finalHyphenDemerits ?? 5000;

  const n = items.length;
  // running totals *before* item i
  const W = new Float64Array(n + 1);
  const Y = new Float64Array(n + 1);
  const Z = new Float64Array(n + 1);
  const F = new Float64Array(n + 1); // infinite stretch
  for (let i = 0; i < n; i++) {
    const it = items[i];
    W[i + 1] = W[i];
    Y[i + 1] = Y[i];
    Z[i + 1] = Z[i];
    F[i + 1] = F[i];
    if (it.t === "glue") {
      W[i + 1] += it.w;
      if (it.stretchOrder > 0) F[i + 1] += it.stretch;
      else Y[i + 1] += it.stretch;
      Z[i + 1] += it.shrink;
    } else if (it.t !== "penalty") {
      W[i + 1] += it.w || 0;
    }
  }

  // index of the first item a line starting after a break at i contains
  const after = (i) => {
    let j = i + 1;
    while (j < n && (items[j].t === "glue" || items[j].t === "penalty" || items[j].t === "kern")) j++;
    return j;
  };

  let active = [{ pos: -1, start: 0, line: 0, fit: 2, demerits: 0, prev: null, flagged: false }];
  let lastDeactivated = null;

  for (let i = 0; i < n; i++) {
    const it = items[i];
    let pen = 0;
    let flagged = false;
    let extra = 0;
    if (it.t === "penalty") {
      if (it.p >= INF_BAD) continue;
      if (it.flagged && !o.hyphens) continue;
      pen = it.p;
      flagged = it.flagged;
      extra = it.w;
    } else if (it.t === "glue") {
      if (it.nobreak || i === 0 || !isBox(items[i - 1])) continue;
    } else continue;

    const candidates = [null, null, null, null];
    const next = [];
    for (const a of active) {
      const target = lineWidth(a.line);
      const L = W[i] - W[a.start] + extra;
      let r;
      if (L < target) {
        const stretch = Y[i] - Y[a.start] + (o.emergency || 0);
        if (F[i] - F[a.start] > 0) r = 0;
        else r = stretch > 0 ? (target - L) / stretch : INF_BAD;
      } else if (L > target) {
        const shrink = Z[i] - Z[a.start];
        r = shrink > 0 ? (target - L) / shrink : -Infinity;
      } else r = 0;
      const b = badness(r);
      const forced = it.t === "penalty" && pen <= -INF_BAD;

      if (b > o.tolerance && !(o.final && active.length === 1 && next.length === 0 && r < -1)) {
        if (r < -1 || forced) {
          lastDeactivated = a;
          continue; // this node can never start a feasible line again
        }
        next.push(a);
        continue;
      }
      const bb = Number.isFinite(b) ? b : INF_BAD;
      let d = (linePenalty + bb) ** 2;
      if (pen > 0) d += pen * pen;
      else if (pen > -INF_BAD) d -= pen * pen;
      if (flagged && a.flagged) d += doubleHyphenDemerits;
      if (forced && a.flagged) d += finalHyphenDemerits;
      const fit = fitness(r);
      if (Math.abs(fit - a.fit) > 1) d += adjDemerits;
      d += a.demerits;
      if (!candidates[fit] || d < candidates[fit].demerits) {
        candidates[fit] = { pos: i, start: after(i), line: a.line + 1, fit, demerits: d, prev: a, flagged, ratio: r };
      }
      if (!forced) next.push(a);
    }
    const best = Math.min(...candidates.filter(Boolean).map((c) => c.demerits));
    for (const c of candidates) if (c && c.demerits <= best + adjDemerits) next.push(c);
    active = next;
    if (!active.length) return null;
  }

  // the paragraph ends with a forced break, so every surviving node ends there
  let best = null;
  for (const a of active) if (a.pos === n - 1 && (!best || a.demerits < best.demerits)) best = a;
  if (!best) return null;
  const breaks = [];
  for (let a = best; a && a.pos >= 0; a = a.prev) breaks.unshift({ pos: a.pos, ratio: a.ratio });
  return breaks;
}

// Cut the item list at the chosen breaks. Glue and penalties at the start of a
// line are dropped, as is the glue a line breaks at; a line ending in a
// hyphenation break gets its hyphen.
export function cutLines(items, breaks) {
  const lines = [];
  let start = 0;
  for (const { pos } of breaks) {
    while (start < pos && (items[start].t === "glue" || items[start].t === "penalty" || items[start].t === "kern")) start++;
    const nodes = items.slice(start, pos);
    const brk = items[pos];
    if (brk.t === "penalty" && brk.hyphen) nodes.push(...brk.hyphen());
    lines.push({ nodes, hyphenated: !!(brk.t === "penalty" && brk.flagged) });
    start = pos + 1;
  }
  return lines;
}
