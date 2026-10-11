// A font face loaded from the JSON written by tools/build-fonts.py.
//
// All metrics returned by this class are in ems (multiples of the font
// size), so callers multiply by the size in points.

export class Font {
  constructor(key, data) {
    this.key = key;
    this.data = data;
    this.name = data.name;
    this.upm = data.upm;
    this.glyphs = data.glyphs;
    this.cmap = new Map(Object.entries(data.cmap).map(([k, v]) => [Number(k), v]));
    this.kerning = data.kern || {};
    this.smallCaps = data.smcp || {};
    this.named = data.named || {};
    this.math = data.math || null;
    this.xHeight = data.xHeight / data.upm;
    this.capHeight = data.capHeight / data.upm;

    // first glyph -> [[rest of components], ligature], longest first
    this.ligatures = new Map();
    for (const [comps, lig] of data.ligatures || []) {
      const [first, ...rest] = comps;
      if (!this.ligatures.has(first)) this.ligatures.set(first, []);
      this.ligatures.get(first).push([rest, lig]);
    }
    for (const list of this.ligatures.values()) list.sort((a, b) => b[0].length - a[0].length);
  }

  has(ch) {
    return this.cmap.has(ch.codePointAt(0));
  }

  glyphFor(ch) {
    const gid = this.cmap.get(ch.codePointAt(0));
    return gid === undefined ? 0 : gid;
  }

  advance(gid) {
    return this.glyphs[gid].w / this.upm;
  }

  // [xMin, yMin, xMax, yMax] in ems
  bbox(gid) {
    const b = this.glyphs[gid].b;
    return [b[0] / this.upm, b[1] / this.upm, b[2] / this.upm, b[3] / this.upm];
  }

  height(gid) {
    return Math.max(0, this.glyphs[gid].b[3] / this.upm);
  }

  depth(gid) {
    return Math.max(0, -this.glyphs[gid].b[1] / this.upm);
  }

  kern(a, b) {
    const row = this.kerning[a];
    return row && row[b] ? row[b] / this.upm : 0;
  }

  // How far the ink pokes out to the right of the advance width: a stand-in
  // for TeX's italic correction, which text fonts don't carry in OpenType.
  overhang(gid) {
    return Math.max(0, (this.glyphs[gid].b[2] - this.glyphs[gid].w) / this.upm);
  }

  // Turn a string into glyphs: ligatures, small capitals, kerning.
  // Returns [{gid, kern, start}]: kern is the adjustment (em) after the
  // glyph, start the index of its first character in [...text].
  shape(text, { smallCaps = false, ligatures = true } = {}) {
    let gids = [];
    for (const ch of text) {
      let gid = this.glyphFor(ch);
      if (smallCaps && this.smallCaps[gid] !== undefined) gid = this.smallCaps[gid];
      gids.push(gid);
    }
    let starts = gids.map((_, i) => i);
    if (ligatures && this.ligatures.size) {
      const out = [];
      const outStarts = [];
      for (let i = 0; i < gids.length; i++) {
        const cands = this.ligatures.get(gids[i]);
        let done = false;
        if (cands) {
          for (const [rest, lig] of cands) {
            if (rest.every((g, j) => gids[i + 1 + j] === g)) {
              out.push(lig);
              outStarts.push(i);
              i += rest.length;
              done = true;
              break;
            }
          }
        }
        if (!done) {
          out.push(gids[i]);
          outStarts.push(i);
        }
      }
      gids = out;
      starts = outStarts;
    }
    return gids.map((gid, i) => ({ gid, start: starts[i], kern: i + 1 < gids.length ? this.kern(gid, gids[i + 1]) : 0 }));
  }

  // ---- maths font helpers ----

  mathConstant(name) {
    const v = this.math.constants[name];
    if (v === undefined) throw new Error(`unknown maths constant ${name}`);
    // percentages stay as they are, lengths become ems
    return /Percent/.test(name) ? v : v / this.upm;
  }

  italicCorrection(gid) {
    const v = this.math && this.math.italic[gid];
    return v ? v / this.upm : 0;
  }

  topAccent(gid) {
    const v = this.math && this.math.accent[gid];
    return v === undefined ? null : v / this.upm;
  }

  // script-size alternate: level 1 = script, 2 = scriptscript
  scriptVariant(gid, level) {
    const alts = this.math && this.math.ssty[gid];
    if (!alts || !alts.length || level === 0) return gid;
    return alts[Math.min(level, alts.length) - 1];
  }

  verticalVariants(gid) {
    return (this.math && this.math.vertical[gid]) || null;
  }
}

export const FACE_FILES = ["roman", "italic", "bold", "roman8", "italic8", "math"];

// Load every face with the given loader, which maps a face name to its parsed
// JSON (fetch in the browser, readFile in Node).
export async function loadFonts(load) {
  const entries = await Promise.all(FACE_FILES.map(async (k) => [k, new Font(k, await load(k))]));
  return Object.fromEntries(entries);
}
