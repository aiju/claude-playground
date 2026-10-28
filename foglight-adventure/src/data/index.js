// All the places on the island.

import { OVERWORLD } from './overworld.js';
import { HOME, ELDER_HOUSE, SHOP, GROTTO, HEART_CAVE } from './places.js';
import { SHRINE } from './shrine.js';
import { LIGHTHOUSE } from './lighthouse.js';

export const AREA_DEFS = {
  overworld: OVERWORLD,
  home: HOME,
  elderHouse: ELDER_HOUSE,
  shop: SHOP,
  grotto: GROTTO,
  heartCave: HEART_CAVE,
  shrine: SHRINE,
  lighthouse: LIGHTHOUSE,
};

export const START = { area: 'home', x: 7.5, z: 6.3, dir: 0 };
