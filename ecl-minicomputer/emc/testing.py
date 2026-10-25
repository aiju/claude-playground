"""Running programs: assemble, simulate, compare with the expected output."""

import os

from . import asm, isa, pipeline
from .sim import Machine

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROGRAMS = os.path.join(ROOT, "programs")
EXPECTED = os.path.join(PROGRAMS, "expected")
INPUTS = os.path.join(PROGRAMS, "inputs")


def program_names():
    return sorted(f[:-2] for f in os.listdir(PROGRAMS) if f.endswith(".s"))


def program_path(name):
    return name if name.endswith(".s") else os.path.join(PROGRAMS, name + ".s")


def program_input(name):
    p = os.path.join(INPUTS, os.path.basename(name).removesuffix(".s") + ".txt")
    if os.path.exists(p):
        with open(p, "rb") as f:
            return f.read()
    return b""


def run_program(path, input_bytes=None, config=None, max_instructions=500_000_000):
    """Assemble and run. Returns (machine, stop, timing or None, image)."""
    img = asm.assemble_file(isa, path)
    if input_bytes is None:
        input_bytes = program_input(path)
    m = Machine(img, input_bytes)
    timing = pipeline.Timing(m, config) if config is not None else None
    stop = m.run(max_instructions, timing)
    return m, stop, timing, img


def check(name, config=None):
    """Run one program against programs/expected. Returns (ok, message, machine, timing)."""
    path = program_path(name)
    exp_path = os.path.join(EXPECTED, os.path.basename(path)[:-2] + ".txt")
    m, stop, timing, img = run_program(path, config=config)
    if stop.cause != "halt":
        return False, f"stopped: {stop}", m, timing
    if not os.path.exists(exp_path):
        return False, "no expected output", m, timing
    with open(exp_path, "rb") as f:
        want = f.read()
    if bytes(m.out) != want:
        got = bytes(m.out)
        i = next((k for k in range(min(len(got), len(want))) if got[k] != want[k]),
                 min(len(got), len(want)))
        return False, (f"output differs at byte {i}: got {got[max(0, i - 20):i + 20]!r}, "
                       f"want {want[max(0, i - 20):i + 20]!r}"), m, timing
    return True, "ok", m, timing
