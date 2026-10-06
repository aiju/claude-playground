// Work in progress and finished goods: trays of frames, crates of parts,
// stacks of wheels, bicycles. Lots wait at their room's work-in-progress spot
// or travel with whoever is carrying them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX = 400;

// A simple bicycle, about 6 ft long, wheels 28 in.: [frame and bars, wheels, saddle].
export function bicycleGeometries() {
  const tube = (a, b, r = 0.07) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
    g.translate(...va.clone().add(vb).multiplyScalar(0.5).toArray());
    return g;
  };
  const R = 1.17;
  const rear = [-1.75, R, 0];
  const front = [1.75, R, 0];
  const bracket = [-0.35, 0.95, 0];
  const seatTop = [-0.8, 2.85, 0];
  const head = [1.15, 2.95, 0];
  const headLow = [1.25, 2.45, 0];
  const frame = mergeGeometries([
    tube(bracket, seatTop), tube(seatTop, head), tube(bracket, headLow), tube(head, headLow),
    tube(bracket, rear, 0.05), tube(seatTop, rear, 0.05), tube(headLow, front, 0.06),
    tube(head, [1.05, 3.35, 0], 0.05), tube([0.95, 3.4, -0.85], [0.95, 3.4, 0.85], 0.05),
    tube(seatTop, [-0.85, 3.15, 0], 0.05),
  ]);
  const wheel = (c) => {
    const g = new THREE.TorusGeometry(R, 0.07, 6, 28);
    g.translate(...c);
    return g;
  };
  const wheels = mergeGeometries([wheel(rear), wheel(front)]);
  const saddle = new THREE.BoxGeometry(0.75, 0.18, 0.5);
  saddle.translate(-0.9, 3.25, 0);
  return [frame, wheels, saddle];
}

const STAGE_COLOURS = {
  frames: {
    null: '#8a8f92', built: '#8a8f92', brazed: '#9c8a62', pickled: '#7d8486', filed: '#a5abad', polished: '#c8cdd0',
    viewed: '#c8cdd0', dipped: '#2a2a2a', enamel1: '#262626', enamel2: '#1d1d1d', enamel3: '#121212', lined: '#151209', transferred: '#151209',
  },
  bright: { null: '#9aa0a3', polished: '#cfd4d6', plated: '#e7ebec', assembled: '#e7ebec' },
  wheels: { null: '#9aa0a3', laced: '#b9bec0', trued: '#d5d9da' },
  parts: { null: '#7a6a52' },
  machines: { null: '#2a2a2a', parts: '#2a2a2a', erected: '#1a1a1a', tested: '#1a1a1a', wrapped: '#d9ccb0' },
};

export class LotsLayer {
  constructor(scenario) {
    this.sc = scenario;
    this.production = scenario.production;
    this.site = scenario.site;
    this.group = new THREE.Group();
    this.group.name = 'lots';
    const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.25 });
    const make = (geo) => {
      const im = new THREE.InstancedMesh(geo, mat(), MAX);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      im.castShadow = true;
      im.frustumCulled = false;
      im.userData = { kind: 'lot', ids: [] };
      this.group.add(im);
      return im;
    };
    const rack = new THREE.BoxGeometry(2.6, 1, 1.4);
    rack.translate(0, 0.5, 0);
    const crate = new THREE.BoxGeometry(1.8, 1.1, 1.3);
    crate.translate(0, 0.55, 0);
    const stack = new THREE.CylinderGeometry(1.17, 1.17, 1, 18);
    stack.translate(0, 0.5, 0);
    this.meshes = { frames: make(rack), bright: make(crate), parts: make(crate.clone()), wheels: make(stack) };
    const [frame, wheels, saddle] = bicycleGeometries();
    this.bikes = {
      frame: make(frame),
      wheels: make(wheels),
      saddle: make(saddle),
    };
    this.bikeSlots = this.stockSlots();
    this.showroom = this.showroomSlots();
  }

  // Where finished machines stand in the Stock Room: rows on the floor and
  // hung on the racks above.
  stockSlots() {
    const room = this.site.rooms.get('stock-room');
    const b = this.site.buildings.get(room.building);
    const slots = [];
    if (!room) return slots;
    for (let level = 0; level < 2; level++) {
      for (let row = 0; row < 8; row++) {
        const z = b.z + 6 + row * 6;
        if (Math.abs(z - b.aisleZ) < 4) continue;
        for (let x = room.x0 + 4; x < room.x1 - 3; x += 1.5) slots.push([x, room.y + level * 4.2, z]);
      }
    }
    return slots;
  }

  showroomSlots() {
    const room = this.site.rooms.get('showroom');
    if (!room) return [];
    const b = this.site.buildings.get(room.building);
    return [0, 1, 2, 3].map((i) => [room.x0 + 4 + i * 4.5, room.y + 0.6, b.z + 22]);
  }

  update(t, figures, isVisible) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const counts = { frames: 0, bright: 0, parts: 0, wheels: 0 };
    const perRoom = new Map();
    for (const im of Object.values(this.meshes)) im.userData.ids = [];
    const people = this.sc.world.people;
    const indexOf = this.personIndex || (this.personIndex = new Map(people.map((p, i) => [p.id, i])));
    const stoves = new Set();

    const machineLots = [];
    for (const lot of this.production.active) {
      if (lot.state === 'equip') continue;
      if (lot.kind === 'machines') { machineLots.push(lot); continue; }
      const im = this.meshes[lot.kind];
      if (!im) continue;
      let visible = true;
      let scale = 1;
      if (lot.carrier) {
        const i = indexOf.get(lot.carrier.id);
        if (!figures.visible[i]) visible = false;
        pos.copy(figures.positions[i]);
        const yaw = figures.info[i].yaw;
        pos.x += Math.sin(yaw) * 1.1;
        pos.z += Math.cos(yaw) * 1.1;
        pos.y += 2.4;
        scale = 0.55;
      } else {
        const node = this.site.nodes.get(`wip-${lot.room}`);
        if (!node || !isVisible(node.building, node.floor)) visible = false;
        else {
          const k = perRoom.get(lot.room) || 0;
          perRoom.set(lot.room, k + 1);
          pos.set(node.x + ((k % 6) - 2.5) * 3.2, node.y, node.z + Math.floor(k / 6) * 2.2);
        }
      }
      if (!visible) continue;
      const height = lot.kind === 'wheels' ? 0.4 + lot.qty * 0.1 : lot.kind === 'frames' ? 0.6 + lot.qty * 0.09 : 1;
      s.set(scale, height * scale, scale);
      q.identity();
      m.compose(pos, q, s);
      const n = counts[lot.kind]++;
      if (n >= MAX) continue;
      im.setMatrixAt(n, m);
      const pal = STAGE_COLOURS[lot.kind];
      im.setColorAt(n, c.set(pal[lot.stage] || pal.null));
      im.userData.ids[n] = lot.id;
    }
    for (const [k, im] of Object.entries(this.meshes)) {
      im.count = Math.min(MAX, counts[k]);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    // Bicycles: those being erected, the stock in the Stock Room, and a few
    // in the showroom.
    const bikes = [];
    for (const lot of machineLots) {
      const node = this.site.nodes.get(`wip-${lot.room}`);
      if (!node || !isVisible(node.building, node.floor)) continue;
      const k = perRoom.get(lot.room) || 0;
      perRoom.set(lot.room, k + 1);
      const shown = Math.min(5, lot.qty);
      for (let j = 0; j < shown; j++) {
        bikes.push({ x: node.x + ((k % 3) - 1) * 9 + (j - 2) * 1.6, y: node.y, z: node.z + 0.8, colour: STAGE_COLOURS.machines[lot.stage] || '#1a1a1a', id: lot.id, yaw: Math.PI / 2 });
      }
    }
    const stock = this.sc.world.works?.finishedStock || [];
    const stockVisible = (() => {
      const r = this.site.rooms.get('stock-room');
      return r && isVisible(r.building, r.floor);
    })();
    if (stockVisible) {
      const n = Math.min(stock.length, this.bikeSlots.length);
      for (let i = 0; i < n; i++) {
        const [x, y, z] = this.bikeSlots[i];
        bikes.push({ x, y, z, colour: STAGE_COLOURS.machines.wrapped, id: `bike:${stock[i].frameNo}`, yaw: Math.PI / 2 });
      }
    }
    for (const [x, y, z] of this.showroom) bikes.push({ x, y, z, colour: '#141414', id: 'showroom', yaw: Math.PI / 2 });
    const B = this.bikes;
    for (const im of Object.values(B)) im.userData.ids = [];
    let n = 0;
    for (const bk of bikes) {
      if (n >= MAX) break;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), bk.yaw);
      m.compose(pos.set(bk.x, bk.y, bk.z), q, s.set(1, 1, 1));
      for (const im of Object.values(B)) {
        im.setMatrixAt(n, m);
        im.userData.ids[n] = bk.id;
      }
      B.frame.setColorAt(n, c.set(bk.colour));
      B.wheels.setColorAt(n, c.set(bk.colour === STAGE_COLOURS.machines.wrapped ? '#cbbd9c' : '#3a3a3a'));
      B.saddle.setColorAt(n, c.set(bk.colour === STAGE_COLOURS.machines.wrapped ? '#cbbd9c' : '#5a3a22'));
      n++;
    }
    for (const im of Object.values(B)) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  pickables() {
    return [...Object.values(this.meshes), this.bikes.frame, this.bikes.wheels];
  }
}
