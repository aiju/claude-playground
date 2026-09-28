// The real-time preview. The picture is drawn live at 30 fps from the audio
// clock, so what you see is in sync with what you hear; the soundtrack is
// synthesised once at load, the same way the final render will make it.

import { makeVirtual, FPS } from './lib/frame.js';
import { buildTimeline, SECTIONS } from './timeline.js';
import { makeShots } from './scenes/index.js';
import { renderFrame } from './render.js';
import { buildSoundtrack, RATE } from './audio/soundtrack.js';

const $ = (id) => document.getElementById(id);
const canvas = $('video');
const { ctx } = makeVirtual(canvas);

const state = { t: 0, playing: false, captions: true, loop: false, mute: { voice: false, sfx: false, music: false } };
let T, shots, sections, manifest;
let stems = null;
let actx = null, gains = {}, sources = [], startedAt = 0;

const fmt = (t, cs = true) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${(cs ? s.toFixed(2) : Math.floor(s).toString()).padStart(cs ? 5 : 2, '0')}`;
};

function status(msg, err = false) {
  $('status').textContent = msg;
  $('status').classList.toggle('err', err);
}

// Hash links like #t62.5 open at that moment (the artifact viewer passes only
// plain tokens through, so no "=").
function timeFromHash() {
  const m = /^#t(\d+(?:\.\d+)?)$/.exec(location.hash);
  return m ? Number(m[1]) : null;
}

async function load() {
  await Promise.all(['bold 16px "DejaVu Sans Mono"', '16px "DejaVu Sans Mono"', 'bold 16px "DejaVu Sans"', '16px "DejaVu Sans"'].map((f) => document.fonts.load(f)));
  manifest = await (await fetch('voice/manifest.json')).json();
  T = buildTimeline(manifest);
  shots = makeShots(T);
  // A section starts with its first shot.
  sections = SECTIONS.map((title, i) => ({ n: i + 1, title, start: shots.find((s) => s.section === i + 1).from }));
  sections.forEach((s, i) => (s.end = sections[i + 1]?.start ?? T.duration));
  buildScrubber();
  buildSectionList();
  state.t = Math.min(T.duration, timeFromHash() ?? 0);
  draw(true);
  window.framesReady = true;

  status('Decoding the narration…');
  const decoder = new OfflineAudioContext(1, 1, RATE);
  const clips = {};
  await Promise.all(Object.keys(T.lines).map(async (id) => {
    const buf = await (await fetch(`voice/${id}.mp3`)).arrayBuffer();
    clips[id] = new Float32Array((await decoder.decodeAudioData(buf)).getChannelData(0));
  }));
  status('Synthesising effects and music…');
  const t0 = performance.now();
  stems = await synthesise(clips);
  status(`Ready. Soundtrack built in ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
  $('play').disabled = false;
}

// ---- audio ---------------------------------------------------------------

// In a worker where possible; on the main thread if module workers aren't
// available.
async function synthesise(clips) {
  try {
    const worker = new Worker(new URL('./audio/worker.js', import.meta.url), { type: 'module' });
    const result = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => (e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.stems));
      worker.onerror = (e) => reject(new Error(e.message || 'worker failed'));
      worker.postMessage({ manifest, clips }, Object.values(clips).map((c) => c.buffer));
    });
    worker.terminate();
    return result;
  } catch (e) {
    console.warn('Building the soundtrack on the main thread:', e);
    return buildSoundtrack({ T, shots, clips });
  }
}

function ensureAudio() {
  if (actx) return;
  try {
    actx = new AudioContext({ sampleRate: RATE, latencyHint: 'playback' });
  } catch {
    actx = new AudioContext({ latencyHint: 'playback' });
  }
  for (const name of ['voice', 'sfx', 'music']) {
    const g = actx.createGain();
    g.gain.value = state.mute[name] ? 0 : 1;
    g.connect(actx.destination);
    gains[name] = { node: g, buffer: toBuffer(stems[name]) };
  }
}

function toBuffer(data) {
  const b = actx.createBuffer(1, data.length, RATE);
  b.copyToChannel(data, 0);
  return b;
}

function latency() {
  return actx ? (actx.outputLatency || 0) + (actx.baseLatency || 0) : 0;
}

// Where playback is, in video seconds: the audio clock minus the time the
// sound takes to reach the speakers.
function clock() {
  if (!state.playing) return state.t;
  return Math.max(state.t, state.t + actx.currentTime - startedAt - latency());
}

function startSources() {
  const when = actx.currentTime + 0.06;
  sources = Object.values(gains).map(({ node, buffer }) => {
    const s = actx.createBufferSource();
    s.buffer = buffer;
    s.connect(node);
    s.start(when, Math.min(state.t, buffer.duration));
    return s;
  });
  startedAt = when;
}

function stopSources() {
  for (const s of sources) {
    try { s.stop(); } catch { /* already stopped */ }
    s.disconnect();
  }
  sources = [];
}

async function play() {
  if (!stems) return;
  ensureAudio();
  await actx.resume();
  if (state.t >= T.duration - 0.05) state.t = 0;
  state.playing = true;
  startSources();
  $('play').textContent = 'Pause';
}

function pause() {
  if (!state.playing) return;
  state.t = clock();
  state.playing = false;
  stopSources();
  $('play').textContent = 'Play';
  draw(true);
}

function seek(t) {
  t = Math.max(0, Math.min(T.duration, t));
  if (state.playing) {
    stopSources();
    state.t = t;
    startSources();
  } else {
    state.t = t;
  }
  draw(true);
}

// ---- drawing -------------------------------------------------------------

let lastFrame = -1;
let lastError = null;
const perf = { ms: 0, n: 0 };

function draw(force = false) {
  const t = clock();
  const frame = Math.floor(t * FPS + 1e-6);
  if (!force && frame === lastFrame) return;
  lastFrame = frame;
  const t0 = performance.now();
  try {
    renderFrame(ctx, frame / FPS, T, shots, { captions: state.captions });
  } catch (e) {
    if (String(e) !== lastError) console.error(e);
    lastError = String(e);
    status(`Drawing failed at ${fmt(t)}: ${e.message}`, true);
  }
  perf.ms += performance.now() - t0;
  perf.n++;
  updateReadout(t);
}

function tick() {
  if (state.playing) {
    let t = clock();
    const sec = sectionAt(t);
    if (state.loop && t >= sec.end - 0.02) seek(sec.start);
    else if (t >= T.duration) {
      state.t = T.duration;
      pause();
    }
    draw();
  }
  requestAnimationFrame(tick);
}

// ---- readouts and controls -----------------------------------------------

const sectionAt = (t) => sections.findLast((s) => s.start <= t + 1e-6) || sections[0];

let lastSec = -1;
function updateReadout(t) {
  $('time').innerHTML = `${fmt(t)} <small>/ ${fmt(T.duration, false)}</small>`;
  const sec = sectionAt(t);
  if (sec.n !== lastSec) {
    lastSec = sec.n;
    $('sec-name').textContent = `§${sec.n} ${sec.title}`;
    document.querySelectorAll('.sec').forEach((el, i) => el.classList.toggle('on', i === sec.n - 1));
    document.querySelectorAll('.scrub .seg').forEach((el, i) => el.classList.toggle('on', i === sec.n - 1));
    drawLoop();
  }
  const hit = T.wordAt(t);
  if (hit) {
    const words = hit.line.words.map((w) => (w === hit.word ? `<b>${esc(w.w)}</b>` : esc(w.w))).join(' ');
    $('said').innerHTML = `${hit.line.id} · ${words}`;
  } else {
    $('said').innerHTML = '&nbsp;';
  }
  const pct = (100 * t) / T.duration;
  $('playhead').style.left = `${pct}%`;
  $('scrub').setAttribute('aria-valuenow', t.toFixed(1));
  $('scrub').setAttribute('aria-valuetext', fmt(t));
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function buildScrubber() {
  const el = $('scrub');
  el.setAttribute('aria-valuemax', T.duration.toFixed(1));
  const pct = (t) => `${(100 * t) / T.duration}%`;
  for (const s of sections) {
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.style.left = pct(s.start);
    seg.style.width = pct(s.end - s.start);
    seg.textContent = s.n;
    seg.title = `§${s.n} ${s.title}`;
    el.append(seg);
  }
  for (const l of Object.values(T.lines)) {
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = pct(l.start);
    tick.title = l.id;
    el.append(tick);
  }
  const loop = document.createElement('div');
  loop.className = 'loop';
  loop.id = 'loopband';
  loop.hidden = true;
  el.append(loop);
  const head = document.createElement('div');
  head.className = 'head-line';
  head.id = 'playhead';
  el.append(head);

  const at = (e) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * T.duration;
  };
  let dragging = false;
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    seek(at(e));
  });
  el.addEventListener('pointermove', (e) => dragging && seek(at(e)));
  el.addEventListener('pointerup', () => (dragging = false));
  el.addEventListener('pointercancel', () => (dragging = false));
}

function drawLoop() {
  const band = $('loopband');
  if (!band) return;
  band.hidden = !state.loop;
  const s = sectionAt(clock());
  band.style.left = `${(100 * s.start) / T.duration}%`;
  band.style.width = `${(100 * (s.end - s.start)) / T.duration}%`;
}

function buildSectionList() {
  const ol = $('sections');
  for (const s of sections) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'sec';
    b.innerHTML = `<span class="n">${s.n}</span><span>${esc(s.title)}</span><span class="t">${fmt(s.start, false)}</span>`;
    b.addEventListener('click', () => seek(s.start));
    li.append(b);
    ol.append(li);
  }
}

function toggle(id, on) {
  $(id).setAttribute('aria-pressed', String(on));
}

function setMute(name, mute) {
  state.mute[name] = mute;
  toggle(`t-${name}`, !mute);
  if (gains[name]) gains[name].node.gain.value = mute ? 0 : 1;
}

function jumpSection(d) {
  const t = clock();
  const i = sections.indexOf(sectionAt(t));
  // "Previous" from well inside a section goes back to its start first.
  const target = d < 0 && t - sections[i].start > 1.5 ? i : i + d;
  seek(sections[Math.max(0, Math.min(sections.length - 1, target))].start);
}

async function copyStamp() {
  const t = clock();
  const hit = T.wordAt(t);
  const s = `${fmt(t)} (§${sectionAt(t).n}${hit ? `, ${hit.line.id} “${hit.word.w}”` : ''})`;
  try {
    await navigator.clipboard.writeText(s);
    status(`Copied: ${s}`);
  } catch {
    status(`Copy this: ${s}`);
  }
}

$('play').addEventListener('click', () => (state.playing ? pause() : play()));
$('prev').addEventListener('click', () => jumpSection(-1));
$('next').addEventListener('click', () => jumpSection(1));
$('copy').addEventListener('click', copyStamp);
$('t-voice').addEventListener('click', () => setMute('voice', !state.mute.voice));
$('t-sfx').addEventListener('click', () => setMute('sfx', !state.mute.sfx));
$('t-music').addEventListener('click', () => setMute('music', !state.mute.music));
$('t-captions').addEventListener('click', () => {
  state.captions = !state.captions;
  toggle('t-captions', state.captions);
  draw(true);
});
$('t-loop').addEventListener('click', () => {
  state.loop = !state.loop;
  toggle('t-loop', state.loop);
  drawLoop();
});

document.addEventListener('keydown', (e) => {
  if (!T || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.('button') && (e.key === ' ' || e.key === 'Enter')) {
    if (e.key === ' ') e.preventDefault();
    else return;
  }
  const t = clock();
  const k = e.key;
  if (k === ' ') state.playing ? pause() : play();
  else if (k === 'ArrowLeft') seek(t - (e.shiftKey ? 5 : 1));
  else if (k === 'ArrowRight') seek(t + (e.shiftKey ? 5 : 1));
  else if (k === ',') { pause(); seek(Math.round(t * FPS - 1) / FPS); }
  else if (k === '.') { pause(); seek(Math.round(t * FPS + 1) / FPS); }
  else if (k === '[') jumpSection(-1);
  else if (k === ']') jumpSection(1);
  else if (k >= '1' && k <= '8') seek(sections[Number(k) - 1].start);
  else if (k === 'l' || k === 'L') $('t-loop').click();
  else if (k === 'c' || k === 'C') $('t-captions').click();
  else if (k === 'v' || k === 'V') $('t-voice').click();
  else if (k === 'e' || k === 'E') $('t-sfx').click();
  else if (k === 'm' || k === 'M') $('t-music').click();
  else return;
  e.preventDefault();
});
window.addEventListener('hashchange', () => {
  const t = timeFromHash();
  if (t !== null && T) seek(t);
});

// For scripted checks: draw the frame at time t and report how long it took.
window.renderAt = (t) => {
  state.t = t;
  draw(true);
  return perf.ms / perf.n;
};
window.perfStats = () => ({ avgMs: perf.ms / perf.n, frames: perf.n });

load()
  .then(() => (window.ready = true))
  .catch((e) => {
    console.error(e);
    status(`Couldn’t load: ${e.message}`, true);
  });
requestAnimationFrame(tick);
