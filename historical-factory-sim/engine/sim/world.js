// The world: people, things, the log, and the primitives processes use to
// move people about and make them work.
import { wait } from './kernel.js';

export const WALK_SPEED = 250; // feet per minute, about 2.8 miles an hour

export class World {
  constructor({ sim, cal, rng, site }) {
    this.sim = sim;
    this.cal = cal;
    this.rng = rng;
    this.site = site;
    this.people = [];
    this.peopleById = new Map();
    this.entities = new Map();
    this.logEntries = [];
    this.logListeners = [];
    this.nextId = 1;
  }

  id(prefix) {
    return `${prefix}${this.nextId++}`;
  }

  addPerson(props) {
    const p = new Person(props);
    this.people.push(p);
    this.peopleById.set(p.id, p);
    this.entities.set(p.id, p);
    return p;
  }

  register(entity) {
    this.entities.set(entity.id, entity);
    return entity;
  }

  log(text, { kind = 'info', refs = [] } = {}) {
    const entry = { t: this.sim.now, text, kind, refs };
    this.logEntries.push(entry);
    if (this.logEntries.length > 2000) this.logEntries.splice(0, 500);
    for (const fn of this.logListeners) fn(entry);
    return entry;
  }
}

export class Person {
  constructor(props) {
    this.node = null;
    this.motion = null;
    this.activity = 'at home';
    this.onSite = false;
    Object.assign(this, props);
  }
}

// Walk a person along the shortest path to a node. The path and its timing
// are kept in `motion` so the renderer can draw them in between events.
// `elapsed` starts the walk that many minutes in, for someone who was
// already on the way when the sim began.
export function* walk(world, p, target, { mode = 'person', speed = WALK_SPEED, activity, elapsed = 0 } = {}) {
  if (!p.node) throw new Error(`${p.name} has no position`);
  if (p.node === target) return;
  const site = world.site;
  const path = site.path(p.node, target, mode);
  const pts = [];
  const ts = [];
  let t = world.sim.now - elapsed;
  let prev = null;
  for (const id of path) {
    const n = site.node(id);
    if (prev) {
      const dy = Math.abs(n.y - prev.y);
      const flat = Math.hypot(n.x - prev.x, n.z - prev.z);
      const len = mode === 'goods' && dy > 0 ? 1.5 * speed : flat + dy * 3;
      t += len / speed;
    }
    pts.push([n.x, n.y, n.z]);
    ts.push(t);
    prev = n;
  }
  if (activity) p.activity = activity;
  p.motion = { pts, ts };
  yield wait(Math.max(0, t - world.sim.now));
  p.node = target;
  p.motion = null;
}

// Where a person is drawn at time t.
export function positionAt(world, p, t, out = [0, 0, 0]) {
  const m = p.motion;
  if (m && t < m.ts[m.ts.length - 1]) {
    const { pts, ts } = m;
    if (t <= ts[0]) return copy(out, pts[0]);
    let i = 1;
    while (i < ts.length - 1 && ts[i] < t) i++;
    const span = ts[i] - ts[i - 1];
    const f = span > 0 ? (t - ts[i - 1]) / span : 1;
    const a = pts[i - 1];
    const b = pts[i];
    out[0] = a[0] + (b[0] - a[0]) * f;
    out[1] = a[1] + (b[1] - a[1]) * f;
    out[2] = a[2] + (b[2] - a[2]) * f;
    return out;
  }
  if (m) return copy(out, m.pts[m.pts.length - 1]);
  const n = world.site.node(p.node);
  out[0] = n.x;
  out[1] = n.y;
  out[2] = n.z;
  return out;
}

function copy(out, v) {
  out[0] = v[0];
  out[1] = v[1];
  out[2] = v[2];
  return out;
}

// Spend `minutes` of working time. Work stops at the end of each spell of
// the person's timetable and the person's `offDuty` routine runs (breakfast,
// dinner, home for the night); then the work carries on where it left off.
//
// If `job` is given and gets `abandoned` while the person is off duty (off
// sick, say, and the foreman has given the work to someone else), the work
// stops there.
export function* work(world, p, minutes, activity, job = null) {
  let left = minutes;
  while (left > 1e-6) {
    if (job && job.abandoned) return;
    const spell = p.timetable.currentSpell(world.sim.now);
    if (!spell) {
      yield* p.offDuty(world, p);
      continue;
    }
    if (activity) p.activity = activity;
    const chunk = Math.min(left, spell[1] - world.sim.now);
    yield wait(chunk);
    left -= chunk;
  }
}

// Make sure the person is at work before doing something that isn't
// measured in working time (like walking across the yard).
export function* onDuty(world, p) {
  while (!p.timetable.currentSpell(world.sim.now)) yield* p.offDuty(world, p);
}
