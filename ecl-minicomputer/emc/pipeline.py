"""Cycle model of an in-order pipeline: IF ID EX MEM WB.

The model follows each instruction through the stages, using the
instruction-level simulator's results (branch outcomes, main-bus
accesses). For each instruction it computes the cycle it enters every
stage from these rules:

  IF  ≥ previous IF + 1, ≥ previous ID (IF is busy until then), and after
        a redirect ≥ the cycle the redirect happens
  ID  ≥ IF + 1, ≥ previous EX (ID is busy until then)
  EX  ≥ ID + 1, ≥ previous MEM (EX is busy until then), and ≥ the cycle
        its operands can be forwarded and its functional unit is free
  MEM ≥ EX + 1, ≥ previous MEM + its length (a main-bus access holds MEM)
  WB  = MEM + length of MEM

A stalled instruction waits in ID, holding IF behind it, which is what an
interlocked pipeline does. A main-bus access freezes the whole pipeline
(every register holds) until its last MEM cycle, so a redirect that falls
into a frozen cycle takes effect when the freeze ends, and a branch target
fetched in a frozen cycle enters ID only after it. A predicted-taken
branch redirects fetch in its first ID cycle, even while it is stalled.
Given the same parameters this is exact, not an estimate, so the netlist
simulator can check it cycle for cycle.

Parameters (Config):
  alu_lat        EX→EX distance for an ALU result (1: back to back)
  load_lat       extra cycles a load result needs after MEM (0: the next
                 instruction but one can use it)
  predict        'none' (always not taken), 'btfn' (backward taken,
                 forward not), 'perfect'
  taken_bubbles  bubbles after a correctly predicted taken branch or a
                 J/JAL, whose target comes from ID (0 models a perfect
                 branch target buffer)
  resolve        stage where branches are resolved: 'EX' or 'MEM'
  mul_lat, div_lat   cycles from MULT/MADD/DIV entering EX to MFHI/MFLO
                 entering EX
  mul_issue      cycles between successive multiplies (= mul_lat when the
                 multiplier isn't pipelined)
  bus_cycles     extra MEM cycles per main-bus access
  slt_late       SLT/SLTU/SLTI/SLTIU results arrive after MEM, like a load's
                 (the draft 0 hardware: it saves a multiplexer in the ALU path)
"""

from collections import Counter
from dataclasses import dataclass, replace

from . import isa
from .isa import fields, sx16


@dataclass(frozen=True)
class Config:
    name: str = "p5"
    alu_lat: int = 1
    load_lat: int = 0
    predict: str = "btfn"
    taken_bubbles: int = 1
    resolve: str = "EX"
    mul_lat: int = 8
    mul_issue: int = 8
    div_lat: int = 34
    bus_cycles: int = 20
    slt_late: bool = True
    desc: str = ""


BASE = Config(mul_lat=18, mul_issue=18, resolve="MEM",
              desc="the draft 0 hardware: 5 stages, BTFN prediction in ID, branch and JALR "
                   "redirects from a register after EX (3 bubbles), 18-cycle multiply, "
                   "34-cycle divide, SLT results after MEM")
HW = BASE

PRESETS = {
    "p5": BASE,
    "p5-nopredict": replace(BASE, name="p5-nopredict", predict="none",
                            desc="as p5, but every branch predicted not taken"),
    "p5-perfect": replace(BASE, name="p5-perfect", predict="perfect", taken_bubbles=0,
                          desc="as p5 with a perfect branch predictor and target buffer"),
    "p5-resolve-ex": replace(BASE, name="p5-resolve-ex", resolve="EX",
                             desc="as p5, branches redirect fetch from EX (one bubble fewer per mispredict "
                                  "and JALR; needs a slower clock)"),
    "p6-mem2": replace(BASE, name="p6-mem2", load_lat=1,
                       desc="memory access over two stages: one more load-use bubble"),
    "p5-mul4": replace(BASE, name="p5-mul4", mul_lat=4, mul_issue=4,
                       desc="as p5 with a 4-cycle multiply"),
    "p5-mul8": replace(BASE, name="p5-mul8", mul_lat=8, mul_issue=8,
                       desc="as p5 with an 8-cycle multiply (radix 16)"),
    "p5-sltfast": replace(BASE, name="p5-sltfast", slt_late=False,
                          desc="as p5 with SLT results forwarded from EX like other ALU results"),
    "p5-mulpipe": replace(BASE, name="p5-mulpipe", mul_lat=3, mul_issue=1,
                          desc="as p5 with a pipelined 3-cycle multiplier"),
    "brief": Config(name="brief", resolve="EX", slt_late=False,
                    desc="the model the benchmark programs were tuned for (docs/notes-v0): "
                         "8-cycle multiply, branch and JALR redirects from EX (2 bubbles), "
                         "SLT forwarded from EX"),
}

# instruction classes
ALU, LOAD, STORE, BRANCH, JUMP, JALR, MULDIV_START, HILO_READ, HILO_WRITE, HALT, SLT = range(11)


def analyse(w, slt_late=True):
    """(class, EX sources, store-data source, destination, is_div, backward)"""
    op, s, t, d, sh, fn = fields(w)
    srcs, sdata, dst, is_div, back = (), None, None, False, False
    if op == isa.OP_ALU:
        cls, srcs, dst = ALU, (s, t), d
        if slt_late and fn in (2, 3):
            cls = SLT
    elif op == isa.OP_SHIFT:
        cls, dst = ALU, d
        srcs = (s,) if 4 <= fn <= 7 else (s, t)
    elif op == isa.OP_MULDIV:
        if fn <= 5:
            cls, srcs, is_div = MULDIV_START, (s, t), fn >= 4
        elif fn in (8, 9, 12):
            cls, dst = HILO_READ, d
        else:
            cls, srcs = HILO_WRITE, (s,)
    elif op == isa.OP_LOADX:
        cls, srcs, dst = LOAD, (s, t), d
    elif op == isa.OP_SYS:
        if fn == 0:
            cls, srcs, dst = JALR, (s,), d
        else:
            cls = HALT
    elif op in isa.IMM_NAMES or op == isa.OP_LUI:
        cls, srcs, dst = ALU, (s,), t
        if slt_late and op in (0x0A, 0x0B):
            cls = SLT
    elif op in isa.BRANCH_NAMES:
        cls, back = BRANCH, sx16(w & 0xFFFF) < 0
        if op == 0x17:
            srcs, dst = (s,), t
        else:
            srcs = (s, t)
    elif op in (isa.OP_J, isa.OP_JAL):
        cls = JUMP
        dst = 31 if op == isa.OP_JAL else None
    elif op in isa.LOAD_NAMES:
        cls, srcs, dst = LOAD, (s,), t
    elif op in isa.STORE_NAMES:
        cls, srcs, sdata = STORE, (s,), t
    else:
        cls = HALT
    # The hardware decides interlocks from the fields, not the instruction:
    # s counts unless it's J/JAL (their offset fills s and t); t counts for
    # the R-type groups and the compare-and-branches. The assembler puts 0 in
    # unused fields, so this matches the per-instruction sources above.
    hw_s = op not in (isa.OP_J, isa.OP_JAL)
    hw_t = op in isa.R_GROUPS or (op in isa.BRANCH_NAMES and op != 0x17)
    srcs = tuple(r for r in ((s,) if hw_s else ()) + ((t,) if hw_t else ()) if r)
    if sdata == 0:
        sdata = None
    if dst == 0:
        dst = None
    return cls, srcs, sdata, dst, is_div, back


STALL_KINDS = ("branch", "load", "muldiv", "bus", "alu")


class Timing:
    """Feed it instructions one at a time with step(idx, pc, npc, bus), or
    replay a recorded trace with replay(trace)."""

    def __init__(self, machine, cfg=BASE):
        self.m = machine
        self.cfg = cfg
        self.info = [None] * machine.n_text
        self.lost = Counter()
        self.mispredicts = 0
        self.branches = 0
        self.last = 0
        self.n = 0
        self.wb_log = None
        self.step = self._make_step()

    def _make_step(self):
        cfg = self.cfg
        info_tab = self.info
        imem = self.m.imem
        lost = self.lost
        ready = [0] * 32          # earliest EX for a consumer of each register
        ready_mem = [0] * 32      # earliest MEM for a store of each register
        ready_kind = ["alu"] * 32
        resolve_off = 1 if cfg.resolve == "EX" else 2
        alu_lat, load_lat, bus_cycles = cfg.alu_lat, cfg.load_lat, cfg.bus_cycles
        taken_bubbles = cfg.taken_bubbles
        slt_late = cfg.slt_late
        predict = cfg.predict
        mul_lat, mul_issue, div_lat = cfg.mul_lat, cfg.mul_issue, cfg.div_lat
        # previous instruction's stages, redirect, units
        IF_p = ID_p = EX_p = MEM_p = -1
        k_p = 1
        redirect = 0
        mul_free = hilo_ready = 0
        n = branches = mispredicts = 0
        freezes = []               # (first frozen cycle, first cycle after) of recent bus accesses

        def thaw(c):
            for a, b in freezes:
                if a <= c < b:
                    c = b
            return c

        def step(idx, pc, npc, bus):
            nonlocal IF_p, ID_p, EX_p, MEM_p, k_p, redirect, mul_free, hilo_ready
            nonlocal n, branches, mispredicts
            info = info_tab[idx]
            if info is None:
                info = info_tab[idx] = analyse(imem[idx], slt_late)
            cls, srcs, sdata, dst, is_div, back = info
            IF = IF_p + 1
            if ID_p > IF:
                IF = ID_p
            why = None
            if redirect > IF:
                # the IF/ID register holds through a freeze, so a target
                # fetched in a frozen cycle waits there until the freeze ends
                IF, why = thaw(redirect), "branch"
            ID = IF + 1
            if EX_p > ID:
                ID = EX_p
            ex = ID + 1
            if MEM_p > ex:
                ex, why = MEM_p, "bus"
            for r in srcs:
                if ready[r] > ex:
                    ex, why = ready[r], ready_kind[r]
            if sdata is not None and ready_mem[sdata] - 1 > ex:
                ex, why = ready_mem[sdata] - 1, ready_kind[sdata]
            if cls == MULDIV_START or cls == HILO_WRITE:
                if mul_free > ex:
                    ex, why = mul_free, "muldiv"
            elif cls == HILO_READ:
                if hilo_ready > ex:
                    ex, why = hilo_ready, "muldiv"
            d = ex - EX_p - 1
            if d > 0:
                lost[why or "branch"] += d
            k = 1 + bus_cycles if bus else 1
            MEM = MEM_p + k_p
            if ex + 1 > MEM:
                MEM = ex + 1
            if bus:
                freezes.append((MEM, MEM + bus_cycles))
                if len(freezes) > 4:
                    del freezes[0]
            if dst is not None:
                if cls == LOAD or cls == SLT:
                    ready[dst] = ready_mem[dst] = MEM + k + load_lat
                    ready_kind[dst] = "bus" if bus else "load"
                else:
                    ready[dst] = ex + alu_lat
                    ready_mem[dst] = ex + 1
                    ready_kind[dst] = "alu"
            rd = 0
            if cls == BRANCH:
                branches += 1
                taken = npc != pc + 4
                pred = taken if predict == "perfect" else (back if predict == "btfn" else False)
                if pred != taken:
                    mispredicts += 1
                    rd = thaw(ex) + resolve_off
                elif taken and taken_bubbles:
                    rd = thaw(ID) + taken_bubbles
            elif cls == MULDIV_START:
                if is_div:
                    mul_free = hilo_ready = ex + div_lat
                else:
                    mul_free = ex + mul_issue
                    hilo_ready = ex + mul_lat
            elif cls == HILO_WRITE:
                if ex + 1 > hilo_ready:
                    hilo_ready = ex + 1
            elif cls == JUMP:
                if taken_bubbles:
                    rd = thaw(ID) + taken_bubbles
            elif cls == JALR:
                rd = thaw(ex) + resolve_off
            redirect = rd
            IF_p, ID_p, EX_p, MEM_p, k_p = IF, ID, ex, MEM, k
            n += 1
            if self.wb_log is not None:
                self.wb_log.append(MEM + k)
            self.last = MEM + k
            self.n = n
            self.branches = branches
            self.mispredicts = mispredicts

        return step

    def replay(self, trace):
        """Run a trace recorded by Machine.run(record=True): one int per
        instruction, idx << 2 | taken << 1 | bus."""
        step = self.step
        for e in trace:
            idx = e >> 2
            pc = idx << 2
            step(idx, pc, pc + 8 if e & 2 else pc + 4, e & 1)

    @property
    def cycles(self):
        return self.last + 1

    def report(self):
        return {"config": self.cfg.name, "cycles": self.cycles, "instructions": self.n,
                "cpi": self.cycles / max(1, self.n), "lost": dict(self.lost),
                "branches": self.branches, "mispredicts": self.mispredicts}
