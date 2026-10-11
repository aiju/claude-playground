// Moving machinery: a horizontal mill engine with its flywheel, crank,
// connecting rod, crosshead and governor; Lancashire boilers in their brick
// settings; rope drives; and chimney smoke.
import * as THREE from 'three';
import { stripeTexture } from './textures.js';

const std = (colour, o = {}) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6, metalness: 0.3, ...o });

// A horizontal single-cylinder mill engine. In its own frame the crankshaft
// runs along z at height `shaftY`; the cylinder lies along +x from the crank.
export class MillEngine {
  constructor({ position, rotationY = 0, flywheelRadius = 9, flywheelZ = -5.5, stroke = 3, rodLength = 8 }) {
    this.group = new THREE.Group();
    this.group.name = 'mill-engine';
    this.group.position.set(...position);
    this.group.rotation.y = rotationY;
    this.r = stroke / 2;
    this.L = rodLength;
    this.shaftY = 8;
    this.angle = 0;
    this.speed = 0;
    const iron = std('#2c3033');
    const green = std('#2f4a3a', { roughness: 0.5 });
    const bright = std('#c4c9cb', { metalness: 0.8, roughness: 0.25 });
    const brass = std('#b08d3c', { metalness: 0.8, roughness: 0.3 });
    const lagging = std('#6b4a30', { metalness: 0, roughness: 0.7 });
    const stone = new THREE.MeshStandardMaterial({ color: '#8f8676', roughness: 1 });
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    const Y = this.shaftY;
    // Foundation and bed plate.
    add(new THREE.BoxGeometry(22, 3, 5), stone, 8, 1.5, 0);
    add(new THREE.BoxGeometry(21, 1.6, 3), green, 8, 3.8, 0);
    // Main bearings and the crankshaft.
    add(new THREE.BoxGeometry(2, Y - 3.6, 2.4), green, 0, (Y + 3.6) / 2 - 0.6, 1.8);
    add(new THREE.BoxGeometry(2, Y - 3.6, 2.4), green, 0, (Y + 3.6) / 2 - 0.6, flywheelZ - 2.2);
    const shaft = new THREE.CylinderGeometry(0.5, 0.5, Math.abs(flywheelZ) + 6, 16);
    shaft.rotateX(Math.PI / 2);
    add(shaft, bright, 0, Y, flywheelZ / 2 + 1);
    // Crosshead guides.
    add(new THREE.BoxGeometry(5, 0.4, 1.6), bright, 9.5, Y + 0.95, 0);
    add(new THREE.BoxGeometry(5, 0.4, 1.6), bright, 9.5, Y - 0.95, 0);
    add(new THREE.BoxGeometry(5, 2.3, 0.3), green, 9.5, Y, -0.95);
    // Cylinder with lagging, brass bands and valve chest.
    const cylGeo = new THREE.CylinderGeometry(1.8, 1.8, 6, 20);
    cylGeo.rotateZ(Math.PI / 2);
    add(cylGeo, lagging, 16, Y, 0);
    for (const x of [13.2, 16, 18.8]) {
      const band = new THREE.TorusGeometry(1.82, 0.08, 6, 24);
      band.rotateY(Math.PI / 2);
      add(band, brass, x, Y, 0);
    }
    const coverGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.4, 20);
    coverGeo.rotateZ(Math.PI / 2);
    add(coverGeo, bright, 12.8, Y, 0);
    add(coverGeo.clone(), bright, 19.2, Y, 0);
    add(new THREE.BoxGeometry(4, 1.4, 1.6), green, 16, Y + 2.2, 0);
    const pipe = new THREE.CylinderGeometry(0.35, 0.35, 8, 10);
    add(pipe, iron, 16, Y + 6.5, 0);
    // Flywheel: rim, rope grooves, eight spokes and the boss.
    const fw = new THREE.Group();
    fw.position.set(0, Y, flywheelZ);
    const R = flywheelRadius;
    const rim = new THREE.CylinderGeometry(R, R, 2.4, 48, 1, true);
    rim.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rim, std('#3a3d40', { side: THREE.DoubleSide }));
    rimMesh.castShadow = true;
    fw.add(rimMesh);
    const inner = new THREE.CylinderGeometry(R - 0.6, R - 0.6, 2.4, 48, 1, true);
    inner.rotateX(Math.PI / 2);
    fw.add(new THREE.Mesh(inner, std('#26292b', { side: THREE.DoubleSide })));
    for (let k = -2; k <= 2; k++) {
      const groove = new THREE.TorusGeometry(R + 0.02, 0.08, 4, 64);
      const gm = new THREE.Mesh(groove, std('#151515'));
      gm.position.z = k * 0.42;
      fw.add(gm);
    }
    for (let k = 0; k < 8; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.55, R - 1, 0.5), std('#2f4a3a'));
      spoke.position.set(Math.cos((k * Math.PI) / 4) * (R - 1) / 2, Math.sin((k * Math.PI) / 4) * (R - 1) / 2, 0);
      spoke.rotation.z = (k * Math.PI) / 4 - Math.PI / 2;
      spoke.castShadow = true;
      fw.add(spoke);
    }
    const boss = new THREE.CylinderGeometry(1.1, 1.1, 2.6, 16);
    boss.rotateX(Math.PI / 2);
    fw.add(new THREE.Mesh(boss, bright));
    this.group.add(fw);
    this.flywheel = fw;
    // Crank disc and pin.
    const disc = new THREE.Group();
    disc.position.set(0, Y, 0.9);
    const dGeo = new THREE.CylinderGeometry(this.r + 0.6, this.r + 0.6, 0.6, 24);
    dGeo.rotateX(Math.PI / 2);
    disc.add(new THREE.Mesh(dGeo, std('#2f4a3a')));
    this.group.add(disc);
    this.crank = disc;
    // Connecting rod, crosshead and piston rod move every frame.
    this.rod = add(new THREE.BoxGeometry(1, 0.45, 0.45), bright, 0, Y, 0);
    this.crosshead = add(new THREE.BoxGeometry(1.2, 1.4, 1.2), bright, 0, Y, 0);
    const prGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 10);
    prGeo.rotateZ(Math.PI / 2);
    this.pistonRod = add(prGeo, bright, 0, Y, 0);
    // Governor: a spindle with two balls that fly out as it runs.
    this.governor = new THREE.Group();
    this.governor.position.set(4, Y + 2.2, 1.6);
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8), bright);
    spindle.position.y = 1.6;
    this.governor.add(spindle);
    this.balls = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.y = 3.1;
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), bright);
      link.position.y = -0.8;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), brass);
      ball.position.y = -1.6;
      arm.add(link, ball);
      arm.userData.side = s;
      this.governor.add(arm);
      this.balls.push(arm);
    }
    this.group.add(this.governor);
    this.update(0, 0);
  }

  // target: 0 stopped, 1 running. The engine eases up and down.
  update(dt, target) {
    this.speed += (target - this.speed) * Math.min(1, dt * 0.6);
    if (this.speed < 0.002 && target === 0) this.speed = 0;
    this.angle += dt * this.speed * Math.PI * 2 * 1.1;
    const a = this.angle;
    this.flywheel.rotation.z = a;
    this.crank.rotation.z = a;
    const Y = this.shaftY;
    const px = this.r * Math.cos(a);
    const py = Y + this.r * Math.sin(a);
    const cx = px + Math.sqrt(this.L * this.L - (py - Y) * (py - Y));
    this.rod.position.set((px + cx) / 2, (py + Y) / 2, 0.3);
    this.rod.scale.x = this.L;
    this.rod.rotation.z = Math.atan2(Y - py, cx - px);
    this.crosshead.position.set(cx, Y, 0);
    const pistonEnd = 13;
    this.pistonRod.position.set((cx + pistonEnd) / 2, Y, 0);
    this.pistonRod.scale.x = Math.max(0.1, pistonEnd - cx);
    this.governor.rotation.y = a * 2;
    const spread = 0.25 + 0.45 * this.speed;
    for (const arm of this.balls) arm.rotation.z = arm.userData.side * spread;
  }

  // World position of the top of the flywheel, where ropes leave it.
  ropePoint(out = new THREE.Vector3()) {
    this.group.updateMatrixWorld(true);
    return this.flywheel.localToWorld(out.set(0, 0, 0));
  }
}

// Ropes from the flywheel to the pulleys that drive each floor's shafting.
export class RopeDrive {
  constructor(from, targets, { radius = 9 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'rope-drive';
    const tex = stripeTexture('#c9b98f', '#7d6e4f');
    tex.repeat.set(1, 8);
    this.mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const pulleyMat = std('#2f4a3a');
    for (const t of targets) {
      const to = new THREE.Vector3(...t);
      // Leave the flywheel at its rim on the side facing the pulley.
      const dir = new THREE.Vector3(to.x - from.x, to.y - from.y, 0).normalize();
      for (const k of [-0.5, 0.5]) {
        const a = new THREE.Vector3(from.x + dir.x * radius, from.y + dir.y * radius, from.z + k);
        const b = new THREE.Vector3(to.x, to.y, from.z + k);
        const len = a.distanceTo(b);
        const geo = new THREE.CylinderGeometry(0.11, 0.11, len, 6);
        const m = new THREE.Mesh(geo, this.mat);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        this.group.add(m);
      }
      const pGeo = new THREE.CylinderGeometry(1.4, 1.4, 1.4, 20);
      pGeo.rotateX(Math.PI / 2);
      const pulley = new THREE.Mesh(pGeo, pulleyMat);
      pulley.position.set(to.x, to.y, from.z);
      this.group.add(pulley);
    }
  }

  update(dt, speed) {
    this.mat.map.offset.y -= dt * speed * 3;
  }
}

// A Lancashire boiler in its brick setting, front facing -z in its frame.
export function lancashireBoiler({ position, rotationY = 0, length = 28 }, pal) {
  const g = new THREE.Group();
  g.position.set(...position);
  g.rotation.y = rotationY;
  const brick = new THREE.MeshStandardMaterial({ color: pal.brickDark, roughness: 1 });
  const iron = std('#2a2c2e');
  const setting = new THREE.Mesh(new THREE.BoxGeometry(10, 8.5, length), brick);
  setting.position.set(0, 4.25, length / 2);
  setting.castShadow = true;
  setting.receiveShadow = true;
  const shellGeo = new THREE.CylinderGeometry(3.5, 3.5, length, 24, 1, false, 0, Math.PI);
  shellGeo.rotateX(Math.PI / 2);
  shellGeo.rotateZ(Math.PI / 2);
  const shell = new THREE.Mesh(shellGeo, iron);
  shell.position.set(0, 7.2, length / 2);
  shell.castShadow = true;
  const front = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.4, 24), std('#3a3d3f'));
  front.rotation.x = Math.PI / 2;
  front.position.set(0, 6, -0.1);
  const doors = new THREE.MeshStandardMaterial({ color: '#ff8a3d', emissive: new THREE.Color('#ff6a1d'), emissiveIntensity: 1 });
  for (const x of [-1.5, 1.5]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.2), doors);
    d.position.set(x, 4.6, -0.35);
    g.add(d);
  }
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2, 12), std('#b08d3c', { metalness: 0.8 }));
  dome.position.set(0, 11.2, length * 0.3);
  g.add(setting, shell, front, dome);
  g.userData.doorMaterial = doors;
  return g;
}

// Chimney smoke: soft puffs that rise, drift with the wind and fade.
export class Smoke {
  constructor(origin, { count = 46 } = {}) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(70,66,62,0.75)');
    grd.addColorStop(1, 'rgba(70,66,62,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.origin = origin.clone();
    this.group = new THREE.Group();
    this.group.name = 'smoke';
    this.puffs = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      this.group.add(s);
      this.puffs.push({ s, age: (i / count) * 30, life: 30 });
    }
    this.wind = new THREE.Vector3(1, 0, 0.25);
  }

  update(dt, density) {
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age > p.life) p.age -= p.life;
      const f = p.age / p.life;
      p.s.position.set(
        this.origin.x + this.wind.x * f * 260 + Math.sin(f * 7 + p.life) * 3,
        this.origin.y + f * 90 + Math.sqrt(f) * 20,
        this.origin.z + this.wind.z * f * 260,
      );
      const size = 6 + f * 70;
      p.s.scale.set(size, size, 1);
      p.s.material.opacity = density * (1 - f) * Math.min(1, f * 8) * 0.55;
    }
  }
}
