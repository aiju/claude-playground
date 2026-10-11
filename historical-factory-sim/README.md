# historical-factory-sim

A stylised 3D simulation of a pre-computer factory, accurate to its time in the paperwork, logistics and bureaucracy. The first scenario is the Sherbourne Cycle Company Limited: a fictional, mid-sized Coventry cycle works in 1913, with about 400 hands, card time recorders, six-copy office orders, pay tins on Friday night and horse drays to the LNWR goods yard.

**Status:** milestone 4 of 7 (see [DESIGN.md](DESIGN.md) §11).

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

The **Paperwork** button opens an explorer of every paper written so far, by kind, by where it is now (in which tray, with the customer, at the railway, in someone's hand), and the books and ledgers. Each document shows as a facsimile with its carbon copies, its history and its paper trail: from an agent's letter through the office order, packing slip, advice of despatch, consignment note and invoice, or from a time card to its pay slip and the week's wages abstract. A link ending `#paperwork` opens the explorer straight away.

Click anyone, any tray of work, a lorry, a desk or an office to see their papers as facsimiles of the period forms. Desks also show their books: the correspondence register, the order book, the despatch book, the sales day book and the cash book. The Secretary's desk has the trial balance, and the sales ledger clerk's desk has the agents' ledger pages. Purchasing, the coal boat and the goods yard come next.

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
| `speed` | `?speed=300` | Sim seconds per real second (60 is one minute a second) |
| `cut` | `?cut=1` or `?cut=open` | Peel the buildings down to that floor, or take the roofs off |
| `cam` | `?cam=engine-house` | A camera preset: `overview`, `gate`, `offices`, `main-block`, `engine-house`, `machine-shop`, `despatch-dock` |
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
- `scenarios/coventry-1913/`: everything with a date on it: the site plan, timetables, staff, routines, production, the works' and the office's paper, the agents, and colours.
- `test/`: Node tests.
