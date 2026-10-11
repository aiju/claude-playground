// The people, as small simplified figures drawn with instancing: trousers
// or a skirt, a coat or blouse, an apron for some trades, a head, and a flat
// cap or a bowler. Clothing comes from each person's `look`.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { positionAt } from '../sim/world.js';

const SKIN = ['#e3bfa0', '#d9b090', '#e8c7aa', '#cfa384'];
const HAIR = ['#3b2a1e', '#4a3423', '#2a211b', '#6b4a2e', '#8a6a45'];

function capGeometry() {
  const crown = new THREE.CylinderGeometry(0.42, 0.44, 0.2, 12);
  crown.translate(0, 5.32, 0);
  const peak = new THREE.BoxGeometry(0.5, 0.05, 0.38);
  peak.translate(0, 5.25, 0.42);
  return mergeGeometries([crown, peak]);
}

function bowlerGeometry() {
  const dome = new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.95, 1);
  dome.translate(0, 5.25, 0);
  const brim = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 14);
  brim.translate(0, 5.25, 0);
  return mergeGeometries([dome, brim]);
}

export class FiguresLayer {
  constructor(world) {
    this.world = world;
    this.people = world.people;
    const n = this.people.length;
    const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
    const make = (geo, name) => {
      const im = new THREE.InstancedMesh(geo, std(), n);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      im.frustumCulled = false;
      im.name = name;
      im.userData = { kind: 'person' };
      return im;
    };
    const legs = new THREE.BoxGeometry(0.85, 2.7, 0.5);
    legs.translate(0, 1.35, 0);
    const skirt = new THREE.CylinderGeometry(0.45, 0.95, 2.9, 12);
    skirt.translate(0, 1.45, 0);
    const torso = new THREE.CapsuleGeometry(0.52, 1.15, 4, 10);
    torso.translate(0, 3.55, 0);
    const apron = new THREE.BoxGeometry(0.95, 2.7, 0.08);
    apron.translate(0, 2.65, 0.5);
    const head = new THREE.SphereGeometry(0.38, 12, 10);
    head.translate(0, 4.95, 0);
    const bun = new THREE.SphereGeometry(0.22, 8, 6);
    bun.translate(0, 5.12, -0.3);

    this.parts = {
      legs: make(legs, 'legs'),
      skirt: make(skirt, 'skirt'),
      torso: make(torso, 'torso'),
      apron: make(apron, 'apron'),
      head: make(head, 'head'),
      bun: make(bun, 'bun'),
      cap: make(capGeometry(), 'cap'),
      bowler: make(bowlerGeometry(), 'bowler'),
    };
    this.group = new THREE.Group();
    this.group.name = 'figures';
    for (const im of Object.values(this.parts)) this.group.add(im);

    const c = new THREE.Color();
    const shared = new Map();
    for (const p of this.people) shared.set(p.spot, (shared.get(p.spot) || 0) + 1);
    this.info = this.people.map((p, i) => {
      const L = p.look;
      const female = L.sex === 'F';
      const set = (part, colour) => this.parts[part].setColorAt(i, c.set(colour));
      set('legs', L.legs);
      set('skirt', L.legs);
      set('torso', L.coat);
      set('apron', L.apron || '#000');
      set('head', SKIN[i % SKIN.length]);
      set('bun', HAIR[(i * 7) % HAIR.length]);
      set('cap', ['#3a3630', '#2d2b28', '#4a4238', '#33302c'][i % 4]);
      set('bowler', '#16161a');
      const h = Math.sin(i * 91.7) * 43758.5453;
      const jitter = h - Math.floor(h);
      return {
        female,
        hat: L.hat,
        apron: !!L.apron,
        scale: L.scale || 1,
        yaw: 0,
        offset: shared.get(p.spot) > 1 || p.roam ? [Math.cos(jitter * 6.28) * 1.6, Math.sin(jitter * 6.28) * 1.6] : [0, 0],
        bobPhase: jitter * 10,
      };
    });
    for (const im of Object.values(this.parts)) im.instanceColor.needsUpdate = true;

    // A ring under the selected person.
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.12, 6, 32),
      new THREE.MeshBasicMaterial({ color: '#f2c14e', depthTest: false, transparent: true }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.renderOrder = 20;
    this.ring.visible = false;
    this.group.add(this.ring);
    this.selected = -1;
    this.positions = this.people.map(() => new THREE.Vector3());
    this.visible = this.people.map(() => false);
  }

  // isVisible(building, floor) says whether that floor is currently shown.
  update(t, realTime, isVisible) {
    const world = this.world;
    const site = world.site;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pos = [0, 0, 0];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    const P = this.parts;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      const info = this.info[i];
      let vis = p.onSite;
      let node = null;
      if (vis) {
        positionAt(world, p, t, pos);
        if (!p.motion) node = site.nodes.get(p.node);
        const where = p.motion ? null : node;
        if (where && where.building !== undefined && !isVisible(where.building, where.floor)) vis = false;
        if (p.motion) {
          const fl = this.floorOf(p, pos);
          if (fl && !isVisible(fl.building, fl.floor)) vis = false;
        }
      }
      this.visible[i] = vis;
      if (!vis) {
        for (const im of Object.values(P)) im.setMatrixAt(i, zero);
        continue;
      }
      let bob = 0;
      if (p.motion) {
        const seg = this.segment(p.motion, t);
        if (seg) info.yaw = Math.atan2(seg[0], seg[1]);
        bob = Math.abs(Math.sin(realTime * 9 + info.bobPhase)) * 0.14;
      } else {
        if (node && node.kind === 'spot') info.yaw = node.facing || 0;
        pos[0] += info.offset[0];
        pos[2] += info.offset[1];
      }
      this.positions[i].set(pos[0], pos[1], pos[2]);
      q.setFromAxisAngle(up, info.yaw);
      s.setScalar(info.scale);
      m.compose(new THREE.Vector3(pos[0], pos[1] + bob, pos[2]), q, s);
      P.torso.setMatrixAt(i, m);
      P.head.setMatrixAt(i, m);
      P.legs.setMatrixAt(i, info.female ? zero : m);
      P.skirt.setMatrixAt(i, info.female ? m : zero);
      P.bun.setMatrixAt(i, info.female ? m : zero);
      P.apron.setMatrixAt(i, info.apron ? m : zero);
      P.cap.setMatrixAt(i, info.hat === 'cap' ? m : zero);
      P.bowler.setMatrixAt(i, info.hat === 'bowler' ? m : zero);
    }
    for (const im of Object.values(P)) im.instanceMatrix.needsUpdate = true;
    if (this.selected >= 0 && this.visible[this.selected]) {
      const v = this.positions[this.selected];
      this.ring.position.set(v.x, v.y + 0.15, v.z);
      this.ring.visible = true;
    } else {
      this.ring.visible = false;
    }
  }

  // Direction of travel at time t.
  segment(m, t) {
    for (let k = 1; k < m.ts.length; k++) {
      if (m.ts[k] >= t) {
        const a = m.pts[k - 1];
        const b = m.pts[k];
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        if (Math.abs(dx) + Math.abs(dz) > 0.01) return [dx, dz];
      }
    }
    return null;
  }

  // Which building floor a walking person is on, from their height.
  floorOf(p, pos) {
    const site = this.world.site;
    for (const b of site.buildings.values()) {
      if (pos[0] >= b.x && pos[0] <= b.x + b.w && pos[2] >= b.z && pos[2] <= b.z + b.d) {
        return { building: b.id, floor: Math.min(b.floors - 1, Math.floor((pos[1] + 0.5) / b.floorHeight)) };
      }
    }
    return null;
  }

  pickables() {
    return [this.parts.torso, this.parts.legs, this.parts.skirt, this.parts.head];
  }
}
