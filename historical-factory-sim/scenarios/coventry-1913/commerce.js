// The commercial side: post, orders, despatch, invoices, the ledgers and the bank.
//
// The routine follows Elbourne (1914) and Spencer (1907):
//   - Orders are checked "as to the credit status of the firm", acknowledged
//     the same day by postcard, and typed as an Office Order "so that six
//     copies may be obtained at one typing": Invoice Clerk, Estimator and
//     Works Accountant, Works Manager, Drawing Office, Works Office,
//     Warehouse.
//   - The Warehouse makes an Advice of Despatch; "the quickest way is to make
//     the invoice out in blank as a carbon copy of the advice".
//   - Invoices go into the Sales Day Book and the Sales Ledger; every
//     customer gets a monthly statement, "a silent demand for payment".
// Railway practice follows West, The Railway Goods Station (1912): outward
// goods arrive at the goods yard in the afternoon and evening for the night
// trains, marked "Paid" (carriage paid) or "To pay".
import { until, wait } from '../../engine/sim/kernel.js';
import { walk, work } from '../../engine/sim/world.js';
import { Ledger } from '../../engine/sim/ledger.js';
import { d, lsd, fmt } from '../../engine/sim/money.js';
import { makeAgents, orderLines, listPrice, orderLetterBody } from './outside.js';
import { PROGRAMME_CYCLE, FRAME_SIZES } from './catalogue.js';

const OPENING_STOCK = 450; // machines in the Stock Room on 1 March (est.)
const CARRIAGE_PER_CRATE = d(30); // est.: no 1913 rate for crated cycles was found
const CRATE_WEIGHT = 84; // lb., a crated machine (est.)
const LORRY_LOAD = 14; // crates on a pair-horse lorry (est.)

const money = (c) => ({ h: c[0], f: c[1], money: true });
const col = (h, f, opts = {}) => ({ h, f, ...opts });

export function setupCommerce(world, production) {
  const rng = world.rng.fork('commerce');
  const paper = world.paper;
  const cal = world.cal;
  const agents = makeAgents(rng);
  const ledger = new Ledger();
  world.ledger = ledger;

  ledger.open('sales', 'Sales', { type: 'income' });
  ledger.open('debtors', 'Sundry Debtors (Sales Ledger)', { type: 'asset' });
  ledger.open('bank', 'Lloyds Bank Ltd., Current Account', { type: 'asset' });
  ledger.open('cheques', 'Cheques in Hand', { type: 'asset' });
  ledger.open('petty', 'Petty Cash', { type: 'asset' });
  ledger.open('discounts', 'Discounts Allowed', { type: 'expense' });
  ledger.open('carriage', 'Carriage Outwards', { type: 'expense' });
  ledger.open('lnwr', 'London and North Western Railway Co.', { type: 'liability' });
  ledger.open('wages', 'Wages', { type: 'expense' });
  ledger.open('ni', 'National Insurance (employer’s share)', { type: 'expense' });
  ledger.open('opening', 'Balances brought forward, 1st March 1913', { type: 'equity' });
  for (const a of agents) ledger.open(a.id, a.name, { type: 'asset', control: 'debtors', meta: a });

  // Opening balances: the bank, the petty cash, and what agents owe for
  // February's machines, for which statements went out on 1st March.
  const t0 = world.sim.now;
  const march1 = cal.at(1913, 3, 1);
  ledger.post(t0, 'Balance at bank brought forward', [['bank', lsd(2850), 0], ['opening', 0, lsd(2850)]]);
  ledger.post(t0, 'Petty cash in hand', [['petty', lsd(25), 0], ['opening', 0, lsd(25)]]);
  for (const a of agents) {
    // February's machines at about £4 18s. each, net of discount (est.).
    const owed = Math.round(a.size * rng.uniform(1.5, 4.5)) * Math.round(lsd(4, 18) * (1 - a.discount) / (3 / 4));
    a.statementDay = march1;
    a.statementBalance = owed;
    ledger.post(t0, 'To account rendered', [[a.id, owed, 0], ['opening', 0, owed]]);
    a.paysOn = schedulePayment(rng, a, march1);
  }

  for (const [id, name, node, kind = 'tray'] of [
    ['post-bag', 'the locked post bag', null, 'away'],
    ['post-office', 'the Head Post Office, Coventry', null, 'away'],
    ['secretary-tray', "the Secretary's tray", 'secretary-desk'],
    ['order-tray', "the order clerk's tray", 'order-clerk'],
    ['orders-open', 'the file of open orders', 'order-clerk', 'file'],
    ['office-out', "the General Office's out-tray", 'office-boys'],
    ['works-manager-tray', "the Works Manager's tray", 'works-manager'],
    ['warehouse-tray', "the warehouse foreman's file of orders to fill", 'box-warehouse', 'file'],
    ['despatch-tray', "the despatch clerk's tray", 'despatch-clerk'],
    ['despatch-out', "the despatch clerk's out-tray, for the General Office", 'despatch-clerk'],
    ['despatch-files', "the despatch clerk's files", 'despatch-clerk', 'file'],
    ['dock', 'the despatch dock', 'DOCK'],
    ['invoice-tray', "the invoice clerk's tray", 'order-clerk'],
    ['ledger-tray', "the sales ledger clerk's tray", 'sales-ledger'],
    ['out-post', 'the letters for the post', 'office-boys'],
    ['counter', 'the enquiry counter', 'enquiry'],
    ['files', 'the General Office files', 'chief-clerk', 'file'],
    ['railway', 'the L. & N.W.R. goods office, Warwick Road', null, 'away'],
    ['customers', 'with the customer', null, 'away'],
  ]) paper.addContainer({ id, name, node, kind });

  const date = (e, { cal: c }) => c.shortDate(e.t);
  for (const [id, title, node, columns] of [
    ['correspondence-register', 'Inwards Correspondence Register', 'secretary-desk', [
      col('No.', (e) => e.no, { num: true }), col('Date', date), col('From', (e) => e.from), col('Subject', (e) => e.subject), col('Passed to', (e) => e.passedTo)]],
    ['order-book', 'Orders Received Book', 'order-clerk', [
      col('Order', (e) => e.no), col('Date', date), col('Customer', (e) => e.agent), col('Town', (e) => e.town), col('Machines', (e) => e.qty, { num: true }), col('Letter', (e) => e.letterNo, { num: true }), col('Despatched', (e, c) => (e.despatched ? c.cal.shortDate(e.despatched) : ''))]],
    ['despatch-book', 'Despatch Book', 'despatch-clerk', [
      col('Date', date), col('Order', (e) => e.orderNo), col('Consignee', (e) => e.consignee), col('Station', (e) => e.station), col('Crates', (e) => e.crates, { num: true }), col('Carriage', (e) => e.carriage), col('Note', (e) => e.consignmentNo, { num: true })]],
    ['sales-day-book', 'Sales Day Book', 'order-clerk', [
      col('Date', date), col('Invoice', (e) => e.no, { num: true }), col('Customer', (e) => e.agent), col('Order', (e) => e.orderNo), money(['Amount', (e) => e.total])]],
    ['cash-book', 'Cash Book (receipts side)', 'cashier-desk', [
      col('Date', date), col('Received from', (e) => e.from), money(['Discount', (e) => e.discount]), money(['Cash', (e) => e.amount]), money(['Bank', (e) => e.banked])]],
  ]) paper.addBook({ id, title, node, columns });

  const C = {
    agents,
    agentsById: new Map(agents.map((a) => [a.id, a])),
    rng,
    orderNo: 1041, // the A series, sales orders (Elbourne's lettering)
    letterNo: 2210,
    invoiceNo: 5512,
    consignmentNo: 880,
    despatches: [],
    orders: [],
    toPayIn: [],
    crates: 90,
    weekDespatched: 0,
    weekly: [],
    lorries: [],
    statementsMonth: cal.parts(t0).month, // this month's went out on the 1st
  };
  world.commerce = C;

  // Note who packed each consignment, for the packing slip.
  const onTake = production.onTake;
  production.onTake = (p, lot, step, ...rest) => {
    onTake?.(p, lot, step, ...rest);
    if (lot.kind === 'despatch' && step.crate) lot.packer = p.name;
  };

  // The Stock Room on 1 March: machines made over the winter, numbered
  // before this season's batches.
  const works = world.works;
  let n = works.nextFrame - OPENING_STOCK;
  while (n < works.nextFrame) {
    const [model, pattern, q] = rng.weighted(PROGRAMME_CYCLE.map((e) => [e, e[2]]));
    const k = Math.min(Math.ceil(q / 4), works.nextFrame - n);
    for (let i = 0; i < k; i++, n++) {
      const m = { frameNo: n, model, pattern, frameSize: rng.weighted(FRAME_SIZES[pattern]), batch: 'stock', finished: t0 - rng.int(7, 60) * 1440 };
      works.register.push(m);
      works.finishedStock.push(m);
    }
  }
  return C;
}

function schedulePayment(rng, agent, statementDay) {
  const days = { good: rng.uniform(4, 9), fair: rng.uniform(11, 20), slow: rng.uniform(24, 40) }[agent.standing];
  return statementDay + Math.round(days) * 1440 + 6 * 60;
}

// An account is overdue once a slow payer's statement has gone three weeks
// without a cheque.
export function overdue(world, agent) {
  return agent.paysOn !== null && agent.statementBalance > 0 && world.sim.now - agent.statementDay > 21 * 1440 && world.ledger.balance(agent.id) > 0;
}

// --- The Post Office: letters in and out ---------------------------------------

// Each night the letters agents posted that day reach the Head Post Office
// for the morning bag; a second delivery comes by the postman after dinner.
export function* postOffice(world) {
  const C = world.commerce;
  const paper = world.paper;
  const cal = world.cal;
  const rng = C.rng;
  for (;;) {
    const day = cal.dayStart(world.sim.now) + 1440;
    yield until(day + 4 * 60);
    if (cal.dow(day) === 0) continue;
    // Orders: about 115 a week in the spring, for about 245 machines (est.).
    const n = poisson(rng, 19);
    const posted = (letter) => {
      letter.history.length = 0;
      paper.note(letter, `written and posted by ${letter.fields.fromName}, ${letter.fields.address.split(', ').at(-1)}`);
      letter.history[0].t = letter.fields.written;
    };
    for (let i = 0; i < n; i++) {
      const agent = rng.pick(C.agents);
      const lines = orderLines(rng, agent);
      posted(paper.create('letter', {
        kind: 'order', from: agent.id, fromName: agent.name, address: agent.address, trade: agent.trade,
        written: day - 1440 + rng.int(9, 18) * 60, lines, body: orderLetterBody(rng, agent, lines),
        delivery: rng.chance(0.65) ? 'morning' : 'afternoon', received: null,
      }, { at: 'post-office' }));
    }
    // Remittances from agents whose day has come.
    for (const a of C.agents) {
      if (a.paysOn && a.paysOn <= day + 12 * 60) {
        const bal = world.ledger.balance(a.id);
        const owing = Math.min(bal, a.statementBalance);
        a.paysOn = null;
        if (owing <= 0) continue;
        const prompt = cal.parts(day).day <= 10;
        const discount = prompt ? Math.round(owing * 0.025 / 2) * 2 : 0;
        posted(paper.create('letter', {
          kind: 'remittance', from: a.id, fromName: a.name, address: a.address, trade: a.trade, written: day - 1440 + 10 * 60,
          amount: owing - discount, discount, balance: owing, received: null,
          bank: rng.pick(['London City & Midland Bank', 'Lloyds Bank', 'Barclay & Co.', 'Capital & Counties Bank', 'National Provincial Bank of England']),
          delivery: rng.chance(0.7) ? 'morning' : 'afternoon',
        }, { at: 'post-office' }));
      }
    }
    // The afternoon delivery: the postman brings it to the enquiry counter.
    world.sim.schedule(day + 14 * 60, () => {
      for (const l of [...paper.container('post-office').docs]) {
        if (l.type === 'letter' && l.fields.delivery === 'afternoon' && l.created <= day + 14 * 60) paper.put(l, 'counter', 'delivered by the postman to the enquiry counter');
      }
    });
  }
}

function poisson(rng, mean) {
  let n = 0;
  let p = Math.exp(-mean);
  let s = p;
  const u = rng.next();
  while (u > s && n < 200) {
    n++;
    p *= mean / n;
    s += p;
  }
  return n;
}

// Take what someone holds to where each piece is going.
function* distribute(world, p, docs, fallback) {
  const paper = world.paper;
  const byDest = new Map();
  for (const dd of docs) {
    const dest = dd.destination || fallback;
    if (!byDest.has(dest)) byDest.set(dest, []);
    byDest.get(dest).push(dd);
  }
  for (const [dest, list] of byDest) {
    const c = paper.container(dest);
    if (c.node) yield* walk(world, p, c.node, { activity: `taking papers to ${c.name}` });
    // What the Works Manager has read goes to the Works Office file.
    if (dest === 'works-manager-tray') for (const dd of [...c.docs]) paper.put(dd, 'works-office', 'read by the Works Manager; filed in the Works Office');
    for (const dd of list) {
      dd.destination = null;
      paper.put(dd, dest);
    }
  }
}

// The second office boy fetches the locked bag from the Head Post Office
// first thing, carries papers between the General Office, the Works Office
// and the warehouse, and takes the day's letters to the post in the evening.
export function* postBoy(world, p) {
  const paper = world.paper;
  const cal = world.cal;
  for (;;) {
    yield* work(world, p, 0.01);
    const now = world.sim.now;
    const mod = cal.minuteOfDay(now);
    const today = cal.dayStart(now);
    if (p.fetched !== today && mod >= 9 * 60) {
      p.fetched = today;
      yield* walk(world, p, 'S_OF', { activity: 'going to the Head Post Office for the post bag' });
      yield* walk(world, p, 'HOME_S', { activity: 'going to the Head Post Office for the post bag' });
      p.onSite = false;
      p.activity = 'at the Head Post Office collecting the bag';
      yield wait(8);
      p.onSite = true;
      for (const l of [...paper.container('post-office').docs]) if (l.fields.delivery === 'morning' || l.created < today - 6 * 60) paper.hold(l, p);
      yield* walk(world, p, 'S_OF', { activity: 'bringing back the locked post bag' });
      if (paper.container('counter').docs.size) {
        yield* walk(world, p, 'enquiry', { activity: 'picking up the letters left at the counter' });
        paper.collect('counter', p);
      }
      yield* walk(world, p, 'secretary-desk', { activity: 'taking the post bag to the Secretary' });
      const got = paper.deliver(p, 'secretary-tray');
      world.log(`The morning post: ${got.length} letters in the bag.`, { kind: 'commerce' });
      yield* walk(world, p, p.spot, { activity: 'going back to the office bench' });
      continue;
    }
    // The afternoon delivery goes up to the Secretary too.
    if (paper.container('counter').docs.size && mod >= 14 * 60) {
      paper.collect('counter', p);
      yield* walk(world, p, 'secretary-desk', { activity: 'taking the afternoon post to the Secretary' });
      paper.deliver(p, 'secretary-tray');
      yield* walk(world, p, p.spot, { activity: 'going back to the office bench' });
      continue;
    }
    // Copies of office orders for the works.
    const out = paper.container('office-out');
    if (out.docs.size) {
      const docs = paper.collect('office-out', p);
      yield* distribute(world, p, docs, 'files');
      // On the way back, anything waiting in the despatch clerk's out-tray.
      const back = paper.container('despatch-out');
      if (back.docs.size) {
        yield* walk(world, p, 'despatch-clerk', { activity: "calling at the despatch clerk's desk" });
        yield* distribute(world, p, paper.collect('despatch-out', p), 'files');
      }
      yield* walk(world, p, p.spot, { activity: 'going back to the office bench' });
      continue;
    }
    // Rounds to the warehouse at eleven, three and five for advices of despatch.
    const round = [11 * 60, 15 * 60, 17 * 60].find((t) => mod >= t && mod < t + 60 && p.round !== today + t);
    if (round !== undefined) {
      p.round = today + round;
      if (paper.container('despatch-out').docs.size) {
        yield* walk(world, p, 'despatch-clerk', { activity: 'going to the warehouse for the advices of despatch' });
        yield* distribute(world, p, paper.collect('despatch-out', p), 'files');
        yield* walk(world, p, p.spot, { activity: 'going back to the office bench' });
      }
      continue;
    }
    // The evening post.
    if (mod >= 17 * 60 + 45 && p.posted !== today) {
      p.posted = today;
      const letters = paper.collect('out-post', p);
      if (letters.length) {
        yield* walk(world, p, 'S_OF', { activity: `taking ${letters.length} letters to the post` });
        yield* walk(world, p, 'HOME_S', { activity: `taking ${letters.length} letters to the post` });
        for (const l of letters) paper.put(l, 'customers', 'posted');
        p.onSite = false;
        yield wait(5);
        p.onSite = true;
        yield* walk(world, p, 'S_OF', { activity: 'coming back from the post' });
        yield* walk(world, p, p.spot, { activity: 'coming back from the post' });
        world.log(`${letters.length} letters, invoices and postcards went to the evening post.`, { kind: 'commerce' });
      }
      continue;
    }
    yield* work(world, p, 5, 'waiting on the office bench');
  }
}

// --- The Secretary opens the post -------------------------------------------------

export function* secretary(world, p) {
  const paper = world.paper;
  const C = world.commerce;
  for (;;) {
    const letter = [...paper.container('secretary-tray').docs][0];
    if (!letter) {
      yield* work(world, p, 10, 'going through the correspondence');
      continue;
    }
    paper.hold(letter, p);
    yield* work(world, p, 1.2, `opening the post: a letter from ${letter.fields.fromName}`);
    const no = C.letterNo++;
    letter.no = no;
    letter.fields.received = world.sim.now;
    paper.mark(letter, 'received', `stamped received and numbered ${no}`);
    const remittance = letter.fields.kind === 'remittance';
    paper.enter('correspondence-register', {
      no, from: letter.fields.fromName, subject: remittance ? `Remittance, ${fmt(letter.fields.amount)}` : 'Order', passedTo: remittance ? 'Cashier' : 'Order Dept.',
    }, { from: letter, by: p });
    if (remittance) {
      yield* work(world, p, 0.5);
      paper.put(letter, 'cashier', 'passed to the Cashier with the cheque');
    } else {
      paper.put(letter, 'order-tray', 'passed to the order clerk');
    }
  }
}

// --- The order clerk: credit, acknowledgement, the Office Order, invoices ---------------

const ORDER_COPIES = [
  ['orders-open', 'Invoice Clerk'],
  ['works-manager-tray', 'Estimator and Works Accountant'],
  ['works-manager-tray', 'Works Manager'],
  ['works-office', 'Drawing Office'],
  ['works-office', 'Works Office'],
  ['warehouse-tray', 'Warehouse'],
];

export function* orderClerk(world, p) {
  const paper = world.paper;
  const C = world.commerce;
  for (;;) {
    // Invoices first: the office copy of an advice of despatch comes back
    // and the invoice is typed in the same terms.
    const advice = [...paper.container('invoice-tray').docs].find((x) => x.type === 'advice-of-despatch');
    if (advice) {
      paper.hold(advice, p);
      yield* work(world, p, 6, `typing the invoice for ${advice.fields.agentName}`);
      writeInvoice(world, p, advice);
      continue;
    }
    const letter = [...paper.container('order-tray').docs][0];
    if (!letter) {
      yield* work(world, p, 10, 'filing copies of orders');
      continue;
    }
    paper.hold(letter, p);
    const agent = C.agentsById.get(letter.fields.from);
    yield* work(world, p, 2, `looking up ${agent.name}'s account in the Sales Ledger`);
    const hold = overdue(world, agent);
    const no = `A.${C.orderNo++}`;
    yield* work(world, p, 8, `typing Office Order ${no} for ${agent.name}`);
    const lines = letter.fields.lines.map((l) => ({ ...l, list: listPrice(l.model, l.pattern) }));
    const order = paper.create('office-order', {
      no, agent: agent.id, agentName: agent.name, address: agent.address, station: agent.station, letterNo: letter.no,
      lines, discount: agent.discount, carriage: agent.carriage, date: world.sim.now, hold,
      instructions: hold ? 'HOLD: account overdue; not to be despatched until settled' : agent.soleAgency ? `Sole agents for ${agent.town}` : '',
    }, { by: p, no });
    order.copies.forEach((c, i) => {
      if (i === 0) paper.put(c, 'orders-open', 'filed with the open orders');
      else {
        c.destination = ORDER_COPIES[i][0];
        paper.put(c, 'office-out', `for the ${ORDER_COPIES[i][1]}`);
      }
    });
    const qty = lines.reduce((a, l) => a + l.qty, 0);
    const entry = paper.enter('order-book', { no, agent: agent.name, town: agent.town, qty, letterNo: letter.no, despatched: null }, { from: order, by: p });
    C.orders.push({ no, agent, order, lines, qty, received: world.sim.now, despatched: null, entry, hold });
    agent.orders++;
    yield* work(world, p, 2, `writing the acknowledgement postcard to ${agent.name}`);
    const card = paper.create('postcard', { to: agent.name, address: agent.address, orderNo: no, theirDate: letter.fields.written, date: world.sim.now }, { by: p });
    paper.put(card, 'out-post', 'for the evening post');
    paper.put(letter, 'files', 'filed with the order');
    world.log(`Order ${no} from ${agent.name}, ${agent.town}: ${qty} machine${qty > 1 ? 's' : ''}.${hold ? ' Held: the account is overdue.' : ''}`, { kind: 'commerce' });
  }
}

function writeInvoice(world, p, advice) {
  const paper = world.paper;
  const C = world.commerce;
  const f = advice.fields;
  const agent = C.agentsById.get(f.agent);
  const no = C.invoiceNo++;
  const lines = f.lines.map((l) => ({ ...l, gross: l.list * l.qty }));
  const gross = lines.reduce((a, l) => a + l.gross, 0);
  const discount = Math.round(gross * agent.discount / 2) * 2;
  const total = gross - discount;
  const invoice = paper.create('invoice', {
    no, date: world.sim.now, orderNo: f.orderNo, agent: agent.id, agentName: agent.name, address: agent.address,
    lines, gross, discountRate: agent.discount, discount, total, carriage: f.carriage, consignmentNo: f.consignmentNo, station: agent.station,
  }, { by: p, no });
  paper.put(invoice.copies[0], 'out-post', 'for the evening post');
  paper.put(invoice.copies[1], 'ledger-tray', 'for posting to the Sales Ledger');
  paper.enter('sales-day-book', { no, agent: agent.name, orderNo: f.orderNo, total }, { from: invoice, by: p });
  paper.put(advice, 'files', 'filed with the invoice');
  for (const x of [...paper.container('invoice-tray').docs]) {
    if (x.type === 'packing-slip' && x.fields.orderNo === f.orderNo) paper.put(x, 'files', 'filed with the invoice');
  }
  const order = C.orders.find((o) => o.no === f.orderNo);
  if (order) (order.invoices ||= []).push(invoice);
  const part = order?.parts?.find((x) => x.consignmentNo === f.consignmentNo);
  if (part) part.invoice = invoice;
  const open = [...paper.container('orders-open').docs].find((dd) => dd.fields.no === f.orderNo);
  if (open && order?.despatched) paper.put(open, 'files', 'invoiced in full; filed');
  world.log(`Invoice No. ${no} to ${agent.name}: ${fmt(total)} (list ${fmt(gross)} less ${Math.round(agent.discount * 100)}%).`, { kind: 'commerce' });
}

// The sales ledger clerk posts the invoice carbons to the customers'
// accounts and, at the beginning of each month, writes the statements.
export function* salesLedgerClerk(world, p) {
  const paper = world.paper;
  const C = world.commerce;
  const cal = world.cal;
  for (;;) {
    const inv = [...paper.container('ledger-tray').docs][0];
    if (inv) {
      paper.hold(inv, p);
      const f = inv.fields;
      yield* work(world, p, 2, `posting invoice ${f.no} to ${f.agentName}'s account`);
      world.ledger.post(world.sim.now, `Goods, invoice ${f.no}`, [[f.agent, f.total, 0], ['sales', 0, f.total]], { ref: inv.id });
      paper.mark(inv, 'posted', 'posted to the Sales Ledger');
      paper.put(inv, 'files', false);
      continue;
    }
    const today = cal.dayStart(world.sim.now);
    const { month, day } = cal.parts(today);
    if (day <= 7 && C.statementsMonth !== month) {
      C.statementsMonth = month;
      let n = 0;
      for (const a of C.agents) {
        const bal = world.ledger.balance(a.id);
        if (bal <= 0) continue;
        yield* work(world, p, 3, `writing the monthly statement for ${a.name}`);
        const since = a.statementDay;
        const recent = world.ledger.account(a.id).lines.filter((l) => l.t > since);
        const brought = bal - recent.reduce((x, l) => x + l.debit - l.credit, 0);
        const lines = [];
        if (brought) lines.push({ t: since, narrative: 'To account rendered', debit: brought > 0 ? brought : 0, credit: brought < 0 ? -brought : 0 });
        for (const l of recent) lines.push({ t: l.t, narrative: l.narrative, debit: l.debit, credit: l.credit });
        const st = paper.create('statement', { agent: a.id, agentName: a.name, address: a.address, date: world.sim.now, balance: bal, lines }, { by: p });
        paper.put(st, 'out-post', 'for the post');
        a.statementDay = world.sim.now;
        a.statementBalance = bal;
        a.paysOn = schedulePayment(C.rng, a, today);
        n++;
      }
      world.log(`${n} monthly statements written for the post.`, { kind: 'commerce' });
      continue;
    }
    yield* work(world, p, 15, 'checking the ledger balances');
  }
}

// --- The Cashier: remittances, paying in, petty cash ------------------------------------

export function* receiveRemittances(world, p) {
  const paper = world.paper;
  const C = world.commerce;
  const letters = [...paper.container('cashier').docs].filter((dd) => dd.type === 'letter' && dd.fields.kind === 'remittance');
  for (const l of letters) {
    paper.hold(l, p);
    yield* work(world, p, 3, `entering ${l.fields.fromName}'s cheque in the Cash Book`);
    const a = C.agentsById.get(l.fields.from);
    const f = l.fields;
    const lines = [['cheques', f.amount, 0], [a.id, 0, f.amount + f.discount]];
    if (f.discount) lines.push(['discounts', f.discount, 0]);
    world.ledger.post(world.sim.now, f.discount ? 'By cheque and discount' : 'By cheque', lines, { ref: l.id });
    const entry = paper.enter('cash-book', { from: a.name, amount: f.amount, discount: f.discount, banked: 0 }, { from: l, by: p });
    paper.mark(l, 'entered', 'entered in the Cash Book');
    C.toPayIn.push({ from: a.name, amount: f.amount, bank: f.bank, entry });
    const receipt = paper.create('receipt', { to: a.name, address: a.address, amount: f.amount, discount: f.discount, date: world.sim.now, stamp: f.amount >= lsd(2), cashier: p.name }, { by: p });
    paper.put(receipt, 'out-post', 'receipt for the post');
    paper.put(l, 'files', 'filed');
    // Orders held for this account can go now.
    for (const o of C.orders) {
      if (o.agent !== a || !o.order.fields.hold) continue;
      o.order.fields.hold = false;
      o.order.fields.instructions = 'Hold released: account settled';
      for (const c of o.order.copies) paper.note(c, 'hold released: the account is settled');
      world.log(`${a.name} have paid; order ${o.no} is released to the warehouse.`, { kind: 'commerce' });
    }
  }
  return letters.length;
}

// The day's cheques go to Lloyds Bank before noon, with a cheque to cash for
// petty cash when it runs low.
export function* bankTrip(world, p) {
  const C = world.commerce;
  const ledger = world.ledger;
  const items = C.toPayIn;
  const pettyLow = ledger.balance('petty') < lsd(10);
  if (!items.length && !pettyLow) return;
  C.toPayIn = [];
  const total = items.reduce((a, i) => a + i.amount, 0);
  const slip = items.length ? world.paper.create('paying-in-slip', { date: world.sim.now, items, total }, { by: p }) : null;
  yield* walk(world, p, 'S_OF', { activity: 'taking the cheques to Lloyds Bank' });
  yield* walk(world, p, 'HOME_S', { activity: 'taking the cheques to Lloyds Bank' });
  p.onSite = false;
  p.activity = `at Lloyds Bank${total ? ` paying in ${fmt(total)}` : ''}`;
  yield wait(12);
  p.onSite = true;
  if (slip) {
    ledger.post(world.sim.now, 'Paid into Lloyds Bank', [['bank', total, 0], ['cheques', 0, total]], { ref: slip.id });
    for (const i of items) i.entry.banked = i.amount;
    world.paper.mark(slip, 'received', "the counterfoil stamped and initialled by the bank's cashier");
    world.log(`The Cashier paid ${items.length} cheque${items.length > 1 ? 's' : ''}, ${fmt(total)}, into Lloyds Bank.`, { kind: 'commerce' });
  }
  if (pettyLow) {
    const draw = lsd(25) - ledger.balance('petty');
    ledger.post(world.sim.now, 'Cheque to self for petty cash', [['petty', draw, 0], ['bank', 0, draw]]);
  }
  yield* walk(world, p, 'S_OF', { activity: 'coming back from the bank' });
  yield* walk(world, p, p.spot, { activity: 'coming back from the bank' });
  if (slip) world.paper.put(slip, 'files', 'counterfoil filed');
}

// --- The warehouse: allocating stock, crating, despatch ------------------------------

// The lines of an order still to be sent.
export const outstanding = (copy) => copy.outstanding || copy.fields.lines;

// Machines on orders waiting in the warehouse, by model and pattern.
export function machinesWanted(world) {
  const want = new Map();
  if (!world.commerce) return want;
  for (const c of world.paper.container('warehouse-tray').docs) {
    for (const l of outstanding(c)) want.set(`${l.model}/${l.pattern}`, (want.get(`${l.model}/${l.pattern}`) || 0) + l.qty);
  }
  return want;
}

// The warehouse foreman goes through his copies of office orders and
// allocates machines from the Stock Room by frame number. An order is sent
// complete if it can be; one that has waited three days goes in part, the
// balance to follow.
const PART_AFTER = 3 * 1440;

export function* warehouseForeman(world, p, production) {
  const paper = world.paper;
  const C = world.commerce;
  const works = world.works;
  for (;;) {
    let did = false;
    for (const copy of [...paper.container('warehouse-tray').docs]) {
      const f = copy.fields;
      if (f.hold) continue;
      const picks = [];
      const sent = [];
      const left = [];
      for (const l of outstanding(copy)) {
        const avail = works.finishedStock.filter((m) => !m.allocated && m.model === l.model && m.pattern === l.pattern && m.frameSize === l.frameSize && !picks.includes(m));
        const n = Math.min(l.qty, avail.length);
        picks.push(...avail.slice(0, n));
        if (n) sent.push({ ...l, qty: n });
        if (n < l.qty) left.push({ ...l, qty: l.qty - n });
      }
      if (!picks.length || (left.length && world.sim.now - f.date < PART_AFTER)) continue;
      did = true;
      for (const m of picks) m.allocated = f.no;
      paper.hold(copy, p);
      yield* work(world, p, 2 + picks.length * 0.5, `allocating machines for order ${f.no} from the Stock Room`);
      const frameNos = picks.map((m) => m.frameNo);
      copy.frameNos = [...(copy.frameNos || []), ...frameNos];
      copy.outstanding = left;
      paper.mark(copy, 'allocated', `frame numbers written on: ${frameNos.join(', ')}${left.length ? '; balance to follow' : ''}`);
      const lot = production.launch({
        label: `${f.no} for ${f.agentName}`, kind: 'despatch', qty: picks.length, unit: 'machine',
        routing: despatchRouting(), room: 'stock-room',
      });
      lot.order = copy;
      lot.machines = picks;
      lot.lines = sent;
      lot.frameNos = frameNos;
      lot.agent = C.agentsById.get(f.agent);
      paper.attach(copy, lot);
      paper.note(copy, 'goes with the machines to be crated');
      world.log(`Order ${f.no}: ${picks.length} machine${picks.length > 1 ? 's' : ''} allocated from stock for ${f.agentName}${left.length ? `, ${left.reduce((a, l) => a + l.qty, 0)} to follow` : ''}.`, { kind: 'commerce' });
      break;
    }
    if (!did) {
      const waiting = paper.container('warehouse-tray').docs.size;
      yield* work(world, p, 15, waiting ? `going through ${waiting} orders waiting for machines` : 'going round the warehouse');
    }
  }
}

export function despatchRouting() {
  return [
    { op: 'getting machines down from the Stock Room racks', group: 'warehouseman', room: 'stock-room', min: 3, take: [2, 4] },
    { op: 'crating machines', group: 'packer', room: 'warehouse', min: 18, take: [1, 2], stage: 'crated', crate: true },
    { op: 'weighing and stencilling crates', group: 'warehouseman', room: 'warehouse', min: 4, take: [2, 6] },
  ];
}

// Called as a despatch lot finishes a step.
export function onDespatchStep(world, lot, step) {
  if (step.crate) world.commerce.crates = Math.max(0, world.commerce.crates - lot.qty);
}

// When a consignment is crated it waits for the despatch clerk to write
// its advice of despatch and consignment note.
export function onDespatchReady(world, lot) {
  const C = world.commerce;
  const works = world.works;
  for (const m of lot.machines) {
    const i = works.finishedStock.indexOf(m);
    if (i >= 0) works.finishedStock.splice(i, 1);
    m.despatched = world.sim.now;
    m.order = lot.order.fields.no;
  }
  world.paper.put(lot.order, 'despatch-tray', 'with the crates, to the despatch clerk');
  C.despatches.push({
    lot, agent: lot.agent, crates: lot.qty, copy: lot.order, orderNo: lot.order.fields.no, lines: lot.lines, frameNos: lot.frameNos, packer: lot.packer,
    ready: world.sim.now, note: null, advice: null, gone: null,
  });
}

// The despatch clerk, at his desk in the warehouse: advices of despatch and
// consignment notes for each consignment, and the signed copies the carmen
// bring back.
export function* despatchClerk(world, p) {
  const paper = world.paper;
  const C = world.commerce;
  for (;;) {
    const dd = C.despatches.find((x) => !x.note);
    if (dd) {
      const agent = dd.agent;
      const f = dd.copy.fields;
      paper.hold(dd.copy, p);
      yield* work(world, p, 7, `writing the advice of despatch and consignment note for ${f.no}`);
      const consignmentNo = C.consignmentNo++;
      const marks = `${agent.name.replace(/^The /, '').split(/[ &.]/)[0].toUpperCase()} / ${agent.town.toUpperCase()} / ${f.no}`;
      const slip = paper.create('packing-slip', {
        orderNo: f.no, agentName: agent.name, lines: dd.lines, frameNos: dd.frameNos, crates: dd.crates, date: world.sim.now, packer: dd.packer,
      }, { by: p });
      const advice = paper.create('advice-of-despatch', {
        orderNo: f.no, agent: agent.id, agentName: agent.name, address: agent.address, station: agent.station,
        carriage: agent.carriage, crates: dd.crates, frameNos: dd.frameNos, lines: dd.lines, date: world.sim.now, consignmentNo,
        balance: outstanding(dd.copy).reduce((a, l) => a + l.qty, 0), weight: dd.crates * CRATE_WEIGHT, marks,
      }, { by: p });
      const note = paper.create('consignment-note', {
        no: consignmentNo, consignee: agent.name, address: agent.address, station: agent.station, crates: dd.crates,
        weight: dd.crates * CRATE_WEIGHT, description: `${dd.crates} crate${dd.crates > 1 ? 's' : ''}, bicycle${dd.crates > 1 ? 's' : ''}`,
        risk: "owner's risk", carriage: agent.carriage, date: world.sim.now, orderNo: f.no,
      }, { by: p });
      const [toCustomer, office, warehouse] = advice.copies;
      toCustomer.destination = 'out-post';
      office.destination = 'invoice-tray';
      paper.put(toCustomer, 'despatch-out', 'for the post');
      paper.put(office, 'despatch-out', 'General Office copy, for invoicing');
      paper.put(warehouse, 'dock', 'with the crates, for the carman to have signed');
      paper.put(note, 'dock', 'with the crates on the dock');
      const [withGoods, slipOffice, slipFile] = slip.copies;
      slipOffice.destination = 'invoice-tray';
      paper.put(withGoods, 'dock', 'to go with the crates');
      paper.put(slipOffice, 'despatch-out', 'General Office copy');
      paper.put(slipFile, 'despatch-files', 'kept in the warehouse for reference');
      dd.slip = slip;
      paper.enter('despatch-book', { orderNo: f.no, consignee: agent.name, station: agent.station, crates: dd.crates, carriage: agent.carriage, consignmentNo }, { from: note, by: p });
      const complete = !outstanding(dd.copy).length;
      if (complete) paper.put(dd.copy, 'despatch-files', 'filed: despatched complete');
      else paper.put(dd.copy, 'warehouse-tray', 'part despatched; back on the file for the balance');
      dd.note = note;
      dd.advice = advice;
      dd.consignmentNo = consignmentNo;
      const order = C.orders.find((o) => o.no === f.no);
      if (order) {
        (order.parts ||= []).push(dd);
        if (complete) {
          order.despatched = world.sim.now;
          if (order.entry) order.entry.despatched = world.sim.now;
        }
      }
      C.weekDespatched += dd.crates;
      continue;
    }
    const back = [...paper.container('despatch-tray').docs].filter((x) => x.type === 'advice-of-despatch');
    if (back.length) {
      for (const x of back) paper.hold(x, p);
      yield* work(world, p, back.length * 0.5, 'filing the signed copies of the advices');
      for (const x of back) paper.put(x, 'despatch-files', 'filed, signed by the railway');
      continue;
    }
    yield* work(world, p, 10, 'writing up the Despatch Book');
  }
}

// The carpenters keep a stock of crates; packers use one per machine.
export function* carpenter(world, p) {
  const C = world.commerce;
  for (;;) {
    if (C.crates < 120) {
      yield* work(world, p, p.age < 17 ? 50 : 28, 'nailing up a cycle crate');
      C.crates++;
    } else {
      yield* work(world, p, 20, 'cutting battens for crates');
    }
  }
}

// --- The lorries to the goods yard ---------------------------------------------------

// A lorry and the times it goes to the goods yard when there are crates
// on the dock (est.).
export function makeLorry(id, name, times) {
  return { id, name, times, done: new Set(), node: 'N1', motion: null, onSite: false, activity: 'in the cart shed', load: 0, driver: null, kind: 'lorry' };
}

// The carmen take whichever lorry is due out. A pair-horse lorry goes to
// the L. & N.W.R. goods yard at Warwick Road, about two miles off through
// the town (est. 35 minutes each way at a walk).
export function* carman(world, p) {
  const C = world.commerce;
  const cal = world.cal;
  for (;;) {
    yield* work(world, p, 0.01);
    const now = world.sim.now;
    const mod = cal.minuteOfDay(now);
    const today = cal.dayStart(now);
    const waiting = C.despatches.some((dd) => dd.note && !dd.gone && !dd.loading);
    let lorry = null;
    let due;
    for (const l of C.lorries) {
      if (l.driver) continue;
      due = l.times.find((t) => mod >= t && mod < t + 60 && !l.done.has(today + t));
      if (due !== undefined) { lorry = l; break; }
    }
    if (!lorry || !waiting) {
      yield* work(world, p, 10, waiting ? 'seeing to the horses' : 'cleaning harness in the stable');
      continue;
    }
    lorry.done.add(today + due);
    lorry.driver = p;
    yield* lorryRound(world, p, lorry);
  }
}

function* lorryRound(world, carman, lorry) {
  const paper = world.paper;
  const C = world.commerce;
  const waiting = C.despatches.filter((dd) => dd.note && !dd.gone && !dd.loading);
  const load = [];
  let crates = 0;
  for (const dd of waiting) {
    if (crates + dd.crates > LORRY_LOAD && load.length) continue;
    dd.loading = true;
    load.push(dd);
    crates += dd.crates;
  }
  yield* walk(world, carman, 'N1', { activity: 'going to harness the horses' });
  yield* work(world, carman, 10, `harnessing the horses to ${lorry.name}`);
  lorry.node = 'N1';
  lorry.onSite = true;
  carman.onSite = false;
  carman.riding = lorry;
  lorry.activity = 'going round to the despatch dock';
  yield* walk(world, lorry, 'DOCK', { mode: 'vehicle', speed: 180, activity: 'backing up to the despatch dock' });
  lorry.activity = `loading ${crates} crates`;
  carman.activity = `loading ${crates} crates onto the lorry`;
  for (let i = 0; i < load.length; i++) {
    yield wait(load[i].crates * 1.5);
    lorry.load += load[i].crates;
    load[i].onLorry = true;
  }
  for (const dd of load) {
    paper.hold(dd.note, carman);
    paper.hold(dd.advice.copies[2], carman);
    paper.hold(dd.slip.copies[0], carman);
  }
  lorry.activity = `taking ${crates} crates to the L. & N.W.R. goods yard, Warwick Road`;
  carman.activity = lorry.activity;
  yield* walk(world, lorry, 'HOME_S', { mode: 'vehicle', speed: 260 });
  lorry.onSite = false;
  lorry.activity = 'on the road to Warwick Road goods yard';
  yield wait(35);
  lorry.activity = 'unloading at the L. & N.W.R. goods shed, Warwick Road';
  carman.activity = lorry.activity;
  yield wait(10 + crates * 1.2);
  const checker = C.rng.pick(['W. Hollis', 'A. Dunn', 'G. Price', 'T. Bray']);
  for (const dd of load) {
    dd.gone = world.sim.now;
    dd.onLorry = false;
    paper.mark(dd.note, 'signed', `received by the L. & N.W.R. checker, ${checker}`);
    paper.put(dd.note, 'railway', 'handed in at the goods office');
    paper.put(dd.slip.copies[0], 'customers', 'went with the crates by goods train');
    dd.advice.fields.checker = checker;
    paper.mark(dd.advice.copies[2], 'signed', `signed for by ${checker} at Warwick Road`);
    if (dd.agent.carriage === 'Paid') {
      world.ledger.post(world.sim.now, `Carriage, consignment ${dd.consignmentNo}`, [['carriage', dd.crates * CARRIAGE_PER_CRATE, 0], ['lnwr', 0, dd.crates * CARRIAGE_PER_CRATE]]);
    }
  }
  lorry.load = 0;
  world.log(`${carman.name} delivered ${crates} crates (${load.length} consignment${load.length > 1 ? 's' : ''}) to the L. & N.W.R. goods yard, Warwick Road, for the night goods trains.`, { kind: 'commerce' });
  lorry.activity = 'coming back from Warwick Road';
  carman.activity = lorry.activity;
  yield wait(35);
  lorry.onSite = true;
  yield* walk(world, lorry, 'N1', { mode: 'vehicle', speed: 220 });
  lorry.activity = 'in the cart shed';
  lorry.onSite = false;
  lorry.driver = null;
  carman.riding = null;
  carman.onSite = true;
  carman.node = 'N1';
  yield* work(world, carman, 10, 'unharnessing and watering the horses');
  yield* walk(world, carman, 'despatch-clerk', { activity: 'taking the signed advices to the despatch clerk' });
  paper.deliver(carman, 'despatch-tray', (x) => x.type === 'advice-of-despatch');
  yield* walk(world, carman, carman.spot, { activity: 'going back to the stable' });
}

// Monday's tally of the week's despatches.
export function* weeklyDespatchTally(world) {
  const C = world.commerce;
  const cal = world.cal;
  for (;;) {
    const now = world.sim.now;
    const nextMon = cal.dayStart(now) + ((8 - cal.dow(now)) % 7 || 7) * 1440 + 60;
    yield until(nextMon);
    C.weekly.push({ weekEnding: nextMon - 1440 - 60, despatched: C.weekDespatched });
    C.weekDespatched = 0;
  }
}

export function commerceSummary(world) {
  const C = world.commerce;
  if (!C) return null;
  const waiting = world.paper.container('warehouse-tray').docs.size;
  return {
    stock: world.works.finishedStock.filter((m) => !m.allocated).length,
    ordersWaiting: waiting,
    onDock: C.despatches.filter((dd) => !dd.gone).reduce((a, dd) => a + dd.crates, 0),
    despatchedThisWeek: C.weekDespatched,
    bank: world.ledger.balance('bank'),
    debtors: world.ledger.balance('debtors'),
  };
}

// --- What the UI can show of the office's books ----------------------------------------

const pseudo = (type, fields, title) => ({ id: `view:${type}:${title}`, type, fields, history: [], marks: [], copy: 0 });

export function commercePapersForPlace(world, id) {
  if (!world.commerce) return [];
  const paper = world.paper;
  const site = world.site;
  const out = [];
  const roomOf = (node) => site.nodes.get(node)?.room;
  for (const b of paper.books.values()) {
    if (!b.columns?.length) continue;
    if (b.node === id || roomOf(b.node) === id) out.push({ label: `${b.title} (${b.entries.length} entries)`, doc: pseudo('book-page', { book: b }, b.id) });
  }
  const ledger = world.ledger;
  if (['secretary-desk', 'secretary', 'chief-clerk'].includes(id)) {
    out.push({
      label: 'Trial balance, as it stands',
      doc: pseudo('trial-balance', {
        get tb() { return ledger.trialBalance(); },
        get when() { return world.cal.docDate(world.sim.now); },
        get personal() { return ledger.personalTotal('debtors'); },
        get control() { return ledger.balance('debtors'); },
      }, 'tb'),
    });
  }
  if (['sales-ledger', 'general-office'].includes(id)) {
    const recent = [];
    for (let i = ledger.postings.length - 1; i >= 0 && recent.length < 4; i--) {
      for (const [code] of ledger.postings[i].lines) {
        const a = ledger.accounts.get(code);
        if (a?.control === 'debtors' && !recent.includes(a)) recent.push(a);
      }
    }
    for (const a of recent) out.push({ label: `Sales Ledger: ${a.name}`, doc: pseudo('ledger-account', { account: a }, a.code) });
  }
  return out;
}

export function commercePapersForLot(world, lot) {
  const out = [];
  if (lot.kind !== 'despatch') return out;
  if (lot.order) out.push({ label: `Office order ${lot.order.fields.no}, warehouse copy`, doc: lot.order });
  const dd = world.commerce.despatches.find((x) => x.lot === lot);
  if (dd?.advice) out.push({ label: 'Advice of despatch, warehouse copy', doc: dd.advice.copies[2] });
  if (dd?.note) out.push({ label: `Consignment note No. ${dd.note.fields.no}`, doc: dd.note });
  if (dd?.invoice) out.push({ label: `Invoice No. ${dd.invoice.fields.no}`, doc: dd.invoice });
  return out;
}
