// Builds the soundtrack off the main thread, so the player can show pictures
// while the sound is being made.

import { buildTimeline } from '../timeline.js';
import { makeShots } from '../scenes/index.js';
import { buildSoundtrack } from './soundtrack.js';

self.onmessage = ({ data: { manifest, clips } }) => {
  try {
    const T = buildTimeline(manifest);
    const stems = buildSoundtrack({ T, shots: makeShots(T), clips });
    self.postMessage({ stems }, [stems.voice.buffer, stems.sfx.buffer, stems.music.buffer]);
  } catch (e) {
    self.postMessage({ error: `${e.message}\n${e.stack}` });
  }
};
