// Writes what goes up to YouTube next to the video: the two caption tracks,
// a description draft with chapters and credits, and the lyrics as text.
//
//   node tools/youtube-extras.mjs [dir]      # default out/youtube
//
// Captions are timed from the measured syllables (alignment.js): each line
// shows from its first syllable until a little after its last, or until the
// next line starts.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CUES } from '../src/lyrics.js';
import { plain } from '../src/schedule.js';
import { CAPTIONS } from '../src/captions.js';
import { SECTIONS, SONG_END } from '../src/timeline.js';

// Every sung line, in order, with its caption texts and when it shows.
export function captionLines() {
  const lines = CUES.filter(c => !c.deco && !c.seal && (c.sylls || c.sing)).map(c => {
    const base = c.key.replace(/#\d+$/, '');
    const cap = CAPTIONS[base];
    if (!cap) throw new Error(`captions.js has no entry for "${base}"`);
    return {
      start: c.sylls ? c.sylls[0][0] : c.sing[0],
      sungEnd: c.sylls ? c.sylls[c.sylls.length - 1][1] : c.sing[1],
      ja: cap.ja ?? (c.script === 'sa' ? cap.roman : plain(c.text)),
      roman: cap.roman,
      en: cap.en,
    };
  }).sort((a, b) => a.start - b.start);
  lines.forEach((l, i) => {
    const next = lines[i + 1];
    let end = Math.max(l.sungEnd + 0.6, l.start + 1.2);
    if (next) end = Math.min(end, next.start - 0.05);
    l.end = Math.max(end, l.start + 0.3);
  });
  return lines;
}

const stamp = s => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = (lines, text) => lines.map((l, i) => `${i + 1}\n${stamp(l.start)} --> ${stamp(l.end)}\n${text(l)}\n`).join('\n');

// YouTube chapters: from 0:00, each at least 10 s long, so a section
// shorter than that is folded into the one before it.
export function chapters() {
  const out = [];
  SECTIONS.forEach((s, i) => {
    const end = SECTIONS[i + 1] ? SECTIONS[i + 1].t0 : SONG_END;
    if (out.length && end - s.t0 < 10) return;
    out.push({ t: out.length ? Math.floor(s.t0) : 0, name: s.name });
  });
  return out;
}
const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export async function writeExtras(dir = 'out/youtube', name = 'heart-sutra') {
  await mkdir(dir, { recursive: true });
  const lines = captionLines();
  await writeFile(`${dir}/${name}.ja.srt`, srt(lines, l => l.ja));
  await writeFile(`${dir}/${name}.en.srt`, srt(lines, l => `<i>${l.roman}</i>\n${l.en}`));
  // the lyrics once each, in the order they're first sung
  const seen = new Set();
  const sheet = lines.filter(l => !seen.has(l.roman) && seen.add(l.roman)).map(l => [l.ja, l.roman !== l.ja && l.roman, l.en].filter(Boolean).join('\n')).join('\n\n');
  await writeFile(`${dir}/lyrics.txt`, `${sheet}\n`);
  await writeFile(`${dir}/description.txt`, [
    chapters().map(c => `${clock(c.t)} ${c.name}`).join('\n'),
    'Emily (@the_aiju) · Claude',
    [
      'Stroke order data from KanjiVG (https://kanjivg.tagaini.net), © Ulrich Apel and contributors, CC BY-SA 3.0',
      'Fonts: Yuji Syuku by Kinuta Font Factory and Yatra One, under the SIL Open Font License',
      'Lyrics aligned with Whisper and MMS',
    ].join('\n'),
    'Subtitles: Japanese, and English with the lyrics romanized.',
  ].join('\n\n') + '\n');
  return [`${name}.ja.srt`, `${name}.en.srt`, 'lyrics.txt', 'description.txt'].map(f => `${dir}/${f}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await writeExtras(process.argv[2]);
  console.log(files.map(f => `wrote ${f}`).join('\n'));
}
