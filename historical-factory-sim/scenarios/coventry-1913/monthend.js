// The month's end in the General Office: the salaries, the Journal's
// month-end entries, the trial balance and the monthly statement for the
// Managing Director.
//
//   - Salaried staff are paid monthly, on the last working day, in
//     envelopes; insured staff (under £160 a year) have their health
//     insurance stamps fixed for the month's weeks, with 4d. a week (3d. for
//     a woman) kept back.
//   - Bills the sim doesn't model (rates, insurance, gas, repairs, shop
//     sundries, office expenses, directors' fees) and depreciation are
//     accrued in the Journal at so much a year (est.).
//   - The Secretary extracts a trial balance at each month's end, and makes
//     out a monthly statement of the trading from the Works Accounts Office's
//     costs: Dicksee's monthly "sales/purchases/estimated-stock" account, with
//     the cost department's figures standing in for a stocktaking.
import { work, walk } from '../../engine/sim/world.js';
import { fmt, lsd, d } from '../../engine/sim/money.js';
import { OVERHEADS, costAbstract, worksStaff } from './costing.js';

export function setupMonthEnd(world) {
  const paper = world.paper;
  const ledger = world.ledger;
  ledger.open('salaries', 'Salaries (office, travellers and management)', { type: 'expense' });
  ledger.open('works-salaries', 'Salaries (works staff)', { type: 'expense' });
  for (const [code, name] of OVERHEADS) ledger.open(code, name, { type: 'expense' });
  ledger.open('accrued', 'Expenses accrued', { type: 'liability' });
  ledger.open('depreciation-provision', 'Provision for depreciation', { type: 'liability' });
  paper.addContainer({ id: 'private-files', name: 'the Secretary’s private file of monthly accounts', node: 'secretary-desk', kind: 'file' });
  paper.addContainer({ id: 'salaries-tray', name: 'the Cashier’s salaries tray', node: 'cashier-desk' });
  const date = (e, { cal }) => cal.shortDate(e.t);
  paper.addBook({
    id: 'salaries-book', title: 'Salaries Book', node: 'cashier-desk', columns: [
      { h: 'Month', f: (e) => e.month }, { h: 'Name', f: (e) => e.name }, { h: 'Position', f: (e) => e.title },
      { h: 'Salary', f: (e) => e.month && e.gross, money: true }, { h: 'Insurance', f: (e) => e.insurance, money: true }, { h: 'Paid', f: (e) => e.net, money: true },
    ],
  });
  paper.addBook({
    id: 'journal', title: 'Journal', node: 'secretary-desk', columns: [
      { h: 'Date', f: date }, { h: 'Particulars', f: (e) => e.text }, { h: 'Dr.', f: (e) => e.dr, money: true }, { h: 'Cr.', f: (e) => e.cr, money: true },
    ],
  });
  const M = { months: [], start: world.sim.now };
  world.monthEnd = M;
  return M;
}

// --- Dates ------------------------------------------------------------------------------

function officeDay(p, t) {
  return p.timetables.office.spellsOn(t).length > 0;
}

// The last working day of the month that `t` is in.
function lastWorkingDay(world, p, t) {
  const cal = world.cal;
  const { year, month } = cal.parts(t);
  let day = cal.at(year, month + 1, 1) - 1440;
  while (!officeDay(p, day)) day -= 1440;
  return day;
}

// The nth working day of the month that `t` is in (1 = the first).
function nthWorkingDay(world, p, t, n) {
  const cal = world.cal;
  const { year, month } = cal.parts(t);
  let day = cal.at(year, month, 1);
  let k = 0;
  for (;;) {
    if (officeDay(p, day) && ++k === n) return day;
    day += 1440;
  }
}

function monthKey(cal, t) {
  const { year, month } = cal.parts(t);
  return `${year}-${month}`;
}

function monthLabel(cal, t) {
  const { year, month } = cal.parts(t);
  return `${cal.monthName(month)} ${year}`;
}

// The previous month's first minute and the next month's first minute.
function monthBounds(cal, t) {
  const { year, month } = cal.parts(t);
  return [cal.at(year, month, 1), cal.at(year, month + 1, 1)];
}

function monthRecord(world, key) {
  const M = world.monthEnd;
  let m = M.months.find((x) => x.key === key);
  if (!m) M.months.push((m = { key }));
  return m;
}

// --- Salaries -----------------------------------------------------------------------------

// Contribution weeks in the month: the Mondays that fall in it.
function weeksIn(cal, t) {
  const [from, to] = monthBounds(cal, t);
  let n = 0;
  for (let day = from; day < to; day += 1440) if (cal.dow(day) === 1) n++;
  return n;
}

function salariesList(world, t) {
  const cal = world.cal;
  const weeks = weeksIn(cal, t);
  const rows = world.people.filter((q) => q.role === 'staff' && q.salary).map((q) => {
    const gross = Math.round(q.salary / 12);
    const insured = !!q.healthCard;
    const insurance = insured ? weeks * d(q.sex === 'F' ? 3 : 4) : 0;
    const employer = insured ? weeks * d(3) : 0;
    return { q, name: q.name, title: q.title, works: worksStaff(world, q), gross, insurance, employer, net: gross - insurance };
  });
  return { rows, weeks };
}

// The Secretary's month-end duties, in the order they come round.
export function* secretaryMonthEnd(world, p) {
  const cal = world.cal;
  const paper = world.paper;
  const ledger = world.ledger;
  const now = world.sim.now;
  const today = cal.dayStart(now);
  const mod = cal.minuteOfDay(now);

  // The last working day: the salaries list for the Cashier.
  if (today === lastWorkingDay(world, p, now) && mod >= 9 * 60 + 30) {
    const m = monthRecord(world, monthKey(cal, now));
    if (!m.salaries) {
      const { rows, weeks } = salariesList(world, now);
      yield* work(world, p, 8 + rows.length * 0.3, 'making out the month’s salaries list');
      const list = paper.create('salaries-list', {
        month: monthLabel(cal, now), date: now, weeks,
        rows: rows.map(({ q, ...r }) => ({ ...r, worksNo: q.worksNo })),
        gross: rows.reduce((a, r) => a + r.gross, 0), insurance: rows.reduce((a, r) => a + r.insurance, 0),
        employer: rows.reduce((a, r) => a + r.employer, 0), net: rows.reduce((a, r) => a + r.net, 0),
      }, { by: p });
      m.salaries = { list, rows };
      paper.put(list, 'salaries-tray', 'passed to the Cashier to draw and pay');
      return true;
    }
  }

  // The first working day of a month: the Journal's entries for the month
  // just ended, then the trial balance.
  const prev = monthBounds(cal, cal.at(cal.parts(now).year, cal.parts(now).month, 1) - 1440);
  const prevKey = monthKey(cal, prev[0]);
  const started = world.monthEnd.start;
  if (today === nthWorkingDay(world, p, now, 1) && mod >= 9 * 60 && prev[1] <= now && prev[1] > started) {
    const m = monthRecord(world, prevKey);
    if (!m.journal) {
      m.journal = true;
      const end = prev[1] - 1;
      const label = monthLabel(cal, prev[0]);
      yield* work(world, p, 15, `writing up the Journal for ${label}`);
      let total = 0;
      for (const [code, name, perYear] of OVERHEADS) {
        const amount = Math.round(lsd(perYear) / 12);
        const credit = code === 'depreciation' ? 'depreciation-provision' : 'accrued';
        ledger.post(end, `${name}: one month (est.)`, [[code, amount, 0], [credit, 0, amount]]);
        const to = credit === 'accrued' ? 'Expenses accrued' : 'Provision for depreciation';
        paper.enter('journal', { t: end, text: `${name} Dr., to ${to}: ${label}, one-twelfth of the year’s estimate`, dr: amount, cr: amount }, { by: p });
        total += amount;
      }
      world.log(`The Secretary posted the Journal for ${label}: ${fmt(total)} of expenses accrued and depreciation.`, { kind: 'accounts' });
      yield* work(world, p, 40, `extracting the trial balance at the end of ${label}`);
      const tb = ledger.trialBalance();
      const doc = paper.create('trial-balance', { tb, when: `At ${cal.docDate(end)}`, month: label }, { by: p });
      paper.mark(doc, tb.balanced ? 'agreed' : 'differs', tb.balanced ? 'the trial balance agrees' : 'the trial balance does not agree');
      paper.put(doc, 'private-files', 'filed in the private file');
      m.trialBalance = doc;
      return true;
    }
  }

  // The third working day: the monthly statement for the Managing Director.
  if (today === nthWorkingDay(world, p, now, 3) && mod >= 10 * 60 && prev[1] > started) {
    const m = monthRecord(world, prevKey);
    if (m.journal && !m.statement) {
      yield* work(world, p, 45, `making out the monthly statement for ${monthLabel(cal, prev[0])}`);
      const { fortnights, ...st } = monthlyStatement(world, prev[0], prev[1]);
      const doc = paper.create('monthly-statement', st, { by: p });
      for (const fn of fortnights) paper.link(doc, fn);
      if (m.trialBalance) paper.link(doc, m.trialBalance);
      m.statement = doc;
      yield* walk(world, p, 'md-desk', { activity: 'taking the monthly statement to the Managing Director' });
      yield* work(world, p, 15, 'going through the month’s figures with the Managing Director');
      paper.mark(doc, 'initialled', 'initialled by the Managing Director');
      paper.put(doc, 'private-files', 'filed in the private file');
      world.log(`The monthly statement for ${st.month}: sales ${fmt(st.sales)}, ${st.net >= 0 ? 'net profit' : 'net loss'} ${fmt(Math.abs(st.net))} (est.).`, { kind: 'accounts' });
      yield* walk(world, p, p.spot, { activity: 'going back to the Secretary’s office' });
      return true;
    }
  }
  return false;
}

// The Cashier draws the salaries cheque and pays the envelopes at four.
export function* cashierSalaries(world, p) {
  const paper = world.paper;
  const ledger = world.ledger;
  const cal = world.cal;
  const list = [...paper.container('salaries-tray').docs].find((x) => x.type === 'salaries-list' && !x.marks.some((m) => m.mark === 'paid'));
  if (!list || cal.minuteOfDay(world.sim.now) < 16 * 60) return false;
  const f = list.fields;
  paper.hold(list, p);
  yield* work(world, p, 20, 'making up the salary envelopes');
  const m = world.monthEnd.months.find((x) => x.salaries?.list === list);
  const [from, to] = monthBounds(cal, f.date);
  const mondays = [];
  for (let day = from; day < to; day += 1440) if (cal.dow(day) === 1) mondays.push(day);
  for (const r of m.salaries.rows) {
    if (r.q.healthCard && r.insurance) {
      for (const week of mondays) r.q.healthCard.fields.stamps.push({ week, value: r.insurance / f.weeks + d(3), salaried: true });
    }
    paper.enter('salaries-book', { month: f.month, name: r.name, title: r.title, gross: r.gross, insurance: r.insurance, net: r.net }, { from: list, by: p });
  }
  const works = m.salaries.rows.filter((r) => r.works).reduce((a, r) => a + r.gross, 0);
  ledger.post(world.sim.now, `Salaries, ${f.month}`, [
    ['salaries', f.gross - works, 0], ['works-salaries', works, 0], ['ni', f.employer, 0], ['bank', 0, f.net + f.insurance + f.employer],
  ]);
  paper.mark(list, 'paid', `salaries paid in envelopes; ${fmt(f.insurance + f.employer)} of insurance stamps bought and fixed`);
  paper.put(list, 'private-files', 'filed with the month’s papers');
  world.log(`The Cashier paid the salaries for ${f.month}: ${fmt(f.net)} in ${f.rows.length} envelopes.`, { kind: 'accounts' });
  return true;
}

// --- The monthly statement ---------------------------------------------------------------

function movement(ledger, code, from, to) {
  const a = ledger.account(code);
  if (!a) return 0;
  return a.lines.filter((l) => l.t >= from && l.t < to).reduce((s, l) => s + l.debit - l.credit, 0);
}

export function monthlyStatement(world, from, to) {
  const cal = world.cal;
  const ledger = world.ledger;
  const C = world.costs;
  const sales = -movement(ledger, 'sales', from, to);
  const ab = costAbstract(world, from, to);
  const fortnights = C.fortnights.filter((fn) => fn.to > from && fn.to <= to + 1440);
  const shop = fortnights.reduce((a, fn) => a + fn.charges.fields.difference, 0);
  const expenses = [
    ['Salaries: office, travellers and management', movement(ledger, 'salaries', from, to)],
    ...OVERHEADS.filter(([, , , share]) => share < 1).map(([code, name, , share]) => [name, Math.round(movement(ledger, code, from, to) * (1 - share))]),
    ['Carriage outwards', movement(ledger, 'carriage', from, to)],
    ['Discounts allowed, less discounts received', movement(ledger, 'discounts', from, to) + movement(ledger, 'discounts-received', from, to)],
  ].filter(([, v]) => v);
  const office = expenses.reduce((a, [, v]) => a + v, 0);
  const gross = ab.invoiced - ab.works;
  const net = gross + shop - office;
  const made = world.works.register.filter((m) => m.batch !== 'stock' && m.finished >= from && m.finished < to).length;
  // Machines on order and not yet sent.
  const sent = new Map();
  for (const dd of world.commerce?.despatches || []) sent.set(dd.orderNo, (sent.get(dd.orderNo) || 0) + dd.crates);
  const waiting = (world.commerce?.orders || []).filter((o) => !o.despatched).reduce((a, o) => a + Math.max(0, o.qty - (sent.get(o.no) || 0)), 0);
  return {
    month: monthLabel(cal, from), from, to,
    sales, invoiced: ab.invoiced, machines: ab.machines, works: ab.works, gross, shop, expenses, office, net,
    made, stock: world.works.finishedStock.length, waiting,
    bank: ledger.balance('bank'), debtors: ledger.balance('debtors'), creditors: -ledger.balance('creditors'),
    wages: movement(ledger, 'wages', from, to),
    fortnights: fortnights.map((fn) => fn.abstract),
  };
}
