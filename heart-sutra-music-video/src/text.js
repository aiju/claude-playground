// Draws the lyrics that are on screen at time t into two canvases the
// shader reads:
//   colour: the glyphs in their ink colour
//   control: r = how far each character has been brushed in (0..1),
//            g = how wet it still is, b = 1 for gold ink
// Characters are brushed in one after another, top to bottom, and dissolve
// when the line ends; the shader turns those values into ink.

import { CUES } from './lyrics.js';

export const FONT_JA = 'BrushJa';
export const FONT_SA = 'BrushSa';

const INKS = {
  gold: [0.86, 0.69, 0.33],
  sumi: [0.075, 0.07, 0.068],
  shu: [0.80, 0.19, 0.11],
  white: [0.96, 0.95, 0.92],
  indigo: [0.13, 0.17, 0.34],
};

const SMALL_KANA = new Set('ゃゅょっぁぃぅぇぉャュョッァィゥェォ');

export async function loadFonts(base = '') {
  const faces = [
    new FontFace(FONT_JA, `url(${base}fonts/brush-ja.ttf)`),
    new FontFace(FONT_SA, `url(${base}fonts/devanagari.ttf)`),
  ];
  for (const f of faces) { await f.load(); document.fonts.add(f); }
}

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const rgb = (r, g, b, a = 1) => `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;

export class TextLayer {
  constructor(width, height) {
    this.w = width; this.h = height;
    this.colour = new OffscreenCanvas(width, height);
    this.control = new OffscreenCanvas(width, height);
    this.c = this.colour.getContext('2d');
    this.k = this.control.getContext('2d');
  }

  draw(t) {
    const { c, k, w, h } = this;
    c.clearRect(0, 0, w, h);
    k.clearRect(0, 0, w, h);
    for (const cue of CUES) {
      if (t < cue.t0 - 0.05 || t > cue.t1) continue;
      this.drawCue(cue, t);
    }
  }

  // Positions of each character: [{ch, x, y, rot}], in pixels.
  layout(cue) {
    const { w, h } = this;
    const size = cue.size * h;
    const out = [];
    if (cue.script === 'sa') {
      out.push({ ch: cue.text, x: cue.x * w, y: cue.y * h, rot: 0, whole: true });
      return { size, glyphs: out };
    }
    const chars = [...cue.text];
    if (cue.dir === 'h') {
      const adv = size * 1.04, gap = size * 0.5;
      let total = 0;
      for (const ch of chars) total += ch === ' ' ? gap : adv;
      let x = cue.x * w - total / 2;
      for (const ch of chars) {
        if (ch === ' ') { x += gap; continue; }
        out.push({ ch, x: x + adv / 2, y: cue.y * h, rot: 0 });
        x += adv;
      }
    } else if (cue.dir === 'ring') {
      const r = cue.radius * h, adv = size * 1.12, gap = size * 0.6;
      let a = 0;
      for (const ch of chars) {
        if (ch === ' ') { a += gap / r; continue; }
        out.push({ ch, a: a + adv / 2 / r });
        a += adv / r;
      }
      for (const g of out) g.a -= a / 2;   // centre the text on the top of the ring
      return { size, glyphs: out, ring: { cx: cue.x * w, cy: cue.y * h, r } };
    } else {
      // vertical columns, right to left, breaking at spaces when a column is full
      const adv = size * 1.06, gap = size * 0.42;
      const maxY = (cue.mirror ? cue.mirror - 0.04 : 0.92) * h;
      const phrases = cue.text.split(' ');
      let x = cue.x * w, y = cue.y * h;
      for (let i = 0; i < phrases.length; i++) {
        const len = [...phrases[i]].length * adv;
        if (i > 0 && y + gap + len > maxY) { x -= size * 1.35; y = cue.y * h; }
        else if (i > 0) y += gap;
        for (const ch of phrases[i]) {
          let gx = x, gy = y + adv / 2;
          if (SMALL_KANA.has(ch)) { gx += size * 0.12; gy -= size * 0.12; }
          out.push({ ch, x: gx, y: gy, rot: 0 });
          y += adv;
        }
      }
      // columns flow leftwards from the anchor; keep the block on screen
      const minX = Math.min(...out.map(g => g.x));
      if (cue.x < 0.5 && out.length) {
        const shift = cue.x * w - minX;
        if (shift > 0) for (const g of out) g.x += shift;
      }
    }
    return { size, glyphs: out };
  }

  drawCue(cue, t) {
    const { c, k, h } = this;
    const L = cue._layout || (cue._layout = this.layout(cue));
    const n = L.glyphs.length;
    const dur = cue.t1 - cue.t0;
    const reveal = Math.min(2.6, dur * 0.42);
    const step = n > 1 ? reveal / n : 0;
    const out = clamp01((cue.t1 - t) / 0.9);
    const ink = INKS[cue.ink] || INKS.sumi;
    const alpha = cue.echo ? 0.7 : 1;
    const gold = cue.ink === 'gold' ? 1 : 0;
    // a slow drift over the life of the line, like a camera moving past
    const life = (t - cue.t0) / dur;
    const drift = (life - 0.5) * h * 0.012;

    const fontFor = cue.script === 'sa' ? FONT_SA : FONT_JA;
    c.font = `${L.size}px ${fontFor}`;
    k.font = c.font;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    const passes = cue.mirror ? [1, -1] : [1];
    for (const flip of passes) {
      c.save(); k.save();
      if (flip < 0) {
        const my = cue.mirror * h;
        c.translate(0, 2 * my); c.scale(1, -1);
        k.translate(0, 2 * my); k.scale(1, -1);
      }
      const pa = flip < 0 ? 0.32 : 1;
      L.glyphs.forEach((g, i) => {
        const t0 = cue.t0 + i * step;
        const prog = clamp01((t - t0) / 0.55);
        if (prog <= 0) return;
        const wet = 1 - smooth((t - t0) / 0.9);
        let x, y, rot = 0;
        if (L.ring) {
          const spin = (t - cue.t0) * 0.05;
          const a = g.a + spin - Math.PI / 2;
          x = L.ring.cx + Math.cos(a) * L.ring.r;
          y = L.ring.cy + Math.sin(a) * L.ring.r;
          rot = a + Math.PI / 2;
        } else {
          x = g.x; y = g.y + drift;
        }
        let presence = out;
        if (cue.unravel) {
          const age = Math.max(0, t - (cue.t0 + reveal + 1.2 + i * 0.28));
          x += Math.pow(age, 1.6) * h * 0.03;
          y -= Math.pow(age, 1.4) * h * 0.012 * Math.sin(i * 1.7 + 1);
          rot += age * 0.25 * Math.sin(i * 2.3);
          presence *= clamp01(1 - age / 3.5);
        }
        this.glyph(g, x, y, rot, L.size, prog, presence, wet, ink, alpha * pa, gold, cue);
      });
      c.restore(); k.restore();
    }
  }

  glyph(g, x, y, rot, size, prog, presence, wet, ink, alpha, gold, cue) {
    const { c, k } = this;
    c.save(); k.save();
    c.translate(x, y); k.translate(x, y);
    if (rot) { c.rotate(rot); k.rotate(rot); }
    const s = 1 + 0.05 * wet;
    c.scale(s, s);

    let bw, bh;
    if (g.whole) {
      bw = c.measureText(g.ch).width * 1.1 + size * 0.4;
      bh = size * 1.7;
    } else {
      bw = size * 1.3; bh = size * 1.3;
    }

    if (cue.seal) {
      // a carved vermilion seal: red block with the glyph cut out of it
      const r = size * 0.62;
      c.fillStyle = rgb(...ink, alpha);
      c.beginPath();
      c.roundRect(-r, -r, 2 * r, 2 * r, r * 0.12);
      c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      c.fillText(g.ch, 0, size * 0.04);
      c.globalCompositeOperation = 'source-over';
      bw = bh = 2.4 * r;
    } else {
      c.fillStyle = rgb(...ink, alpha);
      c.fillText(g.ch, 0, g.whole ? size * 0.1 : 0);
    }

    // control: reveal sweeps top to bottom (left to right for Devanagari)
    const v0 = clamp01(prog * 1.6) * presence;
    const v1 = clamp01(prog * 1.6 - 0.6) * presence;
    const grad = g.whole
      ? k.createLinearGradient(-bw / 2, 0, bw / 2, 0)
      : k.createLinearGradient(0, -bh / 2, 0, bh / 2);
    grad.addColorStop(0, rgb(v0, wet, gold));
    grad.addColorStop(1, rgb(v1, wet, gold));
    k.fillStyle = grad;
    k.fillRect(-bw / 2, -bh / 2, bw, bh);
    c.restore(); k.restore();
  }
}
