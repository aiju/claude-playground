// The shot list: which scene is on screen when. A shot starts a little
// before its line's speech, so the picture leads the words. `wipe` brings
// the shot in behind a scanning beam instead of a cut.

import { hook } from './hook.js';
import { boards } from './boards.js';
import { microword } from './microword.js';
import { prom } from './prom.js';
import { add } from './add.js';
import { tasks } from './tasks.js';
import { buckets } from './buckets.js';
import { memory } from './memory.js';
import { clocks } from './clocks.js';
import { scanline } from './scanline.js';
import { mouse } from './mouse.js';
import { disk } from './disk.js';
import { ether } from './ether.js';
import { screenOff, payoff } from './payoff.js';

export function makeShots(T) {
  const at = (id, lead = 0.35) => T.at(id) - lead;
  return [
    { section: 1, from: 0, scene: hook },
    { section: 2, from: at('N2'), wipe: true, scene: boards },
    { section: 3, from: at('N3'), wipe: true, scene: microword },
    { section: 3, from: at('N4'), scene: prom },
    { section: 4, from: at('N5'), wipe: true, scene: add },
    { section: 4, from: at('N6'), scene: tasks },
    // Same scene carrying on; a separate shot only so section 5 starts here.
    { section: 5, from: at('N7'), scene: tasks, start: at('N6'), sounds: false },
    { section: 5, from: at('N8'), wipe: true, scene: buckets },
    { section: 6, from: at('N9'), wipe: true, scene: memory },
    { section: 6, from: at('N10'), scene: clocks },
    { section: 6, from: at('N11'), scene: scanline },
    { section: 7, from: at('N12'), wipe: true, scene: mouse },
    { section: 7, from: at('N13'), scene: disk },
    { section: 7, from: at('N14'), scene: ether },
    { section: 8, from: at('N15'), wipe: true, scene: screenOff },
    { section: 8, from: at('N16'), scene: payoff },
  ];
}
