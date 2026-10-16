// The paper of the cost accounts and the month's end: the Estimator's
// sheets, coupons cut from the work tallies, cost cards, the weekly wages
// allocation, the fortnight's shop charges, the Delivered Orders Cost
// Abstract, the monthly salaries list and the monthly statement.
//
// After Elbourne (1914): Form 5-9, the Estimate Detail Sheet; 5-131, the Cost
// Allocation Card; 5-138, the Delivered Orders Cost Abstract. The ruling is
// reconstructed.
import { fmt } from '../../engine/sim/money.js';
import { FIRM, FIRM_SHORT, esc, hand, lsdCells } from './formkit.js';
import { quantity } from './purchasing.js';

// "75%", "7½%".
const pct = (r) => {
  const h = Math.round(r * 200) / 2;
  return `${Math.floor(h)}${h % 1 ? '½' : ''}%`;
};
const money = (v) => lsdCells(Math.round(v));
const blank = '<td></td><td></td><td></td>';
// One cell with the amount written out, for the wide rulings.
const amt = (v, cls = '') => `<td class="hand num ${cls}" style="white-space: nowrap">${v ? fmt(Math.round(v)) : ''}</td>`;
// So many of an item: gross where it comes out even, otherwise the count.
const count = (i) => (i.per > 1 && i.qty % i.per ? `${i.qty.toLocaleString('en-GB')}` : quantity(i.qty, i.unit, i.per));

export const ACCOUNTS_FORMS = {
  'estimate-sheet': {
    title: 'Estimate Detail Sheet', size: '8 × 13 in., Form 5-9', colour: '#f7f3e6',
    note: 'Elbourne 1914: columns for material, direct wages and shop charges, which are "applied for estimating purposes as a percentage of Direct Wages". Office oncost is charged on works cost, after Hawkins (1905), whose worked example uses 10%. The figures are the season’s standard, used for machines whose sub-order isn’t yet costed.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const mat = f.lines.map((l) => `<tr><td class="hand">${esc(l.head)}</td>${money(l.material)}</tr>`).join('');
      const wages = f.wages.map(([h, v]) => `<tr><td class="hand">${esc(h)}</td>${money(v)}</tr>`).join('');
      return `
        <div class="fax sheet" style="width: 560px">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="title">ESTIMATE DETAIL SHEET</div>
          <div class="row"><span>Article ${hand(f.name)}</span><span>Per machine</span></div>
          <table class="ruled money"><tr><th>Material</th><th>£</th><th>s.</th><th>d.</th></tr>${mat}
            <tr class="total"><td>Material</td>${money(f.material)}</tr>
            <tr><th>Direct wages</th><th>£</th><th>s.</th><th>d.</th></tr>${wages}
            <tr class="total"><td>Direct wages</td>${money(f.direct)}</tr>
            <tr><td>Shop charges, ${pct(f.rate)} on direct wages</td>${money(f.charges)}</tr>
            <tr class="total"><td>Works cost</td>${money(f.works)}</tr>
            <tr><td>Office oncost, ${pct(f.officeRate)} on works cost</td>${money(f.office)}</tr>
            <tr class="total"><td>Total cost</td>${money(f.total)}</tr>
            <tr><td>List price</td>${money(f.list)}</tr>
            <tr><td>Trade price, list less 25%</td>${money(f.trade)}</tr></table>
          <div class="row foot"><span>${f.trade >= f.total ? 'Margin' : 'Loss'} at trade ${hand(fmt(Math.abs(Math.round(f.trade - f.total))))}</span><span>Estimator ${hand('Works Accountant')}</span></div>
        </div>`;
    },
  },

  'stores-coupon': {
    title: 'Work Tally Coupon', size: 'about 2½ × 3 in., cut from the work tally',
    colour: '#efe3c4',
    note: 'Elbourne 1914: the coupon on the work tally is cut off when the material is drawn, and passes "from the Stores to the Works Accounts Office", where it is priced from the stock rate card and posted to the sub-order’s cost allocation sheet.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.items.map((i) => `<tr><td class="hand num">${esc(count(i))}</td><td class="hand">${esc(i.desc)}</td>${f.priced ? money(i.amount) : blank}</tr>`).join('');
      return `
        <div class="fax slip" style="background:${doc.colour}; width: 400px">
          <div class="row"><span class="firm">COUPON</span><span class="big">${hand(f.subOrder)}</span></div>
          <div class="row small"><span>${esc(f.lot)}</span></div>
          <div class="row"><span>${hand(f.store)}</span><span>${hand(cal.docDate(f.date))}</span></div>
          <table class="ruled money"><tr><th>Quantity</th><th>Material</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            ${f.priced ? `<tr class="total"><td></td><td>Total</td>${money(f.total)}</tr>` : ''}</table>
          <div class="row foot"><span>Issued by ${hand(f.issuedBy)}</span>${f.priced ? `<span>${hand('Priced')}</span>` : ''}</div>
        </div>`;
    },
  },

  'cost-card': {
    title: 'Cost Allocation Card', size: '5 × 8 in., Form 5-131, in the Cost Ledger', colour: '#f2ead2',
    note: 'Elbourne 1914: materials from the coupons and goods issue vouchers, wages from the time allocation, and shop charges are posted fortnightly to each sub-order’s card in the Cost Ledger. Standing orders carry the works’ own time.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const lines = f.lines.slice(-14);
      const rows = lines.map((l) => `<tr><td class="hand">${esc(cal.shortDate(l.t))}</td><td class="hand">${esc(l.ref)}: ${esc(l.text)}</td>
        ${amt(l.materials + l.bf)}${amt(l.wages)}${amt(l.charges)}</tr>`).join('');
      const total = f.bf + f.materials + f.wages + f.charges;
      const standing = f.kind === 'standing';
      return `
        <div class="fax sheet wide" style="background:${doc.colour}">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span class="big">${hand(f.subOrder)}</span></div>
          <div class="title">${standing ? 'STANDING ORDER' : 'COST ALLOCATION CARD'}</div>
          <div class="row"><span>${hand(f.desc)}</span>${standing ? '' : `<span>Opened ${hand(cal.shortDate(f.opened))}</span>`}</div>
          ${f.lines.length > lines.length ? `<div class="row small"><span>${f.lines.length - lines.length} earlier entries on the front of the card</span></div>` : ''}
          <table class="ruled"><tr><th>Date</th><th>Particulars</th><th>Material</th><th>Wages</th><th>Shop charges</th></tr>${rows}
            <tr class="total"><td></td><td>Totals</td>${amt(f.materials + f.bf)}${amt(f.wages)}${amt(f.charges)}</tr></table>
          <div class="row foot"><span>Total to date ${hand(fmt(Math.round(total)))}</span>${f.closed ? `<span>Closed ${hand(cal.shortDate(f.closed))}: ${hand(`${fmt(f.unitCost)} per ${f.unit}`)}</span>` : f.standard ? `<span>Estimate ${hand(fmt(Math.round(f.standard)))} per ${f.unit}</span>` : ''}</div>
        </div>`;
    },
  },

  'wages-allocation': {
    title: 'Weekly Wages Allocation', size: 'foolscap, in the Works Accounts Office',
    note: 'Elbourne 1914: wages are posted to the cost ledger from the weekly time allocation. Every hand’s gross wages are split between the sub-orders on their time slips and the standing orders, so the sheet agrees with the wages abstract.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const orders = f.orders.map((o) => `<tr><td class="hand">${esc(o.subOrder)}</td><td class="hand">${esc(o.desc)}</td>${money(o.amount)}</tr>`).join('');
      const standing = f.standing.map((o) => `<tr><td class="hand">${esc(o.no)}</td><td class="hand">${esc(o.name)}</td>${money(o.amount)}</tr>`).join('');
      return `
        <div class="fax sheet wide">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span>Week ending ${hand(cal.docDate(f.ending))}</span></div>
          <div class="title">WAGES ALLOCATION</div>
          <table class="ruled money"><tr><th>Sub-order</th><th>Description</th><th>£</th><th>s.</th><th>d.</th></tr>${orders}
            <tr class="total"><td></td><td>Direct wages</td>${money(f.direct)}</tr>
            ${standing}
            <tr class="total"><td></td><td>Indirect wages</td>${money(f.indirect)}</tr>
            <tr class="total"><td></td><td>Total, agreeing with the wages abstract (gross)</td>${money(f.total)}</tr></table>
        </div>`;
    },
  },

  'shop-charges': {
    title: 'Works Expenditure and Shop Charges', size: 'foolscap, fortnightly',
    note: 'Hawkins 1905: charging oncost as a percentage on direct wages is "the method most generally adopted", but some manufacturers "use the same rate of Oncost year after year". Each fortnight the Works Accountant sets the works’ actual expenditure against what the rate recovered. Items marked (est.) are accrued at so much a year.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = f.rows.map((r) => `<tr><td class="hand">${esc(r.head)}${r.est ? ' (est.)' : ''}</td>${money(r.amount)}</tr>`).join('');
      return `
        <div class="fax sheet">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span>Fortnight ending ${hand(cal.docDate(f.to - 1440))}</span></div>
          <div class="title">WORKS EXPENDITURE</div>
          <table class="ruled money"><tr><th>Indirect wages and works expenses</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}
            <tr class="total"><td>Works expenditure, actual</td>${money(f.actual)}</tr>
            <tr><td>Direct wages of the fortnight</td>${money(f.direct)}</tr>
            <tr><td>Shop charges recovered at ${pct(f.rate)} on direct wages</td>${money(f.recovered)}</tr>
            <tr class="total"><td>${f.difference >= 0 ? 'Over-recovered' : 'Under-recovered'}</td>${money(Math.abs(f.difference))}</tr></table>
          <div class="row foot"><span>Actual rate ${hand(pct(f.actual / Math.max(1, f.direct)))} on direct wages</span>${f.revised ? `<span>Rate revised to ${hand(pct(f.revised))}</span>` : ''}</div>
        </div>`;
    },
  },

  'cost-abstract': {
    title: 'Delivered Orders Cost Abstract', size: '5 × 8 in. sheets, Form 5-138, mounted in a guard book',
    note: 'Elbourne 1914: fortnightly, the works cost against the invoice price of each order delivered, "to present to the General Manager a concise survey of profitable and unprofitable business". It is "mounted in a guard book for privacy". Office oncost comes off the fortnight’s total.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const signed = (v) => (v < 0 ? `(${fmt(-v)})` : fmt(v));
      const shown = f.rows.slice(0, 40);
      const cell = (v, cls = '') => `<td class="hand num ${cls}" style="white-space: nowrap">${v}</td>`;
      const rows = shown.map((r) => {
        const margin = r.invoiced - r.works;
        return `<tr>${cell(esc(r.invoiceNo))}<td class="hand">${esc(r.agent)}</td>${cell(r.machines)}${cell(fmt(r.invoiced))}${cell(`${fmt(r.works)}${r.basis !== 'actual' ? '*' : ''}`)}${cell(signed(margin), margin < 0 ? 'red' : '')}</tr>`;
      }).join('');
      const margin = f.invoiced - f.works;
      return `
        <div class="fax sheet">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span>Fortnight ending ${hand(cal.docDate(f.to - 1440))}</span></div>
          <div class="title">DELIVERED ORDERS COST ABSTRACT</div>
          <table class="ruled"><tr><th>Invoice</th><th>Customer</th><th>Mchs.</th><th>Invoiced</th><th>Works cost</th><th>Margin</th></tr>${rows}
            ${f.rows.length > shown.length ? `<tr><td></td><td>and ${f.rows.length - shown.length} more invoices</td><td></td><td></td><td></td><td></td></tr>` : ''}
            <tr class="total"><td></td><td>Totals</td>${cell(f.machines)}${cell(fmt(f.invoiced))}${cell(fmt(f.works))}${cell(signed(margin), margin < 0 ? 'red' : '')}</tr>
            <tr><td></td><td colspan="4">Less office oncost on works cost</td>${cell(fmt(f.office))}</tr>
            <tr class="total"><td></td><td colspan="4">Profit (loss) on the fortnight’s deliveries</td>${cell(signed(f.profit), f.profit < 0 ? 'red' : '')}</tr></table>
          <div class="row small"><span>* At the Estimator’s figure: machines from stock, or from sub-orders not yet closed.</span></div>
          <div class="row foot"><span>Works Accountant</span>${doc.marks.some((m) => m.mark === 'initialled') ? '<span class="hand initials">C.H.</span>' : ''}</div>
        </div>`;
    },
  },

  'salaries-list': {
    title: 'Salaries List', size: 'foolscap', colour: '#f7f4ea',
    note: 'Salaried staff were paid monthly. Under the National Insurance Act 1911 those earning under £160 a year were insured: the employer fixed a 7d. stamp each week (6d. for a woman) and kept back 4d. (3d.).',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const paid = doc.marks.some((m) => m.mark === 'paid');
      const rows = f.rows.map((r) => `<tr><td class="hand">${esc(r.name)}</td><td class="hand">${esc(r.title)}</td>${money(r.gross)}${r.insurance ? money(r.insurance) : blank}${money(r.net)}<td class="hand">${paid ? '✓' : ''}</td></tr>`).join('');
      return `
        <div class="fax sheet wide">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span>${hand(cal.docDate(f.date))}</span></div>
          <div class="title">SALARIES, ${esc(f.month.toUpperCase())}</div>
          <table class="ruled money"><tr><th>Name</th><th>Position</th><th colspan="3">Salary</th><th colspan="3">Health insurance (${f.weeks} weeks)</th><th colspan="3">Paid</th><th>Rec’d</th></tr>${rows}
            <tr class="total"><td></td><td>Totals</td>${money(f.gross)}${money(f.insurance)}${money(f.net)}<td></td></tr></table>
          <div class="row foot"><span>Employer’s insurance ${hand(fmt(f.employer))}</span><span>${paid ? hand('Paid in envelopes') : ''}</span></div>
        </div>`;
    },
  },

  'monthly-statement': {
    title: 'Monthly Statement', size: 'foolscap, in the private file',
    note: 'Dicksee: a monthly account of sales, purchases and "estimated stock", checked at the periodical stocktaking. Here the Works Accounts Office’s cost of the machines invoiced stands in for the estimate of stock, and the fortnights’ over- or under-recovered shop charges bring the works cost to the actual. The result is an estimate until the year’s stocktaking.',
    render(doc, ctx) {
      const f = doc.fields;
      const signed = (v) => (v < 0 ? `(${fmt(-v)})` : fmt(v));
      const exp = f.expenses.map(([h, v]) => `<tr><td class="hand">${esc(h)}</td>${money(v)}</tr>`).join('');
      const stat = (h, v) => `<tr><td>${esc(h)}</td><td class="hand num" colspan="3">${esc(v)}</td></tr>`;
      return `
        <div class="fax sheet">
          <div class="row"><span class="firm">${FIRM}</span></div>
          <div class="title">STATEMENT FOR ${esc(f.month.toUpperCase())}</div>
          <table class="ruled money"><tr><th></th><th>£</th><th>s.</th><th>d.</th></tr>
            <tr><td>Sales, ${f.machines.toLocaleString('en-GB')} machines invoiced</td>${money(f.invoiced)}</tr>
            <tr><td>Works cost of the machines invoiced</td>${money(f.works)}</tr>
            <tr class="total"><td>Gross profit</td><td class="hand num" colspan="3">${signed(f.gross)}</td></tr>
            <tr><td>Shop charges ${f.shop >= 0 ? 'over' : 'under'}-recovered</td><td class="hand num" colspan="3">${signed(f.shop)}</td></tr>
            <tr><th>Office and selling expenses</th><th></th><th></th><th></th></tr>${exp}
            <tr class="total"><td>Office and selling expenses</td>${money(f.office)}</tr>
            <tr class="total"><td>Net ${f.net >= 0 ? 'profit' : 'loss'} for the month (est.)</td><td class="hand num ${f.net < 0 ? 'red' : ''}" colspan="3">${signed(f.net)}</td></tr>
            <tr><th>The month in figures</th><th colspan="3"></th></tr>
            ${stat('Machines made', f.made.toLocaleString('en-GB'))}
            ${stat('Machines in the Stock Room', f.stock.toLocaleString('en-GB'))}
            ${stat('Machines on order, not yet sent', f.waiting.toLocaleString('en-GB'))}
            ${stat('Wages paid', fmt(f.wages))}
            ${stat('Bank balance', signed(f.bank))}
            ${stat('Owing by customers', fmt(f.debtors))}
            ${stat('Owing to suppliers', fmt(f.creditors))}</table>
          <div class="row foot"><span>Secretary</span>${doc.marks.some((m) => m.mark === 'initialled') ? '<span class="hand initials">C.H.</span>' : ''}</div>
        </div>`;
    },
  },
};

export const ACCOUNTS_SUMMARIES = {
  'salaries-list': (f) => `${f.month}: ${f.rows.length} staff, ${fmt(f.gross)}`,
  'monthly-statement': (f) => `${f.month}: sales ${fmt(f.sales)}, net ${f.net >= 0 ? 'profit' : 'loss'} ${fmt(Math.abs(f.net))} (est.)`,
  'estimate-sheet': (f) => `${f.name}: works cost ${fmt(Math.round(f.works))}`,
  'stores-coupon': (f) => `No. ${f.no}, ${f.subOrder}: ${f.items.length} item${f.items.length === 1 ? '' : 's'} from the ${f.store}${f.priced ? `, ${fmt(f.total)}` : ''}`,
  'cost-card': (f) => `${f.subOrder} ${f.desc}: ${fmt(Math.round(f.bf + f.materials + f.wages + f.charges))}${f.closed ? `, closed at ${fmt(f.unitCost)} each` : ''}`,
  'wages-allocation': (f, { cal }) => `Week ending ${cal.shortDate(f.ending)}: direct ${fmt(f.direct)}, indirect ${fmt(f.indirect)}`,
  'shop-charges': (f, { cal }) => `Fortnight ending ${cal.shortDate(f.to - 1440)}: ${fmt(f.actual)} spent, ${f.difference >= 0 ? 'over' : 'under'}-recovered ${fmt(Math.abs(f.difference))}`,
  'cost-abstract': (f, { cal }) => `Fortnight ending ${cal.shortDate(f.to - 1440)}: ${f.machines} machines, ${f.profit >= 0 ? 'profit' : 'loss'} ${fmt(Math.abs(f.profit))}`,
};
