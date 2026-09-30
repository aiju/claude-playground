// The box-and-glue model, much as in TeX. Every dimension is in points.
//
//   glyph    a single character from a font
//   rule     a solid black rectangle (fraction bars, and so on)
//   kern     fixed space
//   glue     space that can stretch and shrink
//   penalty  a possible break, with its cost
//   hbox     children set side by side on a common baseline
//   vbox     children stacked, the box's baseline being the last child's
//
// Boxes may be shifted: hbox children move down by `shift`, vbox children
// move right by `shift`.

export const INF_BAD = 10000;

export function glyph(font, gid, size) {
  return {
    t: "glyph",
    font,
    gid,
    size,
    w: font.advance(gid) * size,
    h: font.height(gid) * size,
    d: font.depth(gid) * size,
  };
}

export function rule(w, h, d = 0) {
  return { t: "rule", w, h, d };
}

export function kern(w) {
  return { t: "kern", w };
}

// order 0 is finite, 1 is fil, 2 is fill
export function glue(w, stretch = 0, shrink = 0, { stretchOrder = 0, shrinkOrder = 0, nobreak = false } = {}) {
  return { t: "glue", w, stretch, shrink, stretchOrder, shrinkOrder, nobreak };
}

export function penalty(p, { w = 0, flagged = false, hyphen = null } = {}) {
  return { t: "penalty", p, w, flagged, hyphen };
}

export function hbox(children, { width = null, shift = 0 } = {}) {
  const box = { t: "hbox", c: children, w: 0, h: 0, d: 0, shift, glueRatio: 0, glueSign: 0, glueOrder: 0 };
  let w = 0;
  let h = 0;
  let d = 0;
  const stretch = [0, 0, 0];
  const shrink = [0, 0, 0];
  for (const n of children) {
    if (n.t !== "penalty") w += n.w || 0; // a penalty's width counts only if we break there
    if (n.t === "glue") {
      stretch[n.stretchOrder] += n.stretch;
      shrink[n.shrinkOrder] += n.shrink;
    }
    if (n.t === "glyph" || n.t === "rule" || n.t === "hbox" || n.t === "vbox") {
      const s = n.shift || 0;
      h = Math.max(h, n.h - s);
      d = Math.max(d, n.d + s);
    }
  }
  box.h = h;
  box.d = d;
  box.natural = w;
  if (width === null) {
    box.w = w;
    return box;
  }
  box.w = width;
  setGlue(box, width - w, stretch, shrink);
  return box;
}

function setGlue(box, excess, stretch, shrink) {
  if (Math.abs(excess) < 1e-9) return;
  const totals = excess > 0 ? stretch : shrink;
  const order = totals[2] ? 2 : totals[1] ? 1 : 0;
  box.glueSign = excess > 0 ? 1 : -1;
  box.glueOrder = order;
  if (totals[order] > 0) {
    box.glueRatio = Math.abs(excess) / totals[order];
    // glue can't shrink past its minimum
    if (excess < 0 && order === 0) box.glueRatio = Math.min(box.glueRatio, 1);
  } else {
    box.glueSign = 0;
  }
}

// Stack children vertically. With `height`, glue is set so the box's natural
// height (top of first child to baseline of last) matches.
export function vbox(children, { height = null, shift = 0 } = {}) {
  const box = { t: "vbox", c: children, w: 0, h: 0, d: 0, shift, glueRatio: 0, glueSign: 0, glueOrder: 0 };
  let x = 0;
  let d = 0;
  let w = 0;
  const stretch = [0, 0, 0];
  const shrink = [0, 0, 0];
  for (const n of children) {
    if (n.t === "glue") {
      x += d + n.w;
      d = 0;
      stretch[n.stretchOrder] += n.stretch;
      shrink[n.shrinkOrder] += n.shrink;
    } else if (n.t === "kern") {
      x += d + n.w;
      d = 0;
    } else if (n.t === "hbox" || n.t === "vbox" || n.t === "rule" || n.t === "glyph") {
      x += d + n.h;
      d = n.d;
      w = Math.max(w, n.w + (n.shift || 0));
    }
  }
  box.w = w;
  box.h = x;
  box.d = d;
  box.natural = x;
  if (height !== null) {
    box.h = height;
    setGlue(box, height - x, stretch, shrink);
  }
  return box;
}

// Width a glue node takes inside a box whose glue has been set.
export function glueWidth(n, box) {
  if (box.glueSign === 1 && n.stretchOrder === box.glueOrder) return n.w + box.glueRatio * n.stretch;
  if (box.glueSign === -1 && n.shrinkOrder === box.glueOrder) return n.w - box.glueRatio * n.shrink;
  return n.w;
}
