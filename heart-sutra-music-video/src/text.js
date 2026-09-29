// Draws the lyrics that are on screen at time t into two canvases the
// shader reads:
//   colour: the glyphs in their ink colour
//   control: r = how much of each pixel has been written, g = how wet it is
// Each character is written while it's sung (timings from schedule.js),
// stroke by stroke (see writing.js). When the line ends it dissolves back
// into the paper.

import { CUES } from './lyrics.js';
import { plain, scheduleCue } from './schedule.js';
import { charMap, lineMap, writeControl, MAP_FONT } from './writing.js';

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

// Fonts are fetched and handed over as bytes, which works under strict
// content security policies too.
export async function loadFonts(base = '') {
  for (const [name, file] of [[FONT_JA, 'fonts/brush-ja.ttf'], [FONT_SA, 'fonts/devanagari.ttf']]) {
    const data = await (await fetch(base + file)).arrayBuffer();
    const face = new FontFace(name, data);
    await face.load();
    document.fonts.add(face);
  }
}

const clamp01 = x => Math.min(1, Math.max(0, x));
const rgb = (r, g, b, a = 1) => `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;

const paintChar = ch => (ctx, size) => { ctx.font = `${size}px ${FONT_JA}`; ctx.fillText(ch, 0, 0); };
const paintLine = text => (ctx, size) => { ctx.font = `${size}px ${FONT_SA}`; ctx.fillText(text, 0, size * 0.1); };

let measurer = null;
function widthEm(text) {
  measurer = measurer || new OffscreenCanvas(8, 8).getContext('2d');
  measurer.font = `100px ${FONT_SA}`;
  return measurer.measureText(text).width / 100;
}

// Build every time map up front so playback never stalls on one.
export async function prepareWriting(onProgress = () => {}) {
  const jobs = [];
  const seen = new Set();
  for (const cue of CUES) {
    if (cue.script === 'sa') {
      if (!seen.has(cue.text)) { seen.add(cue.text); jobs.push(() => lineMap(cue.text, paintLine(cue.text), widthEm(cue.text))); }
    } else {
      for (const ch of plain(cue.text)) {
        if (ch === ' ' || seen.has(ch)) continue;
        seen.add(ch);
        jobs.push(() => charMap(ch, paintChar(ch)));
      }
    }
  }
  for (let i = 0; i < jobs.length; i++) {
    jobs[i]();
    if (i % 4 === 3) { onProgress((i + 1) / jobs.length); await new Promise(r => setTimeout(r, 0)); }
  }
  onProgress(1);
}

// How much of a Sanskrit line is written at time t. The line is one glyph,
// so it's written syllable by syllable: each syllable's share of the line
// (by the length of its transcription) is written while it's sung, and the
// brush waits in the gaps between syllables.
function lineProgress(cue, t) {
  const sch = scheduleCue(cue);
  const ys = sch.syllables;
  if (!ys.length) return 0;
  const words = (cue.roman || '').split(' ');
  // shares: every syllable weighs 1 plus a little for each letter past two
  const weight = [];
  for (const w of words) w.split('-').filter(Boolean).forEach((s, i, a) => weight.push(1 + 0.2 * Math.max(0, s.length - 2) + (i === a.length - 1 ? 0.15 : 0)));
  if (weight.length !== ys.length) return clamp01((t - sch.s0) / (sch.s1 - sch.s0));
  const sum = weight.reduce((a, b) => a + b, 0);
  let c = 0;
  for (let k = 0; k < ys.length; k++) {
    const c1 = c + weight[k] / sum;
    if (t < ys[k].t0) return c;
    if (t < ys[k].t1) return c + (c1 - c) * (t - ys[k].t0) / Math.max(1e-3, ys[k].t1 - ys[k].t0);
    c = c1;
  }
  return 1;
}

export class TextLayer {
  constructor(width, height) {
    this.w = width; this.h = height;
    this.colour = new OffscreenCanvas(width, height);
    this.control = new OffscreenCanvas(width, height);
    this.c = this.colour.getContext('2d');
    this.k = this.control.getContext('2d');
    this.scratch = new Map();   // map size -> { canvas, ctx, img }
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

  // Positions of each character, in pixels, plus when each one is written.
  layout(cue) {
    const { w, h } = this;
    const size = cue.size * h;
    const text = plain(cue.text);
    const out = [];
    let ring = null;
    if (cue.script === 'sa') {
      out.push({ ch: text, x: cue.x * w, y: cue.y * h, whole: true });
    } else if (cue.dir === 'ring') {
      const r = cue.radius * h, adv = size * 1.12, space = size * 0.6;
      let a = 0;
      for (const ch of text) {
        if (ch === ' ') { a += space / r; continue; }
        out.push({ ch, a: a + adv / 2 / r });
        a += adv / r;
      }
      for (const g of out) g.a -= a / 2;   // centre the text on the top of the ring
      ring = { cx: cue.x * w, cy: cue.y * h, r };
    } else if (cue.dir === 'h') {
      const adv = size * 1.04, space = size * 0.5;
      let total = 0;
      for (const ch of text) total += ch === ' ' ? space : adv;
      let x = cue.x * w - total / 2;
      for (const ch of text) {
        if (ch === ' ') { x += space; continue; }
        out.push({ ch, x: x + adv / 2, y: cue.y * h });
        x += adv;
      }
    } else {
      // vertical columns, right to left, breaking at spaces when a column is full
      const adv = size * 1.06, space = size * 0.42;
      const maxY = (cue.mirror ? cue.mirror - 0.04 : 0.92) * h;
      const phrases = text.split(' ');
      let x = cue.x * w, y = cue.y * h;
      for (let i = 0; i < phrases.length; i++) {
        const len = [...phrases[i]].length * adv;
        if (i > 0 && y + space + len > maxY) { x -= size * 1.35; y = cue.y * h; }
        else if (i > 0) y += space;
        for (const ch of phrases[i]) {
          let gx = x, gy = y + adv / 2;
          if (SMALL_KANA.has(ch)) { gx += size * 0.12; gy -= size * 0.12; }
          out.push({ ch, x: gx, y: gy });
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
    const sched = scheduleCue(cue).glyphs;
    out.forEach((g, i) => { g.w0 = sched[i].w0; g.w1 = sched[i].w1; });
    return { size, glyphs: out, ring };
  }

  drawCue(cue, t) {
    const { c, k, h } = this;
    const L = cue._layout || (cue._layout = this.layout(cue));
    const dur = cue.t1 - cue.t0;
    const out = clamp01((cue.t1 - t) / 0.9);
    const ink = INKS[cue.ink] || INKS.sumi;
    const alpha = cue.echo ? 0.7 : 1;
    // a slow drift over the life of the line, like a camera moving past
    const drift = ((t - cue.t0) / dur - 0.5) * h * 0.012;
    c.font = `${L.size}px ${cue.script === 'sa' ? FONT_SA : FONT_JA}`;
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
        if (t < g.w0) return;
        const prog = g.whole ? lineProgress(cue, t) : clamp01((t - g.w0) / (g.w1 - g.w0));
        const dry = clamp01((t - g.w1) / 1.2);
        let x, y, rot = 0;
        if (L.ring) {
          const a = g.a + (t - cue.t0) * 0.05 - Math.PI / 2;
          x = L.ring.cx + Math.cos(a) * L.ring.r;
          y = L.ring.cy + Math.sin(a) * L.ring.r;
          rot = a + Math.PI / 2;
        } else {
          x = g.x; y = g.y + drift;
        }
        let presence = out;
        if (cue.unravel) {
          const lineDone = L.glyphs[L.glyphs.length - 1].w1;
          const age = Math.max(0, t - (lineDone + 1.0 + i * 0.28));
          x += Math.pow(age, 1.6) * h * 0.03;
          y -= Math.pow(age, 1.4) * h * 0.012 * Math.sin(i * 1.7 + 1);
          rot += age * 0.25 * Math.sin(i * 2.3);
          presence *= clamp01(1 - age / 3.5);
        }
        this.glyph(cue, g, x, y, rot, L.size, prog, presence, dry, ink, alpha * pa);
      });
      c.restore(); k.restore();
    }
  }

  controlImage(map, prog, presence, dry) {
    const canvas = new OffscreenCanvas(map.w, map.h);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(map.w, map.h);
    writeControl(map, img, prog, presence, dry);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  glyph(cue, g, x, y, rot, size, prog, presence, dry, ink, alpha) {
    const { c, k } = this;
    c.save(); k.save();
    c.translate(x, y); k.translate(x, y);
    if (rot) { c.rotate(rot); k.rotate(rot); }

    if (cue.seal) {
      // a carved vermilion seal, stamped all at once: red block, glyph cut out
      const r = size * 0.62;
      const s = 1 + 0.08 * (1 - prog);
      c.scale(s, s);
      c.fillStyle = rgb(...ink, alpha);
      c.beginPath();
      c.roundRect(-r, -r, 2 * r, 2 * r, r * 0.12);
      c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      c.fillText(g.ch, 0, size * 0.04);
      c.globalCompositeOperation = 'source-over';
      k.globalCompositeOperation = 'lighten';
      k.fillStyle = rgb(prog * presence, 0.4 * (1 - dry), 0);
      k.fillRect(-1.2 * r, -1.2 * r, 2.4 * r, 2.4 * r);
      c.restore(); k.restore();
      return;
    }

    c.fillStyle = rgb(...ink, alpha);
    c.fillText(g.ch, 0, g.whole ? size * 0.1 : 0);

    const map = g.whole ? lineMap(g.ch, paintLine(g.ch), widthEm(g.ch)) : charMap(g.ch, paintChar(g.ch));
    const sc = size / MAP_FONT;
    const dw = map.w * sc, dh = map.h * sc;
    // A glyph's control image is bigger than the glyph and overlaps its
    // neighbours', so they're combined by taking the larger value: one
    // glyph being written never hides another that's already there.
    let img;
    if (prog >= 1 && dry >= 1 && presence >= 1) {
      // finished and dry: the same image every frame
      img = map.finished || (map.finished = this.controlImage(map, 1, 1, 1));
    } else {
      const key = `${map.w}x${map.h}`;
      let s = this.scratch.get(key);
      if (!s) {
        const canvas = new OffscreenCanvas(map.w, map.h);
        const ctx = canvas.getContext('2d');
        s = { canvas, ctx, img: ctx.createImageData(map.w, map.h) };
        this.scratch.set(key, s);
      }
      writeControl(map, s.img, prog, presence, dry);
      s.ctx.putImageData(s.img, 0, 0);
      img = s.canvas;
    }
    k.globalCompositeOperation = 'lighten';
    k.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    c.restore(); k.restore();
  }
}
