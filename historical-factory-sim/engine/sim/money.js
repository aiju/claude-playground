// Pounds, shillings and pence, held as integer farthings.
//
// £1 = 20s, 1s = 12d, 1d = 4 farthings; a guinea is 21s. Rates such as
// 10¼d an hour need the farthing, so everything is kept in farthings and only
// turned into £ s d for display.

export const FARTHING = 1;
export const PENNY = 4;
export const SHILLING = 48;
export const POUND = 960;
export const GUINEA = 1008;

export const lsd = (pounds = 0, shillings = 0, pence = 0) =>
  Math.round(pounds * POUND + shillings * SHILLING + pence * PENNY);
export const d = (pence) => Math.round(pence * PENNY);
export const s = (shillings) => Math.round(shillings * SHILLING);
export const gns = (guineas) => Math.round(guineas * GUINEA);

// Round to the nearest halfpenny, as wages were.
export const toHalfpenny = (f) => Math.round(f / 2) * 2;

export function split(f) {
  const neg = f < 0;
  let a = Math.abs(Math.round(f));
  const pounds = Math.floor(a / POUND);
  a -= pounds * POUND;
  const shillings = Math.floor(a / SHILLING);
  a -= shillings * SHILLING;
  const pence = Math.floor(a / PENNY);
  const farthings = a - pence * PENNY;
  return { neg, pounds, shillings, pence, farthings };
}

const FRACTION = ['', '¼', '½', '¾'];

function penceStr(pence, farthings) {
  if (pence === 0 && farthings > 0) return FRACTION[farthings];
  return `${pence}${FRACTION[farthings]}`;
}

// "£7 15s. 0d.", "10¼d."; with { shillings: true }, sums under £5 stay in
// shillings, as wages were quoted: "38s. 0d."
export function fmt(f, { shillings: inShillings = false } = {}) {
  let { neg, pounds, shillings, pence, farthings } = split(f);
  if (inShillings && pounds < 5) { shillings += pounds * 20; pounds = 0; }
  const sign = neg ? '−' : '';
  if (pounds > 0) return `${sign}£${pounds.toLocaleString('en-GB')} ${shillings}s. ${penceStr(pence, farthings)}d.`;
  if (shillings > 0) return `${sign}${shillings}s. ${penceStr(pence, farthings)}d.`;
  return `${sign}${penceStr(pence, farthings)}d.`;
}

// "38/-", "7/6", "10¼d.": the compact form used on slips. Sums under £5
// stay in shillings unless { pounds: true }.
export function short(f, { pounds: usePounds = false } = {}) {
  let { neg, pounds, shillings, pence, farthings } = split(f);
  if (!usePounds && pounds < 5) { shillings += pounds * 20; pounds = 0; }
  const sign = neg ? '−' : '';
  const sd = pence === 0 && farthings === 0 ? `${shillings}/-` : `${shillings}/${penceStr(pence, farthings)}`;
  if (pounds > 0) return `${sign}£${pounds} ${sd}`;
  if (shillings > 0) return `${sign}${sd}`;
  return `${sign}${penceStr(pence, farthings)}d.`;
}

// Columns for a ruled £ | s. | d. form.
export function columns(f) {
  const { neg, pounds, shillings, pence, farthings } = split(f);
  return {
    neg,
    l: pounds ? pounds.toLocaleString('en-GB') : '',
    s: pounds || shillings ? String(shillings) : '',
    d: penceStr(pence, farthings) || '0',
  };
}

// A list price in guineas where it is a whole number of them: "13 gns."
export function price(f) {
  if (f >= GUINEA && f % GUINEA === 0) return `${f / GUINEA} gns.`;
  return fmt(f);
}
