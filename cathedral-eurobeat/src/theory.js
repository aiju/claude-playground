// Notation helpers: note names, a compact step-sequencer melody language, chords and
// voice-leading.
//
// Melody language (whitespace separated), lengths counted in 16th notes:
//   D6:3     D6 for a dotted eighth          r:4    quarter rest
//   _:8      extend the previous note        v100   velocity for following notes
//   |        bar line: asserts the bar is exactly full (16 steps by default)
//   D6:3>    accent                          D6:2'  staccato

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (parseInt(m[3], 10) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// Returns notes {t, d, m, v, acc, stacc} with t and d in beats.
export function seq(str, start = 0, { tr = 0, vel = 96, bar = 16, name = '' } = {}) {
  const out = [];
  let step = 0;
  let barStart = 0;
  let v = vel;
  const toks = str.trim().split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok === '|') {
      if (step - barStart !== bar) {
        throw new Error(`${name}: bar ${Math.round(barStart / bar)} has ${step - barStart} steps (near "${toks.slice(Math.max(0, i - 5), i).join(' ')}")`);
      }
      barStart = step;
      continue;
    }
    if (/^v\d+$/.test(tok)) {
      v = parseInt(tok.slice(1), 10);
      continue;
    }
    const m = /^([A-G][#b]?-?\d|r|_):(\d+)([>']*)$/.exec(tok);
    if (!m) throw new Error(`${name}: bad token "${tok}"`);
    const len = parseInt(m[2], 10);
    if (m[1] === '_') {
      if (!out.length) throw new Error(`${name}: tie with nothing before it`);
      out[out.length - 1].d += len / 4;
    } else if (m[1] !== 'r') {
      out.push({
        t: start + step / 4,
        d: len / 4,
        m: midi(m[1]) + tr,
        v: m[3].includes('>') ? Math.min(127, v + 16) : v,
        acc: m[3].includes('>'),
        stacc: m[3].includes("'"),
      });
    }
    step += len;
  }
  return out;
}

// ---- chords ------------------------------------------------------------------------

const QUAL = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  '7b9': [0, 4, 7, 10, 13],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  5: [0, 7],
  aug: [0, 4, 8],
};

// "Dm", "Bb", "A7", "Asus4", "C/E", "Dm/A", "Ebmaj7" ...
export function chord(sym) {
  const [main, bassName] = sym.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  if (!m || !(m[2] in QUAL)) throw new Error('bad chord ' + sym);
  const root = midi(m[1] + '0') % 12;
  const ivs = QUAL[m[2]];
  const pcs = ivs.map((i) => (root + i) % 12);
  const bass = bassName ? midi(bassName + '0') % 12 : root;
  return { sym, root, pcs, bass, third: ivs.length > 1 ? (root + ivs[1]) % 12 : root };
}

export function transposeChord(sym, n) {
  const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  return sym.replace(/[A-G][#b]?/g, (x) => names[(((midi(x + '0') % 12) + n) % 12 + 12) % 12]);
}

// Lowest MIDI note >= lo with the given pitch class.
export function pcAbove(pc, lo) {
  return lo + ((((pc - lo) % 12) + 12) % 12);
}

// Choose `n` chord tones between lo and hi that cover the chord's pitch classes (as far
// as n allows) and move as little as possible from `prev`.
export function voice(ch, { lo = 55, hi = 79, n = 4, prev = null, top = null } = {}) {
  const c = typeof ch === 'string' ? chord(ch) : ch;
  const cand = [];
  for (let k = lo; k <= hi; k++) if (c.pcs.includes(((k % 12) + 12) % 12)) cand.push(k);
  const must = new Set([c.root, c.third]);
  let best = null;
  let bestScore = Infinity;
  const pick = [];
  const rec = (i) => {
    if (pick.length === n) {
      const pcs = new Set(pick.map((k) => k % 12));
      for (const p of must) if (!pcs.has(p) && n >= 2) return;
      const want = Math.min(n, c.pcs.length);
      let score = (want - pcs.size) * 6;
      // Avoid clusters of seconds at the bottom of the voicing.
      for (let j = 1; j < pick.length; j++) if (pick[j] - pick[j - 1] < 3 && pick[j - 1] < 60) score += 4;
      if (top != null) score += Math.abs(pick[pick.length - 1] - top) * 3;
      if (prev && prev.length === n) for (let j = 0; j < n; j++) score += Math.abs(pick[j] - prev[j]);
      else score += Math.abs((pick[0] + pick[n - 1]) / 2 - (lo + hi) / 2) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = pick.slice();
      }
      return;
    }
    for (let j = i; j < cand.length; j++) {
      pick.push(cand[j]);
      rec(j + 1);
      pick.pop();
    }
  };
  rec(0);
  if (!best) throw new Error(`no voicing for ${c.sym} in ${lo}..${hi}`);
  return best;
}

// Voice a whole progression with smooth voice leading.
export function voiceProg(syms, opts) {
  let prev = opts.prev || null;
  return syms.map((s) => {
    const v = voice(s, { ...opts, prev });
    prev = v;
    return v;
  });
}
