// Tile kinds. Each area is a grid of these; anything that can change during
// play (bushes, blocks, doors, ice...) is an entity instead, so the static
// mesh of a screen never needs rebuilding.

export const SW = 16; // screen width in tiles
export const SH = 11; // screen height in tiles

let nextId = 0;
const defs = [];
function tile(name, props) {
  const t = { id: nextId++, name, solid: false, tall: false, water: false, pit: false, ground: true, ...props };
  defs[t.id] = t;
  return t;
}

// solid: blocks walking. tall: also blocks projectiles and line of sight.
// water: deep water (blocks walking on the ground; frost can freeze it).
// pit: you fall in. ground: draws a ground surface.
export const T = {
  VOID: tile('void', { solid: true, tall: true, ground: false }),
  GRASS: tile('grass'),
  FLOWERS: tile('flowers'),
  PATH: tile('path'),
  SAND: tile('sand'),
  PLAZA: tile('plaza'),
  FOREST: tile('forest'), // darker forest floor
  WATER: tile('water', { solid: true, water: true, ground: false }),
  BRIDGE_H: tile('bridgeH', { ground: false, bridge: true }),
  BRIDGE_V: tile('bridgeV', { ground: false, bridge: true }),
  CLIFF: tile('cliff', { solid: true, tall: true }),
  TREE: tile('tree', { solid: true, tall: true }),
  PINE: tile('pine', { solid: true, tall: true }),
  FENCE: tile('fence', { solid: true }),
  HOUSE: tile('house', { solid: true, tall: true }),
  LEDGE: tile('ledge', { solid: true, ledge: true }),
  FLOOR: tile('floor'),
  WALL: tile('wall', { solid: true, tall: true }),
  PIT: tile('pit', { pit: true, ground: false }),
  ICE: tile('ice', { ice: true }),
  CAVE: tile('cave'),
  ROCKWALL: tile('rockwall', { solid: true, tall: true }),
  WOOD: tile('wood'),
  STATUE: tile('statue', { solid: true, tall: true }),
  SPIKES: tile('spikes', { spikes: true }),
  CARPET: tile('carpet'),
  SHALLOW: tile('shallow', { shallow: true, ground: false }),
  DOCK: tile('dock', { ground: false, bridge: true }),
  BOOKSHELF: tile('bookshelf', { solid: true, tall: true }),
  COUNTER: tile('counter', { solid: true }),
  LAMP: tile('lamp', { solid: true }), // stone lantern 灯籠 style
  GRAVE: tile('grave', { solid: true }),
  WELL: tile('well', { solid: true }),
  STUMP: tile('stump', { solid: true }),
  BOAT: tile('boat', { solid: true, ground: false }),
  PALM: tile('palm', { solid: true, tall: true }),
  INVIS: tile('invis', { solid: true }), // furniture footprint: solid but drawn as floor
};
export const TILE = defs;

// Characters shared by every area. Area legends can add or override these.
// Entity characters map to { tile, ent } where ent describes what to spawn.
export const BASE_LEGEND = {
  ' ': T.VOID,
  '.': T.GRASS,
  ',': T.FLOWERS,
  ':': T.PATH,
  's': T.SAND,
  'n': T.PLAZA,
  ';': T.FOREST,
  '~': T.WATER,
  '-': T.SHALLOW,
  '=': T.BRIDGE_H,
  '|': T.BRIDGE_V,
  'k': T.DOCK,
  '#': T.CLIFF,
  'T': T.TREE,
  'Y': T.PINE,
  'f': T.FENCE,
  'H': T.HOUSE,
  'v': T.LEDGE,
  '_': T.FLOOR,
  'W': T.WALL,
  'O': T.PIT,
  'i': T.ICE,
  'c': T.CAVE,
  'R': T.ROCKWALL,
  'w': T.WOOD,
  'A': T.STATUE,
  '^': T.SPIKES,
  'm': T.CARPET,
  'B': T.BOOKSHELF,
  'Q': T.COUNTER,
  'L': T.LAMP,
  '+': T.GRAVE,
  'U': T.WELL,
  'u': T.STUMP,
  '%': T.INVIS,
  // entity shorthands (ground under them is inferred from the neighbours)
  'b': { ent: { type: 'bush' } },
  'g': { ent: { type: 'tallgrass' } },
  'o': { ent: { type: 'rock' } },
  'p': { ent: { type: 'pot' } },
  'X': { ent: { type: 'boulder' } },
  'x': { ent: { type: 'block' } },
  '1': { ent: { type: 'enemy', kind: 'slime' } },
  '2': { ent: { type: 'enemy', kind: 'spitter' } },
  '3': { ent: { type: 'enemy', kind: 'bat' } },
  '4': { ent: { type: 'enemy', kind: 'knight' } },
  '5': { ent: { type: 'enemy', kind: 'crab' } },
  '6': { ent: { type: 'enemy', kind: 'lurker' }, tile: T.WATER },
  '7': { ent: { type: 'enemy', kind: 'ember' } },
  '8': { ent: { type: 'enemy', kind: 'skelly' } },
  '9': { ent: { type: 'enemy', kind: 'roller' } },
  '0': { ent: { type: 'enemy', kind: 'wisp' } },
  't': { ent: { type: 'torch', lit: false } },
  'j': { ent: { type: 'torch', lit: true } },
  'e': { ent: { type: 'plate' } },
  'z': { ent: { type: 'crystal' } },
  'r': { ent: { type: 'toggle', color: 'red' } },
  'y': { ent: { type: 'toggle', color: 'blue' } },
  'h': { ent: { type: 'heart' } },
};
