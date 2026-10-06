import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../scenarios/coventry-1913/index.js';

// Four weeks at the goods yard and the canal wharf.
const sc = createScenario({ seed: 23 });
const { sim, cal, world } = sc;
const coal = sc.production.stores.get('coal');
let lowest = Infinity;
for (let t = cal.at(1913, 3, 3); t <= cal.at(1913, 3, 29, 23); t += 60) {
  sim.runUntil(t);
  lowest = Math.min(lowest, coal.qty('coal'));
}
const R = world.railway;
const P = world.purchasing;
const C = world.commerce;
const paper = world.paper;

test('runs without errors', () => {
  assert.deepEqual(sim.errors.map((e) => `${e.process}: ${e.err.message}`), []);
});

test('every crate carted to Warwick Road goes away by the night goods', () => {
  const last = R.departures.at(-1).t;
  const carted = C.despatches.filter((dd) => dd.gone && dd.gone < last).reduce((a, dd) => a + dd.crates, 0);
  const departed = R.departures.reduce((a, d) => a + d.crates, 0);
  assert.ok(carted > 500, `${carted} crates carted`);
  assert.equal(departed, carted);
  // A night goods every weekday and Saturday, none on Sundays.
  for (const d of R.departures) assert.notEqual(cal.dow(d.t), 0);
  assert.ok(R.departures.length >= 23, `${R.departures.length} night goods`);
});

test('the goods checker signs every consignment note, which stays with the railway', () => {
  const gone = C.despatches.filter((dd) => dd.gone);
  for (const dd of gone) {
    assert.ok(dd.note.marks.some((m) => m.mark === 'signed'), `consignment ${dd.consignmentNo} not signed`);
    assert.ok(dd.note.history.some((h) => h.text.includes(`checker, ${R.checker.name}`)), `${dd.consignmentNo} not signed by the checker`);
    assert.equal(dd.note.container.id, 'railway');
  }
});

test('goods by rail come off the night vans onto the delivery bank before the railway van brings them', () => {
  const byRail = P.consignments.filter((c) => ['L. & N.W.R.', 'Midland Railway'].includes(c.carrier) && typeof c.delivered === 'number');
  assert.ok(byRail.length > 10, `${byRail.length} consignments by rail`);
  for (const c of byRail) {
    assert.ok(c.unloaded, `${c.po.no} never unloaded at the yard`);
    assert.ok(c.atYard <= c.unloaded && c.unloaded < c.delivered, c.po.no);
    assert.equal(c.per, `${c.carrier} van`);
  }
});

test('the coal comes by boat, with the colliery’s ticket, and goes through the books as fuel', () => {
  const boats = P.consignments.filter((c) => c.carrier === 'canal' && typeof c.delivered === 'number');
  assert.ok(boats.length >= 1, 'no coal boat');
  for (const c of boats) {
    assert.match(c.per, /canal boat/);
    const grn = c.po.grns[0];
    assert.ok(grn, `${c.po.no}: no goods received note`);
    const ticket = [...paper.docs.values()].find((d) => d.type === 'coal-ticket' && d.fields.poNo === c.po.no);
    assert.ok(ticket, 'no weight ticket');
    assert.equal(ticket.container.id, 'receiving-done');
    assert.ok(paper.related(ticket).includes(grn), 'ticket not filed with the goods received note');
  }
  assert.ok(world.ledger.balance('fuel') > 0, 'no coal invoice posted');
  // The boilers never go short.
  assert.ok(lowest > 100, `coal yard down to ${lowest / 20} tons`);
});
