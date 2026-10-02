// The other train: one running the other way, in the other tunnel, to the
// other end of the line. It only matters at the station on screen, so there
// is only ever one, and it is sent in to that station to arrive at about the
// same time as ours, a little before or after. It waits out of sight down its
// tunnel, comes in, stops, opens its doors (its platform is on its right too)
// and leaves again.
//
// Distances are along its own track (path.js's OtherTrack), the way it runs.

import { BRAKE, ACCEL, DWELL, OVERRUN, stationStart } from './service.js';
import { STATION } from './station.js';
import { rng } from './textures.js';

const CRUISE = 15;                       // m/s
// it sets off far enough out that it can't be seen from the platform
const NEAREST = STATION.length + 20;
const FURTHEST = 330;

export function createOtherService({ track, trainLength }) {
  const r = rng(77);
  const s = { phase: 'away', beta: -1e6, speed: 0, timer: 0, station: -1, stopBeta: 0, offset: 0 };
  // seconds to come to a stand from `d` metres out, running in at CRUISE
  const timeFrom = (d) => d / CRUISE + CRUISE / (2 * BRAKE);

  return {
    get phase() { return s.phase; },
    get beta() { return s.beta; },
    get speed() { return s.speed; },
    get visible() { return s.phase === 'in' || s.phase === 'dwell' || s.phase === 'out'; },
    // how far it still has to go to its stop (null if it isn't coming)
    get toStop() { return s.phase === 'in' ? s.stopBeta - s.beta : s.phase === 'dwell' ? 0 : null; },
    // seconds before it is due, while it waits to set off
    dueIn(timeToOurs) { return s.phase === 'waiting' && timeToOurs !== null ? Math.max(timeToOurs + s.offset, timeFrom(NEAREST)) : null; },

    // a new station on screen: wait for our train to come in to it
    newStation(k) {
      s.station = k;
      // its front stops 3 m short of its end of the platform, which is
      // where our trains come in
      s.stopBeta = track.betaAt(stationStart(k) + OVERRUN);
      s.offset = -12 + r() * 32;            // seconds after ours
      s.phase = 'waiting';
      s.beta = s.stopBeta - FURTHEST - 500;
      s.speed = 0;
    },
    // stand at station k with the doors open (for stills)
    standAt(k) {
      this.newStation(k);
      s.beta = s.stopBeta;
      s.phase = 'dwell';
      s.timer = DWELL.open + 0.5;
    },

    // Moves it on by dt. `timeToOurs` is how long until our train stands at
    // this station (0 once it has), or null if it isn't coming here. Returns
    // 'open' or 'close' when the doors should move.
    update(dt, timeToOurs) {
      let event = null;
      if (s.phase === 'waiting') {
        if (timeToOurs === null) return null;
        const when = timeToOurs + s.offset;
        if (when <= timeFrom(FURTHEST)) {
          const d = Math.min(FURTHEST, Math.max(NEAREST, CRUISE * (when - CRUISE / (2 * BRAKE))));
          s.beta = s.stopBeta - d;
          s.speed = CRUISE;
          s.phase = 'in';
        }
        return null;
      }
      if (s.phase === 'dwell') {
        const before = s.timer;
        s.timer += dt;
        if (before < DWELL.open && s.timer >= DWELL.open) event = 'open';
        if (before < DWELL.close && s.timer >= DWELL.close) event = 'close';
        if (s.timer >= DWELL.leave) s.phase = 'out';
        return event;
      }
      if (s.phase === 'in') {
        const toGo = s.stopBeta - s.beta, v = s.speed;
        const a = toGo < v * v / (2 * BRAKE) + 1 + v * dt ? -Math.min(v * v / (2 * Math.max(toGo, 0.02)), 2.0) : 0;
        s.speed = Math.max(0, v + a * dt);
        let step = s.speed * dt;
        if (step >= toGo || (toGo < 0.05 && s.speed < 0.3)) {
          step = Math.max(0, toGo);
          s.speed = 0;
          s.phase = 'dwell';
          s.timer = 0;
        }
        s.beta += step;
        return null;
      }
      if (s.phase === 'out') {
        s.speed = Math.min(CRUISE, s.speed + ACCEL * dt);
        s.beta += s.speed * dt;
        if (s.beta - trainLength > s.stopBeta + FURTHEST) s.phase = 'away';
      }
      return null;
    },
  };
}
