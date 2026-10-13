"""python3 -m emc hw {run,sta,bom}: the netlist from the command line."""

import sys

from . import chips, cpu, sta


def _variant(args):
    kw_b, kw_t = {}, {}
    if args.rf:
        kw_b["rf_part"] = args.rf
    if args.e151:
        kw_b["ff"] = kw_t["ff"] = sta.E151
    return kw_b, kw_t


def cmd_run(args):
    from .. import testing
    from . import run
    bad = 0
    for f in args.files:
        path = f if f.endswith(".s") else testing.program_path(f)
        r = run.check(path, max_cycles=args.max)
        bad += not r["ok"]
    return 1 if bad else 0


def print_timing(t, r, n_paths, out=sys.stdout):
    T = r["T"]
    rf, dm = r["rf_write"], r["dm_write"]
    print(f"cycle time {T:.2f} ns, {1000 / T:.1f} MHz", file=out)
    print(f"register file ({rf['part']}): write strobe {rf['t_we0']:.2f}-{rf['t_we1']:.2f} ns, "
          f"read address from {rf['t_rd']:.2f} ns", file=out)
    print(f"data memory: write strobe {dm['t_mw0']:.2f}-{dm['t_mw1']:.2f} ns", file=out)
    for T_end, net, ref, kind, path in sta.critical(t, r, n_paths):
        print(f"\n{T_end:7.2f}  {kind:12} {net} at {ref}", file=out)
        for net2, ref2, d, a in path:
            inst = t.nl.refs.get(ref2)
            name = inst.type.name if inst else ""
            print(f"         {a:6.2f}  +{d:4.2f}  {ref2:18} {name:10} -> {net2}", file=out)


def cmd_sta(args):
    if args.variants:
        for name, desc, T, r, t in sta.run_variants(cpu.build, cpu.EXTERNAL):
            print(f"{name:12} {T:6.2f} ns  {1000 / T:5.1f} MHz   {desc}")
        return 0
    kw_b, kw_t = _variant(args)
    nl = cpu.build(**kw_b)
    t = sta.Timing(nl, cpu.EXTERNAL, **kw_t)
    print_timing(t, t.analyse(), args.paths)
    bad = t.hold_check()
    print(f"\nhold check: {len(bad)} violations" + (f", worst {bad[0]}" if bad else ""))
    return 0


def cmd_bom(args):
    kw_b, _ = _variant(args)
    nl = cpu.build(**kw_b)
    bom = nl.bom()
    print(f"{sum(bom.values())} packages")
    for name, n in sorted(bom.items(), key=lambda kv: -kv[1]):
        desc = chips.TYPES[name].desc
        if args.e151 and name == "10H176":
            name, desc = "10E151", "6-bit D register (in place of the 10H176)"
        print(f"  {n:4}  {name:10} {desc}")
    chip_w, term_w, n_term = nl.power()
    by_block = nl.by_block()
    print("\nper block: packages, chip power")
    for blk in sorted(by_block, key=lambda b: -chip_w.get(b, 0)):
        print(f"  {blk:10} {sum(by_block[blk].values()):4}  {chip_w.get(blk, 0):6.1f} W")
    total = sum(chip_w.values())
    print(f"\nchips {total:.0f} W + {n_term} terminated outputs {term_w:.0f} W = {total + term_w:.0f} W")
    return 0


def add_parser(sub):
    hw = sub.add_parser("hw", help="the chip-level netlist: simulate, timing, parts list")
    hs = hw.add_subparsers(dest="hw_cmd", required=True)
    r = hs.add_parser("run", help="run programs on the netlist and compare with the ISA "
                                  "simulator and the cycle model")
    r.add_argument("files", nargs="+")
    r.add_argument("--max", type=int, default=50_000_000)
    r.set_defaults(fn=cmd_run)
    for name, fn, hlp in (("sta", cmd_sta, "static timing analysis"), ("bom", cmd_bom, "parts list and power")):
        p = hs.add_parser(name, help=hlp)
        p.add_argument("--rf", choices=[f"10E422{g}" for g in chips.RAM422],
                       help="register file part")
        p.add_argument("--e151", action="store_true", help="MC10E151 pipeline registers")
        p.set_defaults(fn=fn)
    s = hs.choices["sta"]
    s.add_argument("--paths", type=int, default=6, help="critical paths to show")
    s.add_argument("--variants", action="store_true", help="cycle time of each part variant")
