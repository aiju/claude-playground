"""ISA draft 0: encodings, the assembler hook and the disassembler.

See docs/isa-v0.md. Semantics live in emc/sim.py.
"""

from .asm import Expr, Mem, Reg, Str

MEM_SIZE = {"text": 2 << 20, "data": 2 << 20}   # bytes of local memory in draft 0
M32 = 0xFFFFFFFF

REGISTERS = {f"r{i}": i for i in range(32)}
REGISTERS.update({"zero": 0, "sp": 30, "lr": 31})

# ---- opcodes --------------------------------------------------------------

OP_ALU, OP_SHIFT, OP_MULDIV, OP_LOADX, OP_SYS = 0x01, 0x02, 0x03, 0x04, 0x05
R_GROUPS = (OP_ALU, OP_SHIFT, OP_MULDIV, OP_LOADX, OP_SYS)

ALU_FUNCS = {
    "add": 0x00, "sub": 0x01, "slt": 0x02, "sltu": 0x03,
    "and": 0x04, "or": 0x05, "xor": 0x06, "nor": 0x07,
    "adds": 0x08, "subs": 0x09, "addc": 0x0A, "subc": 0x0B,
    "andn": 0x0C, "orn": 0x0D, "xnor": 0x0E,
}
IMM_OPS = {  # I-type ALU: op, zero-extended?
    "addi": (0x08, False), "slti": (0x0A, False), "sltiu": (0x0B, False),
    "andi": (0x0C, True), "ori": (0x0D, True), "xori": (0x0E, True),
}
OP_LUI = 0x0F
SHIFT_FUNCS = {"sll": 0, "srl": 1, "sra": 2, "ror": 3,
               "slli": 4, "srli": 5, "srai": 6, "rori": 7, "fsr": 8}
MULDIV_FUNCS = {"mult": 0, "multu": 1, "madd": 2, "maddu": 3, "div": 4, "divu": 5,
                "mfhi": 8, "mflo": 9, "mthi": 10, "mtlo": 11, "mfhl": 12}
LOADX_FUNCS = {"lbx": 0, "lhx": 1, "lwx": 2, "lbux": 4, "lhux": 5}
SYS_FUNCS = {"jalr": 0, "halt": 1}
BRANCH_OPS = {"beq": 0x10, "bne": 0x11, "blt": 0x12, "bge": 0x13,
              "bltu": 0x14, "bgeu": 0x15, "dbnz": 0x17}
OP_J, OP_JAL = 0x18, 0x19
LOAD_OPS = {"lb": 0x20, "lh": 0x21, "lw": 0x22, "lbu": 0x24, "lhu": 0x25}
STORE_OPS = {"sb": 0x28, "sh": 0x29, "sw": 0x2A}


def r_type(op, s, t, d, shamt, func):
    return (op << 26) | (s << 21) | (t << 16) | (d << 11) | (shamt << 6) | func


def i_type(op, s, t, imm):
    return (op << 26) | (s << 21) | (t << 16) | (imm & 0xFFFF)


def j_type(op, off):
    return (op << 26) | (off & 0x3FFFFFF)


NOP = r_type(OP_ALU, 0, 0, 0, 0, ALU_FUNCS["add"])
HALT = r_type(OP_SYS, 0, 0, 0, 0, SYS_FUNCS["halt"])


def fits_s16(v):
    return -0x8000 <= v <= 0x7FFF


def fits_u16(v):
    return 0 <= v <= 0xFFFF


# ---- assembler hook -------------------------------------------------------

GENERIC_IMM = {"add": "addi", "slt": "slti", "sltu": "sltiu",
               "and": "andi", "or": "ori", "xor": "xori",
               "sll": "slli", "srl": "srli", "sra": "srai", "ror": "rori"}
SWAPPED = {"bgt": "blt", "ble": "bge", "bgtu": "bltu", "bleu": "bgeu"}
ZERO_BRANCH = {"beqz": ("beq", False), "bnez": ("bne", False),
               "bltz": ("blt", False), "bgez": ("bge", False),
               "bgtz": ("blt", True), "blez": ("bge", True)}


def assemble(name, ops, ctx):
    def reg(i):
        if i >= len(ops) or not isinstance(ops[i], Reg):
            ctx.error(f"{name}: operand {i + 1} must be a register")
        return ops[i].n

    def nops(n):
        if len(ops) != n:
            ctx.error(f"{name} takes {n} operand{'s' if n != 1 else ''}")

    def expr(i):
        if i >= len(ops) or not isinstance(ops[i], Expr):
            ctx.error(f"{name}: operand {i + 1} must be an expression")
        return ctx.value(ops[i].expr)

    def is_imm(i):
        return i < len(ops) and isinstance(ops[i], Expr)

    def simm(v, known, what="immediate"):
        if known and not fits_s16(v):
            ctx.error(f"{name}: {what} {v} doesn't fit in 16 signed bits")
        return v

    def uimm(v, known):
        # andi/ori/xori zero-extend, so a negative constant would silently
        # mean something else: make it an error
        if known and not fits_u16(v):
            ctx.error(f"{name}: immediate {v} doesn't fit in 16 unsigned bits "
                      f"(logical immediates are zero-extended)")
        return v

    def branch_off(target_i, known_pc=ctx.pc):
        if not isinstance(ops[target_i], Expr):
            ctx.error(f"{name}: the target must be a label or address")
        v, known = ctx.value(ops[target_i].expr)
        if known and ctx.section_of(ops[target_i].expr) == "data":
            ctx.error(f"{name}: target is a data address")
        if known and v % 4:
            ctx.error(f"{name}: target {v:#x} isn't a multiple of 4")
        return (v - known_pc) // 4, known

    n = name
    # generic mnemonics with an immediate last operand
    if n in GENERIC_IMM and len(ops) == 3 and is_imm(2):
        n = GENERIC_IMM[n]
    if n == "sub" and len(ops) == 3 and is_imm(2):
        v, known = expr(2)
        return [i_type(0x08, reg(1), reg(0), simm(-v, known))]

    if n in ALU_FUNCS:
        nops(3)
        return [r_type(OP_ALU, reg(1), reg(2), reg(0), 0, ALU_FUNCS[n])]
    if n in IMM_OPS:
        nops(3)
        op, zext = IMM_OPS[n]
        v, known = expr(2)
        v = uimm(v, known) if zext else simm(v, known)
        return [i_type(op, reg(1), reg(0), v)]
    if n == "lui":
        nops(2)
        v, known = expr(1)
        return [i_type(OP_LUI, 0, reg(0), uimm(v, known))]
    if n in SHIFT_FUNCS:
        f = SHIFT_FUNCS[n]
        if n == "fsr":
            nops(4)
            v, known = expr(3)
            if known and not 0 <= v <= 31:
                ctx.error("fsr: shift amount must be 0..31")
            return [r_type(OP_SHIFT, reg(1), reg(2), reg(0), v & 31, f)]
        nops(3)
        if f >= 4:
            v, known = expr(2)
            if known and not 0 <= v <= 31:
                ctx.error(f"{n}: shift amount must be 0..31")
            return [r_type(OP_SHIFT, reg(1), 0, reg(0), v & 31, f)]
        return [r_type(OP_SHIFT, reg(1), reg(2), reg(0), 0, f)]
    if n in MULDIV_FUNCS:
        f = MULDIV_FUNCS[n]
        if f <= 5:
            nops(2)
            return [r_type(OP_MULDIV, reg(0), reg(1), 0, 0, f)]
        if n in ("mfhi", "mflo"):
            nops(1)
            return [r_type(OP_MULDIV, 0, 0, reg(0), 0, f)]
        if n in ("mthi", "mtlo"):
            nops(1)
            return [r_type(OP_MULDIV, reg(0), 0, 0, 0, f)]
        nops(2)  # mfhl d, n
        v, known = expr(1)
        if known and not 0 <= v <= 31:
            ctx.error("mfhl: shift amount must be 0..31")
        return [r_type(OP_MULDIV, 0, 0, reg(0), v & 31, f)]
    if n == "mul":
        nops(3)
        return [r_type(OP_MULDIV, reg(1), reg(2), 0, 0, MULDIV_FUNCS["mult"]),
                r_type(OP_MULDIV, 0, 0, reg(0), 0, MULDIV_FUNCS["mflo"])]
    if n in LOAD_OPS or n in STORE_OPS or n in LOADX_FUNCS:
        nops(2)
        rt = reg(0)
        m = ops[1]
        if not isinstance(m, Mem):
            ctx.error(f"{n}: second operand must be a memory operand [...]")
        if m.index is not None:
            if n in STORE_OPS:
                ctx.error("there are no indexed stores")
            base = n[:-1] if n in LOADX_FUNCS else n
            return [r_type(OP_LOADX, m.base.n, m.index.n, rt, 0, LOADX_FUNCS[base + "x"])]
        if n in LOADX_FUNCS:
            ctx.error(f"{n} needs [reg + reg]")
        base = m.base.n if m.base else 0
        if m.disp is None:
            v, known = 0, True
        else:
            v, known = ctx.value(m.disp)
            if known and ctx.section_of(m.disp) == "text":
                ctx.error(f"{n}: address is in instruction space")
        if known and 0xFFFF8000 <= v <= M32:
            v -= 1 << 32            # the top 32 KB (the I/O page) sign-extends from 16 bits
        if known and not fits_s16(v):
            ctx.error(f"{n}: offset {v} doesn't fit in 16 signed bits")
        op = LOAD_OPS.get(n) or STORE_OPS[n]
        return [i_type(op, base, rt, v)]
    if n in SWAPPED:
        nops(3)
        off, known = branch_off(2)
        return [i_type(BRANCH_OPS[SWAPPED[n]], reg(1), reg(0), check_b16(ctx, n, off, known))]
    if n in ZERO_BRANCH:
        nops(2)
        b, swap = ZERO_BRANCH[n]
        off, known = branch_off(1)
        s, t = (0, reg(0)) if swap else (reg(0), 0)
        return [i_type(BRANCH_OPS[b], s, t, check_b16(ctx, n, off, known))]
    if n == "dbnz":
        nops(2)
        off, known = branch_off(1)
        r = reg(0)
        return [i_type(BRANCH_OPS[n], r, r, check_b16(ctx, n, off, known))]
    if n in BRANCH_OPS:
        nops(3)
        off, known = branch_off(2)
        return [i_type(BRANCH_OPS[n], reg(0), reg(1), check_b16(ctx, n, off, known))]
    if n in ("j", "jal", "b", "call"):
        nops(1)
        off, known = branch_off(0)
        if known and not -(1 << 25) <= off < (1 << 25):
            ctx.error(f"{n}: target out of range")
        return [j_type(OP_JAL if n in ("jal", "call") else OP_J, off)]
    if n == "jalr":
        nops(2)
        return [r_type(OP_SYS, reg(1), 0, reg(0), 0, SYS_FUNCS["jalr"])]
    if n == "ret":
        nops(0)
        return [r_type(OP_SYS, 31, 0, 0, 0, SYS_FUNCS["jalr"])]
    if n == "jr":
        nops(1)
        return [r_type(OP_SYS, reg(0), 0, 0, 0, SYS_FUNCS["jalr"])]
    if n == "callr":
        nops(1)
        return [r_type(OP_SYS, reg(0), 0, 31, 0, SYS_FUNCS["jalr"])]
    if n == "halt":
        nops(0)
        return [HALT]
    if n == "nop":
        nops(0)
        return [NOP]
    if n == "mov":
        nops(2)
        return [r_type(OP_ALU, reg(1), 0, reg(0), 0, ALU_FUNCS["add"])]
    if n == "not":
        nops(2)
        return [r_type(OP_ALU, reg(1), 0, reg(0), 0, ALU_FUNCS["nor"])]
    if n == "neg":
        nops(2)
        return [r_type(OP_ALU, 0, reg(1), reg(0), 0, ALU_FUNCS["sub"])]
    if n in ("li", "la"):
        nops(2)
        d = reg(0)
        v, known = expr(1)
        if known and not -(1 << 31) <= v <= M32:
            ctx.error(f"{n}: value {v} doesn't fit in 32 bits")
        v &= M32
        sv = v - (1 << 32) if v & 0x80000000 else v
        if ctx.min_words < 2 and known:
            if fits_s16(sv):
                return [i_type(0x08, 0, d, sv)]
            if v & 0xFFFF == 0:
                return [i_type(OP_LUI, 0, d, v >> 16)]
        if not known and ctx.min_words < 2:
            return [i_type(0x08, 0, d, 0)]   # optimistic; grows if needed
        return [i_type(OP_LUI, 0, d, v >> 16), i_type(0x0D, d, d, v & 0xFFFF)]
    ctx.error(f"unknown instruction {name}")


def check_b16(ctx, name, off, known):
    if known and not -0x8000 <= off <= 0x7FFF:
        ctx.error(f"{name}: branch target out of range (±128 KB)")
    return off


# ---- disassembler ---------------------------------------------------------

def _inv(d):
    return {v: k for k, v in d.items()}


ALU_NAMES = _inv(ALU_FUNCS)
SHIFT_NAMES = _inv(SHIFT_FUNCS)
MULDIV_NAMES = _inv(MULDIV_FUNCS)
LOADX_NAMES = _inv(LOADX_FUNCS)
SYS_NAMES = _inv(SYS_FUNCS)
IMM_NAMES = {op: n for n, (op, _) in IMM_OPS.items()}
BRANCH_NAMES = _inv(BRANCH_OPS)
LOAD_NAMES = _inv(LOAD_OPS)
STORE_NAMES = _inv(STORE_OPS)


def sx16(v):
    return v - 0x10000 if v & 0x8000 else v


def fields(w):
    return (w >> 26, (w >> 21) & 31, (w >> 16) & 31, (w >> 11) & 31, (w >> 6) & 31, w & 63)


def mnemonic(w):
    """The base mnemonic of an instruction word, or None if it's illegal."""
    op, s, t, d, sh, f = fields(w)
    try:
        if op == OP_ALU:
            return ALU_NAMES[f]
        if op == OP_SHIFT:
            return SHIFT_NAMES[f]
        if op == OP_MULDIV:
            return MULDIV_NAMES[f]
        if op == OP_LOADX:
            return LOADX_NAMES[f]
        if op == OP_SYS:
            return SYS_NAMES[f]
        if op in IMM_NAMES:
            return IMM_NAMES[op]
        if op == OP_LUI:
            return "lui"
        if op in BRANCH_NAMES:
            return BRANCH_NAMES[op]
        if op == OP_J:
            return "j"
        if op == OP_JAL:
            return "jal"
        if op in LOAD_NAMES:
            return LOAD_NAMES[op]
        if op in STORE_NAMES:
            return STORE_NAMES[op]
    except KeyError:
        return None
    return None


def disassemble(w, pc=0):
    op, s, t, d, sh, f = fields(w)
    m = mnemonic(w)
    if m is None:
        return f".word {w:#010x}"
    imm = w & 0xFFFF
    if op == OP_ALU:
        if w == NOP:
            return "nop"
        return f"{m} r{d}, r{s}, r{t}"
    if op == OP_SHIFT:
        if m == "fsr":
            return f"fsr r{d}, r{s}, r{t}, {sh}"
        if f >= 4:
            return f"{m} r{d}, r{s}, {sh}"
        return f"{m} r{d}, r{s}, r{t}"
    if op == OP_MULDIV:
        if f <= 5:
            return f"{m} r{s}, r{t}"
        if m in ("mfhi", "mflo"):
            return f"{m} r{d}"
        if m in ("mthi", "mtlo"):
            return f"{m} r{s}"
        return f"mfhl r{d}, {sh}"
    if op == OP_LOADX:
        return f"{m} r{d}, [r{s} + r{t}]"
    if op == OP_SYS:
        if m == "jalr":
            return f"jalr r{d}, r{s}"
        return m
    if op in IMM_NAMES:
        v = imm if op in (0x0C, 0x0D, 0x0E) else sx16(imm)
        return f"{m} r{t}, r{s}, {v:#x}" if op in (0x0C, 0x0D, 0x0E) else f"{m} r{t}, r{s}, {v}"
    if op == OP_LUI:
        return f"lui r{t}, {imm:#x}"
    if op in BRANCH_NAMES:
        tgt = (pc + 4 * sx16(imm)) & M32
        if m == "dbnz":
            return f"dbnz r{t}, {tgt:#x}"
        return f"{m} r{s}, r{t}, {tgt:#x}"
    if op in (OP_J, OP_JAL):
        off = w & 0x3FFFFFF
        off = off - (1 << 26) if off & (1 << 25) else off
        return f"{m} {(pc + 4 * off) & M32:#x}"
    if op in LOAD_NAMES or op in STORE_NAMES:
        v = sx16(imm)
        mem = f"[r{s}]" if v == 0 else f"[r{s} {'+' if v > 0 else '-'} {abs(v)}]"
        return f"{m} r{t}, {mem}"
    return f".word {w:#010x}"
