# historical-factory-sim

A stylised 3D simulation of a pre-computer factory, accurate to its time in the paperwork, logistics and bureaucracy. The first scenario is the Sherbourne Cycle Company Limited: a fictional, mid-sized Coventry cycle works in 1913, with about 400 hands, card time recorders, six-copy office orders, pay tins on Friday night and horse drays to the LNWR goods yard.

**Status:** milestone 2 of 7 (see [DESIGN.md](DESIGN.md) §11).

The works stands, with its steam engine, shafting and about 400 people. They clock on at the time office, take breakfast and dinner, and go home. Some are late, some are shut out until after breakfast.

Production runs:
- The Works Manager puts batches through.
- Frames go through building, brazing, pickling, filing, numbering, polishing, three coats of stoved enamel and lining.
- Bright parts are polished, plated and fitted, and wheels are laced and trued.
- Everything meets in the Finishing Shop.
- The machines are tested, viewed, wrapped and taken up to the Stock Room.
- The machine and press shops make parts for stock whenever the Storekeeper's cards fall below their ordering levels.

The works' paperwork and accounts come in the next milestones.

- [DESIGN.md](DESIGN.md): what we're building and how, including the split between a period-independent engine and the 1913 scenario.
- [Research report](research/reports/Coventry%20cycle%20works%201913.md): the sourced findings behind the design, with about 150 linked sources.
- [Research notes](research/research_notes/Coventry%20cycle%20works%201913/): the detailed notes the report draws on, one file per topic.

## Running it

It's a static page that loads three.js from a CDN, with no build step. Serve the folder with any static file server and open it in a browser:

```sh
cd historical-factory-sim
python3 -m http.server 8000
# then open http://localhost:8000
```

Drag to turn the view, right-drag to pan, scroll to zoom, and click on anyone to see who they are, what they're doing and their time card. The buttons along the top change the speed, peel the buildings open floor by floor, and jump to places.

URL parameters are handy for looking at a particular moment:

| Parameter | Example | |
|---|---|---|
| `t` | `?t=1913-03-03T10:30` | Start at that time, with everyone already at work |
| `speed` | `?speed=300` | Sim seconds per real second (60 is one minute a second) |
| `cut` | `?cut=1` or `?cut=open` | Peel the buildings down to that floor, or take the roofs off |
| `cam` | `?cam=engine-house` | A camera preset: `overview`, `gate`, `offices`, `main-block`, `engine-house`, `machine-shop` |
| `seed` | `?seed=7` | A different random week |
| `paused` | `?paused=1` | Start paused |

## Tests

The simulation runs without the 3D view, so it's tested headless in Node (22 or later), with no dependencies:

```sh
cd historical-factory-sim
node --test
```

## Layout

- `engine/`: knows nothing about Coventry or 1913. `engine/sim` is the event kernel, calendar, £ s d, random numbers, the site graph and people. `engine/render` is the three.js view. `engine/ui` is the overlay.
- `scenarios/coventry-1913/`: everything with a date on it: the site plan, timetables, staff, routines and colours.
- `test/`: Node tests.
