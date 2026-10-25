"""Static timing analysis of the ECL netlist.

Time zero is the rising clock edge at the flip-flops. The clock tree is
taken as ideal plus a skew budget (an EL11 -> E111 tree, about 0.5 ns), which
is subtracted from every setup check and added to every hold check.

Arrival times propagate through the timing arcs of every cell (worst-case
datasheet maxima at 75 °C, minima for hold), plus a wire delay per net:

  base length:  0.3 ns if driver and loads are in one block, 0.75 ns if not
                (about 2 and 5 inches of microstrip at 0.148 ns/inch,
                HB205); TTL-side nets to the SRAMs another 0.45 ns
  loading:      0.1 ns per load (50 ohm to -2 V, R6 p1-16)
  wired-OR:     0.05 ns per extra output on the net (R6 p1-26)

Sources: flip-flop outputs (clock-to-Q), and the strobes of the cycle:

  RFSEL   register-file address select: write address from the clock edge
          until t_rd, read address after
  RFWS    register-file write strobe, t_we0 .. t_we1
  MWS     data-memory write strobe, t_mw0 .. t_mw1

The strobe times are placed by the analysis as early as the write
constraints allow (absolute times after the edge, as a delay line or a
multi-phase clock would give them), then the cycle time T is the largest of

  * every flip-flop input:  arrival + setup + skew
  * the clock-gating inputs (hold_p, hold_f): stable before the clock's
    low phase (the last t_low ns of the cycle)
  * the register-file write: address and data setup before WE falls, the
    WE pulse width, address hold after WE rises (chips.RAM_WRITE, from the
    10E422 data sheet)
  * the data-memory write: tAS 0, tWP 7, tDW 5, tAW 7 (CY7C1049G-10)

hold_check() checks min-delay paths against hold time plus skew, and
fix_hold() adds delay buffers where they fail. VARIANTS lists the part
substitutions that run_variants() compares.
"""

import math
from collections import defaultdict

from . import chips, csim

NEG = -math.inf


class Timing:
    def __init__(self, nl, external, skew=0.5, strobe_tol=0.25, scale=1.0, ext_arrival=None,
                 t_low=4.0, asym=0.3, ff=None):
        self.nl = nl
        self.model = csim.Model(nl, external)
        self.skew = skew
        self.tol = strobe_tol
        self.scale = scale
        self.t_low = t_low          # the clock's low phase (the clock is asymmetric)
        self.asym = asym            # rise/fall difference of one gate on a strobe path
        # ff: timing of the pipeline flip-flops instead of the 10H176's, as
        # (clock-to-Q max, min, setup, hold), e.g. MC10E151 (0.80, 0.475, 0.0, 0.35)
        self.ff = ff
        self.ext = ext_arrival or {}
        self.loads = defaultdict(list)
        self.drivers = defaultdict(list)
        for inst in nl.instances:
            for pin, net in inst.conn.items():
                (self.drivers if inst.type.kind(pin) == "out" else self.loads)[net].append((inst, pin))
        self.clock_nets = {inst.conn[inst.type.clock] for inst in nl.instances
                           if inst.type.clock and inst.type.clock in inst.conn}

    # ---- wires ---------------------------------------------------------

    def wire(self, net, kind="max"):
        if net in ("0", "1"):
            return 0.0
        drv, lds = self.drivers.get(net, []), self.loads.get(net, [])
        blocks = {i.block for i, _ in drv + lds}
        base = 0.3 if len(blocks) <= 1 else 0.75
        if any(i.type.family == "CMOS" for i, _ in lds + drv):
            base += 0.45
        if kind == "min":
            return base * 0.5
        return base + 0.1 * len(lds) + 0.05 * max(0, len(drv) - 1)

    # ---- propagation ---------------------------------------------------

    def propagate(self, sources, kind="max", clocks=True):
        """sources: net -> time at the driver. Returns net -> arrival
        (at the driver output) and net -> (cause net, inst ref, delay)."""
        arr = dict(sources)
        why = {}
        better = max if kind == "max" else min
        for k in self.model.order:
            inst, cell = self.model.cells[k]
            arcs = inst.type.arcs
            for out in cell.outs:
                onet = inst.conn.get(out)
                if onet is None or onet in sources or onet in self.clock_nets:
                    continue
                best, cause = None, None
                for frm, to, dmax, dmin in arcs:
                    if out not in to:
                        continue
                    d = (dmax if kind == "max" else dmin) * self.scale
                    if self.ff and inst.type.name == "10H176" and frm == ["C"]:
                        d = self.ff[0] if kind == "max" else self.ff[1]
                    for p in frm:
                        inet = inst.conn.get(p, "0")
                        if inet in self.clock_nets and inst.type.clock == p:
                            if not clocks:
                                continue
                            t = 0.0          # clock pin: the edge
                        elif inet in arr:
                            t = arr[inet] + self.wire(inet, kind)
                        else:
                            continue
                        v = t + d
                        if best is None or (v > best if kind == "max" else v < best):
                            best, cause = v, (inet, inst.ref, d)
                if best is None:
                    continue
                if onet in arr:
                    if better(arr[onet], best) == arr[onet]:
                        continue
                arr[onet] = best
                why[onet] = cause
        return arr, why

    def path(self, why, net, arr):
        out = []
        seen = set()
        while net in why and net not in seen:
            seen.add(net)
            inet, ref, d = why[net]
            out.append((net, ref, d, arr[net]))
            net = inet
        out.append((net, "", 0.0, arr.get(net, 0.0)))
        return list(reversed(out))

    # ---- the analysis --------------------------------------------------

    def analyse(self):
        nl = self.nl
        rf = [i for i in nl.instances if i.type.name in chips.RAM_WRITE]
        rw = chips.RAM_WRITE[rf[0].type.name]
        sram_d = [i for i in nl.instances if i.ref.startswith("DMEM")]
        ext = {"RESET": 2.4, "BUSDONE": 2.4, **{f"BUSRD[{i}]": 6.0 for i in range(32)}}
        ext.update(self.ext)
        tol = self.tol

        def pins_arr(arr, insts, pins, kind="max"):
            vals = [arr[i.conn[p]] + self.wire(i.conn[p], kind) for i in insts for p in pins
                    if i.conn.get(p) in arr]
            return (max if kind == "max" else min)(vals)

        def path_delay(src, insts, pin):
            mx, _ = self.propagate({src: 0.0}, clocks=False)
            mn, _ = self.propagate({src: 0.0}, kind="min", clocks=False)
            return pins_arr(mn, insts, [pin], "min"), pins_arr(mx, insts, [pin])

        # 1. register-file write. RFSEL selects the write address from the edge.
        src = dict(ext)
        src["RFSEL"] = 0.0
        arr_w, _ = self.propagate(src)
        addr_pins = [f"A{k}" for k in range(8)]
        addr_w = pins_arr(arr_w, rf, addr_pins)
        data_w = pins_arr(arr_w, rf, [f"D{k}" for k in range(4)])
        d_we_min, d_we_max = path_delay("RFWS_N", rf, "WE")
        d_sel_min, _ = path_delay("RFSEL", rf, "A0")
        t_we0 = addr_w + rw["tSA"] - d_we_min + tol
        t_we1 = max(t_we0 + rw["tW"] + self.asym + 2 * tol,
                    data_w + rw["tSD"] - d_we_min + tol)
        t_rd = t_we1 + d_we_max + rw["tHA"] - d_sel_min + tol
        rf_write = {"part": rf[0].type.name, "addr_valid": addr_w, "data_valid": data_w,
                    "t_we0": t_we0, "t_we1": t_we1, "t_rd": t_rd,
                    "we_path": (d_we_min, d_we_max), "sel_min": d_sel_min}

        # 2. data-memory write strobe (CY7C1049G-10: tAS 0, tWP 7, tAW 7, tDW 5)
        dm_addr = pins_arr(arr_w, sram_d, [f"A{k}" for k in range(19)])
        dm_data = pins_arr(arr_w, sram_d, [f"D{k}" for k in range(8)])
        d_mw_min, d_mw_max = path_delay("MWS_N", sram_d, "WE")
        t_mw0 = dm_addr - d_mw_min + tol
        t_mw1 = max(t_mw0 + 7.0 + (d_mw_max - d_mw_min) + 2 * tol,
                    dm_addr + 7.0 - d_mw_min + tol,
                    dm_data + 5.0 - d_mw_min + tol)
        # the address must hold until WE rises; it changes at the next edge
        # at the earliest after clock-to-Q (0.9) and the 10H125 (0.8)
        dm_write = {"addr_valid": dm_addr, "data_valid": dm_data, "t_mw0": t_mw0, "t_mw1": t_mw1,
                    "we_path": (d_mw_min, d_mw_max), "T_min": t_mw1 + d_mw_max + tol - 1.7 + self.skew}

        # 3. the whole cycle with the strobes in place
        src = dict(ext)
        src.update({"RFSEL": t_rd, "RFWS_N": t_we1, "MWS_N": t_mw1})
        arr, why = self.propagate(src)
        ends = []
        for inst in nl.instances:
            for data, clk, setup, hold in inst.type.checks:
                if self.ff and inst.type.name == "10H176":
                    setup = self.ff[2]
                for p in data:
                    net = inst.conn.get(p)
                    if net is None or net not in arr:
                        continue
                    ends.append((arr[net] + self.wire(net) + setup + self.skew, net, inst.ref, "setup"))
        for net in ("hold_p", "hold_f"):
            if net in arr:
                # stable while the clock is low (before T - t_low)
                ends.append((arr[net] + 0.2 + self.skew + self.t_low, net, "clock gate", "gate"))
        ends.append((dm_write["T_min"], "MWS_N", "DMEM", "memory write"))
        ends.sort(reverse=True)
        return {"T": ends[0][0], "ends": ends, "arr": arr, "why": why, "rf_write": rf_write, "dm_write": dm_write}

    def hold_check(self):
        """Min-delay paths from flip-flop to flip-flop against hold + skew."""
        src = {"RESET": 0.9, "BUSDONE": 0.9, "RFSEL": 0.0, "RFWS_N": 0.0, "MWS_N": 0.0}
        src.update({f"BUSRD[{i}]": 0.9 for i in range(32)})
        arr, why = self.propagate(src, kind="min")
        bad = []
        for inst in self.nl.instances:
            for data, clk, setup, hold in inst.type.checks:
                if self.ff and inst.type.name == "10H176":
                    hold = self.ff[3]
                for p in data:
                    net = inst.conn.get(p)
                    if net is None or net not in arr or net in ("0", "1"):
                        continue
                    a = arr[net] + self.wire(net, "min")
                    slack = a - (hold + self.skew)
                    if slack < 0:
                        bad.append((slack, net, inst.ref))
        bad.sort()
        return bad


def fix_hold(nl, external, ff=None, rounds=3):
    """Put a 10H101 OR section (0.5 ns minimum) in front of every flip-flop
    input that fails the hold check, the usual cure for direct
    register-to-register paths: one buffer per failing net, shared by the
    failing inputs only. Returns the number of buffers added."""
    added = 0
    for _ in range(rounds):
        bad = Timing(nl, external, ff=ff).hold_check()
        if not bad:
            return added
        sinks = defaultdict(set)
        for _slack, net, ref in bad:
            sinks[net].add(ref)
        for net, refs in sinks.items():
            delayed = net + "~h"
            for ref in refs:
                inst = nl.refs[ref]
                for data, _clk, _setup, _hold in inst.type.checks:
                    for p in data:
                        if inst.conn.get(p) == net:
                            inst.conn[p] = delayed
            nl.gate("delay", [net], t=delayed, block=nl.refs[min(refs)].block)
            added += 1
    bad = Timing(nl, external, ff=ff).hold_check()
    if bad:
        raise ValueError(f"hold violations left after {rounds} rounds: {bad[:5]}")
    return added


E151 = (0.80, 0.475, 0.0, 0.35)       # MC10E151 6-bit register, DL140 p2-45

VARIANTS = [
    ("10H", "all MC10H, 10E422-7 register file", {}, {}),
    ("10H, 422-5", "as above with the 5 ns 10E422 grade", {"rf_part": "10E422-5"}, {}),
    ("E151 regs", "pipeline registers MC10E151 (ECLinPS), 10E422-7", {"ff": E151}, {"ff": E151}),
    ("E151, 422-5", "MC10E151 registers and the 5 ns 10E422", {"rf_part": "10E422-5", "ff": E151},
     {"ff": E151}),
]


def critical(t, r, n=8):
    """The n worst endpoints, one per bus, with their paths."""
    out, seen = [], set()
    for T, net, ref, kind in r["ends"]:
        if len(out) >= n:
            break
        key = net.split("[")[0]
        if key in seen:
            continue
        seen.add(key)
        path = t.path(r["why"], net, r["arr"]) if kind in ("setup", "gate") else []
        out.append((T, net, ref, kind, path))
    return out


def run_variants(build, external):
    res = []
    for name, desc, bkw, tkw in VARIANTS:
        nl = build(**bkw)
        t = Timing(nl, external, **tkw)
        r = t.analyse()
        res.append((name, desc, r["T"], r, t))
    return res
