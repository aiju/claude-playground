// Scene list. Each scene starts at t0 and takes over from the previous one
// over `tr` seconds, using a transition style:
//   0 soak evenly · 1 wash in from the left · 2 flood from the top · 3 bloom from the centre
// `scene` picks the GLSL function (see glsl/scenes.js), `v` is its variant.
// `beats` are the moments a scene acts on, in song time (t, and t1 for
// something that takes a while); the shader gets the first four in order.
// Scenes and beats are anchored to the measured lyric timings in
// alignment.js (the syllable a beat lands on is noted beside it).

export const DURATION = 257.8;
export const BPM = 136;

export const SCENES = [
  { name: 'Singing bowl', t0: 0.0, scene: 0, tr: 0,
    beats: [{ t: 0.2, label: 'bowl ring' }, { t: 3.8, label: 'bowl ring' }, { t: 7.4, label: 'bowl ring' }, { t: 11.0, label: 'bowl ring' }] },
  { name: 'Prajñā', t0: 13.0, scene: 1, tr: 1.5, style: 0 },
  { name: 'Descent', t0: 21.6, scene: 2, tr: 1.2, style: 3 },
  { name: 'Sea floor', t0: 34.3, scene: 3, tr: 2.0, style: 2 },
  { name: 'The eye opens', t0: 42.6, scene: 4, tr: 1.2, style: 3,
    beats: [{ t: 45.5, t1: 48.4, label: 'eye opens on 目を開く' }, { t: 46.6, t1: 50.0, label: 'ink runs from the lid' }] },
  { name: 'Wind and sand', t0: 48.9, scene: 5, tr: 1.5, style: 1 },
  { name: 'Five lights', t0: 55.2, scene: 6, tr: 1.5, style: 3,
    beats: [{ t: 59.1, t1: 66.0, label: 'lights come undone on ほどけてゆく' }] },
  { name: 'Full and empty', t0: 64.4, scene: 7, tr: 1.0, style: 0,
    beats: [{ t: 68.2, t1: 69.8, label: 'bowl fills on 満ちて' }, { t: 71.2, t1: 73.8, label: 'bowl drains on 空っぽで' }, { t: 76.2, t1: 78.9, label: 'indigo rinses away' }] },
  { name: 'Form is emptiness', t0: 78.9, scene: 8, tr: 0.6, style: 3,
    beats: [{ t: 78.9, t1: 80.3, label: 'blot bursts open' }] },
  { name: 'Universe in a palm', t0: 89.0, scene: 9, tr: 1.5, style: 0 },
  { name: 'Wheel of light', t0: 94.2, scene: 10, tr: 1.5, style: 3,
    beats: [{ t: 93.7, t1: 96.2, label: 'wheel petals open' }] },
  { name: 'Shakuhachi & taiko', t0: 109.5, scene: 11, tr: 1.2, style: 1,
    beats: [{ t: 110.3, t1: 128.5, label: 'shakuhachi breath drifts across' }] },
  { name: 'Chains, upside down', t0: 128.6, scene: 12, tr: 1.5, style: 2,
    beats: [{ t: 141.6, t1: 145.5, label: 'chain links dissolve on 溶けてゆく' }] },
  { name: 'The far shore', t0: 143.2, scene: 13, tr: 2.0, style: 1,
    beats: [{ t: 147.4, t1: 150.6, label: 'riser: light pulls upward' }] },
  { name: 'Neither / nor', t0: 150.5, scene: 14, tr: 0.8, style: 0,
    beats: [{ t: 150.6, label: '不生不滅 pair' }, { t: 154.3, label: '不垢不浄 pair' }, { t: 157.7, t1: 161.2, label: '不増不減 pair' }] },
  { name: 'Crossing', t0: 161.1, scene: 15, tr: 0.6, style: 1,
    beats: [{ t: 161.2, t1: 168.4, label: 'boat crosses, sky warms' }] },
  { name: 'The other shore', t0: 168.4, scene: 16, tr: 0.8, style: 3,
    beats: [{ t: 168.5, t1: 174.5, label: 'sun rises' }, { t: 169.0, t1: 174.0, label: 'lotus opens' }] },
  { name: 'Form is emptiness II', t0: 182.6, scene: 8, v: 1, tr: 1.2, style: 3,
    beats: [{ t: 182.6, t1: 184.0, label: 'blot bursts open' }] },
  { name: 'Unravelling', t0: 192.3, scene: 18, tr: 1.5, style: 1,
    beats: [{ t: 193.3, t1: 198.2, label: 'figure comes undone on 風に…ほどける' }] },
  { name: 'Wheel of light II', t0: 198.0, scene: 10, v: 1, tr: 1.5, style: 3,
    beats: [{ t: 197.5, t1: 200.0, label: 'wheel petals open' }] },
  // provisional: the wordless stretch after the final chorus (see OUTLINE.md)
  { name: 'Ensō', t0: 212.0, scene: 20, tr: 3.0, style: 0,
    beats: [{ t: 213.0, t1: 223.5, label: 'ensō is brushed, slowly, over the vocalise' }] },
];

// The song's sections, from the measured lyric timings.
export const SECTIONS = [
  { t0: 0.0, name: 'Intro' },
  { t0: 35.5, name: 'Verse 1' },
  { t0: 64.5, name: 'Pre-chorus' },
  { t0: 78.9, name: 'Chorus' },
  { t0: 104.0, name: 'Instrumental' },
  { t0: 128.8, name: 'Vocalise' },
  { t0: 136.1, name: 'Verse 2' },
  { t0: 150.5, name: 'Bridge' },
  { t0: 161.2, name: 'Build' },
  { t0: 168.4, name: 'Climax' },
  { t0: 182.7, name: 'Final chorus' },
  { t0: 207.6, name: 'Vocalise' },
  { t0: 239.2, name: 'Outro' },
];

// Every beat, for the timing checker; plus the fade at the very end.
export const MOMENTS = [
  ...SCENES.flatMap(s => (s.beats || []).map(b => ({ ...b, scene: s.name }))),
  { t: DURATION - 2.5, t1: DURATION, label: 'fade to paper' },
];

// A scene's first four beats in its own time, as the shader wants them:
// [starts, ends], each four numbers.
export function beatsOf(scene) {
  const starts = [1e4, 1e4, 1e4, 1e4], ends = [1e4, 1e4, 1e4, 1e4];
  (scene.beats || []).slice(0, 4).forEach((b, i) => { starts[i] = b.t - scene.t0; ends[i] = (b.t1 ?? b.t) - scene.t0; });
  return [starts, ends];
}

// Which scene(s) are on screen at time t, and how far the transition has got.
export function sceneAt(t) {
  let i = 0;
  while (i + 1 < SCENES.length && SCENES[i + 1].t0 <= t) i++;
  const cur = SCENES[i];
  const prev = SCENES[i - 1];
  if (prev && cur.tr > 0 && t < cur.t0 + cur.tr) {
    return { a: prev, b: cur, mix: (t - cur.t0) / cur.tr, index: i };
  }
  return { a: cur, b: null, mix: 0, index: i };
}

// Fade in from blank paper at the start, back to paper at the end.
export function fadeAt(t) {
  const a = Math.min(1, Math.max(0, t / 1.5));
  const b = Math.min(1, Math.max(0, (DURATION - t) / 2.5));
  return Math.min(a, b);
}
