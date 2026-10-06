// The 1913 season's catalogue, what goes into each machine, and what the
// works buys in and makes for stock.
//
// List prices follow the research report's proposed catalogue, modelled on
// Premier, Swift and Calcott at the November 1910 Olympia show (est.).
// Bought-in prices are estimates from scattered pre-war evidence (BSA hubs at
// 15s. a pair in 1893, pedals at 7s. 6d. in 1898, Bates tyres from 2s. 6d. to
// 10s. 6d. in 1910); no 1912–14 supplier price list was found.
import { lsd, s, d, gns } from '../../engine/sim/money.js';

export const MODELS = {
  deluxe: { no: 1, name: 'Sherbourne de Luxe', list: gns(13), ladyExtra: s(10), hub: 'three-speed', gearCase: 'oil-bath-case', mudguards: true },
  tourist: { no: 2, name: 'Tourist', list: gns(10), ladyExtra: s(10), hub: 'three-speed', gearCase: 'gear-case', mudguards: true },
  standard: { no: 3, name: 'Standard', list: lsd(7, 15), ladyExtra: s(5), hub: 'freewheel', mudguards: true },
  popular: { no: 4, name: 'Popular', list: lsd(5, 15), ladyExtra: s(5), hub: 'freewheel', mudguards: true },
  racer: { no: 5, name: 'Path Racer', list: lsd(6, 6), hub: 'fixed-sprocket', mudguards: false },
  carrier: { no: 6, name: "Tradesman's Carrier", list: gns(9), hub: 'coaster-hub', mudguards: true, basket: true },
  juvenile: { no: 7, name: 'Juvenile', list: lsd(5, 5), ladyExtra: s(5), hub: 'freewheel', mudguards: true },
};

export const PATTERNS = { gent: "gent's", lady: "lady's", boy: "boy's", girl: "girl's" };

// Frame sizes (inches, seat tube) and how often each is made and asked for (est.).
export const FRAME_SIZES = {
  gent: [[22, 1], [24, 3], [26, 1]],
  lady: [[20, 1], [22, 3], [24, 1]],
  boy: [[18, 1]],
  girl: [[18, 1]],
};

export function modelName(model, pattern) {
  return `${MODELS[model].name}, ${PATTERNS[pattern]}`;
}

// The order in which the Works Manager puts batches through (est.): about
// 37% Popular, 37% Standard, 11% Tourist and 4% each of the rest, with about
// one machine in five a lady's pattern.
export const PROGRAMME_CYCLE = [
  ['popular', 'gent', 100], ['standard', 'gent', 100], ['popular', 'lady', 50], ['tourist', 'gent', 50],
  ['standard', 'lady', 50], ['deluxe', 'gent', 25], ['popular', 'gent', 100], ['carrier', 'gent', 25],
  ['standard', 'gent', 100], ['juvenile', 'boy', 25], ['racer', 'gent', 25], ['tourist', 'lady', 25],
];

// Bought in, kept in the Rough Stores. [description, unit, supplier, price, per]
export const BOUGHT = {
  'tube-set': ['Frame tubes, set of five', 'set', 'Accles & Pollock Ltd., Oldbury', d(54), 1],
  'lug-set': ['Lugs, bracket shell and fork crown, set', 'set', 'B.S.A. Co. Ltd., Small Heath', s(3), 1],
  'fork-blades': ['Fork blades', 'pair', 'Accles & Pollock Ltd., Oldbury', d(18), 1],
  'handlebar-tube': ['Handlebar tube', 'length', 'Accles & Pollock Ltd., Oldbury', d(8), 1],
  'bar-steel': ['Bright drawn bar steel', 'lb.', 'Sheffield bar steel', d(1.5), 1],
  rim: ['Rim, 28 in., Westwood pattern', 'each', 'Westwood rims, Birmingham', d(15), 1],
  spoke: ['Spokes, headed and bent', 'gross', 'Spoke maker, Birmingham', s(3), 144],
  nipple: ['Nipples', 'gross', 'Spoke maker, Birmingham', d(18), 144],
  ball: ['Steel balls, ¼ in.', 'gross', 'Hoffmann Manufacturing Co., Chelmsford', s(1), 144],
  chain: ['Roller chain', 'each', 'Coventry Chain Co. Ltd., Spon End', d(30), 1],
  freewheel: ['Free-wheel', 'each', 'Eadie, Redditch', d(42), 1],
  'three-speed': ['Sturmey-Archer three-speed hub', 'each', 'Sturmey-Archer Gears Ltd., Nottingham', s(15), 1],
  'coaster-hub': ['Coaster hub', 'each', 'Eadie, Redditch', s(8), 1],
  'fixed-sprocket': ['Fixed sprocket', 'each', 'B.S.A. Co. Ltd., Small Heath', d(6), 1],
  saddle: ['Saddle', 'each', 'Middlemore & Lamplugh Ltd., Coventry', s(4), 1],
  'tyre-set': ['Tyre cover and inner tube', 'each', 'Dunlop Rubber Co. Ltd.', d(66), 1],
  mudguards: ['Mudguards, rolled, with stays', 'pair', 'Bluemel Bros. Ltd., Wolston', d(21), 1],
  'pedal-pair': ['Pedals', 'pair', 'B.S.A. Co. Ltd., Small Heath', d(54), 1],
  toolbag: ['Toolbag with spanner and oilcan', 'each', 'J. B. Brooks & Co. Ltd., Birmingham', d(18), 1],
  'gear-case': ['Detachable gear case', 'each', 'Richmond Gear Case Co., Coventry', s(4), 1],
  'oil-bath-case': ['Oil-bath gear case', 'each', 'Richmond Gear Case Co., Coventry', s(9), 1],
  basket: ['Carrier frame and basket', 'each', 'Basket maker, Coventry', s(5), 1],
  transfers: ['Head transfer and transfers, set', 'set', 'Transfer printer, Birmingham', d(2), 1],
};

// Made in the works for stock, kept in the Finished Stores.
export const MADE = {
  'hub-shell': 'Hub shell, polished and plated',
  cone: 'Cone, hardened',
  cup: 'Cup, hardened',
  axle: 'Axle, hardened',
  crank: 'Crank',
  chainwheel: 'Chainwheel, polished and plated',
  'seat-pillar': 'Seat pillar',
  'pressings-set': 'Brake and lamp-bracket pressings, set',
  handlebar: 'Handlebar, bent',
  'small-parts': 'Small turned parts, set (nuts, bolts, cotters, spindles)',
};

// What each stream of a batch draws from the stores, per unit.
export function frameIssue() {
  return [['tube-set', 1], ['lug-set', 1], ['fork-blades', 1], ['transfers', 1]];
}

export function brightIssue() {
  return [['crank', 2], ['chainwheel', 1], ['seat-pillar', 1], ['pressings-set', 1], ['handlebar', 1], ['small-parts', 1]];
}

export function wheelRoughIssue() {
  return [['rim', 2], ['spoke', 72], ['nipple', 72], ['ball', 24]];
}

export function wheelFinishedIssue() {
  return [['hub-shell', 2], ['cone', 4], ['axle', 2]];
}

export function finishingIssue(model) {
  const m = MODELS[model];
  const out = [['chain', 1], ['saddle', 1], ['tyre-set', 2], ['pedal-pair', 1], ['toolbag', 1], [m.hub, 1]];
  if (m.mudguards) out.push(['mudguards', 1]);
  if (m.gearCase) out.push([m.gearCase, 1]);
  if (m.basket) out.push(['basket', 1]);
  return out;
}

// Bracket parts go in at finishing, from the Finished Stores (the balls for
// them come from the Rough Stores with the finishing set).
export function finishingMadeIssue() {
  return [['axle', 1], ['cup', 2], ['cone', 2]];
}

// Weekly use at about 270 machines a week, for setting stock levels.
export const WEEKLY_MACHINES = 270;
