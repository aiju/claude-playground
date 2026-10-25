"""ECL chip library: pins, behaviour (as C code for the netlist simulator),
timing arcs and power, for every part type the CPU uses.

A chip type is a list of *cells*. A cell is a group of outputs that the
simulator computes together from a set of inputs (and maybe the chip's
state), with C code written against pin names:

    {X}         the value (0/1) of the net on pin X
    {X} = ...   drive pin X (outputs only); wired-OR is handled by the generator
    {s[i]}      state byte i of this instance (flip-flops, RAM)

Timing arcs are (from pins, to pins, max ns, min ns), worst case over
0–75 °C at −5.2 V ±5 %, 50 Ω to −2 V, from Motorola's MECL Data book
DL122/D Rev 6 (1996) unless noted ("R6 2-74" = page 2-74). Unused ECL inputs
have 50 kΩ pull-downs and read as 0, so they may be left open.

Sequential behaviour:
  'edge'  code run when the net on the clock pin rises (D sampled before)
  'write' code run after the write phase of a cycle (RAM writes)
"""

from dataclasses import dataclass, field


@dataclass
class Cell:
    outs: list
    ins: list
    code: str
    uses_state: bool = False


@dataclass
class ChipType:
    name: str
    desc: str
    pins: dict                      # pin -> 'in' | 'out'
    cells: list
    arcs: list = field(default_factory=list)     # (from list, to list, max, min)
    checks: list = field(default_factory=list)   # (data pins, clock pin, setup, hold)
    clock: str = None               # edge-triggered clock pin
    edge: str = ""                  # C code at a rising clock edge
    write: str = ""                 # C code at the end of the write phase
    n_state: int = 0
    iee_ma: float = 0.0             # max VEE supply current (25 °C), mA
    icc_ma: float = 0.0             # +5 V current (translators, SRAM), mA
    pins_pkg: int = 16
    family: str = "10H"
    source: str = ""
    sections: list = None           # for packable gates: list of (input pins, output pins)

    def kind(self, pin):
        return self.pins[pin]


TYPES = {}


def chip(t):
    TYPES[t.name] = t
    return t


def _pins(ins, outs):
    d = {p: "in" for p in ins}
    d.update({p: "out" for p in outs})
    return d


# ---------------------------------------------------------------------------
# Gates. Sections are named a, b, c...; inputs aN, outputs aO (OR/AND/XOR
# true output) and aN... complement aQ.

def gate_chip(name, desc, kind, sizes, tmax, tmin, iee, src, comp=True):
    """kind: 'or' (OR + NOR outputs), 'nor' (NOR only), 'and', 'xor' (XOR + XNOR)."""
    ins, outs, cells, sections, arcs = [], [], [], [], []
    for k, n in enumerate(sizes):
        s = "abcdefgh"[k]
        si = [f"{s}{i}" for i in range(n)]
        so = []
        if kind in ("or", "and", "xor"):
            so.append(f"{s}T")
        if comp or kind == "nor":
            so.append(f"{s}F")
        ins += si
        outs += so
        expr = {"or": " | ".join, "nor": " | ".join, "and": " & ".join, "xor": " ^ ".join}[kind](
            "{" + p + "}" for p in si)
        code = f"int t = {expr};"
        if f"{s}T" in so:
            code += f" {{{s}T}} = t;"
        if f"{s}F" in so:
            code += f" {{{s}F}} = !t;"
        cells.append(Cell(so, si, code))
        sections.append((si, so))
        arcs.append((si, so, tmax, tmin))
    return chip(ChipType(name, desc, _pins(ins, outs), cells, arcs, iee_ma=iee, source=src,
                         sections=sections))


gate_chip("10H101", "quad OR/NOR buffer (the input common to all four gates tied low)", "or", [1, 1, 1, 1],
          1.6, 0.5, 26, "R6 2-9")
gate_chip("10H102", "quad 2-input NOR", "nor", [2, 2, 2, 2], 1.4, 0.4, 26, "R6 2-10", comp=False)
gate_chip("10H103", "quad 2-input OR", "or", [2, 2, 2, 2], 1.45, 0.4, 26, "R6 2-11", comp=False)
gate_chip("10H104", "quad 2-input AND", "and", [2, 2, 2, 2], 1.9, 0.45, 35, "R6 2-12", comp=False)
gate_chip("10H105", "triple 2-3-2 OR/NOR", "or", [2, 3, 2], 1.3, 0.4, 21, "R6 2-13")
gate_chip("10H107", "triple 2-input XOR/XNOR", "xor", [2, 2, 2], 1.7, 0.4, 28, "R6 2-15")
gate_chip("10H109", "dual 4-5 OR/NOR", "or", [4, 5], 1.45, 0.4, 14, "R6 2-16")
gate_chip("10H209", "dual 4-5 OR/NOR (fastest)", "or", [4, 5], 1.15, 0.4, 30, "R6 2-81")

chip(ChipType(
    "10H117", "dual 2-wide 2-3 OR-AND/OR-AND-INVERT",
    _pins(["a0", "a1", "a2", "a3", "a4", "b0", "b1", "b2", "b3", "b4"], ["aT", "aF", "bT", "bF"]),
    [Cell(["aT", "aF"], ["a0", "a1", "a2", "a3", "a4"],
          "int t = ({a0} | {a1}) & ({a2} | {a3} | {a4}); {aT} = t; {aF} = !t;"),
     Cell(["bT", "bF"], ["b0", "b1", "b2", "b3", "b4"],
          "int t = ({b0} | {b1}) & ({b2} | {b3} | {b4}); {bT} = t; {bF} = !t;")],
    [(["a0", "a1", "a2", "a3", "a4"], ["aT", "aF"], 1.5, 0.45),
     (["b0", "b1", "b2", "b3", "b4"], ["bT", "bF"], 1.5, 0.45)],
    iee_ma=26, source="R6 2-20",
    sections=[(["a0", "a1", "a2", "a3", "a4"], ["aT", "aF"]),
              (["b0", "b1", "b2", "b3", "b4"], ["bT", "bF"])]))

# clock fan-out: one input, three equal outputs, two sections
chip(ChipType(
    "10H210", "dual 3-input 3-output OR (clock fan-out)",
    _pins(["a0", "a1", "a2", "b0", "b1", "b2"], ["aT0", "aT1", "aT2", "bT0", "bT1", "bT2"]),
    [Cell(["aT0", "aT1", "aT2"], ["a0", "a1", "a2"],
          "int t = {a0} | {a1} | {a2}; {aT0} = t; {aT1} = t; {aT2} = t;"),
     Cell(["bT0", "bT1", "bT2"], ["b0", "b1", "b2"],
          "int t = {b0} | {b1} | {b2}; {bT0} = t; {bT1} = t; {bT2} = t;")],
    [(["a0", "a1", "a2"], ["aT0", "aT1", "aT2"], 1.7, 0.5),
     (["b0", "b1", "b2"], ["bT0", "bT1", "bT2"], 1.7, 0.5)],
    iee_ma=38, source="R6 2-82",
    sections=[(["a0", "a1", "a2"], ["aT0", "aT1", "aT2"]), (["b0", "b1", "b2"], ["bT0", "bT1", "bT2"])]))

# hex buffer / inverter with common enable (enable high forces outputs low)
for _name, _inv, _src in (("10H188", False, "R6 2-79"), ("10H189", True, "R6 2-80")):
    chip(ChipType(
        _name, "hex " + ("inverter" if _inv else "buffer") + " with enable",
        _pins([f"D{i}" for i in range(6)] + ["E"], [f"Q{i}" for i in range(6)]),
        [Cell([f"Q{i}"], [f"D{i}", "E"], f"{{Q{i}}} = {'!' if _inv else ''}{{D{i}}} & !{{E}};")
         for i in range(6)],
        [([f"D{i}" for i in range(6)], [f"Q{i}" for i in range(6)], 1.9, 0.7),
         (["E"], [f"Q{i}" for i in range(6)], 2.3, 0.7)],
        iee_ma=42, source=_src))

# ---------------------------------------------------------------------------
# Multiplexers

chip(ChipType(
    "10H158", "quad 2:1 multiplexer, common select (S=0: D0, S=1: D1)",
    _pins([f"{x}{i}" for i in range(4) for x in ("D0_", "D1_")] + ["S"], [f"Q{i}" for i in range(4)]),
    [Cell([f"Q{i}"], [f"D0_{i}", f"D1_{i}", "S"], f"{{Q{i}}} = {{S}} ? {{D1_{i}}} : {{D0_{i}}};")
     for i in range(4)],
    [([f"{x}{i}" for i in range(4) for x in ("D0_", "D1_")], [f"Q{i}" for i in range(4)], 2.0, 0.5),
     (["S"], [f"Q{i}" for i in range(4)], 2.9, 1.0)],
    iee_ma=48, source="R6 2-40"))

chip(ChipType(
    "10H174", "dual 4:1 multiplexer, common selects A (lsb) and B, common enable "
    "(E=1 forces both outputs low)",
    _pins([f"X{i}" for i in range(4)] + [f"Y{i}" for i in range(4)] + ["A", "B", "E"], ["Z", "W"]),
    [Cell(["Z"], [f"X{i}" for i in range(4)] + ["A", "B", "E"],
          "{Z} = {E} ? 0 : ({B} ? ({A} ? {X3} : {X2}) : ({A} ? {X1} : {X0}));"),
     Cell(["W"], [f"Y{i}" for i in range(4)] + ["A", "B", "E"],
          "{W} = {E} ? 0 : ({B} ? ({A} ? {Y3} : {Y2}) : ({A} ? {Y1} : {Y0}));")],
    [([f"X{i}" for i in range(4)], ["Z"], 2.6, 0.7), ([f"Y{i}" for i in range(4)], ["W"], 2.6, 0.7),
     (["A", "B"], ["Z", "W"], 3.2, 1.0), (["E"], ["Z", "W"], 1.7, 0.4)],
    iee_ma=73, source="R6 2-63"))

# ---------------------------------------------------------------------------
# Flip-flops

chip(ChipType(
    "10H176", "hex D master-slave flip-flop, common clock",
    _pins([f"D{i}" for i in range(6)] + ["C"], [f"Q{i}" for i in range(6)]),
    [Cell([f"Q{i}" for i in range(6)], [], " ".join(f"{{Q{i}}} = {{s[{i}]}};" for i in range(6)),
          uses_state=True)],
    [(["C"], [f"Q{i}" for i in range(6)], 2.4, 0.9)],
    checks=[([f"D{i}" for i in range(6)], "C", 1.5, 1.0)],
    clock="C",
    edge=" ".join(f"{{s[{i}]}} = {{D{i}}};" for i in range(6)),
    n_state=6, iee_ma=112, source="R6 2-67 (setup 1.5, hold 0.9–1.0)"))

# ---------------------------------------------------------------------------
# Arithmetic: MC10H181 4-bit ALU and MC10H179 look-ahead.
#
# Per bit: u = A | B&S2 | ~B&S3,  v = A&~B&S0 | A&B&S1 (v implies u).
# Arithmetic (M=0): F = u + v + Cn (Cn active high), so g = v and p = u.
# Logic (M=1): every internal carry is forced to 1, F = ~(u ^ v).
# This reproduces the function select table, R6 2-74 / R5 2-76.

_ALU_UV = """
int u[4], v[4];
int a[4] = {{A0}, {A1}, {A2}, {A3}}, b[4] = {{B0}, {B1}, {B2}, {B3}};
for (int i = 0; i < 4; i++) {
  u[i] = a[i] | (b[i] & {S2}) | (!b[i] & {S3});
  v[i] = (a[i] & !b[i] & {S0}) | (a[i] & b[i] & {S1});
}
"""

chip(ChipType(
    "10H181", "4-bit ALU / function generator",
    _pins([f"A{i}" for i in range(4)] + [f"B{i}" for i in range(4)] + ["S0", "S1", "S2", "S3", "M", "CN"],
          [f"F{i}" for i in range(4)] + ["CN4", "GG", "PG"]),
    [Cell(["GG", "PG"], [f"A{i}" for i in range(4)] + [f"B{i}" for i in range(4)] + ["S0", "S1", "S2", "S3"],
          _ALU_UV + "{GG} = v[3] | (u[3] & v[2]) | (u[3] & u[2] & v[1]) | (u[3] & u[2] & u[1] & v[0]);"
                    " {PG} = u[0] & u[1] & u[2] & u[3];"),
     Cell([f"F{i}" for i in range(4)] + ["CN4"],
          [f"A{i}" for i in range(4)] + [f"B{i}" for i in range(4)] + ["S0", "S1", "S2", "S3", "M", "CN"],
          _ALU_UV + """
int c = {CN};
int f[4];
for (int i = 0; i < 4; i++) {
  f[i] = u[i] ^ v[i] ^ (c | {M});
  c = v[i] | (u[i] & c);
}
{F0} = f[0]; {F1} = f[1]; {F2} = f[2]; {F3} = f[3]; {CN4} = c;
""")],
    [([f"A{i}" for i in range(4)], [f"F{i}" for i in range(4)], 4.0, 1.6),
     ([f"B{i}" for i in range(4)], [f"F{i}" for i in range(4)], 4.8, 2.1),
     (["CN"], [f"F{i}" for i in range(4)], 3.3, 1.2),
     (["CN"], ["CN4"], 2.2, 0.7),
     ([f"A{i}" for i in range(4)], ["GG", "PG"], 4.0, 1.6),
     ([f"B{i}" for i in range(4)], ["GG", "PG"], 4.0, 1.6),
     ([f"A{i}" for i in range(4)], ["CN4"], 3.9, 1.6),
     ([f"B{i}" for i in range(4)], ["CN4"], 4.3, 2.1),
     (["M"], [f"F{i}" for i in range(4)], 4.5, 1.6),
     (["S0", "S1", "S2", "S3"], [f"F{i}" for i in range(4)], 4.8, 1.6),
     (["S0", "S1", "S2", "S3"], ["GG", "PG"], 4.8, 1.4),
     (["S0", "S1", "S2", "S3"], ["CN4"], 4.4, 1.6)],
    iee_ma=145, pins_pkg=24, source="R6 2-74..2-76"))

chip(ChipType(
    "10H179", "look-ahead carry block",
    _pins([f"G{i}" for i in range(4)] + [f"P{i}" for i in range(4)] + ["CN"], ["CN2", "CN4", "GG", "PG"]),
    [Cell(["GG", "PG"], [f"G{i}" for i in range(4)] + [f"P{i}" for i in range(4)],
          "{GG} = {G3} | ({P3} & {G2}) | ({P3} & {P2} & {G1}) | ({P3} & {P2} & {P1} & {G0});"
          " {PG} = {P0} & {P1} & {P2} & {P3};"),
     Cell(["CN2", "CN4"], [f"G{i}" for i in range(4)] + [f"P{i}" for i in range(4)] + ["CN"],
          "{CN2} = {G1} | ({P1} & {G0}) | ({P1} & {P0} & {CN});"
          " {CN4} = {G3} | ({P3} & {G2}) | ({P3} & {P2} & {G1}) | ({P3} & {P2} & {P1} & {G0})"
          " | ({P3} & {P2} & {P1} & {P0} & {CN});")],
    [([f"P{i}" for i in range(4)], ["PG"], 1.7, 0.5),
     ([f"G{i}" for i in range(4)] + [f"P{i}" for i in range(4)] + ["CN"], ["CN2", "CN4", "GG"], 2.6, 0.8)],
    iee_ma=72, source="R6 2-69"))

# ---------------------------------------------------------------------------
# Register file: MC10H145 16 x 4 RAM, one address port.
# Outputs are low while deselected (CS high) or writing (WE low).

chip(ChipType(
    "10H145", "16 x 4 register file (RAM), single address port",
    _pins([f"A{i}" for i in range(4)] + [f"D{i}" for i in range(4)] + ["CS", "WE"], [f"Q{i}" for i in range(4)]),
    [Cell([f"Q{i}" for i in range(4)], [f"A{i}" for i in range(4)] + ["CS", "WE"],
          "int a = {A0} | ({A1} << 1) | ({A2} << 2) | ({A3} << 3);"
          " int en = !{CS} && {WE};"
         
          " {Q0} = en & ({s[a]} >> 0) & 1; {Q1} = en & ({s[a]} >> 1) & 1;"
          " {Q2} = en & ({s[a]} >> 2) & 1; {Q3} = en & ({s[a]} >> 3) & 1;", uses_state=True)],
    [([f"A{i}" for i in range(4)], [f"Q{i}" for i in range(4)], 6.0, 0.0),
     (["CS"], [f"Q{i}" for i in range(4)], 4.0, 0.0),
     (["WE"], [f"Q{i}" for i in range(4)], 4.0, 1.0)],
    write="if (!{CS} && !{WE}) { int a = {A0} | ({A1} << 1) | ({A2} << 2) | ({A3} << 3);"
          " {s[a]} = {D0} | ({D1} << 1) | ({D2} << 2) | ({D3} << 3); }",
    n_state=16, iee_ma=163, source="R6 2-37/2-38: tAA 6.0, tW 6.0, tWSA 3.5, tWHA 1.5, tWSD 0, tWHD 1.5"))

# 256 x 4 ECL RAM (10422 class: Cypress CY10E422L, Fujitsu MBM10422A), one
# address port, block select CS active low, WE active low (outputs low while
# deselected or writing). Write timing per grade (Fujitsu 1990 ECL RAM data
# book p1-3ff): tSA address setup, tW write pulse, tHA address hold, tSD data
# setup to the end of the write, tHD data hold, tWR write recovery.
RAM422 = {
    "-7": {"tAA": 7.0, "tAB": 4.0, "tW": 5.0, "tSA": 1.0, "tHA": 1.0, "tSD": 1.0, "tHD": 1.0, "tWR": 6.0},
    "-5": {"tAA": 5.0, "tAB": 3.0, "tW": 3.5, "tSA": 0.5, "tHA": 1.0, "tSD": 0.5, "tHD": 1.0, "tWR": 3.5},
}


def ram422(grade):
    r = RAM422[grade]
    return chip(ChipType(
        "10E422" + grade, f"256 x 4 ECL RAM, {r['tAA']:.0f} ns (CY10E422L{grade}, MBM10422A{grade})",
        _pins([f"A{i}" for i in range(8)] + [f"D{i}" for i in range(4)] + ["CS", "WE"],
              [f"Q{i}" for i in range(4)]),
        [Cell([f"Q{i}" for i in range(4)], [f"A{i}" for i in range(8)] + ["CS", "WE"],
              "int a = " + " | ".join(f"({{A{i}}} << {i})" for i in range(8)) + ";"
              " int en = !{CS} && {WE};"
              + "".join(f" {{Q{i}}} = en & ({{s[a]}} >> {i}) & 1;" for i in range(4)), uses_state=True)],
        [([f"A{i}" for i in range(8)], [f"Q{i}" for i in range(4)], r["tAA"], 0.0),
         (["CS"], [f"Q{i}" for i in range(4)], r["tAB"], 0.0),
         (["WE"], [f"Q{i}" for i in range(4)], r["tWR"], 1.0)],
        write="if (!{CS} && !{WE}) { int a = " + " | ".join(f"({{A{i}}} << {i})" for i in range(8))
              + "; {s[a]} = {D0} | ({D1} << 1) | ({D2} << 2) | ({D3} << 3); }",
        n_state=256, iee_ma=150, pins_pkg=24, family="10H",
        source=f"Fujitsu MBM10422A{grade} (1990 ECL RAM book p1-3): tAA {r['tAA']}, tW {r['tW']}, "
               f"tSA {r['tSA']}, tHA {r['tHA']}, tSD {r['tSD']}"))


RAM_WRITE = {"10H145": {"tSA": 3.5, "tW": 6.0, "tHA": 1.5, "tSD": 0.0, "tHD": 1.5}}
for _g in RAM422:
    ram422(_g)
    RAM_WRITE["10E422" + _g] = {k: RAM422[_g][k] for k in ("tSA", "tW", "tHA", "tSD", "tHD")}


# ---------------------------------------------------------------------------
# Comparator and decoder

chip(ChipType(
    "10H164", "8:1 multiplexer with enable (E=1 forces Z low), selects A (lsb), B, C",
    _pins([f"X{i}" for i in range(8)] + ["A", "B", "C", "E"], ["Z"]),
    [Cell(["Z"], [f"X{i}" for i in range(8)] + ["A", "B", "C", "E"],
          "int k = {A} | ({B} << 1) | ({C} << 2); int x[8] = {{X0}, {X1}, {X2}, {X3}, {X4}, {X5}, {X6}, {X7}};"
          " {Z} = !{E} && x[k];")],
    [([f"X{i}" for i in range(8)], ["Z"], 2.6, 0.9), (["A", "B", "C"], ["Z"], 3.2, 1.2),
     (["E"], ["Z"], 1.7, 0.5)],
    iee_ma=75, source="R6 2-49"))

chip(ChipType(
    "10H166", "5-bit magnitude comparator (A<B, A>B; E=1 forces both low)",
    _pins([f"A{i}" for i in range(5)] + [f"B{i}" for i in range(5)] + ["E"], ["LT", "GT"]),
    [Cell(["LT", "GT"], [f"A{i}" for i in range(5)] + [f"B{i}" for i in range(5)] + ["E"],
          "int a = {A0} | ({A1} << 1) | ({A2} << 2) | ({A3} << 3) | ({A4} << 4);"
          " int b = {B0} | ({B1} << 1) | ({B2} << 2) | ({B3} << 3) | ({B4} << 4);"
          " {LT} = !{E} && a < b; {GT} = !{E} && a > b;")],
    [([f"A{i}" for i in range(5)] + [f"B{i}" for i in range(5)], ["LT", "GT"], 4.1, 1.2),
     (["E"], ["LT", "GT"], 1.8, 0.7)],
    iee_ma=106, source="R6 2-54"))

chip(ChipType(
    "10H162", "3-to-8 decoder, selected output high; E0, E1 active low",
    _pins(["A", "B", "C", "E0", "E1"], [f"Q{i}" for i in range(8)]),
    [Cell([f"Q{i}" for i in range(8)], ["A", "B", "C", "E0", "E1"],
          "int k = {A} | ({B} << 1) | ({C} << 2); int en = !{E0} && !{E1};"
          + "".join(f" {{Q{i}}} = en && k == {i};" for i in range(8)))],
    [(["A", "B", "C"], [f"Q{i}" for i in range(8)], 2.5, 0.8),
     (["E0", "E1"], [f"Q{i}" for i in range(8)], 2.6, 0.9)],
    iee_ma=76, source="R6 2-47"))

# ---------------------------------------------------------------------------
# Translators (need +5 V as well as −5.2 V)

chip(ChipType(
    "10H124", "quad TTL to ECL translator, complementary outputs",
    _pins([f"D{i}" for i in range(4)], [f"Q{i}" for i in range(4)] + [f"QN{i}" for i in range(4)]),
    [Cell([f"Q{i}", f"QN{i}"], [f"D{i}"], f"{{Q{i}}} = {{D{i}}}; {{QN{i}}} = !{{D{i}}};") for i in range(4)],
    [([f"D{i}" for i in range(4)], [f"Q{i}" for i in range(4)] + [f"QN{i}" for i in range(4)], 2.95, 0.55)],
    iee_ma=66, icc_ma=25, source="R6 2-24"))

chip(ChipType(
    "10H125", "quad ECL to TTL translator",
    _pins([f"D{i}" for i in range(4)], [f"Q{i}" for i in range(4)]),
    [Cell([f"Q{i}"], [f"D{i}"], f"{{Q{i}}} = {{D{i}}};") for i in range(4)],
    [([f"D{i}" for i in range(4)], [f"Q{i}" for i in range(4)], 3.4, 0.8)],
    iee_ma=40, icc_ma=63, source="R5 2-28"))

chip(ChipType(
    "10H601", "9-bit ECL to TTL translator, 3-state TTL outputs (OE active low)",
    _pins([f"D{i}" for i in range(9)] + ["OE"], [f"Q{i}" for i in range(9)]),
    [Cell([f"Q{i}"], [f"D{i}", "OE"], f"{{Q{i}}} = !{{OE}} & {{D{i}}};") for i in range(9)],
    [([f"D{i}" for i in range(9)], [f"Q{i}" for i in range(9)], 4.8, 1.7),
     (["OE"], [f"Q{i}" for i in range(9)], 6.0, 3.5)],
    iee_ma=51, icc_ma=110, pins_pkg=28, source="R6 2-101 (CL 50 pF)"))

# ---------------------------------------------------------------------------
# Off-family parts

SRAM_TIMING = {"tAA": 10.0, "tOE": 5.0, "tWP": 7.0, "tDW": 5.0, "tAW": 7.0, "tAS": 0.0,
               "tWR": 0.0, "tDH": 0.0, "tOH": 3.0}

chip(ChipType(
    "SRAM512Kx8", "512K x 8 asynchronous CMOS SRAM, 10 ns, 5 V TTL levels "
    "(modelled with separate data-in and data-out pins; on the board they share the I/O pins)",
    _pins([f"A{i}" for i in range(19)] + [f"D{i}" for i in range(8)] + ["CE", "OE", "WE"],
          [f"Q{i}" for i in range(8)]),
    [Cell([f"Q{i}" for i in range(8)], [f"A{i}" for i in range(19)] + ["CE", "OE", "WE"],
          "unsigned a = " + " | ".join(f"({{A{i}}} << {i})" for i in range(19)) + ";"
          " int en = !{CE} && !{OE} && {WE}; unsigned v = en ? {mem}[a] : 0;"
          + "".join(f" {{Q{i}}} = (v >> {i}) & 1;" for i in range(8)))],
    # (no WE -> Q arc: outputs during a store don't matter, so it's a false path)
    [([f"A{i}" for i in range(19)], [f"Q{i}" for i in range(8)], 10.0, 3.0),
     (["OE", "CE"], [f"Q{i}" for i in range(8)], 4.5, 0.0)],
    write="if (!{CE} && !{WE}) { unsigned a = " + " | ".join(f"({{A{i}}} << {i})" for i in range(19))
          + "; {mem}[a] = " + " | ".join(f"({{D{i}}} << {i})" for i in range(8)) + "; }",
    icc_ma=100, pins_pkg=36, family="CMOS", source="10 ns 5 V asynchronous SRAM (part to be chosen)"))


def by_name(name):
    return TYPES[name]


# ---------------------------------------------------------------------------
# Behavioural blocks (not yet designed down to chips)

def _word(prefix, n=32):
    return " | ".join(f"((uint32_t){{{prefix}{i}}} << {i})" for i in range(n))


MUL_LAT, DIV_LAT = 18, 34

chip(ChipType(
    "MULDIV", "multiply/divide unit with HI and LO (behavioural: radix-4 Booth multiply, "
    "radix-2 divide; to be designed down to chips)",
    _pins(["START", "OP0", "OP1", "OP2", "MTHI", "MTLO", "C"]
          + [f"A{i}" for i in range(32)] + [f"B{i}" for i in range(32)],
          [f"HI{i}" for i in range(32)] + [f"LO{i}" for i in range(32)] + ["BUSY"]),
    [Cell([f"HI{i}" for i in range(32)] + [f"LO{i}" for i in range(32)] + ["BUSY"], [],
          "uint32_t hi = {s[0]} | ({s[1]} << 8) | ({s[2]} << 16) | ((uint32_t){s[3]} << 24);"
          " uint32_t lo = {s[4]} | ({s[5]} << 8) | ({s[6]} << 16) | ((uint32_t){s[7]} << 24);"
          + "".join(f" {{HI{i}}} = (hi >> {i}) & 1; {{LO{i}}} = (lo >> {i}) & 1;" for i in range(32))
          + " {BUSY} = {s[8]} != 0;", uses_state=True)],
    [(["C"], [f"HI{i}" for i in range(32)] + [f"LO{i}" for i in range(32)] + ["BUSY"], 2.4, 0.9)],
    checks=[(["START", "OP0", "OP1", "OP2", "MTHI", "MTLO"] + [f"A{i}" for i in range(32)]
             + [f"B{i}" for i in range(32)], "C", 1.5, 1.0)],
    clock="C",
    edge="uint32_t a = " + _word("A") + "; uint32_t b = " + _word("B") + ";"
         " uint32_t hi = {s[0]} | ({s[1]} << 8) | ({s[2]} << 16) | ((uint32_t){s[3]} << 24);"
         " uint32_t lo = {s[4]} | ({s[5]} << 8) | ({s[6]} << 16) | ((uint32_t){s[7]} << 24);"
         " int op = {OP0} | ({OP1} << 1) | ({OP2} << 2);"
         " if ({START}) {"
         "   if (op < 4) {"
         "     uint64_t p = (op & 1) ? (uint64_t)a * b : (uint64_t)((int64_t)(int32_t)a * (int32_t)b);"
         "     if (op & 2) p += ((uint64_t)hi << 32) | lo;"
         "     hi = p >> 32; lo = (uint32_t)p;"
         f"     {{s[8]}} = {MUL_LAT - 2};"
         "   } else {"
         "     if (b == 0) { lo = 0xFFFFFFFF; hi = a; }"
         "     else if (op == 4) {"
         "       int32_t sa = (int32_t)a, sb = (int32_t)b;"
         "       if (sa == INT32_MIN && sb == -1) { lo = (uint32_t)INT32_MIN; hi = 0; }"
         "       else { lo = (uint32_t)(sa / sb); hi = (uint32_t)(sa % sb); }"
         "     } else { lo = a / b; hi = a % b; }"
         f"     {{s[8]}} = {DIV_LAT - 2};"
         "   }"
         " } else {"
         "   if ({MTHI}) hi = a;"
         "   if ({MTLO}) lo = a;"
         "   if ({s[8]}) {s[8]}--;"
         " }"
         " {s[0]} = hi; {s[1]} = hi >> 8; {s[2]} = hi >> 16; {s[3]} = hi >> 24;"
         " {s[4]} = lo; {s[5]} = lo >> 8; {s[6]} = lo >> 16; {s[7]} = lo >> 24;",
    n_state=9, iee_ma=0, pins_pkg=0, family="macro",
    source="behavioural; estimated 60-70 MC10H packages for a chip-level radix-4 design"))
