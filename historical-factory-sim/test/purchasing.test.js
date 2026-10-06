import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../scenarios/coventry-1913/index.js';
import { lsd } from '../engine/sim/money.js';

// Seven weeks of buying in, to the third Wednesday in April and past it.
const sc = createScenario({ seed: 41 });
const { sim, cal, world } = sc;
sim.runUntil(cal.at(1913, 4, 19, 23));
const P = world.purchasing;
const paper = world.paper;
const ledger = world.ledger;
const docsOf = (type) => [...paper.docs.values()].filter((d) => d.type === type && d.copy === 0);

test('runs without errors, and the shops never wait long for bought-in parts', () => {
  assert.deepEqual(sim.errors.map((e) => `${e.process}: ${e.err.message}`), []);
  const weeks = world.works.weekly.map((w) => w.machines);
  assert.ok(weeks.slice(1).every((n) => n >= 150), `weekly output ${weeks.join(', ')}`);
  const rough = sc.production.stores.get('rough');
  for (const card of P.cards.values()) assert.ok(rough.qty(card.item) >= 0, card.item);
});

test('every order follows the paper: requisition approved, order signed, goods received note', () => {
  const received = P.pos.filter((po) => po.state === 'received');
  assert.ok(received.length > 40, `${received.length} orders received`);
  for (const po of received) {
    const top = po.docs.top;
    assert.equal(top.copies.length, 3);
    for (const pr of po.prs) assert.ok(pr.marks.some((m) => m.mark === 'approved'), `${pr.no} not approved`);
    if (po.prs.length) {
      assert.ok(top.marks.some((m) => m.mark === 'signed'), `${po.no} not signed`);
      if (po.value > lsd(50)) assert.match(top.fields.signedBy, /Managing Director/, `${po.no} over £50`);
    }
    assert.ok(po.docs.receiving.marks.some((m) => m.mark === 'received'));
    assert.equal(po.grns.length, 1);
    const grn = po.grns[0];
    assert.equal(grn.copies[1].container.id, 'gr-book', 'the duplicate stays in the Stores');
    for (const l of po.lines) assert.equal(grn.fields.lines.find((g) => g.item === l.item).qty, l.qty);
  }
});

test('the Receiving Clerk’s copy of an order carries no prices', () => {
  const po = P.pos.find((o) => o.state === 'received');
  const html = sc.paperView.forms['purchase-order'].render(po.docs.receiving, sc.paperView.ctx);
  assert.ok(!html.includes('£'), 'a price on the unpriced copy');
  assert.ok(sc.paperView.forms['purchase-order'].render(po.docs.top, sc.paperView.ctx).includes('£'));
});

test('every invoice posted to the Bought Ledger was matched to a goods received note', () => {
  const posted = docsOf('supplier-invoice').filter((d) => d.marks.some((m) => m.mark === 'posted'));
  assert.ok(posted.length > 30, `${posted.length} invoices posted`);
  for (const inv of posted) {
    const po = P.pos.find((o) => o.no === inv.fields.poNo);
    assert.ok(inv.marks.some((m) => m.mark === 'passed'), `invoice ${inv.fields.no} not passed`);
    const grn = po.grns[0];
    assert.ok(grn.fields.priced);
    assert.equal(inv.fields.total, po.value);
    for (const l of inv.fields.lines) assert.equal(grn.fields.lines.find((g) => g.item === l.item).qty, l.qty);
  }
  const book = paper.books.get('bought-day-book').entries;
  assert.equal(book.length, posted.length);
  assert.equal(ledger.balance('purchases') + ledger.balance('fuel'), book.reduce((a, e) => a + e.total, 0));
});

test('the books agree, and the Bought Ledger agrees with its control account', () => {
  assert.ok(ledger.trialBalance().balanced);
  assert.equal(ledger.balance('creditors'), ledger.personalTotal('creditors'));
  assert.ok(ledger.balance('bank') > 0, 'the bank account is overdrawn');
});

test('suppliers are paid on the third Wednesday, less 2½%, by combined cheque and receipt', () => {
  assert.deepEqual(P.runs.map((r) => cal.shortDate(r.payDay)), ['19/3/13', '16/4/13']);
  for (const run of P.runs) {
    assert.ok(run.sanctioned && run.paid, 'list not sanctioned and paid');
    assert.equal(cal.dayStart(run.paid), run.payDay);
    assert.equal(run.cheques.length, run.rows.length);
    for (const [i, r] of run.rows.entries()) {
      const ch = run.cheques[i];
      assert.equal(ch.fields.amount, r.gross - r.discount);
      if (r.code !== 'lnwr') assert.ok(Math.abs(r.discount - r.gross * 0.025) <= 2, `${r.name} discount`);
      assert.equal(ch.fields.stamp, ch.fields.amount >= lsd(2));
    }
  }
  // March's receipts have come back signed.
  for (const ch of P.runs[0].cheques) assert.ok(ch.marks.some((m) => m.mark === 'receipted'), `no receipt from ${ch.fields.payee}`);
  // February's accounts are cleared; March's deliveries were paid in April.
  for (const s of P.suppliers) {
    const owedBeforeApril = ledger.account(s.account).lines.filter((l) => l.t < cal.at(1913, 4, 1)).reduce((a, l) => a + l.credit, 0)
      - ledger.account(s.account).lines.reduce((a, l) => a + l.debit, 0);
    assert.ok(owedBeforeApril <= 0, `${s.name} still owed for March`);
  }
});

test('statements from suppliers agree with the Bought Ledger', () => {
  const st = docsOf('supplier-statement');
  assert.ok(st.length >= P.suppliers.length, `${st.length} statements`);
  for (const d of st.filter((x) => x.marks.length)) assert.ok(d.marks.some((m) => m.mark === 'agreed'), `${d.fields.fromName}: ${d.history.at(-1).text}`);
});

test('nothing delivered on a Sunday or a bank holiday', () => {
  const tt = world.people[0].timetables.works;
  for (const g of docsOf('goods-received-note')) {
    assert.notEqual(cal.dow(g.fields.date), 0);
    assert.ok(!tt.isHoliday(g.fields.date), `${g.no} on ${cal.shortDate(g.fields.date)}`);
  }
});
