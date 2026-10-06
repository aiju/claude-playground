// The Sherbourne Cycle Works, Coventry, 1913: everything specific to this
// scenario, assembled into one object the engine can run and draw.
import { Sim } from '../../engine/sim/kernel.js';
import { Calendar, Timetable } from '../../engine/sim/calendar.js';
import { Rng } from '../../engine/sim/rng.js';
import { Site } from '../../engine/sim/site.js';
import { World } from '../../engine/sim/world.js';
import { buildings, yard, fixedSpots, rowSpots, STREET_Z, CANAL_Z } from './site.js';
import { makeTimetables, HOLIDAYS } from './calendar.js';
import { makeStaff, DEPARTMENTS } from './staff.js';
import { offDuty, steadyWork, roaming, commuteMinutes } from './routines.js';
import { Production } from '../../engine/sim/production.js';
import {
  groupFor, setupWorks, seedWorks, onStep, onDone, worksManagerProgramme, storekeeperRounds,
  standingDeliveries, weeklyTally, machinesInProgress,
} from './works.js';
import { palette, scenery, machinery, cameraPresets } from './look.js';
import { MODELS, PATTERNS } from './catalogue.js';
import { price as fmtPrice } from '../../engine/sim/money.js';

export const meta = {
  id: 'coventry-1913',
  title: 'The Sherbourne Cycle Works',
  subtitle: 'Foleshill, Coventry, 1913',
  firm: 'The Sherbourne Cycle Company Limited',
  latitude: 52.41,
  longitude: -1.51,
  defaultStart: [1913, 3, 3, 5, 30],
};

export function createScenario({ seed = 1913, start } = {}) {
  const cal = new Calendar({ year: 1913 });
  const t0 = start ?? cal.at(...meta.defaultStart);
  const sim = new Sim({ start: t0 });
  const rng = new Rng(seed);
  const site = new Site({ buildings, yard, spots: fixedSpots });
  for (const r of rowSpots) site.fillRoom(r.room, r);
  for (const dept of DEPARTMENTS) {
    if (!dept.foreman) continue;
    const room = site.rooms.get(dept.room);
    const b = site.buildings.get(room.building);
    site.addSpot({ id: `box-${dept.id}`, room: dept.room, x: room.x0 + 2.5, z: b.aisleZ + 3, type: 'foreman-box', facing: -Math.PI / 2, label: `Foreman's box, ${dept.name}` });
  }

  // Where lots of work wait in each shop.
  const wipRooms = new Set();
  for (const b of buildings) for (const r of b.rooms || []) if (r.dept) wipRooms.add(r.id);
  for (const id of wipRooms) {
    const room = site.rooms.get(id);
    const b = site.buildings.get(room.building);
    site.addSpot({ id: `wip-${id}`, room: id, x: (room.x0 + room.x1) / 2, z: b.aisleZ + 3.5, type: 'wip', label: `Work waiting in the ${room.name}` });
  }

  const world = new World({ sim, cal, rng: rng.fork('world'), site });
  const timetables = makeTimetables(cal);
  const production = new Production(world, {
    wipNode: (room) => `wip-${room}`,
    onStep: (lot, step) => onStep(world, production, lot, step),
    onDone: (lot) => onDone(world, production, lot),
  });
  world.production = production;
  setupWorks(world, production);
  seedWorks(world, production);
  timetables.saturday = new Timetable(cal, { days: { 6: [[9 * 60, 13 * 60]] }, holidays: HOLIDAYS });

  const peopleRng = rng.fork('people');
  const messSeats = [...site.spots.keys()].filter((id) => id.startsWith('mess-seat-'));
  for (const spec of makeStaff(rng.fork('staff'), site)) {
    const youth = spec.age < 18;
    const p = world.addPerson({
      id: world.id('p'),
      ...spec,
      timetables,
      timetable: spec.away ? timetables.saturday : timetables[spec.timetable],
      record: [],
      node: spec.home,
      offDuty,
      lateness: peopleRng.uniform(0.005, youth ? 0.06 : 0.035),
      dinnerAt: spec.role === 'staff'
        ? peopleRng.weighted([['home', 60], ['bench', 40]])
        : peopleRng.weighted([['home', 50], ['mess', 20], ['bench', 30]]),
      breakfastInMess: spec.role !== 'staff' && peopleRng.chance(0.15),
      messSeat: peopleRng.pick(messSeats),
    });
    p.commute = commuteMinutes(world, p);
    if (p.timetable.currentSpell(t0)) {
      // Starting in the middle of a spell: they're already at work, and
      // their card shows them clocking on when the day began.
      p.onSite = true;
      p.node = p.spot;
      if (p.role !== 'staff') {
        const first = p.timetable.spellsOn(t0)[0];
        p.record.push({ t: first[0] - peopleRng.uniform(2, 14), kind: 'in', late: false });
        const cur = p.timetable.currentSpell(t0);
        if (p.dinnerAt === 'home' && cur[0] >= cal.dayStart(t0) + 13 * 60) {
          p.record.push({ t: cur[0] - 69, kind: 'out' }, { t: cur[0] - peopleRng.uniform(2, 10), kind: 'in', late: false });
        }
      }
    }
    sim.spawn(processFor(world, p), p.name);
  }

  sim.spawn(worksManagerProgramme(world, production, timetables.worksStaff), 'works manager programme');
  sim.spawn(storekeeperRounds(world, production, timetables.works), 'storekeeper rounds');
  sim.spawn(standingDeliveries(world, production, timetables.works), 'standing deliveries');
  sim.spawn(weeklyTally(world, timetables.works), 'weekly tally');

  const works = timetables.works;
  return {
    production,
    machinesInProgress: () => machinesInProgress(world),
    catalogue: {
      MODELS,
      price: (model, pattern) => {
        const m = MODELS[model];
        const lady = pattern === 'lady' || pattern === 'girl';
        return fmtPrice(m.list + (lady ? m.ladyExtra || 0 : 0));
      },
    },
    meta,
    cal,
    sim,
    world,
    site,
    timetables,
    palette,
    scenery,
    machinery,
    cameraPresets,
    streetZ: STREET_Z,
    canalZ: CANAL_Z,
    // The engine runs while the works is at work, and stops for meals.
    engineRunning: (t) => !!(works.currentSpell(t) || works.currentSpell(t + 3)),
    shopsWorking: (t) => !!works.currentSpell(t),
    // The shops are lit from a quarter of an hour before the start, and
    // through the meal breaks (the light is wanted again straight after).
    shopsLit: (t) => {
      const next = works.nextSpell(t);
      if (!next) return false;
      const spells = works.spellsOn(t);
      const first = spells.length ? spells[0][0] : Infinity;
      const last = spells.length ? spells[spells.length - 1][1] : -Infinity;
      return t >= first - 15 && t < last;
    },
    officeWorking: (t) => !!timetables.office.currentSpell(t),
  };
}

function spotsInRooms(site, rooms) {
  const set = new Set(rooms);
  return [...site.spots.values()].filter((s) => set.has(s.room)).map((s) => s.id);
}

function deptRooms(deptId) {
  return buildings.flatMap((b) => (b.rooms || []).filter((r) => r.dept === deptId).map((r) => r.id));
}

const SHOP_ROOMS = buildings.flatMap((b) => (b.rooms || []).filter((r) => r.dept && r.dept !== 'engine').map((r) => r.id));

const describeJob = (s, lot, n) => `${s.op} (${n} of ${lot.batch ? lot.batch.id : lot.label.split(' ')[0]})`;

function processFor(world, p) {
  const site = world.site;
  const production = world.production;
  const g = groupFor(p);
  if (g) return production.worker(p, [g[0]], { efficiency: g[1] * world.rng.uniform(0.92, 1.08), describe: describeJob });
  if (p.trade === 'Messenger boy' || (p.trade === 'Labourer' && p.dept === 'stores')) {
    return production.messenger(p, { base: p.spot });
  }
  const sample = (ids, n) => world.rng.shuffle([...ids]).slice(0, n);
  if (p.role === 'foreman') {
    return roaming(world, p, {
      places: spotsInRooms(site, deptRooms(p.dept)).filter((id) => id !== p.spot),
      between: [10, 30],
      goingTo: (room) => `going round the ${room}`,
      at: (room) => `looking over the work in the ${room}`,
    });
  }
  switch (p.trade) {
    case 'Messenger boy':
      return roaming(world, p, {
        places: sample(spotsInRooms(site, SHOP_ROOMS), 60),
        between: [3, 10],
        goingTo: (room) => `carrying a box of parts to the ${room}`,
        at: (room) => `handing over parts and a work tally in the ${room}`,
      });
    case 'Labourer':
      return roaming(world, p, {
        places: sample(spotsInRooms(site, deptRooms(p.dept).length ? deptRooms(p.dept) : SHOP_ROOMS), 30),
        between: [5, 20],
        goingTo: (room) => `wheeling a barrow of bar steel to the ${room}`,
        at: (room) => `unloading bar steel in the ${room}`,
      });
    case 'Setter':
      return roaming(world, p, {
        places: spotsInRooms(site, ['machine-shop']),
        between: [10, 30],
        dwell: [10, 30],
        goingTo: () => 'going to set up a lathe',
        at: () => 'setting the tools on a capstan lathe',
      });
    case 'Millwright':
      return roaming(world, p, {
        places: sample(spotsInRooms(site, SHOP_ROOMS), 40),
        between: [20, 60],
        dwell: [5, 20],
        goingTo: (room) => `going to see to the shafting in the ${room}`,
        at: (room) => `oiling the line-shaft bearings in the ${room}`,
      });
    case 'Yard labourer':
      return roaming(world, p, {
        places: ['COAL', 'WHARF', 'DOCK', 'Y_W', 'N2', 'N3', 'BY1', 'Y7', 'E_N', 'Y2'],
        between: [5, 15],
        dwell: [5, 20],
        goingTo: (place) => `going to the ${place.toLowerCase()}`,
        at: () => 'sweeping and tidying the yard',
      });
    case 'Carman':
      return roaming(world, p, {
        places: ['N1', 'DOCK', 'Y1'],
        between: [20, 50],
        dwell: [5, 15],
        goingTo: () => 'going to the despatch dock',
        at: () => 'seeing to the horses and the dray',
      });
    case 'Office boy':
      return roaming(world, p, {
        places: ['md-desk', 'secretary-desk', 'cashier-desk', 'works-manager', 'wages-1', 'storekeeper', 'typist-1', 'buyer', 'works-accountant'],
        between: [4, 15],
        goingTo: (room) => `taking letters to the ${room}`,
        at: (room) => `handing over letters in the ${room}`,
      });
    case 'Progress Chaser':
      return roaming(world, p, {
        places: sample(spotsInRooms(site, SHOP_ROOMS), 50),
        between: [5, 20],
        goingTo: (room) => `chasing a batch in the ${room}`,
        at: (room) => `asking after a late batch in the ${room}`,
      });
    default:
      return steadyWork(world, p);
  }
}
