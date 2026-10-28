// A scripted playthrough of the whole game, from Nan's intro to the ending,
// run headless in Chromium. It pauses rendering and drives the real game
// logic with simulated button presses, checking that every puzzle can be
// solved the way a player would solve it. Needs Playwright (npm install),
// then: npm test

import { chromium } from 'playwright';
import { serve } from './serve.mjs';

// ---------------------------------------------------------------- harness
// Runs in the page: window.T steps the game and fakes input.
function harness() {
  window.__paused = true;
  const g = window.game, inp = window.input;
  const T = window.T = {
    fails: 0,
    step(n = 1) { for (let i = 0; i < n; i++) { inp.poll(); g.update(1 / 60); } },
    secs(s) { T.step(Math.round(s * 60)); },
    hold(a, s) { inp.held.add(a); T.secs(s); inp.held.delete(a); T.step(1); },
    press(a) { inp.fresh.add(a); inp.held.add(a); T.step(1); inp.held.delete(a); T.step(2); },
    keyDown(a) { inp.held.add(a); },
    keyUp(a) { inp.held.delete(a); },
    until(fn, secs = 10) { for (let i = 0; i < secs * 60; i++) { if (fn()) return true; T.step(1); } return false; },
    // put the hero somewhere (loading the area/screen if needed)
    at(area, x, z, dir = 0) {
      const p = g.player;
      p.x = x; p.z = z; p.vx = 0; p.vz = 0; p.dir = dir; p.setState('normal');
      const [sx, sy] = g.getArea(area).screenOf(x, z);
      if (g.area?.id !== area || sx !== g.sx || sy !== g.sy) g.loadArea(area, x, z);
      g.mode = 'play'; g.fade = 0; g.fadeAnim = null;
      T.step(2);
    },
    face(d) { g.player.dir = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 }[d]; },
    dialogs() { let n = 0; while (g.ui.dlg && n < 40) { T.press('action'); T.secs(0.1); n++; } },
    ents(pred) { return g.entities.filter(pred); },
    // clear the room of monsters (we're testing puzzles here, not reflexes)
    killAll() {
      for (let k = 0; k < 10; k++) {
        const es = T.ents((e) => e.isEnemy && !e.dead && !e.isBoss);
        if (!es.length) break;
        es.forEach((e) => e.die());
        T.step(2);
      }
    },
    log(...a) { console.log('T: ' + a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); },
    check(name, ok) { console.log('T: ' + (ok ? '  ok    ' : '  FAIL  ') + name); if (!ok) T.fails++; },
  };
  g.ui.titleState = null;
  g.ui.el.title.classList.add('hidden');
  g.newGame();
  T.secs(1.5);
  T.dialogs();
}

// ---------------------------------------------------------------- the run
function playthrough() {
  const g = window.game, T = window.T;
  const openChest = (x, z, d) => { T.at(g.area.id, x, z); T.face(d); T.press('sword'); T.secs(0.6); T.dialogs(); T.secs(0.2); };
  const blockAt = () => T.ents((e) => e.constructor.name === 'Block')[0];
  g.save.hearts = 20; g.save.hp = 40; // plenty of health: this checks puzzles, not dodging

  T.check('Nan\'s intro', g.flag('intro'));
  T.hold('down', 1.6); T.secs(1.0);
  T.check('out of the house into Mossbrook', g.area.id === 'overworld' && g.sx === 1 && g.sy === 1);
  T.at('overworld', 25.5, 16.5); T.face('right'); T.press('sword'); T.dialogs();
  T.check('Elder Moss gives the quest', g.flag('metElder'));

  // the sword works on a slime
  T.at('overworld', 8.5, 6.5);
  const sl = T.ents((e) => e.isEnemy)[0];
  for (let i = 0; i < 4 && sl && !sl.dead; i++) { sl.x = 8.5; sl.z = 7.6; sl.y = 0; sl.wait = 99; T.face('down'); T.press('sword'); T.secs(0.45); }
  T.check('the sword beats a slime', !sl || sl.dead);

  // Whispering Grotto: push the block onto the plate
  T.at('grotto', 22.5, 18.5, Math.PI / 2); T.killAll();
  let blk = blockAt();
  T.keyDown('right'); T.until(() => blk.x >= 26.5 && !blk.anim, 8); T.keyUp('right'); T.secs(0.2);
  T.at('grotto', 26.5, 19.6, Math.PI);
  T.keyDown('up'); T.until(() => blk.z <= 17.5 && !blk.anim, 5); T.keyUp('up'); T.secs(1);
  T.check('grotto block puzzle', g.flag('grottoBlocks'));
  T.at('grotto', 23.5, 9.4, Math.PI); T.secs(0.6); T.killAll(); T.secs(1);
  T.check('grotto ambush cleared', g.flag('grottoTreasure'));
  openChest(24.5, 8.6, 'up');
  T.check('the Leafarang', !!g.save.items.boomerang);

  // Riverside: the lever across the water
  T.at('overworld', 37.5, 15.5); T.face('right'); T.press('item1'); T.secs(1.5);
  T.check('Leafarang hits the far lever', g.flag('bridgeDown'));
  T.secs(1.5);
  T.at('overworld', 37.4, 16.5); T.hold('right', 1.2);
  T.check('across the drawbridge', g.player.x > 41);

  // Old Ruins and Mirror Lake
  T.at('overworld', 44.5, 6.5); T.killAll();
  openChest(44.5, 4.4, 'up');
  T.check('Puffball Bombs', !!g.save.items.bombs && g.save.bombs === 10);
  T.at('overworld', 42.5, 28.5); T.face('left'); T.killAll();
  T.press('item2'); T.hold('right', 0.8); T.secs(2.6);
  T.check('bomb clears the boulder', g.flag('boulder:overworld:41,28'));
  T.at('overworld', 35.5, 28.5); T.hold('up', 1.0); T.secs(1.0);
  T.check('into the Drowned Shrine', g.area.id === 'shrine');

  // Shrine: carry fire to the four torches
  T.at('shrine', 39.5, 28.5); T.killAll();
  for (const [x, z, d] of [[39.5, 28.6, 'up'], [39.5, 26.4, 'down'], [40.6, 27.5, 'left'], [38.4, 27.5, 'right']]) {
    T.at('shrine', x, z); T.face(d); T.press('item1'); T.secs(1.6);
  }
  T.secs(1);
  T.check('torches lit with a burning Leafarang', g.flag('shrineTorches'));
  openChest(44.5, 30.5, 'up');
  T.check('small key 1', g.save.keys.shrine === 1);
  T.at('shrine', 17.6, 27.5); T.hold('left', 2.0); T.secs(0.5);
  T.check('unlock the hub door', g.sx === 0 && g.sy === 2 && g.save.keys.shrine === 0);
  T.secs(1); T.killAll(); T.secs(1);
  T.check('Big Gloop (and all its little Gloops)', g.flag('shrineGloop'));
  openChest(7.5, 30.4, 'up');
  T.check('the Gull Feather', !!g.save.items.feather);
  g.save.equip = ['boomerang', 'feather'];

  // jump the hub channel and the pit row
  T.at('shrine', 23.5, 26.6); T.face('up'); T.press('item2'); T.hold('up', 0.75); T.secs(0.3);
  T.check('jump the hub channel', g.player.z < 25 && g.player.state === 'normal');
  T.hold('up', 1.0); T.secs(0.8);
  T.check('into the crystal room', g.sx === 1 && g.sy === 1);
  T.at('shrine', 23.5, 18.6); T.face('up'); T.press('item2'); T.hold('up', 0.75); T.secs(0.3);
  T.check('jump the pits', g.player.z < 17 && g.player.state !== 'fall');
  T.at('shrine', 23.5, 15.5); T.face('up'); T.press('sword'); T.secs(0.5);
  T.check('crystal switch lowers the red blocks', g.save.flags['crystal:shrine'] === 1);
  T.at('shrine', 27.5, 16.5); T.hold('right', 2.2); T.secs(0.5);
  T.check('through to the ice room', g.sx === 2 && g.sy === 1);

  // slide the block across the ice onto the heavy plate
  T.killAll();
  blk = blockAt();
  T.at('shrine', 36.5, 19.5); T.keyDown('up'); T.until(() => blk.z <= 14.5 && !blk.anim, 5); T.keyUp('up'); T.secs(0.5);
  T.at('shrine', 35.3, 14.5); T.keyDown('right'); T.until(() => blk.x >= 43.5 && !blk.anim, 5); T.keyUp('right'); T.secs(1);
  T.check('ice-slide puzzle', g.flag('shrineIce'));
  openChest(39.5, 19.3, 'down');
  T.check('small key 2', g.save.keys.shrine === 1);
  T.at('shrine', 23.5, 15.5); T.face('up'); T.press('sword'); T.secs(0.7);
  T.check('crystal switch back again', !g.save.flags['crystal:shrine']);
  T.at('shrine', 17.6, 16.5); T.hold('left', 2.2); T.secs(0.5);
  T.check('unlock the Frost Wand vault', g.sx === 0 && g.sy === 1);
  openChest(7.5, 20.3, 'up');
  T.check('the Frost Wand', !!g.save.items.frost);
  g.save.equip = ['frost', 'feather'];

  // freeze paths across the water
  T.at('shrine', 7.5, 15.4); T.face('up'); T.press('item1'); T.secs(0.8);
  T.check('a frost bolt freezes a path', g.isFrozen(7, 13) && g.isFrozen(7, 14));
  T.hold('up', 2.0); T.secs(0.6);
  T.check('across the ice to the Big Key isle', g.sx === 0 && g.sy === 0);
  T.killAll();
  T.at('shrine', 7.5, 9.5); T.face('up'); T.press('item1'); T.secs(0.8); T.hold('up', 0.75); T.secs(0.2);
  openChest(7.5, 6.4, 'up');
  T.check('the Big Key', !!g.save.bigKeys.shrine);

  // Deepcoil: freeze it when it surfaces, then strike
  T.at('shrine', 23.5, 12.5); T.hold('up', 2.0); T.secs(1.5);
  T.check('through the great door', g.sx === 1 && g.sy === 0);
  const boss = T.ents((e) => e.isBoss)[0];
  T.check('Deepcoil rises', !!boss);
  for (let round = 0; boss && !boss.dead && round < 40; round++) {
    T.until(() => boss.surfaced() && ['rise', 'spit', 'lunge'].includes(boss.state), 15);
    if (round === 0) T.check('Deepcoil shrugs off the sword until it is frozen', boss.hurt({ type: 'sword', x: boss.x, z: boss.z + 1 }) === 'block');
    boss.hurt({ type: 'frost' });
    for (let i = 0; i < 3; i++) { T.secs(0.35); boss.hurt({ type: 'sword', dmg: 1 }); }
    T.secs(0.5);
    if (boss.dying) T.until(() => boss.dead, 5);
  }
  T.secs(2);
  T.check('Deepcoil defeated', g.flag('shrineBoss'));
  const sun = T.ents((e) => e.kind === 'sunstone')[0];
  if (sun) { T.at('shrine', sun.x, sun.z + 0.3); T.secs(0.6); T.dialogs(); }
  T.check('the Sunstone', !!g.save.items.sunstone);

  // Gull Point and the lighthouse
  T.at('overworld', 55.5, 5.5); T.face('right'); T.press('item1'); T.secs(0.6);
  T.keyDown('right'); T.until(() => g.player.x >= 60.3, 4); T.keyUp('right'); T.step(2);
  T.hold('up', 0.8); T.secs(1);
  T.check('freeze the sea and enter the lighthouse', g.area.id === 'lighthouse');
  T.killAll();
  g.save.equip = ['boomerang', 'feather'];
  T.at('lighthouse', 8.6, 5.5); T.face('left'); T.press('item1'); T.secs(1.6);
  T.at('lighthouse', 6.4, 5.5); T.face('right'); T.press('item1'); T.secs(1.6);
  T.check('lighthouse torches open the gate', g.flag('lhTorches'));
  T.secs(1); T.at('lighthouse', 7.5, 3.0); T.hold('up', 1.0); T.secs(1);
  T.check('up to the second floor', g.sx === 1);
  T.at('lighthouse', 25.5, 4.6); T.killAll(); T.face('up'); T.press('item2'); T.hold('up', 0.75); T.secs(0.3);
  T.check('jump the gap', g.player.z < 3 && g.player.state === 'normal');
  T.hold('left', 0.8); T.hold('up', 1.0); T.secs(1);
  T.check('up to the lamp room', g.sx === 2);
  T.secs(1.5);

  // the Gloom: light all four torches from the lamp's pilot flame, then strike
  const gloom = T.ents((e) => e.isBoss)[0];
  T.check('the Gloom appears', !!gloom);
  for (let round = 0; gloom && !gloom.dead && round < 12; round++) {
    T.until(() => gloom.state === 'drift', 8);
    // each throw passes through the pilot flame and carries it to one torch
    const throws = [[39.5, 6.6, 'up', 39.5, 2.5], [39.5, 4.4, 'down', 39.5, 8.5], [40.6, 5.5, 'left', 36.5, 5.5], [38.4, 5.5, 'right', 42.5, 5.5]];
    for (let tries = 0; tries < 3; tries++) {
      T.killAll();
      for (const [x, z, d, tx, tz] of throws) {
        const torch = T.ents((e) => e.isTorch && Math.hypot(e.x - tx, e.z - tz) < 0.3)[0];
        if (!torch || torch.lit || gloom.state === 'exposed') continue;
        T.at('lighthouse', x, z); T.face(d); T.press('item1'); T.secs(1.7);
      }
    }
    if (gloom.state === 'exposed') { gloom.hurt({ type: 'spin' }); T.secs(0.4); gloom.hurt({ type: 'spin' }); T.secs(0.4); }
    if (gloom.dying) T.until(() => gloom.dead, 5);
  }
  T.secs(3); T.dialogs();
  T.check('the Gloom scattered', g.flag('gloomDefeated'));
  T.at('lighthouse', 39.5, 6.6); T.face('up'); T.press('sword'); T.secs(0.3);
  T.until(() => g.ui.dlg && g.ui.dlg.done, 4); T.press('sword'); T.secs(7);
  T.check('the Sunstone lights the lighthouse', g.flag('lighthouseLit'));
  T.check('the credits roll', g.mode === 'credits');
}

// ---------------------------------------------------------------- run it
const server = await serve(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('page error:', e.message));
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('T: ')) console.log(t.slice(3)); else if (m.type() === 'error') console.log(t);
});
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.waitForFunction(() => window.game && window.input);
await page.waitForTimeout(500);
await page.evaluate(harness);
await page.evaluate(playthrough);
const fails = await page.evaluate(() => window.T.fails);
console.log(fails ? `\n${fails} check(s) failed` : '\nevery check passed');
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
