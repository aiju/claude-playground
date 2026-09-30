// Draw typeset pages as SVG. Every glyph is a path taken from the font data,
// so the result looks the same everywhere and needs no web fonts.

import { glueWidth, glyph, hbox, kern } from "./nodes.js";

const LETTERS = "ABCDEFGHIKLMNOPQRSTUXYZ"; // signatures skip J, V and W

const fmt = (v) => {
  const s = v.toFixed(2);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
};

class Canvas {
  constructor(style, prefix) {
    this.style = style;
    this.prefix = prefix;
    this.defs = new Map();
    this.out = [];
  }

  glyph(node, x, y) {
    let { font, gid } = node;
    if (node.footnote) gid = font.glyphFor(node.footnote.symbol[0]);
    const id = `${this.prefix}${font.key}-${gid}`;
    if (!this.defs.has(id)) this.defs.set(id, font.glyphs[gid].d);
    if (!font.glyphs[gid].d) return;
    const s = node.size / font.upm;
    const ink = this.style.inkSpread;
    const stroke = ink > 0 ? ` stroke-width="${fmt(ink / s)}"` : "";
    this.out.push(`<use href="#${id}" transform="translate(${fmt(x)} ${fmt(y)}) scale(${s.toPrecision(4)} ${(-s).toPrecision(4)})"${stroke}/>`);
  }

  rect(x, y, w, h) {
    const e = this.style.inkSpread / 2;
    this.out.push(`<rect x="${fmt(x - e)}" y="${fmt(y - e)}" width="${fmt(w + 2 * e)}" height="${fmt(h + 2 * e)}"/>`);
  }

  // draw an hbox with its baseline at y
  hbox(box, x, y) {
    for (const n of box.c) {
      const s = n.shift || 0;
      switch (n.t) {
        case "glyph":
          this.glyph(n, x, y + s);
          x += n.w;
          break;
        case "rule":
          this.rect(x, y + s - n.h, n.w, n.h + n.d);
          x += n.w;
          break;
        case "hbox":
          this.hbox(n, x, y + s);
          x += n.w;
          break;
        case "vbox":
          this.vbox(n, x, y + s - n.h);
          x += n.w;
          break;
        case "glue":
          x += glueWidth(n, box);
          break;
        case "kern":
          x += n.w;
          break;
        default:
          break;
      }
    }
  }

  // draw a vbox with its top at y
  vbox(box, x, y) {
    for (const n of box.c) {
      const s = n.shift || 0;
      switch (n.t) {
        case "hbox":
          y += n.h;
          this.hbox(n, x + s, y);
          y += n.d;
          break;
        case "vbox":
          this.vbox(n, x + s, y);
          y += n.h + n.d;
          break;
        case "rule":
          this.rect(x, y, n.w, n.h + n.d);
          y += n.h + n.d;
          break;
        case "glyph":
          y += n.h;
          this.glyph(n, x + s, y);
          y += n.d;
          break;
        case "glue":
          y += glueWidth(n, box);
          break;
        case "kern":
          y += n.w;
          break;
        default:
          break;
      }
    }
  }

  svg(width, height) {
    const st = this.style;
    const defs = [...this.defs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join("");
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}pt" height="${height}pt">` +
      `<defs>${defs}</defs>` +
      `<rect width="${width}" height="${height}" fill="${st.paper}"/>` +
      `<g fill="${st.ink}" stroke="${st.ink}" stroke-linejoin="round">${this.out.join("")}</g></svg>`
    );
  }
}

function textBox(text, font, size, tracking = 0) {
  const nodes = [];
  const shaped = font.shape(text, { ligatures: !tracking });
  shaped.forEach(({ gid, kern: k }, j) => {
    nodes.push(glyph(font, gid, size));
    const extra = k * size + (j < shaped.length - 1 ? tracking * size : 0);
    if (extra) nodes.push(kern(extra));
  });
  return hbox(nodes);
}

function spacedCaps(text, font, size, tracking) {
  // word spaces grow with the letterspacing
  const words = text.toUpperCase().split(" ");
  const nodes = [];
  words.forEach((w, k) => {
    if (k) nodes.push(kern(size / 3 + 2 * tracking * size));
    nodes.push(textBox(w, font, size, tracking));
  });
  return hbox(nodes);
}

export function signatureLetter(page) {
  if (page < 1 || (page - 1) % 16 !== 0) return null;
  const k = (page - 1) / 16 + 1;
  if (k < LETTERS.length) return LETTERS[k];
  return LETTERS[k % LETTERS.length].repeat(Math.floor(k / LETTERS.length) + 1);
}

export function renderPage(page, style, fonts, prefix = "g") {
  const { width, height } = style.page;
  const c = new Canvas(style, prefix);
  const recto = page.number % 2 === 1;
  const left = recto ? style.margins.inner : width - style.margins.inner - style.textWidth;
  const headY = style.margins.top;
  const textTop = headY + style.headSep - style.topSkip;
  const W = style.textWidth;

  if (!page.opening && page.chapter) {
    const folio = textBox(String(page.number), fonts.roman, style.folioSize);
    const title = spacedCaps(page.chapter.title, fonts.roman, style.head.size, style.head.tracking);
    c.hbox(title, left + (W - title.w) / 2, headY);
    if (recto) {
      if (page.section) c.hbox(textBox(`${page.section}]`, fonts.roman, style.folioSize), left, headY);
      c.hbox(folio, left + W - folio.w, headY);
    } else {
      c.hbox(folio, left, headY);
      const chap = textBox(`[Chap. ${page.chapter.number}`, fonts.roman, style.folioSize);
      c.hbox(chap, left + W - chap.w, headY);
    }
  }

  c.vbox(page.body, left, textTop);

  const vsize = style.topSkip + (style.linesPerPage - 1) * style.leading;
  if (page.footnotes.length) {
    let y = textTop + page.goal + style.footnote.sep;
    page.footnotes.forEach((fn, k) => {
      if (k) y += fn.leading + style.footnote.between;
      fn.lines.forEach((line, i) => {
        if (i) y += Math.max(fn.leading, fn.lines[i - 1].d + line.h + style.lineSkip);
        c.hbox(line, left, y);
      });
    });
  }

  const sig = signatureLetter(page.number);
  if (sig) {
    const b = textBox(sig, fonts.roman8, style.signature.size);
    c.hbox(b, left + (W - b.w) / 2, textTop + vsize + style.signature.drop);
  }
  return c.svg(width, height);
}
