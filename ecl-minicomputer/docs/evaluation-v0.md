# Evaluation of draft 0

Draft 0 is complete as a starting point:

- **ISA:** [isa-v0.md](isa-v0.md).
- **Toolchain:** an assembler, an instruction simulator and an exact
  cycle model.
- **Benchmarks:** twelve programs checked against Python.
- **Hardware:** a chip-level netlist ([hardware-v0.md](hardware-v0.md))
  that runs all of them cycle for cycle as the model predicts.

This document says what draft 0 shows, what to change for draft 1, and
which decisions are Emily's.

## What draft 0 shows

| | Draft 0 |
|---|---|
| Cycle time (worst case, 75 °C) | 30.7 ns (32.6 MHz); 27.6 ns (36.2 MHz) with ECLinPS registers |
| Packages | 710, plus a multiply/divide unit still to design |
| Power | about 300 W worst case |
| Parts | about $3,300 in parts that can be bought, plus 30 broker-only ALU chips |
| CPI over 12 programs | 1.54 (1.02–1.04 for SHA-256, AES, CRC, sieve and sort; 3.0 for Mandelbrot) |

Per-program numbers are in [performance-v0.md](performance-v0.md), and
the programmers' notes in [notes-v0/](notes-v0).

### 1. The multiplier is the biggest lever by far

The 18-cycle multiply is an assumption: a radix-4 iterative unit, the
cheapest that seemed reasonable. It costs more than everything else
together.

| Multiply | Geometric mean | mandel | matmul | fft | pi | bignum |
|---|---:|---:|---:|---:|---:|---:|
| 18 cycles (draft 0) | 0 | 0 | 0 | 0 | 0 | 0 |
| 8 cycles | −18.5% | −50% | −51% | −36% | −28% | −23% |
| 4 cycles, not pipelined | **−21.8%** | −63% | −51% | −37% | −36% | −28% |
| 3 cycles, pipelined (one a cycle) | −22.1% | −63% | −51% | −37% | −38% | −29% |

**A non-pipelined 4-cycle multiplier gets almost all of the gain.** A
fully pipelined one adds 0.3%.

- **What it takes:** a 4-cycle 32 × 32 multiply retires 8 multiplier
  bits a cycle: four radix-4 Booth digits, a carry-save tree and the
  existing 64-bit HI:LO accumulation.
- **Rough size:** about 100–150 packages. That's the largest single
  addition worth making.
- **Parts:** the 100K family had multiplier building blocks (the F100183
  recode multiplier). Whether they can be bought hasn't been checked yet.

### 2. Branches cost less than expected, except in recursive code

| Change | Geometric mean | Biggest gains |
|---|---:|---|
| Perfect prediction and a branch target buffer | −4.6% | fib −17.8%, queens −17.0% |
| Redirect from EX (2 bubbles instead of 3) | −1.4% | fib −10.7%, queens −4.5% |
| No prediction at all | +2.4% | crc32, sieve, sort about +6% |

- **The simple backward-taken rule** gets most of the benefit of
  prediction for loop code.
- **What's left:**
  - the bubble on every taken loop branch: a target buffer, −3% on the
    loop programs;
  - returns in recursive code: a return-address stack, about −8% on fib.
- **The registered redirect** costs 1.4% in cycles. Redirecting straight
  from EX would put the comparators, the next-PC select and its mux in
  one path, about 3 ns (10%) longer than the cycle by my estimate. Keep
  it.

### 3. Splitting memory access over two stages is almost free

One more load-use bubble (`p6-mem2`) costs 1.1% on average (sort 6%,
crc32 4%).

- **Gain:** the load path, 30.35 ns, is the second-longest path. A
  two-stage MEM takes it off the critical list. The load alignment could
  then move into the second stage, and so could the slow translators.
- **Combined:** with a 4-cycle multiplier it's still −20.6% in cycles
  (−23.0% with a target buffer as well).

### 4. Late SLT costs nothing

Making SLT results arrive after MEM, like loads (`p5-sltfast` against
`p5`), changes no program by more than 0.1%. The programs' authors
scheduled around it without being asked. Keep it: it takes the comparator
chain out of the forwarding path.

### 5. The ISA is about right; a few instructions would pay

From the two benchmark write-ups:

| Instruction | Saves | Cost in hardware |
|---|---|---|
| Rotate-and-XOR, `d = s ^ ror(t, n)` | sha256 −17% | the shifter and ALU in series in EX: too slow as it stands; an XOR stage after the shifter |
| Scaled bit-field extract for table indexes, `d = ((s >> p) & mask) << 2` | aes −18%, crc32 −8% | the funnel shifter plus a mask generator |
| Scaled indexed load, `lw d, [s + 4t]` | aes −9%, crc32 −4% | a shifted B input to the address adder |
| Store with base update, `swu x, [p + 4]` | sort −6%, fft −4% | fits: two reads, one write |
| Branch on compare with immediate | fib −7.5% | a short immediate in place of `t`; the comparators already see the immediate path |
| Byte swap, isolate lowest set bit, count leading zeros | 1–5% each | small |

None of these is urgent beside the multiplier. The scaled extract and
the store with base update are the cheapest per percent.

### 6. The hardware is balanced, but big and power-hungry

- **Size:** 710 packages and 300 W, at the top of the design notes'
  estimate (500–800 packages, 150–300 W). That's for an integer-only
  machine.
- **Where it goes:** a third of the packages are multiplexers. The
  barrel shifter alone is 94 packages, more than the decoder or the
  register file.
- **Timing:** the longest paths are within 2 ns of each other. They are
  the register-file read, the load, the branch compare, the branch-target
  adder, decode and the exception logic. No single fix gets much (see
  [hardware-v0.md](hardware-v0.md#where-the-time-goes)).
- **40 MHz** would take ECLinPS registers, the register file read before
  the write, a two-stage MEM and a faster branch-target adder together.

### 7. Parts are the real risk

See [parts.md](parts.md).

- **ALU:** the 10H181 ALU and 10H179 look-ahead are broker-only. So were
  the 10H162 decoders, which are now built from gates.
- **Price:** 44 packages are of types that only come at about $30 each.
- **Speed upgrade:** ECLinPS registers with 10H levels (MC10E151) are
  about $36 each, so 96 of them cost $3,500. The cheap MC100E151 has
  100K levels and needs care where it drives 10H inputs.

## Proposals for draft 1

In order of value:

1. **Design the multiply/divide unit: 4 cycles for a multiply,** radix-4
   Booth with four digits a cycle. Divide can stay slow (34 cycles); the
   programs that divide use reciprocals.
2. **Two-stage memory access (`p6`),** with load alignment in the second
   stage. Retime around it with ECLinPS registers on the critical paths
   only (the memory and register-file paths), not everywhere. That should
   reach about 25–27 ns.
3. **Read the register file first, write it second,** with a third
   forwarding source (from the instruction that just left WB). This takes
   the 16 ns write window out of the read path.
4. **Take the 10H181 out of the PC incrementer and the target adder**
   (an incrementer, and a carry-select adder for the 16-bit offset). That
   leaves 10 broker parts, for the ALU only, and shortens the target path.
5. **Two or three instructions:** store with base update, scaled
   bit-field extract, branch on compare with immediate.
6. **A small branch target buffer and a return-address stack,** if
   packages allow: −3% to −8% on the programs that branch a lot.

## Questions for Emily

1. **The ALU chips.** Choose one:
   - broker 10H181/10H179s, tested on arrival;
   - Fairchild F100181/F100179s (buyable, but 100K levels);
   - or an ALU built from gates (bigger and slower).
2. **Size and power.** Is a machine of about 850 packages (with a real
   multiplier) and 300 W or more what you want to build? If not, the shifter and the
   forwarding muxes are where to save:
   - a 1-bit-per-level shifter instead of a barrel shifter;
   - fewer forwarding paths with more interlocks.
3. **ECLinPS.** Should draft 1 use MC10E-series parts where they buy the
   most speed? That costs about $36 a register chip. The cheap MC100E
   parts would need differential or level-matched connections.
4. **The main bus.** The memories need a host path, to load programs and
   data and read results. Can the host see the ECL machine's memories
   directly on its bus (dual-ported through the SRAMs' TTL side), or only
   through the processor? What width, speed and handshake does the bus
   have?
5. **Vectors and registers (you said keep these open).** The register
   file uses 32 of the 10E422's 256 words.
   - The other 224 could hold eight banks of 32 registers, for fast
     context switching.
   - Or Cray-style vector registers at no extra RAM cost: for example
     seven vector registers of 32 elements.
   - Together with a 4-cycle multiplier, that becomes interesting for
     the matmul/fft/mandel kind of code.
