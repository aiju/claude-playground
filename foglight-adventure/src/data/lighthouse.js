// Gull Point lighthouse: three floors, climbed by stairs.

import { T } from '../tiles.js';
import { puzzleRoom } from './rooms.js';
import { gloomRoom } from '../bosses.js';

const stairs = (to, look = 'stairsUp') => ({ tile: T.WOOD, ent: { type: 'warp', to, dir: null, look } });

export const LIGHTHOUSE = {
  id: 'lighthouse', name: 'Gull Point Lighthouse', env: 'lighthouse', kind: 'dungeon', theme: 'lighthouse', music: 'lighthouse',
  defaultGround: T.WOOD,
  mapRooms: ['0,0', '1,0', '2,0'],
  screens: {
    '0,0': {
      name: 'Gull Point Lighthouse',
      room: puzzleRoom({ flag: 'lhTorches', until: 'torches', shutters: false }),
      map: [
        'WWWWWWWWWWWWWWWW',
        'WWWWW__s___WWWWW',
        'WWW____G____WWWW',
        'WW____________WW',
        'WW_0________0_WW',
        'W___t__j__t____W',
        'WW____________WW',
        'WW__p______p__WW',
        'WWW__________WWW',
        'WWWWW__d___WWWWW',
        'WWWWWWWWWWWWWWWW',
      ],
      legend: {
        j: { ent: { type: 'torch', lit: true, permanent: true } },
        t: { ent: { type: 'torch', litFlag: 'lhTorches' } },
        G: { tile: T.WOOD, ent: { type: 'gate', flag: 'lhTorches' } },
        s: stairs({ area: 'lighthouse', x: 27.5, z: 8.5, dir: Math.PI }),
        d: { tile: T.WOOD, ent: { type: 'warp', to: { area: 'overworld', x: 60.5, z: 5.5, dir: 0 }, dir: 'down' } },
      },
    },
    '1,0': {
      map: [
        'WWWWWWWWWWWWWWWW',
        'W____s_________W',
        'W______________W',
        'WOOOOOOOOOOOOOOW',
        'W9____________0W',
        'W______________W',
        'WOOO_OOOOOOOOOOW',
        'W0____________9W',
        'W______________W',
        'W__________a___W',
        'WWWWWWWWWWWWWWWW',
      ],
      legend: {
        s: stairs({ area: 'lighthouse', x: 40.5, z: 8.5, dir: Math.PI }),
        a: stairs({ area: 'lighthouse', x: 7.5, z: 2.5, dir: 0 }, 'stairs'),
      },
    },
    '2,0': {
      room: gloomRoom,
      music: 'final',
      map: [
        'WWWWWWWWWWWWWWWW',
        'WWWW________WWWW',
        'WW_____t______WW',
        'W______________W',
        'W______________W',
        'W___t__L__t____W',
        'W______________W',
        'W______________W',
        'WW_____t______WW',
        'WWWW___a____WWWW',
        'WWWWWWWWWWWWWWWW',
      ],
      legend: {
        L: { ent: { type: 'lamp' } },
        t: { ent: { type: 'torch' } },
        a: stairs({ area: 'lighthouse', x: 21.5, z: 2.3, dir: 0 }, 'stairs'),
      },
    },
  },
};
