// The Drowned Shrine. Rooms (x,y):
//
//   (0,0) Big Key isle   (1,0) Deepcoil's pool
//   (0,1) Frost Wand     (1,1) Crystal pits     (2,1) Ice slide
//   (0,2) Big Gloop      (1,2) Hub              (2,2) Torches
//                        (1,3) Entrance         (2,3) Pool

import { T } from '../tiles.js';
import { puzzleRoom } from './rooms.js';
import { deepcoilRoom } from '../bosses.js';

const door = (kind) => ({ tile: T.FLOOR, ent: { type: 'door', kind } });
const D = door('open'), K = door('locked'), S = door('shutter'), B = door('boss');
const blueSlime = { ent: { type: 'enemy', kind: 'slime', color: 'blue' } };

export const SHRINE = {
  id: 'shrine', name: 'The Drowned Shrine', env: 'shrine', kind: 'dungeon', theme: 'shrine', music: 'shrine',
  dungeon: 'shrine', defaultGround: T.FLOOR,
  mapRooms: ['0,0', '1,0', '0,1', '1,1', '2,1', '0,2', '1,2', '2,2', '1,3', '2,3'],
  mapMarks: (g) => ({ '1,0': g.flag('shrineBoss') ? '' : '☠' }),
  screens: {
    '1,3': {
      name: 'The Drowned Shrine',
      map: [
        'WWWWWWWDWWWWWWWW',
        'W______________W',
        'W_A__________A_W',
        'W______________W',
        'W___j______j___W',
        'W______________W',
        'W____S_________W',
        'W___p______p___W',
        'W______________W',
        'W______E_______W',
        'WWWWWWWWWWWWWWWW',
      ],
      legend: {
        D,
        S: { ent: { type: 'sign', text: 'THE DROWNED SHRINE\nHere the sun sleeps beneath the water.\nTread softly, and mind the eel.' } },
        E: { tile: T.FLOOR, ent: { type: 'warp', to: { area: 'overworld', x: 35.5, z: 28.4, dir: 0 }, dir: 'down', look: 'stairsUp' } },
      },
    },
    '1,2': {
      map: [
        'WWWWWWWDWWWWWWWW',
        'W_____p__p_____W',
        'W______________W',
        'W~~~~~~~~~~~~~~W',
        'W______________W',
        'K______________D',
        'W__A___S___A___W',
        'W______________W',
        'W____1____1____W',
        'W______________W',
        'WWWWWWWDWWWWWWWW',
      ],
      legend: {
        D, K, '1': blueSlime,
        S: { ent: { type: 'sign', text: 'Only those as light as a gull\'s feather may cross the water.' } },
      },
    },
    '2,2': {
      room: puzzleRoom({ flag: 'shrineTorches', until: 'torches', shutters: false }),
      map: [
        'WWWWWWWWWWWWWWWW',
        'W______________W',
        'W______t_______W',
        'W___3__________W',
        'W______________W',
        'D___t__j__t____W',
        'W______________W',
        'W__________3___W',
        'W______t____C__W',
        'W______________W',
        'WWWWWWWDWWWWWWWW',
      ],
      legend: {
        D,
        j: { ent: { type: 'torch', lit: true, permanent: true } },
        t: { ent: { type: 'torch', litFlag: 'shrineTorches' } },
        C: { ent: { type: 'chest', item: 'key', hidden: true, revealFlag: 'shrineTorches' } },
      },
    },
    '2,3': {
      map: [
        'WWWWWWWDWWWWWWWW',
        'W______________W',
        'W_p__________p_W',
        'W____~~~~~~____W',
        'W____~~__~~____W',
        'W____~~_C~~____W',
        'W____~~__~~____W',
        'W____~~~~6~____W',
        'W______________W',
        'W_p__________p_W',
        'WWWWWWWWWWWWWWWW',
      ],
      legend: { D, C: { ent: { type: 'chest', item: 'shells:20' } } },
    },
    '0,2': {
      room: puzzleRoom({ flag: 'shrineGloop', until: 'enemies' }),
      music: 'miniboss',
      map: [
        'WWWWWWWWWWWWWWWW',
        'W______________W',
        'W_A__________A_W',
        'W______________W',
        'W______________W',
        'W______G_______S',
        'W______________W',
        'W______C_______W',
        'W______________W',
        'W_A__________A_W',
        'WWWWWWWWWWWWWWWW',
      ],
      legend: {
        S,
        G: { ent: { type: 'enemy', kind: 'slime', size: 2.2, color: 'blue', unlessFlag: 'shrineGloop' } },
        C: { ent: { type: 'chest', item: 'feather', big: true, hidden: true, revealFlag: 'shrineGloop' } },
      },
    },
    '1,1': {
      map: [
        'WWWWWWWBWWWWWWWW',
        'W_____yyy______W',
        'W______________W',
        'W______z_______W',
        'W______________W',
        'Ky____________rD',
        'WOOOOOOOOOOOOOOW',
        'W______________W',
        'W__8________8__W',
        'W______________W',
        'WWWWWWWDWWWWWWWW',
      ],
      legend: { D, K, B },
    },
    '2,1': {
      room: puzzleRoom({ flag: 'shrineIce', until: 'plates', shutters: false }),
      map: [
        'WWWWWWWWWWWWWWWW',
        'W______________W',
        'W___Aiiiiiiii__W',
        'W__iiiiiiiieA__W',
        'W__iiiiiiiiii__W',
        'D__iiiiiiiiii__W',
        'W__iiiiiiiiii__W',
        'W__ixiiiiiiii__W',
        'W__iiiiiiiiii_1W',
        'W______C_______W',
        'WWWWWWWWWWWWWWWW',
      ],
      legend: {
        D, '1': blueSlime,
        e: { ent: { type: 'plate', heavy: true } },
        C: { ent: { type: 'chest', item: 'key', hidden: true, revealFlag: 'shrineIce' } },
      },
    },
    '0,1': {
      map: [
        'WWWWWWWDWWWWWWWW',
        'WAA___________AW',
        'W~~~~~~~~~~~~~~W',
        'W~~~~~~~~~~~~~~W',
        'W______________W',
        'W______________K',
        'W__7________7__W',
        'W______________W',
        'W______C_______W',
        'W______________W',
        'WWWWWWWWWWWWWWWW',
      ],
      legend: { D, K, C: { ent: { type: 'chest', item: 'frost', big: true } } },
    },
    '0,0': {
      map: [
        'WWWWWWWWWWWWWWWW',
        'W______________W',
        'W_~~~~~~~~~~~~_W',
        'W_~~6~~~~~~6~~_W',
        'W_~~~~____~~~~_W',
        'W_~~~~_C__~~~~_W',
        'W_~~~~____~~~~_W',
        'W_~~~~~~~~~~~~_W',
        'W_~~~~~~~~~~~~_W',
        'W______________W',
        'WWWWWWWDWWWWWWWW',
      ],
      legend: { D, C: { ent: { type: 'chest', item: 'bigKey', big: true } } },
    },
    '1,0': {
      room: deepcoilRoom,
      music: 'boss',
      map: [
        'WWWWWWWWWWWWWWWW',
        'W______________W',
        'W_A__________A_W',
        'W___~~~~~~~~___W',
        'W__~~~~~~~~~~__W',
        'W__~~~~~~~~~~__W',
        'W__~~~~~~~~~~__W',
        'W___~~~~~~~~___W',
        'W_A__________A_W',
        'W______________W',
        'WWWWWWWSWWWWWWWW',
      ],
      legend: { S },
    },
  },
};
