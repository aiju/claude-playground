// The train in service: it runs through the tunnel, brakes into each
// station, stands with its doors open, and pulls away for the next one.
//
// Distances are along the line, in metres: `distance` is how far the train
// has come. Station k's platform tunnel starts at stationStart(k); the train
// stops with its front a few metres short of the far end.

import { STATION } from './station.js';

export const SPACING = 520;              // from one station to the next
const FIRST = 380;                       // where the first one starts
export const ACCEL = 1.1, BRAKE = 1.05;  // m/s²
export const OVERRUN = 3;                // stop this far short of the end wall
export const DWELL = { open: 1.2, close: 15, leave: 18.5 };   // seconds after stopping

// The Victoria line, north to south
export const LINE = [
  'Walthamstow Central', 'Blackhorse Road', 'Tottenham Hale', 'Seven Sisters', 'Finsbury Park',
  'Highbury & Islington', "King's Cross St. Pancras", 'Euston', 'Warren Street', 'Oxford Circus',
  'Green Park', 'Victoria', 'Pimlico', 'Vauxhall', 'Stockwell', 'Brixton',
];

// The stations a train calls at on its way to `destination`, in order. A
// train for the depot goes by Seven Sisters.
export function route(destination) {
  const end = destination === 'Northumberland Park' ? 'Seven Sisters' : destination;
  const i = LINE.indexOf(end);
  if (i < 0) return LINE;
  // trains for the north end come from Brixton, the rest from Walthamstow
  return i <= 3 ? LINE.slice(i).reverse() : LINE.slice(0, i + 1);
}

export const stationStart = (k) => FIRST + k * SPACING;
export const stopAt = (k) => stationStart(k) + STATION.length - OVERRUN;

export function createService(trainLength) {
  const s = { phase: 'running', timer: 0, stop: 0, next: 0 };

  // the station to show: the one the train is at, or the next one
  function shownStation(distance) {
    return Math.max(0, Math.ceil((distance - trainLength - 30 - STATION.length - FIRST) / SPACING));
  }

  return {
    get phase() { return s.phase; },
    shownStation,
    // which stop comes next (or is where the train stands)
    nextStop(distance) {
      if (s.phase === 'dwell') return s.stop;
      // skip the stops already run past (with stops off, or after a jump)
      while (stopAt(s.next) < distance - 0.5) s.next++;
      return s.next;
    },
    // put the train some way short of station k, running in
    approach(state, k) {
      state.distance = stationStart(k) - 140;
      state.speed = Math.min(state.targetSpeed, 13);
      s.phase = 'running'; s.next = k;
    },
    // stand at station k with the doors open
    standAt(state, k) {
      state.distance = stopAt(k);
      state.speed = 0;
      s.phase = 'dwell'; s.timer = DWELL.open + 0.5; s.stop = k; s.next = k + 1;
    },
    // Moves the train on by dt. Returns 'open' or 'close' when the doors
    // should move.
    update(state, dt, stops) {
      let event = null;
      if (s.phase === 'dwell') {
        const before = s.timer;
        s.timer += dt;
        if (before < DWELL.open && s.timer >= DWELL.open) event = 'open';
        if (before < DWELL.close && s.timer >= DWELL.close) event = 'close';
        if (s.timer >= DWELL.leave) { s.phase = 'running'; s.next = s.stop + 1; }
        state.speed = 0;
        return event;
      }
      const k = this.nextStop(state.distance);
      const toGo = stopAt(k) - state.distance;
      const v = state.speed;
      let a;
      if (stops && toGo < v * v / (2 * BRAKE) + 1 + v * dt) {
        // brake to stop on the mark
        a = -Math.min(v * v / (2 * Math.max(toGo, 0.02)), 2.0);
      } else {
        const d = state.targetSpeed - v;
        a = d > 0 ? Math.min(ACCEL, d / dt) : Math.max(-BRAKE, d / dt);
      }
      state.speed = Math.max(0, v + a * dt);
      let step = state.speed * dt;
      if (stops && (step >= toGo || (toGo < 0.05 && state.speed < 0.3))) {
        step = Math.max(0, toGo);
        state.speed = 0;
        s.phase = 'dwell'; s.timer = 0; s.stop = k; s.next = k + 1;
      }
      state.distance += step;
      return event;
    },
  };
}
