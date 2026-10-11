// Machines, benches and furniture at every spot, drawn as instanced meshes,
// plus the line shafting and belts that drive the machines.
//
// Each prop is a few simple parts in its own frame: x across (the worker's
// left-right), y up, z away from the worker. The prop stands at the spot
// and turns to the spot's facing.
import * as THREE from 'three';
import { stripeTexture } from './textures.js';

const box = (size, at, colour, o = {}) => ({ shape: 'box', size, at, colour, ...o });
const cyl = (r0, r1, h, at, colour, o = {}) => ({ shape: 'cyl', size: [r0, r1, h], at, colour, ...o });
const torus = (R, r, at, colour, o = {}) => ({ shape: 'torus', size: [R, r], at, colour, ...o });
const cone = (r0, r1, h, at, colour, o = {}) => cyl(r0, r1, h, at, colour, o);

const bench = (w = 5, d = 2.4, top = 'wood', z = 1.6) => [
  box([w, 0.3, d], [0, 3, z], top),
  box([w - 0.4, 2.85, d - 0.4], [0, 1.42, z], 'woodDark'),
];

// Pulley positions (prop frame) for machines driven by belt from a line shaft.
const BELTED = {
  capstan: [-2.2, 5, 2.0],
  automatic: [1.6, 4.6, 2.2],
  'toolroom-lathe': [-2.6, 5, 2.0],
  press: [1.0, 5.2, 2.4],
  'polishing-spindle': [0, 3.6, 1.8],
  'spoke-machine': [0.6, 3.6, 1.8],
};

export const LIBRARY = {
  capstan: [
    box([5.6, 2.5, 1.3], [0, 1.25, 2.0], 'machine'),
    box([6, 0.8, 1.6], [0, 2.9, 2.0], 'machine'),
    box([1.4, 1.2, 1.4], [-2.2, 3.9, 2.0], 'machine'),
    cyl(0.45, 0.45, 0.6, [1.2, 3.7, 2.0], 'bright'),
    cyl(0.7, 0.5, 1.2, [-2.2, 5, 2.0], 'bright', { axis: 'x' }),
  ],
  automatic: [
    box([4.5, 3.2, 2.2], [0, 1.6, 2.2], 'machine'),
    box([4.2, 0.8, 1.8], [0, 3.6, 2.2], 'machineGreen'),
    cyl(0.6, 0.6, 0.5, [1.6, 4.6, 2.2], 'bright', { axis: 'x' }),
  ],
  'toolroom-lathe': [
    box([6.6, 2.5, 1.3], [0, 1.25, 2.0], 'machine'),
    box([7, 0.8, 1.6], [0, 2.9, 2.0], 'machine'),
    box([1.4, 1.3, 1.4], [-2.6, 4, 2.0], 'machine'),
    box([0.8, 1, 1], [2.6, 3.8, 2.0], 'machine'),
    cyl(0.7, 0.5, 1.2, [-2.6, 5, 2.0], 'bright', { axis: 'x' }),
  ],
  press: [
    box([2.2, 1, 2.2], [0, 0.5, 2.2], 'machine'),
    box([1, 5, 1], [0, 3, 2.6], 'machine'),
    box([1.4, 1, 1.8], [0, 5.3, 2.1], 'machine'),
    torus(1.1, 0.15, [1.0, 5.2, 2.4], 'iron', { axis: 'x' }),
  ],
  'hardening-furnace': [
    box([4, 4.5, 4], [0, 2.25, 3], 'brick'),
    box([1.6, 1.2, 0.1], [0, 2.2, 0.98], 'glow', { emissive: true }),
    cyl(0.5, 0.6, 8, [0, 8.5, 3.6], 'brickDark'),
  ],
  'pattern-bench': [...bench(7, 2.6, 'woodLight', 1.7)],
  'jig-table': [
    box([5, 0.3, 3.5], [0, 3, 2.1], 'iron'),
    box([4.6, 2.85, 3.1], [0, 1.42, 2.1], 'woodDark'),
    box([3.6, 0.12, 0.12], [0, 3.6, 2.1], 'tube', { rz: 0.35 }),
    box([2.6, 0.12, 0.12], [0.8, 3.6, 2.6], 'tube', { ry: 0.9 }),
    box([0.3, 1.4, 0.3], [-1.6, 3.85, 2.1], 'iron'),
  ],
  hearth: [
    box([3.4, 3, 3], [0, 1.5, 2.1], 'brick'),
    box([2.2, 0.2, 1.8], [0, 3.05, 2.1], 'glow', { emissive: true }),
    cone(0.6, 2.2, 2.5, [0, 7, 2.1], 'iron'),
    cyl(0.4, 0.4, 5, [0, 10.7, 2.1], 'iron'),
  ],
  'file-bench': [...bench(5, 2.4, 'wood', 1.8), box([0.6, 0.6, 0.6], [0.8, 3.45, 1.1], 'iron')],
  sandblast: [box([3.4, 5, 3], [0, 2.5, 2.1], 'iron'), box([1.2, 0.8, 0.1], [0, 3.4, 0.55], 'glass')],
  'pickle-vat': [box([5, 3, 3], [0, 1.5, 2.2], 'woodDark'), box([4.6, 0.1, 2.6], [0, 3.0, 2.2], 'acid')],
  'polishing-spindle': [
    cyl(0.5, 0.7, 3.4, [0, 1.7, 1.8], 'machine'),
    cyl(0.12, 0.12, 3.2, [0, 3.6, 1.8], 'bright', { axis: 'x' }),
    cyl(0.9, 0.9, 0.3, [-1.4, 3.6, 1.8], 'leather', { axis: 'x' }),
    cyl(0.9, 0.9, 0.3, [1.4, 3.6, 1.8], 'leather', { axis: 'x' }),
  ],
  'plating-vat': [
    box([6, 3, 2.8], [0, 1.5, 2.3], 'lead'),
    box([5.6, 0.1, 2.4], [0, 3.0, 2.3], 'nickelBath'),
    box([6, 0.1, 0.1], [0, 3.6, 1.8], 'brass'),
    box([6, 0.1, 0.1], [0, 3.6, 2.8], 'brass'),
  ],
  'scrub-trough': [box([4, 2.6, 2], [0, 1.3, 1.6], 'woodDark'), box([3.6, 0.1, 1.6], [0, 2.6, 1.6], 'water')],
  stove: [
    box([6, 6.8, 5], [0, 3.4, 3.2], 'brickDark'),
    box([5.2, 5.8, 0.15], [0, 3.1, 0.68], 'iron'),
    box([0.15, 5.2, 0.2], [0, 3.1, 0.58], 'machine'),
    cyl(0.5, 0.5, 6, [0, 9.8, 4.2], 'iron'),
  ],
  'dip-tank': [
    box([2.6, 3.6, 2.6], [0, 1.8, 1.9], 'iron'),
    box([2.3, 0.08, 2.3], [0, 3.62, 1.9], 'enamel'),
    box([3, 0.1, 1], [0, 4.6, 2.6], 'iron'),
  ],
  'rubbing-bench': [...bench(5, 2.4, 'wood', 1.6), box([2.4, 0.1, 0.1], [0, 3.6, 1.5], 'enamel', { rz: 0.4 })],
  'lining-bench': [...bench(5, 2.4, 'woodLight', 1.6), box([2.6, 0.1, 0.1], [0, 3.6, 1.5], 'enamel', { rz: 0.3 })],
  bench: [...bench(5, 2.4, 'wood', 1.6), box([0.5, 0.5, 0.5], [-1.2, 3.4, 1.1], 'iron')],
  'spoke-machine': [box([2, 3.2, 2], [0, 1.6, 1.8], 'machine'), cyl(0.5, 0.5, 0.4, [0.6, 3.6, 1.8], 'bright', { axis: 'x' })],
  'lacing-bench': [...bench(4, 2.4, 'wood', 1.6), torus(1.15, 0.06, [0, 3.25, 1.6], 'rim', { axis: 'y' }), cyl(0.15, 0.15, 0.5, [0, 3.25, 1.6], 'bright')],
  'truing-stand': [
    box([0.4, 3.4, 0.4], [0, 1.7, 1.5], 'iron'),
    box([1.8, 0.2, 1.8], [0, 0.1, 1.5], 'iron'),
    torus(1.15, 0.06, [0, 4.0, 1.5], 'rim', { axis: 'x' }),
    cyl(0.12, 0.12, 0.6, [0, 4.0, 1.5], 'bright', { axis: 'x' }),
  ],
  'pillar-bench': [...bench(4.5, 2.4, 'wood', 1.8), cyl(0.15, 0.15, 4, [1.6, 2, 0.9], 'iron')],
  'viewing-bench': [...bench(5, 2.4, 'woodLight', 1.6), box([0.9, 0.5, 0.9], [1.4, 3.4, 1.4], 'brass')],
  'test-stand': [box([2, 1, 4.5], [0, 0.5, 2.2], 'iron'), cyl(0.3, 0.3, 1.6, [0, 1.1, 1.2], 'bright', { axis: 'x' }), cyl(0.3, 0.3, 1.6, [0, 1.1, 3.2], 'bright', { axis: 'x' })],
  'wrapping-table': [
    box([6, 0.3, 3], [0, 2.8, 1.9], 'woodLight'),
    box([5.6, 2.65, 2.6], [0, 1.32, 1.9], 'woodDark'),
    cyl(0.4, 0.4, 2.5, [0, 3.35, 2.9], 'paper', { axis: 'x' }),
  ],
  'packing-bench': [...bench(6, 2.6, 'wood', 1.8)],
  'bin-rack': [
    box([8, 9, 2], [0, 4.5, 1.6], 'woodDark'),
    box([7.8, 0.25, 2.1], [0, 2.2, 1.5], 'wood'),
    box([7.8, 0.25, 2.1], [0, 4.4, 1.5], 'wood'),
    box([7.8, 0.25, 2.1], [0, 6.6, 1.5], 'wood'),
  ],
  'stock-rack': [box([12, 7, 2.5], [0, 3.5, 2.0], 'woodDark'), box([11.6, 0.2, 2.6], [0, 3.5, 1.9], 'wood')],
  'crate-bench': [...bench(7, 3, 'woodLight', 2.0), box([6, 0.4, 0.6], [0, 3.4, 2.2], 'woodLight')],
  forge: [
    box([4, 3, 4], [0, 1.5, 2.4], 'brick'),
    box([2.4, 0.2, 2.4], [0, 3.05, 2.4], 'glow', { emissive: true }),
    cone(0.8, 2.4, 2.6, [0, 7.2, 2.6], 'iron'),
    cyl(0.5, 0.5, 4, [0, 10.4, 2.6], 'iron'),
    box([1.6, 1, 0.8], [2.6, 2.2, 1.2], 'iron'),
  ],
  'mess-seat': [box([4, 0.2, 2.5], [0, 2.6, 1.4], 'woodLight'), box([0.3, 2.5, 2.1], [-1.6, 1.25, 1.4], 'woodDark'), box([0.3, 2.5, 2.1], [1.6, 1.25, 1.4], 'woodDark')],
  desk: [box([4.4, 2.5, 2.4], [0, 1.25, 1.4], 'mahogany'), box([4.4, 0.1, 2.4], [0, 2.55, 1.4], 'leatherGreen')],
  'sloping-desk': [box([4, 3.3, 2.2], [0, 1.65, 1.3], 'mahogany'), box([4, 0.15, 2.3], [0, 3.55, 1.3], 'mahogany', { rx: -0.22 })],
  typewriter: [box([3.6, 2.4, 2.2], [0, 1.2, 1.3], 'mahogany'), box([1.2, 0.5, 1], [0, 2.65, 1.1], 'enamel')],
  counter: [box([8, 3.6, 2], [0, 1.8, 1.4], 'mahogany')],
  safe: [box([2.4, 4, 2.4], [0, 2, 1.6], 'safeGreen'), cyl(0.2, 0.2, 0.15, [0.4, 2.4, 0.38], 'brass', { axis: 'z' })],
  'board-table': [box([14, 0.3, 5], [0, 2.6, 0], 'mahogany'), box([13, 2.45, 0.4], [0, 1.22, 0], 'mahogany')],
  showroom: [box([14, 0.6, 5], [0, 0.3, 3], 'mahogany')],
  'drawing-board': [box([3.6, 0.1, 2.6], [0, 3.3, 1.4], 'paper', { rx: -0.9 }), box([0.3, 3, 0.3], [0, 1.5, 1.6], 'woodDark')],
  'progress-board': [box([7, 4, 0.2], [0, 5, 1.2], 'cork')],
  'copying-press': [box([1.6, 2.6, 1.6], [0, 1.3, 1.2], 'woodDark'), box([1.2, 1, 1.2], [0, 3.1, 1.2], 'iron'), cyl(0.08, 0.08, 1.4, [0, 4.2, 1.2], 'iron')],
  'time-recorder': [
    box([1.4, 2.2, 0.9], [0, 4.6, 0.9], 'mahogany'),
    cyl(0.45, 0.45, 0.08, [0, 5.3, 0.42], 'paper', { axis: 'z' }),
    box([2.4, 3.6, 0.3], [-2.1, 4.4, 1.1], 'woodLight'),
    box([2.4, 3.6, 0.3], [2.1, 4.4, 1.1], 'woodLight'),
  ],
  // A goods shed's platform, along the shed road (sized for a 300 ft shed).
  'shed-platform': [box([296, 1, 36], [0, 0.5, 0], 'stone')],
  'checker-desk': [box([2.6, 3.8, 1.8], [0, 1.9, 1.2], 'woodDark'), box([2.8, 0.15, 2], [0, 3.95, 1.2], 'woodDark', { rx: -0.25 })],
  'foreman-box': [
    box([6, 0.4, 6], [0, 7.2, 0], 'wood'),
    box([6, 3.2, 0.25], [0, 1.6, -3], 'wood'),
    box([6, 3.2, 0.25], [0, 1.6, 3], 'wood'),
    box([0.25, 3.2, 6], [-3, 1.6, 0], 'wood'),
    box([6, 3.8, 0.1], [0, 5.1, 3], 'glass'),
    box([6, 3.8, 0.1], [0, 5.1, -3], 'glass'),
    box([0.1, 3.8, 6], [-3, 5.1, 0], 'glass'),
    box([2.4, 2.6, 1.6], [1.2, 1.3, 1.6], 'mahogany'),
  ],
};

export function colourTable(pal) {
  return {
    machine: pal.machine, machineGreen: '#3f4d45', bright: pal.machineBright, iron: pal.iron, wood: '#6b5640',
    woodDark: '#4a3b2d', woodLight: '#8a7458', brick: pal.brick, brickDark: pal.brickDark, glow: pal.hearthGlow,
    acid: '#8c9a5a', leather: '#7a5c40', lead: '#6f7478', nickelBath: '#4f8a83', brass: pal.brass, water: '#6f8a8a',
    enamel: pal.enamel, rim: '#bfc6c8', paper: '#e9e2cc', tube: '#55595c', mahogany: '#4a2a1f', leatherGreen: '#2f4a3a',
    safeGreen: '#253a2c', cork: '#a07a55', glass: pal.glazing, stone: pal.stone,
  };
}

const UP = new THREE.Vector3(0, 1, 0);

function partGeometry(p) {
  let g;
  if (p.shape === 'box') g = new THREE.BoxGeometry(...p.size);
  else if (p.shape === 'cyl') g = new THREE.CylinderGeometry(p.size[0], p.size[1], p.size[2], 14);
  else if (p.shape === 'torus') g = new THREE.TorusGeometry(p.size[0], p.size[1], 6, 24);
  if (p.shape === 'cyl' && p.axis === 'x') g.rotateZ(Math.PI / 2);
  if (p.shape === 'cyl' && p.axis === 'z') g.rotateX(Math.PI / 2);
  if (p.shape === 'torus' && p.axis === 'x') g.rotateY(Math.PI / 2);
  if (p.shape === 'torus' && p.axis === 'y') g.rotateX(Math.PI / 2);
  if (p.rx) g.rotateX(p.rx);
  if (p.ry) g.rotateY(p.ry);
  if (p.rz) g.rotateZ(p.rz);
  g.translate(...p.at);
  return g;
}

export class PropsLayer {
  constructor(site, pal) {
    this.site = site;
    this.group = new THREE.Group();
    this.group.name = 'props';
    const colours = colourTable(pal);
    this.materials = new Map();
    const mat = (key, emissive) => {
      const k = `${key}${emissive ? '*' : ''}`;
      if (!this.materials.has(k)) {
        const c = colours[key] || '#777';
        const m = key === 'glass'
          ? new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.35, roughness: 0.2 })
          : new THREE.MeshStandardMaterial({ color: c, roughness: /bright|brass|nickel|rim/.test(key) ? 0.4 : 0.85, metalness: /bright|brass|rim|machine|iron/.test(key) ? 0.3 : 0 });
        if (emissive) {
          m.emissive = new THREE.Color(c);
          m.emissiveIntensity = 1.2;
        }
        this.materials.set(k, m);
      }
      return this.materials.get(k);
    };

    // Group spots by prop type.
    const byType = new Map();
    for (const s of site.spots.values()) {
      if (!LIBRARY[s.type]) continue;
      if (!byType.has(s.type)) byType.set(s.type, []);
      byType.get(s.type).push(s);
    }
    this.entries = [];
    this.meshes = [];
    this.glowMaterials = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const [type, spots] of byType) {
      const parts = LIBRARY[type];
      const meshes = parts.map((p) => {
        const im = new THREE.InstancedMesh(partGeometry(p), mat(p.colour, p.emissive), spots.length);
        im.castShadow = p.colour !== 'glass';
        im.receiveShadow = true;
        im.userData = { kind: 'prop', type, spots: spots.map((s) => s.id) };
        if (p.emissive) this.glowMaterials.push(im.material);
        this.group.add(im);
        this.meshes.push(im);
        return im;
      });
      spots.forEach((s, i) => {
        q.setFromAxisAngle(UP, s.facing || 0);
        m4.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(1, 1, 1));
        const entry = { spot: s, meshes, index: i, matrix: m4.clone() };
        this.entries.push(entry);
        for (const im of meshes) im.setMatrixAt(i, entry.matrix);
      });
      for (const im of meshes) im.instanceMatrix.needsUpdate = true;
    }
    this.buildShafting(pal);
  }

  // A line shaft above each row of belted machines, with a belt down to
  // each machine's pulley.
  buildShafting(pal) {
    const rows = new Map();
    const v = new THREE.Vector3();
    for (const e of this.entries) {
      const pulley = BELTED[e.spot.type];
      if (!pulley) continue;
      v.set(...pulley).applyMatrix4(e.matrix);
      const b = this.site.buildings.get(e.spot.building);
      const key = `${e.spot.building}|${e.spot.floor}|${Math.round(v.z)}`;
      if (!rows.has(key)) rows.set(key, { building: b, floor: e.spot.floor, z: Math.round(v.z), xs: [], belts: [] });
      const row = rows.get(key);
      row.xs.push(v.x);
      row.belts.push({ x: v.x, y: v.y, spot: e.spot });
    }
    const shaftTex = stripeTexture('#7d8387', '#4c5155', { across: true });
    const beltTex = stripeTexture(pal.belt, '#4a3a2c');
    this.shaftMat = new THREE.MeshStandardMaterial({ map: shaftTex, metalness: 0.5, roughness: 0.4 });
    this.beltMat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.9 });
    const shaftGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 10);
    shaftGeo.rotateZ(Math.PI / 2);
    const beltGeo = new THREE.BoxGeometry(0.35, 1, 0.08);
    const nShaft = rows.size;
    let nBelt = 0;
    for (const r of rows.values()) nBelt += r.belts.length;
    this.shafts = new THREE.InstancedMesh(shaftGeo, this.shaftMat, nShaft);
    this.belts = new THREE.InstancedMesh(beltGeo, this.beltMat, nBelt);
    this.shaftEntries = [];
    this.beltEntries = [];
    const m = new THREE.Matrix4();
    let i = 0;
    let j = 0;
    for (const r of rows.values()) {
      const b = r.building;
      const y = r.floor * b.floorHeight + b.floorHeight - 1.6;
      const x0 = Math.min(...r.xs) - 4;
      const x1 = Math.max(...r.xs) + 4;
      m.compose(new THREE.Vector3((x0 + x1) / 2, y, r.z), new THREE.Quaternion(), new THREE.Vector3(x1 - x0, 1, 1));
      this.shaftEntries.push({ building: b.id, floor: r.floor, matrix: m.clone(), index: i });
      this.shafts.setMatrixAt(i++, m);
      for (const bt of r.belts) {
        const len = y - bt.y;
        m.compose(new THREE.Vector3(bt.x, bt.y + len / 2, r.z), new THREE.Quaternion(), new THREE.Vector3(1, len, 1));
        this.beltEntries.push({ building: b.id, floor: r.floor, matrix: m.clone(), index: j });
        this.belts.setMatrixAt(j++, m);
      }
    }
    this.shafts.castShadow = true;
    this.belts.castShadow = true;
    this.group.add(this.shafts, this.belts);
  }

  // Show or hide everything on a given building floor.
  setVisibility(isVisible) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const e of this.entries) {
      const vis = isVisible(e.spot.building, e.spot.floor);
      for (const im of e.meshes) im.setMatrixAt(e.index, vis ? e.matrix : zero);
    }
    for (const im of this.meshes) im.instanceMatrix.needsUpdate = true;
    for (const e of this.shaftEntries) this.shafts.setMatrixAt(e.index, isVisible(e.building, e.floor) ? e.matrix : zero);
    for (const e of this.beltEntries) this.belts.setMatrixAt(e.index, isVisible(e.building, e.floor) ? e.matrix : zero);
    this.shafts.instanceMatrix.needsUpdate = true;
    this.belts.instanceMatrix.needsUpdate = true;
  }

  // Turn the shafting and run the belts; `speed` is 0 (stopped) to 1.
  animate(dt, speed, glow) {
    this.phase = (this.phase || 0) + dt * speed * 2.5;
    this.shaftMat.map.offset.x = this.phase;
    this.beltMat.map.offset.y = -this.phase * 1.7;
    for (const m of this.glowMaterials) m.emissiveIntensity = glow;
  }

  spotAt(mesh, instanceId) {
    return mesh.userData.spots ? mesh.userData.spots[instanceId] : null;
  }
}
