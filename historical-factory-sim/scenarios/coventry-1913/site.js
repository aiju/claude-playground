// The Sherbourne Works, Foleshill, Coventry, as it stood in 1913.
//
// The ground plan is invented (DESIGN.md §3); the building types, sizes and
// the floor-by-floor allocation of shops follow Humber's Lower Ford Street
// works as described by the Institution of Mechanical Engineers in 1897, and
// the north-light shed follows Humber's Folly Lane extension of 1907–8.
//
// Feet; x east, z south. Sherbourne Street runs along the south side, the
// Coventry Canal along the north.

import { goodsYard } from './railway.js';

export const STREET_Z = 200;
export const CANAL_Z = -185;

export const buildings = [
  {
    id: 'office', name: 'Offices and Showroom', x: -250, z: 140, w: 120, d: 35,
    floors: 2, floorHeight: 13, roof: { type: 'hipped', pitch: 0.55 }, style: 'office',
    stairs: [-238],
    signs: [{ side: 'S', y: 24.2, width: 104, height: 2.6, text: 'THE SHERBOURNE CYCLE COMPANY LIMITED' }],
    doors: [
      { side: 'S', x: -244, to: 'S_OF', id: 'office:front' },
      { side: 'N', x: -190, to: 'Y1', id: 'office:back' },
    ],
    rooms: [
      { id: 'entrance', name: 'Entrance Hall', floor: 0, x0: -250, x1: -232 },
      { id: 'general-office', name: 'General Office', floor: 0, x0: -232, x1: -168 },
      { id: 'cashier', name: "Cashier's Office", floor: 0, x0: -168, x1: -152 },
      { id: 'showroom', name: 'Showroom', floor: 0, x0: -152, x1: -130 },
      { id: 'board-room', name: 'Board Room', floor: 1, x0: -250, x1: -218 },
      { id: 'md', name: "Managing Director's Room", floor: 1, x0: -218, x1: -200 },
      { id: 'secretary', name: "Secretary's Room", floor: 1, x0: -200, x1: -182 },
      { id: 'correspondence', name: 'Correspondence and Typists', floor: 1, x0: -182, x1: -155 },
      { id: 'travellers', name: "Travellers' Room", floor: 1, x0: -155, x1: -130 },
    ],
  },
  {
    id: 'gatehouse', name: 'Gatehouse, Time Office and Wages Office', x: -126, z: 150, w: 40, d: 24,
    floors: 1, floorHeight: 11, roof: { type: 'gable', pitch: 0.6 }, style: 'office',
    doors: [{ side: 'N', x: -96, to: 'GH_Y', id: 'gatehouse:door' }],
    signs: [{ side: 'S', y: 9.6, width: 22, height: 1.4, text: 'TIME OFFICE', x: -95 }],
    rooms: [
      { id: 'wages-office', name: 'Wages Office', floor: 0, x0: -126, x1: -105 },
      { id: 'time-office', name: 'Time Office', floor: 0, x0: -105, x1: -86 },
    ],
  },
  {
    id: 'main', name: 'Main Block', x: -230, z: 30, w: 230, d: 55,
    floors: 4, floorHeight: 14, roof: { type: 'hipped', pitch: 0.5 }, style: 'works',
    stairs: [-222, -8], hoists: [-214, -16],
    signs: [{ side: 'S', y: 14, width: 150, height: 3.4, text: 'SHERBOURNE CYCLE WORKS' }],
    fireEscapes: [{ side: 'N', x: -150 }, { side: 'N', x: -60 }],
    doors: [
      { side: 'S', x: -200, to: 'DOCK', id: 'main:despatch' },
      { side: 'S', x: -110, to: 'Y2', id: 'main:works' },
      { side: 'S', x: -30, to: 'Y4', id: 'main:stores' },
      { side: 'N', x: -120, to: 'BY1', id: 'main:back' },
    ],
    rooms: [
      { id: 'warehouse', name: 'Warehouse, Wrapping and Despatch', floor: 0, x0: -230, x1: -170, dept: 'warehouse' },
      { id: 'polishing', name: 'Polishing Shop', floor: 0, x0: -170, x1: -95, dept: 'polishing' },
      { id: 'plating', name: 'Plating Shop', floor: 0, x0: -95, x1: -60, dept: 'plating' },
      { id: 'rough-stores', name: 'Rough Stores', floor: 0, x0: -60, x1: 0, dept: 'stores' },
      { id: 'finishing', name: 'Finishing Shop and Final View', floor: 1, x0: -230, x1: -172, dept: 'finishing' },
      { id: 'wheel-shop', name: 'Wheel Shop', floor: 1, x0: -172, x1: -122, dept: 'wheels' },
      { id: 'brakework', name: 'Brakework, Mudguard and Handlebar Shop', floor: 1, x0: -122, x1: -105, dept: 'brakework' },
      { id: 'works-office', name: 'Works Office and Drawing Office', floor: 1, x0: -105, x1: -85 },
      { id: 'enamelling', name: 'Enamelling Shop', floor: 1, x0: -85, x1: -25, dept: 'enamelling' },
      { id: 'lining', name: 'Lining and Transfer Room', floor: 1, x0: -25, x1: 0, dept: 'lining' },
      { id: 'filing', name: 'Filing, Pickling and Sand-blast Shop', floor: 2, x0: -230, x1: -160, dept: 'filing' },
      { id: 'frame-shop', name: 'Frame Building Shop', floor: 2, x0: -160, x1: -110, dept: 'frames' },
      { id: 'brazing', name: 'Brazing Shop', floor: 2, x0: -110, x1: -70, dept: 'brazing' },
      { id: 'view-room', name: 'View Room and Finished Stores', floor: 2, x0: -70, x1: 0, dept: 'viewing' },
      { id: 'stock-room', name: 'Stock Room', floor: 3, x0: -230, x1: -140, dept: 'warehouse' },
      { id: 'pattern-shop', name: 'Pattern Shop', floor: 3, x0: -140, x1: -95, dept: 'toolroom' },
      { id: 'toolroom', name: 'Toolroom', floor: 3, x0: -95, x1: 0, dept: 'toolroom' },
    ],
  },
  {
    id: 'engine-house', name: 'Engine House', x: 6, z: 42, w: 44, d: 40,
    floors: 1, floorHeight: 26, roof: { type: 'gable', pitch: 0.5 }, style: 'engine',
    doors: [{ side: 'S', x: 28, to: 'Y5', id: 'engine:door' }],
    rooms: [{ id: 'engine-room', name: 'Engine House', floor: 0, x0: 6, x1: 50, dept: 'engine' }],
  },
  {
    id: 'boiler-house', name: 'Boiler House', x: 6, z: -18, w: 44, d: 56,
    floors: 1, floorHeight: 20, roof: { type: 'gable', pitch: 0.4 }, style: 'works',
    doors: [{ side: 'N', x: 28, to: 'N5', id: 'boiler:door' }],
    rooms: [{ id: 'boiler-room', name: 'Boiler House', floor: 0, x0: 6, x1: 50, dept: 'engine' }],
    chimney: { x: 28, z: -40, height: 125, base: 13, top: 8 },
  },
  {
    id: 'shed', name: 'Machine Shop (1907 shed)', x: 62, z: -12, w: 160, d: 100,
    floors: 1, floorHeight: 16, roof: { type: 'northlight', teeth: 7 }, style: 'works',
    doors: [
      { side: 'S', x: 100, to: 'Y6', id: 'shed:west' },
      { side: 'S', x: 180, to: 'Y7', id: 'shed:east' },
      { side: 'N', x: 140, to: 'E_N', id: 'shed:north' },
    ],
    rooms: [
      { id: 'hardening', name: 'Hardening Shop', floor: 0, x0: 62, x1: 84, dept: 'press' },
      { id: 'press-shop', name: 'Press Shop', floor: 0, x0: 84, x1: 112, dept: 'press' },
      { id: 'machine-shop', name: 'Machine Shop', floor: 0, x0: 112, x1: 222, dept: 'machine' },
    ],
  },
  {
    id: 'smithy', name: 'Smithy', x: -150, z: -95, w: 36, d: 30,
    floors: 1, floorHeight: 14, roof: { type: 'gable', pitch: 0.45, glazed: true }, style: 'works',
    doors: [{ side: 'S', x: -132, to: 'N2', id: 'smithy:door' }],
    rooms: [{ id: 'smithy-room', name: 'Smithy', floor: 0, x0: -150, x1: -114, dept: 'yard' }],
  },
  {
    id: 'crate-shop', name: 'Crate Shop', x: -105, z: -95, w: 46, d: 30,
    floors: 1, floorHeight: 13, roof: { type: 'gable', pitch: 0.45 }, style: 'timber',
    doors: [{ side: 'S', x: -82, to: 'N3', id: 'crate:door' }],
    rooms: [{ id: 'crate-room', name: 'Crate Shop', floor: 0, x0: -105, x1: -59, dept: 'crates' }],
  },
  {
    id: 'mess', name: 'Mess Room', x: -50, z: -95, w: 36, d: 30,
    floors: 1, floorHeight: 12, roof: { type: 'gable', pitch: 0.45 }, style: 'works',
    doors: [{ side: 'S', x: -32, to: 'N4', id: 'mess:door' }],
    rooms: [{ id: 'mess-room', name: 'Mess Room', floor: 0, x0: -50, x1: -14 }],
  },
  {
    id: 'stable', name: 'Stable and Cart Shed', x: -250, z: -95, w: 46, d: 34,
    floors: 1, floorHeight: 13, roof: { type: 'gable', pitch: 0.5 }, style: 'timber',
    doors: [{ side: 'S', x: -228, to: 'N1', id: 'stable:door' }],
    rooms: [{ id: 'stable-room', name: 'Stable and Cart Shed', floor: 0, x0: -250, x1: -204, dept: 'warehouse' }],
  },
  {
    id: 'lavatories', name: 'Lavatories', x: -254, z: 118, w: 18, d: 18,
    floors: 1, floorHeight: 10, roof: { type: 'flat' }, style: 'works',
    doors: [{ side: 'N', x: -245, to: 'Y_W', id: 'lav:door' }],
    rooms: [{ id: 'lav-room', name: 'Lavatories (men and women separately)', floor: 0, x0: -254, x1: -236 }],
  },
];

const n = (id, x, z, extra = {}) => ({ id, x, z, ...extra });

export const yard = {
  nodes: [
    // Sherbourne Street, and the ways home.
    n('HOME_W', -1100, STREET_Z, { kind: 'home', label: 'towards Foleshill Road' }),
    n('S_W', -420, STREET_Z), n('S_OF', -244, STREET_Z), n('S_SS', -170, STREET_Z),
    n('S_G', -65, STREET_Z), n('S_E', 400, STREET_Z),
    n('HOME_E', 1100, STREET_Z, { kind: 'home', label: 'towards Bell Green' }),
    n('HOME_S', -170, 900, { kind: 'home', label: 'up Cross Street' }),
    // The gate and the gatehouse.
    n('G', -65, 182, { label: 'Works gate' }), n('G_IN', -65, 140), n('GH_Y', -96, 132),
    // The front yard between the offices and the main block.
    n('Y_W', -245, 104), n('Y1', -190, 108), n('DOCK', -200, 96, { label: 'Despatch dock' }),
    n('Y2', -110, 108), n('Y3', -65, 108), n('Y4', -30, 108), n('Y5', 28, 108),
    n('Y6', 100, 108), n('Y7', 180, 108), n('Y_E', 240, 108),
    // Behind the main block.
    n('BY_W', -245, 14), n('BY1', -120, 14), n('BY2', -16, 14),
    n('NW', -245, -50), n('N1', -228, -50), n('N2', -132, -50), n('N3', -82, -50), n('N4', -32, -50),
    n('N5', 28, -32), n('E_N', 140, -30), n('E1', 240, -30),
    n('COAL', 28, -110, { label: 'Coal yard' }), n('WHARF', 28, -163, { label: 'Canal wharf' }),
    // The canal itself, for boats (not joined to the yard).
    n('CN_E', 1150, CANAL_Z, { kind: 'home', label: 'the canal, from Hawkesbury and the Griff arm' }),
    n('CN_WHARF', 28, CANAL_Z + 6, { label: 'Tied up at the works wharf' }),
    n('CN_W', -1150, CANAL_Z, { kind: 'home', label: 'the canal, to the Coventry basin' }),
  ],
  edges: [
    ['HOME_W', 'S_W'], ['S_W', 'S_OF'], ['S_OF', 'S_SS'], ['S_SS', 'S_G'], ['S_G', 'S_E'], ['S_E', 'HOME_E'],
    ['S_SS', 'HOME_S'],
    ['S_G', 'G'], ['G', 'G_IN'], ['G_IN', 'GH_Y'], ['GH_Y', 'Y3'], ['G_IN', 'Y3'],
    ['Y_W', 'Y1'], ['Y1', 'DOCK'], ['Y1', 'Y2'], ['Y2', 'Y3'], ['Y3', 'Y4'], ['Y4', 'Y5'], ['Y5', 'Y6'],
    ['Y6', 'Y7'], ['Y7', 'Y_E'],
    ['Y_W', 'BY_W'], ['BY_W', 'BY1'], ['BY1', 'BY2'], ['BY2', 'N4'], ['BY_W', 'NW'],
    ['NW', 'N1'], ['N1', 'N2'], ['N2', 'N3'], ['N3', 'N4'], ['N4', 'N5'], ['N5', 'E_N'], ['E_N', 'E1'],
    ['E1', 'Y_E'], ['N5', 'COAL'], ['COAL', 'WHARF'],
    ['CN_E', 'CN_WHARF'], ['CN_WHARF', 'CN_W'],
  ],
};

// Fixed spots that aren't part of a department's rows: desks, the time
// recorders, the engine, stoves and the like.
export const fixedSpots = [
  // Gatehouse
  { id: 'time-recorder-1', room: 'time-office', x: -100, z: 156, type: 'time-recorder', facing: Math.PI, label: 'Time recorder No. 1' },
  { id: 'time-recorder-2', room: 'time-office', x: -92, z: 156, type: 'time-recorder', facing: Math.PI, label: 'Time recorder No. 2' },
  { id: 'gatekeeper', room: 'time-office', x: -95, z: 167, type: 'desk', facing: Math.PI, label: "Gatekeeper's desk" },
  { id: 'timekeeper', room: 'time-office', x: -101, z: 166, type: 'desk', facing: Math.PI, label: "Timekeeper's desk" },
  { id: 'wages-1', room: 'wages-office', x: -121, z: 158, type: 'desk', facing: 0, label: 'Wages clerk' },
  { id: 'wages-2', room: 'wages-office', x: -113, z: 158, type: 'desk', facing: 0, label: 'Wages clerk' },
  { id: 'pay-window', room: 'wages-office', x: -110, z: 168, type: 'counter', facing: Math.PI, label: 'Pay window' },
  // Office range, ground floor
  { id: 'enquiry', room: 'entrance', x: -238, z: 166, type: 'counter', facing: 0, label: 'Enquiry counter' },
  { id: 'chief-clerk', room: 'general-office', x: -226, z: 150, type: 'desk', facing: 0, label: "Chief clerk's desk" },
  { id: 'order-clerk', room: 'general-office', x: -216, z: 150, type: 'sloping-desk', facing: 0, label: 'Order and invoice clerk' },
  { id: 'sales-ledger', room: 'general-office', x: -206, z: 150, type: 'sloping-desk', facing: 0, label: 'Sales ledger' },
  { id: 'bought-ledger', room: 'general-office', x: -196, z: 150, type: 'sloping-desk', facing: 0, label: 'Bought ledger' },
  { id: 'buyer', room: 'general-office', x: -186, z: 166, type: 'desk', facing: Math.PI, label: "Buyer's desk" },
  { id: 'buyer-clerk', room: 'general-office', x: -196, z: 166, type: 'sloping-desk', facing: Math.PI, label: "Buyer's clerk" },
  { id: 'office-boys', room: 'general-office', x: -224, z: 166, type: 'bench', facing: Math.PI, label: "Office boys' bench" },
  { id: 'cashier-desk', room: 'cashier', x: -160, z: 152, type: 'desk', facing: 0, label: "Cashier's desk" },
  { id: 'cashier-safe', room: 'cashier', x: -160, z: 168, type: 'safe', facing: Math.PI, label: 'Safe' },
  { id: 'showroom-stand', room: 'showroom', x: -141, z: 157, type: 'showroom', facing: 0, label: 'Showroom' },
  // Office range, first floor
  { id: 'board-table', room: 'board-room', x: -234, z: 157, type: 'board-table', facing: 0, label: 'Board table' },
  { id: 'md-desk', room: 'md', x: -209, z: 152, type: 'desk', facing: 0, label: "Managing Director's desk" },
  { id: 'secretary-desk', room: 'secretary', x: -191, z: 152, type: 'desk', facing: 0, label: "Secretary's desk" },
  { id: 'correspondence-clerk', room: 'correspondence', x: -176, z: 150, type: 'desk', facing: 0, label: 'Correspondence clerk' },
  { id: 'typist-1', room: 'correspondence', x: -168, z: 150, type: 'typewriter', facing: 0, label: 'Typist' },
  { id: 'typist-2', room: 'correspondence', x: -160, z: 150, type: 'typewriter', facing: 0, label: 'Typist' },
  { id: 'letter-press', room: 'correspondence', x: -170, z: 167, type: 'copying-press', facing: Math.PI, label: 'Copying press and letter books' },
  { id: 'traveller-1', room: 'travellers', x: -148, z: 152, type: 'desk', facing: 0, label: "Traveller's desk" },
  { id: 'traveller-2', room: 'travellers', x: -138, z: 152, type: 'desk', facing: 0, label: "Traveller's desk" },
  // Works office (main block, first floor, in the middle)
  { id: 'works-manager', room: 'works-office', x: -101, z: 38, type: 'desk', facing: Math.PI, label: "Works Manager's desk" },
  { id: 'works-accountant', room: 'works-office', x: -95, z: 38, type: 'desk', facing: Math.PI, label: 'Works Accountant' },
  { id: 'cost-1', room: 'works-office', x: -89, z: 38, type: 'sloping-desk', facing: Math.PI, label: 'Cost clerk' },
  { id: 'cost-2', room: 'works-office', x: -89, z: 48, type: 'sloping-desk', facing: Math.PI, label: 'Cost clerk' },
  { id: 'production-clerk', room: 'works-office', x: -101, z: 76, type: 'sloping-desk', facing: 0, label: 'Production clerk' },
  { id: 'progress-board', room: 'works-office', x: -95, z: 78, type: 'progress-board', facing: 0, label: 'Progress board' },
  { id: 'ratefixer', room: 'works-office', x: -89, z: 76, type: 'desk', facing: 0, label: 'Ratefixer' },
  { id: 'draughtsman-1', room: 'works-office', x: -101, z: 48, type: 'drawing-board', facing: Math.PI, label: 'Drawing board' },
  { id: 'draughtsman-2', room: 'works-office', x: -95, z: 48, type: 'drawing-board', facing: Math.PI, label: 'Drawing board' },
  // Stores
  { id: 'storekeeper', room: 'rough-stores', x: -22, z: 45, type: 'desk', facing: Math.PI, label: "Storekeeper's desk" },
  { id: 'receiving-clerk', room: 'rough-stores', x: -10, z: 45, type: 'sloping-desk', facing: Math.PI, label: 'Receiving clerk' },
  { id: 'stores-counter', room: 'rough-stores', x: -24, z: 68, type: 'counter', facing: 0, label: 'Stores issue counter' },
  { id: 'despatch-clerk', room: 'warehouse', x: -176, z: 40, type: 'sloping-desk', facing: Math.PI, label: "Despatch clerk's desk" },
  { id: 'view-counter', room: 'view-room', x: -40, z: 68, type: 'counter', facing: 0, label: 'Finished stores counter' },
  // Engine and boilers
  { id: 'engine-driver', room: 'engine-room', x: 18, z: 72, type: 'engine-driver', facing: Math.PI, label: "Engine driver's place" },
  { id: 'stoker-1', room: 'boiler-room', x: 18, z: -2, type: 'boiler-front', facing: 0, label: 'Boiler No. 1' },
  { id: 'stoker-2', room: 'boiler-room', x: 38, z: -2, type: 'boiler-front', facing: 0, label: 'Boiler No. 2' },
  // Mess room tables
  { id: 'mess-table', room: 'mess-room', x: -32, z: -80, type: 'mess-table', facing: 0, label: 'Mess room tables' },
];

// Department rows: worker spots laid out with Site.fillRoom.
export const rowSpots = [
  { room: 'machine-shop', prefix: 'capstan-', type: 'capstan', count: 40, rows: 4, x0: 116, x1: 218 },
  { room: 'machine-shop', prefix: 'auto-', type: 'automatic', count: 18, rows: 2, x0: 116, x1: 218, gap: 33 },
  { room: 'press-shop', prefix: 'press-', type: 'press', count: 8, rows: 2 },
  { room: 'hardening', prefix: 'hardening-', type: 'hardening-furnace', count: 4, rows: 2 },
  { room: 'toolroom', prefix: 'toolroom-', type: 'toolroom-lathe', count: 16, rows: 2 },
  { room: 'pattern-shop', prefix: 'pattern-', type: 'pattern-bench', count: 3, rows: 2 },
  { room: 'frame-shop', prefix: 'frame-jig-', type: 'jig-table', count: 15, rows: 2 },
  { room: 'brazing', prefix: 'hearth-', type: 'hearth', count: 10, rows: 2 },
  { room: 'filing', prefix: 'file-bench-', type: 'file-bench', count: 14, rows: 2, x1: -180 },
  { room: 'filing', prefix: 'sandblast-', type: 'sandblast', count: 4, rows: 2, x0: -180, x1: -168 },
  { room: 'filing', prefix: 'pickle-', type: 'pickle-vat', count: 2, rows: 2, x0: -168 },
  { room: 'polishing', prefix: 'spindle-', type: 'polishing-spindle', count: 35, rows: 4 },
  { room: 'plating', prefix: 'plating-vat-', type: 'plating-vat', count: 9, rows: 2, x1: -72 },
  { room: 'plating', prefix: 'scrub-', type: 'scrub-trough', count: 6, rows: 2, x0: -72 },
  { room: 'enamelling', prefix: 'stove-', type: 'stove', count: 4, rows: 2, x1: -62, gap: 18, margin: 2 },
  { room: 'enamelling', prefix: 'dip-', type: 'dip-tank', count: 6, rows: 2, x0: -62, x1: -46 },
  { room: 'enamelling', prefix: 'rubbing-', type: 'rubbing-bench', count: 14, rows: 4, x0: -46, margin: 2 },
  { room: 'lining', prefix: 'lining-bench-', type: 'lining-bench', count: 8, rows: 2 },
  { room: 'wheel-shop', prefix: 'spoke-machine-', type: 'spoke-machine', count: 4, rows: 2, x0: -172, x1: -160, margin: 2 },
  { room: 'wheel-shop', prefix: 'lacing-', type: 'lacing-bench', count: 10, rows: 4, x0: -160, x1: -142, margin: 2 },
  { room: 'wheel-shop', prefix: 'truing-', type: 'truing-stand', count: 8, rows: 4, x0: -142, margin: 2 },
  { room: 'brakework', prefix: 'fitting-bench-', type: 'bench', count: 15, rows: 4, margin: 1.5 },
  { room: 'finishing', prefix: 'pillar-bench-', type: 'pillar-bench', count: 35, rows: 4, x0: -214, margin: 2 },
  { room: 'view-room', prefix: 'viewing-bench-', type: 'viewing-bench', count: 6, rows: 2, x1: -46 },
  { room: 'finishing', prefix: 'test-stand-', type: 'test-stand', count: 4, rows: 2, x1: -214, margin: 2 },
  { room: 'warehouse', prefix: 'wrapping-', type: 'wrapping-table', count: 6, rows: 2, x1: -204 },
  { room: 'warehouse', prefix: 'warehouse-', type: 'packing-bench', count: 10, rows: 2, x0: -204, x1: -182 },
  { room: 'rough-stores', prefix: 'bins-', type: 'bin-rack', count: 12, rows: 2, x0: -60, x1: -30, gap: 20 },
  { room: 'view-room', prefix: 'finished-bins-', type: 'bin-rack', count: 10, rows: 2, x0: -34, gap: 20 },
  { room: 'stock-room', prefix: 'stock-rack-', type: 'stock-rack', count: 12, rows: 2, gap: 16 },
  { room: 'crate-room', prefix: 'crate-bench-', type: 'crate-bench', count: 5, rows: 2 },
  { room: 'smithy-room', prefix: 'forge-', type: 'forge', count: 2, rows: 2 },
  { room: 'mess-room', prefix: 'mess-seat-', type: 'mess-seat', count: 24, rows: 4, margin: 3 },
];

// The L. & N.W.R. goods yard at Warwick Road, two miles off: a separate patch
// of the map, joined to the works only by the road journey between them.
buildings.push(...goodsYard.buildings);
yard.nodes.push(...goodsYard.nodes);
yard.edges.push(...goodsYard.edges);
fixedSpots.push(...goodsYard.spots);
