// The L. & N.W.R. goods yard at Warwick Road, Coventry, about two miles
// from the works: the second, smaller diorama (DESIGN.md §3).
//
// Its elements are documented for c. 1890–1920: a walled yard entered off
// Warwick Road with a weighbridge office at the gate; long goods sheds with
// a road and an internal platform; the L. & N.W.R.'s two-storey range along
// Warwick Road "which housed stables beneath"; a 5-ton hand crane; wagon
// turntables; cattle pens. The plan is stylised and invented.
//
// The working day follows West, The Railway Goods Station (1912): inward
// wagons are unloaded first thing so the carmen can deliver "first thing in
// the morning"; outward goods come "tumbling in… between 5 and 7 o'clock in
// the evening, for trains that must depart within the next two or three
// hours"; a loading gang is "checker, caller-off, and loader". Wagons are
// L. & N.W.R. lead grey, lettered L N W R (since 1908) with the white
// diamonds still painted (until c. 1915); the Midland's are lettered M R.
import { until, wait } from '../../engine/sim/kernel.js';
import { walk } from '../../engine/sim/world.js';
import { MALE, SURNAMES } from './names.js';

// The goods yard's own corner of the map, far from the works.
export const GX = -2000;
export const GZ = -2000;
const X = (dx) => GX + dx;
const Z = (dz) => GZ + dz;

const SHED_ROAD_Z = Z(-17);
const SLOT_X = [-122, -78, -34, 10, 54, 98].map(X);
const SIDINGS_Z = [Z(-58), Z(-82), Z(-106)];

export const goodsYard = {
  buildings: [
    {
      id: 'gy-shed', name: 'No. 2 Goods Shed, Warwick Road', x: X(-150), z: Z(-30), w: 300, d: 60,
      floors: 1, floorHeight: 22, roof: { type: 'gable', pitch: 0.32 }, style: 'works', litHours: [5 * 60 + 30, 20 * 60 + 45],
      signs: [{ side: 'S', y: 17, width: 120, height: 3.2, text: 'L. & N. W. R.   GOODS DEPARTMENT' }],
      doors: [-110, -40, 30, 100].map((dx, i) => ({ side: 'S', x: X(dx), to: `GY_BAY${i + 1}`, id: `gy-shed:bay${i + 1}` })),
      rooms: [{ id: 'gy-shed-floor', name: 'No. 2 Goods Shed', floor: 0, x0: X(-150), x1: X(150) }],
    },
    {
      id: 'gy-range', name: 'L. & N.W.R. Stables and Goods Offices', x: X(-70), z: Z(70), w: 250, d: 26,
      floors: 2, floorHeight: 13, roof: { type: 'hipped', pitch: 0.5 }, style: 'works', stairs: [X(-60)], litHours: [6 * 60, 21 * 60],
      doors: [{ side: 'N', x: X(40), to: 'GY_STABLES', id: 'gy-range:door' }],
      rooms: [
        { id: 'gy-stables', name: 'Stables', floor: 0, x0: X(-70), x1: X(180) },
        { id: 'gy-offices', name: 'Goods and Cartage Offices', floor: 1, x0: X(-70), x1: X(180) },
      ],
    },
    {
      id: 'gy-weigh', name: 'Weighbridge Office', x: X(-138), z: Z(70), w: 20, d: 16,
      floors: 1, floorHeight: 10, roof: { type: 'gable', pitch: 0.6 }, style: 'office', litHours: [6 * 60, 20 * 60],
      doors: [{ side: 'N', x: X(-128), to: 'GY_WBO', id: 'gy-weigh:door' }],
      rooms: [{ id: 'gy-weigh-office', name: 'Weighbridge Office', floor: 0, x0: X(-138), x1: X(-118) }],
    },
  ],
  nodes: [
    { id: 'GY_ROAD_W', x: X(-420), z: Z(130), kind: 'home', label: 'Warwick Road, from the town' },
    { id: 'GY_ROAD', x: X(-94), z: Z(130), label: 'Warwick Road' },
    { id: 'GY_GATE', x: X(-94), z: Z(106), label: 'Goods yard gate' },
    { id: 'GY_WB', x: X(-94), z: Z(86), label: 'Weighbridge' },
    { id: 'GY_WBO', x: X(-128), z: Z(60) },
    { id: 'GY_C1', x: X(-110), z: Z(54) },
    { id: 'GY_C2', x: X(-40), z: Z(54) },
    { id: 'GY_C3', x: X(30), z: Z(54) },
    { id: 'GY_C4', x: X(100), z: Z(54) },
    { id: 'GY_E', x: X(180), z: Z(54) },
    { id: 'GY_NE', x: X(180), z: Z(-40) },
    { id: 'GY_CRANE', x: X(180), z: Z(-70), label: 'The 5-ton crane' },
    { id: 'GY_STABLES', x: X(40), z: Z(62), label: 'Stables' },
    ...[-110, -40, 30, 100].map((dx, i) => ({ id: `GY_BAY${i + 1}`, x: X(dx), z: Z(42), label: `Cart bay ${i + 1}` })),
  ],
  edges: [
    ['GY_ROAD_W', 'GY_ROAD'], ['GY_ROAD', 'GY_GATE'], ['GY_GATE', 'GY_WB'], ['GY_WB', 'GY_C1'], ['GY_WB', 'GY_WBO'],
    ['GY_C1', 'GY_C2'], ['GY_C2', 'GY_C3'], ['GY_C3', 'GY_C4'], ['GY_C4', 'GY_E'], ['GY_E', 'GY_NE'], ['GY_NE', 'GY_CRANE'],
    ['GY_C3', 'GY_STABLES'],
    ['GY_C1', 'GY_BAY1'], ['GY_C2', 'GY_BAY2'], ['GY_C3', 'GY_BAY3'], ['GY_C4', 'GY_BAY4'],
  ],
  spots: [
    { id: 'gy-platform', room: 'gy-shed-floor', x: X(0), z: Z(10), type: 'shed-platform', facing: 0, label: 'The goods platform' },
    { id: 'gy-checker', room: 'gy-shed-floor', x: X(-60), z: Z(20), type: 'checker-desk', facing: Math.PI, label: "Checker's desk" },
    { id: 'gy-heap-out', room: 'gy-shed-floor', x: X(-15), z: Z(12), type: 'none', label: 'Outward goods for the night trains' },
    { id: 'gy-heap-in', room: 'gy-shed-floor', x: X(75), z: Z(12), type: 'none', label: 'Inward goods for delivery' },
    ...SLOT_X.map((x, i) => ({ id: `gy-slot-${i + 1}`, room: 'gy-shed-floor', x, z: Z(-4), type: 'none', label: `Wagon ${i + 1} on the shed road` })),
    { id: 'gy-weigh-desk', room: 'gy-weigh-office', x: X(-128), z: Z(78), type: 'desk', facing: Math.PI, label: 'Weighbridge clerk' },
    { id: 'gy-foreman', room: 'gy-offices', x: X(40), z: Z(78), type: 'desk', facing: Math.PI, label: "Cartage foreman's office" },
    { id: 'gy-invoicing', room: 'gy-offices', x: X(70), z: Z(78), type: 'sloping-desk', facing: Math.PI, label: 'Invoicing clerks' },
    { id: 'gy-stall-1', room: 'gy-stables', x: X(120), z: Z(83), type: 'none', label: 'Stables' },
  ],
  // What the renderer draws around it: the yard, Warwick Road, the rails.
  scenery: {
    name: 'Warwick Road goods yard',
    ground: { x0: X(-205), x1: X(225), z0: Z(-155), z1: Z(110), colour: '#6f6a60' },
    road: { x0: X(-460), x1: X(420), z: Z(132), width: 34 },
    wall: { x0: X(-205), x1: X(225), z0: Z(-155), z1: Z(110), height: 9, gates: [[X(-112), X(-76)]] },
    tracks: [
      { x0: X(-200), x1: X(400), z: SHED_ROAD_Z },
      ...SIDINGS_Z.map((z) => ({ x0: X(-200), x1: X(400), z })),
      { x0: X(-600), x1: X(600), z: Z(-172) }, { x0: X(-600), x1: X(600), z: Z(-186) },
    ],
    turntables: [[X(-180), SHED_ROAD_Z], [X(-180), SIDINGS_Z[0]]],
    crane: { x: X(196), z: Z(-70), facing: -Math.PI / 2 },
    weighbridge: { x: X(-94), z: Z(86), w: 10, d: 18 },
    pens: { x0: X(160), x1: X(215), z0: Z(15), z1: Z(42) },
    lamps: [[X(-100), Z(60)], [X(10), Z(60)], [X(120), Z(60)], [X(180), Z(-20)], [X(-160), Z(-70)], [X(60), Z(-70)]],
    terraces: [
      { x0: X(-440), x1: X(-150), z: Z(160), depth: 30, facing: 'N', storeys: 2 },
      { x0: X(-110), x1: X(400), z: Z(160), depth: 30, facing: 'N', storeys: 2 },
    ],
  },
};

// --- The yard's people, wagons and work ----------------------------------------------

const GANG = [
  ['Goods checker', 'gy-checker', 30],
  ['Caller-off', 'gy-checker', 24],
  ['Goods porter', 'gy-platform', 21],
  ['Goods porter', 'gy-platform', 21],
  ['Goods porter', 'gy-platform', 21],
  ['Shunt-horse driver', 'gy-platform', 22],
  ['Weighbridge clerk', 'gy-weigh-desk', 25],
  ['Cartage foreman', 'gy-foreman', 38],
];

export function setupRailway(world) {
  const rng = world.rng.fork('railway');
  const R = {
    rng,
    wagons: [],
    heapOut: [], // outward goods waiting on the platform: { crates, packages, region, ours }
    heapIn: [], // inward goods unloaded for the carmen: { packages, consignment }
    calls: [], // vehicles at the bays waiting for the checker
    bays: ['GY_BAY1', 'GY_BAY2', 'GY_BAY3', 'GY_BAY4'].map((node) => ({ node, busy: null })),
    staff: [],
    departures: [],
    shunt: null,
    wagonNo: 61200,
    atTheYard,
    loadAtTheYard,
    backToTheYard,
    vehicles: [],
  };
  world.railway = R;
  const uniform = { coat: '#262a33', legs: '#24252a', apron: null, sex: 'M', scale: 1, collar: false };
  GANG.forEach(([trade, spot, weekly], i) => {
    const p = world.addPerson({
      id: world.id('r'), name: `${rng.weighted(MALE)} ${rng.weighted(SURNAMES)}`, sex: 'M', age: rng.int(24, 58),
      trade, title: trade, role: 'railway', dept: 'railway', deptName: 'L. & N.W.R. Goods Department, Coventry',
      weekly: weekly * 48, spot, home: 'GY_ROAD_W', node: 'GY_ROAD_W', onSite: false, activity: 'at home', record: [],
      look: { ...uniform, hat: trade === 'Cartage foreman' ? 'bowler' : 'cap', collar: trade === 'Cartage foreman' || trade === 'Weighbridge clerk' },
      outside: true,
    });
    R.staff.push(p);
    if (i === 0) R.checker = p;
  });
  return R;
}

const DAY_START = 6 * 60;
const DAY_END = 20 * 60 + 45;
const NIGHT_GOODS = 20 * 60 + 30;

function onDuty(world, t) {
  const cal = world.cal;
  const mod = cal.minuteOfDay(t);
  return cal.dow(t) !== 0 && mod >= DAY_START && mod < DAY_END;
}

// Come in from Warwick Road at six, go home at a quarter to nine at night.
function* attend(world, p) {
  const cal = world.cal;
  if (onDuty(world, world.sim.now)) {
    if (!p.onSite) {
      p.node = 'GY_ROAD_W';
      p.onSite = true;
      yield* walk(world, p, p.spot, { activity: 'coming on duty' });
    }
    return;
  }
  if (p.onSite) {
    yield* walk(world, p, 'GY_ROAD_W', { activity: 'going home' });
    p.onSite = false;
  }
  p.activity = 'at home';
  let next = cal.dayStart(world.sim.now) + DAY_START;
  if (next <= world.sim.now) next += 1440;
  if (cal.dow(next) === 0) next += 1440;
  yield until(next - world.rng.uniform(0, 10));
  p.node = 'GY_ROAD_W';
  p.onSite = true;
  yield* walk(world, p, p.spot, { activity: 'coming on duty' });
  if (world.sim.now < next) {
    p.activity = 'waiting to sign on';
    yield until(next);
  }
}

// Each morning at half past five the shunt horse places the day's wagons on
// the shed road: last night's inward vans, and empty opens for the evening's
// outward goods; at half past eight in the evening it draws the loaded
// wagons out for the night goods.
export function* yardDay(world) {
  const R = world.railway;
  const cal = world.cal;
  const P = world.purchasing;
  const rng = R.rng;
  for (;;) {
    let day = cal.dayStart(world.sim.now) + (cal.minuteOfDay(world.sim.now) > 5 * 60 + 30 ? 1440 : 0);
    if (cal.dow(day) === 0) day += 1440;
    yield until(day + 5 * 60 + 30);
    R.wagons = R.wagons.filter((w) => w.state === 'siding');
    if (!R.wagons.length) placeSidings(R);
    // Inward: our consignments that came by the night goods, and others'.
    const ours = (P?.consignments || []).filter((c) => c.atYard && c.atYard <= world.sim.now && !c.delivered && !c.unloaded);
    const inward = [
      { slot: 0, kind: 'van', owner: 'LNWR', goods: ours.filter((c) => c.carrier === 'L. & N.W.R.') },
      { slot: 1, kind: 'van', owner: 'MR', goods: ours.filter((c) => c.carrier === 'Midland Railway') },
    ];
    for (const w of inward) {
      const others = rng.int(12, 30);
      R.wagons.push(newWagon(R, { ...w, state: 'inward', others, packages: w.goods.reduce((a, c) => a + c.packages, 0) + others }));
    }
    ['North', 'North', 'South', 'South'].forEach((region, k) => R.wagons.push(newWagon(R, { slot: k + 2, kind: 'open', owner: 'LNWR', state: 'loading', region, crates: 0, packages: 0 })));
    R.shunt = { t0: world.sim.now, t1: world.sim.now + 6, dir: 'in' };
    // In the evening: draw the loaded wagons out for the night goods.
    yield until(day + NIGHT_GOODS);
    const out = R.wagons.filter((w) => w.slot !== undefined);
    for (const w of out) w.moving = { t0: world.sim.now, t1: world.sim.now + 5, dx: 420 };
    R.shunt = { t0: world.sim.now, t1: world.sim.now + 5, dir: 'out' };
    const crates = out.reduce((a, w) => a + (w.crates || 0), 0);
    if (crates) world.log(`The night goods left Warwick Road with ${crates} crates of Sherbourne cycles among its wagons.`, { kind: 'railway' });
    R.departures.push({ t: world.sim.now, crates, wagons: out.length });
    yield wait(6);
    R.wagons = R.wagons.filter((w) => !out.includes(w));
  }
}

function newWagon(R, w) {
  return { id: `wagon-${R.wagonNo}`, no: R.wagonNo++, crates: 0, packages: 0, sheeted: false, ...w, x: w.slot !== undefined ? SLOT_X[w.slot] : w.x, z: w.z ?? SHED_ROAD_Z };
}

// Wagons standing in the sidings, sheeted: timber, iron, a cattle wagon.
function placeSidings(R) {
  const rng = R.rng;
  SIDINGS_Z.forEach((z, k) => {
    const n = 4 + rng.int(0, 3);
    for (let i = 0; i < n; i++) {
      const kind = rng.weighted([['open', 6], ['van', 3], ['cattle', 1]]);
      R.wagons.push(newWagon(R, { kind, owner: rng.chance(0.8) ? 'LNWR' : 'MR', state: 'siding', x: X(-140 + i * 44 + k * 9), z, sheeted: kind === 'open' && rng.chance(0.7), packages: kind === 'open' ? rng.int(4, 12) : 0 }));
    }
  });
}

// The loading gang: unload the inward vans first thing, load the outward
// wagons as goods come in, sheet them in the evening.
export function* porter(world, p) {
  const R = world.railway;
  const cal = world.cal;
  const rng = R.rng;
  for (;;) {
    yield* attend(world, p);
    const mod = cal.minuteOfDay(world.sim.now);
    const inward = R.wagons.find((w) => w.state === 'inward' && w.packages > 0 && !w.busy);
    if (inward) {
      inward.busy = p;
      yield* walk(world, p, `gy-slot-${inward.slot + 1}`, { activity: `unloading the ${inward.owner === 'MR' ? 'Midland' : 'L. & N.W.R.'} van No. ${inward.no}` });
      const n = Math.min(inward.packages, rng.int(2, 4));
      yield wait(2.5);
      inward.packages -= n;
      yield* walk(world, p, 'gy-heap-in', { activity: 'trucking inward goods to the delivery bank' });
      R.inwardOnBank = (R.inwardOnBank || 0) + n;
      if (inward.packages <= 0) {
        inward.state = 'empty';
        R.othersOnBank = (R.othersOnBank || 0) + inward.others;
        for (const c of inward.goods || []) {
          c.unloaded = world.sim.now;
          R.heapIn.push({ packages: c.packages, consignment: c });
        }
      }
      inward.busy = null;
      continue;
    }
    const heap = R.heapOut.find((h) => (h.crates || h.packages) > 0 && !h.busy);
    if (heap) {
      heap.busy = p;
      const wagon = R.wagons.find((w) => w.state === 'loading' && w.region === heap.region && !w.sheeted)
        || R.wagons.find((w) => w.state === 'loading' && !w.sheeted);
      yield* walk(world, p, 'gy-heap-out', { activity: 'loading outward goods' });
      yield wait(1);
      if (wagon) {
        const crates = Math.min(heap.crates || 0, 2);
        const packages = crates ? 0 : Math.min(heap.packages || 0, 3);
        heap.crates = (heap.crates || 0) - crates;
        heap.packages = (heap.packages || 0) - packages;
        yield* walk(world, p, `gy-slot-${wagon.slot + 1}`, { activity: crates ? `loading ${crates} cycle crate${crates > 1 ? 's' : ''} into wagon No. ${wagon.no} for the ${wagon.region}` : `loading packages into wagon No. ${wagon.no}` });
        yield wait(1.5);
        wagon.crates += crates;
        wagon.packages += packages;
      }
      heap.busy = null;
      R.heapOut = R.heapOut.filter((h) => (h.crates || 0) + (h.packages || 0) > 0);
      continue;
    }
    // Sheet the loaded wagons before the night goods.
    if (mod >= 19 * 60 + 45 && mod < NIGHT_GOODS) {
      const w = R.wagons.find((x) => x.state === 'loading' && !x.sheeted && (x.crates || x.packages));
      if (w) {
        yield* walk(world, p, `gy-slot-${w.slot + 1}`, { activity: `sheeting wagon No. ${w.no} and labelling it for the ${w.region}` });
        yield wait(6);
        w.sheeted = true;
        continue;
      }
    }
    yield* walk(world, p, p.spot, { activity: 'waiting for the carts' });
    yield wait(rng.uniform(3, 8));
  }
}

// The checker meets each cart at the bay, checks the goods against the
// consignment notes, and signs; the notes go upstairs to the invoicing clerks.
export function* checker(world, p) {
  const R = world.railway;
  for (;;) {
    yield* attend(world, p);
    const call = R.calls.find((c) => !c.checked);
    if (call) {
      call.taking = true;
      yield* walk(world, p, call.bay.node, { activity: `checking ${call.vehicle.name}’s load against the consignment notes` });
      for (const d of call.notes || []) world.paper.hold(d, p);
      yield wait(2 + (call.items || 1) * 0.3);
      call.checked = { by: p, t: world.sim.now };
      // The carman keeps the notes until they're signed and handed in.
      for (const d of call.notes || []) if (call.holder) world.paper.hold(d, call.holder);
      yield* walk(world, p, p.spot, { activity: 'back to the checker’s desk' });
      continue;
    }
    p.activity = R.wagons.some((w) => w.state === 'loading') ? 'calling off the goods at the wagon side' : 'at the checker’s desk';
    yield wait(4);
  }
}

// The others: the weighbridge clerk, the foreman and the shunt-horse driver
// keep to their places and walk the yard now and then.
export function* yardHand(world, p) {
  const R = world.railway;
  const rng = R.rng;
  const rounds = {
    'Cartage foreman': ['GY_C2', 'GY_C4', 'GY_STABLES', 'GY_CRANE', 'gy-platform'],
    'Shunt-horse driver': ['GY_NE', 'GY_CRANE', 'GY_STABLES'],
    'Weighbridge clerk': ['GY_WB'],
  }[p.trade] || [];
  const doing = {
    'Cartage foreman': 'seeing the carts in and out',
    'Shunt-horse driver': 'seeing to the shunt horse',
    'Weighbridge clerk': 'entering weights in the weighbridge book',
  }[p.trade] || 'at work';
  for (;;) {
    yield* attend(world, p);
    if (R.shunt && world.sim.now < R.shunt.t1 && p.trade === 'Shunt-horse driver') {
      p.activity = R.shunt.dir === 'in' ? 'placing the day’s wagons on the shed road' : 'drawing the loaded wagons out for the night goods';
      yield wait(1);
      continue;
    }
    p.activity = doing;
    yield wait(rng.uniform(8, 25));
    if (rounds.length && rng.chance(0.5) && onDuty(world, world.sim.now)) {
      yield* walk(world, p, rng.pick(rounds), { activity: p.trade === 'Weighbridge clerk' ? 'weighing a cart on the weighbridge' : 'going round the yard' });
      yield wait(rng.uniform(2, 6));
      yield* walk(world, p, p.spot, { activity: 'going back' });
    }
  }
}

// --- Vehicles visiting the yard --------------------------------------------------------------

// A free cart bay, waiting for one if need be.
function* takeBay(world) {
  const R = world.railway;
  for (;;) {
    const free = R.bays.filter((b) => !b.busy);
    if (free.length) return R.rng.pick(free);
    yield wait(2);
  }
}

// Arrive at the yard from the road, back up to a bay, and have the load
// checked. `unload` (a generator) runs at the bay.
export function* atTheYard(world, v, { notes = [], items = 1, holder = null, unload }) {
  const R = world.railway;
  v.node = 'GY_ROAD_W';
  v.onSite = true;
  const bay = yield* takeBay(world);
  bay.busy = v;
  yield* walk(world, v, bay.node, { mode: 'vehicle', speed: 240, activity: 'turning into the goods yard' });
  const call = { vehicle: v, bay, notes, items, holder, checked: null };
  R.calls.push(call);
  v.activity = 'unloading at the goods shed';
  if (unload) yield* unload();
  v.activity = 'waiting for the checker to sign';
  for (let i = 0; i < 40 && !call.checked; i++) yield wait(1);
  R.calls.splice(R.calls.indexOf(call), 1);
  bay.busy = null;
  yield* walk(world, v, 'GY_ROAD_W', { mode: 'vehicle', speed: 260, activity: 'leaving the goods yard' });
  v.onSite = false;
  return call.checked;
}

// A railway van loads at a bay from the delivery bank and sets off.
export function* loadAtTheYard(world, v, packages) {
  const R = world.railway;
  v.parked = false;
  v.onSite = true;
  v.node = 'GY_STABLES';
  v.driver = { name: v.driverName };
  const bay = yield* takeBay(world);
  bay.busy = v;
  yield* walk(world, v, bay.node, { mode: 'vehicle', speed: 200, activity: 'backing up to the delivery bank' });
  v.activity = `loading ${packages} packages for the Sherbourne Works`;
  yield wait(4 + packages * 0.5);
  v.load = packages;
  R.inwardOnBank = Math.max(0, (R.inwardOnBank || 0) - packages);
  bay.busy = null;
  yield* walk(world, v, 'GY_ROAD_W', { mode: 'vehicle', speed: 260, activity: 'leaving the goods yard' });
  v.onSite = false;
}

export function* backToTheYard(world, v) {
  v.node = 'GY_ROAD_W';
  v.onSite = true;
  yield* walk(world, v, 'GY_STABLES', { mode: 'vehicle', speed: 240, activity: 'coming back to the stables' });
  v.onSite = false;
  v.parked = true;
  v.driver = null;
  v.activity = 'standing in the yard';
}

// Other traders' carts bringing goods for the night trains, mostly in the
// evening rush (est. numbers).
export function* tradersCart(world, cart) {
  const R = world.railway;
  const cal = world.cal;
  const rng = R.rng;
  for (;;) {
    const mod = cal.minuteOfDay(world.sim.now);
    const busy = mod >= 17 * 60 && mod < 19 * 60 + 30;
    const open = mod >= 8 * 60 && mod < 19 * 60 + 30 && cal.dow(world.sim.now) !== 0;
    yield wait(open ? rng.uniform(busy ? 4 : 30, busy ? 18 : 100) : 30);
    if (!open) continue;
    const packages = rng.int(3, 14);
    cart.name = rng.pick(['a carrier’s cart', 'a brewer’s dray', 'a ribbon weaver’s van', 'a watchmaker’s cart', 'a coal merchant’s cart', 'a draper’s van']);
    cart.load = packages;
    cart.driver = { name: 'the carman' };
    yield* atTheYard(world, cart, {
      items: packages,
      *unload() {
        yield wait(packages * 0.6);
        R.heapOut.push({ packages, region: rng.pick(['North', 'South']), ours: false });
        cart.load = 0;
        // Often it takes away goods that came in for its own people.
        if (R.othersOnBank > 0 && rng.chance(0.4)) {
          const k = Math.min(R.othersOnBank, rng.int(2, 6));
          cart.activity = `loading ${k} package${k > 1 ? 's' : ''} from the delivery bank`;
          yield wait(k * 0.6);
          R.othersOnBank -= k;
          R.inwardOnBank = Math.max(0, R.inwardOnBank - k);
          cart.load = k;
        }
      },
    });
    cart.driver = null;
  }
}

export function railwayStaffProcess(world, p) {
  if (p.trade === 'Goods checker') return checker(world, p);
  if (/porter|Caller-off/i.test(p.trade)) return porter(world, p);
  return yardHand(world, p);
}

export { SLOT_X, SHED_ROAD_Z };
