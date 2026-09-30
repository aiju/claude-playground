# Tube train

A 3D model of a London Underground train, rendered in the browser with WebGL
(three.js). It's the Victoria line's 2009 Stock, the trains that run from
Walthamstow Central to Brixton, as a full eight-car train, inside and out.
You can look round it in the depot, open its doors and sit in the saloon, then
send it off through a tube tunnel: ride in the cab, watch it from alongside,
or stand at the trackside as it comes out of the dark.

Everything is built in code when the page loads. There are no model files.

## Run it

```sh
node tools/serve.mjs      # then open http://localhost:8080
```

Any static file server will do. It needs a browser with WebGL and an internet
connection, because three.js comes from a CDN.

Drag to look around, scroll or pinch to zoom. The panel switches between the
depot and the tunnel and picks a view. It also opens and closes the doors,
sets the speed and the destination on the front, and turns the saloon lights
and the sound on and off. Keys:

| Key | |
| --- | --- |
| 1–0 | views (Front, Side, Along, Bogie, Inside, Chase, Cab, Alongside, Window, Trackside) |
| D | open or close the doors (in the depot) |
| ↑ ↓ | speed up or slow down (in the tunnel) |
| L | saloon lights |
| S | sound |
| H | hide the panel |
| F | fullscreen |

The page takes URL options too: `?view=cab`, `?doors=open`,
`?dest=Brixton`, and `?cam=x,y,z&at=x,y,z` to put the camera anywhere.

## Stills

```sh
npm install
node tools/stills.mjs                       # a handful of views
node tools/stills.mjs cab trackside:t=4     # particular ones
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
- **The tunnel** (`tunnel.js`) is rings of cast-iron segments with their
  flanges facing in, set around a concrete invert with timber sleepers and
  both conductor rails. There are cable runs along the walls and a working
  light every 15 m. The train stays still and the tunnel slides past it; it
  repeats every 30 rings, so it never moves more than that before jumping
  back. The windows throw light on the walls: the tunnel's shaders read a
  strip of texture that marks where along the train the windows are, and
  blur it more the further the wall is from the glass.
- **The sound** (`sound.js`) is synthesized: a rumble and a rush of air that
  grow with speed, motors that whine when the train pulls away or brakes, a
  click from each wheel as it crosses a rail joint, and the door beeps.

The model leaves out the logos, and the seat moquette is an original pattern,
not TfL's.
