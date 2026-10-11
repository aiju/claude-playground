import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../scenarios/coventry-1913/index.js';
import { paidMinutes, healthContribution, coinsFor } from '../scenarios/coventry-1913/paper.js';
import { lsd, s, d } from '../engine/sim/money.js';
import { Calendar, Timetable } from '../engine/sim/calendar.js';

// The first wages week: cards ending Wednesday 5 March 1913, paid on Friday 7th.
const sc = createScenario({ seed: 21 });
const { sim, cal, world } = sc;
sim.runUntil(cal.at(1913, 3, 8, 13));
const W = world.wages;
const week = W.weeks[0];

test('runs without errors', () => {
  assert.deepEqual(sim.errors.map((e) => `${e.process}: ${e.err.message}`), []);
});

test('every hand and foreman has a pay slip', () => {
  const expected = world.people.filter((p) => p.role === 'hand' || p.role === 'foreman').length;
  assert.equal(week.results.length, expected);
});

test('the cheque is for exactly the net wages, and every tin is paid or reported', () => {
  const net = week.results.reduce((a, r) => a + r.net, 0);
  assert.equal(week.total, net);
  assert.equal(week.cheque.fields.amount, net);
  const coins = coinsFor(net);
  assert.ok(Object.keys(coins).length > 0);
  const paid = week.results.filter((r) => r.paid);
  const unclaimed = week.unclaimed.fields.tins;
  assert.equal(paid.length + unclaimed.length, week.results.length);
  assert.equal(paid.reduce((a, r) => a + r.net, 0) + week.unclaimed.fields.total, net);
});

test('wages are in the right range', () => {
  const avg = week.total / week.results.length;
  assert.ok(avg > s(22) && avg < s(36), `average net ${avg / 48} shillings`);
  const fitters = week.results.filter((r) => r.p.trade === 'Fitter');
  for (const r of fitters) assert.ok(r.gross >= r.timeWages, 'piece never below the day rate');
});

test('insurance stamps are bought and fixed', () => {
  assert.equal(W.stampsBought, week.ending);
  const book = world.paper.books.get('stamp-book').entries;
  assert.equal(book.length, 2);
  const men = week.results.filter((r) => r.p.sex === 'M' && r.p.age >= 21 && r.hours > 0 && r.gross > s(15));
  for (const r of men.slice(0, 20)) assert.equal(r.health.worker, d(4));
});

test('lateness costs a quarter of an hour', () => {
  const c = new Calendar({ year: 1913 });
  const tt = new Timetable(c, { days: { 1: [[360, 480], [510, 750], [810, 1020]] } });
  const mon = c.at(1913, 3, 3);
  const card = (inAt) => ({ fields: { punches: [{ t: mon + inAt, kind: 'in' }, { t: mon + 1021, kind: 'out' }] } });
  assert.equal(paidMinutes(card(355), tt), 570);
  assert.equal(paidMinutes(card(364), tt), 570); // within the five minutes' grace
  assert.equal(paidMinutes(card(368), tt), 555); // loses a quarter
});

test('reduced contributions for low-paid adults (Second Schedule)', () => {
  const man = { age: 30, sex: 'M' };
  assert.deepEqual(healthContribution(man, s(36)), { worker: d(4), employer: d(3) });
  assert.deepEqual(healthContribution(man, s(8)), { worker: 0, employer: d(6) });
  assert.deepEqual(healthContribution({ age: 17, sex: 'F' }, s(8)), { worker: d(3), employer: d(3) });
});
