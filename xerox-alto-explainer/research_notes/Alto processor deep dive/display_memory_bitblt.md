# Display pipeline, cursor, memory, refresh and BitBLT: deep-dive notes

Scope: how the Alto's one microcoded processor also acts as the display controller, cursor engine, DRAM refresh controller and blitter. The micromachine core, emulator, disk, Ethernet and design history are covered in other notes.

Conventions:
- Numbers ending in B, or marked "octal", are octal (Xerox convention).
- A "cycle" is one 170 ns microinstruction time.
- For memory timing, "cycle 1" is the microinstruction that loads MAR, following the 1979 manual.
- **(derived)** marks my own arithmetic. **(my count)** marks a cycle count I made from the microcode. **(inferred)** marks a reasonable reading that no source states directly.

## Sources and citation keys

| Key | Source | Where |
|---|---|---|
| HW76 | *Alto: A Personal Computer System, Hardware Manual*, Aug 1976 (text layer) | bitsavers `Alto_Hardware_Manual_Aug76.pdf`. Cited as § and printed page |
| HW79 | Same manual, May 1979 revision (microcode I:24, II:3) | bitsavers `AltoHWRef.part1.pdf` / `part2.pdf` (scans), OCR from ed-thelen `AltoHWRefPart1-4-ocr.pdf`. Cited as §, printed page where visible, otherwise "part1 PDF p." |
| MU | `altoIIcode3.mu`, the Alto II ROM microcode, ©1979, with 1976–77 change log | bitsavers `microcode/altoIIcode3.mu.txt`. Cited as label and line number in that .txt |
| MU-I | `altocode24.mu`, the Alto I microcode | bitsavers `microcode/altocode24.mu.txt` |
| CONSTS | `altoconsts23.mu` | bitsavers `microcode/altoconsts23.mu.txt` |
| CSL | Thacker, McCreight, Lampson, Sproull, Boggs, *Alto: A personal computer*, CSL-79-11, Aug 1979 | scan at bwlampson.site/25-Alto/25-Alto.pdf, OCR at 25-AltoOCR.htm. Cited as § and printed page |
| T86 | Thacker, "Personal Distributed Computing: The Alto and Ethernet Hardware", ACM Conf. on the History of Personal Workstations, 1986 | bwlampson.site/38-AltoSoftware/ThackerAltoHardware.pdf. Cited as printed page |
| BB75 | Dan Ingalls, "Bit BLT" memo, 19 Nov 1975, plus Diana Merry's `BBSCAN.SR` (20 Apr 1976), bound in the same PDF | bitsavers `BitBLT_Nov1975.pdf`. Cited as PDF page |
| SCH-C | Alto II Display Control schematic, dwg 216339 rev C (Mar–Oct 1976) | bitsavers `schematics/216339C_Display_Control.pdf`. Cited as sheet |
| SCH-G | Same drawing, rev G (Nov 1980), including a block diagram | bitsavers `schematics/216339G_DISPL.pdf`. Cited as page |
| CA | ContrAlto emulator source | github.com/livingcomputermuseum/ContrAlto: `Display/DisplayController.cs`, `Memory/MemoryBus.cs`, `Memory/Memory.cs`, `CPU/Tasks/*.cs` |
| KS-M1 / KS-M2 | Shirriff, "One-hour Mandelbrot" (Jun 2017) and "Improvements to Xerox Alto Mandelbrot" (Jun 2017) | righto.com/2017/06/one-hour-mandelbrot-creating-fractal-on.html; …/improvements-to-xerox-alto-mandelbrot.html; code github.com/shirriff/alto-mandel |
| KS-D1 / KS-D5 | Shirriff, Alto restoration day 1 (Jun 2016) and day 5 (Sep 2016) | righto.com/2016/06/y-combinators-xerox-alto-restoring.html; …/2016/09/xerox-alto-restoration-day-5-smoke-and.html |
| L86 | Lampson, "Personal distributed computing: the Alto and Ethernet software" (1986) | used only to check BitBlt wording |

All the downloads, including a clone of ContrAlto, are in the shared scratchpad: `/tmp/claude-0/-home-user-claude-playground/92890434-7951-5d24-a783-35e7d78c2b45/scratchpad/alto-sources/`. A small cycle-level scanline model I wrote is at `…/scratchpad/sim/scanline.py`.

---

## 0. Key numbers

| Quantity | Value | Basis |
|---|---|---|
| Processor clock | 29.4 MHz crystal ÷ 5 = **5.88 MHz**, so 170.07 ns per microinstruction | SCH-G p.2 block diagram ("K1100A 29.4 MHz", "Divide by 5"); SCH-C sheet 14; HW76 §2.0 p.4 ("170nsec"); KS-M1 ("5.88 MHz") |
| Pixel (bit) clock | 20.16 MHz crystal, so **49.6 ns per pixel**. The manuals round this to "50 ns" | SCH-G p.2 ("K1091A 20.16 MHz"); SCH-C sheet 9; HW76 §4.2 p.25; CSL §3.4 p.21 |
| Line rate | 875 × 30 = **26,250 Hz**, a period of 38.095 µs | CSL §3.4 p.21 |
| Cycles per line | **224 exactly** (5.88 MHz / 26.25 kHz) | CSL §3.4 p.21 (224 is an "integral submultiple" of the line rate); (derived) |
| Pixel clocks per line | **768** (20.16 MHz / 26.25 kHz), the sync divider ÷24 times 32 steps | SCH-G p.2 ("Divide by 24"); (derived) |
| Pixels per microcycle | 768/224 = **24/7 ≈ 3.43** at full resolution, 1.71 at low resolution | (derived) |
| Cycles per field | 98,000 (437.5 lines × 224) | (derived) |
| Visible | 606 × 808. **38 words = 608 bits per line**; 30,704 words for a full screen | HW76 §4.1 p.24; CSL §3.1 p.16 says 608 elements per line |
| Horizontal retrace | "approximately 6 microsec" | HW76 §4.4 p.26; HW79 §4.4 p.34 |
| Memory | 64K × 16 bits (128 KB), 850 ns = 5 cycles; doubleword read = 6 cycles | HW79 §2.3; CSL §2 p.4; T86 p.92 |

---

## 1. Clocks and raster timing (Q4)

**Two crystals, one ratio.** The Alto II Display Control board carries two oscillators ([SCH-G p.2 block diagram]; [SCH-C sheet 9 "Video bit clock", sheet 14 "System clocks"]):
- **20.16 MHz (K1091A)** drives the video shift register directly. Through a "divide by 24" counter it also clocks the sync generator.
- **29.4 MHz (K1100A)** is divided by 5 to make the *system clock for the whole machine* (CSYSCLK, DSYSCLK, AUSYSCLK, MISYSCLK, KSYSCLK…). Switch S1 can substitute an external clock.

So the CPU's heartbeat is generated on the display controller board. This is an Alto II fact; I have not checked the Alto I boards.

**Why 224.** CSL §3.4 p.21 says the 170 ns clock was chosen to be an integral submultiple (224) of the line rate, 875 × 30 = 26.25 kHz.
- Check (derived): 29.4 MHz / 5 / 26,250 = 224.000, and 20.16 MHz / 26,250 = 768.000.
- The two crystals are therefore locked in a **7 : 24 ratio**. Seven CPU cycles (1.1905 µs) equal exactly 24 pixel clocks, which is also exactly one step of the ÷24 sync counter. One line is 32 such steps: 224 cycles, or 768 pixel clocks.

**The oscillators are separate.** The manual calls the bit clock "asynchronous" to the 170 ns master clock. That is why the 16-word RAM plus a 1-word register act as a FIFO *and* a synchronizer between the two clock domains ([HW76 §4.2 pp.24–25]; [CSL §3.4 p.21]).

**Pixel period.**
- Full resolution: 1/20.16 MHz = 49.60 ns. The manuals say 50 ns.
- Low resolution: SETMODE with bus bit 0 set switches to a 100 ns bit clock from the next scan line ([HW76 §4.2 p.25]).
- A 16-bit word takes 16 × 49.6 = 793.7 ns = **4.67 cycles** to shift out, and a 32-bit doubleword takes **9.33 cycles** (derived).

**Horizontal timing.**
- Line period: 38.095 µs.
- The 608 bitmap bits take 608 × 49.6 ns = 30.16 µs = 177.3 cycles (derived). About 46.7 cycles (7.9 µs) of each line carry no bitmap.
- Of that, the manual gives horizontal retrace as about 6 µs ([HW76 §4.4 p.26]).
- The sync generator is a PROM state machine: an 82S23 addressed by a 4-bit state and H1, feeding a half-line counter ([SCH-C sheet 12 "Sync generator 875 line"]). Its timing is therefore quantized in 24-pixel steps of 1.19 µs. A 5-step blank would be 5.95 µs, which fits "approximately 6 µs" and ContrAlto's 6,084 ns **(inferred; I could not read the PROM contents)**.
- ContrAlto models a line as 6,084 ns of blanking plus 38 × 842 ns of words, totalling 38,080 ns = 224 × 170 ns ([CA DisplayController.cs, timing constants]). Its 842 ns per word is an approximation; the real value is 793.7 ns.

**Vertical timing.**
- 875 lines per frame, interlaced: 437.5 lines per field, 60 fields and 30 frames per second ([HW76 §1.0 p.2]; [HW76 §4.1 p.24]).
- 808 visible lines, 404 per field. So at most 33.5 lines (≈1.28 ms) of each field are blank (derived). ContrAlto uses 34 or 35 vblank lines of 38.08 µs, "~1330 µs" ([CA DisplayController.cs, FieldStart and VerticalBlankScanlineCallback]).
- DVT wakes every 16.666 ms ([HW79 App. D p.69]).

**Fraction of time pixels are actually shifting** (derived): (30.16/38.095) × (404/437.5) = 0.792 × 0.923 = **73%**. This matches CSL's "73% of the time, the rest being spent in retracing" ([CSL §3.4 p.22]).

**Bandwidth** ([CSL §3.1 p.16]; derived):
- Peak video rate: 20.16 Mbit/s. CSL says "20 Mbits/second".
- Average: 30,704 words × 16 bits × 30 frames/s = 14.74 Mbit/s. CSL says "an average of 15 megabits/second".

---

## 2. The display tasks (Q1)

### 2.1 Priorities

The task numbers below are octal ([MU line 25, the reset-location table]; [HW79 App. D p.69]; [HW76 App. A p.51]). A higher number means higher priority.

| Task # | Name | Role here | Wakeup source |
|---|---|---|---|
| 16B | KWD, disk word | (not my topic) | Above the display, because the disk has one word of buffering |
| 15B | PART, parity | Memory-error logger | A parity error |
| 14B | **DVT**, display vertical | Once per field | Start of vertical retrace (every 16.666 ms) |
| 13B | **DHT**, display horizontal | Once per line | Once at the start of each field, then **every time DWT blocks** |
| 12B | **CURT**, cursor | Once per line | Once per scan line, during horizontal retrace |
| 11B | **DWT**, display word | Whenever the FIFO has room | DWT not blocked, DHT not blocked, and FIFO not full |
| 10B | **MRT**, memory refresh ("timed task") | Once per line | Every 38.08 µs, from the display board's sync generator |
| 7 | Ethernet | – | – |
| 4 | KSEC, disk sector | – | – |
| 0 | Emulator | The user's program | Always awake |

Sources for the wakeup conditions:
- DVT, DHT and DWT: [HW76 §4.2 p.25]; [HW79 §4.2 p.33].
- CURT: [HW76 §4.4 p.26]; [SCH-C sheet 7 "Wakeups", signal WAKECURT].
- MRT: [HW79 App. D p.69] ("Wakeup every 38.08 microseconds"); [CSL §2 p.4] ("awakened every 38 µs"); [SCH-C sheet 12 signal SWAKMRT on the "Sync generator 875 line" sheet]; [KS-D5 task table].
- The Ethernet microcode comment "every 37 usec" [MU line 430] is a loose round-off, not a spec.

**Why the display sits between the disk and the Ethernet.** Buffer depth divided by data rate gives the tolerable latency. The display's 16 words at 20 Mbit/s give **12.8 µs**. The disk's single word gives about 10 µs at 1.5 Mbit/s. The Ethernet's 16 words give about 87 µs at 3 Mbit/s ([CSL §2.2 p.8]).

**Task-switch rules that matter here** ([HW76 §2.4 pp.8–9]; [HW79 part2 p.66]):
- A task gives up the processor only when it executes `TASK`.
- The switch happens after **one more** instruction.
- A task must not `TASK` while it has a memory reference in flight or state in L or T.
- Microcode must `TASK` at least every 20 instructions, preferably 15, or the Diablo 44 disk overruns.
- Branches are delayed by one instruction: a condition tested in instruction N modifies the NEXT field of instruction N+1 ([CSL §2.3 p.10]; [CA Task.cs `_nextModifier`]). This is why the Mu listings test a condition in one line and name the `:label` in the next.

### 2.2 DVT: display vertical task, once per field

```
DVT:  MAR_ L_ DASTART+1;         ; fetch word 421B (field-interrupt mask)
      CBA_ L, L_ 0;              ; CBA := 421B, the "current DCB+1"
      CURDATA_ L;
      SLC_ L;                    ; SLC := 0 lines left
      T_ MD;                     ; CAUSE A VERTICAL FIELD INTERRUPT
      L_ NWW OR T;
      MAR_ CURLOC;               ; SET UP THE CURSOR (426B/427B)
      NWW_ L, T_ 0-1;
      L_ MD XOR T;               ; HARDWARE EXPECTS X COMPLEMENTED
      T_ MD, EVENFIELD;
      CURX_ L, :DVT1;
DVT1: L_ BIAS-T-1, TASK, :DVT2;  ; BIAS THE Y COORDINATE
```
[MU lines 75–90]

What it does:
1. **ORs the word at 421B into NWW** (new interrupts waiting). This produces the 60 Hz interrupt, and per [HW79 §4.1 p.32] it fires "even if the display is off".
2. **Resets the display list.** It sets CBA = DASTART+1 and SLC = 0, so the next DHT run "finishes" a zero-line pseudo-block and follows its link word, which is the pointer stored at 420B. **The list head at 420B is treated as a fake DCB** whose next-pointer is your first real DCB (derived from DVT and DHT1).
3. **Latches the cursor position.** It stores ¬X in CURX and YPOS = BIAS − Y (−1 in one field), with BIAS = 177700B = −64 ([CONSTS line 180]).

Cost: about 15 cycles once per field, including 2 memory-wait cycles (my count). That is 0.015% of the machine.

### 2.3 DHT: display horizontal task, once per line

The comment reads ";11 cycles if no block change, 17 if new control block." ([MU lines 92–93]).

```
DHT:  MAR_ CBA-1;                 ; doubleword: DCB+0 (link), DCB+1 (mode)
      L_ SLC -1, BUS=0;           ; SLC = 0 ? -> DHT1 (next block)
      SLC_ L, :DHT0;
DHT0: T_ 37400;                   ; MORE TO DO IN THIS BLOCK
      SINK_ MD;                   ; discard link word
      L_ T_ MD AND T, SETMODE;    ; res/polarity -> hardware; low-res bit branches
      HTAB_ L LCY 8, :NORMODE;
NORMODE: L_ T_ 377 . T;           ; T := NWRDS
      AECL_ L, :REST;
REST: L_ DWA + T,TASK;            ; INCREMENT DWA BY 0 OR NWRDS
NDNX: DWA_ L, :DHT;
```
[MU lines 95–111]

What it does:
- On a normal line it re-reads DCB words 0 and 1 with one doubleword fetch and pushes mode and polarity to the hardware (SETMODE).
- It sets HTAB, the tab words, and AECL, which temporarily holds NWRDS.
- It **skips the other field's line** by adding NWRDS to DWA again. DWA has already advanced by NWRDS while the previous line was fetched.
- On a new block (DHT1/MOREB/XREST) it fetches the link, then words 1 to 3 of the new DCB, and sets DWA = SA (or SA + NWRDS in the odd field) and SLC.
- If the link is 0 it executes `BLOCK`. That stops **both DHT and DWT until the next field** ([HW76 §4.2 p.25]).

In the Alto I microcode, DHT and DWT are identical to the Alto II versions ([MU-I]; I diffed the text).

### 2.4 DWT: display word task, the pixel pump

```
DWT:    T_ DWA;
        T_-3+T+1;                     ; T := DWA-2
        L_ AECL+T,BUS=0,TASK;         ; AECL CONTAINS NWRDS AT THIS TIME
        AECL_L, :DWTZ;                ; AECL := address of last doubleword
DWTY:   BLOCK;                        ; (NWRDS = 0: nothing to do)
        TASK, :DWTF;
DWTZ:   L_HTAB-1, BUS=0,TASK;         ; left-margin loop
        HTAB_L, :DOTAB;
DOTAB:  DDR_0, :DWTZ;                 ; push a zero word
NOTAB:  MAR_T_DWA;                    ; start DOUBLEWORD fetch
        L_AECL-T-1;
        ALUCY, L_2+T;                 ; last doubleword yet?
        DWA_L, :XNOMORE;
DOMORE: DDR_MD, TASK;                 ; word 1 -> FIFO (cycle 5)
        DDR_MD, :NOTAB;               ; word 2 -> FIFO (cycle 6)
XNOMORE:DDR_ MD, BLOCK;               ; last pair: then sleep
        DDR_ MD, TASK;
DWTF:   :DWT;
```
[MU lines 135–160]

**Two words per memory reference: confirmed.**
- The manual says the word loop fetches a doubleword from DWA ([HW76 §4.3 p.25]; [HW79 §4.3 p.33]).
- In the code, each `MAR_` is followed by two `DDR_MD`.
- Thacker says the doubleword read was "originally provided to support the display" ([T86 p.92]).
- The memory delivers the first word in cycle 5 and the second in cycle 6 ([HW79 §2.3]). The loop is laid out so that `DDR_MD` falls exactly in cycles 5 and 6 with **zero wait states**. The next `MAR_` comes in cycle 7, right after the 6-cycle doubleword memory cycle ends.

**Cost** (my count): 6 cycles per doubleword, so **3 cycles per word**. A full 38-word line costs 6 (preamble) + 18 × 6 + 7 (last pair) = **121 cycles**.
- Each left-margin (HTAB) word costs 3 cycles (DWTZ, HTAB_L, DOTAB). So **a left margin costs as much CPU as bitmap does**; it saves only memory.
- The right margin is free: DWT simply stops, and the video is blank when the FIFO is empty ([CSL §3.2 p.18]: margins not painted from the bitmap are zeros).
- A line with NWRDS = 0 costs DWT 7 cycles (DWT, DWTY, DWTF).

**The memory could not have fed the display one word at a time** (derived):
- Single-word reads: 16 bits per 850 ns = **18.8 Mbit/s**, which is *below* the 20.16 Mbit/s the video shifter consumes.
- Doubleword reads: 32 bits per 1.02 µs = **31.3 Mbit/s** ([CSL §2.4 p.14] gives "32bits/(6*170ns) = 31.3 Mbits/sec").

**Duty cycle while fetching** (derived): DWT needs 6 cycles per 32 bits; the screen consumes 32 bits every 9.33 cycles. So DWT owns **64%** of the processor while the beam is drawing bitmap.
- CSL: "two thirds of the machine while data is being displayed". CSL prints the doubleword fetch as "six cycles or 1.05 µs" ([CSL §3.4 p.22], checked against the scan). 6 × 170 ns is actually 1.02 µs.
- Thacker 1986: the display "consumes two-thirds of the memory bandwidth" even with doubleword reads ([T86 p.92]).

### 2.5 The FIFO hardware

From [SCH-G p.2 block diagram]; [SCH-C sheets 8 and 10]; [CSL §3.4 p.21]; [HW76 §4.2 p.24].
- **16 words of RAM**, built from four Intel 3101A 16×4 bipolar RAMs. A 4-bit write counter (WA0–3) and a 4-bit read counter (RA0–3) are multiplexed by a 74157.
- A **P3601 PROM** looks at both pointers and produces **STOPWAKE** (drop DWT's wakeup, "full") and **MBEMPTY**.
- Next comes a **one-word intermediate buffer** (13404 register), which is the clock-domain synchronizer, then a **16-bit parallel-to-serial shift register** (two 74166s) clocked by the bit clock.
- `DDR←` is the DWT-specific F2 function (10B) that writes the bus into the FIFO ([HW79 §4.2 p.32–33]; [MU line 67]).
- The hardware **empties the FIFO and clears DWT's block flip-flop at the start of every horizontal retrace** ([HW76 §4.2 p.25]). Nothing carries over between lines. Each line starts with DWT sprinting to refill an empty buffer.
- **Uncertain: the exact "full" threshold.** DWT deposits 2 words per iteration and yields after the second, so the wakeup must drop at 14 or 15 words, not 16. ContrAlto treats ≥ 15 as full ([CA DisplayController.cs `FIFOFULL`]). The PROM contents that would settle this are not readable in the scans.

### 2.6 CURT: the whole task is two microinstructions

```
CURT: XPREG_ CURX, TASK;      ; F2=10: load cursor X counter
      CSR_ CURDATA, :CURT;    ; F2=11: load 16-bit cursor shift register
```
[MU lines 579–584]

It copies two R registers, which MRT prepared during the previous line, into the hardware. It costs **2 cycles per line**. See §5.

### 2.7 Where the cycles land inside one line (modelled)

My cycle-level model (`scratchpad/sim/scanline.py`) uses these assumptions: the FIFO is flushed at the start of retrace; retrace lasts 35 cycles; pixels start right after; DWT timings as counted above; DHT runs when DWT blocks; MRT runs after DHT, as the manual's wording implies (§5). It gives this pattern for a full-width visible line:

```
cycle 0         35                 ~88            ~140  ~151     ~172          223
      |CC|WWWWWWWWWWWWWWWWWWWWWWWWWWW|WWWWWW..WWWWWW..|HHHHHHHHHHH|MMMMM…|..............|
       CURT  DWT flat-out (retrace +  DWT bursts of 6,  DHT (11)   MRT    emulator: one
             FIFO still filling)      emulator in 3-4             (~21)   ~50-cycle block
                                      cycle gaps                          (~9 µs)
```

- **During horizontal retrace the emulator gets essentially nothing.** DWT runs flat-out refilling the flushed FIFO: 35 cycles fill only ~9 words.
- DWT keeps running continuously until the FIFO first fills, around cycle 88. Filling nets only 0.119 words per cycle because the screen is draining it at the same time.
- DWT then bursts for 6 cycles every 9.33 until its last fetch, around cycle 140. At that point the FIFO still holds about 16 words, roughly 75 cycles of video.
- The remaining ~75 cycles go to DHT (11), MRT (~21) and **the user program, in one contiguous ~50-cycle slab at the end of the line**.
- The exact placement depends on where MRT's hardware wakeup falls, which I could not pin down, and on disk and Ethernet activity. The totals in §4 do not depend on it.

---

## 3. The display control block (DCB) chain (Q2)

### 3.1 Fixed page-1 locations

From [HW79 App. B p.68]; [HW76 App. B p.52]; [CONSTS lines 146–150].

| Address (octal) | Name | Contents |
|---|---|---|
| 420 | DASTART | Pointer to the first (top) DCB, or 0 for display off |
| 421 | – | Vertical-field interrupt bit mask, ORed into NWW every 1/60 s |
| 422 / 423 | ITQUAN / ITBITS | Interval timer |
| 424 / 425 | MOUSEX / MOUSEY | Mouse coordinates, maintained by MRT |
| 426 / 427 | CURSORX / CURSORY | Cursor position, read by DVT each field |
| 430 | RTC | Real-time clock (high word) |
| 431–450 | CURMAP | 16-word cursor bitmap |
| 614–621 | DCBR, KNMAR, DWA, CBA, PC, SAD | Register dump written by the parity task |
| 177024–177026 | MEAR / MESR / MECR | Alto II ECC error address, status and control |
| 177740–177757 | BANKREGS | XM bank register per task |

### 3.2 DCB format

Four words. The DCB must start at an **even** address ([HW76 §4.1 p.24]; [HW79 §4.1 p.32]; figure in [CSL Fig. 9 p.21]).

| Word | Bits | Meaning |
|---|---|---|
| DCB+0 | 0–15 | Pointer to next DCB, or 0 if last |
| DCB+1 | 0 | Resolution: 0 = high, 1 = low (half-speed bit clock, each line shown in both fields) |
| DCB+1 | 1 | Polarity: 0 = black on white, 1 = white on black |
| DCB+1 | 2–7 | **HTAB**: wait 16×HTAB bits (left margin in words) |
| DCB+1 | 8–15 | **NWRDS**: words per scan line. **Must be even**; 0 means a blank band with no bitmap |
| DCB+2 | 0–15 | **SA**, bitmap start address. **Must be even** |
| DCB+3 | 0–15 | **SLC**: the block covers 2×SLC scan lines, SLC per field |

- The even alignments exist because DHT and DWT use doubleword fetches (inferred from §2).
- **The bitmap is stored progressively, not interlaced.** The even field shows lines SA, SA+2·NWRDS, …; the odd field starts at SA+NWRDS ([HW76 §4.1 p.24]). DHT's extra `DWA + NWRDS` step does the skipping ([MU line 110]).
- In low-res mode DWA is not advanced between fields. The same bitmap line is shown in both fields at half horizontal speed, so the memory layout is identical and only the displayed size changes ([HW76 §4.1 p.24]).
- **A real example from BCPL** ([KS-M2 code `mandel-fast.txt`]): `dcb!0 = 0; dcb!1 = 38; dcb!2 = v; dcb!3 = 404; lvdas = #420; lvdas!0 = dcb`. That is one full-screen band: 38 words, 404 lines per field, 808 lines total.

### 3.3 Bands, and why Alto screens were often partial

CSL §3.2 pp.18–19, with Fig. 8 on p.19, describes three kinds of band:
- Full width, with its own bitmap.
- **Zero width** (NWRDS = 0), used for leading, paragraph gaps and top and bottom margins.
- **Indented and narrow**, e.g. Fig. 8's "Width = 15, LeftMargin = 17, Height = 300".

The same pages give the payoff:
- For a typical text page these tricks cut the bitmap to about **70%** of full size.
- **Lines are inserted or deleted by splicing DCB pointers.** Scrolling means adjusting the line count of a zero-width DCB, "without moving anything in storage".
- The price: no multiple columns, marginal notes or windows that don't span the width.
- The editor (Bravo) could not have fitted in memory with a full-screen bitmap.
- T86 p.94 adds: the standard text editor's display went from **61 KB (full screen) to about 50 KB**.

**Cycle cost by line type** (my count; DHT 11 + CURT 2 on every displayed line):

| Line type | DWT | DHT | CURT | Display total | Share of 224 |
|---|---|---|---|---|---|
| Full width, 38 words | 121 | 11 | 2 | **134** | **59.8%** |
| Narrow band, n words (n even) | 6 + 3n + 1 | 11 | 2 | 20 + 3n | – |
| Left margin of h words | +3h | – | – | – | Margins cost like pixels |
| Blank band (NWRDS = 0) | 7 | 11 | 2 | **20** | 8.9% |
| Below the last DCB (DHT has blocked) | 0 | 0 | 2 | ~2 | ~1% |
| Display off (DASTART = 0) | 0 | ~6 once per field | – | ≈0 | ≈0 |

Two reasons programs showed less than a full screen:
1. **Memory.** A full bitmap is 30,704 words, 47% of a 64K-word machine (derived; CSL §3.1 p.16 says "half of the Alto's one megabit memory").
2. **CPU.** A full-width band takes about 60% of the cycles on each visible line (§4). Every blank band or early end of the DCB chain gives those cycles straight back to the user program.

---

## 4. Cycle budget: one scanline and one field (Q3)

### 4.1 Per scanline (224 cycles, 38.1 µs)

MRT's cost depends on the microcode version and the cursor (my count, including memory-wait cycles per [HW79 §2.3]):

| MRT variant | No cursor on this line | Cursor enabled, not yet reached | Cursor row on this line |
|---|---|---|---|
| Alto II, 4K chips (2 refreshes) | 17 | 20 | 25 |
| Alto II XM, 16K chips (4 refreshes) | 21 | 24 | 29 |
| Mouse moved this line | about +13 | | |
| Clock word ticked (every 1024 lines) | about +6 | | |

**Scanline budget table** (my count; assumes the disk and Ethernet are idle):

| Line type | DWT | DHT | CURT | MRT | Display share | Left for the emulator |
|---|---|---|---|---|---|---|
| **Visible, full width (38 words)** | **121** (54.0%) | **11** (4.9%), 17 on a band's first line | **2** (0.9%) | **17–29** (7.6–12.9%) | **134 = 59.8%** | **61–73 = 27–33%** (~69 typical) |
| During horizontal retrace (~35 cycles) | ~33 | 0 | 2 | 0 (modelled) | ~100% | **≈0** |
| Visible, blank band | 7 | 11 | 2 | 17–29 | 20 = 8.9% | 175–187 = 78–83% |
| Vertical blanking (33.5 lines per field) | 0 | 0 | 0 | 17–29 | 0 (DVT ~15 once) | **195–207 = 87–92%** |

### 4.2 Per field (98,000 cycles, 16.67 ms), full-screen single DCB (derived)

| Consumer | Cycles per field | Share |
|---|---|---|
| DWT: 121 × 404 | 48,884 | 49.9% |
| DHT: 17 + 403 × 11 + ~6 (final link = 0, BLOCK) | ~4,456 | 4.5% |
| CURT: 2 × ~404–437 | ~840 | 0.9% |
| DVT | ~15 | ~0% |
| **Display total** | **~54,200** | **55.3%** |
| MRT: ~21 × 437.5 (runs on every line, display or not) | ~9,200 | 9.4% |
| **Emulator (disk and Ethernet idle)** | **~34,600** | **35.3%** |
| Emulator with the display off (DASTART = 0) | ~88,800 | 90.6% |

Memory time: DWT holds the memory for 19 × 6 = 114 cycles of every visible line (51%), which is **47%** of all memory time over a field (derived).

### 4.3 Reconciling "about 60%"

CSL §3.2 p.18 says a full-screen bitmap "consumes about 60% of the cycles", without arithmetic. Three consistent readings:
1. **Per visible line**, the display tasks take DWT + DHT + CURT = 134/224 = **59.8%**. This matches "about 60%" almost exactly.
2. **Averaged over a field**, the display takes ~55%. CSL's own figures for the data task alone give ⅔ × 73% = 48.7%. My microcode count gives DWT = 49.9% of the field, which agrees. Adding DHT, CURT and DVT gives ~55%.
3. **As a slowdown of the user program**, which is what users feel:
   - My model's prediction: the emulator gets ~35% of cycles with the display on and ~91% with it off, a ratio of **2.55×**.
   - Shirriff's measurement: turning off the full-screen display cut his Mandelbrot from **24 minutes to 9** ([KS-M2]). That is **2.67×**, meaning the display was costing the program **62.5%** of its speed.
   - Thacker 1986: 1–3 µs per emulated instruction, "increased by a factor of three" with the display running ([T86 pp.92–93]).
   - The measured and modelled figures differ by about 5%. The likely causes are extra memory-wait and task-latency effects on the emulator, but that explanation is **(inferred)**.

**Bottom line for the script:** "about 60%" is right for the display share of a drawn line. Averaged over a field it is about 55%. Programs ran about 2.7 times faster with the display off.

Notes:
- The original Mandelbrot post (KS-M1) gives no display-off numbers. They are in the follow-up post (KS-M2).
- Shirriff "turned off" the display by setting the DCB pointer at 420B to 0 during the computation, then restoring it ([KS-M2 note 2]). The McJones comment on KS-M1 suggests the same thing.

---

## 5. The cursor (Q5)

**Data** ([HW76 §4.4 p.26]; [HW79 §4.4 p.34]):
- A 16×16 bitmap in CURMAP (431B–450B) and a position in 426B/427B, with the origin at the upper left.
- The cursor is unaffected by resolution mode. It takes the polarity of the current DCB.
- "The most efficient" way to hide it is X = −1.

**Division of labour between three tasks:**
1. **DVT, once per field**, reads X and Y from 426B/427B. It stores **¬X** in CURX ("HARDWARE EXPECTS X COMPLEMENTED") and a biased Y counter in YPOS ([MU lines 81–90]).
2. **MRT, once per line, near the end of the line**, does the real work. From `DOCUR/WAITC/SHOWC/CURF` ([MU lines 540–552]):
   ```
   DOCUR: L_ T_ YPOS;               CHECK FOR VISIBLE CURSOR ON THIS SCAN
          SH<0, L_ 20-T-1;
          SH<0, L_ 2+T, :SHOWC;      [SHOWC,WAITC]
   WAITC: YPOS_ L, L_ 0, TASK, :MRTLAST;
   SHOWC: MAR_ CLOCKLOC+T+1, :CNOTLAST;   <- CURMAP+YPOS, via the clock constant
   ```
   - YPOS rises by 2 each line, so even rows show in one field and odd rows in the other.
   - While YPOS < 0 the row is blank. For YPOS 0–15 it fetches `CLOCKLOC+1+YPOS`. Since RTC is at 430B and CURMAP starts at 431B, **the cursor fetch reuses the clock's address constant**.
   - After row 15 it sets CURX = 0, the "flag" in the manual. From then on MRT skips cursor work until the next field.
   - **Why X = −1 is cheapest:** ¬(−1) = 0, so CURX = 0 and MRT's `SH=0` test skips the cursor code on *every* line, about 3 cycles per line saved (my count).
   - The −64 bias (BIAS = 177700B) compensates for the ~32 MRT runs during vertical blanking before line 1 **(inferred)**.
3. **CURT, at the next horizontal retrace**, copies CURX and CURDATA into the hardware in 2 instructions (§2.6).

**Hardware merge** ([SCH-C sheet 11 "Cursor", sheet 10 "Video buffer"]; [SCH-G p.2]; [CSL §3.5 p.22]):
- XPREG← loads ¬X into a **10-bit counter** (three 9316s, bus bits 6–15) clocked by the pixel clock.
- When it overflows (XPPOS), a separate **16-bit cursor shift register** (two 74166s) starts shifting.
- The gates on sheet 10 compute **video = (bitmap bit OR cursor bit) XOR polarity**. The cursor is ORed with the data (CSL: "it is ORed with the main display data") *before* the polarity inversion, which is why it follows the DCB's polarity.
- The cursor costs no bitmap memory traffic beyond one word per line for 16 lines.

**Software closes the loop.** Mouse coordinates (424B/425B) and cursor coordinates (426B/427B) are separate. Software copies one to the other, and can constrain, grid-snap or "snap" the cursor ([CSL §3.5 p.22]).

**The cursor shape was information.** CSL calls it "extremely valuable": 256 bits, "about 1/4" square", where the user is looking ([CSL §3.5 p.22]).

---

## 6. Memory (Q6)

### 6.1 Organisation and timing

- **Size.** 64K × 16-bit words (128 KB). Addresses 0–176777B are storage; **177000B–177777B are I/O** (keyboard at 177034B, etc.). ([HW79 §2.3]; [HW76 §5.0 p.27])
- **Speed.** 850 ns, which is **5 microcycles**. A doubleword read extends the cycle to 6 ([HW79 §2.3 rule b]; [CSL §2 p.4]; [T86 p.92]).
- **Synchronous and processor-driven** ([CSL §2 p.4]; [HW76 §2.3 p.6]):
  - `MAR←` (F1 = 1) starts a reference.
  - `←MD` (BS = 5) reads the data.
  - `MD←` (F2 = 6) writes.
  - There is no DMA. Every device transfer is a microinstruction.
- **Alto II rules** ([HW79 §2.3], part1 PDF pp.9–12):
  - At least one instruction must separate `MAR←` from any MD access.
  - Fetch: first word in **cycle 5**, the other word of the pair (address XOR 1) in cycle 6.
  - Store: `MD←` in cycle 3 or 4 (a double store uses cycles 3 and 4).
  - The Alto II latches the read data, so `←MD` may be used any time after cycle 5.
  - `MAR←` cannot share an instruction with `←MD` of the previous reference.
  - The next `MAR←` is accepted from cycle 6 (a single reference; my reading of the examples and ContrAlto).
- **Alto I differences.** Store in cycle 5. The doubleword pairs addr with addr+1 (even address). Parity is computed on the bus, so only the constant −1 may be ANDed onto `←MD` ([HW76 §2.2–2.3 pp.6–7]).
- **Reading MD too early stalls the whole machine.** The processor suspends until the memory interface is ready; nothing else runs meanwhile ([HW79 §2.3 rule b]; [HW76 §2.3 p.7 rule b]; [CA MemoryBus.cs `Ready()` and Task.cs `MemoryWait`]).
  - Suspended cycles count against the 20-instruction task-latency budget ([HW79 part2 p.66]).
  - A reference may be abandoned by never reading MD, or by starting a new `MAR←`.
- **No split references.** A task must not `TASK` with a reference in flight, so each 6-cycle display fetch is atomic with respect to other tasks ([HW76 §2.4 p.9]).
- **Bandwidth.** Peak with doublewords is 31.3 Mbit/s ([CSL §2.4 p.14]). The display alone averages 14.7 Mbit/s (§1).

### 6.2 Generations

| Machine | Chips | Size | Checking | Boards | Sources |
|---|---|---|---|---|---|
| Alto I (1973) | 1K×1 dynamic metal-gate PMOS (**Intel 1103**) | 64K words | Parity | 16 memory boards | [CSL Fig. 2 p.3]; [KS-D1]; [KS-D5] |
| Alto II (1975 redesign) | **4K×1** dynamic Si-gate NMOS | 64K words | **ECC**: SEC-DED | "312 chips" = 39 bits × 8 chips per bit | [CSL Fig. 2 p.3, §2 p.4]; [T86 p.97]; 39 × 8 = 312 is (derived) |
| Alto II XM | **16K×1** (4116) | Up to **256K words = 512 KB** in four 64K banks | ECC | 4 boards × 80 chips; each board holds a 10-bit slice of a 40-bit doubleword | [CSL Fig. 2 p.3]; [KS-D1]; [KS-D5]; [HW79 §2.3] |

Notes on the table:
- **ECC word.** 32 data bits + 6 Hamming bits + 1 parity bit, plus 1 unused bit on the XM boards ([KS-D5]).
- **ECC registers.** MESR reports "Hamming code", "parity", and syndrome bits 8–13 ([HW76 §5.6 p.30]).
- **Date conflict.** CSL Fig. 2 dates 256K/16K to **1977**. T86 p.97 says the 16K "final redesign" was in **1979**. The microcode change log has "Modified MRT to refresh 16K chips" on 15 Sep 1977 ([MU lines 7–9]), which supports 1977 for at least the first 16K machines.
- **Shipping practice.** From the 7th build on, every Alto II had the XM option but was normally shipped with bank-0 chips only ([HW79 §2.3]).
- **Parity on stores.** The Alto II checks parity on stores as well as fetches ([HW79 §2.3 rule c]).
- **Memory control boards** on the XM machine: AIM (Address Interface Module, which also decodes memory-mapped I/O), DIM (Data Interface Module: Hamming generation, detection and correction) and MEAT (Memory Extension And Terminator) ([KS-D5]).
- **Board keying.** Memory boards need −5 V and +12 V for the 4116s and are notched so they can't go in the wrong slot ([KS-D5 follow-up, day 6]).

### 6.3 The parity task (PART, 15B)

- It wakes on a memory error and dumps six registers into 614B–621B: disk DCB pointer, disk word pointer, display word address (DWA), display DCB address (CBA), PC and SAD. These are the registers most likely to hold the failing address ([MU `PART`/`PX` lines 2082–2110]; [HW76 §5.6 p.29–30]).
- It raises emulator interrupt channel 15, the highest.
- On the Alto II it first writes all ones to MECR, turning off memory interrupts ([MU `PART`]).
- **Side effect:** it uses CURDATA as scratch. The comment reads "THIS CLOBBERS THE CURSOR FOR ONE FRAME WHEN AN ERROR OCCURS" ([MU lines 2107–2108]).
- Shirriff's logic-analyzer trace of a failing boot shows the parity task running within the first few instructions ([KS-D5]).

### 6.4 XM bank registers

From [HW79 §2.3], part1 PDF pp.12–13, and [CA Memory.cs].
- Sixteen registers at **177740B + task number**, one per task.
- Bits 12–13 hold the task's **normal** bank. Bits 14–15 hold its **alternate** bank.
- An "extended" reference is coded as `XMAR←`: `MAR←` (F1 = 1) and `MD←` (F2 = 6) in the same instruction.
- The top 512 words of every bank are the I/O page, so 177740B always reaches the bank registers.
- Booting clears them all to bank 0.
- To run the display from another bank, load the registers for DVT, DHT and DWT. The display then uses page 1 (420B…) *of that bank*.
- The 1977 BitBLT supports source and destination in the alternate bank (DISP bits SOURCEBANK 40, DESTBANK 20; [MU lines 1294–1298]).

---

## 7. MRT: the memory refresh ("timed") task (Q7)

**Rate.** One wakeup every **38.08 µs**, one per scanline including vertical blanking ([HW79 App. D p.69]; [CSL §2 p.4]). The wakeup signal SWAKMRT comes from the display board's sync generator ([SCH-C sheet 12]). So **DRAM refresh is paced by the TV raster**.

**Refresh signalling.** Any memory reference started by an instruction whose **RSELECT = 37B** is a refresh cycle that activates all memory cards ([HW76 §2.3 rule d p.7]; [HW79 §2.3 rule d]). The microcode's refresh references are `MAR← R37…`. **The register number is the refresh signal.**

**Refreshes per wakeup, by version:**

| Version | Refresh `MAR←`s per run | R37 step | Code |
|---|---|---|---|
| Alto I (`altocode24`) | 1: `MAR_ R37 AND T` (T = REFMSK 77740B) | +100B | [MU-I MRT/NOCLK]; [CONSTS line 247] |
| Alto II, 4K chips | 2: `MAR_ R37`, `MAR_ R37 XOR 2` | +4 | [MU AltoIIMRT4K lines 2121–2135] |
| Alto II XM, 16K chips | **4**: `MAR_ R37`, `XOR 2`, `XOR 200`, `XOR 202` | +4 | [MU AltoIIMRT16K lines 2168–2205] |

- The 16K comments state "R37 [8-14] are the refresh address bits" (7 bits, 128 rows) and "four refresh addresses are generated, though R37 is incremented only once".
- In every version a full sweep takes **32 wakeups ≈ 1.22 ms** (derived: 32×1, 32×2 and 32×4 references). That is inside the usual 2 ms DRAM spec.
- The 1103/4K/16K row counts of 32/64/128 are standard datasheet values, **not stated in the Alto documents**.
- On older hardware the refresh `MAR←R37` itself cleared MRT's wakeup. The 16K version uses `BLOCK` instead ("assumes MRTACT is cleared by BLOCK, not MAR_ R37", [MU line 2174]; [CA MemoryRefreshTask.cs]).

**One register, several jobs.** R37 holds:
- the interval-timer and EIA enable flags in its low bits;
- **the low 10 bits of the real-time clock** in bits 4–13 ("R37 [4-13] are the low bits of the TOD clock");
- the refresh row address.

A single `+4` per scanline advances the clock and the refresh row together ([MU lines 2175–2193]). When bits 4–13 wrap (every 1024 lines = 38.99 ms, derived), `CLOCK` increments the RTC word at 430B ([MU lines 533–538]). `RCLK` returns AC0 = RTC and AC1 = R37 ([MU lines 1096–1099]).

**Mouse.**
- `SINK_ MOUSE, BUS` ("MOUSE DATA IS ANDED WITH 17B") does a 9-way dispatch on the mouse's 4 motion bits (TX0–TX8).
- `M00` then does read-modify-write of X and Y at MOUSELOC ("START THE FETCH OF THE COORDINATES") ([MU lines 555–575, 2121–2122]).
- At most **±1 count per axis per scanline**, about 26,000 counts/s (derived).
- Resolution conflict: [HW76 §5.2 p.28] says "approximately 100 points per inch"; [CSL §3.5 p.22] says one unit is roughly 1/200 inch.
- Buttons and keyset are plain memory-mapped bits at UTILIN 177030B, not MRT work ([HW76 §5.2–5.3]).

**Interval timer and EIA.**
- `SIT` ORs AC0 into R37's flag bits ([MU line 764]).
- When the flag is set, MRT compares the clock bits with ITTIME (525B). On a match it stores the state in ITQUAN (422B) and ORs ITBITS (423B) into NWW ([MU `DOTIMER`…`TIMERINT` lines 2137–2158]).
- The same path polls the EIA serial interface at 177701B.
- MRT also generates the Ethernet countdown wakeup ([MU lines 430–436]).

**Cursor.** See §5.

**Cost.** 17–29 cycles per line (§4.1), about 9% of the machine, whether or not anything is displayed.

---

## 8. BitBLT (Q8)

### 8.1 Who and when

- **The memo.** Dan Ingalls, "Bit BLT", memo to Alto Users, **19 November 1975**, organization LRG ([BB75 p.1]).
  - It is headed as a *final* description.
  - The routines "grew out of discussions among Larry Tesler, Bob Sproull, Diana Merry and me".
  - It was shipped as a BCPL driver, a machine-code inner loop, and microcode `BITBLT.MU`.
- **Credit elsewhere.** CSL §3.3 p.20: "designed by Dan Ingalls", and called **RasterOp** in Newman and Sproull. T86 p.89: BitBlt was "invented by Dan Ingalls". L86: "designed by Dan Ingalls".
- **Diana Merry.** Her `BBSCAN.SR` (20 Apr 1976), bound in the same PDF, shows character scan-conversion via BitBlt with "strike" fonts ([BB75 pp.3–5]).
- **What it replaced.** T86 p.89 says BitBlt superseded an earlier specialized character-painting instruction. That instruction survives in the ROM as `CONVERT` ("Scan convert instruction for characters"), and **BitBLT reuses CONVERT's mask table at 460B** ([MU lines 1010–1025, 1326–1337]; [CONSTS line 216]).
- **Maintenance.** The ROM version is "Last modified Sept 6, 1977 by Dan Ingalls", supporting alternate memory banks. The change log reads "BitBLT fixed (LREG bug) and extended for new memory" ([MU lines 6–7, 1285–1288]).

### 8.2 What it does

- **Rectangles.** A block is (bitmap base, bitmap width in words, x, y, width, height) with arbitrary bit alignment ([BB75 p.1]).
- **The descriptor table** passed in AC2 is 16 words and even-aligned ([MU offsets lines 1327–1336]; [BB75 p.3] Merry's table):

  | Word | Field |
  |---|---|
  | 0 | Function |
  | 2 | Destination base |
  | 3 | Destination raster (width in words) |
  | 4, 5 | Destination x, y |
  | 6, 7 | Width, height |
  | 10B | Source base |
  | 11B | Source raster |
  | 12B, 13B | Source x, y |
  | 14B–17B | Gray (texture) |

- **Function = source type + operation.** The 1977 microcode's DISP carries "SOURCE(14), OP(3)" ([MU line 1294]).
  - Operations ([MU lines 1665–1673]):

    | Code | Operation |
    |---|---|
    | 0 | Replace |
    | 1 | Paint (OR) |
    | 2 | Invert (XOR) |
    | 3 | Erase ((NOT source) AND dest) |

  - Source types ([MU lines 1635–1650]; [BB75 p.2]):

    | Code | Source |
    |---|---|
    | 0 | Block |
    | 4 | Complement of block |
    | 8 | Block as a *brush* with gray: gray where the brush is 1, destination kept where 0 ("transparency") |
    | 12 | Gray alone |

  - That gives **16 combinations**.
  - The typed memo lists operations as 0/4/8/12 and sources as 0/1/2/3. **Handwritten corrections swap them** to match the microcode.
- **Gray.** In the memo, gray is one word holding a **4×4** pattern ([BB75 p.2]). The 1977 microcode takes **four words**, one per row, cycling by line mod 4 (`DOGRAY`, [MU lines 1587–1592]). In effect that is a **16×4** texture, which is what CSL §3.3 p.20 calls it. Merry's table has four "scratch gray" words "for building gray words for microcode" ([BB75 p.3]).

### 8.3 How the microcode does it

Label names and line numbers are from [MU].

1. **Setup** (`BITBLT`…`GFN`, lines 1348–1545).
   - Fetch the table fields with doubleword reads (`FDBL`).
   - Compute **SKEW = (SRCX − DESTX) mod 16** and choose the horizontal direction (`CSHI`: "TEST HORIZONTAL DIRECTION"; `LTOR`/`RTOL` set HINC = ±1).
   - Build **MASK1 and MASK2** for the ragged first and last words from the mask table. For right-to-left, add WIDTH−1 to the x's and **swap the masks**.
   - Count the whole middle words (NWORDS).
   - Choose the vertical direction ("VINC _ 0 IFF TOP-TO-BOTTOM").
   - Compute start addresses as base + x/16 + **y × raster, using a shift-and-add multiply loop inside the BitBLT microcode** (`MULLP`, line 1477), done once for the source and once for the destination.
   - Decide whether to preload the first source word (TOPLD).
2. **Vertical loop** (`VLOOP`/`BENTR`): step both addresses by ±(raster ± words), decrement NLINES, check for interrupts, and load this line's gray word if needed.
3. **Horizontal loop.** Three calls per line: the first word (masked), the middle words (full store) and the last word (masked). A comment admits an "UGLY HACK" that "SQUEEZES 2 INSTRS OUT OF INNER LOOP" (line 1621).
4. **Per word** (`WIND` line 1709):
   - Fetch a source word.
   - Merge it with the previous one (WORD2) under the skew mask.
   - **Rotate by SKEW through the general cycle subroutine.**
   - Combine with the destination per OP.
   - Store it, masked (`STMSK`) or full (`STFULL`).
   - Zero skew skips the rotate ("ZERO SKEW BYPASSES LOTS", line 1714).
5. **No barrel shifter.** The shifter does ±1 bit or an 8-bit swap ([HW76 §2.1 p.4]). The cycle table (`L0`–`L8`, `R1X`–`R7`, lines 978–1002) rotates by any n using **one byte swap plus at most 3 one-bit shifts** (e.g. L5 = byte swap, then 3 right). That is the main reason BitBLT spends tens of cycles per word.
6. **Hardware needed.** BitBLT uses registers R40–R51, which live on the Control RAM board. Without that board it traps ("TRAP IF NO RAM", `BBNORAM`, lines 1348–1352). The 1975 driver likewise fell back to Nova code when the RAM microcode wasn't loaded ([BB75 p.2]).

### 8.4 Speed

From the memo ([BB75 p.2]). These are Alto cycles including memory waits but excluding competition from the display or disk. µs figures are (derived) at 170 ns.

| Operation | Cycles | Time |
|---|---|---|
| Store constant | 15 per word | 2.55 µs/word |
| Move block, store | 36 per word | 6.1 µs/word; 2.25 cycles/pixel |
| Move block, OR | 42 per word | 7.1 µs/word |
| Vertical loop overhead | 25–30 per line | |
| Setup, or resume after an interrupt | ~150 | |

My rough hand-count of the 1977 unaligned-copy inner loop is ~35–40 cycles per word, consistent with the memo **(approximate)**.

Full-screen estimates (derived):
- **Copy (unaligned):** 30,704 × 36 + 808 × 27 cycles ≈ 1.13M cycles ≈ **0.19 s** with the display off. With a full-screen display the emulator gets ~35%, so ≈ **0.5 s**.
- **Clear:** ≈ 80 ms with the display off, ≈ 0.22 s with it on.
- The memo's own figure: "like 1/4 second to move most of the screen" (while not yet interruptible).

### 8.5 Staying interruptible

Two levels:
1. **Microtask level.** BitBLT is emulator microcode (task 0), so it is sprinkled with `TASK`. Every higher-priority device task (display, disk, MRT) gets in within a few instructions. The code even counts instructions to the next TASK ("ENTER HERE (8 INST TO TASK)", line 1709) to respect the ~15–20-instruction latency rule ([HW79 part2 p.66]).
2. **Program-interrupt level.**
   - In Nov 1975 the microcode was *not* interruptible, and the memo promised a fix: saving state in the ACs and resuming later ([BB75 p.2]).
   - By 1977, once per scan line (`BENTR`: "CHECK FOR INTERRUPTS", line 1569), a pending enabled interrupt sends it to `DOI1`.
   - `DOI1` stores the lines done in AC1 and **backs up the PC** ("BACK UP THE PC, SO WE GET RESTARTED", line 1581).
   - After the interrupt handler, BITBLT re-executes and resumes from line AC1 (`TTOB`: "ADD NDONE TO STARTING Y'S", line 1449).
   - AC1 must be 0 on the first call (header, lines 1290–1294). The manual documents this convention ([HW76 §9.21 p.49]).
   - Opcode **61024B** (line 1285); fixed ROM entry point BITBLT = 124B ([HW76 §9.1 p.48]).

### 8.6 Overlap

BitBLT picks the copy order like a 2-D `memmove`:
- If the source x is at or left of the destination x, it runs **right-to-left**, using HINC = −1, swapped masks, and addresses starting at x + width − 1.
- If the destination y is above the source y, it runs **top-to-bottom**; otherwise bottom-to-top, with addresses starting at y + height − 1.

So overlapping scrolls and window drags never read already-overwritten bits ([MU `CSHI`/`RTOL`/`LTOR` lines 1378–1384, `BTOT`/`TTOB` lines 1436–1449]). The memo: the routine "first considers the possibility of source-destination overlap" and orders the transfer accordingly ([BB75 p.2]).

This is **one loop parameterized by direction**, not separate left-to-right and right-to-left loops.

---

## 9. Uncertain or conflicting points

1. **FIFO "full" threshold** (14, 15 or 16 words). Not determinable from the scans. ContrAlto uses 15.
2. **Horizontal blanking length.** The manual gives "approximately 6 µs". The 5-step PROM reading (5.95 µs) is inferred. The non-bitmap time per line is certainly 46.7 cycles (7.9 µs).
3. **Vertical blanking.** At most 33.5 lines per field (derived); ContrAlto uses 34 or 35. The exact PROM value is unknown.
4. **When MRT's wakeup falls within the line.** It comes from the sync generator; I could not trace the exact timing. The manual implies it is after DWT has finished its output. This affects *where* the emulator's cycles land, not the totals.
5. **Mouse resolution.** 100/inch (HW76) or 200/inch (CSL).
6. **Date of 16K chips.** 1977 (CSL Fig. 2 and the microcode change log) or 1979 (T86).
7. **CSL's "1.05 µs" per doubleword.** The scan really says 1.05; 6 × 170 ns = 1.02 µs.
8. **606 vs 608 visible pixels.** The manuals say the CRT has 606 points, but 38 words (608 bits) are fetched, and CSL says 608 picture elements per line. Which 2 bits are cut off is not documented.
9. **The Alto I display board** may differ (its clocks, for instance). All the schematic facts here are from the Alto II Display Control board.
10. **My cycle counts.** DWT 121, MRT 17–29, DVT ~15, DHT 11/17 (the last from the microcode comment). They assume the Alto II memory rules and no competing higher-priority tasks. The disk word task or Ethernet can steal cycles from anyone below them.

---

## 10. Corrections to `reports/Xerox Alto explainer research.md` (display and memory sections)

1. **"the display word task takes 3 cycles per word × 38 words, about 51% of the line"**
   - 3 × 38 = 114 leaves out the loop entry and exit. The real count is **121 cycles = 54%** per full line.
   - The three display tasks together (DWT + DHT + CURT) come to **134/224 = 59.8%**. That is essentially the paper's "about 60%".
2. **"MRT roughly 10–15"**
   - It is **17–29 cycles per line**: 17 on a 4K-chip Alto II with no cursor, up to 29 on an XM line with the cursor row.
   - Add about 13 on any line where the mouse moved.
3. **"leaves the user's program about 40% of the machine during visible lines"**
   - On a full-width visible line the emulator gets **61–73 cycles (27–33%)**, and essentially **none during horizontal retrace**.
   - Averaged over a field it is **~35%**. During vertical blanking it is 87–92%.
   - "About a third" is the accurate phrase.
4. **"Hiltzik's shorthand is that the display slowed the processor by roughly a factor of three"**
   - The primary source is Thacker 1986 (p.92–93): emulated instruction times "increased by a factor of three".
   - There is also a measurement: Shirriff's Mandelbrot went from **24 to 9 minutes** with the display off (2.67×).
   - That measurement is in the *follow-up* post ("Improvements to Xerox Alto Mandelbrot"), not the one-hour post the report cites.
5. **"The refresh task wakes about every 37 µs and makes two dummy references"**
   - The spec is **38.08 µs**, once per scanline (HW79 App. D; CSL "38 µs"). The "37 usec" comes from an Ethernet microcode comment.
   - The number of refresh references is **1 (Alto I), 2 (Alto II with 4K chips) or 4 (Alto II XM with 16K chips)**.
   - They are real memory cycles flagged as refresh because they use register **R37** (RSELECT = 37B). They are not "dummy" loads in the usual sense.
6. **"The clock appears to have been chosen to fit the display… implies 875.4 lines per frame"**
   - This is not inference: CSL §3.4 says so explicitly (224 is an "integral submultiple" of the 26.25 kHz line rate).
   - The true clock is 29.4 MHz ÷ 5 = 5.88 MHz (170.07 ns), so a line is exactly 224 cycles and exactly 875 lines per frame.
   - The "875.4" is a rounding artifact of using 170 ns.
7. **Alto II row: "4 Kbit chips (implied…; part number unconfirmed)"**
   - The 4K×1 chips (dynamic Si-gate NMOS) with ECC are **confirmed** by CSL Fig. 2 and Thacker 1986 p.97. Only the part number is still unconfirmed.
   - CSL gives "312 chips" for main memory: 39 bits (32 data + 6 Hamming + 1 parity) × 8 chips per bit.
8. **Alto II XM row.** Add the structure: each of the 4 boards holds a **10-bit slice** of a 40-bit doubleword (32 data + 6 Hamming + parity + 1 spare) (KS-D5).
   - Date conflict: 1977 (CSL, microcode log) vs 1979 (T86).
9. **XM bank registers: "Each task has its own bank register"** is correct, but incomplete.
   - Each register holds *two* 2-bit bank numbers, normal and alternate.
   - `XMAR←` (MAR← and MD← in one instruction) selects the alternate bank.
   - The top 512 words of every bank are I/O.
10. **"Once per field, the vertical task reloads the head of the chain from a fixed low-memory address"**
    - Close, but DVT does not read 420B.
    - It sets CBA = 421B and SLC = 0. DHT then reads 420B *as if it were the link word of a zero-line DCB*.
    - DVT *does* read 421B (the 60 Hz interrupt mask) and 426B/427B (cursor X and Y).
11. **"Programs could get memory and cycles back by showing fewer or narrower bands"**
    - True, but only the right margin is free.
    - **Left margins (HTAB) cost the same 3 cycles per 16 pixels as bitmap**, because DWT pushes explicit zero words.
    - Blank (NWRDS = 0) bands cost 20 cycles per line. Lines below the end of the DCB chain cost ~0.
12. **"The cursor… Its task is just two microinstructions long, and hardware mixes the cursor row into the video"**
    - Correct, but the fetch of the row is done by **MRT**, not the cursor task.
    - The mix is an **OR before the polarity XOR** (schematic; CSL "ORed").
13. **"Lampson lists its modes… plus a 4×4 texture"**
    - Lampson's 4×4 matches the 1975 memo's one-word gray.
    - The shipped 1977 microcode takes four gray words, one per row, so it is effectively **16×4**, as CSL §3.3 describes it.
14. **"Comments describe… separate left-to-right and right-to-left loops"**
    - There is **one** loop parameterized by HINC = ±1 and VINC (up or down). The setup code chooses the direction and swaps the edge masks.
15. **BitBlt credit** (report cites Wikipedia†). Use the primary memo instead:
    - Ingalls, 19 Nov 1975: routines "grew out of discussions among Larry Tesler, Bob Sproull, Diana Merry and me".
    - CSL and T86 both say Ingalls designed or invented it.
16. **Table row "Display cost: About 60% of all cycles"**
    - Better: "~60% of each drawn scanline (134 of 224 cycles); ~55% averaged over a field; programs ran ~2.7× faster with it off".
    - Memory: 14.7 Mbit/s average, 20.16 Mbit/s peak, 31.3 Mbit/s memory peak.

---

## 11. Nerd gems for the video

Suggested colour key for all animations: **red** = display tasks (DWT/DHT/CURT), **yellow** = MRT (refresh/mouse/clock), **blue** = the user's program (emulator). Everything else is 1-bit black and white in a 9:16 frame.

1. **Two crystals locked 7 : 24.**
   - Fact: 29.4 MHz ÷ 5 gives the CPU clock; 20.16 MHz is the pixel clock. Every **7 CPU cycles = exactly 24 pixels**, and 224 cycles = 768 pixel clocks = one scanline. Both oscillators sit on the display board (SCH-G p.2; CSL §3.4).
   - *Animate:* two meshing gears (7 teeth, 24 teeth). Each red tooth-strike drops a column of 3–4 white pixels onto a scanline growing down the portrait frame.
2. **The memory was too slow for the screen, until it read two words at once.**
   - Fact: single-word reads give 18.8 Mbit/s; the pixels need 20.16 Mbit/s. Doubleword reads give 31.3 Mbit/s, and Thacker says they were added for the display.
   - *Animate:* a conveyor of pixels outruns a one-word bucket, which overflows in red. The bucket splits into a two-word bucket and keeps up.
3. **The pixel pump is six microinstructions.**
   - Fact: `MAR←DWA … DDR←MD, TASK; DDR←MD` moves 2 words per 6 cycles, with the loads landing exactly in memory cycles 5 and 6, zero wait. That is 3 cycles per 16 pixels.
   - *Animate:* the 6 lines of microcode as a vertical ticker. Each pass drops two 16-pixel red bars into a 16-slot tube.
4. **A scanline is a 224-slot strip, and your program gets the leftovers at the end.**
   - Fact: on a full line, DWT 121, DHT 11, CURT 2, MRT ~21, you ~69. The FIFO is flushed every line, so the retrace belongs entirely to DWT. The user's time arrives as one slab at the end of the line (§2.7).
   - *Animate:* a tall 224-cell column filling top to bottom: a red flood, red and blue stripes, a yellow notch, then a solid blue block. Repeat fast to become a field.
5. **Turning off the screen made programs 2.7× faster.**
   - Fact: Shirriff's Mandelbrot took 24 minutes with the display on and 9 with it off. The model gives ~35% vs ~91% of cycles.
   - *Animate:* split screen. The top half renders the Mandelbrot slowly under a lit screen; the bottom half with the screen dark finishes first, then the display pointer flips and the image appears at once.
6. **The display list starts with a fake block.**
   - Fact: DVT sets "lines left = 0" and points at 421B, so DHT immediately "finishes" a phantom block and follows its link word, which is the pointer at 420B.
   - *Animate:* a chain of 4-word DCB cards. The first card is a dashed ghost with "0 lines" that instantly hands off to the real chain.
7. **Blank bands are nearly free; the end of the list is free.**
   - Fact: a full-width line costs 134 cycles, a zero-width band 20, and lines after the last DCB about 0. Bravo scrolled by changing the line count of a blank band, "without moving anything in storage" (CSL).
   - *Animate:* a page of text bands. The white gaps between paragraphs stretch and shrink to scroll, while a per-line red cost meter at the side drops at each gap.
8. **Margins aren't free on the left.**
   - Fact: the left margin (HTAB) is made by pushing explicit zero words at 3 cycles each, the same as pixels. The right margin costs nothing.
   - *Animate:* an indented band with red ticks marching across the empty left margin. None appear on the right.
9. **The cursor is a two-instruction task, fed by the refresh task.**
   - Fact: CURT is just `XPREG←CURX, TASK; CSR←CURDATA`. MRT fetches each cursor row using the *clock's* address constant (CURMAP = RTC + 1). The row is ORed into the video before the polarity flip.
   - *Animate:* a 16×16 arrow assembled row by row. A yellow hand (MRT) passes each row to a red two-line stamp (CURT), which ORs it onto the passing scanline.
10. **Setting the cursor's X to −1 is the fast way to hide it.**
    - Fact: the hardware wants X complemented; ¬(−1) = 0, and MRT treats CURX = 0 as "skip the cursor". It saves ~3 cycles on every line.
    - *Animate:* a counter labelled X counting pixels until it overflows and fires the cursor. Set it to −1 and the counter reads 0 and goes dark.
11. **Refresh is signalled by a register number.**
    - Fact: any memory reference started with register **R37** selected is a refresh cycle for every memory card. R37 also holds the refresh row, the low 10 bits of the real-time clock and the timer flags. One `+4` per scanline advances all of them.
    - *Animate:* one 16-bit register with its bit fields coloured yellow (clock), white (row) and blue (flags). A single "+4" ripple advances the clock and sweeps a refresh stripe down a memory-chip grid.
12. **The TV raster paces the DRAM refresh.**
    - Fact: the refresh task's wakeup (SWAKMRT) comes from the display board's 875-line sync generator, once per scanline. Refreshes per wakeup scaled with chip generations: 1 (Alto I), 2 (4K chips), 4 (16K chips). A full sweep takes 32 lines ≈ 1.2 ms.
    - *Animate:* as the beam draws each line, a yellow tick lights 1, then 2, then 4 rows in a DRAM grid, with a generation label switching.
13. **A memory error glitches the cursor.**
    - Fact: the parity task uses the cursor-data register as scratch, which "CLOBBERS THE CURSOR FOR ONE FRAME" (microcode comment). It also dumps six suspect address registers to 614B–621B.
    - *Animate:* the arrow cursor flickers into noise for a single frame while six red numbers drop into memory slots.
14. **BitBLT has no barrel shifter; it rotates by hand.**
    - Fact: each unaligned word is rotated by a byte swap plus up to 3 one-bit shifts through a cycle subroutine. That is ~36 cycles (6 µs) per 16 pixels; a full-screen copy takes ~0.2 s CPU-only and ~0.5 s with the display on.
    - *Animate:* a 16-bit word doing a byte-flip, then 1–3 single-step hops into alignment, before sliding into a destination rectangle.
15. **BitBLT restarts itself.**
    - Fact: once per scanline it checks for interrupts. If one is pending, it saves "lines done" in AC1 and **backs up the PC**, so the same instruction runs again later and resumes mid-rectangle. It also picks its copy direction so overlapping moves are safe.
    - *Animate:* a rectangle copy sweeping top-down is paused by a blue interrupt flag. The PC arrow steps back one instruction, and the sweep resumes from the saved line.
