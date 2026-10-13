# Kernel notes, draft 0

Six number-crunching programs written for ISA draft 0 as an assembly
programmer would write them for speed, to measure the machine:

| Program | What it does |
|---|---|
| [`fib`](../../programs/fib.s) | naive doubly recursive fib(n), n = 0..24: 392,809 real calls |
| [`sieve`](../../programs/sieve.s) | primes below 1,000,000: count, sum mod 2³², largest |
| [`sort`](../../programs/sort.s) | 20,000 LCG words, LSD radix sort, order check, checksum |
| [`mandel`](../../programs/mandel.s) | 72 × 30 fixed-point (Q24) Mandelbrot set, up to 255 iterations |
| [`matmul`](../../programs/matmul.s) | C = A·B for 48 × 48 integer matrices |
| [`fft`](../../programs/fft.s) | 1024-point Q15 radix-2 FFT and inverse |

Each has an independent Python reference in `programs/ref/` that prints the
expected output (`programs/expected/`), and `python3 -m emc test NAME`
passes for all six.

## Which pipeline model

The brief I worked from describes the p5 pipeline as: ALU results forward
back to back, one load-use bubble, **8-cycle** non-pipelined multiply
(34-cycle divide), BTFN prediction, 1 bubble for a predicted-taken
branch or J/JAL, **2** for a mispredict or JALR, 20 cycles per I/O
access. The programs are tuned for that model, and the numbers below
called *brief* use it, spelled out as an explicit `Config` (mul 8,
resolve EX, `slt_late=False`) so that preset changes don't move it.

While I was working, `emc/pipeline.py` changed in the working tree (not
committed, another writer's hardware work): the default `p5` is now the
draft 0 hardware with an **18-cycle** multiply, branch and JALR
redirects after EX (**3** bubbles), SLT results after MEM and bus
freezes. `python3 -m emc run NAME --stats` therefore no longer shows the
brief's numbers. The *p5 now* column shows that model; `--config
p5-mul8` is not the brief's model either, since it inherits the 3-bubble
redirects and late SLT.

*Added afterwards:* the brief's model is now the `brief` preset, so
`python3 -m emc run NAME --config brief --stats` reproduces the *brief*
column, and the default `--stats` model is the *p5 now* column.

## Results

| Program | Instructions | Cycles (brief) | CPI | Cycles (p5 now) | Main losses (brief) |
|---|---:|---:|---:|---:|---|
| fib | 3,340,241 | 4,914,164 | 1.471 | 5,504,172 (+12%) | branch 1,572,585 (32%) |
| sieve | 1,240,446 | 1,285,708 | 1.036 | 1,288,244 (+0.2%) | branch 42,761 (3.3%) |
| sort | 963,782 | 997,146 | 1.035 | 997,512 (+0.0%) | branch 31,529 (3.2%) |
| mandel | 1,804,608 | 2,678,172 | 1.484 | 5,410,940 (+102%) | muldiv 822,320 (31%), bus 44,120 |
| matmul | 650,681 | 662,031 | 1.017 | 1,360,183 (+105%) | branch 9,242; bound by the multiplier (see below) |
| fft | 371,511 | 403,549 | 1.086 | 628,401 (+56%) | branch 15,877, muldiv 11,803 |

A CPI near 1 doesn't mean nothing is lost. In matmul and fft the
multiplier sets the pace, and the code is scheduled so that its shadows
are full of other work instead of stalls.

## Per program

### fib: 4.91 M cycles, 12.5 cycles a call

- **Where the time goes.** Every evaluation is a real call. Inner calls
  run 15 instructions and leaves run 2: `blt r1, r3, .leaf` and `ret`.
  Control transfers cost 1,572,585 cycles (32%):
  - each JAL: 1 bubble (393 K);
  - each `ret`: 2 bubbles (786 K);
  - each leaf: a mispredicted leaf test, 2 bubbles (393 K).
- **Leaf-test prediction.** About half the calls are leaves, so the
  static prediction is wrong for half of them either way. The test is a
  forward branch (predicted "inner call"):
  - predicting leaves (a backward branch) would cost 1 bubble on each
    leaf and 2 on each inner call, which is worse at 50/50;
  - splitting the call sites doesn't help: the first call is a leaf 38%
    of the time and the second 62%, both below the 67% break-even.
- **Biggest difference.** Testing `n < 2` with `blt` against a register
  that holds 2, instead of `slti` + `bnez`, saved one instruction a call:
  5.31 M → 4.91 M cycles (−7.5%). With the new late SLT it also avoids a
  stall: the SLTI version takes 6.29 M cycles on *p5 now*, against
  5.50 M.
- **Not done on purpose.** Testing for leaves at the call site instead of
  in the callee would halve the calls. That removes the thing the
  benchmark measures.

### sieve: 1.29 M cycles, about 1.3 cycles per number below 10⁶

- **Layout.** One flag byte per odd number (500,000 bytes). There are
  three phases:
  - **Pre-sieve by copying, 279 K cycles.** The pattern of multiples of
    3, 5, 7 and 11 repeats every 1155 words. One period is built and
    copied forward; 13 is struck from 15015 words, and that period is
    copied over the rest. The copy costs 2.25 cycles a word: 16 words a
    round, and a loaded word can be stored by the next instruction.
    Striking 3..13 directly would take about 422 K strikes, ~950 K
    cycles.
  - **Striking 17..997, 466 K cycles.** Only p·m with m coprime to 30 is
    struck: 8 residue classes, 8 pointers, each stepping 30p. That makes
    207,542 strikes instead of 389,072 for odds only, at 2.24 cycles a
    strike (8 × `sb r0` + 8 × `add` + branch).
  - **Counting and summing without touching single bytes, 506 K
    cycles.** This is a SWAR scan over blocks of 20 words (see the
    comment in `scan`):
    - R = the sum of the words, so each byte lane counts its primes;
    - C = the sum of the running R, which weights word j by 20 − j;
    - each block folds R and C into scalar totals (21 instructions).

    That is 1.01 cycles per flag byte. A branch-free byte loop (`lb`,
    `andn`, `add`, `add`, `addi`) would cost ~5, about 2.5 M cycles.
- **Biggest differences.** The SWAR scan (est. −2.0 M cycles) and the
  mod-30 wheel (measured 1.69 M → 1.29 M, −24%).
- **Losses.** Only loop back-edges remain (3.3%).

### sort: 0.997 M cycles, 50 cycles a word

- **Method.** LSD radix sort, 11 + 11 + 10 bits, A → B → A → B. Nothing
  branches on the data. A quicksort would make about 400 K comparisons
  at ~6 cycles each with half of them mispredicted: an estimated
  2.4 M cycles.
- **Generation and counting, 410 K cycles (41%), 20.5 cycles a word.**
  All three histograms are counted while the LCG generates the words.
  The LCG's MULTU (8 cycles) is hidden under the 15 counting
  instructions, which saves an estimated 130 K cycles over separate
  generation and histogram passes.
- **Scatter passes, 155 K cycles each, 7.75 cycles a word.**
  - The count tables sit in the first 32 KB, so the scaled digit is the
    base register (`lw p, [d + T0]`) and needs no ADD. That saves 3
    instructions a word in counting and 1 per scatter, ~120 K cycles.
  - A scatter step is load, extract (2), load pointer, store, bump,
    store pointer. The pointer load's bubble is filled with digit work
    for a later word, and the loads stay in order behind the previous
    store, since two words can share a digit.
- **Order check and checksum, 100 K cycles (10%).**
- **Losses.** Back-edges only (3.2%). This is the one program that
  feels a second load-use bubble: +6% with `load_lat=1`.

### mandel: 2.68 M cycles, 19 cycles an iteration (139,193 iterations)

- **Two products an iteration instead of three.**
  - zr' = (zr+zi)(zr−zi) >> 24 + cr and zi' = zr·zi >> 23 + ci.
  - The escape test is a box, |zr| > 2 or |zi| > 2, done as
    `add t, z, 2²⁵; bgtu t, 2²⁶`: no squares needed.
  - With a 9-cycle product (8, plus the MFHL that must come before the
    next MULT), the usual 3-product form would take ~28 cycles an
    iteration (estimate), so this saves about a third.
- **Order of the products.** zr·zi goes first, since it only needs z.
  zi', zr ± zi and both escape tests then run in the shadows, so the
  next product starts 1 cycle after zr' exists: 19 cycles, of which the
  multiplier is busy 16. The other order would take 21.
- **Losses.** muldiv 822 K (31%) is the multiplier's latency itself.
  I/O costs 44 K cycles: 2,190 characters at 20 cycles each.
- **Not done on purpose.** No cardioid/bulb test and no mirror symmetry:
  they would skip most of the iterations, which are what this program
  measures.

### matmul: 0.662 M cycles, 244 cycles per element of C

- **The plain version.** The dot product is unrolled 48 times with
  constant offsets, and each MADD's shadow holds the loads for the MADD
  after next. It is exactly multiplier-bound: 385 cycles an element,
  964 K cycles in all. Only 2 of the 7 issue slots under each MADD are
  used.
- **Biggest difference: quarter squares, −31% (964 K → 662 K).** The other
  5 slots under each MADD now do products without the multiplier:
  - a·b = Q(a+b) − Q(a−b), with Q(x) = ⌊x²/4⌋ from a 4001-word table
    (exact for integers);
  - that is 8 instructions a product: 2 loads, add, sub, 2 `lwx`, add,
    sub;
  - 30 products go to MADD and 18 to the table, which fills the 240
    cycles of the MADDs: 243 instructions an element, at CPI 1.0.
  - The matrices are stored ×4, so a+b is the table's byte offset
    directly. The MADDs then sum 16ab, and `mfhl r5, 4` divides it back
    out exactly.
  - The schedule was generated. The table products run as a
    two-product software pipeline, so no load result is used by the
    next instruction.
- **Sensitive to the multiply latency.** With the 18-cycle multiply of
  *p5 now* the best split is 17 MADD / 31 table products: 826 K cycles,
  against 1,360 K for the 8-cycle split and ~2.09 M for MADD alone.
- **Other costs.** LCG generation with the ×2001 range scaling done by
  shifts under the next multiply (78 K), and the table (18 K).

### fft: 0.404 M cycles; the butterfly pair loop is 52%

- **Structure.**
  - Stages 1 and 2 together with the bit-reversal gather: 28.7 K cycles
    for both transforms, and no multiplies (W = 1, −i).
  - Stages 3–10, group by group. Each group does its W = 1 and W = −i
    butterflies without multiplies (27.5 K cycles, including setup), then
    the pair loop.
  - The pair loop handles butterflies j and j + h/2 together. Their
    twiddles differ by a factor −i, so one 5-word table entry (c, c−s,
    c+s, −s, −c−s) serves both.
- **Three products a butterfly (Gauss).**
  - k1 = c(xr+xi), tr = k1 − (c−s)·xi, ti = k1 − (c+s)·xr.
  - `mfhl …, 16` gives the Q15 product already halved for the stage.
    The inverse runs the same code with a table of doubled values,
    since the MFHL shift is an immediate.
  - The loop is scheduled around its 6 products. Everything else fills
    their shadows: 12 loads, 8 stores, 4 scaling shifts, 5 pointer
    steps, the arithmetic.
  - It takes 58.6 cycles per pair, against 54 for the products alone;
    the remainder is the 45 other instructions that don't quite fit in
    6 × 7 slots.
  - The 4-product form (MULT/MADD/MFHL) would take ~68 cycles a pair
    (estimate): +34 K cycles.
- **Accuracy.** Subtracting both floored Gauss terms from k1 (rather
  than adding one) cancels their rounding bias at no cost:
  - forward error 2.53 → 1.33 LSB rms against an exact DFT/N;
  - round-trip max error 1396 → 559, on values up to 24.7 K.

  The rest is the floor in the per-stage u >> 1 (see the wishes).
- **Outside the transforms**, 1/3 of the time: generating the signal
  (36 K), the power spectrum (21.5 K, multiplier-bound at 21 cycles a
  bin), the 8 scans for the largest bins (20 K), the error loop (17 K)
  and the fold (9 K).

## The ISA in use

**Pleasant**

- **Compare-and-branch with BTFN** makes code layout the whole branch
  strategy:
  - loops cost 1 bubble a round;
  - rare cases out of line cost nothing until they happen (the top-8
    scans, the error maximum, the escape tests, the order check).
- **DBNZ** is a one-instruction loop end; every counted loop uses it.
- **MFHL n** makes fixed point two instructions, and the 64-bit HI:LO
  never loses anything:
  - Q24 in mandel (shifts 24 and 23, for the ×2 in 2·zr·zi);
  - Q15 with stage halving in fft (shift 16);
  - the ×16 in matmul (shift 4).
- **The first 32 KB as `[reg + table]`** turns a scaled index into a
  base register: sort's count tables, sieve's flags, fft's bit-reversal
  and quarter-wave tables.
- **Load → store needs no bubble**, so copy loops run at
  lw/sw/lw/sw.
- **Unsigned compares make range tests one instruction**
  (`bgtu` after an offset add), and `r0` makes the sieve's strike a
  plain `sb r0`.
- **Also useful:** `rori` for checksums and `lwx` for the
  quarter-squares table.

**Awkward**

- **The multiplier.**
  - A product costs 9 cycles: 8, plus 1 because the MFHL must come
    before the next MULT.
  - There is one accumulator.
  - A memory table beats it for 11-bit operands (matmul), and mandel and
    fft are scheduled entirely around it.
  - At 18 cycles (*p5 now*) the multiply-heavy programs take 1.6–2.1×
    as long.
- **No post-increment** costs 5 pointer adds per fft butterfly pair and
  1 per sort scatter. Most loops get around it with offsets.
- **No compare-with-immediate branch.** Constants live in registers:
  2 in fib, 2²⁵ and 2²⁶ in mandel. With the late SLT of the new
  hardware model, SLT/SLTI is no longer usable in a hot path at all;
  none of these programs uses it there.
- **±32 KB displacements.** Arrays above 32 KB need a base register
  (sort's second array, fft's power array). Logical immediates
  zero-extend, so wide masks like 0x3FFFC need an extra shift.
- **The MFHL shift is an immediate**, so differently scaled code paths
  need different tables or code: fft's doubled inverse table.
- **No count-leading-zeros.** Mandel's palette by bit length is a
  256-byte table. It isn't hot.

## Wishes, with savings in these programs

All savings are against the *brief* model and the programs as they are,
unless marked as retuned.

| Wish | Saving |
|---|---|
| **Pipelined multiplier** (3-cycle latency, one a cycle) | matmul **−35%**: plain MADD gives 430 K, measured, against the 662 K hybrid; −55% against plain MADD at 8 cycles. mandel **−26%** (measured, 2.68 M → 1.99 M; it then becomes bound by back-edges). fft −3% as written, ~−8% retuned to 4 products with MADD and no Gauss adds. fib, sieve, sort 0. |
| **Keep the 8-cycle multiply** rather than 18 | the 18-cycle *p5 now* costs mandel +102%, matmul +105% (+25% after retuning the split), fft +56% |
| **A 4-cycle multiplier**, not pipelined | mandel −26%, plain-MADD matmul 540 K (−18% against the hybrid), fft −2% |
| **Branch target buffer** (predicted-taken branches and J/JAL with 0 bubbles; measured) | fib −8%, sieve −3.2%, sort −3.1%, fft −3.3%, matmul −1.4%, mandel −0.1%. With perfect direction prediction as well, fib −16%. |
| **Return-address stack** (`ret` fetched from a predicted address instead of after EX) | fib **−8%** at 1 bubble a return, −16% at 0 (estimated: 392,809 returns × 2 bubbles = 786 K cycles); on top of the BTB's −16%, fib would drop to ~3.3 M cycles (−32%) |
| **Store with base update** (`swu x, [p + 4]`: two reads, one write, so it fits the register file, unlike post-increment loads) | sort −6% (scatter 7 → 6 instructions a word, −60 K cycles); fft −4% (the pair loop drops its 4 data-pointer adds and becomes multiplier-bound, ~−16 K). Doesn't help the sieve, whose stride is a register. |
| **Branch on compare with immediate** (`blti r1, 2`) | fib −7.5% against `slti` + `bnez` (measured), or the same without tying up a register |
| **MFHL that doesn't block the next MULT** (double-buffered HI:LO) | mandel −5% (19 → 18 cycles an iteration); ~0 elsewhere |
| **Byte-sum instruction** (sum of the 4 bytes of a word) | sieve −5%: the per-block fold drops from 21 to ~10 instructions |
| **Rounding arithmetic shift** (round half to even) or a way to round once per butterfly output | fft accuracy, not speed: forward error 1.33 → 0.6 LSB rms and round-trip max 559 → 66 (Python model). In software it costs ~12 instructions a butterfly (+40% of the pair loop). A rounding MFHL alone helps little (1.33 → 1.26), because the program already cancels the product bias. |

Sensitivity of these programs to other pipeline choices (brief model,
one change at a time):

| Change | fib | sieve | sort | mandel | matmul | fft |
|---|---:|---:|---:|---:|---:|---:|
| redirects after EX (3 bubbles) | +12.0% | +0.0% | +0.0% | +0.1% | +0.0% | +0.2% |
| SLT results after MEM | 0 | 0 | 0 | 0 | 0 | 0 |
| a second load-use bubble | 0 | +0.5% | +6.0% | +0.1% | +0.4% | +0.1% |
| no branch prediction | 0 | +3.2% | +3.1% | 0 | +1.4% | +3.0% |
| 18-cycle multiply | 0 | +0.1% | 0 | +102% | +105% | +56% |

## Tool problems

- **The model changed under me.** `emc/pipeline.py` has uncommitted
  changes from the other writer. The default `p5` went from the brief's
  model to an 18-cycle multiply, 3-bubble redirects, late SLT and bus
  freezes, so `run --stats` numbers no longer match the brief, and
  `p5-mul8` isn't the brief's model either. I measured with an explicit
  `Config`. It would help to keep the brief's model as a named preset
  (`p5-brief`?). *(Done afterwards: `--config brief`.)*
- **The doc and the tools disagreed on branch offsets.** At the start,
  `docs/isa-v0.md` said offsets are relative to the branch itself, while
  the assembler and simulator used PC + 4. The working tree now has both
  on PC + 4. Programs that only use labels aren't affected.
- **`--stats` doesn't say where cycles go.** "routines" counts
  instructions under global labels only, so mandel and matmul show
  "main 99.8%". I used a 30-line cycle profile by local label that wraps
  `Timing.step`, and attributes the difference in `timing.last` to the
  label at or before each PC. A `--profile` option along those lines
  would be worth having.
- **`.include` paths.** They are relative to the including file, so a
  variant of a program kept outside `programs/` can't include `lib/`
  without a copy of it.
- **Speed.** With timing the simulator runs at ~0.6–0.8 M
  instructions/s, against ~2.8 M/s without, so a `--stats` run of fib
  takes ~5 s.
- **No real bugs found.** I checked the assembler's `/` and `%`: they
  truncate like C, as documented.
