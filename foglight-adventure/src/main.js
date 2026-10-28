// Boot: set up the renderer, input, audio, UI and game, then run the loop.

import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Models } from './models.js';
import './models2.js';
import { Game } from './game.js';

const canvas = document.getElementById('view');
let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  document.getElementById('ui').innerHTML = `<div class="fatal">Foglight needs WebGL2, which this browser doesn't seem to have.<br><small>${e.message}</small></div>`;
  throw e;
}
const input = new Input();
const audio = new Audio();
const ui = new UI(document.getElementById('ui'), input, audio);
const models = new Models(renderer.gl);
const game = new Game({ renderer, input, audio, ui, models });
window.game = game; // handy for poking at things from the console
window.input = input;

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'KeyM') {
    audio.setMuted(!audio.muted);
    ui.toast(audio.muted ? 'Sound off (M)' : 'Sound on (M)');
  }
});

const params = new URLSearchParams(location.search);
if (params.has('play')) game.newGame();
else game.toTitle();

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (window.__paused) { requestAnimationFrame(frame); return; }
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    input.poll();
    game.update(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 5) acc = 0;
  if (game.player && game.mode !== 'title') ui.refresh(game);
  game.draw(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
