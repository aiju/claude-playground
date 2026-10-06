# historical-factory-sim

A stylised 3D simulation of a pre-computer factory, accurate to its time in the paperwork, logistics and bureaucracy. The first scenario is the Sherbourne Cycle Company Limited: a fictional, mid-sized Coventry cycle works in 1913, with about 400 hands, card time recorders, six-copy office orders, pay tins on Friday night and horse drays to the LNWR goods yard.

**Status:** milestone 5 of 7 (see [DESIGN.md](DESIGN.md) §11).

The works stands, with its steam engine, shafting and about 400 people. Production runs:
- Frames go through building, brazing, filing, numbering, polishing, three coats of stoved enamel and lining.
- Bright parts are polished, plated and fitted, and wheels are laced and trued.
- Everything meets in the Finishing Shop, and the machines are tested, wrapped and taken up to the Stock Room.

The works' own paper runs, following Elbourne's *Factory Administration and Accounts* (1914):
- Time cards are punched at the recorders, with late times in red.
- Daily time slips are collected by the works post.
- A work tally rides with every tray.
- On Wednesday night the timekeeper takes the week's cards to the Wages Office.
- On Thursday the wages clerks work out piecework, premium bonus and National Insurance, and write the wages sheets, the wages abstract and the coin list.
- On Friday the Cashier draws the coin at Lloyds, and the hands are paid from numbered pay tins at the pay window.
- The insurance cards are stamped each week.

The commercial side runs too, following Elbourne and Spencer's *Commercial Organisation of Engineering Factories* (1907):
- About 150 cycle agents across Britain write in with orders and pay their monthly accounts by cheque.
- An office boy fetches the locked post bag; the Secretary opens, stamps, numbers and registers every letter.
- The order clerk checks the customer's account, sends an acknowledgement postcard, and types a six-copy office order. An overdue account's order is held until a cheque comes.
- The warehouse foreman allocates machines from the Stock Room by frame number. An order that has waited three days goes in part, with the balance to follow.
- Packers crate the machines. The despatch clerk writes a triplicate packing slip, a three-copy advice of despatch and the L. & N.W.R. consignment note.
- Pair-horse lorries take the crates to the Warwick Road goods yard, and the carmen bring back the advices signed by the railway's checker.
- The office copy of each advice is invoiced. The invoice goes into the Sales Day Book and is posted to the agent's page in the Sales Ledger.
- Statements go out at the start of the month. The Cashier enters the agents' cheques in the Cash Book, sends receipts (stamped for £2 or more), and pays in at Lloyds before noon.
- Wages, insurance stamps and carriage are posted to a double-entry ledger whose trial balance always agrees.

The Works Manager's programme follows the order book: a model the agents are waiting for goes into the shops first.

Buying in runs on Elbourne's routine too:
- The storekeeper keeps a stock control card for each bought-in part, with an ordering level and a normal quantity, and posts the day's issues to it.
- When stock falls to the level, the storekeeper writes a purchase requisition in triplicate, and the Works Manager initials it.
- The Buyer's clerk types the purchase order in triplicate: one copy for the supplier, one for the Buyer, and an unpriced one for the Receiving Clerk. The Managing Director signs any order over £50.
- Sixteen suppliers in Birmingham, Sheffield, Nottingham, Coventry and elsewhere send their goods by the L. & N.W.R., the Midland, their own carts or parcel post, and post an advice of despatch and their invoice separately.
- The Receiving Clerk checks the goods against the unpriced copy and writes a goods received note in carbon duplicate. The top copy goes to the Works Accounts Office, where the invoice is matched with it, passed and numbered before it reaches the Bought Day Book and the Bought Ledger.
- Suppliers' statements are checked against the ledger at the start of the month.
- On the third Wednesday the month's accounts are paid. The list of payments is checked by the Secretary and sanctioned by the Managing Director, and each supplier gets a combined cheque and receipt, less 2½%.

Away from the works:
- **The Warwick Road goods yard** is a second diorama, about two miles off.
  - At half past five the shunt horse places last night's inward vans and empty open wagons at the goods shed.
  - The porters unload the vans onto the delivery bank, and the railway's own vans bring our goods to the Rough Stores.
  - Our lorries and other traders' carts back up to the shed. The checker signs for the crates against the consignment notes, and the porters load them into wagons for the north and the south, sheeted for the night goods at 8.30.
- **Coal** comes by narrow boat down the Coventry Canal from the Griff colliery, 25 tons at a time. The yard labourers barrow it from the wharf to the coal yard, and the stokers barrow it on to the boilers.

The **Paperwork** button opens an explorer of every paper written so far, by kind, by where it is now (in which tray, with the customer, at the railway, in someone's hand), and the books and ledgers. Each document shows as a facsimile with its carbon copies, its history and its paper trail: from an agent's letter through the office order, packing slip, advice of despatch, consignment note and invoice, or from a time card to its pay slip and the week's wages abstract. A link ending `#paperwork` opens the explorer straight away.

Click anyone, any tray of work, a lorry, a wagon, a desk or an office to see their papers as facsimiles of the period forms. Desks also show their books: the correspondence register, the order book, the despatch book, the sales day book, the cash book, the purchase orders register, the goods received book and the bought day book. The Secretary's desk has the trial balance, and the ledger clerks' desks have the agents' and suppliers' ledger pages. The year comes next: the seasons, the cycle show, the month-end routine, stocktaking and the year end.

- [DESIGN.md](DESIGN.md): what we're building and how, including the split between a period-independent engine and the 1913 scenario.
- [Research report](research/reports/Coventry%20cycle%20works%201913.md): the sourced findings behind the design, with about 150 linked sources.
- [Research notes](research/research_notes/Coventry%20cycle%20works%201913/): the detailed notes the report draws on, one file per topic.

## Running it

It's a static page that loads three.js from a CDN, with no build step. Serve the folder with any static file server and open it in a browser:

```sh
cd historical-factory-sim
python3 -m http.server 8000
# then open http://localhost:8000
```

Drag to turn the view, right-drag to pan, scroll to zoom, and click on anyone to see who they are, what they're doing and their time card. The buttons along the top change the speed, peel the buildings open floor by floor, and jump to places.

URL parameters are handy for looking at a particular moment:

| Parameter | Example | |
|---|---|---|
| `t` | `?t=1913-03-03T10:30` | Start at that time, with everyone already at work |
| `run` | `?run=1913-03-05T14:30` | Start on Monday morning as usual, but run the works on to that time before showing it, so its paper and lorries are all there |
| `speed` | `?speed=300` | Sim seconds per real second (60 is one minute a second) |
| `cut` | `?cut=1` or `?cut=open` | Peel the buildings down to that floor, or take the roofs off |
| `cam` | `?cam=engine-house` | A camera preset: `overview`, `gate`, `offices`, `main-block`, `engine-house`, `machine-shop`, `despatch-dock`, `wharf`, `goods-yard` |
| `seed` | `?seed=7` | A different random week |
| `paused` | `?paused=1` | Start paused |

## Tests

The simulation runs without the 3D view, so it's tested headless in Node (22 or later), with no dependencies:

```sh
cd historical-factory-sim
node --test
```

## Layout

- `engine/`: knows nothing about Coventry or 1913. `engine/sim` is the event kernel, calendar, £ s d, random numbers, the site graph and people. `engine/render` is the three.js view. `engine/ui` is the overlay.
- `scenarios/coventry-1913/`: everything with a date on it: the site plan, timetables, staff, routines, production, the works' and the office's paper, the agents and suppliers, purchasing, the goods yard, the coal boat, and colours.
- `test/`: Node tests.
