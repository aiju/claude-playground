// When each syllable of a lyric line is sung (as far as the video assumes)
// and therefore when each character gets written. The video and the timing
// checker both read this, so what the checker shows is what the video does.
//
// Japanese lines carry their readings in brackets after each kanji:
// '深[ふか]き 智[ち]慧[え]の'. Sanskrit lines carry a hyphenated
// transcription in `roman`: 'praj-nya pa-ra-mi-ta'.
//
// Timing, in order of preference:
//   `sylls: [start1, start2, ..., startN, end]`  measured times for each
//     syllable (N + 1 numbers: every start, then when the last one ends);
//   `sing: [start, end]`  syllables spread evenly between the two;
//   neither: spread from the cue's start at SECONDS_PER_MORA each, with a
//     short rest at every space.

const SMALL = new Set('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ');
export const SECONDS_PER_MORA = 0.34;
const REST = 0.6;   // a space rests for this many syllables

// '深[ふか]き' -> [{ ch: '深', reading: 'ふか' }, { ch: 'き', reading: null }]
export function parseRuby(text) {
  const chars = [...text];
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    let reading = null;
    if (chars[i + 1] === '[') {
      const j = chars.indexOf(']', i + 2);
      reading = chars.slice(i + 2, j).join('');
      out.push({ ch: chars[i], reading });
      i = j;
    } else {
      out.push({ ch: chars[i], reading });
    }
  }
  return out;
}

// The text as it appears on screen, without readings.
export const plain = text => parseRuby(text).map(c => c.ch).join('');

// 'しょう' -> ['しょ', 'う']: small kana belong to the syllable before them.
export function splitMorae(kana) {
  const out = [];
  for (const c of kana) {
    if (SMALL.has(c) && out.length) out[out.length - 1] += c;
    else out.push(c);
  }
  return out;
}

// { s0, s1, glyphs: [{ ch, reading, morae, w0, w1 }], syllables: [{ text, t0, t1, glyph }] }
// glyphs are the characters drawn (spaces left out); a Sanskrit line is one
// glyph. w0..w1 is when a glyph is written; t0..t1 when a syllable is sung.
export function scheduleCue(cue) {
  if (cue._sched) return cue._sched;
  let glyphs;
  if (cue.script === 'sa') {
    glyphs = [{ ch: cue.text, reading: cue.roman, morae: (cue.roman || '').split(/[\s-]+/).filter(Boolean), gap: 0 }];
  } else {
    glyphs = [];
    let gap = 0;
    for (const { ch, reading } of parseRuby(cue.text)) {
      if (ch === ' ') { gap += REST; continue; }
      const morae = reading ? splitMorae(reading) : SMALL.has(ch) ? [] : [ch];
      glyphs.push({ ch, reading, morae, gap });
      gap = 0;
    }
  }
  const units = g => Math.max(0.5, g.morae.length);
  const total = glyphs.reduce((s, g) => s + g.gap + units(g), 0);
  let s0, s1;
  if (cue.seal) [s0, s1] = [cue.t0, cue.t0 + 0.15];
  else if (cue.sing) [s0, s1] = cue.sing;
  else [s0, s1] = [cue.t0, cue.t0 + Math.min(Math.max(0.6, 0.85 * (cue.t1 - cue.t0) - 0.3), total * SECONDS_PER_MORA)];
  const at = u => s0 + (s1 - s0) * u / total;

  const syllables = [];
  const count = glyphs.reduce((n, g) => n + g.morae.length, 0);
  if (cue.sylls && cue.sylls.length === count + 1) {
    // measured: every syllable has its own start; glyphs span their syllables
    let k = 0;
    glyphs.forEach((g, gi) => {
      const first = k;
      g.morae.forEach(m => { syllables.push({ text: m, t0: cue.sylls[k], t1: cue.sylls[k + 1], glyph: gi }); k++; });
      const a = cue.sylls[first], b = cue.sylls[Math.max(first + 1, k)];
      g.w0 = a;
      g.w1 = Math.max(a + 0.22, b);
    });
    return (cue._sched = { s0: cue.sylls[0], s1: cue.sylls[count], glyphs, syllables, measured: true });
  }
  let acc = 0;
  glyphs.forEach((g, gi) => {
    acc += g.gap;
    const a = acc, n = units(g);
    acc += n;
    g.w0 = at(a);
    g.w1 = Math.max(g.w0 + 0.22, at(acc));
    g.morae.forEach((m, k) => {
      syllables.push({ text: m, t0: at(a + n * k / g.morae.length), t1: at(a + n * (k + 1) / g.morae.length), glyph: gi });
    });
  });
  return (cue._sched = { s0, s1, glyphs, syllables });
}
