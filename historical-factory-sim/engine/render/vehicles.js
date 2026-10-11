// Horse-drawn vehicles: a lorry (a flat four-wheeled dray) with its pair of
// horses, its carman on the box and its load of crates. A vehicle is drawn
// on the move while it's on site; when it's idle it stands in the yard
// before the cart shed, unhorsed.
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

function cyl(r, h, x, y, z, axis = 'z', seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

// The lorry faces +x. Platform 14 ft by 6½ ft, about 3½ ft off the road.
function lorryGeometries() {
  const body = mergeGeometries([
    box(14, 0.5, 6.6, 0, 3.4, 0), // platform
    box(14, 0.6, 0.25, 0, 3.9, 3.25), box(14, 0.6, 0.25, 0, 3.9, -3.25), // raves
    box(0.8, 2.2, 5.2, 7.5, 4.3, 0), // the driver's box
    box(5, 0.3, 0.3, 10, 2.9, 0), // the pole
    box(0.3, 0.3, 4, 12.3, 2.9, 0), // swingletree bar
  ]);
  const wheels = mergeGeometries([
    cyl(1.9, 0.35, -4.5, 1.9, 3.5), cyl(1.9, 0.35, -4.5, 1.9, -3.5),
    cyl(1.4, 0.35, 4.5, 1.4, 3.5), cyl(1.4, 0.35, 4.5, 1.4, -3.5),
  ]);
  return { body, wheels };
}

// A heavy horse, low poly, facing +x, about 16½ hands.
function horseGeometry() {
  const parts = [
    box(5.6, 2.6, 2.1, 0, 5.2, 0), // barrel
    box(1.6, 2.6, 1.3, 3.1, 6.6, 0), // neck
    box(2.2, 1.0, 0.95, 4.2, 7.7, 0), // head
    box(0.9, 1.6, 2.3, 2.3, 5.6, 0), // collar
  ];
  for (const [x, z] of [[2.2, 0.6], [2.2, -0.6], [-2.2, 0.6], [-2.2, -0.6]]) {
    parts.push(box(0.55, 4.2, 0.55, x, 2.1, z));
    parts.push(box(0.75, 0.6, 0.75, x, 0.3, z)); // feathered fetlocks
  }
  parts.push(box(0.4, 1.6, 0.3, -2.9, 4.6, 0)); // tail
  return mergeGeometries(parts);
}

function carmanGeometry() {
  return mergeGeometries([
    box(1.0, 1.6, 1.1, 0, 5.6, 0), // seated body and coat
    box(1.1, 0.5, 1.2, 0.5, 4.9, 0), // knees
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
    const { body, wheels } = lorryGeometries();
    const horse = horseGeometry();
    const crateGeo = new THREE.BoxGeometry(...CRATE);
    crateGeo.translate(0, CRATE[1] / 2, 0);
    const horseColours = ['#5a3b26', '#3a2a20', '#7a5a3a', '#2c2420'];
    this.items = this.vehicles.map((v, i) => {
      const g = new THREE.Group();
      g.name = v.id;
      const bodyMesh = new THREE.Mesh(body, mat('#5d4a33'));
      const wheelMesh = new THREE.Mesh(wheels, mat('#8a2e22'));
      const horses = new THREE.Group();
      for (const [k, z] of [[0, 1.5], [1, -1.5]]) {
        const h = new THREE.Mesh(horse, mat(horseColours[(i * 2 + k) % horseColours.length]));
        h.position.set(15.5, 0, z);
        horses.add(h);
      }
      const driver = new THREE.Mesh(carmanGeometry(), mat('#30343a'));
      driver.position.set(7.4, 0, 0.8);
      const crates = new THREE.InstancedMesh(crateGeo, mat('#c9ad7c', { roughness: 0.95 }), MAX_LOAD);
      crates.count = 0;
      for (const m of [bodyMesh, wheelMesh, driver, crates]) m.castShadow = true;
      for (const h of horses.children) h.castShadow = true;
      g.add(bodyMesh, wheelMesh, horses, driver, crates);
      for (const o of [bodyMesh, wheelMesh, driver, crates, ...horses.children]) o.userData = { kind: 'vehicle', id: v.id };
      this.group.add(g);
      // Where it stands when idle: in front of the cart shed, side by side.
      const home = scenario.site.nodes.get(v.home || 'N1');
      return { v, g, horses, driver, crates, wheels: wheelMesh, yaw: Math.PI / 2, park: [home.x - 9 + i * 13, home.z - 4] };
    });
  }

  update(t) {
    const m = new THREE.Matrix4();
    const out = [0, 0, 0];
    for (const it of this.items) {
      const { v, g } = it;
      const moving = v.motion && t < v.motion.ts[v.motion.ts.length - 1];
      if (v.onSite && v.node === 'DOCK' && !moving) {
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
        // The lorry's centre trails behind the point it's driven to.
        g.position.set(out[0] - Math.cos(it.yaw) * 10, 0, out[2] + Math.sin(it.yaw) * 10);
        g.rotation.y = it.yaw;
        g.visible = true;
        it.horses.visible = true;
        it.driver.visible = !!v.driver;
      } else if (v.node === 'N1' && v.activity === 'in the cart shed') {
        // Standing in the yard, horses in the stable.
        g.position.set(it.park[0], 0, it.park[1]);
        g.rotation.y = -Math.PI / 2;
        g.visible = true;
        it.horses.visible = false;
        it.driver.visible = false;
      } else {
        g.visible = false;
      }
      // The load: two tiers of crates on edge, across the platform.
      const n = Math.min(MAX_LOAD, v.load || 0);
      for (let i = 0; i < n; i++) {
        const tier = Math.floor(i / 12);
        const k = i % 12;
        m.makeTranslation(-6.3 + k * 1.08, 3.65 + tier * CRATE[1], 0);
        m.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        it.crates.setMatrixAt(i, m);
      }
      it.crates.count = n;
      it.crates.instanceMatrix.needsUpdate = true;
    }
  }

  pickables() {
    return this.items.flatMap((it) => [it.g.children[0], it.g.children[1], it.driver, it.crates]);
  }

  vehicleFor(object) {
    const id = object.userData?.id;
    return this.vehicles.find((v) => v.id === id) || null;
  }
}
