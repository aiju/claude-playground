// The Works Accounts Office: cost accounts, after Elbourne (1914), with
// Hawkins (1905) for the way oncost is charged.
//
//   - Every sub-order has a cost card in the Cost Ledger. Materials are posted
//     from the coupons cut off the work tallies when the stores issue the
//     parts, priced from the stock rate card; direct wages from the week's
//     time slips, abstracted once the wages are made up. Time that isn't on
//     a sub-order (foremen, labourers, the engine house, waiting time and
//     make-up to the day rate) goes to standing orders, so the allocation
//     agrees with the wages to the farthing.
//   - Works oncost ("shop charges") is added fortnightly as a percentage on
//     direct wages, "the method most generally adopted" (Hawkins). The rate
//     comes from last season's accounts; each fortnight the Works Accountant
//     sets it against what the works actually spent.
//   - Office oncost is a percentage on works cost (Hawkins: "Office Oncost —
//     10 per cent. on Works Cost").
//   - A fortnightly Delivered Orders Cost Abstract sets the works cost of each
//     order invoiced against its invoice, "to present to the General Manager
//     a concise survey of profitable and unprofitable business" (Elbourne).
import { work, walk } from '../../engine/sim/world.js';
import { fmt, lsd } from '../../engine/sim/money.js';
import { BOUGHT, MADE, MODELS, PROGRAMME_CYCLE, frameIssue, brightIssue, wheelRoughIssue, wheelFinishedIssue, finishingIssue, finishingMadeIssue, modelName } from './catalogue.js';
import { STOCK_PARTS, frameRouting, brightRouting, wheelRouting, erectingRouting, stockRouting } from './works.js';
import { PIECE_DEPTS, BONUS_DEPTS, BONUS_ALLOWANCE, pieceOrBonus } from './paper.js';

export const SHOP_CHARGES = 0.75; // works oncost on direct wages, from last season's accounts (est.)
// On works cost: office and selling expenses (est. £4,500 a year: office
// salaries, directors' fees, travellers, carriage and the office's bills) on a
// works cost of about £60,000. Hawkins's worked example uses 10%.
export const OFFICE_ONCOST = 0.075;
const COAL_PER_TON = 20; // the coal card is kept in cwt

// --- The stock rate card and the Estimator's standard costs ----------------------------

// Labour on one unit of a step, from the Ratefixer's book of piece prices.
function labourOn(world, step) {
  if (!step.op || step.equip) return 0;
  return world.wages.pieceRates.price(step);
}

function routingLabour(world, routing, { lady = false } = {}) {
  let total = 0;
  for (const step of routing) {
    if (step.skipIf && !lady && /dress guard/.test(step.op)) continue;
    total += labourOn(world, step);
  }
  return total;
}

// What a unit of each stores item stands at on the stock rate card: bought
// parts at the contract price, parts made in the works at their standard
// works cost (material, labour and shop charges).
export function stockRates(world) {
  const rates = new Map();
  for (const [item, [, , , price, per]] of Object.entries(BOUGHT)) rates.set(item, price / (per || 1));
  rates.set('coal', world.purchasing?.cards.get('coal') ? world.purchasing.cards.get('coal').price / COAL_PER_TON : 0);
  for (const [item, sp] of Object.entries(STOCK_PARTS)) {
    const material = sp.tube ? rates.get('handlebar-tube') : sp.bar * rates.get('bar-steel');
    const labour = routingLabour(world, stockRouting(item, 100)) ;
    rates.set(item, material + labour * (1 + SHOP_CHARGES));
  }
  return rates;
}

// The Estimate Detail Sheet for one model and pattern: material, direct
// wages and shop charges per machine.
export function standardCost(world, rates, model, pattern) {
  const lady = pattern === 'lady' || pattern === 'girl';
  const lines = [];
  const add = (head, list) => {
    let v = 0;
    for (const [item, n] of list) v += (rates.get(item) || 0) * n;
    lines.push({ head, material: v });
  };
  add('Frame tubes, lugs, fork blades and transfers', frameIssue());
  add('Bright parts from the Finished Stores', brightIssue());
  add('Rims, spokes, nipples and balls', wheelRoughIssue());
  add('Hub shells, cones and axles', wheelFinishedIssue());
  add('Finishing set (chain, saddle, tyres, pedals, hub, fittings)', [...finishingIssue(model), ['ball', 22]]);
  add('Bracket axle, cups and cones', finishingMadeIssue());
  const material = lines.reduce((a, l) => a + l.material, 0);
  const wages = [
    ['Frame building to transfers', routingLabour(world, frameRouting())],
    ['Bright parts: polishing, plating and fitting', routingLabour(world, brightRouting(), { lady })],
    ['Wheels: screwing, lacing and truing', routingLabour(world, wheelRouting())],
    ['Finishing, testing, viewing and wrapping', routingLabour(world, erectingRouting(model))],
  ];
  const direct = wages.reduce((a, [, v]) => a + v, 0);
  const charges = direct * SHOP_CHARGES;
  const works = material + direct + charges;
  const office = works * OFFICE_ONCOST;
  return { model, pattern, lines, material, wages, direct, charges, works, office, total: works + office };
}

export function standardKey(model, pattern) {
  return `${model}:${pattern}`;
}

// The list price and the usual trade price (list less a quarter).
export function listPrice(model, pattern) {
  const m = MODELS[model];
  return m.list + (pattern === 'lady' || pattern === 'girl' ? m.ladyExtra || 0 : 0);
}

// --- Overheads ---------------------------------------------------------------------------

// Expenses that come as bills the sim doesn't model, accrued in the Journal
// each month at so much a year (est.; the report's calibrated model puts
// works overhead at 6–8% of sales and selling and administration at 6–8%).
// [account, name, £ a year, share charged to the works]
export const OVERHEADS = [
  ['rates', 'Rates and taxes', 220, 0.85],
  ['insurance', 'Fire and employers’ liability insurance', 140, 0.8],
  ['gas-water', 'Gas and water (brazing hearths and lighting)', 420, 0.9],
  ['repairs', 'Repairs and renewals', 400, 0.95],
  ['shop-sundries', 'Shop sundries: enamel, spelter, compositions, nickel salts and acids', 1100, 1],
  ['depreciation', 'Depreciation: plant at 7½% and tools at 25%', 2400, 0.95],
  ['office-expenses', 'Printing, stationery, catalogues and advertising', 600, 0],
  ['travelling', 'Travellers’ expenses', 250, 0],
  ['directors', 'Directors’ fees', 300, 0],
];

// Standing orders for the works' own time (Elbourne's standing order
// numbers), and the people whose time goes to each when it isn't on a
// sub-order.
export const STANDING = [
  ['S.O. 1', 'Shop supervision: foremen'],
  ['S.O. 2', 'Stores, viewing and the works post'],
  ['S.O. 3', 'Engine house, boilers and yard'],
  ['S.O. 4', 'Toolroom, millwrights and smiths: upkeep of plant and tools'],
  ['S.O. 5', 'Waiting time and make-up to the day rate'],
  ['S.O. 6', 'Crates, packing and despatch'],
  ['S.O. 7', 'Labourers in the shops'],
  ['S.O. 8', 'Earnings of 27th February to 1st March, in the work brought forward'],
];
const STORES_TRADES = new Set(['Storekeeper', 'Storeman', 'Finished-stores man', 'Messenger boy', 'Chief viewer', 'Viewer', 'Cycle tester']);
const UPKEEP_TRADES = new Set(['Millwright', 'Smith', 'Striker']);

function standingFor(p) {
  if (p.role === 'foreman') return 'S.O. 1';
  if (STORES_TRADES.has(p.trade) || p.dept === 'stores' || p.dept === 'viewing') return 'S.O. 2';
  if (p.dept === 'engine') return 'S.O. 3';
  if (UPKEEP_TRADES.has(p.trade) || p.dept === 'toolroom') return 'S.O. 4';
  if (p.dept === 'warehouse' || p.dept === 'crates') return 'S.O. 6';
  if (p.trade === 'Labourer') return 'S.O. 7';
  return null;
}

// --- Setting up the Works Accounts Office ----------------------------------------------------

export function setupCosting(world, production) {
  const paper = world.paper;
  const cal = world.cal;
  const rates = stockRates(world);
  const C = {
    rates,
    standards: new Map(),
    cards: new Map(),
    sheets: [], // weekly wages allocation sheets
    fortnights: [], // closed fortnights: { from, to, charges, abstract }
    couponNo: 1,
    rate: SHOP_CHARGES,
    stockLots: new Map(), // stock order number -> its lot
  };
  world.costs = C;
  for (const [id, name, node, kind] of [
    ['cost-in', 'the cost clerk’s tray', 'cost-2'],
    ['cost-ledger', 'the Cost Ledger', 'works-accountant', 'file'],
    ['cost-files', 'the Works Accounts Office files', 'cost-2', 'file'],
    ['estimates', 'the Estimator’s file', 'works-accountant', 'file'],
    ['md-guard-book', 'the Managing Director’s guard book of cost abstracts', 'md-desk', 'file'],
  ]) paper.addContainer({ id, name, node, kind });

  // The Estimator's sheets for the season, made out last October.
  const seen = new Set();
  for (const [model, pattern] of PROGRAMME_CYCLE) {
    const key = standardKey(model, pattern);
    if (seen.has(key)) continue;
    seen.add(key);
    const std = standardCost(world, rates, model, pattern);
    C.standards.set(key, std);
    const list = listPrice(model, pattern);
    const doc = paper.create('estimate-sheet', {
      model, pattern, name: modelName(model, pattern), lines: std.lines, wages: std.wages,
      material: std.material, direct: std.direct, charges: std.charges, works: std.works, office: std.office, total: std.total,
      rate: SHOP_CHARGES, officeRate: OFFICE_ONCOST, list, trade: Math.round(list * 0.75), date: cal.at(1912, 10, 14),
    }, { at: 'estimates' });
    doc.history[0].t = cal.at(1912, 10, 14, 11);
    doc.history[0].text = 'made out by the Works Accountant and Estimator for the 1913 season';
  }
  for (const [no, name] of STANDING) card(world, no, { kind: 'standing', desc: name });

  // Hooks on the works: a cost card for each sub-order as it's put through,
  // and a coupon from the work tally whenever the stores issue its parts.
  const launched = production.onLaunch;
  production.onLaunch = (lot) => {
    launched?.(lot);
    if (lot.kind === 'despatch') return;
    cardForLot(world, lot);
  };
  const finished = production.onDone;
  production.onDone = (lot) => {
    lot.doneAt = world.sim.now;
    finished?.(lot);
  };
  const issued = production.onIssue;
  production.onIssue = (lot, step, by) => {
    issued?.(lot, step, by);
    if (lot.kind === 'despatch') return;
    coupon(world, lot, step, by);
  };
  return C;
}

function subOrderOf(lot) {
  return lot.batch ? lot.batch.id : lot.label.split(' ')[0];
}

function card(world, subOrder, fields) {
  const C = world.costs;
  if (C.cards.has(subOrder)) return C.cards.get(subOrder);
  const doc = world.paper.create('cost-card', {
    subOrder, opened: world.sim.now, lines: [], bf: 0, materials: 0, wages: 0, charges: 0, closed: null, unitCost: null, ...fields,
  }, { at: 'cost-ledger' });
  C.cards.set(subOrder, doc);
  return doc;
}

function cardForLot(world, lot) {
  const b = lot.batch;
  if (b) {
    return card(world, b.id, {
      kind: 'works', desc: `${b.qty} ${b.name}`, qty: b.qty, unit: 'machine', model: b.model, pattern: b.pattern,
      standard: world.costs.standards.get(standardKey(b.model, b.pattern))?.works ?? null,
    });
  }
  world.costs.stockLots.set(subOrderOf(lot), lot);
  return card(world, subOrderOf(lot), {
    kind: 'stock', desc: lot.label.split(' ').slice(1).join(' '), qty: lot.qty, unit: 'part', item: lot.item,
    standard: world.costs.rates.get(lot.item) ?? null,
  });
}

// Post a line to a cost card.
function post(card, line) {
  const f = card.fields;
  const l = { materials: 0, wages: 0, charges: 0, bf: 0, ...line };
  f.lines.push(l);
  f.materials += l.materials;
  f.wages += l.wages;
  f.charges += l.charges;
  f.bf += l.bf;
}

export function cardTotal(card) {
  const f = card.fields;
  return f.bf + f.materials + f.wages + f.charges;
}

// --- Coupons from the work tallies ---------------------------------------------------------

function coupon(world, lot, step, by) {
  const C = world.costs;
  const paper = world.paper;
  const items = step.issue.map(([item, per]) => ({ item, qty: per * lot.qty, desc: BOUGHT[item]?.[0] || MADE[item] || item, unit: BOUGHT[item]?.[1] || 'each', per: BOUGHT[item]?.[4] || 1 }));
  const doc = paper.create('stores-coupon', {
    no: C.couponNo++, subOrder: subOrderOf(lot), lot: lot.label, store: step.store === 'finished' ? 'Finished Stores' : 'Rough Stores',
    items, issuedBy: by.name, date: world.sim.now, priced: false, total: 0,
  }, { by });
  if (lot.tally) paper.link(doc, lot.tally);
  doc.destination = 'cost-in';
  paper.put(doc, 'stores-out', 'cut off the work tally; with the day’s coupons for the Works Accounts Office');
}

// The cost clerk prices a coupon from the stock rate card and posts it.
function priceCoupon(world, doc) {
  const C = world.costs;
  let total = 0;
  for (const it of doc.fields.items) {
    it.rate = C.rates.get(it.item) || 0;
    it.amount = Math.round(it.rate * it.qty);
    total += it.amount;
  }
  doc.fields.total = total;
  doc.fields.priced = true;
  const c = C.cards.get(doc.fields.subOrder);
  if (c) {
    const n = doc.fields.items.length;
    post(c, { t: world.sim.now, ref: `Coupon ${doc.fields.no}`, text: `${doc.fields.store}, ${n === 1 ? doc.fields.items[0].desc.toLowerCase() : `${n} items`}`, materials: total });
    world.paper.link(doc, c);
  }
  return total;
}

// --- Opening work in progress -------------------------------------------------------------

// The batches and stock orders already in the shops on 3 March carry what
// had been spent on them, at standard (est.): the parts issued and the work
// done on each tray before the step it had reached.
export function openingWorkInProgress(world, production) {
  const C = world.costs;
  const add = new Map();
  for (const lot of production.active) {
    if (lot.kind === 'despatch' || !lot.step) continue;
    let materials = 0;
    let wages = 0;
    lot.routing.forEach((step, i) => {
      if (i > lot.step) return;
      const done = i < lot.step ? lot.qty : lot.qty - lot.left - lot.inHand;
      if (step.issue && i < lot.step) for (const [item, per] of step.issue) materials += (C.rates.get(item) || 0) * per * lot.qty;
      if (step.op && !step.issue && !(step.skipIf && step.skipIf(lot))) wages += labourOn(world, step) * Math.max(0, done);
    });
    const sub = subOrderOf(lot);
    const a = add.get(sub) || { materials: 0, wages: 0 };
    a.materials += materials;
    a.wages += wages;
    add.set(sub, a);
  }
  // Batches that had reached the Finishing Shop came with all three
  // streams' work done.
  for (const b of world.works.batches) {
    if (b.streams['1'].length || !b.arrived.size) continue;
    const lady = b.pattern === 'lady' || b.pattern === 'girl';
    const a = add.get(b.id) || { materials: 0, wages: 0 };
    for (const list of [frameIssue(), brightIssue(), wheelRoughIssue(), wheelFinishedIssue()]) for (const [item, per] of list) a.materials += (C.rates.get(item) || 0) * per * b.qty;
    a.wages += (routingLabour(world, frameRouting()) + routingLabour(world, brightRouting(), { lady }) + routingLabour(world, wheelRouting())) * b.qty;
    add.set(b.id, a);
  }
  for (const [sub, a] of add) {
    const c = C.cards.get(sub);
    if (!c) continue;
    const bf = Math.round(a.materials + a.wages * (1 + SHOP_CHARGES));
    post(c, { t: world.cal.at(1913, 3, 1), ref: 'B/f', text: `From February, at standard (est.): materials ${fmt(Math.round(a.materials))}, wages ${fmt(Math.round(a.wages))}, shop charges`, bf });
    const issued = [...production.active].filter((l) => subOrderOf(l) === sub && l.tally).map((l) => l.tally.fields.issued);
    c.fields.opened = issued.length ? Math.min(...issued) : world.cal.at(1913, 2, 17, 7);
    c.history[0].t = c.fields.opened;
  }
}

// --- The weekly wages allocation -----------------------------------------------------------

// Split each hand's gross wages between the sub-orders on the time slips
// and the standing orders, to the farthing.
export function allocateWages(world, week) {
  const C = world.costs;
  const orders = new Map();
  const standing = new Map(STANDING.map(([no]) => [no, 0]));
  let total = 0;
  for (const r of week.results) {
    const p = r.p;
    total += r.gross;
    let allocated = 0;
    let broughtForward = false;
    const hourly = p.hourly || (p.weekly ? p.weekly / 53 : 0);
    const piece = PIECE_DEPTS.has(p.dept) && pieceOrBonus(p);
    const bonus = BONUS_DEPTS.has(p.dept) && pieceOrBonus(p);
    for (const slip of r.slips) {
      if (slip.fields.broughtForward) {
        broughtForward = true;
        continue;
      }
      for (const e of slip.fields.entries) {
        let amount;
        if (piece) amount = e.price * e.qty;
        else {
          amount = Math.round((e.minutes / 60) * hourly);
          if (bonus) {
            const allowed = e.std * e.qty * BONUS_ALLOWANCE;
            if (allowed > e.minutes) amount += Math.round(((allowed - e.minutes) / allowed) * (e.minutes / 60) * p.hourly);
          }
        }
        if (!C.cards.has(e.order) || C.cards.get(e.order).fields.kind === 'standing') {
          standing.set('S.O. 6', standing.get('S.O. 6') + amount); // packing against an office order
        } else {
          orders.set(e.order, (orders.get(e.order) || 0) + amount);
        }
        allocated += amount;
      }
    }
    const rest = r.gross - allocated;
    const so = broughtForward ? 'S.O. 8' : standingFor(p) || 'S.O. 5';
    standing.set(so, standing.get(so) + rest);
  }
  const direct = [...orders.values()].reduce((a, v) => a + v, 0);
  const indirect = [...standing.values()].reduce((a, v) => a + v, 0);
  return { orders, standing, direct, indirect, total };
}

// --- The cost clerk ------------------------------------------------------------------------

export function* costClerk(world, p) {
  const C = world.costs;
  const W = world.wages;
  const paper = world.paper;
  const cal = world.cal;
  for (;;) {
    // The day after the wages are made up: abstract the week's time slips.
    const now = world.sim.now;
    const week = W.weeks.find((w) => w.abstract && !w.allocated && cal.dayStart(now) > w.calcDay && w.results?.length);
    if (week && cal.minuteOfDay(now) >= 8 * 60 + 30) {
      week.allocated = true;
      yield* walk(world, p, 'wages-2', { activity: 'going to the Wages Office for the week’s time slips' });
      yield* work(world, p, 25 + week.results.length * 0.06, `abstracting the time slips for the week ending ${cal.docDate(week.ending)}`);
      yield* walk(world, p, p.spot, { activity: 'going back to the Works Accounts Office' });
      const a = allocateWages(world, week);
      yield* work(world, p, 10 + a.orders.size * 1.5, 'writing up the wages allocation sheet');
      const sheet = paper.create('wages-allocation', {
        ending: week.ending,
        orders: [...a.orders].map(([sub, amount]) => ({ subOrder: sub, desc: C.cards.get(sub)?.fields.desc || '', amount })).sort((x, y) => x.subOrder.localeCompare(y.subOrder, 'en', { numeric: true })),
        standing: STANDING.map(([no, name]) => ({ no, name, amount: a.standing.get(no) })).filter((x) => x.amount),
        direct: a.direct, indirect: a.indirect, total: a.total, abstractTotal: week.results.reduce((s, r) => s + r.gross, 0),
      }, { by: p });
      if (week.abstract) paper.link(sheet, week.abstract);
      for (const [sub, amount] of a.orders) {
        const c = C.cards.get(sub);
        yield* work(world, p, 0.6, `posting direct wages to the cost card for ${sub}`);
        post(c, { t: world.sim.now, ref: `W/e ${cal.shortDate(week.ending)}`, text: 'Direct wages, from the time slips', wages: amount });
      }
      for (const [no, amount] of a.standing) {
        if (!amount) continue;
        post(C.cards.get(no), { t: world.sim.now, ref: `W/e ${cal.shortDate(week.ending)}`, text: 'Wages, from the time slips', wages: amount });
      }
      C.sheets.push({ week, sheet, ...a });
      paper.put(sheet, 'cost-files', 'filed with the week’s papers');
      world.log(`The wages for the week ending ${cal.docDate(week.ending)} allocated: ${fmt(a.direct)} to ${a.orders.size} sub-orders, ${fmt(a.indirect)} to standing orders.`, { kind: 'costs' });
      continue;
    }
    // Coupons from the stores, priced and posted.
    const coupons = [...paper.container('cost-in').docs].filter((x) => x.type === 'stores-coupon').slice(0, 8);
    if (coupons.length) {
      for (const cp of coupons) {
        paper.hold(cp, p);
        yield* work(world, p, 1 + 0.4 * cp.fields.items.length, `pricing coupon No. ${cp.fields.no} for ${cp.fields.subOrder} from the stock rate card`);
        priceCoupon(world, cp);
        paper.mark(cp, 'priced', `priced and extended: ${fmt(cp.fields.total)}; posted to the cost card for ${cp.fields.subOrder}`);
        paper.put(cp, 'cost-files', false);
      }
      continue;
    }
    yield* work(world, p, 15, 'posting the Cost Ledger');
  }
}

// --- The Works Accountant's fortnight ------------------------------------------------------

// Annual salaries of the staff on the works side, which are works oncost
// (the rest are office oncost).
const WORKS_TIMETABLES = new Set(['worksStaff', 'wages', 'gate']);
export function worksStaff(world, p) {
  return p.role === 'staff' && p.timetable && [...WORKS_TIMETABLES].some((k) => p.timetables?.[k] === p.timetable);
}

function salaries(world, worksSide) {
  return world.people.filter((p) => p.role === 'staff' && p.salary && worksStaff(world, p) === worksSide).reduce((a, p) => a + p.salary, 0);
}

// Coal burnt at the boilers between two times, at the rate card price.
function coalUsed(world, from, to) {
  const store = world.production.stores.get('coal');
  if (!store) return 0;
  const cwt = -store.ledger.filter((l) => l.item === 'coal' && l.qty < 0 && l.t >= from && l.t < to).reduce((a, l) => a + l.qty, 0);
  return Math.round(cwt * (world.costs.rates.get('coal') || 0));
}

// What the works actually spent in the fortnight, against what the shop
// charges recovered.
function shopCharges(world, sheets, from, to) {
  const rows = [];
  const indirect = new Map();
  for (const sh of sheets) for (const [no, v] of sh.standing) if (no !== 'S.O. 8') indirect.set(no, (indirect.get(no) || 0) + v);
  for (const [no, name] of STANDING) if (indirect.get(no)) rows.push({ head: `${no}. ${name}`, amount: indirect.get(no) });
  rows.push({ head: 'Salaries of the works staff (two weeks)', amount: Math.round((salaries(world, true) * 2) / 52) });
  rows.push({ head: 'National Insurance, the firm’s share', amount: sheets.reduce((a, sh) => a + (sh.week.employerNI || 0), 0) });
  rows.push({ head: 'Coal burnt at the boilers', amount: coalUsed(world, from, to) });
  for (const [, name, perYear, share] of OVERHEADS) if (share) rows.push({ head: name, amount: Math.round((lsd(perYear) * share * 2) / 52), est: true });
  const actual = rows.reduce((a, r) => a + r.amount, 0);
  const direct = sheets.reduce((a, sh) => a + sh.direct, 0);
  const recovered = Math.round(direct * world.costs.rate);
  return { rows, actual, direct, rate: world.costs.rate, recovered, difference: recovered - actual };
}

// The works cost of a despatched machine: its sub-order's cost per machine
// once the card is closed, otherwise the Estimator's figure.
export function machineCost(world, m) {
  const C = world.costs;
  const c = m.batch !== 'stock' ? C.cards.get(m.batch) : null;
  if (c && c.fields.closed) return { cost: c.fields.unitCost, basis: 'actual' };
  const std = C.standards.get(standardKey(m.model, m.pattern)) || standardCost(world, C.rates, m.model, m.pattern);
  return { cost: Math.round(std.works), basis: m.batch === 'stock' ? 'stock' : 'standard' };
}

// Each invoice of the fortnight: its machines' works cost, office oncost and
// the profit or loss.
export function costAbstract(world, from, to) {
  const frames = new Map(world.works.register.map((m) => [m.frameNo, m]));
  const rows = [];
  for (const dd of world.commerce?.despatches || []) {
    const inv = dd.invoice;
    if (!inv || inv.fields.date < from || inv.fields.date >= to) continue;
    let works = 0;
    const bases = new Set();
    for (const n of dd.frameNos || []) {
      const m = frames.get(n);
      if (!m) continue;
      const mc = machineCost(world, m);
      works += mc.cost;
      bases.add(mc.basis);
    }
    const office = Math.round(works * OFFICE_ONCOST);
    rows.push({
      invoiceNo: inv.fields.no, orderNo: inv.fields.orderNo, agent: inv.fields.agentName, machines: (dd.frameNos || []).length,
      invoiced: inv.fields.total, works, office, profit: inv.fields.total - works - office, basis: [...bases].join(', '), invoice: inv,
    });
  }
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  return { rows, machines: sum('machines'), invoiced: sum('invoiced'), works: sum('works'), office: sum('office'), profit: sum('profit') };
}

export function* worksAccountant(world, p) {
  const C = world.costs;
  const paper = world.paper;
  const cal = world.cal;
  for (;;) {
    // A fortnight is two wages weeks, closed once both are allocated.
    const open = C.sheets.filter((sh) => !sh.closed);
    if (open.length >= 2 && cal.minuteOfDay(world.sim.now) >= 9 * 60) {
      const sheets = open.slice(0, 2);
      for (const sh of sheets) sh.closed = true;
      const from = C.fortnights.length ? C.fortnights.at(-1).to : cal.at(1913, 3, 3);
      const to = sheets[1].week.ending + 1440;
      yield* work(world, p, 35, 'working out the fortnight’s works expenditure');
      const sc = shopCharges(world, sheets, from, to);
      const charges = paper.create('shop-charges', { from, to, ...sc }, { by: p });
      for (const sh of sheets) paper.link(charges, sh.sheet);
      // Shop charges on each sub-order's direct wages.
      const wages = new Map();
      for (const sh of sheets) for (const [sub, v] of sh.orders) wages.set(sub, (wages.get(sub) || 0) + v);
      for (const [sub, v] of wages) {
        yield* work(world, p, 0.5, `adding shop charges to the cost card for ${sub}`);
        post(C.cards.get(sub), { t: world.sim.now, ref: `F/n ${cal.shortDate(to - 1440)}`, text: `Shop charges, ${Math.round(sc.rate * 100)}% on direct wages of ${fmt(v)}`, charges: Math.round(v * sc.rate) });
      }
      // Close the cards of sub-orders finished in the fortnight.
      const closedNow = [];
      for (const c of C.cards.values()) {
        const f = c.fields;
        if (f.closed || f.kind === 'standing') continue;
        const done = f.kind === 'works' ? world.works.batches.find((b) => b.id === f.subOrder)?.finished : C.stockLots.get(f.subOrder)?.doneAt;
        if (!done || done >= to) continue;
        yield* work(world, p, 4, `closing the cost card for ${f.subOrder}`);
        f.closed = world.sim.now;
        f.unitCost = Math.round(cardTotal(c) / f.qty);
        paper.mark(c, 'closed', `closed: ${f.qty} ${f.unit}s at ${fmt(f.unitCost)} each${f.standard ? ` (estimate ${fmt(Math.round(f.standard))})` : ''}`);
        closedNow.push(c);
      }
      // The Delivered Orders Cost Abstract, for the Managing Director.
      const ab = costAbstract(world, from, to);
      yield* work(world, p, 20 + ab.rows.length * 0.8, 'making out the Delivered Orders Cost Abstract');
      const abstract = paper.create('cost-abstract', { from, to, ...ab, rows: ab.rows.map(({ invoice, ...r }) => r) }, { by: p });
      for (const r of ab.rows.slice(0, 30)) paper.link(abstract, r.invoice);
      paper.link(abstract, charges);
      C.fortnights.push({ from, to, charges, abstract, closed: closedNow });
      // Hawkins: don't "use the same rate of Oncost year after year". The
      // rate for the next fortnight is the actual so far, to the nearest 5%.
      const spent = C.fortnights.reduce((a, fn) => a + fn.charges.fields.actual, 0);
      const direct = C.fortnights.reduce((a, fn) => a + fn.charges.fields.direct, 0);
      const revised = Math.round((spent / Math.max(1, direct)) * 20) / 20;
      if (revised !== C.rate) {
        charges.fields.revised = revised;
        world.log(`The Works Accountant revised the shop charges from ${Math.round(C.rate * 100)}% to ${Math.round(revised * 100)}% on direct wages.`, { kind: 'costs' });
        C.rate = revised;
      }
      paper.put(charges, 'cost-files', 'filed with the fortnight’s papers');
      world.log(`The Works Accountant closed the fortnight to ${cal.docDate(to - 1440)}: ${ab.machines} machines invoiced at a ${ab.profit >= 0 ? 'profit' : 'loss'} of ${fmt(Math.abs(ab.profit))}, and the shop charges ${sc.difference >= 0 ? 'over' : 'under'}-recovered by ${fmt(Math.abs(sc.difference))}`, { kind: 'costs' });
      // Taken to the Managing Director by hand, "for privacy".
      yield* walk(world, p, 'md-desk', { activity: 'taking the cost abstract to the Managing Director' });
      yield* work(world, p, 12, 'going through the cost abstract with the Managing Director');
      paper.mark(abstract, 'initialled', 'initialled by the Managing Director');
      paper.put(abstract, 'md-guard-book', 'mounted in the guard book');
      yield* walk(world, p, p.spot, { activity: 'going back to the Works Office' });
      continue;
    }
    yield* work(world, p, 20, world.rng.pick(['checking the cost cards', 'estimating for a special order', 'going through the stock rate card']));
  }
}
