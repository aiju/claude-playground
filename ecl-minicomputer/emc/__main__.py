"""Command line: python3 -m emc {asm,run,test,report,hw} ..."""

import argparse
import os
import sys
import time

from . import asm, isa, pipeline, testing


def cmd_asm(args):
    img = asm.assemble_file(isa, args.file)
    for w in img.warnings:
        print("warning:", w, file=sys.stderr)
    if args.listing:
        with open(args.listing, "w") as f:
            f.write(img.listing())
    lo, hi = img.data_extent()
    print(f"{img.code_bytes()} bytes of code ({img.code_bytes() // 4} instructions), "
          f"data {lo:#x}–{hi:#x}")


def cmd_run(args):
    cfg = pipeline.PRESETS[args.config] if args.config else (pipeline.BASE if args.stats else None)
    inp = args.input.encode().decode("unicode_escape").encode("latin-1") if args.input is not None else None
    t0 = time.time()
    m, stop, timing, img = testing.run_program(args.file, inp, cfg, args.max)
    dt = time.time() - t0
    sys.stdout.buffer.write(bytes(m.out))
    sys.stdout.flush()
    if stop.cause != "halt":
        print(f"\n*** {stop}", file=sys.stderr)
    if args.stats:
        print_stats(m, timing, img, dt)
    return 0 if stop.cause == "halt" else 1


def print_stats(m, timing, img, dt):
    err = sys.stderr
    print(f"\n{m.instructions:,} instructions in {dt:.2f} s "
          f"({m.instructions / max(dt, 1e-9) / 1e6:.2f} M/s simulated)", file=err)
    if timing:
        r = timing.report()
        print(f"{r['config']}: {r['cycles']:,} cycles, CPI {r['cpi']:.3f}; "
              f"branches {r['branches']:,}, mispredicted {r['mispredicts']:,}", file=err)
        lost = ", ".join(f"{k} {v:,}" for k, v in sorted(r["lost"].items(), key=lambda kv: -kv[1]))
        print(f"cycles lost: {lost or 'none'}", file=err)
    mix = sorted(m.mnemonic_counts().items(), key=lambda kv: -kv[1])
    total = max(1, m.instructions)
    print("mix: " + ", ".join(f"{k} {100 * v / total:.1f}%" for k, v in mix[:16]), file=err)
    # hottest routines: attribute counts to the nearest preceding global text label
    labels = sorted((a, s) for s, a in img.symbols.items()
                    if img.sym_section.get(s) == "text" and "." not in s)
    import bisect
    addrs = [a for a, _ in labels]
    per = {}
    for idx, c in enumerate(m.counts):
        if c:
            i = bisect.bisect_right(addrs, idx * 4) - 1
            name = labels[i][1] if i >= 0 else "?"
            per[name] = per.get(name, 0) + c
    top = sorted(per.items(), key=lambda kv: -kv[1])[:8]
    print("routines: " + ", ".join(f"{k} {100 * v / total:.1f}%" for k, v in top), file=err)


def cmd_test(args):
    names = args.names or testing.program_names()
    cfg = pipeline.PRESETS[args.config] if args.config else None
    bad = 0
    for name in names:
        t0 = time.time()
        ok, msg, m, timing = testing.check(name, cfg)
        extra = f", {timing.cycles:,} cycles, CPI {timing.cycles / max(1, m.instructions):.3f}" if timing else ""
        print(f"{'ok  ' if ok else 'FAIL'} {name:12} {m.instructions:>12,} instructions{extra}"
              f"  ({time.time() - t0:.1f} s){'' if ok else '  ' + msg}")
        bad += not ok
    print(f"{len(names) - bad}/{len(names)} passed")
    return 1 if bad else 0


def cmd_report(args):
    from . import report
    report.main(args)


def main():
    p = argparse.ArgumentParser(prog="emc")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("asm", help="assemble")
    a.add_argument("file")
    a.add_argument("-l", "--listing")
    a.set_defaults(fn=cmd_asm)
    r = sub.add_parser("run", help="assemble and run")
    r.add_argument("file")
    r.add_argument("--input")
    r.add_argument("--stats", action="store_true")
    r.add_argument("--config", choices=sorted(pipeline.PRESETS))
    r.add_argument("--max", type=int, default=500_000_000)
    r.set_defaults(fn=cmd_run)
    t = sub.add_parser("test", help="run programs against expected output")
    t.add_argument("names", nargs="*")
    t.add_argument("--config", choices=sorted(pipeline.PRESETS))
    t.set_defaults(fn=cmd_test)
    rp = sub.add_parser("report", help="regenerate docs/performance-v0.md")
    rp.set_defaults(fn=cmd_report)
    from .hw import cli as hw_cli
    hw_cli.add_parser(sub)
    args = p.parse_args()
    if getattr(args, "file", None) and not os.path.exists(args.file) and os.path.exists(testing.program_path(args.file)):
        args.file = testing.program_path(args.file)
    try:
        sys.exit(args.fn(args) or 0)
    except asm.AsmError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
