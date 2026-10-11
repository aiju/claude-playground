import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim, wait, until, Signal, Resource } from '../engine/sim/kernel.js';
import { Calendar, Timetable } from '../engine/sim/calendar.js';
import { lsd, d, s, gns, fmt, short, price, columns } from '../engine/sim/money.js';
import { Rng } from '../engine/sim/rng.js';

test('kernel runs processes in time order', () => {
  const sim = new Sim();
  const seen = [];
  sim.spawn((function* () { yield wait(10); seen.push(['a', sim.now]); yield wait(5); seen.push(['a', sim.now]); })(), 'a');
  sim.spawn((function* () { yield until(12); seen.push(['b', sim.now]); })(), 'b');
  sim.runUntil(100);
  assert.deepEqual(seen, [['a', 10], ['b', 12], ['a', 15]]);
  assert.equal(sim.now, 100);
});

test('signals and resources', () => {
  const sim = new Sim();
  const sig = new Signal();
  const res = new Resource(sim, 1);
  const log = [];
  sim.spawn((function* () { const v = yield sig; log.push(`got ${v} at ${sim.now}`); })(), 'waiter');
  sim.spawn((function* () { yield wait(3); sig.fire('x'); })(), 'firer');
  for (const name of ['p', 'q']) {
    sim.spawn((function* () { yield res.request(); log.push(`${name} in ${sim.now}`); yield wait(4); res.release(); })(), name);
  }
  sim.runUntil(20);
  assert.deepEqual(log, ['p in 0', 'got x at 3', 'q in 4']);
});

test('calendar knows 1913', () => {
  const cal = new Calendar({ year: 1913 });
  const t = cal.at(1913, 3, 3, 10, 42);
  assert.equal(cal.longDate(t), 'Monday 3 March 1913');
  assert.equal(cal.docDate(t), '3rd March, 1913');
  assert.equal(cal.clockTime(t), '10.42 a.m.');
  assert.equal(cal.clockTime(cal.at(1913, 3, 3, 12)), '12 noon');
  assert.equal(cal.dayName(cal.at(1913, 3, 21)), 'Friday'); // Good Friday
  assert.equal(cal.dayName(cal.at(1913, 12, 25)), 'Thursday');
});

test('timetable spells, holidays and hours', () => {
  const cal = new Calendar({ year: 1913 });
  const tt = new Timetable(cal, {
    days: { 1: [[360, 480], [510, 750], [810, 1020]], 2: [[360, 480]], 6: [[360, 480], [510, 720]] },
    holidays: ['1913-03-24'],
  });
  const mon = cal.at(1913, 3, 3);
  assert.deepEqual(tt.currentSpell(mon + 400), [mon + 360, mon + 480]);
  assert.equal(tt.currentSpell(mon + 490), null);
  assert.deepEqual(tt.nextSpell(mon + 490), [mon + 510, mon + 750]);
  // Easter Monday is a holiday, so after Saturday the next spell is Tuesday.
  const sat = cal.at(1913, 3, 22);
  assert.deepEqual(tt.nextSpell(sat + 800), [cal.at(1913, 3, 25, 6), cal.at(1913, 3, 25, 8)]);
  assert.equal(tt.workingMinutes(mon, mon + 1440), 120 + 240 + 210);
});

test('money in pounds, shillings and pence', () => {
  assert.equal(lsd(1), 960);
  assert.equal(gns(1), lsd(1, 1));
  assert.equal(fmt(lsd(7, 15)), '£7 15s. 0d.');
  assert.equal(fmt(s(38)), '£1 18s. 0d.');
  assert.equal(fmt(s(38), { shillings: true }), '38s. 0d.');
  assert.equal(short(s(38)), '38/-');
  assert.equal(fmt(d(10.25)), '10¼d.');
  assert.equal(fmt(d(10.25) * 53, { shillings: true }), '45s. 3¼d.');
  assert.equal(short(lsd(0, 7, 6)), '7/6');
  assert.equal(short(s(27)), '27/-');
  assert.equal(price(gns(13)), '13 gns.');
  assert.equal(price(lsd(5, 15)), '£5 15s. 0d.');
  assert.deepEqual(columns(lsd(12, 3, 4.5)), { neg: false, l: '12', s: '3', d: '4½' });
});

test('rng is repeatable', () => {
  const a = new Rng(7);
  const b = new Rng(7);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const c = new Rng(8);
  assert.notEqual(new Rng(7).next(), c.next());
});
