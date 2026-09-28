// The timing editor: plays the song under a scrolling view of every
// syllable, lyric line, scene and scripted moment where the video currently
// puts them, over a spectrogram of the actual audio, and lets you move them
// by ear. Everything comes from the same modules the video uses, and edits
// change those same objects (through edits.js), so it shows exactly what
// the video will do. Edits are kept, with their history, by edit-store.js.

import { CUES } from './lyrics.js';
import { scheduleCue, plain } from './schedule.js';
import { SCENES, SECTIONS, moments, DURATION } from './timeline.js';
import { OTHER_SINGING } from './alignment.js';
import { loadAudio, analyse } from './audio.js';
import { spectrogram } from './spectrogram.js';
import { getValues, getUnit, setUnit, sung, sceneOf } from './edits.js';
import { moveSylls, shiftLine, tapStart, tapEnd, moveRange } from './edit-ops.js';
import { EditStore } from './edit-store.js';

const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function fmt(t, dp = 2) {
  t = Math.max(0, t);
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(dp).padStart(dp ? dp + 3 : 2, '0')}`;
}
const signed = d => `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)} s`;
const short = (s, n = 14) => ([...s].length > n ? `${[...s].slice(0, n - 1).join('')}…` : s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const local = {
  get(k, d) { try { const v = localStorage.getItem(`heart-sutra-${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`heart-sutra-${k}`, JSON.stringify(v)); } catch { /* private window */ } },
};

// ---------------------------------------------------------------- data

// the values in the source files, before any edits
const ORIGINAL = getValues();

const LINES = CUES.filter(c => !c.deco).map((cue, i) => ({ i, cue, key: cue.key, text: plain(cue.text), sa: cue.script === 'sa', row: 0, s: null }));
const DECO = CUES.filter(c => c.deco);
let SYLL = [], EVENTS = [];
const eventRows = new Map();
const LINE_ROW = 22, SYL_ROW = 42;

function packRows() {
  const ends = [];
  for (const L of [...LINES].sort((a, b) => a.cue.t0 - b.cue.t0)) {
    let r = 0;
    while (ends[r] !== undefined && ends[r] > L.cue.t0 - 0.05) r++;
    ends[r] = L.cue.t1;
    L.row = r;
  }
  LINES.rows = ends.length;
}

// Rebuilds what's drawn from the (possibly edited) timings. Rows are only
// repacked when an edit is done, so nothing jumps about during a drag.
function refresh(rows = false) {
  for (const L of LINES) L.s = scheduleCue(L.cue);
  SYLL = LINES.flatMap(L => L.s.syllables.map((y, k) => ({ ...y, k, line: L })));
  EVENTS = [
    ...moments().map(m => ({ ...m, id: m.scene != null ? `beat:${m.scene}:${m.beat}` : 'fade' })),
    // the skandha kanji inside the five lights are written, not sung: show them as moments
    ...DECO.map(c => ({ t: c.t0, t1: c.t1, label: `${plain(c.text)} written in a light`, cue: c, id: `deco:${c.key}` })),
  ].sort((a, b) => a.t - b.t);
  EVENTS.forEach((e, i) => {
    if (rows || !eventRows.has(e.id)) eventRows.set(e.id, i % 2);
    e.row = eventRows.get(e.id);
  });
  if (rows) {
    const before = LINES.rows;
    packRows();
    if (before !== undefined && before !== LINES.rows) layout();
  }
  if (loop && loop.line) { loop.a = Math.max(0, loop.line.s.s0 - 1); loop.b = Math.min(DURATION, loop.line.s.s1 + 1); }
}

// ---------------------------------------------------------------- audio clock
// Plays through an <audio> element (which can slow down without changing
// pitch); falls back to Web Audio if the element can't load the file.

const audioEl = $('song');
let buffer = null, vocals = null, features = null, spec = null;
let source = 'mix';   // or 'vocals'
const clock = {
  mode: null, rate: 1, playing: false,
  ctx: null, src: null, offset: 0, startedAt: 0,
  now() {
    if (this.mode === 'media') return audioEl.currentTime;
    return this.playing ? this.offset + (this.ctx.currentTime - this.startedAt) * this.rate : this.offset;
  },
  play() {
    if (this.mode === 'media') { audioEl.play(); }
    else if (this.mode === 'webaudio') {
      this.ctx = this.ctx || new AudioContext();
      if (this.offset >= DURATION - 0.05) this.offset = 0;
      this.src = this.ctx.createBufferSource();
      this.src.buffer = source === 'vocals' && vocals ? vocals : buffer;
      this.src.playbackRate.value = this.rate;
      this.src.connect(this.ctx.destination);
      this.src.start(0, this.offset);
      this.startedAt = this.ctx.currentTime;
    } else return;
    this.playing = true;
  },
  pause() {
    stopTicks();
    if (!this.playing) return;
    if (this.mode === 'media') audioEl.pause();
    else { this.offset = this.now(); this.src.stop(); }
    this.playing = false;
  },
  seek(t) {
    stopTicks();
    t = clamp(t, 0, DURATION);
    if (this.mode === 'media') { audioEl.currentTime = t; return; }
    const was = this.playing;
    if (was) this.pause();
    this.offset = t;
    if (was) this.play();
  },
  setRate(r) {
    stopTicks();
    if (this.mode === 'webaudio' && this.playing) { this.offset = this.now(); this.startedAt = this.ctx.currentTime; if (this.src) this.src.playbackRate.value = r; }
    this.rate = r;
    audioEl.playbackRate = r;
  },
};
audioEl.preservesPitch = true;
audioEl.addEventListener('ended', () => { clock.playing = false; });
audioEl.addEventListener('pause', () => { if (clock.mode === 'media') clock.playing = false; });
audioEl.addEventListener('play', () => { if (clock.mode === 'media') clock.playing = true; });

function mediaReady() {
  return new Promise(resolve => {
    if (audioEl.readyState >= 2) return resolve(audioEl.seekable.length > 0 && audioEl.seekable.end(audioEl.seekable.length - 1) > DURATION - 5);
    // only use the element if it can seek anywhere in the song (the host has
    // to support range requests); otherwise play from the decoded buffer
    const seekable = () => audioEl.seekable.length > 0 && audioEl.seekable.end(audioEl.seekable.length - 1) > DURATION - 5;
    const done = ok => { clearTimeout(timer); resolve(ok && seekable()); };
    const timer = setTimeout(() => done(false), 8000);
    audioEl.addEventListener('canplay', () => done(true), { once: true });
    audioEl.addEventListener('error', () => done(false), { once: true });
    audioEl.load();
  });
}

// ---------------------------------------------------------------- clicks at syllable onsets
// A short tick at every syllable onset, over the song, to hear whether the
// timing is early or late.

const ticks = { on: local.get('clicks', false), until: -1, nodes: [] };
function tickCtx() {
  clock.ctx = clock.ctx || new AudioContext();
  if (clock.ctx.state === 'suspended') clock.ctx.resume();
  return clock.ctx;
}
function stopTicks() {
  for (const n of ticks.nodes) { try { n.stop(); } catch { /* already done */ } }
  ticks.nodes = [];
  ticks.until = -1;
}
function scheduleTicks() {
  if (!ticks.on || !clock.playing || !clock.mode) { if (ticks.until >= 0) stopTicks(); return; }
  const ctx = tickCtx(), now = clock.now(), rate = clock.rate;
  if (ticks.until < now - 0.05 || ticks.until > now + 1) ticks.until = now;
  const horizon = now + 0.25 * rate;
  for (const s of SYLL) {
    if (s.t0 <= ticks.until || s.t0 > horizon) continue;
    const at = ctx.currentTime + (s.t0 - now) / rate;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = s.k === 0 ? 1320 : 2200;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.28, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.045);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.05);
    ticks.nodes.push(osc);
    osc.onended = () => { ticks.nodes = ticks.nodes.filter(n => n !== osc); };
  }
  ticks.until = horizon;
}

// ---------------------------------------------------------------- view state

const ZOOMS = [1.5, 3, 5, 8, 12, 20, 30, 60, 120, 260];
let zoom = 4;               // index into ZOOMS
let viewT0 = -1;
let follow = true;
let loop = null;            // { a, b, line }
let hover = null;           // { x, y, t, hit }
const span = () => ZOOMS[zoom];

// ---------------------------------------------------------------- colours

let C = {};
let specChunks = null;      // the spectrogram drawn into canvases, per theme
function readColours() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['bg', 'surface', 'ink', 'ink-2', 'ink-3', 'rule', 'band-a', 'band-b', 'hover', 'ja', 'sa', 'moment', 'loop', 'ja-soft', 'sa-soft', 'sel', 'sans', 'mono', 'deva']) {
    C[k] = cs.getPropertyValue(`--${k}`).trim();
  }
  specChunks = null;
}
readColours();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColours);
new MutationObserver(readColours).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

// ---------------------------------------------------------------- layout

const roll = $('roll'), ctx = roll.getContext('2d');
const over = $('overview'), octx = over.getContext('2d');
let W = 0, H = 0, LW = 0, lanes = {};

function layout() {
  const w = roll.parentElement.clientWidth;
  LW = w < 640 ? 0 : 118;
  const defs = [
    ['ruler', 22, ''],
    ['sections', 20, 'Section'],
    ['scenes', 20, 'Scene'],
    ['moments', 40, 'Moments'],
    ['other', 20, 'Other singing'],
    ['lines', LINES.rows * LINE_ROW, 'Lines'],
    ['syll', LINES.rows * SYL_ROW, 'Syllables'],
    ['spec', 128, 'Audio'],
    ['hits', 38, 'Drums · level'],
  ];
  let y = 0;
  const specLabel = lanes.spec && lanes.spec.label;
  lanes = {};
  for (const [id, h, label] of defs) { lanes[id] = { y, h, label }; y += h + (id === 'ruler' ? 2 : 6); }
  if (specLabel) lanes.spec.label = specLabel;
  W = w; H = y;
  const dpr = devicePixelRatio || 1;
  roll.width = Math.round(W * dpr); roll.height = Math.round(H * dpr);
  roll.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  over.width = Math.round(over.clientWidth * dpr); over.height = Math.round(44 * dpr);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
refresh(true);
new ResizeObserver(layout).observe(roll.parentElement);
layout();

const xOf = t => LW + (t - viewT0) / span() * (W - LW);
const tOf = x => viewT0 + (x - LW) / (W - LW) * span();
const pxPerS = () => (W - LW) / span();

// ---------------------------------------------------------------- spectrogram image

function buildSpecChunks() {
  if (!spec) return null;
  const chunks = [];
  const ink = hexToRgb(C.ink);
  for (let f0 = 0; f0 < spec.frames; f0 += 4096) {
    const w = Math.min(4096, spec.frames - f0);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = spec.rows;
    const c = cv.getContext('2d');
    const img = c.createImageData(w, spec.rows);
    for (let x = 0; x < w; x++) {
      for (let r = 0; r < spec.rows; r++) {
        const v = spec.data[(f0 + x) * spec.rows + r] / 255;
        const o = (r * w + x) * 4;
        img.data[o] = ink[0]; img.data[o + 1] = ink[1]; img.data[o + 2] = ink[2];
        img.data[o + 3] = Math.pow(v, 1.6) * 235;
      }
    }
    c.putImageData(img, 0, 0);
    chunks.push({ cv, f0, w });
  }
  return chunks;
}
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ---------------------------------------------------------------- selection
// What's selected, and so what nudging, tapping and the selection bar act on:
//   { kind: 'sylls', items: [{ L, k }], part: 'body' | 'start' | 'end', whole }
//   { kind: 'shown', L, part }          when a line is on screen
//   { kind: 'scene', scene, part: 'start' | 'tr' }
//   { kind: 'beat', scene, i, part }
//   { kind: 'deco', cue, part }         a skandha kanji
//   { kind: 'section', i, part }
//   { kind: 'other', i, part }          singing that isn't a lyric line

let sel = null;
let selSylls = new Set();   // 'line index:k'
function select(s) {
  sel = s;
  selSylls = new Set(s && s.kind === 'sylls' ? s.items.map(({ L, k }) => `${L.i}:${k}`) : []);
}
const isSel = (L, k) => selSylls.has(`${L.i}:${k}`);
const glyphSylls = (L, gi) => L.s.syllables.map((y, k) => (y.glyph === gi ? k : -1)).filter(k => k >= 0);
const allSylls = L => L.s.syllables.map((y, k) => ({ L, k }));
const inOrder = () => [...LINES].filter(L => sung(L.cue)).sort((a, b) => a.s.s0 - b.s.s0);
function sylDesc(L, k) { return `${L.s.syllables[k].text} in ${short(L.text)}`; }

// the syllable after (or before) one, going on into the next line
function stepSyll(L, k, dir) {
  if (L.s.syllables[k + dir]) return { L, k: k + dir };
  const order = inOrder(), i = order.indexOf(L) + dir;
  const M = order[i];
  return M ? { L: M, k: dir > 0 ? 0 : M.s.syllables.length - 1 } : null;
}

// ---------------------------------------------------------------- edit operations
// makeOp turns a selection into an edit that can be applied for any time
// difference dt (recomputed from the starting values each time) and then
// committed to the store as one entry.

const store = new EditStore();
let editable = false;

function makeOp(tg, { alt = false } = {}) {
  if (!tg) return null;
  const before = {};
  const take = id => (before[id] = getUnit(id));
  const op = { before, moved: 0, label: '', focus: 0, readout: '' };
  switch (tg.kind) {
    case 'sylls': {
      const lines = new Map();
      for (const { L, k } of tg.items) { if (!lines.has(L)) lines.set(L, []); lines.get(L).push(k); }
      for (const L of lines.keys()) take(`line:${L.key}`);
      const [L0, ks0] = [...lines.entries()][0];
      op.apply = dt => {
        const move = (L, ks, d) => (tg.whole ? shiftLine(before[`line:${L.key}`], d, { withShown: !alt }) : moveSylls(before[`line:${L.key}`], ks, tg.part, d, { stick: !alt }));
        // every line moves by the same amount: the smallest any of them allows
        let d = dt;
        for (const [L, ks] of lines) { const m = move(L, ks, dt).moved; if (Math.abs(m) < Math.abs(d)) d = m; }
        for (const [L, ks] of lines) setUnit(`line:${L.key}`, move(L, ks, d).unit);
        op.moved = d;
        const sy = getUnit(`line:${L0.key}`).sylls, k = Math.min(...ks0);
        op.focus = tg.part === 'end' ? sy[k][1] : sy[k][0];
        const n = tg.items.length;
        const what = tg.whole ? `line ${short(L0.text)}` : tg.glyph ? `${tg.glyph} in ${short(L0.text)}` : n > 1 ? `${n} syllables in ${short(L0.text)}` : sylDesc(L0, k);
        op.label = tg.part === 'start' ? `start of ${what} ${signed(d)}` : tg.part === 'end' ? `end of ${what} ${signed(d)}` : `moved ${what} ${signed(d)}`;
        op.readout = `${tg.part === 'end' ? 'ends' : 'starts'} ${fmt(op.focus)} (${signed(d)})`;
      };
      break;
    }
    case 'shown': case 'deco': {
      const cue = tg.kind === 'shown' ? tg.L.cue : tg.cue, id = `line:${cue.key}`;
      take(id);
      op.apply = dt => {
        const v = before[id], nv = moveRange(v, tg.part, dt, { lo: 0, hi: DURATION, min: 0.2 });
        setUnit(id, { ...v, t0: nv.t0, t1: nv.t1 });
        op.moved = tg.part === 'end' ? nv.t1 - v.t1 : nv.t0 - v.t0;
        op.focus = tg.part === 'end' ? nv.t1 : nv.t0;
        const what = tg.kind === 'deco' ? `${plain(cue.text)} in its light` : short(plain(cue.text));
        op.label = `${tg.part === 'start' ? 'appears' : tg.part === 'end' ? 'goes' : 'on screen'}: ${what} ${signed(op.moved)}`;
        op.readout = `on screen ${fmt(nv.t0, 2)}–${fmt(nv.t1, 2)}`;
      };
      break;
    }
    case 'scene': {
      const id = `scene:${tg.scene.name}`, i = SCENES.indexOf(tg.scene);
      if (i === 0 && tg.part === 'start') return null;
      take(id);
      const prev = SCENES[i - 1], next = SCENES[i + 1];
      const end = next ? next.t0 : DURATION;
      op.apply = dt => {
        const v = before[id], nv = { ...v };
        if (tg.part === 'start') {
          nv.t0 = Math.round(clamp(v.t0 + dt, prev.t0 + 0.2, end - 0.2) * 100) / 100;
          nv.tr = Math.min(v.tr, Math.round((end - nv.t0) * 100) / 100);
          op.moved = nv.t0 - v.t0; op.focus = nv.t0;
          op.label = `scene ${tg.scene.name} starts ${signed(op.moved)}`;
          op.readout = `starts ${fmt(nv.t0)}`;
        } else {
          nv.tr = Math.round(clamp(v.tr + dt, 0, end - v.t0) * 100) / 100;
          op.moved = nv.tr - v.tr; op.focus = v.t0 + nv.tr;
          op.label = `handover into ${tg.scene.name} ${signed(op.moved)}`;
          op.readout = `handover ${nv.tr.toFixed(2)} s`;
        }
        setUnit(id, nv);
      };
      break;
    }
    case 'beat': {
      const id = `scene:${tg.scene.name}`;
      take(id);
      op.apply = dt => {
        const v = before[id], b = v.beats[tg.i];
        const nb = moveRange(b, tg.part, dt, { keys: ['t', 't1'], lo: 0, hi: DURATION, min: 0.05 });
        setUnit(id, { ...v, beats: v.beats.map((x, j) => (j === tg.i ? nb : x)) });
        op.moved = tg.part === 'end' ? nb.t1 - b.t1 : nb.t - b.t;
        op.focus = tg.part === 'end' ? nb.t1 : nb.t;
        op.label = `${tg.part === 'start' ? 'start of ' : tg.part === 'end' ? 'end of ' : ''}beat “${tg.scene.beats[tg.i].label}” ${signed(op.moved)}`;
        op.readout = nb.t1 != null ? `${fmt(nb.t)}–${fmt(nb.t1)}` : fmt(nb.t);
      };
      break;
    }
    case 'section': {
      if (tg.part !== 'start' || tg.i === 0) return null;
      take('sections');
      op.apply = dt => {
        const v = before.sections, s = v[tg.i];
        const t0 = Math.round(clamp(s.t0 + dt, v[tg.i - 1].t0 + 0.2, (v[tg.i + 1] ? v[tg.i + 1].t0 : DURATION) - 0.2) * 100) / 100;
        setUnit('sections', v.map((x, j) => (j === tg.i ? { ...x, t0 } : x)));
        op.moved = t0 - s.t0; op.focus = t0;
        op.label = `section ${s.name} starts ${signed(op.moved)}`;
        op.readout = `starts ${fmt(t0)}`;
      };
      break;
    }
    case 'other': {
      take('other');
      op.apply = dt => {
        const v = before.other, o = v[tg.i];
        const no = moveRange(o, tg.part, dt, { keys: ['t', 't1'], lo: 0, hi: DURATION, min: 0.1 });
        setUnit('other', v.map((x, j) => (j === tg.i ? no : x)));
        op.moved = tg.part === 'end' ? no.t1 - o.t1 : no.t - o.t;
        op.focus = tg.part === 'end' ? no.t1 : no.t;
        op.label = `other singing “${short(o.label, 24)}” ${signed(op.moved)}`;
        op.readout = `${fmt(no.t)}–${fmt(no.t1)}`;
      };
      break;
    }
    default: return null;
  }
  const apply = op.apply;
  op.apply = dt => { apply(dt); refresh(); return op.moved; };
  return op;
}

function commitOp(op, rows = true) {
  const changes = Object.keys(op.before).map(id => ({ id, before: op.before[id], after: getUnit(id) }));
  const e = store.commit(op.label, changes, op.focus);
  refresh(rows);
  renderHistory();
  return e;
}

// A one-off change to units: fn() changes them, and it's logged as one edit.
function change(ids, label, t, fn) {
  const before = Object.fromEntries(ids.map(id => [id, getUnit(id)]));
  fn(before);
  const e = store.commit(label, ids.map(id => ({ id, before: before[id], after: getUnit(id) })), t);
  refresh(true);
  renderHistory();
  return e;
}

// ---------------------------------------------------------------- replaying an edit

let replay = null;          // { until, timer }
function replayAt(t, delay = 0) {
  if (!$('replay').checked || !clock.mode) return;
  if (clock.playing && !replay) return;   // already listening
  if (replay && replay.timer) clearTimeout(replay.timer);
  replay = { until: Infinity, timer: setTimeout(() => {
    replay = { until: t + 1.2 };
    clock.seek(Math.max(0, t - 0.8));
    if (!clock.playing) clock.play();
  }, delay) };
}
// stops waiting to replay; with pause, also stops a replay that's playing
function cancelReplay(pause = false) {
  if (replay && replay.timer) clearTimeout(replay.timer);
  if (pause && replay && replay.until !== Infinity && clock.playing) clock.pause();
  replay = null;
}

// ---------------------------------------------------------------- drawing

let hits = [];   // hit boxes for hover, clicks and drags, rebuilt every frame

function text(str, x, y, { font = `11px ${C.sans}`, color = C['ink-2'], align = 'left', max = Infinity } = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (max < Infinity) {
    if (max < 12) return;
    let s = str;
    while (s.length > 1 && ctx.measureText(s).width > max) s = s.slice(0, -1);
    if (s !== str) s = s.slice(0, -1) + '…';
    if (s.length <= 1 && str.length > 1) return;
    str = s;
  }
  ctx.fillText(str, x, y);
}

function bands(lane, list, fill, labelOf, kind) {
  const { y, h } = lane;
  list.forEach((it, i) => {
    const a = xOf(it.t0), b = xOf(it.t1);
    if (b < LW || a > W) return;
    const x0 = Math.max(a, LW), x1 = Math.min(b, W);
    ctx.fillStyle = i % 2 ? C['band-a'] : C['band-b'];
    ctx.fillRect(x0, y, x1 - x0, h);
    if (fill) fill(it, a, b, y, h);
    text(labelOf(it), x0 + 5, y + h / 2, { max: x1 - x0 - 8, color: C['ink'] });
    hits.push({ x0, x1, y0: y, y1: y + h, kind, it, i });
  });
}

function hatch(a, b, y, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.max(a, LW), y, Math.max(0, Math.min(b, W) - Math.max(a, LW)), h);
  ctx.clip();
  ctx.strokeStyle = C['ink-3'];
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  for (let x = a - h; x < b + h; x += 5) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + h, y); ctx.stroke(); }
  ctx.restore();
}

// a selected edge, or the outline of a selected thing
function mark(x, y, h) { if (x >= LW - 2 && x <= W + 2) { ctx.fillStyle = C.sel; ctx.fillRect(Math.round(x) - 1, y - 2, 3, h + 4); } }
function outline(a, b, y, h) {
  const x0 = Math.max(a, LW), x1 = Math.min(b, W);
  if (x1 <= x0) return;
  ctx.strokeStyle = C.sel; ctx.lineWidth = 2;
  ctx.strokeRect(x0 + 1, y + 1, x1 - x0 - 2, h - 2);
}
const edgeX = (part, a, b) => (part === 'end' ? b : a);

function draw() {
  const t = clock.mode ? clock.now() : 0;
  if (follow && !(drag && drag.op)) viewT0 = clamp(t - span() * 0.3, -span() * 0.3, DURATION - span() * 0.7);
  hits = [];
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, W, H);
  const L = lanes;

  // ruler
  const pps = pxPerS();
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  const major = steps.find(s => s * pps >= 72) || 60;
  const minor = steps.slice().reverse().find(s => s < major && s * pps >= 9 && Math.abs(major / s - Math.round(major / s)) < 1e-6);
  ctx.fillStyle = C['ink-3'];
  if (minor) for (let s = Math.ceil(viewT0 / minor) * minor; s < viewT0 + span(); s += minor) ctx.fillRect(Math.round(xOf(s)), L.ruler.h - 4, 1, 4);
  for (let s = Math.ceil(viewT0 / major) * major; s < viewT0 + span(); s += major) {
    const x = Math.round(xOf(s));
    if (x < LW) continue;
    ctx.fillStyle = C['ink-3'];
    ctx.fillRect(x, L.ruler.h - 9, 1, 9);
    text(fmt(s, major < 1 ? 2 : major < 5 ? 1 : 0), x + 4, 9, { font: `10.5px ${C.mono}`, color: C['ink-2'] });
  }
  ctx.fillStyle = C.rule;
  ctx.fillRect(0, L.ruler.h, W, 1);

  // beat grid behind the lower lanes
  if (features && span() <= 40) {
    ctx.fillStyle = C.rule;
    const top = L.lines.y, bottom = L.hits.y + L.hits.h;
    for (let k = Math.ceil((viewT0 - features.beatOffset) / features.period); ; k++) {
      const bt = features.beatOffset + k * features.period;
      if (bt > viewT0 + span()) break;
      const x = Math.round(xOf(bt));
      if (x >= LW) ctx.fillRect(x, top, 1, bottom - top);
    }
  }

  // sections and scenes, with their starts (and handover ends) to drag
  const sections = SECTIONS.map((s, i) => ({ ...s, t1: SECTIONS[i + 1] ? SECTIONS[i + 1].t0 : DURATION }));
  bands(L.sections, sections, null, s => s.name, 'section');
  sections.forEach((s, i) => {
    if (i) hits.push({ x0: xOf(s.t0) - 5, x1: xOf(s.t0) + 5, y0: L.sections.y, y1: L.sections.y + L.sections.h, kind: 'section-edge', it: i, part: 'start' });
  });
  if (sel && sel.kind === 'section' && sections[sel.i]) {
    const s = sections[sel.i];
    if (sel.part === 'start') mark(xOf(s.t0), L.sections.y, L.sections.h); else outline(xOf(s.t0), xOf(s.t1), L.sections.y, L.sections.h);
  }
  const scenes = SCENES.map((s, i) => ({ ...s, t1: SCENES[i + 1] ? SCENES[i + 1].t0 : DURATION, scene: s }));
  bands(L.scenes, scenes, (s, a, b, y, h) => { if (s.tr) hatch(a, xOf(s.t0 + s.tr), y, h); }, s => s.name, 'scene');
  scenes.forEach((s, i) => {
    const x = xOf(s.t0), xt = xOf(s.t0 + s.tr), y0 = L.scenes.y, y1 = y0 + L.scenes.h;
    if (i) hits.push({ x0: x - 5, x1: x + 2, y0, y1, kind: 'scene-edge', it: s.scene, part: 'start' });
    if (i) hits.push({ x0: xt - 2, x1: xt + 5, y0, y1, kind: 'scene-edge', it: s.scene, part: 'tr' });
  });
  if (sel && sel.kind === 'scene') mark(xOf(sel.scene.t0 + (sel.part === 'tr' ? sel.scene.tr : 0)), L.scenes.y, L.scenes.h);

  // moments
  {
    const { y, h } = L.moments;
    const rowH = h / 2;
    const byRow = [[], []];
    EVENTS.forEach(e => byRow[e.row].push(e));
    byRow.forEach((list, r) => {
      const cy = y + rowH * r + rowH / 2;
      list.forEach((e, i) => {
        const a = xOf(e.t), b = e.t1 != null ? xOf(e.t1) : a;
        const nextX = list[i + 1] ? xOf(list[i + 1].t) : W;
        if (Math.max(a, b + 200) < LW || a > W) return;
        ctx.fillStyle = C.moment;
        if (e.t1 != null) {
          ctx.globalAlpha = 0.35;
          ctx.fillRect(a, cy - 3, Math.max(2, b - a), 6);
          ctx.globalAlpha = 1;
          ctx.fillRect(a, cy - 6, 2, 12);
          ctx.fillRect(b - 1, cy - 4, 1, 8);
        } else {
          ctx.beginPath(); ctx.moveTo(a, cy - 5); ctx.lineTo(a + 5, cy); ctx.lineTo(a, cy + 5); ctx.lineTo(a - 5, cy); ctx.closePath(); ctx.fill();
        }
        const lx = Math.max(a + 7, LW + 4);
        text(e.label, lx, cy, { max: nextX - lx - 6, color: C.ink });
        if (e.t1 != null) hits.push({ x0: a, x1: b, y0: cy - rowH / 2, y1: cy + rowH / 2, kind: 'moment', it: e, a, b });
        else hits.push({ x0: a - 5, x1: a + 5, y0: cy - rowH / 2, y1: cy + rowH / 2, kind: 'moment', it: e });
        const picked = sel && ((sel.kind === 'beat' && e.scene === sel.scene.name && e.beat === sel.i) || (sel.kind === 'deco' && e.cue === sel.cue));
        if (picked) {
          if (sel.part === 'body' || e.t1 == null) outline(a - 6, Math.max(b, a) + 6, cy - rowH / 2, rowH);
          else mark(edgeX(sel.part, a, b), cy - 6, 12);
        }
      });
    });
  }

  // singing that isn't a lyric line
  {
    const { y, h } = L.other;
    OTHER_SINGING.forEach((o, i) => {
      const a = xOf(o.t), b = xOf(o.t1);
      if (b < LW || a > W) return;
      const x0 = Math.max(a, LW), x1 = Math.min(b, W);
      ctx.fillStyle = C['band-b'];
      ctx.fillRect(x0, y + 2, x1 - x0, h - 4);
      hatch(a, b, y + 2, h - 4);
      text(o.label, x0 + 5, y + h / 2, { max: x1 - x0 - 8, color: C.ink });
      hits.push({ x0: a, x1: b, y0: y, y1: y + h, kind: 'other', it: { o, i }, a, b });
      if (sel && sel.kind === 'other' && sel.i === i) {
        if (sel.part === 'body') outline(a, b, y + 1, h - 2); else mark(edgeX(sel.part, a, b), y + 2, h - 4);
      }
    });
    hits.push({ x0: LW, x1: W, y0: y, y1: y + h, kind: 'other-lane', it: null, under: true });
  }

  // lines: thin bar while shown, block while sung
  {
    const { y } = L.lines;
    for (const Ln of LINES) {
      const ry = y + Ln.row * LINE_ROW;
      const a = xOf(Ln.cue.t0), b = xOf(Ln.cue.t1), sa = xOf(Ln.s.s0), sb = xOf(Ln.s.s1);
      if (Math.max(b, sb) < LW || Math.min(a, sa) > W) continue;
      const col = Ln.sa ? C.sa : C.ja, soft = Ln.sa ? C['sa-soft'] : C['ja-soft'];
      ctx.fillStyle = C['ink-3'];
      ctx.fillRect(Math.max(a, LW), ry + 17, Math.min(b, W) - Math.max(a, LW), 2);
      if (a >= LW) ctx.fillRect(a, ry + 14, 1.5, 8);
      if (b <= W) ctx.fillRect(b - 1.5, ry + 14, 1.5, 8);
      ctx.fillStyle = soft;
      ctx.fillRect(Math.max(sa, LW), ry + 2, Math.max(0, Math.min(sb, W) - Math.max(sa, LW)), 13);
      ctx.fillStyle = col;
      if (sa >= LW) ctx.fillRect(sa, ry + 2, 2, 13);
      const al = Ln.cue.align;
      if (al && al.alt != null) {
        const ax = xOf(al.alt);
        if (ax >= LW && ax <= W) { ctx.fillStyle = C.ink; ctx.fillRect(Math.round(ax), ry + 1, 1, 16); text('alt', ax + 3, ry + 5, { font: `9px ${C.mono}`, color: C['ink-2'] }); }
      }
      const conf = al ? (al.checked ? '✓ by ear' : al.conf) : 'guess';
      const lx = Math.max(sa, LW) + 5;
      const label = conf === 'high' ? Ln.text : `${Ln.text} · ${conf}`;
      text(label, lx, ry + 9, { color: C.ink, max: Math.max(b, sb) - lx - 4, font: `12px ${Ln.sa ? C.deva : C.sans}` });
      if (loop && loop.line === Ln) { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(Math.max(sa, LW) + 0.5, ry + 1.5, Math.min(Math.max(b, sb), W) - Math.max(sa, LW) - 1, 18); }
      hits.push({ x0: sa, x1: Math.max(sb, sa + 4), y0: ry, y1: ry + 15, kind: 'line', it: Ln });
      hits.push({ x0: a, x1: b, y0: ry + 15, y1: ry + LINE_ROW, kind: 'shown', it: Ln, a, b });
      if (sel && sel.kind === 'shown' && sel.L === Ln) {
        if (sel.part === 'body') outline(a, b, ry + 13, 10); else mark(edgeX(sel.part, a, b), ry + 13, 10);
      }
      if (sel && sel.kind === 'sylls' && sel.whole && sel.items[0].L === Ln) outline(sa - 1, sb + 1, ry + 1, 15);
    }
  }

  // syllables: kanji (or the Devanagari line) above, sung syllable below,
  // and where the syllables were before any edits as a faint bar underneath
  {
    const { y } = L.syll;
    const now = clock.mode ? t : -1;
    for (const Ln of LINES) {
      if (xOf(Ln.s.s1) < LW || xOf(Ln.s.s0) > W) continue;
      const ry = y + Ln.row * SYL_ROW;
      const col = Ln.sa ? C.sa : C.ja, soft = Ln.sa ? C['sa-soft'] : C['ja-soft'];
      const orig = ORIGINAL.lines[Ln.key];
      if (orig && orig.sylls && !same(orig.sylls, getUnit(`line:${Ln.key}`).sylls)) {
        ctx.fillStyle = C['ink-3'];
        for (const [p, q] of orig.sylls) {
          const a = xOf(p), b = xOf(q);
          if (b < LW || a > W) continue;
          ctx.fillRect(Math.max(a + 1, LW), ry + 38, Math.max(1, b - Math.max(a + 1, LW) - 1), 2);
        }
      }
      if (Ln.sa) {
        const a = xOf(Ln.s.s0), b = xOf(Ln.s.s1);
        text(Ln.text, Math.max(a, LW) + 2, ry + 7, { font: `13px ${C.deva}`, color: C['ink-2'], max: b - Math.max(a, LW) + 60 });
        hits.push({ x0: a, x1: b, y0: ry, y1: ry + 15, kind: 'glyph', it: { L: Ln, gi: 0 } });
      } else {
        Ln.s.glyphs.forEach((g, gi) => {
          if (!g.reading || !g.morae.length) return;
          const ys = Ln.s.syllables.filter(s => s.glyph === gi);
          const a = xOf(ys[0].t0), b = xOf(ys[ys.length - 1].t1);
          if (b < LW || a > W) return;
          ctx.fillStyle = C['ink-3'];
          ctx.fillRect(Math.max(a + 1, LW), ry + 14, Math.max(0, b - Math.max(a + 1, LW) - 1), 1);
          text(g.ch, (a + b) / 2, ry + 7, { font: `13px ${C.sans}`, color: C.ink, align: 'center' });
          hits.push({ x0: a, x1: b, y0: ry, y1: ry + 15, kind: 'glyph', it: { L: Ln, gi } });
        });
      }
      const checked = Ln.cue.align && Ln.cue.align.checked;
      Ln.s.syllables.forEach((s, k) => {
        s.k = k;
        const a = xOf(s.t0) + 1, b = xOf(s.t1) - 1;
        if (b < LW || a > W) return;
        const on = now >= s.t0 && now < s.t1;
        const x0 = Math.max(a, LW);
        ctx.fillStyle = on ? col : soft;
        ctx.fillRect(x0, ry + 17, Math.max(1, b - x0), 19);
        const unsure = !checked && Ln.cue.align && Ln.cue.align.unsure && Ln.cue.align.unsure.includes(s.k);
        if (unsure && !on) hatch(a, b, ry + 17, 19);
        ctx.fillStyle = col;
        if (a >= LW) ctx.fillRect(a, ry + 17, 2, 19);
        const label = s.text;
        ctx.font = `12px ${Ln.sa ? C.mono : C.sans}`;
        if (ctx.measureText(label).width < b - a - 4) text(label, (a + b) / 2 + 1, ry + 27, { font: ctx.font, color: on ? C.surface : C.ink, align: 'center' });
        const edges = sung(Ln.cue) ? { a: a - 1, b: b + 1 } : {};
        hits.push({ x0: a - 1, x1: b + 1, y0: ry + 15, y1: ry + SYL_ROW, kind: 'syll', it: { ...s, line: Ln, k }, ...edges });
        if (isSel(Ln, k)) {
          if (sel.part === 'body' || sel.items.length > 1) outline(a - 1, b + 1, ry + 16, 21);
          else mark(edgeX(sel.part, a - 1, b + 1), ry + 17, 19);
        }
        if (tap && tap.L === Ln && tap.k === k) { ctx.fillStyle = C.sel; ctx.fillRect(x0, ry + 36, Math.max(1, b - x0), 2); }
      });
    }
  }

  // spectrogram, with each syllable onset drawn through it
  {
    const { y, h } = L.spec;
    if (spec) {
      specChunks = specChunks || buildSpecChunks();
      ctx.imageSmoothingEnabled = true;
      const f0 = viewT0 * spec.rate, f1 = (viewT0 + span()) * spec.rate;
      for (const ch of specChunks) {
        const s0 = Math.max(f0, ch.f0), s1 = Math.min(f1, ch.f0 + ch.w);
        if (s1 <= s0) continue;
        const dx0 = LW + (s0 - f0) / (f1 - f0) * (W - LW), dx1 = LW + (s1 - f0) / (f1 - f0) * (W - LW);
        ctx.drawImage(ch.cv, s0 - ch.f0, 0, s1 - s0, spec.rows, dx0, y, dx1 - dx0, h);
      }
    } else {
      text($('status').textContent, LW + 10, y + h / 2, { color: C['ink-3'] });
    }
    ctx.globalAlpha = 0.55;
    for (const s of SYLL) {
      const x = xOf(s.t0);
      if (x < LW || x > W) continue;
      ctx.fillStyle = isSel(s.line, s.k) ? C.sel : s.line.sa ? C.sa : C.ja;
      ctx.fillRect(Math.round(x), y, 1, h);
    }
    ctx.globalAlpha = 1;
  }

  // loudness and detected drum hits
  if (features) {
    const { y, h } = L.hits;
    ctx.fillStyle = C['ink-3'];
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(LW, y + h);
    for (let x = LW; x <= W; x += 2) {
      const i = clamp(Math.floor(tOf(x) * 100), 0, features.level.length - 1);
      ctx.lineTo(x, y + h - features.level[i] * h * 0.9);
    }
    ctx.lineTo(W, y + h);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = C['ink-2'];
    for (const hit of features.hits) {
      const x = xOf(hit.t);
      if (x < LW || x > W) continue;
      const hh = 6 + hit.s * (h - 8);
      ctx.fillRect(Math.round(x), y + h - hh, 1.5, hh);
      hits.push({ x0: x - 3, x1: x + 3, y0: y, y1: y + h, kind: 'hit', it: hit });
    }
  }

  // loop region, box selection, hover line, playhead
  if (loop) {
    ctx.fillStyle = C.loop;
    const a = Math.max(xOf(loop.a), LW), b = Math.min(xOf(loop.b), W);
    if (b > a) ctx.fillRect(a, L.sections.y, b - a, H - L.sections.y);
  }
  if (drag && drag.mode === 'box' && drag.moved) {
    ctx.strokeStyle = C.sel; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.strokeRect(Math.min(drag.x, drag.x1) + 0.5, Math.min(drag.y, drag.y1) + 0.5, Math.abs(drag.x1 - drag.x), Math.abs(drag.y1 - drag.y));
    ctx.setLineDash([]);
  }
  if (hover && hover.x >= LW) {
    ctx.fillStyle = C['ink-3'];
    ctx.fillRect(Math.round(hover.x), L.ruler.h, 1, H);
  }
  if (clock.mode) {
    const x = Math.round(xOf(t));
    if (x >= LW && x <= W) {
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - 1, 0, 2, H);
      ctx.beginPath(); ctx.moveTo(x - 6, 0); ctx.lineTo(x + 6, 0); ctx.lineTo(x, 8); ctx.closePath(); ctx.fill();
    }
  }

  // lane labels
  if (LW) {
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, LW, H);
    ctx.fillStyle = C.rule;
    ctx.fillRect(LW - 1, 0, 1, H);
    for (const id in L) {
      if (!L[id].label) continue;
      text(L[id].label, 10, L[id].y + Math.min(L[id].h, 22) / 2, { font: `500 11.5px ${C.sans}`, color: C['ink-2'] });
    }
    text('110 Hz – 3.5 kHz', 10, L.spec.y + 30, { font: `10.5px ${C.mono}`, color: C['ink-3'] });
  }
  drawOverview(t);
  updateNow(t);
  updateSelbar();
}

function drawOverview(t) {
  const w = over.clientWidth, h = 44;
  const x = s => s / DURATION * w;
  octx.fillStyle = C.surface;
  octx.fillRect(0, 0, w, h);
  SECTIONS.forEach((s, i) => {
    const a = x(s.t0), b = x(SECTIONS[i + 1] ? SECTIONS[i + 1].t0 : DURATION);
    octx.fillStyle = i % 2 ? C['band-a'] : C['band-b'];
    octx.fillRect(a, 0, b - a, 14);
    octx.font = `10px ${C.sans}`;
    octx.fillStyle = C['ink-2'];
    octx.textBaseline = 'middle';
    if (b - a > 40) octx.fillText(s.name, a + 4, 7);
  });
  for (const Ln of LINES) {
    octx.fillStyle = Ln.sa ? C.sa : C.ja;
    octx.fillRect(x(Ln.s.s0), 18 + (Ln.row % 3) * 6, Math.max(2, x(Ln.s.s1) - x(Ln.s.s0)), 4);
  }
  octx.fillStyle = C.moment;
  for (const e of EVENTS) octx.fillRect(x(e.t), 38, 2, 4);
  octx.strokeStyle = C['ink-2'];
  octx.lineWidth = 1;
  octx.strokeRect(x(viewT0) + 0.5, 0.5, Math.max(3, x(span())), h - 1);
  octx.fillStyle = C.ink;
  octx.fillRect(x(t) - 1, 0, 2, h);
}

// ---------------------------------------------------------------- the "now singing" panel

const linesEl = $('lines'), whereEl = $('where');
let shown = { cur: null, next: null, k: -2 };

function lineEl(Ln, cls) {
  const el = document.createElement('div');
  el.className = `line ${Ln.sa ? 'sa' : 'ja'} ${cls}`;
  el.lang = Ln.sa ? 'sa' : 'ja';
  const parts = [];   // per syllable: [glyph element, mora element]
  if (Ln.sa) {
    const deva = document.createElement('span');
    deva.className = 'deva';
    deva.textContent = Ln.text;
    const roman = document.createElement('span');
    roman.className = 'roman';
    roman.lang = 'sa-Latn';
    let k = 0;
    (Ln.cue.roman || '').split(' ').forEach((word, wi) => {
      if (wi) roman.append(' ');
      word.split('-').forEach((syl, si) => {
        if (si) roman.append('-');
        const m = document.createElement('span');
        m.className = 'm';
        m.textContent = syl;
        roman.append(m);
        parts[k++] = [null, m];
      });
    });
    el.append(deva, roman);
  } else {
    let k = 0;
    Ln.s.glyphs.forEach(g => {
      if (g.gap) el.append('　');
      const ge = document.createElement('span');
      ge.className = 'g';
      if (g.reading) {
        const ruby = document.createElement('ruby');
        ruby.append(g.ch);
        const rt = document.createElement('rt');
        g.morae.forEach(mo => {
          const m = document.createElement('span');
          m.className = 'm';
          m.textContent = mo;
          rt.append(m);
          parts[k++] = [ge, m];
        });
        ruby.append(rt);
        ge.append(ruby);
      } else {
        ge.textContent = g.ch;
        g.morae.forEach(() => { parts[k++] = [ge, null]; });
      }
      el.append(ge);
    });
  }
  el._parts = parts;
  return el;
}

function updateNow(t) {
  // the line being sung (or last sung and still on screen), and the next one
  let cur = null, next = null;
  for (const Ln of LINES) {
    if (Ln.s.s0 <= t && t <= Ln.cue.t1 && (!cur || Ln.s.s0 >= cur.s.s0)) cur = Ln;
    if (Ln.s.s0 > t && (!next || Ln.s.s0 < next.s.s0)) next = Ln;
  }
  if (cur !== shown.cur || next !== shown.next) {
    linesEl.replaceChildren();
    shown = { cur, next, k: -2, curEl: null };
    if (cur) { shown.curEl = lineEl(cur, 'current'); linesEl.append(shown.curEl); }
    else {
      const idle = document.createElement('div');
      idle.className = 'line idle';
      idle.textContent = 'No lyric being sung here';
      linesEl.append(idle);
    }
    if (next) linesEl.append(lineEl(next, 'next'));
  }
  if (cur && shown.curEl) {
    const ys = cur.s.syllables;
    let k = -1;
    for (let i = 0; i < ys.length; i++) if (t >= ys[i].t0) k = i;
    const done = k >= 0 && t >= ys[k].t1;
    const key = done ? k + 0.5 : k;
    if (key !== shown.k) {
      shown.k = key;
      const parts = shown.curEl._parts;
      const glyphState = new Map();
      parts.forEach(([ge, m], i) => {
        const on = i === k && !done, sung = i < k || (i === k && done);
        if (m) { m.classList.toggle('on', on); m.classList.toggle('sung', sung); }
        if (ge) { const s = glyphState.get(ge) || { on: false, sung: true }; s.on ||= on; s.sung &&= sung || on; glyphState.set(ge, s); }
      });
      for (const [ge, s] of glyphState) { ge.classList.toggle('on', s.on); ge.classList.toggle('sung', s.sung && !s.on); }
    }
  }
  const scene = SCENES.filter(s => s.t0 <= t).pop();
  const section = SECTIONS.filter(s => s.t0 <= t).pop() || SECTIONS[0];
  const info = cur ? `shown ${fmt(cur.cue.t0, 1)}–${fmt(cur.cue.t1, 1)} · sung ${fmt(cur.s.s0, 2)}–${fmt(cur.s.s1, 2)}` : '';
  const html = `<span>Section <b>${esc(section.name)}</b></span><span>Scene <b>${esc(scene.name)}</b></span>${info ? `<span>${info}</span>` : ''}`;
  if (whereEl._html !== html) { whereEl.innerHTML = html; whereEl._html = html; }
  $('time').firstChild.textContent = `${fmt(t)} `;
}

// ---------------------------------------------------------------- the selection bar

const selbar = $('selbar');
let selbarSig = '';
const wasNow = (a, b) => (same(a, b) ? '' : ` <span class="was">was ${a}</span>`);

function updateSelbar() {
  const parts = [];      // [html, ...]
  const actions = [];    // [action, label]
  let input = null;      // { action, value, label }
  if (!sel) {
    parts.push(editable
      ? '<span class="hint">Click a syllable, line, scene edge, beat, section or passage of other singing to select it; drag it to move it. Hold ⇧ and drag across syllables to select several.</span>'
      : `<span class="hint">${esc(store.status)}</span>`);
  } else if (sel.kind === 'sylls') {
    const L0 = sel.items[0].L, u = getUnit(`line:${L0.key}`), o = ORIGINAL.lines[L0.key];
    const ks = sel.items.filter(i => i.L === L0).map(i => i.k).sort((a, b) => a - b);
    const a = u.sylls[ks[0]][0], b = u.sylls[ks[ks.length - 1]][1];
    const oa = o.sylls[ks[0]][0], ob = o.sylls[ks[ks.length - 1]][1];
    const what = sel.whole ? `Line <b>${esc(L0.text)}</b>` : ks.length === 1 ? `<b>${esc(L0.s.syllables[ks[0]].text)}</b> in ${esc(L0.text)}` : `${sel.items.length} syllables in ${esc(L0.text)}`;
    const edge = sel.part === 'start' ? ' · start selected' : sel.part === 'end' ? ' · end selected' : '';
    parts.push(`${what}${edge}`, `<span class="t">${fmt(a)}–${fmt(b)}</span>${wasNow(`${fmt(oa)}–${fmt(ob)}`, `${fmt(a)}–${fmt(b)}`)}`);
    if (sel.whole) parts.push(`<span class="t">on screen ${fmt(u.t0, 2)}–${fmt(u.t1, 2)}</span>`);
    actions.push(['check', u.checked ? 'Unmark checked' : 'Mark checked (C)']);
    if (!same(u, o)) actions.push(['revert-line', 'Revert line']);
  } else if (sel.kind === 'shown' || sel.kind === 'deco') {
    const cue = sel.kind === 'shown' ? sel.L.cue : sel.cue, u = getUnit(`line:${cue.key}`), o = ORIGINAL.lines[cue.key];
    parts.push(`<b>${esc(plain(cue.text))}</b> ${sel.kind === 'deco' ? 'in its light' : 'on screen'}`, `<span class="t">${fmt(u.t0, 2)}–${fmt(u.t1, 2)}</span>${wasNow(`${fmt(o.t0, 2)}–${fmt(o.t1, 2)}`, `${fmt(u.t0, 2)}–${fmt(u.t1, 2)}`)}`);
    if (u.t0 !== o.t0 || u.t1 !== o.t1) actions.push(['revert-shown', 'Revert']);
  } else if (sel.kind === 'scene' || sel.kind === 'beat') {
    const u = getUnit(`scene:${sel.scene.name}`), o = ORIGINAL.scenes[sel.scene.name];
    if (sel.kind === 'scene') {
      parts.push(`Scene <b>${esc(sel.scene.name)}</b>`, `<span class="t">starts ${fmt(u.t0)} · handover ${u.tr.toFixed(2)} s</span>${wasNow(`${fmt(o.t0)}, ${o.tr.toFixed(2)} s`, `${fmt(u.t0)}, ${u.tr.toFixed(2)} s`)}`);
    } else {
      const b = u.beats[sel.i], ob = o.beats[sel.i];
      const r = x => (x.t1 != null ? `${fmt(x.t)}–${fmt(x.t1)}` : fmt(x.t));
      parts.push(`Beat ${sel.i + 1} of <b>${esc(sel.scene.name)}</b>: ${esc(sel.scene.beats[sel.i].label)}${sel.i >= 4 ? ' <span class="was">(only the first four reach the shader)</span>' : ''}`, `<span class="t">${r(b)}</span>${wasNow(r(ob), r(b))}`);
    }
    if (!same(u, o)) actions.push(['revert-scene', 'Revert scene']);
  } else if (sel.kind === 'section') {
    const s = SECTIONS[sel.i];
    if (!s) { select(null); return; }
    const o = ORIGINAL.sections.find(x => x.name === s.name);
    parts.push(`Section`, `<span class="t">from ${fmt(s.t0)}</span>${o ? wasNow(fmt(o.t0), fmt(s.t0)) : ''}`);
    input = { action: 'rename-section', value: s.name, label: 'Section name' };
    if (sel.i > 0) actions.push(['delete-section', 'Delete section']);
  } else if (sel.kind === 'other') {
    const o = OTHER_SINGING[sel.i];
    if (!o) { select(null); return; }
    parts.push('Other singing', `<span class="t">${fmt(o.t)}–${fmt(o.t1)}</span>`);
    input = { action: 'rename-other', value: o.label, label: 'What it is' };
    actions.push(['delete-other', 'Delete']);
  }
  const sig = JSON.stringify([parts, actions, input]);
  if (sig === selbarSig) return;
  selbarSig = sig;
  const focused = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.action;
  selbar.innerHTML = parts.map(p => `<span>${p}</span>`).join('')
    + (input ? `<input type="text" data-action="${input.action}" value="${esc(input.value)}" aria-label="${input.label}" size="${Math.min(48, Math.max(12, input.value.length + 2))}">` : '')
    + actions.map(([a, l]) => `<button type="button" data-action="${a}">${l}</button>`).join('');
  if (focused && input && focused === input.action) selbar.querySelector('input').focus();
}

selbar.addEventListener('click', e => {
  const a = e.target.dataset && e.target.dataset.action;
  if (!a || !editable || !sel) return;
  if (a === 'check') toggleChecked();
  else if (a === 'revert-line' || a === 'revert-shown') {
    const cue = sel.kind === 'sylls' ? sel.items[0].L.cue : sel.kind === 'shown' ? sel.L.cue : sel.cue;
    const id = `line:${cue.key}`, o = ORIGINAL.lines[cue.key];
    change([id], `reverted ${short(plain(cue.text))}`, a === 'revert-line' ? o.sylls[0][0] : o.t0,
      () => setUnit(id, a === 'revert-line' ? o : { ...getUnit(id), t0: o.t0, t1: o.t1 }));
  } else if (a === 'revert-scene') {
    const id = `scene:${sel.scene.name}`;
    change([id], `reverted scene ${sel.scene.name}`, ORIGINAL.scenes[sel.scene.name].t0, () => setUnit(id, ORIGINAL.scenes[sel.scene.name]));
  } else if (a === 'delete-section' || a === 'delete-other') deleteSelected();
});
selbar.addEventListener('change', e => {
  const a = e.target.dataset && e.target.dataset.action;
  if (!editable || !sel) return;
  const name = e.target.value.trim();
  if (!name) return;
  if (a === 'rename-section') {
    const i = sel.i, old = SECTIONS[i].name;
    if (old !== name) change(['sections'], `renamed section ${old} to ${name}`, SECTIONS[i].t0, () => setUnit('sections', SECTIONS.map((s, j) => (j === i ? { ...s, name } : s))));
  } else if (a === 'rename-other') {
    const i = sel.i, old = OTHER_SINGING[i].label;
    if (old !== name) change(['other'], `renamed other singing to “${short(name, 24)}”`, OTHER_SINGING[i].t, () => setUnit('other', OTHER_SINGING.map((o, j) => (j === i ? { ...o, label: name } : o))));
  }
});

function toggleChecked() {
  const L = sel && sel.kind === 'sylls' ? sel.items[0].L : null;
  if (!L || !sung(L.cue)) return;
  const id = `line:${L.key}`, u = getUnit(id);
  change([id], `${u.checked ? 'unmarked' : 'marked'} ${short(L.text)} as checked`, u.sylls[0][0], () => setUnit(id, { ...u, checked: !u.checked }));
}

function deleteSelected() {
  if (sel && sel.kind === 'section' && sel.i > 0) {
    const s = SECTIONS[sel.i];
    change(['sections'], `deleted section ${s.name}`, s.t0, () => setUnit('sections', SECTIONS.filter((x, j) => j !== sel.i)));
    select(null);
  } else if (sel && sel.kind === 'other') {
    const o = OTHER_SINGING[sel.i];
    change(['other'], `deleted other singing “${short(o.label, 24)}”`, o.t, () => setUnit('other', OTHER_SINGING.filter((x, j) => j !== sel.i)));
    select(null);
  }
}

// ⌥-click in the section or other-singing lane adds one there
function addAt(kind, t) {
  t = Math.round(t * 100) / 100;
  if (kind === 'section') {
    if (SECTIONS.some(s => Math.abs(s.t0 - t) < 0.2)) return;
    const next = [...SECTIONS, { t0: t, name: 'New section' }].sort((a, b) => a.t0 - b.t0);
    change(['sections'], `added a section at ${fmt(t)}`, t, () => setUnit('sections', next));
    select({ kind: 'section', i: next.findIndex(s => s.t0 === t), part: 'body' });
  } else {
    const next = [...OTHER_SINGING, { t, t1: Math.min(DURATION, t + 2), label: 'new' }].sort((a, b) => a.t - b.t);
    change(['other'], `added other singing at ${fmt(t)}`, t, () => setUnit('other', next));
    select({ kind: 'other', i: next.findIndex(o => o.t === t && o.label === 'new'), part: 'body' });
  }
  requestAnimationFrame(() => { const inp = selbar.querySelector('input'); if (inp) { inp.focus(); inp.select(); } });
}

// ---------------------------------------------------------------- history

const historyEl = $('history');
function renderHistory() {
  const edits = store.entries.filter(e => e.kind === 'edit');
  const live = new Set(store.undoStack);
  $('historyCount').textContent = edits.length ? `(${edits.length})` : '';
  historyEl.innerHTML = edits.slice(-80).reverse().map(e => {
    const at = new Date(e.at);
    return `<li class="${live.has(e.seq) ? '' : 'undone'}"><button type="button" data-seq="${e.seq}">${esc(e.label)}</button>`
      + `<span class="t">${e.t != null ? fmt(e.t) : ''} · ${at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></li>`;
  }).join('') || '<li class="empty">No edits yet.</li>';
  const u = store.nextUndo, r = store.nextRedo;
  $('undo').disabled = !u || !editable; $('undo').title = u ? `Undo ${u.label}` : '';
  $('redo').disabled = !r || !editable; $('redo').title = r ? `Redo ${r.label}` : '';
}
historyEl.addEventListener('click', e => {
  const seq = e.target.dataset && +e.target.dataset.seq;
  const entry = seq && store.entry(seq);
  if (entry && entry.t != null) showTime(entry.t, true);
});
function showTime(t, seek = false) {
  if (t < viewT0 + span() * 0.05 || t > viewT0 + span() * 0.95) { setFollow(false); viewT0 = t - span() * 0.3; }
  if (seek && clock.mode) clock.seek(t - 0.5);
}

function undo() {
  if (!editable) return;
  cancelReplay(true);
  const e = store.undo();
  if (e && e.t != null) showTime(e.t);
}
function redo() {
  if (!editable) return;
  cancelReplay(true);
  const e = store.redo();
  if (e && e.t != null) showTime(e.t);
}
store.onChange = () => {
  if (sel && (sel.kind === 'section' || sel.kind === 'other')) select(null);
  refresh(true);
  renderHistory();
};
store.onStatus = s => { $('saveStatus').textContent = s; $('saveStatus').classList.toggle('warn', !!store.error || store.fellBack); };

// ---------------------------------------------------------------- tapping onsets
// J while it plays: the selected syllable starts now, and the next one is
// selected. Holding J sets its end too, when you let go. Taps are moved
// earlier by the tap offset, to make up for reaction time and for sound
// reaching you late (Bluetooth headphones especially).

let tap = null;             // { L, k, id, before, down }
let calib = null;           // { diffs } while calibrating
let tapOffset = local.get('tap-offset', 0);   // ms of real time
$('tapOffset').value = tapOffset;

function tapTime() {
  return clock.now() - (clock.playing ? tapOffset / 1000 * clock.rate : 0);
}
function tapDown() {
  if (calib) {
    const t = clock.now();
    let best = null;
    for (const s of SYLL) if (Math.abs(s.t0 - t) < 0.5 && (!best || Math.abs(s.t0 - t) < Math.abs(best.t0 - t))) best = s;
    if (best) calib.diffs.push((t - best.t0) / clock.rate * 1000);
    showCalib();
    return;
  }
  const first = sel && sel.kind === 'sylls' ? [...sel.items].sort((a, b) => a.L.s.syllables[a.k].t0 - b.L.s.syllables[b.k].t0)[0] : null;
  if (!first || !sung(first.L.cue)) { flashHint('Select the syllable to start tapping from'); return; }
  const { L, k } = first, id = `line:${L.key}`;
  const before = getUnit(id), t = tapTime();
  setUnit(id, tapStart(before, k, t));
  refresh();
  tap = { L, k, id, before, down: performance.now(), t };
}
function tapUp() {
  if (!tap) return;
  const { L, k, id, before } = tap;
  const held = performance.now() - tap.down > 200;
  if (held) { setUnit(id, tapEnd(getUnit(id), k, tapTime())); refresh(); }
  store.commit(`${held ? 'sang' : 'tapped'} ${sylDesc(L, k)}`, [{ id, before, after: getUnit(id) }], tap.t);
  renderHistory();
  const next = stepSyll(L, k, 1);
  select(next ? { kind: 'sylls', items: [next], part: 'body' } : null);
  tap = null;
  refresh(true);
}
function showCalib() {
  const el = $('calibText');
  el.hidden = !calib;
  $('calibrate').textContent = calib ? 'Cancel' : 'Calibrate';
  if (!calib) return;
  const d = [...calib.diffs].sort((a, b) => a - b);
  const med = d.length ? d[Math.floor(d.length / 2)] : null;
  el.innerHTML = d.length
    ? `${d.length} tap${d.length === 1 ? '' : 's'}, median ${Math.round(Math.abs(med))} ms ${med >= 0 ? 'late' : 'early'} <button type="button" id="calibUse">Use ${Math.round(med)} ms</button>`
    : 'Play a line you trust and press J on each syllable';
  const use = $('calibUse');
  if (use) use.onclick = () => { setTapOffset(Math.round(med)); calib = null; showCalib(); };
}
function setTapOffset(v) { tapOffset = +v || 0; $('tapOffset').value = tapOffset; local.set('tap-offset', tapOffset); }
$('tapOffset').addEventListener('change', e => setTapOffset(e.target.value));
$('calibrate').addEventListener('click', () => { calib = calib ? null : { diffs: [] }; showCalib(); });

let hintTimer = null;
function flashHint(msg) {
  const el = $('saveStatus');
  el.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { el.textContent = store.status; }, 2500);
}

// ---------------------------------------------------------------- interaction

const tip = $('tip');
const RANGED = new Set(['syll', 'shown', 'moment', 'other']);
function hitAt(x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (!h.under && x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h;
  }
  // a little slack around edges that can be dragged
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (RANGED.has(h.kind) && h.a != null && x >= h.x0 - 4 && x <= h.x1 + 4 && y >= h.y0 && y <= h.y1) return h;
  }
  for (const h of hits) if (h.under && x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h;
  return null;
}
function partAt(h, x) {
  if (h.part) return h.part;
  if (h.a == null) return 'body';
  const zone = clamp((h.b - h.a) / 3, 2, 6);
  if (x <= h.a + zone) return 'start';
  if (x >= h.b - zone) return 'end';
  return 'body';
}

// what a hit would select (and drag)
function targetFor(h, part) {
  if (!h) return null;
  const it = h.it;
  switch (h.kind) {
    case 'syll': return sung(it.line.cue) ? { kind: 'sylls', items: [{ L: it.line, k: it.k }], part } : { kind: 'shown', L: it.line, part: 'body' };
    case 'glyph': {
      if (!sung(it.L.cue)) return { kind: 'shown', L: it.L, part: 'body' };
      if (it.L.sa) return { kind: 'sylls', items: allSylls(it.L), part: 'body', whole: true };
      return { kind: 'sylls', items: glyphSylls(it.L, it.gi).map(k => ({ L: it.L, k })), part: 'body', glyph: it.L.s.glyphs[it.gi].ch };
    }
    case 'line': return sung(it.cue) ? { kind: 'sylls', items: allSylls(it), part: 'body', whole: true } : { kind: 'shown', L: it, part: 'body' };
    case 'shown': return { kind: 'shown', L: it, part };
    case 'scene-edge': return { kind: 'scene', scene: it, part };
    case 'moment':
      if (it.cue) return { kind: 'deco', cue: it.cue, part };
      if (it.scene != null) return { kind: 'beat', scene: sceneOf(it.scene), i: it.beat, part: it.t1 != null ? part : 'body' };
      return null;
    case 'section-edge': return { kind: 'section', i: it, part: 'start' };
    case 'section': return { kind: 'section', i: h.i, part: 'body' };
    case 'other': return { kind: 'other', i: it.i, part };
  }
  return null;
}
const CURSORS = { start: 'ew-resize', end: 'ew-resize', tr: 'ew-resize', body: 'grab' };

function describe(h) {
  const it = h.it;
  switch (h.kind) {
    case 'syll': {
      const Ln = it.line, g = Ln.s.glyphs[it.glyph];
      const what = Ln.sa ? `<b>${esc(it.text)}</b> in ${esc(Ln.cue.roman)}` : g.reading ? `<b>${esc(it.text)}</b> of ${esc(g.ch)}（${esc(g.reading)}）` : `<b>${esc(it.text)}</b>`;
      const unsure = Ln.cue.align && !Ln.cue.align.checked && Ln.cue.align.unsure && Ln.cue.align.unsure.includes(it.k);
      const o = ORIGINAL.lines[Ln.key];
      const was = o && o.sylls && o.sylls[it.k] && (o.sylls[it.k][0] !== it.t0 || o.sylls[it.k][1] !== it.t1) ? ` <i>(was ${fmt(o.sylls[it.k][0])} – ${fmt(o.sylls[it.k][1])})</i>` : '';
      return `${what}<br>${esc(Ln.text)}<br><span class="t">${fmt(it.t0)} – ${fmt(it.t1)}</span>${was}${unsure ? '<br>the two aligners disagreed on this one by over 0.5 s' : ''}`;
    }
    case 'glyph': return `<b>${esc(it.L.sa ? it.L.text : it.L.s.glyphs[it.gi].ch)}</b><br>click to select its syllables; drag to move them`;
    case 'line': {
      const al = it.cue.align;
      const conf = al ? `measured, ${al.conf} confidence${al.alt != null ? `; the other aligner said ${fmt(al.alt)}` : ''}${al.checked ? '; checked by ear' : ''}` : 'not measured';
      return `<b>${esc(it.text)}</b>${it.sa ? `<br>${esc(it.cue.roman)}` : ''}<br><span class="t">shown ${fmt(it.cue.t0, 1)}–${fmt(it.cue.t1, 1)} · sung ${fmt(it.s.s0)}–${fmt(it.s.s1)}</span><br>${conf}${al && al.note ? `<br><i>${esc(al.note)}</i>` : ''}<br>click to loop this line; drag to move it`;
    }
    case 'shown': return `<b>${esc(it.text)}</b> on screen<br><span class="t">${fmt(it.cue.t0, 2)} – ${fmt(it.cue.t1, 2)}</span><br>drag an end, or the bar`;
    case 'other': return `<b>${esc(it.o.label)}</b><br><span class="t">${fmt(it.o.t)} – ${fmt(it.o.t1)}</span>`;
    case 'moment': return `<b>${esc(it.label)}</b>${it.scene != null ? `<br>beat ${it.beat + 1} of ${esc(it.scene)}` : ''}<br><span class="t">${fmt(it.t)}${it.t1 != null ? ` – ${fmt(it.t1)}` : ''}</span>`;
    case 'scene': return `Scene <b>${esc(it.name)}</b><br><span class="t">from ${fmt(it.t0, 2)}${it.tr ? `, handover takes ${it.tr} s` : ''}</span>`;
    case 'scene-edge': return h.part === 'start' ? `Start of <b>${esc(it.name)}</b><br><span class="t">${fmt(it.t0)}</span>` : `End of the handover into <b>${esc(it.name)}</b><br><span class="t">${it.tr} s</span>`;
    case 'section': return `Section <b>${esc(it.name)}</b><br><span class="t">${fmt(it.t0, 1)} – ${fmt(it.t1, 1)}</span><br>⌥-click to add a section`;
    case 'section-edge': return `Start of section <b>${esc(SECTIONS[it].name)}</b><br><span class="t">${fmt(SECTIONS[it].t0)}</span>`;
    case 'other-lane': return '⌥-click to add a passage of other singing';
    case 'hit': return `Drum hit, strength ${it.s.toFixed(2)}<br><span class="t">${fmt(it.t)}</span>`;
  }
  return '';
}

function showTip(html, x, y) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = roll.parentElement.getBoundingClientRect();
  tip.style.left = `${Math.min(r.width - tip.offsetWidth - 8, x + 14)}px`;
  tip.style.top = `${y + 16}px`;
}

let drag = null;   // { mode: 'pan' | 'edit' | 'box', x, y, moved, ... }
roll.addEventListener('pointerdown', e => {
  const x = e.offsetX, y = e.offsetY;
  const h = hitAt(x, y);
  let tg = editable && h && !e.shiftKey ? targetFor(h, partAt(h, x)) : null;
  // dragging the middle of a syllable in a selected group moves the group
  if (tg && tg.kind === 'sylls' && !tg.whole && tg.part === 'body' && tg.items.length === 1
      && sel && sel.kind === 'sylls' && sel.items.length > 1 && isSel(tg.items[0].L, tg.items[0].k)) tg = { ...sel, part: 'body' };
  if (tg) drag = { mode: 'edit', x, y, tg, h, alt: e.altKey, op: null, moved: false };
  else if (e.shiftKey && editable && y >= lanes.syll.y && y <= lanes.syll.y + lanes.syll.h && (!h || h.kind === 'syll' || h.kind === 'glyph')) drag = { mode: 'box', x, y, x1: x, y1: y, h, moved: false };
  else drag = { mode: 'pan', x, y, t0: viewT0, h, moved: false };
  roll.setPointerCapture(e.pointerId);
});
roll.addEventListener('pointermove', e => {
  const x = e.offsetX, y = e.offsetY;
  if (drag && !drag.moved && Math.abs(x - drag.x) > 3) drag.moved = true;
  if (drag && drag.moved) {
    if (drag.mode === 'edit') {
      if (!drag.op) {
        drag.op = makeOp(drag.tg, { alt: drag.alt });
        if (!drag.op) { drag.mode = 'pan'; drag.t0 = viewT0; }
        else { cancelReplay(true); select(drag.tg); }
      }
      if (drag.op) {
        drag.op.apply((x - drag.x) / pxPerS());
        showTip(drag.op.readout, x, y);
        return;
      }
    }
    if (drag.mode === 'pan') {
      setFollow(false);
      viewT0 = drag.t0 - (x - drag.x) / (W - LW) * span();
    } else if (drag.mode === 'box') { drag.x1 = x; drag.y1 = y; }
  }
  const h = hitAt(x, y);
  hover = { x, y, t: tOf(x), hit: h };
  const part = h && editable ? partAt(h, x) : null;
  roll.style.cursor = drag && drag.moved ? (drag.mode === 'pan' ? 'grabbing' : 'crosshair') : h && editable && targetFor(h, part) && h.kind !== 'section' ? CURSORS[part] : 'crosshair';
  if (h && !(drag && drag.moved)) showTip(describe(h), x, y);
  else tip.hidden = true;
});
roll.addEventListener('pointerleave', () => { hover = null; if (!drag) tip.hidden = true; });
roll.addEventListener('pointerup', e => {
  const d = drag;
  drag = null;
  tip.hidden = true;
  if (!d) return;
  const x = e.offsetX, y = e.offsetY;
  if (d.mode === 'edit' && d.op) {
    const entry = commitOp(d.op);
    if (entry) replayAt(d.op.focus);
    return;
  }
  if (d.mode === 'box' && d.moved) {
    const [t0, t1] = [tOf(Math.min(d.x, x)), tOf(Math.max(d.x, x))];
    const [y0, y1] = [Math.min(d.y, y), Math.max(d.y, y)];
    const items = SYLL.filter(s => sung(s.line.cue) && s.t1 > t0 && s.t0 < t1)
      .filter(s => { const ry = lanes.syll.y + s.line.row * SYL_ROW; return ry + 36 >= y0 && ry + 17 <= y1; })
      .map(s => ({ L: s.line, k: s.k }));
    select(items.length ? { kind: 'sylls', items, part: 'body' } : null);
    return;
  }
  if (d.moved) return;   // a pan
  click(d.h, x, e);
});

function click(h, x, e) {
  if (e.altKey && editable && h && (h.kind === 'section' || h.kind === 'section-edge')) { addAt('section', tOf(x)); return; }
  if (e.altKey && editable && h && h.kind === 'other-lane') { addAt('other', tOf(x)); return; }
  const tg = h ? targetFor(h, partAt(h, x)) : null;
  // ⇧-click adds a syllable to the selection, or takes it out
  if (e.shiftKey && tg && tg.kind === 'sylls' && sel && sel.kind === 'sylls' && !sel.whole) {
    const items = [...sel.items];
    for (const it of tg.items) {
      const i = items.findIndex(s => s.L === it.L && s.k === it.k);
      if (i >= 0) items.splice(i, 1); else items.push(it);
    }
    select(items.length ? { kind: 'sylls', items, part: 'body' } : null);
    return;
  }
  select(tg);
  if (!clock.mode) return;
  cancelReplay(true);
  if (h && h.kind === 'syll') { clock.seek(h.it.t0 - 0.3); if (!clock.playing) clock.play(); }
  else if (h && h.kind === 'line') toggleLoop(h.it);
  else if (!tg && x >= LW) clock.seek(tOf(x));
}

roll.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const at = tOf(e.offsetX);
    setZoom(zoom + (e.deltaY > 0 ? 1 : -1), at, e.offsetX);
  } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    e.preventDefault();
    setFollow(false);
    viewT0 += ((e.shiftKey ? e.deltaY : 0) + e.deltaX) / (W - LW) * span();
  }
}, { passive: false });

over.addEventListener('pointerdown', e => {
  const t = e.offsetX / over.clientWidth * DURATION;
  if (clock.mode) clock.seek(t);
  if (!follow) viewT0 = t - span() * 0.3;
});

function setZoom(z, at, x) {
  zoom = clamp(z, 0, ZOOMS.length - 1);
  $('zoomLabel').textContent = span() >= 60 ? `${Math.round(span() / 60)} min` : `${span()} s`;
  if (!follow && at != null) viewT0 = at - (x - LW) / (W - LW) * span();
}
function setFollow(f) { follow = f; $('follow').checked = f; }
function toggleLoop(Ln) {
  if (loop && loop.line === Ln) { loop = null; }
  else {
    loop = { a: Math.max(0, Ln.s.s0 - 1), b: Math.min(DURATION, Ln.s.s1 + 1), line: Ln };
    clock.seek(loop.a);
    if (!clock.playing) clock.play();
  }
  $('loopchip').hidden = !loop;
  if (loop) $('loopText').textContent = `Looping ${Ln.text}`;
}

// nudging: ⌥← ⌥→ move the selection by 10 ms, with ⇧ by 50 ms
function nudge(dt) {
  if (!editable || !sel) return;
  const op = makeOp(sel);
  if (!op) return;
  op.apply(dt);
  if (!op.moved) return;
  commitOp(op);
  replayAt(op.focus, 450);
}

function stepSelection(dir) {
  if (!sel || sel.kind !== 'sylls') {
    // start from the syllable at the playhead
    const t = clock.mode ? clock.now() : 0;
    const s = SYLL.filter(y => sung(y.line.cue) && y.t0 >= t - 0.01).sort((a, b) => a.t0 - b.t0)[0];
    if (s) select({ kind: 'sylls', items: [{ L: s.line, k: s.k }], part: 'body' });
    return;
  }
  const items = [...sel.items].sort((a, b) => a.L.s.syllables[a.k].t0 - b.L.s.syllables[b.k].t0);
  const from = dir > 0 ? items[items.length - 1] : items[0];
  const next = stepSyll(from.L, from.k, dir);
  if (next) { select({ kind: 'sylls', items: [next], part: 'body' }); showTime(next.L.s.syllables[next.k].t0); }
}

$('play').addEventListener('click', () => { cancelReplay(); clock.playing ? clock.pause() : clock.play(); });
$('zoomIn').addEventListener('click', () => setZoom(zoom - 1));
$('zoomOut').addEventListener('click', () => setZoom(zoom + 1));
$('follow').addEventListener('change', e => setFollow(e.target.checked));
$('loopOff').addEventListener('click', () => { loop = null; $('loopchip').hidden = true; });
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('clicks').checked = ticks.on;
$('clicks').addEventListener('change', e => { ticks.on = e.target.checked; local.set('clicks', ticks.on); if (ticks.on) tickCtx(); });
$('replay').checked = local.get('replay', true);
$('replay').addEventListener('change', e => local.set('replay', e.target.checked));
$('download').addEventListener('click', download);
document.querySelectorAll('input[name=speed]').forEach(r => r.addEventListener('change', () => clock.setRate(+r.value)));
document.querySelectorAll('input[name=listen]').forEach(r => r.addEventListener('change', () => setSource(r.value)));
function setSource(v) {
  if (v === source) return;
  const t = clock.now(), was = clock.playing;
  if (was) clock.pause();
  source = v;
  if (clock.mode === 'media') {
    audioEl.src = v === 'vocals' ? (window.MV_VOCALS || ['audio/vocals.mp3'])[0] : (window.MV_AUDIO || ['audio/song.m4a'])[0];
    audioEl.addEventListener('loadedmetadata', () => { audioEl.currentTime = t; audioEl.playbackRate = clock.rate; if (was) clock.play(); }, { once: true });
    audioEl.load();
  } else {
    clock.offset = t;
    if (was) clock.play();
  }
}
function setSpeed(v) { const r = document.querySelector(`input[name=speed][value="${v}"]`); r.checked = true; clock.setRate(v); }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'radio' && e.target.type !== 'checkbox') return;
  const t = clock.mode ? clock.now() : 0;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.code === 'KeyY') { e.preventDefault(); redo(); }
  else if (mod) return;
  else if (e.code === 'KeyJ') { e.preventDefault(); if (!e.repeat && !tap && editable) tapDown(); }
  else if (e.code === 'Space') { e.preventDefault(); cancelReplay(); clock.playing ? clock.pause() : clock.play(); }
  else if (e.altKey && (e.code === 'ArrowRight' || e.code === 'ArrowLeft')) { e.preventDefault(); nudge((e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.05 : 0.01)); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); clock.seek(t + (e.shiftKey ? 5 : 1)); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); clock.seek(t - (e.shiftKey ? 5 : 1)); }
  else if (e.code === 'Tab') { e.preventDefault(); stepSelection(e.shiftKey ? -1 : 1); }
  else if (e.code === 'Escape') { select(null); calib = null; showCalib(); }
  else if (e.code === 'Backspace' || e.code === 'Delete') { if (editable) { e.preventDefault(); deleteSelected(); } }
  else if (e.code === 'KeyC') { if (editable) toggleChecked(); }
  else if (e.code === 'KeyK') { $('clicks').click(); }
  else if (e.key === '+' || e.key === '=') setZoom(zoom - 1);
  else if (e.key === '-' || e.key === '_') setZoom(zoom + 1);
  else if (e.code === 'KeyF') setFollow(!follow);
  else if (e.code === 'KeyL') { loop = null; $('loopchip').hidden = true; }
  else if (e.key === '1') setSpeed(1);
  else if (e.key === '2') setSpeed(0.75);
  else if (e.key === '3') setSpeed(0.5);
});
addEventListener('keyup', e => { if (e.code === 'KeyJ') tapUp(); });
addEventListener('blur', () => tapUp());

async function download() {
  const data = store.exportJSON();
  const filename = 'heart-sutra-timings.json';
  const downloads = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
  if (downloads) {
    try { await downloads.save({ filename, data }); } catch (err) { if (err && err.code !== 'declined') flashHint(`Couldn't save the file (${err.code})`); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------- start

function frame() {
  if (clock.mode) {
    const now = clock.now();
    if (loop && now >= loop.b) clock.seek(loop.a);
    if (replay && now >= replay.until) { clock.pause(); replay = null; }
    if (replay && !clock.playing && replay.until !== Infinity) replay = null;
    scheduleTicks();
  }
  $('play').textContent = clock.mode ? (clock.playing ? 'Pause' : 'Play') : 'Loading…';
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setZoom(zoom);
renderHistory();

(async () => {
  await store.open();
  editable = true;
  refresh(true);
  renderHistory();
  store.onStatus(store.status);
  if (store.error || store.fellBack) $('saveStatus').classList.add('warn');
  // for tests and the console
  window.timingEditor = {
    store, getValues,
    debug: { hits: () => hits, lanes: () => lanes, sel: () => sel, view(t, z) { setFollow(false); if (z != null) setZoom(z); viewT0 = t; } },
  };
})();

(async () => {
  const status = $('status');
  try {
    buffer = await loadAudio(window.MV_AUDIO || ['audio/song.m4a', 'audio/song.mp3']);
    features = analyse(buffer);
    const media = mediaReady();
    // the separated vocal track, if there is one, makes a much clearer picture
    try { vocals = await loadAudio(window.MV_VOCALS || ['audio/vocals.mp3']); } catch { vocals = null; }
    $('listen').hidden = !vocals;
    lanes.spec.label = vocals ? 'Vocals' : 'Audio';
    status.textContent = 'Analysing the audio…';
    spec = await spectrogram(vocals || buffer, p => { status.textContent = `Analysing the audio ${Math.round(p * 100)}%`; });
    specChunks = null;
    clock.mode = (await media) ? 'media' : 'webaudio';
    status.textContent = clock.mode === 'media' ? '' : 'Slower speeds also lower the pitch in this browser.';
  } catch (err) {
    status.textContent = `Couldn't load the song: ${err.message}`;
    console.error(err);
  }
})();
