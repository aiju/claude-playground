// Batch production: lots of work that follow a routing from shop to shop.
//
// A lot is a quantity of something (frames, wheels, cones) moving through a
// list of steps. Each step is one of:
//
//   { op, group, room, min, take }   work by people of a group, `min` minutes
//                                    per unit, claimed `take` units at a time
//   { equip, room, minutes, perLoad } unattended time in equipment (a stove),
//                                    one load per `perLoad` units
//   { issue: [[item, perUnit], ...], group, room, min }
//                                    draw parts from a store, then work as op
//   { arrive, room }                 just get there (the end of a stream)
//
// When the next step is in another room, the lot waits for a messenger to
// carry it. "The batch shall not be broken at any operation" (Elbourne
// 1914), so a lot moves as a whole.
import { Signal } from './kernel.js';
import { walk, work } from './world.js';

export class Store {
  constructor(id, name, items = {}) {
    this.id = id;
    this.name = name;
    this.stock = new Map();
    this.ledger = [];
    for (const [item, qty] of Object.entries(items)) this.stock.set(item, qty);
    this.opening = new Map(this.stock);
  }

  qty(item) {
    return this.stock.get(item) || 0;
  }

  has(needs) {
    return needs.every(([item, n]) => this.qty(item) >= n);
  }

  take(needs, t, ref) {
    for (const [item, n] of needs) {
      this.stock.set(item, this.qty(item) - n);
      this.ledger.push({ t, item, qty: -n, ref });
    }
  }

  put(item, n, t, ref) {
    this.stock.set(item, this.qty(item) + n);
    this.ledger.push({ t, item, qty: n, ref });
  }
}

export class Production {
  constructor(world, { wipNode, onStep, onDone } = {}) {
    this.world = world;
    this.lots = [];
    this.active = new Set();
    this.moves = [];
    this.stores = new Map();
    this.equipment = new Map();
    this.wipNode = wipNode; // room id -> node id where lots wait
    this.onStep = onStep;
    this.onDone = onDone;
    this.changed = new Signal('production changed');
    this.seq = 0;
  }

  addStore(store) {
    this.stores.set(store.id, store);
    return store;
  }

  addEquipment(type, units) {
    this.equipment.set(type, units.map((u) => ({ ...u, load: null, until: 0 })));
  }

  // Start a lot at a step (0 by default) in a room.
  launch({ label, kind, qty, unit, routing, room, step = 0, batch = null, stage = null, priority }) {
    const lot = {
      id: `lot${++this.seq}`,
      label, kind, qty, unit, routing, batch, stage,
      step, room, state: 'waiting', left: 0, inHand: 0, carrier: null, holders: new Set(),
      priority: priority ?? this.seq, history: [], born: this.world.sim.now,
    };
    this.lots.push(lot);
    this.active.add(lot);
    this.enter(lot, step);
    return lot;
  }

  get now() {
    return this.world.sim.now;
  }

  current(lot) {
    return lot.routing[lot.step];
  }

  enter(lot, k) {
    lot.step = k;
    const s = lot.routing[k];
    if (!s) return this.finish(lot);
    if (s.skipIf && s.skipIf(lot)) return this.enter(lot, k + 1);
    if (s.room && s.room !== lot.room) {
      lot.state = 'awaiting move';
      lot.moveTo = s.room;
      this.moves.push(lot);
      this.note(lot, `waiting to be carried to ${this.roomName(s.room)}`);
      this.changed.fire();
      return;
    }
    if (s.arrive) return this.advance(lot);
    if (s.equip) return this.queueEquipment(lot, s);
    lot.state = 'waiting';
    lot.left = lot.qty;
    lot.inHand = 0;
    this.changed.fire();
  }

  advance(lot) {
    const s = this.current(lot);
    if (s && s.stage) lot.stage = s.stage;
    this.onStep?.(lot, s);
    this.enter(lot, lot.step + 1);
  }

  finish(lot) {
    lot.state = 'done';
    lot.finished = this.now;
    this.active.delete(lot);
    this.note(lot, 'finished');
    this.onDone?.(lot);
    this.changed.fire();
  }

  note(lot, text) {
    lot.history.push({ t: this.now, text, room: lot.room });
  }

  roomName(id) {
    return this.world.site.rooms.get(id)?.name || id;
  }

  // --- Work at a group's bench --------------------------------------------

  // The oldest lot waiting for work from one of these groups, with units
  // still unclaimed and (for issues) the parts in the store.
  claimable(groups) {
    let best = null;
    for (const lot of this.active) {
      const s = this.current(lot);
      if (!s || (!s.op && !s.issue) || lot.state === 'awaiting move' || lot.state === 'moving' || lot.state === 'equip') continue;
      if (!groups.includes(s.group) || lot.left <= 0) continue;
      if (s.issue && lot.inHand === 0 && lot.left === lot.qty) {
        const store = this.stores.get(s.store);
        if (!store.has(s.issue.map(([item, per]) => [item, per * lot.qty]))) {
          lot.short = true;
          continue;
        }
      }
      if (!best || lot.priority < best.priority) best = lot;
    }
    return best;
  }

  // A worker's loop: claim units, do them, hand them back, repeat.
  *worker(p, groups, { efficiency = 1, idle = 'waiting for work', describe } = {}) {
    const world = this.world;
    for (;;) {
      const lot = this.claimable(groups);
      if (!lot) {
        yield* work(world, p, world.rng.uniform(4, 12), idle);
        continue;
      }
      const s = this.current(lot);
      if (s.issue && lot.left === lot.qty && lot.inHand === 0) {
        const store = this.stores.get(s.store);
        store.take(s.issue.map(([item, per]) => [item, per * lot.qty]), this.now, lot.label);
        lot.short = false;
        this.note(lot, `parts issued from the ${store.name}`);
      }
      const [lo, hi] = s.take || [lot.qty, lot.qty];
      const n = Math.min(lot.left, Math.max(1, Math.round(world.rng.uniform(lo, hi))));
      lot.left -= n;
      lot.inHand += n;
      lot.state = 'working';
      lot.holders.add(p.id);
      p.job = { lot, n, step: s };
      const minutes = (n * s.min) / efficiency;
      yield* work(world, p, minutes, describe ? describe(s, lot, n) : `${s.op}: ${lot.label}`);
      p.job = null;
      lot.holders.delete(p.id);
      lot.inHand -= n;
      p.output = (p.output || 0) + n;
      if (lot.left <= 0 && lot.inHand <= 0) {
        this.note(lot, `${s.op} done`);
        this.advance(lot);
      } else if (lot.inHand <= 0) {
        lot.state = 'waiting';
      }
    }
  }

  // --- Carrying lots between shops ------------------------------------------

  claimMove() {
    const lot = this.moves.shift();
    return lot || null;
  }

  *messenger(p, { base, idle = 'waiting at the counter for a job' } = {}) {
    const world = this.world;
    for (;;) {
      const lot = this.claimMove();
      if (!lot) {
        yield* work(world, p, world.rng.uniform(2, 6), idle);
        continue;
      }
      lot.state = 'fetching';
      yield* work(world, p, 0.01);
      const from = this.wipNode(lot.room);
      const to = this.wipNode(lot.moveTo);
      yield* walk(world, p, from, { mode: 'goods', activity: `going to fetch ${lot.label} from the ${this.roomName(lot.room)}` });
      lot.state = 'moving';
      lot.carrier = p;
      p.carrying = lot;
      this.note(lot, `carried by ${p.name}`);
      yield* walk(world, p, to, { mode: 'goods', activity: `carrying ${lot.label} to the ${this.roomName(lot.moveTo)}` });
      lot.room = lot.moveTo;
      lot.moveTo = null;
      lot.carrier = null;
      p.carrying = null;
      this.note(lot, `arrived in the ${this.roomName(lot.room)}`);
      this.enter(lot, lot.step);
      yield* walk(world, p, base, { activity: 'going back' });
    }
  }

  // --- Equipment (stoves and the like) --------------------------------------

  queueEquipment(lot, s) {
    lot.state = 'equip-wait';
    this.changed.fire();
    this.tryEquipment();
  }

  tryEquipment() {
    for (const lot of [...this.active].sort((a, b) => a.priority - b.priority)) {
      if (lot.state !== 'equip-wait') continue;
      const s = this.current(lot);
      const units = this.equipment.get(s.equip) || [];
      const need = Math.ceil(lot.qty / s.perLoad);
      const free = units.filter((u) => !u.load);
      if (free.length < need) continue;
      const use = free.slice(0, need);
      for (const u of use) {
        u.load = lot;
        u.until = this.now + s.minutes;
      }
      lot.state = 'equip';
      lot.equipUnits = use;
      this.note(lot, `in ${use.map((u) => u.label).join(' and ')} for ${s.minutes} minutes`);
      this.world.sim.schedule(this.now + s.minutes, () => {
        for (const u of use) u.load = null;
        lot.equipUnits = null;
        this.advance(lot);
        this.tryEquipment();
      });
    }
  }
}
