// What each character and control sequence means in maths mode: its glyph
// and its TeX atom class. A few choices follow Oxford house style of the
// 1940s rather than modern habit: \le is the slanted ⩽, \phi the stroked ϕ,
// \epsilon the lunate ϵ, and integrals are upright.

const italicLatin = (ch) => {
  if (ch === "h") return "ℎ";
  const c = ch.charCodeAt(0);
  return String.fromCodePoint(c >= 97 ? 0x1d44e + c - 97 : 0x1d434 + c - 65);
};

const greekLower = "alpha beta gamma delta varepsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho varsigma sigma tau upsilon varphi chi psi omega".split(" ");
const greekUpper = { Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω" };

export const SYMBOLS = new Map();

const def = (names, ch, type, extra = {}) => {
  for (const name of names.split(" ")) SYMBOLS.set(name, { ch, type, font: "math", ...extra });
};

for (let c = 65; c <= 90; c++) def(String.fromCharCode(c), italicLatin(String.fromCharCode(c)), "ord");
for (let c = 97; c <= 122; c++) def(String.fromCharCode(c), italicLatin(String.fromCharCode(c)), "ord");
for (let d = 0; d <= 9; d++) def(String(d), String(d), "ord", { digit: true });
greekLower.forEach((name, i) => def("\\" + name, String.fromCodePoint(0x1d6fc + i), "ord"));
def("\\epsilon", "\u{1D716}", "ord");
def("\\vartheta", "\u{1D717}", "ord");
def("\\phi", "\u{1D719}", "ord");
def("\\varrho", "\u{1D71A}", "ord");
def("\\varpi", "\u{1D71B}", "ord");
for (const [name, ch] of Object.entries(greekUpper)) def("\\" + name, ch, "ord");

def("+", "+", "bin");
def("-", "−", "bin");
def("*", "∗", "bin");
def("\\pm", "±", "bin");
def("\\mp", "∓", "bin");
def("\\times", "×", "bin");
def("\\div", "÷", "bin");
def("\\cdot", "⋅", "bin");
def("\\circ", "∘", "bin");
def("\\bullet", "•", "bin");
def("\\cup", "∪", "bin");
def("\\cap", "∩", "bin");
def("\\wedge \\land", "∧", "bin");
def("\\vee \\lor", "∨", "bin");
def("\\setminus", "∖", "bin");
def("\\oplus", "⊕", "bin");
def("\\otimes", "⊗", "bin");
def("\\ast", "∗", "bin");
def("\\star", "⋆", "bin");

def("= \\eq", "=", "rel");
def("<", "<", "rel");
def(">", ">", "rel");
def("\\le \\leq \\leqslant", "⩽", "rel");
def("\\ge \\geq \\geqslant", "⩾", "rel");
def("\\ne \\neq", "≠", "rel");
def("\\to \\rightarrow", "→", "rel");
def("\\gets \\leftarrow", "←", "rel");
def("\\leftrightarrow", "↔", "rel");
def("\\Rightarrow \\implies", "⇒", "rel");
def("\\Leftarrow", "⇐", "rel");
def("\\Leftrightarrow \\iff", "⇔", "rel");
def("\\mapsto", "↦", "rel");
def("\\uparrow", "↑", "rel");
def("\\downarrow", "↓", "rel");
def("\\nearrow", "↗", "rel");
def("\\searrow", "↘", "rel");
def("\\approx", "≈", "rel");
def("\\sim", "∼", "rel");
def("\\simeq", "≃", "rel");
def("\\cong", "≅", "rel");
def("\\equiv", "≡", "rel");
def("\\propto", "∝", "rel");
def("\\asymp", "≍", "rel");
def("\\ll", "≪", "rel");
def("\\gg", "≫", "rel");
def("\\in", "∈", "rel");
def("\\notin", "∉", "rel");
def("\\ni", "∋", "rel");
def("\\subset", "⊂", "rel");
def("\\supset", "⊃", "rel");
def("\\subseteq", "⊆", "rel");
def("\\supseteq", "⊇", "rel");
def("\\prec", "≺", "rel");
def("\\succ", "≻", "rel");
def("\\perp", "⊥", "rel");
def("\\parallel", "∥", "rel");
def("\\mid", "∣", "rel");
def(":", ":", "punct");
def(",", ",", "punct");
def(";", ";", "punct");

def("(", "(", "open");
def("[", "[", "open");
def("\\{ \\lbrace", "{", "open");
def("\\langle", "⟨", "open");
def("\\lfloor", "⌊", "open");
def("\\lceil", "⌈", "open");
def(")", ")", "close");
def("]", "]", "close");
def("\\} \\rbrace", "}", "close");
def("\\rangle", "⟩", "close");
def("\\rfloor", "⌋", "close");
def("\\rceil", "⌉", "close");
def("!", "!", "close");
def("?", "?", "close");

def("|", "|", "ord");
def("\\| \\Vert", "‖", "ord");
def("/", "/", "ord");
def("\\backslash", "\\", "ord");
def(".", ".", "ord");
def("\\infty", "∞", "ord");
def("\\partial", "∂", "ord");
def("\\nabla", "∇", "ord");
def("\\forall", "∀", "ord");
def("\\exists", "∃", "ord");
def("\\emptyset", "∅", "ord");
def("\\ell", "ℓ", "ord");
def("\\hbar", "ℏ", "ord");
def("\\Re", "ℜ", "ord");
def("\\Im", "ℑ", "ord");
def("\\neg \\lnot", "¬", "ord");
def("\\angle", "∠", "ord");
def("\\prime", "′", "ord");
def("\\cdots", "⋯", "inner");
def("\\vdots", "⋮", "ord");
def("\\ddots", "⋱", "inner");
def("\\dagger", "†", "ord");
def("\\ddagger", "‡", "ord");
def("\\S", "§", "ord");
def("\\surd", "√", "ord");
def("\\degree", "°", "ord");

// big operators; `limits` says whether they take limits above and below in
// display style (TeX's default for sums), `displayGlyph` whether they grow.
def("\\sum", "∑", "op", { limits: true });
def("\\prod", "∏", "op", { limits: true });
def("\\coprod", "∐", "op", { limits: true });
def("\\bigcup", "⋃", "op", { limits: true });
def("\\bigcap", "⋂", "op", { limits: true });
def("\\Sum", "∑", "op", { limits: true, displayGlyph: true });
def("\\Prod", "∏", "op", { limits: true, displayGlyph: true });
// Hardy's integrals: upright, with the limits set above and below
def("\\int", "∫", "op", { limits: true, displayGlyph: true, upright: true });
def("\\iint", "∬", "op", { limits: true, displayGlyph: true });
def("\\oint", "∮", "op", { limits: true, displayGlyph: true });

// operator names, set in roman
const opname = (names, limits = false) => {
  for (const name of names.split(" ")) {
    SYMBOLS.set("\\" + name, { text: name, type: "op", font: "roman", limits });
  }
};
opname("sin cos tan cot sec csc cosec log ln exp arg sinh cosh tanh coth arcsin arccos arctan det dim ker deg hom sgn Li li erf");
opname("lim max min sup inf gcd Pr", true);
SYMBOLS.set("\\limsup", { text: "lim sup", type: "op", font: "roman", limits: true });
SYMBOLS.set("\\liminf", { text: "lim inf", type: "op", font: "roman", limits: true });
SYMBOLS.set("\\bmod", { text: "mod", type: "bin", font: "roman" });

// maths alphabets
export function alphabet(kind, ch) {
  const c = ch.charCodeAt(0);
  const upper = c >= 65 && c <= 90;
  const idx = upper ? c - 65 : c - 97;
  if (kind === "frak" && upper) {
    const ex = { C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" }[ch];
    return ex || String.fromCodePoint(0x1d504 + idx);
  }
  if (kind === "cal" && upper) {
    const ex = { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ" }[ch];
    return ex || String.fromCodePoint(0x1d49c + idx);
  }
  if (kind === "bb") return { N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ", C: "ℂ", P: "ℙ" }[ch] || ch;
  return ch;
}

// delimiters accepted after \left, \right and \big
export const DELIMS = new Map([
  ["(", "("], [")", ")"], ["[", "["], ["]", "]"], ["\\{", "{"], ["\\}", "}"], ["\\lbrace", "{"], ["\\rbrace", "}"],
  ["|", "|"], ["\\|", "‖"], ["\\Vert", "‖"], ["\\vert", "|"], ["/", "/"], ["\\langle", "⟨"], ["\\rangle", "⟩"],
  ["\\lfloor", "⌊"], ["\\rfloor", "⌋"], ["\\lceil", "⌈"], ["\\rceil", "⌉"], [".", null],
]);
