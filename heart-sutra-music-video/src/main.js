// Entry point. In the browser it plays the song and draws in real time;
// with ?capture it exposes window.mv.renderAt(t) for the offline renderer.

import { Renderer } from './renderer.js';
import { TextLayer, loadFonts } from './text.js';
import { loadAudio, analyse, featuresAt } from './audio.js';
import { sceneAt, fadeAt, SCENES, DURATION } from './timeline.js';

const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const width = +(params.get('w') || 1920);
const height = +(params.get('h') || 1080);

const canvas = document.getElementById('view');
canvas.width = width;
canvas.height = height;

const renderer = new Renderer(canvas);
const text = new TextLayer(width, height);
let features = null;

function frameState(t) {
  const s = sceneAt(t);
  const f = features ? featuresAt(features, t) : { level: 0, pulse: 0, beat: 0, hits: Array(8).fill([99, 0]) };
  return {
    time: t,
    a: s.a.scene, vA: s.a.v || 0, tA: t - s.a.t0,
    b: s.b ? s.b.scene : null, vB: s.b ? s.b.v || 0 : 0, tB: s.b ? t - s.b.t0 : 0,
    mix: s.mix, trans: s.b ? s.b.style || 0 : 0,
    fade: fadeAt(t), ...f,
  };
}

function render(t) {
  text.draw(t);
  renderer.draw(frameState(t), text);
}

async function init() {
  await loadFonts();
  const buffer = await loadAudio('audio/song.m4a');
  features = analyse(buffer);
}

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

if (!capture) {
  const audio = document.getElementById('song');
  const ui = document.getElementById('ui');
  const scrub = document.getElementById('scrub');
  const label = document.getElementById('label');
  scrub.max = DURATION;
  const start = params.get('t');
  if (start) audio.currentTime = +start;

  const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const loop = () => {
    const t = audio.currentTime;
    render(t);
    scrub.value = t;
    label.textContent = `${fmt(t)} · ${sceneAt(t).a.name}`;
    requestAnimationFrame(loop);
  };
  ready.then(() => { ui.classList.add('ready'); requestAnimationFrame(loop); });

  const toggle = () => (audio.paused ? audio.play() : audio.pause());
  canvas.addEventListener('click', toggle);
  document.getElementById('play').addEventListener('click', toggle);
  audio.addEventListener('play', () => ui.classList.add('playing'));
  audio.addEventListener('pause', () => ui.classList.remove('playing'));
  scrub.addEventListener('input', () => { audio.currentTime = +scrub.value; });
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') audio.currentTime += 5;
    if (e.code === 'ArrowLeft') audio.currentTime -= 5;
    if (e.code === 'KeyF') document.documentElement.requestFullscreen?.();
  });
}
