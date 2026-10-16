import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../scenarios/coventry-1913/index.js';
import { OVERHEADS } from '../scenarios/coventry-1913/costing.js';

// Two months of cost accounts and two month-ends, into May.
const sc = createScenario({ seed: 17 });
const { sim, cal, world } = sc;
sim.runUntil(cal.at(1913, 5, 6, 18));
const C = world.costs;
const M = world.monthEnd;
const paper = world.paper;
const ledger = world.ledger;
const docsOf = (type) => paper.byType.get(type) || [];

test('runs without errors, and the books still agree', () => {
  assert.deepEqual(sim.errors.map((e) => `${e.process}: ${e.err.message}`), []);
  assert.ok(ledger.trialBalance().balanced);
});

test('every week’s wages are allocated, and agree with the wages to the farthing', () => {
  const weeks = world.wages.weeks.filter((w) => w.allocated);
  assert.ok(weeks.length >= 8, `${weeks.length} weeks allocated`);
  for (const sh of C.sheets) {
    const gross = sh.week.results.reduce((a, r) => a + r.gross, 0);
    assert.equal(sh.direct + sh.indirect, gross, `week ending ${cal.shortDate(sh.week.ending)}`);
    assert.equal(sh.sheet.fields.total, sh.sheet.fields.abstractTotal);
    assert.ok(sh.direct > sh.indirect || sh.standing.get('S.O. 8'), 'most of the wages are direct');
  }
  // What went to the cards is what the sheets say.
  const posted = [...C.cards.values()].reduce((a, c) => a + c.fields.wages, 0);
  assert.equal(posted, C.sheets.reduce((a, sh) => a + sh.total, 0));
});

test('every coupon cut from a work tally is priced and posted to its sub-order', () => {
  const coupons = docsOf('stores-coupon');
  assert.ok(coupons.length > 300, `${coupons.length} coupons`);
  const waiting = coupons.filter((x) => !x.fields.priced);
  for (const x of waiting) assert.ok(['cost-in', 'stores-out', 'office-out'].includes(x.container?.id) || x.holder, `coupon ${x.fields.no} lost`);
  assert.ok(waiting.length < 20, `${waiting.length} coupons not yet priced`);
  const priced = coupons.filter((x) => x.fields.priced).reduce((a, x) => a + x.fields.total, 0);
  const materials = [...C.cards.values()].reduce((a, c) => a + c.fields.materials, 0);
  assert.equal(materials, priced);
});

test('finished sub-orders are closed near the Estimator’s figure', () => {
  const closed = [...C.cards.values()].filter((c) => c.fields.closed && c.fields.kind === 'works');
  assert.ok(closed.length >= 10, `${closed.length} works orders closed`);
  for (const c of closed) {
    const f = c.fields;
    assert.ok(Math.abs(f.unitCost - f.standard) / f.standard < 0.12, `${f.subOrder}: ${f.unitCost} against ${f.standard}`);
  }
  for (const b of world.works.batches) {
    if (b.finished && b.finished < C.fortnights.at(-1).to) assert.ok(C.cards.get(b.id).fields.closed, `${b.id} finished but not closed`);
  }
});

test('the shop charges are set against the actual expenditure, and the rate revised', () => {
  assert.ok(C.fortnights.length >= 3);
  for (const fn of C.fortnights) {
    const f = fn.charges.fields;
    assert.equal(f.actual, f.rows.reduce((a, r) => a + r.amount, 0));
    assert.equal(f.difference, f.recovered - f.actual);
  }
  assert.notEqual(C.rate, 0.75, 'the rate was never revised');
  assert.ok(C.rate > 0.6 && C.rate < 1.4, `rate ${C.rate}`);
});

test('the cost abstracts take every invoice once, and go to the Managing Director', () => {
  const seen = new Set();
  for (const fn of C.fortnights) {
    const f = fn.abstract.fields;
    for (const r of f.rows) {
      assert.ok(!seen.has(r.invoiceNo), `invoice ${r.invoiceNo} twice`);
      seen.add(r.invoiceNo);
      assert.equal(r.profit, r.invoiced - r.works - r.office);
    }
    assert.equal(f.invoiced, f.rows.reduce((a, r) => a + r.invoiced, 0));
    assert.ok(fn.abstract.marks.some((m) => m.mark === 'initialled'));
    assert.equal(fn.abstract.container.id, 'md-guard-book');
  }
  const last = C.fortnights.at(-1).to;
  const invoices = docsOf('invoice').filter((x) => x.fields.date < last);
  assert.equal(seen.size, invoices.length);
});

test('salaries are paid on the last working day, and insured staff are stamped', () => {
  const lists = docsOf('salaries-list');
  assert.deepEqual(lists.map((l) => cal.shortDate(l.fields.date)), ['31/3/13', '30/4/13']);
  for (const l of lists) {
    assert.ok(l.marks.some((m) => m.mark === 'paid'));
    assert.equal(l.fields.net, l.fields.gross - l.fields.insurance);
  }
  const paid = ledger.balance('salaries') + ledger.balance('works-salaries');
  assert.equal(paid, lists.reduce((a, l) => a + l.fields.gross, 0));
  const clerk = world.people.find((p) => p.title === 'Cost Clerk');
  assert.equal(clerk.healthCard.fields.stamps.length, 5 + 4, 'five Mondays in March, four in April');
  const md = world.people.find((p) => p.title === 'Managing Director');
  assert.ok(!md.healthCard, 'the Managing Director earns over £160 and is not insured');
});

test('each month-end: the Journal, a trial balance that agrees, and the statement', () => {
  const months = M.months.filter((m) => m.statement);
  assert.deepEqual(months.map((m) => m.statement.fields.month), ['March 1913', 'April 1913']);
  assert.equal(paper.books.get('journal').entries.length, OVERHEADS.length * 2);
  for (const m of months) {
    assert.ok(m.trialBalance.fields.tb.balanced);
    const f = m.statement.fields;
    assert.equal(f.net, f.gross + f.shop - f.office);
    assert.equal(f.gross, f.invoiced - f.works);
    assert.equal(f.sales, f.invoiced, 'every sale in the month is in the cost department’s figures');
    assert.ok(m.statement.marks.some((x) => x.mark === 'initialled'));
  }
});
