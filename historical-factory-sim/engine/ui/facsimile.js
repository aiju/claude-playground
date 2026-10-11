// A document shown as a facsimile of the printed form, with its copies, its
// history and the paper trail around it; in a modal of its own, or inside
// the paperwork explorer.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// When a document was written (a letter's history starts with the agent
// writing it, before it reached the works).
export function writtenAt(doc) {
  return doc.history?.[0]?.t ?? doc.created;
}

export function docTitle(sc, doc) {
  return sc.paperView.forms[doc.type]?.title || doc.type;
}

// The facsimile, its copies switcher and its notes, as HTML. Buttons carry
// data-copy (a copy of this set) or data-rel (a related document).
export function faxHtml(sc, doc, { related = [] } = {}) {
  const pv = sc.paperView;
  const form = pv.forms[doc.type];
  const cal = sc.cal;
  let html = '';
  if (doc.siblings && doc.siblings.length > 1) {
    html += '<div class="fax-copies">' + doc.siblings.map((c, i) => `<button data-copy="${i}" class="${c === doc ? 'on' : ''}">${i === 0 ? 'Top copy' : `Copy ${i + 1}`}</button>`).join('') + '</div>';
  }
  let sheet;
  try {
    sheet = form ? form.render(doc, pv.ctx) : `<pre>${esc(JSON.stringify(doc.fields, null, 1))}</pre>`;
  } catch (err) {
    sheet = `<p class="fax-error">This form couldn't be drawn: ${esc(err.message)}</p>`;
  }
  html += `<div class="fax-sheet">${sheet}</div>`;
  html += '<div class="fax-meta">';
  if (form) html += `<div class="fax-title">${esc(form.title)}<span>${esc(form.size || '')}</span></div><p class="fax-note">${esc(form.note || '')}</p>`;
  const where = pv.whereabouts(doc);
  if (where) html += `<p class="fax-where">Now: ${esc(where)}</p>`;
  if (doc.history.length) {
    html += '<ol class="fax-history">' + doc.history.slice(-12).map((h) => `<li><span>${esc(cal.dayName(h.t).slice(0, 3))} ${esc(cal.docDate(h.t))}, ${esc(cal.clockTime(h.t))}</span> ${esc(h.text)}</li>`).join('') + '</ol>';
  }
  if (related.length) {
    html += '<div class="fax-related"><div class="label">The paper trail</div>';
    html += related.map((d, i) => `<button data-rel="${i}"><b>${esc(docTitle(sc, d))}</b> ${esc(pv.summary(d))}<small>${esc(cal.dayName(writtenAt(d)).slice(0, 3))} ${esc(cal.shortDate(writtenAt(d)))}, ${esc(cal.hhmm(writtenAt(d)))}</small></button>`).join('');
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// Wire up a rendered facsimile's buttons.
export function bindFax(root, doc, related, open) {
  for (const b of root.querySelectorAll('[data-copy]')) b.onclick = () => open(doc.siblings[Number(b.dataset.copy)]);
  for (const b of root.querySelectorAll('[data-rel]')) b.onclick = () => open(related[Number(b.dataset.rel)]);
}

export class Facsimile {
  constructor(root, scenario) {
    this.sc = scenario;
    this.el = document.createElement('div');
    this.el.className = 'facsimile hidden';
    this.el.innerHTML = '<div class="fax-backdrop"></div><div class="fax-panel" role="dialog" aria-modal="true"><button class="fax-close" title="Close">×</button><div class="fax-body"></div></div>';
    root.appendChild(this.el);
    this.el.querySelector('.fax-backdrop').onclick = () => this.close();
    this.el.querySelector('.fax-close').onclick = () => this.close();
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    this.doc = null;
  }

  open(doc) {
    this.doc = doc;
    this.render();
    this.el.classList.remove('hidden');
  }

  close() {
    this.doc = null;
    this.el.classList.add('hidden');
  }

  refresh() {
    if (this.doc) this.render();
  }

  render() {
    const doc = this.doc;
    const related = this.sc.paperView.related?.(doc) || [];
    const body = this.el.querySelector('.fax-body');
    body.innerHTML = faxHtml(this.sc, doc, { related });
    bindFax(body, doc, related, (d) => this.open(d));
  }
}
