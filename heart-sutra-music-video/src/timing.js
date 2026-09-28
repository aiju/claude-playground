// The timing checker: plays the song under a scrolling view of every
// syllable, lyric line, scene and scripted moment where the video currently
// puts them, over a spectrogram of the actual audio. Everything comes from
// the same modules the video uses, so it shows exactly what the video does.

import { CUES } from './lyrics.js';
import { scheduleCue, plain } from './schedule.js';
import { SCENES, SECTIONS, MOMENTS, DURATION } from './timeline.js';
import { loadAudio, analyse } from './audio.js';
import { spectrogram } from './spectrogram.js';

const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function fmt(t, dp = 2) {
  t = Math.max(0, t);
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(dp).padStart(dp ? dp + 3 : 2, '0')}`;
}

// ---------------------------------------------------------------- data

const LINES = CUES.filter(c => !c.deco).map((cue, i) => ({
  i, cue, s: scheduleCue(cue), text: plain(cue.text), sa: cue.script === 'sa',
}));
{
  const ends = [];
  for (const L of LINES) {
    let r = 0;
    while (ends[r] !== undefined && ends[r] > L.cue.t0 - 0.05) r++;
    ends[r] = L.cue.t1;
    L.row = r;
  }
  LINES.rows = ends.length;
}
const SYLL = LINES.flatMap(L => L.s.syllables.map((y, k) => ({ ...y, k, line: L })));
// the skandha kanji inside the five lights are written, not sung: show them as moments
const EVENTS = [
  ...MOMENTS,
  ...CUES.filter(c => c.deco).map(c => { const s = scheduleCue(c); return { t: s.s0, t1: c.t1, label: `${plain(c.text)} written in a light` }; }),
].sort((a, b) => a.t - b.t);
EVENTS.forEach((e, i) => { e.row = i % 2; });

// ---------------------------------------------------------------- audio clock
// Plays through an <audio> element (which can slow down without changing
// pitch); falls back to Web Audio if the element can't load the file.

const audioEl = $('song');
let buffer = null, features = null, spec = null;
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
      this.src.buffer = buffer;
      this.src.playbackRate.value = this.rate;
      this.src.connect(this.ctx.destination);
      this.src.start(0, this.offset);
      this.startedAt = this.ctx.currentTime;
    } else return;
    this.playing = true;
  },
  pause() {
    if (!this.playing) return;
    if (this.mode === 'media') audioEl.pause();
    else { this.offset = this.now(); this.src.stop(); }
    this.playing = false;
  },
  seek(t) {
    t = clamp(t, 0, DURATION);
    if (this.mode === 'media') { audioEl.currentTime = t; return; }
    const was = this.playing;
    if (was) this.pause();
    this.offset = t;
    if (was) this.play();
  },
  setRate(r) {
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

// ---------------------------------------------------------------- view state

const ZOOMS = [3, 5, 8, 12, 20, 30, 60, 120, 260];
let zoom = 3;               // index into ZOOMS
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
  for (const k of ['bg', 'surface', 'ink', 'ink-2', 'ink-3', 'rule', 'band-a', 'band-b', 'hover', 'ja', 'sa', 'moment', 'loop', 'ja-soft', 'sa-soft', 'sans', 'mono', 'deva']) {
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
    ['lines', LINES.rows * 22, 'Lines'],
    ['syll', LINES.rows * 38, 'Syllables'],
    ['spec', 128, 'Audio'],
    ['hits', 38, 'Drums · level'],
  ];
  let y = 0;
  lanes = {};
  for (const [id, h, label] of defs) { lanes[id] = { y, h, label }; y += h + (id === 'ruler' ? 2 : 6); }
  W = w; H = y;
  const dpr = devicePixelRatio || 1;
  roll.width = Math.round(W * dpr); roll.height = Math.round(H * dpr);
  roll.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  over.width = Math.round(over.clientWidth * dpr); over.height = Math.round(44 * dpr);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(layout).observe(roll.parentElement);
layout();

const xOf = t => LW + (t - viewT0) / span() * (W - LW);
const tOf = x => viewT0 + (x - LW) / (W - LW) * span();

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

// ---------------------------------------------------------------- drawing

let hits = [];   // hit boxes for hover and clicks, rebuilt every frame

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
    hits.push({ x0, x1, y0: y, y1: y + h, kind, it });
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

function draw() {
  const t = clock.mode ? clock.now() : 0;
  if (follow) viewT0 = clamp(t - span() * 0.3, -span() * 0.3, DURATION - span() * 0.7);
  hits = [];
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, W, H);
  const L = lanes;

  // ruler
  const pxPerS = (W - LW) / span();
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  const major = steps.find(s => s * pxPerS >= 72) || 60;
  const minor = steps.slice().reverse().find(s => s < major && s * pxPerS >= 9 && (major / s) % 1 === 0);
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

  // sections and scenes
  const sections = SECTIONS.map((s, i) => ({ ...s, t1: SECTIONS[i + 1] ? SECTIONS[i + 1].t0 : DURATION }));
  bands(L.sections, sections, null, s => s.name, 'section');
  const scenes = SCENES.map((s, i) => ({ ...s, t1: SCENES[i + 1] ? SCENES[i + 1].t0 : DURATION }));
  bands(L.scenes, scenes, (s, a, b, y, h) => { if (s.tr) hatch(a, xOf(s.t0 + s.tr), y, h); }, s => s.name, 'scene');

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
        } else {
          ctx.beginPath(); ctx.moveTo(a, cy - 5); ctx.lineTo(a + 5, cy); ctx.lineTo(a, cy + 5); ctx.lineTo(a - 5, cy); ctx.closePath(); ctx.fill();
        }
        const lx = Math.max(a + 7, LW + 4);
        text(e.label, lx, cy, { max: nextX - lx - 6, color: C.ink });
        hits.push({ x0: a - 5, x1: Math.max(b, a + 5), y0: cy - rowH / 2, y1: cy + rowH / 2, kind: 'moment', it: e });
      });
    });
  }

  // lines: thin bar while shown, block while sung
  {
    const { y } = L.lines;
    for (const Ln of LINES) {
      const ry = y + Ln.row * 22;
      const a = xOf(Ln.cue.t0), b = xOf(Ln.cue.t1), sa = xOf(Ln.s.s0), sb = xOf(Ln.s.s1);
      if (b < LW || a > W) continue;
      const col = Ln.sa ? C.sa : C.ja, soft = Ln.sa ? C['sa-soft'] : C['ja-soft'];
      ctx.fillStyle = C['ink-3'];
      ctx.fillRect(Math.max(a, LW), ry + 17, Math.min(b, W) - Math.max(a, LW), 2);
      ctx.fillStyle = soft;
      ctx.fillRect(Math.max(sa, LW), ry + 2, Math.max(0, Math.min(sb, W) - Math.max(sa, LW)), 13);
      ctx.fillStyle = col;
      if (sa >= LW) ctx.fillRect(sa, ry + 2, 2, 13);
      const lx = Math.max(sa, LW) + 5;
      text(Ln.text, lx, ry + 9, { color: C.ink, max: Math.max(b, sb) - lx - 4, font: `12px ${Ln.sa ? C.deva : C.sans}` });
      if (loop && loop.line === Ln) { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(Math.max(sa, LW) + 0.5, ry + 1.5, Math.min(Math.max(b, sb), W) - Math.max(sa, LW) - 1, 18); }
      hits.push({ x0: Math.min(a, sa), x1: Math.max(b, sb), y0: ry, y1: ry + 20, kind: 'line', it: Ln });
    }
  }

  // syllables: kanji (or the Devanagari line) above, sung syllable below
  {
    const { y } = L.syll;
    const now = clock.mode ? t : -1;
    for (const Ln of LINES) {
      if (xOf(Ln.s.s1) < LW || xOf(Ln.s.s0) > W) continue;
      const ry = y + Ln.row * 38;
      const col = Ln.sa ? C.sa : C.ja, soft = Ln.sa ? C['sa-soft'] : C['ja-soft'];
      if (Ln.sa) {
        const a = xOf(Ln.s.s0);
        text(Ln.text, Math.max(a, LW) + 2, ry + 7, { font: `13px ${C.deva}`, color: C['ink-2'], max: xOf(Ln.s.s1) - Math.max(a, LW) + 60 });
      } else {
        Ln.s.glyphs.forEach((g, gi) => {
          if (!g.reading || !g.morae.length) return;
          const ys = Ln.s.syllables.filter(s => s.glyph === gi);
          const a = xOf(ys[0].t0), b = xOf(ys[ys.length - 1].t1);
          if (b < LW || a > W) return;
          ctx.fillStyle = C['ink-3'];
          ctx.fillRect(Math.max(a + 1, LW), ry + 14, Math.max(0, b - Math.max(a + 1, LW) - 1), 1);
          text(g.ch, (a + b) / 2, ry + 7, { font: `13px ${C.sans}`, color: C.ink, align: 'center' });
        });
      }
      Ln.s.syllables.forEach(s => {
        const a = xOf(s.t0) + 1, b = xOf(s.t1) - 1;
        if (b < LW || a > W) return;
        const on = now >= s.t0 && now < s.t1;
        const x0 = Math.max(a, LW);
        ctx.fillStyle = on ? col : soft;
        ctx.fillRect(x0, ry + 17, Math.max(1, b - x0), 19);
        ctx.fillStyle = col;
        if (a >= LW) ctx.fillRect(a, ry + 17, 2, 19);
        const label = s.text;
        ctx.font = `12px ${Ln.sa ? C.mono : C.sans}`;
        if (ctx.measureText(label).width < b - a - 4) text(label, (a + b) / 2 + 1, ry + 27, { font: ctx.font, color: on ? C.surface : C.ink, align: 'center' });
        hits.push({ x0: a - 1, x1: b + 1, y0: ry, y1: ry + 38, kind: 'syll', it: s });
      });
    }
  }

  // spectrogram, with each assumed syllable onset drawn through it
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
      ctx.fillStyle = s.line.sa ? C.sa : C.ja;
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

  // loop region, hover line, playhead
  if (loop) {
    ctx.fillStyle = C.loop;
    const a = Math.max(xOf(loop.a), LW), b = Math.min(xOf(loop.b), W);
    if (b > a) ctx.fillRect(a, L.sections.y, b - a, H - L.sections.y);
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
  const section = SECTIONS.filter(s => s.t0 <= t).pop();
  const info = cur ? `shown ${fmt(cur.cue.t0, 1)}–${fmt(cur.cue.t1, 1)} · sung ${fmt(cur.s.s0, 2)}–${fmt(cur.s.s1, 2)}` : '';
  const html = `<span>Section <b>${section.name}</b></span><span>Scene <b>${scene.name}</b></span>${info ? `<span>${info}</span>` : ''}`;
  if (whereEl._html !== html) { whereEl.innerHTML = html; whereEl._html = html; }
  $('time').firstChild.textContent = `${fmt(t)} `;
}

// ---------------------------------------------------------------- interaction

const tip = $('tip');
function hitAt(x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h;
  }
  return null;
}
function describe(h) {
  const it = h.it;
  switch (h.kind) {
    case 'syll': {
      const Ln = it.line, g = Ln.s.glyphs[it.glyph];
      const what = Ln.sa ? `<b>${it.text}</b> in ${Ln.cue.roman}` : g.reading ? `<b>${it.text}</b> of ${g.ch}（${g.reading}）` : `<b>${it.text}</b>`;
      return `${what}<br>${Ln.text}<br><span class="t">${fmt(it.t0)} – ${fmt(it.t1)}</span>`;
    }
    case 'line': return `<b>${it.text}</b>${it.sa ? `<br>${it.cue.roman}` : ''}<br><span class="t">shown ${fmt(it.cue.t0, 1)}–${fmt(it.cue.t1, 1)} · sung ${fmt(it.s.s0)}–${fmt(it.s.s1)}</span><br>click to loop this line`;
    case 'moment': return `<b>${it.label}</b><br><span class="t">${fmt(it.t)}${it.t1 != null ? ` – ${fmt(it.t1)}` : ''}</span>`;
    case 'scene': return `Scene <b>${it.name}</b><br><span class="t">from ${fmt(it.t0, 1)}${it.tr ? `, handover takes ${it.tr} s` : ''}</span>`;
    case 'section': return `Section <b>${it.name}</b> (estimated)<br><span class="t">${fmt(it.t0, 1)} – ${fmt(it.t1, 1)}</span>`;
    case 'hit': return `Drum hit, strength ${it.s.toFixed(2)}<br><span class="t">${fmt(it.t)}</span>`;
  }
  return '';
}

let drag = null;
roll.addEventListener('pointerdown', e => {
  drag = { x: e.offsetX, t0: viewT0, moved: false };
  roll.setPointerCapture(e.pointerId);
});
roll.addEventListener('pointermove', e => {
  const x = e.offsetX, y = e.offsetY;
  if (drag && Math.abs(x - drag.x) > 4) {
    drag.moved = true;
    setFollow(false);
    viewT0 = drag.t0 - (x - drag.x) / (W - LW) * span();
  }
  const h = hitAt(x, y);
  hover = { x, y, t: tOf(x), hit: h };
  if (h && !drag?.moved) {
    tip.innerHTML = describe(h);
    tip.hidden = false;
    const r = roll.parentElement.getBoundingClientRect();
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(r.width - tw - 8, x + 14)}px`;
    tip.style.top = `${y + 16}px`;
  } else tip.hidden = true;
});
roll.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });
roll.addEventListener('pointerup', e => {
  const wasDrag = drag && drag.moved;
  drag = null;
  if (wasDrag || !clock.mode) return;
  const h = hitAt(e.offsetX, e.offsetY);
  if (h && h.kind === 'syll') { clock.seek(h.it.t0 - 0.3); if (!clock.playing) clock.play(); }
  else if (h && h.kind === 'line') toggleLoop(h.it);
  else if (e.offsetX >= LW) clock.seek(tOf(e.offsetX));
});
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

$('play').addEventListener('click', () => (clock.playing ? clock.pause() : clock.play()));
$('zoomIn').addEventListener('click', () => setZoom(zoom - 1));
$('zoomOut').addEventListener('click', () => setZoom(zoom + 1));
$('follow').addEventListener('change', e => setFollow(e.target.checked));
$('loopOff').addEventListener('click', () => { loop = null; $('loopchip').hidden = true; });
document.querySelectorAll('input[name=speed]').forEach(r => r.addEventListener('change', () => clock.setRate(+r.value)));
function setSpeed(v) { const r = document.querySelector(`input[name=speed][value="${v}"]`); r.checked = true; clock.setRate(v); }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'radio' && e.target.type !== 'checkbox') return;
  const t = clock.mode ? clock.now() : 0;
  if (e.code === 'Space') { e.preventDefault(); clock.playing ? clock.pause() : clock.play(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); clock.seek(t + (e.shiftKey ? 5 : 1)); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); clock.seek(t - (e.shiftKey ? 5 : 1)); }
  else if (e.key === '+' || e.key === '=') setZoom(zoom - 1);
  else if (e.key === '-' || e.key === '_') setZoom(zoom + 1);
  else if (e.code === 'KeyF') setFollow(!follow);
  else if (e.code === 'KeyL') { loop = null; $('loopchip').hidden = true; }
  else if (e.key === '1') setSpeed(1);
  else if (e.key === '2') setSpeed(0.75);
  else if (e.key === '3') setSpeed(0.5);
});

// ---------------------------------------------------------------- start

function frame() {
  if (loop && clock.mode && clock.now() >= loop.b) clock.seek(loop.a);
  $('play').textContent = clock.mode ? (clock.playing ? 'Pause' : 'Play') : 'Loading…';
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setZoom(zoom);

(async () => {
  const status = $('status');
  try {
    buffer = await loadAudio(window.MV_AUDIO || ['audio/song.m4a', 'audio/song.mp3']);
    features = analyse(buffer);
    const media = mediaReady();
    status.textContent = 'Analysing the audio…';
    spec = await spectrogram(buffer, p => { status.textContent = `Analysing the audio ${Math.round(p * 100)}%`; });
    specChunks = null;
    clock.mode = (await media) ? 'media' : 'webaudio';
    status.textContent = clock.mode === 'media' ? '' : 'Slower speeds also lower the pitch in this browser.';
  } catch (err) {
    status.textContent = `Couldn't load the song: ${err.message}`;
    console.error(err);
  }
})();
