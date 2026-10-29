// Houses, the shop, and the caves of the west.

import { T } from '../tiles.js';
import { talk } from './talk.js';
import { puzzleRoom } from './rooms.js';

const deco = (model, extra = {}) => ({ tile: T.INVIS, ent: { type: 'deco', model, ...extra } });

export const HOME = {
  id: 'home', name: 'Pip\'s House', env: 'house', kind: 'interior', theme: 'house', music: 'house', visited: false,
  defaultGround: T.WOOD,
  onNewGame(g) {
    g.player.setState('normal');
    g.after(0.9, () => {
      if (g.flag('intro')) return;
      g.setFlag('intro');
      g.say([
        'Pip! Oh good, you\'re up.',
        'Three nights now the lighthouse has been dark, and the fog just keeps rolling in. I can hardly see the garden.',
        'Elder Moss wants to see you. He\'s out by the well in the middle of the village.',
        'Take your sword, dear. The fog\'s brought monsters with it.\n{sword} swings it, {action} lifts things and talks to folk.',
      ], { name: 'Nan Ginger' });
    });
  },
  screens: {
    '0,0': {
      map: [
        '                ',
        '                ',
        '   WWWWWWWWWW   ',
        '   WBEwwwwBBW   ',
        '   W%wwwwwwwW   ',
        '   WwwwmmmwwW   ',
        '   WwwwmFmwNW   ',
        '   WIwwmmmwGW   ',
        '   WwwwwwwwwW   ',
        '   WWWWdWWWWW   ',
        '                ',
      ],
      legend: {
        E: deco('bed', { ry: 0, oz: 0.5 }),
        F: deco('table'),
        G: deco('stove', { light: [3, 1.6, 0.8, 0.3], ry: -Math.PI / 2 }),
        I: deco('plant'),
        N: { ent: { type: 'npc', species: 'fox', name: 'Nan Ginger', talk: talk.nan, dir: -Math.PI / 2, extra: 'glasses' } },
        d: { tile: T.WOOD, ent: { type: 'warp', to: { area: 'overworld', x: 19.5, z: 14.5, dir: 0 }, dir: 'down' } },
      },
    },
  },
};

export const ELDER_HOUSE = {
  id: 'elderHouse', name: 'Elder Moss\'s House', env: 'house', kind: 'interior', theme: 'house', music: 'house', visited: false,
  defaultGround: T.WOOD,
  screens: {
    '0,0': {
      map: [
        '                ',
        '                ',
        '   WWWWWWWWWW   ',
        '   WBBBwwBBBW   ',
        '   WwwwwwwwwW   ',
        '   WwmmmmmwwW   ',
        '   WwmmFmmwIW   ',
        '   WwmmmmmwwW   ',
        '   WIwwwwwwwW   ',
        '   WWWWdWWWWW   ',
        '                ',
      ],
      legend: {
        F: { tile: T.INVIS, ents: [{ type: 'deco', model: 'table' }, { type: 'sign', text: (g) => talk.elderHouse(g), invisible: true }] },
        I: deco('plant'),
        d: { tile: T.WOOD, ent: { type: 'warp', to: { area: 'overworld', x: 28.5, z: 14.5, dir: 0 }, dir: 'down' } },
      },
    },
  },
};

export const SHOP = {
  id: 'shop', name: 'Tansy\'s Shop', env: 'house', kind: 'interior', theme: 'house', music: 'shop', visited: false,
  defaultGround: T.WOOD,
  screens: {
    '0,0': {
      map: [
        '                ',
        '                ',
        '   WWWWWWWWWW   ',
        '   WBBBwwBBBW   ',
        '   WwwwwNwwwW   ',
        '   WQCQDQFGQW   ',
        '   WwwwwwwwwW   ',
        '   WIwwmmwwIW   ',
        '   WwwwmmwwwW   ',
        '   WWWWdWWWWW   ',
        '                ',
      ],
      legend: {
        N: { ent: { type: 'npc', species: 'tanuki', name: 'Tansy', talk: talk.tansy, dir: 0, interactR: 1.2 } },
        C: { tile: T.COUNTER, ent: { type: 'shopitem', item: 'bombRefill', price: 10, label: 'Puffball bombs, a full bag' } },
        D: { tile: T.COUNTER, ent: { type: 'shopitem', item: 'arrowRefill', price: 10, label: 'A quiver of arrows' } },
        F: { tile: T.COUNTER, ent: { type: 'shopitem', item: 'heartRefill', price: 10, label: 'Seaweed tea (restores all hearts)' } },
        G: { tile: T.COUNTER, ent: { type: 'shopitem', item: 'bow', price: 50, label: 'The REED BOW', once: true } },
        I: deco('barrel'),
        d: { tile: T.WOOD, ent: { type: 'warp', to: { area: 'overworld', x: 19.5, z: 20.5, dir: 0 }, dir: 'down' } },
      },
    },
  },
};

// The Whispering Grotto: entry (0,1), block puzzle (1,1), treasure (1,0).
export const GROTTO = {
  id: 'grotto', name: 'Whispering Grotto', env: 'cave', kind: 'cave', theme: 'cave', music: 'cave',
  defaultGround: T.CAVE, cliffBase: 2.0, cliffMax: 1, dungeon: 'grotto',
  mapRooms: ['0,1', '1,1', '1,0'],
  screens: {
    '1,0': {
      room: puzzleRoom({ flag: 'grottoTreasure', until: 'enemies' }),
      map: [
        'RRRRRRRRRRRRRRRR',
        'RRRRRRRRRRRRRRRR',
        'RRRccccccccccRRR',
        'RRcjcccccccccjRR',
        'RRcccc1ccc1cccRR',
        'RRcccccccccccccR',
        'RRcccccccccccccR',
        'RRccccccC4ccccRR',
        'RRRcjccccccccjRR',
        'RRRRccccccccRRRR',
        'RRRRRRRSRRRRRRRR',
      ],
      legend: {
        C: { ent: { type: 'chest', item: 'boomerang', big: true, hidden: true, revealFlag: 'grottoTreasure' } },
        S: { tile: T.CAVE, ent: { type: 'door', kind: 'shutter' } },
      },
    },
    '0,1': {
      map: [
        'RRRRRRRRRRRRRRRR',
        'RRRRccccccccRRRR',
        'RRRcjcc3ccjccRRR',
        'RRcccccccccccccR',
        'Rcc1cccccccooccR',
        'Rccccccccccccccc',
        'Rccccccc1ccccccR',
        'RRccppcccccccccR',
        'RRRcccccccccccRR',
        'RRRRRRRdRRRRRRRR',
        'RRRRRRRRRRRRRRRR',
      ],
      legend: {
        d: { tile: T.CAVE, ent: { type: 'warp', to: { area: 'overworld', x: 8.5, z: 2.6, dir: 0 }, dir: 'down' } },
      },
    },
    '1,1': {
      room: puzzleRoom({ flag: 'grottoBlocks', until: 'plates' }),
      map: [
        'RRRRRRRSRRRRRRRR',
        'RRRRRcccccRRRRRR',
        'RRRcccccccccRRRR',
        'RRccccc3ccccccRR',
        'RcccRRRcccccccRR',
        'cccccccccRRRcccR',
        'RccccccccRecccRR',
        'RRcccccxccccccRR',
        'RRRcccccccccCRRR',
        'RRRRRcccccccRRRR',
        'RRRRRRRRRRRRRRRR',
      ],
      legend: {
        S: { tile: T.CAVE, ent: { type: 'door', kind: 'shutter' } },
        C: { ent: { type: 'chest', item: 'shells:20' } },
        e: { ent: { type: 'plate', heavy: true } },
      },
    },
  },
};

export const HEART_CAVE = {
  id: 'heartCave', name: 'Hollow Hill', env: 'cave', kind: 'cave', theme: 'cave', music: 'cave',
  defaultGround: T.CAVE, cliffBase: 2.0, cliffMax: 1, visited: false,
  screens: {
    '0,0': {
      map: [
        'RRRRRRRRRRRRRRRR',
        'RRRRRRRRRRRRRRRR',
        'RRRRRccccccRRRRR',
        'RRRRcc3cc3ccRRRR',
        'RRRccccjcccccRRR',
        'RRRcccchccccccRR',
        'RRRccccccccccRRR',
        'RRRRccppccccRRRR',
        'RRRRRccccccRRRRR',
        'RRRRRRRdRRRRRRRR',
        'RRRRRRRRRRRRRRRR',
      ],
      legend: {
        h: { tile: T.CAVE, ent: { type: 'heart' } },
        d: { tile: T.CAVE, ent: { type: 'warp', to: { area: 'overworld', x: 2.5, z: 14.5, dir: 0 }, dir: 'down' } },
      },
    },
  },
};
