import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../scenarios/coventry-1913/index.js';

// Four weeks of orders, despatches, invoices and cheques.
const sc = createScenario({ seed: 31 });
const { sim, cal, world } = sc;
sim.runUntil(cal.at(1913, 3, 29, 23));
const C = world.commerce;
const ledger = world.ledger;
const paper = world.paper;

test('runs without errors', () => {
  assert.deepEqual(sim.errors.map((e) => `${e.process}: ${e.err.message}`), []);
});

test('orders come in and machines go out, a couple of hundred a week', () => {
  assert.ok(C.orders.length > 300, `${C.orders.length} orders`);
  const sent = C.despatches.filter((dd) => dd.gone).reduce((a, dd) => a + dd.crates, 0);
  assert.ok(sent > 600 && sent < 1200, `${sent} machines despatched`);
  // No order is forgotten: everything not yet sent is on the warehouse file,
  // held for credit, or on its way.
  for (const o of C.orders) {
    if (o.despatched) continue;
    const copy = o.order.copies[5];
    // On the warehouse file, being packed, with the despatch clerk, or on its
    // way to the warehouse with the office boy's next round.
    const where = copy.container?.id;
    assert.ok(['warehouse-tray', 'despatch-tray', 'office-out'].includes(where) || copy.lot || copy.holder, `${o.no} lost: ${where}`);
  }
});

test('every consignment has its packing slip, advice, consignment note and invoice', () => {
  const gone = C.despatches.filter((dd) => dd.gone && dd.gone < sim.now - 1440);
  assert.ok(gone.length > 100);
  for (const dd of gone) {
    assert.equal(dd.advice.copies.length, 3);
    assert.equal(dd.slip.copies.length, 3);
    assert.equal(dd.slip.copies[0].container.id, 'customers', 'the packing slip goes with the goods');
    assert.ok(dd.advice.copies[2].marks.some((m) => m.mark === 'signed'), 'the warehouse copy is signed by the carrier');
    assert.ok(dd.note.marks.some((m) => m.mark === 'signed'), `note ${dd.note.fields.no} not signed`);
    assert.equal(dd.note.container.id, 'railway');
    assert.ok(dd.invoice, `consignment ${dd.consignmentNo} not invoiced`);
    assert.equal(dd.invoice.fields.consignmentNo, dd.consignmentNo);
    const machines = dd.invoice.fields.lines.reduce((a, l) => a + l.qty, 0);
    assert.equal(machines, dd.crates);
    assert.equal(dd.frameNos.length, dd.crates);
  }
});

test('a machine is only ever sent once, and leaves the Stock Room when it goes', () => {
  const seen = new Set();
  for (const dd of C.despatches) {
    for (const n of dd.frameNos) {
      assert.ok(!seen.has(n), `frame ${n} sent twice`);
      seen.add(n);
    }
  }
  for (const m of world.works.finishedStock) assert.ok(!m.despatched);
});

test('the books agree: the trial balance balances and the Sales Ledger agrees with its control', () => {
  const tb = ledger.trialBalance();
  assert.ok(tb.balanced, `Dr ${tb.debit} Cr ${tb.credit}`);
  assert.equal(ledger.balance('debtors'), ledger.personalTotal('debtors'));
  // Sales are what the Sales Day Book says, once posted.
  const posted = paper.books.get('sales-day-book').entries.reduce((a, e) => a + e.total, 0);
  const waiting = [...paper.container('ledger-tray').docs].reduce((a, dd) => a + dd.fields.total, 0);
  assert.equal(-ledger.balance('sales'), posted - waiting);
});

test('agents pay, cheques are banked, and receipts go back', () => {
  const book = paper.books.get('cash-book').entries;
  assert.ok(book.length > 50, `${book.length} remittances`);
  const banked = book.reduce((a, e) => a + e.banked, 0);
  const inHand = C.toPayIn.reduce((a, i) => a + i.amount, 0);
  assert.equal(book.reduce((a, e) => a + e.amount, 0), banked + inHand);
  assert.equal(ledger.balance('cheques'), inHand);
  const receipts = [...paper.docs.values()].filter((dd) => dd.type === 'receipt');
  assert.equal(receipts.length, book.length);
  for (const r of receipts) assert.equal(r.fields.stamp, r.fields.amount >= 960 * 2);
});

test('statements go out at the start of April', () => {
  const sc2 = createScenario({ seed: 32, start: cal.at(1913, 3, 31, 5) });
  sc2.sim.runUntil(cal.at(1913, 4, 2, 19));
  const st = [...sc2.world.paper.docs.values()].filter((dd) => dd.type === 'statement');
  assert.ok(st.length > 50, `${st.length} statements`);
  for (const s of st.slice(0, 20)) assert.equal(s.fields.balance, s.fields.lines.reduce((a, l) => a + l.debit - l.credit, 0));
});

test('wages and insurance reach the ledger', () => {
  const W = world.wages;
  const paidWeeks = W.weeks.filter((w) => w.cheque);
  const net = paidWeeks.reduce((a, w) => a + w.total, 0);
  const stamped = W.weeks.filter((w) => w.abstract && W.stampsBought >= w.ending);
  const deducted = stamped.reduce((a, w) => a + w.health + w.unemployment, 0);
  assert.equal(ledger.balance('wages'), net + deducted);
  assert.equal(ledger.balance('ni'), stamped.reduce((a, w) => a + w.employerNI, 0));
});
