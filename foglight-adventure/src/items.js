// Item definitions (what you get and what it says) and what each equipped
// item does when you press its button.

import { Boomerang, Arrow, Bomb, FrostBolt } from './projectiles.js';

const autoEquip = (g, id) => {
  const eq = g.save.equip;
  if (eq.includes(id)) return;
  const free = eq.indexOf(null);
  if (free >= 0) eq[free] = id; else eq[1] = id;
};

export const ITEM_ORDER = ['boomerang', 'bombs', 'bow', 'feather', 'frost'];

export const ITEMS = {
  boomerang: {
    name: 'Leafarang', model: 'boomerang', big: true,
    desc: 'Flies out and back. Stuns monsters, fetches far-off things, hits distant switches. It can carry a flame from a lit torch.',
    give: (g) => { g.save.items.boomerang = true; autoEquip(g, 'boomerang'); },
    text: 'You got the LEAFARANG!\nA springy leaf that always flies home. Throw it to stun monsters, fetch shells from far away and hit distant switches.',
  },
  bombs: {
    name: 'Puffball Bombs', model: 'bomb', big: true,
    desc: 'Place one, then stand back! Breaks cracked walls and boulders. You can pick a bomb up and throw it.',
    give: (g) => { g.save.items.bombs = true; g.save.bombs = g.save.maxBombs; autoEquip(g, 'bombs'); },
    text: 'You got PUFFBALL BOMBS!\nPlace one, then stand well back. They\'ll crack open walls and boulders. You can also pick a lit bomb up and throw it.',
  },
  bow: {
    name: 'Reed Bow', model: 'bow', big: true,
    desc: 'Shoots arrows a long way. An arrow through a flame becomes a fire arrow.',
    give: (g) => { g.save.items.bow = true; g.save.arrows = Math.max(g.save.arrows, 20); autoEquip(g, 'bow'); },
    text: 'You got the REED BOW!\nIt shoots arrows a long, long way. Shoot through a flame to make a fire arrow!',
  },
  feather: {
    name: 'Gull Feather', model: 'feather', big: true,
    desc: 'Lets you jump! Hop over holes, water gaps and low attacks.',
    give: (g) => { g.save.items.feather = true; autoEquip(g, 'feather'); },
    text: 'You got the GULL FEATHER!\nHold it high and you\'ll leap like a seagull. Jump over holes and narrow water!',
  },
  frost: {
    name: 'Frost Wand', model: 'frostwand', big: true,
    desc: 'Shoots a frost bolt. Freezes water into a path of ice, and monsters into ice blocks you can push.',
    give: (g) => { g.save.items.frost = true; autoEquip(g, 'frost'); },
    text: 'You got the FROST WAND!\nIts bolt freezes water into a path of ice, and freezes monsters into blocks you can push around. (They don\'t stay frozen for long!)',
  },
  heartPiece: {
    model: 'heartPiece',
    give: (g) => {
      g.save.heartPieces++;
      if (g.save.heartPieces >= 4) { g.save.heartPieces -= 4; g.save.hearts++; g.save.hp = g.save.hearts * 2; g.justGotHeart = true; } else g.justGotHeart = false;
    },
    text: (g) => g.justGotHeart ? 'You got a PIECE OF HEART!\nThat makes four, and a whole new heart. You feel sturdier already!' : `You got a PIECE OF HEART!\nCollect ${4 - g.save.heartPieces} more to make a new heart.`,
  },
  heartContainer: {
    model: 'heartContainer', big: true,
    give: (g) => { g.save.hearts++; g.save.hp = g.save.hearts * 2; },
    text: 'You got a HEART CONTAINER!\nYour life has grown by one heart, and is fully restored.',
  },
  key: { model: 'key', text: 'You found a SMALL KEY!\nIt opens one locked door in this place.' },
  bigKey: {
    model: 'bigKey', big: true,
    give: (g) => { g.save.bigKeys[g.area.def.dungeon] = true; },
    text: 'You got the BIG KEY!\nIt opens the great sealed door deep in this place.',
  },
  sunstone: {
    model: 'sunstone', big: true,
    give: (g) => { g.save.items.sunstone = true; g.save.flags.sunstone = true; },
    text: 'You got the SUNSTONE!\nIt is warm as a summer afternoon. This is what the lighthouse needs!',
  },
  luckyShell: {
    model: 'luckyShell',
    give: (g) => { g.save.items.luckyShell = true; },
    text: 'You found a swirly, shiny shell!\nThis must be MILL\'S LUCKY SHELL. She\'ll be so pleased.',
  },
  shells5: { model: 'shell5', text: 'You got 5 shells!' },
  shells20: { model: 'shell20', text: 'You got 20 shells!' },
  shells50: { model: 'shell50', text: 'You got 50 shells! What a haul!' },
  arrowsChest: { model: 'arrowsPickup', text: 'You got some arrows!' },
  bombRefill: {
    model: 'bombsPickup',
    canBuy: (g) => !g.save.items.bombs ? 'You\'ll need a bomb bag to carry those, dear.' : g.save.bombs >= g.save.maxBombs ? 'Your bomb bag is already full!' : true,
    give: (g) => { g.save.bombs = g.save.maxBombs; },
    text: 'Your bomb bag is full again!',
  },
  arrowRefill: {
    model: 'arrowsPickup',
    canBuy: (g) => !g.save.items.bow ? 'Arrows aren\'t much use without a bow, are they?' : g.save.arrows >= g.save.maxArrows ? 'Your quiver is already full!' : true,
    give: (g) => { g.save.arrows = g.save.maxArrows; },
    text: 'Your quiver is full again!',
  },
  heartRefill: {
    model: 'heart',
    canBuy: (g) => g.save.hp >= g.save.hearts * 2 ? 'You look perfectly healthy to me!' : true,
    give: (g) => { g.save.hp = g.save.hearts * 2; },
    text: 'A cup of seaweed tea. You feel completely refreshed!',
  },
};

export function makeItemActions(g) {
  return {
    boomerang(p) {
      if (g.entities.some((e) => e instanceof Boomerang && !e.dead)) return;
      g.add(new Boomerang(g, p));
      p.setState('item'); p.itemPose = 'throw';
      g.audio.sfx('throw');
    },
    bombs(p) {
      if (g.save.bombs <= 0) { g.audio.sfx('error'); return; }
      if (g.entities.filter((e) => e instanceof Bomb && !e.dead).length >= 2) return;
      g.save.bombs--;
      let [x, z] = p.frontPoint(0.6);
      if (g.isBlocked({ bodyHw: 0.2, avoidPits: true }, x, z, 0.2)) { x = p.x; z = p.z; }
      g.add(new Bomb(g, x, z, p));
      g.audio.sfx('bombPlace');
      p.setState('item'); p.itemPose = 'throw';
    },
    bow(p) {
      if (g.save.arrows <= 0) { g.audio.sfx('error'); return; }
      if (g.entities.filter((e) => e instanceof Arrow && !e.dead).length >= 2) return;
      g.save.arrows--;
      p.setState('item'); p.itemPose = 'bow';
      g.after(0.08, () => { g.add(new Arrow(g, p)); g.audio.sfx('arrow'); });
    },
    feather(p) {
      if (!p.grounded || p.state !== 'normal') return;
      p.vy = 5.4;
      p.y = 0.01;
      g.audio.sfx('jump');
    },
    frost(p) {
      if (g.entities.some((e) => e instanceof FrostBolt && !e.dead)) return;
      g.add(new FrostBolt(g, p));
      p.setState('item'); p.itemPose = 'wand';
      g.audio.sfx('frost');
    },
  };
}
