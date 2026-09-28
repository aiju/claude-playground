// Scene list. Each scene starts at t0 and takes over from the previous one
// over `tr` seconds, using a transition style:
//   0 soak evenly · 1 wash in from the left · 2 flood from the top · 3 bloom from the centre
// `scene` picks the GLSL function (see glsl/scenes.js), `v` is its variant.

export const DURATION = 257.8;
export const BPM = 136;

export const SCENES = [
  { name: 'Singing bowl',        t0: 0.0,   scene: 0,  tr: 0 },
  { name: 'Prajñā',              t0: 11.0,  scene: 1,  tr: 1.5, style: 0 },
  { name: 'Descent',             t0: 21.6,  scene: 2,  tr: 1.2, style: 3 },
  { name: 'Sea floor',           t0: 36.8,  scene: 3,  tr: 2.0, style: 2 },
  { name: 'The eye opens',       t0: 42.8,  scene: 4,  tr: 1.2, style: 3 },
  { name: 'Wind and sand',       t0: 48.7,  scene: 5,  tr: 1.5, style: 1 },
  { name: 'Five lights',         t0: 55.0,  scene: 6,  tr: 1.5, style: 3 },
  { name: 'Full and empty',      t0: 68.3,  scene: 7,  tr: 1.0, style: 0 },
  { name: 'Form is emptiness',   t0: 79.0,  scene: 8,  tr: 0.6, style: 3 },
  { name: 'Universe in a palm',  t0: 91.0,  scene: 9,  tr: 1.5, style: 0 },
  { name: 'Wheel of light',      t0: 98.0,  scene: 10, tr: 1.5, style: 3 },
  { name: 'Shakuhachi & taiko',  t0: 107.5, scene: 11, tr: 1.2, style: 1 },
  { name: 'Chains, upside down', t0: 122.6, scene: 12, tr: 1.5, style: 2 },
  { name: 'The far shore',       t0: 136.5, scene: 13, tr: 2.0, style: 1 },
  { name: 'Neither / nor',       t0: 150.7, scene: 14, tr: 0.8, style: 0 },
  { name: 'Crossing',            t0: 169.0, scene: 15, tr: 1.0, style: 1 },
  { name: 'The other shore',     t0: 182.4, scene: 16, tr: 0.8, style: 3 },
  { name: 'Form is emptiness II', t0: 211.5, scene: 8, v: 1, tr: 1.5, style: 3 },
  { name: 'Unravelling',         t0: 223.8, scene: 18, tr: 1.5, style: 1 },
  { name: 'Wheel of light II',   t0: 230.5, scene: 10, v: 1, tr: 1.5, style: 3 },
  { name: 'Ensō',                t0: 240.5, scene: 20, tr: 2.0, style: 0 },
];

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
