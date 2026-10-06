// The world beyond the gate: the cycle agents who order machines and pay
// for them, the Post Office, and Lloyds Bank.
//
// Agents bought at list less a trade discount and settled monthly, with
// 2½% off for prompt payment (est., from Raleigh's 1897–1901 terms and
// Elbourne's "Monthly, less 2½%"; no 1913 cycle-trade terms survive).
import { SURNAMES } from './names.js';
import { MODELS, PROGRAMME_CYCLE, FRAME_SIZES } from './catalogue.js';

const TOWNS = [
  // [town, railway station, region, weight]
  ['Birmingham', 'Birmingham (New Street)', 'North', 6], ['Leicester', 'Leicester', 'North', 4], ['Nottingham', 'Nottingham', 'North', 4],
  ['Derby', 'Derby', 'North', 3], ['Northampton', 'Northampton (Castle)', 'South', 3], ['Wolverhampton', 'Wolverhampton', 'North', 3],
  ['Walsall', 'Walsall', 'North', 2], ['Stafford', 'Stafford', 'North', 2], ['Rugby', 'Rugby', 'South', 2], ['Leamington', 'Leamington Spa', 'South', 2],
  ['Warwick', 'Warwick', 'South', 1], ['Kidderminster', 'Kidderminster', 'North', 1], ['Worcester', 'Worcester', 'South', 2],
  ['Shrewsbury', 'Shrewsbury', 'North', 1], ['Stoke-on-Trent', 'Stoke-on-Trent', 'North', 2], ['Burton-on-Trent', 'Burton-on-Trent', 'North', 1],
  ['Lincoln', 'Lincoln', 'North', 1], ['Peterborough', 'Peterborough', 'South', 1], ['Manchester', 'Manchester (London Road)', 'North', 5],
  ['Liverpool', 'Liverpool (Lime Street)', 'North', 4], ['Leeds', 'Leeds', 'North', 3], ['Bradford', 'Bradford', 'North', 2],
  ['Sheffield', 'Sheffield', 'North', 3], ['Hull', 'Hull', 'North', 2], ['York', 'York', 'North', 1], ['Newcastle-on-Tyne', 'Newcastle', 'North', 2],
  ['Preston', 'Preston', 'North', 2], ['Blackburn', 'Blackburn', 'North', 1], ['Bolton', 'Bolton', 'North', 1], ['Huddersfield', 'Huddersfield', 'North', 1],
  ['Carlisle', 'Carlisle', 'North', 1], ['London', 'London (Broad Street)', 'South', 6], ['Bristol', 'Bristol', 'South', 3],
  ['Reading', 'Reading', 'South', 2], ['Oxford', 'Oxford', 'South', 2], ['Cambridge', 'Cambridge', 'South', 1], ['Norwich', 'Norwich', 'South', 2],
  ['Ipswich', 'Ipswich', 'South', 1], ['Brighton', 'Brighton', 'South', 2], ['Southampton', 'Southampton', 'South', 2], ['Portsmouth', 'Portsmouth', 'South', 1],
  ['Exeter', 'Exeter', 'South', 1], ['Plymouth', 'Plymouth', 'South', 1], ['Gloucester', 'Gloucester', 'South', 1], ['Cheltenham', 'Cheltenham', 'South', 1],
  ['Swindon', 'Swindon', 'South', 1], ['Luton', 'Luton', 'South', 1], ['Bedford', 'Bedford', 'South', 1], ['Cardiff', 'Cardiff', 'South', 2],
  ['Swansea', 'Swansea', 'South', 1], ['Glasgow', 'Glasgow', 'North', 3], ['Edinburgh', 'Edinburgh', 'North', 2], ['Coventry', 'Coventry', 'South', 2],
  ['Nuneaton', 'Nuneaton', 'South', 1], ['Hinckley', 'Hinckley', 'South', 1],
];
const STREETS = ['High Street', 'Market Street', 'Church Street', 'London Road', 'Station Road', 'Broad Street', 'Bridge Street', 'King Street', 'Queen Street', 'George Street', 'Victoria Road', 'Park Road', 'Corporation Street', 'New Street', 'Union Street'];
const TRADES = ['Cycle Agent', 'Cycle and Motor Agent', 'Cycle Maker and Repairer', 'Ironmonger', 'Cycle Depot'];

export function makeAgents(rng, n = 150) {
  const agents = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const [town, station, region] = rng.weighted(TOWNS.map((t) => [t, t[3]]));
    const sur = rng.weighted(SURNAMES);
    const style = rng.int(0, 5);
    const name = [
      `${sur} & Sons`, `${sur} Bros.`, `${'ABCEFGHJTW'[rng.int(0, 9)]}. ${sur}`, `${sur} & ${rng.weighted(SURNAMES)}`,
      `${sur} & Co.`, `The ${town} Cycle Depot`,
    ][style];
    if (used.has(name)) { i--; continue; }
    used.add(name);
    const size = rng.weighted([[1, 50], [2, 30], [4, 14], [8, 6]]);
    agents.push({
      id: `agent-${i + 1}`,
      name,
      trade: style === 5 ? 'Cycle Depot' : rng.pick(TRADES),
      address: `${rng.int(1, 180)}, ${rng.pick(STREETS)}, ${town}`,
      town, station, region,
      size,
      // Bigger agents hold a season contract at a third off; the rest a quarter.
      discount: size >= 4 ? 1 / 3 : 1 / 4,
      soleAgency: size >= 4 && rng.chance(0.6),
      standing: rng.weighted([['good', 70], ['fair', 22], ['slow', 8]]),
      carriage: size >= 4 ? 'Paid' : 'To pay',
      orders: 0,
    });
  }
  return agents;
}

// What an agent asks for: one to three lines, in proportion to the
// programme's mix of models.
export function orderLines(rng, agent) {
  const lines = [];
  const nLines = rng.weighted([[1, 55], [2, 33], [3, 12]]);
  for (let i = 0; i < nLines; i++) {
    const [model, pattern] = rng.weighted(PROGRAMME_CYCLE.map(([m, p, q]) => [[m, p], q]));
    const qty = Math.max(1, Math.round(agent.size * rng.uniform(0.5, 1.5) / nLines));
    const frameSize = rng.weighted(FRAME_SIZES[pattern]);
    const same = lines.find((l) => l.model === model && l.pattern === pattern && l.frameSize === frameSize);
    if (same) same.qty += qty;
    else lines.push({ model, pattern, qty, frameSize });
  }
  return lines;
}

export function listPrice(model, pattern) {
  const m = MODELS[model];
  const lady = pattern === 'lady' || pattern === 'girl';
  return m.list + (lady ? m.ladyExtra || 0 : 0);
}

// The phrases an agent might write an order in.
export function orderLetterBody(rng, agent, lines) {
  const items = lines.map((l) => `${l.qty} ${MODELS[l.model].name}, ${l.pattern === 'gent' ? "gent's" : l.pattern === 'lady' ? "lady's" : `${l.pattern}'s`}, ${l.frameSize} in. frame`);
  const opening = rng.pick([
    'Kindly forward at your earliest convenience the following machines:',
    'Please send us per goods train the undermentioned:',
    'We shall be obliged if you will despatch:',
    'Please book and forward as early as possible:',
  ]);
  const close = rng.pick([
    'The season is opening well here and we are short of stock.',
    'Please let us have these without delay as customers are waiting.',
    'Kindly advise date of despatch.',
    'Trusting to receive these in good order,',
  ]);
  return { opening, items, close };
}

// The works' suppliers: who sends what, how, and how long they take between
// getting an order and sending the goods (working days, est.). Real firms
// are named where the research found them supplying the cycle trade; the
// spoke maker, the bar-steel merchant, the transfer printer and the basket
// maker are invented. Carriers: the railway's own carts deliver from Warwick
// Road the morning after the goods train; Coventry firms send their own
// carts; transfers come by parcel post.
export const SUPPLIERS = [
  { id: 'accles', name: 'Accles & Pollock Ltd.', address: 'Oldbury, near Birmingham', items: ['tube-set', 'fork-blades', 'handlebar-tube'], carrier: 'L. & N.W.R.', days: [2, 4] },
  { id: 'bsa', name: 'The Birmingham Small Arms Co. Ltd.', address: 'Small Heath, Birmingham', items: ['lug-set', 'pedal-pair', 'fixed-sprocket'], carrier: 'L. & N.W.R.', days: [2, 4] },
  { id: 'hartley', name: 'J. Hartley & Sons', address: 'Attercliffe, Sheffield', items: ['bar-steel'], carrier: 'Midland Railway', days: [3, 6] },
  { id: 'westwood', name: 'The Westwood Rim Co.', address: 'Bordesley, Birmingham', items: ['rim'], carrier: 'L. & N.W.R.', days: [2, 4] },
  { id: 'hadley', name: 'Hadley & Sons, Spoke Makers', address: 'Lancaster Street, Birmingham', items: ['spoke', 'nipple'], carrier: 'L. & N.W.R.', days: [2, 4] },
  { id: 'hoffmann', name: 'The Hoffmann Manufacturing Co. Ltd.', address: 'Chelmsford', items: ['ball'], carrier: 'L. & N.W.R.', days: [3, 6] },
  { id: 'coventry-chain', name: 'The Coventry Chain Co. Ltd.', address: 'Spon End, Coventry', items: ['chain'], carrier: 'own cart', days: [1, 3] },
  { id: 'eadie', name: 'The Eadie Manufacturing Co. Ltd.', address: 'Redditch', items: ['freewheel', 'coaster-hub'], carrier: 'Midland Railway', days: [2, 5] },
  { id: 'sturmey', name: 'Sturmey-Archer Gears Ltd.', address: 'Nottingham', items: ['three-speed'], carrier: 'Midland Railway', days: [3, 5] },
  { id: 'middlemore', name: 'Middlemore & Lamplugh Ltd.', address: 'Coventry', items: ['saddle'], carrier: 'own cart', days: [1, 3] },
  { id: 'dunlop', name: 'The Dunlop Rubber Co. Ltd.', address: 'Birmingham', items: ['tyre-set'], carrier: 'L. & N.W.R.', days: [2, 4] },
  { id: 'bluemel', name: 'Bluemel Bros. Ltd.', address: 'Wolston, near Coventry', items: ['mudguards'], carrier: 'own cart', days: [2, 4] },
  { id: 'brooks', name: 'J. B. Brooks & Co. Ltd.', address: 'Great Charles Street, Birmingham', items: ['toolbag'], carrier: 'L. & N.W.R.', days: [2, 4] },
  { id: 'richmond', name: 'The Richmond Gear Case Co.', address: 'Croft Road, Coventry', items: ['gear-case', 'oil-bath-case'], carrier: 'own cart', days: [1, 3] },
  { id: 'shilton', name: 'T. Shilton, Basket Maker', address: 'Gosford Street, Coventry', items: ['basket'], carrier: 'own cart', days: [2, 5] },
  { id: 'midland-transfer', name: 'The Midland Transfer Printing Co.', address: 'Hockley, Birmingham', items: ['transfers'], carrier: 'parcel post', days: [2, 4] },
  // Boiler slack by narrow boat from the Griff collieries, by the Coventry Canal.
  { id: 'griff', name: 'The Griff Colliery Co. Ltd.', address: 'Griff, near Nuneaton', items: ['coal'], carrier: 'canal', days: [2, 4] },
];
