// Parse a TeX-like maths formula into a list of atoms and other items.
//
// Atoms: { type: ord|op|bin|rel|open|close|punct|inner, nucleus, sup, sub, limits }
// Nuclei: { kind: "sym", ch, font } | { kind: "text", text, font }
//       | { kind: "list", list } | { kind: "delim", ch, size }
// Other items: frac, sqrt, leftright, space, style, and the display markers
// align (&), newline (\\), eqno (\no), label, tag.

import { SYMBOLS, DELIMS, alphabet } from "./symbols.js";

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "%") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (/\s/.test(ch)) {
      tokens.push({ space: true });
      while (i < src.length && /\s/.test(src[i])) i++;
    } else if (ch === "\\") {
      let j = i + 1;
      if (/[A-Za-z]/.test(src[j] || "")) {
        while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
      } else j++;
      tokens.push({ cs: src.slice(i, j) });
      i = j;
    } else {
      const cp = src.codePointAt(i);
      const s = String.fromCodePoint(cp);
      tokens.push({ ch: s });
      i += s.length;
    }
  }
  return tokens;
}

const SPACES = { "\\,": 3, "\\:": 4, "\\>": 4, "\\;": 5, "\\!": -3, "~": 6, "\\ ": 6 };
const STYLES = { "\\displaystyle": 0, "\\textstyle": 1, "\\scriptstyle": 2, "\\scriptscriptstyle": 3 };
const FONTS = { "\\mathrm": "roman", "\\mathit": "italic", "\\mathbf": "bold", "\\textrm": "roman", "\\text": "roman", "\\mbox": "roman", "\\textit": "italic", "\\textbf": "bold" };
const BIG = { "\\big": 1, "\\Big": 2, "\\bigg": 3, "\\Bigg": 4 };

export function parseMath(src) {
  const p = new Parser(tokenize(src), src);
  const list = p.parseList(null);
  return list;
}

class Parser {
  constructor(tokens, src) {
    this.t = tokens;
    this.i = 0;
    this.src = src;
  }

  peek() {
    return this.t[this.i];
  }

  next() {
    return this.t[this.i++];
  }

  skipSpace() {
    while (this.peek() && this.peek().space) this.i++;
  }

  error(msg) {
    return new Error(`maths: ${msg} in "${this.src}"`);
  }

  // raw text of a braced argument (for \text, \label)
  rawArg() {
    this.skipSpace();
    const tok = this.next();
    if (!tok) throw this.error("missing argument");
    if (tok.ch !== "{") return tok.ch || tok.cs;
    let depth = 1;
    let out = "";
    for (;;) {
      const t = this.next();
      if (!t) throw this.error("unclosed {");
      if (t.ch === "{") depth++;
      if (t.ch === "}" && --depth === 0) break;
      out += t.space ? " " : t.ch || t.cs + (/[A-Za-z]$/.test(t.cs) && this.peek() && this.peek().ch && /[A-Za-z]/.test(this.peek().ch) ? " " : "");
    }
    return out;
  }

  // a single token or a braced group, as a list
  arg() {
    this.skipSpace();
    const tok = this.peek();
    if (!tok) throw this.error("missing argument");
    if (tok.ch === "{") {
      this.next();
      return this.parseList("}");
    }
    return this.parseOne();
  }

  delimiter() {
    this.skipSpace();
    const tok = this.next();
    const key = tok && (tok.ch || tok.cs);
    if (!DELIMS.has(key)) throw this.error(`bad delimiter ${key}`);
    return DELIMS.get(key);
  }

  parseOne() {
    const list = [];
    const saved = this.i;
    this.parseItem(list);
    if (this.i === saved) throw this.error("expected an argument");
    return list;
  }

  parseList(end) {
    const list = [];
    for (;;) {
      const tok = this.peek();
      if (!tok) {
        if (end) throw this.error(`missing ${end}`);
        return list;
      }
      if (end && (tok.ch === end || tok.cs === end)) {
        this.next();
        return list;
      }
      this.parseItem(list);
    }
  }

  parseItem(list) {
    const tok = this.next();
    const last = list[list.length - 1];
    const atom = (type, nucleus, extra = {}) => list.push({ type, nucleus, ...extra });

    if (tok.space) return;
    if (tok.ch === "{") {
      atom("ord", { kind: "list", list: this.parseList("}") });
      return;
    }
    if (tok.ch === "^" || tok.ch === "_") {
      let target = last;
      if (!target || !scriptable(target) || (tok.ch === "^" ? target.sup : target.sub)) {
        target = { type: "ord", nucleus: null };
        list.push(target);
      }
      const script = this.arg();
      if (tok.ch === "^") target.sup = script;
      else target.sub = script;
      return;
    }
    if (tok.ch === "'") {
      let n = 1;
      while (this.peek() && this.peek().ch === "'") {
        this.next();
        n++;
      }
      let target = last && isAtom(last) && !last.sup ? last : null;
      if (!target) {
        target = { type: "ord", nucleus: null };
        list.push(target);
      }
      const primes = { type: "ord", nucleus: { kind: "sym", ch: ["′", "″", "‴"][Math.min(n, 3) - 1], font: "math" } };
      target.sup = [primes];
      if (this.peek() && this.peek().ch === "^") {
        this.next();
        target.sup = [primes, ...this.arg()];
      }
      return;
    }
    if (tok.ch === "&") return list.push({ type: "align" });
    if (tok.ch === "~") return list.push({ type: "space", mu: 6 });
    if (tok.ch === "." && this.peek() && /[0-9]/.test(this.peek().ch || "")) {
      // British decimal point, raised: ·380129
      atom("ord", { kind: "sym", ch: "·", font: "roman" }, { decimal: true });
      return;
    }

    const name = tok.cs || tok.ch;
    if (tok.cs) {
      if (name === "\\\\") return list.push({ type: "newline" });
      if (name in SPACES) return list.push({ type: "space", mu: SPACES[name] });
      if (name === "\\quad") return list.push({ type: "space", mu: 18 });
      if (name === "\\qquad") return list.push({ type: "space", mu: 36 });
      if (name in STYLES) return list.push({ type: "style", style: STYLES[name] });
      if (name === "\\no") return list.push({ type: "eqno" });
      if (name === "\\label") return list.push({ type: "label", key: this.rawArg() });
      if (name === "\\tag") return list.push({ type: "tag", text: this.rawArg() });
      if (name === "\\limits" || name === "\\nolimits") {
        if (last && last.type === "op") last.limitsMode = name === "\\limits" ? "always" : "never";
        return;
      }
      if (name === "\\frac" || name === "\\tfrac" || name === "\\dfrac" || name === "\\cfrac") {
        const num = this.arg();
        const den = this.arg();
        const variant = { "\\frac": "auto", "\\tfrac": "text", "\\dfrac": "display", "\\cfrac": "case" }[name];
        return list.push({ type: "frac", num, den, variant });
      }
      if (name === "\\sqrt") return list.push({ type: "sqrt", body: this.arg() });
      if (name === "\\left") {
        const left = this.delimiter();
        const body = this.parseList("\\right");
        const right = this.delimiter();
        return list.push({ type: "leftright", left, right, body });
      }
      if (name === "\\right") throw this.error("\\right without \\left");
      const bigMatch = /^\\(big|Big|bigg|Bigg)([lrm]?)$/.exec(name);
      if (bigMatch) {
        const size = BIG["\\" + bigMatch[1]];
        const ch = this.delimiter();
        const type = { l: "open", r: "close", m: "rel", "": "ord" }[bigMatch[2]];
        return atom(type, { kind: "delim", ch, size });
      }
      if (name in FONTS) {
        const font = FONTS[name];
        if (name === "\\mathrm" || name === "\\mathit" || name === "\\mathbf") {
          const text = this.rawArg();
          for (const ch of text) if (ch !== " ") atom("ord", { kind: "text", text: ch, font });
          return;
        }
        return atom("ord", { kind: "text", text: this.rawArg(), font });
      }
      if (name === "\\operatorname") return atom("op", { kind: "text", text: this.rawArg(), font: "roman" }, { limits: false });
      if (name === "\\mathfrak" || name === "\\mathcal" || name === "\\mathscr" || name === "\\mathbb") {
        const kind = { "\\mathfrak": "frak", "\\mathcal": "cal", "\\mathscr": "cal", "\\mathbb": "bb" }[name];
        for (const ch of this.rawArg()) if (ch !== " ") atom("ord", { kind: "sym", ch: alphabet(kind, ch), font: "math" });
        return;
      }
      if (name === "\\overline" || name === "\\bar") return atom("ord", { kind: "list", list: this.arg() }, { overline: true });
      if (name === "\\mathop") return atom("op", { kind: "list", list: this.arg() }, { limits: true });
      if (name === "\\mathbin" || name === "\\mathrel" || name === "\\mathord" || name === "\\mathopen" || name === "\\mathclose" || name === "\\mathpunct" || name === "\\mathinner") {
        return atom(name.slice(5), { kind: "list", list: this.arg() });
      }
      if (name === "\\dots" || name === "\\ldots") return atom("ord", { kind: "dots" });
      if (name === "\\phantom") return atom("ord", { kind: "list", list: this.arg() }, { phantom: true });
    }

    const sym = SYMBOLS.get(name);
    if (!sym) throw this.error(`unknown symbol ${name}`);
    if (sym.text) {
      atom(sym.type, { kind: "text", text: sym.text, font: sym.font }, { limits: sym.limits });
    } else {
      atom(sym.type, { kind: "sym", ch: sym.ch, font: sym.font }, {
        limits: sym.limits,
        displayGlyph: sym.displayGlyph,
        upright: sym.upright,
        digit: sym.digit,
      });
    }
  }
}

// fractions, radicals and \left...\right groups take scripts too
function scriptable(item) {
  return isAtom(item) || item.type === "frac" || item.type === "sqrt" || item.type === "leftright";
}

export function isAtom(item) {
  return ["ord", "op", "bin", "rel", "open", "close", "punct", "inner"].includes(item.type);
}
