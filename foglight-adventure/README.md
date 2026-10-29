# Foglight

A little island adventure in the spirit of the 2D Zelda games: top-down gameplay, rendered in 3D like a toy diorama. Everything — the renderer, every model, every sound effect and every tune — is built from scratch in plain JavaScript with WebGL2 and WebAudio. There are no libraries and no asset files.

Three nights ago the lighthouse on Gull Point went dark. A shadow called the Gloom swallowed its light, and now fog creeps over Foglight Isle and monsters come with it. Pip, a small fox with a driftwood sword, sets out to find the Sunstone that sleeps in the Drowned Shrine and carry it back up the tower.

## Playing it

The game is a static page, but browsers won't load JavaScript modules from `file://`, so it needs a local web server. With Node installed:

```bash
node tools/serve.mjs
```

and open <http://localhost:8000>. Any other static server works too, for example `python3 -m http.server`. You need a browser with WebGL2 (any recent Chrome, Firefox, Safari or Edge). The game saves automatically to the browser's local storage, and **Continue** on the title screen picks up where you left off.

| | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | Arrow keys or WASD | Stick or D-pad | Left stick |
| Sword (hold, then let go, for a spin attack) | Z or J | A | ⚔ |
| Lift, throw, talk, read, open | Space or E | B | ✋ (or tap) |
| Item 1 / item 2 | X / C, or K / L | X / Y | 1 / 2 |
| Satchel: choose items, see the map | Enter or Esc | Start | ☰ |
| Sound on/off | M | | |

Talking to someone or opening a chest also works with the sword button.

## What's in it

- **Combat up close and at range.** The sword swings in an arc and charges up into a spin attack. Seeds that monsters spit can be batted back. Thrown pots and rocks hurt too.
- **Five items, each with puzzle uses as well as fighting ones:**
  - the *Leafarang* stuns monsters, fetches pickups and hits far-off switches, and if it flies through a flame it carries the fire to whatever it hits next;
  - *Puffball Bombs* crack walls and boulders and can be picked up and thrown while they fizz;
  - the *Reed Bow* (sold in the village shop) shoots a long way, and an arrow through a flame becomes a fire arrow;
  - the *Gull Feather* lets Pip jump over pits, narrow water and low attacks;
  - the *Frost Wand* freezes a straight path of ice across water, and freezes monsters into blocks you can push onto pressure plates (they don't stay frozen for long).
- **An island to explore**: twelve screens with a village, woods, a meadow with a fairy, a river with a raised drawbridge, old ruins, beaches, Mirror Lake and Gull Point. Inside: houses, a shop, the Whispering Grotto, a hidden cave, the ten-room Drowned Shrine and the lighthouse.
- **Monsters**: Gloops (that split when they're big), seed-spitting Sprouts, bats, shield-carrying beetle knights you have to get behind, crabs, lake fish that only surface to spit bubbles, living embers that shrug off the sword, bone-throwing skeleton fish, spike rollers and gloomwisps. There's a mini-boss, and two bosses: Deepcoil, the shrine eel, and the Gloom itself.
- **Puzzles**: blocks and pressure plates, a block that slides across an ice floor, crystal switches that raise and lower red and blue blocks, torches lit by carrying fire, an eye switch, bombable walls, locked doors, small keys and a Big Key.
- **Secrets**: four pieces of heart around the island (four make a new heart, and one of them is Mill's reward for finding her lost shell), a fairy, and a shop to spend shells in.

It's a short game: probably about an hour, a bit more if you hunt for every secret.

## How it's made

| File | What it does |
| --- | --- |
| [src/renderer.js](src/renderer.js) | The WebGL2 renderer: a shadow map from the sun, lit vertex-coloured meshes with point lights, an animated water shader, point-sprite particles, a stencilled silhouette when Pip walks behind a wall, and a post pass with tilt-shift blur, drifting fog and a vignette. |
| [src/mesh.js](src/mesh.js), [src/models.js](src/models.js), [src/models2.js](src/models2.js) | A small mesh builder (boxes, bevelled boxes, cylinders, low-poly spheres, prisms) and every character and prop modelled with it. |
| [src/terrain.js](src/terrain.js) | Turns a screen of tiles into one static mesh: blended grass with paths and beaches laid over it, terraced cliffs with noise-jittered faces, water beds and banks, trees, palms, fences, dungeon walls (cut down along the bottom of each room so they don't hide the floor), and buildings. |
| [src/world.js](src/world.js), [src/tiles.js](src/tiles.js) | Areas are ASCII maps, drawn screen by screen; each character is a tile or something to spawn. |
| [src/game.js](src/game.js) | The game: screens, scrolling between them, warps, collision, the camera, saving. |
| [src/player.js](src/player.js), [src/enemies.js](src/enemies.js), [src/bosses.js](src/bosses.js), [src/objects.js](src/objects.js), [src/projectiles.js](src/projectiles.js), [src/items.js](src/items.js) | Pip, the monsters, the bosses, the world's objects and puzzle pieces, and the items. |
| [src/audio.js](src/audio.js), [src/music.js](src/music.js) | A WebAudio synth with a reverb, about eighty sound effects made from oscillators and filtered noise, and a step sequencer playing the soundtrack from note strings and chord charts. |
| [src/ui.js](src/ui.js), [src/icons.js](src/icons.js) | The HUD, dialogue boxes, the satchel menu, the title screen and the credits, as HTML over the canvas. |
| [src/data/](src/data) | The island: maps, people and what they say, and room scripts. |

## Checking it

```bash
node tools/check-maps.mjs
```

checks the maps: every screen is the right size, walking off the edge of a screen never lands you inside a wall, and every door and staircase leads somewhere you can stand.

```bash
npm install
npm test
```

also plays the whole game headless in Chromium, from Nan's first words to the credits. It drives the real game logic with simulated button presses (with rendering paused, so it takes a couple of minutes) and checks each puzzle can be solved the way a player would solve it: pushing the grotto's block onto its plate, carrying fire with the Leafarang, sliding the block across the ice, freezing a path over the water, and beating both bosses.
