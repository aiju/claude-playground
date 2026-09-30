// The controls panel.

import { DESTINATIONS } from './views.js';

export function buildUI(app) {
  const $ = (id) => document.getElementById(id);
  const panel = $('panel');
  panel.hidden = false;

  // scenes
  for (const b of panel.querySelectorAll('[data-scene]')) b.addEventListener('click', () => app.setScene(b.dataset.scene));
  // views, one row per scene
  const viewRow = $('views');
  const viewButtons = Object.entries(app.views).map(([name, v]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = v.label;
    b.dataset.view = name;
    b.dataset.group = v.group;
    b.addEventListener('click', () => app.setView(name));
    viewRow.append(b);
    return b;
  });
  $('doors').addEventListener('click', () => app.toggleDoors());
  const speed = $('speed');
  speed.addEventListener('input', () => app.setSpeedKmh(+speed.value));
  const dest = $('dest');
  for (const d of DESTINATIONS) dest.append(new Option(d, d));
  dest.addEventListener('change', () => app.setDestination(dest.value));
  $('stops').addEventListener('click', () => app.setStops(!app.state.stops));
  $('lights').addEventListener('click', () => app.setLights(!app.state.lights));
  $('sound').addEventListener('click', () => app.setSound(!app.soundOn));
  $('hide').addEventListener('click', () => document.body.classList.add('bare'));
  $('show').addEventListener('click', () => document.body.classList.remove('bare'));

  const speedOut = $('speedOut');
  let shown = null;
  return {
    refresh() {
      const s = app.state;
      const here = app.views[s.view].group;
      document.body.dataset.scene = s.scene;
      for (const b of panel.querySelectorAll('[data-scene]')) b.setAttribute('aria-pressed', String(b.dataset.scene === here));
      for (const b of viewButtons) {
        b.hidden = b.dataset.group !== here;
        b.setAttribute('aria-pressed', String(b.dataset.view === s.view));
      }
      $('stops').setAttribute('aria-pressed', String(s.stops));
      $('doors').textContent = s.doorTarget ? 'Close doors' : 'Open doors';
      speed.value = Math.round(s.targetSpeed * 3.6);
      dest.value = s.destination;
      $('lights').setAttribute('aria-pressed', String(s.lights));
      $('sound').setAttribute('aria-pressed', String(app.soundOn));
    },
    // the speedometer
    tick() {
      const kmh = Math.round(app.state.speed * 3.6);
      if (kmh !== shown) { shown = kmh; speedOut.textContent = `${kmh} km/h`; }
    },
  };
}
