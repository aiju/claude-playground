// Daily life at the Sherbourne Works: coming in, clocking on, meals, going
// home, and (until the production and paperwork milestones replace them) the
// placeholder work each trade does.
//
// Gate practice follows Swindon (Williams 1915), the best-described British
// works of the period: five minutes' grace, then a quarter-hour's pay lost,
// and after a quarter past six the latecomer is shut out until breakfast.
// Elbourne (1914) says brass checks had "given way largely" to card time
// recorders; the Sherbourne Works installed card recorders in 1912 (choice).
import { until, wait } from '../../engine/sim/kernel.js';
import { walk, work, WALK_SPEED } from '../../engine/sim/world.js';
import { punch, endOfDay, collectPay } from './paper.js';

const ACTIVITY = {
  'Turner': 'turning hub shells on a capstan lathe',
  'Machine minder': 'minding a capstan lathe on cups and cones',
  'Machine minder (youth)': 'minding a capstan lathe on axles',
  'Automatic minder': 'minding an automatic screw machine',
  'Automatic minder (youth)': 'minding an automatic screw machine',
  'Setter': 'setting the tools on a capstan lathe',
  'Presser': 'pressing handlebar brackets',
  'Hardener': 'case-hardening cups and cones',
  'Toolmaker': 'making a frame jig for next season',
  'Apprentice toolmaker': 'filing a gauge under a toolmaker’s eye',
  'Patternmaker': 'making a pattern for a bracket casting',
  'Frame builder': 'pegging tubes and lugs in the frame jig',
  'Frame builder (learner)': 'drilling lugs for pinning',
  'Brazer': 'brazing a frame joint at the hearth',
  'Brazer’s boy': 'feeding spelter and minding the blast',
  'Filer': 'filing spelter off the lugs',
  'Sand-blaster': 'sand-blasting a frame',
  'Pickler': 'pickling frames in the acid vat',
  'Polisher': 'polishing handlebars on the emery wheel',
  'Polisher (rough)': 'rough-polishing cranks',
  'Plater': 'hanging parts in the nickel vat',
  'Plater’s youth': 'stringing parts on wires for the vat',
  'Scrubber': 'scrubbing parts with pumice for plating',
  'Enameller': 'rubbing down a stoved coat with pumice',
  'Enameller’s youth': 'rubbing down mudguards',
  'Liner': 'lining a frame in gold',
  'Transfer hand': 'laying on head transfers',
  'Spoke-machine minder': 'screwing spoke ends',
  'Lacer (youth)': 'lacing spokes into a hub',
  'Lacer': 'lacing spokes into a hub',
  'Wheel truer': 'truing a wheel',
  'Wheel builder': 'building a wheel',
  'Fitter': 'assembling brakework',
  'Fitter’s youth': 'fitting mudguard stays',
  'Dress-guard lacer': 'lacing a dress guard',
  'Finisher': 'finishing a machine at the pillar bench',
  'Finisher (learner)': 'fitting pedals and chains',
  'Chief viewer': 'viewing parts against the gauges',
  'Viewer': 'viewing parts against the gauges',
  'Cycle tester': 'testing a finished machine',
  'Wrapper': 'wrapping a machine in paper strips',
  'Wrapper (girl)': 'tying up wrapped machines',
  'Warehouseman': 'packing a machine for despatch',
  'Carpenter': 'nailing up a crate',
  'Carpenter’s boy': 'sawing battens',
  'Storekeeper': 'checking the stock control cards',
  'Storeman': 'counting out parts from the bins',
  'Finished-stores man': 'taking in viewed parts',
  'Engine driver': 'minding the engine',
  'Stoker': 'firing the boiler',
  'Smith': 'forging at the hearth',
  'Striker': 'striking for the smith',
  'Managing Director': 'reading the morning’s letters',
  'Secretary and Accountant': 'going through the post',
  'Cashier': 'writing up the Cash Book',
  'Chief Clerk': 'checking invoices',
  'Correspondence Clerk': 'drafting replies to letters',
  'Typist': 'typing letters',
  'Order and Invoice Clerk': 'typing an Office Order',
  'Sales Ledger Clerk': 'posting the Sales Ledger',
  'Bought Ledger Clerk': 'posting the Bought Ledger',
  'Buyer': 'writing a purchase order',
  'Buyer’s Clerk': 'copying purchase orders',
  "Buyer's Clerk": 'copying purchase orders',
  'Despatch Clerk': 'writing consignment notes',
  'Works Manager': 'going over the production programme',
  'Works Accountant and Estimator': 'working out a cost',
  'Cost Clerk': 'posting cost allocation sheets',
  'Production Clerk': 'writing up the production programme',
  'Ratefixer': 'fixing a piece rate',
  'Draughtsman': 'drawing a new lug for next season',
  'Wages Clerk': 'working out the week’s wages',
  'Timekeeper': 'checking time cards',
  'Gatekeeper': 'minding the gate',
  'Receiving Clerk': 'writing a goods received note',
};

export function activityFor(p) {
  return ACTIVITY[p.trade] || ACTIVITY[p.title] || 'at work';
}

const BREAKFAST_MAX = 45;
const DINNER_MAX = 120;

// What a person does between spells of work.
export function* offDuty(world, p) {
  const { sim } = world;
  const spell = p.timetable.nextSpell(sim.now);
  if (!spell) {
    p.activity = 'not employed';
    yield until(Infinity);
    return;
  }
  if (!p.onSite) {
    yield* comeIn(world, p, spell);
    return;
  }
  const gap = spell[0] - sim.now;
  const back = p.node;
  if (gap <= BREAKFAST_MAX && world.cal.minuteOfDay(sim.now) >= 10 * 60) {
    // Back late from a job off the premises: a bite to eat before the bell.
    p.activity = 'eating a late dinner';
    yield until(spell[0]);
    return;
  }
  if (gap <= BREAKFAST_MAX) {
    if (p.breakfastInMess) {
      yield* walk(world, p, p.messSeat, { activity: 'going to the mess room for breakfast' });
      p.activity = 'at breakfast in the mess room';
      yield until(spell[0] - 3);
      yield* walk(world, p, back, { activity: 'back from breakfast' });
    } else {
      p.activity = 'at breakfast at the bench';
      yield until(spell[0]);
    }
    return;
  }
  if (gap <= DINNER_MAX) {
    if (p.dinnerAt === 'home') {
      yield* goOut(world, p, 'going home to dinner');
      yield* comeIn(world, p, spell);
    } else if (p.dinnerAt === 'mess') {
      yield* walk(world, p, p.messSeat, { activity: 'going to the mess room' });
      p.activity = 'at dinner in the mess room';
      yield until(spell[0] - 4);
      yield* walk(world, p, back, { activity: 'back from dinner' });
    } else {
      p.activity = 'eating dinner at the bench';
      yield until(spell[0]);
    }
    return;
  }
  yield* goOut(world, p, 'going home', { endOfDay: true });
  yield* comeIn(world, p, p.timetable.nextSpell(sim.now));
}

function clocks(p) {
  return p.role !== 'staff';
}

function entrance(p) {
  return p.timetable === p.timetables.office ? 'S_OF' : 'G';
}

function* comeIn(world, p, spell) {
  const { sim, rng } = world;
  // Now and then someone is off sick for the day (est. one day in forty).
  const firstOfDay = p.timetable.spellsOn(spell[0])[0];
  if (firstOfDay && firstOfDay[0] === spell[0] && p.role !== 'staff' && rng.chance(0.025)) {
    p.activity = 'off sick at home';
    p.record.push({ t: spell[0], kind: 'absent' });
    world.production?.abandon(p);
    const last = p.timetable.lastSpellOfDay(spell[0]);
    yield until(last[1] + 30);
    spell = p.timetable.nextSpell(sim.now);
  }
  let start = spell[0];
  let target;
  if (p.role === 'staff') target = start - rng.uniform(0, 10);
  else if (rng.chance(p.lateness)) target = start + rng.uniform(1, 22);
  else target = start - rng.uniform(2, 14);
  const depart = target - p.commute;
  // If the sim starts after they set off, they're already part of the way.
  const elapsed = Math.min(p.commute * 0.97, Math.max(0, sim.now - depart));
  yield until(depart);
  p.node = p.home;
  p.onSite = true;
  const gate = entrance(p);
  yield* walk(world, p, gate, { activity: 'coming in to work', elapsed });
  if (clocks(p)) {
    const lateAtGate = sim.now - start;
    if (lateAtGate > 15 && p.timetable === p.timetables.works) {
      // Shut out until the next spell: "losing a quarter".
      const next = p.timetable.nextSpell(start + 1);
      p.activity = 'shut out at the gate until after breakfast';
      p.record.push({ t: sim.now, kind: 'shut out' });
      world.log(`${p.name} (No. ${p.worksNo}) arrived at ${world.cal.clockTime(sim.now)} and was shut out until after breakfast.`, { kind: 'gate', refs: [p.id] });
      yield until(next[0] - 3);
      start = next[0];
    }
    const recorder = p.worksNo % 2 ? 'time-recorder-1' : 'time-recorder-2';
    yield* walk(world, p, recorder, { activity: 'clocking on' });
    yield wait(0.15);
    const lateBy = sim.now - start;
    const late = lateBy > 5 && p.timetable === p.timetables.works;
    p.record.push({ t: sim.now, kind: 'in', late });
    punch(world, p, 'in', late);
    if (lateBy > 5 && lateBy <= 15 && p.timetable === p.timetables.works) {
      world.log(`${p.name} (No. ${p.worksNo}) clocked on ${Math.round(lateBy)} minutes late and loses a quarter of an hour.`, { kind: 'gate', refs: [p.id] });
    }
  }
  yield* walk(world, p, p.spot, { activity: 'going to work' });
}

function* goOut(world, p, activity, { endOfDay: last = false } = {}) {
  const { sim } = world;
  if (last) endOfDay(world, p);
  if (clocks(p)) {
    const recorder = p.worksNo % 2 ? 'time-recorder-1' : 'time-recorder-2';
    yield* walk(world, p, recorder, { activity: 'clocking off' });
    yield wait(0.15);
    p.record.push({ t: sim.now, kind: 'out' });
    punch(world, p, 'out', false);
    if (last) yield* collectPay(world, p);
  }
  yield* walk(world, p, entrance(p), { activity });
  yield* walk(world, p, p.home, { activity });
  p.onSite = false;
  p.activity = 'at home';
}

// --- Placeholder work, until the production milestone ----------------------

export function* steadyWork(world, p) {
  for (;;) yield* work(world, p, 60, activityFor(p));
}

export function* roaming(world, p, { places, between = [8, 25], dwell = [1, 4], goingTo, at, errand }) {
  const { rng } = world;
  for (;;) {
    if (errand) yield* errand(world, p);
    yield* work(world, p, rng.uniform(...between), activityFor(p));
    const dest = rng.pick(places);
    const room = world.site.roomAt(dest);
    const roomName = room ? room.name : world.site.node(dest).label || 'the yard';
    yield* work(world, p, 0.01);
    yield* walk(world, p, dest, { activity: goingTo(roomName) });
    yield* work(world, p, rng.uniform(...dwell), at(roomName));
    yield* walk(world, p, p.spot, { activity: 'going back' });
  }
}

export function commuteMinutes(world, p) {
  const path = world.site.path(p.home, entrance(p));
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const a = world.site.node(path[i - 1]);
    const b = world.site.node(path[i]);
    len += Math.hypot(a.x - b.x, a.z - b.z);
  }
  return len / WALK_SPEED;
}
