// Headless soak test: runs every map with every traffic pattern and reports
// how well the crowd flows. Usage: node test/soak.js [seconds] [agents] [map] [pattern]
const Sim = require('../sim.js');
const secs = +process.argv[2] || 60, count = +process.argv[3] || 160;
const onlyMap = process.argv[4], onlyPat = process.argv[5];
const dims = process.env.PORTRAIT ? [34, 54] : [54, 34];
const dt = 1 / 60;
let bad = 0;
console.log('map       pattern  arr/min  pace  stuck  maxStuck  overlap  inWall  ms/tick');
for (const map of Sim.MAPS) {
  if (onlyMap && onlyMap !== '-' && map.id !== onlyMap) continue;
  for (const pid of Object.keys(Sim.PATTERNS)) {
    if (onlyPat && pid !== onlyPat) continue;
    const w = new Sim.World(dims[0], dims[1], 3);
    if (process.env.NOSIG) w.opts.signals = false;
    if (process.env.NOREROUTE) w.opts.reroute = false;
    w.setWalls(Sim.buildMap(map.id, dims[0], dims[1], 11));
    w.setPattern(pid, count);
    let arrivals = 0, lateArrivals = 0, paceSum = 0, n = 0, maxStuck = 0, maxOverlap = 0, inWall = 0, stuckEnd = 0;
    const t0 = process.hrtime.bigint();
    const steps = Math.round(secs / dt);
    for (let i = 0; i < steps; i++) {
      const before = w.arrivalTimes.length ? w.arrivalTimes[w.arrivalTimes.length - 1] : -1;
      w.step(dt);
      const at = w.arrivalTimes;
      for (let j = at.length - 1; j >= 0 && at[j] > before; j--) { arrivals++; if (i > steps * 2 / 3) lateArrivals++; }
      if (i > steps / 4) { paceSum += w.stats.pace; n++; }
      if (i % 30 === 0) {
        for (const a of w.agents) {
          if (a.stuck > maxStuck) maxStuck = a.stuck;
          if (w.wall[w.cellOf(a)]) inWall++;
        }
        for (let p = 0; p < w.agents.length; p++) for (let q = p + 1; q < w.agents.length; q++) {
          const a = w.agents[p], b = w.agents[q];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (0.6 - d > maxOverlap) maxOverlap = 0.6 - d;
        }
      }
    }
    stuckEnd = w.stats.stuck;
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / steps;
    const pace = paceSum / n;
    // Fail on real trouble: nothing getting through any more, a body inside a
    // wall, or two bodies well inside each other. A long queue is not a failure.
    const flag = (lateArrivals === 0 || inWall > 0 || maxOverlap > 0.25) ? '  <<<' : '';
    if (flag) bad++;
    console.log(`${map.id.padEnd(9)} ${pid.padEnd(8)} ${String(Math.round(arrivals / secs * 60)).padStart(7)}  ${pace.toFixed(2)}  ${String(stuckEnd).padStart(5)}  ${maxStuck.toFixed(1).padStart(8)}  ${maxOverlap.toFixed(3).padStart(7)}  ${String(inWall).padStart(6)}  ${ms.toFixed(3)}${flag}`);
  }
}
process.exitCode = bad ? 1 : 0;
