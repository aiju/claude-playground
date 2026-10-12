"""Run programs on the chip-level netlist and check them against the
instruction-level simulator and the cycle model.

The testbench drives the clock and the two strobes of each cycle, models
the main-bus bridge (the console, with a fixed number of wait cycles) and
counts cycles.

A cycle in the testbench:
  write phase  CLK high, RFSEL/RFWS/MWS active: the register file and the
               data memory take their writes
  read phase   CLK low, strobes off: everything settles for the next edge
  edge         CLK rises: flip-flops whose (gated) clock rose take D
"""

import ctypes
import sys

from .. import asm, isa, pipeline
from ..sim import Machine
from . import cpu, csim

TESTBENCH = r"""
long tb_cycles, tb_retired, tb_bus_cycles = 20, tb_bus_cnt;
long tb_rlog[1 << 22];
int tb_error;
uint32_t tb_err_addr;
unsigned char tb_out[1 << 20]; long tb_outn;
unsigned char tb_in[1 << 16]; long tb_inn, tb_inpos;

static const int W_D[32] = { {ids:w_d:32} };
static const int W_DEST[5] = { {ids:w_dest:5} };
static const int M_RES[32] = { {ids:m_res:32} };
static const int M_SDF[32] = { {ids:m_sdf:32} };
static const int BUSRD_IDS[32] = { {ids:BUSRD:32} };

static uint32_t word(const int *ids, int k) {
  uint32_t v = 0;
  for (int i = 0; i < k; i++) v |= (uint32_t)n[ids[i]] << i;
  return v;
}

void tb_cycle(void) {
  /* write phase */
  {net:CLK} = 1; {net:RFSEL} = 1; {net:RFWS_N} = 0; {net:MWS_N} = 0;
  eval();
  writes();
  /* read phase */
  {net:RFSEL} = 0; {net:RFWS_N} = 1; {net:MWS_N} = 1; {net:CLK} = 0;
  eval();
  /* an instruction leaving MEM enters WB next cycle */
  if (!{net:hold_p} && {net:m_v} && !{net:RESET}) {
    if (tb_retired < (1 << 22)) tb_rlog[tb_retired] = tb_cycles + 1;
    tb_retired++;
  }
  int done_next = 0;
  uint32_t rd = 0;
  if ({net:m_bus} && !{net:BUSDONE} && !{net:halted}) {
    if (++tb_bus_cnt >= tb_bus_cycles) {
      tb_bus_cnt = 0;
      done_next = 1;
      uint32_t a = word(M_RES, 32);
      if ((a & ~3u) != 0xFFFFFF00u) { tb_error = 1; tb_err_addr = a; }
      else if ({net:m_st}) { if (tb_outn < (long)sizeof tb_out) tb_out[tb_outn++] = word(M_SDF, 8); }
      else rd = tb_inpos < tb_inn ? tb_in[tb_inpos++] : 0xFFFFFFFFu;
    }
  }
  snapshot();
  {net:CLK} = 1;
  eval_clock();
  capture();
  {net:BUSDONE} = done_next;
  for (int i = 0; i < 32; i++) n[BUSRD_IDS[i]] = (rd >> i) & 1;
  if (!{net:RESET}) tb_cycles++;
}

void tb_clear(void) {
  memset(n, 0, sizeof n); memset(st, 0, sizeof st);
  tb_cycles = tb_retired = tb_bus_cnt = tb_outn = tb_inpos = 0; tb_error = 0;
}

void tb_reset(void) {
  {net:RESET} = 1;
  for (int i = 0; i < 4; i++) tb_cycle();
  {net:RESET} = 0;
  tb_cycles = tb_retired = 0;
}

/* run until halted, a testbench error or max_cycles; returns 1 if halted */
int tb_run(long max_cycles) {
  while (tb_cycles < max_cycles) {
    tb_cycle();
    if (tb_error) return -1;
    if ({net:halted}) return 1;
  }
  return 0;
}

int tb_halted(void) { return {net:halted}; }
int tb_net(int id) { return n[id]; }
"""


class HwSim:
    def __init__(self, bus_cycles=20):
        self.nl = cpu.build()
        self.model, self.lib = csim.build(self.nl, cpu.EXTERNAL, TESTBENCH, name="cpu")
        lib = self.lib
        lib.tb_run.restype = ctypes.c_int
        lib.tb_run.argtypes = [ctypes.c_long]
        lib.mem_ptr.restype = ctypes.POINTER(ctypes.c_uint8)
        ctypes.c_long.in_dll(lib, "tb_bus_cycles").value = bus_cycles
        self.mem = {inst.ref: lib.mem_ptr(i) for i, inst in enumerate(self.model.mems)}

    def load(self, img, input_bytes=b""):
        self.lib.tb_clear()
        for m in self.mem.values():
            ctypes.memset(m, 0, 1 << 19)
        for idx, w in img.text.items():
            for lane in range(4):
                self.mem[f"IMEM{lane}"][idx] = (w >> (8 * lane)) & 0xFF
        for a, v in img.data.items():
            self.mem[f"DMEM{a & 3}"][a >> 2] = v
        buf = (ctypes.c_uint8 * len(input_bytes)).from_buffer_copy(input_bytes) if input_bytes else None
        tb_in = (ctypes.c_uint8 * 65536).in_dll(self.lib, "tb_in")
        for i, c in enumerate(input_bytes):
            tb_in[i] = c
        ctypes.c_long.in_dll(self.lib, "tb_inn").value = len(input_bytes)
        del buf

    def run(self, max_cycles=50_000_000):
        self.lib.tb_reset()
        status = self.lib.tb_run(max_cycles)
        lib = self.lib
        cycles = ctypes.c_long.in_dll(lib, "tb_cycles").value
        retired = ctypes.c_long.in_dll(lib, "tb_retired").value
        outn = ctypes.c_long.in_dll(lib, "tb_outn").value
        out = bytes((ctypes.c_uint8 * outn).in_dll(lib, "tb_out")) if outn else b""
        if status == -1:
            addr = ctypes.c_uint32.in_dll(lib, "tb_err_addr").value
            raise RuntimeError(f"bus access to unmapped address {addr:#x}")
        return status, cycles, retired, out

    def net(self, name):
        return self.lib.tb_net(self.model.net_id[name])

    def word(self, name, k=32):
        return sum(self.net(f"{name}[{i}]") << i for i in range(k))

    def registers(self):
        """The 32 registers, read from register-file copy A."""
        st = (ctypes.c_uint8 * self.model.n_state).in_dll(self.lib, "st")
        regs = []
        for r in range(32):
            v = 0
            for c in range(8):
                base = self.model.state_base[f"RFA_{c}"]
                v |= (st[base + r] & 15) << (4 * c)
            regs.append(v)
        return regs

    def dmem(self, addr, n):
        return bytes(self.mem[f"DMEM{a & 3}"][a >> 2] for a in range(addr, addr + n))


def check(path, input_bytes=None, max_cycles=50_000_000, verbose=True):
    """Run a program on the netlist and on the ISA simulator + cycle model.
    Returns a dict of results; 'ok' says whether output, registers, data
    memory and cycle count all agree."""
    from ..testing import program_input
    img = asm.assemble_file(isa, path)
    if input_bytes is None:
        input_bytes = program_input(path)
    m = Machine(img, input_bytes)
    t = pipeline.Timing(m, pipeline.HW)
    stop = m.run(200_000_000, t)
    hw = HwSim(bus_cycles=pipeline.HW.bus_cycles)
    hw.load(img, input_bytes)
    status, cycles, retired, out = hw.run(max_cycles)
    res = {"isa_out": bytes(m.out), "hw_out": out, "isa_instr": m.instructions, "hw_retired": retired,
           "model_cycles": t.cycles, "hw_cycles": cycles, "status": status, "stop": stop}
    regs = hw.registers()
    reg_ok = all(regs[i] == m.R[i] for i in range(32))
    lo, hi = img.data_extent() if img.data else (0, 0)
    mem_ok = True
    if hi > lo:
        mem_ok = hw.dmem(lo, hi - lo) == bytes(m.dmem[lo:hi])
    same = lambda ok: "same" if ok else "DIFFERENT"  # noqa: E731
    out_ok, cyc_ok = out == bytes(m.out), cycles == t.cycles
    res.update(reg_ok=reg_ok, mem_ok=mem_ok, regs=regs, isa_regs=list(m.R),
               ok=status == 1 and out_ok and reg_ok and mem_ok and cyc_ok)
    if verbose:
        # the HALT instruction never reaches WB, so the netlist retires one fewer
        print(f"{path}: {'halted' if status == 1 else 'did NOT halt'} after {cycles:,} cycles "
              f"(model {t.cycles:,}), retired {retired:,} + halt (ISA {m.instructions:,}); "
              f"output {same(out_ok)}, registers {same(reg_ok)}, memory {same(mem_ok)}, "
              f"cycles {same(cyc_ok)}")
    return res


if __name__ == "__main__":
    for p in sys.argv[1:]:
        check(p)
