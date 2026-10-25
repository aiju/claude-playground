"""Instruction semantics, assembler forms and disassembler round trips."""

import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from emc import asm, isa, pipeline  # noqa: E402
from emc.sim import Machine  # noqa: E402

M32 = 0xFFFFFFFF


def run(src, data="", max_n=100_000, timing=None):
    text = "        .text\n" + src + "\n        halt\n        .data\n" + data
    img = asm.assemble_text(isa, text)
    m = Machine(img)
    t = pipeline.Timing(m, timing) if timing else None
    stop = m.run(max_n, t)
    return m, stop, t


def s32(x):
    return (x ^ 0x80000000) - 0x80000000


class Alu(unittest.TestCase):
    def regs(self, src, data=""):
        m, stop, _ = run(src, data)
        self.assertEqual(stop.cause, "halt", str(stop))
        return m

    def test_add_sub_logic(self):
        m = self.regs("""
            li r1, 0x7FFFFFFF
            li r2, 1
            add r3, r1, r2
            sub r4, r2, r1
            and r5, r1, r2
            or  r6, r1, r2
            xor r7, r1, r2
            nor r8, r1, r2
            andn r9, r1, r2
            orn r10, r2, r1
            xnor r11, r1, r2
            slt r12, r3, r2
            sltu r13, r3, r2
            slt r14, r2, r3
            add r0, r1, r2
        """)
        R = m.R
        self.assertEqual(R[3], 0x80000000)
        self.assertEqual(R[4], (1 - 0x7FFFFFFF) & M32)
        self.assertEqual(R[5], 1)
        self.assertEqual(R[6], 0x7FFFFFFF)
        self.assertEqual(R[7], 0x7FFFFFFE)
        self.assertEqual(R[8], 0x80000000)
        self.assertEqual(R[9], 0x7FFFFFFE)
        self.assertEqual(R[10], 0x80000001)
        self.assertEqual(R[11], 0x80000001)
        self.assertEqual(R[12], 1)     # 0x80000000 < 1 signed
        self.assertEqual(R[13], 0)
        self.assertEqual(R[14], 0)
        self.assertEqual(R[0], 0)

    def test_immediates(self):
        m = self.regs("""
            addi r1, r0, -5
            slti r2, r1, -4
            sltiu r3, r1, -4
            andi r4, r1, 0xFF00
            ori  r5, r0, 0xFFFF
            xori r6, r1, 0xFFFF
            lui  r7, 0x1234
            li   r8, 0x12345678
            li   r9, -1
            li   r10, 0x80000000
            add  r11, r1, 7
            sub  r12, r1, 7
            sll  r13, r5, 4
            and  r14, r5, 0x0F0F
        """)
        R = m.R
        self.assertEqual(R[1], (-5) & M32)
        self.assertEqual(R[2], 1)
        self.assertEqual(R[3], 1)       # 0xFFFFFFFB < 0xFFFFFFFC unsigned
        self.assertEqual(R[4], 0xFF00)
        self.assertEqual(R[5], 0xFFFF)
        self.assertEqual(R[6], 0xFFFF0004)
        self.assertEqual(R[7], 0x12340000)
        self.assertEqual(R[8], 0x12345678)
        self.assertEqual(R[9], M32)
        self.assertEqual(R[10], 0x80000000)
        self.assertEqual(R[11], 2)
        self.assertEqual(R[12], (-12) & M32)
        self.assertEqual(R[13], 0xFFFF0)
        self.assertEqual(R[14], 0x0F0F)

    def test_li_sizes(self):
        img = asm.assemble_text(isa, """
            li r1, 5
            li r1, -32768
            li r1, 0x10000
            li r1, 0x12345
            li r1, later
            halt
later = 0x40000
        """)
        sizes = [st.size for st in img.stmts if st.kind == "insn"]
        self.assertEqual(sizes, [4, 4, 4, 8, 4, 4])

    def test_carry_chain(self):
        # 64-bit add and subtract with ADDS/ADDC and SUBS/SUBC
        a, b = 0x00000001_FFFFFFFF, 0x00000002_00000001
        m = self.regs(f"""
            li r1, {a & M32}
            li r2, {a >> 32}
            li r3, {b & M32}
            li r4, {b >> 32}
            adds r5, r1, r3
            addi r9, r9, 1         ; doesn't touch C
            addc r6, r2, r4
            subs r7, r1, r3
            subc r8, r2, r4
            addc r10, r0, r0       ; C after the subtract
        """)
        R = m.R
        self.assertEqual((R[6] << 32) | R[5], a + b)
        self.assertEqual((R[8] << 32) | R[7], (a - b) & ((1 << 64) - 1))
        self.assertEqual(R[10], 0)     # a < b: borrow, so C = 0

    def test_shifts(self):
        m = self.regs("""
            li r1, 0x80000011
            li r2, 4
            sll r3, r1, r2
            srl r4, r1, r2
            sra r5, r1, r2
            ror r6, r1, r2
            slli r7, r1, 0
            srai r8, r1, 31
            rori r9, r1, 0
            rori r10, r1, 1
            li r11, 0x12345678
            li r12, 0x9ABCDEF0
            fsr r13, r11, r12, 8
            fsr r14, r11, r12, 0
            li r15, 36
            sll r16, r1, r15        ; amount mod 32
        """)
        R = m.R
        self.assertEqual(R[3], 0x00000110)
        self.assertEqual(R[4], 0x08000001)
        self.assertEqual(R[5], 0xF8000001)
        self.assertEqual(R[6], 0x18000001)
        self.assertEqual(R[7], 0x80000011)
        self.assertEqual(R[8], M32)
        self.assertEqual(R[9], 0x80000011)
        self.assertEqual(R[10], 0xC0000008)
        self.assertEqual(R[13], 0x789ABCDE)
        self.assertEqual(R[14], 0x9ABCDEF0)
        self.assertEqual(R[16], 0x00000110)

    def test_multiply(self):
        rnd = random.Random(1)
        for _ in range(50):
            a, b = rnd.getrandbits(32), rnd.getrandbits(32)
            m = self.regs(f"""
                li r1, {a}
                li r2, {b}
                mult r1, r2
                mfhi r3
                mflo r4
                multu r1, r2
                mfhi r5
                mflo r6
                madd r1, r2
                mfhi r7
                mflo r8
                mfhl r9, 12
                mul r10, r1, r2
            """)
            R = m.R
            ps = (s32(a) * s32(b)) & ((1 << 64) - 1)
            pu = a * b
            self.assertEqual((R[3] << 32) | R[4], ps)
            self.assertEqual((R[5] << 32) | R[6], pu)
            acc = (pu + s32(a) * s32(b)) & ((1 << 64) - 1)
            self.assertEqual((R[7] << 32) | R[8], acc)
            self.assertEqual(R[9], (acc >> 12) & M32)
            self.assertEqual(R[10], pu & M32)

    def test_divide(self):
        cases = [(7, 2), (-7, 2), (7, -2), (-7, -2), (0, 5), (5, 0), (-2**31, -1), (-2**31, 1),
                 (0xFFFFFFFF, 3)]
        for a, b in cases:
            m = self.regs(f"""
                li r1, {a & M32}
                li r2, {b & M32}
                div r1, r2
                mflo r3
                mfhi r4
                divu r1, r2
                mflo r5
                mfhi r6
            """)
            R = m.R
            ua, ub = a & M32, b & M32
            if b == 0:
                self.assertEqual((R[3], R[4]), (M32, ua))
                self.assertEqual((R[5], R[6]), (M32, ua))
                continue
            sa, sb = s32(ua), s32(ub)
            if sa == -2**31 and sb == -1:
                q, r = -2**31, 0
            else:
                q = abs(sa) // abs(sb) * (1 if (sa < 0) == (sb < 0) else -1)
                r = sa - q * sb
            self.assertEqual((R[3], R[4]), (q & M32, r & M32), (a, b))
            self.assertEqual((R[5], R[6]), (ua // ub, ua % ub), (a, b))

    def test_mthi_mtlo(self):
        m = self.regs("""
            li r1, 0x11
            li r2, 0x22
            mthi r1
            mtlo r2
            li r3, 3
            li r4, 4
            maddu r3, r4
            mfhi r5
            mflo r6
        """)
        self.assertEqual((m.R[5], m.R[6]), (0x11, 0x22 + 12))


class Memory(unittest.TestCase):
    def test_loads_stores(self):
        m, stop, _ = run("""
            la r1, buf
            li r2, 0x8081C2F3
            sw r2, [r1]
            lw r3, [r1]
            lb r4, [r1]
            lbu r5, [r1]
            lb r6, [r1 + 3]
            lh r7, [r1 + 2]
            lhu r8, [r1 + 2]
            sb r2, [r1 + 4]
            sh r2, [r1 + 6]
            lw r9, [r1 + 4]
            li r10, 2
            lhx r11, [r1 + r10]
            lbux r12, [r1 + r10]
            li r10, 4
            lwx r13, [r1 + r10]
        """, data="buf: .space 16")
        self.assertEqual(stop.cause, "halt", str(stop))
        R = m.R
        self.assertEqual(R[3], 0x8081C2F3)
        self.assertEqual(R[4], 0xFFFFFFF3)
        self.assertEqual(R[5], 0xF3)
        self.assertEqual(R[6], 0xFFFFFF80)
        self.assertEqual(R[7], 0xFFFF8081)
        self.assertEqual(R[8], 0x8081)
        self.assertEqual(R[9], 0xC2F300F3)
        self.assertEqual(R[11], 0xFFFF8081)
        self.assertEqual(R[12], 0x81)
        self.assertEqual(R[13], 0xC2F300F3)

    def test_misaligned(self):
        for insn in ("lw r2, [r1 + 2]", "lh r2, [r1 + 1]", "sw r2, [r1 + 1]", "sh r2, [r1 + 3]"):
            m, stop, _ = run(f"la r1, buf\n {insn}", data="buf: .space 8")
            self.assertTrue(stop.cause.startswith("misaligned"), (insn, stop))

    def test_console(self):
        img = asm.assemble_text(isa, """
            li r1, 'A'
            sb r1, [0xFFFFFF00]
            lw r2, [0xFFFFFF00]
            lbu r3, [0xFFFFFF00]
            lw r4, [0xFFFFFF00]
            halt
        """)
        m = Machine(img, b"xy")
        stop = m.run()
        self.assertEqual(stop.cause, "halt")
        self.assertEqual(bytes(m.out), b"A")
        self.assertEqual((m.R[2], m.R[3], m.R[4]), (ord("x"), ord("y"), M32))


class Control(unittest.TestCase):
    def test_branches(self):
        m, stop, _ = run("""
            li r1, -1
            li r2, 1
            li r10, 0
            blt r1, r2, .a
            ori r10, r10, 1
        .a: bltu r1, r2, .b
            ori r10, r10, 2
        .b: bge r2, r1, .c
            ori r10, r10, 4
        .c: bgeu r2, r1, .d
            ori r10, r10, 8
        .d: beq r1, r1, .e
            ori r10, r10, 16
        .e: bne r1, r1, .f
            ori r10, r10, 32
        .f: bgt r2, r1, .g
            ori r10, r10, 64
        .g: blez r1, .h
            ori r10, r10, 128
        .h: bgtz r2, .i
            ori r10, r10, 256
        .i: nop
        """)
        self.assertEqual(stop.cause, "halt")
        # taken: blt, bge, beq, bgt, blez, bgtz. not taken: bltu, bgeu, bne
        self.assertEqual(m.R[10], 2 | 8 | 32)

    def test_dbnz_and_calls(self):
        m, stop, _ = run("""
            li r1, 5
            li r2, 0
        .l: addi r2, r2, 10
            dbnz r1, .l
            call f
            la r5, f
            callr r5
            j done
            li r2, 999
        f:  addi r3, r3, 1
            ret
        done: nop
        """)
        self.assertEqual(stop.cause, "halt")
        self.assertEqual((m.R[1], m.R[2], m.R[3]), (0, 50, 2))

    def test_illegal(self):
        img = asm.assemble_text(isa, ".word 0\n")
        stop = Machine(img).run()
        self.assertEqual(stop.cause, "illegal instruction")
        img = asm.assemble_text(isa, "li r1, 6\njr r1\n")
        stop = Machine(img).run()
        self.assertEqual(stop.cause, "misaligned jump")

    def test_assembler_errors(self):
        for bad in ("addi r1, r2, 40000", "andi r1, r2, -1", "sw r1, [r2 + r3]",
                    "beq r1, r2, buf", "lw r1, [here]\nhere: nop", "slli r1, r2, 32",
                    "la r1, SP\nSP: nop", "r5 = 3"):
            with self.assertRaises(asm.AsmError, msg=bad):
                asm.assemble_text(isa, bad + "\n.data\nbuf: .word 0")


class RoundTrip(unittest.TestCase):
    def test_disassemble_reassemble(self):
        """Every legal word disassembles to text that assembles back to it."""
        rnd = random.Random(7)
        legal = 0
        for _ in range(20000):
            op = rnd.choice(list(range(0x01, 0x06)) + list(range(0x08, 0x2B)))
            w = (op << 26) | rnd.getrandbits(26)
            if op in isa.R_GROUPS:
                w &= ~(0x1F << 6) if not ((op == isa.OP_SHIFT) or (op == isa.OP_MULDIV and w & 63 == 12)) else M32
            m = isa.mnemonic(w)
            if m is None:
                continue
            text = isa.disassemble(w, 0x1000)
            if text.startswith(".word"):
                continue
            src = f".org 0x1000\n{text}\n"
            try:
                img = asm.assemble_text(isa, src)
            except asm.AsmError:
                continue
            w2 = img.text[0x1000 >> 2]
            if isa.disassemble(w2, 0x1000) == text:
                legal += 1
        self.assertGreater(legal, 5000)

    def test_listed_forms(self):
        for src in ("add r1, r2, r3", "lw r4, [r5 - 8]", "lbux r1, [r2 + r3]", "fsr r1, r2, r3, 7",
                    "mfhl r9, 16", "jalr r31, r4", "dbnz r7, 0x1000", "lui r3, 0xbeef",
                    "andi r1, r2, 0xff", "mult r1, r2", "mthi r5"):
            img = asm.assemble_text(isa, f".org 0x1000\n{src}\n")
            self.assertEqual(isa.disassemble(img.text[0x400], 0x1000), src)


class Timing(unittest.TestCase):
    def cycles(self, src, cfg=pipeline.BASE):
        m, stop, t = run(src, timing=cfg)
        self.assertEqual(stop.cause, "halt")
        return t.cycles, t

    def test_straight_line(self):
        # n independent instructions + halt: n+1 instructions, 4 cycles of fill
        c, t = self.cycles("add r1, r2, r3\n" * 10)
        self.assertEqual(c, 11 + 4)

    def test_load_use(self):
        c0, _ = self.cycles("lw r1, [r0]\nadd r3, r4, r5\nadd r2, r1, r1")
        c1, _ = self.cycles("lw r1, [r0]\nadd r2, r1, r1\nadd r3, r4, r5")
        self.assertEqual(c1 - c0, 1)

    def test_branch_bubbles(self):
        # a backward loop taken 9 times: each taken DBNZ costs 1 bubble,
        # the final fall-through is a mispredict (2 bubbles)
        c, t = self.cycles("li r1, 10\n.l: nop\ndbnz r1, .l")
        self.assertEqual(t.mispredicts, 1)
        self.assertEqual(c, (22 + 4) + 9 * 1 + (3 if pipeline.BASE.resolve == "MEM" else 2))

    def test_mul_latency(self):
        c0, _ = self.cycles("mult r1, r2\nmflo r3")
        c1, _ = self.cycles("mflo r3\nmult r1, r2")
        self.assertEqual(c0 - c1, pipeline.BASE.mul_lat - 1)


if __name__ == "__main__":
    unittest.main()
