// Foglight island: twelve screens, four across and three down.
//
//   Whispering Woods | Northern Meadow | Old Ruins        | Gull Point
//   Woodland Edge    | Mossbrook       | Riverside        | East Fields
//   Driftwood Beach  | Southern Shore  | Mirror Lake      | Sunny Cove

import { T } from '../tiles.js';
import { talk } from './talk.js';

const npc = (species, name, talkFn, extra = {}) => ({ ent: { type: 'npc', species, name, talk: talkFn, ...extra } });
const sign = (text) => ({ ent: { type: 'sign', text } });
const chest = (item, extra = {}) => ({ ent: { type: 'chest', item, ...extra } });
const warp = (to, dir = 'up', extra = {}) => ({ ent: { type: 'warp', to, dir, ...extra } });

export const OVERWORLD = {
  id: 'overworld',
  name: 'Foglight Isle',
  env: 'day',
  kind: 'overworld',
  theme: 'overworld',
  music: (g) => 'overworld',
  structures: [
    { type: 'house', x: 18, y: 12, w: 3, h: 2, door: 1, roof: 0xd0564a },
    { type: 'house', x: 27, y: 12, w: 3, h: 2, door: 1, roof: 0x4a7fc0, wall: 0xf0e6d0 },
    { type: 'shop', x: 18, y: 18, w: 4, h: 2, door: 1, roof: 0x8a5ac0 },
    { type: 'lighthouse', x: 59, y: 2, w: 3, h: 3, litFlag: 'lighthouseLit' },
    { type: 'shrine', x: 33, y: 24, w: 5, h: 3 },
    { type: 'cave', x: 8, y: 1 },
    { type: 'cave', x: 2, y: 13 },
  ],
  screens: {
    // ------------------------------------------------------------ row 0
    '0,0': {
      name: 'Whispering Woods',
      map: [
        '################',
        '####TT##D##TTT##',
        '###TT;##;##;;TT#',
        '##TT;;;;;S;;;;TT',
        '#TT;;g;;;;;;;;;;',
        '#T;;;;b;;;;;3;;;',
        '#TT;;;;;;;;;;;;;',
        '#TTT;g;;;1;;;TTT',
        '##TTT;;;;;;;;TTT',
        '##TTTT;;;;;;TTTT',
        '#TTTTT;;;;TTTTTT',
      ],
      legend: {
        D: { tile: T.FOREST, ent: { type: 'warp', to: { area: 'grotto', x: 7.5, z: 20.4, dir: Math.PI }, dir: 'up' } },
        S: sign('WHISPERING GROTTO\nKeep out! Monsters inside.\n— the Mossbrook Council'),
      },
    },
    '1,0': {
      name: 'Northern Meadow',
      map: [
        '################',
        '#YY,,....#######',
        '#Y,,F,,...~~~~~#',
        '#.,,,,,...~~~~~#',
        ';..,,,....~~C~~#',
        ';.........~~~~~#',
        ';....o...S~~~~~#',
        '#..b..........##',
        '#T.....::...TTT#',
        '#TTT..::::..TTT#',
        '#TTTTT::::TTTTT#',
      ],
      legend: {
        F: { ent: { type: 'fairy' } },
        C: chest('shells:50'),
        S: sign('MIRROR POND\nOn a still day you can see the sky in it.\n(There hasn\'t been a still day since the fog came.)'),
      },
    },
    '2,0': {
      name: 'Old Ruins',
      map: [
        '######~~~#######',
        '#####T~~~.nnnnn#',
        '####TT~~~.WWWWW#',
        '####T.~~~.W.C.W#',
        '####TT~~~.W...W#',
        '#####.~~~.WW.WW#',
        '####TT~~~.n.4.n.',
        '####TI~~~..o....',
        '#####T~~~...4...',
        '####TT~~~...WGW#',
        '####TT~~~T:::Wh#',
      ],
      legend: {
        C: chest('bombs'),
        I: { ent: { type: 'eye', flag: 'ruinsEye', ry: Math.PI / 2 } },
        G: { tile: T.PLAZA, ent: { type: 'gate', flag: 'ruinsEye' } },
        h: { tile: T.PLAZA, ent: { type: 'heart' } },
      },
    },
    '3,0': {
      name: 'Gull Point',
      map: [
        '################',
        '####,,..~~~~~~~~',
        '###.,,..~~sHHHs~',
        '##.....k~~sHZHs~',
        '##..o..k~~sHHHs~',
        '#....N.k~~ssDss~',
        '........~~~~~~~~',
        '..S.....~~~~~~~~',
        '..........~~~~~~',
        '#..b......~~~~~~',
        '##T....T~~~~~~~~',
      ],
      legend: {
        N: npc('owl', 'Hoot', talk.hoot),
        Z: { tile: T.HOUSE, ent: { type: 'beam' } },
        S: sign('GULL POINT LIGHTHOUSE\nKeeper: Hoot\nVisitors by boat only.'),
        D: { tile: T.SAND, ent: { type: 'warp', to: { area: 'lighthouse', x: 7.5, z: 8.5, dir: Math.PI }, dir: 'up' } },
      },
    },
    // ------------------------------------------------------------ row 1
    '0,1': {
      name: 'Woodland Edge',
      map: [
        '#TTTTT;;;;TTTTT#',
        '###TT.;;;;.TTTT#',
        '##X#...::...T.T#',
        '##.....::..2..T#',
        '#,,...::.......:',
        '#.,g..::...b..::',
        '#.....:::::::::.',
        '#T..2......g..T#',
        '#TT.......,,..T#',
        '#TT.....b.,,.TT#',
        '#TT....TTTTTTTT#',
      ],
      legend: {
        X: { tile: T.PATH, ents: [{ type: 'cracked' }, { type: 'warp', to: { area: 'heartCave', x: 7.5, z: 8.4, dir: Math.PI }, dir: 'up' }] },
      },
    },
    '1,1': {
      name: 'Mossbrook',
      music: 'village',
      map: [
        '#TTTTT::::TTTTT#',
        '#.HHH.::::.HHH.#',
        '#.HHH.::::.HHH.#',
        '#LSD..::::..E.L#',
        '::::::nnnn::::::',
        ':::::nnnnnN:::::',
        '....,nnUnnn,.K..',
        '#.HHHHnnnnn.ff.#',
        '#.HHHH.:::.J,,b#',
        '#L.Q...:::.,,,L#',
        '#TTT...:::...TT#',
      ],
      legend: {
        D: warp({ area: 'home', x: 7.5, z: 8.3, dir: Math.PI }),
        E: warp({ area: 'elderHouse', x: 7.5, z: 8.3, dir: Math.PI }),
        Q: warp({ area: 'shop', x: 7.5, z: 8.3, dir: Math.PI }),
        S: sign('PIP & NAN GINGER\nNo hawkers. No gulls.'),
        N: npc('turtle', 'Elder Moss', talk.elder, { dir: Math.PI / 2 * 3 }),
        K: npc('rabbit', 'Dot', talk.dot, { wander: 1.6 }),
        J: npc('mouse', 'Mill', talk.mill, { dir: Math.PI }),
      },
    },
    '2,1': {
      name: 'Riverside',
      map: [
        '#TTTTT~~~T:::###',
        '#TT..T~~~.:..:T#',
        '#T....~~~..::.T#',
        '#..S..~~~..::...',
        ':.....~~~l.::...',
        '::::::B~~::::::.',
        '......~~~..::...',
        '#T....~~~...::..',
        '#TT...~~~...::T#',
        '#TTT..~~~T..::T#',
        '#TTTTT~~~TT::::#',
      ],
      legend: {
        S: sign('DRAWBRIDGE\nLowered by the lever on the far bank.\n(Yes, the FAR bank. We know.)'),
        l: { tile: T.PATH, ent: { type: 'lever', flag: 'bridgeDown' } },
        B: { tile: T.WATER, ent: { type: 'bridge', flag: 'bridgeDown', len: 3 } },
      },
    },
    '3,1': {
      name: 'East Fields',
      map: [
        '#TT....TTTTT~~~~',
        '#T......,,..s~~~',
        '#..2.....,..ss~~',
        '...........o.s~~',
        '..:::::::.....s~',
        '......:...4...s~',
        '..b...:.......s~',
        '......:..,,...s~',
        '#T....::...5.ss~',
        '#TT...:::...ss~~',
        '#TTTTT....TTT~~~',
      ],
      legend: {},
    },
    // ------------------------------------------------------------ row 2
    '0,2': {
      name: 'Driftwood Beach',
      map: [
        '~~#....TTTTTTTT#',
        '~~P....,....TTT#',
        '~ss.........b.T#',
        '~ss..P...5......',
        '~~ss............',
        '~~ss..u...o.....',
        '~~~~ss....5.....',
        '~ss~ssss........',
        '~hs~ssPs........',
        '~~~~~sssssssss~~',
        '~~~~~~~~~~~~~~~~',
      ],
      legend: {
        P: T.PALM,
        h: { tile: T.SAND, ent: { type: 'heart' } },
      },
    },
    '1,2': {
      name: 'Southern Shore',
      map: [
        '#TTT....:....TT#',
        '#T......:.....T~',
        '#.,..b..:......~',
        '........:...s~~~',
        '......:::..ss~~~',
        '....::::..sss~~~',
        '..::::..sssss~~~',
        'ss....sssskkk~~~',
        'sssssssssskN~~~~',
        '~~ssssssssk~~~~~',
        '~~~~~~~~~~~~~~~~',
      ],
      legend: {
        N: { tile: T.DOCK, ent: { type: 'npc', species: 'bear', name: 'Bramble', talk: talk.bramble, dir: Math.PI / 2, extra: 'hat.straw' } },
      },
    },
    '2,2': {
      name: 'Mirror Lake',
      map: [
        '~~~~~~~~~TT::::#',
        '~~~~~~~~~T.:...#',
        '~HHHHH~~~..:.4.#',
        '~HHHHH~~~.::....',
        '~HHHHH~~~.:.....',
        '~nnDnn~~~.:..o..',
        '~nnnnnnnnX:.....',
        '~~~~6~~~~.:..2.#',
        '~~~~~~~~~..:...#',
        '~~~~~~~~~ss::ss#',
        '~~~~~~~~~~~~~~~~',
      ],
      legend: {
        D: { tile: T.PLAZA, ent: { type: 'warp', to: { area: 'shrine', x: 23.5, z: 41.3, dir: Math.PI }, dir: 'up' } },
      },
    },
    '3,2': {
      name: 'Sunny Cove',
      map: [
        '#TTTTT....TTT~~~',
        '#T....,..,...s~~',
        '#.....:..:....s~',
        '......:..:..P.s~',
        '...........ssss~',
        '....5....sssss~~',
        '......sssssPss~~',
        '#T..ssss5sss~~~~',
        '#TssssssOss~~~~~',
        '#~~sssssss~~~~~~',
        '~~~~~~~~~~~~~~~~',
      ],
      legend: {
        P: T.PALM,
        O: { ent: { type: 'rock', hide: 'luckyShell' } },
      },
    },
  },
};
