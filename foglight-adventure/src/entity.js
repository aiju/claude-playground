// Base classes for everything that lives in a screen.

import { clamp } from './math.js';

let nextUid = 1;

export class Entity {
  constructor(game, x, z) {
    this.game = game;
    this.uid = nextUid++;
    this.x = x; this.z = z; this.y = 0;
    this.r = 0.35;          // radius for hits and overlaps
    this.hw = 0.45;         // half-size of the collision box, if solid
    this.solid = false;     // blocks movement
    this.low = false;       // solid but flyers pass over it
    this.dead = false;
    this.screenKey = null;  // which screen spawned this (null = follows the hero)
    this.sortY = 0;
  }
  get tx() { return Math.floor(this.x); }
  get tz() { return Math.floor(this.z); }
  update(dt) {}
  draw(r) {}
  // Return 'hit' (took it), 'block' (deflected it) or undefined (ignored it).
  hurt(src) { return undefined; }
  remove() { this.dead = true; }
  dist(o) { return Math.hypot(o.x - this.x, o.z - this.z); }
  overlaps(o, pad = 0) { return Math.hypot(o.x - this.x, o.z - this.z) < this.r + o.r + pad; }
  boxOverlaps(x, z, hw) {
    return Math.abs(x - this.x) < hw + this.hw && Math.abs(z - this.z) < hw + this.hw;
  }
}

// Something that walks around, takes damage and gets knocked back.
export class Actor extends Entity {
  constructor(game, x, z) {
    super(game, x, z);
    this.hp = 1;
    this.maxHp = 1;
    this.kvx = 0; this.kvz = 0; this.kt = 0;  // knockback
    this.invuln = 0;
    this.flash = 0;
    this.stun = 0;
    this.flying = false;
    this.airborne = false;
    this.avoidPits = true;
    this.bodyHw = 0.28;
    this.dir = 0;
  }

  // Move with collision against tiles and solid entities; returns true if
  // the move was blocked on either axis.
  move(dx, dz) {
    const g = this.game;
    let blocked = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.2));
    const sx = dx / steps, sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      if (sx) {
        if (!g.isBlocked(this, this.x + sx, this.z, this.bodyHw)) this.x += sx;
        else blocked = true;
      }
      if (sz) {
        if (!g.isBlocked(this, this.x, this.z + sz, this.bodyHw)) this.z += sz;
        else blocked = true;
      }
    }
    return blocked;
  }

  knock(fromX, fromZ, speed = 8, time = 0.18) {
    let dx = this.x - fromX, dz = this.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    this.kvx = (dx / l) * speed; this.kvz = (dz / l) * speed;
    this.kt = time;
  }

  updateKnock(dt) {
    if (this.kt > 0) {
      this.kt -= dt;
      this.move(this.kvx * dt, this.kvz * dt);
      return true;
    }
    return false;
  }

  tickTimers(dt) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
  }

  tint() {
    if (this.flash > 0) return [1, 1, 1, clamp(this.flash * 8, 0, 0.85)];
    if (this.stun > 0) return [0.5, 0.7, 1, 0.25 + 0.15 * Math.sin(this.game.time * 30)];
    return null;
  }
}
