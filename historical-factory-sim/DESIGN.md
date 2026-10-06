# Design: the Sherbourne Cycle Works, Coventry, 1913

A stylised 3D simulation of a fictional, mid-sized Coventry cycle works in 1913. It runs as a living diorama: people walk in at six in the morning, batches of frames go through the hearths and stoves, and letters, carbon copies, time cards, pay tins and consignment notes move round the site in people's hands. You can watch it and click anything to see what it is.

This document says what we're building and how. The facts behind it are in the [research report](research/reports/Coventry%20cycle%20works%201913.md), which links about 150 sources, and the [research notes](research/research_notes/Coventry%20cycle%20works%201913/). This document doesn't repeat that sourcing. Where it fills a gap the sources leave, it marks the choice **(est.)** for an estimate or **(choice)** for a free design decision, so it's always clear what is documented and what isn't.

## 1. Goals and scope

**What matters most, in order:**

1. **The paper.** Every document is a real object with a period name, a printed layout, a number of carbon copies, a route and a book it gets entered in. Documents are created, carried, filed, posted, cut, crayoned and stamped as they were. The main sources are Elbourne's *Factory Administration and Accounts* (March 1914) and Spencer's *Commercial Organisation of Engineering Factories* (1907).
2. **The rhythms.** The research report puts it like this: "a 1913 cycle works was a set of rhythms tied together by paper, more than a set of machines." The sim has to get the timing right for all of them:
   - the day: a 6 a.m. start, breakfast and dinner, and the 5–7 p.m. rush to the goods yard;
   - the week: the wages week ends on Wednesday and pay tins go out on Friday night;
   - the month: statements, supplier payments and the cost abstract;
   - the year: designs in October, the show in November, overtime from February to May, stocktaking in August, short time in autumn.
3. **The logistics.** Inbound and outbound goods, the stores, the horse dray, the LNWR goods yard, parcel post and the canal coal boat.
4. **The manufacturing.** Every real step is present and in the right order, with plausible durations and capacities. The physics and chemistry are abstracted away.

**Out of scope for now:** player decisions (this is a "watch" sim), individual-level drama and dialogue, weather beyond light and dark, and anything after 1913.

## 2. The firm

### Identity (choice; please change anything you like)

- **Name:** The Sherbourne Cycle Company Limited, after the river that runs through Coventry. I checked and found no real cycle firm of that name.
- **Works:** Sherbourne Works, on a fictional street off Foleshill Road. The site backs onto the Coventry Canal.
- **Trade mark:** "The Sherbourne", on a head transfer showing the city's three spires.
- **Telegraphic address:** "SHERBOURNE, COVENTRY". **Telephone:** Coventry 517 (fictional). **Code:** ABC 5th edition.
- **Bank:** Lloyds Bank Limited, Coventry. Rudge-Whitworth banked with Lloyds, and Barclays hadn't reached the Midlands yet.
- **Status:** a private limited company under the Companies (Consolidation) Act 1908. As a private company it doesn't have to file a balance sheet.

### Backstory (choice, modelled on real firms' histories)

1. **1888:** Edwin Hartwell and Samuel Lowe start building safety bicycles in part of a converted ribbon factory at Spon End, by the Sherbourne.
2. **1896:** at the height of the boom, the firm becomes a public company and moves to a new four-storey red-brick works in Foleshill.
3. **1901:** the slump forces a capital reconstruction, like the write-downs real Coventry firms made in 1900–05.
4. **1907:** a north-light shed is added for the machine shop. The engine house is rebuilt between the old block and the new shed with a bigger engine that drives both.
5. **1909:** the firm re-registers as a private company, as Singer did.
6. **1913:** Edwin is chairman and his son Charles is managing director. The board is watching neighbours move into motorcycles.

### Size (est.; the reasoning is in the report)

Firms that made most of their own parts produced about 30–45 machines per worker a year. That gives:

| | |
|---|---|
| Works hands | about 400 |
| Salaried staff | about 28 |
| Output | about 11,000 machines a year: about 280 a week in the February–May peak, about 120 in the August–November slack |
| Batches | 100 for the Popular and gent's Standard, 50 for the other models (est.; Grew's example batch is 100) |
| Turnover | about £85,000 a year |
| Weekly wage bill | about £600 |
| Capital | £45,000 in £1 ordinary shares, £20,000 in 6% cumulative preference shares, and £10,000 of 5% debentures (est.) |
| Financial year | ends 31 August, as cycle companies' years usually did |

### Catalogue for the 1913 season (est.; modelled on Premier, Swift and Calcott in the 1910 show report)

| No. | Model | Gent's list price | Specification |
|---|---|---|---|
| 1 | Sherbourne de Luxe | 13 gns (£13 13s) | Sturmey-Archer 3-speed, oil-bath gear case, Brooks saddle, Renold chain, gold-leaf lining |
| 2 | Tourist | 10 gns | 3-speed, detachable gear case |
| 3 | Standard | £7 15s | Free-wheel, two rim brakes; 3-speed +£1 1s, gear case +10s 6d |
| 4 | Popular | £5 15s | Free-wheel, two rim brakes, second-grade tyres |
| 5 | Path Racer | £6 6s | Dropped bars, wood rims, fixed wheel |
| 6 | Tradesman's Carrier | 9 gns | Carrier frame, name plate, basket, coaster hub |
| 7 | Juvenile | £5 5s (girl's £5 10s) | Boy's and girl's |

- **Lady's patterns:** +5s (Popular and Standard) or +10s (Tourist and de Luxe). They have a dropped frame and a dress guard laced by women.
- **Frame sizes:** 22–26 in. **Wheels:** 28 in.
- **Finish:** black enamel lined in gold, or green or red to order.
- **Included:** saddle, pedals and toolbag. Lamps and bells are not included.
- **Rough volume mix (est.):** Popular 35%, Standard 35%, Tourist 12%, de Luxe 5%, Carrier 5%, Racer 3%, Juvenile 5%. About a quarter of machines are lady's patterns.
- **Spares:** a printed spares list. Agents order parts by post, and they mostly go out by parcel post (11 lb maximum).

### Customers and terms (est.)

**Agents:** about 150, mostly in the Midlands and the North, a few with sole agencies for their town. They buy at list less 25%, or less 33⅓% on a guaranteed season order, and get 2½% off for settling a monthly account.

Other customers:
- two factors;
- a co-operative society contract;
- a London store that takes machines with its own transfer ("built for the trade");
- export through two confirming houses, one in London and one in Liverpool. Export is about 15% of output, sent knocked down in zinc-lined cases at about £4 a machine.

Two **travellers** cover the North and the South, and an **Olympia show stand** goes up in November.

**Suppliers:** about 20 real firms, named in the report's supplier table, for example:
- Accles & Pollock (tube);
- BSA (fittings and lug sets);
- Coventry Chain and Renold (chains);
- Sturmey-Archer (3-speed hubs);
- Brooks and Middlemore & Lamplugh (saddles);
- Dunlop and Bates (tyres);
- Hoffmann (balls);
- Bluemel (mudguards);
- enamel from Wolverhampton.

Their terms are "Monthly, less 2½%", and the firm pays them on the third Wednesday of the month for the previous month's deliveries (Spencer's routine). Coal comes by canal from a colliery north of Coventry.

**Other outside parties:**
- the LNWR (Warwick Road goods yard and its cartage department);
- the Post Office;
- Lloyds Bank;
- the factory inspector and the certifying surgeon;
- an insurance office (fire, boiler and workmen's compensation);
- the Inland Revenue (income tax at 1s 2d in the £);
- the auditors (a Birmingham firm of chartered accountants);
- the shareholders;
- the unions: the ASE, the Toolmakers, and the Workers' Union with its 1s entrance fee and 3d a week.

## 3. The site

The layout follows Humber's documented four-storey plan of 1897, which was still the usual building type in 1913, plus a 1907-style north-light shed. All dimensions are **(est.)**, derived from Rudge-Whitworth's and Humber's buildings. 1 ft = 1 unit in the scene.

### Buildings

| Building | Size | Contents |
|---|---|---|
| **Office range** on the street | 2 storeys, 120 × 35 ft, corner entrance | **Ground floor:** enquiry counter, general office (sloping desks, partitioned cashier's cage with safe), showroom. **First floor:** board room, managing director, secretary, travellers' room, typists. Painted company name across the front (required by law). |
| **Gatehouse and time office** at the works gate | — | Card time recorder (installed 1912) with "in" and "out" racks; gatekeeper; board of statutory notices; private telephone switchboard (the door attendant minds it). |
| **Main block** | 4 storeys, 220 × 55 ft, about 14 ft floor to floor, goods hoist at one end, iron fire-escape stairs | See the floor-by-floor table below. |
| **North-light shed** (1907) | 160 × 100 ft | Machine shop (capstans, automatics, milling) driven from line shafts; press shop; hardening shop next to the boiler house. |
| **Boiler and engine house** | — | Two Lancashire boilers and a horizontal steam engine of about 150 hp **(choice)**. Its big flywheel drives everything: ropes run up a rope race to the main shaft on each floor of the main block, and another rope drive goes to the shed. The engine also belts a dynamo for the plating vats and the electric light in the shed and offices. The tall chimney stands beside it. |
| **Yard buildings** | — | Smithy (single storey); crate shop (carpenters); stable for three horses with the van and dray shed; men's and women's lavatory blocks; mess room; workers' bicycle shed; coke and coal heaps. |
| **Canal wharf** | — | Hand crane; coal boats unload here. |
| **Despatch dock** | — | Raised platform where the drays load. |

### Main block, floor by floor

| Floor | Contents |
|---|---|
| Ground | Rough stores by the goods entrance; iron and plate polishing; plating (vats, dynamo); wrapping; warehouse and despatch office. |
| First | Enamelling (stoves, dip tanks); lining room (partitioned); wheel shop; brakework and mudguard benches; finishing (assembly); final viewers; drawing office and works office in the middle. |
| Second | Frame building (jig tables); brazing shop (partitioned, hoods, 8–10 hearths); pickling and sand-blast; filing; finished-parts stores and view room. |
| Third | Toolroom; pattern shop; stock room for finished machines. |

**Inside the shops:** walls limewashed every 14 months; line shafting with railed belts and flywheels; gas mantles on spiral tubes in the old block and electric lamps in the shed; steam radiators. All of these are visible marks the Factory Act left on buildings.

### Around the site

- Terraces of red brick and slate with narrow pavements.
- A pub on the corner.
- A chocolate-and-cream Corporation tram on Foleshill Road. The fleet was open-top; the first covered tops arrived in 1913.
- The canal, with a horse-drawn boat.

### The goods yard

The LNWR goods yard at Warwick Road, about two miles away, is a **second, smaller diorama** you can switch to. It stands on its own patch of ground, well away from the works, and the vehicles that go between them leave one and turn up at the other after the time the journey takes. It shows:
- the walled yard and the weighbridge office at the gate;
- the No. 2 goods shed, with an internal platform and lead-grey wagons, some still with white diamonds and some with "L N W R" lettering;
- the 5-ton hand crane and wagon turntables;
- the two-storey street range with stables below;
- the cartage foreman.

The yard fills with drays between 5 and 7 p.m. Our crates are tracked in full detail. Other traffic is ambient. How it runs is in "The goods yard and the coal boat as built" in §7.

The private siding is optional. Daimler had one, but it isn't needed for cycles, which went out as small consignments ("smalls") through the goods shed. We can add it later.

## 4. People

### Works hands (est. allocation; floor positions follow Humber)

| Department | Hands | Main trades |
|---|---|---|
| Stores and messengers | 20 | Storekeeper, receiving clerk, stores servers, youth messengers |
| Machine shop and automatics | 70 | Turners, machine minders, setters |
| Press shop and hardening | 15 | Pressers, hardeners |
| Toolroom and pattern shop | 20 | Toolmakers, patternmakers |
| Frame building | 15 | Frame builders with youth learners |
| Brazing | 10 | Brazers |
| Filing and sand-blast | 20 | Filers, sand-blasters |
| Polishing | 35 | Polishers |
| Plating | 15 | Platers, with youths and girls scrubbing |
| Enamelling | 20 | Enamellers with youths |
| Lining and transfers | 8 | Liners |
| Wheel shop | 30 | Spoke-machine minders, lacers (youths), truers |
| Brakework, mudguards and handlebars | 15 | Fitters |
| Finishing | 35 | Finishers with learners |
| Viewers and testers | 10 | Viewers, cycle testers |
| Wrapping and packing | 15 | Mostly women and girls |
| Crate shop | 5 | Carpenters |
| Warehouse and despatch | 10 | Warehousemen, carmen |
| Enginemen, millwrights and labourers | 15 | Engine driver, stoker, millwright, labourers |
| Foremen and chargemen | 15 | One foreman per shop |

### Salaried staff (est., following Elbourne's and Dicksee's roles)

- **Commercial side:** the Secretary-Accountant; the Cashier, who also keeps the petty cash; the Chief Clerk; a correspondence clerk and two typists; an order and invoice clerk; a sales ledger clerk; a bought ledger clerk; the Buyer and a clerk; two travellers.
- **Works side:** the Works Manager; the Works Accountant-Estimator and two cost clerks; two wages clerks and a timekeeper; a production clerk and a progress chaser; a ratefixer; two draughtsmen; a despatch clerk; the gatekeeper; and three office boys.

### Each person in the sim

- A name, generated from period name frequencies.
- Sex and age. About 15% of the hands are women **(est.)**. They work in wrapping, scrubbing for the platers, lacing dress guards, rough polishing and some machine minding. The sources disagree: Carter (1912) says leading Coventry firms used women "just for wrapping", but the 1911 census counts 1,476 women in Coventry cyclemaking, about a quarter of the trade.
- A works number, a trade, a department, a rate, and a home street.
- **Records:** an engagement form, a health-insurance card, and an unemployment book if their trade is insured. The employer holds the card and book and stamps them weekly.
- **For young people:** anyone under 16 has a certificate of fitness from the certifying surgeon.
- **History:** a rate sheet that records 52 weeks of earnings and stamps.

### Pay (sourced; the rates are in the report's wage table)

**Rates:**
- labourers 6d an hour (27s for 54 hours);
- machine hands about 7d;
- skilled production workers 8d;
- fitters and turners 38s for 53 hours;
- toolroom 9d;
- patternmakers 10¼d.

**Cycle-trade weekly averages:**
- brazers about 35s;
- filers about 30s;
- enamellers 30s;
- liners 38–40s;
- wheel truers 37s.

**Women and young people:**
- women 10s 6d to 18s;
- boys and girls 7s to 11s.

**Piecework:** Coventry moved quickly to piecework, often gang piecework. The sim uses Carter's 1912 prices: 10½d a pair of wheels, 6d a handlebar, 3d a fork, 7d a gear set and 6d a brake set. Setters and toolmakers stay on time rates. **(choice):** the sim also runs a Rowan premium bonus in the machine shop. It was contentious with the ASE, which suits 1913.

**Overtime:** time and a quarter for the first two hours, then time and a half **(est.; no Coventry source found)**.

## 5. Time

### The clock

- **Time zone:** GMT all year. British Summer Time didn't exist until 1916.
- **Default start:** Monday 3 March 1913, at the start of the busy season. The sim can start at any date in 1913.
- **Holidays (unpaid):** Good Friday 21 March, Easter Monday 24 March, Whit Monday 12 May, Bank Holiday Monday 4 August, Christmas Day (Thursday) and Boxing Day (Friday).
- **Sun:** the sun's position is computed for Coventry (52.41° N) on the sim date. In early March the works starts in the dark, so the shop lights are on.

### The working day (est. timetable, 53 hours)

No 1913 Coventry timetable survives. This reconstruction fits the August 1910 agreement between Coventry employers and the unions, and the Factory Act limits for women and young persons.

| | Monday–Friday | Saturday |
|---|---|---|
| Work | 6:00–8:00, 8:30–12:30, 1:30–5:00 | 6:00–8:00, 8:30–12:00 |
| Meals | Breakfast 8:00–8:30, dinner 12:30–1:30 | Breakfast 8:00–8:30 |

**Lateness** follows Swindon practice, which is documented; Coventry's isn't:
- five minutes' grace;
- after that, a quarter-hour's pay is deducted;
- anyone arriving after 6:15 is shut out until breakfast ("losing a quarter").

The deductions go in a fines register, as the Truck Act requires.

**The office** works 9:00–6:00, and 9:00–1:00 on Saturday **(est.)**. Staff sign an attendance book, with late arrivals in red.

**Overtime:** in the busy season, up to 15 hours a week under the 1910 agreement. Foremen issue overtime tickets, which double as gate passes.

### A typical day

Working hours are as above. Everything else in this table is **(est.)**: the 5–7 p.m. goods-yard rush comes from West's handbook, but its exact times at Coventry and the times of post and carts are not documented.

| Time | What happens |
|---|---|
| 5:50 | Hands stream in from the terraces; clock cards punch in at the gatehouse |
| 6:00 | Works starts |
| 7:30 | An office boy fetches the locked post bag from the head post office |
| 8:00 | Breakfast |
| 9:00 | The office opens; the Secretary opens the post |
| Morning | Orders are checked for credit, acknowledged by postcard the same day, and typed as six-copy office orders; the works post goes round every hour **(est.)** |
| 12:30 | Dinner |
| Afternoon | LNWR carts deliver inbound goods; goods received notes are written |
| 5:00 | The works stops; crates are loaded onto the drays |
| 5:00–7:00 | Drays go to Warwick Road |
| 6:00 | The office closes |
| Evening | The signed letters are press-copied and posted |

### The week (wages, following Elbourne)

| Day | What happens |
|---|---|
| Wednesday | The wages week ends at stopping time. Time cards are collected and the wages clerks work out pay, bonuses and National Insurance to the halfpenny. |
| Thursday | Wages sheets and the wages abstract are finished; the coin list goes to the Cashier. |
| Friday morning | The Cashier draws a cheque for the exact total at Lloyds and brings back sovereigns, half-sovereigns, silver and copper in 5s bags. The pay clerks make up the numbered tins. |
| Friday evening | Pay at the pay stations. Each worker hands in a pay card and gets a tin; cards are cancelled with a crayon mark; unclaimed pay goes back to the Cashier with a report. |
| Weekly | Each worker's health stamp (7d for men, 4d of it deducted; 6d for women) and unemployment stamp (2½d + 2½d) go on their card and book. |

### The month

- Monthly statements to agents.
- Supplier payments on the third Wednesday, after the directors approve the list of payments.
- The cost abstract every fortnight.
- The monthly trial balance.
- Petty cash topped back up to its float (the imprest system).

### The year

| When | What happens |
|---|---|
| October | New season's models settled; toolroom and pattern shop busy |
| Late November | Olympia show |
| End of December | Works restart after Christmas |
| December–March | Stocking agents and depots |
| February–May | Peak, with overtime |
| June–July | Work follows the orders |
| August | Stocktaking for the 31 August year end; the slack season begins |
| September–October | Audit |
| October–November | Annual general meeting; dividends declared |
| Autumn | Short time |

## 6. Production

### Process

The process follows Grew's 13 stations (report, section "Thirteen stations"):

1. **Rough stores.** The Work Depot issues a batch: lug sets, mitred tubes, rims and spokes.
2. **Machine shop.** Hubs, cones, cups, axles, cranks and chainwheels are made to stock, in parallel with everything else.
3. **Press shop and hardening.**
4. **Frame building.** Lugs and tubes are pegged in jigs.
5. **Brazing.** Gas-blown coke hearths, about 1.5–2 frames per brazer per hour **(est.)**.
6. **Pickling or sand-blast, then filing.** The biggest labour sink.
7. **Frame number.** Stamped under the bottom bracket after filing **(est.: the step isn't documented, but the number has to stay legible under enamel)**. Each number is entered in the Progressive Number Register.
8. **Iron polishing.**
9. **Finished-parts stores and view room.** Parts are gauged, counted and credited to the pieceworkers. Rejects go back with a viewing report and are reworked under an "X" sub-order.
10. **Finishing the parts:**
    - **Enamelling:** 3 coats at about 380 °F, 1–1½ h each, rubbed down with pumice between coats. A stove holds 100 frames.
    - **Lining and transfers:** transfers stoved 10–15 min at 150–200 °F.
    - **Plating**, at the same time.
    - **Wheel building**, at the same time.
11. **Finishing (assembly)** at pillar benches.
12. **Final viewer.** Weighs the machine, enters the number in the book, and tests the bearings, brakes and tyres.
13. **Wrapping, crating and despatch.** Machines are wrapped in paper or butter cloth. Home crates are 77 × 23 × 48 in; export machines are knocked down and packed in zinc-lined cases.

**Lead time:** about 1–2 weeks from issuing a batch to packed machines **(est.)**.

### Batches and how they're tracked

- A batch is the unit the stores issue, the size of a stove load, and the unit a work tally follows.
- Inside the shops a batch travels in trays of 25 under its one sub-order number **(choice)**. Moving whole batches of 100 through about 16 operations in turn made a batch take four weeks and left departments half idle. Trays bring it to about 2½ weeks from issue to the Stock Room, which is near the research estimate.
- A bicycle becomes an individual object, with its frame number, when the number is stamped. Before that, parts are counted lots: a bin of 2,000 spokes, a tray of 144 cones.

### Calibration (est.)

No British times per operation survive. So the minutes per unit for each operation are set so that each department, at its headcount, is about 85% busy at 270 machines a week. A few were checked against the sources: Carter's piece rate gives about 75 minutes to true a pair of wheels, and Humber's 200 polishers for 1,000 machines a week make polishing very labour-heavy.

Where the estimated headcounts left people with too little to do, they were trimmed: the wheel shop from 30 to 22, and wrapping from 15 to 6, plus 4 packers. This leaves about 375 hands.

In a simulated three weeks from 3 March, the works finishes 250–300 machines in a full week and fewer in Easter week. Departments are 55–95% busy.

### Rules the managers run on (est.)

| Who | Rule |
|---|---|
| Works Manager | Every Monday, sets the week's programme from the order book (A orders), the stock targets for the season (C orders, sanctioned by the managing director), and the shortage list |
| Storekeeper | Raises a purchase requisition whenever a stock card falls below its ordering level |
| Foremen | Take on hands in the spring and lay them off in the autumn |
| Progress chaser | Stamps urgent tallies "V.U." |

**How "Elbourne" the firm is** can be set. Elbourne's system was an ideal; a typical firm ran something simpler, like Spencer's. The default is a middle setting: Elbourne's office orders, purchasing, wages and work tallies, but not his cost allocation sheets.

## 7. Documents and books

### The model

Every document is a typed object with these properties:

- **Identity:** a form number, a title, its size and its paper colour.
- **Content:** its fields and values.
- **Copies:** an object per copy, all linked to one set. Each copy has its own colour, destination, and a flag for whether it carries prices. The top copy is white; the carbons are pink, yellow and blue **(choice)**, because the sources only say "distinctive colours".
- **Where it is:** in someone's hand, in a tray, in a pigeonhole, in a file, in the post, or entered in a book.
- **Markings:** corner cut, crayon cross, "V.U." stamp, red entry, receipt stamp.
- **History:** every move and every mark, with time and person.

A **book** is an append-only ruled register that sits somewhere physical, such as the sales day book on the invoice clerk's desk. Each entry points back to the document it came from.

### Document set for the first version

All are Elbourne's unless marked otherwise. The research notes catalogue about 85 documents in all.

**Post and correspondence:**
- the inwards correspondence register (telegrams entered in red);
- the postcard acknowledging an order;
- letters, with the signed original press-copied into the letter book;
- telegrams;
- departmental memoranda (in triplicate);
- the postage stamp book.

**Sales:**
- the six-copy office order, A/B/C/D series, with its corner cut once fully invoiced;
- the packing slip (triplicate);
- the advice of despatch (3 copies), with the invoice typed as a carbon of it;
- the sales day book and the sales ledger;
- monthly statements;
- credit notes, printed in red.

**Production:**
- the application for sanction to manufacture for stock;
- the production programme;
- work tallies with their coupons;
- stage tickets;
- viewing reports (triplicate);
- the works product note (triplicate);
- the Progressive Number Register;
- the weekly shortage list.

**Purchasing and stores:**
- the purchase requisition (triplicate);
- the purchase order (triplicate, with an unpriced copy for the receiving clerk);
- the goods received note;
- stock control cards;
- goods issue vouchers;
- suppliers' invoices;
- the bought ledger;
- the list of payments;
- the combined cheque and receipt, with a 1d receipt stamp for £2 or more.

**Wages:**
- the engagement form and the discharge note;
- the time card, which comes back as the pay card;
- job advice slips and job tickets;
- the overtime ticket, which is also the gate pass;
- extra pay slips;
- the wages sheet and the wages abstract (deductions in red);
- the coin list and pay tin slips;
- the unclaimed pay report;
- the fines register;
- health insurance cards and unemployment books.

**Railway and export** (from West's 1913 handbook and from Hooper & Graham):
- the consignment note, marked owner's risk or company's risk, and "Paid" or "To pay";
- the railway's delivery sheet;
- the monthly account with the LNWR;
- the advice note and freight note exchanged with the shipping agent;
- a set of 2–3 bills of lading, each with a 6d stamp;
- cases stencilled with shipping marks.

**The law and the company:**
- the general register;
- the abstract of the Factory Act and the other notices posted at the gate;
- accident notices;
- the certificate of fitness;
- the minute books;
- the register of members;
- the annual return.

### The commercial routine as built (milestone 4)

This is the routine as the simulation runs it. Figures marked (est.) are estimates.

- **The post:**
  - Orders arrive at about 19 a day, for about 245 machines a week (est.).
  - About two-thirds come in the morning bag, which the second office boy fetches from the Head Post Office at nine. The rest come with the postman after dinner.
  - The Secretary stamps each letter "received", numbers it, enters it in the Inwards Correspondence Register, and passes it to the order clerk or, with its cheque, to the Cashier.
- **Office orders:**
  - The order clerk looks up the account and types the six-copy office order.
  - The copies go to the invoice clerk's open-order file, the Works Manager's tray (his copy and the estimator's), the Works Office file (the drawing office's and the works office's), and the warehouse foreman.
  - What the Works Manager has read is filed in the Works Office.
  - A slow payer whose statement has gone three weeks unpaid has the order held until a cheque comes.
- **Allocation:**
  - The warehouse foreman allocates machines by model, pattern and frame size, and writes the frame numbers on his copy.
  - An order is sent complete if it can be. After three days what can be sent goes, "balance to follow", and the copy goes back on the file.
- **Despatch:**
  - Warehousemen get the machines down from the Stock Room, packers crate them one to a crate, and warehousemen weigh and stencil the crates.
  - The despatch clerk, at a desk in the warehouse, writes the packing slip and the advice of despatch, each in triplicate, plus the railway's consignment note.
  - The customer's copy of the advice goes by post, the office copies of both go to the General Office, and the warehouse copy waits on the dock with the crates.
- **Cartage:**
  - Two pair-horse lorries go to Warwick Road at set times when there are crates waiting (est.): the big lorry at 9.30, 1.30 and 4.30, the second at 11 and 3.15. Whichever of the three carmen is free takes one.
  - A round takes about an hour and a half: half an hour each way at a walk, plus backing up to the goods shed, unloading and waiting for the checker.
  - The consignment note stays with the railway, and the packing slip goes on with the goods. The checker signs the warehouse copy of the advice, which comes back to the despatch clerk.
  - Carriage on "Paid" consignments is posted to the L. & N.W.R. account at 2s. 6d. a crate (est.).
  - The carmen work longer hours than the shops, to 6.30 p.m. (est.), and are paid for them. The pay window stays open until they're off.
- **Invoices and ledger:**
  - The office copy of the advice is invoiced the same day and entered in the Sales Day Book.
  - The carbon goes to the sales ledger clerk, who posts it to the agent's account.
  - Statements go out in the first week of each month.
  - Agents pay 4–9, 11–20 or 24–40 days after the statement, by standing (est.). Those who pay by the 10th take 2½%.
- **Cash:**
  - The Cashier enters each cheque in the Cash Book and sends a receipt, with a penny stamp if it's for £2 or more.
  - He pays in at Lloyds at a quarter past eleven, and tops up the petty cash there when it runs low.
- **Wages and stamps in the ledger:**
  - The wages cheque is posted to Wages.
  - The insurance stamps come out of petty cash: the men's share to Wages, the employer's to National Insurance.
- **Stock and the programme:**
  - The Stock Room opens with 450 machines from the winter (est.).
  - The Works Manager still follows the season's programme cycle, but puts first any model the agents are waiting for that isn't covered by stock and work in hand.
- **Not yet built:** credit notes, telegrams, the letter book, export, and the B/C/D order series.

### Purchasing as built (milestone 5)

The routine is Elbourne's (1914), with Spencer's (1907) where they differ. Figures marked (est.) are estimates.

- **Stock control cards:**
  - The storekeeper keeps a card for each bought-in part (about two dozen) and for coal.
  - Each card has an ordering level of a week and a half's use plus the supplier's lead time, and a normal quantity of two weeks' use (est.).
  - The storekeeper looks through the cards at 8.40 and 2.15, and posts the day's issues to them before the end of the day.
- **Requisitions and orders:**
  - When stock plus what's on order falls to the level, the storekeeper writes a purchase requisition in triplicate. The Works Manager initials it (Spencer's "O.K. and initial each item").
  - The Buyer places it with the part's supplier. His clerk types the purchase order in triplicate: the top copy for the supplier, the second for the Buyer's file, and the third, without prices, for the Receiving Clerk. It is entered in the Purchase Orders Register.
  - The Managing Director signs any order over £50.
  - Orders go by the evening post. The Receiving Clerk's copy goes round with the office boy.
- **Suppliers:**
  - There are sixteen, plus the colliery: tubes, lugs, rims, spokes, balls, chains, hubs, gears, saddles, tyres and the rest, from Birmingham, Sheffield, Nottingham, Redditch, Chelmsford and Coventry itself. Some are real firms of the period and some are invented.
  - Each takes one to six working days to send the goods (est.), and posts an advice of despatch the same day. The invoice follows by separate post up to two days later.
  - The goods come by the L. & N.W.R. or the Midland (by the night goods, then the railway's van in the morning), by the supplier's own cart, or by parcel post. Coal comes by canal boat.
  - Nothing is delivered on a Sunday or a bank holiday.
- **Receiving:**
  - The Receiving Clerk signs the carman's delivery sheet or delivery note at the Rough Stores door, counts the goods against the unpriced copy of the order, and writes a goods received note in carbon duplicate. The duplicate stays in his book, and the entry goes in the Goods Received Book.
  - The goods go into the store, the stock card is posted, and the order copy is endorsed "received in full" and filed with the advice note.
  - The top copy of the goods received note goes to the Works Accounts Office.
- **Invoices:**
  - "Suppliers' invoices shall not be sent beyond the Works Accounts Office." There a cost clerk matches each invoice with its goods received note, prices the note, and passes and numbers the invoice (P.I. 1301 and so on).
  - The Bought Ledger clerk enters it in the Bought Day Book and posts it to the supplier's page in the Bought Ledger, against Purchases (or Coal and Fuel for the colliery's invoices).
- **Statements and pay day:**
  - At the start of the month each supplier sends a statement, and the L. & N.W.R. sends its monthly account for carriage. The Bought Ledger clerk checks each against the ledger and marks it agreed.
  - "Our pay day is the third Wednesday in the month" (Spencer). On the Monday before, the Bought Ledger clerk makes out the list of payments for everything delivered in the month before.
  - The Secretary checks the list and the Managing Director sanctions it. On the Wednesday the Cashier writes a combined cheque and receipt for each supplier, less 2½% for prompt payment (the railway's account is paid net), with a penny stamp on the receipt for £2 or more. They go by the evening post, and the receipts come back signed.
- **Opening state:** each card opens with some stock (est.), and orders already placed for anything below its level. February's purchases are owed as balances brought forward and are paid on 19 March.

### The goods yard and the coal boat as built (milestone 5)

**The yard** (after West, *Railway Goods Station Working*, 1912; numbers est.):
- **The staff:** eight railwaymen: a goods checker, a caller-off, three porters, a shunt-horse driver, a weighbridge clerk and the cartage foreman. They're on from six in the morning to a quarter to nine at night.
- **The morning:**
  - At half past five the shunt horse places last night's inward vans (an L. & N.W.R. and a Midland) and four empty open wagons at the goods shed.
  - The porters unload the vans onto the delivery bank.
  - At a quarter to eight the railway's vans load our packages there and take them to the works with a delivery sheet, which the Receiving Clerk signs.
  - Other traders' carts take away the rest during the day.
- **Our crates:**
  - The lorries back up to a bay, and the crates go onto the platform.
  - The checker checks them against the consignment notes and signs. The notes stay in the goods office, and the warehouse copy of each advice goes back with the carman.
  - The porters load the crates into the open wagons for the north and the south.
- **The evening:**
  - Between five and half past seven the traders' carts crowd the bays.
  - From a quarter to eight the porters sheet the loaded wagons.
  - At half past eight the shunt horse draws them out for the night goods, which takes every crate that came in that day.
- **Rolling stock:** lead-grey wagons. The L. & N.W.R.'s are lettered L N W R with white diamonds; the Midland's are lettered M R. Sheeted wagons stand in the sidings.

**Coal:**
- **Supply:** boiler slack comes from the Griff colliery near Nuneaton, by horse-drawn narrow boat down the Coventry Canal, 25 tons at a time (est.). It is ordered on a stock card like any other part.
- **The boat:**
  - It arrives in the late morning with the colliery's weight ticket.
  - The Receiving Clerk comes down to the wharf to sign the ticket.
  - The six yard labourers shovel the slack into barrows and wheel it to the coal yard, which takes about three hours.
  - The ticket is filed with the goods received note.
- **Use:** the two stokers barrow 3 cwt at a time from the coal yard to the boiler fronts, about two tons a day (est.).
- **On screen:** the heap in the coal yard grows and shrinks with the stock.

### Facsimiles

Clicking a document opens a facsimile: an HTML/CSS rendering of the printed form, set in a period-style serif.
- **Handwritten entries:** the clerks' entries use a script font.
- **Typed text:** a typewriter font.
- **Carbons:** coloured paper with slightly smudged text.
- **Markings:** stamps and crayon marks drawn on top.

Layouts follow the column lists in Elbourne's specimen forms. The research had no images of the forms, so the ruling is reconstructed.

### Invariants checked by tests

- **Books:** the trial balance always balances.
- **Stock:** stock on hand equals opening stock plus receipts minus issues, for every item.
- **Frame numbers:** every one is in the register exactly once.
- **Despatches:** every despatched machine has an advice of despatch, an invoice and a consignment note.
- **Wages:** the cash drawn equals the total on the wages abstract.
- **National Insurance:** stamps bought equal stamps fixed on cards and books.
- **Purchases:** every supplier's invoice paid is matched to a goods received note, and the Bought Ledger agrees with Sundry Creditors.
- **Pay day:** suppliers are paid on the third Wednesday, less 2½%, and their statements agree with the ledger.
- **The goods yard:** every crate carted to Warwick Road goes by a night goods, and the checker signs every consignment note.
- **Coal:** every boat-load has its weight ticket and goods received note, and the boilers never run short.

## 8. Simulation model

**Kernel:** a small discrete-event kernel in plain JavaScript, in the style of SimPy. Every actor (a worker, a clerk, a messenger, a carman, the Post Office, an agent's letter-writing) is a generator function that yields:

```js
function* openThePost(secretary, bag) {
  yield walkTo(secretary, 'general-office/secretary-desk');
  for (const letter of bag.contents) {
    yield work(secretary, 2);                 // minutes
    stamp(letter, 'received', sim.now);
    registerBook.enter({ no: nextNo(), from: letter.sender, re: letter.subject });
    yield give(letter, routeFor(letter));     // into the right tray
  }
}
```

The procedures then read the way the period textbooks describe them.

- **Clock:** minute resolution, with 1 January 1913 00:00 GMT as time zero. People's movement between events is interpolated so it renders smoothly.
- **Headless:** the sim never touches the DOM or three.js. It runs in Node for tests and for a "warm-up", where it simulates a few weeks so queues and work in progress fill up naturally before you start watching.
- **Determinism:** a seeded random number generator, so the same seed replays the same week.
- **Randomness, with seasonal rates (est.):**
  - order arrivals;
  - supplier delivery delays;
  - viewing rejects, about 3%;
  - absences, about 4%;
  - lateness;
  - rare accidents, which trigger the workmen's compensation and accident-notice paperwork.
- **Money:** integer farthings, because rates like 10¼d an hour need them. Displayed as £ s d, and as guineas where the period would.
- **Walking:** on a navigation graph of doors, stairs, the hoist and yard paths. Each place has capacity, such as stove space, bench places and hearths.
- **Starting state:** an opening trial balance as at 1 March 1913 consistent with the report's model accounts, plus opening stock, work in progress, an open order book, and each worker's earnings so far.
- **Speed:** pause, 1×, 10×, 60× and 600×, plus "skip to next morning".

## 9. The 3D view and interface

- **Look (choice; we'll iterate):** a muted low-poly diorama with soft shadows and an optional tilt-shift blur.
- **Palette:**
  - red-brown brick, slate roofs, soot-darkened chimney tops;
  - limewashed interiors;
  - Brunswick-green doors and window frames;
  - lead-grey LNWR wagons;
  - chocolate-and-cream tram.
- **Lighting:** follows the sun for the date and time. Gas and electric light glow from the windows on winter mornings.
- **Seeing inside:** the main block can be peeled back floor by floor, like an architect's model. Roofs fade out as you zoom in.
- **People:** small simplified figures. Their clothing colour shows their trade or role: flat caps on the shop floor, bowlers for foremen, aprons on the women wrappers. They are drawn with instancing so 430 of them stay cheap.
- **Goods:** batches are drawn as stacks or racks with a count. Crates, drays, horses, wagons and the coal boat are individual objects.
- **Paper:** documents are small coloured rectangles in hands and trays, with a "paper layer" toggle that brightens them and dims everything else.
- **Controls:**
  - **Clock:** "Tuesday 4 March 1913, 10:42 a.m.", with the speed controls.
  - **Layers:** people, goods and paper.
  - **Places:** works, goods yard.
  - **Floors:** the floor selector.
- **Clicking things:**
  - **A person:** name, works number, trade, rate, what they're doing now, and this week's time card.
  - **A document:** its facsimile and its history.
  - **A batch:** its work tally.
  - **A bicycle:** its frame number and its life so far.
  - **A room:** what department it is.
- **Follow mode:** the camera follows one thing through its life: an order from letter to cheque, a frame from tube to crate, or one man's week from clock card to pay tin.
- **Event log:** for example, "10:42 Letter No. 1,207 from J. Smith & Sons, Leicester: 6 Standard gent's. Passed to Order Dept."

## 10. Architecture: engine and scenario

You said we might build other factories in other periods later, so the code is split along one line, without a plugin framework:

```
historical-factory-sim/
  index.html                    three.js through an import map from a CDN; no build step
  engine/                       knows nothing about Coventry or 1913
    sim/        kernel, calendar and time, money and currencies, rng,
                world (places, people, lots, serial items), documents, books
    render/     scene, buildings from a layout spec, figures, props, camera, picking
    ui/         clock, inspector, facsimile frame, event log, layers
  scenarios/
    coventry-1913/
      index.js                  exports everything below as one object
      site.js                   buildings, floors, rooms, workstations, navigation graph
      calendar.js               timetable, holidays
      staff.js                  departments, trades, rates, name lists
      catalogue.js              models, bills of materials, routings, spares list
      documents/                form definitions and facsimile templates
      procedures/               the generator scripts: post, orders, production,
                                stores, purchasing, wages, despatch, month-end
      outside/                  agents, suppliers, LNWR, Post Office, bank, state
      opening-state.js          1 March 1913
  test/                         node --test: invariants above, plus a simulated week
```

**What's generic:**
- the event kernel;
- calendars and working timetables;
- £ s d, which serves any British scenario from 1700 to 1971, alongside other currencies;
- places, people, lots and serial items;
- documents with copies, and books;
- the renderer's building blocks: pitched, north-light and flat roofs, storeys, windows, chimneys, yards, water.

**What belongs to the scenario:** everything with a date on it.

A Wedgwood pottery in 1775 or a German works in 1913 would reuse the engine and supply its own scenario folder.

**Dependencies:** three.js only, loaded from a CDN, with no npm build. Tests run with Node's built-in test runner.

## 11. Build plan

Each milestone runs on its own and ends with the invariant tests passing.

1. **Skeleton.** The kernel, calendar, money and seeded random numbers; the site as plain blocks with floors and the navigation graph; 430 people who walk in, clock on, go to their places, break and go home; the clock and speed controls; the inspector for people.
2. **Production.** The catalogue, bills of materials and routings; stores; batches flowing through the shops with stoves and hearths as capacities; frame numbers; finished stock.
3. **Works paper.** Work tallies, stage tickets, job tickets, time cards, the wages week through to Friday's pay tins, National Insurance stamps and lateness fines.
4. **Commercial paper.** The post bag, agents' orders, the six-copy office order, despatch, consignment notes, the dray to Warwick Road, invoices, day books, ledgers, statements, cheques and the bank. *(Built; see "The commercial routine as built" in §7.)*
5. **Purchasing and logistics.** Requisitions, purchase orders, goods received notes, invoice matching and supplier payment; LNWR cartage; the canal coal boat; the goods yard diorama. *(Built; see "Purchasing as built" and "The goods yard and the coal boat as built" in §7.)*
6. **The year.** Seasonality, the show, the month-end routine, the cost abstract, stocktaking and the 31 August year end, the audit and the AGM, plus the inspector's visits and accidents.
7. **Polish.** Full facsimiles, follow mode, lighting and the tilt-shift look, and the surroundings (terraces, tram, pub).

Milestones 1–4 make a satisfying first thing to watch. I'd suggest a pull request at the end of milestone 2 or 3, and one per milestone after that.

## 12. Known compromises and open points

- **Unemployment insurance:** no ruling was found on whether cycle-making counted as an insured trade. The default is that men in engineering trades are insured, which the Act's "mechanical engineering" and "construction of vehicles" support.
- **Undocumented in Coventry:** daily timetables, office hours, overtime rates, building colours, the works hooter (it gets one anyway), how many frames went in a stove, trade discounts in 1913 and times per operation. All of these are marked (est.) or (choice) above.
- **Sources from other places and dates** are used where Coventry has none: Humber's 1897 floor plan, Swindon's gate practice and Birmingham women's wages. They're flagged in the report.
- **Elbourne describes an ideal**, which is why how "Elbourne" the firm is can be set.
- **The ground plan is invented.** The site is a composite, not a real Coventry plot. Ordnance Survey maps of about 1905–1914 could guide the street pattern later.

## 13. Decisions

These were agreed in conversation on 6 October 2026.

1. The firm's name and backstory stay as above.
2. The firm keeps its full size: about 400 hands plus 28 staff.
3. The default start is Monday 3 March 1913.
4. The build order is as in section 11.
5. Power: the sources point to gas engines as the commonest prime mover in 1912 Coventry ("usually gas or oil", Carter), and to electric motors spreading after Rudge-Whitworth switched around 1907. The Sherbourne works has a full steam plant instead. It's still well within period practice (Humber's 1897 works ran on a steam engine), and it's much more fun to watch.
