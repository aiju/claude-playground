// Every timing the editor can change, as plain JSON, read from and written
// into the objects the video itself uses (CUES, SCENES, SECTIONS,
// OTHER_SINGING). The timing editor stores and undoes edits in this form,
// and tools/apply-timing.mjs writes it back into the source files.
//
// The values are split into units, and an edit replaces whole units:
//   line:<key>    { t0, t1, sylls: [[start, end], ...], checked }  a lyric line
//                 (deco and seal lines have only t0 and t1)
//   scene:<name>  { t0, tr, beats: [{ t, t1 }, ...] }  beats keep their order
//   sections      [{ t0, name }, ...]
//   other         [{ t, t1, label }, ...]  singing that isn't a lyric line

import { CUES } from './lyrics.js';
import { SCENES, SECTIONS } from './timeline.js';
import { OTHER_SINGING } from './alignment.js';
import { scheduleCue } from './schedule.js';

export const round = x => Math.round(x * 100) / 100;
const clone = v => JSON.parse(JSON.stringify(v));

const cueByKey = new Map(CUES.map(c => [c.key, c]));
const sceneByName = new Map(SCENES.map(s => [s.name, s]));
export const sung = cue => !cue.deco && !cue.seal;
export const cueOf = key => cueByKey.get(key);
export const sceneOf = name => sceneByName.get(name);

export function unitIds() {
  return [...CUES.map(c => `line:${c.key}`), ...SCENES.map(s => `scene:${s.name}`), 'sections', 'other'];
}

export function getUnit(id) {
  if (id.startsWith('line:')) {
    const cue = cueByKey.get(id.slice(5));
    if (!sung(cue)) return { t0: cue.t0, t1: cue.t1 };
    const sylls = scheduleCue(cue).syllables.map(y => [y.t0, y.t1]);
    return { t0: cue.t0, t1: cue.t1, sylls, checked: !!(cue.align && cue.align.checked) };
  }
  if (id.startsWith('scene:')) {
    const s = sceneByName.get(id.slice(6));
    return { t0: s.t0, tr: s.tr, beats: (s.beats || []).map(b => (b.t1 != null ? { t: b.t, t1: b.t1 } : { t: b.t })) };
  }
  if (id === 'sections') return clone(SECTIONS);
  if (id === 'other') return clone(OTHER_SINGING);
  throw new Error(`no timing unit ${id}`);
}

export function setUnit(id, v) {
  if (id.startsWith('line:')) {
    const cue = cueByKey.get(id.slice(5));
    if (!cue) return false;
    cue.t0 = v.t0;
    cue.t1 = v.t1;
    if (v.sylls && sung(cue)) {
      cue.sylls = clone(v.sylls);
      delete cue.sing;
      if (cue.align) cue.align.checked = !!v.checked;
    }
    delete cue._sched;    // schedule.js caches syllable times,
    delete cue._layout;   // text.js the writing times
    return true;
  }
  if (id.startsWith('scene:')) {
    const s = sceneByName.get(id.slice(6));
    if (!s) return false;
    s.t0 = v.t0;
    s.tr = v.tr;
    (s.beats || []).forEach((b, i) => {
      const nb = v.beats && v.beats[i];
      if (!nb) return;
      b.t = nb.t;
      if (b.t1 != null && nb.t1 != null) b.t1 = nb.t1;
    });
    return true;
  }
  if (id === 'sections') { SECTIONS.splice(0, SECTIONS.length, ...clone(v)); return true; }
  if (id === 'other') { OTHER_SINGING.splice(0, OTHER_SINGING.length, ...clone(v)); return true; }
  return false;
}

// All units: { lines: { key: unit }, scenes: { name: unit }, sections, other }
export function getValues() {
  return {
    lines: Object.fromEntries(CUES.map(c => [c.key, getUnit(`line:${c.key}`)])),
    scenes: Object.fromEntries(SCENES.map(s => [s.name, getUnit(`scene:${s.name}`)])),
    sections: getUnit('sections'),
    other: getUnit('other'),
  };
}

export const unitsOf = values => [
  ...Object.entries(values.lines || {}).map(([k, v]) => [`line:${k}`, v]),
  ...Object.entries(values.scenes || {}).map(([k, v]) => [`scene:${k}`, v]),
  ...(values.sections ? [['sections', values.sections]] : []),
  ...(values.other ? [['other', values.other]] : []),
];

// Applies every unit in `values`; returns the ids it didn't recognise.
export function setValues(values) {
  const unknown = [];
  for (const [id, v] of unitsOf(values)) if (!setUnit(id, v)) unknown.push(id);
  return unknown;
}
