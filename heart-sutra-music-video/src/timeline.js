// Scene list. Each scene starts at t0 and takes over from the previous one
// over `tr` seconds, using a transition style:
//   0 soak evenly · 1 wash in from the left · 2 flood from the top · 3 bloom from the centre
// `scene` picks the GLSL function (see glsl/scenes.js), `v` is its variant.
// `beats` are the moments a scene acts on, in song time (t, and t1 for
// something that takes a while); the shader gets the first four in order.
// Scenes and beats are anchored to the lyric timings in alignment.js,
// corrected by ear; a beat's label says what happens and on which words.

export const DURATION = 257.8;
export const BPM = 136;

export const SCENES = [
  { name: 'Singing bowl', t0: 0.0, scene: 0, tr: 0,
    beats: [{ t: 0.2, label: 'bowl ring' }, { t: 3.8, label: 'bowl ring' }, { t: 7.4, label: 'bowl ring' }, { t: 11.0, label: 'bowl ring' }] },
  // one continuous shot from the stupa into the sea
  { name: 'Prajñā and the descent', t0: 13.7, scene: 2, tr: 1.5, style: 0,
    beats: [{ t: 14.34, t1: 20.79, label: 'a stupa rises out of the fold on प्रज्ञापारमिता ×2' },
      { t: 19.3, t1: 22.4, label: 'the water comes down from above, fading in to full strength by 0:20; the stupa melts; the jellyfish rises from below' },
      { t: 22.4, t1: 27.3, label: 'sinking fast past the surface light' }, { t: 27.3, t1: 34.8, label: 'the choir chant: the shoal speeds up and swims off the top' }] },
  { name: 'Sea floor', t0: 34.8, scene: 3, tr: 2.0, style: 2 },
  { name: 'The eye opens', t0: 42.4, scene: 4, tr: 1.2, style: 3,
    beats: [{ t: 42.7, t1: 44.53, label: 'upper lid painted on 観る者は' }, { t: 44.53, t1: 46.3, label: 'lower lid painted on 静かに' },
            { t: 46.3, t1: 48.98, label: 'eye opens on 目を開く' }, { t: 47.2, t1: 50.6, label: 'ink runs from the lid' }] },
  { name: 'Wind and sand', t0: 49.4, scene: 5, tr: 1.5, style: 1 },
  { name: 'Five lights', t0: 55.9, scene: 6, tr: 1.5, style: 3,
    beats: [{ t: 60.17, t1: 64.4, label: 'lights come undone on 解けてゆく' }] },
  { name: 'Full and empty', t0: 64.45, scene: 7, tr: 1.0, style: 0,
    beats: [{ t: 68.4, t1: 71.0, label: 'the moon waxes full on 満ちて' }, { t: 71.58, t1: 75.08, label: 'and wanes to nothing on 空っぽで' }, { t: 75.42, t1: 78.97, label: 'indigo rinses away' }] },
  { name: 'Form is emptiness', t0: 78.9, scene: 8, tr: 0.6, style: 3,
    beats: [{ t: 78.97, t1: 80.4, label: 'blot bursts open' }, { t: 82.7, t1: 84.2, label: 'unfolds again on 空即是色' }] },
  { name: 'Universe in a palm', t0: 89.1, scene: 9, tr: 1.5, style: 0,
    beats: [{ t: 92.5, t1: 95.2, label: 'the galaxy wells up on 宇宙が透ける' }] },
  { name: 'Wheel of light', t0: 94.8, scene: 10, tr: 1.5, style: 3,
    beats: [{ t: 95.21, t1: 97.9, label: 'wheel petals open' }] },
  { name: 'Shakuhachi & taiko', t0: 108.2, scene: 11, tr: 1.2, style: 1,
    beats: [{ t: 109.3, t1: 111.2, label: 'shakuhachi breath (drums rest)' }, { t: 113.0, t1: 114.85, label: 'shakuhachi breath (drums rest)' },
      { t: 116.7, t1: 118.45, label: 'shakuhachi breath (drums rest)' }, { t: 118.45, t1: 121.9, label: 'drums all the way through' }] },
  { name: 'Cranes over the mountains', t0: 121.9, scene: 17, tr: 1.6, style: 0,
    beats: [{ t: 122.0, t1: 128.8, label: 'cranes cross on the long held note' }] },
  { name: 'Chains, upside down', t0: 128.6, scene: 12, tr: 1.5, style: 2,
    beats: [{ t: 141.62, t1: 143.35, label: 'chain links dissolve on 溶けてゆく' }] },
  { name: 'The far shore', t0: 143.0, scene: 13, tr: 1.6, style: 1,
    beats: [{ t: 147.44, t1: 150.57, label: 'riser: light pulls upward' }] },
  { name: 'Neither / nor', t0: 150.5, scene: 14, tr: 0.8, style: 0,
    beats: [{ t: 150.61, label: '不生不滅 pair' }, { t: 154.26, label: '不垢不浄 pair' }, { t: 157.68, t1: 161.35, label: '不増不減 pair' }] },
  { name: 'Crossing', t0: 161.2, scene: 15, tr: 0.6, style: 1,
    beats: [{ t: 161.35, t1: 168.4, label: 'boat crosses, sky warms' }] },
  { name: 'The other shore', t0: 168.35, scene: 16, tr: 0.8, style: 3,
    beats: [{ t: 168.47, t1: 174.5, label: 'sun rises' }, { t: 169.0, t1: 174.0, label: 'lotus opens' }] },
  { name: 'Form is emptiness II', t0: 182.65, scene: 8, v: 1, tr: 1.2, style: 3,
    beats: [{ t: 182.76, t1: 184.2, label: 'blot bursts open' }, { t: 186.25, t1: 187.8, label: 'unfolds again on 空即是色' }] },
  { name: 'Unravelling', t0: 192.3, scene: 18, tr: 1.5, style: 1,
    beats: [{ t: 193.35, t1: 198.41, label: 'figure comes undone on 風に…解ける' }] },
  { name: 'Wheel of light II', t0: 198.3, scene: 10, v: 1, tr: 1.5, style: 3,
    beats: [{ t: 198.74, t1: 201.5, label: 'wheel petals open' }] },
  // the wordless stretch after the final chorus (see OUTLINE.md)
  { name: 'Ensō', t0: 212.0, scene: 20, tr: 3.0, style: 0,
    beats: [{ t: 213.0, t1: 223.5, label: 'ensō is brushed, slowly, over the vocalise' }] },
];

// The song's sections, from the lyric timings.
export const SECTIONS = [
  { t0: 0.0, name: 'Intro' },
  { t0: 35.8, name: 'Verse 1' },
  { t0: 64.5, name: 'Pre-chorus' },
  { t0: 78.9, name: 'Chorus' },
  { t0: 108.0, name: 'Instrumental' },
  { t0: 128.8, name: 'Vocalise' },
  { t0: 136.1, name: 'Verse 2' },
  { t0: 150.5, name: 'Bridge' },
  { t0: 161.3, name: 'Build' },
  { t0: 168.4, name: 'Climax' },
  { t0: 182.7, name: 'Final chorus' },
  { t0: 212.0, name: 'Vocalise' },
  { t0: 239.2, name: 'Outro' },
];

// Every beat, for the timing editor; plus the fade at the very end. A
// function, because the timing editor moves beats while it runs.
export function moments() {
  return [
    ...SCENES.flatMap(s => (s.beats || []).map((b, i) => ({ ...b, scene: s.name, beat: i }))),
    { t: DURATION - 2.5, t1: DURATION, label: 'fade to paper' },
  ];
}

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
