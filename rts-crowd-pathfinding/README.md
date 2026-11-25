# rts-crowd-pathfinding

*Coming Through* (すみません、通ります): a browser toy where a few hundred little
walkers find their way across a floor plan, around the walls and around each
other, the way units in a real-time strategy game have to. You can redraw the
walls while they walk.

## Run it

Open `index.html` in a browser. There is no build step and nothing to install.

- Drag on the floor to build walls; drag on a wall to erase.
- Drag the markers (A, B, the compass points, the flag) to move the destinations.
- Tap a walker to see the route it is following. With **Flow field** on, the
  arrows show that walker's whole field.
- Space pauses.

Traffic patterns: a one-way stream A → B, two crowds swapping ends, a four-way
crossroads, a ring where everyone heads for the opposite point, random
wandering, and a flag that the whole crowd follows.

## How it works

Everything that thinks is in `sim.js`, which has no DOM in it. Three layers,
from far-sighted to near-sighted:

1. **Flow fields.** One Dijkstra distance field per goal cell, shared by every
   walker heading there, so a walker shoved off course still knows the way.
   The edge costs are live: crowded cells cost more, walking against the
   prevailing flow costs more, and walking with a wall on your left costs
   more. That last one turns any two-cell corridor into a two-lane road, and
   the first two make opposing crowds settle onto different routes.
2. **One-lane signals.** A corridor one cell wide cannot hold two-way traffic,
   so each one is found automatically and given a token, like single-track
   railway working. One direction has the green; when it has run long enough
   and someone is waiting at the far end, it drains and flips. Those waiting
   stand clear of the mouth so the others can get out.
3. **ORCA** (optimal reciprocal collision avoidance, the linear programs from
   RVO2) for the last metre, with walls as hard constraints. Who dodges is
   decided by rank: whoever is behind in a queue yields to whoever is in
   front, and waiting walkers yield to moving ones.

Two things break the stand-offs that are left. A jam that will not clear makes
its own cells more and more expensive, until the walkers at its edges find it
cheaper to go round. And a walker held up by cross traffic for a few seconds
gives way for a moment, at a random time, the way Ethernet stations back off
after a collision.

`app.js` draws it on a canvas and wires up the controls.

## Checking it

```bash
node test/soak.js 45 160
```

runs every floor plan with every traffic pattern for 45 simulated seconds with
160 walkers, and prints arrivals per minute, average pace, how many walkers
have been held up for more than six seconds (a long queue counts), the
deepest overlap between two bodies, and the time per tick. It exits non-zero
if any run has stopped delivering anyone by the end, or leaves a body inside
a wall. `node test/ascii.js maze headon 30`
prints one moment as text.

`tools/shot.js` takes a screenshot with Playwright, and
`tools/build-artifact.js out.html` folds the page into one self-contained
file.
