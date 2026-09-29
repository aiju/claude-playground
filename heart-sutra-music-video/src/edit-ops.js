// The timing editor's edit operations, as pure functions on timing units
// (see edits.js). Each takes a unit as it was when the edit began and
// returns the new one, so a drag can be recomputed from where it started on
// every mouse move. Times come out rounded to 0.01 s.
//
// Syllables in a line never overlap. Two that touch (one ends where the
// next starts) stay together: moving the start of one moves the end of the
// one before. With `stick: false` (⌥ in the editor) they come apart, which
// is how a gap opens.

import { round } from './edits.js';

export const MIN = 0.03;       // the shortest a syllable can get, in seconds
const TOUCH = 0.006;           // closer than this, two syllables touch
const touching = (a, b) => Math.abs(a - b) < TOUCH;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const copy = sy => sy.map(p => [...p]);
const tidy = sy => sy.map(([a, b]) => [round(a), round(b)]);

// Runs of consecutive indices: [1, 2, 3, 6] -> [[1, 3], [6, 6]]
function runs(ks) {
  const out = [];
  for (const k of [...ks].sort((a, b) => a - b)) {
    if (out.length && out[out.length - 1][1] === k - 1) out[out.length - 1][1] = k;
    else out.push([k, k]);
  }
  return out;
}

// Moves syllables `ks` of a line by dt. part 'body' moves them whole (any
// number, as a group); 'start' or 'end' moves one edge of the one syllable
// in ks. Returns the new unit and how far it actually moved.
export function moveSylls(unit, ks, part, dt, { stick = true } = {}) {
  const sy = unit.sylls, out = copy(sy);
  let moved = 0;
  if (part === 'start') {
    const k = ks[0], prev = sy[k - 1];
    const joined = prev && touching(prev[1], sy[k][0]) && stick;
    const lo = prev ? (joined ? prev[0] + MIN : prev[1]) : 0;
    out[k][0] = clamp(sy[k][0] + dt, lo, sy[k][1] - MIN);
    if (joined) out[k - 1][1] = out[k][0];
    moved = out[k][0] - sy[k][0];
  } else if (part === 'end') {
    const k = ks[0], next = sy[k + 1];
    const joined = next && touching(next[0], sy[k][1]) && stick;
    const hi = next ? (joined ? next[1] - MIN : next[0]) : Infinity;
    out[k][1] = clamp(sy[k][1] + dt, sy[k][0] + MIN, hi);
    if (joined) out[k + 1][0] = out[k][1];
    moved = out[k][1] - sy[k][1];
  } else {
    let lo = -Infinity, hi = Infinity;
    const rs = runs(ks);
    const joins = rs.map(([i, j]) => {
      const prev = sy[i - 1], next = sy[j + 1];
      const jp = prev && touching(prev[1], sy[i][0]) && stick, jn = next && touching(next[0], sy[j][1]) && stick;
      lo = Math.max(lo, prev ? (jp ? prev[0] + MIN : prev[1]) - sy[i][0] : -sy[i][0]);
      if (next) hi = Math.min(hi, (jn ? next[1] - MIN : next[0]) - sy[j][1]);
      return [jp, jn];
    });
    moved = clamp(dt, Math.min(0, lo), Math.max(0, hi));
    for (const k of ks) out[k] = [sy[k][0] + moved, sy[k][1] + moved];
    rs.forEach(([i, j], r) => {
      if (joins[r][0]) out[i - 1][1] = out[i][0];
      if (joins[r][1]) out[j + 1][0] = out[j][1];
    });
  }
  return { unit: { ...unit, sylls: tidy(out), checked: true }, moved: round(moved) };
}

// Moves a whole line: every syllable, and (withShown) when it's on screen.
export function shiftLine(unit, dt, { withShown = true } = {}) {
  const first = unit.sylls ? unit.sylls[0][0] : unit.t0;
  const d = Math.max(dt, -Math.min(first, withShown ? unit.t0 : first));
  const out = { ...unit };
  if (unit.sylls) { out.sylls = tidy(unit.sylls.map(([a, b]) => [a + d, b + d])); out.checked = true; }
  if (withShown || !unit.sylls) { out.t0 = round(unit.t0 + d); out.t1 = round(unit.t1 + d); }
  return { unit: out, moved: round(d) };
}

// Pushes later syllables along so none overlaps the one before it.
function ripple(sy, k) {
  for (let i = k + 1; i < sy.length && sy[i][0] < sy[i - 1][1]; i++) {
    const len = sy[i][1] - sy[i][0];
    sy[i][0] = sy[i - 1][1];
    sy[i][1] = Math.max(sy[i][1], sy[i][0] + Math.max(MIN, Math.min(len, 0.1)));
  }
}

// A tap: syllable k starts at t. The syllable before ends there if it
// touched (or would overlap); a syllable tapped after its old end keeps its
// length, pushing later ones along.
export function tapStart(unit, k, t) {
  const sy = copy(unit.sylls), prev = sy[k - 1];
  if (prev) t = Math.max(t, prev[0] + MIN);
  t = Math.max(0, t);
  const len = sy[k][1] - sy[k][0];
  if (prev && (touching(prev[1], sy[k][0]) || prev[1] > t)) prev[1] = t;
  sy[k][0] = t;
  if (sy[k][1] < t + MIN) sy[k][1] = t + Math.max(MIN, len);
  ripple(sy, k);
  return { ...unit, sylls: tidy(sy), checked: true };
}

// Letting go of a held tap: syllable k ends at t. A gap opens if that's
// before the next one starts; later ones move along if it's after.
export function tapEnd(unit, k, t) {
  const sy = copy(unit.sylls);
  sy[k][1] = Math.max(t, sy[k][0] + MIN);
  ripple(sy, k);
  return { ...unit, sylls: tidy(sy), checked: true };
}

// Moves a start, an end, or both of an object with a time range, such as
// { t0, t1 } or { t, t1 }. `keys` names the two fields; lo..hi bounds the
// range. A point (no end field) only moves whole.
export function moveRange(obj, part, dt, { keys = ['t0', 't1'], lo = 0, hi = Infinity, min = 0.1 } = {}) {
  const [ka, kb] = keys, a = obj[ka], b = obj[kb];
  const out = { ...obj };
  if (b == null || part === 'body') {
    const d = clamp(dt, lo - a, (b == null ? hi : hi - b));
    out[ka] = round(a + d);
    if (b != null) out[kb] = round(b + d);
  } else if (part === 'start') out[ka] = round(clamp(a + dt, lo, b - min));
  else out[kb] = round(clamp(b + dt, a + min, hi));
  return out;
}
