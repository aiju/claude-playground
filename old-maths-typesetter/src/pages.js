// Cut the vertical list into pages, TeX-fashion: keep adding material, note
// the cost of breaking at each legal place, and when the page overflows go
// back to the cheapest break. Footnotes shorten the page they land on.

import { kern, vbox, INF_BAD } from "./nodes.js";

// footnote marks, in order, starting afresh on each page
const FOOTNOTE_SYMBOLS = ["†", "‡", "§", "‖", "¶", "††", "‡‡"];

const AWFUL = Infinity;
const isBox = (n) => n.t === "hbox" || n.t === "vbox" || n.t === "rule";
const discardable = (n) => n.t === "glue" || n.t === "kern" || n.t === "penalty";

function badness(excess, total) {
  if (excess === 0) return 0;
  if (total <= 0) return INF_BAD;
  const r = excess / total;
  return Math.min(INF_BAD, 100 * r ** 3);
}

export function buildPages(vlist, style) {
  const vsize = style.topSkip + (style.linesPerPage - 1) * style.leading;
  const fs = style.footnote;
  const pages = [];
  let pageNumber = 1;
  let section = null;
  let chapter = null;
  const n = vlist.length;
  let i = 0;

  while (i < n) {
    while (i < n && (discardable(vlist[i]) || vlist[i].t === "pagenumber")) {
      if (vlist[i].t === "pagenumber") pageNumber = vlist[i].value;
      i++;
    }
    if (i >= n) break;
    const start = i;
    let h = 0;
    let depth = 0;
    let first = true;
    const stretch = [0, 0, 0];
    let shrink = 0;
    const notes = [];
    let footSpan = 0;
    let best = null;
    let lastWasBox = false;

    const goalNow = () => (notes.length ? vsize - fs.sep - footSpan : vsize);
    const evaluate = (j, p) => {
      const goal = goalNow();
      // like TeX's \maxdepth: a deep last line counts against the page
      const h0 = h;
      h += Math.max(0, depth - style.maxDepth);
      let b;
      if (h <= goal) {
        b = stretch[1] || stretch[2] ? 0 : badness(goal - h, stretch[0]);
      } else {
        b = h - goal <= shrink ? badness(h - goal, shrink) : AWFUL;
      }
      let c;
      if (b === AWFUL) c = AWFUL;
      else if (p <= -INF_BAD) c = p;
      else if (b < INF_BAD) c = b + p;
      else c = 100000;
      if (!best || c <= best.cost) best = { j, cost: c, goal, notes: notes.length, footSpan };
      h = h0;
      return c === AWFUL || p <= -INF_BAD;
    };

    let j = i;
    for (; j < n; j++) {
      const it = vlist[j];
      if (isBox(it)) {
        if (first) {
          h = Math.max(style.topSkip, it.h);
          first = false;
        } else h += depth + it.h;
        depth = it.d;
        for (const fn of it.footnotes || []) {
          footSpan += notes.length ? fn.leading + fs.between : 0;
          footSpan += fn.span;
          notes.push(fn);
        }
        lastWasBox = true;
        // one box can't be pushed off an otherwise empty page
        if (!best && h > goalNow()) best = { j: j + 1, cost: AWFUL, goal: goalNow(), notes: notes.length, footSpan };
        continue;
      }
      if (it.t === "glue") {
        if (lastWasBox && evaluate(j, 0)) break;
        h += depth + it.w;
        depth = 0;
        stretch[it.stretchOrder] += it.stretch;
        shrink += it.shrink;
      } else if (it.t === "kern") {
        h += depth + it.w;
        depth = 0;
      } else if (it.t === "penalty") {
        if (it.p < INF_BAD && evaluate(j, it.p)) break;
      }
      lastWasBox = false;
    }
    if (!best) best = { j: n, goal: goalNow(), notes: notes.length, footSpan };

    const items = vlist.slice(start, best.j);
    const firstBox = items.find(isBox);
    // the first baseline sits topSkip below the top of the text block
    const top = firstBox ? Math.max(0, style.topSkip - firstBox.h) : 0;
    const body = vbox([kern(top), ...items], { height: best.goal });

    // running-head bookkeeping: the section in force at the top of the page
    const topSection = firstBox && firstBox.mark ? firstBox.mark.section : section;
    let opening = null;
    for (const it of items) {
      if (!isBox(it)) continue;
      if (it.chapter) {
        opening = it.chapter;
        chapter = it.chapter;
      }
      if (it.mark && it.mark.section) section = it.mark.section;
    }
    const footnotes = notes.slice(0, best.notes);
    footnotes.forEach((fn, k) => (fn.symbol = FOOTNOTE_SYMBOLS[k % FOOTNOTE_SYMBOLS.length]));
    pages.push({
      number: pageNumber++,
      body,
      goal: best.goal,
      footnotes,
      chapter,
      section: topSection,
      opening: !!opening,
    });
    i = best.j;
  }
  return pages;
}
