// Public entry point.
//
//   const ts = await createTypesetter((name) => fetch(`fonts/${name}.json`).then((r) => r.json()));
//   const { pages, warnings } = ts.typeset(source);
//   const svgs = pages.map((p) => ts.render(p));

import { loadFonts } from "./font.js";
import { Hyphenator } from "./hyphenate.js";
import { patterns, exceptions } from "../hyphenation/en.js";
import { parseDocument } from "./document.js";
import { Composer } from "./compose.js";
import { buildPages } from "./pages.js";
import { renderPage } from "./svg.js";
import { clarendon } from "./style.js";

export { clarendon };

export async function createTypesetter(loadFace, style = clarendon) {
  const fonts = await loadFonts(loadFace);
  const hyphenator = new Hyphenator(patterns, exceptions, { leftMin: 2, rightMin: 3 });
  let counter = 0;
  return {
    fonts,
    style,
    // Returns { pages, warnings }; throws on markup it can't parse.
    typeset(source) {
      const doc = parseDocument(source);
      const composer = new Composer(fonts, style, hyphenator);
      const vlist = composer.compose(doc);
      return { pages: buildPages(vlist, style), warnings: composer.warnings };
    },
    // Each call gets its own id prefix so several SVGs can share a document.
    // Options: `style` overrides rendering-only settings (letterpress, paper,
    // ink); `back` is the page on the other side of the leaf, which shows
    // through faintly; `px` is how many device pixels a point will cover,
    // which tunes the letterpress texture to the display (default 4).
    render(page, { style: overrides = {}, back = null, px = 4 } = {}) {
      return renderPage(page, { ...style, ...overrides }, fonts, `t${(counter++).toString(36)}-`, { back, px });
    },
  };
}
