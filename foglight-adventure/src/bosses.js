// Bosses: Deepcoil the shrine eel and the Gloom, plus their rooms, the
// lighthouse's great lamp, and the ending.

import { Entity } from './entity.js';
import { Enemy, ENEMIES } from './enemies.js';
import { Pickup, Deco } from './objects.js';
import { Shot } from './projectiles.js';
import { SW, SH } from './tiles.js';
import { clamp, lerp, rand, angleDiff, TAU } from './math.js';
import { setShutters } from './data/rooms.js';

// ======================================================================
// Deepcoil
// ======================================================================
export class Deepcoil extends Enemy {
  constructor(g, cx, cz) {
    super(g, cx, cz);
    this.cx = cx; this.cz = cz;
    this.rx = 3.9; this.rz = 1.45;
    this.hp = this.maxHp = 10;
    this.th = Math.PI / 2;
    this.spin = 1;
    this.y = -0.7;
    this.trail = [];
    this.freezable = false;
    this.stunnable = false;
    this.ghost = true;
    this.confined = false;
    this.r = 0.6;
    this.harmless = true;
    this.dmg = 2;
    this.heavy = true;
    this.isBoss = true;
    this.state = 'intro';
    this.hitsThisFreeze = 0;
    this.headX = cx; this.headZ = cz;
    this.lunge = 0;
    this.updateHead();
  }
  get phase2() { return this.hp <= 5; }
  ellipse(th) { return [this.cx + Math.cos(th) * this.rx, this.cz + Math.sin(th) * this.rz]; }
  updateHead() {
    const [x, z] = this.ellipse(this.th);
    const p = this.game.player;
    const a = Math.atan2(p.x - x, p.z - z);
    this.headX = x + Math.sin(a) * this.lunge;
    this.headZ = z + Math.cos(a) * this.lunge;
    this.x = this.headX; this.z = this.headZ;
    const last = this.trail[0];
    if (!last || Math.hypot(last[0] - x, last[1] - z) > 0.08) {
      this.trail.unshift([x, z]);
      if (this.trail.length > 120) this.trail.pop();
    }
  }
  surfaced() { return this.y > -0.25; }

  hurt(src) {
    if (this.dying || !this.surfaced()) return undefined;
    if (src.type === 'frost') {
      if (this.state === 'frozen') return 'hit';
      this.setState('frozen');
      this.hitsThisFreeze = 0;
      this.lunge = 0;
      this.game.audio.sfx('freeze');
      this.game.audio.sfx('bossHurt');
      this.game.particles.ring(this.x, 0.3, this.z, [0.8, 0.95, 1], 18, 3, 0.25);
      return 'hit';
    }
    if (this.state !== 'frozen') {
      if (src.type === 'arrow') return this.takeHit(1);
      if (src.type === 'sword' || src.type === 'spin' || src.type === 'boomerang') {
        this.game.particles.sparks(this.x, 0.5, this.z, 6, [0.8, 1, 1], 3);
        return 'block';
      }
      return undefined;
    }
    if (this.invuln > 0) return 'hit';
    const dmg = src.type === 'spin' || src.type === 'bomb' ? 2 : 1;
    const r = this.takeHit(dmg);
    this.hitsThisFreeze++;
    if (this.hitsThisFreeze >= 3 && this.hp > 0) { this.setState('thrash'); }
    return r;
  }
  takeHit(dmg) {
    const g = this.game;
    this.hp -= dmg;
    this.flash = 0.25;
    this.invuln = 0.3;
    g.audio.sfx('bossHurt');
    g.shake(0.1, 0.15);
    if (this.hp <= 0) { this.setState('dying'); this.dying = true; g.audio.music(null); g.audio.sfx('bossDie'); }
    return 'hit';
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.tickTimers(dt);
    this.t += dt; this.st += dt;
    const speed = (this.phase2 ? 1.05 : 0.75);
    switch (this.state) {
      case 'intro':
        this.y = lerp(-0.7, 0.35, Math.min(1, this.st / 1.2));
        if (this.st > 0.3 && this.st < 0.35) { g.audio.sfx('bossRoar'); g.shake(0.2, 1.0); }
        if (this.st > 2.2) this.setState('dive');
        break;
      case 'swim': {
        this.th += speed * this.spin * dt;
        this.y = lerp(this.y, -0.62, dt * 4);
        if (Math.random() < dt * 0.4) this.spin = -this.spin;
        if (this.st > (this.phase2 ? 1.6 : 2.4) + rand(0, 1)) this.setState('seek');
        break;
      }
      case 'seek': {
        const tt = Math.atan2((p.z - this.cz) / this.rz, (p.x - this.cx) / this.rx);
        const d = angleDiff(this.th, tt);
        this.th += clamp(d, -2.6 * dt, 2.6 * dt);
        if (Math.abs(d) < 0.1 || this.st > 1.6) { this.setState('rise'); g.particles.splash(this.x, 0, this.z, 14); g.audio.sfx('splash'); }
        break;
      }
      case 'rise':
        this.y = lerp(-0.62, 0.3, Math.min(1, this.st / 0.45));
        if (this.st > 0.55) this.setState(Math.random() < (this.phase2 ? 0.45 : 0.65) ? 'spit' : 'lunge');
        break;
      case 'spit':
        if (this.st > 0.35 && !this.spat) {
          this.spat = true;
          const n = this.phase2 ? 5 : 3;
          const a0 = Math.atan2(p.x - this.x, p.z - this.z);
          for (let i = 0; i < n; i++) {
            const a = a0 + (i - (n - 1) / 2) * 0.32;
            g.add(new Shot(g, this.x + Math.sin(a) * 0.5, this.z + Math.cos(a) * 0.5, Math.sin(a), Math.cos(a), { kind: 'bubble', speed: 4.4, y: 0.45, reflectable: false, flies: true, life: 2.6 }));
          }
          g.audio.sfx('bubble');
        }
        if (this.st > 1.6) { this.spat = false; this.setState('dive'); }
        break;
      case 'lunge': {
        const k = this.st;
        if (k < 0.35) this.lunge = 0;
        else if (k < 0.6) { this.lunge = lerp(0, 1.9, (k - 0.35) / 0.25); this.harmless = false; }
        else if (k < 0.9) this.lunge = 1.9;
        else if (k < 1.3) { this.lunge = lerp(1.9, 0, (k - 0.9) / 0.4); }
        else { this.lunge = 0; this.harmless = true; this.setState('dive'); }
        if (k > 0.35 && k < 0.4) g.audio.sfx('bossRoar', 0.5);
        break;
      }
      case 'frozen':
        this.y = 0.15;
        if (this.st > 4.2) this.setState('thrash');
        break;
      case 'thrash':
        this.y = 0.2 + Math.sin(this.st * 30) * 0.05;
        if (this.st < 0.05) { g.audio.sfx('iceBreak'); g.audio.sfx('bossRoar'); g.shake(0.18, 0.4); g.particles.debris(this.x, 0.4, this.z, g.models.get('iceChip'), 12, { size: 1.6 }); }
        if (this.st > 0.6) this.setState('dive');
        break;
      case 'dive':
        this.harmless = true;
        this.lunge = 0;
        this.y = lerp(this.y, -0.62, dt * 6);
        if (this.st > 0.6) this.setState('swim');
        break;
      case 'dying':
        this.y = 0.25 + Math.sin(this.st * 20) * 0.08;
        this.th += dt * 3;
        if (Math.random() < dt * 8) g.particles.puff(this.x + rand(-1, 1), 0.4, this.z + rand(-1, 1), 6, [1, 1, 1], 0.6, 2);
        if (Math.random() < dt * 5) g.audio.sfx('enemyDie', 0.6);
        if (this.st > 2.6) {
          this.dead = true;
          g.particles.splash(this.x, 0, this.z, 30);
          g.audio.sfx('explode');
          g.flash([1, 1, 1], 0.5);
          if (this.onDefeat) this.onDefeat();
        }
        break;
    }
    this.harmless = this.harmless || !this.surfaced();
    if (this.state === 'rise' || this.state === 'spit' || this.state === 'frozen') this.harmless = this.state === 'frozen';
    this.updateHead();
    if (!this.dying) this.contact();
    if (this.surfaced() && Math.random() < 0.2) g.particles.add({ x: this.x + rand(-0.5, 0.5), y: 0, z: this.z + rand(-0.5, 0.5), vy: 0.6, life: 0.4, size: 0.12, col: [0.85, 0.97, 1], shape: 1, additive: false });
  }

  // a point on the body trail, `dist` units behind the head
  along(dist) {
    let acc = 0;
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1], b = this.trail[i];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + d >= dist) { const k = (dist - acc) / d; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; }
      acc += d;
    }
    const l = this.trail[this.trail.length - 1] || [this.x, this.z];
    return l;
  }

  draw(r) {
    const M = this.game.models;
    const t = this.t;
    const tint = this.state === 'frozen' ? [0.75, 0.92, 1, 0.45] : this.flash > 0 ? [1, 1, 1, 0.7] : null;
    // body segments, sinking further below the surface towards the tail
    const n = 8;
    let prev = [this.headX, this.headZ];
    for (let i = 1; i <= n; i++) {
      const [sx, sz] = this.along(i * 0.62);
      const y = Math.min(this.y, -0.15) - i * 0.04 + Math.sin(t * 4 - i * 0.7) * 0.06;
      const s = 1 - i * 0.06;
      r.push(); r.translate(sx, y, sz); r.rotY(Math.atan2(prev[0] - sx, prev[1] - sz)); r.scale(s);
      r.draw(M.get(i === n ? 'eel.tail' : 'eel.seg'), { tint: this.state === 'frozen' ? tint : null });
      r.pop();
      prev = [sx, sz];
    }
    // head
    const p = this.game.player;
    const face = this.state === 'swim' || this.state === 'dive' ? Math.atan2(this.headX - this.along(0.4)[0], this.headZ - this.along(0.4)[1]) : Math.atan2(p.x - this.headX, p.z - this.headZ);
    r.push(); r.translate(this.headX, this.y, this.headZ); r.rotY(face);
    if (this.state === 'thrash' || this.state === 'dying') r.rotZ(Math.sin(t * 30) * 0.15);
    r.draw(M.get('eel.head'), { tint });
    const jaw = this.state === 'spit' ? Math.min(1, this.st * 4) * 0.5 : this.state === 'lunge' && this.lunge > 0.5 ? 0.6 : 0.08;
    r.push(); r.translate(0, 0.02, 0.15); r.rotX(jaw); r.draw(M.get('eel.jaw'), { tint }); r.pop();
    r.pop();
    if (this.state === 'frozen') {
      r.push(); r.translate(this.headX, -0.05, this.headZ); r.scale(2.2, 1, 2.2);
      r.draw(M.get('iceTile'), { shadow: false, alpha: 0.9 });
      r.pop();
    }
    r.light(this.headX, 0.9, this.headZ, 2.8, 0.3, 0.9, 1.0);
  }
}

export const deepcoilRoom = {
  enter(g, st) {
    const key = `${g.sx},${g.sy}`;
    const x0 = g.sx * SW, z0 = g.sy * SH;
    if (!g.flag('shrineBoss')) {
      setShutters(g, true);
      g.audio.music(null);
      g.after(0.8, () => {
        const boss = new Deepcoil(g, x0 + 8, z0 + 5.5);
        boss.onDefeat = () => deepcoilDefeated(g, x0, z0);
        g.add(boss, key);
        g.ui.banner('DEEPCOIL, the Shrine Eel');
        g.audio.music('boss');
      });
    } else spawnShrineRewards(g, x0, z0);
  },
};

function deepcoilDefeated(g, x0, z0) {
  g.setFlag('shrineBoss');
  setShutters(g, false);
  g.audio.music(null);
  g.after(1.2, () => {
    g.audio.sfx('secret');
    spawnShrineRewards(g, x0, z0, true);
    g.audio.music('victory');
  });
}

function spawnShrineRewards(g, x0, z0, fresh) {
  const key = `${g.sx},${g.sy}`;
  if (!g.flag('got:shrineHeart')) {
    g.add(new Pickup(g, x0 + 7.5, z0 + 9.3, 'heartContainer', { persist: 'got:shrineHeart', float: true, pop: !!fresh }), key);
  }
  g.add(new Deco(g, x0 + 7.5, z0 + 1.4, { model: 'pedestal', ry: 0 }), key);
  if (!g.save.items.sunstone) {
    g.add(new Pickup(g, x0 + 7.5, z0 + 1.4, 'sunstone', { persist: 'got:sunstone', float: true }), key).y = 0.7;
  }
  g.add(new Portal(g, x0 + 12.5, z0 + 9.3, { area: 'overworld', x: 35.5, z: 28.4, dir: 0 }), key);
}

// A shimmering pad that takes you back outside.
class Portal extends Entity {
  constructor(g, x, z, to) {
    super(g, x, z);
    this.to = to; this.r = 0.4; this.armed = false;
  }
  update() {
    const g = this.game, p = g.player;
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (!this.armed) { if (d > 0.8) this.armed = true; return; }
    if (d < 0.4 && g.mode === 'play' && p.state === 'normal') g.warp({ ...this.to, sound: 'portal' });
    if (Math.random() < 0.3) g.particles.add({ x: this.x + rand(-0.35, 0.35), y: 0.05, z: this.z + rand(-0.35, 0.35), vy: 1.2, life: 0.8, size: 0.12, col: [0.6, 0.95, 1], shape: 2 });
  }
  draw(r) {
    r.drawAt(this.game.models.get('portal'), this.x, 0, this.z, this.game.time, 1, { shadow: false });
    r.light(this.x, 0.6, this.z, 2.5, 0.4, 0.9, 1.2);
  }
}

// ======================================================================
// The great lamp of the lighthouse
// ======================================================================
export class GreatLamp extends Entity {
  constructor(g, x, z) {
    super(g, x, z);
    this.solid = true; this.hw = 0.55; this.r = 0.6; this.low = true;
    this.talkable = true;
    this.lit = g.flag('lighthouseLit');
  }
  isFire() { return !this.lit; } // the little pilot flame
  interact() {
    const g = this.game;
    if (this.lit) { g.say('The Sunstone blazes in the great lamp. You can feel the warmth on your whiskers.'); return true; }
    if (!g.flag('gloomDefeated')) { g.say('The great lamp is cold. Only a tiny pilot flame still flickers in it.'); return true; }
    if (!g.save.items.sunstone) { g.say('The great lamp is cold and empty.'); return true; }
    g.say('The great lamp waits, cold and empty. Place the SUNSTONE inside?', {
      choices: ['Place it', 'Not yet'],
      onChoice: (i) => { if (i === 0) startEnding(g, this); },
    });
    return true;
  }
  draw(r) {
    const M = this.game.models;
    r.drawAt(M.get('greatLamp'), this.x, 0, this.z, 0);
    if (this.lit) {
      const t = this.game.time;
      r.push(); r.translate(this.x, 1.25, this.z); r.rotY(t); r.draw(M.get('sunstone'), { emis: 1 }); r.pop();
      r.light(this.x, 1.6, this.z, 9, 2.6, 2.1, 1.2);
    } else {
      r.sprite(this.x, 1.05, this.z, 0.45 + Math.sin(this.game.time * 13) * 0.05, 1, 0.65, 0.25, 0.9, 0, true);
      r.light(this.x, 1.3, this.z, 3.2, 1.4, 0.8, 0.3);
      if (Math.random() < 0.3) this.game.particles.fire(this.x, 1.0, this.z, 0.6);
    }
  }
}

// ======================================================================
// The Gloom
// ======================================================================
export class Gloom extends Enemy {
  constructor(g, x, z, home) {
    super(g, x, z);
    this.home = home;
    this.hp = this.maxHp = 9;
    this.flying = true;
    this.ghost = true;
    this.confined = false;
    this.y = 1.2;
    this.r = 0.75;
    this.dmg = 2;
    this.freezable = false;
    this.stunnable = false;
    this.isBoss = true;
    this.state = 'intro';
    this.ang = 0;
    this.fade = 0;
    this.dmgThisExposure = 0;
    this.attackT = 2.5;
  }
  get phase2() { return this.hp <= 5; }
  torches() {
    const key = this.screenKey;
    return this.game.entities.filter((e) => e.isTorch && e.screenKey === key);
  }
  hurt(src) {
    if (this.dying) return undefined;
    if (this.state !== 'exposed') {
      if (src.type === 'frost') { this.slow = 2; this.game.particles.ring(this.x, this.y, this.z, [0.8, 0.95, 1], 10, 2); return 'hit'; }
      return undefined;
    }
    if (this.invuln > 0) return 'hit';
    let dmg = src.type === 'spin' ? 2 : src.type === 'bomb' ? 2 : src.fire ? 2 : 1;
    if (src.type === 'boomerang' && !src.fire) dmg = 0;
    if (!dmg) return 'block';
    this.hp -= dmg; this.dmgThisExposure += dmg;
    this.flash = 0.25; this.invuln = 0.3;
    const g = this.game;
    g.audio.sfx('bossHurt');
    g.shake(0.1, 0.15);
    if (this.hp <= 0) { this.dying = true; this.setState('dying'); g.audio.music(null); g.audio.sfx('bossDie'); }
    else if (this.dmgThisExposure >= 4) this.setState('recover');
    return 'hit';
  }
  update(dt) {
    const g = this.game, p = g.player;
    this.tickTimers(dt);
    this.t += dt; this.st += dt;
    this.slow = Math.max(0, (this.slow || 0) - dt);
    const sp = this.slow > 0 ? 0.4 : 1;
    const [hx, hz] = this.home;
    switch (this.state) {
      case 'intro':
        this.fade = Math.min(0.55, this.st * 0.4);
        if (this.st > 0.4 && this.st < 0.45) { g.audio.sfx('bossRoar'); g.shake(0.15, 1.0); }
        if (this.st > 2.0) this.setState('drift');
        break;
      case 'drift': {
        this.fade = lerp(this.fade, 0.42, dt * 3);
        this.ang += dt * (this.phase2 ? 0.75 : 0.5) * sp;
        // circle the lamp, leaning towards the hero
        const tx = hx + Math.cos(this.ang) * 4.2 + (p.x - hx) * 0.25;
        const tz = hz + Math.sin(this.ang) * 2.6 + (p.z - hz) * 0.25;
        this.x = lerp(this.x, tx, dt * 1.5 * sp);
        this.z = lerp(this.z, tz, dt * 1.5 * sp);
        this.y = 1.1 + Math.sin(this.t * 2) * 0.2;
        this.attackT -= dt * sp;
        if (this.attackT <= 0) {
          const r = Math.random();
          this.setState(r < 0.45 ? 'orbs' : r < 0.75 ? 'swoop' : 'summon');
        }
        if (this.torches().every((t) => t.lit)) this.setState('exposed');
        break;
      }
      case 'orbs':
        if (this.st > 0.5 && !this.fired) {
          this.fired = true;
          const n = this.phase2 ? 12 : 8;
          const off = rand(0, 1);
          for (let i = 0; i < n; i++) {
            const a = ((i + off) / n) * TAU;
            g.add(new Shot(g, this.x, this.z, Math.sin(a), Math.cos(a), { kind: 'gloom', speed: 3.6, y: 0.5, reflectable: false, flies: true, life: 4 }), this.screenKey);
          }
          g.audio.sfx('gloomOrbs');
        }
        if (this.st > 1.1) { this.fired = false; this.endAttack(); }
        break;
      case 'swoop': {
        if (this.st < 0.5) { this.fade = lerp(this.fade, 0.8, dt * 5); this.y = lerp(this.y, 0.7, dt * 4); }
        else if (this.st < 1.4) {
          if (!this.swoopDir) { const a = Math.atan2(p.x - this.x, p.z - this.z); this.swoopDir = [Math.sin(a), Math.cos(a)]; g.audio.sfx('swoosh'); }
          this.x += this.swoopDir[0] * 6.5 * dt * sp; this.z += this.swoopDir[1] * 6.5 * dt * sp;
          this.x = clamp(this.x, hx - 6, hx + 6); this.z = clamp(this.z, hz - 3.8, hz + 3.8);
          this.contactNow = true;
        } else { this.swoopDir = null; this.contactNow = false; this.endAttack(); }
        break;
      }
      case 'summon':
        if (this.st > 0.6 && !this.fired) {
          this.fired = true;
          const alive = g.entities.filter((e) => e.isEnemy && !e.isBoss && !e.dead).length;
          for (let i = 0; i < Math.min(2, 3 - alive); i++) {
            const a = rand(0, TAU);
            const w = new ENEMIES.wisp(g, hx + Math.cos(a) * 4, hz + Math.sin(a) * 2.5, {});
            w.screenKey = this.screenKey; w.sx = this.sx; w.sy = this.sy;
            g.entities.push(w);
            g.particles.puff(w.x, 0.6, w.z, 8, [0.3, 0.25, 0.45], 0.6);
          }
          g.audio.sfx('summon');
        }
        if (this.st > 1.2) { this.fired = false; this.endAttack(); }
        break;
      case 'exposed':
        // the light pins it down
        this.fade = lerp(this.fade, 1, dt * 5);
        this.y = lerp(this.y, 0.45, dt * 3);
        this.x = lerp(this.x, hx + Math.cos(this.ang) * 3.2, dt * 0.8);
        this.z = lerp(this.z, hz + Math.sin(this.ang) * 2.2, dt * 0.8);
        if (this.st < 0.05) { g.audio.sfx('bossHurt'); g.ui.toast('The Gloom shrinks from the light!'); this.dmgThisExposure = 0; }
        if (this.st > 6) this.setState('recover');
        break;
      case 'recover':
        this.fade = lerp(this.fade, 0.6, dt * 3);
        this.y = lerp(this.y, 1.3, dt * 3);
        if (this.st < 0.05) {
          g.audio.sfx('bossRoar'); g.audio.sfx('gust');
          g.shake(0.2, 0.6);
          for (const t of this.torches()) if (t.lit) { t.lit = false; g.particles.puff(t.x, 1, t.z, 6, [0.3, 0.3, 0.35], 0.5); }
          const a = Math.atan2(p.x - this.x, p.z - this.z);
          for (let i = 0; i < 30; i++) {
            const b = a + rand(-1, 1);
            g.particles.add({ x: this.x, y: 0.6, z: this.z, vx: Math.sin(b) * rand(4, 8), vz: Math.cos(b) * rand(4, 8), drag: 2, life: 0.7, size: 0.5, size1: 1.2, col: [0.35, 0.3, 0.5], alpha: 0.4, shape: 3, additive: false });
          }
          p.knock(this.x, this.z, 7, 0.25);
        }
        if (this.st > 1.2) { this.attackT = 1.5; this.setState('drift'); }
        break;
      case 'dying':
        this.fade = Math.max(0, 1 - this.st / 2.5);
        this.y += dt * 0.4;
        if (Math.random() < dt * 14) g.particles.add({ x: this.x + rand(-0.6, 0.6), y: this.y + rand(-0.4, 0.6), z: this.z + rand(-0.6, 0.6), vy: rand(0.5, 1.5), vx: rand(-1, 1), vz: rand(-1, 1), life: 1.2, size: 0.6, size1: 1.4, col: [0.35, 0.3, 0.5], alpha: 0.5, shape: 3, additive: false });
        if (this.st > 2.8) {
          this.dead = true;
          g.flash([1, 1, 1], 0.6);
          g.audio.sfx('secret');
          if (this.onDefeat) this.onDefeat();
        }
        break;
    }
    // touching the Gloom hurts, unless it's pinned by the light
    if (this.state !== 'exposed' && this.state !== 'dying' && this.state !== 'intro') {
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (d < 0.9 && (this.y < 1.0 || this.contactNow)) p.hurt({ type: 'enemy', dmg: this.dmg, x: this.x, z: this.z });
    }
  }
  endAttack() { this.attackT = (this.phase2 ? 1.4 : 2.2) + rand(0, 1); this.setState('drift'); }
  draw(r) {
    const M = this.game.models;
    const t = this.t;
    const exposed = this.state === 'exposed';
    const s = exposed ? 0.8 + Math.sin(t * 25) * 0.03 : 1 + Math.sin(t * 2.3) * 0.05;
    r.push(); r.translate(this.x, this.y, this.z);
    r.rotY(Math.atan2(this.game.player.x - this.x, this.game.player.z - this.z));
    r.scale(s, s * (1 + Math.sin(t * 3) * 0.05), s);
    r.draw(M.get('gloom'), { alpha: this.fade, tint: this.flash > 0 ? [1, 1, 1, 0.7] : exposed ? [1, 0.95, 0.8, 0.25] : null, shadow: false, emis: 0.15 });
    r.pop();
    if (this.fade > 0.1) r.light(this.x, this.y, this.z, 3, 0.5, 0.3, 0.9);
    if (Math.random() < 0.5 && !this.dying) this.game.particles.add({ x: this.x + rand(-0.6, 0.6), y: this.y - 0.4, z: this.z + rand(-0.6, 0.6), vy: -0.3, life: 1, size: 0.6, size1: 1.3, col: [0.28, 0.24, 0.4], alpha: 0.35 * this.fade, shape: 3, additive: false });
  }
}

export const gloomRoom = {
  enter(g, st) {
    const key = `${g.sx},${g.sy}`;
    const x0 = g.sx * SW, z0 = g.sy * SH;
    if (g.flag('gloomDefeated')) return;
    g.audio.music(null);
    g.after(1.0, () => {
      const boss = new Gloom(g, x0 + 7.5, z0 + 3, [x0 + 7.5, z0 + 5.5]);
      boss.onDefeat = () => {
        g.setFlag('gloomDefeated');
        for (const e of g.entities) if (e.isEnemy && !e.dead) e.die();
        g.audio.music('victory');
        g.after(2.5, () => g.say('The Gloom has scattered like morning mist!\nNow, the great lamp...'));
      };
      g.add(boss, key);
      g.ui.banner('THE GLOOM');
      g.audio.music('final');
    });
  },
};

// ======================================================================
// Ending
// ======================================================================
function startEnding(g, lamp) {
  const p = g.player;
  g.cutscene = {
    t: 0,
    freezePlayer: true,
    update(dt) {
      this.t += dt;
      if (this.t < 0.05) { p.setState('hold'); p.holdItem = 'sunstone'; g.audio.music(null); g.audio.sfx('fanfare'); }
      if (this.t > 2.2 && !this.placed) {
        this.placed = true;
        p.holdItem = null;
        p.setState('normal');
        lamp.lit = true;
        g.setFlag('lighthouseLit');
        g.audio.sfx('lampLight');
        g.flash([1, 0.95, 0.8], 1.5);
        g.shake(0.1, 1.0);
      }
      if (this.t > 4.5 && !this.faded) {
        this.faded = true;
        g.fadeTo(1, 1.2, () => rollCredits(g));
      }
      return true;
    },
  };
}

function rollCredits(g) {
  g.cutscene = null;
  // rebuild the overworld so the lighthouse shines and the fog has gone
  for (const [k, v] of g.screenCache) { v.mesh.dispose(); v.water.dispose(); v.props?.dispose(); g.screenCache.delete(k); }
  g.persist();
  g.player.x = 60.5; g.player.z = 7.5; g.player.dir = 0;
  g.loadArea('overworld', 60.5, 7.5);
  g.player.hidden = true;
  g.creditsPan = { t: 0 };
  g.mode = 'credits';
  g.audio.music('ending');
  g.fadeTo(0, 1.5);
  const secs = Math.floor(g.save.time);
  const hrs = Math.floor(secs / 3600), mins = Math.floor((secs % 3600) / 60);
  g.ui.ending([
    '#Foglight',
    'The Sunstone blazed atop Gull Point,',
    'and the fog rolled back out to sea.',
    '',
    'Hoot flew home to his tower.',
    'Bramble caught a very large fish.',
    'Elder Moss woke up from his nap',
    'and said he\'d known all along.',
    '',
    'And Pip?',
    'Pip went home for tea.',
    '',
    '#Starring',
    'Pip the fox',
    'Nan Ginger · Elder Moss · Tansy',
    'Dot · Mill · Bramble · Hoot',
    '',
    '#Featuring',
    'Deepcoil, the Shrine Eel',
    'The Gloom',
    'and a great many Gloops',
    '',
    '#Made with',
    'JavaScript, WebGL2 and WebAudio,',
    'with every model, tune and sound',
    'built from scratch in code.',
    '',
    `Hearts: ${g.save.hearts} · Shells: ${g.save.shells} · Time: ${hrs ? hrs + 'h ' : ''}${mins}m`,
    '',
    '#Thank you for playing!',
    '',
    'The island is still yours to explore.',
  ], () => {
    g.creditsPan = null;
    g.player.hidden = false;
    g.mode = 'play';
    g.save.respawn = { area: 'overworld', x: 60.5, z: 5.5, dir: 0 };
    g.persist();
    g.startAt(g.save.respawn);
  });
}
