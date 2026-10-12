# Design notes, round 0

The brief:

1. Optimised for raw number-crunching performance.
2. Probably a load/store RISC.
3. No microcode.

These notes come before any draft. They cover what ECL changes compared with
the [TTL machine](../../ttl-minicomputer), what the brief pushes towards,
rough sizes, a strawman to argue with, and the questions that decide between
the options. Numbers are rough unless a source is given.

## 1. What ECL changes

### Speed

| | 74LS / 74HCT (the TTL machine) | MC10H ECL |
|---|---|---|
| Gate delay | ~8–20 ns | ~1 ns |
| 4-bit ALU, operand to result | 74LS181: ~25–62 ns ([datasheet](https://ece-classes.usc.edu/ee459/library/datasheets/DM74LS181.pdf)) | MC10H181: ~1.5–4 ns, depending on the pin pair and temperature ([datasheet](https://www.nyang-tech.com/datasheet/1494245025/onsemi/MC10H181L.pdf)) |
| Whole machine | draft 1b: 3 MHz worst case | 25–50 MHz looks plausible (below) |

At these speeds **wires cost as much as gates**. A signal on FR4 covers about
15 cm per ns, so a trace across a big board is a gate delay. The timing model
has to include wiring, and placement becomes part of the design. The Cray-1
cut its wires to length to balance them.

### Power

ECL draws its current all the time, whether it switches or not.

- About 25 mW per 10H gate, and a few hundred mW per MSI chip.
- About 20–30 mW more for every terminated line.
- So 0.3–0.5 W per chip on average. 500 chips is 150–250 W, which means
  30–50 A at −5.2 V plus a −2 V termination supply, and fans.

The chip budget is also a power and cooling budget.

### Boards

- Any line longer than a few cm is a transmission line and needs
  terminating, either 50 Ω to −2 V or series termination for point-to-point
  lines.
- That means multilayer boards with ground planes and controlled impedance.
  Breadboards and ordinary wire-wrap are out.
- Between boards: twisted pair or ribbon cable with differential drivers.

### Logic style

- Every gate has true and complement outputs, so inversion is free.
- Outputs can be tied together (wired-OR), so wide ORs, AND-OR multiplexers
  and buses come cheap.
- Parts are smaller than in the 7400 world. The biggest 10H functions are a
  4-bit ALU (10H181) with its lookahead (10H179), a 16 × 4 register file
  (10H145), 8-input multiplexers and hex flip-flops. A 64-bit register is 11
  chips.

### Parts

| Family | What it offers | Status |
|---|---|---|
| MC10H (Motorola, then ON) | gates, flip-flops, multiplexers, 4-bit ALU and lookahead, 16 × 4 register file, counters, TTL translators | Mostly obsolete. Plentiful as new-old stock; a few are still listed as active |
| F100K (Fairchild, National) | wider functions: 6-bit adder (100180), ALU (100181), 8-bit shift matrix (100158), 16-input multiplexer (100164), 256 × 4 RAM (100422), and a recoder (100183) and Wallace-tree adder (100182) made for multipliers | Obsolete, rarer. Rochester Electronics reissues some |
| ECL RAM (10422, 10474, 100474, 100494, …) | register files, small fast memories | Obsolete and scarce |
| ECLinPS Lite / EP | single gates, flip-flops, multiplexers, translators | Partly still made, but for clock distribution. A CPU from these would be thousands of chips |
| Fast CMOS SRAM, 8–10 ns asynchronous | main memory | In production; needs translators to and from ECL, a few ns each way |

Fairchild's [100K data book](https://bitsavers.trailing-edge.com/components/fairchild/_dataBooks/1982_Fairchild_100K_ECL_Data_Book.pdf)
quotes 24.3 ns for a 16 × 16 multiply built from the 100183 and 100182.

**Consequence:** a realistic machine uses new-old-stock 10H (and maybe 100K)
logic with modern SRAM for memory. That gives it something the Cray-1 didn't
have: **memory as fast as the logic needs.** A 10 ns SRAM plus translation
in and out fits a 25–30 ns clock, so main memory can be plain SRAM with one
access per clock. No DRAM, no caches and no bank interleaving.

## 2. What the brief pushes towards

- **A pipeline at about one instruction per clock.** Without microcode, every
  instruction moves through fixed stages. Long operations (multiply, floating
  point) go to separate functional units that keep working while issue
  carries on, as in the CDC 6600, CDC 7600 and Cray-1. A busy bit per
  register (a scoreboard) stalls issue when an instruction needs a result
  that isn't ready.
- **Fixed 32-bit instructions with three operands.** The TTL notes already
  said fixed 32-bit instructions would suit a pipelined implementation.
  Decoding is then a few gates per field.
- **Separate instruction and data memories** (Harvard), so a fetch and a load
  or store can both happen in every clock.
- **Floating point in hardware**, if number crunching means floating point
  (question 1).
- **Loop overhead sets the throughput.** Take daxpy,
  $y_i \leftarrow a x_i + y_i$. Each element needs two loads, a multiply, an
  add and a store, plus pointer steps, a count and a branch.
  - A machine issuing one instruction per clock needs at least 5 clocks per
    element even when fully unrolled. That's at most 0.4 floating-point
    operations (FLOPs) per clock.
  - With vector registers (Cray-1), it's a handful of vector instructions per
    64 elements. daxpy is then limited by the single memory port to 3 clocks
    per element (0.67 FLOPs per clock). Kernels that reuse registers, like
    matrix multiply, get close to 2 FLOPs per clock with the multiply
    chained into the add.

| Model | Precedent | FLOPs per clock (rough) | Extra hardware | Programming |
|---|---|---:|---|---|
| Scalar pipeline, separate FP units | CDC 7600; MIPS R3000 with R3010 | 0.3–0.5 | baseline | easy; interlocks keep it correct |
| Plus vector registers | Cray-1, Convex C1 | 0.7–2 | vector register RAM, a length counter, chaining control: ~150–300 chips | vector loops; scalar code unchanged |
| VLIW / exposed pipeline | FPS AP-120B and FPS-164, Multiflow Trace | 1–2 | wide instruction memory, more register ports | hard by hand (software pipelining); wants a scheduler in the assembler |

Superscalar or out-of-order issue isn't on the list: it costs too many chips
without microcode to hide the complexity.

## 3. Rough sizes

These are counted from parts, not from a design, using 10H-class chips.

| Block | Chips |
|---|---:|
| 64-bit register (hex D flip-flops) | 11 |
| 32-bit integer ALU (8 × 10H181, 3 × 10H179) | ~11 |
| 64-bit integer ALU (16 × 10H181, 5 × 10H179) | ~21 |
| 64-bit barrel shifter, three levels of 4:1 multiplexers | ~96 (~40 with F100K shift matrices) |
| 16 × 64-bit registers, two read ports (two copies of 16 × 10H145) | 32 |
| 64-bit FP adder, pipelined: two shifters, adder, leading-zero count, rounding, pipeline registers | 200–300 |
| 53 × 53 FP multiplier, iterative (8–16 multiplier bits per clock, 4–7 clocks) | 50–100 |
| 53 × 53 FP multiplier, fully pipelined (one per clock) | 250+ |
| **Whole scalar machine** with a pipelined FP adder and an iterative multiplier | **500–800 (≈ 150–300 W)** |

Most of the chips go on shifters and pipeline registers, not on adders.
Single precision would roughly halve the floating-point units.

## 4. A strawman

This isn't a proposal yet, just something concrete to argue with.

- Load/store, fixed 32-bit instructions, three operands.
- **64-bit data registers** shared by integer and floating point, like the
  CDC 6600's X and the Cray-1's S registers.
- **32-bit address registers** with their own adder, for pointers, loop
  counts and branches. This is like the CDC 6600's A and B registers and the
  Cray-1's A registers. It's also the D/A split proposed for the TTL machine
  ([proposals, section 11](../../ttl-minicomputer/docs/proposals.md#11-address-registers-with-hidden-state)),
  here for a different reason: address arithmetic stays 32 bits wide and
  runs alongside the 64-bit units.
- Byte addresses, but loads and stores of aligned 64-bit (and maybe 32-bit)
  words only, with byte extract and insert instructions (Alpha style).
- In-order issue, one instruction per clock, scoreboard interlocks.
  Functional units: address, integer, shift, FP add (pipelined),
  FP multiply, load/store, branch.
- **IEEE 754 binary64 format**, round to nearest even only, denormals
  flushed to zero, sticky flags instead of traps. Division by a reciprocal
  approximation plus Newton steps, as on the Cray-1.
- Separate instruction and data SRAM, 64 bits wide, one access each per
  clock.
- Clock target 25–40 MHz worst case.
- Room in the encoding for vector registers later.

## 5. What carries over from the TTL machine

- **The way of working:**
  1. Specify an ISA.
  2. Write an assembler and an instruction-level simulator.
  3. Write a suite of programs checked against Python reference outputs.
  4. Cost them with a timing model.
  5. Build a chip-level netlist with static timing analysis.
- **Tooling:** the TTL project's assembler core, simulator harness, netlist
  language and timing analysis are a good starting point. They get copied
  and adapted, since projects in this repo don't import from each other. The
  chip library and timing analysis will need ECL parts and wire delays.
- **ISA lessons that still apply:**
  - auto-increment pays in pointer loops;
  - 16 registers were never short in hand-written code;
  - two-operand shifts cost `MOV`s, which three operands fix;
  - `.align` should pad with `NOP`s.

## 6. Open questions

1. **What does "number crunching" mean?**
   - Floating point: ray tracing, matrix multiply, FFT, n-body, Mandelbrot.
   - Integer: SHA-256, CRC, sieves, bignum.
   - Which benchmarks should define "fast"? Is single precision interesting,
     or double only?
   - My lean: 64-bit floating point first-class, a benchmark suite mostly
     floating point plus a few integer programs.
2. **Build budget.** Is the machine meant to be built, or is it a design on
   paper and in simulation for now? Roughly how many chips and watts? How
   hard should the clock be pushed (25 MHz on relaxed boards, or 50 MHz and
   up with deeper pipelines and careful layout)?
3. **Parts policy.**
   - (a) All period ECL, including ECL RAM.
   - (b) New-old-stock 10H/100K logic, with modern fast SRAM behind
     translators for memory (and maybe register files).
   - (c) Only parts in production today.
   - Are 100K's bigger functions (shift matrix, multiplier set) fair game
     alongside 10H?
   - My lean: (b), with 100K allowed.
4. **Standalone or attached?**
   - (a) A standalone minicomputer with interrupts, console, storage and OS
     ambitions.
   - (b) An attached processor whose host (a microcontroller, a PC, or even
     the TTL minicomputer) loads programs and data, starts it and does all
     the I/O, like an FPS array processor or a Cray's front end.
   - My lean: (b) first. No interrupts, no MMU, exceptions just halt, which
     keeps the ECL budget for arithmetic.
5. **How much parallelism?**
   - (a) A scalar pipeline.
   - (b) Plus vector registers, Cray-1 style.
   - (c) VLIW with an exposed pipeline.
   - My lean: (b), with the scalar machine built first and the ISA leaving
     room for vectors.
6. **Registers and words.**
   - (a) Unified 64-bit general registers.
   - (b) A CDC/Cray split: 32-bit address registers and 64-bit data
     registers.
   - (c) A 32-bit integer machine with separate 64-bit FP registers (MIPS
     plus FPU).
   - My lean: (b).

## 7. Answers

Emily's answers, which draft 0 follows:

1. **Integer first, 32 bits.** Floating point can come later.
2. **It will actually be built.** Push the clock hard.
3. **Any ECL that can reasonably be bought,** with the details still to
   check ([parts.md](parts.md) does that).
4. **(b), an attached processor.** It has its own local memory for code
   and data, and a TTL-level, relatively slow main bus to the rest of the
   system. The bus details are still to come.
5. **Vectors: maybe.** Keep the option open.
6. **Register organisation: open.**

That makes draft 0 a 32-bit integer load/store machine with 32
registers, local instruction and data memories, and a window onto the
main bus. Opcodes are left free for vectors. The
[evaluation](evaluation-v0.md) has the next round of questions.
