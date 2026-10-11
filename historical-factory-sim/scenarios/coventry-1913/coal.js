// Coal for the boilers, by canal from the Griff collieries north of
// Coventry, a narrow-boat load at a time.
//
// The Coventry Canal in 1913 carried "mainly coal to wharves around the
// city from the North Warwickshire pits", in horse-drawn narrow boats up to
// 71 ft 9 in. by 7 ft (VCH). A load of 25 tons, the boiler's use of about
// two tons a day, the price and the time to unload are estimates. The
// colliery's weight ticket comes with the boat, and the receiving clerk
// signs for it and writes the goods received note as for any other goods.
import { wait } from '../../engine/sim/kernel.js';
import { walk, work } from '../../engine/sim/world.js';
import { Store } from '../../engine/sim/production.js';
import { s } from '../../engine/sim/money.js';
import { CANAL_Z } from './site.js';

const CWT_PER_TON = 20;
const BOAT_LOAD = 25 * CWT_PER_TON; // cwt
const BARROW = 3; // cwt to the boiler house at a time

// The coal yard and its stock control card.
export function setupCoal(world, production) {
  const P = world.purchasing;
  const rng = P.rng;
  const opening = Math.round(rng.uniform(32, 42)) * CWT_PER_TON;
  const store = production.addStore(new Store('coal', 'Coal Yard', { coal: opening }));
  const s0 = P.suppliers.find((x) => x.items.includes('coal'));
  const card = {
    item: 'coal', desc: 'Boiler slack', unit: 'ton', price: s(11.5), per: CWT_PER_TON, pack: BOAT_LOAD, weekly: 13 * CWT_PER_TON,
    level: 30 * CWT_PER_TON, normal: BOAT_LOAD, supplier: s0, store: 'coal', onOrder: 0, requested: 0, lastPosted: world.sim.now,
  };
  card.doc = world.paper.create('stock-card', {
    item: 'coal', desc: card.desc, unit: 'ton', per: CWT_PER_TON, bin: 'Coal yard', level: card.level, normal: card.normal,
    lines: [{ t: world.cal.at(1913, 3, 1), ref: 'Balance', balance: store.qty('coal') }],
  }, { at: 'stock-cards' });
  P.cards.set('coal', card);
  P.itemSupplier.set('coal', s0);
  world.ledger.open('fuel', 'Coal and fuel', { type: 'expense' });
  // February's boats, to be paid for on the third Wednesday.
  const owed = Math.round(rng.uniform(3.6, 4.4) * card.weekly / card.per * card.price / 2) * 2;
  world.ledger.post(world.cal.at(1913, 2, 28, 12), 'Balance brought forward: February deliveries', [[s0.account, 0, owed], ['opening', owed, 0]]);
  P.boats = [];
  return { store, card, boats: 0 };
}

export function makeBoat(id, name, captain) {
  return { id, name, captain, kind: 'boat', node: 'CN_E', motion: null, onSite: false, activity: 'at the colliery', load: 0, driver: null, papers: new Set(), towpathZ: CANAL_Z - 24 };
}

// The boat comes down the canal the morning after the colliery sends it,
// ties up at the wharf, waits to be unloaded, and goes back for more.
export function* coalBoat(world, boat) {
  const P = world.purchasing;
  const paper = world.paper;
  for (;;) {
    yield wait(10);
    const c = P.consignments.find((x) => x.carrier === 'canal' && !x.delivered && x.boatDue <= world.sim.now);
    if (!c) continue;
    c.delivered = 'on the boat';
    const tons = c.lines[0].qty;
    const ticket = paper.create('coal-ticket', {
      no: 3000 + P.rng.int(100, 999), colliery: c.supplier.name, boat: boat.name, captain: boat.captain, cwt: tons, poNo: c.po.no, date: world.sim.now - 300, signedBy: null,
    });
    ticket.history.length = 0;
    paper.note(ticket, `weighed and made out at ${c.supplier.name}’s wharf`);
    ticket.history[0].t = world.sim.now - 300;
    paper.hold(ticket, boat);
    paper.link(ticket, c.po.docs.top);
    boat.load = tons;
    boat.node = 'CN_E';
    boat.onSite = true;
    boat.driver = { name: boat.captain };
    yield* walk(world, boat, 'CN_WHARF', { mode: 'vehicle', speed: 200, activity: `coming down the canal with ${tons / CWT_PER_TON} tons of slack` });
    boat.activity = 'tied up at the works wharf';
    // The receiving clerk comes down to the wharf to sign the ticket.
    const call = { vehicle: boat, sheet: ticket, load: [c], packages: tons / CWT_PER_TON, node: 'WHARF', signed: null };
    P.atDoor.push(call);
    for (let i = 0; i < 120 && !call.signed; i++) yield wait(1);
    P.atDoor.splice(P.atDoor.indexOf(call), 1);
    // The yard labourers unload it with shovels and barrows.
    boat.unloading = true;
    boat.activity = 'being unloaded at the wharf';
    while (boat.load > 0) yield wait(5);
    boat.unloading = false;
    c.delivered = world.sim.now;
    c.per = `canal boat “${boat.name}”`;
    P.toCheck.push(c);
    paper.put(ticket, 'receiving-tray', 'with the receiving clerk, for the goods received note');
    world.log(`${c.supplier.name}’s boat “${boat.name}” was unloaded at the wharf: ${tons / CWT_PER_TON} tons of slack.`, { kind: 'stores' });
    boat.activity = 'going back up the canal';
    yield* walk(world, boat, 'CN_E', { mode: 'vehicle', speed: 220 });
    boat.onSite = false;
    boat.driver = null;
    boat.activity = 'at the colliery';
  }
}

// The yard labourers sweep and tidy, and unload the coal boat when it comes.
export function* yardLabourer(world, p, { places }) {
  const rng = world.rng;
  const boats = () => (world.purchasing?.boats || []).filter((b) => b.unloading && b.load > 0);
  for (;;) {
    const b = boats()[0];
    if (b) {
      yield* work(world, p, 0.01);
      yield* walk(world, p, 'WHARF', { activity: `going to unload the boat “${b.name}”` });
      while (b.load > 0) {
        // Don't start a barrow-load just before the bell.
        const spell = p.timetable.currentSpell(world.sim.now);
        if (!spell || spell[1] - world.sim.now < 8) {
          yield* work(world, p, spell ? spell[1] - world.sim.now : 0.01, 'putting the shovels away');
          continue;
        }
        if (p.node !== 'WHARF') yield* walk(world, p, 'WHARF', { activity: `going back to the boat “${b.name}”` });
        yield* work(world, p, 6, 'shovelling slack from the boat into a barrow');
        yield* walk(world, p, 'COAL', { activity: 'barrowing slack to the coal yard' });
        b.load = Math.max(0, b.load - 6);
        yield* walk(world, p, 'WHARF', { activity: 'going back to the boat' });
      }
      continue;
    }
    yield* work(world, p, rng.uniform(5, 15), 'sweeping and tidying the yard');
    const dest = rng.pick(places);
    yield* walk(world, p, dest, { activity: 'going across the yard with a broom and barrow' });
    yield* work(world, p, rng.uniform(5, 20), 'sweeping and tidying the yard');
  }
}

// The stokers barrow slack from the coal yard to the boiler fronts.
export function* stoker(world, p) {
  const store = world.production.stores.get('coal');
  for (;;) {
    yield* work(world, p, world.rng.uniform(80, 110), 'firing the boiler');
    if (store.qty('coal') < BARROW) continue;
    yield* walk(world, p, 'COAL', { activity: 'fetching a barrow of slack from the coal yard' });
    yield* work(world, p, 4, 'filling a barrow with slack');
    store.take([['coal', BARROW]], world.sim.now, 'to the boilers');
    yield* walk(world, p, p.spot, { activity: 'wheeling the slack to the boiler front' });
  }
}

export { CWT_PER_TON };
