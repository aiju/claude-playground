// The overlay: clock, speed and view controls, the inspector and the log.
import { fmt } from '../sim/money.js';

const SPEEDS = [
  { label: '1×', v: 1, title: 'Real time' },
  { label: '10×', v: 10, title: 'Ten times real time' },
  { label: '1 min/s', v: 60, title: 'One minute a second' },
  { label: '5 min/s', v: 300, title: 'Five minutes a second' },
  { label: '20 min/s', v: 1200, title: 'Twenty minutes a second' },
  { label: '1 hr/s', v: 3600, title: 'One hour a second' },
];

const CUTS = [
  { label: 'Roofs on', v: Infinity },
  { label: 'Roofs off', v: 'open' },
  { label: '3rd floor', v: 3 },
  { label: '2nd', v: 2 },
  { label: '1st', v: 1 },
  { label: 'Ground', v: 0 },
];

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(root, { scenario, view, clock }) {
    this.sc = scenario;
    this.view = view;
    this.clock = clock;
    const cal = scenario.cal;

    this.clockPanel = el('header', 'panel clock');
    this.clockPanel.innerHTML = `<div class="firm">${esc(scenario.meta.firm)}</div><div class="date"></div><div class="time"></div><div class="status"></div>`;
    root.appendChild(this.clockPanel);

    const controls = el('nav', 'panel controls');
    const speedRow = el('div', 'row');
    speedRow.appendChild(el('span', 'label', 'Speed'));
    this.pauseBtn = el('button', '', 'Pause');
    this.pauseBtn.onclick = () => { clock.paused = !clock.paused; this.refreshButtons(); };
    speedRow.appendChild(this.pauseBtn);
    this.speedBtns = SPEEDS.map((s) => {
      const b = el('button', '', s.label);
      b.title = s.title;
      b.onclick = () => { clock.speed = s.v; clock.paused = false; this.refreshButtons(); };
      speedRow.appendChild(b);
      return { b, v: s.v };
    });
    const skip = el('button', '', 'Next morning');
    skip.title = 'Skip to twenty to six tomorrow morning';
    skip.onclick = () => clock.skipToNextMorning();
    speedRow.appendChild(skip);
    controls.appendChild(speedRow);

    const cutRow = el('div', 'row');
    cutRow.appendChild(el('span', 'label', 'Show'));
    this.cutBtns = CUTS.map((c) => {
      const b = el('button', '', c.label);
      b.onclick = () => { view.setCut(c.v); this.refreshButtons(); };
      cutRow.appendChild(b);
      return { b, v: c.v };
    });
    controls.appendChild(cutRow);

    const placeRow = el('div', 'row');
    placeRow.appendChild(el('span', 'label', 'Go to'));
    const names = { overview: 'Overview', gate: 'Gate', offices: 'Offices', 'main-block': 'Main block', 'engine-house': 'Engine house', 'machine-shop': 'Machine shop' };
    for (const key of Object.keys(scenario.cameraPresets || {})) {
      const b = el('button', '', names[key] || key);
      b.onclick = () => { view.setPreset(key); this.refreshButtons(); };
      placeRow.appendChild(b);
    }
    controls.appendChild(placeRow);
    root.appendChild(controls);

    this.inspector = el('aside', 'panel inspector hidden');
    root.appendChild(this.inspector);
    this.logPanel = el('section', 'panel log');
    root.appendChild(this.logPanel);
    root.appendChild(el('div', 'hint', 'Drag to turn · right-drag to pan · scroll to zoom · click anyone'));

    scenario.world.logListeners.push(() => { this.logDirty = true; });
    view.onPick = (sel) => this.show(sel);
    this.selection = null;
    this.lastInspect = 0;
    this.refreshButtons();
  }

  refreshButtons() {
    this.pauseBtn.classList.toggle('on', this.clock.paused);
    for (const { b, v } of this.speedBtns) b.classList.toggle('on', !this.clock.paused && this.clock.speed === v);
    for (const { b, v } of this.cutBtns) b.classList.toggle('on', this.view.cut.level === v);
  }

  update(t, realNow) {
    const sc = this.sc;
    const cal = sc.cal;
    const [date, time, status] = this.clockPanel.querySelectorAll('.date, .time, .status');
    date.textContent = cal.longDate(t);
    time.textContent = cal.clockTime(t);
    const onSite = sc.world.people.filter((p) => p.onSite).length;
    let state;
    if (sc.shopsWorking(t)) state = 'The works is at work';
    else if (sc.timetables.works.isHoliday(t)) state = 'Bank holiday: the works is closed';
    else {
      const next = sc.timetables.works.nextSpell(t);
      const gap = next ? next[0] - t : Infinity;
      const mod = cal.minuteOfDay(t);
      if (gap < 40 && mod > 7 * 60 && mod < 9 * 60) state = 'Breakfast';
      else if (gap <= 60 && mod > 12 * 60 && mod < 14 * 60) state = 'Dinner hour';
      else state = 'The works is closed';
    }
    const engine = sc.engineRunning(t) ? 'the engine is running' : 'the engine is stopped';
    status.textContent = `${state}; ${engine}; ${onSite} on the premises.`;

    if (this.logDirty) {
      this.logDirty = false;
      const entries = sc.world.logEntries.slice(-40);
      this.logPanel.innerHTML = entries.map((e) => `<div class="entry ${e.kind}"><span class="t">${esc(cal.dayName(e.t).slice(0, 3))} ${esc(cal.clockTime(e.t))}</span>${esc(e.text)}</div>`).join('');
      this.logPanel.scrollTop = this.logPanel.scrollHeight;
    }
    if (this.selection && realNow - this.lastInspect > 400) {
      this.lastInspect = realNow;
      this.render();
    }
  }

  show(sel) {
    this.selection = sel.kind === 'none' ? null : sel;
    if (sel.kind !== 'person') {
      this.view.follow = false;
      this.view.select(-1);
    }
    this.render();
  }

  render() {
    const sel = this.selection;
    const box = this.inspector;
    if (!sel) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    let html = '<button class="close" title="Close">×</button>';
    if (sel.kind === 'person') html += this.personHtml(sel.person);
    else if (sel.kind === 'spot') html += this.spotHtml(sel.spot);
    else if (sel.kind === 'building') html += this.buildingHtml(sel);
    box.innerHTML = html;
    box.querySelector('.close').onclick = () => this.show({ kind: 'none' });
    const follow = box.querySelector('[data-act=follow]');
    if (follow) {
      follow.classList.toggle('on', this.view.follow);
      follow.onclick = () => { this.view.follow = !this.view.follow; this.render(); };
    }
  }

  pay(p) {
    if (p.hourly) return `${fmt(p.hourly)} an hour (${fmt(p.hourly * 53, { shillings: true })} for 53 hours)`;
    if (p.weekly) return `${fmt(p.weekly, { shillings: true })} a week`;
    if (p.salary) return `${fmt(p.salary)} a year`;
    return '';
  }

  personHtml(p) {
    const sc = this.sc;
    const cal = sc.cal;
    const site = sc.site;
    const spot = site.nodes.get(p.spot);
    const room = spot ? site.roomAt(spot.id) : null;
    const home = site.nodes.get(p.home);
    const ident = p.worksNo ? `No. ${p.worksNo} · ${esc(p.title)}` : esc(p.title);
    let html = `<h2>${esc(p.name)}</h2><div class="sub">${ident}</div>`;
    html += `<div class="now">${esc(capitalise(p.activity))}</div>`;
    html += '<dl>';
    html += `<dt>Department</dt><dd>${esc(p.deptName)}</dd>`;
    if (room) html += `<dt>Works in</dt><dd>${esc(room.name)}</dd>`;
    html += `<dt>Age</dt><dd>${p.age}</dd>`;
    html += `<dt>Pay</dt><dd>${esc(this.pay(p))}</dd>`;
    if (home) html += `<dt>Lives</dt><dd>${esc(home.label || '')}</dd>`;
    html += '</dl>';
    if (p.role !== 'staff') html += this.timecardHtml(p);
    html += '<div class="actions"><button data-act="follow">Follow</button></div>';
    return html;
  }

  // The week's clockings, laid out like a time card: late in red.
  timecardHtml(p) {
    const cal = this.sc.cal;
    const now = this.clock.t;
    const dow = cal.dow(now);
    const monday = cal.dayStart(now) - ((dow + 6) % 7) * 1440;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let rows = '';
    for (let i = 0; i < 6; i++) {
      const d0 = monday + i * 1440;
      const recs = p.record.filter((r) => r.t >= d0 && r.t < d0 + 1440 && (r.kind === 'in' || r.kind === 'out'));
      const cells = [];
      for (let k = 0; k < 4; k++) {
        const r = recs[k];
        cells.push(r ? `<td class="${r.late ? 'late' : ''}">${cal.hhmm(r.t)}</td>` : '<td></td>');
      }
      rows += `<tr><th>${days[i]}</th>${cells.join('')}</tr>`;
    }
    return `<table class="timecard"><caption>Time card, week beginning ${esc(cal.docDate(monday))}</caption><tr><th></th><th>In</th><th>Out</th><th>In</th><th>Out</th></tr>${rows}</table>`;
  }

  spotHtml(spot) {
    const sc = this.sc;
    const room = sc.site.roomAt(spot.id);
    const who = sc.world.people.filter((p) => p.spot === spot.id && !p.roam);
    let html = `<h2>${esc(spot.label || describeSpot(spot.type))}</h2>`;
    if (room) html += `<div class="sub">${esc(room.name)}</div>`;
    if (who.length) {
      html += '<dl>';
      for (const p of who) html += `<dt>${p.worksNo ? `No. ${p.worksNo}` : ''}</dt><dd>${esc(p.name)}, ${esc(p.title.toLowerCase())}</dd>`;
      html += '</dl>';
    }
    return html;
  }

  buildingHtml({ building, room, floor }) {
    const sc = this.sc;
    const floorName = building.floors > 1 ? ['Ground floor', 'First floor', 'Second floor', 'Third floor'][floor] : '';
    let html = `<h2>${esc(room ? room.name : building.name)}</h2><div class="sub">${esc(building.name)}${floorName ? ` · ${floorName}` : ''}</div>`;
    if (room) {
      const here = sc.world.people.filter((p) => p.onSite && !p.motion && sc.site.nodes.get(p.node)?.room === room.id);
      html += `<dl><dt>People here</dt><dd>${here.length}</dd></dl>`;
    }
    return html;
  }
}

function capitalise(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const SPOT_NAMES = {
  capstan: 'Capstan lathe', automatic: 'Automatic screw machine', press: 'Power press', 'hardening-furnace': 'Case-hardening furnace',
  'toolroom-lathe': 'Toolroom lathe', 'pattern-bench': "Patternmaker's bench", 'jig-table': 'Frame jig', hearth: 'Brazing hearth',
  'file-bench': "Filer's bench", sandblast: 'Sand-blast cabinet', 'pickle-vat': 'Pickling vat', 'polishing-spindle': 'Polishing spindle',
  'plating-vat': 'Nickel plating vat', 'scrub-trough': 'Scrubbing trough', stove: 'Enamelling stove', 'dip-tank': 'Enamel dipping tank',
  'rubbing-bench': 'Rubbing-down bench', 'lining-bench': "Liner's bench", 'spoke-machine': 'Spoke screwing machine',
  'lacing-bench': 'Lacing bench', 'truing-stand': 'Truing stand', bench: "Fitter's bench", 'pillar-bench': 'Pillar bench',
  'viewing-bench': "Viewer's bench", 'test-stand': 'Test rollers', 'wrapping-table': 'Wrapping table', 'packing-bench': 'Packing bench',
  'bin-rack': 'Stores bins', 'stock-rack': 'Stock racks', 'crate-bench': 'Crate bench', forge: "Smith's forge", 'mess-seat': 'Mess room table',
  desk: 'Desk', 'sloping-desk': 'Sloping desk', typewriter: 'Typewriter', counter: 'Counter', 'time-recorder': 'Time recorder',
  'foreman-box': "Foreman's box",
};

function describeSpot(type) {
  return SPOT_NAMES[type] || type;
}
