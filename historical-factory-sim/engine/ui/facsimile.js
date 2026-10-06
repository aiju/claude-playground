// A modal that shows a document as a facsimile of the printed form, with
// its copies and its history.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
    const pv = this.sc.paperView;
    const form = pv.forms[doc.type];
    const cal = this.sc.cal;
    let html = '';
    if (doc.siblings && doc.siblings.length > 1) {
      html += '<div class="fax-copies">' + doc.siblings.map((c, i) => `<button data-copy="${i}" class="${c === doc ? 'on' : ''}">${i === 0 ? 'Top copy' : `Copy ${i + 1}`}</button>`).join('') + '</div>';
    }
    html += `<div class="fax-sheet">${form ? form.render(doc, pv.ctx) : `<pre>${esc(JSON.stringify(doc.fields, null, 1))}</pre>`}</div>`;
    html += '<div class="fax-meta">';
    if (form) html += `<div class="fax-title">${esc(form.title)}<span>${esc(form.size || '')}</span></div><p class="fax-note">${esc(form.note || '')}</p>`;
    const where = pv.whereabouts(doc);
    if (where) html += `<p class="fax-where">Now: ${esc(where)}</p>`;
    html += '<ol class="fax-history">' + doc.history.slice(-12).map((h) => `<li><span>${esc(cal.dayName(h.t).slice(0, 3))} ${esc(cal.docDate(h.t))}, ${esc(cal.clockTime(h.t))}</span> ${esc(h.text)}</li>`).join('') + '</ol>';
    html += '</div>';
    const body = this.el.querySelector('.fax-body');
    body.innerHTML = html;
    for (const b of body.querySelectorAll('[data-copy]')) b.onclick = () => this.open(doc.siblings[Number(b.dataset.copy)]);
  }
}
