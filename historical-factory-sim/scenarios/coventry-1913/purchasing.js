// Buying in: stock control cards, purchase requisitions, purchase orders,
// the suppliers, deliveries, goods received notes, matching invoices, the
// Bought Ledger and the monthly payment run.
//
// The routine is Elbourne's (1914), with Spencer's (1907) where they differ:
//   - The storekeeper keeps a stock control card for each item, with an
//     "ordering level" and a "normal quantity to be ordered" (Elbourne), and
//     writes a purchase requisition in triplicate when stock falls to the
//     level. The Works Manager must "O.K. and initial each item" (Spencer).
//   - The Buyer places it; his clerk types the purchase order in triplicate:
//     supplier; Buyer; "the third copy going to the Receiving Clerk, without
//     prices". Orders over £50 are signed by the Managing Director.
//   - Suppliers send an advice of despatch by post, separately from the
//     invoice. The Receiving Clerk checks the goods against his unpriced copy
//     and writes a goods received note in carbon duplicate; the duplicate
//     stays in the Stores.
//   - "Suppliers' invoices shall not be sent beyond the Works Accounts
//     Office": there the GRN is matched with the invoice, completed as to
//     prices, and the invoice passed and numbered before it goes to the
//     Bought Ledger.
//   - "Our pay day is third Wednesday in the month, and remittances are made
//     for all accounts passed in respect to deliveries for the preceding
//     month" (Spencer). A list of payments is checked by the Accountant and
//     sanctioned by a director; payment is by combined cheque and receipt.
import { until, wait } from '../../engine/sim/kernel.js';
import { walk, work } from '../../engine/sim/world.js';
import { lsd, fmt } from '../../engine/sim/money.js';
import { BOUGHT, WEEKLY_MACHINES } from './catalogue.js';
import { SUPPLIERS } from './outside.js';
import { usePerMachine } from './works.js';

const DISCOUNT = 0.025; // "Monthly, less 2½%"
const MD_LIMIT = lsd(50); // orders above this are signed by the Managing Director
const RAILWAYS = ['L. & N.W.R.', 'Midland Railway'];

export function setupPurchasing(world, production, timetables) {
  HOLIDAY = (t) => timetables.works.isHoliday(t);
  const paper = world.paper;
  const cal = world.cal;
  const ledger = world.ledger;
  const rng = world.rng.fork('purchasing');
  const rough = production.stores.get('rough');
  const use = usePerMachine();
  const feb28 = cal.at(1913, 2, 28, 12);

  ledger.open('purchases', 'Purchases (materials and parts)', { type: 'expense' });
  ledger.open('creditors', 'Sundry Creditors (Bought Ledger)', { type: 'liability' });
  ledger.open('discounts-received', 'Discounts Received', { type: 'income' });
  const suppliers = SUPPLIERS.map((s) => ({ ...s, account: `sup-${s.id}`, invoiceNo: rng.int(1200, 9800) }));
  for (const s of suppliers) ledger.open(s.account, s.name, { type: 'liability', control: 'creditors', meta: s });

  for (const [id, name, node, kind = 'tray'] of [
    ['stock-cards', 'the stock control cards', 'storekeeper', 'file'],
    ['requisition-book', 'the requisition book', 'storekeeper', 'file'],
    ['stores-out', "the Stores' out-tray", 'storekeeper'],
    ['works-out', "the Works Office's out-tray", 'works-manager'],
    ['buyer-tray', "the Buyer's tray", 'buyer'],
    ['buyer-sign', 'the orders waiting to be signed', 'buyer'],
    ['buyer-clerk-tray', "the Buyer's clerk's tray", 'buyer-clerk'],
    ['buyer-files', "the Buyer's file of orders", 'buyer', 'file'],
    ['receiving-file', "the receiving clerk's file of orders expected", 'receiving-clerk', 'file'],
    ['receiving-tray', "the receiving clerk's tray", 'receiving-clerk'],
    ['receiving-done', "the receiving clerk's file of orders received", 'receiving-clerk', 'file'],
    ['gr-book', 'the goods received book (duplicates)', 'receiving-clerk', 'file'],
    ['invoice-match', 'the Works Accounts Office: invoices and G.R. notes to match', 'works-accountant'],
    ['bought-tray', "the bought ledger clerk's tray", 'bought-ledger'],
    ['bought-files', 'the Bought Ledger files', 'bought-ledger', 'file'],
    ['suppliers', 'with the supplier', null, 'away'],
  ]) paper.addContainer({ id, name, node, kind });

  const date = (e, { cal: c }) => c.shortDate(e.t);
  const col = (h, f, o = {}) => ({ h, f, ...o });
  const money = (h, f) => ({ h, f, money: true });
  for (const [id, title, node, columns] of [
    ['po-register', 'Purchase Orders Register', 'buyer', [
      col('Order', (e) => e.no), col('Date', date), col('Supplier', (e) => e.supplier), col('Goods', (e) => e.goods), money('Value', (e) => e.value), col('Received', (e, c) => (e.received ? c.cal.shortDate(e.received) : ''))]],
    ['goods-received-book', 'Goods Received Book', 'receiving-clerk', [
      col('G.R.', (e) => e.no), col('Date', date), col('Supplier', (e) => e.supplier), col('Per', (e) => e.per), col('Goods', (e) => e.goods), col('Order', (e) => e.poNo)]],
    ['bought-day-book', 'Bought Day Book', 'bought-ledger', [
      col('Date', date), col('P.I.', (e) => e.piNo), col('Supplier', (e) => e.supplier), col('Their No.', (e) => e.invNo, { num: true }), col('Order', (e) => e.poNo), money('Amount', (e) => e.total)]],
    ['cash-book-payments', 'Cash Book (payments side)', 'cashier-desk', [
      col('Date', date), col('Paid to', (e) => e.to), money('Discount', (e) => e.discount), money('Bank', (e) => e.amount)]],
  ]) paper.addBook({ id, title, node, columns });

  const P = {
    rng,
    suppliers,
    supplierById: new Map(suppliers.map((s) => [s.id, s])),
    itemSupplier: new Map(suppliers.flatMap((s) => s.items.map((i) => [i, s]))),
    cards: new Map(),
    pos: [],
    consignments: [],
    atDoor: [],
    toCheck: [],
    reviewed: new Set(),
    prNo: 401,
    poNo: 2101,
    grNo: 812,
    piNo: 1301,
    sheetNo: 4410,
    runs: [],
    vehicles: [],
  };
  world.purchasing = P;

  // The stock control cards, and stock in the bins on 1 March.
  let bin = 0;
  for (const [item, [desc, unit, , price, per]] of Object.entries(BOUGHT)) {
    const s = P.itemSupplier.get(item);
    const weekly = (use[item] || 0) * WEEKLY_MACHINES;
    const pack = item === 'bar-steel' ? 112 : per > 1 ? per : weekly >= 200 ? 25 : weekly >= 40 ? 10 : 5;
    const up = (n) => Math.max(pack, Math.ceil(n / pack) * pack);
    // Days from the order going out to the goods being in the bins.
    const lead = 1 + s.days[1] + (s.carrier === 'own cart' ? 0 : 1);
    // Batches draw their parts a tray at a time, so allow half as much again.
    const level = up(weekly * (lead / 5.5 + 1.5));
    const normal = up(weekly * 2);
    const opening = up(Math.max(weekly * 0.9, level + rng.uniform(-0.3, 1) * normal));
    rough.stock.set(item, opening);
    rough.opening.set(item, opening);
    const card = {
      item, desc, unit, price, per, pack, weekly, level, normal, supplier: s, store: 'rough',
      onOrder: 0, requested: 0, lastPosted: world.sim.now,
    };
    card.doc = paper.create('stock-card', {
      item, desc, unit, per, bin: `${'ABCDEFGH'[Math.floor(bin / 6)]}${(bin % 6) + 1}`, level, normal,
      lines: [{ t: cal.at(1913, 3, 1), ref: 'Balance', balance: opening }],
    }, { at: 'stock-cards' });
    bin++;
    P.cards.set(item, card);
  }

  // Orders placed in the last week of February for whatever had fallen to
  // its ordering level; the goods are due in the first days of March.
  const late = [...P.cards.values()].filter((c) => rough.qty(c.item) < c.level);
  const bySupplier = new Map();
  for (const c of late) {
    if (!bySupplier.has(c.supplier)) bySupplier.set(c.supplier, []);
    bySupplier.get(c.supplier).push(c);
  }
  for (const [s, cards] of bySupplier) {
    const placed = cal.at(1913, 2, rng.int(24, 28), 15);
    const po = makeOrder(world, s, cards.map((c) => ({ card: c, qty: c.normal })), { placed });
    po.state = 'with supplier';
    po.despatchDay = workingDay(cal, cal.at(1913, 3, 1), rng.int(0, 3));
    paper.put(po.docs.top, 'suppliers', false);
    paper.put(po.docs.buyer, 'buyer-files', false);
    paper.put(po.docs.receiving, 'receiving-file', false);
    noteOrder(world, po);
  }

  // What the works owes its suppliers for February's deliveries, to be paid
  // on the third Wednesday of March; and February's railway account.
  for (const s of suppliers) {
    const weekly = s.items.reduce((a, i) => a + P.cards.get(i).weekly / P.cards.get(i).per * P.cards.get(i).price, 0);
    const owed = Math.round(weekly * rng.uniform(3.6, 4.4) / 2) * 2;
    if (owed > 0) ledger.post(feb28, 'Balance brought forward: February deliveries', [[s.account, 0, owed], ['opening', owed, 0]]);
  }
  const rail = Math.round(lsd(52) * rng.uniform(0.85, 1.15));
  ledger.post(feb28, 'Carriage account, February', [['lnwr', 0, rail], ['opening', rail, 0]]);
  P.febRail = rail;
  return P;
}

// The day `n` working days after `day` (Sundays and bank holidays don't
// count).
let HOLIDAY = () => false;
function workingDay(cal, day, n) {
  const off = (t) => cal.dow(t) === 0 || HOLIDAY(t);
  let t = cal.dayStart(day);
  let k = n;
  while (k > 0 || off(t)) {
    t += 1440;
    if (!off(t)) k--;
  }
  return t;
}

const roundTo = (f, q = 2) => Math.round(f / q) * q;

const PLURAL = { set: 'sets', pair: 'pairs', length: 'lengths', gross: 'gross', 'lb.': 'lb.' };
// "550 toolbags with spanner and oilcan", "270 gross of spokes".
export const goods = (n, unit, per, desc) => (unit === 'each' && per === 1 ? `${n.toLocaleString('en-GB')} × ${desc.toLowerCase()}` : `${quantity(n, unit, per)} of ${desc.toLowerCase()}`);
// A quantity in the trade's own unit: spokes by the gross, frame tubes by
// the set, saddles by number.
export function quantity(n, unit, per = 1) {
  if (per > 1) return `${(n / per).toLocaleString('en-GB')} ${unit}`;
  if (unit === 'each') return n.toLocaleString('en-GB');
  return `${n.toLocaleString('en-GB')} ${n === 1 ? unit : PLURAL[unit] || `${unit}s`}`;
}

// A purchase order (the record and its three copies).
function makeOrder(world, s, wants, { by = null, placed = world.sim.now, prs = [] } = {}) {
  const P = world.purchasing;
  const paper = world.paper;
  const no = `P.${P.poNo++}`;
  const lines = wants.map(({ card, qty }) => ({
    item: card.item, desc: card.desc, unit: card.unit, qty, price: card.price, per: card.per,
    amount: roundTo((qty / card.per) * card.price),
  }));
  const value = lines.reduce((a, l) => a + l.amount, 0);
  const top = paper.create('purchase-order', {
    no, date: placed, supplier: s.id, supplierName: s.name, address: s.address, lines, value,
    delivery: s.carrier === 'own cart' ? 'By your cart to the Rough Stores' : s.carrier === 'parcel post' ? 'By parcel post' : `Per ${s.carrier} goods, carriage paid, to Coventry`,
    prs: prs.map((r) => r.no), signedBy: null,
  }, { by, no });
  if (!by) {
    top.history.length = 0;
    for (const c of top.copies) {
      c.history.length = 0;
      paper.note(c, 'typed by the Buyer’s clerk');
      c.history[0].t = placed;
    }
  }
  const po = { no, supplier: s, lines, value, placed, docs: { top, buyer: top.copies[1], receiving: top.copies[2] }, prs, state: 'typed', grns: [], invoices: [] };
  P.pos.push(po);
  for (const r of prs) paper.link(top, r);
  paper.enter('po-register', { no, supplier: s.name, goods: lines.map((l) => l.desc).join('; '), value, received: null }, { from: top, by });
  po.entry = paper.books.get('po-register').entries.at(-1);
  return po;
}

// The receiving clerk enters an order on the stock control cards.
function noteOrder(world, po) {
  for (const l of po.lines) {
    const card = world.purchasing.cards.get(l.item);
    card.onOrder += l.qty;
    card.requested = Math.max(0, card.requested - l.qty);
    cardLine(world, card, { ref: po.no, ordered: l.qty });
  }
  world.paper.mark(po.docs.receiving, 'noted', 'entered as on order on the stock control cards');
}

function cardLine(world, card, line) {
  const store = world.production.stores.get(card.store);
  card.doc.fields.lines.push({ t: world.sim.now, ...line, balance: store.qty(card.item) });
}

// --- The storekeeper ----------------------------------------------------------------

// Twice a day the storekeeper goes through his cards; at the end of the day
// he posts the day's issues to them.
export function* storekeeper(world, p) {
  const P = world.purchasing;
  const cal = world.cal;
  for (;;) {
    yield* work(world, p, 0.01);
    const now = world.sim.now;
    const today = cal.dayStart(now);
    const mod = cal.minuteOfDay(now);
    const slot = [8 * 60 + 40, 14 * 60 + 15].find((t) => mod >= t && mod < t + 150 && !P.reviewed.has(today + t));
    if (slot !== undefined) {
      P.reviewed.add(today + slot);
      yield* reviewCards(world, p);
      continue;
    }
    const last = p.timetable.lastSpellOfDay(now);
    if (last && now >= last[1] - 25 && P.issuesPosted !== today) {
      P.issuesPosted = today;
      yield* postIssues(world, p);
      continue;
    }
    yield* work(world, p, 10, 'at the stores issue counter');
  }
}

function* reviewCards(world, p) {
  const P = world.purchasing;
  const paper = world.paper;
  yield* work(world, p, 4, 'going through the stock control cards');
  for (const card of P.cards.values()) {
    const store = world.production.stores.get(card.store);
    const have = store.qty(card.item);
    if (have + card.onOrder + card.requested >= card.level) continue;
    const qty = card.normal;
    yield* work(world, p, 3, `writing a purchase requisition for ${card.desc.toLowerCase()}`);
    const no = `R.${P.prNo++}`;
    const pr = paper.create('purchase-requisition', {
      no, date: world.sim.now, item: card.item, desc: card.desc, unit: card.unit, per: card.per, qty, stock: have, level: card.level,
      purpose: 'Stock', delivery: 'As soon as possible', storekeeper: p.name, approvedBy: null, poNo: null, supplier: null,
    }, { by: p, no });
    card.requested += qty;
    cardLine(world, card, { ref: no, requisitioned: qty });
    paper.link(pr, card.doc);
    const [top, second, book] = pr.copies;
    for (const c of [top, second]) c.destination = 'works-manager-tray';
    paper.put(top, 'stores-out', 'for the Works Manager to approve');
    paper.put(second, 'stores-out', 'for the Works Manager to approve');
    paper.put(book, 'requisition-book', 'kept in the requisition book');
    world.log(`Requisition ${no}: ${goods(qty, card.unit, card.per, card.desc)} (stock down to ${quantity(have, card.unit, card.per)}).`, { kind: 'stores' });
  }
}

function* postIssues(world, p) {
  const P = world.purchasing;
  const totals = new Map();
  for (const card of P.cards.values()) {
    const store = world.production.stores.get(card.store);
    let n = 0;
    for (let i = store.ledger.length - 1; i >= 0 && store.ledger[i].t > card.lastPosted; i--) {
      const e = store.ledger[i];
      if (e.item === card.item && e.qty < 0) n -= e.qty;
    }
    card.lastPosted = world.sim.now;
    if (n) totals.set(card, n);
  }
  if (!totals.size) return;
  yield* work(world, p, 0.4 * totals.size, 'posting the day’s issues to the stock control cards');
  for (const [card, n] of totals) cardLine(world, card, { ref: 'Issues', issued: n });
}

// --- The Works Manager's desk ----------------------------------------------------------

export function* worksManagerDesk(world, p) {
  const paper = world.paper;
  for (;;) {
    const tray = paper.container('works-manager-tray');
    const prs = [...tray.docs].filter((x) => x.type === 'purchase-requisition');
    if (prs.length) {
      for (const pr of prs) paper.hold(pr, p);
      const tops = prs.filter((x) => x.copy === 0);
      for (const pr of tops) {
        yield* work(world, p, 1.2, `approving requisition ${pr.no}`);
        pr.fields.approvedBy = p.name;
        for (const c of pr.siblings) if (c.copy < 2) paper.mark(c, 'approved', 'O.K.’d and initialled by the Works Manager');
      }
      for (const pr of prs) {
        pr.destination = pr.copy === 0 ? 'buyer-tray' : 'requisition-book';
        paper.put(pr, 'works-out', pr.copy === 0 ? 'for the Buyer' : 'back to the Stores');
      }
      continue;
    }
    const read = [...tray.docs].filter((x) => x.type === 'office-order');
    if (read.length) {
      for (const x of read) paper.hold(x, p);
      yield* work(world, p, 0.4 * read.length, 'reading the copies of the day’s office orders');
      for (const x of read) paper.put(x, 'works-office', 'read by the Works Manager; filed in the Works Office');
      continue;
    }
    yield* work(world, p, 10, 'going over the production programme');
  }
}

// --- The Buyer and his clerk ----------------------------------------------------------------

export function* buyer(world, p) {
  const P = world.purchasing;
  const paper = world.paper;
  for (;;) {
    const prs = [...paper.container('buyer-tray').docs].filter((x) => x.type === 'purchase-requisition');
    if (prs.length) {
      for (const pr of prs) paper.hold(pr, p);
      yield* work(world, p, 2 * prs.length, 'deciding where to place the requisitions');
      for (const pr of prs) {
        const s = P.itemSupplier.get(pr.fields.item);
        pr.fields.supplier = s.name;
        paper.note(pr, `to be ordered from ${s.name}`);
        paper.put(pr, 'buyer-clerk-tray', 'passed to the Buyer’s clerk to type the order');
      }
      continue;
    }
    const unsigned = [...paper.container('buyer-sign').docs];
    if (unsigned.length) {
      for (const top of unsigned) paper.hold(top, p);
      const big = unsigned.filter((x) => x.fields.value > MD_LIMIT);
      for (const top of unsigned.filter((x) => x.fields.value <= MD_LIMIT)) {
        yield* work(world, p, 0.5, `signing order ${top.no}`);
        top.fields.signedBy = `${p.name}, Buyer`;
        paper.mark(top, 'signed', 'signed by the Buyer');
      }
      if (big.length) {
        yield* walk(world, p, 'md-desk', { activity: `taking ${big.length} order${big.length > 1 ? 's' : ''} over £50 to the Managing Director` });
        const md = world.people.find((q) => q.title === 'Managing Director');
        for (const top of big) {
          yield* work(world, p, 1, `Mr ${md ? md.name.split(' ').at(-1) : 'Hartwell'} signing order ${top.no}`);
          top.fields.signedBy = `${md ? md.name : 'Charles Hartwell'}, Managing Director`;
          paper.mark(top, 'signed', 'signed by the Managing Director (over £50)');
        }
        yield* walk(world, p, p.spot, { activity: 'going back to his desk' });
      }
      for (const top of unsigned) {
        top.destination = null;
        paper.put(top, 'out-post', 'for the evening post');
      }
      continue;
    }
    yield* work(world, p, 10, 'writing to a supplier about prices');
  }
}

export function* buyersClerk(world, p) {
  const P = world.purchasing;
  const paper = world.paper;
  for (;;) {
    const prs = [...paper.container('buyer-clerk-tray').docs].filter((x) => x.type === 'purchase-requisition');
    if (!prs.length) {
      yield* work(world, p, 10, 'copying purchase orders into the register');
      continue;
    }
    const s = P.itemSupplier.get(prs[0].fields.item);
    const mine = prs.filter((x) => P.itemSupplier.get(x.fields.item) === s);
    for (const pr of mine) paper.hold(pr, p);
    yield* work(world, p, 5 + 1.5 * mine.length, `typing a purchase order for ${s.name}`);
    const po = makeOrder(world, s, mine.map((pr) => ({ card: P.cards.get(pr.fields.item), qty: pr.fields.qty })), { by: p, prs: mine });
    for (const pr of mine) {
      pr.fields.poNo = po.no;
      paper.mark(pr, 'ordered', `order ${po.no} placed with ${s.name}`);
      paper.put(pr, 'buyer-files', 'filed with the Buyer’s copy of the order');
    }
    paper.put(po.docs.top, 'buyer-sign', 'waiting to be signed');
    paper.put(po.docs.buyer, 'buyer-files', 'the Buyer’s copy, filed under the supplier');
    po.docs.receiving.destination = 'receiving-file';
    paper.put(po.docs.receiving, 'office-out', 'the Receiving Clerk’s copy, without prices');
    world.log(`Purchase order ${po.no} to ${s.name}: ${po.lines.map((l) => goods(l.qty, l.unit, l.per, l.desc)).join('; ')} (${fmt(po.value)}).`, { kind: 'stores' });
  }
}

// --- The suppliers ------------------------------------------------------------------------------

// Each morning: orders posted the night before reach the suppliers; those
// whose day has come send the goods, an advice note by post and, a day or
// two later, the invoice.
export function* suppliersAtWork(world) {
  const P = world.purchasing;
  const cal = world.cal;
  const rng = P.rng;
  for (;;) {
    const day = cal.dayStart(world.sim.now) + 1440;
    yield until(day + 3 * 60);
    if (cal.dow(day) === 0 || HOLIDAY(day)) continue;
    for (const po of P.pos) {
      if (po.state === 'typed' && po.docs.top.container?.id === 'suppliers') {
        po.state = 'with supplier';
        world.paper.note(po.docs.top, `received by ${po.supplier.name}`);
        po.despatchDay = workingDay(cal, day, rng.int(...po.supplier.days));
      }
    }
    for (const po of P.pos) if (po.state === 'with supplier' && po.despatchDay <= day) despatch(world, po, day);
    monthlyAccounts(world, day);
  }
}

function packagesFor(l) {
  if (l.item === 'bar-steel') return Math.max(1, Math.ceil(l.qty / 560)); // bundles of 5 cwt (est.)
  if (l.per > 1) return Math.max(1, Math.ceil(l.qty / l.per / 20)); // boxes of 20 gross
  return Math.max(1, Math.ceil(l.qty / (l.item === 'tyre-set' ? 50 : 100)));
}

function despatch(world, po, day) {
  const P = world.purchasing;
  const cal = world.cal;
  const s = po.supplier;
  const rng = P.rng;
  po.state = 'despatched';
  const packages = po.lines.reduce((a, l) => a + packagesFor(l), 0);
  const cons = { po, supplier: s, lines: po.lines.map((l) => ({ ...l })), packages, carrier: s.carrier, despatched: day + 16 * 60 };
  P.consignments.push(cons);
  po.consignment = cons;
  const next = workingDay(cal, day, 1);
  if (RAILWAYS.includes(s.carrier)) cons.atYard = next + 3 * 60; // by the night goods train
  else if (s.carrier === 'own cart') cons.cartDue = rng.chance(0.5) ? day + 15 * 60 : next + 11 * 60;
  else cons.postDue = next + 10 * 60 + 15;
  const outsidePost = (type, fields, at) => world.sim.schedule(at, () => {
    const doc = world.paper.create(type, { ...fields, delivery: 'morning', received: null }, { at: 'post-office' });
    doc.history.length = 0;
    world.paper.note(doc, `written and posted by ${s.name}`);
    doc.history[0].t = fields.date;
    world.paper.link(doc, po.docs.top);
    if (type === 'advice-note') po.advice = doc;
    else po.invoices.push(doc);
  });
  const marks = `S.C.Co. / ${po.no}`;
  outsidePost('advice-note', {
    supplier: s.id, supplierName: s.name, address: s.address, poNo: po.no, date: day + 16 * 60, lines: cons.lines, packages, carrier: s.carrier, marks,
  }, next + 4 * 60);
  const invDay = workingDay(cal, day, rng.int(0, 2));
  const gross = cons.lines.reduce((a, l) => a + l.amount, 0);
  outsidePost('supplier-invoice', {
    supplier: s.id, supplierName: s.name, address: s.address, no: s.invoiceNo++, poNo: po.no, date: invDay + 17 * 60,
    lines: cons.lines, total: gross, carrier: s.carrier, terms: 'Monthly, less 2½%',
  }, workingDay(cal, invDay, 1) + 4 * 60);
}

// Statements from the suppliers, and the railway's monthly account, in the
// first days of the month.
function monthlyAccounts(world, day) {
  const P = world.purchasing;
  const cal = world.cal;
  const { month, day: dom } = cal.parts(day);
  if (dom > 6 || P.statementsMonth === month) return;
  P.statementsMonth = month;
  const monthStart = cal.at(1913, month, 1);
  const ledger = world.ledger;
  const accounts = [...P.suppliers.map((s) => ({ code: s.account, name: s.name, address: s.address, type: 'supplier-statement', supplier: s })), { code: 'lnwr', name: 'London and North Western Railway Co.', address: 'Goods Department, Warwick Road, Coventry', type: 'railway-account' }];
  for (const a of accounts) {
    const acct = ledger.account(a.code);
    const lines = acct.lines.filter((l) => l.t < monthStart);
    const balance = -lines.reduce((x, l) => x + l.debit - l.credit, 0);
    if (balance <= 0) continue;
    const recent = lines.filter((l) => l.t >= monthStart - 31 * 1440 || l.narrative.startsWith('Balance'));
    const at = day + P.rng.int(0, 2) * 1440 + 4 * 60;
    world.sim.schedule(at, () => {
      const doc = world.paper.create(a.type, {
        from: a.code, fromName: a.name, address: a.address, date: monthStart - 1440 + 17 * 60, balance,
        lines: recent.map((l) => ({ t: l.t, narrative: l.narrative, amount: l.credit - l.debit })), delivery: 'morning', received: null,
      }, { at: 'post-office' });
      doc.history.length = 0;
      world.paper.note(doc, `sent by ${a.name}`);
      doc.history[0].t = doc.fields.date;
    });
  }
}

// --- Deliveries ------------------------------------------------------------------------------------

export function makeVan(id, name, { kind = 'van', carrier, colour, driverName, home = 'HOME_S' }) {
  return { id, name, kind, carrier, colour, driverName, home, node: home, motion: null, onSite: false, activity: 'away', load: 0, driver: null, papers: new Set() };
}

// The railway companies' vans bring yesterday's goods "first thing in the
// morning" (West); the suppliers in Coventry send their own carts.
export function* railwayCartage(world, van) {
  const P = world.purchasing;
  const cal = world.cal;
  for (;;) {
    const now = world.sim.now;
    const today = cal.dayStart(now);
    let leave = today + 8 * 60 + 15;
    if (now >= leave || cal.dow(today) === 0 || HOLIDAY(today)) leave = workingDay(cal, today, 1) + 8 * 60 + 15;
    yield until(leave);
    const load = P.consignments.filter((c) => c.carrier === van.carrier && c.atYard && c.atYard <= world.sim.now && !c.delivered);
    if (!load.length) continue;
    for (const c of load) c.delivered = 'on the van';
    yield* deliver(world, van, load, { travel: 35 });
  }
}

export function* supplierCarts(world, cart) {
  const P = world.purchasing;
  for (;;) {
    yield wait(10);
    const due = P.consignments.filter((c) => c.carrier === 'own cart' && !c.delivered && c.cartDue <= world.sim.now);
    if (!due.length) continue;
    const c = due[0];
    c.delivered = 'on the cart';
    cart.name = `${c.supplier.name}’s cart`;
    cart.driverName = `${c.supplier.name}’s carman`;
    yield* deliver(world, cart, [c], { travel: 20 });
  }
}

// The postman brings parcels to the Stores with the second delivery.
export function* parcelPost(world) {
  const P = world.purchasing;
  for (;;) {
    yield wait(15);
    for (const c of P.consignments) {
      if (c.carrier === 'parcel post' && !c.delivered && c.postDue <= world.sim.now) {
        c.delivered = world.sim.now;
        c.per = 'parcel post';
        P.toCheck.push(c);
        world.log(`The postman brought ${c.packages} parcel${c.packages > 1 ? 's' : ''} from ${c.supplier.name} to the Rough Stores.`, { kind: 'stores' });
      }
    }
  }
}

function* deliver(world, v, load, { travel }) {
  const P = world.purchasing;
  const paper = world.paper;
  const packages = load.reduce((a, c) => a + c.packages, 0);
  const railway = RAILWAYS.includes(v.carrier);
  const sheet = paper.create('delivery-sheet', {
    no: railway ? P.sheetNo++ : null, carrier: railway ? v.carrier : load[0].supplier.name, railway, date: world.sim.now,
    lines: load.map((c) => ({ consignee: 'The Sherbourne Cycle Co. Ltd.', from: c.supplier.name, packages: c.packages, marks: `S.C.Co. / ${c.po.no}`, po: c.po.no })),
    others: railway ? otherTraders(P.rng) : [], signedBy: null,
  });
  paper.hold(sheet, v);
  for (const c of load) paper.link(sheet, c.po.docs.top);
  v.activity = railway ? `on the way from Warwick Road with ${packages} packages` : `on the way with ${packages} packages`;
  yield wait(travel);
  v.onSite = true;
  v.node = v.home;
  v.load = packages;
  v.driver = { name: v.driverName };
  yield* walk(world, v, 'Y4', { mode: 'vehicle', speed: 220, activity: `bringing ${packages} packages to the Rough Stores` });
  v.activity = 'waiting at the Rough Stores door';
  const call = { vehicle: v, sheet, load, packages, node: 'Y4', signed: null };
  P.atDoor.push(call);
  for (let i = 0; i < 90 && !call.signed; i++) yield wait(1);
  v.activity = `unloading ${packages} packages into the Rough Stores`;
  yield wait(1 + packages * 0.8);
  v.load = 0;
  P.atDoor.splice(P.atDoor.indexOf(call), 1);
  for (const c of load) {
    c.delivered = world.sim.now;
    c.per = railway ? `${v.carrier} van` : `${c.supplier.name}’s cart`;
    P.toCheck.push(c);
  }
  world.log(`${v.name[0].toUpperCase()}${v.name.slice(1)} delivered ${packages} package${packages > 1 ? 's' : ''} to the Rough Stores (${load.map((c) => `${c.supplier.name}, ${c.po.no}`).join('; ')}).`, { kind: 'stores' });
  v.activity = 'leaving the works';
  yield* walk(world, v, v.home, { mode: 'vehicle', speed: 260 });
  v.onSite = false;
  v.driver = null;
  v.activity = 'away';
  paper.put(sheet, railway ? 'railway' : 'suppliers', railway ? 'back to the goods office with the van' : 'taken back by the carman');
}

const OTHER_TRADERS = ['Smith & Son, Foleshill Road', 'A. Herbert, Butcher, Stoney Stanton Road', 'The Foleshill Co-operative Society', 'J. Cash Ltd., Kingfield', 'W. Payne, Ironmonger', 'Coventry Corporation Gas Department', 'H. Phillips, Draper'];
function otherTraders(rng) {
  return rng.shuffle([...OTHER_TRADERS]).slice(0, rng.int(2, 4)).map((consignee) => ({ consignee, packages: rng.int(1, 6) }));
}

// --- The Receiving Clerk ------------------------------------------------------------------------

export function* receivingClerk(world, p) {
  const P = world.purchasing;
  const paper = world.paper;
  for (;;) {
    yield* work(world, p, 0.01);
    const call = P.atDoor.find((c) => !c.signed);
    if (call) {
      yield* walk(world, p, call.node, { activity: `going out to ${call.vehicle.name}` });
      yield* work(world, p, 2 + call.packages * 0.2, `checking ${call.packages} packages off the ${call.sheet.fields.railway ? 'delivery sheet' : 'delivery note'}`);
      call.signed = world.sim.now;
      call.sheet.fields.signedBy = p.name;
      paper.mark(call.sheet, 'signed', `signed for by ${p.name}, receiving clerk`);
      yield* walk(world, p, p.spot, { activity: 'going back into the Stores' });
      continue;
    }
    const fresh = [...paper.container('receiving-file').docs].filter((x) => x.type === 'purchase-order' && !x.marks.some((m) => m.mark === 'noted'));
    if (fresh.length) {
      for (const copy of fresh) {
        const po = P.pos.find((o) => o.no === copy.no);
        yield* work(world, p, 0.5 * po.lines.length, `entering order ${po.no} on the stock control cards`);
        noteOrder(world, po);
      }
      continue;
    }
    const advices = [...paper.container('receiving-tray').docs].filter((x) => x.type === 'advice-note');
    if (advices.length) {
      for (const a of advices) {
        paper.hold(a, p);
        yield* work(world, p, 0.5, `noting ${a.fields.supplierName}’s advice of despatch`);
        paper.mark(a, 'noted', 'noted: goods expected');
        paper.put(a, 'receiving-file', 'filed with the order');
      }
      continue;
    }
    const c = P.toCheck.shift();
    if (c) {
      yield* receive(world, p, c);
      continue;
    }
    yield* work(world, p, 10, 'checking goods in the Rough Stores');
  }
}

function* receive(world, p, c) {
  const P = world.purchasing;
  const paper = world.paper;
  const po = c.po;
  const copy = po.docs.receiving;
  paper.hold(copy, p);
  yield* work(world, p, 3 + 2 * c.lines.length, `counting ${c.supplier.name}’s goods against order ${po.no}`);
  const no = `G.R. ${P.grNo++}`;
  const store = world.production.stores.get('rough');
  const inspector = world.people.find((q) => q.trade === 'Storekeeper');
  const grn = paper.create('goods-received-note', {
    no, supplier: c.supplier.id, supplierName: c.supplier.name, poNo: po.no, prNos: po.docs.top.fields.prs, date: world.sim.now,
    per: c.per, lines: c.lines.map((l) => ({ item: l.item, desc: l.desc, unit: l.unit, qty: l.qty, rejected: 0, price: l.price, per: l.per })),
    packages: c.packages, certified: p.name, inspected: inspector ? inspector.name : '', priced: false, invoiceNo: null,
  }, { by: p, no });
  for (const l of c.lines) {
    store.put(l.item, l.qty, world.sim.now, no);
    const card = P.cards.get(l.item);
    card.onOrder = Math.max(0, card.onOrder - l.qty);
    cardLine(world, card, { ref: no, received: l.qty });
  }
  po.grns.push(grn);
  po.state = 'received';
  po.entry.received = world.sim.now;
  paper.link(grn, po.docs.top);
  paper.enter('goods-received-book', { no, supplier: c.supplier.name, per: c.per, goods: c.lines.map((l) => goods(l.qty, l.unit, l.per, l.desc)).join('; '), poNo: po.no }, { from: grn, by: p });
  paper.mark(copy, 'received', `endorsed: received in full, ${no}`);
  paper.put(copy, 'receiving-done', 'filed: received');
  if (po.advice?.container?.id === 'receiving-file') paper.put(po.advice, 'receiving-done', 'filed with the order');
  const [top, duplicate] = grn.copies;
  top.destination = 'invoice-match';
  paper.put(top, 'stores-out', 'for the Works Accounts Office');
  paper.put(duplicate, 'gr-book', 'the carbon duplicate stays in the book');
  world.log(`${no}: ${c.supplier.name}’s goods for ${po.no} checked and taken into stock.`, { kind: 'stores' });
}

// --- The Works Accounts Office: matching invoices ----------------------------------------------------

export function* invoiceMatcher(world, p) {
  const P = world.purchasing;
  const paper = world.paper;
  for (;;) {
    const box = paper.container('invoice-match');
    const invoices = [...box.docs].filter((x) => x.type === 'supplier-invoice');
    let done = false;
    for (const inv of invoices) {
      const grns = [...box.docs].filter((x) => x.type === 'goods-received-note' && x.fields.poNo === inv.fields.poNo);
      if (!grns.length) continue;
      paper.hold(inv, p);
      for (const g of grns) paper.hold(g, p);
      yield* work(world, p, 4 + 1.5 * inv.fields.lines.length, `checking ${inv.fields.supplierName}’s invoice against ${grns.map((g) => g.no).join(', ')}`);
      const piNo = `P.I. ${P.piNo++}`;
      inv.fields.passedNo = piNo;
      inv.fields.grNos = grns.map((g) => g.no);
      paper.mark(inv, 'passed', `checked against ${grns.map((g) => g.no).join(', ')}: quantities, prices and extensions correct; passed and numbered ${piNo}`);
      for (const g of grns) {
        g.fields.priced = true;
        g.fields.invoiceNo = inv.fields.no;
        paper.mark(g, 'priced', `completed as to prices from the invoice; ${piNo}`);
        paper.link(g, inv);
      }
      for (const x of [inv, ...grns]) {
        x.destination = 'bought-tray';
        paper.put(x, 'works-out', 'for the Bought Ledger');
      }
      done = true;
      break;
    }
    if (!done) yield* work(world, p, 10, 'posting cost allocation sheets');
  }
}

// --- The Bought Ledger and paying the suppliers -------------------------------------------------------

// The third Wednesday of the month.
export function payDayOf(cal, t) {
  const { month } = cal.parts(t);
  let d = cal.at(1913, month, 1);
  while (cal.dow(d) !== 3) d += 1440;
  return d + 14 * 1440;
}

export function* boughtLedgerClerk(world, p) {
  const P = world.purchasing;
  const paper = world.paper;
  const cal = world.cal;
  const ledger = world.ledger;
  for (;;) {
    const tray = paper.container('bought-tray');
    const inv = [...tray.docs].find((x) => x.type === 'supplier-invoice' && x.marks.some((m) => m.mark === 'passed'));
    if (inv) {
      const grns = [...tray.docs].filter((x) => x.type === 'goods-received-note' && x.fields.poNo === inv.fields.poNo);
      paper.hold(inv, p);
      yield* work(world, p, 3, `entering ${inv.fields.supplierName}’s invoice in the Bought Day Book`);
      const f = inv.fields;
      const s = P.supplierById.get(f.supplier);
      ledger.post(world.sim.now, `Goods, ${f.passedNo} (their No. ${f.no})`, [['purchases', f.total, 0], [s.account, 0, f.total]], { ref: inv.id });
      paper.enter('bought-day-book', { piNo: f.passedNo, supplier: s.name, invNo: f.no, poNo: f.poNo, total: f.total }, { from: inv, by: p });
      paper.mark(inv, 'posted', 'posted to the Bought Ledger');
      paper.put(inv, 'bought-files', 'filed under the supplier');
      for (const g of grns) paper.put(g, 'bought-files', 'filed with the invoice');
      continue;
    }
    const other = [...tray.docs].find((x) => x.type !== 'supplier-invoice' && x.type !== 'goods-received-note');
    if (other) {
      paper.hold(other, p);
      if (other.type === 'supplier-statement' || other.type === 'railway-account') {
        yield* work(world, p, 3, `checking ${other.fields.fromName}’s statement against the Bought Ledger`);
        const monthStart = cal.dayStart(other.fields.date + 1440);
        const ours = -ledger.account(other.fields.from).lines.filter((l) => l.t < monthStart).reduce((x, l) => x + l.debit - l.credit, 0);
        paper.mark(other, ours === other.fields.balance ? 'agreed' : 'queried', ours === other.fields.balance ? 'agreed with the Bought Ledger' : `does not agree with the Bought Ledger (${fmt(ours)})`);
      } else {
        yield* work(world, p, 0.5, 'filing a receipt');
      }
      paper.put(other, 'bought-files', 'filed');
      continue;
    }
    // On the Monday before pay day, the list of payments.
    const now = world.sim.now;
    const pay = payDayOf(cal, now);
    const today = cal.dayStart(now);
    if (today >= pay - 2 * 1440 && today < pay && cal.minuteOfDay(now) >= 10 * 60 && !P.runs.some((r) => r.payDay === pay)) {
      yield* paymentsList(world, p, pay);
      continue;
    }
    yield* work(world, p, 10, 'posting the Bought Ledger');
  }
}

function* paymentsList(world, p, pay) {
  const P = world.purchasing;
  const ledger = world.ledger;
  const cal = world.cal;
  const monthStart = cal.at(1913, cal.parts(pay).month, 1);
  const rows = [];
  const due = (code) => {
    const a = ledger.account(code);
    const credits = a.lines.filter((l) => l.t < monthStart).reduce((x, l) => x + l.credit, 0);
    const debits = a.lines.reduce((x, l) => x + l.debit, 0);
    return credits - debits;
  };
  for (const s of P.suppliers) {
    const gross = due(s.account);
    if (gross <= 0) continue;
    const discount = Math.round(gross * DISCOUNT / 2) * 2;
    rows.push({ code: s.account, name: s.name, address: s.address, gross, discount, net: gross - discount });
  }
  const rail = due('lnwr');
  if (rail > 0) rows.push({ code: 'lnwr', name: 'London and North Western Railway Co.', address: 'Warwick Road, Coventry', gross: rail, discount: 0, net: rail });
  yield* work(world, p, 4 + rows.length, 'making out the list of payments');
  const list = world.paper.create('payments-list', {
    date: world.sim.now, payDay: pay, month: cal.parts(monthStart - 1440).month, rows,
    total: rows.reduce((a, r) => a + r.net, 0), discount: rows.reduce((a, r) => a + r.discount, 0),
  }, { by: p });
  const run = { payDay: pay, list, cheques: [], rows };
  P.runs.push(run);
  yield* walk(world, p, 'secretary-desk', { activity: 'taking the list of payments to the Secretary' });
  world.paper.put(list, 'secretary-tray', 'for the Secretary to check against the statements');
  yield* walk(world, p, p.spot, { activity: 'going back to the General Office' });
  world.log(`The list of payments for ${cal.docDate(pay)}: ${rows.length} accounts (${fmt(run.list.fields.total)}).`, { kind: 'accounts' });
}

// The Secretary checks the list and takes it to the Managing Director on
// pay day; then it goes to the Cashier. Returns true if he did something.
export function* secretaryPayments(world, p) {
  const P = world.purchasing;
  if (!P) return false;
  const paper = world.paper;
  const cal = world.cal;
  const list = [...paper.container('secretary-tray').docs].find((x) => x.type === 'payments-list');
  if (list && !list.marks.some((m) => m.mark === 'checked')) {
    paper.hold(list, p);
    yield* work(world, p, 6, 'checking the list of payments against the creditors’ statements');
    paper.mark(list, 'checked', 'checked against the creditors’ statements by the Secretary');
    paper.put(list, 'secretary-tray', false);
    return true;
  }
  const run = P.runs.find((r) => !r.sanctioned && r.list.marks.some((m) => m.mark === 'checked'));
  if (run && cal.dayStart(world.sim.now) >= run.payDay && cal.minuteOfDay(world.sim.now) >= 9 * 60 + 40) {
    paper.hold(run.list, p);
    yield* walk(world, p, 'md-desk', { activity: 'taking the list of payments to the Managing Director' });
    yield* work(world, p, 6, 'going through the list of payments with the Managing Director');
    run.sanctioned = world.sim.now;
    paper.mark(run.list, 'sanctioned', 'sanctioned by the Managing Director');
    yield* walk(world, p, 'cashier-desk', { activity: 'giving the list of payments to the Cashier' });
    paper.put(run.list, 'cashier', 'for the Cashier to draw the cheques');
    yield* walk(world, p, p.spot, { activity: 'going back upstairs' });
    return true;
  }
  return false;
}

// The Cashier draws a combined cheque and receipt for each account, has
// them signed, and puts them in the evening post. Returns true if he did
// something.
export function* cashierPayments(world, p) {
  const P = world.purchasing;
  if (!P) return false;
  const run = P.runs.find((r) => r.sanctioned && !r.paid);
  if (!run) return false;
  const paper = world.paper;
  const ledger = world.ledger;
  run.paid = world.sim.now;
  paper.hold(run.list, p);
  const sec = world.people.find((q) => q.title === 'Secretary and Accountant');
  const md = world.people.find((q) => q.title === 'Managing Director');
  for (const r of run.rows) {
    yield* work(world, p, 3, `writing the cheque and receipt for ${r.name}`);
    const ch = paper.create('cheque-receipt', {
      payee: r.name, address: r.address, gross: r.gross, discount: r.discount, amount: r.net, date: world.sim.now,
      month: run.list.fields.month, signatories: [`${md?.name || 'Charles Hartwell'}, Director`, `${sec?.name || 'the Secretary'}, Secretary`], stamp: r.net >= lsd(2),
    }, { by: p });
    const lines = [[r.code, r.gross, 0], ['bank', 0, r.net]];
    if (r.discount) lines.push(['discounts-received', 0, r.discount]);
    ledger.post(world.sim.now, r.discount ? 'By cheque and discount' : 'By cheque', lines, { ref: ch.id });
    paper.enter('cash-book-payments', { to: r.name, amount: r.net, discount: r.discount }, { from: ch, by: p });
    paper.link(ch, run.list);
    run.cheques.push(ch);
  }
  yield* walk(world, p, 'md-desk', { activity: 'taking the cheques up to be signed' });
  yield* work(world, p, run.cheques.length * 0.4, 'the Managing Director signing the cheques');
  yield* walk(world, p, 'secretary-desk', { activity: 'taking the cheques to the Secretary to sign' });
  yield* work(world, p, run.cheques.length * 0.4, 'the Secretary countersigning the cheques');
  for (const ch of run.cheques) {
    paper.mark(ch, 'signed', 'signed by a director and the Secretary');
    paper.put(ch, 'out-post', 'for the evening post, with an addressed envelope');
  }
  paper.mark(run.list, 'paid', 'cheques drawn and posted');
  paper.put(run.list, 'files', 'filed');
  yield* walk(world, p, p.spot, { activity: 'going back to the Cashier’s office' });
  world.log(`The Cashier sent ${run.cheques.length} cheques (${fmt(run.list.fields.total)}) to the suppliers and the railway.`, { kind: 'accounts' });
  // The receipts come back signed in two or three days.
  for (const ch of run.cheques) {
    const back = workingDay(world.cal, world.sim.now, P.rng.int(2, 3)) + 4 * 60;
    world.sim.schedule(back, () => {
      paper.mark(ch, 'receipted', `receipt signed${ch.fields.stamp ? ' over a penny stamp' : ''} and returned by ${ch.fields.payee}; the cheque kept by them`);
      ch.fields.delivery = 'morning';
      ch.fields.received = null;
      paper.put(ch, 'post-office', false);
    });
  }
  return true;
}

export function purchasingSummary(world) {
  const P = world.purchasing;
  if (!P) return null;
  return {
    onOrder: P.pos.filter((o) => o.state !== 'received').length,
    toMatch: world.paper.container('invoice-match').docs.size,
  };
}
