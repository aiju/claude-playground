# historical-factory-sim

A stylised 3D simulation of a pre-computer factory, accurate to its time in the paperwork, logistics and bureaucracy. The first scenario is the Sherbourne Cycle Company Limited: a fictional, mid-sized Coventry cycle works in 1913, with about 400 hands, card time recorders, six-copy office orders, pay tins on Friday night and horse drays to the LNWR goods yard.

**Status:** design and research. Nothing runs yet.

- [DESIGN.md](DESIGN.md): what we're building and how, including the split between a period-independent engine and the 1913 scenario.
- [Research report](research/reports/Coventry%20cycle%20works%201913.md): the sourced findings behind the design, with about 150 linked sources.
- [Research notes](research/research_notes/Coventry%20cycle%20works%201913/): the detailed notes the report draws on, one file per topic.

## Running it

There's nothing to run yet. The plan (see DESIGN.md, section 10) is a static page using three.js from a CDN with no build step, served by any static file server:

```sh
cd historical-factory-sim
python3 -m http.server 8000
# then open http://localhost:8000
```

Tests will run headless in Node with `node --test`.
