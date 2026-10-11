import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../scenarios/coventry-1913/index.js';

test('a Monday at the Sherbourne Works', () => {
  const sc = createScenario({ seed: 1 });
  const { sim, cal, world } = sc;
  const at = (h, m = 0) => cal.at(1913, 3, 3, h, m);
  const onSite = () => world.people.filter((p) => p.onSite).length;
  const hands = world.people.filter((p) => p.role !== 'staff');

  assert.ok(world.people.length >= 400, `${world.people.length} people`);
  sim.runUntil(at(5, 40));
  assert.ok(onSite() < 60, `at 5.40 a.m. ${onSite()} on site`);

  sim.runUntil(at(7));
  const clockedIn = hands.filter((p) => p.record.some((r) => r.kind === 'in')).length;
  assert.ok(clockedIn > hands.length * 0.9, `${clockedIn} of ${hands.length} hands clocked in by 7 a.m.`);
  assert.ok(sc.engineRunning(sim.now));

  sim.runUntil(at(8, 10));
  assert.ok(!sc.engineRunning(sim.now), 'engine stops for breakfast');

  sim.runUntil(at(10, 30));
  const atWork = world.people.filter((p) => p.onSite && !p.motion).length;
  assert.ok(atWork > 380, `${atWork} at work at 10.30 a.m.`);

  sim.runUntil(at(12, 50));
  assert.ok(onSite() < world.people.length - 120, `${onSite()} still on site at dinner`);

  sim.runUntil(at(15));
  assert.ok(onSite() > 380, `${onSite()} back after dinner`);

  sim.runUntil(at(19, 30));
  assert.equal(onSite(), 0, 'everyone has gone home by half past seven');

  // Tuesday morning they all come back.
  sim.runUntil(cal.at(1913, 3, 4, 10));
  assert.ok(onSite() > 380);
  assert.deepEqual(sim.errors, []);
});

test('the same seed replays the same day', () => {
  const run = () => {
    const sc = createScenario({ seed: 42 });
    sc.sim.runUntil(sc.cal.at(1913, 3, 3, 9));
    return sc.world.people.map((p) => p.record.map((r) => r.t.toFixed(3)).join(',')).join('|');
  };
  assert.equal(run(), run());
});
