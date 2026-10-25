"""The chip-level netlist: programs on the netlist simulator against the ISA
simulator and the cycle model, and timing sanity. Needs gcc."""

import os
import shutil
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from emc import testing  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


@unittest.skipUnless(shutil.which("gcc"), "needs gcc")
class Netlist(unittest.TestCase):
    def check(self, path):
        from emc.hw import run
        r = run.check(path, max_cycles=1_000_000, verbose=False)
        self.assertEqual(r["status"], 1, "did not halt")
        self.assertEqual(r["hw_out"], r["isa_out"])
        self.assertTrue(r["reg_ok"], "registers differ")
        self.assertTrue(r["mem_ok"], "data memory differs")
        self.assertEqual(r["hw_cycles"], r["model_cycles"])

    def test_exercise(self):
        """Every instruction and hazard case."""
        self.check(os.path.join(HERE, "hw", "exercise.s"))

    def test_hello(self):
        self.check(testing.program_path("hello"))


class Timing(unittest.TestCase):
    def test_no_hold_violations_and_cycle_time(self):
        from emc.hw import cpu, sta
        nl = cpu.build()
        t = sta.Timing(nl, cpu.EXTERNAL)
        self.assertEqual(t.hold_check(), [])
        self.assertLess(t.analyse()["T"], 32.0)


if __name__ == "__main__":
    unittest.main()
