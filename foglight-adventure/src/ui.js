// DOM user interface: HUD, dialog boxes, banners, pause menu, title and
// game-over screens. It reads the same Input as the game.

import { heartIcon, ICONS } from './icons.js';
import { ITEMS, ITEM_ORDER } from './items.js';
import { SW, SH } from './tiles.js';

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class UI {
  constructor(root, input, audio) {
    this.root = root;
    this.input = input;
    this.audio = audio;
    this.el = {};
    root.innerHTML = `
      <div id="hud" class="hidden">
        <div class="hud-left">
          <div id="hearts"></div>
          <div class="counters">
            <span class="ctr"><i>${ICONS.shell}</i><b id="shells">0</b></span>
            <span class="ctr" id="keysCtr"><i>${ICONS.key}</i><b id="keys">0</b></span>
            <span class="ctr" id="bigKeyCtr"><i>${ICONS.bigKey}</i></span>
          </div>
        </div>
        <div class="hud-right">
          <div class="slot" id="slot0"><div class="icon"></div><span class="lbl"></span><span class="cnt"></span></div>
          <div class="slot" id="slot1"><div class="icon"></div><span class="lbl"></span><span class="cnt"></span></div>
        </div>
      </div>
      <div id="banner"></div>
      <div id="dialog" class="hidden"><div class="name"></div><div class="text"></div><div class="choices"></div><div class="more">▼</div></div>
      <div id="menu" class="hidden"></div>
      <div id="title" class="hidden"></div>
      <div id="gameover" class="hidden"></div>
      <div id="toast"></div>`;
    for (const id of ['hud', 'hearts', 'shells', 'keys', 'keysCtr', 'bigKeyCtr', 'banner', 'dialog', 'menu', 'title', 'gameover', 'slot0', 'slot1', 'toast']) this.el[id] = root.querySelector('#' + id);
    this.dlg = null;
    this.menuOpen = false;
    this.cache = {};
    this.layout = 'zx';
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ' || e.code === 'KeyK' || e.code === 'KeyL') this.layout = 'jk';
      if (e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'KeyC') this.layout = 'zx';
    });
  }

  keyName(action) {
    if (this.input.usingTouch) return { sword: '⚔', action: '✋', item1: '1', item2: '2', menu: '☰' }[action];
    if (this.input.usingPad) return { sword: 'A', action: 'B', item1: 'X', item2: 'Y', menu: 'Start' }[action];
    if (this.layout === 'jk') return { sword: 'J', action: 'Space', item1: 'K', item2: 'L', menu: 'Enter' }[action];
    return { sword: 'Z', action: 'Space', item1: 'X', item2: 'C', menu: 'Enter' }[action];
  }

  // ---------------- HUD ----------------
  showHud(v) { this.el.hud.classList.toggle('hidden', !v); }

  refresh(g) {
    const s = g.save;
    const set = (k, v, fn) => { if (this.cache[k] !== v) { this.cache[k] = v; fn(v); } };
    set('hearts', `${s.hp}/${s.hearts}`, () => {
      let h = '';
      for (let i = 0; i < s.hearts; i++) {
        const f = Math.max(0, Math.min(2, s.hp - i * 2));
        h += `<span class="heart${f === 0 ? ' empty' : ''}">${heartIcon(f)}</span>`;
      }
      this.el.hearts.innerHTML = h;
    });
    this.el.hearts.classList.toggle('low', s.hp <= 2 && s.hp > 0);
    set('shells', s.shells, (v) => { this.el.shells.textContent = v; });
    const d = g.area?.def.dungeon;
    set('keys', d ? (s.keys[d] || 0) : -1, (v) => {
      this.el.keysCtr.style.display = v >= 0 ? '' : 'none';
      this.el.keys.textContent = v;
    });
    set('bigkey', d && s.bigKeys[d] ? 1 : 0, (v) => { this.el.bigKeyCtr.style.display = v ? '' : 'none'; });
    for (let i = 0; i < 2; i++) {
      const id = s.equip[i];
      const cnt = id === 'bombs' ? s.bombs : id === 'bow' ? s.arrows : '';
      set('slot' + i, `${id}|${cnt}|${this.keyName('item' + (i + 1))}`, () => {
        const el = this.el['slot' + i];
        el.querySelector('.icon').innerHTML = id ? ICONS[id] : '';
        el.querySelector('.lbl').textContent = this.keyName('item' + (i + 1));
        el.querySelector('.cnt').textContent = cnt === '' ? '' : cnt;
        el.classList.toggle('empty', !id);
        const tb = this.input.touchRoot?.querySelector(i ? '.b-i2' : '.b-i1');
        if (tb) tb.innerHTML = id ? ICONS[id] : `<span>${i + 1}</span>`;
      });
    }
  }

  banner(text) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
  }

  // ---------------- dialog ----------------
  format(t) {
    let s = esc(t);
    s = s.replace(/\{(sword|action|item1|item2|menu)\}/g, (_, a) => `<kbd>${this.keyName(a)}</kbd>`);
    s = s.replace(/\b([A-Z][A-Z'’]{2,}(?: [A-Z][A-Z'’]+)*)\b/g, '<em>$1</em>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  dialog(text, opts = {}) {
    const pages = Array.isArray(text) ? text.slice() : [text];
    this.dlg = { pages, page: 0, shown: 0, opts, choice: 0, delay: 0.12 };
    this.el.dialog.classList.remove('hidden');
    this.el.dialog.classList.toggle('sign', !!opts.sign);
    this.showPage();
  }

  showPage() {
    const d = this.dlg;
    const raw = d.pages[d.page];
    d.full = this.format(raw);
    d.plainLen = raw.length;
    d.shown = 0;
    const el = this.el.dialog;
    el.querySelector('.name').textContent = d.opts.name || '';
    el.querySelector('.name').style.display = d.opts.name ? '' : 'none';
    el.querySelector('.choices').innerHTML = '';
    el.querySelector('.more').style.visibility = 'hidden';
    this.renderText();
  }

  renderText() {
    // reveal the formatted HTML character by character (tags count as 0)
    const d = this.dlg;
    let out = '', n = 0, i = 0;
    const s = d.full;
    while (i < s.length && n < d.shown) {
      if (s[i] === '<') { const j = s.indexOf('>', i); out += s.slice(i, j + 1); i = j + 1; continue; }
      if (s[i] === '&') { const j = s.indexOf(';', i); out += s.slice(i, j + 1); i = j + 1; n++; continue; }
      out += s[i]; i++; n++;
    }
    // close any open tags
    const open = (out.match(/<(em|kbd)>/g) || []).length - (out.match(/<\/(em|kbd)>/g) || []).length;
    if (open > 0) out += out.lastIndexOf('<kbd>') > out.lastIndexOf('<em>') ? '</kbd>' : '</em>';
    this.el.dialog.querySelector('.text').innerHTML = out;
    d.done = i >= s.length;
  }

  updateDialog(dt) {
    const d = this.dlg, inp = this.input;
    d.delay -= dt;
    const adv = d.delay <= 0 && (inp.pressed('sword') || inp.pressed('action'));
    if (!d.done) {
      const before = d.shown;
      d.shown += dt * 55;
      if (adv) d.shown = 1e9;
      if (Math.floor(d.shown / 3) !== Math.floor(before / 3)) this.audio.sfx('blip', 0.25);
      this.renderText();
      if (d.done) this.onPageDone();
      return;
    }
    const isLast = d.page === d.pages.length - 1;
    if (isLast && d.opts.choices) {
      if (inp.pressed('up') || inp.pressed('down')) {
        d.choice = (d.choice + (inp.pressed('down') ? 1 : -1) + d.opts.choices.length) % d.opts.choices.length;
        this.audio.sfx('menuMove');
        this.renderChoices();
      }
      if (adv) {
        this.audio.sfx('menuSelect');
        this.closeDialog(d.choice);
      }
      return;
    }
    if (adv) {
      if (!isLast) { d.page++; this.showPage(); this.audio.sfx('blip', 0.4); }
      else this.closeDialog();
    }
  }

  onPageDone() {
    const d = this.dlg;
    const isLast = d.page === d.pages.length - 1;
    if (isLast && d.opts.choices) this.renderChoices();
    else this.el.dialog.querySelector('.more').style.visibility = 'visible';
  }

  renderChoices() {
    const d = this.dlg;
    this.el.dialog.querySelector('.choices').innerHTML = d.opts.choices.map((c, i) => `<div class="choice${i === d.choice ? ' sel' : ''}">${esc(c)}</div>`).join('');
  }

  closeDialog(choice) {
    const d = this.dlg;
    this.dlg = null;
    this.el.dialog.classList.add('hidden');
    this.input.consume('sword'); this.input.consume('action');
    if (d.opts.onChoice && choice !== undefined) d.opts.onChoice(choice);
    if (d.opts.onDone) d.opts.onDone(choice);
  }

  // ---------------- update: returns true while the UI holds the game ----------------
  update(dt) {
    if (this.titleState) { this.updateTitle(dt); return true; }
    if (this.goState) { this.updateGameOver(dt); return true; }
    if (this.menuOpen) { this.updateMenu(dt); return true; }
    if (this.dlg) { this.updateDialog(dt); return true; }
    if (this.endingState) { this.updateEnding(dt); return true; }
    return false;
  }

  // ---------------- pause menu ----------------
  openMenu(g) {
    this.g = g;
    this.menuOpen = true;
    this.menuSel = Math.max(0, ITEM_ORDER.indexOf(g.save.equip[0]));
    this.audio.sfx('menuOpen');
    this.audio.duck(99, 0.35);
    this.el.menu.classList.remove('hidden');
    this.renderMenu();
  }
  closeMenu() {
    this.menuOpen = false;
    this.el.menu.classList.add('hidden');
    this.audio.sfx('menuClose');
    this.audio.unduck();
    this.input.consume('menu');
  }
  updateMenu() {
    const inp = this.input, g = this.g;
    if (inp.pressed('menu')) return this.closeMenu();
    const n = ITEM_ORDER.length;
    if (inp.pressed('left')) { this.menuSel = (this.menuSel + n - 1) % n; this.audio.sfx('menuMove'); this.renderMenu(); }
    if (inp.pressed('right')) { this.menuSel = (this.menuSel + 1) % n; this.audio.sfx('menuMove'); this.renderMenu(); }
    for (const [btn, slot] of [['item1', 0], ['item2', 1], ['sword', 0]]) {
      if (inp.pressed(btn)) {
        const id = ITEM_ORDER[this.menuSel];
        if (!g.save.items[id]) continue;
        const eq = g.save.equip;
        const other = 1 - slot;
        if (eq[other] === id) eq[other] = eq[slot];
        eq[slot] = id;
        this.audio.sfx('menuSelect');
        g.persist();
        this.renderMenu();
      }
    }
    if (inp.pressed('map')) { this.audio.sfx('menuMove'); }
  }
  renderMenu() {
    const g = this.g, s = g.save;
    const items = ITEM_ORDER.map((id, i) => {
      const has = s.items[id];
      const eq = s.equip.indexOf(id);
      const cnt = id === 'bombs' && has ? `<span class="cnt">${s.bombs}</span>` : id === 'bow' && has ? `<span class="cnt">${s.arrows}</span>` : '';
      return `<div class="mi${i === this.menuSel ? ' sel' : ''}${has ? '' : ' none'}">${has ? ICONS[id] : ''}${cnt}${eq >= 0 ? `<span class="eq">${this.keyName('item' + (eq + 1))}</span>` : ''}</div>`;
    }).join('');
    const selId = ITEM_ORDER[this.menuSel];
    const it = s.items[selId] ? ITEMS[selId] : null;
    const quest = [
      `<div class="q"><i>${ICONS.sword}</i>Driftwood Sword</div>`,
      `<div class="q"><i>${ICONS.heartPiece}</i>Heart pieces: ${s.heartPieces} / 4</div>`,
      s.items.sunstone ? `<div class="q"><i>${ICONS.sunstone}</i>The Sunstone</div>` : '',
    ].join('');
    const d = g.area.def.dungeon;
    const dung = d ? `<div class="q"><i>${ICONS.key}</i>Small keys: ${s.keys[d] || 0}</div>${s.bigKeys[d] ? `<div class="q"><i>${ICONS.bigKey}</i>Big Key</div>` : ''}` : '';
    this.el.menu.innerHTML = `
      <div class="panel">
        <h2>Satchel</h2>
        <div class="items">${items}</div>
        <div class="desc">${it ? `<b>${it.name}</b> ${it.desc}<br><span class="hint">Press <kbd>${this.keyName('item1')}</kbd> or <kbd>${this.keyName('item2')}</kbd> to put it on that button.</span>` : '<span class="hint">An empty pocket. Who knows what you\'ll find?</span>'}</div>
        <div class="cols">
          <div class="col"><h3>Treasures</h3>${quest}${dung}</div>
          <div class="col"><h3>Map</h3>${this.mapHtml(g)}</div>
        </div>
        <div class="controls">
          <span><kbd>${this.layout === 'jk' ? 'WASD' : '←↑↓→'}</kbd> move</span>
          <span><kbd>${this.keyName('sword')}</kbd> sword (hold to charge a spin)</span>
          <span><kbd>${this.keyName('action')}</kbd> lift / talk / throw</span>
          <span><kbd>${this.keyName('item1')}</kbd><kbd>${this.keyName('item2')}</kbd> items</span>
          <span><kbd>${this.keyName('menu')}</kbd> close</span>
          <span><kbd>M</kbd> sound on/off</span>
        </div>
      </div>`;
  }
  mapHtml(g) {
    const a = g.area;
    const v = g.save.flags['visited:' + a.id] || [];
    const marks = a.def.mapMarks?.(g) || {};
    let h = `<div class="map" style="grid-template-columns:repeat(${a.sw}, 1fr)">`;
    for (let y = 0; y < a.sh; y++) for (let x = 0; x < a.sw; x++) {
      const k = `${x},${y}`;
      const here = x === g.sx && y === g.sy;
      const seen = v.includes(k);
      const exists = a.def.mapRooms ? a.def.mapRooms.includes(k) : true;
      h += `<div class="cell${seen ? ' seen' : ''}${here ? ' here' : ''}${exists ? '' : ' void'}">${marks[k] || ''}</div>`;
    }
    return h + `</div><div class="mapname">${esc(a.def.name || '')}</div>`;
  }

  // ---------------- title ----------------
  title(g, hasSave) {
    this.g = g;
    this.titleState = { sel: hasSave ? 1 : 0, opts: hasSave ? ['New Adventure', 'Continue'] : ['New Adventure'], t: 0 };
    this.el.title.classList.remove('hidden');
    this.renderTitle();
  }
  renderTitle() {
    const t = this.titleState;
    this.el.title.innerHTML = `
      <div class="logo"><span class="fog">Fog</span><span class="light">light</span></div>
      <div class="sub">a little island adventure</div>
      <div class="opts">${t.opts.map((o, i) => `<div class="opt${i === t.sel ? ' sel' : ''}">${o}</div>`).join('')}</div>
      <div class="help">${this.input.usingTouch ? 'Tap to start' : this.input.usingPad ? 'Stick/D-pad and A' : 'Arrow keys or WASD, then Z, J, Space or Enter'}</div>`;
  }
  updateTitle(dt) {
    const t = this.titleState, inp = this.input;
    t.t += dt;
    if (inp.pressed('up') || inp.pressed('down')) {
      t.sel = (t.sel + 1) % t.opts.length; this.audio.sfx('menuMove'); this.renderTitle();
    }
    if (t.t > 0.3 && (inp.pressed('sword') || inp.pressed('action') || inp.pressed('menu'))) {
      this.audio.unlock();
      this.audio.sfx('menuSelect');
      const choice = t.opts[t.sel];
      this.titleState = null;
      this.el.title.classList.add('hidden');
      this.input.consume('sword'); this.input.consume('action'); this.input.consume('menu');
      if (choice === 'Continue') this.g.continueGame(); else this.g.newGame();
    }
  }

  // ---------------- game over ----------------
  gameOver(cb) {
    this.goState = { sel: 0, cb, t: 0 };
    this.el.gameover.classList.remove('hidden');
    this.renderGameOver();
  }
  renderGameOver() {
    const s = this.goState;
    this.el.gameover.innerHTML = `<div class="go-title">You fainted…</div><div class="go-sub">But Pip is a plucky sort of fox.</div>
      <div class="opts">${['Get back up', 'Back to the title'].map((o, i) => `<div class="opt${i === s.sel ? ' sel' : ''}">${o}</div>`).join('')}</div>`;
  }
  updateGameOver(dt) {
    const s = this.goState, inp = this.input;
    s.t += dt;
    if (inp.pressed('up') || inp.pressed('down')) { s.sel = 1 - s.sel; this.audio.sfx('menuMove'); this.renderGameOver(); }
    if (s.t > 0.5 && (inp.pressed('sword') || inp.pressed('action') || inp.pressed('menu'))) {
      this.audio.sfx('menuSelect');
      this.goState = null;
      this.el.gameover.classList.add('hidden');
      this.input.consume('sword'); this.input.consume('action'); this.input.consume('menu');
      s.cb(s.sel === 0 ? 'continue' : 'title');
    }
  }

  // ---------------- ending ----------------
  ending(lines, onDone) {
    this.endingState = { lines, t: 0, onDone };
    const el = this.el.title;
    el.classList.remove('hidden');
    el.classList.add('credits');
    el.innerHTML = `<div class="roll">${lines.map((l) => l.startsWith('#') ? `<h2>${esc(l.slice(1))}</h2>` : l === '' ? '<br>' : `<p>${esc(l)}</p>`).join('')}</div>`;
    this.endingState.roll = el.querySelector('.roll');
  }
  updateEnding(dt) {
    const e = this.endingState;
    e.t += dt;
    const h = e.roll.offsetHeight;
    const y = window.innerHeight - e.t * 38;
    e.roll.style.transform = `translateY(${Math.max(y, -h + window.innerHeight * 0.45)}px)`;
    if (y < -h + window.innerHeight * 0.45 && e.t > 5 && (this.input.pressed('sword') || this.input.pressed('action') || this.input.pressed('menu'))) {
      this.endingState = null;
      this.el.title.classList.add('hidden');
      this.el.title.classList.remove('credits');
      e.onDone && e.onDone();
    }
  }
}
