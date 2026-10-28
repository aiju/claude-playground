// The game: owns the current area and screen, the entities in it, the
// camera, saving, and the flow between play, scrolling and warping.

import { Area } from './world.js';
import { T, TILE, SW, SH } from './tiles.js';
import { buildScreen } from './terrain.js';
import { MeshBuilder } from './mesh.js';
import { MODEL_BUILDERS } from './models.js';
import { Particles } from './particles.js';
import { Player } from './player.js';
import { mat4, clamp, lerp, rand, smooth } from './math.js';
import { createEntity, Thrown } from './objects.js';
import { makeItemActions, ITEMS } from './items.js';
import { AREA_DEFS, START } from './data/index.js';
import { ENVS } from './data/envs.js';

const SAVE_KEY = 'foglight-save-v1';
const PITCH = 0.9;   // camera pitch from the horizontal, radians
const FOVY = 0.55;

export function newSave() {
  return {
    hearts: 3, hp: 6, shells: 0,
    arrows: 0, maxArrows: 30, bombs: 0, maxBombs: 10,
    items: { sword: true },
    equip: [null, null],
    keys: {}, bigKeys: {},
    heartPieces: 0,
    flags: {},
    respawn: { ...START },
    time: 0,
  };
}

export class Game {
  constructor({ renderer, input, audio, ui, models }) {
    this.r = renderer;
    this.input = input;
    this.audio = audio;
    this.ui = ui;
    this.models = models;
    this.particles = new Particles(this);
    this.time = 0;
    this.dt = 1 / 60;
    this.areas = {};
    this.screenCache = new Map();
    this.entities = [];
    this.frozen = new Map();
    this.mode = 'title';
    this.shakeT = 0; this.shakeA = 0;
    this.stopT = 0;
    this.flashT = 0; this.flashCol = [1, 1, 1];
    this.fade = 0;
    this.cam = [8, 5.5];
    this.camDist = 16;
    this.save = newSave();
    this.itemActions = makeItemActions(this);
    this.player = null;
    this.cutscene = null;
    this.area = null;
    this.sx = 0; this.sy = 0;
    this.visitKilled = new Set();
    this.timers = [];
  }

  // ---------------- saving ----------------
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* storage may be unavailable */ }
  }
  loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s) return { ...newSave(), ...s };
    } catch { /* ignore broken saves */ }
    return null;
  }
  flag(name) { return !!this.save.flags[name]; }
  setFlag(name, v = true) { this.save.flags[name] = v; this.persist(); }

  newGame() {
    this.creditsPan = null;
    this.save = newSave();
    this.startAt(this.save.respawn);
    this.ui.showHud(true);
    if (this.area.def.onNewGame) this.area.def.onNewGame(this);
  }
  continueGame() {
    this.creditsPan = null;
    const s = this.loadSave();
    if (!s) return this.newGame();
    this.save = s;
    this.save.hp = Math.max(this.save.hp, 6);
    this.startAt(this.save.respawn);
    this.ui.showHud(true);
  }
  startAt(p) {
    this.player = new Player(this, p.x, p.z);
    this.player.dir = p.dir ?? Math.PI;
    this.player.vis = this.player.dir;
    this.loadArea(p.area, p.x, p.z);
    this.mode = 'play';
    this.fade = 1;
    this.fadeTo(0, 0.5);
  }

  // ---------------- areas & screens ----------------
  getArea(id) {
    if (!this.areas[id]) {
      const def = AREA_DEFS[id];
      if (!def) throw new Error(`unknown area ${id}`);
      this.areas[id] = new Area(def);
    }
    return this.areas[id];
  }

  loadArea(id, x, z) {
    const prev = this.area;
    this.area = this.getArea(id);
    if (prev !== this.area) {
      this.visitKilled.clear();
      for (const [k, v] of this.screenCache) {
        if (!k.startsWith(id + ':')) { v.mesh.dispose(); v.water.dispose(); v.props?.dispose(); this.screenCache.delete(k); }
      }
    }
    this.frozen.clear();
    this.entities = [];
    this.particles.list.length = 0;
    this.player.x = x; this.player.z = z;
    this.player.y = 0; this.player.vy = 0;
    this.player.lastSafe = [x, z];
    if (this.player.state !== 'hold') this.player.setState('normal');
    const [sx, sy] = this.area.screenOf(x, z);
    this.sx = sx; this.sy = sy;
    this.cam = this.screenCenter(sx, sy);
    this.applyEnv();
    this.spawnScreen(sx, sy);
    this.onScreenEnter(true);

    this.audio.music(this.musicFor());
  }

  musicFor() {
    const d = this.area.def;
    const s = this.area.screenInfo(this.sx, this.sy);
    if (s.music) return s.music;
    if (typeof d.music === 'function') return d.music(this);
    return d.music || 'overworld';
  }

  applyEnv() {
    const d = this.area.def;
    let env = ENVS[d.env || 'day'];
    if (typeof env === 'function') env = env(this);
    this.r.setEnv(env);
    this.envDef = env;
    this.r.post.gloom = env.gloom ?? 0;
    if (env.gloomCol) this.r.post.gloomCol = env.gloomCol;
  }

  screenCenter(sx, sy) { return [sx * SW + SW / 2, sy * SH + SH / 2]; }
  inScreen(x, z, sx, sy) { return x >= sx * SW && x < (sx + 1) * SW && z >= sy * SH && z < (sy + 1) * SH; }
  inCurrentScreen(x, z) { return this.inScreen(x, z, this.sx, this.sy); }

  screenData(sx, sy) {
    const key = `${this.area.id}:${sx},${sy}`;
    let s = this.screenCache.get(key);
    if (!s) {
      s = buildScreen(this.r.gl, this.area, sx, sy, this.save.flags);
      s.props = this.buildProps(sx, sy);
      this.screenCache.set(key, s);
    }
    return s;
  }

  // A static mesh of the screen's props in their starting state, drawn for
  // neighbouring screens that are visible at the edges of the view.
  buildProps(sx, sy) {
    const b = new MeshBuilder();
    const map = { bush: 'bush', tallgrass: 'tallgrass', rock: 'rock', pot: 'pot', boulder: 'boulder', sign: 'sign', block: 'block' };
    for (const s of this.area.spawns) {
      if (Math.floor(s.tx / SW) !== sx || Math.floor(s.ty / SH) !== sy) continue;
      const m = map[s.type];
      if (!m) continue;
      b.push(); b.translate(s.tx + 0.5, 0, s.ty + 0.5); MODEL_BUILDERS[m](b); b.pop();
    }
    return b.build(this.r.gl);
  }

  spawnScreen(sx, sy) {
    const key = `${sx},${sy}`;
    for (const s of this.area.spawns) {
      if (Math.floor(s.tx / SW) !== sx || Math.floor(s.ty / SH) !== sy) continue;
      const sid = `${this.area.id}:${s.tx},${s.ty}`;
      if (s.type === 'enemy' && this.visitKilled.has(sid)) continue;
      const e = createEntity(this, s, sid);
      if (!e) continue;
      e.screenKey = key;
      e.spawnId = sid;
      e.sx = sx; e.sy = sy;
      this.entities.push(e);
    }
    const info = this.area.screenInfo(sx, sy);
    if (info.spawn) info.spawn(this, sx, sy, key);
  }

  add(e, screenKey) {
    e.screenKey = screenKey ?? `${this.sx},${this.sy}`;
    if (e.sx === undefined) { e.sx = this.sx; e.sy = this.sy; }
    this.entities.push(e);
    return e;
  }

  onScreenEnter(fromWarp) {
    this.roomScript = null;
    const info = this.area.screenInfo(this.sx, this.sy);
    if (info.room) this.roomScript = { ...info.room, state: {} };
    if (this.roomScript?.enter) this.roomScript.enter(this, this.roomScript.state);
    // name the place when it changes
    const name = info.name || (this.area.kind !== 'overworld' ? this.area.def.name : null);
    if (name && name !== this.lastBanner && this.mode !== 'title' && this.mode !== 'credits') this.ui.banner(name);
    if (name) this.lastBanner = name;
    const m = this.musicFor();
    this.audio.music(m);
    this.save.respawnScreen = { area: this.area.id, x: this.player.x, z: this.player.z };
    this.ui.updateMinimap?.();
    if (this.area.def.visited !== false) {
      const v = (this.save.flags['visited:' + this.area.id] ||= []);
      const k = `${this.sx},${this.sy}`;
      if (!v.includes(k)) v.push(k);
    }
  }

  // ---------------- collision queries ----------------
  isFrozen(tx, tz) { return this.frozen.has(tz * this.area.w + tx); }

  tileBlocks(ent, tx, tz) {
    const d = TILE[this.area.tileAt(tx, tz)];
    if (ent.ghost) return false;
    if (d.water) {
      if (this.isFrozen(tx, tz)) return false;
      return !(ent.airborne || ent.flying || ent.swims);
    }
    if (ent.swims) return true;
    if (ent.flying) return d.tall || d === T.VOID;
    if (d.solid) return true;
    if (d.pit) return ent.avoidPits && !ent.airborne;
    if (d.spikes && ent.avoidPits) return true;
    return false;
  }

  isBlocked(ent, x, z, hw) {
    const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw - 1e-6);
    const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw - 1e-6);
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
      if (this.tileBlocks(ent, tx, tz)) return true;
    }
    if (ent.confined && ent.sx !== undefined && !ent.ghost) {
      const bx0 = ent.sx * SW + 0.0, bz0 = ent.sy * SH + 0.0;
      if (x - hw < bx0 || x + hw > bx0 + SW || z - hw < bz0 || z + hw > bz0 + SH) return true;
    }
    if (ent.ghost) return false;
    for (const e of this.entities) {
      if (e === ent || !e.solid || e.dead) continue;
      if (ent.flying && e.low) continue;
      if (ent.airborne && e.low && ent.isPlayer) continue;
      if (e.boxOverlaps(x, z, hw)) {
        if (ent.passThrough && ent.passThrough(e)) continue;
        return true;
      }
    }
    return false;
  }

  isSafeSpot(x, z) {
    const tx = Math.floor(x), tz = Math.floor(z);
    const d = this.area.tileDef(tx, tz);
    if (d.solid && !(d.water && this.isFrozen(tx, tz))) return false;
    if (d.pit || d.spikes) return false;
    if (d.water && !this.isFrozen(tx, tz)) return false;
    return !this.isBlocked(this.player, x, z, this.player.bodyHw);
  }

  // The nearest safe floor tile to (x, z) inside the current screen.
  findSafeSpot(x, z) {
    const x0 = this.sx * SW, z0 = this.sy * SH;
    let best = null, bd = 1e9;
    for (let ty = z0; ty < z0 + SH; ty++) for (let tx = x0; tx < x0 + SW; tx++) {
      const cx = tx + 0.5, cz = ty + 0.5;
      const d = Math.hypot(cx - x, cz - z);
      if (d < bd && this.isSafeSpot(cx, cz) && !this.area.tileDef(tx, ty).water) { bd = d; best = [cx, cz]; }
    }
    return best || [x, z];
  }

  solidAt(x, z, except) {
    for (const e of this.entities) {
      if (e === except || !e.solid || e.dead) continue;
      if (Math.abs(x - e.x) < e.hw && Math.abs(z - e.z) < e.hw) return e;
    }
    return null;
  }

  entitiesNear(x, z, r, filter) {
    const out = [];
    for (const e of this.entities) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.z - z) < r + e.r && (!filter || filter(e))) out.push(e);
    }
    return out;
  }

  // Is there a tall tile (or tall solid entity) on the straight line between two points?
  wallBetween(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / 0.2);
    const t0 = [Math.floor(x0), Math.floor(z0)], t1 = [Math.floor(x1), Math.floor(z1)];
    for (let i = 1; i < n; i++) {
      const x = lerp(x0, x1, i / n), z = lerp(z0, z1, i / n);
      const tx = Math.floor(x), tz = Math.floor(z);
      if ((tx === t0[0] && tz === t0[1]) || (tx === t1[0] && tz === t1[1])) continue;
      if (TILE[this.area.tileAt(tx, tz)].tall) return true;
    }
    return false;
  }

  // Apply a damage source to everything in a circle.
  hitArea(src, x, z, radius, filter) {
    for (const e of [...this.entities]) {
      if (e.dead || !e.hurt) continue;
      if (filter && !filter(e)) continue;
      if (Math.hypot(e.x - x, e.z - z) < radius + e.r) e.hurt(src);
    }
    if (this.player && (!filter || filter(this.player)) && Math.hypot(this.player.x - x, this.player.z - z) < radius + this.player.r) this.player.hurt(src);
  }

  throwObject(e, player, speedMul = 1) {
    const t = new Thrown(this, e, player, speedMul);
    this.add(t);
  }

  // ---------------- effects ----------------
  shake(a = 0.15, t = 0.25) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
  hitstop(t) { this.stopT = Math.max(this.stopT, t); }
  flash(col = [1, 1, 1], t = 0.3) { this.flashCol = col; this.flashT = t; this.flashDur = t; }
  fadeTo(v, dur, then) { this.fadeAnim = { from: this.fade, to: v, t: 0, dur, then }; }
  after(t, fn) { this.timers.push({ t, fn }); }

  damagePlayer(n) {
    this.save.hp = Math.max(0, this.save.hp - n);
    this.audio.sfx('hurt');
    this.shake(0.12, 0.2);
    this.flash([1, 0.2, 0.2], 0.18);
  }
  healPlayer(n) {
    this.save.hp = Math.min(this.save.hearts * 2, this.save.hp + n);
  }
  addShells(n) {
    this.save.shells = Math.min(999, this.save.shells + n);
  }

  say(text, opts = {}) {
    return this.ui.dialog(text, opts);
  }

  // Hold an item up, show its message, then carry on.
  giveItem(id, then) {
    const it = ITEMS[id];
    const p = this.player;
    if (it.give) it.give(this);
    p.setState('hold');
    p.holdItem = it.model;
    p.dir = 0;
    this.audio.sfx(it.big ? 'fanfare' : 'itemget');
    if (it.big) this.audio.duck(3.2);
    this.persist();
    this.say(typeof it.text === 'function' ? it.text(this) : it.text, {
      onDone: () => {
        p.setState('normal'); p.holdItem = null;
        if (it.after) it.after(this);
        if (then) then();
      },
    });
  }

  onPlayerDeath() {
    this.audio.music(null);
    this.audio.sfx('die');
    this.after(1.6, () => {
      this.ui.gameOver((choice) => {
        if (choice === 'continue') {
          this.save.hp = 6;
          this.fade = 1;
          this.startAt(this.save.respawn);
        } else {
          this.toTitle();
        }
      });
    });
  }

  toTitle() {
    this.mode = 'title';
    this.ui.showHud(false);
    // the island drifts past behind the title
    this.save = newSave();
    this.player = new Player(this, 24.5, 17.5);
    this.player.hidden = true;
    this.loadArea('overworld', 24.5, 17.5);
    this.player.hidden = true;
    this.creditsPan = { t: 0, title: true };
    this.fade = 1;
    this.fadeTo(0, 1.2);
    this.audio.music('title');
    this.ui.title(this, this.hasSave());
  }

  // ---------------- transitions ----------------
  warp(target) {
    if (this.mode !== 'play') return;
    this.mode = 'warp';
    this.audio.sfx(target.sound || 'door');
    const p = this.player;
    this.fadeTo(1, 0.3, () => {
      const t = typeof target === 'function' ? target(this) : target;
      p.dir = t.dir ?? p.dir;
      p.vis = p.dir;
      p.carry = null;
      this.loadArea(t.area, t.x, t.z);
      if (t.respawn !== false) {
        this.save.respawn = { area: t.area, x: t.x, z: t.z, dir: p.dir };
        this.persist();
      }
      const finish = () => { this.mode = 'play'; };
      if (t.walk) {
        p.autoWalk(t.x + t.walk[0], t.z + t.walk[1], 0.35, () => { p.lastSafe = [p.x, p.z]; });
      }
      this.fadeTo(0, 0.35, finish);
    });
  }

  startScroll(dx, dy) {
    const nsx = this.sx + dx, nsy = this.sy + dy;
    if (nsx < 0 || nsy < 0 || nsx >= this.area.sw || nsy >= this.area.sh) return false;
    this.mode = 'scroll';
    // clear short-lived things
    for (const e of this.entities) if (e.transient) e.dead = true;
    this.scroll = { from: [this.sx, this.sy], to: [nsx, nsy], t: 0, dur: this.area.kind === 'overworld' ? 0.62 : 0.75 };
    this.spawnScreen(nsx, nsy);
    const p = this.player;
    let tx = p.x, tz = p.z;
    // indoors, walk right through the doorway so shutters can close behind you
    const depth = this.area.kind === 'overworld' ? 0.72 : 1.5;
    if (dx) tx = (dx > 0 ? nsx * SW + depth : (nsx + 1) * SW - depth);
    if (dy) tz = (dy > 0 ? nsy * SH + depth : (nsy + 1) * SH - depth);
    if (this.area.kind !== 'overworld') {
      // line up with the doorway
      if (dx) tz = Math.floor(tz) + 0.5;
      if (dy) tx = Math.floor(tx) + 0.5;
    }
    const carry = p.carry;
    p.autoWalk(tx, tz, this.scroll.dur);
    p.carry = carry;
    return true;
  }

  endScroll() {
    const [fx, fy] = this.scroll.from;
    const oldKey = `${fx},${fy}`;
    this.entities = this.entities.filter((e) => e.screenKey !== oldKey || e.followsPlayer);
    for (const [k, ice] of this.frozen) if (ice.screenKey === oldKey) this.frozen.delete(k);
    [this.sx, this.sy] = this.scroll.to;
    this.scroll = null;
    this.mode = 'play';
    const p = this.player;
    p.lastSafe = this.isSafeSpot(p.x, p.z) ? [p.x, p.z] : this.findSafeSpot(p.x, p.z);
    if (this.area.kind === 'overworld') {
      // overworld monsters come back when you return
      for (const k of [...this.visitKilled]) this.visitKilled.delete(k);
    }
    this.onScreenEnter(false);
  }

  // ---------------- update ----------------
  update(dt) {
    this.dt = dt;
    this.time += dt;
    this.save.time += dt;
    // fades and timers run in every mode
    if (this.fadeAnim) {
      const f = this.fadeAnim;
      f.t += dt;
      this.fade = lerp(f.from, f.to, Math.min(1, f.t / f.dur));
      if (f.t >= f.dur) { this.fadeAnim = null; f.then && f.then(); }
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }

    if (this.creditsPan) {
      this.creditsPan.t += dt;
      for (const e of this.entities) if (e.animateDuringScroll) e.update(dt);
      this.particles.update(dt);
    }
    if (this.ui.update(dt)) return;
    if (this.mode === 'title' || this.mode === 'credits' || !this.player) return;

    if (this.input.pressed('menu') && this.mode === 'play' && this.player.state !== 'hold' && this.player.state !== 'dead') {
      this.ui.openMenu(this);
      return;
    }
    if (this.stopT > 0) { this.stopT -= dt; return; }

    if (this.mode === 'scroll') {
      const s = this.scroll;
      s.t += dt;
      this.player.update(dt);
      const k = smooth(Math.min(1, s.t / s.dur));
      const a = this.screenCenter(...s.from), b = this.screenCenter(...s.to);
      this.cam = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
      for (const e of this.entities) if (e.animateDuringScroll) e.update(dt);
      this.particles.update(dt);
      if (s.t >= s.dur) endScrollSafe(this);
      return;
    }
    if (this.mode === 'warp') { this.particles.update(dt); return; }

    // play
    if (this.cutscene) {
      if (this.cutscene.update(dt, this) === false) this.cutscene = null;
    }
    const p = this.player;
    if (!this.cutscene?.freezePlayer) p.update(dt);
    const list = this.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.dead) e.update(dt);
    }
    if (list.some((e) => e.dead)) this.entities = list.filter((e) => !e.dead);
    this.particles.update(dt);
    if (this.roomScript?.update) this.roomScript.update(this, this.roomScript.state, dt);

    // walking off the edge of the screen
    if (this.mode === 'play' && ['normal', 'charge', 'hurt'].includes(p.state) && !p.airborne) {
      const x0 = this.sx * SW, z0 = this.sy * SH;
      let dx = 0, dy = 0;
      if (p.x < x0) dx = -1; else if (p.x >= x0 + SW) dx = 1;
      else if (p.z < z0) dy = -1; else if (p.z >= z0 + SH) dy = 1;
      if (dx || dy) {
        if (!this.startScroll(dx, dy)) {
          p.x = clamp(p.x, x0 + 0.3, x0 + SW - 0.3);
          p.z = clamp(p.z, z0 + 0.3, z0 + SH - 0.3);
        }
      }
    }
  }

  // ---------------- draw ----------------
  draw(frameDt) {
    const r = this.r;
    if (!this.area) { r.render(frameDt); return; }
    // camera
    if (this.creditsPan) {
      // a slow tour of the island
      const path = this.creditsPan.title ? [[24, 16.5], [40, 16.5], [40, 27.5], [24, 27.5]] : [[56, 5.5], [56, 16.5], [40, 16.5], [24, 16.5], [24, 5.5], [8, 5.5], [8, 16.5], [8, 27.5], [24, 27.5], [40, 27.5], [56, 27.5]];
      const seg = this.creditsPan.title ? 9 : 6.5;
      const u = this.creditsPan.t / seg;
      const i = Math.floor(u) % (this.creditsPan.title ? path.length : path.length - 1);
      const j = this.creditsPan.title ? (i + 1) % path.length : Math.min(i + 1, path.length - 1);
      const k = smooth(Math.min(1, u - Math.floor(u)));
      const a = path[i], b = path[this.creditsPan.title ? j : Math.min(j, path.length - 1)];
      const done = !this.creditsPan.title && u >= path.length - 1;
      this.cam = done ? path[path.length - 1] : [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
      const [nsx, nsy] = this.area.screenOf(this.cam[0], this.cam[1]);
      if (nsx !== this.sx || nsy !== this.sy) {
        this.entities = this.entities.filter((e) => e.screenKey === `${nsx},${nsy}`);
        this.sx = nsx; this.sy = nsy;
        if (!this.entities.length) this.spawnScreen(nsx, nsy);
      }
    }
    let [cx, cz] = this.cam;
    if (this.shakeT > 0) { cx += rand(-1, 1) * this.shakeA; cz += rand(-1, 1) * this.shakeA; }
    const tgt = [cx, 0, cz + 0.35];
    this.fitCamera();
    const D = this.camDist;
    const eye = [tgt[0], tgt[1] + Math.sin(PITCH) * D, tgt[2] + Math.cos(PITCH) * D];
    r.setCamera(eye, tgt, FOVY);
    // fog distances are given relative to the camera distance
    const f = this.envDef.fog;
    r.env.fog = [D + f[0], D + f[1], f[2]];
    r.shadowCenter = [cx, 0, cz - 0.5];
    r.shadowRadius = 12.5;
    r.post.fade = this.fade;
    r.post.scroll = [cx / 9, cz / 9];
    r.post.flash = this.flashT > 0 ? [...this.flashCol, (this.flashT / this.flashDur) * 0.45] : [0, 0, 0, 0];
    r.reset();

    // terrain for the visible screens
    const active = new Set([`${this.sx},${this.sy}`]);
    if (this.scroll) active.add(`${this.scroll.to[0]},${this.scroll.to[1]}`);
    const sx0 = Math.floor((cx - SW / 2) / SW), sy0 = Math.floor((cz - SH / 2) / SH);
    for (let sy = sy0 - 1; sy <= sy0 + 2; sy++) for (let sx = sx0 - 1; sx <= sx0 + 2; sx++) {
      if (sx < 0 || sy < 0 || sx >= this.area.sw || sy >= this.area.sh) continue;
      // skip screens that are well out of view
      const ccx = sx * SW + SW / 2, ccz = sy * SH + SH / 2;
      if (Math.abs(ccx - cx) > SW * 1.6 || ccz - cz > SH * 1.2 || cz - ccz > SH * 1.7) continue;
      const s = this.screenData(sx, sy);
      r.draw(s.mesh);
      r.drawWater(s.water);
      if (!active.has(`${sx},${sy}`)) r.draw(s.props);
      for (const l of s.lights) r.light(l.x, l.y, l.z, l.r, ...l.col);
    }
    // entities
    for (const e of this.entities) if (!e.dead && !e.carried) e.draw(r);
    if (this.player && !this.player.hidden) this.player.draw(r);
    if (this.envDef?.heroLight && this.player && !this.player.hidden) {
      const l = this.envDef.heroLight;
      r.light(this.player.x, 1.2, this.player.z, l[0], l[1], l[2], l[3]);
    }
    if (this.cutscene?.draw) this.cutscene.draw(r, this);
    this.particles.draw(r);
    r.render(frameDt);
  }

  // Find the camera distance at which the whole screen fits the view.
  fitCamera() {
    const r = this.r;
    const aspect = r.w / r.h;
    if (this.fitAspect === aspect) return;
    this.fitAspect = aspect;
    let D = 16;
    const tgt = [SW / 2, 0, SH / 2 + 0.35];
    for (let i = 0; i < 30; i++) {
      const eye = [tgt[0], Math.sin(PITCH) * D, tgt[2] + Math.cos(PITCH) * D];
      r.setCamera(eye, tgt, FOVY);
      let worst = 0;
      for (const p of [[0, 0, 0], [SW, 0, 0], [0, 0, SH], [SW, 0, SH], [0, 1.6, 0], [SW, 1.6, 0], [SW / 2, 2.1, 0]]) {
        const q = mat4.transformPoint(r.viewProj, p[0], p[1], p[2]);
        worst = Math.max(worst, Math.abs(q[0]) / 0.99, q[1] / 0.93, -q[1] / 0.985);
      }
      D *= Math.pow(worst, 0.8);
    }
    this.camDist = D;
  }
}

function endScrollSafe(g) { g.endScroll(); }
