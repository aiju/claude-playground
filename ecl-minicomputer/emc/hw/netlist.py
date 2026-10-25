"""Netlist description for ECL designs.

    nl = Netlist()
    nl.add("10H158", block="ex", S="sel", D0_0="a[0]", D1_0="b[0]", Q0="y[0]")
    nl.gate("or", ["a", "b"], t="a_or_b", f="a_nor_b")     # packs into gate packages
    q = nl.reg(["d0", "d1"], clock="clk_p", block="idex")    # helpers in blocks.py

Nets are strings. "0" is a low input (an ECL input left open reads low: it
has a 50 kΩ pull-down) and "1" a high one (tied to a high level). Several
outputs on one net make a wired-OR (an emitter dot), which ECL is built
for; check() limits it to 6 outputs per net, as the data books recommend.
Every output net needs a terminator; power() counts them.

Each instance belongs to a *block* (fetch, decode, alu, …), used for the
parts list, power per block and the wire-length estimate in timing analysis.
"""

from collections import defaultdict

from . import chips

MAX_DOTS = 6

GATE_TYPES = {
    # kind -> chip types to try, first one with a big enough section wins.
    # Only parts with cheap aftermarket stock (docs/parts.md): the 10H105
    # and 10H103 would save 19 packages but cost about $28 each, against
    # $1-2 for the 10H101, 10H102 and 10H109.
    "or": ["10H101", "10H109"],
    "nor": ["10H102", "10H109"],
    "and": ["10H104"],
    "xor": ["10H107"],
    "orand": ["10H117"],
    "clkbuf": ["10H210"],
    "delay": ["10H101"],       # a hold-time buffer: one OR section, 0.5 ns minimum
}


class Instance:
    __slots__ = ("type", "ref", "block", "conn", "role")

    def __init__(self, typ, ref, block, role=None):
        self.type = typ
        self.ref = ref
        self.block = block
        self.conn = {}
        self.role = role

    def __setitem__(self, pin, net):
        if pin not in self.type.pins:
            raise KeyError(f"{self.ref} ({self.type.name}) has no pin {pin}")
        if pin in self.conn:
            raise ValueError(f"{self.ref}.{pin} connected twice")
        self.conn[pin] = net


class Netlist:
    def __init__(self):
        self.instances = []
        self.refs = {}
        self.counters = defaultdict(int)
        self.pools = {}            # (chip type, block, section size) -> [instance, used sections]
        self.block = "misc"
        self.ties = set()

    # ---- placing parts -------------------------------------------------

    def add(self, typ, ref=None, block=None, role=None, **pins):
        t = chips.TYPES[typ]
        if ref is None:
            self.counters[typ] += 1
            ref = f"U{typ}_{self.counters[typ]}"
        if ref in self.refs:
            raise ValueError(f"duplicate reference {ref}")
        inst = Instance(t, ref, block or self.block, role)
        self.instances.append(inst)
        self.refs[ref] = inst
        for p, n in pins.items():
            inst[p] = n
        return inst

    def gate(self, kind, inputs, t=None, f=None, block=None):
        """One gate: kind 'or' (outputs OR=t, NOR=f), 'nor' (f only), 'and',
        'xor' (XOR=t, XNOR=f), 'orand' ((i0|i1)&(i2|i3|i4)), or 'clkbuf' (t is
        a list of up to three copies of the OR). Packed into a free section of
        a package in the same block; unused inputs read low."""
        inputs = list(inputs)
        block = block or self.block
        if kind == "nor" and t is not None:
            kind = "or"
        typ, inst, idx = self._pick(kind, len(inputs), block)
        ins, outs = typ.sections[idx]
        for p, net in zip(ins, inputs):
            inst[p] = net
        if kind == "clkbuf":
            for p, net in zip(outs, t):
                inst[p] = net
            return inst
        tpin = [o for o in outs if o.endswith("T")]
        fpin = [o for o in outs if o.endswith("F")]
        if t is not None:
            if not tpin:
                raise ValueError(f"{typ.name} has no true output")
            inst[tpin[0]] = t
        if f is not None:
            if not fpin:
                raise ValueError(f"{typ.name} has no complement output")
            inst[fpin[0]] = f
        return inst

    def _pick(self, kind, n, block):
        for name in GATE_TYPES[kind]:
            typ = chips.TYPES[name]
            sizes = [len(sec[0]) for sec in typ.sections]
            if max(sizes) < n:
                continue
            pool = self.pools.setdefault((name, block), [])
            best = None
            for entry in pool:
                for i, sz in enumerate(sizes):
                    if i not in entry[1] and sz >= n and (best is None or sz < best[2]):
                        best = (entry, i, sz)
            if best is None:
                entry = [self.add(name, block=block), set()]
                pool.append(entry)
                i = min((k for k, sz in enumerate(sizes) if sz >= n), key=lambda k: sizes[k])
                best = (entry, i, sizes[i])
            best[0][1].add(best[1])
            return typ, best[0][0], best[1]
        raise ValueError(f"no {kind} gate with {n} inputs")

    # ---- analysis ------------------------------------------------------

    def nets(self):
        """net -> {'drivers': [(inst, pin)], 'loads': [(inst, pin)]}"""
        out = defaultdict(lambda: {"drivers": [], "loads": []})
        for inst in self.instances:
            for pin, net in inst.conn.items():
                k = "drivers" if inst.type.kind(pin) == "out" else "loads"
                out[net][k].append((inst, pin))
        return out

    def check(self, external=()):
        """Every net read must have a driver (or be '0'/'1' or external);
        at most MAX_DOTS outputs on a net."""
        errors = []
        for net, d in self.nets().items():
            if net in ("0", "1"):
                if d["drivers"]:
                    errors.append(f"constant net {net} is driven by {d['drivers'][0][0].ref}")
                continue
            if d["loads"] and not d["drivers"] and net not in external:
                errors.append(f"net {net} has no driver (read by "
                              + ", ".join(f"{i.ref}.{p}" for i, p in d["loads"][:4]) + ")")
            if len(d["drivers"]) > MAX_DOTS:
                errors.append(f"net {net} has {len(d['drivers'])} outputs dotted (max {MAX_DOTS})")
        if errors:
            raise ValueError("netlist errors:\n  " + "\n  ".join(errors[:60])
                             + (f"\n  … and {len(errors) - 60} more" if len(errors) > 60 else ""))

    def bom(self):
        counts = defaultdict(int)
        for inst in self.instances:
            counts[inst.type.name] += 1
        return dict(sorted(counts.items()))

    def by_block(self):
        out = defaultdict(lambda: defaultdict(int))
        for inst in self.instances:
            out[inst.block][inst.type.name] += 1
        return out

    def power(self, term_mw=28.0, vee=5.2, vcc=5.0):
        """Watts: chip supply currents (max at 25 °C) plus one terminated
        output per ECL net (50 Ω to −2 V: ~15 mW in the output stage and
        ~13 mW in the resistor, R6 p1-16)."""
        chip_w = defaultdict(float)
        for inst in self.instances:
            chip_w[inst.block] += (inst.type.iee_ma * vee + inst.type.icc_ma * vcc) / 1000
        nets = self.nets()
        n_term = sum(1 for net, d in nets.items()
                     if d["drivers"] and any(i.type.family == "10H" for i, _ in d["drivers"]))
        return dict(chip_w), n_term * term_mw / 1000, n_term
