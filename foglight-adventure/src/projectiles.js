// Things that fly: the Leafarang, arrows, bombs and their explosions, frost
// bolts, and the seeds and fireballs monsters throw back at you.

import { Entity } from './entity.js';
import { Pickup } from './objects.js';
import { T, TILE } from './tiles.js';
import { clamp, lerp, rand, angleDiff } from './math.js';

function tallAt(g, x, z) {
  return TILE[g.area.tileAt(Math.floor(x), Math.floor(z))].tall;
}
function tallEntityAt(g, x, z, except) {
  for (const e of g.entities) {
    if (e === except || e.dead || !e.solid || !e.tall) continue;
    if (Math.abs(x - e.x) < e.hw && Math.abs(z - e.z) < e.hw) return e;
  }
  return null;
}
function fireNear(g, x, z) {
  for (const e of g.entities) if (e.isFire && e.isFire() && Math.hypot(e.x - x, e.z - z) < 0.6) return true;
  return false;
}

// ---------------- Leafarang ----------------
export class Boomerang extends Entity {
  constructor(g, p) {
    super(g, p.x + p.fx * 0.3, p.z + p.fz * 0.3);
    this.owner = p;
    this.vx = p.fx; this.vz = p.fz;
    this.y = 0.45;
    this.r = 0.25;
    this.t = 0;
    this.back = false;
    this.speed = 11.5;
    this.hits = new Set();
    this.carrying = [];
    this.fire = 0;
    this.transient = true;
    this.followsPlayer = true;
    this.whirr = 0;
  }
  update(dt) {
    const g = this.game, p = this.owner;
    this.t += dt;
    this.whirr -= dt;
    if (this.whirr <= 0) { this.whirr = 0.13; g.audio.sfx('whirr', 0.5); }
    if (!this.back && this.t > 0.4) this.back = true;
    if (this.back) {
      const dx = p.x - this.x, dz = p.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.45) return this.caught();
      this.vx = dx / d; this.vz = dz / d;
      this.speed = Math.min(13, this.speed + dt * 10);
    }
    const nx = this.x + this.vx * this.speed * dt, nz = this.z + this.vz * this.speed * dt;
    if (!this.back && (tallAt(g, nx, nz) || tallEntityAt(g, nx, nz))) {
      const te = tallEntityAt(g, nx, nz);
      if (te && te.hurt && !this.hits.has(te)) { this.hits.add(te); te.hurt(this.src()); }
      g.particles.sparks(this.x, this.y, this.z, 5, [1, 0.9, 0.6], 2);
      g.audio.sfx('tink', 0.5);
      this.back = true;
    } else { this.x = nx; this.z = nz; }
    if (this.t > 3) return this.caught();
    // fire
    if (fireNear(g, this.x, this.z)) { if (!this.fire) g.audio.sfx('fireup'); this.fire = 3; }
    if (this.fire > 0) {
      this.fire -= dt;
      g.particles.fire(this.x, this.y, this.z, 0.9, dt);
    }
    for (const e of g.entities) {
      if (e === this || e.dead || this.hits.has(e)) continue;
      if (e instanceof Pickup) {
        const small = !['heartPiece', 'heartContainer', 'luckyShell', 'bigKey'].includes(e.kind);
        if (small && Math.hypot(e.x - this.x, e.z - this.z) < 0.5 && !e.carriedBy) { e.carriedBy = this; this.carrying.push(e); this.back = true; }
        continue;
      }
      if (!e.hurt) continue;
      if (Math.hypot(e.x - this.x, e.z - this.z) < e.r + this.r && Math.abs((e.y || 0) - this.y) < 1.2) {
        this.hits.add(e);
        const res = e.hurt(this.src());
        if (res === 'hit' || res === 'block') {
          if (!this.back) { this.back = true; g.particles.sparks(this.x, this.y, this.z, 5, [1, 1, 0.7], 2); }
        }
      }
    }
    for (const c of this.carrying) { c.x = this.x; c.z = this.z; c.y = 0; }
  }
  src() { return { type: 'boomerang', dmg: this.fire > 0 ? 1 : 0, stun: 2.2, fire: this.fire > 0, x: this.x - this.vx, z: this.z - this.vz, owner: this.owner }; }
  caught() {
    this.dead = true;
    for (const c of this.carrying) { c.carriedBy = null; if (!c.dead) c.collect(); }
    this.game.audio.sfx('catch', 0.6);
  }
  draw(r) {
    r.push(); r.translate(this.x, this.y, this.z); r.rotY(this.t * 22); r.rotX(0.15);
    r.draw(this.game.models.get('boomerang'));
    r.pop();
    r.blob(this.x, 0, this.z, 0.2, 0.2);
    if (this.fire > 0) r.light(this.x, this.y + 0.3, this.z, 3, 1.6, 0.8, 0.3);
  }
}

// ---------------- arrows ----------------
export class Arrow extends Entity {
  constructor(g, p) {
    super(g, p.x + p.fx * 0.4, p.z + p.fz * 0.4);
    this.owner = p;
    this.vx = p.fx * 15; this.vz = p.fz * 15;
    this.y = 0.48;
    this.r = 0.15;
    this.t = 0;
    this.stuck = 0;
    this.fire = false;
    this.transient = true;
    this.ang = p.dir;
  }
  update(dt) {
    const g = this.game;
    this.t += dt;
    if (this.stuck > 0) { this.stuck -= dt; if (this.stuck <= 0) this.dead = true; return; }
    if (this.fall) {
      this.fall.t += dt; this.y += this.fall.vy * dt; this.fall.vy -= 15 * dt; this.x += this.vx * 0.05 * dt; this.z += this.vz * 0.05 * dt;
      if (this.y < 0) this.dead = true;
      return;
    }
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + this.vx * dt / steps, nz = this.z + this.vz * dt / steps;
      const te = tallEntityAt(g, nx, nz);
      if (te) {
        const res = te.hurt ? te.hurt(this.src()) : undefined;
        if (res === 'hit') { this.dead = true; return; }
        this.stuck = 0.4; g.audio.sfx('thunk', 0.6); return;
      }
      if (tallAt(g, nx, nz)) { this.stuck = 0.5; g.audio.sfx('thunk', 0.6); return; }
      this.x = nx; this.z = nz;
      if (!this.fire && fireNear(g, this.x, this.z)) { this.fire = true; g.audio.sfx('fireup'); }
      for (const e of g.entities) {
        if (e === this || e.dead || !e.hurt || e === this.owner) continue;
        if (Math.hypot(e.x - this.x, e.z - this.z) < e.r + this.r && Math.abs((e.y || 0) - this.y) < (e.tall ? 2 : 1)) {
          const res = e.hurt(this.src());
          if (res === 'hit') { this.dead = true; g.particles.sparks(this.x, this.y, this.z, 4, [1, 0.9, 0.7], 2); return; }
          if (res === 'block') { this.fall = { t: 0, vy: 3 }; this.vx = -this.vx; this.vz = -this.vz; g.audio.sfx('tink'); return; }
        }
      }
    }
    if (this.fire) g.particles.fire(this.x, this.y, this.z, 0.6, dt);
    if (this.t > 1.2) this.dead = true;
  }
  src() { return { type: 'arrow', dmg: 2, fire: this.fire, x: this.x - this.vx * 0.05, z: this.z - this.vz * 0.05, owner: this.owner }; }
  draw(r) {
    r.push(); r.translate(this.x, this.y, this.z); r.rotY(Math.atan2(this.vx, this.vz));
    if (this.fall) r.rotX(this.fall.t * 10);
    r.draw(this.game.models.get('arrow'));
    r.pop();
    if (this.fire) r.light(this.x, this.y + 0.3, this.z, 2.6, 1.6, 0.8, 0.3);
  }
}

// ---------------- bombs ----------------
export class Bomb extends Entity {
  constructor(g, x, z, owner) {
    super(g, x, z);
    this.owner = owner;
    this.fuse = 2.4;
    this.r = 0.3;
    this.liftable = true;
    this.isBomb = true;
    this.squash = 0;
    this.followsPlayer = true;
  }
  interact(p, lifting) {
    if (!lifting) return false;
    p.liftEntity(this);
    this.dead = true;
    return true;
  }
  carryTick(dt, p) {
    this.fuse -= dt;
    if (this.fuse <= 0) { p.carry = null; this.explode(p.x, p.z); }
  }
  onLand(x, z, hit, tile) {
    const g = this.game;
    if (tile.water && !g.isFrozen(Math.floor(x), Math.floor(z))) { g.particles.splash(x, 0, z, 10); g.audio.sfx('fizzle'); return; }
    if (tile.pit) return;
    this.x = x; this.z = z; this.dead = false;
    this.squash = 0.3;
    g.add(this);
  }
  update(dt) {
    this.fuse -= dt;
    this.squash = Math.max(0, this.squash - dt);
    const t = TILE[this.game.area.tileAt(this.tx, this.tz)];
    if (t.water && !this.game.isFrozen(this.tx, this.tz)) { this.dead = true; this.game.particles.splash(this.x, 0, this.z, 8); return; }
    if (Math.random() < 0.5) this.game.particles.add({ x: this.x, y: 0.5, z: this.z, vy: 0.8, life: 0.3, size: 0.07, col: [1, 0.8, 0.3], shape: 1 });
    if (this.fuse <= 0) this.explode(this.x, this.z);
  }
  hurt(src) {
    if (src.type === 'bomb' && this.fuse > 0.1) { this.fuse = 0.1; return 'hit'; }
    if (src.fire && this.fuse > 0.5) { this.fuse = 0.5; return 'hit'; }
    return undefined;
  }
  explode(x, z) {
    this.dead = true;
    const g = this.game;
    g.add(new Explosion(g, x, z, this.owner));
  }
  drawCarried(r, x, y, z) { this.drawAt(r, x, y, z); }
  drawAt(r, x, y, z) {
    const blink = this.fuse < 1 ? Math.floor(this.fuse * 14) % 2 === 0 : Math.floor(this.fuse * 5) % 2 === 0;
    const s = 1 + (this.fuse < 0.6 ? (0.6 - this.fuse) * 0.4 : 0);
    r.push(); r.translate(x, y, z); r.scale(s * (1 + this.squash * 0.5), s * (1 - this.squash * 0.6), s * (1 + this.squash * 0.5));
    r.draw(this.game.models.get('bomb'), { tint: blink ? [1, 1, 1, 0.45] : null });
    r.pop();
    r.sprite(x, y + 0.5, z, 0.25, 1, 0.8, 0.3, 0.9, 0, true);
  }
  draw(r) { this.drawAt(r, this.x, 0, this.z); r.blob(this.x, 0, this.z, 0.25, 0.3); }
}

export class Explosion extends Entity {
  constructor(g, x, z, owner) {
    super(g, x, z);
    this.t = 0;
    this.r = 0;
    this.owner = owner;
    this.transient = true;
    g.audio.sfx('explode');
    g.shake(0.25, 0.35);
    g.hitstop(0.04);
    g.hitArea({ type: 'bomb', dmg: 4, x, z, owner }, x, z, 1.5);
    const P = g.particles;
    for (let i = 0; i < 18; i++) {
      const a = rand(0, 6.28), s = rand(1, 4);
      P.add({ x, y: 0.4, z, vx: Math.cos(a) * s, vy: rand(0.5, 3), vz: Math.sin(a) * s, drag: 3, life: rand(0.3, 0.6), size: rand(0.6, 1.1), size1: 0.1, col: [1, 0.85, 0.4], col1: [1, 0.3, 0.05] });
    }
    for (let i = 0; i < 12; i++) {
      const a = rand(0, 6.28), s = rand(0.5, 2.5);
      P.add({ x, y: 0.5, z, vx: Math.cos(a) * s, vy: rand(1, 2.5), vz: Math.sin(a) * s, drag: 2, life: rand(0.7, 1.2), size: rand(0.6, 1), size1: 1.6, col: [0.35, 0.33, 0.32], alpha: 0.7, shape: 3, additive: false, fadeIn: 0.1 });
    }
    P.sparks(x, 0.4, z, 14, [1, 0.8, 0.3], 6);
  }
  update(dt) { this.t += dt; if (this.t > 0.3) this.dead = true; }
  draw(r) {
    const k = this.t / 0.3;
    r.light(this.x, 1, this.z, 6 * (1 - k), 3, 1.8, 0.6);
    r.sprite(this.x, 0.5, this.z, 3 * (0.5 + k), 1, 0.9, 0.6, (1 - k) * 0.9, 0, true);
  }
}

// ---------------- frost ----------------
export class FrostBolt extends Entity {
  constructor(g, p) {
    super(g, p.x + p.fx * 0.4, p.z + p.fz * 0.4);
    this.owner = p;
    this.vx = p.fx * 9.5; this.vz = p.fz * 9.5;
    this.y = 0.45; this.r = 0.25; this.t = 0;
    this.transient = true;
  }
  update(dt) {
    const g = this.game;
    this.t += dt;
    const steps = 2;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + this.vx * dt / steps, nz = this.z + this.vz * dt / steps;
      const te = tallEntityAt(g, nx, nz);
      if (te) { te.hurt && te.hurt(this.src()); return this.burst(); }
      if (tallAt(g, nx, nz)) return this.burst();
      this.x = nx; this.z = nz;
      // freeze the water we fly over
      const tx = Math.floor(this.x), tz = Math.floor(this.z);
      const d = g.area.tileDef(tx, tz);
      if (d.water && !g.isFrozen(tx, tz)) {
        const ice = new IceTile(g, tx + 0.5, tz + 0.5);
        g.add(ice);
      }
      for (const e of g.entities) {
        if (e === this || e.dead || !e.hurt || e instanceof IceTile) continue;
        if (Math.hypot(e.x - this.x, e.z - this.z) < e.r + this.r && Math.abs((e.y || 0) - this.y) < 1.2) {
          const res = e.hurt(this.src());
          if (res) return this.burst();
        }
      }
    }
    if (Math.random() < 0.9) g.particles.add({ x: this.x + rand(-0.1, 0.1), y: this.y + rand(-0.1, 0.1), z: this.z + rand(-0.1, 0.1), vy: -0.3, life: 0.5, size: 0.15, size1: 0.02, col: [0.75, 0.95, 1], shape: 2 });
    if (this.t > 1.0) this.burst();
  }
  src() { return { type: 'frost', dmg: 1, x: this.x - this.vx * 0.05, z: this.z - this.vz * 0.05, owner: this.owner }; }
  burst() {
    this.dead = true;
    this.game.particles.ring(this.x, this.y, this.z, [0.7, 0.95, 1], 12, 2, 0.15);
    this.game.audio.sfx('frostHit');
  }
  draw(r) {
    r.sprite(this.x, this.y, this.z, 0.7, 0.6, 0.9, 1, 0.8, 0, true);
    r.sprite(this.x, this.y, this.z, 0.35, 1, 1, 1, 1, 2, true);
    r.light(this.x, this.y + 0.3, this.z, 2.5, 0.5, 0.9, 1.4);
  }
}

export class IceTile extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.life = 14;
    this.r = 0.5;
    this.grow = 0;
    const k = this.tz * g.area.w + this.tx;
    g.frozen.set(k, this);
    this.key = k;
    g.audio.sfx('freeze', 0.6);
    g.particles.ring(x, 0, z, [0.85, 0.97, 1], 8, 1.5, 0.2);
  }
  update(dt) {
    this.life -= dt;
    this.grow = Math.min(1, this.grow + dt * 6);
    if (this.life <= 0) {
      this.dead = true;
      if (this.game.frozen.get(this.key) === this) this.game.frozen.delete(this.key);
      this.game.particles.splash(this.x, 0, this.z, 5);
      this.game.audio.sfx('melt', 0.5);
    }
  }
  hurt(src) {
    if (src.type === 'fire' || src.fire) { this.life = Math.min(this.life, 0.01); return 'hit'; }
    return undefined;
  }
  draw(r) {
    if (this.life < 2.5 && Math.floor(this.life * 8) % 2 === 0) return;
    r.push(); r.translate(this.x, 0, this.z); r.scale(this.grow, 1, this.grow);
    r.draw(this.game.models.get('iceTile'), { shadow: false });
    r.pop();
  }
}

// ---------------- enemy shots ----------------
export class Shot extends Entity {
  constructor(g, x, z, dx, dz, opts = {}) {
    super(g, x, z);
    const l = Math.hypot(dx, dz) || 1;
    this.speed = opts.speed ?? 6;
    this.vx = dx / l * this.speed; this.vz = dz / l * this.speed;
    this.y = opts.y ?? 0.45;
    this.r = opts.r ?? 0.18;
    this.dmg = opts.dmg ?? 1;
    this.kind = opts.kind ?? 'seed';
    this.reflectable = opts.reflectable ?? this.kind === 'seed';
    this.fireShot = this.kind === 'fire';
    this.mine = false;
    this.t = 0;
    this.transient = true;
    this.life = opts.life ?? 3;
    this.flies = opts.flies ?? false;
  }
  isFire() { return this.fireShot; }
  update(dt) {
    const g = this.game;
    this.t += dt;
    this.x += this.vx * dt; this.z += this.vz * dt;
    if ((!this.flies && tallAt(g, this.x, this.z)) || tallEntityAt(g, this.x, this.z) || this.t > this.life) {
      const te = tallEntityAt(g, this.x, this.z);
      if (te && te.hurt && this.fireShot) te.hurt({ type: 'fire', fire: true });
      return this.pop();
    }
    if (this.kind === 'fire') g.particles.fire(this.x, this.y, this.z, 0.8, dt);
    if (this.kind === 'bubble' && Math.random() < 0.2) g.particles.add({ x: this.x, y: this.y, z: this.z, vy: 0.5, life: 0.4, size: 0.08, col: [0.8, 0.95, 1], shape: 1 });
    if (this.mine) {
      for (const e of g.entities) {
        if (e.isEnemy && !e.dead && Math.hypot(e.x - this.x, e.z - this.z) < e.r + this.r) {
          e.hurt({ type: 'reflect', dmg: 2, x: this.x - this.vx, z: this.z - this.vz });
          return this.pop();
        }
      }
      return;
    }
    const p = g.player;
    if (Math.hypot(p.x - this.x, p.z - this.z) < p.r + this.r && Math.abs(p.y + 0.4 - this.y) < 0.6) {
      // a sword swing in progress bats seeds back
      if (this.reflectable && (p.state === 'swing' || p.state === 'spin' || p.state === 'charge')) return this.reflect();
      p.hurt({ type: this.kind, dmg: this.dmg, x: this.x - this.vx, z: this.z - this.vz });
      return this.pop();
    }
  }
  hurt(src) {
    if (this.reflectable && (src.type === 'sword' || src.type === 'spin')) { this.reflect(); return 'hit'; }
    if (src.type === 'frost' && this.fireShot) { this.pop(); return 'hit'; }
    return undefined;
  }
  reflect() {
    if (this.mine) return;
    const p = this.game.player;
    this.mine = true;
    this.vx = p.fx * this.speed * 1.4; this.vz = p.fz * this.speed * 1.4;
    this.game.audio.sfx('reflect');
    this.game.particles.sparks(this.x, this.y, this.z, 6, [1, 1, 0.7], 3);
  }
  pop() {
    this.dead = true;
    this.game.particles.puff(this.x, this.y, this.z, 4, this.kind === 'fire' ? [0.4, 0.35, 0.3] : [0.8, 0.75, 0.6], 0.3, 1.2);
  }
  draw(r) {
    const M = this.game.models;
    if (this.kind === 'seed') {
      r.drawAt(M.get('seed'), this.x, this.y, this.z, this.t * 10);
      r.blob(this.x, 0, this.z, 0.12, 0.25);
    } else if (this.kind === 'fire') {
      r.sprite(this.x, this.y, this.z, 0.8, 1, 0.55, 0.15, 0.85, 0, true);
      r.sprite(this.x, this.y, this.z, 0.3, 1, 0.95, 0.7, 1, 1, true);
      r.light(this.x, this.y + 0.3, this.z, 2.5, 1.6, 0.7, 0.2);
    } else if (this.kind === 'bubble') {
      r.drawAt(M.get('bubble'), this.x, this.y, this.z, this.t * 3, 1 + Math.sin(this.t * 12) * 0.08, { alpha: 0.8 });
    } else if (this.kind === 'bone') {
      r.push(); r.translate(this.x, this.y, this.z); r.rotY(this.t * 14); r.draw(M.get('bone')); r.pop();
    } else if (this.kind === 'gloom') {
      r.sprite(this.x, this.y, this.z, 0.9, 0.45, 0.25, 0.7, 0.8, 0, true);
      r.sprite(this.x, this.y, this.z, 0.35, 0.9, 0.7, 1, 1, 2, true);
      r.light(this.x, this.y + 0.3, this.z, 2.2, 0.6, 0.3, 1.0);
    }
  }
}
