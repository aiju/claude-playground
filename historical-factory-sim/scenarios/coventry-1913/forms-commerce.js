// The commercial office's paper: letters in, office orders, postcards,
// invoices, statements, receipts, paying-in slips, advices of despatch and
// the railway's consignment notes; and pages of the books and ledgers.
//
// The six-copy Office Order and the four-copy Advice of Despatch follow
// Elbourne (1914); the consignment note follows the railway companies'
// printed notes as West describes them (1912). Layouts are reconstructed:
// no specimen of a cycle maker's commercial forms was found.
import { fmt, short } from '../../engine/sim/money.js';
import { FIRM, FIRM_SHORT, esc, hand, typed, lsdCells } from './formkit.js';
import { MODELS, PATTERNS } from './catalogue.js';

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const stampDate = (cal, t) => {
  const p = cal.parts(t);
  return `${p.day} ${MONTHS[p.month - 1].toUpperCase().replace('.', '')} ${p.year}`;
};
const describe = (l) => `${MODELS[l.model].name}, ${PATTERNS[l.pattern]}, ${l.frameSize} in.`;
const weight = (lb) => {
  const cwt = Math.floor(lb / 112);
  const qr = Math.floor((lb - cwt * 112) / 28);
  return `${cwt} cwt. ${qr} qrs. ${lb - cwt * 112 - qr * 28} lb.`;
};
const ofMonth = (cal, t, ref) => {
  const a = cal.parts(t);
  const b = cal.parts(ref);
  const ord = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
  if (a.month === b.month) return `${ord(a.day)} inst.`;
  return `${ord(a.day)} ult.`;
};
const letterhead = (f) => `
  <div class="letterhead"><div class="lh-name">${esc(f.fromName)}</div><div class="lh-trade">${esc(f.trade)}s</div><div class="lh-addr">${esc(f.address)}</div></div>`;

const ORDER_COPY_NAMES = ['INVOICE CLERK', 'ESTIMATOR AND WORKS ACCOUNTANT', 'WORKS MANAGER', 'DRAWING OFFICE', 'WORKS OFFICE', 'WAREHOUSE'];
const ADVICE_COPY_NAMES = ['CUSTOMER: BY POST', 'GENERAL OFFICE: FOR INVOICING', 'WAREHOUSE: TO BE SIGNED BY THE CARRIER'];
const SLIP_COPY_NAMES = ['WITH THE PACKAGES', 'GENERAL OFFICE', 'WAREHOUSE'];

export const COMMERCE_FORMS = {
  letter: {
    title: 'Letter', size: 'quarto note-paper', stock: 'sheet', colour: '#fdfbf4',
    note: "An agent's letter. On opening, each is stamped with the date and numbered, entered in the Inwards Correspondence Register, and passed to whoever is to deal with it.",
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const received = doc.marks.some((m) => m.mark === 'received');
      const town = f.address.split(', ').at(-1);
      let body;
      if (f.kind === 'remittance') {
        body = `<p>${hand('Dear Sirs,')}</p><p>${hand(`We beg to enclose cheque on the ${f.bank} value ${fmt(f.amount)}${f.discount ? `, being the amount of your statement, ${fmt(f.balance)}, less discount ${fmt(f.discount)}` : ' on account'}, and shall be glad to have your receipt.`)}</p>`;
      } else {
        body = `<p>${hand('Dear Sirs,')}</p><p>${hand(f.body.opening)}</p><ul class="items">${f.body.items.map((i) => `<li>${hand(i)}</li>`).join('')}</ul><p>${hand(f.body.close)}</p>`;
      }
      return `
        <div class="fax sheet letter">
          ${letterhead(f)}
          <div class="row"><span></span><span>${hand(`${town}, ${cal.docDate(f.written)}`)}</span></div>
          <div>${hand('The Sherbourne Cycle Co. Ltd.,')}<br>${hand('Sherbourne Works, Coventry.')}</div>
          ${body}
          <div class="row"><span></span><span>${hand('Yours faithfully,')}<br><span class="hand initials">${esc(f.fromName)}</span></span></div>
          ${received ? `<div class="stamp recd">RECEIVED<br>${esc(stampDate(cal, f.received))}<br>No. ${esc(doc.no)}</div>` : ''}
        </div>`;
    },
  },

  'office-order': {
    title: 'Office Order', size: 'foolscap, typed with five carbons',
    copies: [{ colour: '#fbf8ef' }, { colour: '#f3d9d9' }, { colour: '#d9e2ef' }, { colour: '#f1e9b8' }, { colour: '#d8e8d0' }, { colour: '#eadcc0' }],
    note: 'Elbourne 1914: the customer\'s order is typed as an Office Order "so that six copies may be obtained at one typing": Invoice Clerk, Estimator and Works Accountant, Works Manager, Drawing Office, Works Office, Warehouse.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="typed num">${l.qty}</td><td class="typed">${esc(describe(l))}</td><td class="typed">${esc(MODELS[l.model].no)}</td><td class="typed num">${esc(fmt(l.list))}</td></tr>`).join('');
      const nos = doc.frameNos ? `<div class="row"><span>Frame Nos. ${hand(doc.frameNos.join(', '))}</span></div>${doc.outstanding?.length ? `<div class="row"><span>${hand(`Balance to follow: ${doc.outstanding.map((l) => `${l.qty} ${describe(l)}`).join('; ')}`)}</span></div>` : ''}` : '';
      return `
        <div class="fax sheet" style="background:${doc.colour}">
          <div class="row"><span class="firm">${FIRM}</span><span class="big">No. ${typed(f.no)}</span></div>
          <div class="title">OFFICE ORDER</div>
          <div class="row"><span>Date ${typed(cal.docDate(f.date))}</span><span>Customer's letter No. ${typed(f.letterNo)}</span></div>
          <div class="row"><span>Customer ${typed(f.agentName)}</span></div>
          <div class="row"><span>Address ${typed(f.address)}</span></div>
          <div class="row"><span>Deliver per L. &amp; N.W.R. goods to ${typed(f.station)}</span><span>Carriage ${typed(f.carriage)}</span></div>
          <table class="ruled"><tr><th>Qty.</th><th>Description</th><th>Model No.</th><th>List price each</th></tr>${rows}</table>
          <div class="row"><span>Terms: list less ${typed(`${Math.round(f.discount * 100)}%`)}, monthly account, 2½% for settlement by the 10th.</span></div>
          ${f.instructions ? `<div class="row"><span>Instructions ${typed(f.instructions)}</span></div>` : ''}
          ${nos}
          <div class="copy-name">${ORDER_COPY_NAMES[doc.copy] || ''} COPY</div>
        </div>`;
    },
  },

  postcard: {
    title: 'Acknowledgement Postcard', size: 'postcard, 5½ × 3½ in.', stock: 'card', colour: '#f3ead2',
    note: 'Spencer 1907: orders are acknowledged on the day they arrive, usually by a printed postcard. The inland postcard rate was ½d.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      return `
        <div class="fax card postcard">
          <div class="row"><span class="firm">${FIRM_SHORT}, Sherbourne Works, Coventry</span><span class="halfd">½d.</span></div>
          <div class="row"><span>${hand(cal.docDate(f.date))}</span></div>
          <p>Messrs. ${hand(f.to)}</p>
          <p>Dear Sirs,<br>We beg to acknowledge with thanks the receipt of your order of the ${hand(ofMonth(cal, f.theirDate, f.date))}, which shall have our best attention. Our reference is ${hand(f.orderNo)}, which kindly quote in any correspondence.</p>
          <div class="row"><span></span><span>Yours faithfully,<br>${FIRM_SHORT}</span></div>
        </div>`;
    },
  },

  invoice: {
    title: 'Invoice', size: 'quarto, typed with a carbon',
    copies: [{ colour: '#fbf8ef' }, { colour: '#e9dfc6' }],
    note: 'Elbourne 1914: "the quickest way is to make the invoice out in blank as a carbon copy of the advice"; the carbon goes to the sales ledger clerk to be posted.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="typed num">${l.qty}</td><td class="typed">${esc(describe(l))}</td><td class="typed num">${esc(fmt(l.list))}</td>${lsdCells(l.gross, 'typed')}</tr>`).join('');
      return `
        <div class="fax sheet invoice" style="background:${doc.colour}">
          <div class="row"><span>Telegrams: "Sherbourne, Coventry."</span><span>Telephone: No. 412.</span></div>
          <div class="row"><span>Coventry, ${typed(cal.docDate(f.date))}</span><span class="big">No. ${typed(f.no)}</span></div>
          <div class="row"><span>Messrs. ${typed(f.agentName)}, ${typed(f.address)}</span></div>
          <div class="title small-caps">Bought of</div>
          <div class="title">${FIRM}</div>
          <div class="row small"><span>Manufacturers of the "Sherbourne" Cycles</span><span>Terms: Monthly, less 2½%</span></div>
          <table class="ruled money"><tr><th>Qty.</th><th>Description</th><th>Each</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            <tr><td></td><td>Less trade discount ${typed(`${Math.round(f.discountRate * 100)}%`)}</td><td></td>${lsdCells(f.discount, 'typed')}</tr>
            <tr class="total"><td></td><td><b>Total</b></td><td></td>${lsdCells(f.total, 'typed')}</tr>
          </table>
          <div class="row"><span>Your order ${typed(f.orderNo)}. Per L. &amp; N.W.R. to ${typed(f.station)}, consignment No. ${typed(f.consignmentNo)}, carriage ${typed(f.carriage)}.</span></div>
          <div class="small">Goods are carefully packed and delivered to the railway in good condition; any damage in transit must be reported to the railway company at once.</div>
          ${doc.copy === 1 ? '<div class="copy-name">COPY: SALES LEDGER</div>' : ''}
          ${doc.marks.some((m) => m.mark === 'posted') ? '<div class="stamp">POSTED</div>' : ''}
        </div>`;
    },
  },

  statement: {
    title: 'Statement', size: 'quarto, written by hand',
    colour: '#fbf8ef',
    note: 'Spencer 1907: a statement of account goes to every customer at the beginning of the month, "a silent demand for payment".',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="hand">${esc(cal.shortDate(l.t))}</td><td class="hand">${esc(l.narrative)}</td>${l.debit ? lsdCells(l.debit) : '<td></td><td></td><td></td>'}${l.credit ? lsdCells(l.credit) : '<td></td><td></td><td></td>'}</tr>`).join('');
      return `
        <div class="fax sheet wide">
          <div class="row"><span class="firm">${FIRM}</span><span>Sherbourne Works, Coventry</span></div>
          <div class="title">STATEMENT</div>
          <div class="row"><span>Messrs. ${hand(f.agentName)}, ${hand(f.address)}</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="row"><span>Dr. to ${FIRM_SHORT}</span><span>Terms: Monthly, less 2½% if paid by the 10th.</span></div>
          <table class="ruled money"><tr><th>Date</th><th>Particulars</th><th>£</th><th>s.</th><th>d.</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            <tr class="total"><td></td><td><b>Balance due</b></td>${lsdCells(f.balance)}<td></td><td></td><td></td></tr>
          </table>
        </div>`;
    },
  },

  receipt: {
    title: 'Receipt', size: 'from the receipt book, with counterfoil', stock: 'slip', colour: '#fbf8ef',
    note: 'Stamp Act 1891: a receipt for £2 or more needs a penny stamp, cancelled with the date and initials.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      return `
        <div class="fax slip receipt">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="title">RECEIVED</div>
          <p>from Messrs. ${hand(f.to)} the sum of ${hand(ctx.words(f.amount))}${f.discount ? `, with discount ${hand(fmt(f.discount))}` : ''}, with thanks.</p>
          <div class="row"><span class="amount">${hand(fmt(f.amount))}</span>${f.stamp ? `<span class="rstamp">ONE<br>PENNY<br><span class="hand">${esc(cal.shortDate(f.date))}</span></span>` : ''}<span>For ${FIRM_SHORT}<br>${hand(f.cashier || '')}</span></div>
        </div>`;
    },
  },

  'paying-in-slip': {
    title: 'Paying-in Slip', size: 'bank paying-in book, with counterfoil', stock: 'slip', colour: '#eaf0e4',
    note: "The bank's cashier initials and stamps the counterfoil, which comes back to the Cashier as his receipt.",
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.items.map((i) => `<tr><td class="hand">${esc(i.from)}</td><td class="hand">${esc(i.bank)}</td>${lsdCells(i.amount)}</tr>`).join('');
      const stamped = doc.marks.some((m) => m.mark === 'received');
      return `
        <div class="fax sheet" style="background:${this.colour}">
          <div class="bank">LLOYDS BANK LIMITED</div>
          <div class="row"><span>Coventry Branch</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="row"><span>Paid in to the credit of ${hand(FIRM_SHORT)}</span></div>
          <table class="ruled money"><tr><th>Cheques: drawer</th><th>On</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            <tr class="total"><td>Total</td><td></td>${lsdCells(f.total)}</tr></table>
          ${stamped ? `<div class="stamp">LLOYDS BANK LTD.<br>${esc(stampDate(cal, f.date))}<br>COVENTRY</div>` : ''}
        </div>`;
    },
  },

  'packing-slip': {
    title: 'Packing Slip', size: '6½ × 8 in., in triplicate',
    copies: [{ colour: '#fbf8ef' }, { colour: '#f3d9d9' }, { colour: '#d9e2ef' }],
    note: 'Elbourne 1914, Form 5-112: "in triplicate, one remaining in Warehouse for reference, one going with package and one passing to General Office for invoicing purposes."',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="hand num">${l.qty}</td><td class="hand">${esc(describe(l))}</td></tr>`).join('');
      return `
        <div class="fax slip" style="background:${doc.colour}; width: 420px">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="title">PACKING SLIP</div>
          <div class="row"><span>To ${hand(f.agentName)}</span><span>Order ${hand(f.orderNo)}</span></div>
          <table class="ruled"><tr><th>Qty.</th><th>Description</th></tr>${rows}</table>
          <div class="row"><span>Frame Nos. ${hand((f.frameNos || []).join(', '))}</span></div>
          <div class="row"><span>Packed by ${hand(f.packer || '')}</span><span>${hand(`${f.crates} crate${f.crates > 1 ? 's' : ''}`)}</span></div>
          <div class="small">The above goods should be examined before being signed for. If this is not possible, sign for as "Unexamined."</div>
          <div class="copy-name">${SLIP_COPY_NAMES[doc.copy] || ''}</div>
        </div>`;
    },
  },

  'advice-of-despatch': {
    title: 'Advice of Despatch', size: '6½ × 8 in., in triplicate',
    copies: [{ colour: '#fbf8ef' }, { colour: '#f3d9d9' }, { colour: '#d9e2ef' }],
    note: 'Elbourne 1914, Form 5-113: the customer\'s copy "should go by post"; one remains in the Warehouse, "signed by Carrier as acknowledgment of receipt"; the other goes to the General Office "for completing the invoice". "A separate advice should be used for each Sales Order."',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="hand num">${l.qty}</td><td class="hand">${esc(describe(l))}</td></tr>`).join('');
      const signed = doc.marks.find((m) => m.mark === 'signed');
      return `
        <div class="fax sheet" style="background:${doc.colour}">
          <div class="row"><span class="firm">${FIRM}</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="title">ADVICE OF DESPATCH</div>
          <div class="row"><span>Messrs. ${hand(f.agentName)}, ${hand(f.address)}</span></div>
          <p>We have this day forwarded to you per L. &amp; N.W.R. goods train to ${hand(f.station)}, carriage ${hand(f.carriage)}, ${hand(`${f.crates} crate${f.crates > 1 ? 's' : ''}`)} containing:</p>
          <table class="ruled"><tr><th>Qty.</th><th>Description</th></tr>${rows}</table>
          <div class="row"><span>Frame Nos. ${hand((f.frameNos || []).join(', '))}</span><span>Gross weight ${hand(weight(f.weight || 0))}</span></div>
          <div class="row"><span>Marks ${hand(f.marks || '')}</span><span>As per packing slip</span></div>
          ${f.balance ? `<div class="row"><span>${hand(`Balance of order (${f.balance}) to follow.`)}</span></div>` : ''}
          <div class="row"><span>Our order ${hand(f.orderNo)}</span><span>Consignment note ${hand(f.consignmentNo)}</span></div>
          ${doc.copy === 2 ? `<div class="row foot"><span>Received the above in apparent good order: ${signed ? `<span class="hand initials">${esc(f.checker || 'W. Hollis')}</span> <span class="small">for L. &amp; N.W.R., Warwick Road</span>` : '____________________'}</span></div>` : ''}
          <div class="copy-name">${ADVICE_COPY_NAMES[doc.copy] || ''}</div>
        </div>`;
    },
  },

  'consignment-note': {
    title: 'Consignment Note', size: "the railway company's printed form",
    colour: '#f7f1dc',
    note: 'West 1912: every consignment is handed in with a consignment note, signed by the sender, stating whether carriage is paid or to pay, and at whose risk. Cycles went cheaper at owner\'s risk.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const signed = doc.marks.some((m) => m.mark === 'signed');
      return `
        <div class="fax sheet" style="background:${this.colour}">
          <div class="title small-caps">London and North Western Railway</div>
          <div class="title">CONSIGNMENT NOTE</div>
          <div class="row"><span>Coventry (Warwick Road) Goods Station</span><span>No. ${hand(f.no)}</span></div>
          <p class="small">To the London and North Western Railway Company. Receive and forward the undermentioned goods, subject to the Company's conditions of carriage.</p>
          <table class="ruled">
            <tr><th>Consignee</th><th>Destination</th><th>No. and description of packages</th><th>Weight</th><th>Paid / To pay</th></tr>
            <tr><td class="hand">${esc(f.consignee)}, ${esc(f.address)}</td><td class="hand">${esc(f.station)}</td><td class="hand">${esc(f.description)}</td><td class="hand">${esc(weight(f.weight))}</td><td class="hand">${esc(f.carriage)}</td></tr>
          </table>
          <div class="row"><span>At ${hand(f.risk)}</span><span>Date ${hand(cal.docDate(f.date))}</span></div>
          <div class="row foot"><span>Signature of sender ${hand('for ' + FIRM_SHORT)}</span></div>
          ${signed ? `<div class="stamp">L. &amp; N.W.R.<br>RECEIVED<br>${esc(stampDate(cal, doc.marks.find((m) => m.mark === 'signed').t))}</div>` : ''}
        </div>`;
    },
  },

  // Pages of the books, made up when looked at.
  'book-page': {
    title: 'Book', size: 'bound book',
    note: 'The registers and day books of the office, each ruled for its own columns.',
    render(doc, ctx) {
      const b = doc.fields.book;
      const cols = b.columns;
      const PAGE = 16;
      const back = doc.fields.offset || 0;
      const end = Math.max(0, b.entries.length - back);
      const entries = b.entries.slice(Math.max(0, end - PAGE), end);
      const cell = (c, e) => {
        const v = c.f(e, ctx);
        return c.money ? lsdCells(v || 0) : `<td class="hand${c.num ? ' num' : ''}">${esc(v ?? '')}</td>`;
      };
      const head = cols.map((c) => (c.money ? `<th colspan="3">${esc(c.h)}</th>` : `<th>${esc(c.h)}</th>`)).join('');
      const rows = entries.map((e) => `<tr>${cols.map((c) => cell(c, e)).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length + 2 * cols.filter((c) => c.money).length}" class="hand">Nothing entered yet.</td></tr>`;
      return `
        <div class="fax sheet wide book">
          <div class="title">${esc(b.title.toUpperCase())}</div>
          <div class="row small"><span>${b.entries.length} entr${b.entries.length === 1 ? 'y' : 'ies'}${entries.length ? `; entries ${end - entries.length + 1}–${end} shown` : ''}</span></div>
          <table class="ruled money"><tr>${head}</tr>${rows}</table>
        </div>`;
    },
  },

  'ledger-account': {
    title: 'Ledger Account', size: 'a page of the ledger',
    note: 'Each customer has a page in the Sales Ledger and each supplier one in the Bought Ledger: debits on the left, credits on the right. The balances of each must add up to its control account in the General Ledger, Sundry Debtors or Sundry Creditors.',
    render(doc, ctx) {
      const a = doc.fields.account;
      const { cal } = ctx;
      const lines = a.lines.slice(-14);
      const dr = lines.filter((l) => l.debit);
      const cr = lines.filter((l) => l.credit);
      const n = Math.max(dr.length, cr.length, 1);
      let rows = '';
      for (let i = 0; i < n; i++) {
        const l = dr[i];
        const r = cr[i];
        rows += `<tr>${l ? `<td class="hand">${esc(cal.shortDate(l.t))}</td><td class="hand">${esc(l.narrative)}</td>${lsdCells(l.debit)}` : '<td></td><td></td><td></td><td></td><td></td>'}${r ? `<td class="hand">${esc(cal.shortDate(r.t))}</td><td class="hand">${esc(r.narrative)}</td>${lsdCells(r.credit)}` : '<td></td><td></td><td></td><td></td><td></td>'}</tr>`;
      }
      const bal = a.debit - a.credit;
      return `
        <div class="fax sheet wide book">
          <div class="row"><span class="big">${esc(a.name)}</span><span>${esc(a.meta?.address || '')}</span></div>
          ${a.meta?.discount ? `<div class="row small"><span>${esc(a.meta.trade || '')}; terms list less ${Math.round(a.meta.discount * 100)}%</span></div>` : ''}
          <table class="ruled money ledger"><tr><th colspan="5">Dr.</th><th colspan="5">Cr.</th></tr>
            <tr><th>Date</th><th>Particulars</th><th>£</th><th>s.</th><th>d.</th><th>Date</th><th>Particulars</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}</table>
          <div class="row foot"><span>Balance ${hand(bal === 0 ? 'Nil' : bal > 0 ? `${fmt(bal)} Dr.` : `${fmt(-bal)} Cr.`)}</span></div>
        </div>`;
    },
  },

  'trial-balance': {
    title: 'Trial Balance', size: 'foolscap',
    note: 'Every debit has its credit, so the two columns must agree. The personal accounts are represented by their control account.',
    render(doc) {
      const tb = doc.fields.tb;
      const rows = tb.rows.map((r) => `<tr><td>${esc(r.name)}</td>${r.debit ? lsdCells(r.debit) : '<td></td><td></td><td></td>'}${r.credit ? lsdCells(r.credit) : '<td></td><td></td><td></td>'}</tr>`).join('');
      return `
        <div class="fax sheet wide">
          <div class="row"><span class="firm">${FIRM}</span><span>${hand(doc.fields.when)}</span></div>
          <div class="title">TRIAL BALANCE</div>
          <table class="ruled money"><tr><th>Account</th><th colspan="3">Dr.</th><th colspan="3">Cr.</th></tr>${rows}
          <tr class="total"><td>Totals</td>${lsdCells(tb.debit)}${lsdCells(tb.credit)}</tr></table>
          <div class="row foot"><span>${tb.balanced ? 'Agreed.' : '<span class="red">Does not agree.</span>'} Sales Ledger balances ${hand(short(doc.fields.personal, { pounds: true }))}; Sundry Debtors ${hand(short(doc.fields.control, { pounds: true }))}.</span></div>
        </div>`;
    },
  },
};
