// The overlay: clock, speed and view controls, the inspector and the log.
import { fmt } from '../sim/money.js';
import { Facsimile } from './facsimile.js';

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
    if (view.paperLayer) {
      this.paperBtn = el('button', '', 'Paper');
      this.paperBtn.title = 'Make the paper stand out: cards, slips, tins and papers in hand';
      this.paperBtn.onclick = () => { view.paperLayer.setEmphasis(!view.paperLayer.emphasis); this.refreshButtons(); };
      cutRow.appendChild(this.paperBtn);
    }
    controls.appendChild(cutRow);

    const placeRow = el('div', 'row');
    placeRow.appendChild(el('span', 'label', 'Go to'));
    for (const [key, preset] of Object.entries(scenario.cameraPresets || {})) {
      const b = el('button', '', preset.label || key);
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

    this.facsimile = scenario.paperView ? new Facsimile(root, scenario) : null;
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
    if (this.paperBtn) this.paperBtn.classList.toggle('on', this.view.paperLayer.emphasis);
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
    let prod = '';
    if (sc.world.works) {
      const w = sc.world.works;
      prod = ` ${w.finishedThisWeek} machines finished this week; ${sc.machinesInProgress()} in the shops; ${w.finishedStock.length} in the Stock Room.`;
    }
    const cs = sc.commerceSummary?.();
    if (cs) prod += ` ${cs.ordersWaiting} order${cs.ordersWaiting === 1 ? '' : 's'} on the warehouse file; ${cs.onDock} crate${cs.onDock === 1 ? '' : 's'} on the dock; ${cs.despatchedThisWeek} machine${cs.despatchedThisWeek === 1 ? '' : 's'} despatched this week.`;
    status.textContent = `${state}; ${engine}; ${onSite} on the premises.${prod}`;

    if (this.logDirty) {
      this.logDirty = false;
      const entries = sc.world.logEntries.slice(-40);
      this.logPanel.innerHTML = entries.map((e) => `<div class="entry ${e.kind}"><span class="t">${esc(cal.dayName(e.t).slice(0, 3))} ${esc(cal.clockTime(e.t))}</span>${esc(e.text)}</div>`).join('');
      this.logPanel.scrollTop = this.logPanel.scrollHeight;
    }
    if (this.selection && realNow - this.lastInspect > 400 && !(this.facsimile && this.facsimile.doc)) {
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
    else if (sel.kind === 'lot') html += this.lotHtml(sel.lot);
    else if (sel.kind === 'bike') html += this.bikeHtml(sel.machine);
    else if (sel.kind === 'vehicle') html += this.vehicleHtml(sel.vehicle);
    html += this.papersHtml(sel);
    box.innerHTML = html;
    box.querySelector('.close').onclick = () => this.show({ kind: 'none' });
    for (const b of box.querySelectorAll('[data-doc]')) {
      b.onclick = () => this.facsimile.open(this.paperList[Number(b.dataset.doc)]);
    }
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
    if (p.carrying) html += `<div class="sub">Carrying ${esc(p.carrying.label)}</div>`;
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

  papersHtml(sel) {
    const pv = this.sc.paperView;
    if (!pv) return '';
    let list = [];
    if (sel.kind === 'person') list = pv.papersFor(sel.person);
    else if (sel.kind === 'lot') list = pv.papersForLot(sel.lot);
    else if (sel.kind === 'spot') list = pv.papersForPlace(sel.spot.id);
    else if (sel.kind === 'building' && sel.room) list = pv.papersForPlace(sel.room.id);
    else if (sel.kind === 'vehicle' && sel.vehicle?.driver) list = pv.papersFor(sel.vehicle.driver).filter((x) => x.label.startsWith('Carrying'));
    this.paperList = list.map((x) => x.doc);
    if (!list.length) return '';
    return `<div class="papers"><div class="label">Papers</div>${list.map((x, i) => `<button data-doc="${i}">${esc(x.label)}</button>`).join('')}</div>`;
  }

  lotHtml(lot) {
    const sc = this.sc;
    const cal = sc.cal;
    const prod = sc.production;
    const s = prod.current(lot);
    const room = sc.site.rooms.get(lot.room);
    const batch = lot.batch;
    let html = `<h2>${esc(lot.label.split(' ')[0])}</h2><div class="sub">${esc(lot.label.split(' ').slice(1).join(' '))}</div>`;
    let now;
    if (lot.state === 'done') now = 'Finished';
    else if (lot.state === 'awaiting move') now = `Waiting to be carried to the ${prod.roomName(lot.moveTo)}`;
    else if (lot.state === 'moving' || lot.state === 'fetching') now = `Being carried to the ${prod.roomName(lot.moveTo)}`;
    else if (lot.state === 'equip') now = `${capitalise(s.what || 'in the stove')}`;
    else if (lot.state === 'equip-wait') now = 'Waiting for a stove';
    else if (s && (s.op || s.issue)) {
      const done = lot.qty - lot.left - lot.inHand;
      now = `${capitalise(s.op)}: ${done} of ${lot.qty} done${lot.inHand ? `, ${lot.inHand} in hand` : ''}${lot.short ? ' (short of parts)' : ''}`;
    } else now = lot.state;
    html += `<div class="now">${esc(now)}</div><dl>`;
    if (room) html += `<dt>In</dt><dd>${esc(room.name)}</dd>`;
    html += `<dt>Quantity</dt><dd>${lot.qty} ${esc(lot.unit)}${lot.qty === 1 ? '' : 's'}</dd>`;
    if (lot.kind === 'despatch' && lot.agent) {
      html += `<dt>For</dt><dd>${esc(lot.agent.name)}, ${esc(lot.agent.town)}</dd>`;
      html += `<dt>To</dt><dd>${esc(lot.agent.station)}, carriage ${esc(lot.agent.carriage.toLowerCase())}</dd>`;
      html += `<dt>Frame nos.</dt><dd>${esc((lot.frameNos || []).map((n) => n.toLocaleString('en-GB')).join(', '))}</dd>`;
    }
    if (batch) {
      html += `<dt>Sub-order</dt><dd>${esc(batch.id)}: ${batch.qty} ${esc(batch.name)}</dd>`;
      html += `<dt>Put through</dt><dd>${esc(cal.dayName(batch.launched))} ${esc(cal.docDate(batch.launched))}</dd>`;
      if (batch.frameNos) html += `<dt>Frame nos.</dt><dd>${batch.frameNos[0].toLocaleString('en-GB')}–${batch.frameNos[1].toLocaleString('en-GB')}</dd>`;
    }
    html += '</dl>';
    const steps = lot.routing.map((st, i) => {
      const name = st.op || st.what || (st.arrive ? `to the ${prod.roomName(st.room)}` : '');
      const cls = i < lot.step ? 'done' : i === lot.step ? 'here' : '';
      return `<li class="${cls}">${esc(capitalise(name))}</li>`;
    });
    html += `<ol class="routing">${steps.join('')}</ol>`;
    const hist = lot.history.slice(-6).reverse();
    if (hist.length) {
      html += '<dl>' + hist.map((h) => `<dt>${esc(cal.dayName(h.t).slice(0, 3))} ${esc(cal.hhmm(h.t))}</dt><dd>${esc(capitalise(h.text))}</dd>`).join('') + '</dl>';
    }
    return html;
  }

  vehicleHtml(v) {
    if (!v) return '';
    let html = `<h2>${esc(capitalise(v.name))}</h2><div class="sub">Pair-horse lorry</div>`;
    html += `<div class="now">${esc(capitalise(v.activity))}</div><dl>`;
    if (v.driver) html += `<dt>Carman</dt><dd>${esc(v.driver.name)}</dd>`;
    html += `<dt>Load</dt><dd>${v.load ? `${v.load} crate${v.load > 1 ? 's' : ''}` : 'Empty'}</dd>`;
    html += '</dl>';
    return html;
  }

  bikeHtml(m) {
    if (!m) return '<h2>A machine in stock</h2>';
    const cal = this.sc.cal;
    const model = this.sc.catalogue?.MODELS?.[m.model];
    let html = `<h2>Frame No. ${m.frameNo.toLocaleString('en-GB')}</h2><div class="sub">${esc(model ? model.name : m.model)}, ${esc(m.pattern)}'s pattern${m.frameSize ? `, ${m.frameSize} in. frame` : ''}</div>`;
    html += `<div class="now">${m.allocated ? `Wrapped, in the Stock Room; allocated to order ${esc(m.allocated)}` : 'Wrapped, in the Stock Room'}</div><dl>`;
    html += `<dt>Sub-order</dt><dd>${esc(m.batch === 'stock' ? 'last season’s stock' : m.batch)}</dd>`;
    html += `<dt>Finished</dt><dd>${esc(cal.dayName(m.finished))} ${esc(cal.docDate(m.finished))}, ${esc(cal.clockTime(m.finished))}</dd>`;
    if (model) html += `<dt>List price</dt><dd>${esc(this.sc.catalogue.price(m.model, m.pattern))}</dd>`;
    html += '</dl>';
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
