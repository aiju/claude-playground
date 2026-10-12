# Parts: what can be bought

Research date: 12 October 2026. Stock and prices are from OEMsTrade and
Findchips search pages fetched that day. They change, so check them again
before buying. Timing comes from the Motorola data books:

| Tag | Document |
|---|---|
| R6 | Motorola *MECL Data*, DL122 Rev 6 (1996); book page `2-n` |
| DL140 | Motorola *High Performance ECL Data (ECLinPS)*, DL140 Rev 4 (1996) |
| HB205 | Motorola *MECL System Design Handbook*, 4th edition (1989) |

All three are on bitsavers (`components/motorola/_dataBooks/`). The SRAM
and translator figures come from current onsemi and Infineon data sheets.

## The short version

- **The whole MC10H family is obsolete.**
  - onsemi has no product page for any 10H part checked.
  - Most parts are still stocked by authorised aftermarket sellers, mainly
    Rochester Electronics and Verical.
- **Two price levels.**
  - A part is cheap ($1–6) when some package of it is stocked in quantity,
    often the SOEIAJ-16 (5.3 mm SO) version.
  - Otherwise it's $28–36 a piece from Rochester's lead-free lots.
- **The ALU (10H181) and its carry look-ahead (10H179) can only be had
  from brokers.** That is the biggest parts problem in the design.
- **The 10E422 register-file RAM (Cypress CY10E422L) can be bought:**
  about 5,000 in stock at $10–15.
- **The memories are modern 10 ns 5 V SRAMs** behind 10H translators. They
  are cheap and current.

## Draft 0's parts list against stock

The netlist (`python3 -m emc hw bom`) uses only part types that are
stocked, except the ALU chips. Two choices were made for availability:

- **Decoders are built from gates.** The 10H162 (and 10H161) decoders are
  broker-only, so each decoder output is one 5-input NOR from a 10H109.
  This costs 28 more packages and no speed.
- **Gates come from the 10H101, 10H102 and 10H109 ($1–2).** The 10H105
  and 10H103 would save 19 packages, but cost about $28 each.

| Part | Qty | Rating | Cheapest package with enough stock | Price | Cost |
|---|---:|:---:|---|---:|---:|
| 10H109 dual 4-5 OR/NOR | 191 | A | MELG (SOEIAJ-16), 30,282 | $2.19 | $418 |
| 10H174 dual 4:1 mux | 163 | A | MG (SOEIAJ-16), 4,900 | $3.46 | $564 |
| 10H176 hex D flip-flop | 96 | A | MEL (SOEIAJ-16), 1,242 | $2.94 | $282 |
| 10H158 quad 2:1 mux | 46 | A | FNR2G (PLCC-20 reel), 2,300 | $1.72 | $79 |
| 10H101 quad OR/NOR | 29 | A | P (DIP-16), 15,124 | $1.13 | $33 |
| 10H124 TTL→ECL | 26 | A | MG (SOEIAJ-16), 3,696 | $3.78 | $98 |
| 10H164 8:1 mux | 25 | A | M (SOEIAJ-16), 3,183 | $3.09 | $77 |
| **10H181 4-bit ALU** | 24 | **C** | brokers only | ? | ? |
| 10H210 clock fan-out OR | 19 | A | MG (SOEIAJ-16), 5,793 | $3.99 | $76 |
| 10H102 quad NOR | 17 | A | P (DIP-16), 7,235 | $1.13 | $19 |
| 10E422 256×4 RAM, 7 ns | 16 | A | Cypress CY10E422L-7, 4,972 | $10–15 | ~$190 |
| 10H125 ECL→TTL | 12 | B | PG (DIP-16), 40,669 | $30.22 | $363 |
| 10H166 5-bit comparator | 12 | B | PG (DIP-16), 7,199 | $32.16 | $386 |
| 10H188 hex buffer with enable | 12 | B | PG (DIP-16), 5,185 | $32.00 | $384 |
| CY7C1049G-10 512K×8 SRAM | 8 | A | -10VXI (SOJ-36), Mouser 2,162 | $4.30 | $34 |
| **10H179 carry look-ahead** | 6 | **C** | brokers only | ? | ? |
| 10H107 triple XOR | 4 | B | PG (DIP-16), 10,113 | $30.00 | $120 |
| 10H601 9-bit ECL→TTL, 3-state | 4 | B | FNR2G (PLCC-28), 3,207 | $36.04 | $144 |

- **Ratings:**
  - **A:** stocked in quantity at about $6 or less.
  - **B:** stocked, but only at the $28–36 price level.
  - **C:** brokers only.
- **Totals:**
  - 636 A-rated packages, about $1,900.
  - 44 B-rated packages, about $1,400.
  - 30 C-rated packages.
  - The behavioural multiply/divide unit isn't counted.
- **Packages are mixed** (DIP-16, SOEIAJ-16, PLCC-20/28). The cheap lot
  is often the SO. Most parts also come in the other packages at the
  higher price level.
- **The B-rated parts are cheap to design out:**
  - the 10H188 enables could become 10H174/10H164 enables or gates;
  - the 10H166s used for equality could be XOR/NOR trees;
  - the translators have no cheaper replacement (see below).

### The ALU problem

The 10H181 and 10H179 are used three times: in the ALU, in the PC
incrementer, and in the branch-target adder. That is 24 + 6 packages.

**Options:**

1. **Buy from brokers.** They claim large stock: 60 offers for the 10H181
   and 36 for the 10H179. Quality and authenticity are unknown, so test
   every part. Only the ALU really needs them.
2. **Fairchild F100181 and F100179** (100K family). These can be bought:
   Rochester has about 1,600 of the 100181DC at $8 and about 900 of the
   100179DC at $4.60.
   - They run on −5.2 V.
   - But 100K outputs driving 10H inputs leave only 35 mV of high-level
     noise margin over temperature (DL140 table 4-1), against 150 mV
     10H-to-10H. 10H driving 100K is fine.
   - That would need differential receivers, or a temperature-controlled
     card cage, or keeping the 100K outputs inside a 100K island.
3. **Design the incrementer and the target adder without 10H181s.**
   - PC + 4 is an incrementer, which is AND chains and XORs.
   - The target adder could become a carry-select adder from 10H158s
     and gates.
   - That leaves 8 + 2 broker parts, for the ALU only.
4. **An ALU from gates.** About 32 XOR sections plus a carry tree: maybe
   40–50 packages, and probably slower than the 10H181 and 10H179.

This is one of the questions in [evaluation-v0.md](evaluation-v0.md).

## ECLinPS (MC10E / MC100E): the speed option

ECLinPS registers and muxes are 3–5 times faster than 10H.

| Part | What | Clock→Q or data delay (max) | Setup / hold | vs 10H |
|---|---|---|---|---|
| E151 | 6-bit D register | 0.80 ns | 0 / 0.35 | 10H176: 2.4 ns, setup 1.5 |
| E158 | 5-bit 2:1 mux | D 0.55, select 0.775 | | 10H158: 2.0 / 2.9 |
| E171 | 3-bit 4:1 mux | D 0.65, select 0.85 | | 10H174: 2.6 / 3.2 |
| E166 | 9-bit comparator | 1.40 | | 10H166 (5 bits): 4.1 |
| E111 | 1:9 clock driver | 0.61, 50 ps skew within the part | | |

- **No arithmetic.** There's no ECLinPS adder, ALU or carry look-ahead.
- **Levels:**
  - MC10E parts have 10H levels and mix freely with 10H.
  - MC100E parts have 100K levels, so the 35 mV problem applies when they
    drive 10H inputs single-ended.
- **Packaging:** all the parts in the table are PLCC-28, and the PLCC
  family is out of onsemi's catalogue.
- **Stock:**

  | Part | MC10E (10H levels) | MC100E (100K levels) |
  |---|---|---|
  | E151 | Rochester 5,731 at about **$36** | about 5,300 at **$5.85** |
  | E111 | 7,427 at $5.85 | |
  | E158 | Rochester 1,939 at $5.84 | 4,645 at $5.84 |
  | E167 (mux-register) | 1,968 at $5.84 | |

- **Consequence for draft 0:** the "E151 registers" timing variant (36
  MHz instead of 32.6) means 96 × MC10E151 at about $36, so roughly
  $3,500 more. The alternative is MC100E151s used with care (differential
  outputs into 10H differential inputs, or 100K-level islands).

## Memories

**Register file.** The only ECL RAM available in quantity is the Cypress
CY10E422L / CY100E422: 256×4, 5–7 ns.

| Part | Stock | Price |
|---|---|---|
| CY10E422L-7 (10H levels) | 4,972 + 994 + 460 across package versions | $9.82–14.83 |
| CY100E422 (100K levels) | about 2,250 | $7.42–10.89 |

Draft 0 uses 16 of them: two read copies × 8 chips. Only 32 of each
chip's 256 words are used. The leftover space could hold more register
sets (open question 6 in the evaluation).

Bigger ECL RAMs (1K×4, 4K×4) come only in lots of 100–300 at $20–80, and
the 10H145 (16×4) only from brokers. So local memory is TTL-level CMOS
SRAM behind translators.

**Local memories: Infineon (Cypress) CY7C1049G-10VXI.**

| | |
|---|---|
| Organisation | 512K × 8, 5 V |
| Package | SOJ-36 |
| Read | tAA 10 ns, tOE 4.5 ns |
| Write | tWC 10, tAW 7, tWP 7, tDW 5 ns; tAS, tDH and tWR 0 |
| Status | Active, at Mouser, Arrow, Future and Newark for $4–5 |

- Four chips make a 2 MB 32-bit bank, and draft 0 has one bank each for
  instructions and data.
- The CY7C1049GN-10 is equivalent.
- The CY7C1041GN-10 (256K × 16) halves the chip count and the address
  loading.
- Data in and out share pins, so writes go through 3-state 10H601s.

## Translators

No part in production translates 5 V TTL to −5.2 V ECL. The obsolete but
stocked 10H parts do the job:

| Part | Direction | Max delay | Stock | Used for |
|---|---|---|---|---|
| 10H124 | TTL→ECL, 4 bits, complementary outputs | 2.95 ns | A | memory read data, instruction word (its complement outputs save inverters in decode) |
| 10H125 | ECL→TTL, 4 bits | 3.4 ns | B | SRAM addresses and write enables |
| 10H601 | ECL→TTL, 9 bits, 3-state, 48 mA | 4.8 ns | B | store data |
| MC100EPT25 | ECL→3.3 V TTL, 1 bit | 0.8–1.6 ns | active | the speed option for addresses and write enable (needs +3.3 V) |

The 9-bit 10H600 (TTL→ECL) adds about 2 ns over the 10H124 on the read
path, which is too much at this clock rate.

## Clock

- **Recommended tree:** an oscillator into an MC10EL11 (active), then two
  or three MC10E111 1:9 drivers (Rochester has 7,427 at $5.85).
- That feeds 15–18 terminated lines with 3–4 loads each, at about 0.5 ns
  of skew. The timing analysis assumes that figure.
- A tree of 10H209/210 gates alone can exceed 1 ns.
- In draft 0, the clock-gating 10H210s sit in the last level, one per
  domain and load group. The E111 tree drives them.
- **Strobes:** the register-file and data-memory write strobes, and the
  register-file address select, need edges at fixed times in the cycle
  (`emc hw sta` places them).
  - The cleanest source is a multi-phase clock from a faster oscillator,
    for example 4 × 40 MHz phases from 160 MHz with a 10H131 Johnson
    counter.
  - The Microchip SY100EP195V programmable delay runs at −5.2 V and is in
    production; it can trim edges.

## Power

From `python3 -m emc hw bom`, with the data books' maximum supply
currents at 25 °C:

| Rail | Current | Power |
|---|---:|---:|
| −5.2 V (V<sub>EE</sub>) | about 42 A | about 220 W |
| +5 V (translators, SRAMs) | about 2.6 A | about 13 W |
| −2 V (V<sub>TT</sub>, termination) | about 34 A (2,400 terminated outputs at about 14 mA on average) | about 67 W, including the output stages |

- **Total:** about 300 W, worst case.
- **V<sub>TT</sub>** needs a separate −2 V supply that sinks current. A
  Thevenin pair per line costs 144 mW instead of 13 mW (HB205). Ripple
  and regulation aren't critical.
- **Fewer terminators:** many nets are short and stay inside one block.
  10H allows an unterminated stub of up to about 1 inch (R6 1-24), so a
  real layout would terminate fewer than 2,400 outputs.
- **Supplies:** keep the ECL core on −5.2 V, with ground as the quiet
  reference. Add separate +5 V (and +3.3 V if MC100EPT25s are used)
  supplies for the TTL side, all on one ground plane. PECL (ECL on +5 V)
  would share its reference with the TTL bus's noise.
