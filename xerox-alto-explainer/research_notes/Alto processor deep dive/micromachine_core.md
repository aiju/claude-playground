# Alto processor deep dive: the micromachine core and the Nova emulator

Scope: the datapath, the microinstruction format, next-address logic, the control store, the clock, the physical boards, the Mu assembler, and the Nova ("BCPL") emulator microcode, with cycle-accurate traces. Display, disk and Ethernet microcode, BitBLT and design rationale belong to the other researchers and appear here only where they touch the core.

Everything below was read from full-text primary sources in this session (scans rendered and read where there was no text layer). Octal numbers carry a trailing **B** or are marked "octal", following Xerox usage. Xerox numbers bits from the MSB: bit 0 is the most significant.

---

## 0. Sources and citation keys

| Key | Document | Where | How cited |
|---|---|---|---|
| **HW79** | *Alto: A Personal Computer System, Hardware Manual*, May 1979 (covers microcode Alto I v24, Alto II v3) | [part1](http://bitsavers.trailing-edge.com/pdf/xerox/alto/AltoHWRef.part1.pdf), [part2](http://bitsavers.trailing-edge.com/pdf/xerox/alto/AltoHWRef.part2.pdf) (scans) | § number + printed page; "p1-PDF n" = PDF page n of part1 when the printed number was not legible |
| **HW76** | Same manual, August 1976 revision | [Alto_Hardware_Manual_Aug76.pdf](http://bitsavers.trailing-edge.com/pdf/xerox/alto/Alto_Hardware_Manual_Aug76.pdf) (has text layer) | § + printed page (PDF page in brackets) |
| **UC** | `ALTOIICODE3.MU`, Xerox 1979 Alto II ROM microcode (the plain-text file prints `←` as `_`) | [altoIIcode3.mu.txt](http://bitsavers.trailing-edge.com/pdf/xerox/alto/microcode/altoIIcode3.mu.txt) | label, plus line number in the bitsavers text file |
| **UC-addr** | The same file annotated by Josh Dersch (2015) with the PROM address of every microinstruction, e.g. `EM0020> START:` | [ContrAlto Disassembly/altoIIcode3.mu](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu) | label + octal address |
| **UC-lst** | The printed listing of AltoIICode3.mu, header dated 30-Dec-78 (shows real `←` glyphs) | [AltoIICode3.mu.pdf](http://bitsavers.trailing-edge.com/pdf/xerox/alto/AltoIICode3.mu.pdf) | listing page (PDF page) |
| **CONSTS** | `ALTOCONSTS23.MU`, the symbol and constant definitions (Boggs/Taft 1977–79) | [altoconsts23.mu.txt](http://bitsavers.trailing-edge.com/pdf/xerox/alto/microcode/altoconsts23.mu.txt) | line number |
| **CSL79** | Thacker, McCreight, Lampson, Sproull, Boggs, "Alto: A Personal Computer", CSL-79-11 (Aug 1979) | [scan](https://bwlampson.site/25-Alto/25-Alto.pdf), [OCR](https://bwlampson.site/25-Alto/25-AltoOCR.htm) | printed page / figure / § |
| **TH86** | Thacker, "Personal Distributed Computing: The Alto and Ethernet Hardware" (ACM HOPW, 1986) | [bwlampson.site PDF](https://bwlampson.site/38-AltoSoftware/ThackerAltoHardware.pdf) | printed page |
| **LAMP86** | Lampson, "Personal Distributed Computing: The Alto and Ethernet Software" (1986) | [PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf) | § |
| **MU** | "Mu: Alto Microassembler" (Ed Taft, 25 Mar 1978), pp. 77–83 of *Alto Subsystems*, Oct 1979 | [AltoSubsystems_Oct79.pdf](http://bitsavers.trailing-edge.com/pdf/xerox/alto/AltoSubsystems_Oct79.pdf) (scan) | printed page |
| **SCH-CTL / SCH-ALU / SCH-DISP / SCH-CRAM** | Alto II schematics: Control board 216695A (1K XM, material list dated 3/5/76), ALU board 216381D, Display Control 216339C, CRAM 216643A | [bitsavers schematics](http://bitsavers.trailing-edge.com/pdf/xerox/alto/schematics/) | drawing + sheet |
| **CA** | ContrAlto emulator source, commit 9d1cd93 | [GitHub](https://github.com/livingcomputermuseum/ContrAlto) | file |
| **KS-x** | Ken Shirriff, righto.com Alto posts: [day 4](https://www.righto.com/2016/07/restoring-y-combinators-xerox-alto-day_31.html), [day 5](https://www.righto.com/2016/09/xerox-alto-restoration-day-5-smoke-and.html), [day 9](https://www.righto.com/2016/10/restoring-ycs-xerox-alto-day-9-tracing.html), [day 10](https://www.righto.com/2016/10/restoring-ycs-xerox-alto-day-10-new.html), [intro](https://www.righto.com/2016/06/y-combinators-xerox-alto-restoring.html), [Mandelbrot 2](https://www.righto.com/2017/06/improvements-to-xerox-alto-mandelbrot.html), [Bitcoin](https://www.righto.com/2017/07/bitcoin-mining-on-vintage-xerox-alto.html) | as named |
| **KAY93** | Kay, "The Early History of Smalltalk" (HOPL-II) | [worrydream copy](https://worrydream.com/EarlyHistoryOfSmalltalk/) | § IV |

Local copies for the team are in the shared folder `…/scratchpad/alto-sources/`: `HW79_part1_ocr.txt` and `HWRef79_part2_ocr.txt` (OCR text of the 1979 manual), `Aug76.txt`, `25-Alto.pdf`, `ThackerAltoHardware.txt`, the schematics PDFs, `AltoSubsystems_Oct79.pdf` and `AltoIICode3.mu.pdf`.

---

## 1. The datapath

### 1.1 One-paragraph picture

A 16-bit **processor bus** feeds the A input of a 16-bit **ALU**. The ALU's B input is always the **T** register. The ALU output can load **L**, **T** (for some functions only), **MAR**, and on RAM-equipped machines **M**. L feeds a **shifter**. The shifter output is the only path into the **R** register file, and R drives the bus. Everything is loaded simultaneously at the end of a single 170 ns cycle (HW79 §2.0–2.1, pp. 3–4; CSL79 Fig. 6 p. 11; HW76 Fig. 1 [PDF 6]).

### 1.2 The bus

- It is 16 bits wide, and memory, ALU, registers and I/O controllers all hang on it (CSL79 §2.4 p. 13).
- It is a **wired AND**. If several sources are gated in the same microinstruction, the bus carries the AND of their values, "regardless of the means by which the sources are enabled (BS, F1, or F2)" (HW79 p. 5). This is used deliberately for masking: a bus source ANDed with a mask constant.
- With **no source** (BS=2) the bus reads all ones. **Loading an R register (BS=1) forces the bus to 0**, "so that an ALU function of 0 and T may be executed simultaneously" (HW79 pp. 4–5).

### 1.3 The ALU

- **Chips:** four **SN74S181** 4-bit ALU slices plus one **74S182** carry-lookahead generator. The ALU board's material list shows 4× 74S181 (A7, A9, A17, A19) and 1× 74S182 (A40) (SCH-ALU, material list). CSL79 §2.4 p. 13 says "four SN74S181 ICs". KS-intro says four 74181. HW76/HW79 say "SN74181 type".
- **Function mapping:** the 4-bit ALUF field goes through a PROM that drives the 181's S3–S0, M and carry-in lines (HW79 p. 4; CSL79 p. 13). The manual says the 74181 "can do a total of 48 arithmetic and logical operations, most of which are relatively useless" (HW76 p. 5; HW79 p. 4). CSL79 p. 13 says "64". Both are defensible counts: 16 logic functions, plus 16 arithmetic functions × 2 carry-in values, is 48, while 16 × 2 × 2 is 64.

ALUF table (HW79 p. 4; HW76 p. 5 [PDF 8]; CONSTS lines 76–95). "*" means T is loaded from the **ALU output** instead of the bus when this function is used together with LoadT.

| ALUF (octal) | Function | 74181 S3 S2 S1 S0, M, Cn | 181 operation |
|---|---|---|---|
| 0 | BUS (*in HW79 only) | 1111, 1, 0 | A |
| 1 | T | 1010, 1, 0 | B |
| 2 | BUS OR T * | 1110, 1, 0 | A + B (logical OR) |
| 3 | BUS AND T | 1011, 1, 0 | AB |
| 4 | BUS XOR T | 0110, 1, 0 | A XOR B |
| 5 | BUS + 1 * | 0000, 0, 0 | A PLUS 1 |
| 6 | BUS − 1 * | 1111, 0, 1 | A MINUS 1 |
| 7 | BUS + T | 1001, 0, 1 | A PLUS B |
| 10 | BUS − T | 0110, 0, 0 | A MINUS B |
| 11 | BUS − T − 1 | 0110, 0, 1 | A MINUS B MINUS 1 |
| 12 | BUS + T + 1 * | 1001, 0, 0 | A PLUS B PLUS 1 |
| 13 | BUS + SKIP * | 0000, 0, SKIP′ | A PLUS 1 if the emulator's SKIP flag is set, else A |
| 14 | BUS . T * (AND) | 1011, 1, 0 | AB, the same 181 operation as ALUF 3 |
| 15 | BUS AND NOT T | 0111, 1, 0 | A AND NOT B |
| 16–17 | undefined; CONSTS line 93 says a "ZEROALU" request is "unlikely ever to be implemented" | — | — |

- The mapping yields **13 distinct 74181 operations**. ALUF 3 and 14 are the same AND and differ only in whether T is loaded from the bus or from the ALU. CSL79 Fig. 5 and p. 13 count "fourteen" useful codes. HW76/HW79 say the field maps to "16 most useful functions", but two of those are undefined.
- **BUS+SKIP** feeds the emulator's SKIP flip-flop into the 74181's carry-in. This is how a Nova skip instruction costs zero cycles (see §3.7).
- **Carry:** the F2 branch ALUCY tests **ALUC0**. This is the carry "produced by the ALU during the most recent microinstruction that loaded L", *not* the carry of the current microinstruction (HW79 p. 6; CA `Task.cs` implements exactly this). Logical operations (M=1) force carry-out to 0 (HW79 p. 4).
- The emulator's Nova **CARRY** flag is a separate flip-flop, "distinct from the microprocessor's ALUC0 bit" (HW79 §3.5 p. 31).

### 1.4 Registers

| Register | Size | Loaded from / when | Notes | Source |
|---|---|---|---|---|
| **R** | 32 × 16 | from the **shifter output** (i.e. from L) when BS=1 (`Rname←`); read onto the bus with BS=0 | You cannot read and load the same R in one microinstruction. The low 2 bits of RSELECT can be replaced by IR fields (emulator). R37 is special: MAR← with RSELECT=37B starts a refresh cycle. | HW79 pp. 3–4, 7; HW76 p. 4 |
| **S** (RAM board) | 31 usable × 16 (1K CRAM); **8 banks × 31** on the 3K-RAM option | from **M** (no shifter in the path) | Only RAM-related tasks see them. Reading S with RSELECT=0 returns M, hence 31 usable. Mu names them R40–R77, and M = R40. The bank per task is set by SRB← (F1=13B, non-emulator) or ESRB← (F1=15B, emulator) from BUS[12–14]. The S RAM is 40 ns (HW76). | HW79 §8.7 pp. 60–61; HW76 §8.0 p. 44 |
| **T** | 16 | bus, or ALU output for starred ALUFs, when LoadT=1 | Always the ALU's B input. Loading T also loads the control-RAM address register from the ALU output. | HW79 p. 4; HW76 §8.2 p. 44 |
| **L** | 16 | ALU output when LoadL=1 | Feeds the shifter, and so indirectly R. SH<0 and SH=0 test the shifter output. | HW79 pp. 3–6 |
| **M** (RAM board) | 16 | ALU output when LoadL=1, in RAM-related tasks only | The "analog of L" for the S registers. It also supplies the high half of a WRTRAM. | HW79 §8.7 p. 60 |
| **MAR** | 16 | ALU output with F1=1 (`MAR←`), which also *starts* a memory reference | `XMAR←` (F1=1 plus F2=6) selects the task's alternate bank on the Alto II XM | HW79 pp. 5–6, 9 |
| **MD** | — | not a CPU register: BS=5 (`←MD`) reads memory data, F2=6 (`MD←`) writes the bus to memory | The Alto II latches read data | HW79 pp. 6–7 |
| **IR** | 16 | F2=14B `IR←` (emulator only) | High bits cannot be read. `←DISP` (BS=7) reads IR[8–15], sign-extended unless X=0. | HW79 §3.5 pp. 30–31; CA `Task.cs` |
| SKIP, CARRY | 1 each | set by `DNS←` | Emulator state; `IR←` clears SKIP | HW79 §3.5 p. 31 |
| **MPC RAM** | 16 × 12 | NEXT bus, every cycle | One micro-PC per task; the only per-task state the hardware saves | HW76 §2.4 p. 8; CSL79 p. 10 |
| **MIR** | 32 | control-store output at the end of each cycle | Microinstruction register | HW76 p. 8; CSL79 p. 10 |

- Timing rule, stated for programmers: registers hold their values during the whole cycle, and at the end of the cycle "they are loaded instantaneously and simultaneously" (HW79 pp. 3–4). So `PC← L, L← T` (UC `MAYBE:`) writes the old L into PC while L takes T's value, in one cycle.
- Emulator register map (UC lines 593–594 and 666–670): **AC0=R3, AC1=R2, AC2=R1, AC3=R0**, NWW (interrupts waiting) = R4, SAD = R5, **PC = R6**, XREG = R7. The source comments why the accumulators are backwards: "AC'S ARE BACKWARDS BECAUSE THE HARDWARE SUPPLIES THE COMPLEMENT ADDRESS" (UC line 666). The hardware substitutes (IR field XOR 3) into RSELECT[3–4].

### 1.5 Shifter

- F1=4 `L LSH 1`, F1=5 `L RSH 1`, F1=6 `L LCY 8` (rotate by 8, i.e. a byte swap). The vacated bit is normally filled with 0 (HW79 p. 5).
- Emulator-only modifiers:
  - `DNS←` (F2=12B, "do Nova shifts") does the Nova's 17-bit rotate through CARRY, writes R[DestAC] unless the Nova no-load bit IR[12] is set, and sets SKIP.
  - `MAGIC` (F2=11B) makes LSH/RSH shift T's high or low bit into the vacated position, giving double-length shifts. Mu spells this `L MLSH 1` / `L MRSH 1`.
  - (HW79 §3.5 p. 31; CONSTS lines 54–56.)
- The shifter output is what gets written into R, and it is also what SH<0 and SH=0 test. It is computed from L's value *at the start* of the microinstruction (HW79 p. 6 footnote).

### 1.6 Constant PROM

- 256 words × 16 bits (HW76 §2.2 p. 6; HW79 p. 6). **About 200 of the 256 were used** (CSL79 p. 13).
- It is **addressed by concatenating RSELECT (5 bits) and BS (3 bits)** (HW79 p. 6). A constant is not a field of its own: it is a reuse of the register-select and bus-source fields as an 8-bit address.
- It is gated onto the bus when F1=7, F2=7 (`←CONSTANT`), or **BS≥4**. With BS≥4 the constant is ANDed with that bus source, giving up to 32 masks per source (HW79 p. 6). Example: `$M17 $M6:000017; Constant normally ANDed with MOUSE` (CONSTS line 116). A plain `←DISP` is therefore always ANDed with *some* BS=7 constant. The file defines `ALLONES7` ("Constant normally ANDed with DISP") for that, next to real masks like `X17` (CONSTS lines 117–120). That the all-ones mask sits at RSELECT=0 is my inference; the file does not say.
- Alto I caveat: only −1 can be used with ←MD, because parity is computed on the bus (HW79 p. 6).
- Mu treats the constant **0** specially: it is not taken from the PROM if an R load already forces the bus to 0 (MU p. 79–80; CONSTS line 112 calls it "SUPER SPECIAL").
- Where the constant PROM sits physically: **not verified**. There are no obvious 4× 256×4 PROMs on the ALU board's material list.

### 1.7 Bus sources (BS, 3 bits)

(HW79 pp. 4–5; HW76 p. 5; CONSTS lines 24–33)

| BS | Name | Source |
|---|---|---|
| 0 | `←Rname` | read R[RSELECT] |
| 1 | `Rname←` | load R from the shifter; bus forced to 0 |
| 2 | (none) | bus = all ones |
| 3 | task-specific | e.g. disk `←KSTAT`; in RAM-related tasks `←S` |
| 4 | task-specific | e.g. disk `←KDATA`, Ethernet input data `EIDFCT`; in RAM tasks `S←` (bus undefined) |
| 5 | `←MD` | memory data |
| 6 | `←MOUSE` | BUS[12–15] = mouse bits, the rest ones |
| 7 | `←DISP` | IR[8–15], sign-extended if IR's X field ≠ 0 |

### 1.8 The memory interface: MAR←, MD, and the cycle rules

Numbering convention: **the microinstruction that does MAR← is "cycle 1"** (HW79 p. 7; CA `MemoryBus.cs` "Memory cycle 1 is the instruction in which a MAR<- is executed"). HW76 counts the same events as "the fourth cycle after MAR has been loaded", so its numbers are one lower.

| Rule | Alto II | Alto I | Source |
|---|---|---|---|
| Earliest touch of MD | at least **one microinstruction must intervene** (cycle 2 must not use MD) | same | HW79 rule (a) p. 6 |
| Memory cycle length | **5 microcycles = 850 ns**; 6 for a double-word | same | HW79 rule (b) p. 6; CSL79 p. 4 ("850ns (five microinstruction cycles)") |
| Read (`←MD`) | first word in **cycle 5**, second word of the doubleword (adr XOR 1) in cycle 6. Data is latched, so it can be read any time after cycle 5 | cycle 5; odd word in cycle 6 | HW79 rules (g), (h) p. 7 |
| Store (`MD←`) | **cycle 3 or 4**, "may not be issued later than cycle 4"; a double store uses cycles 3 and 4, to adr and adr XOR 1 | cycle 5 (6 for the second word on modified machines) | HW79 rule (f) p. 7 |
| Too early | the processor **suspends**: the system clock stops until the interface is ready | same | HW79 rule (b); §8.8 p. 61 ("waiting for memory data" stops the clock) |
| Back-to-back | MAR← cannot share an instruction with ←MD of the previous access; a new MAR← stalls until the previous cycle ends | same | HW79 rule (e) p. 7; CA `MemoryBus.Ready` |
| Abandoning | legal: just never read MD, or start a new MAR← | | HW79 rule (b) |

- Canonical Alto II fetch from the manual (HW79 p. 8): `MAR← ANY; REQUIRED; SUSPEND; SUSPEND; wherever←MD`. Put useful work in the three middle slots and the fetch is free.
- Peak bandwidth: 32 bits / (6 × 170 ns) = **31.3 Mbit/s** (CSL79 p. 14).
- The Alto II "exchange" idiom: two MD← stores, then two ←MD reads, all under one MAR← (HW79 p. 9).

---

## 2. The microinstruction format

### 2.1 Fields (32 bits, bit 0 = MSB)

| Bits | Field | Width | Meaning |
|---|---|---|---|
| 0–4 | **RSELECT** | 5 | R (or S) register; also the high 5 bits of a constant address |
| 5–8 | **ALUF** | 4 | ALU function (table in §1.3) |
| 9–11 | **BS** | 3 | bus source (table in §1.7) |
| 12–15 | **F1** | 4 | special function 1 |
| 16–19 | **F2** | 4 | special function 2 |
| 20 | **LoadT** | 1 | load T |
| 21 | **LoadL** | 1 | load L (and M in RAM tasks) |
| 22–31 | **NEXT** | 10 | address of the successor, "subject to modifiers" |

- Sources: HW79 §2.1 p. 3; HW79 §8.3 p. 57; CA `MicroInstruction.cs` (masks 0xF8000000 … 0x3FF).
- **Conflict (bits 20/21):** HW76 §2.1 p. 4 [PDF 5] and CSL79 Fig. 5 (p. 10) draw **LL at bit 20 and LT at bit 21**. HW79 §2.1 (revised text: "20 T Load T; 21 L Load L & M"), the RAM word layout in *both* manuals' §8.3 (low half: bit 4 = Load T, bit 5 = Load L), and CA (which executes the real PROM images) all put **LoadT at bit 20 and LoadL at bit 21**. Use the HW79 order on screen.
- In the RAM word format, the top bits of F1, F2 and LoadL are stored **inverted**, as "an artifact of hardware microinstruction decoding" (HW79 §8.3 p. 57). Worked example from the manual: `L←MD, TASK, :LOCA` with LOCA=325B is stored as **000132 / 100325** (octal). I recomputed this from the field widths and it matches. KS-day4 remarks that some PROM bits are "inverted for no good reason (probably to save an inverter chip somewhere)".

### 2.2 Standard F1 and F2 (the same meaning in every task)

"The first eight conditions specified by each field (except BLOCK) are interpreted identically by all tasks" (HW79 p. 5; HW76 p. 5). CONSTS lines 35–50.

| Code | F1 | F2 |
|---|---|---|
| 0 | — (none) | — (none) |
| 1 | `MAR←` load MAR from the ALU, start a memory reference | `BUS=0`: NEXT ← NEXT OR (bus==0) |
| 2 | `TASK`: allow a task switch | `SH<0`: NEXT ← NEXT OR (shifter output < 0) |
| 3 | `BLOCK`: convention only; the *device* drops its wakeup | `SH=0`: NEXT ← NEXT OR (shifter output = 0) |
| 4 | `←L LSH 1` | `BUS`: NEXT ← NEXT OR BUS[6–15] (a 10-bit dispatch) |
| 5 | `←L RSH 1` | `ALUCY`: NEXT ← NEXT OR ALUC0 |
| 6 | `←L LCY 8` | `MD←`: store the bus into memory |
| 7 | `←CONSTANT` | `←CONSTANT` (same as F1=7) |

### 2.3 Task-specific codes

F1 and F2 codes **10B–17B** and BS **3–4** mean different things in different tasks. Each I/O controller decodes the F1/F2 lines only while its own task number is current (CSL79 p. 12: "eight of the possible values of the F1 and F2 fields … are task-specific"). CSL79 p. 12 also says: "This encoding reduces the size of the microinstruction."

| Task | F1 10–17 | F2 10–17 | BS 3/4 | Source |
|---|---|---|---|---|
| Emulator (0) | 10 SWMODE, 11 WRTRAM, 12 RDRAM, 13 RMR← (ESRB/SRB on 3K), 15 ESRB←, 16 RSNF (read host number from the Ethernet board), 17 STARTF (the SIO instruction) | 10 BUSODD, 11 MAGIC, 12 DNS←, 13 ACDEST, 14 IR←, 15 IDISP, 16 ACSOURCE | ←S / S← | CONSTS lines 52–72; HW79 §3.5 |
| Disk (KSEC 4, KWD 16B) | 11 STROBE, 12 KSTAT←, 13 INCRECNO, 14 CLRSTAT, 15 KCOMM←, 16 KADR←, 17 KDATA← | 10 INIT, 11 RWC, 12 RECNO, 13 XFRDAT, 14 SWRNRDY, 15 NFER, 16 STROBON | ←KSTAT / ←KDATA | CA `MicroInstruction.cs` enums; HW76 p. 5 |
| Display word (11B) | — | 10 DDR← (push a word into the display FIFO) | — | UC line 61 |
| Display horizontal (13B) | — | 10 EVENFIELD, 11 SETMODE | — | UC lines 59–60 |
| Display vertical (14B) | — | 10 EVENFIELD | — | UC line 59 |
| Cursor (12B) | — | 10 XPREG←, 11 CSR← | — | CA enums; UC `CURT:` |
| Ethernet (7) | 13 EILFCT, 14 EPFCT, 15 EWFCT | 10 EODFCT, 11 EOSFCT, 12 ERBFCT, 13 EEFCT, 14 EBFCT, 15 ECBFCT, 16 EISFCT | 4 EIDFCT | UC lines 220–231 |

So **F2=10B alone has six meanings**: branch on bus bit 15 (emulator), write display data (DWT), branch if even field (DHT/DVT), load cursor X (CURT), output an Ethernet word (Ethernet), initialise the disk (disk). The same pattern holds for F1=13B: RMR← or SRB← on the RAM board, INCRECNO (disk), EILFCT (Ethernet).

### 2.4 Next-address formation: no incrementer, OR-only branches, one-instruction delay

1. **No incrementing micro-PC.** "The Alto does not have an incrementing microprogram counter. Instead, each microinstruction specifies the least significant ten bits of the address of its successor" (CSL79 p. 10). Each task does have a stored micro-PC, the 16×12 MPC RAM, rewritten every cycle from the NEXT bus (CSL79 p. 10; HW76 p. 8). The PC is *stored*; it is never *incremented*.
2. **Branches are ORs.** Conditions OR bits into NEXT and never add. One-bit tests (BUS=0, SH<0, SH=0, ALUCY, BUSODD, device tests) OR into NEXT[9], the LSB (HW79 p. 5). Wider dispatches OR in more bits:
   - `BUS` ORs BUS[6–15] (10 bits, up to a 1024-way jump).
   - `IR←` ORs bus bits 0, 5, 6, 7 into NEXT[6–9] (16-way).
   - `IDISP` and `ACSOURCE` each OR up to 4 bits.
   - Devices OR bits too; for example the Ethernet task branches 4 ways on "NEXT6 and NEXT7" (UC line 164).
   - The base label must therefore have zeros where the condition bits land, so Mu packs targets into aligned blocks (§8).
3. **The modification lands one instruction late.** "Because the next instruction is already being fetched while the instruction is being executed, conditional branches and dispatches affect not the address of an instruction's immediate successor, but the instruction following that one" (CSL79 p. 10). HW79 p. 10 says the same: "the Alto pre-fetches one microinstruction ahead". The manual's example: `100B: SH<0, NEXT=101B` / `101B: NEXT=102B` executes 100, 101, 102 or 100, 101, 103. TH86 p. 92 calls this "a two stage pipeline". CA's `Task.cs` implements it: "If we have a modified next field from the last instruction, make sure it gets applied to this one."
   - In Mu source this reads naturally: the *test* is on one line and the *target pair* is on the next. From UC `DHT:` (UC lines 95–97): `L_ SLC -1, BUS=0;` then `SLC_ L, :DHT0;` with `!1,2,DHT0,DHT1;`.
4. **Bank switching** (1K-word banks; NEXT is only 10 bits): see §5.2.

### 2.5 Task switching (core mechanics only)

- `TASK` (F1=2) loads the current-task register at the end of the instruction with the highest-priority requester from the priority encoder. "One additional instruction is executed by the current task before the switch becomes effective." That instruction "must do no NEXT address modification", since it would land on the new task (HW79 p. 11; HW76 p. 8).
- The manual's timeline table, useful for animation: two streams A–F and J–M, where C allows the switch, D still runs, then J and K run, then E resumes (HW79 p. 11).
- A switch only happens if a higher-priority wakeup is pending, or if the current task has dropped its own. The emulator (task 0) "is always requesting wakeup" (HW79 p. 11).
- Rules: no state may be held in L, T or a pending memory reference across a TASK. **TASK may not appear in two consecutive microinstructions** (HW79 p. 11).
- At reset, **each task starts at the microaddress equal to its task number**, so the emulator starts at 0 (HW79 p. 11). The ROM's reset table is `!17,20,NOVEM,,,,KSEC,,,EREST,MRT,DWT,CURT,DHT,DVT,PART,KWDX,;` (UC line 25).
- Undocumented quirk found by the emulator authors: a TASK in the first microinstruction after a switch has no effect (CA `Task.cs` comment: "observed on the real hardware").

---

## 3. The Nova emulator, traced

### 3.1 What the emulator is

- It is task 0, label `NOVEM` at address 0, headed ";NOVA EMULATOR" (UC lines 591–603; UC-addr `EM0000> NOVEM:`).
- It emulates a Nova-like "BCPL" instruction set. The differences from a Nova: 16-bit addresses (so only single-level indirection), no auto-index locations, a different interrupt system, and Nova I/O opcodes (60000B and up) reassigned to Alto instructions (HW76 §3.1 p. 10; §3.3 p. 16).
- The hardware added for it is IR, the ACSOURCE/ACDEST register addressing, the IR dispatch logic, and the SKIP/CARRY/DNS shifter control. CSL79 p. 14 puts the total at **"less than ten ICs"**. Thacker later judged that the same hardware "probably would have been better" spent on something more general (TH86 p. 93).
- The standard ROM's 1,024 words are budgeted per task as follows. This is my count of the per-address annotations in UC-addr, 1,021 addresses in all:

  | Task | Words |
  |---|---|
  | Emulator | 628 (including boot, BITBLT, MUL/DIV, CONVERT) |
  | Ethernet | 95 |
  | Disk sector | 80 |
  | Memory refresh (MRT) | 73 |
  | Disk word | 65 |
  | Display horizontal | 29 |
  | Display word | 18 |
  | Parity | 17 |
  | Display vertical | 14 |
  | Cursor | 2 |

  The whole display controller (four tasks) is **63 microinstructions**.

### 3.2 The main loop: fetch, interrupt check, decode

Excerpt from UC lines 692–708, with PROM addresses from UC-addr:

```
START:  T_ MAR_PC+SKIP;                      ; 020
START1: L_ NWW, BUS=0;   BUS# 0 MEANS DISABLED OR SOMETHING TO DO   ; 525
        :MAYBE, SH<0, L_ 0+T+1;   SH<0 MEANS DISABLED               ; 576
MAYBE:  PC_ L, L_ T, :DOINT;                 ; 526
NOINT:  PC_ L, :DIS0;                        ; 527
DIS0:   L_ T_ IR_ MD;    SKIP CLEARED HERE   ; 535
DIS1:   T_ ACSOURCE, :GETAD;                 ; 612
```

What happens, cycle by cycle, with no interrupt pending:

| Cycle | Label (octal addr) | Action | Memory cycle |
|---|---|---|---|
| 1 | START (020) | MAR ← PC+SKIP starts the instruction fetch, and T gets the same value (ALUF 13B is starred). **The previous instruction's skip is applied here, free.** | 1 |
| 2 | START1 (525) | L ← NWW (R4, interrupt-request word). BUS=0 steers cycle 3's successor: NWW=0 → NOINT (527), else MAYBE (526). | 2 |
| 3 | unlabeled (576) | L ← T+1 = the new PC. SH<0 tests the sign of NWW ("interrupts disabled"); in the MAYBE path this picks DOINT or DIS0. | 3 |
| 4 | NOINT (527) | PC (R6) ← L | 4 |
| 5 | DIS0 (535) | **The instruction arrives exactly in memory cycle 5, with no stall.** L, T, IR ← MD. IR← clears SKIP and ORs bus bits 0, 5, 6, 7 into DIS1's successor. | 5 |
| 6 | DIS1 (612) | T ← R[SrcAC] via ACSOURCE; jumps to GETAD (540) + the 4 opcode bits. The ACSOURCE dispatch ORs more bits into the *next* instruction's successor. | — |

- The four slots of memory latency are filled with the interrupt test and the PC increment. That is the Nova emulator's only overlap trick (§3.7).
- Interrupts are pure microcode: I/O microcode ORs bits into NWW, and "at the start of every macroinstruction, NIW is tested" (CSL79 §2.1 p. 5; "NIW" there, NWW in the source).

**The three-level decode cascade.** Each stage is set up one instruction early, per §2.4.

1. **`IR←`** (in DIS0) ORs {IR[0], IR[5], IR[6], IR[7]} into DIS1's NEXT (HW79 §3.5 p. 30; CA `EmulatorTask.cs`). This selects one of 16 entries `GETAD, G1 … G17` (`!17,20,…`, "GETAD MUST BE 0 MOD 20", UC lines 675 and 710):
   - Memory-reference and jump instructions (IR[0]=0) index by I and X: G0–G3 compute the base (0, PC−1, AC2, AC3), and G4–G7 are the indirect twins.
   - Arithmetic instructions (IR[0]=1) index by the AFunc field: G10 COM, G11 NEG, G12 MOV, G13 INC, G14 ADC, G15 SUB, **G16 ADD**, G17 AND (UC lines 719–726).
2. **`ACSOURCE`** (in DIS1) has two jobs. It addresses R[SrcAC XOR 3], and it ORs into the G-instruction's successor (HW79 §3.5 p. 31):

   | Condition | Value ORed in |
   |---|---|
   | IR[0]=1 | 3 − SH field → `SHIFT, SH1, SH2, SH3` = swap, right, left, none |
   | IR[1–2] ≠ 3 | the indirect bit IR[5] → `DOINS` / `DOIND` |
   | Alto-specific opcodes (IR[1–2]=3) | a code from IR[3–7], e.g. 0 → CYCLE (2), 2 → NOPAR (3), 11B/12B → JSRII (4), 16B → CONVERT (1), 37B → TRAP; others → RAMTRAP |

3. **`IDISP`** (in DOINS) is a 16-way dispatch via a 256×4 PROM (HW76 §3.5 p. 23):

   | Condition | Value ORed in |
   |---|---|
   | IR[1–2]=0 | IR[3–4] → JMP, JSR, ISZ, DSZ |
   | IR[1–2]=1 | 4 → LDA |
   | IR[1–2]=2 | 5 → STA |

   The targets form the table `XCTAB, XJSR, XISZ, XDSZ, XLDA, XSTA, CONVERT…` (UC line 676).

### 3.3 Worked example 1: `ADD 1,2` (octal 133000): AC2 ← AC2 + AC1

Encoding: 1 | SrcAC=01 | DestAC=10 | AFunc=110 | SH=00 | CY=00 | NL=0 | SK=000.

- IR[0,5,6,7] = 1110 = 16B → **G16**.
- SH=0 → 3 − 0 = 3 → **SH3**.
- SrcAC 1 → R2. DestAC 2 → R1.

| Cycle | Address | Microinstruction (UC) | Effect |
|---|---|---|---|
| 1–6 | 020, 525, 576, 527, 535, 612 | main loop (§3.2) | fetch, PC+1, IR←, T ← AC1 |
| 7 | 556 | `G16: L_ ACDEST+T, TASK, :SHIFT;  ADD` | bus = R1 (AC2), ALUF 7 → L = AC2+AC1; TASK |
| 8 | 533 | `SH3: DNS_ L, :START;  NO SHIFT` | DNS writes L into R1 (AC2), computes CARRY and the skip condition, then jumps to START. This is the one instruction that runs after TASK. |

**Total: 8 microinstructions = 8 × 170 ns = 1.36 µs**, with no memory stalls. The PROM address trail is **020 → 525 → 576 → 527 → 535 → 612 → 556 → 533 → 020**.

### 3.4 Worked example 2: `LDA 1,3,2` (octal 025003): AC1 ← mem[AC2+3]

Encoding: 0 | MFunc=01 | DestAC=01 | I=0 | X=10 | D=3.

- IR[0,5,6,7] = 0010 → **G2**.
- IR[1–2]=1 ≠ 3, so the ACSOURCE dispatch uses I=0 → **DOINS**.
- IDISP gives 4 → **XLDA**.

| Cycle | Address | Microinstruction (UC lines 711–850) | Effect |
|---|---|---|---|
| 1–6 | … | main loop | |
| 7 | 542 | `G2: T_ AC2, :DOINS;` | base register |
| 8 | 060 | `DOINS: L_ DISP + T, TASK, :SAVAD, IDISP;` | L = sign-extended 3 + AC2 |
| 9 | 626 | `SAVAD: SAD_ L, :XCTAB;` | effective address → SAD (R5); IDISP picked XCTAB+4 |
| 10 | 564 | `XLDA: MAR_ SAD, :FINLOAD;` | memory cycle 1 |
| 11 | 647 | `FINLOAD: NOP;` | the mandatory gap (memory cycle 2) |
| 12 | 650 | `LOADX: L_ MD, TASK;` | issued in memory cycle 3, so **the clock stops for 2 cycles**; it executes in cycle 5 |
| 13 | 651 | `LOADD: ACDEST_ L, :START;` | R2 (AC1) ← data |

**Total: 13 microinstructions + 2 stall cycles = 15 cycles ≈ 2.55 µs.** The stall count comes from the HW79 p. 7–8 rules and CA's `MemoryBus` model. It is my trace, not a published figure.

### 3.5 Other instructions (my traces from UC)

| Instruction | Path | Cost |
|---|---|---|
| **JMP** (PC-relative, direct) | main loop (6) + G1 `T_ PC -1` + DOINS + SAVAD + `XCTAB: L_ SAD, TASK, :FINJMP` + `FINJMP: PC_ L, :START` | 11 cycles ≈ 1.87 µs |
| **STA** | …SAVAD, then `XSTA: MAR_ SAD` / `XSTA1: L_ ACDEST` / `FINSTO: SAD_ L, TASK` / `FINST1: MD_SAD, :START` (the store lands in memory cycle 4, which is legal) | 13 microinstructions + ~1 stall at the next START's MAR← (the memory cycle is still busy) ≈ 14 cycles ≈ 2.4 µs |
| **JSR** | `XJSR: T_ SAD, :FINJSR` → `FINJSR: L_ PC; AC3_ L, L_ T, TASK;` → `FINJMP` | about 12 cycles |

- `PC−1` appears in the relative-address G-entries because PC has already been incremented in cycle 3.
- An indirect bit adds a detour through `DOIND` (UC lines 734–736): a second memory reference, about +3 cycles plus stalls.

### 3.6 The Nova-skip trick and other emulator gems in UC

- **Skip costs nothing.** `DNS←` sets the SKIP flip-flop. The *next* instruction's first microinstruction computes `MAR←PC+SKIP` with ALUF 13B, where the 74181's carry-in is SKIP′ (HW79 §3.5 p. 31: the PC "is incremented by 1 at the beginning of the next emulated instruction if SKIP is set, using BUS+SKIP"). So SZR, SNC and the rest never branch in microcode.
- **Unimplemented opcodes** go to `RAMTRAP: SWMODE, :TRAP;` (UC line 792). With a control RAM installed, execution continues *in RAM* at the address of TRAP1 (37B), with the instruction in L and the byte-swapped copy in XREG. Without one, it traps through a vector in page 1 (HW79 §8.6 p. 60; HW76 §3.3 p. 16).
- **MUL** is an "exact emulation of Nova hardware multiply" in microcode. It loops on `L MRSH 1` (the MAGIC shift) about 16 times (UC lines 904–946).

### 3.7 Overlap and prefetch: the precise answer

- The Nova emulator does **no macro-instruction prefetch**. Each instruction's fetch starts at START.
- Its overlaps are:
  1. The fetch's 4-cycle latency is hidden behind the interrupt check and the PC increment (§3.2), so the word arrives exactly in memory cycle 5.
  2. The skip is folded into the next fetch's address add.
  3. The decode is spread over three dispatches, each set up an instruction ahead.
  4. At the micro level, the next microinstruction is always being fetched during the current one (the two-stage pipeline).
- The **Mesa** emulator shows what a byte-code machine gains. It fetches one word per two byte-codes, dispatches 256 ways on the even byte with `BUS`, and parks the odd byte in register `ib` for the next instruction, which then needs no memory reference (MesaROM.mu `nextA` / `nextAni` / `nextBa`, [CA Disassembly/MesaROM.mu](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/MesaROM.mu)).
- TH86 p. 92: the doubleword read "was also used very effectively by instruction set emulators for instruction fetching".
- CSL79 §8: the Mesa emulator "interprets instructions just as fast as the emulator for BCPL", even without the Nova-specific decode hardware.

---

## 4. Emulator performance

| Figure | Value | Basis |
|---|---|---|
| Microinstruction rate | **5.88 million per second** (nominal 5.880000 MHz) | HW79 §3.3 RCLK (p1-PDF 25) |
| Emulated instruction time, no I/O load | "between one and three microseconds" | TH86 p. 92 |
| Effect of the display | times "increased by a factor of three" | TH86 pp. 92–93 |
| Display share of the machine | "about 60% of the cycles" for a full-screen bitmap | CSL79 §3.1 |
| Measured display-off speed-up | BCPL Mandelbrot went from 24 min to 9 min with the display off, **2.7×** | KS-Mandelbrot 2 |
| Round figure quoted by Shirriff | "about 400,000 instructions per second" | KS-Bitcoin (secondary, basis not stated) |
| My traces | ADD 8 cycles (1.36 µs), JMP 11 (1.87 µs), STA ≈ 14 (2.4 µs), LDA 15 (2.55 µs) | §3.3–3.5 |

Synthesis (computed, and should be flagged as an estimate if used):

- Display off: **≈ 1.4–2.6 µs per instruction ≈ 0.4–0.7 million Nova instructions per second**. That is 8–15 microinstructions per Nova instruction.
- Full display on: the emulator keeps roughly a third to 40% of the cycles, so **≈ 3.5–8 µs per instruction ≈ 130–290 thousand instructions per second**.
- The memory refresh task (every 38.08 µs) and the cursor task take a few more percent even with the display off. Not quantified here.
- **Do not say "6 MIPS" for the CPU.** Kay's "about 6 MIPS" (KAY93 § IV) is the *microcode* instruction rate.

---

## 5. Control store

### 5.1 Sizes, technology and history

CSL79 Fig. 2, p. 3 (read from the scan):

| Year | Control memory | Technology | Processor registers |
|---|---|---|---|
| 1973 | 1K PROM | 256×4 Schottky bipolar PROMs | 32 R (16×4 Schottky bipolar) |
| 1974 | 1K PROM + **1K RAM** | RAM: 1K×1 Schottky bipolar | 32 R + 32 S |
| 1976 | **2K PROM** + 1K RAM | 1K×4 Schottky bipolar PROMs | (same) |
| 1979 | 1K PROM + **3K RAM** | RAM: 4K×1 static NMOS | 32 R + **8 × 32 S** (256×4 Schottky bipolar) |

- TH86 p. 95: in summer 1973 the team "added one thousand words of instruction RAM to the original PROM control store".
- TH86 p. 97: the 1979 redesign changed the store "from one thousand words of RAM and two thousand words of PROM to one thousand words of PROM plus three thousand words of RAM".
- HW79 §8.0 p. 56 lists the configurations:
  - **1K RAM**: every Alto, with one bank of 31 S registers. It was once optional on the Alto I.
  - **2K ROM**: "certain Alto IIs", ROM0 plus a programmable ROM1.
  - **3K RAM**: "certain other Alto IIs", with 8 banks of 31 S registers.
- Chip evidence:
  - The 1976 Alto II 1K control board carries **33 Intel 3601-1** 256×4 PROMs: 32 hold the 1K×32 microcode, and one is presumably the SWMODE configuration PROM (SCH-CTL material list; the last part is my inference).
  - Shirriff's 2K-capable board uses **eight 1K×4 PROMs plus eight empty sockets** (KS-day4).
  - The 1K CRAM board uses **32 × Fairchild F93415A** 1K×1 bipolar RAMs (SCH-CRAM sheet 7, "32 PLACES").
  - HW76 §8.0 p. 44: the RAM is "fast (90 nsec.)" and the S-register RAM "even faster (40 nsec.)".

### 5.2 Banks and SWMODE

- NEXT has only 10 bits, so the microcode memory is split into 1K banks: ROM0, ROM1, RAM0, RAM1, RAM2 (HW79 §8.4 pp. 57–58).
- `SWMODE` (emulator F1=10B) switches the running task's bank "after the microinstruction following that in which the SWMODE appears". The destination depends on the configuration, the current bank, and NEXT[1–2] of that following instruction. The 3K-RAM table picks RAM0, RAM1 or RAM2 by those two bits (HW79 §8.4 p. 58).
- Tasks other than the emulator cannot switch banks at run time (HW79 p. 58). At reset, the 16-bit **reset mode register** (`RMR←`, F1=13B) decides for each task whether it starts in ROM0 or RAM0; it resets to all ones, meaning all tasks start in ROM (HW79 §8.4 p. 59).
- The bank-switch logic is itself a 256×4 PROM. A swappable configuration PROM (SW1, SW2 or SW3K) on the control board selects the table (KS-day9, KS-day10; HW79 p. 58 mentions "the chip in position 51" labelled Sw2K or Sw1K).

### 5.3 Writing, reading and entering the RAM

- **Control-RAM address register:** loaded from the ALU output *whenever T is loaded* (HW79 §8.2 p. 56).
  - ALU bits 2–3: RAM bank.
  - Bit 4: RAM (0) or ROM (1).
  - Bit 5: which half to read.
  - Bits 6–15: word address.
- **WRTRAM** (F1=11B) writes a whole 32-bit word in one go. **M** (loaded from the ALU in the same instruction) becomes the high half. The **ALU output of the *following* instruction** becomes the low half. "This protocol mates well with doubleword main memory reads" (HW79 §8.2 p. 57).
- **RDRAM** (F1=12B) reads one 16-bit half. The data is **ANDed onto the bus** in the next instruction, which is why the reading code loads `L←ALLONES` there (HW79 p. 57).
- Both RDRAM and WRTRAM **stop the system clock for one cycle** (HW79 §8.8 p. 61).
- ROM0 can be read the same way, but only if the instruction after RDRAM sits at the target address mod 1024. "There is no known way to read ROM1" (HW79 §8.8 p. 61).
- Emulator instructions (UC lines 1173–1190, UC-addr):
  - `RDRAM` 61011B: `RDRM: T<- AC1, RDRAM;` / `L<- ALLONES, TASK, :LOADD;`
  - `WRTRAM` 61012B: `WTRM: T<- AC1;` / `L<- AC0, WRTRAM;` / `L<- AC3, :FINBLT;` (AC0 is the high half, AC3 the low half, AC1 the address)
  - `JMPRAM` 61010B: `JMPR: T<-AC1, BUS, SWMODE, :TORAM;` / `TORAM: :NOVEM;`. `BUS` ORs AC1's low 10 bits into `TORAM`'s NEXT, which is NOVEM = **address 0**, and SWMODE flips the bank. So the jump target is literally "zero OR the accumulator". The manual warns it can make the machine "plunge completely off the deep end" (HW79 §8.5 p. 59).
- Other ways control reaches RAM:
  - unimplemented opcodes → `RAMTRAP` (§3.6);
  - the "PC call" return convention from ROM subroutines (BLT, BLKS, MUL, DIV, BITBLT): if PC lies in 177000–177777B, the routine returns to RAM or ROM1 at PC AND 777B (HW79 §9.2.1 p. 63);
  - `RAMRET: T<-XREG, BUS, SWMODE;` (UC-addr 021);
  - the **"silent boot"**: load RAM0 with `NOVEM: SWMODE; :START;`, set RMR so the emulator starts in RAM, and reset. "The emulator hiccoughs momentarily into the RAM" and carries on in ROM (HW76 §9.22 p. 50).
- ROM addresses guaranteed for RAM programmers (HW79 §9.1 p. 62): START=20B, TRAP1=37B, RAMCYCX=22B, BLT=105B, BLKS=106B, MUL=120B, DIV=121B, BITBLT=124B, and a cycle table at 160B.

### 5.4 "Three instruction sets"

- CSL79 §2.1 p. 5: emulators for **BCPL, Smalltalk, Lisp and Mesa**. "The BCPL emulator is contained in the PROM microstore, while the others are loaded into RAM as needed."
- LAMP86 §2.2: each environment has "its own instruction set, implemented by its own microcode emulator". The BCPL set is always present, and the RAM has room for "a thousand microinstructions, enough for one other emulator". The environments communicate only by world-swap or through the file system.
- Nuance:
  - On 2K-ROM Alto IIs, **Mesa lived in ROM1**. The XMesa microcode header says `uCodeVersion` tells RunMesa "what version of the Mesa microcode is in ROM1" (MesaROM.mu, Levin, March 1979). It was "developed from Lampson's MESA.U of 21 March 1975".
  - Smalltalk needed the larger 3K CRAM (KS-day10; secondary).
  - Mesa and Smalltalk use **byte-codes** dispatched 256 ways through the standard `BUS` dispatch, with no special hardware (CSL79 p. 14).
  - By 1979 other emulators "had almost totally superseded the original BCPL emulator" and were loaded at boot time or with the program (TH86 p. 97).

---

## 6. Clock

- Nominal **5.880000 MHz**, i.e. a period of **170.07 ns**. HW79 §3.3 (RCLK): the refresh task ticks "once every 224 ticks of the system clock" = 38.08 µs.
- **Why that number:** CSL79 §3.4 says the 170 ns clock "is chosen to be an integral submultiple (224) of the display's line rate (875*30 = 26.25 kHz)". Check: 875 × 30 × 224 = 5,880,000 exactly.
- **Where it comes from (Alto II):** the Display Control board, drawing 216339C, sheet 14 "SYSTEM CLOCKS" (SCH-DISP). My reading of the sheet:
  - A **29.4 MHz** crystal oscillator module (K1100A, U51) drives a **74S163** counter (U61).
  - The counter's A–D inputs are grounded, and its QC output, inverted, drives LOAD. The counter runs 0,1,2,3,4 and reloads, i.e. **÷5**: 29.4 MHz / 5 = 5.88 MHz.
  - Switch S1 selects INT or an EXT clock input (P1).
  - The clock is gated by STOP and STOPCLK and buffered into per-board copies: CSYSCLK, AUSYSCLK, DSYSCLK, KSYSCLK, MISYSCLK, DCSYSCLK, plus ungated "ARC" copies. Reading the prefixes as C=control, AU=ALU, K=disk and so on is my inference.
- **Phases:** a single-phase clock. HW76 §2.4 p. 8: "There is only one phase of the system clock. It is true during the last 25 ns of every instruction." The schematic's ÷5 counter makes a pulse one crystal period wide (≈ 34 ns). The difference from 25 ns is unresolved: it could be gate delays, or the Alto I figure.
- **Within a cycle:**
  1. At the clock edge, MIR is loaded with the next microinstruction, the modified NEXT is written into the MPC RAM, and all registers load together (HW79 pp. 3–4; CSL79 p. 10).
  2. The bus, ALU and shifter then settle combinationally from the new register values.
  3. Meanwhile the MPC RAM output addresses the control store, prefetching the next microinstruction.
- **The clock is also a stall mechanism.** Memory waits, RDRAM, WRTRAM and a marginal Ethernet input path all *stop* SysClk (HW79 §8.8 p. 61; UC lines 359–368, the Ethernet "WARNING" comment).
- **Derived rates:** the Ethernet bit time is two clock periods, 2.94 Mbit/s (HWRef79 part2 §7; TH86 p. 95 "half the rate of the Alto master clock").
- **Alto I:** also 170 ns (HW76 p. 4). Whether its clock came from the same 29.4 MHz ÷ 5 circuit is **not verified**.

---

## 7. Physical realisation

| Board (Alto II) | What it holds | Chips (from material list) | Families |
|---|---|---|---|
| **ALU** (216381D) | ALU, R file, T/L/shifter paths (functional placement of T/L/shifter is my inference) | 67 ICs: 4× 74S181, 1× 74S182, 8× Intel 3101A (16×4 bipolar RAM = the 32×16 R file), 9× Fairchild 9309 (dual 4-input mux; likely the shifter, inference), 4× 74298 (2-input mux with storage; likely T, inference), 3× 74S174, 4× 74S175, 1× 82S23 PROM (likely the ALUF decode, inference), 2× 82S34 (part number as read on the scan), plus 74H/74S gates, 7438, 7486 | 74S Schottky, 74H, 74xx TTL, Intel/Signetics bipolar |
| **Control** (216695A, 1K XM, 3/5/76) | microcode PROM, MPC RAM, task priority, next-address and bank logic, MIR | ≈ 92 ICs: 33× Intel 3601-1 (256×4 PROM), 3× Intel 3101A (MPC RAM 16×12), 2× Fairchild 9318 (8-input priority encoders), 6× Intel 3205 (1-of-8 decoders), 7× 74S174, 5× 74S175, 3× 74S158, 1× 74S157, plus 74S and 74H gates, 3× 74S260, 1× 74S85, 82S23, 82S31, 3× 82S34 | mostly 74S and 74H |
| **CRAM** (216643A 1K; 217812C 3K) | control RAM, M, S registers | 1K: 32× F93415A for the RAM (logic not counted); 3K: 4K×1 static NMOS (CSL79 Fig. 2) | bipolar / NMOS |
| Display Control (216339C) | **the master clock** (plus the display, which is not my topic) | 29.4 MHz module + 74S163 | |

- Shirriff (KS-day4): the control board uses "two special priority encoder chips" and "two i3101A RAM chips" for the per-task addresses. The 1976 material list above has **three** 3101As, which is the right number for a 12-bit MPC (3 × 4 bits). Treat "two" as a board-variant difference or a slip.
- KS-intro: the 32×16 register file uses i3101 chips, "Intel's first-ever product".

**How many boards and chips is "the CPU"? The sources conflict:**

| Source | Claim |
|---|---|
| KAY93 § IV | "160 MSI chips distributed on two cards" for the whole machine except memory (the 1973 prototype) |
| TH86 p. 92 | "three printed circuit boards containing about 200 small and medium-scale integrated circuits" |
| CSL79 p. 4 | "five printed circuit boards, each of which contains approximately 70" SSI/MSI TTL ICs. Probably ALU, control, CRAM and the two memory-interface boards (AIM, DIM); that list is my inference. |
| KS-day5, KS-intro | 3 CPU boards (ALU, Control, Control RAM) of 13 in total; roughly 100 chips per board |
| Material lists | ALU 67, Control ≈ 92 |

For the video, "three boards, a couple of hundred TTL chips" is safe. The location of MAR (probably the AIM memory-address board) was not verified.

---

## 8. The Mu microassembler and what a line looks like

Source: MU pp. 77–83.

- Mu was written in BCPL and runs on the Alto itself. It is "downward compatible with Debal", the original assembler/debugger.
- Statements end with `;`. Everything after the semicolon to the end of the line is a comment.
- Statement types:
  - **Includes:** `#AltoConsts23.mu;`
  - **Symbol definitions:** `$name$Ln1,n2,n3;`, for example `$TASK $L016002,000000,000000; F1 = 2`
  - **Constants:** `$name$n;`, and mask constants `$name$Mbs:value;`
  - **R names:** `$PC $R6;`
  - **Address predefinitions:** `!n,k,name0,…;` reserves an aligned block of k locations for dispatch targets. "If L is the address of the last location of the block, L and n = n." `%mask2,mask1,init,…` is the general form.
  - **Executable statements:** `label: clause, clause, …;`
- The three clause kinds:
  - gotos: `:label`, which fills NEXT;
  - non-data functions: `TASK`, `BUS=0` and so on, which fill F1 or F2;
  - assignments: `dest1←dest2←…←source`. Mu splits the source into a bus source plus an ALU function. `L←foo+T+1` means "bus source foo, ALU function +T+1". `L←2+T` is legal but `L←T+2` is not, because the bus operand comes first.
- `SINK←` names a bus source with no destination, e.g. `SINK←AC0, BUS=0`.
- Placement: a predefined label goes to its reserved slot; any other instruction goes to "the lowest unused location". **This is why the code is scattered through the PROM.**
- Mu warns about the T quirk: `L←T←MD-1` actually loads T straight from MD, because ALUF 10B is not starred. "Beware!" (MU p. 79).
- Output is `.MB` (Micro format) for the PROM blower, RamLoad and PackMu. A 3-bit **F3 field "exists only in the debugging RAM"** (MU p. 80). TH86 p. 93 describes that debugging microstore: extra bits for breakpoints, driven from a minicomputer.
- In the plain-text file the arrow is `_`. The printed listing and the Alto show a real `←` glyph (UC-lst, p. 16).

**A real line for the screen** (UC line 725; UC-addr `EM0556>`; UC-lst p. 16 [PDF 18]):

```
G16:    L← ACDEST+T, TASK, :SHIFT;          ADD
```

| Part | Meaning |
|---|---|
| `G16:` | label, fixed at octal 556 by the `!17,20,GETAD,…` predefinition |
| `L←` | LoadL=1 |
| `ACDEST` | BS=0 (read R), F2=13B (RSELECT low bits ← DestAC XOR 3) |
| `+T` | ALUF=7 |
| `TASK` | F1=2 |
| `:SHIFT` | NEXT=530B; the previous line's ACSOURCE dispatch ORs in the Nova SH field |
| `ADD` | comment |

Logical field value: RSEL 0 | ALUF 7 | BS 0 | F1 2 | F2 13 | LT 0 | LL 1 | NEXT 530 = **001602 132530** octal. In the RAM-word format with inverted bits it is **001612 030530**. Both are computed by me from the field layout, not read from a PROM dump, and should be labelled that way on screen.

Other quotable lines:
- `START: T← MAR←PC+SKIP;`: fetch, apply the skip, prime T, in one line.
- `JMPR: T←AC1, BUS, SWMODE, :TORAM;`: "jump into RAM".
- `DIS0: L← T← IR← MD; SKIP CLEARED HERE`: three destinations in one cycle.

---

## 9. Uncertainties and open items

1. LoadT/LoadL bit order conflicts between sources (§2.1). Evidence favours LoadT at bit 20.
2. Clock phase width: 25 ns (HW76) versus ≈ 34 ns implied by the Alto II schematic (§6).
3. The per-instruction cycle counts are my hand traces using HW79 rules and the CA memory model. They were not measured on hardware or in the emulator. They assume no pre-emption by other tasks and no interrupt pending.
4. The instructions-per-second figures are derived. The only primary figures are TH86's 1–3 µs and ×3.
5. CPU board and chip counts conflict (§7). Functional placement of the T, shifter and ALUF-PROM chips on the ALU board is inferred from part types.
6. Location of the constant PROM and of MAR: not verified.
7. Smalltalk requiring the 3K CRAM rests on KS-day10 only.
8. The part number "82S34" was read from a scan and may be misread.

---

## 10. Corrections to earlier notes

Applies to `reports/Xerox Alto explainer research.md` (the "report") and `research_notes/Xerox Alto explainer research/hardware_architecture.md` (the "hw notes").

1. **Branch timing (report, "The 'CPU' is itself a program"; hw notes §1).** "A branch works by ORing condition bits into that address" is incomplete. The OR modifies the NEXT of the *following* microinstruction, because the next microinstruction is already being fetched (CSL79 p. 10; HW79 p. 10; TH86 p. 92 "two stage pipeline"). Also, a micro-PC *does* exist (one per task, in the MPC RAM). What is missing is an *incrementer*.
2. **"Eight 1K×4 PROM chips" (report and hw notes, cited to Shirriff day 5).** The quote is from **day 4** (2016/07), not day 5. It describes Shirriff's 2K-capable Alto II control board. The 1976 Alto II 1K control board uses **32 × Intel 3601 256×4 PROMs** (+1), and the 1973 Alto used 256×4 PROMs (CSL79 Fig. 2; SCH-CTL).
3. **ALU "four 74181" (both).** Precisely: four **74S181** (Schottky) plus a **74S182** lookahead carry chip (SCH-ALU; CSL79 p. 13).
4. **ALUF 14 (hw notes: "BUS AND T with a different carry setting").** Wrong. ALUF 3 and ALUF 14 drive the 74181 identically (S=1011, M=1). The difference is that ALUF 14 loads **T from the ALU output** instead of from the bus (HW79 p. 4; CONSTS lines 80 and 90).
5. **Clock (report: "170 ns ≈ 5.88 MHz (computed)").** Now primary: nominal **5.880000 MHz** (HW79 §3.3). It is generated as **29.4 MHz ÷ 5** on the Alto II Display Control board (SCH-DISP sheet 14) and equals 875 × 30 × 224 (CSL79 §3.4). The hw notes could not tell which document the "integral submultiple (224)" excerpt came from: it is **CSL79 §3.4**.
6. **"6 MIPS" (report quoting Kay).** Correct only as a *microinstruction* rate. The Nova-level rate is about **0.4–0.7 million instructions/s** with the display off and about a third of that with a full display (§4). The script must not call the CPU a 6-MIPS machine.
7. **Display slow-down "factor of three" (report, attributed to Hiltzik).** There is a primary source: TH86 pp. 92–93. Shirriff measured 2.7×.
8. **Control-store history (report: "Later machines added writable RAM, up to 1K PROM plus 3K RAM").** Imprecise:
   - 1K RAM was added in **1973–74** and is standard on all Altos per HW79.
   - 2K PROM + 1K RAM came in 1976.
   - 1K PROM + 3K RAM came in 1979.
   - The maximum is 4K words; 2K PROM and 3K RAM were never combined.
   - (CSL79 Fig. 2; TH86 pp. 95, 97; HW79 §8.0.)
9. **S registers (hw notes: "8 banks of 32 S registers"; "my reading of ContrAlto").** Only **31 are usable** per bank, because S0 reads M. There are 8 banks only with the 3K-RAM option, otherwise 1 bank. This is documented in HW79 §8.0 and §8.7, so it is no longer an inference.
10. **Mesa location (report: "Mesa, Smalltalk and Lisp each loaded their own instruction set into the RAM").** On 2K-PROM Alto IIs, XMesa's microcode was in **ROM1** (MesaROM.mu header).
11. **Chip counts (hw notes: "no reliable source").** There are now four conflicting counts plus two material lists (§7).
12. **Cycles per Nova instruction (hw notes: "no figure").** 8 (ADD) to about 15 (LDA) microcycles, from traces (§3). TH86 gives 1–3 µs.
13. **Memory timing (hw notes: ContrAlto's "6–7-cycle windows … possibly pipeline").** Resolved. The manual numbers the MAR← instruction as cycle 1. Read data is available in cycle 5 (cycle 6 for the second word). The next MAR← may issue 5 cycles after the previous one, which is the 850 ns memory cycle. Alto II stores go in cycles 3–4.
14. **One-instruction task-switch delay (hw notes: "could not fetch the manual's wording").** Primary: HW79 p. 11 / HW76 p. 8, "One additional instruction is executed … before the switch becomes effective." TASK is also illegal in two consecutive microinstructions.

---

## 11. Nerd gems for the video

Each gem gives the fact, then a one-line animation idea for a 1-bit, portrait-format video.

1. **Every microinstruction names its successor.** There is no incrementer. An ADD's micro-path through the PROM is octal 020 → 525 → 576 → 527 → 535 → 612 → 556 → 533 → 020 (UC-addr).
   *Animate:* a 32×32 grid of 1,024 PROM cells; a single lit cell hops along that trail and leaves a dotted line.

2. **Branching is an OR, never an add.** A test can only turn the last address bit from 0 to 1, so every two-way branch target pair sits at an even/odd address, e.g. MAYBE=526, NOINT=527.
   *Animate:* a 10-bit address row; a condition bit drops in and ORs onto bit 9 only; the arrow swings between two adjacent cells.

3. **Branches arrive one instruction late.** The next microinstruction is already fetched, so a test steers the instruction *after* next. The source puts the test on one line and the targets on the following line.
   *Animate:* a two-stage conveyor (FETCH | EXECUTE); a test lamp in EXECUTE lights while its effect lands on the item two slots back.

4. **The same 4-bit code does six jobs.** F2=10B means branch on bit 15 (emulator), write a display word (display word task), even-field test (display tasks), load cursor X (cursor), send an Ethernet word (Ethernet), initialise the disk (disk).
   *Animate:* the bits `1000` stay fixed while the task label above them flips through six names, each lighting a different device icon.

5. **Nova registers are stored backwards.** AC0 is R3 and AC3 is R0, because the hardware feeds the *complement* of the AC number into the register select.
   *Animate:* four slots labelled AC0–AC3 flip in mirror order into R3–R0 as an XOR-3 gate flashes.

6. **A skip costs zero cycles.** A Nova skip only sets a flag, and the next fetch computes PC+SKIP by feeding the flag into the 74181's carry-in.
   *Animate:* a 1-pixel "carry" bit drops into the adder's carry-in while MAR←PC+SKIP runs.

7. **The fetch latency is hidden.** MAR← goes out in cycle 1 and the instruction arrives in cycle 5. In between, the emulator checks interrupts and increments the PC, so the instruction lands exactly when memory is ready.
   *Animate:* a five-segment "memory busy" bar with three microinstructions sliding into the gaps.

8. **An ADD is 8 microinstructions, 1.36 µs. An LDA is 15 cycles.** At 5.88 million microinstructions per second that is roughly half a million Nova instructions per second, and about a third of that with the display on (TH86: ×3).
   *Animate:* a tick counter over 8 pulses for ADD, then 15 for LDA, with two "frozen clock" ticks during the memory stall.

9. **Too early to read memory? The clock stops.** A premature ←MD, RDRAM or WRTRAM literally halts the master clock until memory is ready.
   *Animate:* a pulsing clock waveform goes flat for two beats while a "memory" box finishes.

10. **The CPU's heartbeat lives on the display board.** A 29.4 MHz crystal ÷ 5 gives 5.88 MHz, which is exactly 875 lines × 30 frames × 224. Divide by 2 and you get the Ethernet's odd 2.94 Mbit/s.
    *Animate:* a gear train from the crystal (29.4) to the CPU (5.88), then the scanline (×224 ticks per line), then the Ethernet (÷2).

11. **The Nova-specific hardware is "less than ten ICs"** (CSL79 p. 14), and the Mesa emulator, with no special hardware at all, runs "just as fast" (CSL79 §8).
    *Animate:* a pile of about 200 chips (the CPU) with fewer than 10 highlighted, then a Mesa byte-code racing a Nova word to a finish line in a tie.

12. **Constants are addressed by reusing other fields.** The register-select and bus-source fields double as an 8-bit address into a 256-constant PROM (about 200 used). Because the bus is a wired AND, a device source and a mask constant AND together for free.
    *Animate:* the RSELECT and BS boxes of the microword slide together into an address arrow; two bus sources overlap and only the common bits stay lit.

13. **The emulator is just task 0, the background job.** At reset each task starts at the microaddress equal to its task number, so the whole Nova starts at address 0. It is the lowest-priority task and is always ready to run.
    *Animate:* 16 task lanes; the device lanes flash briefly; lane 0 fills every gap.

14. **"Jump to RAM" is an OR into address zero.** `JMPR: T←AC1, BUS, SWMODE` followed by `:NOVEM` ORs the accumulator into address 0 and flips the ROM/RAM bank. It is one of the few instructions that can make the machine "plunge completely off the deep end" (HW79 §8.5).
    *Animate:* a 10-bit zero row gets the accumulator ORed onto it, and a bank switch flips from ROM to RAM.

15. **The whole display controller is 63 microinstructions.** The ROM holds 1,024 words: the Nova emulator takes about 628, Ethernet 95, the disk 145, and the display's four tasks just 63 (UC-addr count).
    *Animate:* a 1,024-cell PROM map filling in task-shaded blocks, with the tiny display slice highlighted.
