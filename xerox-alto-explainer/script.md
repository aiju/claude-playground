# Task Zero: script and storyboard

A 9:16 short, just under two minutes, that does nothing but nerd out about the Alto's processor. The story is one idea: the Alto had one microcoded processor, and it did the work of the display, disk, Ethernet and memory-refresh controllers by handing itself between hardware tasks, with switches that cost zero cycles. The "computer" you programmed was just the lowest-priority task.

Facts come from the processor deep-dive notes in [`research_notes/Alto processor deep dive/`](research_notes/Alto%20processor%20deep%20dive). Almost all of them trace to primary documents: the 1976 and 1979 Alto Hardware Manuals, Xerox's 1979 Alto II microcode listing, the schematics, and Thacker et al., "Alto: A Personal Computer" (CSL-79-11, 1979). The [fact sheet](#fact-sheet) at the end maps every claim in the narration to its source.

## Format

| | |
| --- | --- |
| Frame | 1080 × 1920, drawn at 540 × 960 and scaled up with nearest-neighbour |
| Length | ~118 s: 331 words of narration take 105 s as generated (~190 wpm), and the gaps between lines add the rest (see [TTS notes](#tts-notes)) |
| Palette | Ink on paper, plus the Alto's three mouse-button colours |
| Voice | One narrator (Gemini TTS), brisk and dry, a little amused |

**Colour key.** The same key is used in every scene:

| Colour | Means |
| --- | --- |
| Blue | Display tasks (display word, display horizontal, display vertical, cursor) |
| Red | Disk (the most urgent task, so the alarm colour) |
| Yellow | Memory refresh and mouse; Ethernet (striped yellow) |
| Ink | Task 0, the emulator: **your program** |

Patterns (solid, stripes, dots) tell apart tasks that share a colour.

## Narration and storyboard

Section times are from the first generated narration track (`node narration.js`). Line IDs (N1…) are the units sent to TTS one at a time, so the visual timeline can be laid out from the measured clip lengths.

### 1. Hook: first light (0:00–0:09)

> **N1** April 1973. The first picture on a Xerox Alto: Cookie Monster. Every pixel, fed to the screen by its one and only processor.

- **Visual:** A portrait Alto screen (3:4) on paper. A red beam sweeps down and draws a pixel-art cookie with a bite out of it, line by line. That's our own drawing standing in for the real sketch. A small counter ticks `line 0 … 807`. "APRIL 1973" sits in the corner.
- **Sound:** The heartbeat clock fades in (see [Sound](#sound)). The beam is a soft rising sweep, one tick per band.

### 2. The controllers that aren't there (0:09–0:17)

> **N2** The Alto's device boards are mostly buffers and shift registers. The rest — every disk word, every packet, every scanline — is microcode.

- **Visual:** Three board outlines slide in, labelled DISK, ETHERNET and DISPLAY. Each is a grid of chips.
  - Most chips grey out (dither), leaving a small highlighted cluster labelled `1-word buffer + shift reg`, `16-word FIFO + Manchester + CRC` and `16-word FIFO + shift reg`.
  - Three arrows run from the boards into one box: **PROCESSOR · microcode**.
- **Sound:** Each board lands with a relay-like clunk. The greying-out is a descending blip.

### 3. One microinstruction (0:17–0:32)

> **N3** Every 170 nanoseconds, it runs one 32-bit microinstruction: register, ALU op, bus source, two functions… and the address of the next one.
>
> **N4** There's no program counter to increment. Every instruction names its successor, and a branch just ORs a bit into that address.

- **Visual (N3):** The microword scene. 32 bit cells in two rows; each field lights up as it's named: RSEL, ALUF, BS, F1, F2, then NEXT in red. The bits re-randomise on every heartbeat tick.
- **Visual (N4):** Cut to a 32 × 32 grid, the 1,024-word microcode PROM. A single lit cell hops from address to address, leaving a dotted trail.
  - On "ORs a bit", the 10-bit NEXT address appears under the grid. A condition bit drops onto its last bit, and the hop swings between two neighbouring cells (even/odd).
  - Real target pair from the listing: `MAYBE` = 526, `NOINT` = 527.
- **On screen, a real line from Xerox's listing:** `G16: L← ACDEST+T, TASK, :SHIFT;  ADD`
- **Sound:** Every hop is a tick. The OR makes a small "flip" click.

### 4. The computer is a program (0:32–0:48)

> **N5** Even the instruction set programmers saw — a Data General Nova lookalike — is just a microcode program. An ADD is eight microinstructions: 1.36 microseconds. A real Nova 1200 took 1.35.
>
> **N6** That emulator is task zero: the lowest of sixteen priorities.

- **Visual (N5):** "ADD 1,2" appears in big type. The PROM grid replays the real ADD path through its eight octal addresses, `020 → 525 → 576 → 527 → 535 → 612 → 556 → 533`, with a counter running 1…8 and "1.36 µs" at the end. A second stopwatch labelled `Nova 1200` stops at 1.35 µs right beside it.
- **Visual (N6):** The grid collapses into a stack of 16 horizontal lanes, numbered 17 down to 0 in octal (as in the listing). Lane 0 is filled in ink and labelled **YOUR PROGRAM**.
  - Xerox's actual task table scrolls past above: `NOVEM,,,,KSEC,,,EREST,MRT,DWT,CURT,DHT,DVT,PART,KWDX`.
- **Sound:** Eight ticks for the ADD, then a low "thunk" for task zero.

### 5. Sixteen tasks, free switching (0:48–1:05)

> **N7** Each task has its own micro-PC. Devices raise wakeup lines, a priority encoder picks the winner, and the running task yields whenever it says TASK. Nothing is saved, so switching is free.
>
> **N8** Priority follows buffering: the disk holds one word, so it outranks everything. The Ethernet holds sixteen, so it can wait.

- **Visual (N7):** Lanes are drawn left to right as a timeline; each lane has a tiny micro-PC register at its left end.
  - Wakeup flags pop up on lanes (blue display, yellow refresh, red disk).
  - A priority-encoder bracket on the right points at the highest raised flag. When the running lane shows `TASK`, control jumps lanes with no gap, and a "0 cycles" label flashes.
  - Lane 0 fills every gap in ink.
- **Visual (N8):** Two buckets under clocks. The disk bucket has 1 slot and a fast drip (a word every ~10 µs); a red LATE lamp sits on it. The Ethernet bucket has 16 slots and a slow drip (a word every 5.44 µs, but 16 deep). The disk's flag always wins the encoder.
- **Sound:** Each lane has its own pitch, and a task switch is a pitch jump. The disk is a sharp high blip, the Ethernet a softer blip.

### 6. The screen eats the machine (1:05–1:29)

> **N9** The screen is a 606 by 808 bitmap — nearly half of main memory.
>
> **N10** The clock was picked so a scanline is exactly 224 cycles. And memory's too slow for single words, so the display reads two at a time: thirty-two pixels every six microinstructions.
>
> **N11** On each visible line, the display takes sixty percent of the cycles, memory refresh about a tenth — and your program gets the rest: about a third.

- **Visual (N9):** The memory scene. A 64-row memory bar (1K words per row) fills 30 rows in blue; the portrait screen beside it fills in step. Labels: `30,704 words · 61,408 bytes · 47%`.
- **Visual (N10):**
  - Two meshing gears marked 7 and 24, labelled `CPU 5.88 MHz` and `pixels 20.16 MHz`. They drive a ruler of 224 ticks across the frame, labelled `1 scanline = 224 × 170 ns = 38.08 µs`.
  - Then the six-line display-word loop from the listing appears as a vertical ticker. Each pass drops two 16-pixel bars into a 16-slot FIFO tube. The lines on screen:
    ```
    NOTAB:  MAR← T← DWA;
            L← AECL-T-1;
            ALUCY, L← 2+T;
            DWA← L, :XNOMORE;
    DOMORE: DDR← MD, TASK;
            DDR← MD, :NOTAB;
    ```
- **Visual (N11), the hero shot:**
  - The 224-slot scanline grid (14 × 16) fills cycle by cycle in modelled schedule order. The cursor's 2 cycles come first. Then comes a solid blue flood of display words while the FIFO refills after retrace, with yellow refresh cycles slotted in as the FIFO tops up. Next, 11 striped DHT cycles set up the next line. The rest is one solid ink slab.
  - Percentages count up beside the legend: display 60%, refresh 8%, **your program 32%**.
  - The schedule comes from a cycle-level model of the Alto II microcode (display notes, §2.7). The totals are solid. Exactly where the refresh cycles fall within the line is an assumption (ContrAlto's convention).
  - The grid then shrinks into one line of a whole field and repeats fast down the portrait frame, so the screen fills with the stripe pattern.
- **Sound:** The grid fill is sonified: each slot is a 4 ms tone whose pitch is its task's. The line sounds like a chord that's mostly blue with a dark ink tail, so you can literally hear your program getting the leftovers.

### 7. Everything else is microcode too (1:29–1:45)

> **N12** Even DRAM refresh is microcode — and on its way through, that task counts the mouse.
>
> **N13** The disk task stores a word and updates the checksum in one microinstruction.
>
> **N14** Ethernet sends a bit every two cycles — hence 2.94 megabits — and its random backoff is read off the refresh counter.

Rapid cuts, about 5 s each:
- **N12:**
  - A DRAM chip grid; a yellow refresh stripe sweeps one row per scanline.
  - Beside it, a 3 × 3 arrow pad (the mouse's 9 possible moves) lights one cell per tick, and X/Y counters at `424`/`425` bump by one.
  - The three mouse buttons light up as bits named RED, YELLOW and BLUE.
- **N13:** A disk word drops out of a shift register and splits in two: one path into a memory column, the other through an XOR into a checksum register that starts at `521`. Both happen on the same tick.
- **N14:**
  - A clock ladder with a Manchester waveform aligned two rungs per bit.
  - Then an 8-bit odometer (the refresh tick counter) is ANDed with a mask that gains one yellow `1` per collision, giving a red countdown bar.
- **Sound:** The refresh is a soft yellow tick, the disk a chunky head click, the Ethernet a bit-chirp, and a collision a "bonk".

### 8. Payoff (1:45–1:58)

> **N15** Switch the screen off, and programs run almost three times faster.
>
> **N16** All four display tasks together? Sixty-three microinstructions. Your program? Task zero. It gets whatever's left.

- **Visual (N15):** Two progress bars: `display on: 24 min` and `display off: 9 min` (Ken Shirriff's Mandelbrot run on a restored Alto). In the scanline grid, all the blue slots turn to ink at once.
- **Visual (N16):**
  - The 1,024-cell PROM map shades by task: emulator ~628 cells in ink, disk 145 red, Ethernet 95 yellow, display 63 blue, which is a tiny sliver.
  - Hard cut to the scanline grid, the ink slab glowing. Title card: **TASK ZERO**, with the three mouse-button bars.
- **Sound:** The screen-off moment drops the blue texture and the heartbeat speeds up. The end is a 7:24 polyrhythm resolving on one chord.

## Trims and extras

The narration is 331 words. As generated it's 105 s of speech and a 1:58 track with the gaps, so nothing needs cutting yet. If a new voice or the visuals push it over 120 s, cut in this order:
1. N13 (the disk checksum), −13 words.
2. The last sentence of N5 (the Nova 1200 comparison), −6 words.
3. In N7, "Each task has its own micro-PC", −6 words. The visual still shows it.

Optional lines if there's room, or for a longer cut:
- **Precedent:** "Thacker reinvented this: MIT's TX-2 had hardware task sequences in 1958, but for slow devices. The Alto did it every 170 nanoseconds, for the screen." Sources: Thacker's 2007 CHM oral history, p. 14; Forgie 1957.
- **Locks for free:** "A task can't be interrupted until it says TASK, so device microcode gets mutual exclusion for free." Source: CSL79 §2.
- **The controllers came back:** the Dorado made task switching preemptive, and by the 1985 Daybreak workstation an 80186 handled all the I/O. Source: rationale notes §4.

## Sound

- **Heartbeat.** A soft click train standing in for the 170 ns clock, slowed down by a very large factor. It's always there and speeds up and slows down with the story.
- **Tasks have pitches.**

  | Task | Sound |
  | --- | --- |
  | Display | A bright, buzzy mid tone |
  | Refresh | A soft high tick |
  | Disk | A sharp high blip |
  | Ethernet | A breathy chirp |
  | Your program | A low, warm tone |

  Any animation that shows the schedule also plays it.
- **Music: a 7 : 24 polyrhythm.** The CPU and pixel clocks are locked at 7 cycles to 24 pixels. So the backing pulse is 7 low notes against 24 high ticks per bar. It's audible as a lopsided groove and only nerds will get it, which is the point.
- **Foley:** relay clunks for boards landing, and a disk spin-up whine under the first scene. All of it is synthesised in JS like the repo's music projects (the code gets copied and adapted, not imported).

## TTS notes

- **One narrator.** Style prompt, kept fixed for every line: *"Brisk, clear, dry technical narrator with a hint of amusement; like a friendly engineer showing off something clever."*
- **Model and voice.** `gemini-3.8-flash-tts` with the Charon voice for now; a sampler of seven other voices is waiting on a listen.
- **Prompt shape.** Given a plain "Read this as…" preamble, the model reads the preamble aloud. `tts.js` sends the style under `### DIRECTOR'S NOTES` and the line under `#### TRANSCRIPT` instead, and only the transcript gets spoken.
- **Takes go wrong.** In the first run, 5 of 35 takes failed (counting the 16 lines, 14 voice samples and retakes). The model invented an opening ("Hey everybody. So if you've got a PC today…", three times on N7, which starts mid-thought), added a leading "And", or said a sentence twice. `tts.js` has `gemini-3.8-flash` transcribe each take and redoes any that don't match the line.
- **Pronunciation.** `tts.js` sends "ALU" as A-L-U and "micro-PC" as micro-P-C. Everything else ("ORs", "Nova 1200", "2.94 megabits", `TASK`) came out right as written.
- **Measured.** The lines run from 3.2 s (N15) to 11.3 s (N5), 105 s in all. With 0.35 s between lines and 0.8 s between sections, the narration track is 1:58.

## Fact sheet

Every claim in the narration, with where it comes from. "HW79" is the 1979 Alto Hardware Manual, "µcode" the 1979 Alto II microcode listing (`altoIIcode3.mu`), and "CSL79" is Thacker et al. 1979. Line references and page numbers are in the deep-dive notes.

| Line | Claim | Source |
| --- | --- | --- |
| N1 | First picture: Cookie Monster, April 1973 | Kay, *Early History of Smalltalk* (1993) |
| N2 | The disk hardware is only drivers, one word of buffer, shifting, encoding and sync; everything else is microcode | CSL79 §4.2; disk/Ethernet notes |
| N2 | Ethernet board: 16-word FIFO, Manchester coding, CRC in hardware; DMA, filtering and backoff in microcode | HW79 §7; µcode; schematics |
| N3 | 170 ns microcycle; 32-bit microinstruction with RSEL/ALUF/BS/F1/F2/T/L/NEXT | HW79 §2; CSL79; ContrAlto |
| N4 | No incrementer; NEXT names the successor; branches OR into the low address bit (one instruction late) | CSL79 p.10; HW79 p.10 |
| N5 | The Nova-like ISA is the task-0 microcode (`NOVEM`); ADD = 8 microinstructions (1.36 µs) | µcode reset table and G16; hand trace in micromachine notes |
| N5 | Nova 1200 ADD = 1.35 µs (LDA 2.55 µs on both) | Data General, *How to Use the Nova Computers* (1974), p. D12 |
| N6 | 16 task levels; the emulator is task 0, the lowest | µcode reset table; HW79 |
| N7 | Per-task micro-PCs (3101A RAM); wakeup lines + priority encoder; TASK function; nothing saved on a switch | HW79 §2; schematics; ContrAlto CPU |
| N8 | Disk word task is the highest-priority standard task; 1-word disk buffer vs 16-word Ethernet FIFO | CSL79 §2.2; µcode |
| N9 | 606 × 808 visible (38 words = 608 bits per line); 30,704 words = 47% of 64K words | HW79 §4; computed |
| N10 | Clock chosen as 1/224 of the line period; 29.4 MHz ÷ 5; pixel clock 20.16 MHz (7 : 24) | CSL79 §3.4; display schematic |
| N10 | Doubleword reads added for the display; DWT moves 2 words per 6 microinstructions | Thacker 1986; µcode DWT loop |
| N11 | Visible line: display 134/224 = 60%; MRT 17–29 cycles; emulator 61–73 cycles (27–33%) | Cycle count from µcode (display notes) |
| N12 | DRAM refresh done by the MRT microcode task; MRT also updates mouse X/Y at 424/425 | µcode MRT; HW79 §5 |
| N13 | The disk read loop stores a word to memory and XORs it into the checksum in one microinstruction (`MD← L← KDATA XOR T`) | µcode KWD read loop |
| N14 | Ethernet bit = 2 × 170 ns → 2.94 Mbit/s | HW79 §7.2 |
| N14 | Backoff = refresh tick count mod 256, ANDed with a doubling mask | µcode Ethernet output (EOCDWT area) |
| N15 | ~3× faster with the display off (Thacker); Mandelbrot 24 → 9 min (Shirriff) | Thacker 1986; righto.com |
| N16 | Display tasks = 63 of 1,024 ROM microinstructions; emulator ~628, disk 145, Ethernet 95 | Count from µcode addresses (micromachine notes) |

**Rounded or simplified:**
- "Every pixel, fed to the screen by its one and only processor" leaves out the display board's hardware: the FIFO, shift register, sync generator and cursor shifter. N2 covers that.
- "Nothing is saved": by convention each task keeps its state in its own registers.
- "About a third" is 27–33% depending on the refresh work on that line.
- ADD at eight microinstructions and the 63-instruction display count come from our own traces and counts of the listing, not from a document that states them.
