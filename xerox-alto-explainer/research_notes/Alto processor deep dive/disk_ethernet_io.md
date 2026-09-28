# Disk, Ethernet, keyboard, mouse, interrupts and boot: how much of each "controller" is microcode?

Research notes for the Alto processor explainer (90–120 s, 9:16, 1-bit + red/yellow/blue).
Scope: only the I/O "controllers" and boot. The micromachine core, display/BitBLT/memory and design rationale are covered in other notes.

All numbers are octal where suffixed ₈ or written as Xerox writes them (e.g. 521B). Microcode line numbers refer to `altoIIcode3.mu.txt` exactly as served by bitsavers (2,231 lines).

---

## 0. Sources and citation keys

| Key | Source | Notes on use |
|---|---|---|
| **HWM79** | *Alto: A Personal Computer System — Hardware Manual*, May 1979 ([part 1](http://bitsavers.trailing-edge.com/pdf/xerox/alto/AltoHWRef.part1.pdf), [part 2](http://bitsavers.trailing-edge.com/pdf/xerox/alto/AltoHWRef.part2.pdf)). Describes microcode Alto I v24 / Alto II v3. | Part 1 read via the OCR copy at ed-thelen.org (`AltoHWRefPart1-4-ocr.pdf`); part 2 has no text layer, so pages were rendered and read. Cited by section and printed page. |
| **HWM76** | *Hardware Manual*, August 1976 ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/Alto_Hardware_Manual_Aug76.pdf)), microcode v23. | Has a text layer. Cited by section and printed page. Mostly identical wording to HWM79; differences flagged. |
| **µcode** | Alto II microcode `altoIIcode3.mu` ([bitsavers txt](http://bitsavers.trailing-edge.com/pdf/xerox/alto/microcode/altoIIcode3.mu.txt)), Xerox 1979, last edits Nov 1977. | Cited as `L<line>` plus label. |
| **consts** | `altoconsts23.mu` ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/microcode/altoconsts23.mu.txt)) | Cited as `consts L<line>`. |
| **µcode-I** | Alto I microcode `altocode24.mu` ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/microcode/altocode24.mu.txt)) | Used once, for the Alto I backoff variant. |
| **Thacker79** | Thacker, McCreight, Lampson, Sproull, Boggs, "Alto: A Personal Computer", CSL-79-11 ([bwlampson.site OCR](https://bwlampson.site/25-Alto/25-AltoOCR.htm)) | Cited by section. |
| **M&B76** | Metcalfe & Boggs, "Ethernet: Distributed Packet Switching for Local Computer Networks", CACM 19(7) 1976; read from the Xerox CSL-75-7 reprint ([mirror](http://www.isa.uniovi.es/docencia/redes/EthernetPaper.pdf)) | Cited by section. |
| **BootProto** | Ed Taft & David Boggs, "Alto Boot Protocol", memo, 13 Feb 1979 ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/ethernet/AltoBootProto.pdf)) | Cited by page. |
| **DiskSch** | 216389E *Alto II Assembly, P.W. — Disk Control*, rev E ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/schematics/216389E_Alto_II_Assembly_Disk_Control.pdf)) | Sheet 4–5 = material list; sheet 7 = power-on reset; sheet 14 = data handling. |
| **EnetSch** | 216323D *Alto II Assembly, P.W. — Ethernet*, rev D, 3-3-76 ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/schematics/216323D_Assembly_Ethernet.pdf)) | Sheet 4 = material list. |
| **KbdSch** | 216414E (Microswitch keyboard assembly 217166) ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/schematics/216414E_KBD.pdf)) | Sheet 6 block diagram, sheet 10 schematic. |
| **MouseSpec** | 209920A *Spec, Procurement — Mouse* ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/schematics/209920A_Spec_Procurement_Mouse.pdf)) | Sheet 2. |
| **Intro** | Schematic-set introduction `01a_INTRO.pdf` ([bitsavers](http://bitsavers.trailing-edge.com/pdf/xerox/alto/schematics/01a_INTRO.pdf)) | "Booting information" p.7, module chart p.8. |
| **Shirriff-Enet** | Ken Shirriff, "Fixing the Ethernet board from a vintage Xerox Alto" ([righto 2017/11](https://www.righto.com/2017/11/fixing-ethernet-board-from-vintage.html)) | |
| **Shirriff-GW** | Shirriff, "Xerox Alto's 3 Mb/s Ethernet: Building a gateway" ([righto 2018/01](https://www.righto.com/2018/01/xerox-altos-3-mbs-ethernet-building.html)) | |
| **Shirriff-d6/d7/d8** | Restoration days 6, 7, 8 ([d6](https://www.righto.com/2016/09/restoring-ycombinators-xerox-alto-day-6.html), [d7](https://www.righto.com/2016/09/restoring-ycs-xerox-alto-day-7.html), [d8](https://www.righto.com/2016/09/restoring-ycs-xerox-alto-day-8-it-boots.html)) | |
| **Shirriff-boot** | "How our boot disk got overwritten" ([righto 2016/09](https://www.righto.com/2016/09/restoring-ycs-xerox-alto-how-our-boot.html)) | |
| **Shirriff-seek** | "A 1970s disk drive that wouldn't seek" ([righto 2018/03](https://www.righto.com/2018/03/a-1970s-disk-drive-that-wouldnt-seek.html)) | |
| **ContrAlto** | Living Computers ContrAlto source ([GitHub](https://github.com/livingcomputermuseum/ContrAlto)): `IO/DiskController.cs`, `IO/DiabloDrive.cs`, `IO/MouseAndKeyset.cs`, `IO/Keyboard.cs` | Emulator, secondary to Xerox docs. |
| **gunkies** | [RK11 disk controller](https://gunkies.org/wiki/RK11_disk_controller), [DL11](https://gunkies.org/wiki/DL11_asynchronous_serial_line_interface) | For the "conventional minicomputer" contrast only. |

Local copies of everything are in the shared scratchpad `alto-sources/` folder.

---

## 1. The principle, in the designers' words

- Design goal 2 of the microprocessor: "minimize the amount of hardware in the I/O controllers", done "by doing most of the processing associated with I/O transfers with microprograms" (HWM79 §2.0; same text HWM76 §2.0).
- Disk: "The hardware is modest because it takes advantage of the computational power available in the micromachine. The hardware does only what the micromachine cannot do" — cable drive/receive, buffering, (de)serialisation, encoding, sync detection, micromachine communication (Thacker79 §4.2; quote trimmed).
- The processor, not the devices, makes every memory reference: "the processor is multiplexed, and multiplexing of the memory is a natural consequence" (Thacker79 §2, paraphrase of the OCR text). Processor-bus devices' tasks "initiate all memory references for the device controller" (Thacker79 §2.2).
- Shirriff's one-line version: the sector and word tasks do what "most computers do ... with DMA hardware" (Shirriff-d6).
- Critical sections between device code and programs need no locks: shared structures "can be interlocked by simply not allowing task switches" in the device microcode (Thacker79 §2.2). Example: the Ethernet post writes EPLOC and reads EBLOC in one double-word memory reference (µcode L259–272, `EPOST`).

**Buffer depth sets priority** (Thacker79 §2.2): the disk has **one word** of buffering (10 µs at 1.5 Mbit/s), so it is the highest-priority task; the display has 16 words at 20 Mbit/s (12.8 µs); the Ethernet has 16 words at 3 Mbit/s (**87 µs**), so it runs at low priority. The manual gives the Ethernet task's worst-case wakeup latency as "on the order of 20 microseconds" (HWM79 §7.2 p.52).

**Standard task table** (HWM79 App. D p.69; µcode L25 reset table):

| Task (octal) | Name | Wakeup source |
|---|---|---|
| 16 | KWD, disk word | Each disk word, once enabled by KSEC. Highest used priority (17 is unused). |
| 15 | PART, parity | Memory parity/ECC error |
| 14 | DVT | Every 16.666 ms |
| 13 | DHT | Display line |
| 12 | CURT | Cursor |
| 11 | DWT | Display FIFO has room |
| 10 | MRT | "Wakeup every 38.08 microseconds" |
| 7 | ETHER (entry label `EREST`) | FIFO data, post events, or an MRT-tick countdown flip-flop |
| 4 | KSEC, disk sector | Sector mark on the disk |
| 0 | Emulator (`NOVEM`) | Always requesting |

Tasks 1–3, 5 and 6 are unused in the standard Alto (HWM79 App. D).

---

## 2. Disk (Diablo Model 31/44)

### 2.1 Drive facts (HWM79 §6.0 Fig. 7, p.43)

| | Diablo 31 | Diablo 44 |
|---|---|---|
| Cylinders × heads × sectors | 203 × 2 × 12 | 406 × 2 × 12 |
| Words per sector | 2 header + 8 label + 256 data | same |
| Sectors per pack | 4,872 | 9,744 |
| Rotation | **40 ms** | 25 ms |
| Seek (approx.) | 15 + 8.6·√dt ms; 15/70/135 min/avg/max | 8 + 3·√dt; 8/30/68 |
| Transfer rate, peak/avg | 1.6/1.22 MHz; **10.2/13 µs per word** | 2.5/1.9 MHz; 6.7/8 µs per word |
| Per sector | 3.3 ms | 2.1 ms |
| Whole drive | 19.3 s | 44 s (both packs) |

The 13 µs "average" is simply 3.33 ms ÷ 256 data words (computed). A sector mark comes every 3.33 ms, one per hub slot, 12 per revolution (Shirriff-d6).

**Word time in microcycles (computed):** 10.2 µs ÷ 0.170 µs ≈ **60 cycles per word** on the Diablo 31 (≈39 on the 44).
*Conflict, small:* the disk board's write oscillator is **3,330 kHz for the Model 31** and 5,000 kHz for the 44 (DiskSch sheet 14 note). One bit per two oscillator cycles, which is my reading of the flip-flop on that sheet, gives ≈9.6 µs per word. ContrAlto also uses ≈9.6 µs (40 ms ÷ 12 ÷ 347 word slots; ContrAlto `DiskController.cs` `_wordDuration`, `DiabloDrive.cs` `SectorWordCount`). Thacker79 says "1.5 Mbits/sec" in §2.2 and "1.7 Mbits/sec" in §4.2. **Use "about 10 µs, about 60 cycles, per word."**

### 2.2 What the disk hardware does (≈55–60 TTL chips, one board)

- **Board:** one card in slot 21 of the Alto II (Intro p.8). The rev E material list has **60 ICs plus one crystal oscillator**: 8×74109, 6×8T10, 5×7437, 3×74174, 3×74H04, 4×74LS08 and assorted SSI/MSI; 63 IC sockets; 62 decoupling capacitors (DiskSch sheets 4–5, counted). Thacker79 Fig. 11 says **"55 MSI TTL ICs"**, 4 R-registers and 144 microinstructions (§4.2 text: "about 150").
- **Clock/data separation is in the Diablo drive, not the Alto.** The drive sends separate `RDDATA` and `RDCLK` lines. The board has a 74153 mux choosing the bit clock from the drive's read clock or the board's crystal (`BCLKSRC`, `W/R`) (DiskSch sheet 14). Thacker79 §4.2 agrees: "the disk drive itself performs data-clock separation", while the controller encodes write data (Thacker79 calls it a "self-clocking Manchester code").
- **Registers and pulses the microcode drives** (HWM79 §6.1 pp.47–48; µcode L1743–1756):
  - `KDATA←` (F1=17): the 16-bit output word, also the disk address for seeks.
  - `←KDATA` (BS=4): the one-word input buffer.
  - `KADR←` (F1=16): read/write/check codes for the three records.
  - `KCOM←` (F1=15): the five mode bits XFEROFF, WDINHIB (stop word-task wakeups), BCLKSRC (disk clock or crystal), WFFO and SENDADR.
  - `KSTAT←`/`←KSTAT`: status.
  - `CLRSTAT`, `INCRECNO`, `STROBE` (start a seek).
  - F2 dispatches: `INIT`, `RWC` (read/write/check dispatch), `RECNO` (record-number dispatch through a map 0→0, 1→2, 2→3, 3→1), `XFRDAT`, `SWRNRDY`, `NFER`, `STROBON`.
- **Sync detection is hardware, in one bit.** With WFFO = 0, the hardware "holds the disk bit counter at -1 until a 1-bit is read" (HWM79 §6.1 p.47). Every record's sync pattern is a *single 1 bit* after a zero preamble (Thacker79 §4.2.2). The microcode writes it as the word 000001 (µcode L1989 `WP0: KDATA_ONE; WRITE THE SYNC PATTERN`).
- **Sector-late watchdog:** a 74123 one-shot of about **86 µs** (R = 30 kΩ, C = 0.01 µF). If the sector task has not answered a sector pulse in that time, the SECLATE status bit is set (ContrAlto `DiskController.cs` comment, derived from the board). Thacker79 §4.2.1 says the sector task's roughly 12 µs of work "can be satisfied at any time in a 100 µs interval".
- **Word-late detection:** the status bit is the OR of SECLATE and the "CARRY" out of the word shift register while the word task is still enabled, i.e. a word finished before the task took the last one (ContrAlto `DiskController.cs` KSTAT comment; ContrAlto does not emulate the second part).
- **Seek:** the Alto sends the cylinder number over 9 parallel lines and strobes. The drive's own three DTL seek boards do the servo work (Shirriff-d8; Shirriff-seek).
- **Write-fault interlock:** a zener-referenced supply monitor on the disk board produces `OKTORUN`, which gates `WRTGATE` and `ERGATE` (DiskSch sheets 7 and 14). So a browning-out Alto cannot write the pack.
- **Not in hardware:** DMA, address counting, word counting, preamble and gap timing, checksum, command parsing, chaining, retry policy, seek decisions, interrupts.

### 2.3 What the two microcode tasks do

**KSEC, the sector task (task 4), µcode L1779–1918.** It wakes on every sector mark.
1. Idles all transfers (`KCOMM_TOWTT`, L1787).
2. ORs the sector-interrupt mask at KBLK+3 (524B) into NWW (L1789–1794) and stores status in KBLK+1 (L1793–1795).
3. If the previous sector finished a command (`DMPSTAT`, L1871), it writes the final status into DCB+1. It then ORs DCB+6 (no error) or DCB+7 (error) into NWW (L1879–1891) and follows the DCB's next pointer (`NEF1: MAR_DCBR ... FETCH ADDRESS OF NEXT CONTROL BLOCK`, L1889).
4. On error it jumps back to the `KSEC` entry, which stores −1 in KBLK+2 ("forget where the arm is") and 0 in the DCB pointer (L1779–1786; HWM79 §6.1 p.46).
5. Command validation, the **seal**. It reads DCB+2, XORs it with `TOTUWC` (= 044000, consts L158) and requires the top byte to come out zero (L1804–1817, `BADCOMM` L1901). So C[0–7] must equal 110B. HWM79 §6.0 calls these bits "Checked to verify that this is a valid disk command"; Thacker79 §4.1 calls them "the seal": if the controller is pointed at random memory, "its seal would probably be improper".
6. Sector-number range check by carry: it adds `SECT2CM` = 040000, whose comment reads "CAUSES ILLEGAL SECTORS TO CARRY OUT". Sectors 12–15 overflow the 4-bit field and `ALUCY` branches to `ILLSEC` (consts L154; µcode L1829–1834, L1913).
7. It compares the new cylinder and disk with KBLK+2 (mask `CADM`, consts L152). If they differ, it starts a seek (`STROB`, L1915–1916) and sleeps until the next sector. If they match and the drive is ready, it compares the sector number. When the sector is right, it enables the word task (`TRANSFER: KCOMM_TOTUWC`, L1866) and sleeps. The command completes at the *next* sector mark (HWM79 §6.1 p.46).

**KWD, the word task (task 16), µcode L1921–2080.** It wakes once per word time for the whole sector.
- Record dispatch (`REC0/REC1/REC2`, L1938–1955). Lengths are 2 (header), 10₈ = 8 (label) and `PAGE1` = 400₈ = 256 (data). The buffer pointers come from DCB+3, DCB+4 and DCB+5.
- **Preamble and gap timing are microcode word counts** (consts L239–244):

| Constant | Octal | Words (decimal) | Use |
|---|---|---|---|
| MFRRDL | 177757 | 17 | Header read delay |
| MFR0BL | 177744 | 28 | Header preamble written |
| MIRRDL | 177774 | 4 | Inter-record read delay |
| MIR0BL | 177775 | 3 | Inter-record preamble written |
| MRPAL | 177775 | 3 | Read postamble |
| MWPAL | 177773 | 5 | Write postamble |

  The comments say "21", "34" and so on, which are octal. In effect **the on-disk sector format is a set of constants in the microcode.** The preamble loop costs 3 microinstructions per word time (`INPREF/INPREF0/INPREF1`, L1967–1972). Thacker79 §4.2.2: even with no data moving, "the disk controller is waking up the data task each time the 16-bit buffer is full, so that it can count preamble bits".
- **Main loop** (L1993–2036). It runs *downward* through memory, "Due to the ALU functions available" (HWM79 §6.1 p.47):
  ```
  XFLP: T_L_KNMARW-1;            ; decrement buffer pointer
        KNMARW_L;
        MAR_KNMARW,RWC;          ; start memory ref, dispatch read/write/check
        L_KWDCTW-T,:R0;
  R0:   T_CKSUMRW,SH=0,BLOCK;
        MD_L_KDATA XOR T,TASK,:RW1;   ; bus=disk word → memory; ALU=checksum XOR
  RW1:  CKSUMRW_L,:XFLP;
  ```
  One microinstruction both stores the disk word into memory (MD← takes the bus) and folds it into the checksum (L← takes the ALU result).
- **Checksum = XOR of all words, seeded with 521B.** `WP1: L_KBLKADR ... INITIALIZE THE CHECKSUM` (L1990), and KBLKADR = 521 (consts L147). ContrAlto: "Load checksum with constant value of 521B" (`DiabloDrive.cs`). So the seed is the address of the disk control block word. *Why that value is my speculation:* reusing an existing constant saves a constant-ROM word, and a nonzero seed makes an all-zero record fail the check. A checksum error is noted in status and the command continues (HWM79 §6.1 p.47; `CKSMERR` L2059).
- **Microinstructions per word (counted):** read 7 (XFLP 4 + R0 2 + RW1 1), write 8 (W0 path), check 9 when the memory word is nonzero, 11 when it is zero (the CK4/CK6 path does a second store).
  - At about 60 cycles per word, that is **12% (read) to 18% (check-and-fill)** of the machine during a record.
  - Thacker79 §4.2.2: the data task is "awakened about every 10 µs" and transfers a word "in at most 1.7 µs", i.e. up to **20%** during transfers.
  - The sector task costs about 12 µs per 3.33 ms, about **0.4%** (Thacker79 §4.2.1; percentage computed).

### 2.4 Command block, chaining, interrupts (HWM79 §6.0 pp.43–45; HWM76 §6.0 pp.31–33)

- **KBLK at 521B.** 521 points to the first DCB (0 = idle); 522 holds status at the start of the current sector; 523 holds the disk address of the latest command (−1 forces a seek); 524 is the sector-interrupt bit mask.
- **DCB (10 words):**

| Word | Contents |
|---|---|
| +0 | Next DCB |
| +1 | Status |
| +2 | Command |
| +3 | Header buffer pointer |
| +4 | Label buffer pointer |
| +5 | Data buffer pointer |
| +6 | Interrupt mask on success |
| +7 | Interrupt mask on error |
| +8 | Unused (free for software) |
| +9 | Disk address |

- **Command word C:** [0–7] = 110B seal; then three 2-bit fields for header, label and data (0 read, 1 check, 2/3 write); [14] = no-transfer (seek only); [15] XOR A[14] selects the drive.
- **Disk address A:** [0–3] sector, [4–12] cylinder, [13] head, [14] disk, [15] restore.
- **Chaining:** after a successful command the controller stores the next pointer in KBLK. On error it stores 0 and the chain is abandoned (HWM79 §6.0). Commands complete, and chain, only at sector marks (µcode `NEF1` L1889).
- **Manual tricks** (HWM79 §6.0 p.46):
  - To read a block, put `JMP STRT` at STRT, start the read, and jump to STRT. The data arrives top-down, so when the loop instruction is overwritten, the block is complete.
  - "chain disk reads through their label blocks": each label holds part of the next sector's DCB.
- **Write rule:** "writing, once begun, must continue until the end of the sector" (HWM79 §6.0 p.43).

### 2.5 Check mode: the label as a microcode-enforced guard

- In check mode each disk word is compared with memory. A memory word of **0 is a wildcard**: the disk word is stored in its place and does not take part in the check. So one pass can read and check a block, but you cannot check for zero words (HWM79 §6.0 p.43).
- A mismatch stops the sector at once. `CKERR: KCOMM_TOTUWC; TURN OFF DATA TRANSFER` then posts the check-error status (µcode L2079–2080; status S[14–15] = 2, "check error. Command terminated instantly", HWM76 §6.0 p.33).
- Typical use is "check header, check label, write data". The header check catches seek or sector hardware errors; the label check catches *software* errors, a wrong file or page, before the data record is written. Thacker79 §4.1: conventional controllers' header records guard "failures of seeking or sector counting hardware, but not ... software failures". This is why disk addresses in the Alto file system are only hints.
- **Precision:** the controller checks the label only when the command asks for check mode on it. "Every transfer is checked" is a file-system convention, not a hardware rule.

### 2.6 Missed deadlines

- The word hardware has **one word** of buffering (Thacker79 §2.2), so the word task must run within about one word time (about 10 µs).
- If it is late, status bit S[11] = "data or sector processing was late during the last sector. Data and current sector number unreliable". Completion code S[14–15] = 1 means "hardware error (see S[8-11])" (HWM76 §6.0 p.33).
- The command then ends in error: KBLK ← 0, KBLK+2 ← −1, the DCB+7 error interrupt fires, and software must retry, typically one revolution (40 ms) later (HWM79 §6.1 p.46; µcode `DMPSTAT/ERRFND` L1871–1891).
- The contrast with the optional Trident disk (9 Mbit/s) shows the limit of the one-word design. Wakeup latency "can be up to 2 µs, so multi-word buffering hardware is required in the faster controller" (Thacker79 §4.2).

---

## 3. Ethernet (experimental 2.94 Mbit/s)

### 3.1 Rate derivation (primary)

- Clock: "clock interval of approximately 170 nsec" (HWM79 §2.0; HWM76 §2.0 says "170nsec").
- "The phase encoder uses the system clock (one Ethernet bit time is two clock periods)" (HWM79 §7.2 p.52).
- So one bit = 340 ns, giving 1/340 ns = **2.94 Mbit/s** (the rate is stated in HWM79 §7.0 p.49). Each Manchester half-cell is one 170 ns microcycle; Shirriff notes "the Ethernet pulses are 170ns wide" (Shirriff-GW).
- One 16-bit word = 32 cycles = **5.44 µs**. The manual: output data wakeups come "once every 5.44 microseconds on the average" (HWM79 §7.3 p.54).

### 3.2 What the Ethernet hardware does (≈70 TTL chips, one board)

- **Board:** Alto II slot 14 (Intro p.8). The rev D material list has **70 ICs** plus 3 resistor networks (EnetSch sheet 4, counted): 13×74109, 8×7438 line drivers, 4× Intel 3101A (the FIFO), 3× Intel 3205 decoders, 3× 3601 PROMs, 1× Fairchild 9401 CRC, 2×74123 one-shots, shift registers 74164/74165, 4×74LS298. Thacker79 §5.3 says "about 75 MSI TTL ICs", "slightly larger than the disk and display controllers".
- **Blocks** (HWM79 §7.2 p.52 and Fig. 9, the unnumbered page after p.52):
  - A **16-word FIFO** ("Interface Buffer (16 words)"), built from four Intel 3101A 16×4 RAMs (Shirriff-Enet). It is shared by transmit and receive, so the interface is half-duplex and cannot loop back (Thacker79 §5.3).
  - Output shift register plus **phase (Manchester) encoder**. Shirriff says it is a PROM-driven state machine using two Intel 3601 PROMs (Shirriff-Enet). The material list has three 3601s (EnetSch sheet 4); the role of the third is unverified.
  - **Clock recovery / phase decoder:** an RC filter and XOR edge detector, then a one-shot about 75% of a bit cell long that ignores cell-boundary edges (Shirriff-Enet).
  - **Carrier sense:** "a one-shot which is retriggered by each level transition" gives the packet envelope, called 'carrier' (HWM79 §7.2).
  - **Sync bit:** a single leading 1. It sets the receiver's clock phase and "recirculated every 16 bit times" to mark full words (HWM79 §7.2).
  - Write register to synchronise the incoming-clock domain with the processor clock. Losing a word sets "input data late" (HWM79 §7.2).
  - **16-bit CRC in hardware**: generated on send and checked on receive (HWM79 §7.2), using a Fairchild 9401 (Shirriff-Enet). The microcode never touches it. The wakeup to empty the FIFO fires only when ≥2 words are present, "but insures that the CRC will be left behind" (HWM79 §7.2).
  - **Deference in hardware:** "The phase encoder will *not* start up while there is carrier present" (HWM79 §7.2).
  - **Collision detection in the transceiver**, which compares transmitted and received data. A collision line sets a flip-flop that wakes the microcode (HWM79 §7.2).
  - **Countdown tick:** a flip-flop set by microcode gives a wakeup on the next MRT tick (`SWAKMRT`). The grain is "about 38 microseconds" (HWM79 §7.2) or 38.08 µs (§7.3 p.53). *HWM76 says 37 µs.*
  - **Cable:** three twisted pairs (transmit data, receive data, collision) plus power from the interface (HWM79 §7.2). The host address (0–377B) is set by jumper wires on the backplane and returned by SIO (HWM76 §7.1; Shirriff-GW).
- **Clock-stealing quirk:** the delay to gate FIFO data onto the bus is marginal, so the interface **stops the system clock for one cycle** when needed. "Due to a design error, the instruction *following*" is sometimes the one stopped (HWM79 §7.3 footnote p.55). Microcode warning: µcode L359–368. Consequence: Appendix G lists RDRAM as not working reliably "when the Ethernet interface is active" (HWM79 App. G p.71, Alto II v2).

### 3.3 What the Ethernet microcode does (task 7; µcode L162–499, "Version III, Boggs and Metcalfe")

About 100 microinstructions and 2 R-registers: ECNTR = R12 and EPNTR = R13 (µcode L189–190; Thacker79 §5.3).

**Task-specific functions** (µcode L220–231; HWM79 §7.3 p.54):

| Function | Code | Effect |
|---|---|---|
| EIDFCT | BS=4 | Input data: FIFO to bus, pop |
| EILFCT | F1=13 | Input *look*: FIFO head to bus **without popping** |
| EPFCT | F1=14 | Post: hardware status to bus, reset interface |
| EWFCT | F1=15 | Wake me on the next MRT tick |
| EODFCT | F2=10 | Output data: bus to FIFO |
| EOSFCT | F2=11 | Start output |
| ERBFCT | F2=12 | Dispatch on the ICMD/OCMD flip-flops set by SIO |
| EEFCT | F2=13 | End of output data |
| EBFCT | F2=14 | Branch on post/collision |
| ECBFCT | F2=15 | Branch if FIFO not empty |
| EISFCT | F2=16 | Start input (hunt for the next packet) |

**Control block in page 1** (µcode L204–216; HWM79 §7.1 pp.49–50):

| Location | Name | Contents |
|---|---|---|
| 600 | EPLOC | Post: microcode status (left byte) + hardware status (right byte, low-true) |
| 601 | EBLOC | Interrupt bits ORed into NWW at post |
| 602 | EELOC | Words left |
| 603 | ELLOC | Backoff "load" mask |
| 604 | EICLOC | Input buffer count |
| 605 | EIPLOC | Input buffer pointer |
| 606 | EOCLOC | Output buffer count |
| 607 | EOPLOC | Output buffer pointer |
| 610 | EHLOC | Host address |

- Commands are given through SIO with AC0[14:15]: 1 = transmit, 2 = receive, 3 = reset.
- Microcode status codes: 0 input done, 1 output done, 2 input overrun, 3 load overflow, 4 zero-length buffer, 5 reset, 6 "Call a repairman" (HWM76 §7.1 p.38; the 1979 Fig. 9 says "Impossible microcode condition").
- Ethernet command blocks are **not chained**, "partly because of a shortage of microcode space" (Thacker79 §5.3).

**Address filtering is microcode** (`EIFRST`, L298–342):
- On the first-word wakeup, the task *peeks* at the FIFO head (EILFCT) and accepts the packet if EHLOC = 0 (promiscuous), if the destination byte is 0 (broadcast), or if the destination equals the host byte.
- Otherwise it restarts the receiver to hunt for the next packet (HWM79 §7.3 p.53).
- It must decide "within about 14*5.44 usec", before the FIFO fills (µcode L303).
- Thacker79 §5.3: rejecting a packet takes 13 cycles (2.21 µs). That is "as much as 20%" of the machine only with minimum-length back-to-back packets.
- Contrast: M&B76 §4.3 says interfaces "ordinarily include hardware" address filtering. On the Alto it is microcode.

**Main loops (5 microinstructions per word, counted):**
- Input `EIDATA/EIDMOR/EIDOK/EIDZ4` (L374–378) and output `EODATA/EODOK/EODMOR` (L465–469).
- One word every 32 cycles gives **5/32 ≈ 16%** of the processor while a packet streams. Thacker79 §5.3 agrees: "The task consumes 16% of the machine in the data transfer loops", "five cycles (one memory reference) every 5.44 µs".
- The rest of the code runs once per packet, which is negligible.

**Random exponential backoff is microcode, and its "random" number is the clock** (`EOREST/EORST1/EORST2`, L398–424; HWM79 §7.3 p.53):
```
EOREST: MAR_ ELLOC;           Get load
        L_ R37;               Use clock as random # gen
        EPNTR_ LRSH1;         Use bits [6:13]
        ...
        MTEMP_ LLSH1          New load = (old lshift 1) + 1
EORST1: ... EPNTR_ LRSH1; T_ 377; L_ EPNTR AND T   → (R37>>2) & 377
EORST2: ... L_ EPNTR AND T;   L_ Random & Load   (T = OLD load)
```
- **R37** holds the low bits of the real-time clock. On the Alto II it advances by 4 every MRT wakeup ("R37 [4-13] are the low bits of the TOD clock", µcode L2175; `T_ 3+T+1`, L2190). So bits [6:13] are simply **the count of 38.08 µs refresh ticks, mod 256**.
- The Alto I code takes "bits [2:9]" with a left shift, because its R37 advances by 100B per tick (µcode-I L374–376; HWM76 §3.3 RCLK p.18). Both machines use the *same* 8 tick-counter bits.
- **The algorithm:**
  - Load starts at 0 (software must zero ELLOC). Each attempt, the countdown = (tick count mod 256) AND old_load, then load ← load·2 + 1.
  - The first attempt waits 0. After collision *k* the wait is uniform over 0 … 2^k − 1 ticks.
  - It is **capped by the 8-bit random number at 255 ticks × 38.08 µs ≈ 9.7 ms** (computed). The doubling stops mattering after 8 collisions.
  - After **16 collisions** the load's sign bit is set and the attempt aborts with status 3, "load overflow"; ELLOC reads −1 (µcode L402–405; HWM79 §7.3).
- **Countdown:** one decrement per MRT tick through EWFCT (`EOCDWT` loop, L439–442), 4 microinstructions per 38 µs tick.
  - While counting down, if an input buffer is set up, the **receiver is started "under" the transmitter**. An arriving packet for this host aborts the send and is received instead (HWM79 §7.3 p.53; µcode L420–428).
- M&B76 §4.4 calls the idea "Binary Exponential Backoff" with the mean doubling per collision. Its model uses a 16 µs slot (§6); the Alto's grain is the 38 µs refresh tick.

**Interrupting the emulator:** at completion, `EPOST` writes EELOC and EPLOC and ORs EBLOC into NWW (µcode L264–272). A reset with EBLOC ≠ 0 also interrupts (HWM79 §7.3). Because a receiver may wait "for days", programs always use interrupts rather than busy-waiting (Thacker79 §5.3).

**Packet size:**
- The hardware has no length limit. The receiver posts "input buffer overrun" if a packet exceeds EICLOC (HWM79 §7.1).
- Convention: "packets should not be substantially longer than 256 words" (HWM79 §7.1 p.50). M&B76 §6: "We limit in software the maximum length of our packets to be near 4000 bits".
- The receive-before-transmit wait is "a maximum of about 1.5 ms assuming 250-300 word packets" (HWM76 §7.1).
- Packet layout: sync bit, 8-bit destination, 8-bit source, data, 16-bit CRC (M&B76 Fig. 2). The second word is the type by software convention; Pup = 1000B (HWM76 §7.1).

---

## 4. Keyboard: pure hardware on the memory bus, zero microcode

- Four words at **KBDAD = 177034–177037B**, one bit per key; **a pressed key reads 0** (HWM79 §5.1 p.35).
  - "61 or 64 keys", in Microswitch and ADL layouts (HWM79 §5.1).
  - The Thacker paper: a typewriter keyboard plus 8 extra keys; each bit is the current up/down state, so "any key [can] be used as a shift key" (Thacker79 §3.6).
- **The hardware is 8 multiplexers in the keyboard itself.** 64 key lines go into **74153 dual 4:1 muxes**, giving 16 output lines `KB(0-15)` to the **AIM** (Memory Address Interface) board. Two select lines `SEL(0-1)`, from the low address bits, choose one of the 4 words (KbdSch sheet 6 block diagram; sheet 10 shows chips A1–A8 with 3.3 kΩ pull-ups per key).
  - No scanning, no encoder, no debouncing, no character codes: the "undecoded keyboard" (HWM76 §1.0).
- **Memory-bus device** (Thacker79 §2.2, Fig. 4): the keyboard and keyset are read with ordinary loads decoded from the top two pages of address space. A memory-bus access costs five microinstruction cycles, versus one for processor-bus devices.
- **Cost:** 0 microcode, 0 task, no interrupt. Software polls. *(How often the OS polls was not verified here.)*
- **Boot use:** the PROM reads KBDAD at reset (§7 below). The keyboard word *is* the boot disk address.

## 5. Mouse and keyset: tiny hardware, counting in the refresh task

- **Motion:**
  - "The hardware senses motion by ±1 increments in each direction ... and microcode running in the timed task uses this information to update a pair of mouse coordinates" (Thacker79 §3.5).
  - The bus source **←MOUSE (BS=6)** returns "Mouse data (4 bits, remainder of word is 1)" (HWM76 §2.1 bus-source table). The microcode ANDs it with 17B (µcode L2121 comment; consts L32, L116).
  - The code has 9 values, (dx, dy) ∈ {−1, 0, +1}². The dispatch table is `!17,20,TX0,TX6,TX3,TX2,TX8,TX5,TX1,TX7,TX4` (µcode L508) and ContrAlto documents the same map (`MouseAndKeyset.cs`).
  - *Unverified:* which board generates this code, and whether it latches pending steps between MRT samples.
- **Microcode:**
  - MRT reads ←MOUSE on **every wakeup (every 38.08 µs)** and dispatches (µcode L2121–2122 and L2187–2188).
  - With no motion it falls into the refresh path. On motion, `TXn` + `M00` (µcode L556–574, "START THE FETCH OF THE COORDINATES") read MOUSELOC and MOUSELOC+1 (424B, 425B), add dx and dy, and write them back.
  - Cost: **about 11 extra microinstructions** in that 224-cycle wakeup (counted). Buttons and no-motion ticks cost nothing extra.
  - At most one step per axis per tick, so ≤26,000 counts/s (computed).
  - *Possible microcode quirk (tentative):* ContrAlto's author says simultaneous X+Y moves trigger "a microcode bug that causes erroneous movements", so the emulator never reports diagonal moves (`MouseAndKeyset.cs`). My reading of `TX5` (dx = −1, dy = +1) is that it adds 2 to Y, which depends on the T-loading rule. Treat as unconfirmed.
- **Coordinates are relative:** "the hardware only increments and decrements them" (HWM79 §5.2 p.36). Software ties the cursor to them (Thacker79 §3.5).
- **Resolution conflict:** HWM79 §5.2 says "approximately 100 points per inch"; Thacker79 §3.5 says one unit is "roughly 1/200 inch". Mechanism: the mouse rides on three ball bearings and senses "the x and y rotations of one of these bearings" (Thacker79 §3.5).
- **Buttons, pure hardware:** they are read directly as UTILIN (177030B) bits 13, 14, 15: **RED** (top or left), **BLUE** (bottom or right), **YELLOW** (middle); pressed = 0 (HWM79 §5.2 p.36).
- **Keyset:** 5 bits in UTILIN [8–12], key 0 on the left (HWM79 §5.3). Pure memory-bus hardware, polled by software.
- **Supplier:** the Xerox procurement spec says the mouse assembly "may be purchased from Hawley Laboratories, Berkeley" (MouseSpec sheet 2).

---

## 6. Interrupts: from wakeup lines to Nova-style interrupts

There are two separate layers. "The interrupt system is completely separate from the task-switching mechanism" (Thacker79 §2.1).

1. **Hardware wakeups → microtasks.**
   - Each device raises a wakeup line. A task gives up the processor with `TASK` (F1=2), and the highest-priority requester runs.
   - "One additional instruction is executed by the current task before the switch becomes effective" (HWM79 §2.4 p.11).
   - `BLOCK` (F1=3) is by convention how a task tells *its device* to drop the wakeup. It "is not accomplished by the Alto microprocessor, but rather by the individual device interfaces" (HWM79 §2.4 p.11).
   - `TASK` may not appear in two consecutive microinstructions. State must be in the task's own R-registers at a switch (HWM79 §2.4).
   - The emulator "is always requesting wakeup" (HWM79 §3.0).
2. **Microcode → NWW → emulator interrupts.**
   - Device microcode ORs channel bits into **NWW** (R4, µcode L41). Sources in the standard microcode:

| Source | Where the mask lives | Code |
|---|---|---|
| Display field | word at 421B | µcode `DVT` L75–82 |
| Interval timer | ITQUAN+1 | µcode L2221–2227 |
| Disk sector | KBLK+3 | µcode L1789–1794 |
| Disk command | DCB+6 or DCB+7 | µcode L1879–1885 |
| Ethernet post | EBLOC | µcode L268–272 |
| Parity | channel 15, fixed | µcode `PR2` L2101 |

   - **15 channels**; bit 0 of NWW means "disabled"; channel 15 is reserved for memory errors (HWM79 §3.2).
   - Page-1 locations: ACTIVE 453B, WW 452B, PCLOC 500B, INTVEC 501–517B.
   - **Where the emulator checks:** in the instruction-fetch microinstruction itself. `START: T_ MAR_PC+SKIP; START1: L_ NWW, BUS=0; :MAYBE, SH<0` (µcode L692–694) tests NWW while the memory fetch is in flight.
   - Microcode comment: "TIMING IS 0 CYCLES IF DISABLED, 18 CYCLES IF THE INTERRUPTING CHANEL IS INACTIVE, AND 36+6N CYCLES TO CAUSE AN INTERRUPT ON CHANNEL N" (µcode L1246–1248).
   - If (NWW OR WW) AND ACTIVE ≠ 0, it saves PC in PCLOC, sets NWW[0], clears that channel's bit and jumps through INTVEC. Otherwise pending bits are flushed into WW (HWM79 §3.2 p.29).
   - A microcode-caused interrupt is noticed "within one instruction". Long instructions such as BitBLT can be interrupted and resumed (HWM79 §3.2).
   - Instructions: DIR 61000, EIR 61001, BRI 61002, DIRS 61013.

---

## 7. Reset and boot: all in PROM microcode, using the ordinary device tasks

### 7.1 Reset

- A "boot" is triggered by the button on the back of the keyboard, or by SIO with AC0 bit 0 = 1. The SIO route works only "if an Ethernet board is plugged into the Alto" (HWM79 §3.3 SIO p.20; App. C: SIO bit 0 = "Software boot feature").
- A boot "simply resets all micro-pc's to fixed initial values determined by their task numbers" (HWM79 §3.4 p.29). "Each task start[s] at the location which is its task number (thus the emulator task finds its first instruction to execute at MPC=0)" (HWM79 §2.4 p.11).
- The reset table in the code: `!17,20,NOVEM,,,,KSEC,,,EREST,MRT,DWT,CURT,DHT,DVT,PART,KWDX,;` (µcode L25).
- The word task's reset slot `KWDX` sits *inside* its own transfer loop, commented "(ALSO USED FOR RESET)" (L1977).
- The **Reset Mode Register** chooses ROM or RAM per task and resets to all ones, meaning all ROM (HWM76 §8.4; HWM79 §8 p.59: "task i starts at location i").
- A reset does not clear R-registers, S-registers, microcode RAM or main memory, and need not take "longer than a few microseconds", which enables the "silent boot" (HWM76 §9.2.2 p.50).

### 7.2 The emulator's boot microcode (`NOVEM`…`DiskBoot`/`EtherBoot`, µcode L597–662)

1. It stores the old PC in location 0. The `Q0…Q6` loop fills page 0/1 words: **a disk command block at location 1** (next = 1, command = `TOTUWC` = 044000, which passes the seal as "read/read/read"; header → 402, label → 402, data → 1). It also sets Ethernet input count 256 at 604 and pointer 1 at 605 (L604–610, `Q5` and `Q6` marked "X21").
2. It clears the display pointer (420B ← 0), zeroes R37 (the clock), disables interrupts (NWW ← 100000) and reads keyboard word **177034** (L611–618).
3. `BUSODD` tests bit 15. The **BS key** held gives EtherBoot; otherwise DiskBoot (L618–619, "X21 change").

**Disk boot** (L621–623; HWM79 §3.4 pp.29–30):
- The complemented keyboard word (pressed = 1) is stored as the disk address in **location 12₈**, which is DCB+9 (`BDAD`, consts L245). KBLK ← 1 and the emulator starts.
- The KSEC/KWD tasks read the sector: data to 1–400B and label to 402–411B.
- "When the transfer is complete, PC←1 ... The disk status is stored in location 2, so the bootstrapping code must skip this location" (HWM79 §3.4).
- *My reading (inference, consistent with the manual's JMP-STRT trick in §6.0 and with the register trace):*
  - The last value `INXCom` leaves in PC is 1, and location 1 holds 000001, which is the Nova instruction `JMP 1`. The emulator therefore spins on location 1.
  - Data arrives top-down, so the **last word written overwrites the spinning instruction** and drops the CPU straight into the boot sector.
  - The DCB (locations 1–12) lives inside the very buffer it fills.
- Keys → address bits (HWM79 Fig. 6 p.35 with the address format of §6.0):

| Bits | Field | Keys |
|---|---|---|
| 0–3 | Sector | 5, 4, 6, E |
| 4–12 | Cylinder | 7, D, U, V, 0, K, −, P, / |
| 13 | Head | \ |
| 14 | Disk | LF |
| 15 | Restore | BS (which instead selects Ether boot) |

  No keys pressed gives address 0.

**Ethernet boot, the "Breath of Life"** (L626–649; "Ethernet boot section added in X21"):
- It sets EHLOC ← **377B**, zeroes EPLOC, starts the receiver with `SINK_ 2, STARTF` (the SIO receive command), then busy-waits on EPLOC.
- It accepts only good status (377) **and** word 2 = **602B**, then `PC ← 3` (`EthNovaGo`). On anything else it re-arms and waits again (the branch at `EtherBoot` goes to EReRead or FINJMP).
- The Ethernet task, not the emulator, copies the packet into locations 1–400B.
- Server side (BootProto p.1, p.4):
  - A boot server sends a BreathOfLife packet "every 5 seconds or so" on each directly connected Ethernet. It is **not a Pup**: destination 377B, type 602B, and the contents are a boot-loader program starting at word 3.
  - The total packet must not exceed 256 words.
  - Shirriff's modern IFS sent one every second (Shirriff-GW, footnote).
- Stage 2, "Mayday" (BootProto pp.1–2):
  - The loader in the packet reads keyboard word KBDAD+1 as a **boot-file number**. The keys are 3 2 W Q S A 9 I X O L , " ] BLANK-MIDDLE BLANK-TOP, most significant first. All keys up except BS means file 0.
  - It broadcasts a BootFileRequest Pup (type 244B) about once a second for about 30 s, and receives the file by EFTP. Space limits it to 254-word EFTP blocks.
- The NetExec later replaced key combinations for most boot files (BootProto p.3).
- Aside: the KissOfDeath Pup (247B) is answered only by DMT; the memo describes the idle Altos as "about 125 6-MIP CPUs" (BootProto p.5).

---

## 8. Contrast with conventional 1970s controllers

| Device | Conventional minicomputer approach | Alto |
|---|---|---|
| 2.5 MB cartridge disk | DEC RK11-C: "about 40 small M-Series FLIP CHIPs" on a custom wire-wrapped backplane in a 19-inch rack. RK11-D: **four quad cards** plus its own 4-slot backplane, with a 6-word FIFO (gunkies RK11). It does its own sequencing and Unibus DMA for the RK05, the same class of IBM-2315-style 14-inch single-platter cartridge. *Inference:* Shirriff's replacement Alto pack arrived in a DEC RK05K cartridge box (Shirriff-d8), which suggests physical compatibility; not verified. | **One board, 55–60 TTL chips**, a one-word buffer, and about 150 microinstructions in two tasks. Seeks, format timing, checksum, seal check, label check and chaining are all microcode. |
| Network | No standard product existed. M&B76 §4.3: "an interface must be built for each kind" of station, "ordinarily" with hardware address filtering. | **One board, about 70 chips** (FIFO, Manchester, CRC, carrier, clock recovery) plus **about 100 microinstructions**: DMA, address filter, backoff, retransmission timer and posting. |
| Keyboard | Terminal with its own encoder, reached through a serial-line card. The PDP-11 DL11 is one quad card with a UART and interrupts per character (gunkies DL11). | **8 multiplexer chips inside the keyboard**, read as 4 memory words. No codes, no UART, no microcode. |
| Mouse | No mainstream equivalent; SRI's NLS mouse predates the Alto (see the main report). | ±1-step hardware plus **about 11 microinstructions of the refresh task**; buttons are memory bits. |

Scale: the whole processor is five boards of about 70 ICs each. Each of the three standard I/O controllers (display, disk, Ethernet) is one board of about 60 ICs; memory is 312 chips (Thacker79 §2).

---

## 9. Corrections to `reports/Xerox Alto explainer research.md` (disk, Ethernet and input parts)

1. **Line 189**, "all sequencing, address arithmetic and protocol handling is microcode". Mostly right, but real work stays in hardware:
   - Ethernet: CRC (9401 chip), Manchester encode/decode, clock recovery, carrier sense and deference (HWM79 §7.2). Collision detection is in the external transceiver.
   - Disk: sync-bit detection and (de)serialisation (HWM79 §6.1). Clock/data separation is in the Diablo drive, not the Alto (DiskSch sheet 14; Thacker79 §4.2).
2. **Line 193**, "KWDX, disk word (16) … a late word is lost for good".
   - The task is **KWD**; `KWDX` is only its reset label (HWM79 App. D; µcode L1977).
   - "Lost for good" overstates it. A late word sets status S[11], the command ends in error, KBLK ← 0 and KBLK+2 ← −1, and software retries on a later revolution (HWM76 §6.0 p.33; HWM79 §6.1 p.46).
3. **Line 200**, "EREST, Ethernet (7)". The manual calls the task **ETHER**; `EREST` is its entry label (HWM79 App. D; µcode L251).
4. **Line 149 and "Numbers to double-check", line 79.** The 2.94 Mbit/s rate and "one bit per two microcycles" are no longer merely computed. They are **stated in the manual**: "one Ethernet bit time is two clock periods" (HWM79 §7.2 p.52); 2.94 Mbit/s (HWM79 §7.0 p.49); 5.44 µs per word (HWM79 §7.3).
5. **"Numbers to double-check", line 78** (disk 2.5 MB and 1,500 rpm are "emulator geometry, computed"). Now primary: HWM79 Fig. 7 p.43 gives 203 cylinders, 2 heads, 12 sectors, 256-word data records, 4,872 sectors per pack and 40 ms per revolution.
6. **Line 244**, the label "is checked on every transfer". Imprecise. The controller checks a label only when the command puts that record in **check** mode; routine checking is a file-system convention, and 0 words act as wildcards (HWM79 §6.0 p.43; Thacker79 §4.1).
7. **Line 250.** Rate correct. Add that the 5.44 µs figure is in the manual itself (HWM79 §7.3), not just ContrAlto.
8. **Line 252.** Correct as far as it goes. Worth adding for the video:
   - The FIFO is **shared** by send and receive, so the interface is half-duplex (Thacker79 §5.3).
   - **Address filtering and exponential backoff are microcode.**
   - The backoff "random" number is the refresh clock (µcode L398–424).
9. **Line 254**, "The mouse needs no controller either".
   - Imprecise. A small hardware interface converts the encoders into a 4-bit ±1 motion code, read through a dedicated bus source ←MOUSE (BS=6; HWM76 §2.1; Thacker79 §3.5). The *counting* is microcode.
   - The refresh task runs every **38.08 µs** (HWM79 App. D), not just "every few tens of microseconds".
   - The buttons are read by software directly from UTILIN 177030B, with no microcode involved.
10. **Line 266**, "Backspace plus the top two blank keys fetches the Scavenger; backspace alone ... the memory diagnostic".
    - Mechanism, primary: the microcode only tests **BS**. The other keys are read by the **boot loader inside the Breath-of-Life packet** as a boot-file number from KBDAD+1, where BLANK-TOP is bit 15 and BLANK-MIDDLE bit 14. That makes BS + the top two blank keys **file 3**, and BS alone file 0 (BootProto pp.1–2).
    - That file 3 was the Scavenger, and file 0 the memory test (DMT), is plausible but not verified from a boot directory.
    - Also, holding keys *without* BS changes the **disk address** the PROM boots from (HWM79 §3.4).
11. **Line 430**, "A server periodically broadcast a 'Breath of Life' packet to Ethernet host 0377".
    - It is sent to destination **377B**, not the broadcast address 0. It is a raw non-Pup packet of type 602B, about every 5 s (BootProto pp.1, 4). The receiving Alto accepts it only while in its PROM Ether-boot loop, which sets EHLOC = 377 (µcode L632–634).
    - "Broadcast" is fine loosely; a precise script should say "sent to a special address every Alto listens for while net-booting".
12. **"Story hooks", Breath of Life**, "a dark Alto wakes up". The Alto is not woken by the packet. A user resets it with **BS held**, and the PROM waits for the next packet (HWM79 §3.4).
13. **Claims table, line 16**, "vampire taps" called an anachronism. The *term* may be 1980s, but the 3 Mb/s transceivers Shirriff photographed clamp on and pierce the coax: "a 'vampire tap' punctures the cable", with period tap-drilling tools (Shirriff-GW). M&B76 §4.1 says "off-the-shelf CATV taps". Suggest: "the mechanism existed; the name is later (unverified)".
14. **Line 372**, "a random time whose range doubles after each collision". True, but on the Alto the doubling is **truncated at 8 bits (≤255 × 38 µs ≈ 9.7 ms)**, and the attempt gives up after 16 collisions (µcode L398–424; HWM79 §7.3).
15. **Line 187** (switch after the next microinstruction): confirmed by HWM79 §2.4 p.11. **Line 185** (16 tasks): confirmed.

---

## 10. Nerd gems for the video (animatable, 1-bit, portrait, red/yellow/blue accents)

1. **The Ethernet's dice are the DRAM-refresh clock.** Backoff = (38 µs tick count mod 256) AND a mask that gains one 1-bit per collision (µcode L398–424).
   *Animate:* a white 8-bit odometer spinning at the top; below it an ELLOC mask filling with 1s from the right in **yellow**, one per collision; an AND gate outputs a **red** countdown bar that shrinks one cell per tick. After 8 collisions the mask outgrows the odometer and the bar stops growing.
2. **One Ethernet bit = exactly two microcycles.** 170 ns × 2 = 340 ns, giving 2.94 Mbit/s; 16 bits = 32 cycles = 5.44 µs (HWM79 §7.2–7.3).
   *Animate:* a vertical clock ladder of 32 rungs beside a Manchester waveform whose half-cells align rung for rung; 5 rungs flash **blue** for "Ethernet task (16%)", and the other 27 stay free for everyone else.
3. **The disk gets one word of slack, so it outranks everything.** A word every ~10 µs (≈60 cycles); the read loop is 7 microinstructions, with 1 word of buffer versus the Ethernet's 16 (Thacker79 §2.2; µcode L1993–2007).
   *Animate:* three buckets for disk (1 slot), display (16) and Ethernet (16, slow drip) with a timer on each. The disk bucket overflows first and a **red** "LATE" bit latches.
4. **One microinstruction does DMA and checksum at once.** `MD_L_KDATA XOR T`: the bus carries the disk word to memory while the ALU folds it into the XOR checksum, seeded with 521₈ (µcode L2003, L1990).
   *Animate:* a word drops from the disk shift register and splits into two paths, one into a memory column and one through an XOR into a **yellow** checksum register that starts at "521".
5. **Sync is a single 1 in a sea of zeros.** The hardware holds its bit counter at −1 until the first 1 bit arrives (HWM79 §6.1; Thacker79 §4.2.2).
   *Animate:* a scrolling row of white zeros; one **yellow** 1 lands and a counter snaps from −1 to 0; words then tick off in groups of 16.
6. **The sector format is microcode constants.** Preambles of 28 and 3 words, read delays of 17 and 4, postambles of 3 and 5, all counted by the word task one word at a time (consts L239–244).
   *Animate:* a track drawn as a long strip whose gap lengths are dimensioned with numbers pulled out of a code listing on screen.
7. **Zero is a wildcard; a wrong label stops the write.** In check mode a memory word of 0 accepts whatever the disk holds; any other mismatch kills the sector before the data record (HWM79 §6.0; µcode `CKERR` L2079).
   *Animate:* two 8-word label rows slide past each other; zeros fill in white; a mismatched word flashes **red** and a write head above the data record lifts away.
8. **The boot program hangs on "JMP 1" until the disk overwrites it.** The PROM builds the disk command block at locations 1–12, inside the page being loaded, and the emulator spins at location 1. Data fills downward from 400₈, and the last word replaces the loop instruction (HWM79 §3.4, §6.0 trick; µcode L604–623; the self-loop is my inference).
   *Animate:* a tall memory column with a **blue** circling arrow at address 1; words rain from the top; the final word lands on address 1 and the arrow breaks free into the new code.
9. **Your fingers are the disk address.** At reset the PROM reads keyboard word 177034 and uses the pressed keys, as 16 bits, as the boot disk address. BS alone switches to the network (HWM79 §3.4, Fig. 6).
   *Animate:* the top-left keys (5 4 6 E 7 D U V 0 K − P / \ LF BS) light up and their bits fly into a 16-bit address split as sector | cylinder | head | disk; BS flashes **red** and the view cuts to a coax cable.
10. **Breath of Life: a packet addressed to "377", type "602", executed from word 3.** Servers emit one about every 5 s; the Alto's PROM just listens (BootProto; µcode L630–649).
    *Animate:* a pulse travels down a vertical coax line; its header shows `377 | 602` in **yellow**; it pours into memory and the PC arrow jumps to 3.
11. **The mouse is 11 microinstructions in the refresh task.** Every 38.08 µs the refresh task reads a 4-bit code, one of 9 moves, and adds ±1 to X and Y at 424₈ and 425₈ (µcode L556–574; Thacker79 §3.5).
    *Animate:* a 3×3 grid of arrows with one cell lit per tick; X and Y counters beside it bump by one.
12. **The buttons are literally RED, YELLOW and BLUE.** Top/left = RED, middle = YELLOW, bottom/right = BLUE, as bits 13, 15 and 14 of word 177030 (HWM79 §5.2).
    *Animate:* a white mouse outline whose three buttons are the video's only three accent colours, each toggling one bit in a 16-bit word below.
13. **The keyboard is 8 chips and 64 wires, with no keycodes.** 74153 multiplexers select 16 of 64 key switches by two address bits; a pressed key reads 0 (KbdSch sheets 6 and 10; HWM79 §5.1).
    *Animate:* a 4×16 grid of dots, the whole keyboard state, with one row highlighted as the address bits count 0 to 3.
14. **Interrupts cost zero cycles until something happens.** Devices OR bits into NWW; the emulator tests NWW inside its instruction-fetch microinstruction: 0 cycles if nothing is pending, 36+6N to take one (µcode L692–694, L1246).
    *Animate:* device icons fire single **yellow** bits into a 16-bit register; a program counter ticks past; only when a bit lands does it detour through a vector table.
15. **The Ethernet can freeze the whole CPU for one clock.** When FIFO data is late, the interface stops the system clock for a cycle, and a design error sometimes freezes the *next* instruction instead (HWM79 §7.3 footnote; App. G: RDRAM unreliable during Ethernet activity).
    *Animate:* the global clock ladder stalls for one frame with a **red** outline, then resumes.

---

## 11. Summary table: hardware versus microcode, with cycle cost

| Device | In hardware | In microcode | Cycle cost (170 ns cycles) |
|---|---|---|---|
| **Disk** (Diablo 31; one board, 55–60 TTL; clock separation in the drive) | Shift register and one-word buffer, bit clock mux (drive clock or 3.33 MHz crystal), sync-bit detect (counter held at −1), sector-mark and word wakeups, 86 µs sector-late one-shot, word-late latch, cylinder lines and seek strobe, supply-OK write interlock | KSEC (task 4): status, interrupts, seal and sector-range checks, seek decision, DCB chaining. KWD (task 16): preamble and gap timing, sync write, record dispatch, DMA address and count, read/write/check, 0-wildcard, XOR checksum seeded with 521₈ | 7 (read) / 8 (write) / 9–11 (check) microinstructions per ~60-cycle word, i.e. 12–18%; Thacker79 says ≤20%. KSEC about 12 µs per 3.33 ms sector (~0.4%). |
| **Ethernet** (one board, ~70 TTL) | 16-word FIFO (4× 3101A), Manchester encode (3601 PROM state machine) and decode (RC edge detect + one-shot), carrier one-shot, deference, 16-bit CRC (9401), sync bit and word framing, collision flip-flop (collision sensed by the transceiver), host-address jumpers | One task (7), about 100 microinstructions: SIO command dispatch, DMA to and from memory, address filter (promiscuous, broadcast, host), backoff from R37 tick bits, 38 µs countdown, receive-under-transmit, status post, NWW interrupt | 5 microinstructions per 32-cycle word, i.e. **16%** while a packet streams; 13 cycles (2.21 µs) to reject a packet; about 4 per 38 µs backoff tick |
| **Keyboard** | 64 key switches → 8× 74153 muxes → 16 lines; address decode on the memory interface | None | 0 microcode; each program read is one ordinary memory-bus load |
| **Mouse / keyset** | Encoders → 4-bit ±1 motion code (bus source ←MOUSE); buttons and keyset as bits of 177030 | MRT samples every 38.08 µs; `TXn` + `M00` update X and Y at 424₈/425₈ | About 11 microinstructions per tick in which the mouse moved; 0 otherwise (the MRT's own refresh work belongs to the memory notes) |
| **Interrupts** | 16 wakeup lines, priority encoder; BLOCK handled by each device | NWW OR-in by device code; checked in the emulator's fetch microinstruction; vectors through INTVEC | 0 cycles if nothing pending; 18 if the channel is inactive; 36+6N to take one |
| **Boot** | Reset loads each task's micro-PC with its task number; SIO bit 0 soft reset via the Ethernet board | PROM emulator code: builds a DCB at location 1 or arms Ethernet receive for 377/602; the ordinary disk and Ethernet tasks move the data | Disk: one sector plus a possible seek (≤ one 40 ms revolution + seek). Ethernet: until the next Breath of Life (~5 s) |
