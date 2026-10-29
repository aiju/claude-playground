// The monsters of Foglight island.

import { Actor } from './entity.js';
import { T, TILE, SW, SH } from './tiles.js';
import { clamp, lerp, rand, angleDiff, TAU } from './math.js';
import { dropLoot, IceBlock, Pickup } from './objects.js';
import { Shot } from './projectiles.js';

export function createEnemy(g, s, x, z) {
  const C = ENEMIES[s.kind];
  if (!C) { console.warn('unknown enemy', s.kind); return null; }
  return new C(g, x, z, s);
}

export class Enemy extends Actor {
  constructor(g, x, z, s = {}) {
    super(g, x, z);
    this.isEnemy = true;
    this.confined = true;
    this.dmg = 1;
    this.freezable = true;
    this.stunnable = true;
    this.t = rand(0, 2);
    this.st = 0;
    this.state = 'idle';
    this.vis = rand(0, TAU);
    this.dir = this.vis;
    this.lootChance = 0.5;
    this.spec = s;
    this.contactR = 0;
  }
  setState(s) { this.state = s; this.st = 0; }
  get player() { return this.game.player; }
  distToPlayer() { const p = this.game.player; return Math.hypot(p.x - this.x, p.z - this.z); }
  angleToPlayer() { const p = this.game.player; return Math.atan2(p.x - this.x, p.z - this.z); }

  hurt(src) {
    const g = this.game;
    if (this.dying || this.dead) return undefined;
    if (src.owner && src.owner.isEnemy) return undefined;
    if (src.type === 'frost') {
      if (this.onFrost) return this.onFrost(src);
      if (this.freezable) { this.freeze(); return 'hit'; }
      return 'block';
    }
    if (src.type === 'boomerang' && !src.fire) {
      if (!this.stunnable) return 'block';
      this.stun = src.stun ?? 2;
      this.flash = 0.1;
      g.audio.sfx('stun');
      if (this.boomerangHurts) return this.takeDamage({ ...src, dmg: 1 });
      return 'hit';
    }
    const res = this.guard ? this.guard(src) : null;
    if (res) return res;
    if (this.invuln > 0) return 'hit';
    return this.takeDamage(src);
  }

  takeDamage(src) {
    const g = this.game;
    let dmg = src.dmg ?? 1;
    if (src.fire && this.fireWeak) dmg *= 2;
    if (dmg <= 0) return 'block';
    this.hp -= dmg;
    this.flash = 0.18;
    this.invuln = 0.25;
    if (src.x !== undefined && !this.heavy) this.knock(src.x, src.z, src.type === 'bomb' ? 10 : 7, 0.16);
    g.audio.sfx('enemyHit');
    if (this.hp <= 0) this.die();
    else if (this.onHurt) this.onHurt(src);
    return 'hit';
  }

  freeze() {
    const g = this.game;
    this.dead = true;
    this.frozen = true;
    const ice = new IceBlock(g, this);
    g.add(ice, this.screenKey);
  }

  die() {
    const g = this.game;
    this.dead = true;
    this.dying = true;
    if (this.spawnId) g.visitKilled.add(this.spawnId);
    g.particles.puff(this.x, 0.4, this.z, 12, [1, 1, 1], 0.6, 2.2);
    g.particles.sparks(this.x, 0.4, this.z, 8, [1, 0.9, 0.5], 3);
    g.audio.sfx('enemyDie');
    if (this.onDie) this.onDie();
    dropLoot(g, this.x, this.z, this.lootChance);
  }

  update(dt) {
    this.tickTimers(dt);
    this.t += dt;
    this.st += dt;
    if (this.updateKnock(dt)) return this.contact();
    if (this.stun > 0) { this.stunned?.(dt); return this.contact(); }
    this.ai(dt);
    this.contact();
  }
  ai(dt) {}

  contact() {
    const p = this.game.player;
    if (this.harmless || this.dying) return;
    const r = (this.contactR || this.r) + p.r - 0.12;
    const dy = Math.abs((this.y || 0) - p.y);
    if (Math.hypot(p.x - this.x, p.z - this.z) < r && dy < (this.flying ? 1.2 : 0.6)) {
      p.hurt({ type: 'enemy', dmg: this.dmg, x: this.x, z: this.z });
    }
  }

  // walk toward an angle; returns true if blocked
  walk(ang, speed, dt) {
    return this.move(Math.sin(ang) * speed * dt, Math.cos(ang) * speed * dt);
  }

  turnTo(a, dt, rate = 10) { this.vis += angleDiff(this.vis, a) * Math.min(1, dt * rate); }

  drawModel(r, name, opts = {}) {
    const M = this.game.models;
    r.push(); r.translate(this.x, (this.y || 0) + (opts.y || 0), this.z); r.rotY(opts.ry ?? this.vis);
    const k = 1.12;
    r.scale((opts.sx ?? 1) * k, (opts.sy ?? opts.sx ?? 1) * k, (opts.sz ?? opts.sx ?? 1) * k);
    r.draw(M.get(name), { tint: this.tint(), rim: 0.35 });
    if (opts.extra) opts.extra(r);
    r.pop();
  }
  drawFrozen(r) {
    // pose inside an ice block (block draw translates/scales first)
    const x = this.x, z = this.z, y = this.y;
    this.x = 0; this.z = 0; this.y = 0;
    const st = this.stun; this.stun = 0; const fl = this.flash; this.flash = 0;
    this.draw(r, true);
    this.x = x; this.z = z; this.y = y; this.stun = st; this.flash = fl;
  }
  shadow(r, s = 0.3) { r.blob(this.x, 0, this.z, s, 0.3); }
}

// ---------------- Gloop (slime) ----------------
class Slime extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.size = s.size ?? 1;
    this.hp = this.maxHp = s.hp ?? (this.size >= 2 ? 8 : this.size > 1.2 ? 3 : 2);
    if (s.size && s.size < 1) this.hp = 1;
    this.r = 0.3 * this.size;
    this.bodyHw = 0.24 * Math.min(this.size, 1.6);
    this.color = s.color;
    this.wait = rand(0.3, 1.2);
    this.hopT = 0;
    this.squash = 0;
    this.boomerangHurts = this.size < 1;
    this.heavy = this.size >= 2;
    this.dmg = this.size >= 2 ? 2 : 1;
    this.lootChance = this.size >= 2 ? 1 : 0.45;
  }
  ai(dt) {
    if (this.state === 'idle') {
      this.wait -= dt;
      if (this.wait <= 0) {
        const near = this.distToPlayer() < 7;
        this.hopA = near && Math.random() < 0.8 ? this.angleToPlayer() + rand(-0.4, 0.4) : rand(0, TAU);
        this.setState('hop');
        this.dir = this.hopA;
      }
    } else if (this.state === 'hop') {
      const dur = 0.42 + this.size * 0.08;
      const k = this.st / dur;
      this.y = Math.sin(Math.min(1, k) * Math.PI) * 0.35 * Math.sqrt(this.size);
      this.walk(this.hopA, 2.7 * (this.size >= 2 ? 1.1 : 1), dt);
      if (k >= 1) {
        this.y = 0; this.squash = 0.25;
        this.setState('idle');
        this.wait = rand(0.4, 1.0) * (this.size >= 2 ? 0.7 : 1);
        if (this.size >= 2) { this.game.shake(0.06, 0.12); this.game.audio.sfx('thud', 0.6); }
        else this.game.audio.sfx('squish', 0.25);
      }
    }
    this.squash = Math.max(0, this.squash - dt);
    this.turnTo(this.dir, dt, 8);
  }
  onDie() {
    // big slimes split
    if (this.size > 1.2) {
      const g = this.game;
      const ns = this.size >= 2 ? 1.4 : 0.8;
      for (const s of [-1, 1]) {
        const e = new Slime(g, this.x + s * 0.3, this.z, { size: ns, color: this.color });
        e.screenKey = this.screenKey; e.sx = this.sx; e.sy = this.sy;
        e.knock(this.x - s, this.z, 5, 0.2);
        e.isSplit = true;
        g.entities.push(e);
      }
      this.lootChance = 0;
    }
  }
  draw(r, frozen) {
    const s = this.size;
    const sq = this.squash > 0 ? this.squash : 0;
    const st = this.state === 'hop' ? 0.12 : 0;
    const wob = Math.sin(this.t * 6) * 0.03;
    this.drawModel(r, this.color === 'blue' ? 'slime.blue' : 'slime', { sx: s * (1 + sq - st + wob), sy: s * (1 - sq + st * 1.5 - wob), sz: s * (1 + sq - st + wob) });
    if (!frozen) this.shadow(r, 0.32 * s * (1 - this.y * 0.5));
  }
}

// ---------------- Sprout (seed spitter) ----------------
class Sprout extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.hp = this.maxHp = 2;
    this.r = 0.32;
    this.walkT = 0;
    this.wait = rand(0.5, 1.5);
    this.dir = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(rand(0, 4))];
  }
  ai(dt) {
    const p = this.player;
    const dx = p.x - this.x, dz = p.z - this.z;
    if (this.state === 'idle') {
      this.wait -= dt;
      const aligned = (Math.abs(dx) < 0.6 || Math.abs(dz) < 0.6) && Math.hypot(dx, dz) < 8;
      if (aligned && this.wait < 0.6 && !this.game.wallBetween(this.x, this.z, p.x, p.z)) {
        this.dir = Math.abs(dx) < 0.6 ? (dz > 0 ? 0 : Math.PI) : (dx > 0 ? Math.PI / 2 : -Math.PI / 2);
        this.setState('wind');
      } else if (this.wait <= 0) {
        this.dir = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(rand(0, 4))];
        this.setState('walk');
        this.walkDur = rand(0.6, 1.4);
      }
    } else if (this.state === 'walk') {
      this.walkT += dt;
      if (this.walk(this.dir, 1.8, dt) || this.st > this.walkDur) { this.setState('idle'); this.wait = rand(0.6, 1.4); }
    } else if (this.state === 'wind') {
      if (this.st > 0.45) {
        const g = this.game;
        g.add(new Shot(g, this.x + Math.sin(this.dir) * 0.4, this.z + Math.cos(this.dir) * 0.4, Math.sin(this.dir), Math.cos(this.dir), { kind: 'seed', speed: 6.5 }), this.screenKey);
        g.audio.sfx('spit');
        this.setState('recover');
      }
    } else if (this.state === 'recover') {
      if (this.st > 0.5) { this.setState('idle'); this.wait = rand(1.0, 2.0); }
    }
    this.turnTo(this.dir, dt, 12);
  }
  draw(r, frozen) {
    const puff = this.state === 'wind' ? this.st / 0.45 : this.state === 'recover' ? Math.max(0, 1 - this.st * 4) : 0;
    const bob = this.state === 'walk' ? Math.abs(Math.sin(this.walkT * 14)) * 0.05 : 0;
    this.drawModel(r, 'sprout', { y: bob, extra: (rr) => {
      rr.push(); rr.translate(0, 0.42, 0.22); rr.scale(1 + puff * 0.35); rr.draw(this.game.models.get('sprout.mouth'), { tint: this.tint() }); rr.pop();
      rr.push(); rr.translate(0, 0.72, 0); rr.rotY(this.t * 2); rr.rotZ(Math.sin(this.t * 3) * 0.15); rr.draw(this.game.models.get('sprout.leaves'), { tint: this.tint() }); rr.pop();
    } });
    if (!frozen) this.shadow(r, 0.3);
  }
}

// ---------------- Flit (bat) ----------------
class Bat extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.hp = this.maxHp = 1;
    this.flying = true;
    this.r = 0.3;
    this.bodyHw = 0.2;
    this.y = 1.1;
    this.state = 'perch';
    this.boomerangHurts = true;
    this.ph = rand(0, 6);
    this.lootChance = 0.4;
  }
  ai(dt) {
    const g = this.game;
    if (this.state === 'perch') {
      this.y = 1.3;
      if (this.distToPlayer() < 4.5 || this.t > 30) { this.setState('swoop'); g.audio.sfx('bat', 0.5); }
      return;
    }
    if (this.state === 'swoop') {
      const a = this.angleToPlayer() + Math.sin(this.t * 5 + this.ph) * 0.9;
      this.walk(a, 3.6, dt);
      this.dir = a;
      this.y = lerp(this.y, 0.55 + Math.sin(this.t * 7) * 0.12, dt * 3);
      if (this.st > 1.6) { this.setState('away'); this.awayA = this.angleToPlayer() + Math.PI + rand(-0.8, 0.8); }
    } else if (this.state === 'away') {
      this.walk(this.awayA, 3, dt);
      this.y = lerp(this.y, 1.2, dt * 2);
      if (this.st > 0.9) this.setState('swoop');
    }
    this.turnTo(this.dir, dt, 10);
  }
  stunned() { this.y = Math.max(0.3, this.y - 0.02); }
  draw(r, frozen) {
    const flap = this.state === 'perch' && !frozen ? 0.2 : Math.sin(this.t * 24) * 0.8;
    const M = this.game.models;
    this.drawModel(r, 'bat', { extra: (rr) => {
      for (const s of [-1, 1]) {
        rr.push(); rr.translate(s * 0.12, 0.05, 0); rr.rotZ(s * flap); rr.scale(s, 1, 1);
        rr.draw(M.get('bat.wing'), { tint: this.tint() });
        rr.pop();
      }
    }, ry: this.state === 'perch' ? 0 : this.vis });
    if (!frozen) this.shadow(r, 0.2);
  }
}

// ---------------- Shellguard (shielded beetle knight) ----------------
class Knight extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.hp = this.maxHp = 4;
    this.dmg = 2;
    this.r = 0.36;
    this.bodyHw = 0.3;
    this.dir = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(rand(0, 4))];
    this.vis = this.dir;
    this.walkT = 0;
    this.lootChance = 0.7;
  }
  guard(src) {
    if (this.stun > 0) return null;
    if (!['sword', 'arrow', 'thrown', 'reflect'].includes(src.type)) return null;
    const a = Math.atan2(src.x - this.x, src.z - this.z);
    if (Math.abs(angleDiff(this.vis, a)) < 1.0) return 'block';
    return null;
  }
  ai(dt) {
    const p = this.player;
    const d = this.distToPlayer();
    const sees = d < 6 && !this.game.wallBetween(this.x, this.z, p.x, p.z) && Math.abs(angleDiff(this.dir, this.angleToPlayer())) < 1.7;
    if (this.state === 'idle') {
      if (sees) { this.setState('alert'); this.game.audio.sfx('alert', 0.5); }
      else {
        this.walkT += dt;
        if (this.walk(this.dir, 1.3, dt) || this.st > rand(1.5, 3)) {
          this.dir = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(rand(0, 4))];
          this.st = 0;
        }
      }
    } else if (this.state === 'alert') {
      this.dir = this.angleToPlayer();
      if (this.st > 0.4) this.setState('charge');
    } else if (this.state === 'charge') {
      this.dir = this.angleToPlayer();
      this.walkT += dt * 2;
      const blocked = this.walk(this.dir, 3.1, dt);
      if (this.st > 1.8 || (blocked && this.st > 0.3)) { this.setState('rest'); }
    } else if (this.state === 'rest') {
      if (this.st > 0.8) this.setState('idle');
    }
    this.turnTo(this.dir, dt, this.state === 'charge' ? 6 : 10);
  }
  draw(r, frozen) {
    const M = this.game.models;
    const bob = Math.abs(Math.sin(this.walkT * 10)) * 0.04;
    this.drawModel(r, 'knight', { y: bob, extra: (rr) => {
      rr.push(); rr.translate(0.0, 0.42, 0.3); rr.rotY(this.stun > 0 ? 0.9 : 0); rr.draw(M.get('knight.shield'), { tint: this.tint() }); rr.pop();
      rr.push(); rr.translate(-0.3, 0.4, 0.05); rr.rotX(this.state === 'charge' ? 1.2 : 0.2); rr.draw(M.get('knight.spear'), { tint: this.tint() }); rr.pop();
    } });
    if (!frozen) this.shadow(r, 0.36);
  }
}

// ---------------- Pinchy (crab) ----------------
class Crab extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.hp = this.maxHp = 2;
    this.r = 0.33;
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.wait = rand(0.3, 1);
    this.dir = 0;
    this.vis = 0;
    this.walkT = 0;
  }
  ai(dt) {
    if (this.state === 'idle') {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.setState('scuttle');
        const p = this.player;
        this.side = Math.abs(p.z - this.z) < 2.5 ? Math.sign(p.x - this.x) || 1 : (Math.random() < 0.5 ? -1 : 1);
        this.zdir = Math.abs(p.z - this.z) > 0.5 && Math.random() < 0.5 ? Math.sign(p.z - this.z) : 0;
        this.dur = rand(0.5, 1.1);
      }
    } else {
      this.walkT += dt;
      const blocked = this.move(this.side * 3.4 * dt, (this.zdir || 0) * 1.2 * dt);
      if (blocked || this.st > this.dur) { this.setState('idle'); this.wait = rand(0.3, 0.9); }
    }
  }
  draw(r, frozen) {
    const M = this.game.models;
    const bob = this.state === 'scuttle' ? Math.abs(Math.sin(this.walkT * 22)) * 0.04 : 0;
    const snap = Math.max(0, Math.sin(this.t * 6)) * 0.4;
    this.drawModel(r, 'crab', { y: bob, ry: 0, extra: (rr) => {
      for (const s of [-1, 1]) {
        rr.push(); rr.translate(s * 0.3, 0.2, 0.18); rr.rotY(-s * snap); rr.draw(M.get('crab.claw'), { tint: this.tint() }); rr.pop();
      }
    } });
    if (!frozen) this.shadow(r, 0.34);
  }
}

// ---------------- Lurker (fish in the water) ----------------
class Lurker extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.hp = this.maxHp = 2;
    this.swims = true;
    this.r = 0.35;
    this.bodyHw = 0.3;
    this.state = 'under';
    this.wait = rand(1, 2.5);
    this.y = -0.5;
    this.harmless = true;
  }
  hurt(src) {
    if (this.state === 'under' && src.type !== 'frost') return undefined;
    return super.hurt(src);
  }
  ai(dt) {
    const g = this.game, p = this.player;
    if (this.state === 'under') {
      this.y = lerp(this.y, -0.55, dt * 4);
      this.harmless = true;
      // drift towards the hero beneath the surface
      const a = this.angleToPlayer();
      this.walk(a, 1.4, dt);
      this.dir = a;
      if (Math.random() < 0.06) g.particles.add({ x: this.x + rand(-0.2, 0.2), y: -0.1, z: this.z + rand(-0.2, 0.2), vy: 0.4, life: 0.4, size: 0.1, col: [0.85, 0.95, 1], shape: 1, additive: false });
      this.wait -= dt;
      if (this.wait <= 0 && this.distToPlayer() < 7) { this.setState('rise'); g.particles.splash(this.x, -0.1, this.z, 6); g.audio.sfx('splashSmall', 0.6); }
    } else if (this.state === 'rise') {
      this.y = lerp(-0.5, 0.05, Math.min(1, this.st / 0.35));
      this.dir = this.angleToPlayer();
      if (this.st > 0.5) {
        g.add(new Shot(g, this.x, this.z, p.x - this.x, p.z - this.z, { kind: 'bubble', speed: 4.5, y: 0.4, reflectable: true }), this.screenKey);
        g.audio.sfx('bubble');
        this.setState('up');
      }
    } else if (this.state === 'up') {
      this.harmless = false;
      this.dir = this.angleToPlayer();
      if (this.st > 1.3) { this.setState('under'); this.wait = rand(1.8, 3); g.particles.splash(this.x, -0.1, this.z, 5); }
    }
    this.turnTo(this.dir, dt, 8);
  }
  draw(r, frozen) {
    if (this.state === 'under' && !frozen) {
      r.blob(this.x, -0.12, this.z, 0.35, 0.35);
      return;
    }
    const wob = Math.sin(this.t * 8) * 0.1;
    this.drawModel(r, 'lurker', { extra: (rr) => { rr.push(); rr.translate(0, 0.15, -0.3); rr.rotY(wob); rr.draw(this.game.models.get('lurker.tail'), { tint: this.tint() }); rr.pop(); } });
  }
}

// ---------------- Ember (living flame) ----------------
class Ember extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.hp = this.maxHp = 1;
    this.r = 0.3;
    this.flying = true;
    this.y = 0.35;
    this.freezable = false;
    this.lootChance = 0.6;
  }
  isFire() { return true; }
  onFrost() { this.die(); this.game.audio.sfx('fizzle'); return 'hit'; }
  guard(src) {
    if (src.type === 'bomb') return null;
    if (src.type === 'sword' || src.type === 'spin') { this.game.particles.sparks(this.x, 0.4, this.z, 6, [1, 0.6, 0.2], 3); return 'block'; }
    return 'block';
  }
  hurt(src) {
    if (src.type === 'boomerang') return undefined;
    return super.hurt(src);
  }
  ai(dt) {
    const a = this.angleToPlayer() + Math.sin(this.t * 1.7) * 0.8;
    this.walk(a, 1.2, dt);
    this.y = 0.35 + Math.sin(this.t * 4) * 0.08;
    this.game.particles.fire(this.x, this.y + 0.1, this.z, 1.3, dt);
    // set brambles and torches it touches alight
    for (const e of this.game.entities) if ((e.isTorch || e.isBramble) && e.dist(this) < 0.9 && e.hurt) e.hurt({ type: 'fire', fire: true });
  }
  draw(r) {
    const t = this.t;
    r.push(); r.translate(this.x, this.y, this.z); r.rotY(this.angleToPlayer());
    r.scale(1 + Math.sin(t * 9) * 0.06, 1 + Math.sin(t * 7) * 0.08, 1);
    r.draw(this.game.models.get('ember'), { emis: 1.0, shadow: false, tint: this.flash > 0 ? [1, 1, 1, 0.7] : null });
    r.pop();
    r.light(this.x, this.y + 0.5, this.z, 3.2, 1.8, 0.8, 0.25);
  }
}

// ---------------- Bonefin (skeleton fish that dodges and throws bones) ----------------
class Skelly extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.hp = this.maxHp = 3;
    this.r = 0.33;
    this.wait = rand(0.5, 1.5);
    this.walkT = 0;
    this.lootChance = 0.6;
  }
  ai(dt) {
    const g = this.game, p = this.player;
    const d = this.distToPlayer();
    // hop away from sword swings
    if (this.state !== 'dodge' && p.state === 'swing' && d < 2.2 && Math.random() < 0.6) {
      this.dodgeA = this.angleToPlayer() + Math.PI + rand(-0.5, 0.5);
      this.setState('dodge');
      g.audio.sfx('jump', 0.4);
    }
    if (this.state === 'dodge') {
      this.y = Math.sin(Math.min(1, this.st / 0.35) * Math.PI) * 0.5;
      this.walk(this.dodgeA, 6, dt);
      if (this.st > 0.35) { this.y = 0; this.setState('idle'); this.wait = 0.3; }
    } else if (this.state === 'idle') {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (d < 6 && Math.random() < 0.5) this.setState('throw');
        else { this.setState('walk'); this.walkA = Math.random() < 0.6 ? this.angleToPlayer() : rand(0, TAU); }
      }
    } else if (this.state === 'walk') {
      this.walkT += dt;
      this.dir = this.walkA;
      if (this.walk(this.walkA, 1.6, dt) || this.st > 1.2) { this.setState('idle'); this.wait = rand(0.4, 1); }
    } else if (this.state === 'throw') {
      this.dir = this.angleToPlayer();
      if (this.st > 0.4) {
        g.add(new Shot(g, this.x, this.z, p.x - this.x, p.z - this.z, { kind: 'bone', speed: 5, y: 0.6, reflectable: true }), this.screenKey);
        g.audio.sfx('throw', 0.6);
        this.setState('idle'); this.wait = rand(0.8, 1.6);
      }
    }
    this.turnTo(this.dir, dt, 10);
  }
  draw(r, frozen) {
    const bob = this.state === 'walk' ? Math.abs(Math.sin(this.walkT * 12)) * 0.05 : 0;
    const arm = this.state === 'throw' ? -this.st * 4 : 0;
    this.drawModel(r, 'skelly', { y: bob, extra: (rr) => { rr.push(); rr.translate(-0.25, 0.45, 0); rr.rotX(arm); rr.draw(this.game.models.get('bone'), { tint: this.tint() }); rr.pop(); } });
    if (!frozen) this.shadow(r, 0.3);
  }
}

// ---------------- Thornball (spiked trap) ----------------
class Roller extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.home = [x, z];
    this.r = 0.38;
    this.bodyHw = 0.4;
    this.dmg = 2;
    this.freezable = false;
    this.stunnable = false;
    this.state = 'wait';
    this.spin = 0;
    this.lootChance = 0;
  }
  hurt(src) {
    if (['sword', 'spin', 'arrow', 'boomerang', 'thrown'].includes(src.type)) return 'block';
    return undefined;
  }
  passThrough(e) { return e instanceof Roller; }
  ai(dt) {
    const p = this.player;
    if (this.state === 'wait') {
      const dx = p.x - this.x, dz = p.z - this.z;
      if (Math.abs(dz) < 0.5 && Math.abs(dx) < 9) { this.go = [Math.sign(dx), 0]; this.setState('rush'); this.game.audio.sfx('roll'); }
      else if (Math.abs(dx) < 0.5 && Math.abs(dz) < 9) { this.go = [0, Math.sign(dz)]; this.setState('rush'); this.game.audio.sfx('roll'); }
    } else if (this.state === 'rush') {
      const blocked = this.move(this.go[0] * 8 * dt, this.go[1] * 8 * dt);
      this.spin += dt * 20;
      if (blocked) { this.setState('back'); this.game.audio.sfx('tink', 0.6); }
    } else if (this.state === 'back') {
      const dx = this.home[0] - this.x, dz = this.home[1] - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) { this.x = this.home[0]; this.z = this.home[1]; this.setState('wait'); return; }
      const s = Math.min(d, 2 * dt);
      this.x += dx / d * s; this.z += dz / d * s;
      this.spin -= dt * 5;
    }
  }
  draw(r) {
    r.push(); r.translate(this.x, 0.38, this.z); r.rotY(this.spin * 0.3); r.rotX(this.spin);
    r.draw(this.game.models.get('roller'));
    r.pop();
    this.shadow(r, 0.35);
  }
}

// ---------------- Gloomwisp (foggy ghost) ----------------
class Wisp extends Enemy {
  constructor(g, x, z, s) {
    super(g, x, z, s);
    this.hp = this.maxHp = 2;
    this.flying = true;
    this.ghost = false;
    this.r = 0.33;
    this.y = 0.6;
    this.freezable = false;
    this.fireWeak = true;
    this.boomerangHurts = false;
    this.fade = 0.4;
  }
  onFrost() { this.stun = 2; return 'hit'; }
  ai(dt) {
    const a = this.angleToPlayer() + Math.sin(this.t * 1.3) * 1.2;
    this.walk(a, 1.7, dt);
    this.dir = a;
    this.y = 0.6 + Math.sin(this.t * 2.5) * 0.15;
    const d = this.distToPlayer();
    this.fade = lerp(this.fade, d < 3 ? 1 : 0.45, dt * 3);
    this.turnTo(this.dir, dt, 6);
  }
  draw(r) {
    const M = this.game.models;
    r.push(); r.translate(this.x, this.y, this.z); r.rotY(this.vis);
    r.scale(1, 1 + Math.sin(this.t * 4) * 0.06, 1);
    r.draw(M.get('wisp'), { alpha: this.fade, tint: this.tint(), emis: 0.2, shadow: false });
    r.pop();
    r.light(this.x, this.y, this.z, 2, 0.4, 0.3, 0.8);
    if (Math.random() < 0.2) this.game.particles.add({ x: this.x + rand(-0.2, 0.2), y: this.y - 0.2, z: this.z + rand(-0.2, 0.2), vy: -0.2, life: 0.8, size: 0.4, size1: 0.8, col: [0.35, 0.3, 0.5], alpha: 0.35, shape: 3, additive: false });
  }
}

export const ENEMIES = { slime: Slime, spitter: Sprout, bat: Bat, knight: Knight, crab: Crab, lurker: Lurker, ember: Ember, skelly: Skelly, roller: Roller, wisp: Wisp };
export { Slime };
