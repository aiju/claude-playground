// Lay out a parsed formula as boxes, following the rules of Appendix G of
// The TeXbook with the parameters of the OpenType MATH table, adjusted for
// the house style of Oxford books of the 1940s:
//
//   - binary operators get no space around them: a₀+a₁+a₂+...
//   - the ellipsis is three full stops on the baseline
//   - simple numerical fractions are set as small "case fractions": ½, ¼
//   - square roots have no vinculum; complex radicands go in parentheses:
//     √3, √(n+1)
//   - integrals are upright and, in displays, take their limits above and
//     below, just as sums do

import { glyph, kern, glue, penalty, hbox, vbox, rule } from "../nodes.js";
import { isAtom } from "./parse.js";

export const D = 0;
export const T = 1;
export const S = 2;
export const SS = 3;

// TeXbook p. 170. 1 thin, 2 medium, 3 thick; negative = only in D and T.
const SPACING = {
  ord: { ord: 0, op: 1, bin: -2, rel: -3, open: 0, close: 0, punct: 0, inner: -1 },
  op: { ord: 1, op: 1, bin: 0, rel: -3, open: 0, close: 0, punct: 0, inner: -1 },
  bin: { ord: -2, op: -2, bin: 0, rel: 0, open: -2, close: 0, punct: 0, inner: -2 },
  rel: { ord: -3, op: -3, bin: 0, rel: 0, open: -3, close: 0, punct: 0, inner: -3 },
  open: { ord: 0, op: 0, bin: 0, rel: 0, open: 0, close: 0, punct: 0, inner: 0 },
  close: { ord: 0, op: 1, bin: -2, rel: -3, open: 0, close: 0, punct: 0, inner: -1 },
  punct: { ord: -1, op: -1, bin: 0, rel: -1, open: -1, close: -1, punct: -1, inner: -1 },
  inner: { ord: -1, op: 1, bin: -2, rel: -3, open: -1, close: 0, punct: -1, inner: -1 },
};

const supStyle = (s) => (s <= T ? S : SS);
const numStyle = (s) => (s === D ? T : s === T ? S : SS);

export class MathTypesetter {
  // fonts: the loaded faces; size: text size in pt; opts: house-style knobs
  constructor(fonts, opts = {}) {
    this.fonts = fonts;
    this.mf = fonts.math;
    this.opts = {
      thinMu: 3,
      medMu: 0, // Oxford: no space around + and −
      thickMu: 5,
      thickStretchMu: 2,
      punctMu: 3,
      binPenalty: 700,
      relPenalty: 500,
      ...opts,
    };
  }

  styleSize(ctx, style = ctx.style) {
    if (style === S) return (ctx.size * this.mf.mathConstant("scriptPercentScaleDown")) / 100;
    if (style === SS) return (ctx.size * this.mf.mathConstant("scriptScriptPercentScaleDown")) / 100;
    return ctx.size;
  }

  // a MATH constant in points at the current style's size
  c(name, ctx) {
    return this.mf.mathConstant(name) * this.styleSize(ctx);
  }

  axis(ctx) {
    return this.c("axisHeight", ctx);
  }

  with(ctx, changes) {
    return { ...ctx, ...changes };
  }

  // text fonts come in two optical sizes
  textFont(key, size) {
    if (size < 9) {
      if (key === "roman") return this.fonts.roman8;
      if (key === "italic") return this.fonts.italic8;
    }
    return this.fonts[key];
  }

  textRun(text, fontKey, size) {
    const font = this.textFont(fontKey, size);
    const nodes = [];
    for (const part of text.split(/( )/)) {
      if (part === " ") {
        nodes.push(glue(size / 3, size / 6, size / 9, { nobreak: true }));
        continue;
      }
      if (!part) continue;
      for (const { gid, kern: k } of font.shape(part)) {
        nodes.push(glyph(font, gid, size));
        if (k) nodes.push(kern(k * size));
      }
    }
    return hbox(nodes);
  }

  symGlyph(ch, ctx) {
    const size = this.styleSize(ctx);
    let gid = this.mf.glyphFor(ch);
    if (!gid) {
      // not in the maths font: borrow from the text roman
      const font = this.textFont("roman", size);
      return glyph(font, font.glyphFor(ch), size);
    }
    gid = this.mf.scriptVariant(gid, ctx.style - 1 > 0 ? ctx.style - 1 : 0);
    return glyph(this.mf, gid, size);
  }

  // ---------------------------------------------------------------------
  // lists

  // Returns a list of horizontal nodes. At the top level of an in-line
  // formula `breakable` adds TeX's penalties after relations and operators.
  hlist(list, ctx, { breakable = false } = {}) {
    ctx = { ...ctx };
    const items = [];
    for (const item of list) {
      if (item.type === "style") {
        ctx.style = item.style;
        continue;
      }
      if (["newline", "eqno", "label", "tag"].includes(item.type)) continue;
      items.push({ item, ctx: { ...ctx } });
    }

    // atom types after TeX's rules 5 and 6 (binary operators that can't be)
    let prev = null;
    for (const entry of items) {
      const it = entry.item;
      let type = atomType(it);
      if (!type) continue;
      if (type === "bin" && (!prev || ["bin", "op", "rel", "open", "punct"].includes(prev.type))) type = "ord";
      if (["rel", "close", "punct"].includes(type) && prev && prev.type === "bin") prev.type = "ord";
      entry.type = type;
      prev = entry;
    }
    if (prev && prev.type === "bin") prev.type = "ord";

    const out = [];
    let last = null;
    let alignPending = false;
    for (let i = 0; i < items.length; i++) {
      const entry = items[i];
      const { item } = entry;
      if (item.type === "align") {
        // the alignment point goes after the space before the next atom, so
        // that "&=" lines up the relation signs themselves
        alignPending = true;
        continue;
      }
      if (item.type === "space") {
        const mu = this.styleSize(entry.ctx) / 18;
        out.push(kern(item.mu * mu));
        continue;
      }
      if (!entry.type) continue;
      if (last) {
        const sp = this.spacing(last.type, entry.type, entry.ctx);
        if (sp) out.push(sp);
      }
      if (alignPending) {
        out.push({ t: "align", w: 0 });
        alignPending = false;
      }
      const box = this.atom(item, entry.type, entry.ctx);
      out.push(box);
      if (breakable) {
        const next = items.slice(i + 1).find((e) => e.type);
        if (next && entry.type === "bin") out.push(penalty(this.opts.binPenalty));
        if (next && entry.type === "rel" && next.type !== "rel" && next.type !== "punct") out.push(penalty(this.opts.relPenalty));
      }
      last = entry;
    }
    return out;
  }

  box(list, ctx) {
    return hbox(this.hlist(list, ctx));
  }

  // A displayed line, split at its & into the parts before and after.
  displayParts(list, size) {
    const nodes = this.hlist(list, { size, style: D, cramped: false });
    const k = nodes.findIndex((n) => n.t === "align");
    if (k < 0) return { left: null, right: hbox(nodes) };
    return { left: hbox(nodes.slice(0, k)), right: hbox(nodes.slice(k + 1)) };
  }

  spacing(left, right, ctx) {
    let code = SPACING[left][right];
    if (code < 0) {
      if (ctx.style > T) return null;
      code = -code;
    }
    if (!code) return null;
    const mu = this.styleSize(ctx) / 18;
    if (code === 1) {
      const m = left === "punct" ? this.opts.punctMu : this.opts.thinMu;
      return kern(m * mu);
    }
    if (code === 2) return this.opts.medMu ? kern(this.opts.medMu * mu) : null;
    return glue(this.opts.thickMu * mu, this.opts.thickStretchMu * mu, 0, { nobreak: true });
  }

  // ---------------------------------------------------------------------
  // atoms

  atom(item, type, ctx) {
    if (item.type === "frac") return this.scripts(this.fraction(item, ctx), item, ctx, 0, false);
    if (item.type === "sqrt") return this.scripts(this.radical(item, ctx), item, ctx, 0, false);
    if (item.type === "leftright") return this.scripts(this.leftRight(item, ctx), item, ctx, 0, false);

    let nuc;
    let italic = 0;
    const n = item.nucleus;
    const isChar = n && n.kind === "sym";
    if (type === "op" && n && n.kind === "sym" && n.font === "math") {
      return this.bigOp(item, ctx);
    }
    if (!n) nuc = hbox([]);
    else if (n.kind === "sym") {
      const g = this.symGlyph(n.ch, ctx);
      if (item.decimal) nuc = hbox([g]);
      else {
        italic = g.font === this.mf ? this.mf.italicCorrection(g.gid) * g.size : 0;
        nuc = hbox([g]);
      }
    } else if (n.kind === "text") {
      nuc = this.textRun(n.text, n.font, this.styleSize(ctx));
    } else if (n.kind === "list") {
      nuc = this.box(n.list, ctx);
    } else if (n.kind === "delim") {
      const target = [0, 0.85, 1.15, 1.45, 1.75][n.size] * this.styleSize(ctx);
      nuc = hbox([this.delimiter(n.ch, target, ctx)]);
    } else if (n.kind === "dots") {
      nuc = this.dots(ctx);
    }
    if (item.overline) nuc = this.overline(nuc, ctx);
    if (item.phantom) nuc = { ...hbox([kern(nuc.w)]), h: nuc.h, d: nuc.d };
    if (type === "op" && item.limitsMode !== "never" && (item.limitsMode === "always" || (item.limits && ctx.style === D))) {
      return this.limits(nuc, item, ctx, 0);
    }
    return this.scripts(nuc, item, ctx, isChar ? italic : 0, isChar);
  }

  // Hardy writes "a₀+a₁+..." with full stops, not spaced-out dots.
  dots(ctx) {
    const size = this.styleSize(ctx);
    const font = this.textFont("roman", size);
    const dot = font.glyphFor(".");
    const nodes = [];
    for (let i = 0; i < 3; i++) {
      nodes.push(glyph(font, dot, size));
      if (i < 2) nodes.push(kern(-0.06 * size));
    }
    return hbox(nodes);
  }

  overline(box, ctx) {
    const t = this.c("overbarRuleThickness", ctx);
    const gap = this.c("overbarVerticalGap", ctx);
    return vbox([kern(this.c("overbarExtraAscender", ctx)), rule(box.w, t), kern(gap), box]);
  }

  // TeX rule 17/18: superscripts and subscripts
  scripts(nuc, item, ctx, italic, isChar) {
    if (!item.sup && !item.sub) {
      if (italic) return hbox([nuc, kern(italic)]);
      return nuc;
    }
    const supCtx = this.with(ctx, { style: supStyle(ctx.style) });
    const subCtx = this.with(ctx, { style: supStyle(ctx.style), cramped: true });
    const sup = item.sup ? this.box(item.sup, supCtx) : null;
    const sub = item.sub ? this.box(item.sub, subCtx) : null;

    let u = 0;
    let v = 0;
    if (!isChar) {
      u = nuc.h - this.c("superscriptBaselineDropMax", supCtx);
      v = nuc.d + this.c("subscriptBaselineDropMin", subCtx);
    }
    const after = kern(this.c("spaceAfterScript", ctx));
    if (sup) {
      u = Math.max(u, ctx.cramped ? this.c("superscriptShiftUpCramped", ctx) : this.c("superscriptShiftUp", ctx), sup.d + this.c("superscriptBottomMin", ctx));
    }
    if (sub && !sup) {
      v = Math.max(v, this.c("subscriptShiftDown", ctx), sub.h - this.c("subscriptTopMax", ctx));
      sub.shift = v;
      return hbox([nuc, sub, after]);
    }
    if (sup && !sub) {
      sup.shift = -u;
      return hbox([nuc, kern(italic), sup, after]);
    }
    v = Math.max(v, this.c("subscriptShiftDown", ctx));
    const gap = u - sup.d - (sub.h - v);
    const minGap = this.c("subSuperscriptGapMin", ctx);
    if (gap < minGap) {
      v += minGap - gap;
      const psi = this.c("superscriptBottomMaxWithSubscript", ctx) - (u - sup.d);
      if (psi > 0) {
        u += psi;
        v -= psi;
      }
    }
    sup.shift = italic;
    const stack = vbox([sup, kern(u + v - sup.d - sub.h), sub], { shift: v });
    return hbox([nuc, stack, after]);
  }

  // TeX rule 13: large operators
  bigOp(item, ctx) {
    const mf = this.mf;
    const n = item.nucleus;
    const size = this.styleSize(ctx);
    let gid = mf.glyphFor(n.ch);
    const display = ctx.style === D;
    if (item.upright) {
      gid = mf.named[display && item.displayGlyph ? "integral.v1.up" : "integral.up"] ?? gid;
    } else if (display && item.displayGlyph) {
      const vv = mf.verticalVariants(gid);
      const min = mf.mathConstant("displayOperatorMinHeight");
      if (vv) {
        const found = vv.variants.find(([, adv]) => adv / mf.upm >= min);
        if (found) gid = found[0];
        else if (vv.variants.length) gid = vv.variants[vv.variants.length - 1][0];
      }
    } else {
      gid = mf.scriptVariant(gid, ctx.style > T ? ctx.style - 1 : 0);
    }
    const g = glyph(mf, gid, size);
    // centre on the axis
    g.shift = (g.h - g.d) / 2 - this.axis(ctx);
    const italic = item.upright ? 0 : mf.italicCorrection(gid) * size;
    const nuc = hbox([g]);
    const lim = item.limitsMode === "always" || (item.limitsMode !== "never" && item.limits && display);
    if (lim) return this.limits(nuc, item, ctx, italic, { tight: item.upright });
    return this.scripts(nuc, item, ctx, italic, false);
  }

  // Limits above and below. `tight` sets them close against the ends of the
  // sign, as the Monotype integrals were, rather than at TeX's distances.
  limits(nuc, item, ctx, italic, { tight = false } = {}) {
    const supCtx = this.with(ctx, { style: supStyle(ctx.style) });
    const subCtx = this.with(ctx, { style: supStyle(ctx.style), cramped: true });
    const sup = item.sup ? this.box(item.sup, supCtx) : null;
    const sub = item.sub ? this.box(item.sub, subCtx) : null;
    if (!sup && !sub) return nuc;
    const w = Math.max(nuc.w, sup ? sup.w + italic / 2 : 0, sub ? sub.w + italic / 2 : 0);
    const centre = (b, dx) => {
      const pad = (w - b.w) / 2 + dx;
      return hbox([kern(pad), b, kern(w - b.w - pad)]);
    };
    const children = [];
    const close = 0.06 * this.styleSize(ctx);
    if (sup) {
      const gap = tight ? close : Math.max(this.c("upperLimitGapMin", ctx), this.c("upperLimitBaselineRiseMin", ctx) - sup.d);
      children.push(centre(sup, italic / 2), kern(gap));
    }
    const body = centre(nuc, 0);
    children.push(body);
    let shift = 0;
    if (sub) {
      const gap = tight ? close : Math.max(this.c("lowerLimitGapMin", ctx), this.c("lowerLimitBaselineDropMin", ctx) - sub.h);
      children.push(kern(gap), centre(sub, -italic / 2));
      shift = nuc.d + gap + sub.h;
    }
    const stack = vbox(children, { shift });
    return hbox([stack, kern(this.c("spaceAfterScript", ctx) / 2)]);
  }

  // TeX rule 15: fractions
  fraction(item, ctx) {
    const numeric = (l) => l.length > 0 && l.every((a) => a.type === "ord" && a.nucleus && a.nucleus.kind === "sym" && a.digit && !a.sup && !a.sub);
    const variant = item.variant === "auto" && numeric(item.num) && numeric(item.den) ? "case" : item.variant;
    if (variant === "case") return this.caseFraction(item, ctx);

    const style = variant === "display" ? D : variant === "text" && ctx.style === D ? T : ctx.style;
    const fctx = this.with(ctx, { style });
    const num = this.box(item.num, this.with(ctx, { style: numStyle(style) }));
    const den = this.box(item.den, this.with(ctx, { style: numStyle(style), cramped: true }));
    const disp = style === D;
    const t = this.c("fractionRuleThickness", fctx);
    const a = this.axis(fctx);
    let u = this.c(disp ? "fractionNumeratorDisplayStyleShiftUp" : "fractionNumeratorShiftUp", fctx);
    let v = this.c(disp ? "fractionDenominatorDisplayStyleShiftDown" : "fractionDenominatorShiftDown", fctx);
    const gapN = this.c(disp ? "fractionNumDisplayStyleGapMin" : "fractionNumeratorGapMin", fctx);
    const gapD = this.c(disp ? "fractionDenomDisplayStyleGapMin" : "fractionDenominatorGapMin", fctx);
    if (u - num.d - (a + t / 2) < gapN) u = gapN + num.d + a + t / 2;
    if (a - t / 2 - (den.h - v) < gapD) v = gapD - a + t / 2 + den.h;
    const size = this.styleSize(fctx);
    const over = 0.04 * size; // the rule reaches a hair beyond the wider part
    const w = Math.max(num.w, den.w) + 2 * over;
    const centre = (b) => hbox([kern((w - b.w) / 2), b, kern((w - b.w) / 2)]);
    const stack = vbox([centre(num), kern(u - num.d - (a + t / 2)), rule(w, t), kern(a - t / 2 - (den.h - v)), centre(den)], { shift: v });
    const nds = 0.1 * size;
    return hbox([kern(nds), stack, kern(nds)]);
  }

  // ½ ¼ ¾: small figures on a short rule, centred on the axis
  caseFraction(item, ctx) {
    const small = this.with(ctx, { style: SS, cramped: false });
    const num = this.box(item.num, small);
    const den = this.box(item.den, this.with(small, { cramped: true }));
    const size = this.styleSize(ctx);
    const t = this.c("fractionRuleThickness", ctx) * 0.9;
    const a = this.axis(ctx);
    const gap = 0.07 * size;
    const w = Math.max(num.w, den.w) + 0.06 * size;
    const centre = (b) => hbox([kern((w - b.w) / 2), b, kern((w - b.w) / 2)]);
    // the rule sits on the axis; the vbox's baseline is the denominator's
    const stack = vbox([centre(num), kern(gap), rule(w, t), kern(gap), centre(den)], { shift: den.h + gap + t / 2 - a });
    return hbox([kern(0.03 * size), stack, kern(0.03 * size)]);
  }

  // Oxford style: √3, √x, but √(n+1) rather than a vinculum
  radical(item, ctx) {
    const body = this.box(item.body, this.with(ctx, { cramped: true }));
    const simple =
      item.body.length === 1 && isAtom(item.body[0]) && item.body[0].nucleus && item.body[0].nucleus.kind === "sym" && !item.body[0].sup && !item.body[0].sub;
    const digits = item.body.length > 0 && item.body.every((a) => a.digit && !a.sup && !a.sub);
    const size = this.styleSize(ctx);
    const inner = simple || digits ? [body] : [this.delimiterFor("(", body, ctx), body, this.delimiterFor(")", body, ctx)];
    const content = hbox(inner);
    const clearance = 0.08 * size;
    const need = content.h + content.d + clearance;
    const sign = this.delimiter("√", need, ctx, { centre: false });
    // the radical glyph hangs from its top; put the top just above the body
    const top = sign.h;
    sign.shift = top - (content.h + clearance);
    return hbox([sign, kern(-0.02 * size), content]);
  }

  leftRight(item, ctx) {
    const body = this.box(item.body, ctx);
    const nodes = [];
    if (item.left) nodes.push(this.delimiterFor(item.left, body, ctx));
    else nodes.push(kern(0.1 * this.styleSize(ctx)));
    nodes.push(body);
    if (item.right) nodes.push(this.delimiterFor(item.right, body, ctx));
    else nodes.push(kern(0.1 * this.styleSize(ctx)));
    return hbox(nodes);
  }

  // TeX rule 19: a delimiter big enough to cover the box, centred on the axis
  delimiterFor(ch, box, ctx) {
    const a = this.axis(ctx);
    const half = Math.max(box.h - a, box.d + a);
    const size = this.styleSize(ctx);
    const target = Math.max(2 * half * 0.901, 2 * half - 0.5 * size);
    return this.delimiter(ch, target, ctx);
  }

  // Smallest variant at least `target` tall, or an assembly of pieces.
  delimiter(ch, target, ctx, { centre = true } = {}) {
    const mf = this.mf;
    const size = this.styleSize(ctx);
    const base = mf.glyphFor(ch);
    const vv = mf.verticalVariants(base);
    let node = null;
    if (vv) {
      for (const [gid] of vv.variants) {
        const g = glyph(mf, gid, size);
        node = g;
        if (g.h + g.d >= target) break;
      }
      if (node && node.h + node.d < target && vv.assembly) node = this.assemble(vv.assembly, target, size);
    }
    if (!node) node = glyph(mf, base, size);
    if (centre) node.shift = (node.h - node.d) / 2 - this.axis(ctx);
    return node;
  }

  // Build a tall delimiter from its top, bottom, middle and extender pieces.
  assemble(parts, target, size) {
    const mf = this.mf;
    const em = size / mf.upm;
    const overlap = mf.math.minConnectorOverlap;
    const ext = parts.filter((p) => p[4] & 1);
    let reps = 0;
    let chosen;
    let total;
    for (;;) {
      chosen = [];
      for (const p of parts) {
        if (p[4] & 1) for (let i = 0; i < reps; i++) chosen.push(p);
        else chosen.push(p);
      }
      total = chosen.reduce((s, p) => s + p[3], 0) - overlap * (chosen.length - 1);
      if (total * em >= target || reps > 50 || !ext.length) break;
      reps++;
    }
    // spread the joins so the pieces overlap evenly
    const joins = chosen.length - 1;
    let maxOverlap = Infinity;
    for (let i = 0; i < joins; i++) maxOverlap = Math.min(maxOverlap, chosen[i][2], chosen[i + 1][1]);
    const natural = chosen.reduce((s, p) => s + p[3], 0);
    let ov = overlap;
    if (joins > 0) ov = Math.min(maxOverlap, Math.max(overlap, (natural - target / em) / joins));
    // parts are listed bottom to top; the vbox runs top to bottom
    const children = [];
    const bottomUp = chosen.map((p) => glyph(mf, p[0], size));
    for (let i = bottomUp.length - 1; i >= 0; i--) {
      const g = bottomUp[i];
      const box = hbox([g]);
      box.h = g.h;
      box.d = g.d;
      children.push(box);
      if (i > 0) children.push(kern(-ov * em));
    }
    return vbox(children);
  }

  // ---------------------------------------------------------------------
  // entry points

  inline(list, size) {
    return this.hlist(list, { size, style: T, cramped: false }, { breakable: true });
  }
}

function atomType(item) {
  if (isAtom(item)) return item.type;
  // TeX makes \left...\right an Inner atom, with thin spaces around it;
  // Monotype setting had none: a₀(1−...)
  if (item.type === "leftright") return "ord";
  if (item.type === "frac") return "inner";
  if (item.type === "sqrt") return "ord";
  return null;
}
