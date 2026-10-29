// Pip the fox: movement, sword (with charged spin), lifting and throwing,
// pushing, ledge hops, jumping, and using items.

import { Actor } from './entity.js';
import { T, TILE } from './tiles.js';
import { clamp, angleDiff, lerp, rand, TAU } from './math.js';

const SPEED = 4.7;
const SWING_TIME = 0.2;
const SPIN_TIME = 0.42;
const CHARGE_TIME = 0.7;
const REACH = 1.3;

export class Player extends Actor {
  constructor(game, x, z) {
    super(game, x, z);
    this.isPlayer = true;
    this.r = 0.3;
    this.bodyHw = 0.27;
    this.avoidPits = false;
    this.state = 'normal';
    this.st = 0;
    this.dir = Math.PI;
    this.vis = Math.PI;
    this.walkT = 0;
    this.moving = false;
    this.vy = 0;
    this.carry = null;
    this.charge = 0;
    this.charged = false;
    this.hits = new Set();
    this.swingA = 0;
    this.pushT = 0;
    this.lastSafe = [x, z];
    this.vx = 0; this.vz = 0;
    this.holdItem = null;
    this.itemPose = null;
    this.speedMul = 1;
    this.splashT = 0;
  }

  get fx() { return Math.sin(this.dir); }
  get fz() { return Math.cos(this.dir); }
  get busy() { return !['normal', 'charge'].includes(this.state); }
  get grounded() { return this.y <= 0.001; }

  setState(s) { this.state = s; this.st = 0; }

  // cardinal facing as [dx, dz]
  card() {
    const a = Math.round(this.dir / (Math.PI / 2));
    const m = ((a % 4) + 4) % 4;
    return [[0, 1], [1, 0], [0, -1], [-1, 0]][m];
  }

  update(dt) {
    const g = this.game, inp = g.input;
    this.tickTimers(dt);
    this.st += dt;
    this.airborne = this.y > 0.05 || this.state === 'hop';

    // vertical motion (feather jumps)
    if (this.y > 0 || this.vy > 0) {
      this.vy -= 17 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        g.particles.puff(this.x, 0.05, this.z, 5, [0.85, 0.8, 0.7], 0.35, 1.2);
        g.audio.sfx('land');
      }
    }

    switch (this.state) {
      case 'normal': this.updateNormal(dt); break;
      case 'charge': this.updateCharge(dt); break;
      case 'swing': this.updateSwing(dt); break;
      case 'spin': this.updateSpin(dt); break;
      case 'lift':
        if (this.st > 0.2) this.setState('normal');
        break;
      case 'throw':
      case 'item':
        if (this.itemPose === 'bow' || this.itemPose === 'wand') this.moving = false;
        if (this.st > (this.itemPose === 'bow' ? 0.28 : 0.18)) { this.setState('normal'); this.itemPose = null; }
        break;
      case 'hurt':
        this.updateKnock(dt);
        if (this.st > 0.22) this.setState('normal');
        break;
      case 'hop': this.updateHop(dt); break;
      case 'fall':
      case 'drown':
        if (this.st > 0.8) this.respawnFromHazard();
        break;
      case 'auto': this.updateAuto(dt); break;
      case 'hold':
      case 'dead':
      case 'frozen':
        break;
    }

    if (this.carry) {
      // keep carried things (like lit bombs) ticking
      this.carry.x = this.x; this.carry.z = this.z;
      if (this.carry.carryTick) this.carry.carryTick(dt, this);
    }

    if (this.grounded && !['fall', 'drown', 'hop', 'dead', 'auto'].includes(this.state)) this.checkGround(dt);
  }

  // ---- normal walking ----
  updateNormal(dt) {
    const g = this.game, inp = g.input;
    const [ax, az] = this.state === 'normal' ? inp.axis() : [0, 0];
    this.walkMove(dt, ax, az, 1);

    // actions
    if (inp.pressed('action')) {
      if (this.carry) this.throwCarried();
      else this.interact(true);
    } else if (inp.pressed('sword')) {
      if (this.carry) this.throwCarried();
      else if (!this.interact(false)) this.startSwing();
    } else if (inp.pressed('item1')) {
      this.useItem(g.save.equip[0]);
    } else if (inp.pressed('item2')) {
      this.useItem(g.save.equip[1]);
    }
  }

  walkMove(dt, ax, az, mul) {
    const g = this.game;
    const tile = g.area.tileDef(this.tx, this.tz);
    let speed = SPEED * mul * (this.carry ? 0.85 : 1) * this.speedMul;
    if (tile === T.SHALLOW) speed *= 0.72;
    const moving = ax !== 0 || az !== 0;
    this.moving = moving;
    if (moving && this.state === 'normal') this.dir = Math.atan2(ax, az);
    const onIce = tile.ice && this.grounded;
    if (onIce) {
      const k = Math.min(1, dt * 2.2);
      this.vx += (ax * speed - this.vx) * k;
      this.vz += (az * speed - this.vz) * k;
    } else {
      this.vx = ax * speed; this.vz = az * speed;
    }
    if (!moving && !onIce) { this.pushT = 0; return; }
    const ox = this.x, oz = this.z;
    // ledge hop: walking south into a ledge
    if (az > 0.7 && this.grounded && this.tryLedge()) return;
    this.move(this.vx * dt, this.vz * dt);
    if (onIce && (Math.abs(this.x - ox) < 1e-4 && Math.abs(this.vx) > 0.1)) this.vx = 0;
    if (onIce && (Math.abs(this.z - oz) < 1e-4 && Math.abs(this.vz) > 0.1)) this.vz = 0;
    this.walkT += Math.hypot(this.x - ox, this.z - oz) * 1.15;
    // nudge around corners when walking straight into one
    const cardinal = moving && (Math.abs(ax) < 0.01 || Math.abs(az) < 0.01);
    if (cardinal) {
      const mx = Math.abs(this.x - ox) < 1e-5 && Math.abs(ax) > 0.01;
      const mz = Math.abs(this.z - oz) < 1e-5 && Math.abs(az) > 0.01;
      if (mx || mz) {
        this.nudge(ax, az, speed * dt);
        this.tryPush(dt, ax, az);
      } else this.pushT = 0;
    } else this.pushT = 0;
    if (tile === T.SHALLOW && moving) {
      this.splashT -= dt;
      if (this.splashT < 0) { this.splashT = 0.18; g.particles.splash(this.x, 0, this.z, 3); }
    }
  }

  nudge(ax, az, step) {
    const g = this.game;
    const px = az !== 0 ? 1 : 0, pz = ax !== 0 ? 1 : 0; // perpendicular axis
    for (let off = 0.06; off <= 0.42; off += 0.06) {
      for (const s of [-1, 1]) {
        const tx = this.x + px * off * s, tz = this.z + pz * off * s;
        if (!g.isBlocked(this, tx, tz, this.bodyHw) && !g.isBlocked(this, tx + ax * 0.12, tz + az * 0.12, this.bodyHw)) {
          this.move(px * s * Math.min(step, off), pz * s * Math.min(step, off));
          return;
        }
      }
    }
  }

  tryPush(dt, ax, az) {
    const g = this.game;
    const dx = Math.sign(Math.round(ax)), dz = Math.sign(Math.round(az));
    const e = g.solidAt(this.x + dx * (this.bodyHw + 0.15), this.z + dz * (this.bodyHw + 0.15), this);
    if (e && e.push && !this.carry) {
      this.pushT += dt;
      this.pushing = true;
      if (this.pushT > 0.32) {
        this.pushT = 0;
        e.push(dx, dz, this);
      }
    } else this.pushT = 0;
  }

  tryLedge() {
    const g = this.game;
    const fz = this.z + this.bodyHw + 0.08;
    const tx = this.tx, tz = Math.floor(fz);
    if (g.area.tileAt(tx, tz) !== T.LEDGE.id) return false;
    if (Math.abs(this.x - (tx + 0.5)) > 0.38) return false;
    const land = [tx + 0.5, tz + 1.5];
    if (g.isBlocked({ ...this, airborne: false, flying: false, avoidPits: false, isPlayer: true }, land[0], land[1], this.bodyHw)) return false;
    this.hop = { x0: this.x, z0: this.z, x1: land[0], z1: land[1], dur: 0.42 };
    this.dir = 0;
    this.setState('hop');
    g.audio.sfx('jump');
    return true;
  }

  updateHop(dt) {
    const h = this.hop, t = Math.min(1, this.st / h.dur);
    this.x = lerp(h.x0, h.x1, t);
    this.z = lerp(h.z0, h.z1, t);
    this.y = Math.sin(t * Math.PI) * 0.7 + (1 - t) * 0.0;
    this.walkT += dt * 3;
    if (t >= 1) {
      this.y = 0;
      this.setState('normal');
      this.game.particles.puff(this.x, 0.05, this.z, 6, [0.85, 0.8, 0.7], 0.35, 1.2);
      this.game.audio.sfx('land');
    }
  }

  // ---- interaction ----
  frontPoint(d = 0.7) { return [this.x + this.fx * d, this.z + this.fz * d]; }

  interact(lifting) {
    const g = this.game;
    const [px, pz] = this.frontPoint(0.65);
    let best = null, bd = 1e9;
    for (const e of g.entities) {
      if (e === this || e.dead || !e.interact) continue;
      if (!lifting && !e.talkable) continue;
      const d = Math.hypot(e.x - px, e.z - pz);
      const reach = (e.interactR ?? e.r) + 0.4;
      if (d < reach && d < bd) { best = e; bd = d; }
    }
    if (best) return best.interact(this, lifting) !== false;
    return false;
  }

  liftEntity(e) {
    this.carry = e;
    e.carried = true;
    e.solid = false;
    this.setState('lift');
    this.game.audio.sfx('lift');
  }

  throwCarried() {
    const e = this.carry;
    if (!e) return;
    this.carry = null;
    e.carried = false;
    this.game.throwObject(e, this);
    this.setState('throw');
    this.itemPose = 'throw';
    this.game.audio.sfx('throw');
  }

  dropCarried() {
    const e = this.carry;
    if (!e) return;
    this.carry = null;
    e.carried = false;
    this.game.throwObject(e, this, 0.5);
  }

  // ---- sword ----
  startSwing() {
    this.setState('swing');
    this.hits.clear();
    this.swingA = -1.7;
    this.game.audio.sfx('swing');
  }

  swordHit(a0, a1, reach, dmg, type) {
    const g = this.game;
    const lo = Math.min(a0, a1) - 0.35, hi = Math.max(a0, a1) + 0.35;
    const src = { type, dmg, x: this.x, z: this.z, owner: this };
    for (const e of g.entities) {
      if (e === this || e.dead || this.hits.has(e) || !e.hurt || e.carried) continue;
      const d = Math.hypot(e.x - this.x, e.z - this.z);
      if (d > reach + e.r) continue;
      if (Math.abs((e.y || 0) - this.y) > 1.2 && !e.tall) continue;
      let rel = angleDiff(this.dir, Math.atan2(e.x - this.x, e.z - this.z));
      if (type === 'spin') { /* full circle */ } else {
        if (d > 0.45 && (rel < lo || rel > hi)) continue;
      }
      // don't hit through walls
      if (g.wallBetween(this.x, this.z, e.x, e.z)) continue;
      this.hits.add(e);
      const res = e.hurt(src);
      if (res === 'hit') {
        g.hitstop(0.05);
        g.particles.sparks(e.x, 0.5, e.z, 6, [1, 1, 0.8], 3);
      } else if (res === 'block') {
        g.audio.sfx('tink');
        g.particles.sparks((e.x + this.x) / 2, 0.5, (e.z + this.z) / 2, 8, [1, 0.9, 0.5], 4);
        this.knock(e.x, e.z, 6, 0.12);
        if (this.state !== 'spin') { this.setState('hurt'); this.st = 0.1; }
      }
    }
  }

  updateSwing(dt) {
    const t = Math.min(1, this.st / SWING_TIME);
    const e = 1 - Math.pow(1 - t, 2.2);
    const prev = this.swingA;
    this.swingA = lerp(-1.7, 1.5, e);
    this.swordHit(prev, this.swingA, REACH, 1, 'sword');
    // allow a small step forward while swinging
    if (this.st < 0.1) this.move(this.fx * dt * 1.2, this.fz * dt * 1.2);
    if (this.st >= SWING_TIME + 0.04) {
      if (this.game.input.down('sword')) {
        this.setState('charge');
        this.charge = 0; this.charged = false;
      } else this.setState('normal');
    }
  }

  updateCharge(dt) {
    const g = this.game;
    this.charge += dt;
    this.swingA = 0;
    const [ax, az] = g.input.axis();
    this.walkMove(dt, ax, az, 0.55);
    // a held sword pokes enemies and cuts grass it touches
    this.hits.clear();
    if (!this.charged && this.charge > CHARGE_TIME) {
      this.charged = true;
      g.audio.sfx('charged');
      const [px, pz] = this.frontPoint(0.95);
      g.particles.ring(px, 0.45, pz, [1, 0.95, 0.6], 10, 1.5, 0.12);
    }
    if (this.charged && Math.random() < 0.4) {
      const [px, pz] = this.frontPoint(0.6 + Math.random() * 0.4);
      g.particles.twinkle(px, 0.42, pz, [1, 0.9, 0.5], 0.22, 0.3);
    }
    if (!g.input.down('sword')) {
      if (this.charged) {
        this.setState('spin');
        this.hits.clear();
        this.spinStart = this.swingA;
        g.audio.sfx('spin');
      } else this.setState('normal');
    }
  }

  updateSpin(dt) {
    const g = this.game;
    const t = Math.min(1, this.st / SPIN_TIME);
    const prev = this.swingA;
    this.swingA = -t * TAU * 1.05;
    this.swordHit(prev, this.swingA, REACH + 0.35, 2, 'spin');
    const a = this.dir + this.swingA;
    g.particles.add({ x: this.x + Math.sin(a) * 1.0, y: 0.4, z: this.z + Math.cos(a) * 1.0, life: 0.25, size: 0.5, size1: 0.1, col: [0.9, 0.95, 1], shape: 0, alpha: 0.6 });
    if (t >= 1) this.setState('normal');
  }

  // ---- items ----
  useItem(id) {
    const g = this.game;
    if (!id || !g.save.items[id]) return;
    const fn = g.itemActions[id];
    if (fn) fn(this);
  }

  // ---- damage ----
  hurt(src) {
    const g = this.game;
    if (this.invuln > 0 || ['fall', 'drown', 'dead', 'hold', 'hop', 'auto'].includes(this.state) || g.cutscene) return undefined;
    if (src.owner === this) {
      if (src.type !== 'bomb') return undefined;
    }
    // your own bombs only sting a little
    const dmg = src.owner === this && src.type === 'bomb' ? 2 : (src.dmg ?? 1);
    g.damagePlayer(dmg);
    this.flash = 0.2;
    this.invuln = 1.1;
    if (this.carry) this.dropCarried();
    if (g.save.hp <= 0) { this.die(); return 'hit'; }
    this.knock(src.x ?? this.x - this.fx, src.z ?? this.z - this.fz, 9, 0.2);
    this.setState('hurt');
    return 'hit';
  }

  die() {
    this.setState('dead');
    this.game.onPlayerDeath();
  }

  // ---- hazards under foot ----
  checkGround(dt) {
    const g = this.game;
    const t = g.area.tileDef(this.tx, this.tz);
    if (t.pit) {
      this.setState('fall');
      this.carry && this.dropCarried();
      g.audio.sfx('fall');
      return;
    }
    if (t.water && !g.isFrozen(this.tx, this.tz)) {
      this.setState('drown');
      g.particles.splash(this.x, 0, this.z, 16);
      g.audio.sfx('splash');
      this.carry && this.dropCarried();
      return;
    }
    if (t.spikes && this.invuln <= 0) {
      this.hurt({ type: 'spikes', dmg: 1, x: this.x + (this.x - this.lastSafe[0]) * 2, z: this.z + (this.z - this.lastSafe[1]) * 2 });
      return;
    }
    // remember the last safe spot (not near any hazard)
    let safe = true;
    for (let dz = -1; dz <= 1 && safe; dz++) for (let dx = -1; dx <= 1; dx++) {
      const d = g.area.tileDef(Math.floor(this.x + dx * 0.4), Math.floor(this.z + dz * 0.4));
      if (d.pit || d.spikes || (d.water && g.isFrozen(Math.floor(this.x + dx * 0.4), Math.floor(this.z + dz * 0.4)))) { safe = false; break; }
    }
    if (safe && g.inCurrentScreen(this.x, this.z)) this.lastSafe = [this.x, this.z];
  }

  respawnFromHazard() {
    const g = this.game;
    g.damagePlayer(1);
    let [sx, sz] = this.lastSafe;
    if (!g.inCurrentScreen(sx, sz) || !g.isSafeSpot(sx, sz)) [sx, sz] = g.findSafeSpot(this.x, this.z);
    this.x = sx; this.z = sz;
    if (g.save.hp <= 0) { this.die(); return; }
    this.y = 0; this.vy = 0;
    this.invuln = 1.2;
    this.setState('normal');
  }

  // scripted walking (screen scrolls, doors)
  autoWalk(tx, tz, dur, then) {
    this.auto = { x0: this.x, z0: this.z, x1: tx, z1: tz, dur, then };
    if (Math.hypot(tx - this.x, tz - this.z) > 0.01) this.dir = Math.atan2(tx - this.x, tz - this.z);
    this.setState('auto');
  }
  updateAuto(dt) {
    const a = this.auto;
    const t = Math.min(1, this.st / a.dur);
    const nx = lerp(a.x0, a.x1, t), nz = lerp(a.z0, a.z1, t);
    this.walkT += Math.hypot(nx - this.x, nz - this.z) * 1.15;
    this.moving = Math.hypot(nx - this.x, nz - this.z) > 0.0001;
    this.x = nx; this.z = nz;
    if (t >= 1) {
      this.setState('normal');
      this.moving = false;
      if (a.then) a.then();
    }
  }

  // ---- drawing ----
  draw(r) {
    const g = this.game, M = g.models;
    const t = g.time;
    if (this.invuln > 0 && this.state !== 'fall' && this.state !== 'drown' && Math.floor(t * 20) % 2 === 0) return this.drawShadow(r);
    // turn smoothly toward the facing direction
    const target = this.state === 'spin' ? this.dir + this.swingA : this.dir;
    this.vis += angleDiff(this.vis, target) * Math.min(1, (this.state === 'spin' ? 40 : 18) * g.dt);
    const yaw = this.state === 'spin' ? this.dir + this.swingA : this.vis;
    const walking = this.moving && !this.busy || this.state === 'auto' || this.state === 'hop';
    const ph = this.walkT * Math.PI * 2 * 0.9;
    let bob = walking ? Math.abs(Math.sin(ph)) * 0.05 : Math.sin(t * 2.2) * 0.008;
    let s = 1, sinkY = 0, lieZ = 0;
    if (this.state === 'fall') { s = Math.max(0, 1 - this.st / 0.7); sinkY = -this.st * 1.2; }
    if (this.state === 'drown') { sinkY = -Math.min(0.7, this.st * 1.2); }
    if (this.state === 'dead') lieZ = Math.min(1, this.st * 2) * 1.4;
    const tint = this.flash > 0 ? [1, 0.3, 0.3, 0.6] : null;
    const opts = { stencil: true, tint };

    r.push();
    r.translate(this.x, this.y + bob + sinkY, this.z);
    r.rotY(yaw + (this.state === 'fall' ? this.st * 12 : 0) + (this.state === 'dead' ? Math.min(this.st, 0.8) * 8 : 0));
    if (lieZ) r.rotX(-lieZ);
    r.scale(s * 1.2);
    if (this.state === 'charge' && this.charged) r.translate(Math.sin(t * 60) * 0.01, 0, 0);
    const part = (mesh) => { r.draw(mesh, opts); r.silhouette(mesh, r.m); };

    // feet
    const step = walking ? Math.sin(ph) * 0.13 : 0;
    const lift = walking ? Math.max(0, Math.cos(ph)) * 0.05 : 0;
    const lift2 = walking ? Math.max(0, -Math.cos(ph)) * 0.05 : 0;
    r.push(); r.translate(-0.09, lift, step); part(M.get('hero.foot')); r.pop();
    r.push(); r.translate(0.09, lift2, -step); part(M.get('hero.foot')); r.pop();
    r.push(); r.translate(0, bob * 0.3, 0); part(M.get('hero.body'));
    // tail
    r.push(); r.translate(0, 0.2, -0.13); r.rotY(Math.sin(t * 3.1) * 0.35 + (walking ? Math.sin(ph) * 0.3 : 0)); r.rotX(0.35 + (walking ? 0.15 : 0)); part(M.get('hero.tail')); r.pop();
    // scarf tail flutters with speed
    r.push(); r.translate(0.07, 0.45, -0.14); r.rotX(-(walking ? 0.9 : 0.15) - Math.sin(t * 9) * (walking ? 0.15 : 0.05)); r.rotZ(Math.sin(t * 5) * 0.1); part(M.get('hero.scarfEnd')); r.pop();
    this.drawArms(r, part, walking, ph);
    r.pop();
    r.pop();
    this.drawShadow(r);
    // carried object above the head
    if (this.carry) {
      const k = this.state === 'lift' ? Math.min(1, this.st / 0.2) : 1;
      const cy = lerp(0.25, 1.1, k);
      const cx = this.x + this.fx * lerp(0.6, 0, k), cz = this.z + this.fz * lerp(0.6, 0, k);
      this.carry.drawCarried(r, cx, this.y + cy + bob, cz);
    }
    // item being held up
    if (this.state === 'hold' && this.holdItem) {
      r.push(); r.translate(this.x, 1.38 + Math.sin(t * 3) * 0.03, this.z); r.rotY(t * 1.5); r.scale(1.4);
      r.draw(M.get(this.holdItem), { emis: 0.25 });
      r.pop();
      r.light(this.x, 1.4, this.z, 3, 1.2, 1.1, 0.8);
      if (Math.random() < 0.3) g.particles.twinkle(this.x + rand(-0.4, 0.4), 1.2 + rand(-0.3, 0.3), this.z + rand(-0.2, 0.2), [1, 0.95, 0.6], 0.25, 0.5);
    }
  }

  drawShadow(r) {
    if (this.state === 'fall' || this.state === 'drown') return;
    const h = this.y;
    r.blob(this.x, 0, this.z, 0.36 * (1 - Math.min(0.5, h * 0.4)), 0.32 * (1 - Math.min(0.6, h * 0.5)));
  }

  drawArms(r, part, walking, ph) {
    const M = this.game.models;
    const st = this.state;
    const swinging = st === 'swing' || st === 'spin' || st === 'charge';
    const handY = 0.3;
    // left hand (towards +x when facing +z)
    let lx = 0.22, ly = handY, lz = walking ? -Math.sin(ph) * 0.1 : 0;
    // right hand (sword hand, -x)
    let rx = -0.22, ry = handY, rz = walking ? Math.sin(ph) * 0.1 : 0;
    if (this.carry || st === 'lift') { lx = 0.17; ly = 0.75; lz = 0.05; rx = -0.17; ry = 0.75; rz = 0.05; }
    if (st === 'hold') { lx = 0.2; ly = 0.88; lz = 0.02; rx = -0.2; ry = 0.88; rz = 0.02; }
    if (st === 'throw' || (st === 'item' && this.itemPose !== 'bow')) { rx = -0.12; ry = 0.45; rz = 0.28; }
    if (st === 'item' && this.itemPose === 'bow') { lx = 0.05; ly = 0.4; lz = 0.35; rx = -0.05; ry = 0.4; rz = 0.05; }
    if (st === 'item' && this.itemPose === 'wand') { rx = -0.1; ry = 0.5; rz = 0.32; }
    if (swinging) {
      const a = st === 'spin' ? 0 : this.swingA;
      rx = Math.sin(a) * 0.3; rz = Math.cos(a) * 0.3; ry = 0.34;
    }
    r.push(); r.translate(lx, ly, lz); part(M.get('hero.hand')); r.pop();
    r.push(); r.translate(rx, ry, rz); part(M.get('hero.hand'));
    if (swinging) {
      const a = st === 'spin' ? 0 : this.swingA;
      r.rotY(a);
      r.rotX(st === 'charge' ? 0.15 : 0.05);
      part(M.get('sword'));
      if (st === 'charge' && this.charged) r.draw(M.get('sword'), { emis: 0.6 + 0.4 * Math.sin(this.game.time * 20), shadow: false });
    } else if (st === 'item' && this.itemPose === 'bow') {
      r.translate(0, 0.02, 0.28); r.rotX(-Math.PI / 2); r.rotY(Math.PI / 2);
      part(M.get('bow'));
    } else if (st === 'item' && this.itemPose === 'wand') {
      r.rotX(1.3); part(M.get('frostwand'));
    }
    r.pop();
    if (!swinging && !(st === 'item' && this.itemPose === 'bow')) {
      // sword on the back
      r.push(); r.translate(0.04, 0.5, -0.2); r.rotZ(2.4); r.rotX(-Math.PI / 2 + 0.15); r.scale(0.85);
      part(M.get('sword'));
      r.pop();
    }
  }
}
