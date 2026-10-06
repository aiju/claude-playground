// How the Sherbourne Works and its surroundings look: colours and the
// scenery around the site. These are design choices (DESIGN.md §9); the
// documented facts are the red brick and slate, limewashed shop walls,
// lead-grey LNWR wagons and the chocolate-and-cream Corporation trams.
import { STREET_Z, CANAL_Z } from './site.js';

export const palette = {
  ground: '#6a6957',
  yard: '#7c766a',
  street: '#45444a',
  pavement: '#918b7f',
  grass: '#5d6b45',
  water: '#3d4f52',
  towpath: '#7b725f',
  brick: '#8c4a36',
  brickDark: '#6e3a2b',
  engineeringBrick: '#3f3533',
  officeBrick: '#93503a',
  timber: '#5b4a3a',
  slate: '#4a4f58',
  glazing: '#9fb3b8',
  limewash: '#e8e2d2',
  floor: '#9a9183',
  joinery: '#1f4a33', // Brunswick green doors and window frames
  stone: '#b5a98f',
  soot: '#2a2622',
  window: '#2a3236',
  windowLit: '#f4d18b',
  iron: '#3a3b3d',
  machine: '#3c4142',
  machineBright: '#9aa3a6',
  bench: '#6b5640',
  belt: '#2a211b',
  shaft: '#7d8387',
  enamel: '#141414',
  brass: '#b08d3c',
  hearthGlow: '#ff8a3d',
};

// Terraces, the canal, the street and the like around the site.
export const scenery = {
  street: { z: STREET_Z, width: 34, x0: -1200, x1: 1200 },
  sideStreet: { x: -170, width: 26, z0: STREET_Z, z1: 950 },
  canal: { z: CANAL_Z, width: 34, x0: -1200, x1: 1200 },
  boundaryWall: { x0: -262, x1: 262, z0: -168, z1: 182, height: 9, gates: [[-80, -50]], gaps: [[-250, -238]] },
  terraces: [
    // South side of Sherbourne Street, either side of Cross Street.
    { x0: -760, x1: -190, z: STREET_Z + 22, depth: 30, facing: 'N', storeys: 2 },
    { x0: -150, x1: 700, z: STREET_Z + 22, depth: 30, facing: 'N', storeys: 2 },
    { x0: -760, x1: -190, z: STREET_Z + 130, depth: 30, facing: 'S', storeys: 2 },
    { x0: -150, x1: 700, z: STREET_Z + 130, depth: 30, facing: 'S', storeys: 2 },
    { x0: -760, x1: -190, z: STREET_Z + 190, depth: 30, facing: 'N', storeys: 2 },
    { x0: -150, x1: 700, z: STREET_Z + 190, depth: 30, facing: 'N', storeys: 2 },
    // North side of the street, west and east of the works.
    { x0: -760, x1: -290, z: STREET_Z - 52, depth: 30, facing: 'S', storeys: 2 },
    { x0: 290, x1: 700, z: STREET_Z - 52, depth: 30, facing: 'S', storeys: 2 },
  ],
  pub: { x: -190, z: STREET_Z + 37, w: 40, d: 32, name: 'The Spon End Tavern' },
  neighbourWorks: [
    { x: 300, z: -150, w: 160, d: 90, floors: 3, name: 'a neighbouring ribbon mill' },
  ],
};

// The engine house and boiler house (DESIGN.md §13: a full steam plant).
// The engine's crank is at x 19, z 64; its flywheel turns in the plane of
// the main block's rope race, which takes the drive to every floor, and a
// second rope drive crosses to the 1907 shed.
export const machinery = {
  engine: { position: [19, 0, 64], flywheelZ: -5.5, flywheelRadius: 9 },
  ropeTargets: [[-3, 12, 58.5], [-3, 26, 58.5], [-3, 40, 58.5], [-3, 54, 58.5], [64, 13, 58.5]],
  boilers: [{ position: [17, 0, 1] }, { position: [39, 0, 1] }],
  steamPipe: [[28, 13.5, 16], [28, 13.5, 52]],
};

export const cameraPresets = {
  overview: { label: 'Overview', target: [-50, 10, 30], position: [330, 360, 610], cut: Infinity },
  gate: { label: 'Gate', target: [-75, 3, 178], position: [55, 85, 70], cut: Infinity },
  'main-block': { label: 'Main block', target: [-110, 14, 58], position: [-40, 150, 260], cut: 1 },
  'engine-house': { label: 'Engine house', target: [24, 6, 60], position: [60, 70, 125], cut: 'open' },
  'machine-shop': { label: 'Machine shop', target: [150, 4, 40], position: [200, 110, 210], cut: 'open' },
  offices: { label: 'Offices', target: [-190, 6, 158], position: [-120, 80, 300], cut: 0 },
  'despatch-dock': { label: 'Despatch dock', target: [-200, 4, 90], position: [-130, 70, 175], cut: 0 },
};
