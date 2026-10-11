// Bits shared by the facsimile renderers of the works' and the office's forms.
import { columns } from '../../engine/sim/money.js';

export const FIRM = 'THE SHERBOURNE CYCLE COMPANY LIMITED';
export const FIRM_SHORT = 'The Sherbourne Cycle Co. Ltd.';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const hand = (s) => `<span class="hand">${esc(s)}</span>`;
export const typed = (s) => `<span class="typed">${esc(s)}</span>`;
export const lsdCells = (f, cls = 'hand') => {
  const c = columns(f);
  return `<td class="l ${cls}">${c.l}</td><td class="s ${cls}">${c.s}</td><td class="d ${cls}">${c.d}</td>`;
};
export const hours = (h) => {
  const q = Math.round(h * 4) / 4;
  const whole = Math.floor(q);
  const frac = ['', '¼', '½', '¾'][Math.round((q - whole) * 4)];
  return `${whole || (frac ? '' : '0')}${frac}`;
};
