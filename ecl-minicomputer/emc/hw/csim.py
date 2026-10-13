"""Netlist simulator: compiles a netlist into C and runs it through ctypes.

Two-valued and zero-delay: it checks logic, not timing (that's sta.py).
Each net is a byte. The generated code has:

  eval()        every cell in dependency order; a net with several drivers
                (wired-OR) is cleared first and then OR-ed into
  eval_clock()  only the cells between the CLK net and the clock pins
  writes()      RAM writes (run after the write phase of a cycle)
  snapshot()    remember every flip-flop's D inputs and clock pin
  capture()     flip-flops whose clock pin went from 0 to 1 take their D

The cycle itself (which external nets change when, in what order these
run) is up to a testbench: C code given to build(), written against net
names as {net:NAME} and the engine functions above.
"""

import ctypes
import hashlib
import os
import re
import subprocess
from collections import defaultdict

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "build", "csim")


class Model:
    def __init__(self, nl, external):
        """external: names of nets driven by the testbench (sources)."""
        self.nl = nl
        self.external = list(external)
        self.net_id = {"0": 0, "1": 1}
        for inst in nl.instances:
            for net in inst.conn.values():
                self.net_id.setdefault(net, len(self.net_id))
        for net in self.external:
            self.net_id.setdefault(net, len(self.net_id))
        self.drivers = defaultdict(list)
        for inst in nl.instances:
            for pin, net in inst.conn.items():
                if inst.type.kind(pin) == "out":
                    self.drivers[net].append((inst, pin))
        self.wired = {n for n, d in self.drivers.items() if len(d) > 1}
        # state allocation
        self.state_base = {}
        self.n_state = 0
        self.mems = []
        for inst in nl.instances:
            if inst.type.n_state:
                self.state_base[inst.ref] = self.n_state
                self.n_state += inst.type.n_state
            if "{mem}" in "".join(c.code for c in inst.type.cells) + inst.type.write:
                self.mems.append(inst)
        self.cells = []
        for inst in nl.instances:
            for cell in inst.type.cells:
                self.cells.append((inst, cell))
        self.order = self._toposort(self.cells)

    def _toposort(self, cells):
        produced_by = defaultdict(list)     # net -> cell indices driving it
        for k, (inst, cell) in enumerate(cells):
            for p in cell.outs:
                if p in inst.conn:
                    produced_by[inst.conn[p]].append(k)
        deps = []
        for inst, cell in cells:
            d = set()
            for p in cell.ins:
                net = inst.conn.get(p, "0")
                d.update(produced_by.get(net, ()))
            deps.append(d)
        order, state = [], [0] * len(cells)     # 0 new, 1 visiting, 2 done

        import sys
        sys.setrecursionlimit(100000)

        def visit(k, path):
            if state[k] == 2:
                return
            if state[k] == 1:
                cyc = [f"{cells[j][0].ref}" for j in path[path.index(k):]]
                raise ValueError("combinational loop: " + " -> ".join(cyc[:20]))
            state[k] = 1
            path.append(k)
            for j in deps[k]:
                visit(j, path)
            path.pop()
            state[k] = 2
            order.append(k)

        for k in range(len(cells)):
            visit(k, [])
        return order

    # ---- code generation ----------------------------------------------

    def n(self, net):
        return f"n[{self.net_id[net]}]"

    def subst(self, inst, code, pins_as=None, outs=()):
        """Replace {PIN}, {s[...]} and {mem} in a code template."""
        base = self.state_base.get(inst.ref, 0)
        code = re.sub(r"\{s\[([^\]]+)\]\}", lambda m: f"st[{base} + ({m.group(1)})]", code)
        if "{mem}" in code:
            code = code.replace("{mem}", f"mem_{self.mems.index(inst)}")
        for p in outs:
            net = inst.conn.get(p)
            if net is None:
                code = re.sub(r"\{" + re.escape(p) + r"\}\s*=", "dummy =", code)
            elif net in self.wired:
                code = re.sub(r"\{" + re.escape(p) + r"\}\s*=", f"{self.n(net)} |=", code)

        def pin(m):
            p = m.group(1)
            if pins_as and p in pins_as:
                return pins_as[p]
            if p in inst.type.pins:
                return self.n(inst.conn.get(p, "0"))
            return m.group(0)
        return re.sub(r"\{([A-Za-z0-9_]+)\}", pin, code)

    def cell_code(self, inst, cell):
        return "{ " + self.subst(inst, cell.code, outs=cell.outs) + " }"

    def generate(self, testbench):
        nl = self.nl
        out = ["#include <stdint.h>", "#include <string.h>", "#include <stdio.h>",
               f"#define NNETS {len(self.net_id)}",
               f"uint8_t n[NNETS];", f"uint8_t st[{max(1, self.n_state)}];", "static uint8_t dummy;"]
        for i, inst in enumerate(self.mems):
            out.append(f"uint8_t mem_{i}[1 << 19];")
        out.append("uint8_t *mem_ptr(int i) { switch (i) {"
                   + "".join(f" case {i}: return mem_{i};" for i in range(len(self.mems)))
                   + " } return 0; }")
        wired_ids = sorted(self.net_id[w] for w in self.wired)
        out.append(f"static const int wired[] = {{{', '.join(map(str, wired_ids)) or '0'}}};")
        out.append(f"#define NWIRED {len(wired_ids)}")
        # eval
        out.append("void eval(void) {")
        out.append("  for (int i = 0; i < NWIRED; i++) n[wired[i]] = 0;")
        for k in self.order:
            inst, cell = self.cells[k]
            out.append("  " + self.cell_code(inst, cell))
        out.append("  n[0] = 0; n[1] = 1;")
        out.append("}")
        # clock tree: cells downstream of CLK that lead to a clock pin
        clock_pins = {(inst.ref, inst.type.clock) for inst in nl.instances if inst.type.clock}
        clk_nets = {inst.conn.get(inst.type.clock) for inst in nl.instances if inst.type.clock}
        needed = self._fanin_cells(clk_nets) & self._fanout_cells("CLK")
        out.append("void eval_clock(void) {")
        for k in self.order:
            if k in needed:
                inst, cell = self.cells[k]
                out.append("  " + self.cell_code(inst, cell))
        out.append("}")
        # flip-flops
        ffs = [inst for inst in nl.instances if inst.type.clock]
        nsnap = sum(len([p for p in i.type.pins if i.type.kind(p) == "in" and p != i.type.clock]) for i in ffs)
        out.append(f"uint8_t snap[{max(1, nsnap)}], cpre[{max(1, len(ffs))}];")
        snap_lines, cap_lines = [], []
        k = 0
        for j, inst in enumerate(ffs):
            pins_as = {}
            for p in inst.type.pins:
                if inst.type.kind(p) == "in" and p != inst.type.clock:
                    snap_lines.append(f"  snap[{k}] = {self.n(inst.conn.get(p, '0'))};")
                    pins_as[p] = f"snap[{k}]"
                    k += 1
            snap_lines.append(f"  cpre[{j}] = {self.n(inst.conn.get(inst.type.clock, '0'))};")
            cap_lines.append(f"  if (!cpre[{j}] && {self.n(inst.conn.get(inst.type.clock, '0'))}) {{ "
                             + self.subst(inst, inst.type.edge, pins_as) + " }")
        out.append("void snapshot(void) {")
        out += snap_lines
        out.append("}")
        out.append("void capture(void) {")
        out += cap_lines
        out.append("}")
        out.append("void writes(void) {")
        for inst in nl.instances:
            if inst.type.write:
                out.append("  { " + self.subst(inst, inst.type.write) + " }")
        out.append("}")
        out.append(self.subst_tb(testbench))
        return "\n".join(out) + "\n"

    def _fanin_cells(self, nets):
        produced_by = defaultdict(list)
        for k, (inst, cell) in enumerate(self.cells):
            for p in cell.outs:
                if p in inst.conn:
                    produced_by[inst.conn[p]].append(k)
        seen, stack = set(), list(nets)
        cells = set()
        while stack:
            net = stack.pop()
            if net in seen:
                continue
            seen.add(net)
            for k in produced_by.get(net, ()):
                if k not in cells:
                    cells.add(k)
                    inst, cell = self.cells[k]
                    for p in cell.ins:
                        stack.append(inst.conn.get(p, "0"))
        return cells

    def _fanout_cells(self, net0):
        readers = defaultdict(list)
        for k, (inst, cell) in enumerate(self.cells):
            for p in cell.ins:
                readers[inst.conn.get(p, "0")].append(k)
        seen, stack, cells = set(), [net0], set()
        while stack:
            net = stack.pop()
            if net in seen:
                continue
            seen.add(net)
            for k in readers.get(net, ()):
                if k not in cells:
                    cells.add(k)
                    inst, cell = self.cells[k]
                    for p in cell.outs:
                        if p in inst.conn:
                            stack.append(inst.conn[p])
        return cells

    def subst_tb(self, code):
        """{net:NAME} -> the net's byte; {ids:NAME:N} -> the ids of NAME[0..N-1]."""
        def rep(m):
            name = m.group(1)
            if name not in self.net_id:
                raise KeyError(f"testbench refers to unknown net {name}")
            return self.n(name)

        def ids(m):
            name, k = m.group(1), int(m.group(2))
            out = []
            for i in range(k):
                net = f"{name}[{i}]"
                if net not in self.net_id:
                    raise KeyError(f"testbench refers to unknown net {net}")
                out.append(str(self.net_id[net]))
            return ", ".join(out)
        code = re.sub(r"\{ids:([^:}]+):(\d+)\}", ids, code)
        return re.sub(r"\{net:([^}]+)\}", rep, code)


def build(nl, external, testbench, name="cpu", opt="-O1"):
    """Generate, compile (cached by content) and load. Returns (Model, ctypes.CDLL)."""
    model = Model(nl, external)
    src = model.generate(testbench)
    os.makedirs(CACHE, exist_ok=True)
    h = hashlib.sha1(src.encode()).hexdigest()[:12]
    c_path = os.path.join(CACHE, f"{name}_{h}.c")
    so_path = os.path.join(CACHE, f"{name}_{h}.so")
    if not os.path.exists(so_path):
        with open(c_path, "w") as f:
            f.write(src)
        subprocess.run(["gcc", opt, "-shared", "-fPIC", "-o", so_path, c_path], check=True)
    lib = ctypes.CDLL(so_path)
    return model, lib
