// Horse-drawn vehicles: the pair-horse lorry (a flat dray) with its load of
// crates; the railway companies' covered vans; and light one-horse carts.
// A vehicle is drawn on the move while it's on site; when it's laid up it
// stands where it's kept, unhorsed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { positionAt } from '../sim/world.js';

const CRATE = [6, 3.33, 1]; // about 72 × 40 × 12 in. (est.)
const MAX_LOAD = 16;

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function cyl(r, h, x, y, z, seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

// Each kind faces +x: [body, wheels, where the horses stand, how many,
// where the driver sits, how far the centre trails the point it's driven to].
const KINDS = {
  // Platform 14 ft by 6½ ft, about 3½ ft off the road.
  lorry: () => ({
    body: mergeGeometries([
      box(14, 0.5, 6.6, 0, 3.4, 0), box(14, 0.6, 0.25, 0, 3.9, 3.25), box(14, 0.6, 0.25, 0, 3.9, -3.25),
      box(0.8, 2.2, 5.2, 7.5, 4.3, 0), box(5, 0.3, 0.3, 10, 2.9, 0), box(0.3, 0.3, 4, 12.3, 2.9, 0),
    ]),
    wheels: mergeGeometries([cyl(1.9, 0.35, -4.5, 1.9, 3.5), cyl(1.9, 0.35, -4.5, 1.9, -3.5), cyl(1.4, 0.35, 4.5, 1.4, 3.5), cyl(1.4, 0.35, 4.5, 1.4, -3.5)]),
    horses: [[15.5, 1.5], [15.5, -1.5]], driver: [7.4, 0, 0.8], trail: 10,
  }),
  // A one-horse covered van: wooden sides and a canvas hood on hoops.
  van: () => ({
    body: mergeGeometries([box(11, 0.4, 6, 0, 3.2, 0), box(11, 2.4, 0.25, 0, 4.6, 2.9), box(11, 2.4, 0.25, 0, 4.6, -2.9), box(0.25, 2.4, 6, -5.4, 4.6, 0), box(0.8, 1.6, 5, 6, 4, 0), box(6, 0.25, 0.25, 9, 2.8, 1.1), box(6, 0.25, 0.25, 9, 2.8, -1.1)]),
    hood: (() => {
      const g = new THREE.CylinderGeometry(3.1, 3.1, 11, 14, 1, true, -Math.PI / 2, Math.PI);
      g.rotateZ(Math.PI / 2);
      g.translate(0, 5.8, 0);
      return g;
    })(),
    wheels: mergeGeometries([cyl(1.7, 0.3, -3, 1.7, 3.2), cyl(1.7, 0.3, -3, 1.7, -3.2), cyl(1.3, 0.3, 3.6, 1.3, 3.2), cyl(1.3, 0.3, 3.6, 1.3, -3.2)]),
    horses: [[13, 0]], driver: [6, 0, 0.6], trail: 8,
  }),
  // A narrow boat, about 70 ft by 7 ft: a black hull, the cabin aft, and the
  // hold amidships. Its horse walks the towpath (drawn separately).
  boat: () => ({
    body: mergeGeometries([
      box(70, 3.4, 7, 0, 1.2, 0), box(9, 2.6, 6.2, -29.5, 4.2, 0), box(3, 0.4, 0.4, 34, 3, 0),
      new THREE.CylinderGeometry(0.25, 0.25, 2.2, 8).translate(-27, 6.4, 1.6),
    ]),
    trim: mergeGeometries([box(9.1, 0.5, 6.3, -29.5, 5.3, 0), box(70.2, 0.4, 0.3, 0, 2.95, 3.45), box(70.2, 0.4, 0.3, 0, 2.95, -3.45)]),
    wheels: new THREE.BufferGeometry(),
    horses: [], driver: [-35, -2.2, 0], trail: 34, towed: true,
  }),
  // A light one-horse cart with low sides.
  cart: () => ({
    body: mergeGeometries([box(8, 0.4, 5, 0, 3, 0), box(8, 1.2, 0.2, 0, 3.8, 2.4), box(8, 1.2, 0.2, 0, 3.8, -2.4), box(0.2, 1.2, 5, -3.9, 3.8, 0), box(6, 0.25, 0.25, 7, 2.8, 1), box(6, 0.25, 0.25, 7, 2.8, -1)]),
    wheels: mergeGeometries([cyl(2.2, 0.3, 0, 2.2, 2.8), cyl(2.2, 0.3, 0, 2.2, -2.8)]),
    horses: [[11.5, 0]], driver: [3, 0, 0.6], trail: 6,
  }),
};

// A heavy horse, low poly, facing +x.
function horseGeometry() {
  const parts = [
    box(5.6, 2.6, 2.1, 0, 5.2, 0), box(1.6, 2.6, 1.3, 3.1, 6.6, 0), box(2.2, 1.0, 0.95, 4.2, 7.7, 0), box(0.9, 1.6, 2.3, 2.3, 5.6, 0),
  ];
  for (const [x, z] of [[2.2, 0.6], [2.2, -0.6], [-2.2, 0.6], [-2.2, -0.6]]) {
    parts.push(box(0.55, 4.2, 0.55, x, 2.1, z));
    parts.push(box(0.75, 0.6, 0.75, x, 0.3, z));
  }
  parts.push(box(0.4, 1.6, 0.3, -2.9, 4.6, 0));
  return mergeGeometries(parts);
}

function driverGeometry() {
  return mergeGeometries([
    box(1.0, 1.6, 1.1, 0, 5.6, 0), box(1.1, 0.5, 1.2, 0.5, 4.9, 0),
    new THREE.SphereGeometry(0.38, 10, 8).translate(0, 6.85, 0),
    new THREE.CylinderGeometry(0.42, 0.44, 0.22, 10).translate(0, 7.2, 0),
  ]);
}

export class VehiclesLayer {
  constructor(scenario) {
    this.sc = scenario;
    this.vehicles = scenario.vehicles || [];
    this.group = new THREE.Group();
    this.group.name = 'vehicles';
    const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
    const horse = horseGeometry();
    const crateGeo = new THREE.BoxGeometry(...CRATE);
    crateGeo.translate(0, CRATE[1] / 2, 0);
    const parcelGeo = new THREE.BoxGeometry(1.6, 1.2, 1.4);
    parcelGeo.translate(0, 0.6, 0);
    const horseColours = ['#5a3b26', '#3a2a20', '#7a5a3a', '#2c2420', '#6b4a33'];
    const shapes = {};
    let lorries = 0;
    this.items = this.vehicles.map((v, i) => {
      const kind = KINDS[v.kind] ? v.kind : 'lorry';
      const shape = shapes[kind] || (shapes[kind] = KINDS[kind]());
      const g = new THREE.Group();
      g.name = v.id;
      const body = new THREE.Mesh(shape.body, mat(v.colour || '#5d4a33'));
      const wheels = new THREE.Mesh(shape.wheels, mat(kind === 'lorry' ? '#8a2e22' : '#3a2f27'));
      const parts = [body, wheels];
      if (shape.hood) parts.push(new THREE.Mesh(shape.hood, mat('#d8d0bc', { side: THREE.DoubleSide })));
      if (shape.trim) parts.push(new THREE.Mesh(shape.trim, mat('#8a2a24')));
      // A boat's horse walks the towpath on the far bank.
      let towHorse = null;
      if (shape.towed) {
        towHorse = new THREE.Mesh(horse, mat('#5a4030'));
        towHorse.castShadow = true;
        this.group.add(towHorse);
      }
      const horses = new THREE.Group();
      shape.horses.forEach(([x, z], k) => {
        const h = new THREE.Mesh(horse, mat(horseColours[(i * 2 + k) % horseColours.length]));
        h.position.set(x, 0, z);
        h.castShadow = true;
        horses.add(h);
      });
      const driver = new THREE.Mesh(driverGeometry(), mat('#30343a'));
      driver.position.set(...shape.driver);
      const load = kind === 'boat'
        ? new THREE.InstancedMesh(new THREE.BoxGeometry(52, 1, 6).translate(0, 0.5, 0), mat('#1d1c1b', { roughness: 1 }), 1)
        : new THREE.InstancedMesh(kind === 'lorry' ? crateGeo : parcelGeo, mat(kind === 'lorry' ? '#c9ad7c' : '#9a8460', { roughness: 0.95 }), MAX_LOAD);
      load.count = 0;
      for (const m of [...parts, driver, load]) m.castShadow = true;
      g.add(...parts, horses, driver, load);
      for (const o of [...parts, driver, load, ...horses.children]) o.userData = { kind: 'vehicle', id: v.id };
      this.group.add(g);
      // Lorries stand side by side in front of the cart shed when laid up.
      let park = v.parkAt;
      if (!park && kind === 'lorry') {
        const home = scenario.site.nodes.get('N1');
        park = [home.x - 9 + lorries * 13, home.z - 4, -Math.PI / 2];
        lorries++;
      }
      return { v, g, kind, shape, parts, horses, driver, load, towHorse, yaw: Math.PI / 2, park };
    });
  }

  update(t) {
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    const out = [0, 0, 0];
    for (const it of this.items) {
      const { v, g, shape } = it;
      const moving = v.motion && t < v.motion.ts[v.motion.ts.length - 1];
      if (v.onSite && v.node === 'DOCK' && !moving && it.kind === 'lorry') {
        // Drawn up alongside the dock, horses' heads to the west.
        const dock = this.sc.site.nodes.get('DOCK');
        g.position.set(dock.x - 2, 0, dock.z + 5);
        it.yaw = Math.PI;
        g.rotation.y = it.yaw;
        g.visible = true;
        it.horses.visible = true;
        it.driver.visible = false;
      } else if (v.onSite) {
        positionAt(this.sc.world, v, t, out);
        // Heading: along the stretch of road it's on.
        const mo = v.motion;
        if (mo && mo.pts.length > 1) {
          let i = 1;
          while (i < mo.ts.length - 1 && mo.ts[i] < t) i++;
          const dx = mo.pts[i][0] - mo.pts[i - 1][0];
          const dz = mo.pts[i][2] - mo.pts[i - 1][2];
          if (dx * dx + dz * dz > 0.01) it.yaw = Math.atan2(-dz, dx);
        }
        if (it.kind === 'boat' && !moving) {
          // Tied up alongside the wharf, bow to the west.
          it.yaw = Math.PI;
          g.position.set(out[0], 0, out[2]);
        } else {
          // The vehicle trails behind the point it's driven to.
          g.position.set(out[0] - Math.cos(it.yaw) * shape.trail, 0, out[2] + Math.sin(it.yaw) * shape.trail);
        }
        g.rotation.y = it.yaw;
        g.visible = true;
        it.horses.visible = true;
        it.driver.visible = !!v.driver;
      } else if (v.parked && it.park) {
        g.position.set(it.park[0], 0, it.park[1]);
        g.rotation.y = it.park[2] ?? 0;
        g.visible = true;
        it.horses.visible = false;
        it.driver.visible = false;
      } else {
        g.visible = false;
      }
      if (it.towHorse) {
        // Ahead of the boat on the towpath while it moves; grazing when tied up.
        const moving2 = v.motion && t < v.motion.ts[v.motion.ts.length - 1];
        it.towHorse.visible = g.visible;
        it.towHorse.position.set(g.position.x + (moving2 ? Math.cos(it.yaw) * 60 : 12), 0, v.towpathZ ?? g.position.z - 24);
        it.towHorse.rotation.y = moving2 ? it.yaw : Math.PI / 2;
      }
      if (it.kind === 'boat') {
        // Slack heaped in the hold, by the ton.
        const full = Math.min(1, (v.load || 0) / 500);
        m.makeScale(1, 0.2 + full * 2.6, 1);
        m.setPosition(2, 2.6, 0);
        it.load.setMatrixAt(0, m);
        it.load.count = v.load > 0 ? 1 : 0;
        it.load.instanceMatrix.needsUpdate = true;
        continue;
      }
      // The load: crates on edge across a lorry, parcels in a cart.
      const n = Math.min(MAX_LOAD, v.load || 0);
      for (let i = 0; i < n; i++) {
        if (it.kind === 'lorry') {
          m.makeTranslation(-6.3 + (i % 12) * 1.08, 3.65 + Math.floor(i / 12) * CRATE[1], 0);
          m.multiply(rot);
        } else {
          m.makeTranslation(-2.5 + (i % 4) * 1.7, 3.2 + Math.floor(i / 8) * 1.2, -1.4 + (Math.floor(i / 4) % 2) * 2.8);
        }
        it.load.setMatrixAt(i, m);
      }
      it.load.count = it.kind === 'van' ? 0 : n;
      it.load.instanceMatrix.needsUpdate = true;
    }
  }

  pickables() {
    return this.items.flatMap((it) => [...it.parts, it.driver, it.load]);
  }

  vehicleFor(object) {
    const id = object.userData?.id;
    return this.vehicles.find((v) => v.id === id) || null;
  }
}
