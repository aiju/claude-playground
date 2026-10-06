// The paperwork explorer: every document the works has written, by kind;
// where all the paper is now; and the books and ledgers. Choosing a
// document shows its facsimile, its copies, its history and the paper trail
// it belongs to. It knows nothing about any one scenario: the scenario's
// paper view supplies the kinds, summaries, places, books and ledger.
import { fmt } from '../sim/money.js';
import { faxHtml, bindFax, docTitle, writtenAt } from './facsimile.js';

const LIMIT = 250;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => n.toLocaleString('en-GB');

export class Explorer {
  constructor(root, { scenario, clock, onClockChange }) {
    this.sc = scenario;
    this.pv = scenario.paperView;
    this.paper = scenario.world.paper;
    this.clock = clock;
    this.onClockChange = onClockChange;
    this.tab = 'kinds';
    this.source = null;
    this.target = null; // what the right-hand pane shows
    this.trail = [];
    this.query = '';
    this.isOpen = false;

    const el = document.createElement('div');
    el.className = 'explorer hidden';
    el.innerHTML = `
      <div class="ex-panel" role="dialog" aria-modal="true" aria-label="Paperwork">
        <header class="ex-head">
          <div class="ex-name"><h2>Paperwork</h2><span>Every paper written since the works opened, and where it is now</span></div>
          <div class="ex-tabs" role="tablist">
            <button data-tab="kinds" role="tab">By kind</button>
            <button data-tab="places" role="tab">Where it is</button>
            <button data-tab="books" role="tab">Books and ledger</button>
          </div>
          <div class="ex-time"><span class="ex-clock"></span><button class="ex-pause"></button><button class="ex-skip" title="Run the works on to twenty to six tomorrow morning">Next morning</button></div>
          <button class="ex-close" title="Close (Esc)">×</button>
        </header>
        <div class="ex-body">
          <nav class="ex-side" aria-label="Kinds of paper"></nav>
          <section class="ex-list">
            <div class="ex-list-head"><div class="ex-list-title"></div><input type="search" id="ex-search" placeholder="Search names, numbers, towns" autocomplete="off"></div>
            <div class="ex-rows"></div>
          </section>
          <section class="ex-view"></section>
        </div>
      </div>`;
    root.appendChild(el);
    this.el = el;
    this.side = el.querySelector('.ex-side');
    this.listTitle = el.querySelector('.ex-list-title');
    this.rowsEl = el.querySelector('.ex-rows');
    this.view = el.querySelector('.ex-view');
    this.search = el.querySelector('#ex-search');
    this.clockEl = el.querySelector('.ex-clock');
    this.pauseBtn = el.querySelector('.ex-pause');

    el.querySelector('.ex-close').onclick = () => this.close();
    for (const b of el.querySelectorAll('[data-tab]')) b.onclick = () => this.setTab(b.dataset.tab);
    this.pauseBtn.onclick = () => {
      clock.paused = !clock.paused;
      this.onClockChange?.();
      this.tick(true);
    };
    el.querySelector('.ex-skip').onclick = () => {
      clock.skipToNextMorning();
      this.onClockChange?.();
      this.tick(true);
    };
    this.search.oninput = () => {
      this.query = this.search.value.trim().toLowerCase();
      this.renderList();
    };
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen && !document.querySelector('.facsimile:not(.hidden)')) this.close();
    });
  }

  open() {
    this.isOpen = true;
    this.el.classList.remove('hidden');
    if (!this.source) this.chooseDefault();
    this.renderAll();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1500);
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    clearInterval(this.timer);
  }

  // Open on the kind with the most recent paper.
  chooseDefault() {
    let best = null;
    for (const g of this.pv.kinds) {
      for (const t of g.types) {
        const last = this.paper.byType.get(t)?.at(-1);
        if (last && (!best || last.created > best.created)) best = last;
      }
    }
    this.source = { kind: 'type', type: best ? best.type : this.pv.kinds[0].types[0] };
  }

  setTab(tab) {
    this.tab = tab;
    this.trail = [];
    this.target = null;
    if (tab === 'kinds') this.chooseDefault();
    else if (tab === 'places') this.source = { kind: 'place', id: this.pv.places()[0]?.id };
    else this.source = this.pv.ledger?.() ? { kind: 'tb' } : { kind: 'book', id: this.pv.books()[0]?.id };
    this.renderAll();
  }

  renderAll() {
    for (const b of this.el.querySelectorAll('[data-tab]')) {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    }
    this.renderSide();
    this.renderList();
    this.renderView();
    this.tick(true);
  }

  // Every 1½ seconds while open: the clock, the counts, and anything new.
  tick(force = false) {
    const cal = this.sc.cal;
    const t = this.clock.t;
    this.clockEl.textContent = `${cal.dayName(t).slice(0, 3)} ${cal.docDate(t)}, ${cal.clockTime(t)}`;
    this.pauseBtn.textContent = this.clock.paused ? 'Run on' : 'Pause';
    this.pauseBtn.classList.toggle('on', this.clock.paused);
    if (force || !this.clock.paused) {
      this.renderSide();
      const sig = this.listSignature();
      if (force || sig !== this.lastSig) this.renderList();
      this.renderView({ keepScroll: true });
    }
  }

  // --- The left-hand column ---------------------------------------------------------

  renderSide() {
    const s = this.source || {};
    let html = '';
    if (this.tab === 'kinds') {
      for (const g of this.pv.kinds) {
        const total = g.types.reduce((a, t) => a + (this.paper.byType.get(t)?.length || 0), 0);
        html += `<div class="ex-group"><div class="ex-group-name">${esc(g.group)}<span>${num(total)}</span></div>`;
        for (const t of g.types) {
          const form = this.pv.forms[t];
          const n = this.paper.byType.get(t)?.length || 0;
          const copies = form?.copies || [{ colour: form?.colour || '#fbf8ef' }];
          const sw = copies.slice(0, 6).map((c) => `<i style="background:${esc(c.colour || '#fbf8ef')}"></i>`).join('');
          html += `<button class="ex-kind${s.kind === 'type' && s.type === t ? ' on' : ''}${n ? '' : ' none'}" data-type="${esc(t)}">
            <span class="ex-swatch" title="${copies.length > 1 ? `${copies.length} copies` : 'One copy'}">${sw}</span>
            <span class="ex-kind-name">${esc(form?.title || t)}</span><span class="ex-count">${num(n)}</span></button>`;
        }
        html += '</div>';
      }
    } else if (this.tab === 'places') {
      const places = this.pv.places();
      const sections = [['works', 'In the works'], ['away', 'Gone from the works'], ['hands', 'With people']];
      for (const [key, name] of sections) {
        const list = places.filter((p) => (p.id === 'hands' ? 'hands' : p.away ? 'away' : 'works') === key);
        if (!list.length) continue;
        html += `<div class="ex-group"><div class="ex-group-name">${esc(name)}<span>${num(list.reduce((a, p) => a + p.count, 0))}</span></div>`;
        for (const p of list) html += `<button class="ex-kind${s.kind === 'place' && s.id === p.id ? ' on' : ''}" data-place="${esc(p.id)}"><span class="ex-kind-name">${esc(p.label)}</span><span class="ex-count">${num(p.count)}</span></button>`;
        html += '</div>';
      }
    } else {
      const ledger = this.pv.ledger?.();
      if (ledger) {
        html += '<div class="ex-group"><div class="ex-group-name">Ledgers</div>';
        html += `<button class="ex-kind${s.kind === 'tb' ? ' on' : ''}" data-ledger="tb"><span class="ex-kind-name">General Ledger and trial balance</span></button>`;
        html += `<button class="ex-kind${s.kind === 'sales' ? ' on' : ''}" data-ledger="sales"><span class="ex-kind-name">Sales Ledger</span><span class="ex-count">${num(ledger.sales().length)}</span></button>`;
        html += '</div>';
      }
      html += '<div class="ex-group"><div class="ex-group-name">Books</div>';
      for (const b of this.pv.books()) html += `<button class="ex-kind${s.kind === 'book' && s.id === b.id ? ' on' : ''}${b.count ? '' : ' none'}" data-book="${esc(b.id)}"><span class="ex-kind-name">${esc(b.label)}</span><span class="ex-count">${num(b.count)}</span></button>`;
      html += '</div>';
    }
    const scroll = this.side.scrollTop;
    this.side.innerHTML = html;
    this.side.scrollTop = scroll;
    const pick = (source) => {
      this.source = source;
      this.trail = [];
      this.target = null;
      this.search.value = '';
      this.query = '';
      this.renderAll();
    };
    for (const b of this.side.querySelectorAll('[data-type]')) b.onclick = () => pick({ kind: 'type', type: b.dataset.type });
    for (const b of this.side.querySelectorAll('[data-place]')) b.onclick = () => pick({ kind: 'place', id: b.dataset.place });
    for (const b of this.side.querySelectorAll('[data-book]')) b.onclick = () => pick({ kind: 'book', id: b.dataset.book, offset: 0 });
    for (const b of this.side.querySelectorAll('[data-ledger]')) b.onclick = () => pick({ kind: b.dataset.ledger });
  }

  // --- The middle column: the list -------------------------------------------------------

  listSignature() {
    const s = this.source;
    if (!s) return '';
    if (s.kind === 'type') return `${s.type}:${this.paper.byType.get(s.type)?.length || 0}`;
    if (s.kind === 'place') return `${s.id}:${this.pv.places().find((p) => p.id === s.id)?.count || 0}`;
    if (s.kind === 'book') return `${s.id}:${this.pv.books().find((b) => b.id === s.id)?.count || 0}`;
    return `${s.kind}:${Math.floor(this.clock.t / 30)}`;
  }

  items() {
    const s = this.source;
    const pv = this.pv;
    const cal = this.sc.cal;
    const docRow = (d, withTitle) => ({
      key: d.id,
      title: withTitle ? `${docTitle(this.sc, d)}${d.siblings?.length > 1 ? `, ${d.copy === 0 ? 'top copy' : `copy ${d.copy + 1}`}` : ''}` : pv.summary(d),
      text: withTitle ? pv.summary(d) : '',
      meta: `${cal.dayName(writtenAt(d)).slice(0, 3)} ${cal.shortDate(writtenAt(d))}, ${cal.hhmm(writtenAt(d))} · ${pv.whereabouts(this.paper.top(d)) || ''}`,
      colour: d.colour,
      target: { doc: d },
    });
    if (!s) return { title: '', rows: [] };
    if (s.kind === 'type') {
      const all = this.paper.byType.get(s.type) || [];
      return { title: pv.forms[s.type]?.title || s.type, total: all.length, docs: all, make: (d) => docRow(d, false) };
    }
    if (s.kind === 'place') {
      const place = pv.places().find((p) => p.id === s.id);
      const docs = place ? place.docs() : [];
      return { title: place ? place.label : 'Nothing there now', total: docs.length, docs, make: (d) => docRow(d, true) };
    }
    if (s.kind === 'book') {
      const b = pv.books().find((x) => x.id === s.id);
      if (!b) return { title: '', rows: [] };
      const entries = b.book.entries;
      return {
        title: b.label, total: entries.length, docs: entries,
        make: (e) => {
          const r = pv.bookEntry(b.book, e);
          return {
            key: `${b.id}:${entries.indexOf(e)}`, title: r.text, text: r.amount !== null && r.amount !== undefined ? fmt(r.amount) : '',
            meta: `${cal.dayName(e.t).slice(0, 3)} ${cal.shortDate(e.t)}, ${cal.hhmm(e.t)}${e.by ? ` · ${e.by}` : ''}${r.from ? ` · from the ${docTitle(this.sc, r.from).toLowerCase()}` : ''}`,
            target: r.from ? { doc: r.from } : null,
          };
        },
      };
    }
    const ledger = pv.ledger?.();
    if (!ledger) return { title: '', rows: [] };
    const acctRow = (a) => ({
      key: a.doc.id, title: a.label, text: a.balance ? `${fmt(Math.abs(a.balance))} ${a.balance > 0 ? 'Dr.' : 'Cr.'}` : 'Nil',
      meta: a.sub || '', target: { doc: a.doc },
    });
    if (s.kind === 'tb') {
      const list = ledger.general();
      return { title: 'General Ledger', total: list.length, docs: list, make: acctRow, forward: true };
    }
    const list = ledger.sales();
    return { title: 'Sales Ledger', total: list.length, docs: list, make: acctRow, forward: true };
  }

  renderList() {
    this.lastSig = this.listSignature();
    const it = this.items();
    this.listTitle.innerHTML = it.title ? `<b>${esc(it.title)}</b><span>${it.total !== undefined ? `${num(it.total)} in all` : ''}</span>` : '';
    const docs = it.docs || [];
    const q = this.query;
    const rows = [];
    let matched = 0;
    // Newest first, except ledger accounts, which keep the ledger's order.
    for (let k = 0; k < docs.length; k++) {
      const i = it.forward ? k : docs.length - 1 - k;
      const r = it.make(docs[i]);
      if (q && !`${r.title} ${r.text} ${r.meta} ${docs[i].no ?? ''}`.toLowerCase().includes(q)) continue;
      matched++;
      if (rows.length < LIMIT) rows.push(r);
    }
    this.rowTargets = rows.map((r) => r.target);
    const selectedKey = this.target?.doc?.id;
    let html = rows.map((r, i) => `
      <button class="ex-row${r.target ? '' : ' plain'}${r.key === selectedKey ? ' on' : ''}" data-row="${i}">
        ${r.colour ? `<i class="ex-paper" style="background:${esc(r.colour)}"></i>` : ''}
        <span class="ex-row-title">${esc(r.title)}</span>
        ${r.text ? `<span class="ex-row-text">${esc(r.text)}</span>` : ''}
        <span class="ex-row-meta">${esc(r.meta)}</span>
      </button>`).join('');
    if (!docs.length) {
      html = `<p class="ex-empty">${this.source?.kind === 'type' ? 'None written yet. Run the works on and they’ll appear here as they’re written.' : 'Nothing here yet.'}</p>`;
    } else if (!rows.length) {
      html = `<p class="ex-empty">Nothing matches “${esc(this.search.value)}”.</p>`;
    } else if (matched > rows.length) {
      html += `<p class="ex-more">The newest ${num(rows.length)} of ${num(matched)} shown. Search to find older ones.</p>`;
    }
    const scroll = this.rowsEl.scrollTop;
    this.rowsEl.innerHTML = html;
    this.rowsEl.scrollTop = scroll;
    for (const b of this.rowsEl.querySelectorAll('[data-row]')) {
      const target = this.rowTargets[Number(b.dataset.row)];
      if (!target) continue;
      b.onclick = () => {
        this.trail = [];
        this.show(target);
      };
    }
  }

  // --- The right-hand column: the document ----------------------------------------------

  show(target, { push = false } = {}) {
    if (push && this.target) this.trail.push(this.target);
    this.target = target;
    for (const b of this.rowsEl.querySelectorAll('.ex-row')) b.classList.toggle('on', this.rowTargets[Number(b.dataset.row)]?.doc === target.doc);
    this.renderView();
    this.view.scrollTop = 0;
  }

  // What to show when nothing has been picked: the book's latest page, the
  // trial balance, or the newest document of the kind.
  defaultTarget() {
    const s = this.source;
    if (!s) return null;
    if (s.kind === 'book') {
      const b = this.pv.books().find((x) => x.id === s.id);
      return b ? { doc: this.pv.bookPage(b.book, s.offset || 0), book: b, offset: s.offset || 0 } : null;
    }
    if (s.kind === 'tb') return { doc: this.pv.ledger().trialBalance };
    if (s.kind === 'sales') {
      const top = this.pv.ledger().sales()[0];
      return top ? { doc: top.doc } : null;
    }
    if (s.kind === 'type') {
      const last = this.paper.byType.get(s.type)?.at(-1);
      return last ? { doc: last } : null;
    }
    const place = this.pv.places().find((p) => p.id === s.id);
    const last = place?.docs().at(-1);
    return last ? { doc: last } : null;
  }

  renderView({ keepScroll = false } = {}) {
    const target = this.target || this.defaultTarget();
    if (!target) {
      this.viewSig = null;
      this.view.innerHTML = '<p class="ex-empty">Choose a paper to see it.</p>';
      return;
    }
    const doc = target.doc;
    // Redraw a document only when something has happened to it; books and
    // ledgers are drawn fresh, since they change as entries are made.
    const sig = `${doc.id}:${doc.history.length}:${doc.marks.length}:${doc.links?.size || 0}:${this.trail.length}:${target.offset ?? ''}`;
    if (keepScroll && sig === this.viewSig && !doc.id.startsWith('view:')) return;
    this.viewSig = sig;
    const related = this.pv.related?.(doc) || [];
    let html = '<div class="ex-view-bar">';
    if (this.trail.length) html += '<button class="ex-back">← Back</button>';
    if (target.book) {
      const total = target.book.count;
      html += `<button class="ex-page" data-dir="1"${target.offset + 16 >= total ? ' disabled' : ''}>Earlier entries</button>`;
      html += `<button class="ex-page" data-dir="-1"${target.offset <= 0 ? ' disabled' : ''}>Later entries</button>`;
    }
    html += '</div>';
    html += `<div class="fax-body ex-fax">${faxHtml(this.sc, doc, { related })}</div>`;
    const scroll = this.view.scrollTop;
    this.view.innerHTML = html;
    if (keepScroll) this.view.scrollTop = scroll;
    bindFax(this.view, doc, related, (d) => this.show({ doc: d }, { push: true }));
    const back = this.view.querySelector('.ex-back');
    if (back) back.onclick = () => {
      this.target = this.trail.pop() || null;
      this.renderView();
    };
    for (const b of this.view.querySelectorAll('.ex-page')) {
      b.onclick = () => {
        const offset = Math.max(0, target.offset + Number(b.dataset.dir) * 16);
        this.source.offset = offset;
        this.target = { doc: this.pv.bookPage(target.book.book, offset), book: target.book, offset };
        this.renderView();
      };
    }
  }
}
