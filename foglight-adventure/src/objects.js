// World objects: pickups, cuttable and liftable things, puzzle pieces,
// doors and warps, chests, signs and the people of the island.

import { Entity, Actor } from './entity.js';
import { T, TILE, SW, SH } from './tiles.js';
import { clamp, lerp, rand, angleDiff, hexLin } from './math.js';
import { createEnemy } from './enemies.js';
import { ITEMS } from './items.js';
import { GreatLamp } from './bosses.js';

// ---------------- factory ----------------
export function createEntity(g, s, sid) {
  const x = s.tx + 0.5, z = s.ty + 0.5;
  switch (s.type) {
    case 'bush': return new Bush(g, x, z, s);
    case 'tallgrass': return new TallGrass(g, x, z, s);
    case 'pot': return new Pot(g, x, z, s);
    case 'rock': return new Rock(g, x, z, s);
    case 'boulder': return g.flag('boulder:' + sid) ? null : new Boulder(g, x, z, s, sid);
    case 'block': return new Block(g, x, z, s);
    case 'chest': return new Chest(g, x, z, s, sid);
    case 'sign': return new Sign(g, x, z, s);
    case 'warp': return new Warp(g, x, z, s);
    case 'door': return new Door(g, x, z, s, sid);
    case 'cracked': return g.flag('cracked:' + sid) ? null : new Cracked(g, x, z, s, sid);
    case 'torch': return new Torch(g, x, z, s);
    case 'plate': return new Plate(g, x, z, s);
    case 'crystal': return new Crystal(g, x, z, s);
    case 'toggle': return new Toggle(g, x, z, s);
    case 'npc': return new NPC(g, x, z, s);
    case 'shopitem': return (s.once && g.flag('bought:' + s.item)) ? null : new ShopItem(g, x, z, s);
    case 'pickup': return (s.persist && g.flag('got:' + sid)) ? null : new Pickup(g, x, z, s.kind, { persist: s.persist ? 'got:' + sid : null, float: s.float });
    case 'heart': return g.flag('got:' + sid) ? null : new Pickup(g, x, z, 'heartPiece', { persist: 'got:' + sid, float: true });
    case 'enemy': return s.unlessFlag && g.flag(s.unlessFlag) ? null : createEnemy(g, s, x, z);
    case 'lamp': return new GreatLamp(g, x, z);
    case 'beam': return g.flag('lighthouseLit') ? new Beam(g, x, z) : null;
    case 'bramble': return g.flag('bramble:' + sid) ? null : new Bramble(g, x, z, s, sid);
    case 'stairs': return new Warp(g, x, z, { ...s, look: 'stairs' });
    case 'lever': return new Lever(g, x, z, s, sid);
    case 'bridge': return new DrawBridge(g, x, z, s);
    case 'eye': return new EyeSwitch(g, x, z, s, sid);
    case 'fairy': return new Fairy(g, x, z, s);
    case 'deco': return new Deco(g, x, z, s);
    case 'trigger': return new Trigger(g, x, z, s, sid);
    case 'gate': return new Gate(g, x, z, s);
    default:
      if (s.make) return s.make(g, x, z, s, sid);
      console.warn('unknown entity', s.type);
      return null;
  }
}

// ---------------- loot ----------------
export function dropLoot(g, x, z, chance = 0.45) {
  if (Math.random() > chance) return;
  const sv = g.save;
  const low = sv.hp <= sv.hearts;
  const table = [['shell1', 6], ['heart', low ? 5 : 2.5], ['shell5', 1.2]];
  if (sv.items.bow) table.push(['arrows', sv.arrows < 10 ? 2.5 : 1]);
  if (sv.items.bombs) table.push(['bombs', sv.bombs < 3 ? 2.5 : 1]);
  const total = table.reduce((a, b) => a + b[1], 0);
  let r = Math.random() * total;
  for (const [k, w] of table) {
    r -= w;
    if (r <= 0) { g.add(new Pickup(g, x, z, k, { pop: true, despawn: 9 })); return; }
  }
}

// ---------------- pickups ----------------
const PICKUP_MODEL = {
  heart: 'heart', shell1: 'shell1', shell5: 'shell5', shell20: 'shell20', shell50: 'shell50',
  arrows: 'arrowsPickup', bombs: 'bombsPickup', key: 'key', bigKey: 'bigKey', heartPiece: 'heartPiece', heartContainer: 'heartContainer', luckyShell: 'luckyShell',
};

export class Pickup extends Entity {
  constructor(g, x, z, kind, opts = {}) {
    super(g, x, z);
    this.kind = kind;
    this.r = 0.3;
    this.persist = opts.persist;
    this.despawn = opts.despawn ?? 0;
    this.age = 0;
    this.float = opts.float;
    this.y = opts.pop ? 0.3 : 0;
    this.vy = opts.pop ? 4 : 0;
    this.vx = opts.vx ?? 0; this.vz = opts.vz ?? 0;
    this.spin = Math.random() * 6;
  }
  update(dt) {
    this.age += dt;
    if (this.vy || this.y > 0) {
      this.vy -= 18 * dt; this.y += this.vy * dt;
      this.x += this.vx * dt; this.z += this.vz * dt;
      if (this.y <= 0) { this.y = 0; this.vy = Math.abs(this.vy) > 2 ? -this.vy * 0.35 : 0; }
    }
    if (this.despawn && this.age > this.despawn) { this.dead = true; return; }
    const p = this.game.player;
    if (this.age > 0.25 && Math.hypot(p.x - this.x, p.z - this.z) < 0.55 && p.y < 0.8 && !['dead', 'fall', 'drown'].includes(p.state)) this.collect();
  }
  collect() {
    const g = this.game, s = g.save;
    this.dead = true;
    if (this.persist) g.setFlag(this.persist);
    switch (this.kind) {
      case 'heart': g.healPlayer(2); g.audio.sfx('heart'); break;
      case 'shell1': g.addShells(1); g.audio.sfx('shell'); break;
      case 'shell5': g.addShells(5); g.audio.sfx('shell'); break;
      case 'shell20': g.addShells(20); g.audio.sfx('shellBig'); break;
      case 'shell50': g.addShells(50); g.audio.sfx('shellBig'); break;
      case 'arrows': s.arrows = Math.min(s.maxArrows, s.arrows + 5); g.audio.sfx('pickup'); break;
      case 'bombs': s.bombs = Math.min(s.maxBombs, s.bombs + 3); g.audio.sfx('pickup'); break;
      case 'key': {
        const d = g.area.def.dungeon;
        s.keys[d] = (s.keys[d] || 0) + 1;
        g.audio.sfx('key');
        g.persist();
        break;
      }
      case 'fairy': g.healPlayer(99); g.audio.sfx('fairy'); break;
      default:
        if (ITEMS[this.kind]) g.giveItem(this.kind);
    }
    g.particles.twinkle(this.x, 0.4, this.z);
  }
  draw(r) {
    if (this.despawn && this.age > this.despawn - 2 && Math.floor(this.age * 12) % 2) return;
    const t = this.game.time;
    const fl = this.float ? 0.35 + Math.sin(t * 2.5) * 0.08 : 0.05;
    const big = this.kind === 'heartContainer' || this.kind === 'heartPiece' || this.kind === 'luckyShell';
    r.push(); r.translate(this.x, this.y + fl + (big ? 0.35 : 0), this.z);
    r.rotY(this.kind === 'heart' ? Math.sin(t * 2) * 0.4 : t * 2 + this.spin);
    if (this.kind === 'key') r.translate(0, 0.15, 0);
    r.draw(this.game.models.get(PICKUP_MODEL[this.kind] || this.kind), { rim: 0.4 });
    r.pop();
    r.blob(this.x, 0, this.z, 0.22, 0.25);
    if (big && Math.random() < 0.08) this.game.particles.twinkle(this.x + rand(-0.3, 0.3), 0.6 + rand(0, 0.5), this.z + rand(-0.3, 0.3));
  }
}

// ---------------- cuttables ----------------
class Bush extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.solid = true; this.low = true; this.hw = 0.42; this.r = 0.42;
    this.hide = s.hide;
    this.wob = 0;
  }
  hurt(src) {
    if (!['sword', 'spin', 'boomerang', 'bomb', 'fire', 'arrow', 'thrown'].includes(src.type)) return undefined;
    if (src.type === 'arrow' || src.type === 'boomerang') { this.wob = 0.3; if (src.type === 'arrow') return undefined; }
    this.cut();
    return 'cut';
  }
  cut() {
    const g = this.game;
    this.dead = true;
    g.particles.leaves(this.x, 0.35, this.z, g.models.get('leaf'), 10);
    g.audio.sfx('cut');
    g.add(new Deco(g, this.x, this.z, { model: 'bushStump' }), this.screenKey);
    if (this.hide) revealHidden(g, this, this.hide);
    else dropLoot(g, this.x, this.z, 0.35);
  }
  update(dt) { this.wob = Math.max(0, this.wob - dt); }
  draw(r) {
    const w = this.wob > 0 ? Math.sin(this.wob * 40) * 0.08 : 0;
    r.push(); r.translate(this.x, 0, this.z); r.rotZ(w); r.draw(this.game.models.get('bush')); r.pop();
  }
}

function revealHidden(g, from, hide) {
  if (typeof hide === 'string') g.add(new Pickup(g, from.x, from.z, hide, { pop: true }), from.screenKey);
  else if (hide.type) {
    const e = createEntity(g, { ...hide, tx: Math.floor(from.x), ty: Math.floor(from.z) }, from.spawnId);
    if (e) { g.add(e, from.screenKey); g.audio.sfx('secret'); }
  }
}

class TallGrass extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.r = 0.4;
    this.hide = s.hide;
    this.rustle = 0;
  }
  hurt(src) {
    if (!['sword', 'spin', 'bomb', 'fire', 'boomerang'].includes(src.type)) return undefined;
    const g = this.game;
    this.dead = true;
    g.particles.leaves(this.x, 0.2, this.z, g.models.get('leaf'), 6);
    g.audio.sfx('grass');
    g.add(new Deco(g, this.x, this.z, { model: 'grassStub', shadow: false }), this.screenKey);
    if (this.hide) revealHidden(g, this, this.hide);
    else dropLoot(g, this.x, this.z, 0.25);
    return 'cut';
  }
  update(dt) {
    const p = this.game.player;
    if (p.moving && Math.hypot(p.x - this.x, p.z - this.z) < 0.6) {
      if (this.rustle <= 0) this.game.audio.sfx('rustle', 0.3);
      this.rustle = 0.4;
    }
    this.rustle = Math.max(0, this.rustle - dt);
  }
  draw(r) {
    const w = this.rustle > 0 ? Math.sin(this.rustle * 30) * 0.12 : 0;
    r.push(); r.translate(this.x, 0, this.z); r.rotZ(w); r.draw(this.game.models.get('tallgrass'), { shadow: false }); r.pop();
  }
}

export class Deco extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.model = s.model;
    this.ry = s.ry ?? rand(0, 6);
    this.shadow = s.shadow ?? true;
    this.scale = s.scale ?? 1;
    this.yOff = s.y ?? 0;
    this.solid = !!s.solid;
    this.light = s.light;
    this.ox = s.ox ?? 0; this.oz = s.oz ?? 0;
  }
  draw(r) {
    r.drawAt(this.game.models.get(this.model), this.x + this.ox, this.yOff, this.z + this.oz, this.ry, this.scale, { shadow: this.shadow });
    if (this.light) r.light(this.x, 1, this.z, ...this.light);
  }
}

// ---------------- liftables ----------------
class Liftable extends Entity {
  constructor(g, x, z, model) {
    super(g, x, z);
    this.solid = true; this.low = true; this.hw = 0.38; this.r = 0.38;
    this.model = model;
    this.liftable = true;
  }
  interact(p, lifting) {
    if (!lifting) return false;
    p.liftEntity(this);
    this.dead = true; // removed from the world while carried
    return true;
  }
  drawCarried(r, x, y, z) { r.drawAt(this.game.models.get(this.model), x, y, z, 0); }
  draw(r) { r.drawAt(this.game.models.get(this.model), this.x, 0, this.z, 0); }
  // thrown object landed or hit something
  shatter(x, z) {}
}

class Pot extends Liftable {
  constructor(g, x, z, s) { super(g, x, z, 'pot'); this.hide = s.hide; }
  hurt(src) {
    if (src.type === 'bomb' || src.type === 'spin') { this.shatter(this.x, this.z); this.dead = true; return 'hit'; }
    return undefined;
  }
  shatter(x, z) {
    const g = this.game;
    g.particles.debris(x, 0.3, z, g.models.get('shard'), 8);
    g.audio.sfx('shatter');
    const hide = this.hide;
    if (hide) revealHidden(g, { x, z, screenKey: `${g.sx},${g.sy}`, spawnId: this.spawnId }, hide);
    else dropLoot(g, x, z, 0.5);
  }
}

class Rock extends Liftable {
  constructor(g, x, z, s) { super(g, x, z, 'rock'); this.hide = s.hide; }
  // whatever was hidden under a rock turns up where the rock was lifted from
  interact(p, lifting) {
    if (!lifting) return false;
    if (this.hide) {
      revealHidden(this.game, { x: this.x, z: this.z, screenKey: this.screenKey, spawnId: this.spawnId }, this.hide);
      this.hide = null;
    }
    return super.interact(p, lifting);
  }
  update(dt) {
    // a rock with something under it glints now and then
    if (this.hide && Math.random() < dt * 0.7) this.game.particles.twinkle(this.x + rand(-0.3, 0.3), 0.15, this.z + 0.35, [1, 0.9, 0.95], 0.28, 0.5);
  }
  shatter(x, z) {
    const g = this.game;
    g.particles.debris(x, 0.3, z, g.models.get('chip'), 8);
    g.audio.sfx('rockbreak');
    if (this.hide) revealHidden(g, { x, z, screenKey: `${g.sx},${g.sy}` }, this.hide);
  }
  hurt(src) {
    if (src.type === 'bomb') { this.shatter(this.x, this.z); this.dead = true; return 'hit'; }
    return src.type === 'sword' ? 'block' : undefined;
  }
}

// An object flying through the air after being thrown.
export class Thrown extends Entity {
  constructor(g, obj, p, speedMul) {
    super(g, p.x, p.z);
    this.obj = obj;
    this.y = 0.92;
    const sp = 8 * speedMul;
    this.vx = p.fx * sp; this.vz = p.fz * sp;
    this.vy = speedMul < 1 ? 0 : 1.6;
    this.r = 0.3;
    this.transient = true;
    this.owner = p;
  }
  update(dt) {
    const g = this.game;
    this.vy -= 13 * dt;
    const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    this.y += this.vy * dt;
    const t = TILE[g.area.tileAt(Math.floor(nx), Math.floor(nz))];
    const wall = t.tall || (t.solid && !t.water && this.y < 0.6) || g.solidAt(nx, nz, this.obj);
    if (wall && !(wall && wall.low && this.y > 0.5)) return this.land(this.x, this.z, true);
    this.x = nx; this.z = nz;
    for (const e of g.entities) {
      if (e === this || e.dead || !e.isEnemy || this.y > 1.3) continue;
      if (Math.hypot(e.x - this.x, e.z - this.z) < e.r + 0.3) {
        e.hurt({ type: 'thrown', dmg: 2, x: this.x - this.vx, z: this.z - this.vz, owner: this.owner });
        return this.land(this.x, this.z, true);
      }
    }
    if (this.y <= 0) this.land(this.x, this.z, false);
  }
  land(x, z, hit) {
    const g = this.game;
    this.dead = true;
    const o = this.obj;
    const t = TILE[g.area.tileAt(Math.floor(x), Math.floor(z))];
    if (o.onLand) { o.onLand(x, z, hit, t); return; }
    if (t.water && !g.isFrozen(Math.floor(x), Math.floor(z))) { g.particles.splash(x, 0, z, 10); g.audio.sfx('splash'); return; }
    if (t.pit) { g.audio.sfx('fall'); return; }
    o.shatter(x, z);
  }
  draw(r) {
    this.obj.drawCarried(r, this.x, this.y, this.z);
    r.blob(this.x, 0, this.z, 0.3, 0.25);
  }
}

class Boulder extends Entity {
  constructor(g, x, z, s, sid) {
    super(g, x, z);
    this.solid = true; this.hw = 0.5; this.r = 0.5; this.tall = true;
    this.sid = sid;
  }
  hurt(src) {
    if (src.type === 'bomb') {
      const g = this.game;
      this.dead = true;
      g.setFlag('boulder:' + this.sid);
      g.particles.debris(this.x, 0.5, this.z, g.models.get('chip'), 14, { size: 1.6, speed: 3.5 });
      g.audio.sfx('rockbreak');
      g.audio.sfx('secret');
      return 'hit';
    }
    return src.type === 'sword' ? 'block' : undefined;
  }
  draw(r) { r.drawAt(this.game.models.get('boulder'), this.x, 0, this.z, 0.3); }
}

// Brambles: thorny vines that only fire can clear.
class Bramble extends Entity {
  constructor(g, x, z, s, sid) {
    super(g, x, z);
    this.solid = true; this.hw = 0.48; this.r = 0.45;
    this.sid = sid;
    this.burn = 0;
    this.isBramble = true;
  }
  hurt(src) {
    if (src.type === 'fire' || src.fire) {
      if (this.burn <= 0) { this.burn = 0.01; this.game.audio.sfx('fireup'); }
      return 'hit';
    }
    if (src.type === 'sword' || src.type === 'spin') return 'block';
    return undefined;
  }
  update(dt) {
    if (this.burn > 0) {
      this.burn += dt;
      const g = this.game;
      g.particles.fire(this.x + rand(-0.3, 0.3), 0.2, this.z + rand(-0.3, 0.3), 1.4);
      // spread to neighbouring brambles
      if (this.burn > 0.4) for (const e of g.entities) if (e instanceof Bramble && e.burn <= 0 && e.dist(this) < 1.1) e.hurt({ type: 'fire' });
      if (this.burn > 1.0) {
        this.dead = true;
        g.setFlag('bramble:' + this.sid);
        g.particles.puff(this.x, 0.3, this.z, 8, [0.3, 0.3, 0.3], 0.6);
      }
    }
  }
  draw(r) {
    const g = this.game;
    const s = this.burn > 0 ? 1 - this.burn * 0.6 : 1;
    r.drawAt(g.models.get('bramble'), this.x, 0, this.z, this.x * 3.1, s, { tint: this.burn > 0 ? [1, 0.4, 0.1, this.burn * 0.6] : null });
    if (this.burn > 0) r.light(this.x, 0.8, this.z, 3, 1.8, 0.8, 0.2);
  }
}

// ---------------- pushable blocks ----------------
export class Block extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.solid = true; this.hw = 0.49; this.r = 0.45; this.tall = true;
    this.fixed = !!s.fixed;
    this.anim = null;
    this.model = s.model || 'block';
    this.weight = true;
  }
  canEnter(tx, tz) {
    const g = this.game;
    const d = g.area.tileDef(tx, tz);
    if (d.solid && !(d.water && g.isFrozen(tx, tz))) return false;
    if (d.pit) return false;
    if (g.solidAt(tx + 0.5, tz + 0.5, this)) return false;
    return true;
  }
  push(dx, dz) {
    if (this.fixed || this.anim) return false;
    const tx = this.tx + dx, tz = this.tz + dz;
    if (!this.canEnter(tx, tz)) return false;
    // don't squash the hero
    this.anim = { x0: this.x, z0: this.z, x1: tx + 0.5, z1: tz + 0.5, t: 0, dur: 0.32, dx, dz };
    this.game.audio.sfx('push');
    return true;
  }
  update(dt) {
    const a = this.anim;
    if (!a) return;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    this.x = lerp(a.x0, a.x1, k); this.z = lerp(a.z0, a.z1, k);
    if (k >= 1) {
      this.anim = null;
      // blocks keep sliding on ice
      if (this.game.area.tileDef(this.tx, this.tz).ice || this.slides) {
        if (this.canEnter(this.tx + a.dx, this.tz + a.dz)) {
          this.anim = { x0: this.x, z0: this.z, x1: this.x + a.dx, z1: this.z + a.dz, t: 0, dur: 0.12, dx: a.dx, dz: a.dz };
        } else this.game.audio.sfx('thud');
      }
      if (this.onMoved) this.onMoved();
    }
  }
  draw(r) { r.drawAt(this.game.models.get(this.model), this.x, 0, this.z, 0); }
}

// A monster frozen solid: a pushable, sliding block for a while.
export class IceBlock extends Block {
  constructor(g, enemy) {
    super(g, Math.floor(enemy.x) + 0.5, Math.floor(enemy.z) + 0.5, { model: 'iceBlock' });
    this.enemy = enemy;
    this.life = enemy.freezeTime ?? 9;
    this.slides = true;
    this.isIce = true;
    this.screenKey = enemy.screenKey;
    this.sx = enemy.sx; this.sy = enemy.sy;
    this.spawnId = enemy.spawnId;
    g.audio.sfx('freeze');
  }
  push(dx, dz) {
    const ok = super.push(dx, dz);
    if (ok) { this.anim.dur = 0.12; this.game.audio.sfx('iceSlide'); }
    return ok;
  }
  update(dt) {
    super.update(dt);
    this.life -= dt;
    if (this.life <= 0 && !this.anim) this.release();
  }
  release() {
    const g = this.game;
    this.dead = true;
    const e = this.enemy;
    e.x = this.x; e.z = this.z; e.frozen = false; e.dead = false; e.stun = 0.6;
    g.add(e, this.screenKey);
    g.particles.debris(this.x, 0.5, this.z, g.models.get('iceChip'), 8);
    g.audio.sfx('iceBreak');
  }
  hurt(src) {
    if (['sword', 'spin', 'bomb', 'thrown', 'arrow'].includes(src.type)) {
      const g = this.game;
      this.dead = true;
      g.particles.debris(this.x, 0.5, this.z, g.models.get('iceChip'), 14, { size: 1.4 });
      g.audio.sfx('iceBreak');
      const e = this.enemy;
      e.x = this.x; e.z = this.z;
      e.die ? e.die() : null;
      return 'hit';
    }
    if (src.fire) { this.life = 0; return 'hit'; }
    return undefined;
  }
  draw(r) {
    const M = this.game.models;
    const blink = this.life < 2 && Math.floor(this.life * 8) % 2 === 0;
    r.push(); r.translate(this.x, 0.12, this.z); r.scale(0.8);
    if (this.enemy.drawFrozen) this.enemy.drawFrozen(r);
    r.pop();
    r.drawAt(M.get('iceBlock'), this.x, 0, this.z, 0, 1, { alpha: blink ? 0.4 : 0.75, tint: [0.8, 0.95, 1, 0.2] });
  }
}

// ---------------- chests ----------------
class Chest extends Entity {
  constructor(g, x, z, s, sid) {
    super(g, x, z);
    this.solid = true; this.hw = 0.42; this.r = 0.42; this.talkable = true;
    this.item = s.item;
    this.big = !!s.big;
    if (this.big) { this.hw = 0.55; this.r = 0.55; }
    this.flagKey = 'chest:' + sid;
    this.open = g.flag(this.flagKey);
    this.lid = this.open ? 1 : 0;
    this.hidden = !!s.hidden && !this.open && !(s.revealFlag && g.flag(s.revealFlag));
    this.revealFlag = s.revealFlag;
    if (this.hidden) { this.solid = false; this.talkable = false; }
    this.appear = 0;
  }
  reveal() {
    if (!this.hidden) return;
    const g = this.game;
    this.hidden = false; this.solid = true; this.talkable = true;
    this.appear = 0.001;
    g.particles.puff(this.x, 0.3, this.z, 14, [1, 1, 1], 0.7, 2.5);
    g.audio.sfx('appear');
    if (this.revealFlag) g.setFlag(this.revealFlag);
  }
  interact(p) {
    const g = this.game;
    if (this.hidden) return false;
    if (this.open) { g.say('It\'s empty.'); return true; }
    // chests open from the front
    this.open = true;
    g.setFlag(this.flagKey);
    g.audio.sfx('chest');
    p.dir = Math.atan2(this.x - p.x, this.z - p.z);
    const item = this.item;
    g.after(0.35, () => {
      if (item.startsWith('shells:')) {
        const n = +item.split(':')[1];
        g.addShells(n);
        g.giveItem(n >= 50 ? 'shells50' : n >= 20 ? 'shells20' : 'shells5', null);
      } else if (item.startsWith('arrows:')) {
        g.save.arrows = Math.min(g.save.maxArrows, g.save.arrows + +item.split(':')[1]);
        g.giveItem('arrowsChest');
      } else if (item === 'key') {
        const d = g.area.def.dungeon;
        g.save.keys[d] = (g.save.keys[d] || 0) + 1;
        g.giveItem('key');
      } else g.giveItem(item);
    });
    p.setState('hold');
    p.holdItem = null;
    return true;
  }
  update(dt) {
    if (this.open && this.lid < 1) this.lid = Math.min(1, this.lid + dt * 4);
    if (this.appear > 0 && this.appear < 1) this.appear = Math.min(1, this.appear + dt * 3);
  }
  draw(r) {
    if (this.hidden) return;
    const M = this.game.models;
    const s = this.appear > 0 && this.appear < 1 ? this.appear : 1;
    const pre = this.big ? 'bigchest' : 'chest';
    r.push(); r.translate(this.x, 0, this.z); r.scale(s);
    r.draw(M.get(pre + '.base'));
    const k = this.big ? 1.35 : 1;
    r.translate(0, 0.44 * k, -0.29 * k); r.rotX(-this.lid * 1.9);
    r.draw(M.get(pre + '.lid'));
    r.pop();
    if (this.open && this.lid < 1) r.light(this.x, 0.8, this.z, 2.5, 1.5, 1.3, 0.8);
  }
}

// ---------------- signs ----------------
class Sign extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.solid = !s.invisible; this.hw = 0.3; this.r = 0.35; this.talkable = true; this.low = true;
    this.text = s.text;
    this.invisible = !!s.invisible;
    if (this.invisible) this.interactR = 0.6;
  }
  interact() {
    const t = typeof this.text === 'function' ? this.text(this.game) : this.text;
    this.game.say(t, { sign: true });
    return true;
  }
  hurt(src) { return src.type === 'sword' ? 'block' : undefined; }
  draw(r) { if (!this.invisible) r.drawAt(this.game.models.get('sign'), this.x, 0, this.z, 0); }
}

// The lighthouse beam, once the Sunstone is back.
class Beam extends Entity {
  constructor(g, x, z) { super(g, x, z); this.animateDuringScroll = true; }
  draw(r) {
    const t = this.game.time * 0.9;
    const y = 7.3;
    r.light(this.x, y, this.z, 7, 2.4, 2.0, 1.2);
    r.sprite(this.x, y, this.z, 2.6, 1, 0.9, 0.6, 0.9, 0, true);
    for (let i = 1; i <= 14; i++) {
      const d = i * 0.9;
      for (const s of [1, -1]) {
        const a = t + (s < 0 ? Math.PI : 0);
        r.sprite(this.x + Math.cos(a) * d, y - i * 0.05, this.z + Math.sin(a) * d * 0.9, 0.9 + i * 0.35, 1, 0.95, 0.75, 0.32 * (1 - i / 15), 0, true);
      }
    }
  }
}

// ---------------- warps (doors, stairs, cave mouths) ----------------
class Warp extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.target = s.to;
    this.look = s.look;
    this.r = 0.3;
    this.needDir = s.dir; // e.g. 'up' means you must be walking north into it
    this.armed = false;
    this.cond = s.cond;
  }
  update() {
    const g = this.game, p = g.player;
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (!this.armed) { if (d > 0.75) this.armed = true; return; }
    if (g.mode !== 'play' || p.state !== 'normal' || p.airborne) return;
    if (d > 0.42) return;
    if (this.needDir) {
      const [ax, az] = g.input.axis();
      const ok = { up: az < -0.5, down: az > 0.5, left: ax < -0.5, right: ax > 0.5 }[this.needDir];
      if (!ok) return;
    }
    if (this.cond && !this.cond(g)) return;
    g.warp(this.target);
  }
  draw(r) {
    if (this.look === 'stairs') r.drawAt(this.game.models.get('stairs'), this.x, 0, this.z, this.ry || 0);
    else if (this.look === 'stairsUp') r.drawAt(this.game.models.get('stairsUp'), this.x, 0, this.z, this.ry || 0);
  }
}

// ---------------- dungeon doors ----------------
class Door extends Entity {
  constructor(g, x, z, s, sid) {
    super(g, x, z);
    this.kind = s.kind || 'open';
    const tx = Math.floor(x), tz = Math.floor(z);
    // which wall of its room is it in?
    const lx = tx % SW, lz = tz % SH;
    this.out = lz === 0 ? [0, -1] : lz === SH - 1 ? [0, 1] : lx === 0 ? [-1, 0] : [1, 0];
    this.ry = Math.atan2(-this.out[0], -this.out[1]); // model faces into the room
    const ptx = tx + this.out[0], ptz = tz + this.out[1];
    this.flagKey = `door:${g.area.id}:${Math.min(tx, ptx)},${Math.min(tz, ptz)}`;
    this.closed = this.kind !== 'open';
    if ((this.kind === 'locked' || this.kind === 'boss') && g.flag(this.flagKey)) this.closed = false;
    if (this.kind === 'shutter') this.closed = false; // the room script closes it
    this.solid = this.closed;
    this.tall = true;
    this.hw = 0.5; this.r = 0.5;
    this.talkable = this.closed && (this.kind === 'locked' || this.kind === 'boss');
    this.anim = this.closed ? 1 : 0; // 1 = fully closed
    this.south = this.out[1] === 1;
  }
  setClosed(c, silent) {
    if (this.closed === c) return;
    this.closed = c;
    this.solid = c;
    if (!silent) this.game.audio.sfx(c ? 'shutterClose' : 'shutterOpen');
  }
  interact() { return this.tryUnlock(); }
  tryUnlock() {
    const g = this.game;
    const d = g.area.def.dungeon;
    if (!this.closed) return false;
    if (this.kind === 'locked') {
      if ((g.save.keys[d] || 0) > 0) {
        g.save.keys[d]--;
        this.unlock();
        return true;
      }
      g.say('It\'s locked. A small key would open it.');
      return true;
    }
    if (this.kind === 'boss') {
      if (g.save.bigKeys[d]) { this.unlock(); return true; }
      g.say('A heavy door, sealed with a great lock.\nYou need the Big Key.');
      return true;
    }
    return false;
  }
  unlock() {
    const g = this.game;
    g.setFlag(this.flagKey);
    this.setClosed(false, true);
    this.talkable = false;
    g.audio.sfx('unlock');
    g.particles.sparks(this.x, 0.8, this.z, 10, [1, 0.9, 0.4]);
    // open the matching door on the other side too, if it's spawned
    for (const e of g.entities) if (e instanceof Door && e !== this && e.flagKey === this.flagKey) { e.setClosed(false, true); e.talkable = false; }
  }
  update(dt) {
    const target = this.closed ? 1 : 0;
    this.anim += Math.sign(target - this.anim) * Math.min(Math.abs(target - this.anim), dt * 5);
    // walking into a locked door with a key opens it
    const p = this.game.player;
    if (this.closed && (this.kind === 'locked' || this.kind === 'boss') && p.state === 'normal' && p.moving) {
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      const facing = Math.abs(angleDiff(p.dir, Math.atan2(this.x - p.x, this.z - p.z))) < 0.6;
      const d2 = this.game.area.def.dungeon;
      if (d < 0.85 && facing) {
        if (this.kind === 'locked' && (this.game.save.keys[d2] || 0) > 0) this.tryUnlock();
        if (this.kind === 'boss' && this.game.save.bigKeys[d2]) this.tryUnlock();
      }
    }
  }
  draw(r) {
    const M = this.game.models;
    r.push(); r.translate(this.x, 0, this.z); r.rotY(this.ry);
    if (!this.south && this.game.area.theme === 'shrine') r.draw(M.get('door.frame'));
    if (this.anim > 0.01) {
      const m = this.kind === 'shutter' ? 'door.shutter' : this.kind === 'boss' ? 'door.boss' : 'door.locked';
      if (this.kind === 'shutter') { r.translate(0, -(1 - this.anim) * 1.5, 0); }
      else { r.translate(0, (1 - this.anim) * 1.6, 0); }
      if (this.south) r.scale(1, 0.4, 1);
      r.draw(M.get(m));
    }
    r.pop();
  }
}

class Cracked extends Entity {
  constructor(g, x, z, s, sid) {
    super(g, x, z);
    this.solid = true; this.tall = true; this.hw = 0.5; this.r = 0.5;
    this.sid = sid;
    this.model = s.model || (g.area.theme === 'overworld' ? 'crackedRock' : 'crackedWall');
    this.ry = s.ry || 0;
  }
  hurt(src) {
    if (src.type !== 'bomb') return undefined;
    const g = this.game;
    this.dead = true;
    g.setFlag('cracked:' + this.sid);
    g.particles.debris(this.x, 0.8, this.z, g.models.get(g.area.theme === 'overworld' ? 'chipBrown' : 'chip'), 16, { size: 1.8, speed: 3.5 });
    g.audio.sfx('rockbreak');
    g.after(0.3, () => g.audio.sfx('secret'));
    return 'hit';
  }
  draw(r) {
    const h = this.model === 'crackedRock' ? this.game.area.cliffAt(this.tx, this.tz) || 1.5 : 1;
    r.push(); r.translate(this.x, 0, this.z); r.rotY(this.ry);
    if (this.model === 'crackedRock') r.scale(1, h / 1.5, 1);
    r.draw(this.game.models.get(this.model));
    r.pop();
  }
}

// ---------------- torches ----------------
export class Torch extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.solid = true; this.hw = 0.3; this.r = 0.35; this.low = false;
    this.lit = !!s.lit || (s.litFlag && g.flag(s.litFlag));
    this.timed = s.timed || 0;
    this.left = 0;
    this.isTorch = !s.permanent;
    this.permanent = !!s.permanent;
    this.id = s.id;
  }
  isFire() { return this.lit; }
  light() {
    if (this.lit) return;
    this.lit = true;
    this.left = this.timed;
    this.game.audio.sfx('fireup');
    this.game.particles.sparks(this.x, 0.95, this.z, 8, [1, 0.6, 0.2], 2);
  }
  hurt(src) {
    if (src.fire || src.type === 'fire') {
      if (this.lit) return undefined; // flames pass straight through a lit torch
      this.light();
      return 'hit';
    }
    if (src.type === 'frost' && this.lit && !this.permanent) { this.lit = false; this.game.audio.sfx('fizzle'); return 'hit'; }
    return undefined;
  }
  update(dt) {
    if (this.lit) {
      this.game.particles.fire(this.x, 0.92, this.z, 1, dt);
      if (this.timed) {
        this.left -= dt;
        if (this.left <= 0) { this.lit = false; this.game.audio.sfx('fizzle'); }
      }
    }
  }
  draw(r) {
    r.drawAt(this.game.models.get('torch'), this.x, 0, this.z, 0);
    if (this.lit) {
      const f = 1 + Math.sin(this.game.time * 13 + this.x) * 0.08 + Math.sin(this.game.time * 7.3) * 0.06;
      r.light(this.x, 1.3, this.z, 4.6 * f, 1.9, 1.1, 0.45);
      r.sprite(this.x, 1.0, this.z, 0.7 * f, 1, 0.6, 0.2, 0.55, 0, true);
    }
  }
}

// ---------------- pressure plates ----------------
class Plate extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.r = 0.4;
    this.pressed = false;
    this.latch = !!s.latch;
    this.heavy = !!s.heavy; // only blocks are heavy enough
    this.id = s.id;
    this.isPlate = true;
  }
  update() {
    const g = this.game;
    const was = this.pressed;
    let now = false;
    const p = g.player;
    if (!this.heavy && !p.airborne && Math.abs(p.x - this.x) < 0.45 && Math.abs(p.z - this.z) < 0.45) now = true;
    for (const e of g.entities) {
      if (e === this || e.dead || !(e.weight)) continue;
      if (Math.abs(e.x - this.x) < 0.3 && Math.abs(e.z - this.z) < 0.3) now = true;
    }
    if (this.latch && was) now = true;
    this.pressed = now;
    if (now !== was) g.audio.sfx(now ? 'plateDown' : 'plateUp');
  }
  draw(r) {
    r.drawAt(this.game.models.get(this.pressed ? 'plate.down' : 'plate'), this.x, 0, this.z, 0, 1, { shadow: false, tint: this.heavy ? [0.35, 0.45, 0.6, 0.45] : null });
  }
}

// ---------------- crystal switches and coloured blocks ----------------
class Crystal extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.solid = true; this.hw = 0.3; this.r = 0.38; this.tall = true;
    this.cool = 0;
  }
  state() { return this.game.save.flags['crystal:' + this.game.area.id] ? 1 : 0; }
  hurt(src) {
    if (this.cool > 0) return 'hit';
    if (!['sword', 'spin', 'boomerang', 'arrow', 'bomb', 'thrown', 'frost'].includes(src.type)) return undefined;
    const g = this.game;
    this.cool = 0.6;
    g.save.flags['crystal:' + g.area.id] = this.state() ? 0 : 1;
    g.audio.sfx('crystal');
    g.particles.ring(this.x, 0.75, this.z, this.state() ? [0.4, 0.6, 1] : [1, 0.35, 0.35], 14, 2.5);
    // a block rising under the hero nudges them off it
    const p = g.player;
    for (const e of g.entities) {
      if (e instanceof Toggle && e.raisedNow() && Math.abs(p.x - e.x) < 0.5 + p.bodyHw && Math.abs(p.z - e.z) < 0.5 + p.bodyHw) {
        const [sx, sz] = g.findSafeSpot(p.x, p.z);
        p.x = sx; p.z = sz;
        g.particles.puff(p.x, 0.2, p.z, 6);
      }
    }
    return 'hit';
  }
  update(dt) { this.cool = Math.max(0, this.cool - dt); }
  draw(r) {
    const M = this.game.models, t = this.game.time;
    r.drawAt(M.get('crystal.base'), this.x, 0, this.z, 0);
    const blue = this.state() === 1;
    const col = blue ? [0.25, 0.45, 1, 0.75] : [1, 0.22, 0.22, 0.75];
    r.push(); r.translate(this.x, 0.78 + Math.sin(t * 2) * 0.04, this.z); r.rotY(t);
    r.draw(M.get('crystal.orb'), { tint: col, emis: 0.6 });
    r.pop();
    r.light(this.x, 1, this.z, 2.5, blue ? 0.4 : 1.2, blue ? 0.6 : 0.3, blue ? 1.4 : 0.3);
  }
}

class Toggle extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.color = s.color;
    this.hw = 0.5; this.r = 0.45;
    this.h = this.raisedNow() ? 1 : 0;
  }
  raisedNow() {
    const st = this.game.save.flags['crystal:' + this.game.area.id] ? 1 : 0;
    return this.color === 'red' ? st === 0 : st === 1;
  }
  get solid() { return this.raisedNow(); }
  set solid(v) {}
  get tall() { return this.raisedNow(); }
  set tall(v) {}
  update(dt) {
    const t = this.raisedNow() ? 1 : 0;
    this.h += Math.sign(t - this.h) * Math.min(Math.abs(t - this.h), dt * 6);
  }
  draw(r) {
    const M = this.game.models;
    const col = this.color === 'red' ? [0.9, 0.25, 0.25, 0.75] : [0.25, 0.45, 0.95, 0.75];
    if (this.h > 0.05) {
      r.push(); r.translate(this.x, 0, this.z); r.scale(1, this.h, 1);
      r.draw(M.get('toggle.up'), { tint: col });
      r.pop();
    } else r.drawAt(M.get('toggle.down'), this.x, 0, this.z, 0, 1, { tint: col, shadow: false });
  }
}

// ---------------- levers, drawbridges, eye switches ----------------
class Lever extends Entity {
  // a target you hit (with the boomerang, an arrow, or the sword) to set a flag
  constructor(g, x, z, s, sid) {
    super(g, x, z);
    this.solid = true; this.hw = 0.3; this.r = 0.35;
    this.flagKey = s.flag;
    this.on = g.flag(this.flagKey);
    this.a = this.on ? 1 : 0;
  }
  hurt(src) {
    if (this.on) return undefined;
    if (!['sword', 'spin', 'boomerang', 'arrow', 'thrown', 'bomb'].includes(src.type)) return undefined;
    this.on = true;
    const g = this.game;
    g.setFlag(this.flagKey);
    g.audio.sfx('lever');
    g.after(0.4, () => g.audio.sfx('secret'));
    return 'hit';
  }
  update(dt) { if (this.on) this.a = Math.min(1, this.a + dt * 4); }
  draw(r) {
    const M = this.game.models;
    r.drawAt(M.get('lever.base'), this.x, 0, this.z, 0);
    r.push(); r.translate(this.x, 0.25, this.z); r.rotZ(lerp(0.7, -0.7, this.a)); r.draw(M.get('lever.arm')); r.pop();
  }
}

// A bridge that lowers when its flag is set; until then the water blocks the way.
class DrawBridge extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.flagKey = s.flag;
    this.len = s.len || 3;
    this.down = g.flag(this.flagKey) ? 1 : 0;
    this.r = 0.5;
    this.animateDuringScroll = true;
  }
  update(dt) {
    const g = this.game;
    const want = g.flag(this.flagKey) ? 1 : 0;
    if (want && this.down < 1) {
      this.down = Math.min(1, this.down + dt * 0.8);
      if (this.down >= 1) { g.audio.sfx('thud'); g.shake(0.08, 0.2); }
    }
    // while lowered, the bridge tiles act like frozen water (walkable)
    for (let i = 0; i < this.len; i++) {
      const k = this.tz * g.area.w + this.tx + i;
      if (this.down >= 1) g.frozen.set(k, this); else g.frozen.delete(k);
    }
  }
  draw(r) {
    const M = this.game.models;
    // hinged at the far (east) end, swinging down westwards
    const ang = (1 - this.down) * 1.35;
    r.push(); r.translate(this.x - 0.5 + this.len, 0, this.z); r.rotZ(-ang);
    for (let i = 0; i < this.len; i++) { r.push(); r.translate(-i - 0.5, 0, 0); r.draw(M.get('bridgeSeg')); r.pop(); }
    r.pop();
    r.drawAt(M.get('bridgePost'), this.x - 0.5 + this.len, 0, this.z - 0.55, 0);
    r.drawAt(M.get('bridgePost'), this.x - 0.5 + this.len, 0, this.z + 0.55, 0);
  }
}

class EyeSwitch extends Entity {
  constructor(g, x, z, s, sid) {
    super(g, x, z);
    this.flagKey = s.flag;
    this.on = g.flag(this.flagKey);
    this.r = 0.35;
    this.ry = s.ry || 0;
    this.y = 1.0;
    this.tall = true;
  }
  hurt(src) {
    if (this.on || src.type !== 'arrow') return undefined;
    const g = this.game;
    this.on = true;
    g.setFlag(this.flagKey);
    g.audio.sfx('crystal');
    g.after(0.3, () => g.audio.sfx('secret'));
    return 'hit';
  }
  draw(r) {
    const M = this.game.models;
    r.push(); r.translate(this.x, 1.1, this.z); r.rotY(this.ry);
    r.draw(M.get('eye.frame'));
    r.draw(M.get('eye.ball'), { tint: this.on ? [0.2, 0.8, 0.4, 0.6] : null, emis: this.on ? 0.3 : 0.1 });
    r.pop();
  }
}

// Iron bars that sink into the ground once their flag is set.
class Gate extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.flagKey = s.flag;
    this.ry = s.ry || 0;
    this.open = g.flag(this.flagKey) ? 1 : 0;
    this.hw = 0.5; this.r = 0.5; this.tall = true;
    this.animateDuringScroll = true;
  }
  get solid() { return this.open < 0.5; }
  set solid(v) {}
  update(dt) {
    if (this.game.flag(this.flagKey) && this.open < 1) {
      if (this.open === 0) this.game.audio.sfx('shutterOpen');
      this.open = Math.min(1, this.open + dt * 1.5);
    }
  }
  draw(r) {
    if (this.open >= 1) return;
    r.push(); r.translate(this.x, -this.open * 1.45, this.z); r.rotY(this.ry); r.translate(0, 0, -0.3);
    r.draw(this.game.models.get('door.shutter'));
    r.pop();
  }
}

class Trigger extends Entity {
  // invisible: runs a function once when the hero steps on it
  constructor(g, x, z, s, sid) {
    super(g, x, z);
    this.fn = s.fn; this.once = s.once ?? true; this.flagKey = s.flag; this.w = s.w ?? 1; this.h = s.h ?? 1;
    this.r = 0.5;
  }
  update() {
    const g = this.game, p = g.player;
    if (this.flagKey && g.flag(this.flagKey)) return;
    if (p.x >= this.x - 0.5 && p.x < this.x - 0.5 + this.w && p.z >= this.z - 0.5 && p.z < this.z - 0.5 + this.h && p.state === 'normal') {
      if (this.flagKey) g.setFlag(this.flagKey);
      if (this.once) this.dead = true;
      this.fn(g, this);
    }
  }
}

// ---------------- fairies ----------------
class Fairy extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.bx = x; this.bz = z; this.r = 0.3;
    this.ph = rand(0, 6);
  }
  update(dt) {
    const t = this.game.time + this.ph;
    this.x = this.bx + Math.sin(t * 1.3) * 0.8;
    this.z = this.bz + Math.sin(t * 0.9) * 0.6;
    this.y = 0.9 + Math.sin(t * 3) * 0.2;
    const p = this.game.player;
    if (Math.hypot(p.x - this.x, p.z - this.z) < 0.6) {
      this.dead = true;
      this.game.healPlayer(99);
      this.game.audio.sfx('fairy');
      for (let i = 0; i < 12; i++) this.game.particles.twinkle(p.x + rand(-0.5, 0.5), rand(0.2, 1.2), p.z + rand(-0.5, 0.5), [1, 0.7, 0.9], 0.3, 0.8);
    }
  }
  draw(r) {
    const t = this.game.time;
    r.sprite(this.x, this.y, this.z, 0.6, 1, 0.6, 0.85, 0.8, 0, true);
    r.sprite(this.x, this.y, this.z, 0.18, 1, 1, 1, 1, 1, true);
    const w = Math.abs(Math.sin(t * 30)) * 0.25;
    r.sprite(this.x - 0.12, this.y + 0.05, this.z, w + 0.1, 0.8, 0.9, 1, 0.6, 0, true);
    r.sprite(this.x + 0.12, this.y + 0.05, this.z, w + 0.1, 0.8, 0.9, 1, 0.6, 0, true);
    r.light(this.x, this.y, this.z, 2.2, 1.0, 0.5, 0.8);
    if (Math.random() < 0.2) this.game.particles.twinkle(this.x, this.y, this.z, [1, 0.7, 0.9], 0.15, 0.6);
  }
}

// ---------------- people ----------------
export class NPC extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.solid = true; this.hw = 0.35; this.r = 0.38; this.talkable = true;
    this.model = 'npc.' + (s.species || 'rabbit');
    this.name = s.name;
    this.talk = s.talk;
    this.dir = s.dir ?? 0;
    this.baseDir = this.dir;
    this.vis = this.dir;
    this.ph = rand(0, 6);
    this.talkingT = 0;
    this.wander = s.wander;
    this.home = [x, z];
    this.wt = rand(1, 3);
    this.walking = false;
    this.tx0 = x; this.tz0 = z;
    this.extra = s.extra;
    if (s.interactR) this.interactR = s.interactR;
  }
  interact(p) {
    const g = this.game;
    this.dir = Math.atan2(p.x - this.x, p.z - this.z);
    this.walking = false;
    let lines = typeof this.talk === 'function' ? this.talk(g, this) : this.talk;
    if (!lines) return false;
    this.talkingT = 99;
    g.audio.sfx('talk');
    g.say(lines, { name: this.name, onDone: () => { this.talkingT = 0.5; } });
    return true;
  }
  hurt(src) { return src.type === 'sword' || src.type === 'spin' ? 'block' : undefined; }
  update(dt) {
    this.talkingT = Math.max(0, this.talkingT - dt);
    if (this.wander && this.talkingT <= 0) {
      this.wt -= dt;
      if (this.wt <= 0) {
        this.wt = rand(1.5, 3.5);
        this.walking = !this.walking && Math.random() < 0.7;
        if (this.walking) {
          const a = rand(0, 6.28);
          this.wdx = Math.cos(a); this.wdz = Math.sin(a);
          if (Math.hypot(this.x + this.wdx - this.home[0], this.z + this.wdz - this.home[1]) > this.wander) { this.wdx = this.home[0] - this.x; this.wdz = this.home[1] - this.z; const l = Math.hypot(this.wdx, this.wdz) || 1; this.wdx /= l; this.wdz /= l; }
          this.dir = Math.atan2(this.wdx, this.wdz);
        }
      }
      if (this.walking) {
        const g = this.game, sp = 1.1 * dt;
        const nx = this.x + this.wdx * sp, nz = this.z + this.wdz * sp;
        this.solid = false;
        const blocked = g.isBlocked({ avoidPits: true, bodyHw: 0.3 }, nx, nz, 0.3) || Math.hypot(g.player.x - nx, g.player.z - nz) < 0.8;
        this.solid = true;
        if (!blocked) { this.x = nx; this.z = nz; } else this.walking = false;
      }
    } else if (this.talkingT <= 0 && !this.wander) {
      // glance at the hero when nearby
      const p = this.game.player;
      if (p.dist(this) < 2.5) this.dir = Math.atan2(p.x - this.x, p.z - this.z);
      else this.dir = this.baseDir;
    }
    this.vis += angleDiff(this.vis, this.dir) * Math.min(1, dt * 8);
  }
  draw(r) {
    const t = this.game.time + this.ph;
    const bob = this.walking ? Math.abs(Math.sin(t * 9)) * 0.05 : Math.sin(t * 2) * 0.012;
    const talk = this.talkingT > 0 ? Math.abs(Math.sin(t * 10)) * 0.03 : 0;
    r.push(); r.translate(this.x, bob, this.z); r.rotY(this.vis); r.scale(1.15, 1.15 * (1 + talk), 1.15);
    r.draw(this.game.models.get(this.model));
    if (this.extra) r.draw(this.game.models.get(this.extra));
    r.pop();
    r.blob(this.x, 0, this.z, 0.32, 0.3);
  }
}

class ShopItem extends Entity {
  constructor(g, x, z, s) {
    super(g, x, z);
    this.item = s.item; this.price = s.price; this.r = 0.35; this.talkable = true; this.solid = false;
    this.once = s.once; this.label = s.label;
    this.y = s.y ?? 0.95;
    this.interactR = 0.5;
  }
  interact(p) {
    const g = this.game;
    const it = ITEMS[this.item];
    const can = it.canBuy ? it.canBuy(g) : true;
    if (can !== true) { g.say(can); return true; }
    g.say(`${this.label}: ${this.price} shells. Buy it?`, {
      choices: ['Yes please', 'No thanks'],
      onChoice: (i) => {
        if (i !== 0) return;
        if (g.save.shells < this.price) { g.say('Oh dear, you don\'t have enough shells for that.', { name: 'Tansy' }); return; }
        g.save.shells -= this.price;
        g.audio.sfx('buy');
        if (this.once) { g.setFlag('bought:' + this.item); this.dead = true; }
        g.giveItem(this.item);
      },
    });
    return true;
  }
  draw(r) {
    const t = this.game.time;
    const it = ITEMS[this.item];
    r.push(); r.translate(this.x, this.y + Math.sin(t * 2 + this.x) * 0.04, this.z); r.rotY(Math.sin(t) * 0.5);
    r.draw(this.game.models.get(it.model));
    r.pop();
  }
}
