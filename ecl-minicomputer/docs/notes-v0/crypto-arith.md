# Crypto and arithmetic notes, draft 0

Six programs written for ISA draft 0 as an assembly programmer would write
them for speed, to measure the machine:

| Program | What it does |
|---|---|
| [`sha256`](../../programs/sha256.s) | SHA-256 of `""`, `"abc"`, the 56-byte FIPS message and 16 KB of LCG output |
| [`crc32`](../../programs/crc32.s) | zlib CRC-32 of `"123456789"` and of a 256 KB LCG buffer, tables built at run time |
| [`aes`](../../programs/aes.s) | AES-128: FIPS-197 C.1, then CTR mode over 16 KB (SP 800-38A key and counter) with a checksum |
| [`queens`](../../programs/queens.s) | N-queens solution counts for N = 1..11, bitmask backtracking |
| [`pi`](../../programs/pi.s) | 500 decimals of π by Machin's formula on 56 32-bit limbs |
| [`bignum`](../../programs/bignum.s) | 1000! and Fibonacci(10000): digit count, first and last 50 digits |

Each has an independent Python reference in `programs/ref/` (hashlib, zlib,
`cryptography` when installed, `math.factorial`, a Gauss–Legendre AGM for
π) and `python3 -m emc test NAME` passes for all six. The test data come
from the LCG x = 1664525 x + 1013904223 (mod 2³²), seed 1, words x1, x2, …
stored little-endian. The CTR checksum is `chk = rotl(chk, 5) + w` over
the ciphertext's little-endian words.

## Which pipeline model

The brief describes the pipeline as: ALU results back to back, one
load-use bubble, an **8-cycle** non-pipelined multiply, a 34-cycle divide,
BTFN prediction, 1 bubble for a predicted-taken branch or J/JAL, **2** for
a mispredict or JALR, and 20 cycles per I/O access. The column *brief*
uses exactly that model, as an explicit `Config` (`mul_lat=8,
mul_issue=8, resolve="EX", slt_late=False`).

While I worked, `emc/pipeline.py` changed in the working tree (another
writer's hardware work). The default `p5` now has an **18-cycle**
multiply, **3**-bubble mispredicts and JALR, SLT results that arrive after
MEM, and bus freezes. The *p5 now* column uses that model. `--config
p5-mul8` is not the brief's model either. The code was written for the
brief, then checked on p5 now; the two changes made for p5 now (the LCG
fill and the SLT scheduling) cost little or nothing on the brief.

*Added afterwards:* the brief's model is now the `brief` preset
(`python3 -m emc run NAME --config brief --stats`).

## Results

| Program | Instructions | Cycles (brief) | CPI | Cycles (p5 now) | Main losses (brief) |
|---|---:|---:|---:|---:|---|
| sha256 | 687,892 | 700,968 | 1.019 | 702,046 (+0.2%) | branch 8,121; printing 4,920 |
| crc32 | 1,571,655 | 1,626,883 | 1.035 | 1,626,966 (+0.0%) | branch 54,580 (`dbnz` bubbles) |
| aes | 678,534 | 692,309 | 1.020 | 694,701 (+0.3%) | branch 11,141 |
| queens | 2,081,941 | 2,399,109 | 1.152 | 2,511,741 (+4.7%) | branch 315,742 (13%, 112,220 mispredicts) |
| pi | 777,135 | 1,042,220 | 1.341 | 1,448,697 (+39%) | muldiv 206,080 (20%), branch 47,850 |
| bignum | 3,726,076 | 4,188,501 | 1.124 | 5,459,144 (+30%) | muldiv 307,551 (7%), branch 144,471 |

The table-driven programs (sha256, crc32, aes) run at CPI 1.02–1.04: no
stalls in the kernels, only loop-branch bubbles. pi and bignum are
multiplier-bound, so the 18-cycle multiply costs them 30–39%.

## Per program

### sha256: 2,472 cycles a block (38.6 a byte)

- **Kernel:** `sha_block` takes 2,456 instructions and 2,472 cycles per
  64-byte block, 260 blocks in all. It is 92% of the program; the 16 KB
  LCG fill is 47 K cycles.
  - A round is 25 instructions with no stalls: Σ1 5, Ch 3, Σ0 5, Maj 3,
    seven adds, and loads of W and K.
  - The message schedule is 14 instructions a word, with no loads.
  - Loading and byte-swapping a block is 7 instructions a word.
- **What mattered:**
  - **Register renaming over an 8-round unroll.** Round j sees a..h
    rotated by j, so no moves are needed. Shifting the variables instead
    would add 8 `mov`s a round: +512 instructions a block (+21%).
  - **The schedule in a 16-register window.** The register holding
    W[t−16] becomes W[t], so the 16-step unrolled body needs no loads. The
    version with loads would be 17 instructions a word: +144 a block (+6%).
  - **Maj(a,b,c) = b ^ ((a^b) & (b^c)).** This round's a^b is the next
    round's b^c, so Maj is 3 instructions instead of 4 (+64 a block).
  - **One pointer for W and K.** K follows W in memory, so the round loads
    use `[p]` and `[p + 256]`.
- **Mix:** xor 27%, add 24%, rori 24%. Rotates and xors are
  three-quarters of the work, which is the case for the rotate-xor wish
  below.

### crc32: 12.75 cycles a word (3.19 a byte)

- **Kernel:** 65,536 words in 835,661 cycles. Each word is 12
  instructions with no stalls, plus `dbnz` overhead for 4 words a pass.
  - Table build (20 KB): 36 K cycles.
  - LCG fill of the 256 KB: 754 K cycles, 11.5 a word, nearly half the
    program.
- **Method:** slicing over three tables of 11, 11 and 10 bits (2048 +
  2048 + 1024 entries). F = f³² is linear over GF(2), so each table is
  built by doubling from basis values, one xor per entry.

  | Method | Instructions a word | Notes |
  |---|---:|---|
  | Byte-at-a-time (Sarwate) | ~24 | |
  | Slicing-by-4 or -8, byte tables | 17 | each index is a shift and a mask |
  | Two 16-bit tables | 9 | 512 KB of tables, ~450 K cycles to build: more than it saves on 256 KB |
  | **Three tables, rotated fields** | **12** | used |
- **What mattered:**
  - **Choosing the table fields.** `LWX` wants the index × 4. The fields
    are bits 2–12 (`andi c, 0x1FFC`, one instruction), bits 13–23 (two),
    and bits 24–31 + 0–1 via `rori c, 22; andi 0xFFC` (two). That makes 5
    index instructions instead of 6, and 13 → 12 instructions a word:
    901 K → 836 K cycles (−7%).
  - **A byte step for free.** The byte step for the tail reuses T2:
    f⁸(v) = F(v << 24) = T2[v].
  - **Hybrid LCG fill.** The multiplier makes every other word two steps
    ahead (x[n+2] = a²x[n] + c(a+1)) while shifts and adds make the word
    in between (a = 1664525 = 25·139·479) in the multiply's shadow.
    - On p5 now: 19 → 11.5 cycles a word, which took crc32 from 2.12 M to
      1.63 M cycles.
    - On the brief: a multiplier-only fill with two interleaved chains
      was 9 cycles a word (590 K), so the hybrid costs 164 K (+10%) there.

### aes: 614 cycles a CTR block (38.4 a byte)

- **Kernel:** about 602 instructions a block and CPI 1.01.
  - `aes_rounds3` (rounds 3–10) is 576 K cycles; the per-block CTR work
    is 53 K.
  - A full round is 68 instructions with no stalls. Each column is 8
    instructions to extract and scale the four bytes, 4 `lwx`, the key
    load and 4 xors.
  - The tables (S-box via exp/log over GF(2⁸), Te0–Te3) take 15 K cycles.
- **What mattered:**
  - **Counter-mode caching.** Within a run of 256 blocks only byte 15 of
    the counter block changes.
    - Round 1 then changes only in column 0: t0 = P0 ^ Te3[byte].
    - Every round-2 column takes exactly one byte of t0.
    - So rounds 0–2 cost 21 instructions instead of 144, after a
      once-per-run setup (5 runs in 1024 blocks).
    - Per block: 733 → 602 instructions (−18%).
  - **Four Te tables instead of one plus rotates.** One table would cost
    +12 instructions a round (~+15%).

### queens: 2.40 M cycles; 101,902 candidates tried, 71,124 descents

- **Where the time goes:**
  - 70% of the candidates tried lead to a descent; 30% are dead ends
    rejected before a push.
  - Branches cost 13% on the brief (112,220 mispredicts) and 17% on p5
    now, with its 3-bubble mispredicts.
  - The data-dependent branches are 50/50 or worse: "dead end?" is taken
    30% of the time, "last candidate in the row?" 56%. BTFN can't help
    either.
  - A perfect predictor would save 17% (`p5-perfect`).
- **Built in from the start:**
  - Mirror symmetry: first-row queens only in the left half, counted
    twice, plus the middle column once. That halves the work.
  - The row before the last tests whether the last row has a square
    instead of descending.
- **Passes (brief model):**

  | Version | Instructions | Cycles |
  |---|---:|---:|
  | Push (candidates, c, l, r) for every level, pop exhausted rows | 2.75 M | 3.14 M |
  | Test the child before pushing; push a row only if it still has candidates | 2.35 M | 2.69 M (−14%) |
  | Two alternating register sets (no moves to enter the child) | 2.08 M | 2.40 M (−11%) |

  In the second version, every pop has work to do, and 61 K useless pops
  and 31 K dead-end push/pop pairs are gone.
- **What didn't work:** rebuilding c, l, r on backtrack instead of saving
  them (c &= ~b, l = (l >> 1) & ~b, r = (r << 1) & ~b). r loses a bit off
  the bottom at each level, the losses add up over several levels, and the
  counts come out wrong (43 for N = 7).

### pi: 54 cycles a limb on the brief, 81 on p5 now

- **Algorithm:** π = 16 atan(1/5) − 4 atan(1/239). Each term k divides
  the power P twice: T = P / (x²(2k+1)) and P = P / x². That is 13,783
  limb steps for 492 terms after the first of each series.
- **Division:** a limb of a long division is 64/32 bits, which `DIVU`
  can't do. It uses Möller–Granlund 2-by-1 division with a precomputed
  reciprocal: 2 `MULTU` and about 15 ALU ops. The divisor is normalised
  (d << s) and the dividend is shifted on the fly. The reciprocal for
  each new divisor comes from 2–7 `DIVU`s (`recip`, 100 K cycles in all).
- **What mattered:**
  - **Interleaving the two divisions in one pass.** They read the same
    limbs and their chains are independent, so one chain's multiplies fill
    the other's waits.

    | Model | Single chain (`div1`), 2 limbs | Fused pass | Saving |
    |---|---:|---:|---:|
    | brief | 68 cycles | 54.3 | −20% |
    | p5 now | 108 cycles | 80.6 | −25% |
  - **Reciprocal instead of `DIVU`.** `DIVU` on 16-bit halves would be 2 ×
    34 cycles plus about 6 instructions, ~75 a limb a division. That is
    ~150 a limb against 54 (brief) or 81 (p5 now).
- **Losses:**
  - p5 now: muldiv 624 K (43%); four 18-cycle multiplies a limb are
    72 cycles.
  - brief: 206 K (20%).
  - `addpass` (summing a term with `ADDS`/`ADDC`, bottom-up) is 8.5
    cycles a limb, 8–11% of the program.
  - Printing (×10⁹ passes) is 45–76 K.

### bignum: quadadd 2.14 M, to_dec 1.62 M (brief) / 2.51 M (p5 now), fact 0.38 M / 0.73 M

- **Fibonacci(10000): 5.67 cycles a limb, 378,048 limb steps.**
  - F(n+3) = 4F(n) + F(n−3), so a_k = F(3k+1) needs only
    a_k+1 = 4a_k + a_k−1.
  - 4a_k is one `FSR` per limb, using the top bits of the limb below, so
    each pass is a single `ADDC` chain doing three Fibonacci steps: 3,332
    passes instead of 9,999.
  - A limb is load, load, `fsr`, `addc`, store, unrolled ×8.
  - The plain a += b; b += a loop would be ~1.12 M limb steps at ~4.5
    cycles, ~5.0 M cycles. The FSR form is 2.14 M (−58%).
- **1000!: 33,319 limb multiplies.**
  - Consecutive factors are packed into one 32-bit multiplier (about 3
    per pass near 1000).
  - Only the odd part of each factor is multiplied in, and the 994 powers
    of two are one shift at the end. That cut limb multiplies from 40,367
    to 33,319 and cycles on p5 now from 841 K to 727 K (−14%).
  - The loop starts the next limb's `MULTU` before adding the current
    carry, so it runs at the multiplier's pace: 21.8 cycles a limb on p5
    now, 11.4 on the brief.
- **Decimal conversion (`to_dec`): 63,944 limb steps.**
  - It repeatedly divides by 10⁹ with the same reciprocal division: the
    divisor is 4·10⁹, normalised, and `FSR` shifts the dividend by 2 on
    the fly.
  - **Two passes interleaved:** pass B divides pass A's quotient, two
    limbs behind it. This took p5 now from 3.45 M to 2.51 M cycles (−27%)
    and per limb step from 54 → 39 cycles (p5 now) and 33 → 25 (brief).
  - The conversion now costs more than computing 1000! itself.

## What was pleasant

- **FSR.**
  - It normalises a dividend on the fly in division loops.
  - It does the ×4 in the Fibonacci identity in one instruction.
  - Without it, `to_dec` and `quadadd` would each need 2 more
    instructions a limb.
- **`C` touched only by `ADDS`/`SUBS`/`ADDC`/`SUBC`.** Carry chains run
  straight through `lw`, `sw`, `addi` and `dbnz`, so unrolled multi-limb
  loops need no care at all.
- **31 registers.**
  - sha256 keeps a 16-word schedule window plus temporaries.
  - aes keeps 4 tables, 8 state words and the CTR state.
  - Two interleaved division chains need about 24 registers.
  - queens keeps two complete board states.
  - Nothing spilled in a hot loop.
- **`DBNZ`, `ANDN`, `RORI` and `LWX`.** They are each used in nearly
  every kernel: `ANDN` in Ch, the byte-swap masks and the queens
  candidates; `LWX` for every table lookup.
- **A multiply unit that runs on its own.** With interlocked `HI`/`LO`,
  independent work fills its shadow without any hazard bookkeeping.
  Software-pipelining a carry or remainder chain against the multiplier is
  easy.

## What was awkward

- **The multiplier is the bottleneck of every multi-precision program.**
  - It isn't pipelined.
  - Its result has to be read (`MFLO`, `MFHI`) before the next multiply
    overwrites it.
  - A 32×32 limb product therefore costs a full multiply period plus two
    reads.
  - Waiting for it costs bignum 7% (brief) to 30% (p5 now) of its cycles
    and pi 20% to 43%. The LCG data generation needed a shift-add trick.
- **No 64/32 divide.** `DIVU` is 32/32 and takes 34 cycles, so every
  long division uses reciprocal multiplication with normalisation. Even
  computing the reciprocal needs several `DIVU`s.
- **Table indexes are expensive.** `LWX` takes a byte offset, so
  "byte k of x, times 4" is 2 instructions: 8 of the 17 instructions in
  an AES column, 5 of the 12 in a CRC word.
- **No byte swap.** It is 5 instructions (two `rori`, `andn`, `and`, `or`,
  plus a mask register) for every big-endian word: SHA-256 input and the
  AES counter.
- **Only one carry flag.** Two `ADDC` chains can't be interleaved, which
  would have allowed two Fibonacci steps per pass. Saving and restoring
  `C` costs 4 instructions a limb.
- **SLT results arrive late on p5 now.** Each reciprocal-division step
  has an `sltu` feeding a mask, which needs a filler instruction or a
  `nop`.
- **No macros or `.rept` in the assembler.** The unrolled SHA-256 rounds
  and schedule and the AES rounds are generated by scripts
  (`programs/gen/sha256.py`, `programs/gen/aes.py`).

## Instructions and features I missed

Savings are in cycles on the brief model unless stated, from instruction
counts or from the `emc` presets.

| Wish | Where | Saving |
|---|---|---|
| **Rotate-xor**, `d = s ^ ror(t, n)` (R-format, n in `shamt`) | Σ0, Σ1, σ0, σ1 in SHA-256: 5 → 3 instructions each | −448 instructions a block, **−17% sha256** |
| **Bit-field extract, scaled for table lookup**, `d = ((s >> p) & (2^n − 1)) << 2` | AES column 8 → 4 index instructions; CRC word 5 → 3 | **−18% aes**, **−8% crc32** (−16% of the CRC kernel) |
| …or only a **scaled indexed load**, `LWX4 d, [s + 4t]` | AES column 8 → 6; CRC word 5 → 4 | −9% aes, −4% crc32 |
| **Faster multiply** (measured with presets, against p5 now's 18 cycles) | pi; bignum | 8 cycles: **−28% pi, −23% bignum**; 4 cycles: −36%, −28%; pipelined (3 cycles, issue every cycle): −38%, −29% |
| **Byte swap** | SHA-256 message words, AES counter | −2.4% sha256, −0.7% aes |
| **Isolate lowest set bit**, `d = s & −s` | every candidate in queens | −113 K instructions, −4.7% queens |
| **Branch redirect from EX** (p5 now → `p5-resolve-ex`) | queens | −4.5% queens (the others are below 0.4%) |
| **64/32 `DIVU`** (`HI:LO / s`, 34 cycles) | `to_dec`, pi's `recip` | at an 18-cycle multiply −8% of `to_dec` and −4% pi; at 8 cycles none: the reciprocal method is already faster |
| **Count leading zeros** | normalising each divisor in pi | about −1% pi |

Other measurements with the presets on p5 now:
- A second load-use bubble (`p6-mem2`) costs crc32 4% and pi 2%; the
  rest are within 0.5%.
- Forwarding SLT from EX (`p5-sltfast`) gains under 0.1%, because the
  code is already scheduled around it.

## Tool problems

1. **The pipeline model changed while I was working.** Uncommitted edits
   to `emc/pipeline.py` made the default `p5` an 18-cycle multiply with
   3-bubble redirects and late SLT. `run --stats` and `test --config p5`
   no longer show the brief's machine, and no preset does. The figures
   here are with an explicit `Config`. Branch offsets also became
   PC+4-relative in `isa.py`/`sim.py`; the assembler hides that.
2. **Labels that spell a register name are accepted where they are
   defined and fail where they are used,** with a misleading message (the
   names are case-insensitive, so `SP` is `sp`):
   ```
           .text
           la      r1, SP          ; error: la: operand 2 must be an expression
           halt
           .data
   SP:     .word   7               ; accepted (so is "r5:")
   ```
   The definition should be rejected with a clear message. *(Fixed
   afterwards: the assembler now rejects it.)*
3. The `--stats` routine breakdown counts instructions, not cycles, so
   it hides where a multiplier-bound program actually waits. I used a
   small per-instruction stall profiler built on `pipeline.Timing` instead.
