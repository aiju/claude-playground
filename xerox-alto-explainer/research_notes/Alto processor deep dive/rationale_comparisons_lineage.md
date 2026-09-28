# Alto processor: rationale, precedents, lineage, instruction sets and physical build

Research notes for the 90–120 s explainer about the Alto's microcoded processor. This file covers **why** the one-processor, many-task design was chosen, what came before and after it, the multiple instruction sets, and the hardware you could hold in your hand. The micromachine core, display/memory and disk/Ethernet are covered in the sibling files in this folder.

Unlike the earlier research round, almost everything here was **read in full from primary documents** (downloaded September 2026). Anything known only from a search-engine snippet is marked †. Arithmetic I did myself is marked *(computed)*. Quotations are kept under 15 words.

## Sources

Local copies are in `/tmp/claude-0/-home-user-claude-playground/92890434-7951-5d24-a783-35e7d78c2b45/scratchpad/alto-sources/` (the scratchpad is not part of the repo).

| Key | Document | Where |
|---|---|---|
| **CSL79** | Thacker, McCreight, Lampson, Sproull, Boggs, *Alto: A Personal Computer*, CSL-79-11, 7 Aug 1979 (also in Siewiorek, Bell & Newell, *Computer Structures*, 1982) | [OCR text](https://bwlampson.site/25-Alto/25-AltoOCR.htm); [scan](http://bitsavers.org/pdf/xerox/parc/techReports/CSL-79-11_Alto_A_Personal_Computer.pdf). Cited by section, since the OCR has no page numbers |
| **TH86** | C. P. Thacker, "Personal Distributed Computing: The Alto and Ethernet Hardware", ACM Conf. on the History of Personal Workstations, Jan 1986, pp. 87–100 | [PDF](https://bwlampson.site/38-AltoSoftware/ThackerAltoHardware.pdf) (PDF page *n* = printed page 86+*n*) |
| **OH07** | Oral history of Chuck Thacker, interviewed by Al Kossow, 29 Aug 2007, CHM X4148.2008 | [CHM catalog 102658126](https://www.computerhistory.org/collections/catalog/102658126); [transcript PDF](https://s3.us-west-1.wasabisys.com/chm-cms-media/media-live/_file/import/102658126-05-01-acc.pdf) |
| **TM74** | Thacker & McCreight, *Alto: A Personal Computer System* (hardware manual/memo), Dec 1974 | [bitsavers](http://bitsavers.org/pdf/xerox/alto/memos_1974/Alto_A_Personal_Computer_Dec74.pdf) |
| **HW76 / HW79** | *Alto Hardware Manual*, Aug 1976 and May 1979 (McCreight, Boggs, Taft) | [Aug76](http://bitsavers.org/pdf/xerox/alto/Alto_Hardware_Manual_Aug76.pdf); [1979 part 1](http://bitsavers.org/pdf/xerox/alto/AltoHWRef.part1.pdf), [part 2](http://bitsavers.org/pdf/xerox/alto/AltoHWRef.part2.pdf) (part 2 has no text layer; I OCR'd it) |
| **INTRO79** | *Alto II Documentation, Book I: General Introduction* (Xerox, 1979): module location chart, power wiring | [01a_INTRO.pdf](http://bitsavers.org/pdf/xerox/alto/schematics/01a_INTRO.pdf) |
| **CARDS** | Hand-drawn "P.C. Alto Card Arrangement", first sheet of the Alto I schematics | [AltoI_Schematics.pdf](http://bitsavers.org/pdf/xerox/alto/schematics/AltoI_Schematics.pdf), p. 1 |
| **WHY72** | Butler Lampson, "Why Alto", Xerox memo to CSL, 19 Dec 1972 | [web page](https://bwlampson.site/38a-WhyAlto/WebPage.html) |
| **LAM86** | Lampson, "Personal Distributed Computing: The Alto and Ethernet Software" (1986/88) | [PDF](https://bwlampson.site/38-AltoSoftware/Acrobat.pdf) |
| **LAM06** | Lampson, "The Alto at PARC in the 1970s", slides, 17 Oct 2006 | [PDF](https://bwlampson.site/Slides/AltoAtPARCIn1970s.pdf) |
| **KAY93** | Alan Kay, "The Early History of Smalltalk", HOPL-II, 1993 | [worrydream transcription](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| **ING20** | Dan Ingalls, "The Evolution of Smalltalk from Smalltalk-72 through Squeak", PACMPL 4 (HOPL IV), 2020 | [PDF](https://smalltalkzoo.computerhistory.org/papers/EvolutionOfSmalltalk.pdf) |
| **LPD75** | L. P. Deutsch, "Status report on Alto Lisp", Xerox memo, 14 May 1975 | [bitsavers](http://bitsavers.org/pdf/xerox/alto/memos_1975/Status_Report_on_Alto_Lisp_May75.pdf) |
| **MESAROM** | `MesaROM.mu`, XMesa microcode version 39, last modified by Levin, 6 Mar 1979 (header comments) | [ContrAlto repo](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/MesaROM.mu) |
| **BYTERP** | `BYTERP.MU`, Smalltalk-76 byte-interpreter microcode, "NOVACALL VERSION I", 13 Dec 1977 | [CHM Filene/Smalltalk-76](http://xeroxalto.computerhistory.org/Filene/Smalltalk-76/.index.html) |
| **MARSH80** | Sidney Marshall, "Microcode in Smalltalk", Xerox memo, 19 Nov 1980 | same CHM directory, `microSmall.memo` |
| **UCODE** | Xerox Alto II microcode listing `altoIIcode3.mu` (1979) | [ContrAlto](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu) |
| **FORGIE57** | J. W. Forgie, "The Lincoln TX-2 Input-Output System", WJCC, Feb 1957 (in Lincoln Lab 6M-4968, §II, pp. 37–47) | [bitsavers TX-2_Papers_WJCC_57.pdf](http://bitsavers.org/pdf/mit/tx-2/TX-2_Papers_WJCC_57.pdf) (no text layer; I OCR'd it) |
| **THORN70** | J. E. Thornton, *Design of a Computer: The Control Data 6600*, 1970, pp. 10–11, 141–143 | [bitsavers](http://bitsavers.org/pdf/cdc/cyber/books/DesignOfAComputer_CDC6600.pdf) (OCR'd) |
| **SMOT** | Mark Smotherman (Clemson), "Honeywell 800" architecture sketch and "History of Multithreading" (2005/2007) | [H800](https://people.computing.clemson.edu/~mark/h800.html); [MT](https://people.computing.clemson.edu/~mark/multithreading.html) |
| **LP80** | Lampson & Pier, "A Processor for a High-Performance Personal Computer", 7th ISCA, 1980 (the Dorado processor) | [PDF](https://bwlampson.site/24-DoradoProcessor/Acrobat.pdf) |
| **PIER83** | K. Pier, "A Retrospective on the Dorado", ISL-83-1, Aug 1983 | [bitsavers](http://bitsavers.org/pdf/xerox/parc/techReports/ISL-83-1_A_Retrospective_on_the_Dorado_-_A_High-Performance_Personal_Computer_198308.pdf) |
| **DORHW81** | *Dorado Hardware Manual*, 14 Sep 1981 | [bitsavers](http://bitsavers.org/pdf/xerox/dorado/Dorado_Hardware_Manual_Sep1981.pdf) |
| **D0HW79** | *D0 Hardware Manual*, May 1979 (the Dolphin) | [bitsavers](http://bitsavers.org/pdf/xerox/dolphin/D0_Hardware_Manual_May1979.pdf) |
| **DLION79** | Bob Belleville, "Dandelion – Function and Performance", SDD memo, 10 Aug 1979 | [bitsavers](http://bitsavers.org/pdf/xerox/8010_dandelion/DandelionOverviewAug79.pdf) (OCR'd) |
| **DLIONHW** | *Dandelion Hardware Manual*, v2.2, March 1982 (Crane, Davies, Garner, Ogus) | [bitsavers](http://bitsavers.org/pdf/xerox/8010_dandelion/DandelionHardwareRefRev2.2.pdf) (OCR'd pp. 1–50) |
| **DAYB86** | *Daybreak Technical Reference Manual*, Dec 1986, ch. 1 | [bitsavers TechRef_1.pdf](http://bitsavers.org/pdf/xerox/6085/daybreak/Daybreak_Technical_Reference_Manual_Dec86/TechRef_1.pdf) |
| **DG74** | Data General, *How to Use the Nova Computers*, 015-000009-09, Oct 1974 | [bitsavers](http://bitsavers.org/pdf/dg/015-000009-09_HowToUseNova_Oct74.pdf) (App. D p. D12 = PDF p. 242) |
| **STELLA79** | Steve Wright, *Stella Programmer's Guide* (Atari 2600), 1979 | [HTML transcription](https://alienbill.com/2600/101/docs/stella.html) |
| **BAD** | Worth & Lechner, *Beneath Apple DOS* (1981; 1982 printing), ch. 3 | [apple2.org.za mirror](https://mirrors.apple2.org.za/Apple%20II%20Documentation%20Project/Books/Beneath%20Apple%20DOS.pdf) |
| **CUDA** | NVIDIA, *CUDA C++ Programming Guide* v12.4, §4.2 "Hardware Multithreading" | [docs.nvidia.com](https://docs.nvidia.com/cuda/archive/12.4.0/cuda-c-programming-guide/index.html) |
| **SH16a/b/c/d** | Ken Shirriff's righto.com: YC Alto overview (June 2016); restoration day 1 (June 2016); day 2 (July 2016); day 5 (Sept 2016) | [a](https://www.righto.com/2016/06/y-combinators-xerox-alto-restoring.html), [b](https://www.righto.com/2016/06/restoring-y-combinators-xerox-alto-day.html), [c](https://www.righto.com/2016/07/restoring-y-combinators-xerox-alto-day.html), [d](https://www.righto.com/2016/09/xerox-alto-restoration-day-5-smoke-and.html) |
| **WP** | Wikipedia raw wikitext (Sept 2026): TX-2, CDC 6600, Barrel processor, Honeywell 800, Disk II, Group coded recording, Television Interface Adaptor, ZX80, ZX81, Data General Nova, Xerox Star, Xerox Daybreak, Simultaneous multithreading, Hyper-threading, Temporal multithreading | en.wikipedia.org |
| **CORE** | Sibling note `micromachine_core.md` (this folder): hand traces of the emulator microcode | local |

Sites that blocked me: amturing.acm.org, cacm.acm.org, microsoft.com research blog and web.archive.org. The ACM Turing laureate essay is therefore snippet-only (†).

---

## 1. Rationale: why one processor for everything?

### 1.1 The designers' stated reasons

**The two design goals, in Thacker and McCreight's own manual (TM74 §2.0, p. 6):**
1. "the simplest structure adequate for the required tasks".
2. "minimize the amount of hardware in the I/O controllers", by doing most I/O processing in microprograms.

The 16 fixed-priority tasks were "devised" to serve these goals, so that devices could run in parallel with each other and with the CPU (TM74 §2.0).

**The architectural argument (CSL79 §2).**
- In most small machines the memory is multiplexed between the I/O controllers and the CPU, "and when an I/O controller is accessing the memory, the CPU is idle".
- The Alto instead multiplexes the processor, and "multiplexing of the memory is a natural consequence".
- The Data General manual of the day describes exactly the conventional scheme the Alto rejected: a disk "can gain direct access to memory through a data channel", and "the program simply pauses while access is made" (DG74 ch. 1, p. 13).

**"Trading hardware for microcode": the phrase is theirs.**
- CSL79 §4 calls one design choice a good example of "trading off controller hardware against shared processor time, register space, and microcode space".
- The rule was: "Usually the decision was made to minimize controller hardware."
- Where it was cheaper, they went the other way. About two extra chips in the disk controller saved one R-register or about 30 microinstructions.

**What each controller ends up being (CSL79 §2.3).** Most controllers are just:
- a small buffer to absorb wakeup latency;
- registers and interface logic for the device's electrical protocol;
- a little logic to decode the F1/F2 fields and raise wakeups.

Because the processor makes every memory request, "the usual DMA hardware found in most minicomputers is eliminated" (CSL79 §2.3). The 1979 field-service introduction puts it bluntly: "There isn't much special-purpose hardware in the Alto" (INTRO79 p. 4).

**Why it doesn't hurt performance (CSL79 §2.3, §4; TH86 p. 91).**
- The memory, not the processor, is the bottleneck.
- In the high-bandwidth controller loops, "all but one of the microinstructions are executed concurrently with the main memory transfer" (CSL79 §4). The extra cost of also sharing the processor is therefore minimal.
- Thacker 1986: "multiplexing the processor in this way did not degrade system performance" (TH86 p. 91).
- The Dorado paper restates the argument most crisply: when I/O makes memory references, the emulator waits for memory anyway, so "the processor might as well be working for the I/O device" (LP80 §4).

**Better interfaces for free (CSL79 §2; TH86 p. 94).**
- Each controller has "the full processing capability and temporary storage of the micromachine at their disposal" (CSL79 §2).
- So the display interprets a chain of control blocks in memory, and so does the disk. Those are "convenient logical interfaces" that a cheap DMA controller would not have given (TH86 p. 94).
- Thacker calls this "intimate coupling" "one of the most powerful features of the Alto" (CSL79 §2.3).

**Flexibility and experimentation.**
- The processor was "specified with flexibility and expansion in mind"; microcode "allowed us to experiment with new instruction sets and with new input-output devices" (TH86 p. 91).
- Lampson's 2006 summary of the hardware ideas (LAM06 slide 14):
  - "KISS";
  - "cheap enough to build lots of them";
  - "Programmable at all levels";
  - "could change the instruction set and add new operations easily";
  - Ethernet and laser-printer controllers were "add-ins".

**Cost (the constraint behind all of it).**
- Lampson's 1972 memo projected about $10.5K per Alto (WHY72 §2).
- The cost is "about equally split among disk, memory, and everything else" (WHY72 §2). With two-thirds of the budget going on disk and memory, the processor and controllers had to be minimal *(my reading of the memo, not a stated argument)*.
- Thacker: cost "was not a primary consideration", but "it could not be outrageous", because they needed enough machines to justify writing software (TH86 p. 89).
- Actual cost: about **$18,000** for the Alto I and about **$12,000** for the 1975 Alto II redesign (TH86 p. 97). Lampson's 2006 slide also says "$12,000 to make" (LAM06 slide 13).
- Appendix F of Ingalls' HOPL IV paper (Alan Kay's voice, it seems) gives the context: packaged Nova memory cost about 2.5¢/bit, so the display memory alone would have been about $12,500 in 1971. Thacker's answer was the first viable IC memory (the Intel 1103, a little under 1¢/bit) plus a "meta-computer" that emulated as much as possible in microcode (ING20 App. F, pp. 98–99).

**Simplicity paid off in the build.** "The microprocessor was simple enough that the hardware worked almost immediately. Debugging the microcode was more difficult" (TH86 p. 93).

**The priority order is a buffer-depth calculation, not a bandwidth ranking (CSL79 §2.2).**

| Controller | Buffer | Latency it tolerates | Priority |
|---|---|---|---|
| Disk | One word | ≈10 µs at 1.5 Mbit/s | Highest |
| Display | 16 words | ≈12.8 µs at 20 Mbit/s | In the middle |
| Ethernet | 16 words | ≈87 µs at 3 Mbit/s | Low, even though it needs more bandwidth than the disk |

**Locks for free (CSL79 §2.2).** With only one processor, device microcode protects shared data "by simply not allowing task switches in critical sections". Mutual exclusion is simply not executing TASK.

### 1.2 What Thacker said later

- **1979:** processor sharing among I/O and emulation "has been extremely successful" (CSL79 §8). Thacker also foresaw the alternative:
  - hardware was now cheap enough "to replicate the processor in every I/O controller";
  - but without caches or multiported memories, shared memory "will still limit the system's performance";
  - those alternatives add cost, "while the multitasking is very inexpensive", so "this architecture is still viable today".
- **1986:** the processor's "principal characteristic" versus contemporary minis was that it was shared between emulation and up to fifteen other fixed-priority tasks. It "was very successful in the Alto, and has been used in several of the Alto's successors" (TH86 p. 91).
- **2007:**
  - "we multiplexed the computing rather than multiplexing the access to memory";
  - that leads to "an enormous simplification in the device controllers", making the system cheap, "particularly if you like complicated devices" (OH07 p. 14);
  - tasks could switch "in one cycle", and "we kind of turned around the way computers had been architected until then" (OH07 p. 14).
- The Dorado team kept the idea and gave two reasons: memory contention dominates anyway, and a shared processor makes complex device interfaces cheap. They added a caveat: for low-bandwidth devices, LSI controller chips were reducing the advantage, "but for data rates above one megabit/second no such chips exist as yet" (LP80 §4). Pier's 1983 retrospective says the multitasking architecture "has proved itself", especially in uniformity and flexibility (PIER83 §5.1, p. 22).

### 1.3 Was the task idea new, or borrowed? (Sources conflict. Don't say "inspired by TX-2".)

| Source | What it says |
|---|---|
| **Thacker 1986** | "This technique had been used before on the Lincoln Laboratory TX-2", citing Forgie's 1957 TX-2 I/O paper (TH86 p. 91, ref. [14]). This states precedence, not inspiration. |
| **Thacker 2007** | The multiplexing "had actually been invented once before but we didn't know it, on the TX-2". Thacker and McCreight heard about it afterwards from Wes Clark. McCreight joked that when the TX-2 paper appeared he "was five years old, or nine years old" (OH07 p. 14). Thacker recalls Clark citing an FJCC paper "in 1965 or something"; the TX-2 I/O paper is actually WJCC, Feb 1957 (FORGIE57; TH86 ref. 14). Forgie's 1965 FJCC paper is about TX-2 *time-sharing* (WP TX-2), so the memory is garbled. |
| **Kay 1993** | "Chuck claimed that he got the idea from a lecture I had given on coroutines". Kay remembers the TX-2 used the idea first and says he "probably mentioned that in the talk" (KAY93, Alto section). |
| **Pier 1983 (Dorado)** | Processor sharing "originated in the TX-2 computer" and "is also used in the Alto" (PIER83 §4, p. 5). This states priority, not how Thacker came to it. |

**Thacker's own earlier machines.**
- **BCC 500 (1968).** Thacker describes it as five independent microcoded processors: one for scheduling, one for terminal I/O, one for "rotating memories" and two CPUs (OH07 p. 7). That is essentially the *opposite* approach: separate processors per function. The Alto folded them into one engine *(my framing; Thacker doesn't draw this contrast himself)*.
- **MAXC (1971–72).** A microcoded PDP-10 emulation built by PARC (KAY93; OH07 pp. 11–12). Kossow suggested they had done "similar things with MAXC already, with the disc controller". Thacker: "Not as thoroughly … an exploratory probe" (OH07 p. 14). MAXC also contributed the rapid-prototyping facility and even the memory boards used in the first Altos (TH86 p. 91).

**Bottom line for the script:** "The idea had been invented once before, on MIT Lincoln Lab's TX-2 in 1957. Thacker found out afterwards." That is safe. "Borrowed from the TX-2" is not.

### 1.4 What the designers considered weaknesses

1. **Address space and memory size.**
   - "The limitations on the size of the address space and on the amount of real memory have been serious" (CSL79 §8).
   - "a fairly serious error" (TH86 p. 91).
   - Lampson calls them the Alto's "most serious deficiency" (LAM86 §1.1).
   - The extended-memory bank-register scheme is "this clumsy arrangement", an "unplanned addition" (CSL79 §2).
2. **Not a fast machine.** "The Alto was not a high-performance machine, even by the standards of its time." Emulated instructions take 1–3 µs, and "With the display running, these times are increased by a factor of three" (TH86 pp. 92–93).
3. **The display eats the machine, by choice.**
   - A full-screen bitmap uses "about half the main storage" and "about 60% of the cycles" (CSL79 §3.1).
   - While visible lines are being painted, the display data task alone "consumes two thirds of the machine", which is 73% of the time (CSL79 §3.4).
   - The display takes "two-thirds of the memory bandwidth" even with doubleword reads (TH86 p. 92).
   - They accepted this deliberately: "willing to expend a considerable fraction of the machine's resources" on the user interface (TH86 p. 90).
4. **The micromachine is poor at emulating "existing architectures with structured opcodes"** (CSL79 §8). The BCPL/Nova decoding hardware (under ten chips, CSL79 §2.4) went unused by later emulators. Thacker: it "probably would have been better" spent on functions "with more general utility" (TH86 p. 93).
5. **No writeable control store at first.** Thacker: the lack was "a serious limitation" for an experimental machine. In summer 1973 they added 1K words of RAM before committing to printed circuit boards (TH86 p. 95).
6. **The microstore was too small later.**
   - With 1K of RAM, the music microcode (TWANG), animation microcode (KAOS) and OOZE microcode could not be loaded together (ING20 §4.6, p. 29).
   - Smalltalk-76's interpreter didn't fit, so part was left in emulated Nova code, "which forced two layers of interpretation" (KAY93, NoteTaker section).
7. **Awkward micro-programming details (CSL79 §2.3–2.4).**
   - No hardware subroutine linkage (worked around with dispatch tables).
   - Branches take effect one instruction late.
   - No conditional branch allowed right after a TASK.
   - No indexed R-register addressing, so multiple Ethernet boards couldn't share one copy of microcode (CSL79 §5).
8. **A software-level weakness.** Because nothing but files and network protocols was standardized, no Alto could act as a remote terminal to another (CSL79 §7.1).

---

## 2. Precedents and analogues

A compact way to compare them uses four axes:
- **Granularity:** what gets interleaved. Microinstructions, machine instructions, or whole scanlines.
- **Scheduling:** demand plus fixed priority, round-robin, or static hand-scheduling.
- **Switch cost:** what state must move.
- **Role of the "main" program:** is the user's program one of the multiplexed threads?

The Alto combines:
- per-**microinstruction** granularity (a switch can follow any microinstruction that says TASK, taking effect one instruction later);
- **demand-driven fixed priority**, where devices raise wakeups;
- **cooperative yield**, since the running task must execute TASK, and it isn't preempted (CSL79 §2.3; TH86 p. 92);
- an essentially **free switch**, since only the micro-PC is kept per task, in a 16-word MPC RAM, and everything else is shared by convention (CSL79 §2.3; HW79 §2.4);
- the **user's program as the lowest-priority task**, which always requests service (CSL79 §2).

### 2.1 Lincoln Lab TX-2 (operational 1958): "multiple sequences"

Forgie's 1957 I/O paper describes a "multiple-sequence computer" (FORGIE57 §II.B–K, pp. 37–47):
- It has several program counters, which "time-share the hardware of the central computer". Each I/O device gets its own sequence, so "we effectively obtain an input-output computer for each device" (§II.B).
- **33 sequences.** Half of the 64-word index-register memory holds 32 program counters, plus the special start-over sequence 0 (§II.C).
- **Fixed priority.** "control of the machine will go to the sequence having the highest priority" (§II.C). Priorities were changeable, "but such changes are not under program control" (§II.C).
- **Main computation at the bottom of the list.** Table I ends with "Main sequences (three)". The devices above them include magnetic tape, printer, A-D converter, paper tape, light pen, **display (several sequences)**, TX-0 link and Flexowriters (Table I, p. 47). This is the same shape as the Alto's emulator in task 0.
- **Cooperative switching via two bits in every instruction.** The **break** bit permits a switch to a higher-priority sequence; the **dismiss** bit says the sequence is done for now (§II.C, §II.G–H). These are the Alto's TASK and "remove wakeup, then TASK" (CSL79 §2.3) *(my mapping)*.
- **Minimal buffering.** Usually "one line of data" per device, for example 6 bits for a tape reader (§II.D).
- **Register state saved by convention.** A higher-priority sequence that uses the arithmetic registers must store and reload them before dismissing (§II.J). The Alto rule is the same: don't TASK with state in L or T (CSL79 §2.3).

Differences from the Alto:
- **Level.** TX-2 sequences run ordinary machine instructions out of 6.5 µs core, not microcode (R. L. Best's memory paper in the same 1957 volume, §IV).
- **Switch cost.** Changing sequence meant exchanging program counters with the core X-memory, partly overlapped (§II.F). It was not free.
- **Target devices.** Forgie's own conclusion: the technique suits "a large number of relatively slow input-output devices", "as opposed to a smaller number of high-speed devices" (§II.K, item 7). The Alto applied the same idea at 170 ns granularity to its *fastest* device, the display at about 20 Mbit/s.

### 2.2 CDC 6600 peripheral processors (1964): the "barrel"

- Ten Peripheral and Control Processors (PPUs), each with its own 4,096 × 12-bit memory with a 1 µs cycle and its own stored program (THORN70 pp. 10–11).
- They are not ten physical processors. "a network of registers" shares "one common arithmetic, logical, and distribution system". The barrel has ten positions, one of which is "the slot" (THORN70 pp. 141–142, Fig. 83).
- "Once every minor cycle, 100 nanoseconds, all information in the barrel is moved one position." So each PPU passes through the slot once per 1,000 ns major cycle, matching its memory cycle, "without degrading their performance" (THORN70 p. 143).
- A PPU instruction needs several trips round the barrel (WP CDC 6600, citing the 6000 Series HW Reference Manual).

**Similar:** one set of logic shared by many I/O "processors", each keeping its own state, and justified because logic is much faster than memory. The Alto has the same 5:1 logic-to-memory ratio: memory access is 850 ns, or 5 microcycles (CSL79 §2).

**Different:**
- The barrel is **strict round-robin**: each PPU gets 100 ns in every 1,000 ns whether it needs it or not. The Alto is **demand-driven by priority**, and a task can hold the processor for many consecutive cycles.
- The 6600's **central CPU is not in the barrel**. On the Alto, the user's program *is* one of the multiplexed tasks.
- PPUs are full 12-bit computers running machine code (and much of the OS), with **private** memories.

### 2.3 Honeywell 800 (announced 1958, first installed 1960)

- **Eight "virtual processors"** in hardware, each with its own set of 32 registers, including two sequence counters (SMOT H800; WP Honeywell 800).
- On each memory cycle the hardware first scans the I/O controllers by priority (up to 8 input and 8 output), then the CPU. The first requester gets the cycle.
- Within the CPU, cycles go **round-robin** among active programs, and an instruction, typically 4 memory cycles, runs to completion (SMOT H800, "Supervision").

**Similar:** hardware-held per-program state and instruction-by-instruction interleaving (SMOT MT calls it "hardware multiprogramming", a form of fine-grained multithreading).

**Different, and in fact the reverse of the Alto:**
- On the H800 the *I/O controllers* are separate hardware that steal memory cycles (DMA-like), and the *user programs* share the processor round-robin.
- On the Alto the *I/O controllers' logic* shares the processor, and there is only one user program (task 0).

### 2.4 Modern SMT / Hyper-Threading and GPU warp schedulers

**Hyper-Threading (Intel, 2002)** is SMT:
- two logical processors per core, each with its own architectural state, sharing the execution units (WP Hyper-threading);
- SMT means issuing instructions **from more than one thread in the same cycle** on a superscalar core (WP SMT, Temporal multithreading);
- Intel claimed about 5% extra die area (WP Hyper-threading, citing Intel Technology Journal 2002).

The Alto issues **one microinstruction per cycle from one task**, so it is **fine-grained temporal (interleaved) multithreading with priority, not SMT**.

The ACM Turing laureate page reportedly says the Alto "may have been the first simultaneously-multithreaded (SMT) computer" (amturing.acm.org †, snippet only). That is technically wrong on "simultaneous". "First" is also doubtful given the TX-2 (1957), H800 (1958) and CDC 6600 PPUs (1964) (SMOT MT). Smotherman's timeline lists the Alto (1979) under "microtasking" (SMOT MT).

**GPU warp scheduling is the closest modern cousin.** NVIDIA's guide:
- each warp's context "is maintained on-chip during the entire lifetime of the warp";
- "switching from one execution context to another has no cost";
- "at every instruction issue time, a warp scheduler selects a warp" that is ready (CUDA §4.2).

**Similar:** per-thread PCs held on chip, a zero-cost switch at every issue slot, and the goal of hiding memory latency. The Alto overlapped almost all device-loop computation with memory (CSL79 §4).

**Different:**
- A GPU picks among many *equivalent* warps for throughput, and typically also issues from more than one warp per cycle (multiple schedulers per SM).
- The Alto picks by *fixed priority* to meet *real-time device deadlines*, and a task gives up the processor voluntarily.

**Another modern echo: "software peripherals" on hardware threads.** XMOS XCore chips (2007, eight hardware threads per core) and the Ubicom IP3023 (2004) implement Ethernet, USB and similar interfaces as deterministic hardware threads on a barrel-style core (WP Barrel processor). This is the Alto's "controllers in microcode" idea in a microcontroller. Treat it as an analogy only: there is no historical link.

### 2.5 Machines where the CPU itself drives the video or disk

**Apple II Disk II (1978).**
- Wozniak's controller used about a tenth of the chips of existing controllers (WP Disk II, citing BYTE Jan 1985).
- The 6502 does the GCR "nibble" encoding and decoding in software. "5-and-3", then "6-and-2", was chosen so that a byte could be decoded fast enough (WP GCR).
- The read loop must "read a byte, transform it, and store it — all in under 32 cycles … or the information will be lost" (BAD ch. 3). This is exactly the Alto disk's one-word, ~10 µs deadline (CSL79 §2.2).

Different:
- The Disk II has **no multitasking**. The 6502 is monopolized for the whole transfer, typically with interrupts off.
- The Alto's disk task grabs a few microcycles per word and hands the rest back, so the emulator keeps running between disk words.

**Atari 2600 "racing the beam" (1977).**
- There is no frame buffer. The CPU must load the TIA's registers for each line, and there are "only 76 machine cycles per line (228/3 = 76)" (STELLA79, "Television protocol"; §3.2).
- WSYNC halts the CPU until the next line starts (§3.2).
- Game logic mostly runs in the roughly 70 non-picture lines, "5,320 machine cycles" (STELLA79).

Compare the Alto:
- An Alto scanline is 224 microcycles *(computed: 38.08 µs / 170 ns; see the display notes)*.
- Here the scheduling is done by hardware priority every microcycle, not hand-counted by the programmer, and the Alto *does* have a frame buffer in main memory.

**Sinclair ZX80 / ZX81 (1980–81).**
- The ZX80 makes a picture only when idle, so the screen blanks while a program runs (WP ZX80).
- The ZX81 added SLOW mode ("compute and display"): the program runs "only about a quarter of the time". FAST mode abandons the display (WP ZX81, citing Thomasson 1983).

Similar to the Alto:
- Alto programs also run much faster with the display off or with fewer display bands (TH86 p. 93: ×3; CSL79 §3.1).
- A ZX81 program's ~25% share is in the same range as an Alto program's leftovers under a full-screen display.

Different: the ZX81 switches between display and program coarsely, per line or block, via interrupts. The Alto interleaves per microinstruction.

### 2.6 One-line verdicts for the script

- **TX-2:** "Same idea, fifteen years earlier, one level up: at machine instructions instead of microinstructions."
- **CDC 6600:** "A barrel that turns on a fixed schedule; the Alto's tasks only run when they're called for."
- **Honeywell 800:** "Hardware juggled eight user programs; the Alto juggled one user program and five controllers."
- **GPUs:** "A modern GPU still switches for free on every instruction, for the same reason: memory is slow."
- **Apple II / Atari / ZX81:** "Home computers also made the CPU do the controller's job, but they had to stop everything else to do it."

---

## 3. Multiple instruction sets (writable microcode)

### 3.1 The standard "BCPL" emulator (Nova-like, in ROM)

- The papers call it "the BCPL instruction set". It was chosen because it was straightforward to implement and because "we had previously developed a BCPL compiler for a similar instruction set" (CSL79 §2.1).
- Thacker says it was patterned on the Data General Nova, which PARC used heavily. A PARC bakeoff found the Nova better than the PDP-11 for compiled high-level languages: faster, and simpler for compilers (OH07 p. 13).
- **Not Nova-compatible** (HW76 §3.1; TH86 p. 93):
  - 16-bit rather than 15-bit addresses, so only one level of indirection;
  - no auto-index locations;
  - a completely different interrupt system;
  - the Nova I/O opcodes were reassigned to Alto-specific instructions.
- It lives in ROM0 and is task 0 (`NOVEM`), plus a small amount of decoding hardware (IR, accumulator addressing), fewer than ten chips (CSL79 §2.4; UCODE).
- Lampson's 1972 memo already planned a processor running "Nova instructions at about 1.5 us/instruction". It would be extensible with instructions for Lisp, BCPL and MPS (MPS was the Modular Programming System, whose MPL language became Mesa) (WHY72 §2).

### 3.2 The bytecode convention

- In the summer before the Alto (1972), Lampson, Deutsch and Kay "worked out a general scheme for emulated HLL machine languages". Lampson "did not want to have to decode bytes" field by field, so different meanings would be mapped onto the 256 values of a byte: a "poor man's Huffman code". "All subsequent emulators at PARC used this general scheme" (KAY93).
- On the Alto, the standard dispatch does "an initial 256-way dispatch" to each bytecode's microcode (CSL79 §2.4). One 8-bit dispatch replaces the "several dispatches" a Nova-style instruction needs, and this "more than offsets the lack of specialized decoding hardware" (TH86 p. 93).
- Result: the Mesa emulator "interprets instructions just as fast as the emulator for BCPL", even though only BCPL has decoding hardware (CSL79 §8).

### 3.3 Mesa

- **Lineage of the microcode (MESAROM header):**
  - "Developed from Lampson's MESA.U of 21 March 1975";
  - "First version assembled 5 June 1975";
  - "Modified by Johnsson; July 25, 1977";
  - "Completely rewritten by Roy Levin, Sept-Oct. 1977";
  - version 39 corresponds to Mesa 5.0.
- The language itself: Mitchell, Geschke and Satterthwaite, begun in 1971. It was ported to the Alto in 1975 with Rich Johnsson and John Wick, and adopted by SDD in 1976. Programs were compiled into bytecodes of 1–3 bytes (LAM86 §2.2.2).
- **The Mesa emulator often lived in ROM, not RAM.** MESAROM notes: "in most cases, an Alto running Mesa will have the Mesa emulator in ROM1". ROM1 is the second 1K ROM bank of "2K ROM" Altos (HW79 §8.1, §8.4).
- Mesa's 8-word operand stack is implemented by dispatching on the stack pointer into tables of eight microinstructions, each touching a particular R-register (CSL79 §2.4).
- **Speed:** as fast as the BCPL emulator (CSL79 §8). Compiled Mesa was about half the size of comparable C code for the VAX (LAM86 §2.2.2).
- After 1977, most Alto software was written in Mesa in CSL or Smalltalk in LRG (TH86 p. 93).

### 3.4 Smalltalk

- **Before Smalltalk-76**, Alto microcode was the "magic wand" (ING20 §4.6, pp. 28–29):
  - a block-move loop that took at least 7 memory cycles per word in Nova code took 2 in microcode;
  - up to 5 simple microinstructions fit in one memory cycle;
  - Ingalls wrote the OOZE object-table kernel and BitBlt in microcode;
  - Steve Purcell wrote the KAOS animation microcode, and Bob Shur the TWANG music microcode (ING20 §2.11, p. 18).
- **BitBlt was about 300 microinstructions**, and "The guts of the first Smalltalk virtual machine emulator were about the same size" (ING20 App. F, p. 99).
- **Smalltalk-76 (Ingalls, begun August 1976).**
  - The bytecodes were designed "amenable to efficient execution in microcode" (ING20 §5).
  - Ingalls: "Finally I wrote Novacode and microcode for the VM" (ING20 App. B.3, p. 89).
  - The microcode file is `BYTERP.MU`, headed "NOVACALL VERSION I", dated 13 Dec 1977 (BYTERP). Its register comments warn about "THE NOVACODE", because the VM was part microcode and part Nova code.
  - Kay: not all of the interpreter fit the Alto's microcode memory, "some of it had to be rendered in emulated 'NOVA' code which forced two layers of interpretation" (KAY93, NoteTaker section).
- **Speedup:** Smalltalk-76 "was more than 10 times faster" than Smalltalk-74. Footnote 17: about 28× on simple operations and about 2.5× on full message sends (ING20 §5, p. 43, fn. 17).
  - Table 3 (modern back-ported benchmarks, approximate): Smalltalk-74 on the Alto, 607 simple ops/s and 46 sends/s; Smalltalk-76 on the Alto, 16.13k ops/s and 118 sends/s (ING20 App. E.2, Table 3).
- **Later user-level microcode.** Sidney Marshall's 1980 memo added "microcoded primitives" for floating point. Smalltalk methods could jump into another RAM bank via SWMODE (MARSH80). So in 1980 a Smalltalk *user* could write and load microcode.

### 3.5 Lisp

- Peter Deutsch and Willie-Sue Haugeland (LAM86 §2.2.4). The project began in fall 1972.
- The instruction-set design was done in spring 1973 and presented at 3IJCAI in August 1973. The "last stage of microcode implementation" was completed in early 1975 (LPD75).
- Lisp compiled to the new instruction set and run by the microcoded emulator ran "at speeds comparable to BCPL code" (LPD75).
- Overall the system was "5 to 7 times slower than a completely unloaded Maxc" (LPD75, May 1975).
- Verdict: the microcode worked, but the 64K memory was "a crippling performance limitation" (CSL79 §7.1). The system was unsuccessful "primarily due to the lack of sufficient memory" (TH86 p. 93). It thrived later as Interlisp-D on the Dorado (LAM86 §2.2.4).

### 3.6 How emulators were switched

The mechanism, from HW79 §8 and CSL79 §2.1:
- **ROM0** always holds the standard Nova/BCPL emulator and the I/O microcode (HW79 §8.4).
- **Loading.** An ordinary Nova-code program writes microcode into the control RAM with the emulator instructions **WRTRAM** (octal 61012) and **RDRAM** (61011) (HW79 §8.5). Emulators "were usually loaded at bootstrap time or as part of starting a program that used a particular language" (TH86 p. 97).
- **Entering.** **JMPRAM** (61010) jumps to a microaddress in another bank. It is built on **SWMODE**, a bank-switch function "available only to the emulator task" (HW79 §8.4–8.5). The manual warns JMPRAM "is fraught with peril" (HW79 §8.5).
- **Traps.** Unimplemented opcodes trap to `RAMTRAP: SWMODE, :TRAP`, so a RAM-resident emulator can pick them up (HW79 §8.6; UCODE).
- **Ping-pong between emulators.** The Mesa microcode has a normal entry `Mgo`, invoked from Nova code via JMPRAM. It can drop back into Nova code and then return to `next` "after Nova or RAM execution" (MESAROM). The two emulators cooperate rather than one replacing the other.
- **Isolation.**
  - Only one extra emulator fitted in the standard 1K RAM (LAM86 §2.2).
  - Environments (BCPL, Mesa, Smalltalk, Lisp) shared only disk files and network protocols, and talked only through world-swap or the file system (CSL79 §7.1; LAM86 §2, §2.2). Each could "stretch the resources of the machine in a different way" (LAM86 §2.2).
- **Hardware assist by microcode.** A hardware multiplier was attached as a processor-bus device and driven by an S-group instruction added in writeable microstore (CSL79 §2.2).

---

## 4. Lineage: what happened to the idea

| Machine (first ran) | Technology | Microcycle | Tasks and scheduling | Who fetches display pixels | Notes |
|---|---|---|---|---|---|
| **Alto I** (Apr 1973) | 74S Schottky TTL, 4 × 74S181 | 170 ns | 16 fixed-priority tasks; cooperative (TASK) | Microcode (display word task) | CSL79 §2, §2.3 |
| **Alto II** (redesigned 1975; XM and 3K RAM 1979) | Same processor; 4K then 16K NMOS memory with ECC | 170 ns | Same | Same | TH86 p. 97; HW79 App. F |
| **Dolphin / D0** (1978) | Schottky TTL | 180–220 ns per microinstruction (DLION79 p. 6); a new microinstruction every two clocks (D0HW79 §1.0) | 16 fixed-priority; Mesa emulator in task 0, timers task 14, error task 15, 13 I/O tasks; switch when the running task executes RETURN (D0HW79 §2.2) | Microcode, which the Dandelion memo contrasts with its own display hardware (DLION79 p. 3) | About 50 built for PARC; "only about twice as fast" as the Alto; sold as the 1100 Lisp machine and inside the 5700 printer (TH86 p. 98) |
| **Dorado** (Model 0 1978, Model 1 spring 1979) | ECL (MECL 10K), about 3,000 MSI parts, processor about 35% (LP80 abstract) | Designed for 50 ns; stitchweld prototypes 55 ns; production multiwire ≥60 ns; booted at 64 ns (DORHW81 p. 144) | 16 tasks, **preemptive**: a higher task takes over "without the knowledge or consent" of the running one; two-stage arbitration pipeline; task-specific registers (LP80 §5.1–5.4) | A "fast I/O" path: two microinstructions move a 16-word block (LP80 §7) | 2,500 W, refrigerator-sized, 2,000 cfm of air; about 30 built by 1982; about three VAX-11/780s (TH86 pp. 97–98) |
| **Dandelion** (1980; Star 8010, Apr 1981) | AMD 2901 bit-slices; 4K × 48-bit WCS | 137 ns | **Fixed time slots.** Click = 3 microinstructions (411 ns); round = 5 clicks (2 µs); up to 8 tasks; the emulator takes any click a device doesn't use (DLIONHW §1.0, §2.5.6) | **Hardware.** The display controller reads a separate display bank; display microcode handles only line events and refresh (DLION79 p. 3; DLIONHW pp. 2, 36) | 8085 IOP for floppy, keyboard, mouse and boot (DLIONHW p. 4) |
| **Dicentra** (1982) | A Dandelion variant with Multibus I/O | — | As the Dandelion *(inferred from "variant")* | — | Boggs and Hal Murray; used as a server; Mesa only (TH86 p. 98; LAM86) |
| **Daybreak / 6085** (1985) | 2901C "Mesa processor"; 4K × 48 WCS (expandable to 8K) | — | The Mesa processor has **no direct data path to I/O**; an **Intel 80186 IOP "handles all I/O and boot-up operations"**; the Mesa processor comes last in memory priority, after refresh, display and IOP (DAYB86 §1.1, glossary) | Gate-array display controller | Launched 1985 at about $4,995 (WP Xerox Daybreak) |

### 4.1 Detail on the successors

**The Dorado kept the concept but made it preemptive.**
- The reason: with a cache, microcode suffers unpredictable delays, and a polling scheme would leave the processor idle. So "the Dorado does task switching on demand", "much like a conventional interrupt system", and the hardware absorbs the polling overhead (LP80 §5.2).
- High-priority tasks were "very carefully designed and coded to execute only two microinstructions per wakeup" (PIER83 §5.1, p. 22).
- Task switches happened "every ten or twenty microcycles when a high-speed device is running" (PIER83 §4.1).
- The disk at 10 Mbit/s uses 5% of the processor, and the display's fast-I/O path uses a quarter of the microcycles at full I/O bandwidth (LP80 §7).
- Task table: 0 emulator, 1 fault restart, 2 "junk" task every 32 µs, 3 display horizontal, 6–7 Ethernet out/in, 13 (octal) display word, 14 (octal) disk, 17 (octal) fault. The disk is again just above the display word task (DORHW81 Table 22, PDF p. 93).
- Lessons (PIER83 §5.1, pp. 21–23):
  - fixed priority "has worked thus far";
  - language emulation would have gained more from hardware for context switching and cached call stacks, citing the IBM 801 and RISC;
  - Pier notes the Dorado lacked the Alto's constant ROM of "two hundred or so" commonly used constants.

**The Dandelion (Star) replaced priority with a timetable.**
- Standard round: click 0 Ethernet, 1 disk (SA1000/SA4000), 2 IOP, 3 Ethernet, 4 display/LSEP/tape or refresh (DLIONHW p. 36).
- Task numbers: 0 emulator, 1 display (or LSEP or tape), 2 Ethernet, 3 refresh, 4 disk, 5 IOP, 6 IOP control-store address, 7 kernel (DLIONHW p. 35).
- Because each device's latency is guaranteed by its slot, "The controllers can be made very small" (DLIONHW p. 1). That is the Alto's argument, achieved by a different route.
- The CP clock is the display's 19.59 ns bit period × 7 = 137.14 ns, with exactly 14 rounds per scan line (DLIONHW p. 2). The Alto's clock is also locked to the display: 224 cycles per line *(computed; see display notes)*.
- Emulator share: the display microcode uses only 1.1 Mbit/s, leaving 86% for the emulator. "Even with the Ethernet, SA1000, and IOP concurrently transferring data and the Display microcode refreshing memory, the Emulator still executes 60% of the time" (DLIONHW p. 36).
- Belleville's 1979 memo: the display controller maintains the display "with minimum impact" on the processor, "(unlike D0 or Alto)". Fast Mesa bytecodes execute in one click, 412 ns (DLION79 pp. 3, 6).
- Thacker (1986): the Dandelion's "fixed time-slice form of multitasking" was "quite different" from the Alto's. It was the first descendant that could not run Alto software (TH86 p. 98). Thacker (2007): "Butler designed it … a somewhat different form of tasking" (OH07 p. 19).
- The authorship conflict is small: TH86 says it was implemented by Belleville, Garner and Crane from the "Wildflower" paper design by Lampson and Roy Levin. That is consistent.

**The arc for the script:**
1. Alto and Dolphin: cooperative priority tasks.
2. Dorado: preemptive priority tasks, and the display gets its own fast path.
3. Dandelion: fixed time slots, display hardware and a microprocessor for slow I/O.
4. Daybreak: a microprocessor handles all I/O and the main processor just emulates.

The controllers came back as chips got cheap, just as Thacker allowed in 1979 (CSL79 §8).

---

## 5. The physical build

### 5.1 Alto I card cage (the 1973–74 PC-board machine)

The hand-drawn "P.C. Alto Card Arrangement" (CARDS, p. 1) shows **28 slots**:

| Slot | Card |
|---|---|
| 1, 2 | Optional processor-bus devices |
| 3 | Optional Ethernet |
| 4 | Disk control |
| 5 | Display control |
| 6 | Optional RAM control store |
| 7 | Control card |
| 8 | Arithmetic card |
| 9 | Memory interface |
| 10, 12 | Optional memory-bus devices (slot 11 also optional) |
| 13–28 | Sixteen "bit memory" cards; a 48K configuration fills fewer slots than 64K |

- Sixteen memory boards matches Shirriff's statement that the Alto I needed 16 boards of 1103s for 128 KB (SH16a).
- The drawing is dated "**1-31-72**" in handwriting. Since the project began in November 1972 (KAY93; TH86 p. 91), this is almost certainly January 1973, a classic new-year slip *(inference; uncertain)*.
- TH86 says the two April 1973 prototypes were **wire-wrap** and used MAXC memory boards; PC boards came after summer 1973 (TH86 pp. 91, 95). So this chart describes the PC version.

### 5.2 Alto II card cage (INTRO79 p. 8, "Module Location Chart")

**21 slots:**

| Slot | Card |
|---|---|
| 1–4 | Memory storage |
| 5–6 | Empty |
| 7 | Terminator (MEAT in XM machines) |
| 8 | Memory Data Interface (DIM) |
| 9 | Memory Address Interface (AIM) |
| 10 | Control RAM (CRAM or 3KCRAM) |
| 11 | 2K (or 3K) Control |
| 12 | ALU |
| 13 | Display Control |
| 14 | Ethernet |
| 15–20 | Options (handwritten on one chart: Trident in 15; Orbit CTL, INP, MEM and OUT in 17–20) |
| 21 | Disk Control |

- The standard machine therefore has **13 boards**, which matches Shirriff (SH16a).
- The **CPU is three boards: Control, ALU and CRAM** (SH16a; SH16d). Memory is 4 storage boards plus 3 memory-control boards (MEAT, AIM, DIM) (SH16c).
- Boards are about 7-5/16″ × 10″, holding "roughly 100 chips (depending on the board)" (SH16a). The backplane is wire-wrapped (SH16b).

### 5.3 Chip counts (the primary sources conflict)

| Source | Processor | Each I/O controller | Memory |
|---|---|---|---|
| CSL79 §2 (1979) | 5 boards × about 70 SSI/MSI TTL ICs (about 350) | 1 board, about 60 ICs | 312 chips |
| TH86 p. 92 (1986) | 3 boards, about 200 ICs | 1 board, about 60 ICs | — |
| KAY93 | "160 MSI chips distributed on two cards", for the whole machine except memory | — | — |

**Likely reconciliation** *(my inference, not stated anywhere)*: the 1979 paper's "five boards" are the 3 CPU boards plus the 2 memory-interface boards (AIM and DIM), and TH86 counts the CPU proper. Kay's figure isn't supported by either designer document.

### 5.4 Logic families and memories

From CSL79 Fig. 2 and §2.4 unless noted:
- **ALU:** four **SN74S181**. They "can provide 64 arithmetic and logical functions, most of which are useless". The 14 useful ones are selected by the 4-bit ALUF field through a PROM.
- **Other logic:** small- and medium-scale 74S Schottky TTL.
- **Control store:** 1K of PROM built from 256×4 Schottky bipolar PROMs (1973); 1K×4 PROMs by 1976. RAM: 1K×1 Schottky bipolar (1974), then 4K×1 static NMOS (1979).
- **Registers:** 32 R registers in 16×4 Schottky bipolar RAM, built from Intel 3101 64-bit chips (SH16a). S registers: 1 bank in 1974, 8 banks with the 3K RAM.
- **Constants:** a 256 × 16 constant PROM; "Approximately 200 of the 256 available constants have been used".
- **MPC RAM:** 16 × 12 bits (HW79 §2.4).
- **Main memory:** 1973, 64K words of 1K×1 dynamic PMOS (the Intel 1103) with parity; 1975, 4K×1 NMOS with error correction; 1977, 16K×1 NMOS, up to 256K words.

### 5.5 Power, cooling and cabinet

- **Four switching supplies:** PS-1 +12 V, PS-2 +15 V, PS-3 −15 V, PS-4 +5 V (INTRO79 p. 11). The maintenance outline also lists a −5 V output to check (INTRO79 p. 13).
- Shirriff describes the supplies as +15, −15, +12 and ±5 V, "complex but highly efficient". Their control circuits are built from discrete components, three plug-in boards per supply (SH16a; SH16b).
- **What uses which voltage:** logic uses +5 V; the MOS memory needs +5, −5 and +12 V; the Ethernet card ±15 V, with +15 V powering the transceiver; the disk ±15 V (SH16c).
- **Cooling:** four fans (INTRO79 p. 13).
- **Cabinet:**
  - "a small cabinet which is an unobtrusive addition to a normal office" (CSL79 §1);
  - "under-table-size" (INTRO79 p. 4);
  - about dorm mini-fridge size (SH16b);
  - Lampson's 1972 memo planned "a table about 45″ wide and 25″ deep" to house it (WHY72 §2);
  - the Alto II cabinet differed slightly from the Alto I's (TH86 p. 90, Fig. 1 caption).

### 5.6 Compared with a Data General Nova

- **Nova chassis:** 5¼″ high with seven slots. On the original Nova two slots hold the CPU; on the **Nova 1200** the CPU needs **one** slot (DG74 ch. 1, pp. 13–14).
- **Nova boards** are 15″ × 15″ (WP Data General Nova, citing Hendrie 2002).
- **Nova 1200 ALU:** a **single 74181**, working 4 bits at a time. The Nova 800 used four ALU chips (WP Data General Nova).
- **Board-area comparison** *(computed)*: the Alto's three CPU boards are about 3 × 73 in² ≈ 220 in². That is about the area of one 15″ × 15″ Nova 1200 CPU board (225 in²), but the Alto's holds **four** 74S181s and a microsequencer with 16 program counters. Treat this as a rough visual comparison, not a like-for-like chip count.

### 5.7 Alto I vs Alto II, as it affects the processor

**Main differences listed by the 1979 manual** (HW79 App. F, §2.3):
- memory-reference timing: the Alto II stores in cycles 3–4 and allows a double-word store; the Alto I stores in cycle 5;
- the Alto II checks parity on stores as well as fetches;
- some emulator instructions differ (RCLK, SIO, SIT, VERS, DREAD, DEXCH, DIAGNOSE);
- the keyboard;
- the external device connector;
- the memory configuration switch;
- parity reporting;
- the 2K ROM and 3K RAM options;
- extended memory (standard from the 7th Alto II build).

**Telling the machines apart:**
- VERS returns engineering number 0 on an Alto I and 2 on an Alto II (HW79 App. G). XM machines are engineering number 3 (HW79 §2.3).
- Microcode can test location 613 octal: 0 means Alto I, −1 means Alto II (HW79 App. B).
- The microcode families differ: `AltoCode23/24` for the Alto I and `AltoIICode2/3` for the Alto II (HW79 §9.1; App. G).

**History:**
- The redesign was done in 1975 by Xerox's Special Programs Group in Los Angeles, planned by John Ellenby (TH86 p. 97; HW79 §1.2). It brought 4K RAMs with error correction and cut the cost from about $18K to about $12K (TH86 p. 97).
- **1979 final redesign:** 16K chips, up to 512 KB, and a microstore of 1K PROM + 3K RAM, replacing 2K PROM + 1K RAM (TH86 p. 97).

### 5.8 Production numbers (a conflict with the report)

**Thacker's figures (TH86 pp. 95, 97):**
- 2 wire-wrap prototypes by April 1973;
- 9 more prototypes built at PARC during 1973;
- 60 original Altos built by the Los Angeles group over two years, delivered from May 1974;
- then "approximately fifteen hundred Altos" over four years after the 1975 redesign, "approximately a thousand" still in use in 1986.

**Other figures:**
- CSL79 §1: "nearly a thousand Altos in regular use" in summer 1979.
- OH07 p. 15: "finished all six machines by the middle of '73" (a conflicting memory).
- The report's "about 2,000" comes from Kay and Hiltzik. The designer's own count implies about 1,500–1,600.

---

## 6. Performance comparisons

**Emulated Nova vs a real Nova.**

| Instruction | Alto emulator, display off | Nova 1200 | Nova 800 | Original Nova |
|---|---|---|---|---|
| ADD | 8 microinstructions = **1.36 µs** (CORE §3.3) | **1.35 µs** | 0.8 µs | 5.9 µs |
| LDA | 15 microinstructions = **2.55 µs** (CORE §3.5) | **2.55 µs** | 1.6 µs | 5.2 µs |

(Nova times: DG74 App. D p. D12, "Instruction Execution Times".)

- **So with the display off, the Alto's emulated Nova ran at almost exactly the speed of a real Nova 1200** *(computed comparison)*.
- Thacker gives 1–3 µs per emulated instruction without I/O, and **×3 with the display on** (TH86 pp. 92–93). With a full display, then, the Alto was slower than a Nova 1200 and in the range of the original 1969 Nova.
- In the ADD path, the ADD microinstruction itself (`G16: L_ ACDEST+T, TASK, :SHIFT`) carries a TASK. The user program offers the processor away inside the instruction (UCODE).

**Headline rates.**
- Lampson 2006: "0.3 MIPS" for the Alto (LAM06 slide 10).
- Kay: microcode ran at "about 6 MIPS" (KAY93).
- So roughly **20 microinstructions of machine for every user instruction delivered** *(computed; the ratio mixes the display tax with emulation overhead)*.
- Ingalls, the software view: the Nova emulator was "effectively a 0.5 MHz machine" without display competition, "more like 0.3MHz when running Smalltalk". He says the display took roughly 50% of memory bandwidth (ING20 §2.10, p. 17). *Caveat:* in the same paper Ingalls gives 200 ns and 1 µs as the microcycle and memory cycle; the documented figures are 170 ns and 850 ns (CSL79 §2).

**How much "the computer" (task 0) actually got.**
- Full-screen display: about 60% of cycles go to the display (CSL79 §3.1), so the emulator gets under 40% while other devices are idle.
- A typical text page uses bands and zero-width blocks, which cuts the cost substantially (CSL79 §3.1). Bravo's display went from 61 KB to about 50 KB (TH86 p. 94).
- **Ethernet:** 16% of the machine during data transfer; up to 20% for address filtering in the improbable case of back-to-back minimum-length packets (CSL79 §5).
- **Disk:** a one-word buffer, one wakeup per word (CSL79 §2.2). No overall percentage is given in CSL79. The Alto disk transfers about 1 Mbit/s (LAM86).
- **For contrast:** the Dandelion's emulator still gets ≥60% with Ethernet, disk and IOP all running (DLIONHW p. 36), because its display pixels no longer go through the processor.

**Against bigger machines.**
- Lampson in 1972 expected the Alto to beat a time-shared PDP-10 for most interactive work (WHY72 §2).
- Alto Lisp in 1975 was 5–7× slower than an unloaded MAXC (the PARC PDP-10 clone) (LPD75).
- The Dolphin was 2×, the Dandelion 3× and the Dorado 10× an Alto (LAM86 §1.4).
- **I found no primary Alto-vs-PDP-11 benchmark.** Thacker's PDP-11 remark is qualitative (OH07 p. 13).

---

## Corrections to `reports/Xerox Alto explainer research.md` (and `video-concepts.md`) on this topic

1. **"Switches … on every microinstruction, at no cost"** (video-concepts, treatment A and the "trick" section; the report says it more carefully). Switching is **cooperative**:
   - a task keeps the processor until it executes TASK, and the switch takes effect one instruction later;
   - the next instruction may not branch, and state in L or T must not be live across a switch (CSL79 §2.3; TH86 p. 92);
   - better wording: "can switch after any microinstruction, with no state to save".
   - Preemptive task switching arrived with the **Dorado** (LP80 §5.2).
2. **"The Alto had no display controller, no disk controller and no network controller"** (video-concepts). Overstated. Each device has a controller board of about 60 ICs, with buffers, electrical interface and wakeup logic (CSL79 §2; TH86 p. 92). What it lacked was **DMA** and controller *sequencing logic* (CSL79 §2.3). Say "tiny controllers, no DMA".
3. **The origin of the task idea** (report, "The build, the memo and first light"). Kay's version is reported correctly, but it needs Thacker's own accounts:
   - TH86 p. 91: "used before on the Lincoln Laboratory TX-2", citing Forgie 1957;
   - OH07 p. 14: "invented once before but we didn't know it", learned afterwards from Wes Clark.
   - Don't claim Thacker borrowed it from the TX-2.
4. **Kay's "160 MSI chips on two cards"** (report, build section and conflicts table). Both designer documents disagree: 5 boards × ~70 ICs (CSL79 §2) or 3 boards / ~200 ICs (TH86 p. 92), plus about 60 ICs per controller. The Alto II slot chart shows a three-board CPU (INTRO79 p. 8). Treat Kay's figure as wrong rather than as "perhaps the Alto I processor alone".
5. **Alto II date.** The report says "around 1976; inferred". Thacker says the redesign was done **during 1975**, cost fell from about **$18K to $12K**, and 4K RAM with ECC came in then. The 16K/512 KB XM and 1K PROM + 3K RAM came in the **1979** redesign (TH86 p. 97).
6. **"Later machines added writable RAM."** Nuance: **1K of RAM was added to the Alto I in summer 1973 / 1974**, before the PC-board version (TH86 p. 95; CSL79 Fig. 2), and became standard on all Altos (HW79 §8.1). Only the 2K ROM (1976) and 3K RAM (1979) options came later.
7. **"Mesa, Smalltalk and Lisp each loaded their own instruction set into the RAM."**
   - On most Mesa Altos the Mesa emulator was in **ROM1**, the second PROM bank (MESAROM header).
   - Smalltalk-76's VM was part microcode and part emulated Nova code (KAY93; BYTERP).
   - The Nova emulator stayed in ROM0 throughout, and emulators called back and forth (MESAROM).
8. **"1,024 microinstructions held in eight 1K×4 PROM chips"** (Shirriff †). True for the later 1K×4-PROM machines. The 1973 original used **256×4** PROMs (CSL79 Fig. 2), which *(computed)* means 32 chips for 1K × 32 bits.
9. **Factor-of-three slowdown.** The report cites Hiltzik. The primary source is **Thacker himself** (TH86 pp. 92–93: 1–3 µs per instruction, ×3 with the display). Use it.
10. **Production numbers.** The designer's count is about 60 Alto Is plus about 1,500 Alto IIs by roughly 1979–80, about 1,000 still in use in 1986 (TH86 p. 97), against the report's "about 2,000". The snippet-level "initial run of 80 by Clement Designlabs" conflicts with TH86's "sixty of the original systems" built by Xerox's Los Angeles group. Present the total as "about 1,500–2,000".
11. **Power supplies** (Shirriff †, the only source in the report). Now confirmed from Xerox's own wiring diagram: +12, +15, −15 and +5 V switching supplies, with −5 V also checked in maintenance (INTRO79 pp. 11, 13).
12. **"Successors Dolphin (~2×), Dorado (~10×), Dandelion (~3×)".** Confirmed (LAM86 §1.4). Add that the Dolphin was Schottky TTL, the Dorado ECL, and the Dandelion 2901 bit-slice with *fixed time-slice* tasking (TH86 p. 98).
13. **A warning about sources not in the report.** The ACM Turing laureate essay (snippet †) says the display-line task was the highest priority and calls the Alto possibly "the first SMT computer". Both are wrong: the disk word task is highest (CSL79 §2.2; UCODE), and the Alto is interleaved, not simultaneous, multithreading with 1950s precedents (§2.4 above). Don't quote it.

---

## Nerd gems for the video

Visual system: 1-bit black and white, portrait 9:16, and three accent colours: **red** (display tasks), **yellow** (disk/Ethernet/other I/O) and **blue** (emulator or "your program"), unless a gem says otherwise.

1. **Invented twice.** MIT's TX-2 ran device "sequences" by priority in 1957. Thacker and McCreight only learned this from Wes Clark after building the Alto (FORGIE57; OH07 p. 14).
   *Animate:* two priority ladders side by side, "TX-2 1957" and "ALTO 1972", building rung by rung in sync; a thin dotted line labelled "W. Clark" connects them only at the end.

2. **The patience ranking.** The disk has a one-word buffer, about 10 µs before data is lost, so it outranks the 20 Mbit/s display (16 words, about 12.8 µs). The Ethernet, which needs more bandwidth than the disk, sits low with 87 µs of slack (CSL79 §2.2).
   *Animate:* three hourglasses of different sizes (yellow disk, red display, yellow Ethernet) draining at once; the smallest glass jumps to the front of the queue.

3. **A context switch saves one number.** Each of the 16 tasks keeps only a 12-bit micro-PC in a 16-word MPC RAM. Switching means reading a different word (CSL79 §2.3; HW79 §2.4).
   *Animate:* a column of 16 bookmark tabs; one pulls out each tick while the rest stay frozen in place.

4. **The emulated Nova was a Nova 1200, when the screen was off.** ADD: 8 microinstructions = 1.36 µs; a real Nova 1200 ADD is 1.35 µs. LDA: 2.55 µs on both. Turn the display on and it's about ×3 slower (CORE; DG74 p. D12; TH86 pp. 92–93).
   *Animate:* two stopwatches, "ALTO" and "NOVA 1200", tie at 1.36 vs 1.35; then red display bands fill the Alto's dial and its hand slows to a third.

5. **The ADD instruction offers to step aside.** Of its 8 microinstructions, the one that does the add also says TASK: "anyone more urgent may go next" (UCODE `G16`).
   *Animate:* 8 blue dots march across; dot 7 raises a tiny flag and a red dot slips into the gap before the blue ones continue.

6. **Twenty to one.** Microcode ran at about 6 million instructions a second; users got about 0.3 million (KAY93; LAM06).
   *Animate:* a funnel; 20 coloured pixels pour in (mostly red, some yellow) and one blue pixel drips out.

7. **Locks by silence.** Device microcode protects shared data simply by not executing TASK in a critical section. With one processor there is nothing else to lock out (CSL79 §2.2).
   *Animate:* a task holding a "TASK" button with a finger held just above it, not pressing; a padlock icon fades in, then away.

8. **An organ out of microcode (1973).** Kay got a pipe-organ keyboard. The microcode computed up to 10 voices every 40 µs (25 kHz) from a 256-point wavetable (TH86 p. 95).
   *Animate:* ten keys light up; a circular 256-dot wavetable spins; one blue sample dot drops out every tick.

9. **64 phone lines, no controller.** A 300-baud concentrator for 64 lines used only level converters and latches. The timed (refresh) task serialized every character (CSL79 §2.2; TH86 p. 95).
   *Animate:* 64 yellow wires fan into a single empty card slot, and the "controller" silhouette dissolves into microcode text.

10. **Eight times fewer chips.** The Dover printer controller was about 300 ICs, an eighth of the EARS character generator, because the Alto's microprocessor did the low-level control (TH86 p. 97).
    *Animate:* a tall stack of chips shrinks to one-eighth, and the missing seven-eighths reappear as scrolling microcode lines.

11. **"64 functions, most of which are useless."** The Alto used 14 of the 74181 ALU's 64 functions, chosen through a PROM (CSL79 §2.4).
    *Animate:* an 8 × 8 grid of function cells; 50 fade to black, 14 stay lit.

12. **Two emulators in ROM.** Many Altos carried the Mesa emulator in a second ROM next to the Nova emulator, and the two passed control back and forth (MESAROM; HW79 §8.4).
    *Animate:* two chips labelled NOVA and MESA pass a blue baton back and forth; the program counter trail zig-zags between them.

13. **The Star's timetable.** The Dandelion replaced priority with a clock: every 2 µs, five 411 ns "clicks" (Ethernet, disk, IOP, Ethernet, display), and the emulator takes any click a device skips. The clock is exactly 7 display pixels long (DLIONHW pp. 2, 35–36).
    *Animate:* a five-segment wheel spinning, segments coloured yellow/yellow/yellow/yellow/red, with unused segments flipping to blue.

14. **Full circle.** By 1985 the Daybreak's Mesa processor had no data path to I/O at all; an Intel 80186 handled every device (DAYB86 §1.1). Thacker had written in 1979 that cheap chips would allow a processor per controller (CSL79 §8).
    *Animate:* the single Alto processor block splits into separate little boxes (display, disk, network), each with its own tiny chip.

15. **The card cage.** The Alto I drawing shows 28 slots, 16 of them "bit memory". The Alto II has 21 slots and 13 boards, with a CPU of three cards: Control, ALU and Control-RAM (CARDS; INTRO79 p. 8).
    *Animate:* a card cage viewed edge-on in portrait; cards slide in one by one, CPU cards blue, controllers yellow and red, memory hatched.

## Best one-sentence framing

> **Because every DMA transfer left the CPU waiting for the one shared memory anyway, Thacker gave the memory to the processor and let it lend itself, a free switch at a time, to whichever device was most urgent, which turned five controllers into five little microprograms and left your program to run in the gaps.** (Built on CSL79 §2; OH07 p. 14; LP80 §4.)
