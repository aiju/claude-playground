# Tube train

A 3D model of a London Underground train, rendered in the browser with WebGL
(three.js). It's the Victoria line's 2009 Stock, the trains that run from
Walthamstow Central to Brixton, as a full eight-car train, inside and out.
You can look round it in the depot, open its doors and sit in the saloon, then
send it off through a tube tunnel: ride in the cab, watch it from alongside,
or stand at the trackside as it comes round a bend out of the dark.
Underground it runs in service along a winding line, calling at a station
every half kilometre, where you can wait on the platform, watch it pull in
and see the doors open.

Everything is built in code when the page loads. There are no model files.

## Run it

```sh
node tools/serve.mjs      # then open http://localhost:8080
```

Any static file server will do. It needs a browser with WebGL and an internet
connection, because three.js comes from a CDN.

Drag to look around, scroll or pinch to zoom. The panel switches between the
depot, the tunnel and the station and picks a view. It also opens and closes
the doors in the depot, sets the speed, turns the stops at stations on and
off, sets the destination on the front, and turns the saloon lights and the
sound on and off. Keys:

| Key | |
| --- | --- |
| 1–5 | the views of where you are (in the depot Front, Side, Along, Bogie, Inside; in the tunnel Chase, Cab, Alongside, Window, Trackside; at the station Platform, Arriving, Doors) |
| D | open or close the doors (in the depot) |
| ↑ ↓ | speed up or slow down (underground) |
| L | saloon lights |
| S | sound |
| H | hide the panel |
| F | fullscreen |

The page takes URL options too: `?view=cab`, `?doors=open`,
`?dest=Brixton`, `?s=900` to start the train that many metres along the line,
`?stopped` to start it standing at the first station, and
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
  station. Each block has a level straight through the station, then a curve
  or an S-bend (radii of 170 to 470 m, eased in and out) and a dip of up to
  about 1 in 30 down to the next station. The Victoria line's stations sit
  on humps like this, so trains run downhill as they pull away and uphill as
  they brake. Anything along the line is placed in a frame (a point on the
  track and its forward, up and right directions) at its distance along it.
- **The tunnel** (`tunnel.js`) is rings of cast-iron segments with their
  flanges facing in, set around a concrete invert with timber sleepers and
  both conductor rails. There are cable runs along the walls and a working
  light every 15 m. It is built in 30 m pieces wherever the train and the
  camera are, and taken down behind them. The rings, sleepers, insulators
  and cables are instanced along the line; the rails and the invert are swept
  along it. The windows throw light on the walls: the tunnel's shaders read a
  strip of texture that marks where along the train the windows are, and
  blur it more the further the wall is from the glass.
- **On a curve** (`train.js`) each car sits on its two bogies, so it is a
  chord of the curve: its middle swings in, its ends swing out, and the
  bogies turn under it to follow the rails. Cameras ride with a car, stand in
  the station or stand at the trackside, and each frame a riding camera is
  moved however its car moved, so it goes round the bends with it.
- **The station** (`station.js`) is a deep-level platform tunnel, 140 m
  long and 6.8 m across, set off to one side of the track so there's room for
  the platform. It has glazed tiles with a band in the line's light blue, a
  dark ceiling with two long light troughs, a pit between the rails, posters
  on the wall across the track, benches, the station's name along both walls,
  way-out signs and a dot-matrix train indicator. Its light is two more line
  sources, which the station, the tunnel near it and the outside of the train
  all add in their shaders, in the station's own coordinates. Only one
  station exists at a time: when the train has left, it moves on to the next
  stop along the line and takes the next name. The running tunnel is cut away
  in the shader where the station is.
- **The service** (`service.js`) drives the train underground. It pulls
  away at 1.1 m/s², cruises at the speed you set, and brakes to stop with
  its front 3 m short of the end of the platform. It opens the doors on the
  platform side, closes them after 15 s with the warning beeps, and leaves.
- **The sound** (`sound.js`) is synthesized: a rumble and a rush of air that
  grow with speed, motors that whine when the train pulls away or brakes, a
  click from each wheel as it crosses a rail joint, and the door beeps.

The model leaves out the logos. The seat moquette, the station's tile motif
and the posters are original designs, not TfL's.
