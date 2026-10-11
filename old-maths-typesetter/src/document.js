// Parse the LaTeX-flavoured source into blocks.
//
//   \chapter{Title}  or  \chapter[III]{Title}
//   \section{Title.}                 run-in numbered heading, 1.1, 1.2, ...
//   \begin{theorem} ... \end{theorem}  THEOREM n., statement in italic
//   \begin{items} \item[(A)] ... \end{items}  hanging-indented list
//   blank line                        new paragraph
//   $...$                             in-line maths
//   $$ ... $$                         displayed maths; inside it \no numbers
//                                     an equation (1.2.3), \label{key} names
//                                     it, \\ starts a new line and & aligns
//   \footnote{...}, \emph{...}, \textbf{...}, \textsc{...}, \eqref{key},
//   \ref{key}, \S, ~, --, ---, `quotes', \noindent, \newpage,
//   \pagenumber{n}
//
// Blocks: {type: chapter|par|display|newpage}. Paragraph content is a list of
// inline items: text, math, footnote, ref, space kinds.

import { parseMath } from "./math/parse.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

export function parseDocument(src) {
  src = src.replace(/(^|[^\\])%.*$/gm, "$1");
  const blocks = [];
  const labels = new Map();
  const state = { chapter: 0, section: 0, equation: 0, theorem: 0, chapterRoman: "" };
  let buf = "";
  let para = null; // pending paragraph options
  let italic = false;

  const flush = () => {
    if (buf.trim() || (para && para.head)) {
      const content = parseInline(buf.trim(), italic ? "italic" : "roman", labels, state);
      blocks.push({ type: "par", indent: para ? para.indent : true, head: para ? para.head : null, content });
    }
    buf = "";
    para = null;
  };

  let i = 0;
  const readGroup = (open = "{", close = "}") => {
    while (/\s/.test(src[i])) i++;
    if (src[i] !== open) return null;
    let depth = 0;
    const start = i;
    for (; i < src.length; i++) {
      if (src[i] === "\\") {
        i++;
        continue;
      }
      if (src[i] === open) depth++;
      else if (src[i] === close && --depth === 0) {
        i++;
        return src.slice(start + 1, i - 1);
      }
    }
    throw new Error(`unclosed ${open}`);
  };
  const startsWith = (s) => src.startsWith(s, i);

  while (i < src.length) {
    if (src[i] === "\n" && /^\n[ \t]*\n/.test(src.slice(i, i + 50))) {
      flush();
      while (i < src.length && /\s/.test(src[i])) i++;
      continue;
    }
    if (startsWith("\\chapter")) {
      flush();
      i += 8;
      const opt = readGroup("[", "]");
      const title = readGroup();
      state.chapter = opt && ROMAN.includes(opt) ? ROMAN.indexOf(opt) : state.chapter + 1;
      state.section = 0;
      state.equation = 0;
      state.chapterRoman = opt || ROMAN[state.chapter] || String(state.chapter);
      blocks.push({ type: "chapter", number: state.chapterRoman, titleText: title });
      continue;
    }
    if (startsWith("\\section")) {
      flush();
      i += 8;
      const title = readGroup();
      state.section++;
      state.equation = 0;
      const number = `${state.chapter}.${state.section}`;
      para = { indent: true, head: { kind: "section", number, title: parseInline(title, "bold", labels, state) } };
      continue;
    }
    if (startsWith("\\begin{theorem}")) {
      flush();
      i += 15;
      state.theorem++;
      italic = true;
      para = { indent: true, head: { kind: "theorem", number: String(state.theorem) } };
      // a \label straight after names the theorem
      const m = /^\s*\\label\{([^}]*)\}/.exec(src.slice(i));
      if (m) {
        labels.set(m[1], String(state.theorem));
        i += m[0].length;
      }
      continue;
    }
    if (startsWith("\\end{theorem}")) {
      flush();
      italic = false;
      i += 13;
      continue;
    }
    if (startsWith("\\begin{items}") || startsWith("\\end{items}")) {
      flush();
      i += startsWith("\\begin{items}") ? 13 : 11;
      continue;
    }
    if (startsWith("\\item")) {
      flush();
      i += 5;
      const label = readGroup("[", "]") || "";
      para = { indent: true, head: { kind: "item", label: parseInline(label, italic ? "italic" : "roman", labels, state) } };
      continue;
    }
    if (startsWith("\\newpage")) {
      flush();
      blocks.push({ type: "newpage" });
      i += 8;
      continue;
    }
    if (startsWith("\\pagenumber")) {
      i += 11;
      blocks.push({ type: "pagenumber", value: Number(readGroup()) });
      continue;
    }
    if (startsWith("\\noindent")) {
      i += 9;
      para = para || { indent: false, head: null };
      para.indent = false;
      continue;
    }
    if (startsWith("$$")) {
      // the text so far is the first part of a paragraph the display splits
      const p = para;
      if (buf.trim()) flush();
      else if (p && p.head) flush();
      const end = src.indexOf("$$", i + 2);
      if (end < 0) throw new Error("unclosed $$");
      const body = src.slice(i + 2, end);
      i = end + 2;
      blocks.push(display(body, labels, state));
      // text straight after the display continues the paragraph, unindented
      para = { indent: false, head: null };
      continue;
    }
    if (src[i] === "\\" && src[i + 1] === "$") {
      buf += "\\$";
      i += 2;
      continue;
    }
    if (src[i] === "$") {
      // copy inline maths verbatim so the paragraph parser sees it whole
      const end = src.indexOf("$", i + 1);
      if (end < 0) throw new Error("unclosed $");
      buf += src.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (!buf && !para) para = { indent: true, head: null };
    buf += src[i++];
  }
  flush();
  return { blocks, labels };
}

function display(body, labels, state) {
  const list = parseMath(body);
  // give each \no its number, and each \label the number before it
  let last = null;
  for (const item of list) {
    if (item.type === "eqno") {
      state.equation++;
      item.number = `${state.chapter}.${state.section}.${state.equation}`;
      last = item;
    } else if (item.type === "label") {
      if (last) labels.set(item.key, last.number);
    }
  }
  return { type: "display", list };
}

// ---------------------------------------------------------------------------
// in-line content

const TEXT_COMMANDS = {
  "\\emph": (f) => (f === "italic" ? "roman" : "italic"),
  "\\textit": () => "italic",
  "\\textbf": () => "bold",
  "\\textrm": () => "roman",
  "\\textup": () => "roman",
};

export function parseInline(s, font, labels, state, sc = false) {
  const out = [];
  let text = "";
  const pushText = () => {
    if (text) out.push({ t: "text", text: smartQuotes(text), font, sc });
    text = "";
  };
  let i = 0;
  const group = () => {
    while (s[i] === " ") i++;
    if (s[i] !== "{") throw new Error(`expected { at ${s.slice(i, i + 20)}`);
    let depth = 0;
    const start = i;
    for (; i < s.length; i++) {
      if (s[i] === "\\") {
        i++;
        continue;
      }
      if (s[i] === "$") {
        const e = s.indexOf("$", i + 1);
        i = e;
        continue;
      }
      if (s[i] === "{") depth++;
      else if (s[i] === "}" && --depth === 0) {
        i++;
        return s.slice(start + 1, i - 1);
      }
    }
    throw new Error("unclosed {");
  };

  while (i < s.length) {
    const ch = s[i];
    if (ch === "$") {
      pushText();
      const end = s.indexOf("$", i + 1);
      out.push({ t: "math", list: parseMath(s.slice(i + 1, end)), src: s.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (ch === "{") {
      pushText();
      out.push(...parseInline(group(), font, labels, state, sc));
      continue;
    }
    if (ch === "~") {
      pushText();
      out.push({ t: "nbsp" });
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      text += " ";
      while (i < s.length && /\s/.test(s[i])) i++;
      continue;
    }
    if (ch === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
      const cs = "\\" + m[1];
      i += m[0].length;
      if (cs in TEXT_COMMANDS) {
        pushText();
        const f = TEXT_COMMANDS[cs](font);
        // italic correction on the way into upright type, too
        if (font === "italic" && f !== "italic" && out.length) out.push({ t: "italcorr" });
        out.push(...parseInline(group(), f, labels, state, sc));
        // italic correction on the way out of italic, unless . or , follows
        if (f === "italic" && font !== "italic" && !/^[.,]/.test(s.slice(i))) out.push({ t: "italcorr" });
        continue;
      }
      if (cs === "\\textsc") {
        pushText();
        out.push(...parseInline(group(), font, labels, state, true));
        continue;
      }
      if (cs === "\\footnote") {
        pushText();
        out.push({ t: "footnote", content: parseInline(group().trim(), "roman", labels, state) });
        continue;
      }
      if (cs === "\\eqref" || cs === "\\ref") {
        pushText();
        out.push({ t: "ref", key: group(), paren: cs === "\\eqref", font });
        continue;
      }
      if (cs === "\\label") {
        group();
        continue;
      }
      if (cs === "\\S") {
        text += "§";
        pushText();
        out.push({ t: "thin", nobreak: true });
        while (s[i] === " " || s[i] === "~") i++;
        continue;
      }
      if (cs === "\\SS") {
        text += "§§";
        pushText();
        out.push({ t: "thin", nobreak: true });
        while (s[i] === " " || s[i] === "~") i++;
        continue;
      }
      if (cs === "\\dots" || cs === "\\ldots") {
        pushText();
        out.push({ t: "dots", font });
        continue;
      }
      if (cs === "\\,") {
        pushText();
        out.push({ t: "thin", nobreak: true });
        continue;
      }
      if (cs === "\\ ") {
        pushText();
        out.push({ t: "space" });
        continue;
      }
      if (cs === "\\enskip" || cs === "\\quad" || cs === "\\qquad") {
        pushText();
        out.push({ t: "skip", em: { "\\enskip": 0.5, "\\quad": 1, "\\qquad": 2 }[cs] });
        while (s[i] === " ") i++;
        continue;
      }
      if (cs === "\\/") {
        pushText();
        out.push({ t: "italcorr" });
        continue;
      }
      if (cs === "\\dag") {
        text += "†";
        continue;
      }
      if ("%&$#_{}".includes(m[1])) {
        text += m[1];
        continue;
      }
      throw new Error(`unknown command ${cs}`);
    }
    text += ch;
    i++;
  }
  pushText();
  return out;
}

function smartQuotes(t) {
  return t
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/``/g, "“")
    .replace(/''/g, "”")
    .replace(/`/g, "‘")
    .replace(/'/g, "’");
}
