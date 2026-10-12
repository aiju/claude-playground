# ISA draft 0

Draft 0 is a 32-bit integer machine for an ECL processor with hardwired
control. It's a load/store RISC with fixed 32-bit instructions, 32
registers and three-operand ALU instructions. Every choice here was made
with a short pipeline running at a high clock in mind: register numbers
are always in the same bits, every instruction reads at most two registers
and writes at most one, and nothing needs a sequencer except multiply and
divide, which run in their own unit.

The machine is an **attached processor**:

- It has its own fast local memories, one for instructions and one for
  data.
- It reaches the rest of the system through a slow TTL main bus.
- A host on that bus loads programs, starts the processor and does all the
  I/O.

The bus is still to be designed, so everything about it here is a
placeholder.

## Machine state

| Item | Description |
|---|---|
| `r0` | Always reads as 0. Writes are discarded. |
| `r1`–`r31` | General purpose, 32 bits. By convention `r30` is the stack pointer (`sp`) and `r31` the link register (`lr`); the hardware only gives `r31` a special role, as the link register of `JAL`. |
| `PC` | Program counter, 32 bits, a multiple of 4. |
| `HI`, `LO` | The multiply/divide unit's 64-bit result: product, accumulator, or remainder and quotient. |
| `C` | Carry flag, used only by the multi-word arithmetic instructions `ADDS`, `SUBS`, `ADDC`, `SUBC`. Nothing else reads or writes it. |

There are no other flags: conditional branches compare two registers.

## Memory

Instructions and data live in separate address spaces (a Harvard
machine), so the processor can fetch an instruction and access data in the
same cycle.

- **Instruction space:** the local instruction memory, holding 32-bit
  words. `PC` addresses it in bytes, so instruction *n* is at address
  4*n*. The processor can't load from or store to it; the host fills it.
- **Data space:** byte addressed, little-endian, 32-bit addresses.

| Data addresses | What |
|---|---|
| `0x00000000`–`0x7FFFFFFF` | Local data memory. 2 MB is fitted in the draft 0 hardware (`0x00000000`–`0x001FFFFF`). |
| `0x80000000`–`0xFFFFFFFF` | The main-bus window: accesses go out over the slow bus and the processor waits for them. **Placeholder until the bus is designed.** |
| `0xFFFFFF00`–`0xFFFFFFFF` | Inside the window, the I/O page. It's reachable as `[r0 + negative offset]`. |

The I/O page in the simulator:

| Address | Read | Write |
|---|---|---|
| `0xFFFFFF00` `CONSOLE` | next input byte, or `0xFFFFFFFF` if there is none | low byte goes to the host's console |

Sizes are byte (8), half (16) and word (32). A half must be at an even
address and a word at a multiple of 4. A misaligned access is an exception
(see below). Byte and half loads come in sign- and zero-extending forms.

The first 32 KB of data memory can be reached with `r0` as the base
(`lw r1, [counter]`), so small programs need no global pointer.

## Instruction formats

Every instruction is one 32-bit word. Fields never move:

```
 31    26 25   21 20   16 15   11 10    6 5      0
+--------+-------+-------+-------+-------+--------+
|   op   |   s   |   t   |   d   | shamt |  func  |   R: register
+--------+-------+-------+-------+-------+--------+
|   op   |   s   |   t   |          imm16         |   I: immediate, load/store, branch
+--------+-------+-------+------------------------+
|   op   |                  off26                 |   J: jump
+--------+----------------------------------------+
```

- **`s` and `t` are always the two register read addresses.** The register
  file is read in parallel with decoding, and an instruction that needs
  only one source ignores the other.
- **The destination** is `d` for R-type instructions (op `0x01`–`0x07`),
  `t` for I-type instructions and loads, and `r31` for `JAL`.
- **Immediates** are sign-extended, except for `ANDI`, `ORI` and `XORI`,
  which zero-extend, and `LUI`, which puts its immediate in the upper half.
- **Branch and jump offsets** count instructions (words) and are relative
  to the address of the branch or jump itself.

## Opcode map

| op | Instruction | op | Instruction |
|---|---|---|---|
| `0x00` | *illegal* (so an all-zero word traps) | `0x18` | `J off26` |
| `0x01` | ALU group (R) | `0x19` | `JAL off26` |
| `0x02` | shift group (R) | `0x1A`–`0x1F` | *reserved* |
| `0x03` | multiply/divide group (R) | `0x20` | `LB t, [s + imm]` |
| `0x04` | indexed loads (R) | `0x21` | `LH` |
| `0x05` | system group (R) | `0x22` | `LW` |
| `0x06`, `0x07` | *reserved* | `0x24` | `LBU` |
| `0x08` | `ADDI t, s, imm` | `0x25` | `LHU` |
| `0x09` | *reserved* | `0x28` | `SB t, [s + imm]` |
| `0x0A` | `SLTI t, s, imm` | `0x29` | `SH` |
| `0x0B` | `SLTIU t, s, imm` | `0x2A` | `SW` |
| `0x0C` | `ANDI t, s, uimm` | others `0x20`–`0x2F` | *reserved* |
| `0x0D` | `ORI t, s, uimm` | `0x30`–`0x3F` | *reserved* (vector extension?) |
| `0x0E` | `XORI t, s, uimm` | | |
| `0x0F` | `LUI t, uimm` | | |
| `0x10` | `BEQ s, t, off16` | | |
| `0x11` | `BNE` | | |
| `0x12` | `BLT` | | |
| `0x13` | `BGE` | | |
| `0x14` | `BLTU` | | |
| `0x15` | `BGEU` | | |
| `0x16` | *reserved* | | |
| `0x17` | `DBNZ t, off16` | | |

Reserved opcodes and function codes are illegal instructions.

The groups are laid out for a decoder built from gates:

- **Loads and stores (`0x20`–`0x2F`):** bits 1–0 of op are the size (0
  byte, 1 half, 2 word), bit 2 means "zero-extend" and bit 3 means "store".
  The indexed loads reuse the size bits in `func`.
- **I-type ALU instructions:** the low 3 bits of op are the same as the
  low 3 bits of the R-type function code they match (`ADDI`/`ADD`,
  `SLTI`/`SLT`, `ANDI`/`AND`, …).
- **Branches:** bits 2–1 of op pick the test (equal, signed less,
  unsigned less, or `s` = 1 for `DBNZ`) and bit 0 inverts it.

### ALU group (op `0x01`): `d ← s ∘ t`

| func | Instruction | Operation |
|---|---|---|
| `0x00` | `ADD` | `d ← s + t` |
| `0x01` | `SUB` | `d ← s − t` |
| `0x02` | `SLT` | `d ← (s < t signed) ? 1 : 0` |
| `0x03` | `SLTU` | `d ← (s < t unsigned) ? 1 : 0` |
| `0x04` | `AND` | `d ← s & t` |
| `0x05` | `OR` | `d ← s \| t` |
| `0x06` | `XOR` | `d ← s ^ t` |
| `0x07` | `NOR` | `d ← ~(s \| t)` |
| `0x08` | `ADDS` | `d ← s + t`, `C ←` carry out |
| `0x09` | `SUBS` | `d ← s − t`, `C ←` 1 if no borrow (`s ≥ t` unsigned) |
| `0x0A` | `ADDC` | `d ← s + t + C`, `C ←` carry out |
| `0x0B` | `SUBC` | `d ← s − t − (1 − C)`, `C ←` 1 if no borrow |
| `0x0C` | `ANDN` | `d ← s & ~t` |
| `0x0D` | `ORN` | `d ← s \| ~t` |
| `0x0E` | `XNOR` | `d ← ~(s ^ t)` |

`ADD`, `SUB` and every other instruction leave `C` alone. So a multi-word
add can step pointers and count between its `ADDC`s:

```
        ; [r5] ← [r2] + [r3], r6 words, least significant first
        adds  r0, r0, r0        ; C ← 0
loop:   lw    r1, [r2]
        lw    r4, [r3]
        addc  r1, r1, r4        ; uses and sets C
        sw    r1, [r5]
        addi  r2, r2, 4         ; ADDI and DBNZ don't touch C
        addi  r3, r3, 4
        addi  r5, r5, 4
        dbnz  r6, loop
```

### Shift group (op `0x02`)

| func | Instruction | Operation |
|---|---|---|
| `0x00` | `SLL d, s, t` | `d ← s << t[4:0]` |
| `0x01` | `SRL d, s, t` | `d ← s >> t[4:0]`, zeros in |
| `0x02` | `SRA d, s, t` | `d ← s >> t[4:0]`, sign in |
| `0x03` | `ROR d, s, t` | `d ← s` rotated right by `t[4:0]` |
| `0x04`–`0x07` | `SLLI`, `SRLI`, `SRAI`, `RORI d, s, n` | the same, by `n` = `shamt` |
| `0x08` | `FSR d, s, t, n` | funnel shift: `d ←` bits `n+31`…`n` of the 64-bit value `s:t` (`s` high) |

`FSR` covers rotates and shifts of 64-bit values (`FSR lo, hi, lo, n`
shifts the pair `hi:lo` right by `n`, given the new `hi` from `SRLI`/`SRAI`).

### Multiply/divide group (op `0x03`)

The multiply/divide unit holds `HI:LO` and runs on its own, taking several
cycles per operation. An instruction that needs `HI` or `LO`, or the unit
itself, waits until the unit is done. The hardware interlocks, so there are
no hazard rules for the programmer, only a reason to put independent work
between a multiply and the instruction that reads its result.

| func | Instruction | Operation |
|---|---|---|
| `0x00` | `MULT s, t` | `HI:LO ← s × t` (signed, 64-bit product) |
| `0x01` | `MULTU s, t` | `HI:LO ← s × t` (unsigned) |
| `0x02` | `MADD s, t` | `HI:LO ← HI:LO + s × t` (signed) |
| `0x03` | `MADDU s, t` | `HI:LO ← HI:LO + s × t` (unsigned) |
| `0x04` | `DIV s, t` | `LO ← s / t`, `HI ← s mod t` (signed, rounding towards zero; the remainder has the sign of `s`) |
| `0x05` | `DIVU s, t` | the same, unsigned |
| `0x08` | `MFHI d` | `d ← HI` |
| `0x09` | `MFLO d` | `d ← LO` |
| `0x0A` | `MTHI s` | `HI ← s` |
| `0x0B` | `MTLO s` | `LO ← s` |
| `0x0C` | `MFHL d, n` | `d ←` bits `n+31`…`n` of `HI:LO` (fixed-point results) |

**Division by zero** doesn't trap: `LO ←` all ones and `HI ← s`.
`DIV` of `−2³¹` by `−1` gives `LO = −2³¹`, `HI = 0`.

A fixed-point multiply with 12 fraction bits is `MULT a, b` then
`MFHL d, 12`.

### Indexed loads (op `0x04`): `d ← mem[s + t]`

| func | Instruction |
|---|---|
| `0x00` | `LBX d, [s + t]` |
| `0x01` | `LHX` |
| `0x02` | `LWX` |
| `0x04` | `LBUX` |
| `0x05` | `LHUX` |

There are no indexed stores: they would read three registers.

### System group (op `0x05`)

| func | Instruction | Operation |
|---|---|---|
| `0x00` | `JALR d, s` | `d ← PC + 4`, `PC ← s` |
| `0x01` | `HALT` | stop and tell the host |

### Branches and jumps

| Instruction | Operation |
|---|---|
| `BEQ s, t, off` | if `s = t`: `PC ← PC + 4·off` |
| `BNE`, `BLT`, `BGE`, `BLTU`, `BGEU` | not equal, signed `<`, signed `≥`, unsigned `<`, unsigned `≥` |
| `DBNZ t, off` | `t ← t − 1`; if the new `t ≠ 0`: `PC ← PC + 4·off`. The assembler sets `s = t`: the hardware reads `s` and writes `t`. |
| `J off` | `PC ← PC + 4·off` (±128 MB) |
| `JAL off` | `r31 ← PC + 4`, `PC ← PC + 4·off` |

The conditional branches reach ±128 KB. There are no delay slots.

**Performance note:** the draft 0 hardware predicts a conditional branch
taken when its offset is negative (backward) and not taken otherwise,
including offset 0. Put loop tests at the bottom of loops and the rare
case of an `if` out of line.

## Exceptions

There are no interrupts. These events stop the processor:

- `HALT` (normal completion);
- an illegal instruction;
- a misaligned load or store;
- a jump to an address that isn't a multiple of 4.

Each one stops the processor with a cause code and the address of the
instruction for the host to read. Instructions before the one that stopped
it have completed, and none after it has changed anything.

## Assembler

The syntax follows the TTL machine's assembler. Comments start with `;`,
labels end with `:`, local labels start with `.` and belong to the last
global label, and `name = expr` defines a constant. Expressions have
C-like operators, `lo16()` and `hi16()`.

| Operand | Syntax |
|---|---|
| register | `r0`–`r31`, `zero` (`r0`), `sp` (`r30`), `lr` (`r31`) |
| immediate | an expression, optionally with `#` |
| memory | `[r2]`, `[r2 + 8]`, `[r2 - 4]`, `[label]` (base `r0`), `[r2 + label]`, `[r2 + r3]` (indexed loads only) |

**Sections.** `.text` (instruction space) and `.data` (data space) each
have their own location counter, both starting at 0. A label is an address
in whichever section it is defined in. Data directives: `.word`, `.half`,
`.byte`, `.ascii`, `.asciz`, `.space n[, fill]`, `.align n`, `.org`.
`.include "file"`.

**Generic mnemonics.** An ALU or shift mnemonic with an immediate as its
last operand picks the immediate form:

| Written | Assembled |
|---|---|
| `add r1, r2, 5` | `addi` |
| `and r1, r2, 0xFF` | `andi` |
| `sub r1, r2, 5` | `addi r1, r2, -5` |
| `slt`, `sltu`, `or`, `xor` with an immediate | the `…I` form |
| `sll r1, r2, 3` | `slli` |

**Pseudo-instructions:**

| Pseudo | Expansion |
|---|---|
| `nop` | `add r0, r0, r0` |
| `mov d, s` | `add d, s, r0` |
| `li d, value` | `addi`, `lui`, or `lui` + `ori` (1–2 instructions) |
| `la d, label` | same as `li` |
| `not d, s` | `nor d, s, r0` |
| `neg d, s` | `sub d, r0, s` |
| `beqz`, `bnez`, `bltz`, `bgez s, label` | compare with `r0` |
| `bgtz`, `blez s, label` | `blt r0, s` / `bge r0, s` |
| `bgt`, `ble`, `bgtu`, `bleu s, t, label` | the operands swapped |
| `b label` | `j label` |
| `call label` | `jal label` |
| `ret` | `jalr r0, lr` |
| `jr s` | `jalr r0, s` |
| `callr s` | `jalr lr, s` |
| `mul d, s, t` | `mult s, t` + `mflo d` |

## Calling convention

| Registers | Use | Saved by |
|---|---|---|
| `r1`–`r7` | arguments; results in `r1` (and `r2`) | caller |
| `r8`–`r15` | temporaries | caller |
| `r16`–`r29` | variables | callee |
| `r30` (`sp`) | stack pointer, grows down, 4-byte aligned | callee |
| `r31` (`lr`) | return address | caller (a non-leaf function saves its own) |

`HI`, `LO` and `C` are caller-saved.

## Why it looks like this

- **Compare-and-branch instead of flags.**
  - A loop test is one instruction (`bne p, end, loop`), not a compare and
    a branch.
  - There's no flag state for the pipeline to forward, and no "this
    instruction changes the flags" rules for the programmer (a lesson from
    the TTL machine).
  - The one flag that pays its way, carry for multi-word arithmetic, only
    belongs to the four instructions that use it.
- **`DBNZ`.** Counted loops are the inner loops of number crunching. The
  hardware decides the branch from `s = 1`, a fast test of the source, so
  it costs no more time than a register compare.
- **`HI`/`LO` instead of a multiply that writes a register.**
  - A multiplier that takes several cycles can't share the register
    file's single write port with the pipeline.
  - Keeping its results in `HI`/`LO` means it never needs one. It also
    gives multiply-accumulate (`MADD`) for dot products and matrix work,
    and quotient and remainder from one divide.
  - `MFHL` makes a fixed-point multiply two instructions.
- **No auto-increment.** A post-incremented load writes two registers, and
  the register file has one write port. Unrolled loops step a pointer once
  per several accesses with offsets instead. A split into address and data
  registers would bring auto-increment back (open question).
- **Indexed loads but not stores.** `[s + t]` uses the address adder that
  is already there, but a store would need a third register read.
- **The all-zero word is illegal.** Running off the end of a program into
  cleared memory stops the machine instead of sliding through `NOP`s.
- **Room left.** Opcodes `0x30`–`0x3F` are free for a vector extension or
  anything else that measurement argues for.
