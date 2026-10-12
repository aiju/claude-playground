"""Instruction-level simulator for ISA draft 0.

Each instruction word is decoded once, on first execution, into a Python
closure that carries out the instruction and returns the next PC. The run
loop counts executions per instruction, and can drive a timing model
(emc/pipeline.py) one instruction at a time.
"""

import sys

from . import isa
from .isa import M32, fields, sx16

assert sys.byteorder == "little", "the memory model uses native word views"

IO_BASE = 0xFFFFFF00
CONSOLE = 0xFFFFFF00
BUS_BASE = 0x80000000


class MachineStop(Exception):
    """The processor stopped: HALT, or an exception."""

    def __init__(self, cause, pc, detail=""):
        super().__init__(f"{cause} at {pc:#x}{': ' + detail if detail else ''}")
        self.cause = cause
        self.pc = pc
        self.detail = detail


def s32(x):
    return (x ^ 0x80000000) - 0x80000000


class Machine:
    def __init__(self, image=None, input_bytes=b"", text_size=isa.MEM_SIZE["text"],
                 data_size=isa.MEM_SIZE["data"]):
        self.n_text = text_size // 4
        self.imem = [0] * self.n_text
        self.dmem = bytearray(data_size)
        self.dsize = data_size
        self.m32 = memoryview(self.dmem).cast("I")
        self.m16 = memoryview(self.dmem).cast("H")
        self.R = [0] * 32
        self.pc = 0
        self.hi = 0
        self.lo = 0
        self.c = 0
        self.inp = bytes(input_bytes)
        self.inp_pos = 0
        self.out = bytearray()
        self.counts = [0] * self.n_text
        self.taken = [0] * self.n_text
        self.bus_accesses = 0
        self.bus = False            # set by an access that went out on the main bus
        self.decoded = [None] * self.n_text
        self.instructions = 0
        self.stop = None
        if image is not None:
            self.load(image)

    def load(self, image):
        for i, w in image.text.items():
            self.imem[i] = w
        for a, b in image.data.items():
            self.dmem[a] = b
        self.symbols = image.symbols

    # ---- the main bus window ---------------------------------------------

    def bus_read(self, a, size, pc):
        self.bus = True
        self.bus_accesses += 1
        if a & ~3 == CONSOLE:
            if self.inp_pos < len(self.inp):
                v = self.inp[self.inp_pos]
                self.inp_pos += 1
                return v
            return M32 if size == 4 else (1 << (8 * size)) - 1
        raise MachineStop("bus error", pc, f"read of unmapped bus address {a:#x}")

    def bus_write(self, a, v, size, pc):
        self.bus = True
        self.bus_accesses += 1
        if a & ~3 == CONSOLE:
            self.out.append(v & 0xFF)
            return
        raise MachineStop("bus error", pc, f"write of unmapped bus address {a:#x}")

    # ---- decoding into closures -------------------------------------------

    def decode(self, idx):
        w = self.imem[idx]
        pc = idx * 4
        f = make(self, w, pc)
        self.decoded[idx] = f
        return f

    # ---- running ----------------------------------------------------------

    def run(self, max_instructions=200_000_000, timing=None, record=None):
        """Run until HALT, an exception or the instruction limit. Returns the
        MachineStop. Only completed instructions are counted; HALT counts.

        timing: a pipeline.Timing to step along. record: an array to append
        the trace to (idx << 2 | taken << 1 | bus), for Timing.replay."""
        R = self.R
        counts = self.counts
        decoded = self.decoded
        n_text = self.n_text
        pc = self.pc
        n = 0
        try:
            if record is not None:
                append = record.append
                while n < max_instructions:
                    idx = pc >> 2
                    if idx >= n_text:
                        raise MachineStop("unmapped instruction address", pc)
                    f = decoded[idx] or self.decode(idx)
                    self.bus = False
                    npc = f(pc)
                    R[0] = 0
                    counts[idx] += 1
                    n += 1
                    append((idx << 2) | ((npc != pc + 4) << 1) | self.bus)
                    pc = npc
            elif timing is None:
                while n < max_instructions:
                    idx = pc >> 2
                    if idx >= n_text:
                        raise MachineStop("unmapped instruction address", pc)
                    f = decoded[idx] or self.decode(idx)
                    pc = f(pc)
                    R[0] = 0
                    counts[idx] += 1
                    n += 1
            else:
                step = timing.step
                while n < max_instructions:
                    idx = pc >> 2
                    if idx >= n_text:
                        raise MachineStop("unmapped instruction address", pc)
                    f = decoded[idx] or self.decode(idx)
                    self.bus = False
                    npc = f(pc)
                    R[0] = 0
                    counts[idx] += 1
                    n += 1
                    step(idx, pc, npc, self.bus)
                    pc = npc
            raise MachineStop("instruction limit", pc)
        except MachineStop as e:
            self.stop = e
            if e.cause == "halt":
                counts[pc >> 2] += 1
                n += 1
                if timing is not None:
                    timing.step(pc >> 2, pc, pc + 4, False)
                if record is not None:
                    record.append((pc >> 2) << 2)
            self.pc = pc
            self.instructions += n
            return e

    def mnemonic_counts(self):
        out = {}
        for idx, c in enumerate(self.counts):
            if c:
                m = isa.mnemonic(self.imem[idx]) or "illegal"
                out[m] = out.get(m, 0) + c
        return out


# ---------------------------------------------------------------------------
# Semantics: one closure per instruction word. Each takes the PC and returns
# the next PC.

def make(m, w, pc):
    R = m.R
    op, s, t, d, sh, fn = fields(w)
    imm = w & 0xFFFF
    simm = sx16(imm)
    nxt = (pc + 4) & M32
    dmem, m32, m16, dsize = m.dmem, m.m32, m.m16, m.dsize

    def illegal(p):
        raise MachineStop("illegal instruction", p, f"{w:#010x}")

    # ---- R-type ALU
    if op == isa.OP_ALU:
        if fn == 0x00:
            def f(p):
                R[d] = (R[s] + R[t]) & M32
                return nxt
        elif fn == 0x01:
            def f(p):
                R[d] = (R[s] - R[t]) & M32
                return nxt
        elif fn == 0x02:
            def f(p):
                R[d] = 1 if s32(R[s]) < s32(R[t]) else 0
                return nxt
        elif fn == 0x03:
            def f(p):
                R[d] = 1 if R[s] < R[t] else 0
                return nxt
        elif fn == 0x04:
            def f(p):
                R[d] = R[s] & R[t]
                return nxt
        elif fn == 0x05:
            def f(p):
                R[d] = R[s] | R[t]
                return nxt
        elif fn == 0x06:
            def f(p):
                R[d] = R[s] ^ R[t]
                return nxt
        elif fn == 0x07:
            def f(p):
                R[d] = ~(R[s] | R[t]) & M32
                return nxt
        elif fn in (0x08, 0x09, 0x0A, 0x0B):
            sub = fn & 1
            carry_in = fn & 2

            def f(p):
                b = R[t] ^ M32 if sub else R[t]
                cin = m.c if carry_in else sub
                r = R[s] + b + cin
                m.c = r >> 32
                R[d] = r & M32
                return nxt
        elif fn == 0x0C:
            def f(p):
                R[d] = R[s] & ~R[t] & M32
                return nxt
        elif fn == 0x0D:
            def f(p):
                R[d] = (R[s] | ~R[t]) & M32
                return nxt
        elif fn == 0x0E:
            def f(p):
                R[d] = ~(R[s] ^ R[t]) & M32
                return nxt
        else:
            f = illegal
        return f

    # ---- I-type ALU
    if op == 0x08:
        def f(p):
            R[t] = (R[s] + simm) & M32
            return nxt
        return f
    if op == 0x0A:
        def f(p):
            R[t] = 1 if s32(R[s]) < simm else 0
            return nxt
        return f
    if op == 0x0B:
        u = simm & M32

        def f(p):
            R[t] = 1 if R[s] < u else 0
            return nxt
        return f
    if op == 0x0C:
        def f(p):
            R[t] = R[s] & imm
            return nxt
        return f
    if op == 0x0D:
        def f(p):
            R[t] = R[s] | imm
            return nxt
        return f
    if op == 0x0E:
        def f(p):
            R[t] = R[s] ^ imm
            return nxt
        return f
    if op == isa.OP_LUI:
        v = imm << 16

        def f(p):
            R[t] = v
            return nxt
        return f

    # ---- shifts
    if op == isa.OP_SHIFT:
        if fn == 0:
            def f(p):
                R[d] = (R[s] << (R[t] & 31)) & M32
                return nxt
        elif fn == 1:
            def f(p):
                R[d] = R[s] >> (R[t] & 31)
                return nxt
        elif fn == 2:
            def f(p):
                R[d] = (s32(R[s]) >> (R[t] & 31)) & M32
                return nxt
        elif fn == 3:
            def f(p):
                x, n = R[s], R[t] & 31
                R[d] = ((x >> n) | (x << (32 - n))) & M32
                return nxt
        elif fn == 4:
            def f(p):
                R[d] = (R[s] << sh) & M32
                return nxt
        elif fn == 5:
            def f(p):
                R[d] = R[s] >> sh
                return nxt
        elif fn == 6:
            def f(p):
                R[d] = (s32(R[s]) >> sh) & M32
                return nxt
        elif fn == 7:
            def f(p):
                x = R[s]
                R[d] = ((x >> sh) | (x << (32 - sh))) & M32
                return nxt
        elif fn == 8:
            def f(p):
                R[d] = (((R[s] << 32) | R[t]) >> sh) & M32
                return nxt
        else:
            f = illegal
        return f

    # ---- multiply/divide
    if op == isa.OP_MULDIV:
        if fn in (0, 1, 2, 3):
            signed = not (fn & 1)
            acc = fn & 2

            def f(p):
                a, b = R[s], R[t]
                if signed:
                    a, b = s32(a), s32(b)
                prod = a * b
                if acc:
                    prod += (m.hi << 32) | m.lo
                prod &= (1 << 64) - 1
                m.hi, m.lo = prod >> 32, prod & M32
                return nxt
        elif fn in (4, 5):
            signed = fn == 4

            def f(p):
                a, b = R[s], R[t]
                if b == 0:
                    m.lo, m.hi = M32, a
                    return nxt
                if signed:
                    a, b = s32(a), s32(b)
                    q = abs(a) // abs(b)
                    if (a < 0) != (b < 0):
                        q = -q
                    r = a - q * b
                    m.lo, m.hi = q & M32, r & M32
                else:
                    m.lo, m.hi = a // b, a % b
                return nxt
        elif fn == 8:
            def f(p):
                R[d] = m.hi
                return nxt
        elif fn == 9:
            def f(p):
                R[d] = m.lo
                return nxt
        elif fn == 10:
            def f(p):
                m.hi = R[s]
                return nxt
        elif fn == 11:
            def f(p):
                m.lo = R[s]
                return nxt
        elif fn == 12:
            def f(p):
                R[d] = (((m.hi << 32) | m.lo) >> sh) & M32
                return nxt
        else:
            f = illegal
        return f

    # ---- system
    if op == isa.OP_SYS:
        if fn == 0:
            def f(p):
                target = R[s]
                if target & 3:
                    raise MachineStop("misaligned jump", p, f"target {target:#x}")
                R[d] = nxt
                return target
        elif fn == 1:
            def f(p):
                raise MachineStop("halt", p)
        else:
            f = illegal
        return f

    # ---- branches
    if op in isa.BRANCH_NAMES:
        target = (pc + 4 + 4 * simm) & M32
        taken = m.taken
        idx = pc >> 2
        cond = {
            0x10: lambda a, b: a == b,
            0x11: lambda a, b: a != b,
            0x12: lambda a, b: s32(a) < s32(b),
            0x13: lambda a, b: s32(a) >= s32(b),
            0x14: lambda a, b: a < b,
            0x15: lambda a, b: a >= b,
        }.get(op)
        if op == 0x17:
            def f(p):
                v = (R[s] - 1) & M32
                R[t] = v
                if v:
                    taken[idx] += 1
                    return target
                return nxt
        elif op == 0x10:
            def f(p):
                if R[s] == R[t]:
                    taken[idx] += 1
                    return target
                return nxt
        elif op == 0x11:
            def f(p):
                if R[s] != R[t]:
                    taken[idx] += 1
                    return target
                return nxt
        elif cond is not None:
            def f(p):
                if cond(R[s], R[t]):
                    taken[idx] += 1
                    return target
                return nxt
        else:
            f = illegal
        return f

    if op in (isa.OP_J, isa.OP_JAL):
        off = w & 0x3FFFFFF
        off = off - (1 << 26) if off & (1 << 25) else off
        target = (pc + 4 + 4 * off) & M32
        if op == isa.OP_J:
            def f(p):
                return target
        else:
            def f(p):
                R[31] = nxt
                return target
        return f

    # ---- loads and stores
    if op in isa.LOAD_NAMES or op == isa.OP_LOADX:
        if op == isa.OP_LOADX:
            kind = fn
            if kind not in isa.LOADX_NAMES:
                return illegal
            dst = d

            def ea(p):
                return (R[s] + R[t]) & M32
        else:
            kind = op & 7
            dst = t

            def ea(p):
                return (R[s] + simm) & M32
        size = 1 << (kind & 3)
        signed = not (kind & 4)

        def f(p):
            a = ea(p)
            if a & (size - 1):
                raise MachineStop("misaligned load", p, f"address {a:#x}")
            if a < dsize:
                if size == 4:
                    v = m32[a >> 2]
                elif size == 2:
                    v = m16[a >> 1]
                    if signed and v & 0x8000:
                        v |= 0xFFFF0000
                else:
                    v = dmem[a]
                    if signed and v & 0x80:
                        v |= 0xFFFFFF00
            elif a >= BUS_BASE:
                v = m.bus_read(a, size, p)
                if size == 2 and signed and v & 0x8000:
                    v |= 0xFFFF0000
                elif size == 1 and signed and v & 0x80:
                    v |= 0xFFFFFF00
                v &= M32
            else:
                raise MachineStop("unmapped data address", p, f"load from {a:#x}")
            R[dst] = v
            return nxt
        return f

    if op in isa.STORE_NAMES:
        size = 1 << (op & 3)

        def f(p):
            a = (R[s] + simm) & M32
            if a & (size - 1):
                raise MachineStop("misaligned store", p, f"address {a:#x}")
            v = R[t]
            if a < dsize:
                if size == 4:
                    m32[a >> 2] = v
                elif size == 2:
                    m16[a >> 1] = v & 0xFFFF
                else:
                    dmem[a] = v & 0xFF
            elif a >= BUS_BASE:
                m.bus_write(a, v, size, p)
            else:
                raise MachineStop("unmapped data address", p, f"store to {a:#x}")
            return nxt
        return f

    return illegal
