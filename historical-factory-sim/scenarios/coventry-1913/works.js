// Production at the Sherbourne Works: routings, stores, stock orders, the
// Works Manager's programme, and the frame-number register.
//
// A batch ("sub-order") of machines splits into three streams that run side
// by side and meet in the Finishing Shop: frames and forks; bright parts
// (cranks, chainwheel, handlebars, brakework); and wheels. The order of
// shops follows Grew's tour of a cycle factory (1921) and Carter's 1912 list
// of Coventry shops; enamelling follows Cassell (1916): three coats, stoved
// at about 380 °F for an hour to an hour and a half, rubbed down between.
//
// Minutes per unit are estimates (no British times per operation survive),
// calibrated so that each department, at the headcount in staff.js, is about
// 85% busy at 270 machines a week, the spring peak.
import { Store } from '../../engine/sim/production.js';
import { work } from '../../engine/sim/world.js';
import { wait, until } from '../../engine/sim/kernel.js';
import {
  MODELS, BOUGHT, MADE, PROGRAMME_CYCLE, WEEKLY_MACHINES, FRAME_SIZES, modelName,
  frameIssue, brightIssue, wheelRoughIssue, wheelFinishedIssue, finishingIssue, finishingMadeIssue,
} from './catalogue.js';
import { onDespatchStep, onDespatchReady, machinesWanted } from './commerce.js';

// Which production group each trade works in, and how fast (learners and
// youths are slower).
export const GROUPS = {
  Turner: ['turner', 1], 'Machine minder': ['minder', 1], 'Machine minder (youth)': ['minder', 0.7],
  'Automatic minder': ['auto', 0.85], 'Automatic minder (youth)': ['auto', 0.7],
  Presser: ['presser', 1], Hardener: ['hardener', 1],
  'Frame builder': ['frame-builder', 1], 'Frame builder (learner)': ['frame-builder', 0.5],
  Brazer: ['brazer', 1], 'Brazer’s boy': ['brazer', 0.5],
  Filer: ['filer', 1], 'Sand-blaster': ['blaster', 1], Pickler: ['pickler', 1],
  Polisher: ['polisher', 1], 'Polisher (rough)': ['polisher', 0.6],
  Plater: ['plater', 1], 'Plater’s youth': ['plater', 0.5], Scrubber: ['scrubber', 0.6],
  'Enameller’s youth': ['rubber', 0.5],
  Liner: ['liner', 1], 'Transfer hand': ['transfer', 0.8],
  'Spoke-machine minder': ['spoke-minder', 0.7], 'Lacer (youth)': ['lacer', 0.7], Lacer: ['lacer', 0.7],
  'Wheel truer': ['truer', 1],
  Fitter: ['fitter', 1], 'Fitter’s youth': ['fitter', 0.7], 'Dress-guard lacer': ['dress-guard', 0.8],
  Finisher: ['finisher', 1], 'Finisher (learner)': ['finisher', 0.5],
  'Chief viewer': ['viewer', 1], Viewer: ['viewer', 1], 'Cycle tester': ['tester', 1],
  Wrapper: ['wrapper', 1], 'Wrapper (girl)': ['wrapper', 0.6],
  Storeman: ['storeman', 1], 'Finished-stores man': ['finished-storeman', 1],
  Packer: ['packer', 1], Warehouseman: ['warehouseman', 1],
};

// Enamellers at the dipping tanks dip; the rest rub down.
export function groupFor(p) {
  if (p.trade === 'Enameller') return [p.spot.startsWith('dip-') ? 'dipper' : 'rubber', 1];
  return GROUPS[p.trade] || null;
}

const lady = (lot) => lot.batch && (lot.batch.pattern === 'lady' || lot.batch.pattern === 'girl');

// --- Routings for the three streams of a batch and for erecting ----------------

function frameRouting() {
  return [
    { issue: frameIssue(), store: 'rough', group: 'storeman', room: 'rough-stores', min: 1.5, op: 'issuing tubes and lugs', take: [100, 100] },
    { op: 'building frames in the jig', group: 'frame-builder', room: 'frame-shop', min: 125, take: [1, 2], stage: 'built' },
    { op: 'brazing frames', group: 'brazer', room: 'brazing', min: 90, take: [1, 2], stage: 'brazed' },
    { op: 'pickling frames', group: 'pickler', room: 'filing', min: 20, take: [6, 10], stage: 'pickled' },
    { op: 'sand-blasting frames', group: 'blaster', room: 'filing', min: 40, take: [2, 4] },
    { op: 'filing spelter off the joints', group: 'filer', room: 'filing', min: 140, take: [1, 2], stage: 'filed' },
    { op: 'stamping frame numbers', group: 'viewer', room: 'view-room', min: 1.5, take: [100, 100], stamp: true },
    { op: 'iron-polishing frames', group: 'polisher', room: 'polishing', min: 95, take: [1, 2], stage: 'polished' },
    { op: 'viewing frames', group: 'viewer', room: 'view-room', min: 20, take: [5, 10], stage: 'viewed' },
    { op: 'dipping frames in black enamel (first coat)', group: 'dipper', room: 'enamelling', min: 20, take: [4, 8], stage: 'dipped' },
    { equip: 'stove', room: 'enamelling', minutes: 60, perLoad: 50, stage: 'enamel1', what: 'stoving the first coat at 380 °F' },
    { op: 'rubbing down the first coat', group: 'rubber', room: 'enamelling', min: 55, take: [2, 3] },
    { op: 'dipping frames (second coat)', group: 'dipper', room: 'enamelling', min: 20, take: [4, 8] },
    { equip: 'stove', room: 'enamelling', minutes: 75, perLoad: 50, stage: 'enamel2', what: 'stoving the second coat' },
    { op: 'rubbing down the second coat', group: 'rubber', room: 'enamelling', min: 55, take: [2, 3] },
    { op: 'dipping frames (finishing coat)', group: 'dipper', room: 'enamelling', min: 20, take: [4, 8] },
    { equip: 'stove', room: 'enamelling', minutes: 90, perLoad: 50, stage: 'enamel3', what: 'stoving the finishing coat' },
    { op: 'lining frames', group: 'liner', room: 'lining', min: 50, take: [2, 3], stage: 'lined' },
    { op: 'laying on transfers', group: 'transfer', room: 'lining', min: 24, take: [3, 6], stage: 'transferred' },
    { arrive: true, room: 'finishing' },
  ];
}

function brightRouting() {
  return [
    { issue: brightIssue(), store: 'finished', group: 'finished-storeman', room: 'view-room', min: 2, op: 'issuing bright parts', take: [100, 100] },
    { op: 'polishing cranks, chainwheels and handlebars', group: 'polisher', room: 'polishing', min: 140, take: [1, 2], stage: 'polished' },
    { op: 'scrubbing bright parts with pumice', group: 'scrubber', room: 'plating', min: 22, take: [2, 4] },
    { op: 'nickel-plating bright parts', group: 'plater', room: 'plating', min: 45, take: [2, 3], stage: 'plated' },
    { op: 'fitting brakework and handlebars', group: 'fitter', room: 'brakework', min: 127, take: [1, 2], stage: 'assembled' },
    { op: 'lacing dress guards', group: 'dress-guard', room: 'brakework', min: 64, take: [1, 3], skipIf: (lot) => !lady(lot) },
    { arrive: true, room: 'finishing' },
  ];
}

function wheelRouting() {
  return [
    { issue: wheelRoughIssue(), store: 'rough', group: 'storeman', room: 'rough-stores', min: 2, op: 'issuing rims and spokes', take: [100, 100] },
    { issue: wheelFinishedIssue(), store: 'finished', group: 'finished-storeman', room: 'view-room', min: 1.5, op: 'issuing hubs and cones', take: [100, 100] },
    { op: 'screwing spokes', group: 'spoke-minder', room: 'wheel-shop', min: 28, take: [2, 4] },
    { op: 'lacing wheels', group: 'lacer', room: 'wheel-shop', min: 60, take: [1, 2], stage: 'laced' },
    { op: 'truing wheels', group: 'truer', room: 'wheel-shop', min: 75, take: [1, 2], stage: 'trued' },
    { arrive: true, room: 'finishing' },
  ];
}

function erectingRouting(model) {
  return [
    { issue: [...finishingIssue(model), ['ball', 22]], store: 'rough', group: 'storeman', room: 'finishing', min: 3, op: 'making up finishing sets', take: [100, 100] },
    { issue: finishingMadeIssue(), store: 'finished', group: 'finished-storeman', room: 'finishing', min: 1, op: 'issuing bracket parts', take: [100, 100] },
    { op: 'finishing machines at the pillar bench', group: 'finisher', room: 'finishing', min: 300, take: [1, 1], stage: 'erected' },
    { op: 'testing machines on the rollers', group: 'tester', room: 'finishing', min: 36, take: [1, 2], stage: 'tested' },
    { op: 'final viewing: weighing each machine and entering its number', group: 'viewer', room: 'finishing', min: 12, take: [2, 4], register: true },
    { op: 'greasing and wrapping in paper strips', group: 'wrapper', room: 'warehouse', min: 45, take: [1, 2], stage: 'wrapped' },
    { arrive: true, room: 'stock-room' },
  ];
}

// --- Stock parts made in the machine and press shops --------------------------

// [per machine, lb. of bar per part, [steps...], lot take sizes]
export const STOCK_PARTS = {
  'hub-shell': { per: 2, bar: 0.5, steps: [
    ['turning hub shells', 'turner', 'machine-shop', 12, [10, 20]],
    ['polishing hub shells', 'polisher', 'polishing', 16, [8, 16]],
    ['scrubbing hub shells', 'scrubber', 'plating', 3, [20, 40]],
    ['plating hub shells', 'plater', 'plating', 6, [20, 40]],
  ] },
  chainwheel: { per: 1, bar: 1.5, steps: [
    ['turning and milling chainwheels', 'turner', 'machine-shop', 40, [4, 8]],
    ['polishing chainwheels', 'polisher', 'polishing', 20, [4, 8]],
    ['scrubbing chainwheels', 'scrubber', 'plating', 3, [20, 40]],
    ['plating chainwheels', 'plater', 'plating', 8, [10, 20]],
  ] },
  crank: { per: 2, bar: 1, steps: [['turning and profiling cranks', 'turner', 'machine-shop', 25, [8, 16]]] },
  axle: { per: 3, bar: 0.2, steps: [
    ['turning axles', 'minder', 'machine-shop', 8, [20, 40]],
    ['case-hardening axles', 'hardener', 'hardening', 3, [50, 100]],
  ] },
  'seat-pillar': { per: 1, bar: 0.5, steps: [['turning seat pillars', 'minder', 'machine-shop', 15, [10, 20]]] },
  'small-parts': { per: 1, bar: 2, steps: [['turning nuts, bolts and cotters', 'minder', 'machine-shop', 160, [1, 2]]] },
  cone: { per: 6, bar: 0.1, steps: [
    ['making cones on the automatics', 'auto', 'machine-shop', 14, [20, 40]],
    ['case-hardening cones', 'hardener', 'hardening', 3, [50, 100]],
  ] },
  cup: { per: 2, bar: 0.1, steps: [
    ['making cups on the automatics', 'auto', 'machine-shop', 14, [20, 40]],
    ['case-hardening cups', 'hardener', 'hardening', 3, [50, 100]],
  ] },
  'pressings-set': { per: 1, bar: 1, steps: [['pressing brake parts and brackets', 'presser', 'press-shop', 45, [4, 8]]] },
  handlebar: { per: 1, tube: true, steps: [['bending handlebars', 'presser', 'press-shop', 15, [10, 20]]] },
};

const VIEW_MIN = { 'hub-shell': 1, chainwheel: 2, crank: 1, axle: 0.5, 'seat-pillar': 0.5, 'small-parts': 3, cone: 0.5, cup: 0.5, 'pressings-set': 1, handlebar: 1 };

function stockRouting(item, qty) {
  const sp = STOCK_PARTS[item];
  const material = sp.tube ? [['handlebar-tube', 1]] : [['bar-steel', sp.bar]];
  const r = [{ issue: material, store: 'rough', group: 'storeman', room: 'rough-stores', min: 0.05, op: `issuing ${sp.tube ? 'tube' : 'bar steel'}`, take: [qty, qty] }];
  for (const [op, group, room, min, take] of sp.steps) r.push({ op, group, room, min, take });
  r.push({ op: `viewing ${MADE[item].toLowerCase()}`, group: 'viewer', room: 'view-room', min: VIEW_MIN[item], take: [50, 100] });
  r.push({ arrive: true, room: 'view-room' });
  return r;
}

// --- The works' production state ----------------------------------------------

const FIRST_FRAME_NUMBER = 152000; // the 1913 season's numbers start here (est.)

export function setupWorks(world, production) {
  const rough = {};
  const weeks = (n) => Math.round(n * WEEKLY_MACHINES);
  const use = usePerMachine();
  for (const item of Object.keys(BOUGHT)) rough[item] = Math.round((use[item] || 0) * WEEKLY_MACHINES * 5);
  const finished = {};
  for (const [item, sp] of Object.entries(STOCK_PARTS)) finished[item] = Math.round(sp.per * weeks(1.4));
  production.addStore(new Store('rough', 'Rough Stores', rough));
  production.addStore(new Store('finished', 'Finished Stores', finished));
  production.addEquipment('stove', [1, 2, 3, 4].map((i) => ({ id: `stove-${i}`, label: `No. ${i} stove`, spot: `stove-${i}` })));

  const works = {
    batches: [],
    orderNo: 311,
    nextFrame: FIRST_FRAME_NUMBER,
    register: [], // the Progressive Number Register: frame number, model, batch, date
    finishedStock: [],
    finishedThisWeek: 0,
    weekly: [],
    cycle: 0,
    stockLots: new Map(),
  };
  world.works = works;
  return works;
}

function usePerMachine() {
  const use = {};
  const add = (list, k = 1) => { for (const [item, n] of list) use[item] = (use[item] || 0) + n * k; };
  add(frameIssue());
  add(wheelRoughIssue());
  add([['ball', 22]]);
  // Weighted over the programme's mix of models.
  const total = PROGRAMME_CYCLE.reduce((a, [, , q]) => a + q, 0);
  for (const [model, , q] of PROGRAMME_CYCLE) add(finishingIssue(model), q / total);
  for (const sp of Object.values(STOCK_PARTS)) {
    if (sp.tube) use['handlebar-tube'] = (use['handlebar-tube'] || 0) + sp.per;
    else use['bar-steel'] = (use['bar-steel'] || 0) + sp.per * sp.bar;
  }
  return use;
}

// Launch a batch: three streams that meet in the Finishing Shop. Each
// stream travels in trays of TRAY machines' worth (est.), all under the
// sub-order's one number and work tally, so that the first trays can be
// brazing while the last are still in the jigs.
export const TRAY = 25;

export function launchBatch(world, production, [model, pattern, qty], { fraction = 0, streams = true } = {}) {
  const works = world.works;
  const no = works.orderNo++;
  const trays = Math.ceil(qty / TRAY);
  const batch = {
    id: `C.${no}`, no, series: 'C', model, pattern, qty, trays, name: modelName(model, pattern),
    launched: world.sim.now, streams: { 1: [], 2: [], 3: [], 4: [] }, arrived: new Map(), traysDone: 0,
    frameNos: null, finished: null,
  };
  works.batches.push(batch);
  const mk = (key, label, kind, unit, routing, room, tray, f) => {
    const n = Math.min(TRAY, qty - tray * TRAY);
    const step = f > 0 ? seedStep(routing, f, world.rng) : 0;
    const lot = production.launch({
      label: `${batch.id}/${key}${trays > 1 ? 'abcd'[tray] : ''} ${label}`, kind, qty: n, unit, routing, batch,
      room: f > 0 ? routing[step].room : room, step, stage: seedStage(routing, step),
    });
    lot.tray = tray;
    if (f > 0 && routing[step].op) lot.left = Math.max(1, Math.round(lot.left * world.rng.uniform(0.3, 1)));
    if (f > 0 && lot.tally) backdateTally(world, lot, f);
    if (f > 0 && step > 6 && key === '1') assignFrameNumbers(world, batch);
    batch.streams[key].push(lot);
    return lot;
  };
  for (let tray = 0; streams && tray < trays; tray++) {
    // In the opening state the later trays of a batch are a little behind.
    const f = fraction > 0 ? Math.max(0.02, fraction - tray * 0.05) : 0;
    mk('1', `frames, ${batch.name}`, 'frames', 'frame', frameRouting(), 'rough-stores', tray, f);
    mk('2', `bright parts, ${batch.name}`, 'bright', 'set', brightRouting(), 'view-room', tray, f);
    mk('3', `wheels, ${batch.name}`, 'wheels', 'pair', wheelRouting(), 'rough-stores', tray, f);
  }
  world.log(`Sub-order ${batch.id} put through: ${qty} ${batch.name}.`, { kind: 'works' });
  return batch;
}

// In the opening state the tallies of batches already in the shops were
// issued days ago, and their coupons have been cut.
function backdateTally(world, lot, f) {
  const issued = world.sim.now - Math.round(f * 16) * 1440;
  lot.tally.fields.issued = world.cal.dayStart(issued) + 6 * 60 + 30;
  lot.tally.history = [{ t: lot.tally.fields.issued, text: 'issued by the Work Depot' }];
  if (lot.step > 0) lot.tally.marks.push({ t: lot.tally.fields.issued + 20, mark: 'coupon cut' });
}

function launchErecting(world, production, batch, tray, { step = 0, left } = {}) {
  const n = Math.min(TRAY, batch.qty - tray * TRAY);
  const fin = production.launch({
    label: `${batch.id}/4${batch.trays > 1 ? 'abcd'[tray] : ''} erecting, ${batch.name}`, kind: 'machines', qty: n, unit: 'machine',
    routing: erectingRouting(batch.model), room: 'finishing', batch, stage: step > 2 ? 'erected' : 'parts', step,
  });
  fin.tray = tray;
  if (left !== undefined) fin.left = left;
  if (step > 0 && fin.tally) backdateTally(world, fin, 0.2);
  batch.streams['4'].push(fin);
  return fin;
}

// For the opening state: a step part-way along a routing, never in a stove.
function seedStep(routing, fraction, rng) {
  const isOp = (st) => st.op && !st.issue;
  let k = Math.min(routing.length - 2, Math.floor(fraction * (routing.length - 1)));
  while (k > 0 && !isOp(routing[k])) k--;
  while (k < routing.length - 1 && !isOp(routing[k])) k++;
  return k;
}

function seedStage(routing, step) {
  let stage = null;
  for (let i = 0; i < step; i++) if (routing[i].stage) stage = routing[i].stage;
  return stage;
}

export function assignFrameNumbers(world, batch) {
  if (batch.frameNos) return;
  const works = world.works;
  batch.frameNos = [works.nextFrame, works.nextFrame + batch.qty - 1];
  works.nextFrame += batch.qty;
}

// The frame numbers of one tray of a batch.
export function trayFrameNos(batch, tray) {
  const first = batch.frameNos[0] + tray * TRAY;
  return [first, Math.min(batch.frameNos[1], first + TRAY - 1)];
}

// Called by the production engine as each step finishes.
export function onStep(world, production, lot, step) {
  if (lot.kind === 'despatch') return onDespatchStep(world, lot, step);
  const batch = lot.batch;
  if (step.stamp && batch) {
    const fresh = !batch.frameNos;
    assignFrameNumbers(world, batch);
    const [a, b] = trayFrameNos(batch, lot.tray);
    world.log(`Frames ${a.toLocaleString('en-GB')} to ${b.toLocaleString('en-GB')} stamped (${batch.id}${fresh ? ', the first tray' : ''}).`, { kind: 'works' });
  }
}

export function onDone(world, production, lot) {
  const works = world.works;
  const batch = lot.batch;
  if (lot.kind === 'despatch') return onDespatchReady(world, lot);
  if (lot.kind === 'parts') {
    production.stores.get('finished').put(lot.item, lot.qty, world.sim.now, lot.label);
    works.stockLots.delete(lot.item);
    return;
  }
  if (!batch) return;
  if (lot.kind === 'machines') {
    const t = world.sim.now;
    const [a, b] = trayFrameNos(batch, lot.tray);
    for (let n = a; n <= b; n++) {
      // Frame sizes are made in proportion to what agents ask for.
      const m = { frameNo: n, model: batch.model, pattern: batch.pattern, frameSize: world.rng.weighted(FRAME_SIZES[batch.pattern]), batch: batch.id, finished: t };
      works.register.push(m);
      works.finishedStock.push(m);
    }
    works.finishedThisWeek += lot.qty;
    batch.traysDone++;
    if (batch.traysDone === batch.trays) {
      batch.finished = t;
      world.log(`The last of ${batch.id}, ${batch.qty} ${batch.name}, wrapped and taken up to the Stock Room.`, { kind: 'works' });
    }
    return;
  }
  const got = batch.arrived.get(lot.tray) || new Set();
  got.add(lot.kind);
  batch.arrived.set(lot.tray, got);
  if (got.size === 3) launchErecting(world, production, batch, lot.tray);
}

export function machinesInProgress(world) {
  let n = 0;
  for (const b of world.works.batches) if (!b.finished) n += b.qty - b.traysDone * TRAY;
  return Math.max(0, n);
}

// What to put through next. The season's programme was laid down from the
// travellers' estimates, and the Works Manager follows it, except that a
// model the agents are waiting for, with not enough in stock or in the
// shops to fill their orders, goes in first.
function nextEntry(world) {
  const works = world.works;
  const want = machinesWanted(world);
  if (want.size) {
    const have = new Map();
    const add = (k, n) => have.set(k, (have.get(k) || 0) + n);
    for (const m of works.finishedStock) if (!m.allocated) add(`${m.model}/${m.pattern}`, 1);
    for (const b of works.batches) if (!b.finished) add(`${b.model}/${b.pattern}`, b.qty - b.traysDone * TRAY);
    let best = null;
    for (const [k, n] of want) {
      const short = n - (have.get(k) || 0);
      if (short > 0 && (!best || short > best[1])) best = [k, short];
    }
    if (best) {
      const entry = PROGRAMME_CYCLE.find(([m, p]) => `${m}/${p}` === best[0]);
      if (entry) return entry;
    }
  }
  return PROGRAMME_CYCLE[works.cycle++ % PROGRAMME_CYCLE.length];
}

// The Works Manager's programme: keep about two weeks' work in the shops.
export function* worksManagerProgramme(world, production, timetable) {
  const TARGET_WIP = 640;
  for (;;) {
    const spell = timetable.nextSpell(world.sim.now + 1);
    yield until(spell[0] + 35);
    let n = 0;
    while (machinesInProgress(world) < TARGET_WIP && n < 4) {
      launchBatch(world, production, nextEntry(world));
      n++;
    }
    yield until(timetable.lastSpellOfDay(world.sim.now)[1] + 1);
  }
}

// The Storekeeper's stock cards: when a made part falls below an ordering
// level of a week and a half's use, a stock order goes to the shops for a
// week's worth.
export function stockCheck(world, production, { seed = false } = {}) {
  const works = world.works;
  const fin = production.stores.get('finished');
  for (const [item, sp] of Object.entries(STOCK_PARTS)) {
    if (works.stockLots.has(item)) continue;
    const weekly = sp.per * WEEKLY_MACHINES;
    if (fin.qty(item) >= weekly * 1.5) continue;
    const qty = Math.round(weekly / 10) * 10;
    const routing = stockRouting(item, qty);
    const no = works.orderNo++;
    let step = 0;
    let room = 'rough-stores';
    if (seed) {
      step = 1 + Math.floor(world.rng.next() * (routing.length - 3));
      room = routing[step].room;
    }
    const lot = production.launch({ label: `C.${no} ${qty} ${MADE[item].toLowerCase()}`, kind: 'parts', qty, unit: 'part', routing, room, step });
    lot.item = item;
    if (seed) lot.left = Math.max(1, Math.round(qty * world.rng.uniform(0.2, 1)));
    works.stockLots.set(item, lot);
    if (!seed) world.log(`Stock order C.${no} for ${qty} ${MADE[item].toLowerCase()}: the stock card is below its ordering level.`, { kind: 'works' });
  }
}

// Three times a day, a quarter of an hour into each spell.
export function* storekeeperRounds(world, production, timetable) {
  for (;;) {
    const spell = timetable.nextSpell(world.sim.now);
    if (world.sim.now <= spell[0] + 15) {
      yield until(spell[0] + 15);
      stockCheck(world, production);
    }
    yield until(spell[1] + 1);
  }
}

// Until purchasing is modelled (milestone 5), the bought-in stock is made up
// twice a week as if by standing orders delivered by the railway's carts.
export function* standingDeliveries(world, production, timetable) {
  const use = usePerMachine();
  const rough = production.stores.get('rough');
  for (;;) {
    yield until(world.sim.now + 1);
    const spell = timetable.nextSpell(world.sim.now);
    const dow = world.cal.dow(spell[0]);
    if ((dow === 2 || dow === 5) && world.cal.minuteOfDay(spell[0]) < 9 * 60) {
      yield until(spell[0] + 4 * 60);
      for (const item of Object.keys(BOUGHT)) {
        const target = Math.round((use[item] || 0) * WEEKLY_MACHINES * 5);
        const have = rough.qty(item);
        if (have < target * 0.7) rough.put(item, target - have, world.sim.now, 'standing order');
      }
    }
    yield until(timetable.lastSpellOfDay(world.sim.now)[1] + 1);
  }
}

// Weekly tally of machines finished, kept every Saturday at noon.
export function* weeklyTally(world, timetable) {
  for (;;) {
    yield until(world.sim.now + 1);
    const last = timetable.lastSpellOfDay(world.sim.now);
    if (world.cal.dow(last[0]) === 6) {
      yield until(last[1]);
      world.works.weekly.push({ weekEnding: world.sim.now, machines: world.works.finishedThisWeek });
      world.log(`Week ending ${world.cal.docDate(world.sim.now)}: ${world.works.finishedThisWeek} machines finished.`, { kind: 'works' });
      world.works.finishedThisWeek = 0;
    } else {
      yield until(last[1] + 1);
    }
  }
}

// The opening state on 1 March 1913: batches part-way through the shops, and
// stock orders in the machine and press shops.
export function seedWorks(world, production) {
  const fractions = [0.95, 0.85, 0.72, 0.6, 0.48, 0.36, 0.24, 0.12];
  for (const f of fractions) {
    const entry = PROGRAMME_CYCLE[world.works.cycle++ % PROGRAMME_CYCLE.length];
    const batch = launchBatch(world, production, entry, { fraction: f, streams: f <= 0.8 });
    if (f > 0.8) {
      // These have reached the Finishing Shop already.
      assignFrameNumbers(world, batch);
      for (let tray = 0; tray < batch.trays; tray++) {
        const n = Math.min(TRAY, batch.qty - tray * TRAY);
        batch.arrived.set(tray, new Set(['frames', 'bright', 'wheels']));
        const step = f > 0.9 ? 2 + Math.min(3, tray) : 2;
        launchErecting(world, production, batch, tray, { step, left: Math.max(1, Math.round(n * world.rng.uniform(0.3, 1))) });
      }
    }
  }
  world.logEntries.length = 0;
  stockCheck(world, production, { seed: true });
}
