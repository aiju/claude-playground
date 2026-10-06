// A small discrete-event simulation kernel in the style of SimPy.
//
// Time is a number of minutes since the scenario's epoch. A process is a
// generator that yields commands; the kernel resumes it when the command is
// satisfied. Sub-procedures compose with `yield*`.
//
//   function* clerk(sim) {
//     yield wait(10);          // ten minutes pass
//     yield until(540);        // until 9 a.m. on day 0
//     const v = yield signal;  // until someone calls signal.fire(v)
//   }

export const wait = (minutes) => ({ kind: 'wait', minutes });
export const until = (time) => ({ kind: 'until', time });

// A signal wakes every process waiting on it. A `once` signal stays fired, so
// waiting on it afterwards returns at once (like a process's `done`).
export class Signal {
  constructor(name = '', { once = false } = {}) {
    this.name = name;
    this.once = once;
    this.waiters = [];
    this.fired = false;
    this.value = undefined;
  }

  fire(value) {
    this.fired = true;
    this.value = value;
    const waiters = this.waiters;
    this.waiters = [];
    for (const resume of waiters) resume(value);
  }
}

// A resource with a fixed number of slots and a FIFO queue.
export class Resource {
  constructor(sim, capacity, name = '') {
    this.sim = sim;
    this.capacity = capacity;
    this.name = name;
    this.inUse = 0;
    this.queue = [];
  }

  get free() {
    return this.capacity - this.inUse;
  }

  request() {
    return { kind: 'acquire', resource: this };
  }

  release() {
    if (this.queue.length > 0) {
      const resume = this.queue.shift();
      this.sim.schedule(this.sim.now, () => resume());
    } else {
      this.inUse--;
    }
  }
}

export class Process {
  constructor(sim, gen, name) {
    this.sim = sim;
    this.gen = gen;
    this.name = name;
    this.done = new Signal(`${name} done`, { once: true });
    this.alive = true;
  }

  resume(value) {
    if (!this.alive) return;
    let result;
    try {
      result = this.gen.next(value);
    } catch (err) {
      this.alive = false;
      this.sim.reportError(this, err);
      return;
    }
    if (result.done) {
      this.alive = false;
      this.done.fire(result.value);
      return;
    }
    this.handle(result.value);
  }

  handle(cmd) {
    const sim = this.sim;
    if (cmd instanceof Signal) {
      if (cmd.fired && cmd.once) sim.schedule(sim.now, () => this.resume(cmd.value));
      else cmd.waiters.push((v) => sim.schedule(sim.now, () => this.resume(v)));
      return;
    }
    if (cmd instanceof Process) {
      this.handle(cmd.done);
      return;
    }
    switch (cmd && cmd.kind) {
      case 'wait':
        if (!(cmd.minutes >= 0)) throw new Error(`${this.name}: bad wait ${cmd.minutes}`);
        sim.schedule(sim.now + cmd.minutes, () => this.resume());
        return;
      case 'until':
        sim.schedule(Math.max(sim.now, cmd.time), () => this.resume());
        return;
      case 'acquire': {
        const r = cmd.resource;
        if (r.inUse < r.capacity) {
          r.inUse++;
          sim.schedule(sim.now, () => this.resume());
        } else {
          r.queue.push(() => this.resume());
        }
        return;
      }
      default:
        this.alive = false;
        sim.reportError(this, new Error(`${this.name}: unknown command ${JSON.stringify(cmd)}`));
    }
  }

  kill() {
    this.alive = false;
  }
}

export class Sim {
  constructor({ start = 0 } = {}) {
    this.now = start;
    this.heap = [];
    this.seq = 0;
    this.errors = [];
    this.onError = null;
  }

  schedule(time, fn) {
    if (time < this.now) time = this.now;
    const item = { time, seq: this.seq++, fn };
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(h[p], item)) break;
      h[i] = h[p];
      i = p;
    }
    h[i] = item;
  }

  spawn(gen, name = 'process') {
    const p = new Process(this, gen, name);
    this.schedule(this.now, () => p.resume());
    return p;
  }

  // Run every event due at or before `time`, then set the clock to `time`.
  runUntil(time) {
    const h = this.heap;
    let n = 0;
    while (h.length > 0 && h[0].time <= time) {
      const item = this.pop();
      this.now = item.time;
      item.fn();
      n++;
    }
    if (time > this.now) this.now = time;
    return n;
  }

  get nextEventTime() {
    return this.heap.length > 0 ? this.heap[0].time : Infinity;
  }

  pop() {
    const h = this.heap;
    const top = h[0];
    const last = h.pop();
    if (h.length > 0) {
      let i = 0;
      const n = h.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        let mv = last;
        if (l < n && less(h[l], mv)) { m = l; mv = h[l]; }
        if (r < n && less(h[r], mv)) { m = r; mv = h[r]; }
        if (m === i) break;
        h[i] = h[m];
        i = m;
      }
      h[i] = last;
    }
    return top;
  }

  reportError(process, err) {
    this.errors.push({ process: process.name, time: this.now, err });
    if (this.onError) this.onError(process, err);
    else console.error(`[sim t=${this.now.toFixed(1)}] ${process.name}:`, err);
  }
}

function less(a, b) {
  return a.time < b.time || (a.time === b.time && a.seq < b.seq);
}
