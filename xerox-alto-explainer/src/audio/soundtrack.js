// Builds the soundtrack as three mono stems: voice, effects and music. Runs
// in the browser (the player builds it at load) and in Node (mix.js), from
// the same timeline and scenes, so the preview sounds like the final video.

import { RATE, db, follow, limitTogether, room } from './dsp.js';
import * as instruments from './instruments.js';
import { TASK_SOUND } from './instruments.js';
import { musicClock, renderMusic } from './music.js';

export { RATE };

const VOICE_RMS = db(-19); // every line levelled to this loudness
const VOICE_PEAK = db(-2);
const FADE = Math.round(0.006 * RATE);
const MUSIC = db(-7); // the bed sits well under the voice

// clips: { N1: Float32Array, … } at RATE, as decoded from voice/*.mp3.
export function buildSoundtrack({ T, shots, clips }) {
  const n = Math.ceil(T.duration * RATE);
  const voice = new Float32Array(n);
  const sfx = new Float32Array(n);
  const music = new Float32Array(n);

  for (const l of Object.values(T.lines)) {
    const c = clips[l.id];
    const from = Math.round(l.clip.from * RATE);
    const to = Math.min(c.length, Math.round(l.clip.to * RATE));
    let ss = 0;
    let peak = 0;
    for (let i = from; i < to; i++) {
      ss += c[i] * c[i];
      peak = Math.max(peak, Math.abs(c[i]));
    }
    const gain = Math.min(VOICE_RMS / Math.sqrt(ss / (to - from)), VOICE_PEAK / peak);
    const at = Math.round((l.clip.from + l.clip.shift) * RATE) - from;
    for (let i = from; i < to; i++) {
      const j = at + i;
      if (j < 0 || j >= n) continue;
      const fade = Math.min(1, (i - from) / FADE, (to - 1 - i) / FADE);
      voice[j] += c[i] * gain * fade;
    }
  }

  // Scenes place their own effects, bound to the effects stem.
  const S = {};
  for (const [name, fn] of Object.entries(instruments)) if (typeof fn === 'function') S[name] = (...a) => fn(sfx, ...a);
  S.task = (name, t, dur, g) => TASK_SOUND[name](sfx, t, dur, g);
  const clock = musicClock(T);
  for (const shot of shots) if (shot.sounds !== false) shot.scene.sounds?.(S, T, shot, clock);

  renderMusic(music, T, clock);

  // A small dark room on the music. The effects stay dry, like the machine.
  const wet = room(music, { size: 0.6, gain: 0.22 });
  for (let i = 0; i < n; i++) music[i] += wet[i];

  // Duck the music while the narrator talks, and the effects a little.
  const env = follow(voice, { attack: 0.03, release: 0.4 });
  for (let i = 0; i < n; i++) {
    const talk = Math.min(1, env[i] / 0.12);
    music[i] *= MUSIC * (1 - 0.45 * talk);
    sfx[i] *= 1 - 0.3 * talk;
  }

  limitTogether([voice, sfx, music], { ceiling: -1 });
  return { voice, sfx, music };
}
