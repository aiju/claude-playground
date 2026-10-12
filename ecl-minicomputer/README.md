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

**Status: draft 0, in progress.**

| Document | What's in it |
|---|---|
| [docs/design-notes.md](docs/design-notes.md) | Round 0: what ECL changes, what number crunching pushes towards, rough sizes, the first questions and answers |
| [docs/isa-v0.md](docs/isa-v0.md) | ISA draft 0: registers, memory, encodings, instructions, assembler syntax, calling convention |

## Running things

Needs Python 3.10 or later; nothing else.

```sh
python3 -m emc run programs/hello.s --stats   # assemble and run; cycles, instruction mix, hot routines
python3 -m emc run sieve --config p5-perfect  # programs/NAME.s, with another pipeline configuration
python3 -m emc asm programs/hello.s -l hello.lst
python3 -m emc test                           # every program against programs/expected
python3 -m unittest discover tests            # instruction semantics, assembler, pipeline model
```

## Layout

```
emc/asm.py        assembler core: expressions, labels, sections, directives, relaxation
emc/isa.py        draft 0 encodings, assembler hook, disassembler
emc/sim.py        instruction-level simulator
emc/pipeline.py   cycle model of the 5-stage pipeline, with variants for design exploration
emc/testing.py    running programs against expected output
programs/         programs, programs/lib (startup, console, number printing),
                  programs/expected (outputs)
tests/            unit tests
```
