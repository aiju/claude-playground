# ecl-minicomputer

Design exploration for a minicomputer built from ECL logic, aimed at raw
integer number-crunching speed. It's a pipelined 32-bit load/store RISC with
hardwired control (no microcode). It works as an attached processor: it
has its own fast local memories and a slow TTL main bus to a host.

It's a sibling of [ttl-minicomputer](../ttl-minicomputer) and borrows that
project's way of working:

1. a spec;
2. an assembler and simulator;
3. a suite of programs checked against Python;
4. a cycle model;
5. a chip-level implementation with timing analysis.

**Status: draft 0 done.**

- **ISA:** a 32-bit integer ISA with an assembler, a simulator and an exact
  cycle model.
- **Benchmarks:** twelve programs checked against Python references.
- **Hardware:** a chip-level netlist of a 5-stage pipeline in MC10H ECL:
  710 packages, 32.6 MHz worst case (36 MHz with ECLinPS registers),
  about 300 W.
- **Verification:** the netlist runs every program with the same results
  as the simulator, in exactly the predicted number of cycles.

Start with [the evaluation](docs/evaluation-v0.md): what draft 0 shows,
proposals for draft 1, and open questions.

| Document | What's in it |
|---|---|
| [docs/design-notes.md](docs/design-notes.md) | Round 0: what ECL changes, what number crunching pushes towards, rough sizes, the first questions and answers |
| [docs/isa-v0.md](docs/isa-v0.md) | ISA draft 0: registers, memory, encodings, instructions, assembler syntax, calling convention |
| [docs/hardware-v0.md](docs/hardware-v0.md) | The draft 0 implementation: pipeline, clocking, blocks, timing, what isn't designed yet |
| [docs/parts.md](docs/parts.md) | Which ECL, RAM and translator parts can still be bought, at what price; power |
| [docs/performance-v0.md](docs/performance-v0.md) | Cycles for every program on the hardware and on pipeline variants (generated) |
| [docs/evaluation-v0.md](docs/evaluation-v0.md) | What draft 0 shows, proposals for draft 1, questions |
| [docs/notes-v0/](docs/notes-v0) | The benchmark programmers' notes: tuning, lost cycles, the instructions they missed |

## Running things

Needs Python 3.10 or later; the hardware simulator also needs gcc.

```sh
python3 -m emc run programs/hello.s --stats   # assemble and run; cycles, instruction mix, hot routines
python3 -m emc run sieve --config p5-perfect  # programs/NAME.s, with another pipeline configuration
python3 -m emc asm programs/hello.s -l hello.lst
python3 -m emc test                           # every program against programs/expected
python3 -m unittest discover tests            # instruction semantics, assembler, pipeline model
python3 -m emc report                         # regenerate docs/performance-v0.md (a few minutes)
```

The hardware commands also need gcc:

```sh
python3 -m emc hw run sieve fib               # run on the chip-level netlist, compare with the simulator
python3 -m emc hw sta                         # static timing analysis: cycle time, critical paths
python3 -m emc hw sta --variants              # the same for each part variant
python3 -m emc hw bom                         # parts list, power per block
```

## Layout

```
emc/asm.py        assembler core: expressions, labels, sections, directives, relaxation
emc/isa.py        draft 0 encodings, assembler hook, disassembler
emc/sim.py        instruction-level simulator
emc/pipeline.py   cycle model of the 5-stage pipeline, with variants for design exploration
emc/testing.py    running programs against expected output
emc/report.py     generates docs/performance-v0.md
emc/hw/           the chip-level netlist, its simulator and timing analysis (see docs/hardware-v0.md)
programs/         programs, programs/lib (startup, console, number printing),
                  programs/expected (outputs), programs/ref (Python references),
                  programs/gen (generators for the unrolled sha256 and aes)
tests/            unit tests; tests/hw/exercise.s for the netlist
```
