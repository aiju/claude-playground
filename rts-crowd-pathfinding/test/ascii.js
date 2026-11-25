// Debug view: node test/ascii.js map pattern seconds [agents]
const Sim = require('../sim.js');
const [map, pid, secs, count] = [process.argv[2], process.argv[3], +process.argv[4] || 20, +process.argv[5] || 160];
const W = 54, H = 34, dt = 1 / 60;
const w = new Sim.World(W, H, 3);
if (process.env.NOSIG) w.opts.signals = false;
w.setWalls(Sim.buildMap(map, W, H, 11));
w.setPattern(pid, count);
for (let i = 0; i < secs / dt; i++) w.step(dt);
const g = [];
for (let y = 0; y < H; y++) { g.push([]); for (let x = 0; x < W; x++) g[y].push(w.wall[x + y * W] ? '#' : (w.narrow[x + y * W] ? '-' : ' ')); }
for (const m of w.markers) g[m.y | 0][m.x | 0] = m.label;
for (const a of w.agents) {
  const ch = a.state === 1 ? 'i' : a.waiting ? 'w' : a.flushed ? 'f' : a.lost ? '?' : a.stuck > 3 ? 'S' : String(a.team);
  g[a.y | 0][a.x | 0] = ch;
}
console.log(g.map((r) => r.join('')).join('\n'));
for (const s of w.segs) console.log(`seg ${s.id} axis${s.axis} fixed${s.fixed} ${s.lo}-${s.hi} dir=${s.dir} drain=${s.draining} inside=${s.inside} want=${s.want} green=${(w.time - s.since).toFixed(1)}`);
console.log(w.stats);
