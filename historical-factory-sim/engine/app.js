// Boots a scenario: builds the sim and the view, and runs the clock.
//
// URL parameters, handy for looking at a particular moment:
//   ?t=1913-03-03T10:30   start at that time (people are placed at work)
//   ?speed=300            sim seconds per real second
//   ?cut=1 | open         peel the buildings
//   ?cam=engine-house     a camera preset
//   ?seed=7               a different random week
//   ?paused=1
import { View } from './render/view.js';
import { UI } from './ui/ui.js';

export function startApp({ createScenario, container, overlay }) {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') ? Number(params.get('seed')) : undefined;
  let start;
  const tParam = params.get('t');
  let scenario = createScenario({ seed });
  if (tParam) {
    const m = tParam.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
    if (m) {
      start = scenario.cal.at(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
      scenario = createScenario({ seed, start });
    }
  }
  const sim = scenario.sim;

  const clock = {
    t: sim.now,
    speed: Number(params.get('speed')) || 60,
    paused: params.get('paused') === '1',
    skipToNextMorning() {
      const cal = scenario.cal;
      let target = cal.dayStart(this.t) + 1440 + 5 * 60 + 40;
      while (scenario.timetables.works.isHoliday(target) || cal.dow(target) === 0) target += 1440;
      sim.runUntil(target);
      this.t = target;
    },
  };

  const view = new View(container, scenario);
  if (params.get('cam')) view.setPreset(params.get('cam'));
  const cut = params.get('cut');
  if (cut) view.setCut(cut === 'open' ? 'open' : cut === 'roofs' ? Infinity : Number(cut));
  const ui = new UI(overlay, { scenario, view, clock });
  ui.refreshButtons();

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!clock.paused) clock.t += (dt * clock.speed) / 60;
    sim.runUntil(clock.t);
    view.frame(clock.t, dt, now / 1000);
    ui.update(clock.t, now);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.factory = { scenario, view, clock, ui };
  return window.factory;
}
