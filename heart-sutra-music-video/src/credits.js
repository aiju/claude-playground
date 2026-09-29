// The credits: a moment of silence on bare paper after the song, the names
// soaking in like the lyrics do. Set in the lyrics' brush font, which
// tools/fetch-fonts.mjs subsets to these characters as well.
//   y: centre of the line, 0..1 from the top · size: fraction of the height
//   at: seconds after the song ends · spacing: letter spacing in ems

import { SONG_END } from './timeline.js';

export const CREDITS = [
  { text: 'Emily @the_aiju', y: 0.45, size: 0.044, ink: 'sumi', at: 0.0 },
  { text: 'Claude', y: 0.535, size: 0.044, ink: 'sumi', at: 0.15 },
  { text: 'stroke order from KanjiVG (Ulrich Apel, CC BY-SA 3.0) · lyrics aligned with Whisper and MMS', y: 0.875, size: 0.017, ink: 'grey', at: 0.3, spacing: 0.04 },
  { text: 'fonts: Yuji Syuku by Kinuta Font Factory and Yatra One, under the SIL Open Font License', y: 0.905, size: 0.017, ink: 'grey', at: 0.3, spacing: 0.04 },
].map(l => ({ ...l, t0: SONG_END + l.at }));
