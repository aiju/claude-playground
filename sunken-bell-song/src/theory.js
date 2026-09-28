// Notation helpers: note names, a compact melody language, chords and voicings.
//
// Melody language (whitespace separated tokens):
//   D5:4.      note D5, dotted quarter   (durations: 1 2 4 8 16 32, '.' dotted, 't' triplet)
//   F5         note, reusing the previous duration
//   r:8        rest
//   C6:8~      tie into the next note (durations merge)
//   (E5)D5:4   grace note(s) before the main note, e.g. (E5,F5)D5
//   flags after the duration:
//     '  staccato    >  accent    *  trill (upper note set by the score)
//     s  slide up into the note    f  fall off at the end    m  mordent
//   v70        set velocity (0-127) for following notes
//   |          bar line: asserts that the bar is exactly full

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (parseInt(m[3], 10) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export function dur(code) {
  const m = /^(\d+)(\.{0,2})(t?)$/.exec(code);
  if (!m) throw new Error('bad duration ' + code);
  let d = 4 / parseInt(m[1], 10);
  if (m[2] === '.') d *= 1.5;
  if (m[2] === '..') d *= 1.75;
  if (m[3]) d *= 2 / 3;
  return d;
}

// Parse a melody string starting at `start` (in beats).
export function mel(str, start = 0, { transpose = 0, vel = 90, barLen = 4, name = '' } = {}) {
  const out = [];
  let t = start;
  let d = 1;
  let v = vel;
  let barStart = start;
  let tie = null;
  const toks = str.trim().split(/\s+/);
  for (let ti = 0; ti < toks.length; ti++) {
    const tok = toks[ti];
    if (tok === '|') {
      const len = t - barStart;
      if (Math.abs(len - barLen) > 1e-6) {
        throw new Error(`${name}: bar at beat ${barStart} has ${len} beats, expected ${barLen} (near "${toks.slice(Math.max(0, ti - 4), ti).join(' ')}")`);
      }
      barStart = t;
      continue;
    }
    if (/^v\d+$/.test(tok)) {
      v = parseInt(tok.slice(1), 10);
      continue;
    }
    const m = /^(\(([^)]*)\))?([A-G][#b]?-?\d|r)(:([0-9.t]+))?([~'>*sfm]*)$/.exec(tok);
    if (!m) throw new Error(`${name}: bad token "${tok}"`);
    if (m[5]) d = dur(m[5]);
    const flags = m[6] || '';
    if (m[3] === 'r') {
      tie = null;
      t += d;
      continue;
    }
    const note = midi(m[3]) + transpose;
    if (tie && tie.m === note) {
      tie.d += d;
      if (flags.includes('f')) tie.fall = true;
      if (!flags.includes('~')) tie = null;
      t += d;
      continue;
    }
    const n = {
      t,
      d,
      m: note,
      v: flags.includes('>') ? Math.min(127, v + 18) : v,
      grace: m[2] ? m[2].split(',').map((g) => midi(g) + transpose) : null,
      trill: flags.includes('*'),
      stacc: flags.includes("'"),
      slide: flags.includes('s'),
      fall: flags.includes('f'),
      mordent: flags.includes('m'),
    };
    out.push(n);
    tie = flags.includes('~') ? n : null;
    t += d;
  }
  if (Math.abs(t - barStart) > 1e-6 && Math.abs(t - barStart - barLen) > 1e-6) {
    throw new Error(`${name}: last bar has ${t - barStart} beats, expected ${barLen}`);
  }
  return out;
}

// ---- scales -------------------------------------------------------------------

// Next scale note above midi note m, for trills and mordents.
export function scaleUp(m, pcs) {
  let u = m + 1;
  while (!pcs.includes(((u % 12) + 12) % 12)) u++;
  return u;
}

export const SCALES = {
  cMinor: [0, 2, 3, 5, 7, 8, 10],
  cHarmonic: [0, 2, 3, 5, 7, 8, 11],
  cHijaz: [0, 1, 4, 5, 7, 8, 10],
};

// ---- chords ---------------------------------------------------------------------

const QUAL = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  5: [0, 7],
  6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  mmaj7: [0, 3, 7, 11],
  9: [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  'maj7#11': [0, 4, 7, 11, 18],
  '7b9': [0, 4, 7, 10, 13],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  '7sus4': [0, 5, 7, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
};

export function chord(sym) {
  const m = /^([A-G])(#|b)?([a-z0-9#]*)(\/([A-G][#b]?))?$/.exec(sym);
  if (!m) throw new Error('bad chord ' + sym);
  const root = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const q = QUAL[m[3]];
  if (!q) throw new Error('bad chord quality ' + sym);
  const bass = m[5] ? midi(m[5] + '0') % 12 : root;
  return { sym, root, bass, iv: q, pcs: q.map((x) => (root + x) % 12) };
}

export function transposeChord(sym, semis) {
  const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  return sym.replace(/([A-G][#b]?)/g, (n) => names[(midi(n + '0') - 12 + semis + 120) % 12]);
}

// Chord chart: "Dm | Bb | Gm:2 A:2 | ..." -> [{t, d, c}] in beats.
export function chart(str, start = 0, { transpose = 0, barLen = 4 } = {}) {
  const out = [];
  let t = start;
  for (const bar of str.split('|')) {
    const toks = bar.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    let used = 0;
    for (const tok of toks) {
      const [sym, dc] = tok.split(':');
      const d = dc ? dur(dc) : barLen - used;
      const s = transpose ? transposeChord(sym, transpose) : sym;
      out.push({ t, d, c: chord(s) });
      t += d;
      used += d;
    }
    if (Math.abs(used - barLen) > 1e-6) throw new Error(`chart bar not ${barLen} beats: ${bar}`);
  }
  return out;
}

export function chordAt(ch, t) {
  for (const x of ch) if (t >= x.t - 1e-6 && t < x.t + x.d - 1e-6) return x.c;
  return null;
}

// All close-ish voicings of `n` notes of chord `c` within [lo, hi].
function candidates(c, n, lo, hi) {
  const res = [];
  const pcs = c.pcs.slice();
  for (let base = lo; base <= hi; base++) {
    if (!pcs.includes(base % 12)) continue;
    const v = [base];
    let idx = pcs.indexOf(base % 12);
    let cur = base;
    while (v.length < n) {
      idx = (idx + 1) % pcs.length;
      let next = cur + 1;
      while (next % 12 !== pcs[idx]) next++;
      v.push(next);
      cur = next;
    }
    if (cur <= hi) res.push(v);
  }
  return res;
}

// Pick a voicing near the previous one (smooth voice leading).
export function voice(c, n, lo, hi, prev = null) {
  const cand = candidates(c, n, lo, hi);
  if (!cand.length) throw new Error('no voicing for ' + c.sym);
  const mid = (lo + hi) / 2;
  let best = null;
  let bestCost = Infinity;
  for (const v of cand) {
    let cost = 0;
    if (prev) for (let i = 0; i < n; i++) cost += Math.abs(v[i] - prev[Math.min(i, prev.length - 1)]);
    else cost = Math.abs(v.reduce((a, b) => a + b, 0) / n - mid);
    if (!v.some((x) => x % 12 === c.root)) cost += 3;
    if (c.iv.length > 2 && !v.some((x) => x % 12 === c.pcs[1])) cost += 4;
    // avoid semitone clashes between adjacent voices in the lower register
    for (let i = 1; i < n; i++) if (v[i] - v[i - 1] === 1 && v[i] < 60) cost += 6;
    if (cost < bestCost) {
      bestCost = cost;
      best = v;
    }
  }
  return best;
}

// Lowest MIDI note with pitch class pc that is >= lo.
export function pcAbove(pc, lo) {
  let m = lo;
  while (((m % 12) + 12) % 12 !== pc) m++;
  return m;
}
