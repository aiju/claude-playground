// The works' printed forms, and how each one looks as a facsimile.
//
// Layouts follow the column lists in Elbourne's specimen forms (1914). The
// sources had no images of the forms, so the ruling is reconstructed, and
// the colours of carbon copies are a choice: Elbourne says only "distinctive
// colours", with the top copy white.
import { fmt, columns, short } from '../../engine/sim/money.js';

const FIRM = 'THE SHERBOURNE CYCLE COMPANY LIMITED';
const FIRM_SHORT = 'The Sherbourne Cycle Co. Ltd.';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hand = (s) => `<span class="hand">${esc(s)}</span>`;
const lsdCells = (f, cls = 'hand') => {
  const c = columns(f);
  return `<td class="l ${cls}">${c.l}</td><td class="s ${cls}">${c.s}</td><td class="d ${cls}">${c.d}</td>`;
};
const hours = (h) => {
  const q = Math.round(h * 4) / 4;
  const whole = Math.floor(q);
  const frac = ['', '¼', '½', '¾'][Math.round((q - whole) * 4)];
  return `${whole || (frac ? '' : '0')}${frac}`;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RECORDER_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const FORMS = {
  'time-card': {
    title: 'Time Card', size: '7 × 3½ in.', colour: '#efe3c4', stock: 'card',
    note: 'Elbourne 1914: headed "Ending Wednesday"; the recorder prints each clocking, late ones in red; issued again on Friday as the pay card.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rows = [];
      for (let day = f.start; day <= f.ending; day += 1440) {
        const dow = cal.dow(day);
        if (dow === 0) continue;
        const ps = f.punches.filter((p) => p.t >= day && p.t < day + 1440).sort((a, b) => a.t - b.t);
        const cells = [0, 1, 2, 3].map((i) => {
          const p = ps[i];
          if (!p) return '<td></td>';
          const t = cal.parts(p.t);
          return `<td class="recorder ${p.late ? 'red' : ''}">${RECORDER_DAYS[dow]}&nbsp;${t.hour}&nbsp;${String(t.minute).padStart(2, '0')}</td>`;
        });
        const hrs = ctx.dayHours ? ctx.dayHours(doc, day) : null;
        rows.push(`<tr><th>${DAYS[dow]}</th>${cells.join('')}<td class="hand">${hrs ? hours(hrs) : ''}</td></tr>`);
      }
      const result = ctx.payFor?.(doc);
      const cancelled = doc.marks.some((m) => m.mark === 'cancelled');
      return `
        <div class="fax card time-card${cancelled ? ' crayoned' : ''}">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span class="big">No. ${hand(f.worksNo)}</span></div>
          <div class="title">TIME CARD</div>
          <div class="row"><span>Week ending Wednesday ${hand(cal.docDate(f.ending))}</span></div>
          <div class="row"><span>Name ${hand(f.name)}</span><span>Dept. ${hand(f.dept)}</span></div>
          <table class="ruled"><tr><th>Day</th><th>In</th><th>Out</th><th>In</th><th>Out</th><th>Hours</th></tr>${rows.join('')}</table>
          <div class="row foot">
            <span>Total hours ${result ? hand(hours(result.hours)) : '______'}</span>
            <span>Wages ${result ? hand(short(result.gross)) : '______'}</span>
          </div>
          <div class="small">Late arrivals print in red. Five minutes' grace; after that a quarter of an hour is lost.</div>
        </div>`;
    },
  },

  'time-slip': {
    title: 'Daily Time Slip', size: '2½ × 3½ in. (pad)', stock: 'slip',
    note: 'Elbourne 1914: written by the workman on a pad, colour differing for machine and hand work, and passed to the Wages Office.',
    colourFor: (doc) => (/Machine|Press/.test(doc.fields.dept) ? '#f2d6d6' : '#fbf8ef'),
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const signed = doc.marks.some((m) => m.mark === 'signed');
      let body;
      if (f.broughtForward) {
        body = `<tr><td colspan="4" class="hand">Brought forward from the previous days: ${esc(fmt(f.earnings, { shillings: true }))}</td></tr>`;
      } else {
        body = f.entries.map((e) => `<tr><td class="hand">${esc(e.order)}</td><td class="hand">${esc(e.op)}</td><td class="hand num">${e.qty}</td><td class="hand num">${hours(e.minutes / 60)}</td></tr>`).join('')
          || '<tr><td colspan="4" class="hand">Day work</td></tr>';
      }
      return `
        <div class="fax slip" style="background:${this.colourFor(doc)}">
          <div class="row"><span class="firm">${FIRM_SHORT}</span></div>
          <div class="title">DAILY TIME SLIP</div>
          <div class="row"><span>No. ${hand(f.worksNo)}</span><span>Date ${hand(cal.shortDate(f.day))}</span></div>
          <div class="row"><span>Name ${hand(f.name)}</span></div>
          <table class="ruled"><tr><th>Order No.</th><th>Operation</th><th>Qty.</th><th>Hours</th></tr>${body}</table>
          <div class="row foot"><span>Foreman ${signed ? `<span class="hand initials">${esc(ctx.foremanInitials?.(f.dept) || 'J.W.')}</span>` : '______'}</span></div>
        </div>`;
    },
  },

  'work-tally': {
    title: 'Work Tally', size: 'about 2½ × 5 in.', colour: '#e8d9a8', stock: 'card',
    note: 'Elbourne 1914: issued by the Work Depot, "accompanies the batch through all operations"; its coupon is cut off when the material is drawn.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const lot = doc.lot || ctx.lotFor?.(doc);
      const cut = doc.marks.some((m) => m.mark === 'coupon cut');
      const steps = lot ? lot.routing.filter((s) => s.op || s.equip) : [];
      const done = lot ? lot.routing.slice(0, lot.state === 'done' ? lot.routing.length : lot.step).filter((s) => s.op || s.equip).length : 0;
      const rows = steps.map((s, i) => `<tr><td>${esc(s.op || s.what)}</td><td class="${i < done ? 'stamp-cell' : ''}">${i < done ? '<span class="stamp small">PASSED</span>' : ''}</td></tr>`).join('');
      return `
        <div class="fax card tally${cut ? ' corner-cut' : ''}" style="background:${this.colour}">
          <div class="row"><span class="firm">${FIRM_SHORT}</span></div>
          <div class="title">WORK TALLY</div>
          <div class="row"><span>Sub-order ${hand(f.subOrder)}</span><span>Qty. ${hand(f.qty)}</span></div>
          <div class="row"><span>${hand(f.lot)}</span></div>
          <div class="row"><span>Issued ${hand(cal.docDate(f.issued))}</span></div>
          <table class="ruled"><tr><th>Operation</th><th>Viewed</th></tr>${rows}</table>
          <div class="coupon">${cut ? '<em>coupon cut off: material drawn</em>' : 'COUPON: to be cut off when the material is drawn from the stores'}</div>
        </div>`;
    },
  },

  'pay-slip': {
    title: 'Pay Slip', size: 'to suit the pay tin', stock: 'slip', colour: '#fbf8ef',
    note: 'Elbourne 1914: torn from a sheet and laid on top of the coin in each numbered pay tin.',
    render(doc, ctx) {
      const f = doc.fields;
      const { cal } = ctx;
      const rate = f.weekly ? `${short(f.rate)} a week` : `${fmt(f.rate)} an hour`;
      const line = (label, amount, cls = '') => `<tr class="${cls}"><td>${label}</td>${lsdCells(amount)}</tr>`;
      return `
        <div class="fax slip pay" style="background:${this.colour}">
          <div class="row"><span class="firm">${FIRM_SHORT}</span><span class="big">No. ${hand(f.worksNo)}</span></div>
          <div class="title">PAY</div>
          <div class="row"><span>Week ending ${hand(cal.docDate(f.ending))}</span></div>
          <div class="row"><span>${hand(f.name)}</span></div>
          <table class="ruled money"><tr><th></th><th>£</th><th>s.</th><th>d.</th></tr>
            ${line(`Time, ${hand(hours(f.hours))} hrs. at ${hand(rate)}`, f.timeWages)}
            ${f.piece ? line('Piece work', f.piece) : ''}
            ${f.bonus ? line('Premium bonus', f.bonus) : ''}
            ${line('Gross wages', f.gross, 'total')}
            ${f.health ? line('<span class="red">Less Health Insurance</span>', f.health, 'red') : ''}
            ${f.unemployment ? line('<span class="red">Less Unemployment Insurance</span>', f.unemployment, 'red') : ''}
            ${line('<b>Amount in tin</b>', f.net, 'total')}
          </table>
          <div class="small">Paid on ${hand(esc(f.basis))}. Examine your money before leaving the pay window.</div>
        </div>`;
    },
  },

  'coin-list': {
    title: 'Coin List', size: 'foolscap half-sheet', stock: 'sheet', colour: '#fbf8ef',
    note: 'Elbourne 1914: the wages clerk sends the Cashier an analysis of the coin needed: "sovereigns, half-sovereigns, half-crowns, threepenny pieces, copper and sundry silver".',
    render(doc, ctx) {
      const f = doc.fields;
      const rows = Object.entries(f.coins).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="hand num">${n.toLocaleString('en-GB')}</td></tr>`).join('');
      return `
        <div class="fax sheet">
          <div class="row"><span class="firm">${FIRM}</span></div>
          <div class="title">WAGES: COIN REQUIRED</div>
          <div class="row"><span>Week ending ${hand(ctx.cal.docDate(f.ending))}</span></div>
          <table class="ruled"><tr><th>Coin</th><th>Number</th></tr>${rows}</table>
          <div class="row foot"><span>Total ${hand(fmt(f.total))}</span></div>
        </div>`;
    },
  },

  'wages-abstract': {
    title: 'Wages Abstract', size: '14½ × 10½ in.', stock: 'sheet', colour: '#fbf8ef',
    note: 'Elbourne 1914: summarises the wages sheets for the Works Manager and General Manager; deductions in red.',
    render(doc, ctx) {
      const f = doc.fields;
      const rows = f.rows.map((r) => `<tr><td>${esc(r.dept)}</td><td class="hand num">${r.hands}</td>${lsdCells(r.gross)}${lsdCells(r.deductions, 'hand red')}${lsdCells(r.net)}</tr>`).join('');
      const tg = f.rows.reduce((a, r) => a + r.gross, 0);
      const td = f.rows.reduce((a, r) => a + r.deductions, 0);
      return `
        <div class="fax sheet wide">
          <div class="row"><span class="firm">${FIRM}</span></div>
          <div class="title">WAGES ABSTRACT</div>
          <div class="row"><span>Week ending Wednesday ${hand(ctx.cal.docDate(f.ending))}</span></div>
          <table class="ruled money">
            <tr><th rowspan="2">Department</th><th rowspan="2">Hands</th><th colspan="3">Gross wages</th><th colspan="3" class="red">Deductions (N.I.)</th><th colspan="3">Net wages</th></tr>
            <tr><th>£</th><th>s.</th><th>d.</th><th>£</th><th>s.</th><th>d.</th><th>£</th><th>s.</th><th>d.</th></tr>
            ${rows}
            <tr class="total"><td>Totals</td><td></td>${lsdCells(tg)}${lsdCells(td, 'hand red')}${lsdCells(f.total)}</tr>
          </table>
          <div class="row foot"><span>Employer's insurance contributions ${hand(fmt(f.employerNI))}</span><span>Health ${hand(fmt(f.health))}; unemployment ${hand(fmt(f.unemployment))} deducted</span></div>
        </div>`;
    },
  },

  cheque: {
    title: 'Cheque', size: 'bank cheque', stock: 'cheque', colour: '#eaf0e4',
    note: 'Dicksee 1912: "a cheque should always be drawn for the exact amount of wages required". Stamp duty on a cheque was 1d. until 1918.',
    render(doc, ctx) {
      const f = doc.fields;
      const paid = doc.marks.some((m) => m.mark === 'paid');
      return `
        <div class="fax cheque${paid ? ' paid' : ''}">
          <div class="row"><span>Coventry, ${hand(ctx.cal.docDate(f.date))}</span><span class="duty">STAMP DUTY<br>ONE PENNY</span></div>
          <div class="bank">LLOYDS BANK LIMITED</div>
          <div class="row small"><span>Coventry Branch</span></div>
          <div class="row payline"><span>Pay ${hand(f.payee)}</span></div>
          <div class="row payline"><span>${hand(ctx.words(f.amount))}</span></div>
          <div class="row"><span class="amount">${hand(fmt(f.amount))}</span><span class="sig">${f.signatories.map((s) => `${hand(s)}`).join('<br>')}<br><span class="small">for ${FIRM_SHORT}</span></span></div>
          ${paid ? '<div class="stamp diag">PAID</div>' : ''}
        </div>`;
    },
  },

  'unclaimed-report': {
    title: 'Unclaimed Pay Report', size: '5 × 8 in.', stock: 'slip', colour: '#fbf8ef',
    note: 'Elbourne 1914: unclaimed pay goes back to the Cashier with a report and an unprinted carbon.',
    render(doc, ctx) {
      const f = doc.fields;
      const rows = f.tins.map((t) => `<tr><td class="hand">${t.worksNo}</td><td class="hand">${esc(t.name)}</td>${lsdCells(t.net)}</tr>`).join('') || '<tr><td colspan="5" class="hand">None.</td></tr>';
      return `
        <div class="fax slip">
          <div class="row"><span class="firm">${FIRM_SHORT}</span></div>
          <div class="title">UNCLAIMED PAY</div>
          <div class="row"><span>Week ending ${hand(ctx.cal.docDate(f.ending))}</span></div>
          <table class="ruled money"><tr><th>No.</th><th>Name</th><th>£</th><th>s.</th><th>d.</th></tr>${rows}<tr class="total"><td></td><td>Total</td>${lsdCells(f.total)}</tr></table>
        </div>`;
    },
  },

  'ni-card': {
    title: 'Health Insurance Contribution Card', size: 'card', stock: 'card', colour: '#e6dcc8',
    note: 'National Insurance Act 1911, Part I: the employer fixes a stamp each week, 7d. for a man (4d. from his wages) and 6d. for a woman (3d.).',
    render(doc, ctx) {
      const f = doc.fields;
      const boxes = [];
      for (let i = 0; i < 26; i++) {
        const st = f.stamps[i];
        boxes.push(st ? `<div class="stampbox"><div class="nistamp ${st.value >= 28 ? 'seven' : 'six'}">${short(st.value)}<br><span>${esc(ctx.cal.shortDate(st.week))}</span></div></div>` : '<div class="stampbox"></div>');
      }
      return `
        <div class="fax card ni">
          <div class="title small-caps">National Insurance Act, 1911: Health Insurance</div>
          <div class="title">CONTRIBUTION CARD</div>
          <div class="row"><span>Name ${hand(f.name)}</span><span>${f.sex === 'F' ? 'Woman' : 'Man'}</span></div>
          <div class="row"><span>Approved Society ${hand(f.society)}</span></div>
          <div class="row small"><span>Employer: ${FIRM_SHORT}, Sherbourne Works, Coventry</span></div>
          <div class="stamps">${boxes.join('')}</div>
          <div class="small">One stamp for each week of employment. The card is to be surrendered at the end of the half-year.</div>
        </div>`;
    },
  },

  'unemployment-book': {
    title: 'Unemployment Book', size: 'book', stock: 'card', colour: '#d9e0e6',
    note: 'National Insurance Act 1911, Part II: lodged with the employer while employed; 2½d. a week from the workman and 2½d. from the employer (1d. each under 18).',
    render(doc, ctx) {
      const f = doc.fields;
      const boxes = [];
      for (let i = 0; i < 26; i++) {
        const st = f.stamps[i];
        boxes.push(st ? `<div class="stampbox"><div class="nistamp ui">${short(st.value)}<br><span>${esc(ctx.cal.shortDate(st.week))}</span></div></div>` : '<div class="stampbox"></div>');
      }
      return `
        <div class="fax card ni ui">
          <div class="title small-caps">National Insurance Act, 1911: Part II, Unemployment</div>
          <div class="title">UNEMPLOYMENT BOOK</div>
          <div class="row"><span>Name ${hand(f.name)}</span><span>Trade ${hand(f.trade)}</span></div>
          <div class="row small"><span>Lodged with ${FIRM_SHORT}</span></div>
          <div class="stamps">${boxes.join('')}</div>
        </div>`;
    },
  },
};

// Amounts in words, for cheques.
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function words(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${words(n % 100)}` : ''}`;
  return `${words(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${n % 1000 < 100 ? 'and ' : ''}${words(n % 1000)}` : ''}`;
}

export function amountInWords(f) {
  const pounds = Math.floor(f / 960);
  const rest = f - pounds * 960;
  const sh = Math.floor(rest / 48);
  const pence = (rest - sh * 48) / 4;
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  let out = `${cap(words(pounds) || 'no')} pounds`;
  if (sh) out += ` ${words(sh)} shillings`;
  if (pence) out += ` and ${pence === Math.floor(pence) ? words(pence) : `${words(Math.floor(pence))}${pence % 1 ? ' halfpenny' : ''}`} pence`;
  return out;
}

export function defineForms(paper) {
  for (const [id, f] of Object.entries(FORMS)) {
    paper.defineType({ id, title: f.title, colour: f.colour, copies: f.copies });
  }
}
