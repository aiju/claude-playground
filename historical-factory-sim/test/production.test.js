import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../scenarios/coventry-1913/index.js';

// Three weeks of production from the opening state.
const sc = createScenario({ seed: 11 });
const { sim, cal, world } = sc;
sim.runUntil(cal.at(1913, 3, 22, 23));
const works = world.works;

test('runs without errors', () => {
  assert.deepEqual(sim.errors.map((e) => `${e.process}: ${e.err.message}`), []);
});

test('makes a couple of hundred machines a week', () => {
  const weeks = works.weekly.map((w) => w.machines);
  assert.equal(weeks.length, 3);
  // The week ending 22 March has Good Friday in it.
  const total = weeks.reduce((a, b) => a + b, 0);
  assert.ok(total >= 600 && total <= 900, `weekly output ${weeks.join(', ')}`);
  // Machines finish in trays of 25, so a single week can be lumpy.
  assert.ok(Math.min(...weeks) >= 150, `weekly output ${weeks.join(', ')}`);
  assert.ok((weeks[1] + weeks[2]) / 2 >= 200, `weeks two and three ${weeks[1]}, ${weeks[2]}`);
});

test('every finished machine has a unique frame number, in sequence', () => {
  const nos = works.register.map((m) => m.frameNo);
  assert.equal(new Set(nos).size, nos.length);
  const batches = new Map();
  for (const b of works.batches) if (b.frameNos) batches.set(b.id, b);
  for (const m of works.register) {
    if (m.batch === 'stock') continue; // last season's machines, in the Stock Room on 1 March
    const b = batches.get(m.batch);
    assert.ok(m.frameNo >= b.frameNos[0] && m.frameNo <= b.frameNos[1], `${m.frameNo} outside ${b.id}`);
  }
  // Frame numbers handed out never overlap between batches.
  const ranges = [...batches.values()].map((b) => b.frameNos).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) assert.ok(ranges[i][0] > ranges[i - 1][1]);
});

test('stores reconcile: opening stock + receipts − issues = stock on hand', () => {
  for (const store of sc.production.stores.values()) {
    const sum = new Map(store.opening);
    for (const e of store.ledger) sum.set(e.item, (sum.get(e.item) || 0) + e.qty);
    for (const [item, qty] of store.stock) assert.equal(qty, sum.get(item) || 0, `${store.name}: ${item}`);
    for (const [item, qty] of store.stock) assert.ok(qty >= 0, `${store.name}: ${item} went negative (${qty})`);
  }
});

test('the hand trades are kept busy but not swamped', () => {
  const finishers = world.people.filter((p) => p.trade === 'Finisher');
  const out = finishers.reduce((a, p) => a + (p.output || 0), 0);
  assert.ok(out > 400, `finishers erected ${out} machines`);
});
