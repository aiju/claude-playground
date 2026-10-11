// Double-entry accounts.
//
// Every transaction debits some accounts and credits others by the same
// total, so the trial balance always balances. Personal accounts (each
// customer, each supplier) roll up into a control account in the general
// ledger, as a sales ledger rolled up into "Sundry Debtors".

export class Ledger {
  constructor() {
    this.accounts = new Map();
    this.postings = [];
  }

  open(code, name, { type = 'asset', control = null, meta = {} } = {}) {
    if (!this.accounts.has(code)) this.accounts.set(code, { code, name, type, control, meta, debit: 0, credit: 0, lines: [] });
    return this.accounts.get(code);
  }

  account(code) {
    const a = this.accounts.get(code);
    if (!a) throw new Error(`no account ${code}`);
    return a;
  }

  // lines: [[code, debit, credit], ...]. Personal accounts also post to
  // their control account.
  post(t, narrative, lines, { ref = null } = {}) {
    let dr = 0;
    let cr = 0;
    for (const [, d, c] of lines) {
      dr += d || 0;
      cr += c || 0;
    }
    if (dr !== cr) throw new Error(`unbalanced posting "${narrative}": Dr ${dr} Cr ${cr}`);
    const posting = { t, narrative, lines, ref };
    this.postings.push(posting);
    for (const [code, d, c] of lines) {
      const a = this.account(code);
      a.debit += d || 0;
      a.credit += c || 0;
      a.lines.push({ t, narrative, debit: d || 0, credit: c || 0, ref });
      if (a.control) {
        const ctl = this.account(a.control);
        ctl.debit += d || 0;
        ctl.credit += c || 0;
      }
    }
    return posting;
  }

  // Debit balance (negative for a credit balance).
  balance(code) {
    const a = this.account(code);
    return a.debit - a.credit;
  }

  // The trial balance of the general ledger (control accounts, not the
  // personal accounts behind them).
  trialBalance() {
    let dr = 0;
    let cr = 0;
    const rows = [];
    for (const a of this.accounts.values()) {
      if (a.control) continue;
      const b = a.debit - a.credit;
      if (b === 0) continue;
      rows.push({ code: a.code, name: a.name, debit: b > 0 ? b : 0, credit: b < 0 ? -b : 0 });
      if (b > 0) dr += b;
      else cr -= b;
    }
    return { rows, debit: dr, credit: cr, balanced: dr === cr };
  }

  personalTotal(control) {
    let n = 0;
    for (const a of this.accounts.values()) if (a.control === control) n += a.debit - a.credit;
    return n;
  }
}
