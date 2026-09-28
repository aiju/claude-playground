// Lays the narration out in time. Each line's speech starts after the gap
// given here, measured from the end of the previous line's speech; the gaps
// are where the pictures get room to breathe. Word timings from the voice
// manifest become absolute cue times the scenes can hang animation on.
//
// Runs in the browser (player) and in Node (soundtrack checks), so it takes
// the manifest as data and touches nothing else.

export const SECTIONS = [
  'First light',
  'The controllers that aren’t there',
  'One microinstruction',
  'The computer is a program',
  'Sixteen tasks, free switching',
  'The screen eats the machine',
  'Everything else is microcode too',
  'Payoff',
];

// [line, section, seconds of quiet before its speech starts]
const PLAN = [
  ['N1', 1, 1.6], // the beam starts drawing and the clock fades in first
  ['N2', 2, 0.9],
  ['N3', 3, 0.8],
  ['N4', 3, 0.55],
  ['N5', 4, 0.8],
  ['N6', 4, 0.5],
  ['N7', 5, 0.8],
  ['N8', 5, 0.55],
  ['N9', 6, 0.8],
  ['N10', 6, 0.55],
  ['N11', 6, 0.55],
  ['N12', 7, 2.4], // the scanline grid finishes and fills a whole screen
  ['N13', 7, 0.45],
  ['N14', 7, 0.45],
  ['N15', 8, 0.9],
  ['N16', 8, 1.1], // the screen goes dark and the machine speeds up
];
const TAIL = 4.0; // the title card and the last chord

// Silence kept around each clip's speech when it's placed.
export const PAD = [0.04, 0.12];

// Words are looked up by a simplified key: "micro-PC." -> "micropc".
export const key = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

export function buildTimeline(manifest) {
  const lines = {};
  let t = 0;
  for (const [id, section, before] of PLAN) {
    const clip = manifest.lines[id];
    if (!clip) throw new Error(`no voice clip for ${id}`);
    const start = t + before;
    const shift = start - clip.speechStart; // clip time -> video time
    lines[id] = {
      id,
      section,
      text: clip.text,
      start,
      end: clip.speechEnd + shift,
      clip: { shift, from: Math.max(0, clip.speechStart - PAD[0]), to: Math.min(clip.duration, clip.speechEnd + PAD[1]) },
      words: (clip.words || []).map((w) => ({ w: w.w, key: key(w.w), start: w.start + shift, end: w.end + shift })),
    };
    t = lines[id].end;
  }
  const duration = t + TAIL;

  // Exact matches first, then words that start with the key ("functions…"
  // for "functions").
  const find = (l, word, nth) => {
    const k = key(word);
    const exact = l.words.filter((w) => w.key === k);
    const hits = exact.length > nth ? exact : l.words.filter((w) => w.key.startsWith(k));
    if (!hits[nth]) throw new Error(`no word "${word}" (#${nth}) in ${l.id}`);
    return hits[nth];
  };

  const T = {
    lines,
    duration,
    // First time a line (or its nth occurrence of a word) is heard.
    at(id, word, nth = 0) {
      const l = lines[id];
      if (!l) throw new Error(`no line ${id}`);
      if (word === undefined) return l.start;
      return find(l, word, nth).start;
    },
    end(id, word, nth = 0) {
      const l = lines[id];
      if (!l) throw new Error(`no line ${id}`);
      if (word === undefined) return l.end;
      return find(l, word, nth).end;
    },
    // The word being spoken (or the last one spoken) at time t, for captions
    // and for the player's position readout.
    wordAt(t) {
      let found = null;
      for (const l of Object.values(lines)) {
        if (t < l.start - 0.05 || t > l.end + 0.6) continue;
        for (const w of l.words) if (w.start <= t) found = { line: l, word: w };
      }
      return found;
    },
  };
  return T;
}
