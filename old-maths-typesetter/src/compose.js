// Turn parsed blocks into one long vertical list of lines, displays and
// glue, ready to be cut into pages.

import { glyph, kern, glue, penalty, hbox, vbox, INF_BAD } from "./nodes.js";
import { breakParagraph, cutLines } from "./linebreak.js";
import { MathTypesetter } from "./math/layout.js";

const ABBREVIATIONS = new Set(["i.e.", "e.g.", "cf.", "viz.", "ch.", "chap.", "vol.", "p.", "pp.", "eq.", "fig.", "no.", "art.", "vols.", "ed.", "op.", "loc.", "cit."]);

export class Composer {
  constructor(fonts, style, hyphenator) {
    this.fonts = fonts;
    this.style = style;
    this.hy = hyphenator;
    this.math = new MathTypesetter(fonts);
    this.vlist = [];
    this.warnings = [];
    this.prevDepth = null;
    this.labels = new Map();
    this.body = {
      size: style.size,
      leading: style.leading,
      indent: style.parIndent,
      fonts: { roman: fonts.roman, italic: fonts.italic, bold: fonts.bold },
    };
    this.foot = {
      size: style.footnote.size,
      leading: style.footnote.leading,
      indent: style.footnote.indent,
      fonts: { roman: fonts.roman8, italic: fonts.italic8, bold: fonts.bold },
    };
  }

  compose(doc) {
    this.labels = doc.labels;
    let first = true;
    for (const block of doc.blocks) {
      if (block.type === "chapter") {
        if (!first) this.eject();
        this.chapterHead(block);
      } else if (block.type === "par") {
        this.paragraph(block);
      } else if (block.type === "display") {
        this.display(block);
      } else if (block.type === "newpage") {
        this.eject();
      } else if (block.type === "pagenumber") {
        this.vlist.push({ t: "pagenumber", value: block.value });
      }
      first = false;
    }
    this.eject();
    return this.vlist;
  }

  // \vfill\eject
  eject() {
    this.vlist.push(glue(0, 1, 0, { stretchOrder: 2 }), penalty(-INF_BAD));
    this.prevDepth = null;
  }

  appendBox(box, leading = this.style.leading) {
    if (this.prevDepth !== null) {
      let g = leading - this.prevDepth - box.h;
      if (g < this.style.lineSkipLimit) g = this.style.lineSkip;
      this.vlist.push(glue(g));
    }
    this.vlist.push(box);
    this.prevDepth = box.d;
  }

  centred(nodes) {
    return hbox([glue(0, 1, 0, { stretchOrder: 1 }), ...nodes, glue(0, 1, 0, { stretchOrder: 1 })], { width: this.style.textWidth });
  }

  chapterHead(block) {
    const st = this.style.chapter;
    const numeral = this.textNodes(block.number, this.fonts.roman, st.numeralSize);
    const title = this.textNodes(block.titleText.toUpperCase(), this.fonts.roman, st.titleSize);
    const a = this.centred(numeral);
    const b = this.centred(title);
    const box = vbox([kern(st.sink), a, kern(st.afterNumeral - a.d - b.h), b]);
    box.chapter = { number: block.number, title: block.titleText };
    this.prevDepth = null;
    this.appendBox(box);
    this.vlist.push(penalty(INF_BAD), glue(st.afterTitle - this.style.leading));
  }

  // --------------------------------------------------------------------
  // paragraphs

  paragraph(block) {
    const ctx = this.body;
    const items = [];
    if (block.indent) items.push(hbox([], { width: ctx.indent }));
    let mark = null;
    let sectionHead = false;
    let hang = 0;
    if (block.head && block.head.kind === "section") {
      const bold = this.fonts.bold;
      items.push(...this.textNodes(block.head.number + ".", bold, ctx.size), glue(ctx.size / 3, ctx.size / 6, ctx.size / 9));
      this.inline(block.head.title, ctx, items);
      items.push(glue(this.style.section.afterHead, 2, 1));
      mark = { section: block.head.number };
      sectionHead = true;
      this.vlist.push(penalty(-200), glue(this.style.section.before, this.style.section.beforeStretch, 1));
    } else if (block.head && block.head.kind === "theorem") {
      const roman = this.fonts.roman;
      items.push(...this.textNodes("T", roman, ctx.size), ...this.textNodes("heorem", roman, ctx.size, { smallCaps: true }));
      items.push(glue(ctx.size / 3, ctx.size / 6, ctx.size / 9), ...this.textNodes(block.head.number + ".", roman, ctx.size));
      items.push(glue(ctx.size * 0.5, ctx.size / 6, ctx.size / 9));
      this.vlist.push(penalty(-100), glue(3, 2, 1));
    } else if (block.head && block.head.kind === "item") {
      // "(A) if ..." with the turnover lines hanging under the text
      const label = [];
      this.inline(block.head.label, ctx, label);
      const labelBox = hbox(label);
      const space = ctx.size / 2;
      items.push(labelBox, kern(space));
      hang = ctx.indent + labelBox.w + space;
    } else if (this.prevDepth !== null) {
      this.vlist.push(glue(0, 0.8, 0)); // \parskip
    }
    this.inline(block.content, ctx, items);
    if (items.length === 0 || (items.length === 1 && block.indent)) return;
    const W = this.style.textWidth;
    const lines = this.setParagraph(items, ctx, hang ? (k) => (k === 0 ? W : W - hang) : W);
    if (hang) lines.forEach((line, k) => k > 0 && (line.shift = hang));
    if (mark) lines[0].mark = mark;
    this.pushLines(lines, { sectionHead });
  }

  // break into lines and box them; width may vary by line number
  setParagraph(items, ctx, width = this.style.textWidth) {
    items.push(penalty(INF_BAD), glue(0, 1, 0, { stretchOrder: 1 }), penalty(-INF_BAD));
    const s = this.style;
    const breaks = breakParagraph(items, {
      width,
      pretolerance: s.pretolerance,
      tolerance: s.tolerance,
      emergencyStretch: s.emergencyStretch,
      linePenalty: s.linePenalty,
      adjDemerits: s.adjDemerits,
      doubleHyphenDemerits: s.doubleHyphenDemerits,
      finalHyphenDemerits: s.finalHyphenDemerits,
    });
    const widthOf = typeof width === "function" ? width : () => width;
    return cutLines(items, breaks).map(({ nodes, hyphenated }, k) => {
      const box = hbox(nodes, { width: widthOf(k) });
      const over = box.natural - box.w;
      if (box.glueSign === -1 && box.glueRatio >= 1 && over > 0.5) {
        this.warnings.push(`overfull line by ${over.toFixed(1)}pt: ${lineText(nodes)}`);
      }
      box.hyphenated = hyphenated;
      box.footnotes = nodes.filter((n) => n.t === "ins").map((n) => n.footnote);
      return box;
    });
  }

  pushLines(lines, { sectionHead = false } = {}) {
    const s = this.style;
    lines.forEach((line, k) => {
      if (k > 0) {
        let p = 0;
        if (k === 1) p += sectionHead ? INF_BAD : s.clubPenalty;
        if (k === lines.length - 1) p += s.widowPenalty;
        if (lines[k - 1].hyphenated) p += s.brokenPenalty;
        this.vlist.push(penalty(Math.min(p, INF_BAD)));
      }
      this.appendBox(line);
    });
  }

  // in-line items -> horizontal nodes
  inline(content, ctx, out, state = { sf: 1000 }) {
    for (const it of content) {
      if (it.t === "text") {
        this.text(it, ctx, out, state);
      } else if (it.t === "math") {
        out.push(...this.math.inline(it.list, ctx.size));
        state.sf = 1000;
      } else if (it.t === "nbsp") {
        out.push(penalty(INF_BAD), this.space(ctx, state.sf));
        state.sf = 1000;
      } else if (it.t === "space") {
        out.push(this.space(ctx, 1000));
        state.sf = 1000;
      } else if (it.t === "skip") {
        out.push(glue(it.em * ctx.size, ctx.size / 6, ctx.size / 9));
        state.sf = 1000;
      } else if (it.t === "thin") {
        out.push(kern(ctx.size * 0.17));
      } else if (it.t === "dots") {
        out.push(this.math.dots({ size: ctx.size, style: 1 }));
        state.sf = 1000;
      } else if (it.t === "italcorr") {
        const lastGlyph = [...out].reverse().find((n) => n.t === "glyph");
        if (lastGlyph) out.push(kern(lastGlyph.font.overhang(lastGlyph.gid) * lastGlyph.size));
      } else if (it.t === "ref") {
        const num = this.labels.get(it.key) || "??";
        this.text({ text: it.paren ? `(${num})` : num, font: it.font === "italic" ? "roman" : it.font, sc: false }, ctx, out, state);
      } else if (it.t === "footnote") {
        const fn = this.footnote(it);
        const font = ctx.fonts.roman;
        const g = glyph(font, font.glyphFor("†"), ctx.size);
        g.footnote = fn;
        out.push({ t: "ins", w: 0, footnote: fn }, g);
      }
    }
  }

  space(ctx, sf) {
    const size = ctx.size;
    let w = size / 3;
    let st = size / 6;
    let sh = size / 9;
    if (sf >= 2000) w += size / 9;
    st *= sf / 1000;
    sh *= 1000 / sf;
    return glue(w, st, sh);
  }

  text(it, ctx, out, state) {
    const font = ctx.fonts[it.font] || ctx.fonts.roman;
    const parts = it.text.split(/( +)/);
    for (const part of parts) {
      if (!part) continue;
      if (part[0] === " ") {
        out.push(this.space(ctx, state.sf));
        continue;
      }
      out.push(...this.word(part, font, ctx.size, it.sc));
      state.sf = spaceFactor(part, state.sf);
    }
  }

  // one word with its hyphenation points
  word(word, font, size, smallCaps = false) {
    const chars = [...word];
    const breaks = new Set();
    const m = /^([^A-Za-z]*)([A-Za-z]{5,})([^A-Za-z]*)$/.exec(word);
    if (m && this.hy) for (const p of this.hy.points(m[2])) breaks.add(p + m[1].length);
    const explicit = new Set();
    chars.forEach((ch, i) => {
      if (ch === "-" && i > 0 && i < chars.length - 1) explicit.add(i + 1);
    });
    const shaped = font.shape(word, { smallCaps });
    const nodes = [];
    const hyphen = () => [glyph(font, font.glyphFor("-"), size)];
    const hyphenWidth = font.advance(font.glyphFor("-")) * size;
    shaped.forEach(({ gid, kern: k, start }, j) => {
      if (j > 0 && breaks.has(start)) nodes.push(penalty(this.style.hyphenPenalty, { w: hyphenWidth, flagged: true, hyphen }));
      if (j > 0 && explicit.has(start)) nodes.push(penalty(this.style.exHyphenPenalty, { flagged: true }));
      nodes.push(glyph(font, gid, size));
      if (k) nodes.push(kern(k * size));
    });
    return nodes;
  }

  textNodes(text, font, size, { smallCaps = false, tracking = 0 } = {}) {
    const nodes = [];
    for (const part of text.split(/( +)/)) {
      if (!part) continue;
      if (part[0] === " ") {
        nodes.push(glue(size / 3 + tracking * size, size / 6, size / 9));
        continue;
      }
      const shaped = font.shape(part, { smallCaps, ligatures: !tracking });
      shaped.forEach(({ gid, kern: k }, j) => {
        nodes.push(glyph(font, gid, size));
        const extra = k + (j < shaped.length - 1 ? tracking : 0);
        if (extra) nodes.push(kern(extra * size));
      });
    }
    return nodes;
  }

  // --------------------------------------------------------------------
  // footnotes

  footnote(it) {
    const ctx = this.foot;
    const fn = { content: it.content, symbol: "†" };
    const items = [hbox([], { width: ctx.indent })];
    const font = ctx.fonts.roman;
    const g = glyph(font, font.glyphFor("†"), ctx.size);
    g.footnote = fn;
    items.push(g, glue(ctx.size / 3, ctx.size / 6, ctx.size / 9));
    this.inline(it.content, ctx, items);
    let lines = this.setParagraph(items, ctx);
    if (lines.length === 1) {
      // a one-line note is centred, as the Clarendon Press did
      const nodes = items.slice(1, -3);
      lines = [this.centred(nodes)];
      lines[0].footnotes = [];
    }
    fn.lines = lines;
    let span = 0;
    for (let k = 1; k < lines.length; k++) {
      span += Math.max(ctx.leading, lines[k - 1].d + lines[k].h + this.style.lineSkip);
    }
    fn.span = span;
    fn.leading = ctx.leading;
    return fn;
  }

  // --------------------------------------------------------------------
  // displays

  display(block) {
    const s = this.style;
    const ds = s.display;
    const size = s.size;

    // split into lines at \\, each into columns at \no, each into halves at &
    const lines = [[]];
    for (const item of block.list) {
      if (item.type === "newline") lines.push([]);
      else lines[lines.length - 1].push(item);
    }
    const rows = lines.map((items) => {
      const cols = [];
      let cur = { number: null, items: [] };
      for (const item of items) {
        if (item.type === "eqno") {
          if (cur.items.length || cur.number) cols.push(cur);
          cur = { number: item.number, items: [] };
        } else if (item.type === "tag") {
          cur.number = item.text;
        } else cur.items.push(item);
      }
      cols.push(cur);
      return cols.map((c) => ({
        number: c.number ? hbox(this.textNodes(`(${c.number})`, this.fonts.roman, size)) : null,
        ...this.math.displayParts(c.items, size),
      }));
    });

    const boxes = rows.some((r) => r.length > 1) ? this.displayColumns(rows) : this.displayLines(rows.map((r) => r[0]));

    this.vlist.push(penalty(INF_BAD), glue(ds.above, ds.aboveStretch, ds.aboveShrink));
    boxes.forEach(({ box, numbered }, k) => {
      if (k > 0) this.vlist.push(penalty(numbered ? 100 : INF_BAD));
      this.appendBox(box, k > 0 ? s.leading + ds.jot : s.leading);
    });
    this.vlist.push(penalty(0), glue(ds.below, ds.belowStretch, ds.belowShrink));
  }

  // Equations side by side, as in (1.1.1) 1−1+1−...,   (1.1.2) 1−2+3−...
  displayColumns(rows) {
    const W = this.style.textWidth;
    const gap = this.style.display.columnGap * this.style.size;
    const numW = Math.max(...rows.flat().map((c) => (c.number ? c.number.w : 0)));
    return rows.map((row) => {
      const colW = W / row.length;
      const nodes = [];
      row.forEach((c, k) => {
        nodes.push(...(c.number ? [c.number, kern(numW - c.number.w + gap)] : [kern(numW + gap)]));
        const formula = c.left ? [c.left, c.right] : [c.right];
        nodes.push(...formula);
        const used = numW + gap + formula.reduce((a, b) => a + b.w, 0);
        if (k < row.length - 1) nodes.push(kern(Math.max(colW - used, gap)));
      });
      nodes.push(glue(0, 1, 0, { stretchOrder: 1 }));
      return { box: hbox(nodes, { width: W }), numbered: row.some((c) => c.number) };
    });
  }

  // One equation to a line: centred, aligned at &, or, when too wide to
  // align, the first line to the left and the turnover lines to the right.
  displayLines(cells) {
    const W = this.style.textWidth;
    const gap = this.style.display.numberGap * this.style.size;
    const fill = () => glue(0, 1, 0, { stretchOrder: 1 });
    const aligned = cells.some((c) => c.left);
    const leftW = aligned ? Math.max(...cells.map((c) => (c.left ? c.left.w : 0))) : 0;
    const blockW = Math.max(...cells.map((c) => (aligned ? leftW + c.right.w : c.right.w)));
    const numW = Math.max(0, ...cells.map((c) => (c.number ? c.number.w : 0)));
    const multline = aligned && blockW > W;
    let x0 = (W - blockW) / 2;
    if (numW && x0 < numW + gap) x0 = Math.min(numW + gap, Math.max(0, W - blockW));

    const boxes = [];
    cells.forEach((c, k) => {
      const parts = c.left ? [c.left, c.right] : [c.right];
      const formula = aligned && !multline ? [kern(leftW - (c.left ? c.left.w : 0)), ...parts] : parts;
      const fw = formula.reduce((a, b) => a + b.w, 0);
      let x = x0;
      if (!aligned) x = Math.max((W - fw) / 2, numW ? Math.min(numW + gap, W - fw) : 0);
      if (multline) {
        const start = c.number ? c.number.w + gap : 0;
        x = k === 0 ? start : k === cells.length - 1 ? W - fw : Math.max(start, (W - fw) / 2);
      }
      if (c.number && x < c.number.w + gap / 2) {
        // too wide to share a line with its number: the number goes above
        boxes.push({ box: hbox([c.number, fill()], { width: W }), numbered: true });
        x = Math.max(0, Math.min(x, (W - fw) / 2));
        boxes.push({ box: hbox([kern(x), ...formula, fill()], { width: W }), numbered: false });
        return;
      }
      const nodes = c.number ? [c.number, kern(x - c.number.w)] : [kern(x)];
      boxes.push({ box: hbox([...nodes, ...formula, fill()], { width: W }), numbered: !!c.number });
    });
    return boxes;
  }
}


// the characters of a line, roughly, for messages
function lineText(nodes) {
  let s = "";
  for (const n of nodes) {
    if (n.t === "glyph") {
      const name = n.font.glyphs[n.gid].n;
      s += name.length === 1 ? name : "·";
    } else if (n.t === "glue") s += " ";
  }
  return s.trim().slice(0, 60);
}

// TeX's space factor: wider spaces after full stops, a little after commas
function spaceFactor(word, sf) {
  if (ABBREVIATIONS.has(word.toLowerCase().replace(/^[(‘“]+/, ""))) return 1000;
  for (const ch of word) {
    if (/[a-z0-9]/.test(ch)) sf = 1000;
    else if (/[A-Z]/.test(ch)) sf = 999;
    else if (/[.?!]/.test(ch)) sf = sf < 1000 ? 1000 : 3000;
    else if (ch === ":") sf = sf < 1000 ? 1000 : 2000;
    else if (ch === ";") sf = sf < 1000 ? 1000 : 1500;
    else if (ch === ",") sf = sf < 1000 ? 1000 : 1250;
    else if (/[)\]’”']/.test(ch)) continue;
    else sf = 1000;
  }
  return sf;
}
