// The credits: a moment of silence on bare paper after the song, the names
// soaking in like the lyrics do. Set in the lyrics' brush font, which
// tools/fetch-fonts.mjs subsets to these characters as well.
//   y: centre of the line, 0..1 from the top · size: fraction of the height
//   at: seconds after the song ends · spacing: letter spacing in ems

import { SONG_END } from './timeline.js';

export const CREDITS = [
  { text: 'Emily @the_aiju', y: 0.4, size: 0.044, ink: 'sumi', at: 0.0 },
  { text: 'song & direction', y: 0.458, size: 0.022, ink: 'grey', at: 0.1, spacing: 0.08 },
  { text: 'Claude', y: 0.56, size: 0.044, ink: 'sumi', at: 0.15 },
  { text: 'visuals & code', y: 0.618, size: 0.022, ink: 'grey', at: 0.25, spacing: 0.08 },
  { text: 'stroke order from KanjiVG (Ulrich Apel, CC BY-SA 3.0) · lyrics aligned with Whisper and MMS', y: 0.875, size: 0.017, ink: 'grey', at: 0.35, spacing: 0.04 },
  { text: 'fonts: Yuji Syuku by Kinuta Font Factory and Yatra One, under the SIL Open Font License', y: 0.905, size: 0.017, ink: 'grey', at: 0.35, spacing: 0.04 },
].map(l => ({ ...l, t0: SONG_END + l.at }));
