// Entry point. In the browser it plays the song and draws in real time;
// with ?capture it exposes window.mv.renderAt(t) for the offline renderer.

import { Renderer } from './renderer.js';
import { TextLayer, loadFonts, prepareWriting } from './text.js';
import { loadAudio, analyse, featuresAt } from './audio.js';
import { sceneAt, fadeAt, beatsOf, SCENES, DURATION } from './timeline.js';
import { CUES } from './lyrics.js';

const params = new URLSearchParams(location.search);
const FPS = 30;   // the frame rate the video will be rendered at; the frame-step buttons step by one of these
const capture = params.has('capture');

const canvas = document.getElementById('view');
const renderer = new Renderer(canvas);
let text;
let features = null;
let buffer = null;

function setResolution(height, width = Math.round(height * 16 / 9)) {
  canvas.width = width;
  canvas.height = height;
  text = new TextLayer(width, height);
  for (const cue of CUES) delete cue._layout;   // layouts are in pixels
}
setResolution(+(params.get('h') || 1080), params.get('w') ? +params.get('w') : undefined);

function frameState(t) {
  const s = sceneAt(t);
  const f = features ? featuresAt(features, t) : { level: 0, pulse: 0, beat: 0, hits: Array(16).fill([99, 0, 0, 0]), accents: Array(8).fill([99, 0, 0, 0]) };
  return {
    time: t,
    a: s.a.scene, vA: s.a.v || 0, tA: t - s.a.t0,
    b: s.b ? s.b.scene : null, vB: s.b ? s.b.v || 0 : 0, tB: s.b ? t - s.b.t0 : 0,
    beatsA: beatsOf(s.a), beatsB: s.b ? beatsOf(s.b) : null,
    mix: s.mix, trans: s.b ? s.b.style || 0 : 0,
    fade: fadeAt(t), ...f,
  };
}

function render(t) {
  text.draw(t);
  renderer.draw(frameState(t), text);
}

// Every shader program the video uses: each scene, and each handover.
function programKeys() {
  const keys = [];
  SCENES.forEach((s, i) => {
    keys.push([s.scene, null]);
    if (i > 0 && s.tr > 0) keys.push([SCENES[i - 1].scene, s.scene]);
  });
  return keys;
}

async function init(status = () => {}) {
  status('Loading fonts');
  await loadFonts();
  await prepareWriting(p => status(`Preparing brush strokes ${Math.round(p * 100)}%`));
  status('Loading the song');
  buffer = await loadAudio(window.MV_AUDIO || ['audio/song.m4a', 'audio/song.mp3']);
  features = analyse(buffer);
  if (!capture) await renderer.warm(programKeys(), p => status(`Compiling shaders ${Math.round(p * 100)}%`));
}

if (capture) {
  const ready = init();
  window.mv = {
    ready,
    scenes: SCENES,
    duration: DURATION,
    async renderAt(t) {
      await ready;
      render(t);
      renderer.finish();
    },
  };
} else {
  startPlayer();
}

function startPlayer() {
  const ui = document.getElementById('ui');
  const playBtn = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const label = document.getElementById('label');
  const sceneSel = document.getElementById('scene');
  const resSel = document.getElementById('res');
  const status = document.getElementById('status');
  scrub.max = DURATION;
  for (const s of SCENES) sceneSel.add(new Option(`${fmt(s.t0)}  ${s.name}`, s.t0));

  // Web Audio clock: the song plays from a decoded buffer, and its playback
  // position drives the picture.
  let ctx = null, source = null, playing = false, offset = +(params.get('t') || 0), startedAt = 0;
  const now = () => (playing ? ctx.currentTime - startedAt : offset);
  function play() {
    if (!buffer) return;
    ctx = ctx || new AudioContext();
    if (offset >= DURATION - 0.1) offset = 0;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0, offset);
    startedAt = ctx.currentTime - offset;
    playing = true;
    ui.classList.add('playing');
  }
  function pause() {
    if (!playing) return;
    offset = now();
    source.stop();
    playing = false;
    ui.classList.remove('playing');
  }
  function seek(t) {
    const was = playing;
    if (was) pause();
    offset = Math.min(DURATION, Math.max(0, t));
    if (was) play();
  }
  const toggle = () => (playing ? pause() : play());
  // step one frame (at FPS) either way, pausing first and landing on a frame
  const step = n => { pause(); seek(Math.round(offset * FPS + n) / FPS); };

  // A frame that fails shouldn't stop the loop (the picture would freeze
  // while the song plays on): the error is logged once and shown in the label.
  let frames = 0, fpsAt = performance.now(), fps = 0, problem = null;
  canvas.addEventListener('webglcontextlost', () => { problem = 'the graphics context was lost'; });
  const loop = () => {
    let t = now();
    if (t >= DURATION) { pause(); offset = DURATION; t = DURATION; }
    try {
      render(t);
    } catch (err) {
      if (!problem) console.error(err);
      problem = err.message;
    }
    scrub.value = t;
    frames++;
    const n = performance.now();
    if (n - fpsAt > 1000) { fps = Math.round(frames * 1000 / (n - fpsAt)); frames = 0; fpsAt = n; }
    label.textContent = `${fmtFrame(t)} · ${sceneAt(t).a.name} · ${fps} fps${problem ? ` · error: ${problem}` : ''}`;
    requestAnimationFrame(loop);
  };

  init(msg => { status.textContent = msg; })
    .then(() => {
      ui.classList.add('ready');
      status.hidden = true;
      requestAnimationFrame(loop);
    })
    .catch(err => { status.textContent = `Couldn't start: ${err.message}`; console.error(err); });

  canvas.addEventListener('click', toggle);
  playBtn.addEventListener('click', toggle);
  document.getElementById('back').addEventListener('click', () => step(-1));
  document.getElementById('fwd').addEventListener('click', () => step(1));
  scrub.addEventListener('input', () => seek(+scrub.value));
  sceneSel.addEventListener('change', () => { seek(+sceneSel.value); sceneSel.blur(); });
  resSel.addEventListener('change', () => { setResolution(+resSel.value); resSel.blur(); });
  document.getElementById('full').addEventListener('click', () => {
    (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())?.catch?.(() => {});
  });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') seek(now() + 5);
    if (e.code === 'ArrowLeft') seek(now() - 5);
    if (e.code === 'KeyF') document.getElementById('full').click();
    if (e.code === 'Comma') step(-1);
    if (e.code === 'Period') step(1);
  });
}

function fmt(t) { return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }
// m:ss:ff, with ff the frame within the second
function fmtFrame(t) {
  const f = Math.round(t * FPS);
  return `${fmt(Math.floor(f / FPS))}:${String(f % FPS).padStart(2, '0')}`;
}
