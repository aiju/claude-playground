// The works' paper: time cards, daily time slips, work tallies, the wages
// week, pay tins and National Insurance stamps.
//
// The procedure follows Elbourne, Factory Administration and Accounts (1914):
//   - The time card is headed "Ending Wednesday". The recorder prints each
//     clocking on it, late ones in red. On Wednesday night the timekeeper
//     takes the week's cards to the Wages Office and racks new ones.
//   - Each piece-worker writes up a daily time slip; the works post (a
//     messenger boy going round the shops) brings the slips to the Wages
//     Office.
//   - On Thursday the wages clerks work out every man's pay and write the
//     wages sheets and the wages abstract, and a coin list goes to the
//     Cashier.
//   - On Friday the Cashier draws a cheque "for the exact amount of wages
//     required" (Dicksee) and brings the coin from the bank. The pay clerks
//     make up a numbered tin for each man with the pay slip on top. "It is
//     better generally to pay on Friday night rather than Saturday morning."
// National Insurance follows the 1911 Act's Second, Sixth and Eighth
// Schedules. Lateness follows Swindon practice (Williams 1915): after five
// minutes' grace a quarter of an hour is lost.
import { Paper } from '../../engine/sim/documents.js';
import { Resource, until, wait } from '../../engine/sim/kernel.js';
import { walk, work } from '../../engine/sim/world.js';
import { d, s, lsd, toHalfpenny, fmt, split } from '../../engine/sim/money.js';
import { DEPARTMENTS } from './staff.js';
import { GROUPS } from './works.js';
import { defineForms, PAPER_KINDS } from './forms.js';
import { receiveRemittances, bankTrip, commercePapersForPlace, commercePapersForLot, ledgerViews } from './commerce.js';
import { cashierPayments } from './purchasing.js';

// Who is paid how. Coventry moved fast to piecework, "often gang piece-work";
// setters and toolmakers stayed on time rates (Carr 1978). The machine and
// press shops are on a Rowan premium bonus (choice).
const PIECE_DEPTS = new Set(['frames', 'brazing', 'filing', 'polishing', 'plating', 'enamelling', 'lining', 'wheels', 'brakework', 'finishing', 'warehouse']);
const BONUS_DEPTS = new Set(['machine', 'press']);
// Unemployment insurance: "mechanical engineering" and "construction of
// vehicles" (Sixth Schedule). Treated as covering the machine, fitting and
// frame shops; polishing, plating, enamelling, packing and stores are left
// out as uncertain (choice; no umpire's ruling on cycle works was found).
const INSURED_DEPTS = new Set(['machine', 'press', 'toolroom', 'frames', 'brazing', 'filing', 'wheels', 'brakework', 'finishing', 'viewing', 'engine']);

const PIECE_PREMIUM = 1.4; // piece prices set so a man kept busy earns about a quarter over his time rate (est.)
const BONUS_ALLOWANCE = 1.25; // ratefixer's time allowed over the standard time (est.)

// Carter (1912) quotes Coventry piece prices; where one fits an operation
// it's used as it is.
const CARTER_PRICES = { 'truing wheels': d(10.5) };

export function setupPaper(world, production, timetables) {
  const paper = new Paper(world);
  world.paper = paper;
  defineForms(paper);
  const site = world.site;
  const cal = world.cal;

  paper.addContainer({ id: 'rack-out', name: 'the time card rack (out)', node: 'time-recorder-1', kind: 'rack' });
  paper.addContainer({ id: 'rack-in', name: 'the time card rack (in)', node: 'time-recorder-2', kind: 'rack' });
  paper.addContainer({ id: 'wages-in', name: "the Wages Office's in-tray", node: 'wages-1', kind: 'tray' });
  paper.addContainer({ id: 'wages-files', name: 'the Wages Office files', node: 'wages-2', kind: 'file' });
  paper.addContainer({ id: 'pay-tins', name: 'the trays of pay tins', node: 'pay-window', kind: 'tins' });
  paper.addContainer({ id: 'ni-cards', name: 'the insurance cards and unemployment books', node: 'wages-2', kind: 'file' });
  paper.addContainer({ id: 'cashier', name: "the Cashier's desk", node: 'cashier-desk', kind: 'tray' });
  paper.addContainer({ id: 'works-office', name: "the Works Office's tally file", node: 'production-clerk', kind: 'file' });
  paper.addContainer({ id: 'bank', name: 'Lloyds Bank, Coventry', node: null, kind: 'away' });
  for (const dept of DEPARTMENTS) {
    const room = site.rooms.get(dept.room);
    const node = site.nodes.has(`box-${dept.id}`) ? `box-${dept.id}` : `wip-${dept.room}`;
    paper.addContainer({ id: `slips-${dept.id}`, name: `the time-slip box in the ${room ? room.name : dept.name}`, node, kind: 'box' });
  }
  const ending = (e, c) => c.cal.shortDate(e.ending);
  const m = (h, f) => ({ h, f, money: true });
  paper.addBook({
    id: 'wages-sheets', title: 'Wages Sheets', node: 'wages-1', columns: [
      { h: 'Week ending', f: ending }, { h: 'No.', f: (e) => e.worksNo, num: true }, { h: 'Name', f: (e) => e.name },
      { h: 'Hours', f: (e) => (Math.round(e.hours * 4) / 4).toString(), num: true }, m('Gross', (e) => e.gross),
      m('Insurance', (e) => e.health + e.unemployment), m('Net', (e) => e.net),
    ],
  });
  paper.addBook({
    id: 'wages-abstract', title: 'Wages Abstract Book', node: 'wages-1', columns: [
      { h: 'Week ending', f: ending }, m('Gross', (e) => e.gross), m('Health', (e) => e.health), m('Unemployment', (e) => e.unemployment),
      m('Employer', (e) => e.employerNI), m('Net', (e) => e.total),
    ],
  });
  paper.addBook({
    id: 'stamp-book', title: 'Insurance Stamp Book', node: 'wages-2', columns: [
      { h: 'Week ending', f: ending }, { h: 'Cards and books stamped', f: (e) => e.cards, num: true }, { h: 'By', f: (e) => e.by },
    ],
  });

  const W = {
    paper,
    payStations: new Resource(world.sim, 2, 'pay stations'),
    weeks: [], // one entry per wages week: totals and the cards
    current: null,
    pieceRates: pieceRateBook(production),
    stamps: { health: 0, unemployment: 0 },
  };
  world.wages = W;

  // A health insurance card for everyone 16 or over, and an unemployment
  // book for those in insured trades; the employer keeps them and stamps
  // them weekly.
  for (const p of world.people) {
    if (p.role === 'staff' && p.salary >= lsd(160)) continue; // non-manual over £160 a year: not insured
    if (p.age >= 16) {
      p.healthCard = paper.create('ni-card', { name: p.name, worksNo: p.worksNo, sex: p.sex, society: approvedSociety(world, p), stamps: [] }, { at: 'ni-cards' });
      if (p.role !== 'staff' && INSURED_DEPTS.has(p.dept) && !/apprentice/i.test(p.trade)) {
        p.unemploymentBook = paper.create('unemployment-book', { name: p.name, worksNo: p.worksNo, trade: p.trade, stamps: [] }, { at: 'ni-cards' });
      }
    }
  }

  // The opening week: cards for the week ending Wednesday 5 March, with the
  // clockings of Thursday 27 February to Saturday 1 March already on them.
  const firstWeekEnd = cal.at(1913, 3, 5);
  W.current = { ending: firstWeekEnd, start: firstWeekEnd - 6 * 1440 };
  for (const p of world.people) {
    if (!clocks(p)) continue;
    const card = newCard(world, p, W.current);
    for (let day = W.current.start; day < cal.at(1913, 3, 3); day += 1440) syntheticDay(world, p, card, day);
    paper.put(card, 'rack-out', false);
  }
  production.onTake = (p, lot, step, n, minutes, started) => slipEntry(world, p, lot, step, n, minutes);
  production.onLaunch = (lot) => {
    if (lot.kind === 'despatch') return; // packed against the office order, not a works order
    const tally = paper.create('work-tally', { lot: lot.label, subOrder: lot.batch ? lot.batch.id : lot.label.split(' ')[0], qty: lot.qty, unit: lot.unit, item: lot.batch ? lot.batch.name : lot.label.split(' ').slice(2).join(' '), issued: world.sim.now });
    paper.attach(tally, lot);
    lot.tally = tally;
  };
  production.onIssue = (lot, step, by) => {
    if (lot.tally && !lot.tally.marks.some((m) => m.mark === 'coupon cut')) {
      paper.mark(lot.tally, 'coupon cut', `coupon cut off: material drawn from the stores by ${by.name}`);
    }
  };
  return W;
}

export function clocks(p) {
  return p.role === 'hand';
}

function approvedSociety(world, p) {
  if (p.sex === 'F') return world.rng.pick(['Prudential Approved Society', 'National Deposit Friendly Society', 'Hearts of Oak Benefit Society']);
  return world.rng.weighted([['Amalgamated Society of Engineers Approved Society', 20], ['Hearts of Oak Benefit Society', 20], ['Prudential Approved Society', 25], ['Oddfellows, Manchester Unity', 20], ['National Deposit Friendly Society', 15]]);
}

function newCard(world, p, week) {
  const card = world.paper.create('time-card', {
    worksNo: p.worksNo, name: p.name, dept: p.deptName, ending: week.ending, start: week.start, punches: [],
  });
  p.card = card;
  return card;
}

// Clockings for a day before the sim began, so the first pay is a full week.
function syntheticDay(world, p, card, day) {
  const timetable = p.timetable;
  const spells = timetable.spellsOn(day);
  if (!spells.length) return;
  const rng = world.rng;
  const first = spells[0][0];
  const last = spells[spells.length - 1][1];
  card.fields.punches.push({ t: first - rng.uniform(2, 14), kind: 'in', late: false });
  if (p.dinnerAt === 'home' && spells.length >= 3) {
    card.fields.punches.push({ t: spells[1][1] + rng.uniform(0.5, 2), kind: 'out' });
    card.fields.punches.push({ t: spells[2][0] - rng.uniform(2, 9), kind: 'in', late: false });
  }
  card.fields.punches.push({ t: last + rng.uniform(0.5, 3), kind: 'out' });
  // Piece and bonus earnings for those days, brought forward on a slip.
  if (pieceOrBonus(p)) {
    const slip = world.paper.create('time-slip', { worksNo: p.worksNo, name: p.name, dept: p.deptName, day, entries: [], broughtForward: true });
    const minutes = timetable.workingMinutes(day, day + 1440);
    slip.fields.earnings = Math.round((minutes / 60) * (p.hourly || 0) * (BONUS_DEPTS.has(p.dept) ? 1.12 : 1.2) * rng.uniform(0.92, 1.08));
    world.paper.put(slip, 'wages-in', 'filed with the week’s slips');
  }
}

// Packers and warehousemen work to the orders as they come, on day work.
const DAY_TRADES = new Set(['Packer', 'Warehouseman']);

function pieceOrBonus(p) {
  const inGroup = (GROUPS[p.trade] || p.trade === 'Enameller') && !DAY_TRADES.has(p.trade);
  return p.role === 'hand' && inGroup && (PIECE_DEPTS.has(p.dept) || BONUS_DEPTS.has(p.dept)) && p.trade !== 'Chief viewer';
}

// The ratefixer's book of piece prices: so much a unit for each operation.
function pieceRateBook(production) {
  const groupRate = new Map();
  for (const dept of DEPARTMENTS) {
    for (const [trade, , , rate] of dept.hands) {
      const g = GROUPS[trade];
      if (!g || !rate) continue;
      groupRate.set(g[0], Math.max(groupRate.get(g[0]) || 0, d(rate)));
    }
  }
  return {
    groupRate,
    price(step) {
      if (CARTER_PRICES[step.op]) return CARTER_PRICES[step.op];
      const base = groupRate.get(step.group) || d(7);
      return Math.max(1, Math.round((step.min / 60) * base * PIECE_PREMIUM));
    },
  };
}

// --- Clocking -----------------------------------------------------------------

// The card comes out of one rack, goes through the recorder, and into the other.
export function punch(world, p, kind, late) {
  const card = p.card;
  if (!card) return;
  const paper = world.paper;
  card.fields.punches.push({ t: world.sim.now, kind, late: !!late });
  paper.put(card, kind === 'in' ? 'rack-in' : 'rack-out', false);
}

// --- Daily time slips -----------------------------------------------------------

function slipFor(world, p) {
  const day = world.cal.dayStart(world.sim.now);
  if (p.slip && p.slip.fields.day === day) return p.slip;
  const slip = world.paper.create('time-slip', { worksNo: p.worksNo, name: p.name, dept: p.deptName, day, entries: [] }, { by: p });
  p.slip = slip;
  return slip;
}

function slipEntry(world, p, lot, step, n, minutes) {
  if (!clocks(p)) return;
  const slip = slipFor(world, p);
  slip.fields.entries.push({
    order: lot.batch ? lot.batch.id : lot.label.split(' ')[0], op: step.op, qty: n, unit: lot.unit, minutes,
    std: step.min, price: world.wages.pieceRates.price(step), group: step.group,
  });
}

// At the end of the day the slip goes in the department's box.
export function endOfDay(world, p) {
  if (p.slip && p.slip.holder === p) {
    world.paper.put(p.slip, `slips-${p.dept}`);
  }
}

// --- The works post -------------------------------------------------------------

// A messenger boy goes round the time-slip boxes twice a day, the foreman
// signing the slips as they're collected, and takes them to the Wages Office.
export function* worksPost(world, p) {
  const paper = world.paper;
  const boxes = [...paper.containers.values()].filter((c) => c.id.startsWith('slips-'));
  const tt = p.timetable;
  for (;;) {
    // Rounds at a quarter to nine and at two.
    const spell = tt.nextSpell(world.sim.now);
    const startAt = spell[0] + (world.cal.minuteOfDay(spell[0]) < 9 * 60 ? 15 : 30);
    if (p.lastRound === startAt || world.sim.now > startAt + 0.5 || startAt > spell[1] - 30 || world.cal.minuteOfDay(spell[0]) < 7 * 60) {
      yield* work(world, p, 10, 'waiting at the stores counter');
      continue;
    }
    if (startAt - world.sim.now > 0.01) yield* work(world, p, startAt - world.sim.now, 'waiting at the stores counter');
    p.lastRound = startAt;
    let carried = 0;
    for (const box of boxes) {
      if (!box.docs.size) continue;
      yield* walk(world, p, box.node, { activity: `going round with the works post: ${box.name}` });
      const got = paper.collect(box.id, p);
      for (const slip of got) paper.mark(slip, 'signed', 'signed by the foreman');
      carried += got.length;
      yield* work(world, p, 0.5, 'collecting time slips from the box');
    }
    if (carried) {
      yield* walk(world, p, 'wages-1', { activity: `taking ${carried} time slips to the Wages Office` });
      paper.deliver(p, 'wages-in');
      yield* work(world, p, 1, 'handing the works post to the wages clerk');
    }
    yield* walk(world, p, p.spot, { activity: 'going back to the stores counter' });
  }
}

// --- The timekeeper -------------------------------------------------------------

// On Wednesday night, once the hands have gone, the week's cards go to the
// Wages Office and next week's are racked.
export function* timekeeper(world, p) {
  const cal = world.cal;
  const W = world.wages;
  for (;;) {
    yield* work(world, p, 15, 'checking time cards in the rack');
    const now = world.sim.now;
    if (cal.dow(now) === 3 && cal.minuteOfDay(now) >= 17 * 60 + 15 && !W.collected?.has(cal.dateKey(now))) {
      (W.collected ||= new Set()).add(cal.dateKey(now));
      const ending = W.current;
      const next = { ending: ending.ending + 7 * 1440, start: ending.start + 7 * 1440 };
      W.current = next;
      const cards = [...world.paper.containers.get('rack-out').docs, ...world.paper.containers.get('rack-in').docs]
        .filter((c) => c.type === 'time-card' && c.fields.ending === ending.ending);
      for (const c of cards) world.paper.hold(c, p);
      // The day's time slips come too, so the wages can start first thing.
      for (const box of world.paper.containers.values()) {
        if (box.id.startsWith('slips-')) for (const sl of world.paper.collect(box.id, p)) world.paper.mark(sl, 'signed', 'signed by the foreman');
      }
      yield* walk(world, p, 'wages-1', { activity: `taking ${cards.length} time cards to the Wages Office` });
      world.paper.deliver(p, 'wages-in');
      yield* walk(world, p, 'time-recorder-1', { activity: 'going back to rack next week’s cards' });
      for (const person of world.people) {
        if (!clocks(person)) continue;
        const card = newCard(world, person, next);
        world.paper.put(card, 'rack-out', false);
      }
      yield* work(world, p, 20, 'racking next week’s time cards');
      world.log(`The timekeeper took ${cards.length} time cards ending ${cal.docDate(ending.ending)} to the Wages Office and racked next week's.`, { kind: 'paper' });
      W.weeks.push({ ending: ending.ending, cards, ...wagesDays(world, ending.ending) });
    }
  }
}

// --- Working out the wages ----------------------------------------------------

// The day the wages are worked out (the first working day after the week
// ends on Wednesday) and the day they're paid: Friday, or the Thursday if
// Friday is a holiday (Good Friday), or the next working day after that.
export function wagesDays(world, ending) {
  const tt = world.people[0].timetables.works;
  const working = (day) => tt.spellsOn(day).length > 0;
  let calc = ending + 1440;
  while (!working(calc)) calc += 1440;
  let pay = ending + 2 * 1440;
  if (!working(pay)) pay = working(ending + 1440) ? ending + 1440 : pay;
  while (!working(pay)) pay += 1440;
  if (pay < calc) pay = calc;
  const spells = tt.spellsOn(pay);
  // The window stays open until the last hands are off (the carmen, back
  // from the goods yard).
  let payEnd = spells[spells.length - 1][1];
  for (const t of new Set(world.people.filter((p) => p.role === 'hand').map((p) => p.timetable))) {
    const s2 = t.spellsOn(pay);
    if (s2.length) payEnd = Math.max(payEnd, s2[s2.length - 1][1]);
  }
  return { calcDay: calc, payDay: pay, payTime: spells[spells.length - 1][1], payEnd };
}

// Paid hours on a card, clipped to the timetable, losing a quarter of an
// hour for being more than five minutes late.
export function paidMinutes(card, timetable) {
  const punches = [...card.fields.punches].sort((a, b) => a.t - b.t);
  let total = 0;
  let open = null;
  for (const pu of punches) {
    if (pu.kind === 'in') open = pu.t;
    else if (open !== null) {
      for (let day = Math.floor(open / 1440) * 1440; day <= pu.t; day += 1440) {
        for (const [a, b] of timetable.spellsOn(day)) {
          let start = Math.max(a, open);
          if (open > a && open <= a + 5) start = a; // five minutes' grace
          else if (open > a + 5 && open < b) start = a + 15 * Math.ceil((open - a) / 15);
          const end = Math.min(b, pu.t);
          if (end > start) total += end - start;
        }
      }
      open = null;
    }
  }
  return total;
}

// Health contributions, Second Schedule: 7d. for men (4d. from the man),
// 6d. for women (3d.), less from low-paid adults.
export function healthContribution(p, gross) {
  if (p.age < 16) return { worker: 0, employer: 0 };
  const daily = gross / 6;
  const male = p.sex !== 'F';
  if (p.age >= 21) {
    if (daily <= s(1.5)) return { worker: 0, employer: d(male ? 6 : 5) };
    if (daily <= s(2)) return { worker: d(1), employer: d(male ? 5 : 4) };
    if (daily <= s(2.5) && male) return { worker: d(3), employer: d(4) };
  }
  return male ? { worker: d(4), employer: d(3) } : { worker: d(3), employer: d(3) };
}

export function unemploymentContribution(p) {
  if (!p.unemploymentBook) return { worker: 0, employer: 0 };
  return p.age < 18 ? { worker: d(1), employer: d(1) } : { worker: d(2.5), employer: d(2.5) };
}

export function computeWages(world, p, week, timetable) {
  const paper = world.paper;
  const card = week.cards.find((c) => c.fields.worksNo === p.worksNo);
  // Foremen don't clock; they're paid the full week.
  // The engine-house crew and the carmen are paid for their own longer hours.
  const tt = p.role === 'hand' ? p.timetable : timetable;
  const minutes = !clocks(p) ? 53 * 60 : card ? paidMinutes(card, tt) : 0;
  const hours = minutes / 60;
  let timeWages;
  if (p.weekly) timeWages = Math.round(p.weekly * Math.min(1, hours / 53));
  else timeWages = Math.round(hours * p.hourly);
  // The week's slips: piece earnings, or the Rowan bonus.
  const slips = [...paper.containers.get('wages-in').docs].filter((dd) => dd.type === 'time-slip' && dd.fields.worksNo === p.worksNo && dd.fields.day >= week.ending - 6 * 1440 && dd.fields.day <= week.ending);
  let piece = 0;
  let bonus = 0;
  let brought = 0;
  for (const slip of slips) {
    if (slip.fields.broughtForward) brought += slip.fields.earnings;
    for (const e of slip.fields.entries) {
      if (PIECE_DEPTS.has(p.dept)) piece += e.price * e.qty;
      else if (BONUS_DEPTS.has(p.dept)) {
        const allowed = e.std * e.qty * BONUS_ALLOWANCE;
        const taken = e.minutes;
        if (allowed > taken) bonus += Math.round(((allowed - taken) / allowed) * (taken / 60) * p.hourly);
      }
    }
  }
  let gross;
  let basis;
  if (PIECE_DEPTS.has(p.dept) && pieceOrBonus(p)) {
    piece += brought;
    gross = Math.max(piece, timeWages);
    basis = piece >= timeWages ? 'piece' : 'day rate (piece below the day rate)';
  } else if (BONUS_DEPTS.has(p.dept) && pieceOrBonus(p)) {
    bonus += Math.max(0, brought - Math.round((brought / 1.12)));
    gross = timeWages + bonus;
    basis = 'time and premium bonus';
  } else {
    gross = timeWages;
    basis = p.weekly ? 'weekly wage' : 'time';
  }
  gross = toHalfpenny(gross);
  const worked = hours > 0;
  const health = worked ? healthContribution(p, gross) : { worker: 0, employer: 0 };
  const unemp = worked ? unemploymentContribution(p) : { worker: 0, employer: 0 };
  const net = gross - health.worker - unemp.worker;
  return { p, card, slips, hours, timeWages, piece, bonus, gross, basis, health, unemp, net, lateness: card ? card.fields.punches.filter((x) => x.late).length : 0 };
}

// Coins for the week's pay, as the wages clerk's coin analysis.
const COINS = [[lsd(1), 'sovereigns'], [s(10), 'half-sovereigns'], [d(30), 'half-crowns'], [s(2), 'florins'], [s(1), 'shillings'], [d(6), 'sixpences'], [d(3), 'threepenny pieces'], [d(1), 'pennies'], [d(0.5), 'halfpennies']];

export function coinsFor(amount) {
  const out = {};
  let left = amount;
  for (const [v, name] of COINS) {
    const n = Math.floor(left / v);
    if (n) out[name] = n;
    left -= n * v;
  }
  return out;
}

// The wages clerks' week.
export function* wagesClerk(world, p, { half, partner, timetable }) {
  const cal = world.cal;
  const W = world.wages;
  const paper = world.paper;
  for (;;) {
    const now = world.sim.now;
    const mod = cal.minuteOfDay(now);
    // The first working day after the week ends: work out the wages.
    const today = cal.dayStart(now);
    const week = W.weeks.find((w) => !w.done?.has(half) && w.calcDay === today);
    if (week && mod >= 8 * 60) {
      (week.done ||= new Set()).add(half);
      week.results ||= [];
      const mine = world.people.filter((q) => clocks(q) || (q.role === 'foreman'))
        .filter((q) => (half === 0 ? q.worksNo < 500 : q.worksNo >= 500));
      for (const q of mine) {
        yield* work(world, p, 1.1, `working out the wages: No. ${q.worksNo}, ${q.name}`);
        const r = computeWages(world, q, week, timetable);
        week.results.push(r);
        const slip = paper.create('pay-slip', {
          worksNo: q.worksNo, name: q.name, dept: q.deptName, ending: week.ending, hours: r.hours, rate: q.hourly || q.weekly,
          weekly: !!q.weekly, timeWages: r.timeWages, piece: r.piece, bonus: r.bonus, gross: r.gross, basis: r.basis,
          health: r.health.worker, unemployment: r.unemp.worker, net: r.net,
        }, { at: 'wages-files' });
        r.paySlip = slip;
        paper.link(slip, r.card);
        for (const sl of r.slips) paper.link(slip, sl);
        paper.enter('wages-sheets', { ending: week.ending, dept: q.deptName, worksNo: q.worksNo, name: q.name, hours: r.hours, gross: r.gross, health: r.health.worker, unemployment: r.unemp.worker, net: r.net }, { from: slip, by: p });
        if (r.card) paper.put(r.card, 'wages-files', 'filed after working out the wages');
        for (const sl of r.slips) paper.put(sl, 'wages-files', false);
      }
      (week.finished ||= new Set()).add(half);
      if (week.finished.size === 2 && !week.abstractStarted) {
        week.abstractStarted = true;
        yield* abstractAndCoinList(world, p, week);
      }
      continue;
    }
    // Friday after the cash comes: make up the tins.
    if (W.cashArrived && W.cashArrived.ending === (W.weeks.at(-1)?.ending) && !W.cashArrived.tinsDone?.has(half)) {
      (W.cashArrived.tinsDone ||= new Set()).add(half);
      const wk = W.weeks.at(-1);
      const mine = wk.results.filter((r) => (half === 0 ? r.p.worksNo < 500 : r.p.worksNo >= 500));
      for (const r of mine) {
        yield* work(world, p, 0.45, `making up pay tin No. ${r.p.worksNo}`);
        paper.put(r.paySlip, 'pay-tins', `put in pay tin No. ${r.p.worksNo} on top of ${fmt(r.net, { shillings: true })}`);
        r.tin = true;
      }
      (W.cashArrived.tinsFinished ||= new Set()).add(half);
      if (W.cashArrived.tinsFinished.size === 2) {
        world.log(`The pay tins are made up: ${wk.results.length} tins, ${fmt(wk.total)} in all.`, { kind: 'paper' });
        wk.tinsReady = true;
      }
      continue;
    }
    // Friday afternoon: stamp the insurance cards.
    const wk = W.weeks.at(-1);
    if (wk && wk.tinsReady && today === wk.payDay && !wk.stamped?.has(half) && W.stampsBought === wk.ending) {
      (wk.stamped ||= new Set()).add(half);
      const mine = wk.results.filter((r) => (half === 0 ? r.p.worksNo < 500 : r.p.worksNo >= 500) && r.hours > 0);
      let n = 0;
      for (const r of mine) {
        if (r.p.healthCard && (r.health.worker || r.health.employer)) {
          yield* work(world, p, 0.15, `stamping No. ${r.p.worksNo}'s health insurance card`);
          r.p.healthCard.fields.stamps.push({ week: wk.ending, value: r.health.worker + r.health.employer });
          n++;
        }
        if (r.p.unemploymentBook) {
          yield* work(world, p, 0.1, `stamping No. ${r.p.worksNo}'s unemployment book`);
          r.p.unemploymentBook.fields.stamps.push({ week: wk.ending, value: r.unemp.worker + r.unemp.employer });
        }
      }
      paper.enter('stamp-book', { ending: wk.ending, cards: n, by: p.name });
      continue;
    }
    if (wk && wk.tinsReady && today === wk.payDay && now >= wk.payTime && now < Math.max(wk.payTime + 75, wk.payEnd + 25)) {
      yield* work(world, p, 5, half === 0 ? 'paying out at the pay window' : 'cancelling pay cards with a crayon mark');
      yield* unclaimedCheck(world, p);
      continue;
    }
    yield* work(world, p, 20, half === 0 ? 'posting time slips to the wages sheets' : 'checking yesterday’s time slips');
  }
}

function* abstractAndCoinList(world, p, week) {
  const paper = world.paper;
  const W = world.wages;
  yield* work(world, p, 25, 'adding up the wages abstract');
  const byDept = new Map();
  let total = 0;
  let health = 0;
  let unemployment = 0;
  let employerNI = 0;
  const coins = {};
  for (const r of week.results) {
    const row = byDept.get(r.p.deptName) || { dept: r.p.deptName, hands: 0, gross: 0, deductions: 0, net: 0 };
    row.hands++;
    row.gross += r.gross;
    row.deductions += r.health.worker + r.unemp.worker;
    row.net += r.net;
    byDept.set(r.p.deptName, row);
    total += r.net;
    health += r.health.worker;
    unemployment += r.unemp.worker;
    employerNI += r.health.employer + r.unemp.employer;
    for (const [k, n] of Object.entries(coinsFor(r.net))) coins[k] = (coins[k] || 0) + n;
  }
  week.total = total;
  week.health = health;
  week.unemployment = unemployment;
  week.employerNI = employerNI;
  week.stampsNeeded = health + unemployment + employerNI;
  const abstract = paper.create('wages-abstract', { ending: week.ending, rows: [...byDept.values()], total, health, unemployment, employerNI }, { at: 'wages-files' });
  paper.enter('wages-abstract', { ending: week.ending, total, gross: [...byDept.values()].reduce((a, r) => a + r.gross, 0), health, unemployment, employerNI }, { from: abstract, by: p });
  const coinList = paper.create('coin-list', { ending: week.ending, coins, total }, { by: p });
  week.abstract = abstract;
  week.coinList = coinList;
  paper.link(abstract, coinList);
  for (const r of week.results) paper.link(abstract, r.paySlip);
  yield* walk(world, p, 'cashier-desk', { activity: 'taking the coin list to the Cashier' });
  paper.put(coinList, 'cashier', 'handed to the Cashier');
  world.log(`The wages for the week ending ${world.cal.docDate(week.ending)} come to ${fmt(total)} net; the coin list is with the Cashier.`, { kind: 'paper' });
  yield* walk(world, p, p.spot, { activity: 'going back to the Wages Office' });
}

// --- The Cashier and the bank ---------------------------------------------------

export function* cashier(world, p) {
  const cal = world.cal;
  const W = world.wages;
  const paper = world.paper;
  for (;;) {
    const now = world.sim.now;
    const wk = W.weeks.at(-1);
    // On pay day, from twenty past nine (or as soon as the coin list comes,
    // if the wages were only worked out that morning).
    if (wk && wk.coinList && !wk.cashDrawn && cal.dayStart(now) === wk.payDay && cal.minuteOfDay(now) >= 9 * 60 + 20) {
      wk.cashDrawn = true;
      yield* work(world, p, 5, 'writing the wages cheque');
      const cheque = paper.create('cheque', {
        bank: 'Lloyds Bank Limited, Coventry', payee: 'Wages or Order', amount: wk.total, date: now, coins: wk.coinList.fields.coins,
        signatories: ['Charles Hartwell, Director', world.people.find((q) => q.title === 'Secretary and Accountant')?.name + ', Secretary'],
      }, { by: p });
      wk.cheque = cheque;
      paper.link(cheque, wk.coinList);
      paper.link(cheque, wk.abstract);
      world.ledger?.post(now, `Wages, week ending ${cal.docDate(wk.ending)} (net)`, [['wages', wk.total, 0], ['bank', 0, wk.total]], { ref: cheque.id });
      world.log(`The Cashier drew a cheque on Lloyds Bank for the wages, ${fmt(wk.total)}, and set off for the bank.`, { kind: 'paper' });
      const trip = function* (who, label) {
        yield* walk(world, who, 'S_OF', { activity: label });
        yield* walk(world, who, 'HOME_S', { activity: label });
      };
      yield* trip(p, 'walking to Lloyds Bank with the wages cheque');
      p.onSite = false;
      p.activity = 'at Lloyds Bank, drawing the wages in coin';
      paper.mark(cheque, 'paid', 'cashed at Lloyds Bank; the coin counted into bags');
      paper.put(cheque, 'bank', 'kept by the bank, to come back with the pass book');
      yield wait(20);
      p.onSite = true;
      yield* walk(world, p, 'S_OF', { activity: 'carrying the wages back from the bank' });
      yield* walk(world, p, 'wages-1', { activity: 'carrying the wages to the Wages Office' });
      W.cashArrived = { ending: wk.ending, at: world.sim.now };
      world.log(`The wages arrived from the bank: ${fmt(wk.total)} in coin.`, { kind: 'paper' });
      yield* work(world, p, 5, 'handing over the cash bags to the wages clerks');
      yield* walk(world, p, p.spot, { activity: 'going back to the Cashier’s office' });
      continue;
    }
    // The suppliers' cheques on pay day.
    if (yield* cashierPayments(world, p)) continue;
    // Agents' cheques, as the post brings them; the bank before noon.
    if (world.commerce) {
      if (yield* receiveRemittances(world, p)) continue;
      const mod = cal.minuteOfDay(now);
      if (mod >= 11 * 60 + 15 && mod < 12 * 60 && p.banked !== cal.dayStart(now)) {
        p.banked = cal.dayStart(now);
        yield* bankTrip(world, p);
        continue;
      }
    }
    yield* work(world, p, 15, 'writing up the Cash Book');
  }
}

// An office boy fetches the insurance stamps from the Post Office on
// Thursday afternoon, once the wages abstract says how many. Returns at
// once if there's nothing to fetch.
export function* stampErrand(world, p) {
  const cal = world.cal;
  const W = world.wages;
  const wk = W.weeks.at(-1);
  if (!wk || !wk.abstract || W.stampsBought === wk.ending) return;
  W.stampsBought = wk.ending;
  yield* walk(world, p, 'cashier-desk', { activity: 'fetching the money for the insurance stamps' });
  yield* walk(world, p, 'S_OF', { activity: 'going to the Post Office for insurance stamps' });
  yield* walk(world, p, 'HOME_S', { activity: 'going to the Post Office for insurance stamps' });
  p.onSite = false;
  p.activity = `at the Post Office buying ${fmt(wk.stampsNeeded)} of insurance stamps`;
  yield wait(25);
  p.onSite = true;
  yield* walk(world, p, 'S_OF', { activity: 'coming back with the insurance stamps' });
  yield* walk(world, p, 'wages-2', { activity: 'taking the insurance stamps to the Wages Office' });
  world.ledger?.post(world.sim.now, `Insurance stamps, week ending ${cal.docDate(wk.ending)}`, [
    ['wages', wk.health + wk.unemployment, 0], ['ni', wk.employerNI, 0], ['petty', 0, wk.stampsNeeded],
  ]);
  world.log(`An office boy brought ${fmt(wk.stampsNeeded)} of health and unemployment insurance stamps from the Post Office.`, { kind: 'paper' });
  yield* walk(world, p, p.spot, { activity: 'going back to the General Office' });
}

// Friday night: after clocking off, each hand queues at a pay station,
// hands in his number, takes his tin, empties it and drops it in the basket.
export function* collectPay(world, p) {
  const W = world.wages;
  const wk = W.weeks.at(-1);
  if (!wk || !wk.tinsReady || world.cal.dayStart(world.sim.now) !== wk.payDay) return;
  const r = wk.results.find((x) => x.p === p);
  if (!r || r.paid) return;
  yield* walk(world, p, 'pay-window', { activity: 'queueing at the pay window' });
  p.activity = 'queueing at the pay window';
  yield W.payStations.request();
  yield wait(0.3);
  W.payStations.release();
  r.paid = world.sim.now;
  world.paper.hold(r.paySlip, p);
  world.paper.mark(r.paySlip, 'paid', `pay tin No. ${p.worksNo} handed over at the pay window`);
  if (r.card) world.paper.mark(r.card, 'cancelled', 'pay card cancelled with a crayon mark across the corner');
  p.lastPay = r;
  p.activity = `counting his pay: ${fmt(r.net, { shillings: true })}`;
}

// Unclaimed tins go back to the Cashier with a report.
function* unclaimedCheck(world, p) {
  const cal = world.cal;
  const W = world.wages;
  const wk = W.weeks.at(-1);
  if (wk && wk.tinsReady && !wk.unclaimedDone && world.sim.now >= Math.max(wk.payTime + 60, wk.payEnd + 10)) {
    wk.unclaimedDone = true;
    const left = wk.results.filter((r) => !r.paid);
    yield* work(world, p, 10, 'making out the unclaimed pay report');
    const report = world.paper.create('unclaimed-report', { ending: wk.ending, tins: left.map((r) => ({ worksNo: r.p.worksNo, name: r.p.name, net: r.net })), total: left.reduce((a, r) => a + r.net, 0) }, { by: p });
    world.paper.put(report, 'wages-files', 'kept with the unclaimed tins for the Cashier');
    wk.unclaimed = report;
    world.paper.link(report, wk.abstract);
    if (left.length) world.log(`${left.length} pay tins were not called for and are locked up with the unclaimed pay report.`, { kind: 'paper' });
  }
}

// --- What the UI can show of the paper ------------------------------------------

export function makePaperView(world, FORMS, amountInWords) {
  const W = world.wages;
  const paper = world.paper;
  const cal = world.cal;
  const resultFor = (card) => {
    for (const wk of W.weeks) for (const r of wk.results || []) if (r.card === card) return r;
    return null;
  };
  const foremen = new Map(world.people.filter((p) => p.role === 'foreman').map((p) => [p.deptName, p]));
  const ctx = {
    cal,
    words: amountInWords,
    payFor: resultFor,
    dayHours(card, day) {
      const r = resultFor(card);
      if (!r) return null;
      const punches = card.fields.punches.filter((x) => x.t >= day && x.t < day + 1440);
      const p = r.p;
      const tt = p.role === 'hand' ? p.timetable : p.timetables.works;
      return paidMinutes({ fields: { punches } }, tt) / 60;
    },
    foremanInitials(deptName) {
      const f = foremen.get(deptName);
      return f ? f.name.split(' ').map((w) => `${w[0]}.`).join('') : '';
    },
  };
  const where = (doc) => {
    if (doc.holder) return `in the hands of ${doc.holder.name}`;
    if (doc.container) return `in ${doc.container.name}`;
    if (doc.lot) return `with ${doc.lot.label.split(' ')[0]}, ${doc.lot.state === 'done' ? 'finished' : `in the ${world.production.roomName(doc.lot.room)}`}`;
    return null;
  };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  return {
    forms: FORMS,
    ctx,
    whereabouts: where,
    kinds: PAPER_KINDS,
    summary(doc) {
      const f = FORMS[doc.type];
      try {
        if (f?.summary) return f.summary(doc, ctx);
      } catch {
        // fall through to the plain label
      }
      return doc.no ? `No. ${doc.no}` : f?.title || doc.type;
    },
    related: (doc) => paper.related(doc),
    // Where the paper is now: every tray, rack, file and box with something
    // in it, and what people are carrying.
    places() {
      const out = [];
      for (const c of paper.containers.values()) {
        if (c.docs.size) out.push({ id: `c:${c.id}`, label: cap(c.name), count: c.docs.size, away: !c.node, docs: () => [...c.docs] });
      }
      const holders = world.people.filter((q) => q.papers?.size);
      const inHand = holders.reduce((a, q) => a + q.papers.size, 0);
      if (inHand) out.push({ id: 'hands', label: 'In someone\u2019s hands', count: inHand, docs: () => holders.flatMap((q) => [...q.papers]) });
      return out.sort((a, b) => b.count - a.count);
    },
    books() {
      return [...paper.books.values()].filter((b) => b.columns?.length).map((b) => ({ id: b.id, label: b.title, count: b.entries.length, book: b }));
    },
    bookPage: (book, offset = 0) => ({ id: `view:book:${book.id}:${offset}`, type: 'book-page', fields: { book, offset }, history: [], marks: [], copy: 0 }),
    bookEntry(book, e) {
      const cols = book.columns.filter((c) => !c.money).slice(0, 4);
      const money = book.columns.find((c) => c.money);
      const text = cols.map((c) => c.f(e, ctx)).filter((v) => v !== null && v !== undefined && v !== '').join(' · ');
      return { text, amount: money ? money.f(e, ctx) : null, from: e.from ? paper.docs.get(e.from) : null };
    },
    ledger: () => ledgerViews(world),
    papersFor(p) {
      const out = [];
      if (p.card) out.push({ label: 'Time card, this week', doc: p.card });
      const last = W.weeks.at(-1)?.results?.find((r) => r.p === p);
      if (last?.card) out.push({ label: `Time card, week ending ${cal.docDate(last.card.fields.ending)}`, doc: last.card });
      if (p.slip) out.push({ label: `Time slip, ${cal.dayName(p.slip.fields.day)}`, doc: p.slip });
      if (last?.paySlip) out.push({ label: `Pay slip, week ending ${cal.docDate(last.paySlip.fields.ending)}`, doc: last.paySlip });
      if (p.healthCard) out.push({ label: 'Health insurance card', doc: p.healthCard });
      if (p.unemploymentBook) out.push({ label: 'Unemployment book', doc: p.unemploymentBook });
      for (const d of p.papers || []) if (!out.some((o) => o.doc === d)) out.push({ label: `Carrying: ${FORMS[d.type]?.title || d.type}`, doc: d });
      return out;
    },
    papersForLot(lot) {
      return [...(lot.tally ? [{ label: 'Work tally', doc: lot.tally }] : []), ...commercePapersForLot(world, lot)];
    },
    papersForPlace(id) {
      const out = [];
      const wk = W.weeks.at(-1);
      if (['wages-office', 'wages-1', 'wages-2', 'pay-window'].includes(id) && wk) {
        if (wk.abstract) out.push({ label: `Wages abstract, week ending ${cal.docDate(wk.ending)}`, doc: wk.abstract });
        if (wk.unclaimed) out.push({ label: 'Unclaimed pay report', doc: wk.unclaimed });
      }
      if (['cashier', 'cashier-desk'].includes(id) && wk) {
        if (wk.coinList) out.push({ label: 'Coin list for the wages', doc: wk.coinList });
        if (wk.cheque) out.push({ label: 'Wages cheque', doc: wk.cheque });
      }
      out.push(...commercePapersForPlace(world, id));
      for (const c of paper.containers.values()) {
        if (c.node === id || (world.site.nodes.get(c.node)?.room === id && c.docs.size)) {
          const docs = [...c.docs].slice(-3).reverse();
          for (const d of docs) out.push({ label: `${FORMS[d.type]?.title || d.type} in ${c.name} (${c.docs.size} there)`, doc: d });
        }
      }
      return out.slice(0, 14);
    },
  };
}
