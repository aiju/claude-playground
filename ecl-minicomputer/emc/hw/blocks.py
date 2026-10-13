"""Building blocks for netlists: buses, registers, multiplexers, adders,
gates with both polarities, fan-out, and clock trees.

ECL gates give OR and NOR outputs at once, so every OR made here also gives
its complement for free; and_() uses NOR-of-complements when the
complements are known, which keeps logic one level deep.
"""

from collections import defaultdict

from . import chips  # noqa: F401  (registers the chip types)


def bus(name, n, lo=0):
    return [f"{name}[{i}]" for i in range(lo, lo + n)]


class Builder:
    def __init__(self, nl, decoder_chip=False):
        self.nl = nl
        self.decoder_chip = decoder_chip
        self.comp = {}              # net -> its complement, when one exists
        self.uid = 0
        self.clock_pools = {}
        self.pending = defaultdict(list)   # (domain, block) -> [(d, q)]
        self.ctl = {}               # registered net -> (d, domain)
        self.copies = defaultdict(int)

    def tmp(self, hint="t"):
        self.uid += 1
        return f"_{hint}{self.uid}"

    def block(self, name):
        self.nl.block = name

    # ---- gates ---------------------------------------------------------

    def pair(self, a, b):
        self.comp[a], self.comp[b] = b, a

    def inv(self, x):
        if x == "0":
            return "1"
        if x == "1":
            return "0"
        if x not in self.comp:
            y = self.tmp("n")
            self.nl.gate("nor", [x], f=y)
            self.pair(x, y)
        return self.comp[x]

    def or_(self, xs, out=None, nout=None):
        """OR; the gate's NOR output becomes the complement."""
        xs = [x for x in dict.fromkeys(xs) if x != "0"]
        if "1" in xs:
            raise ValueError("OR with constant 1")
        if not xs:
            return "0"
        if len(xs) > 5:
            xs = [self.or_(xs[i:i + 5]) for i in range(0, len(xs), 5)]
            return self.or_(xs, out, nout)
        out = out or self.tmp("o")
        nout = nout or self.tmp("on")
        self.nl.gate("or", xs, t=out, f=nout)
        self.pair(out, nout)
        return out

    def nor(self, xs, out=None):
        y = self.or_(xs, nout=out)
        return self.comp[y]

    def and_(self, xs, out=None):
        """AND: one NOR of complements if they're all known, else invert first."""
        xs = [x for x in dict.fromkeys(xs) if x != "1"]
        if "0" in xs:
            return "0"
        if not xs:
            return "1"
        if len(xs) == 1 and out is None:
            return xs[0]
        return self.nor([self.inv(x) for x in xs], out)

    def xor(self, a, b, out=None, nout=None):
        out = out or self.tmp("x")
        nout = nout or self.tmp("xn")
        self.nl.gate("xor", [a, b], t=out, f=nout)
        self.pair(out, nout)
        return out

    # ---- registers -----------------------------------------------------

    def reg(self, d, q, domain, block=None):
        """Edge-triggered register bits; packed six to a 10H176 per clock
        domain and block when flush() runs."""
        for dn, qn in zip(d, q):
            self.pending[(domain, block or self.nl.block)].append((dn, qn))
        return q

    def ctl_reg(self, d, q, domain, comp=False):
        """A control bit whose copies fan() may make (and its complement as a
        second flip-flop, if comp and d's complement is known)."""
        self.reg([d], [q], domain)
        self.ctl[q] = (d, domain)
        if comp:
            qn = q + "_n"
            self.reg([self.inv(d)], [qn], domain)
            self.pair(q, qn)
        return q

    def flush(self):
        for (domain, block), bits in self.pending.items():
            for c in range(0, len(bits), 6):
                pins = {"C": self.clock_net(domain)}
                for k, (dn, qn) in enumerate(bits[c:c + 6]):
                    pins[f"D{k}"] = dn
                    pins[f"Q{k}"] = qn
                self.nl.add("10H176", block=block, **pins)
        self.pending.clear()

    # ---- fan-out ---------------------------------------------------------

    def fan(self, net, n):
        """n load slots for net with at most 4 loads per physical net: copies
        of the flip-flop for registered control bits, buffers otherwise."""
        if n <= 4 or net in ("0", "1"):
            return [net] * n
        k = (n + 3) // 4
        if net in self.ctl:
            d, dom = self.ctl[net]
            copies = []
            for _ in range(k):
                self.copies[net] += 1
                c = f"{net}~{self.copies[net]}"
                self.reg([d], [c], dom)
                copies.append(c)
            return [copies[i // 4] for i in range(n)]
        return self.buf(net, n)

    def buf(self, x, n):
        """Fan out through 10H210 sections (3 outputs, 4 loads each)."""
        if n <= 4:
            return [x] * n
        outs = []
        for _ in range((n + 11) // 12):
            o = [self.tmp("b") for _ in range(3)]
            self.nl.gate("clkbuf", [x], t=o)
            outs += o
        return [outs[i // 4] for i in range(n)]

    # ---- multiplexers ---------------------------------------------------

    def _sels(self, sel, n):
        return sel if isinstance(sel, list) else self.fan(sel, n)

    def mux2(self, sel, d0, d1, out, block=None):
        """2:1 multiplexer over buses (10H158, 4 bits per package)."""
        n = len(out)
        chips_ = list(range(0, n, 4))
        sels = self._sels(sel, len(chips_))
        for j, c in enumerate(chips_):
            pins = {"S": sels[j]}
            for k in range(4):
                if c + k < n:
                    pins[f"D0_{k}"] = d0[c + k]
                    pins[f"D1_{k}"] = d1[c + k]
                    pins[f"Q{k}"] = out[c + k]
            self.nl.add("10H158", block=block, **pins)
        return out

    def mux4(self, a, b, srcs, out, en="0", block=None):
        """4:1 multiplexer over buses (10H174, 2 bits per package). srcs: 4
        buses or constants; en=1 forces the outputs low."""
        n = len(out)
        groups = [list(range(c, min(c + 2, n))) for c in range(0, n, 2)]
        aa, bb, ee = self._sels(a, len(groups)), self._sels(b, len(groups)), self._sels(en, len(groups))
        for j, g in enumerate(groups):
            pins = {"A": aa[j], "B": bb[j], "E": ee[j]}
            for half, k in zip(("XZ", "YW"), g):
                for m in range(4):
                    s = srcs[m]
                    pins[f"{half[0]}{m}"] = s if isinstance(s, str) else s[k]
                pins[half[1]] = out[k]
            self.nl.add("10H174", block=block, **pins)
        return out

    # ---- clocks --------------------------------------------------------

    def clock_domain(self, name, hold):
        """A gated clock domain: CLK OR hold (hold must be stable while the
        clock is low)."""
        self.clock_pools[name] = {"hold": hold, "outs": [], "loads": []}

    def clock_net(self, domain):
        p = self.clock_pools[domain]
        for i, used in enumerate(p["loads"]):
            if used < 4:
                p["loads"][i] += 1
                return p["outs"][i]
        k = len(p["outs"])
        outs = [f"clk_{domain}_{k + j}" for j in range(3)]
        self.nl.gate("clkbuf", ["CLK", p["hold"]], t=outs, block="clock")
        p["outs"] += outs
        p["loads"] += [1, 0, 0]
        return outs[0]

    # ---- arithmetic -----------------------------------------------------

    def adder(self, a, b, s, m, cin, f, cout=None, block=None, prefix="add"):
        """32-bit ALU from 8 x 10H181 and 2 x 10H179. s: S0..S3 (nets or
        lists of per-package nets); a, b, f: 32-bit buses (constants allowed,
        None in f for unused outputs)."""
        gg, pg, cn4 = bus(prefix + "_gg", 8), bus(prefix + "_pg", 8), bus(prefix + "_c4", 8)
        c = [None] * 8
        c8, c16, c24 = prefix + "_c8", prefix + "_c16", prefix + "_c24"
        cout = cout or prefix + "_cout"
        c[0], c[1], c[2], c[3] = cin, cn4[0], c8, cn4[2]
        c[4], c[5], c[6], c[7] = c16, cn4[4], c24, cn4[6]
        sv = [self._sels(x, 8) for x in s]
        mv = self._sels(m, 8)
        for k in range(8):
            pins = {"S0": sv[0][k], "S1": sv[1][k], "S2": sv[2][k], "S3": sv[3][k], "M": mv[k], "CN": c[k],
                    "GG": gg[k], "PG": pg[k]}
            if k in (0, 2, 4, 6):
                pins["CN4"] = cn4[k]
            for i in range(4):
                pins[f"A{i}"] = a[4 * k + i]
                pins[f"B{i}"] = b[4 * k + i]
                if f[4 * k + i] is not None:
                    pins[f"F{i}"] = f[4 * k + i]
            self.nl.add("10H181", block=block, **pins)
        self.nl.add("10H179", block=block, CN=cin, CN2=c8, CN4=c16,
                    **{f"G{i}": gg[i] for i in range(4)}, **{f"P{i}": pg[i] for i in range(4)})
        self.nl.add("10H179", block=block, CN=c16, CN2=c24, CN4=cout,
                    **{f"G{i}": gg[4 + i] for i in range(4)}, **{f"P{i}": pg[4 + i] for i in range(4)})
        return f, cout

    def ne5(self, a, b, block=None):
        """5-bit inequality from one 10H166 (its two outputs dotted). Returns
        the 'not equal' net."""
        ne = self.tmp("ne")
        self.nl.add("10H166", block=block, LT=ne, GT=ne,
                    **{f"A{i}": a[i] for i in range(5)}, **{f"B{i}": b[i] for i in range(5)})
        return ne

    def decoder(self, sel, e0, e1, outs):
        """3-to-8 decoder: outs[k] high when sel == k and both active-low
        enables are low; None leaves an output unused. Built from NOR gates
        (one 5-input NOR per output, from the select bits or their
        complements), because the 10H162 is no longer sold; decoder_chip
        uses the 10H162 instead."""
        if not self.decoder_chip:
            for k, o in enumerate(outs):
                if o is not None:
                    lits = [self.inv(s) if (k >> i) & 1 else s for i, s in enumerate(sel)]
                    self.nor(lits + [e0, e1], out=o)
            return outs
        pins = {"A": sel[0], "B": sel[1], "C": sel[2], "E0": e0, "E1": e1}
        for k, o in enumerate(outs):
            if o is not None:
                pins[f"Q{k}"] = o
        self.nl.add("10H162", **pins)
        return outs
