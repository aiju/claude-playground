// Draw typeset pages as SVG. Every glyph is a path taken from the font data,
// so the result looks the same everywhere and needs no web fonts. With
// style.letterpress set, the type is printed as described in letterpress.js.

import { glueWidth, glyph, hbox, kern } from "./nodes.js";
import { random, sortQuirks, encodeSort, inkFilter, paperFilter, throughFilter } from "./letterpress.js";

const LETTERS = "ABCDEFGHIKLMNOPQRSTUXYZ"; // signatures skip J, V and W

const fmt = (v) => {
  const s = v.toFixed(2);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
};

class Canvas {
  // `quirks` gives each sort its ink and position (letterpress), or is null
  constructor(style, prefix, defs = new Map(), quirks = null) {
    this.style = style;
    this.prefix = prefix;
    this.defs = defs;
    this.quirks = quirks;
    this.out = [];
  }

  glyph(node, x, y) {
    let { font, gid } = node;
    if (node.footnote) gid = font.glyphFor(node.footnote.symbol[0]);
    const id = `${this.prefix}${font.key}-${gid}`;
    if (!this.defs.has(id)) this.defs.set(id, font.glyphs[gid].d);
    if (!font.glyphs[gid].d) return;
    const s = node.size / font.upm;
    const scale = `scale(${s.toPrecision(4)} ${(-s).toPrecision(4)})`;
    if (!this.quirks) {
      this.out.push(`<use href="#${id}" transform="translate(${fmt(x)} ${fmt(y)}) ${scale}"/>`);
      return;
    }
    const q = this.quirks();
    const turn = Math.abs(q.rotate) > 0.005 ? ` rotate(${q.rotate.toFixed(2)})` : "";
    this.out.push(`<use href="#${id}" transform="translate(${fmt(x + q.dx)} ${fmt(y + q.dy)})${turn} ${scale}" fill="${encodeSort(q)}"/>`);
  }

  rect(x, y, w, h) {
    const fill = this.quirks ? ` fill="${encodeSort({ density: 0.97, height: 0.55 })}"` : "";
    this.out.push(`<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"${fill}/>`);
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

  // `back`: a canvas holding the other side of the leaf, for show-through
  svg(width, height, back = null, px = 4) {
    const st = this.style;
    const lp = st.letterpress;
    const p = this.prefix;
    const defs = [...this.defs].map(([id, d]) => `<path id="${id}" d="${d}"/>`);
    const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}pt" height="${height}pt">`;
    if (!lp) {
      return `${head}<defs>${defs.join("")}</defs><rect width="${width}" height="${height}" fill="${st.paper}"/><g fill="${st.ink}">${this.out.join("")}</g></svg>`;
    }
    defs.push(inkFilter(`${p}ink`, lp, st.ink, width, height, st.seed, px), paperFilter(`${p}paper`, lp, st.paper, width, height, st.seed));
    let through = "";
    if (back && lp.showThrough > 0) {
      defs.push(throughFilter(`${p}through`, lp));
      through = `<g transform="translate(${width} 0) scale(-1 1)" fill="${st.ink}" opacity="${lp.showThrough}" filter="url(#${p}through)">${back.out.join("")}</g>`;
    }
    return (
      `${head}<defs>${defs.join("")}</defs>` +
      `<rect width="${width}" height="${height}" fill="${st.paper}" filter="url(#${p}paper)"/>` +
      through +
      `<g filter="url(#${p}ink)">${this.out.join("")}</g></svg>`
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

// Draw one page's type: running head, text, footnotes, signature.
function drawPage(c, page, style, fonts) {
  const { width } = style.page;
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
}

// `back` is the page printed on the other side of the leaf, if known; `px`
// the device pixels per point it will be shown at (see letterpress.js).
export function renderPage(page, style, fonts, prefix = "g", { back = null, px = 4 } = {}) {
  const { width, height } = style.page;
  const lp = style.letterpress;
  // the same page always prints the same way
  const seed = (page.number * 7919 + 17) % 100000;
  const quirks = lp
    ? (() => {
        const rand = random(seed);
        return () => sortQuirks(rand, lp);
      })()
    : null;
  const c = new Canvas({ ...style, seed }, prefix, new Map(), quirks);
  drawPage(c, page, style, fonts);
  let behind = null;
  if (lp && back) {
    behind = new Canvas(style, prefix, c.defs);
    drawPage(behind, back, style, fonts);
  }
  return c.svg(width, height, behind, px);
}
