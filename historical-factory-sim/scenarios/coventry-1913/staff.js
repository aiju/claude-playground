// The people of the Sherbourne Works.
//
// Department sizes follow the research report's estimated allocation for a
// firm of about 400 hands (itself an estimate: no departmental headcount for a
// British cycle works of 1910–14 survives). Trades follow Carter's 1912 list
// of jobs in Coventry cycle works. Hourly rates follow the Coventry Trades
// Council's 1913 figures (Carr 1978) and Carter's cycle-trade weekly averages,
// divided by 53 hours; women's, youths' and staff pay are estimates.
import { d, s, lsd } from '../../engine/sim/money.js';
import { MALE, FEMALE, SURNAMES } from './names.js';

// [trade, count, spot prefix or base spot, hourly rate in pence, sex, age range, opts]
// opts.roam: walks about the department rather than standing at one spot.
// opts.weekly: paid by the week (shillings) rather than by the hour.
const M = 'M';
const F = 'F';

export const DEPARTMENTS = [
  {
    id: 'machine', name: 'Machine Shop', room: 'machine-shop', worksNos: 100,
    foreman: { weekly: 60 },
    hands: [
      ['Turner', 14, 'capstan-', 8.5, M, [22, 58]],
      ['Machine minder', 16, 'capstan-', 7, M, [19, 55]],
      ['Machine minder (youth)', 10, 'capstan-', 3.5, M, [15, 18]],
      ['Automatic minder', 10, 'auto-', 3.25, F, [16, 26]],
      ['Automatic minder (youth)', 8, 'auto-', 3.5, M, [15, 18]],
      ['Setter', 6, 'capstan-1', 9, M, [26, 55], { roam: true }],
      ['Labourer', 5, 'capstan-1', 6, M, [18, 60], { roam: true }],
    ],
  },
  {
    id: 'press', name: 'Press Shop and Hardening', room: 'press-shop', worksNos: 200,
    foreman: { weekly: 52 },
    hands: [
      ['Presser', 6, 'press-', 7, M, [18, 55]],
      ['Presser', 2, 'press-', 3, F, [16, 24]],
      ['Hardener', 4, 'hardening-', 7.5, M, [24, 58]],
      ['Labourer', 2, 'press-1', 6, M, [18, 60], { roam: true }],
    ],
  },
  {
    id: 'toolroom', name: 'Toolroom and Pattern Shop', room: 'toolroom', worksNos: 230,
    foreman: { weekly: 65 },
    hands: [
      ['Toolmaker', 13, 'toolroom-', 9, M, [24, 60]],
      ['Apprentice toolmaker', 3, 'toolroom-', 2.5, M, [15, 20]],
      ['Patternmaker', 3, 'pattern-', 10.25, M, [26, 60]],
    ],
  },
  {
    id: 'frames', name: 'Frame Building', room: 'frame-shop', worksNos: 300,
    foreman: { weekly: 55 },
    hands: [
      ['Frame builder', 10, 'frame-jig-', 8, M, [22, 55]],
      ['Frame builder (learner)', 5, 'frame-jig-', 3.5, M, [15, 19]],
    ],
  },
  {
    id: 'brazing', name: 'Brazing Shop', room: 'brazing', worksNos: 320,
    hands: [
      ['Brazer', 8, 'hearth-', 8, M, [24, 55]],
      ['Brazer’s boy', 2, 'hearth-', 2.5, M, [14, 16]],
    ],
  },
  {
    id: 'filing', name: 'Filing and Sand-blast', room: 'filing', worksNos: 340,
    foreman: { weekly: 50 },
    hands: [
      ['Filer', 14, 'file-bench-', 6.75, M, [18, 55]],
      ['Sand-blaster', 4, 'sandblast-', 6.75, M, [18, 50]],
      ['Pickler', 2, 'pickle-', 6.5, M, [20, 55]],
    ],
  },
  {
    id: 'polishing', name: 'Polishing Shop', room: 'polishing', worksNos: 400,
    foreman: { weekly: 52 },
    hands: [
      ['Polisher', 27, 'spindle-', 7, M, [18, 55]],
      ['Polisher (rough)', 8, 'spindle-', 3, F, [16, 28]],
    ],
  },
  {
    id: 'plating', name: 'Plating Shop', room: 'plating', worksNos: 450,
    foreman: { weekly: 52 },
    hands: [
      ['Plater', 6, 'plating-vat-', 7.5, M, [22, 55]],
      ['Plater’s youth', 3, 'plating-vat-', 3, M, [15, 18]],
      ['Scrubber', 6, 'scrub-', 2.25, F, [14, 20]],
    ],
  },
  {
    id: 'enamelling', name: 'Enamelling Shop', room: 'enamelling', worksNos: 500,
    foreman: { weekly: 55 },
    hands: [
      ['Enameller', 6, 'dip-', 6.75, M, [22, 55]],
      ['Enameller', 8, 'rubbing-', 6.75, M, [20, 55]],
      ['Enameller’s youth', 6, 'rubbing-', 3, M, [15, 18]],
    ],
  },
  {
    id: 'lining', name: 'Lining and Transfers', room: 'lining', worksNos: 530,
    hands: [
      ['Liner', 5, 'lining-bench-', 8.75, M, [24, 55]],
      ['Transfer hand', 3, 'lining-bench-', 3.25, F, [17, 28]],
    ],
  },
  {
    id: 'wheels', name: 'Wheel Shop', room: 'wheel-shop', worksNos: 600,
    foreman: { weekly: 52 },
    hands: [
      ['Spoke-machine minder', 4, 'spoke-machine-', 3, M, [15, 18]],
      ['Lacer (youth)', 6, 'lacing-', 3, M, [15, 18]],
      ['Lacer', 6, 'lacing-', 2.75, F, [15, 22]],
      ['Wheel truer', 8, 'truing-', 8.25, M, [22, 55]],
      ['Wheel builder', 6, 'truing-', 7.5, M, [20, 55]],
    ],
  },
  {
    id: 'brakework', name: 'Brakework and Fitting', room: 'brakework', worksNos: 640,
    hands: [
      ['Fitter', 12, 'fitting-bench-', 8.5, M, [21, 58]],
      ['Fitter’s youth', 1, 'fitting-bench-', 3, M, [15, 18]],
      ['Dress-guard lacer', 2, 'fitting-bench-', 2.75, F, [15, 24]],
    ],
  },
  {
    id: 'finishing', name: 'Finishing Shop', room: 'finishing', worksNos: 700,
    foreman: { weekly: 58 },
    hands: [
      ['Finisher', 25, 'pillar-bench-', 8.5, M, [21, 55]],
      ['Finisher (learner)', 10, 'pillar-bench-', 3.5, M, [15, 20]],
    ],
  },
  {
    id: 'viewing', name: 'Viewing and Testing', room: 'view-room', worksNos: 750,
    hands: [
      ['Chief viewer', 1, 'viewing-bench-', 0, M, [35, 60], { weekly: 48 }],
      ['Viewer', 5, 'viewing-bench-', 8.5, M, [26, 58]],
      ['Cycle tester', 4, 'test-stand-', 8, M, [22, 45]],
    ],
  },
  {
    id: 'warehouse', name: 'Warehouse, Wrapping and Despatch', room: 'warehouse', worksNos: 800,
    foreman: { weekly: 48 },
    hands: [
      ['Wrapper', 10, 'wrapping-', 3, F, [17, 35]],
      ['Wrapper (girl)', 5, 'wrapping-', 2, F, [14, 16]],
      ['Warehouseman', 6, 'warehouse-', 7, M, [22, 58]],
      ['Carman', 3, 'stable-room', 6.5, M, [24, 60], { roam: true, base: 'N1' }],
    ],
  },
  {
    id: 'crates', name: 'Crate Shop', room: 'crate-room', worksNos: 830,
    hands: [
      ['Carpenter', 4, 'crate-bench-', 8.5, M, [24, 60]],
      ['Carpenter’s boy', 1, 'crate-bench-', 2.5, M, [14, 16]],
    ],
  },
  {
    id: 'stores', name: 'Stores', room: 'rough-stores', worksNos: 1,
    hands: [
      ['Storekeeper', 1, 'storekeeper', 0, M, [35, 60], { weekly: 45 }],
      ['Storeman', 6, 'bins-', 6.5, M, [20, 60]],
      ['Finished-stores man', 4, 'finished-bins-', 6.5, M, [20, 60]],
      ['Messenger boy', 8, 'stores-counter', 2.5, M, [14, 16], { roam: true }],
      ['Labourer', 2, 'stores-counter', 6, M, [18, 60], { roam: true }],
    ],
  },
  {
    id: 'engine', name: 'Engine House, Boilers and Yard', room: 'engine-room', worksNos: 900,
    hands: [
      ['Engine driver', 1, 'engine-driver', 0, M, [35, 60], { weekly: 42, timetable: 'engine' }],
      ['Stoker', 2, 'stoker-', 6.5, M, [24, 55], { timetable: 'engine' }],
      ['Millwright', 2, 'engine-driver', 9, M, [28, 60], { roam: true }],
      ['Smith', 1, 'forge-', 8.5, M, [28, 60]],
      ['Striker', 1, 'forge-', 6, M, [18, 45]],
      ['Yard labourer', 6, 'Y4', 6, M, [18, 62], { roam: true }],
    ],
  },
];

// Salaried staff: [title, spot, salary £ a year, sex, age range, timetable, opts]
export const STAFF = [
  ['Managing Director', 'md-desk', 600, M, [42, 42], 'office', { name: 'Charles Hartwell', look: 'gentleman' }],
  ['Secretary and Accountant', 'secretary-desk', 300, M, [38, 55], 'office', { look: 'gentleman' }],
  ['Cashier', 'cashier-desk', 160, M, [35, 55], 'office'],
  ['Chief Clerk', 'chief-clerk', 140, M, [32, 55], 'office'],
  ['Correspondence Clerk', 'correspondence-clerk', 100, M, [22, 40], 'office'],
  ['Typist', 'typist-', 52, F, [18, 26], 'office'],
  ['Typist', 'typist-', 52, F, [18, 26], 'office'],
  ['Order and Invoice Clerk', 'order-clerk', 90, M, [20, 40], 'office'],
  ['Sales Ledger Clerk', 'sales-ledger', 85, M, [20, 40], 'office'],
  ['Bought Ledger Clerk', 'bought-ledger', 85, M, [20, 40], 'office'],
  ['Buyer', 'buyer', 180, M, [32, 55], 'office'],
  ["Buyer's Clerk", 'buyer-clerk', 70, M, [18, 30], 'office'],
  ['Despatch Clerk', 'despatch-clerk', 80, M, [20, 40], 'worksStaff'],
  ['Traveller (North)', 'traveller-1', 160, M, [28, 50], 'office', { away: true }],
  ['Traveller (South)', 'traveller-2', 160, M, [28, 50], 'office', { away: true }],
  ['Office boy', 'office-boys', 26, M, [14, 15], 'office', { roam: true }],
  ['Office boy', 'office-boys', 26, M, [14, 15], 'office', { roam: true }],
  ['Works Manager', 'works-manager', 350, M, [40, 55], 'worksStaff', { look: 'gentleman' }],
  ['Works Accountant and Estimator', 'works-accountant', 200, M, [30, 50], 'worksStaff'],
  ['Cost Clerk', 'cost-', 80, M, [19, 35], 'worksStaff'],
  ['Cost Clerk', 'cost-', 80, M, [19, 35], 'worksStaff'],
  ['Production Clerk', 'production-clerk', 100, M, [24, 45], 'worksStaff'],
  ['Progress Chaser', 'progress-board', 95, M, [22, 40], 'worksStaff', { roam: true }],
  ['Ratefixer', 'ratefixer', 160, M, [30, 50], 'worksStaff'],
  ['Draughtsman', 'draughtsman-', 120, M, [24, 45], 'worksStaff'],
  ['Draughtsman', 'draughtsman-', 120, M, [24, 45], 'worksStaff'],
  ['Wages Clerk', 'wages-', 90, M, [22, 45], 'worksStaff'],
  ['Wages Clerk', 'wages-', 90, M, [20, 40], 'worksStaff'],
  ['Timekeeper', 'timekeeper', 75, M, [30, 55], 'gate'],
  ['Gatekeeper', 'gatekeeper', 60, M, [45, 65], 'gate'],
  ['Receiving Clerk', 'receiving-clerk', 75, M, [22, 45], 'worksStaff'],
];

// What people wear, for the figures. Colours are period-plausible choices.
const COATS = ['#2c2f38', '#3b3229', '#45403a', '#2f3530', '#3a3a40', '#4a3d30'];
const SKIRTS = ['#2a2a33', '#3a2f2a', '#2d3340', '#433a46'];

function lookFor(rng, { sex, age, trade, role, look }) {
  const youth = age < 18;
  const scale = sex === F ? 0.93 : youth ? (age < 16 ? 0.84 : 0.92) : 1;
  if (look === 'gentleman') return { coat: '#1d1d22', legs: '#25252b', hat: 'bowler', apron: null, sex, scale, collar: true };
  if (role === 'staff') {
    return sex === F
      ? { coat: '#efeae0', legs: rng.pick(SKIRTS), hat: 'none', apron: null, sex, scale, collar: false }
      : { coat: '#26272d', legs: '#2c2d33', hat: 'none', apron: null, sex, scale, collar: true };
  }
  if (role === 'foreman') return { coat: '#1f2026', legs: '#2a2b31', hat: 'bowler', apron: null, sex, scale, collar: true };
  if (sex === F) return { coat: rng.pick(SKIRTS), legs: rng.pick(SKIRTS), hat: 'none', apron: '#e9e3d4', sex, scale, collar: false };
  let apron = null;
  if (/Brazer|Smith|Striker|Hardener/.test(trade)) apron = '#7a5a3c';
  else if (/Plater|Enameller|Polisher|Pickler|Sand-blaster/.test(trade)) apron = '#3d3a36';
  else if (/Carpenter/.test(trade)) apron = '#cdbf9f';
  const coat = /Engine|Stoker|Millwright/.test(trade) ? '#36435a' : rng.pick(COATS);
  return { coat, legs: '#2e2c2a', hat: 'cap', apron, sex, scale, collar: false };
}

function makeName(rng, sex) {
  return `${rng.weighted(sex === F ? FEMALE : MALE)} ${rng.weighted(SURNAMES)}`;
}

// Assign a spot to each person. A prefix ('capstan-') hands out the next
// unused spot that starts with it; an exact id is used as it is (shared).
function spotAllocator(site) {
  const used = new Set();
  const all = [...site.spots.keys()];
  return (key) => {
    if (site.nodes.has(key) && !key.endsWith('-')) return key;
    const free = all.find((id) => id.startsWith(key) && !used.has(id));
    if (!free) throw new Error(`no free spot for ${key}`);
    used.add(free);
    return free;
  };
}

// Homes are off-site, in one of three directions (est. weights).
const HOMES = [['HOME_W', 45], ['HOME_S', 35], ['HOME_E', 20]];

export function makeStaff(rng, site) {
  const people = [];
  const nextSpot = spotAllocator(site);
  const usedNames = new Set();
  const uniqueName = (sex) => {
    for (;;) {
      const nm = makeName(rng, sex);
      if (!usedNames.has(nm)) { usedNames.add(nm); return nm; }
    }
  };

  for (const dept of DEPARTMENTS) {
    let worksNo = dept.worksNos;
    if (dept.foreman) {
      const age = rng.int(38, 60);
      people.push({
        name: uniqueName(M), sex: M, age, trade: 'Foreman', title: `Foreman, ${dept.name}`,
        role: 'foreman', dept: dept.id, deptName: dept.name, worksNo: worksNo++,
        weekly: s(dept.foreman.weekly), spot: nextSpot(`box-${dept.id}`), roam: true,
        timetable: 'works', home: rng.weighted(HOMES),
        look: lookFor(rng, { sex: M, age, role: 'foreman' }),
      });
    }
    for (const [trade, count, spotKey, rate, sex, [a0, a1], opts = {}] of dept.hands) {
      for (let i = 0; i < count; i++) {
        const age = rng.int(a0, a1);
        const spot = opts.base || nextSpot(spotKey);
        people.push({
          name: uniqueName(sex), sex, age, trade, title: trade, role: 'hand', dept: dept.id, deptName: dept.name,
          worksNo: worksNo++, hourly: opts.weekly ? 0 : d(rate), weekly: opts.weekly ? s(opts.weekly) : 0,
          spot, roam: !!opts.roam, timetable: opts.timetable || 'works', home: rng.weighted(HOMES),
          look: lookFor(rng, { sex, age, trade, role: 'hand' }),
        });
      }
    }
  }

  for (const [title, spotKey, salary, sex, [a0, a1], timetable, opts = {}] of STAFF) {
    const age = rng.int(a0, a1);
    people.push({
      name: opts.name || uniqueName(sex), sex, age, trade: title, title, role: 'staff', dept: 'office',
      deptName: timetable === 'office' ? 'Commercial Office' : 'Works Staff',
      worksNo: null, salary: lsd(salary), spot: nextSpot(spotKey), roam: !!opts.roam, away: !!opts.away,
      timetable, home: rng.weighted(HOMES),
      look: lookFor(rng, { sex, age, role: 'staff', look: opts.look }),
    });
  }
  return people;
}
