// The paper of buying in: stock control cards, purchase requisitions and
// orders, suppliers' advices and invoices, railway delivery sheets, goods
// received notes, statements, the list of payments, and the combined cheque
// and receipt.
//
// Fields and wording follow Elbourne's specimen forms (1914): Form 5-54, the
// Purchase Requisition; 5-15, the Purchase Order; 5-82, the Goods Received
// Note; 5-89, the Stock Control Card; 6-4, the Combined Cheque and Receipt.
// The ruling is reconstructed; suppliers' own papers are invented.
import { fmt } from '../../engine/sim/money.js';
import { FIRM, FIRM_SHORT, esc, hand, typed, lsdCells } from './formkit.js';
import { quantity } from './purchasing.js';

const qty = (n) => Number(n).toLocaleString('en-GB');
// A line's quantity in its trade unit ("270 gross", "550 sets", "275").
const amountOf = (l) => quantity(l.qty, l.unit, l.per || 1);
const priceOf = (l) => `${fmt(l.price)}${l.per > 1 ? ` per ${l.per === 144 ? 'gross' : l.unit === 'ton' ? 'ton' : l.per}` : l.unit === 'each' ? ' each' : ` per ${l.unit}`}`;
// What came: so many packages, or for loose goods (coal) the weight.
const packed = (f) => (f.packages ? `${f.packages} package${f.packages > 1 ? 's' : ''}` : f.lines.map(amountOf).join(', '));
const supplierHead = (f) => `<div class="letterhead"><div class="lh-name">${esc(f.supplierName || f.fromName)}</div><div class="lh-addr">${esc(f.address)}</div></div>`;
const blank = '<td></td><td></td><td></td>';

export const PURCHASING_FORMS = {
  'stock-card': {
    title: 'Stock Control Card', size: '8½ × 11 in., Form 5-89', colour: '#f6efd9',
    note: 'Elbourne 1914: kept "in quantity only" at the Stores, with an ordering level "rather than to fix the maximum and minimum quantities", and "the normal quantity to be ordered".',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.slice(-16).map((l) => `<tr><td class="hand">${esc(cal.shortDate(l.t))}</td><td class="hand">${esc(l.ref)}</td>
        <td class="hand num">${l.requisitioned ? qty(l.requisitioned) : ''}</td><td class="hand num">${l.ordered ? qty(l.ordered) : ''}</td>
        <td class="hand num">${l.received ? qty(l.received) : ''}</td><td class="hand num">${l.issued ? qty(l.issued) : ''}</td>
        <td class="hand num">${qty(l.balance)}</td></tr>`).join('');
      return `
        <div class="fax sheet" style="background:${this.colour}; width: 560px">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span>Rough Stores, bin ${hand(f.bin)}</span></div>
          <div class="title">STOCK CONTROL CARD</div>
          <div class="row"><span>Description ${hand(f.desc)}</span><span>Unit ${hand(f.unit)}</span></div>
          <div class="row"><span>Ordering level ${hand(qty(f.level))}</span><span>Normal quantity to be ordered ${hand(qty(f.normal))}</span></div>
          <table class="ruled"><tr><th>Date</th><th>Ref.</th><th>Requisitioned</th><th>Ordered</th><th>Received</th><th>Issued</th><th>Balance</th></tr>${rows}</table>
        </div>`;
    },
  },

  'purchase-requisition': {
    title: 'Purchase Requisition', size: '6½ × 8 in., Form 5-54, in carbon triplicate',
    copies: [{ colour: '#fbf8ef' }, { colour: '#f3d9d9' }, { colour: '#f1e9b8' }],
    note: 'Elbourne 1914: "after approval by the Works Manager, the top copy is sent to the Buyer and the second copy to the General Stores." Spencer 1907: the works manager must "O.K. and initial each item".',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const approved = doc.marks.some((m) => m.mark === 'approved');
      return `
        <div class="fax slip" style="background:${doc.colour}; width: 440px">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span class="big">No. ${hand(f.no)}</span></div>
          <div class="title">PURCHASE REQUISITION</div>
          <div class="row"><span>Date ${hand(cal.docDate(f.date))}</span><span>Purpose ${hand(f.purpose)}</span></div>
          <table class="ruled"><tr><th>Quantity</th><th>Description</th></tr><tr><td class="hand num">${hand(amountOf(f))}</td><td class="hand">${esc(f.desc)}</td></tr></table>
          <div class="row small"><span>In stock ${hand(quantity(f.stock, f.unit, f.per || 1))}; ordering level ${hand(quantity(f.level, f.unit, f.per || 1))}</span></div>
          <div class="row"><span>Delivery required ${hand(f.delivery)}</span></div>
          <div class="row"><span>Supplier ${f.supplier ? hand(f.supplier) : '__________'}</span><span>Purchase Order No. ${f.poNo ? hand(f.poNo) : '______'}</span></div>
          <div class="row foot"><span>Certified ${hand(f.storekeeper)}</span><span>Approved ${approved ? `<span class="hand initials">${esc((f.approvedBy || '').split(' ').map((w) => `${w[0]}.`).join(''))}</span> O.K.` : '______'}</span></div>
        </div>`;
    },
  },

  'purchase-order': {
    title: 'Purchase Order', size: '6½ × 8 in., Form 5-15, typed in triplicate',
    copies: [{ colour: '#fbf8ef' }, { colour: '#d9e2ef' }, { colour: '#eadcc0' }],
    note: 'Elbourne 1914: "in triplicate, the second copy remaining with the Buyer and the third copy going to the Receiving Clerk, without prices." Orders over £50 may need the Managing Director\'s signature.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const priced = doc.copy !== 2;
      const rows = f.lines.map((l) => `<tr><td class="typed num">${esc(amountOf(l))}</td><td class="typed">${esc(l.desc)}</td>${priced ? `<td class="typed">${esc(priceOf(l))}</td>${lsdCells(l.amount, 'typed')}` : '<td class="unpriced" colspan="4"></td>'}</tr>`).join('');
      const signed = doc.marks.some((m) => m.mark === 'signed') || doc.siblings?.[0]?.marks.some((m) => m.mark === 'signed');
      return `
        <div class="fax sheet" style="background:${doc.colour}">
          <div class="row"><span class="firm">${FIRM}</span><span class="big">No. ${typed(f.no)}</span></div>
          <div class="row small"><span>Sherbourne Works, Coventry. Telegrams: "Sherbourne, Coventry."</span></div>
          <div class="title">PURCHASE ORDER</div>
          <div class="row"><span>To ${typed(f.supplierName)}, ${typed(f.address)}</span><span>${typed(cal.docDate(f.date))}</span></div>
          <p>Please supply the following:</p>
          <table class="ruled money"><tr><th>Quantity</th><th>Description</th>${priced ? '<th>Price</th><th>£</th><th>s.</th><th>d.</th>' : '<th colspan="4">Prices</th>'}</tr>${rows}
            ${priced ? `<tr class="total"><td></td><td>Total</td><td></td>${lsdCells(f.value, 'typed')}</tr>` : ''}</table>
          <div class="row"><span>Delivery ${typed(f.delivery)}</span><span>Requisition ${typed((f.prs || []).join(', '))}</span></div>
          <div class="small">It is important to us that this Order No. be marked on the packages and quoted on Advice of Despatch and Invoice. We rely on your sending us by post an Advice of Despatch the same day as goods are sent. Usual Terms: Monthly, less 2½%. Our pay day is the third Wednesday in the month.</div>
          <div class="row foot"><span>For ${FIRM_SHORT}</span><span>${signed && f.signedBy ? hand(f.signedBy) : '______________'}</span></div>
          <div class="copy-name">${['SUPPLIER', 'BUYER’S COPY', 'RECEIVING CLERK’S COPY: WITHOUT PRICES'][doc.copy] || ''}</div>
          ${doc.marks.some((m) => m.mark === 'received') ? '<div class="stamp">RECEIVED</div>' : ''}
        </div>`;
    },
  },

  'advice-note': {
    title: 'Supplier’s Advice of Despatch', size: 'supplier’s own form', colour: '#fdfbf4',
    note: 'Elbourne 1914: suppliers are asked to post an advice of despatch the same day as the goods go, and to send it separately from the invoice, so the Stores know what to expect.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="hand num">${esc(amountOf(l))}</td><td class="hand">${esc(l.desc)}</td></tr>`).join('');
      return `
        <div class="fax sheet letter">
          ${supplierHead(f)}
          <div class="title">ADVICE OF DESPATCH</div>
          <div class="row"><span>To ${FIRM_SHORT}, Coventry</span><span>${hand(cal.docDate(f.date))}</span></div>
          <p>We have this day forwarded ${f.carrier === 'own cart' ? 'by our own cart' : f.carrier === 'parcel post' ? 'by parcel post' : f.carrier === 'canal' ? 'by boat' : `per ${esc(f.carrier)} goods train`} ${hand(packed(f))}${f.packages ? ` marked ${hand(f.marks)}` : ''}, against your order ${hand(f.poNo)}:</p>
          <table class="ruled"><tr><th>Quantity</th><th>Description</th></tr>${rows}</table>
          <div class="small">Invoice follows by post.</div>
          ${doc.marks.some((m) => m.mark === 'received') ? `<div class="stamp recd">RECEIVED<br>No. ${esc(doc.no)}</div>` : ''}
        </div>`;
    },
  },

  'supplier-invoice': {
    title: 'Supplier’s Invoice', size: 'supplier’s billhead', colour: '#fdfbf4',
    note: 'Elbourne 1914: "Suppliers\' invoices shall not be sent beyond the Works Accounts Office, however trustworthy the Stores Staff may be." There the invoice is matched with the goods received note, checked, passed and numbered.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="hand num">${esc(amountOf(l))}</td><td class="hand">${esc(l.desc)}</td><td class="hand">${esc(priceOf(l))}</td>${lsdCells(l.amount)}</tr>`).join('');
      const passed = doc.marks.some((m) => m.mark === 'passed');
      return `
        <div class="fax sheet invoice">
          ${supplierHead(f)}
          <div class="row"><span>${hand(cal.docDate(f.date))}</span><span class="big">Invoice No. ${hand(f.no)}</span></div>
          <div class="row"><span>${FIRM_SHORT}, Sherbourne Works, Coventry</span><span>Your order ${hand(f.poNo)}</span></div>
          <div class="title small-caps">Dr. to ${esc(f.supplierName)}</div>
          <table class="ruled money"><tr><th>Quantity</th><th>Description</th><th>Price</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            <tr class="total"><td></td><td>Total</td><td></td>${lsdCells(f.total)}</tr></table>
          <div class="row small"><span>Terms: ${esc(f.terms)}</span><span>Per ${esc(f.carrier)}</span></div>
          ${passed ? `<div class="stamp">PASSED ${esc(f.passedNo)}<br>G.R. ${esc((f.grNos || []).map((g) => g.replace('G.R. ', '')).join(', '))} · prices and extensions checked</div>` : ''}
          ${doc.marks.some((m) => m.mark === 'posted') ? '<div class="stamp">POSTED</div>' : ''}
        </div>`;
    },
  },

  'delivery-sheet': {
    title: 'Delivery Sheet', size: 'the carrier’s form', colour: '#efe6cc',
    note: 'West 1912: inward goods are entered on delivery sheets for the carmen, who get each consignee\'s signature. A supplier\'s own carman brings a delivery note to be signed in the same way.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const signed = doc.marks.some((m) => m.mark === 'signed');
      const ours = f.lines.map((l) => `<tr><td class="hand">${esc(l.consignee)}</td><td class="hand">${esc(l.from)}</td><td class="hand">${esc(l.marks)}</td><td class="hand num">${l.packages}</td><td>${signed ? `<span class="hand">${esc(f.signedBy)}</span>` : ''}</td></tr>`).join('');
      const others = (f.others || []).map((l) => `<tr><td class="hand">${esc(l.consignee)}</td><td></td><td></td><td class="hand num">${l.packages}</td><td></td></tr>`).join('');
      return `
        <div class="fax sheet wide" style="background:${this.colour}">
          ${f.railway ? `<div class="title small-caps">${esc(f.carrier === 'L. & N.W.R.' ? 'London and North Western Railway' : 'Midland Railway')}</div><div class="title">DELIVERY SHEET</div><div class="row"><span>Coventry (Warwick Road) Goods Station</span><span>No. ${hand(f.no)}</span></div>` : `<div class="title small-caps">${esc(f.carrier)}</div><div class="title">DELIVERY NOTE</div>`}
          <div class="row"><span>Date ${hand(cal.docDate(f.date))}</span></div>
          <table class="ruled"><tr><th>Consignee</th><th>From</th><th>Marks</th><th>Packages</th><th>Received by</th></tr>${ours}${others}</table>
          <div class="small">Received the above in apparent good order and condition.</div>
        </div>`;
    },
  },

  'goods-received-note': {
    title: 'Goods Received Note', size: '6½ × 8 in., Form 5-82, in carbon duplicate',
    copies: [{ colour: '#fbf8ef' }, { colour: '#dfe6ee' }],
    note: 'Elbourne 1914: "made out by the Receiving Clerk in carbon duplicate, the duplicate being retained in the General Stores." The top copy goes to the Works Accounts Office, "where it will be used to check the invoice, and be completed as to prices."',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const priced = f.priced && doc.copy === 0;
      const rows = f.lines.map((l) => `<tr><td class="hand">${esc(l.desc)}</td><td class="hand num">${esc(amountOf(l))}</td><td class="hand num">${l.rejected || ''}</td>${priced ? `<td class="hand">${esc(priceOf(l))}</td>` : '<td></td>'}</tr>`).join('');
      return `
        <div class="fax slip" style="background:${doc.colour}; width: 480px">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span class="big">${hand(f.no)}</span></div>
          <div class="title">GOODS RECEIVED</div>
          <div class="row"><span>Supplier ${hand(f.supplierName)}</span></div>
          <div class="row"><span>Purchase Order ${hand(f.poNo)}</span><span>Requisition ${hand((f.prNos || []).join(', '))}</span></div>
          <div class="row"><span>Received ${hand(cal.docDate(f.date))}</span><span>Per ${hand(f.per)}</span></div>
          <table class="ruled"><tr><th>Description</th><th>Quan. rec’d</th><th>Rejections</th><th>Price</th></tr>${rows}</table>
          <div class="row"><span>Packages ${hand(f.packages || 'loose')}</span>${priced ? `<span>Inv. No. ${hand(f.invoiceNo)}</span>` : ''}</div>
          <div class="row foot"><span>Certified ${hand(f.certified)}</span><span>Goods inspected by ${hand(f.inspected)}</span></div>
          ${doc.copy === 1 ? '<div class="copy-name">DUPLICATE: RETAINED IN THE STORES</div>' : ''}
        </div>`;
    },
  },

  'supplier-statement': {
    title: 'Supplier’s Statement', size: 'supplier’s own form', colour: '#fdfbf4',
    note: 'Spencer 1907: creditors send monthly statements, which the ledger clerk certifies against the Bought Ledger before the list of payments is made out.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="hand">${esc(cal.shortDate(l.t))}</td><td class="hand">${esc(l.narrative)}</td>${lsdCells(l.amount)}</tr>`).join('');
      return `
        <div class="fax sheet">
          <div class="letterhead"><div class="lh-name">${esc(f.fromName)}</div><div class="lh-addr">${esc(f.address)}</div></div>
          <div class="title">STATEMENT</div>
          <div class="row"><span>${FIRM_SHORT}, Coventry</span><span>${hand(cal.docDate(f.date))}</span></div>
          <table class="ruled money"><tr><th>Date</th><th>Particulars</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            <tr class="total"><td></td><td>Balance due</td>${lsdCells(f.balance)}</tr></table>
          <div class="small">Terms: Monthly, less 2½%.</div>
          ${doc.marks.some((m) => m.mark === 'agreed') ? '<div class="stamp">AGREED WITH LEDGER</div>' : ''}
        </div>`;
    },
  },

  'railway-account': {
    title: 'Railway Monthly Account', size: 'the railway company’s form', colour: '#efe6cc',
    note: 'West 1912: regular traders were debited on ledger accounts for carriage on goods sent "Paid", and settled monthly.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.lines.map((l) => `<tr><td class="hand">${esc(cal.shortDate(l.t))}</td><td class="hand">${esc(l.narrative)}</td>${lsdCells(l.amount)}</tr>`).join('');
      return `
        <div class="fax sheet" style="background:${this.colour}">
          <div class="title small-caps">London and North Western Railway</div>
          <div class="title">ACCOUNT FOR CARRIAGE</div>
          <div class="row"><span>Coventry Goods Station</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="row"><span>${FIRM_SHORT}, Sherbourne Works</span></div>
          <table class="ruled money"><tr><th>Date</th><th>Particulars</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            <tr class="total"><td></td><td>Amount due</td>${lsdCells(f.balance)}</tr></table>
          ${doc.marks.some((m) => m.mark === 'agreed') ? '<div class="stamp">AGREED WITH LEDGER</div>' : ''}
        </div>`;
    },
  },

  'payments-list': {
    title: 'List of Payments', size: 'foolscap', colour: '#fbf8ef',
    note: 'Elbourne 1914: "A list of payments proposed to be made should be submitted by the Bought Ledger Clerk… gross amount… discount taken and the net amount payable… checked by the Accountant with… the Creditors Statements." Spencer: for "the sanction of the directors".',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.rows.map((r) => `<tr><td class="hand">${esc(r.name)}</td>${lsdCells(r.gross)}${r.discount ? lsdCells(r.discount) : blank}${lsdCells(r.net)}</tr>`).join('');
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `
        <div class="fax sheet wide">
          <div class="row"><span class="firm">${FIRM}</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="title">LIST OF PAYMENTS</div>
          <div class="row"><span>For deliveries in ${hand(months[f.month - 1])}, to be paid on ${hand(cal.docDate(f.payDay))}</span></div>
          <table class="ruled money"><tr><th rowspan="2">Creditor</th><th colspan="3">Statement</th><th colspan="3">Discount</th><th colspan="3">Cheque</th></tr>
            <tr><th>£</th><th>s.</th><th>d.</th><th>£</th><th>s.</th><th>d.</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            <tr class="total"><td>Totals</td><td></td><td></td><td></td>${lsdCells(f.discount)}${lsdCells(f.total)}</tr></table>
          <div class="row foot"><span>Checked ${doc.marks.some((m) => m.mark === 'checked') ? hand('with the statements') : '______'}</span><span>Sanctioned ${doc.marks.some((m) => m.mark === 'sanctioned') ? '<span class="hand initials">C.H.</span>' : '______'}</span></div>
        </div>`;
    },
  },

  'cheque-receipt': {
    title: 'Combined Cheque and Receipt', size: 'Form 6-4', colour: '#eaf0e4',
    note: 'Elbourne 1914: the combined cheque and receipt form is "now used by a large number of trading firms"; the creditor signs the receipt, over a penny stamp if it is for £2 or more, and returns it.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const signed = doc.marks.some((m) => m.mark === 'signed');
      const receipted = doc.marks.some((m) => m.mark === 'receipted');
      return `
        <div class="fax cheque">
          <div class="row"><span>Coventry, ${hand(cal.docDate(f.date))}</span><span class="duty">STAMP DUTY<br>ONE PENNY</span></div>
          <div class="bank">LLOYDS BANK LIMITED</div>
          <div class="row payline"><span>Pay ${hand(f.payee)} or Order</span></div>
          <div class="row payline"><span>${hand(ctx.words(f.amount))}</span></div>
          <div class="row"><span class="amount">${hand(fmt(f.amount))}</span><span class="sig">${signed ? f.signatories.map((s) => hand(s)).join('<br>') : '<br>'}<br><span class="small">for ${FIRM_SHORT}</span></span></div>
          <div class="receipt-part">
            <div class="row"><span><b>RECEIPT.</b> Received from ${FIRM_SHORT} the sum of ${hand(fmt(f.amount))}${f.discount ? `, discount ${hand(fmt(f.discount))}` : ''}, in settlement of account.</span></div>
            <div class="row"><span>${receipted ? hand(`for ${f.payee}`) : 'Signature ______________'}</span>${f.stamp ? `<span class="rstamp">${receipted ? `ONE<br>PENNY<br><span class="hand">${esc(cal.shortDate(f.date))}</span>` : '1d.<br>stamp<br>here'}</span>` : ''}</div>
            <div class="small">This receipt is to be signed and returned. The cheque will not be honoured if the receipt is detached unsigned.</div>
          </div>
        </div>`;
    },
  },
};

PURCHASING_FORMS['coal-ticket'] = {
  title: 'Colliery Weight Ticket', size: 'the colliery\u2019s ticket', colour: '#e9e2cf',
  note: 'The colliery weighs each boat-load and sends a ticket with the boatman; the receiving clerk signs for it at the wharf and it goes with the goods received note (est.: no specimen found).',
  render(doc, ctx) {
    const f = doc.fields;
    const { cal } = ctx;
    const tons = Math.floor(f.cwt / 20);
    const cwt = f.cwt - tons * 20;
    return `
      <div class="fax slip" style="background:${this.colour}; width: 400px">
        <div class="row"><span class="firm">${esc(f.colliery)}</span><span>No. ${hand(f.no)}</span></div>
        <div class="title">WEIGHT TICKET</div>
        <div class="row"><span>Boat ${hand(`\u201c${f.boat}\u201d`)}</span><span>Steerer ${hand(f.captain)}</span></div>
        <div class="row"><span>Boiler slack, ${hand(`${tons} tons ${cwt} cwt.`)}</span></div>
        <div class="row"><span>To ${FIRM_SHORT}, Foleshill, by the Coventry Canal</span></div>
        <div class="row"><span>Your order ${hand(f.poNo)}</span><span>${hand(cal.docDate(f.date))}</span></div>
        <div class="row foot"><span>Received ${f.signedBy ? hand(f.signedBy) : '______________'}</span></div>
      </div>`;
  },
};

export const PURCHASING_SUMMARIES = {
  'coal-ticket': (f) => `\u201c${f.boat}\u201d: ${f.cwt / 20} tons of slack for ${f.poNo}`,
  'stock-card': (f) => `${f.desc}: ${quantity(f.lines.at(-1)?.balance ?? 0, f.unit, f.per || 1)} in stock`,
  'purchase-requisition': (f) => `${f.no} ${quantity(f.qty, f.unit, f.per || 1)} of ${f.desc.toLowerCase()}`,
  'purchase-order': (f) => `${f.no} ${f.supplierName}: ${fmt(f.value)}`,
  'advice-note': (f) => `${f.supplierName}: ${packed(f)} for ${f.poNo}`,
  'supplier-invoice': (f) => `${f.supplierName} No. ${f.no}: ${fmt(f.total)}${f.passedNo ? `, ${f.passedNo}` : ''}`,
  'delivery-sheet': (f) => `${f.railway ? `${f.carrier} No. ${f.no}` : f.carrier}: ${f.lines.map((l) => l.po).join(', ')}`,
  'goods-received-note': (f) => `${f.no} ${f.supplierName}, ${f.poNo}`,
  'supplier-statement': (f) => `${f.fromName}: ${fmt(f.balance)}`,
  'railway-account': (f) => `${f.fromName}: ${fmt(f.balance)}`,
  'payments-list': (f, { cal }) => `${f.rows.length} accounts, ${fmt(f.total)}, pay day ${cal.shortDate(f.payDay)}`,
  'cheque-receipt': (f) => `${f.payee}: ${fmt(f.amount)}`,
};
