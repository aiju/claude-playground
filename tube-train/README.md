# Tube train

A 3D model of a London Underground train, rendered in the browser with WebGL
(three.js). It's the Victoria line's 2009 Stock, the trains that run from
Walthamstow Central to Brixton, as a full eight-car train, inside and out.
You can look round it in the depot, open its doors and sit in the saloon, then
send it off through a tube tunnel: ride in the cab, watch it from alongside,
or stand at the trackside as it comes round a bend out of the dark.
Underground it runs in service along a winding line, in one of a pair of
twin tunnels, calling at a station every half kilometre. There you can wait
on the platform with the other passengers, watch it pull in and see people
get off and on, and look through the arches to the other platform, where
trains going the other way stop.

Everything is built in code when the page loads. There are no model files.

## Run it

```sh
node tools/serve.mjs      # then open http://localhost:8080
```

Any static file server will do. It needs a browser with WebGL and an internet
connection, because three.js comes from a CDN.

Underground, a map in the corner shows the line round the train from above:
the bends, both tunnels, the stations with their names, both trains, where
the camera is and which way it looks, and under it the line's height, stretched so the dips
show. Click it to zoom out and in.

Drag to look around, scroll or pinch to zoom. The panel switches between the
depot, the tunnel and the station and picks a view. It also opens and closes
the doors in the depot, sets the speed, turns the stops at stations on and
off, sets the destination on the front, and turns the saloon lights and the
sound on and off. Keys:

| Key | |
| --- | --- |
| 1–6 | the views of where you are (in the depot Front, Side, Along, Bogie, Inside; in the tunnel Chase, Cab, Alongside, Window, Trackside, Inside; at the station Platform, Arriving, Doors, Across, Platform 2) |
| D | open or close the doors (in the depot) |
| ↑ ↓ | speed up or slow down (underground) |
| L | saloon lights |
| S | sound |
| M | show or hide the map (underground) |
| H | hide the panel |
| F | fullscreen |

The page takes URL options too: `?view=cab`, `?doors=open`,
`?dest=Brixton`, `?s=900` to start the train that many metres along the line,
`?stopped` to start it standing at the first station (with `&board=7`, seven
seconds after the doors opened), and
`?cam=x,y,z&at=x,y,z` to put the camera anywhere.

## Stills

```sh
npm install
node tools/stills.mjs                       # a handful of views
node tools/stills.mjs cab platform:s=960    # particular ones
```

This renders views in headless Chromium and saves them to `out/stills/`. It
serves three.js from `node_modules`, so it works offline. WebGL runs on the
CPU there, so each still takes a few seconds.

## How it's made

The dimensions come from TfL's rolling stock data sheet for the 2009 Stock
and the scale drawings on it. That covers car lengths, the body's width and
height, the floor height, and where every door and window is, down to the
millimetre. The wheel size, the bogie spacing and the formation are from the
data sheet too. The shape of the cab front and the colours are matched to
photographs. `src/dims.js` has all the numbers.

- **The body** (`profile.js`, `geom.js`, `car.js`). Tube trains have
  rounded shoulders to fit the tunnels, and the body is built on that
  cross-section. Each side is a flat (u, v) plane, u along the car and v up
  and over the profile. Windows and doorways are rounded rectangles cut out of
  it. The panel is meshed in thin horizontal strips, so it follows the curve
  and the rounded corners stay exact. The same layout makes the outer skin,
  the inside lining, the window reveals, the glass and the door leaves. The
  leaves hang on the outside of the body and slide along it, as the real ones
  do.
- **The cab front** (`nose.js`) is a flat face, where the centre door is,
  joined to the body by a rounded edge. The edge is deep at the sides, where
  the windscreens wrap round the corners, and tight over the roof. Its paint
  scheme is a texture drawn on a canvas and projected from straight ahead,
  with holes where the glass is. The destination and train number displays
  are drawn as dot-matrix LEDs.
- **Inside** (`interior.js`) are the longitudinal seats in each bay, blue grab
  poles and rails, draught screens by the doors and a simple cab. The saloon
  lights are two long strips along the ceiling. Rather than use dozens of
  lamps, the interior materials add the light of two line sources in their
  shaders (`materials.js`).
- **Underneath** (`bogie.js`) are the bogies, with wheels, axleboxes, air
  springs and traction motors. The driving cars and the D cars have shoe gear
  for the fourth rail. Equipment cases hang between the bogies.
- **The line** (`path.js`) is made up as the train goes, one block per
  station. Each block has a level straight through the station, then a bend
  or an S-bend (radii of 150 to 320 m, eased in and out) and a dip of up to
  about 1 in 30 down to the next station. The run-in to the first station is
  an S-bend, and the train starts out standing in the first curve of it. The Victoria line's stations sit
  on humps like this, so trains run downhill as they pull away and uphill as
  they brake. Anything along the line is placed in a frame (a point on the
  track and its forward, up and right directions) at its distance along it.
- **The tunnel** (`tunnel.js`) is rings of cast-iron segments with their
  flanges facing in, set around a concrete invert with timber sleepers and
  both conductor rails. There are cable runs along the walls and a working
  light every 15 m. It is built in 61 m pieces wherever the train and the
  camera are, a part at a time over several frames and well before it comes
  into sight, and taken down behind them. The rings, sleepers, insulators
  and cables are instanced along the line; the rails and the invert are swept
  along it. The windows throw light on the walls: the tunnel's shaders read a
  strip of texture that marks where along the train the windows are, and
  blur it more the further the wall is from the glass.
- **On a curve** (`train.js`) each car sits on its two bogies, so it is a
  chord of the curve: its middle swings in, its ends swing out, and the
  bogies turn under it to follow the rails. Cameras ride with a car, keep to
  the track ahead of the train (the chase view, which sees the train swing
  round the bends towards it), stand in the station or stand at the
  trackside. Each frame a riding camera is moved however the thing it rides
  with moved, so it goes round the bends with it. The cab and trackside views
  show the curves best.
- **The station** (`station.js`) is two deep-level platform tunnels side by
  side, one for each direction, the second built as the first turned round.
  Each is 140 m long and 6.8 m across, set off to one side of its track so
  there's room for the platform. They have glazed tiles with a band in the
  line's light blue, a dark ceiling with two long light troughs, a pit
  between the rails, posters on the wall across the track, benches, the
  station's name along both walls, way-out signs and a dot-matrix train
  indicator. Three arched cross-passages join the platforms, and the outer
  two lead off to the way out down a corridor between the tunnels. Each
  tunnel's light is two more line sources, which the station, the tunnels
  near it and the outsides of the trains all add in their shaders, in the
  station's own coordinates. Only one station exists at a time: when the
  train has left, it moves on to the next stop along the line and takes the
  next name. The running tunnels' rings and cables are left out where the
  station is, and anything left over is cut away in the shader.
- **The other track** (`path.js`, `other.js`) runs 13 m to the right of
  ours, in a tunnel of its own, with trains going to the other end of the
  line. On a curve the two tracks are different lengths, so the other one
  has its own distance along it, worked out from the angle the line has
  turned. Its tunnel is only built round the station, the one place it can
  be seen from. There is one other train, which waits out of sight and is
  sent in to arrive at about the same time as ours, a little before or
  after; it stops, opens its doors on its platform and leaves again.
- **The service** (`service.js`) drives the train underground. It pulls
  away at 1.1 m/s², cruises at the speed you set, and brakes to stop with
  its front 3 m short of the end of the platform. It opens the doors on the
  platform side, closes them after 15 s with the warning beeps, and leaves.
- **The passengers** (`people.js`) are little people made of a few rounded
  parts, each with their own height, build, skin tone, hair, coat and
  trousers, and sometimes a backpack, a beanie or a phone. Every kind of part
  is one instanced mesh for the whole crowd, so a couple of hundred people
  take ten draw calls, and their poses (walking, sitting, holding the rail,
  looking at a phone) are set from a few joint angles each frame. Each person
  lives in the station's coordinates or a car's, and moves with it. When the
  doors open, about a quarter of the riders stand up, step off and walk out
  through the passages in the platform wall; then the people waiting go to
  the nearest door, wait for it to be clear, get on and find a free seat or
  a rail to hold. Anyone not on when the doors close waits for the next train,
  and new people keep arriving from the passages.
- **The map** (`minimap.js`) is drawn on its own 2D canvas each frame,
  from the same path as the tunnel. It turns slowly so the stretch of line
  on it always runs left to right, and draws station names only where they
  have room.
- **Keeping it smooth.** What costs most is the number of separate things
  drawn each frame, so the trains' parts are drawn in batches (`batch.js`):
  the parts every car shares (doors, bogies, seats and so on) are one
  instanced mesh each across both trains, fed each frame with the places of
  the ones in view. The station is merged into a mesh per material, and the
  tunnel is drawn no further than the murk lets you see. All the shaders
  are built while the page loads. The number of lights never changes, since
  that would have every shader built again: a working light inside the
  station is turned down rather than switched off. People out of view
  aren't posed. If frames still come unevenly, the page draws fewer pixels.
- **The sound** (`sound.js`) is synthesized: a rumble and a rush of air that
  grow with speed, motors that whine when the train pulls away or brakes, a
  click from each wheel as it crosses a rail joint, and the door beeps.

The model leaves out the logos. The seat moquette, the station's tile motif
and the posters are original designs, not TfL's.
