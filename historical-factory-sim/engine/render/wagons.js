// Railway wagons: open wagons, covered vans and cattle wagons in the
// company's grey, lettered on the side, sheeted when loaded. Wagons move
// when they're shunted; a horse walks ahead of the rake. Goods waiting on
// the platform are drawn as stacks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LETTERS = { LNWR: 'L  N  W  R', MR: 'M   R' };

function sideTexture(owner, kind) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = kind === 'open' ? 96 : 192;
  const g = c.getContext('2d');
  g.fillStyle = '#6a6d70'; // "medium lead grey"
  g.fillRect(0, 0, c.width, c.height);
  // Planks.
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth = 2;
  const planks = kind === 'open' ? 5 : 9;
  for (let i = 1; i < planks; i++) {
    g.beginPath();
    g.moveTo(0, (i * c.height) / planks);
    g.lineTo(c.width, (i * c.height) / planks);
    g.stroke();
  }
  // Ironwork.
  g.fillStyle = '#2a2b2c';
  g.fillRect(0, 0, 10, c.height);
  g.fillRect(c.width - 10, 0, 10, c.height);
  g.fillRect(c.width / 2 - 5, 0, 10, c.height);
  // Lettering, and on L. & N.W.R. wagons the white diamonds (to c. 1915).
  g.fillStyle = '#f2f0ea';
  g.font = `bold ${kind === 'open' ? 40 : 52}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(LETTERS[owner] || owner, c.width / 2, c.height * (kind === 'open' ? 0.55 : 0.4));
  if (owner === 'LNWR') {
    for (const x of [60, c.width - 60]) {
      g.beginPath();
      const y = c.height * (kind === 'open' ? 0.5 : 0.62);
      const r = kind === 'open' ? 16 : 22;
      g.moveTo(x, y - r);
      g.lineTo(x + r * 0.7, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r * 0.7, y);
      g.closePath();
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function wheelsGeometry(len) {
  const parts = [];
  for (const x of [-len / 2 + 3.2, len / 2 - 3.2]) {
    for (const z of [-2.35, 2.35]) {
      const w = new THREE.CylinderGeometry(1.5, 1.5, 0.35, 14);
      w.rotateX(Math.PI / 2);
      w.translate(x, 1.5, z);
      parts.push(w);
    }
  }
  const frame = new THREE.BoxGeometry(len, 0.9, 6.6);
  frame.translate(0, 2.6, 0);
  parts.push(frame);
  for (const sx of [-1, 1]) {
    for (const z of [-2.2, 2.2]) {
      const b = new THREE.CylinderGeometry(0.35, 0.35, 1, 8);
      b.rotateZ(Math.PI / 2);
      b.translate(sx * (len / 2 + 0.5), 2.6, z);
      parts.push(b);
    }
  }
  return mergeGeometries(parts);
}

export class WagonsLayer {
  constructor(scenario) {
    this.sc = scenario;
    this.R = scenario.railway;
    this.group = new THREE.Group();
    this.group.name = 'wagons';
    this.items = new Map();
    this.textures = {};
    this.mats = {
      grey: new THREE.MeshStandardMaterial({ color: '#6a6d70', roughness: 0.9 }),
      iron: new THREE.MeshStandardMaterial({ color: '#232425', roughness: 0.6, metalness: 0.4 }),
      sheet: new THREE.MeshStandardMaterial({ color: '#2d332f', roughness: 0.95 }),
      roof: new THREE.MeshStandardMaterial({ color: '#cfccc4', roughness: 0.95 }),
      crate: new THREE.MeshStandardMaterial({ color: '#c9ad7c', roughness: 0.95 }),
      bale: new THREE.MeshStandardMaterial({ color: '#8f7a5a', roughness: 1 }),
      horse: new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 0.9 }),
    };
    this.geo = {
      wheels15: wheelsGeometry(15),
      wheels17: wheelsGeometry(17),
      crate: new THREE.BoxGeometry(1, 3.3, 6),
      bale: new THREE.BoxGeometry(2.4, 2, 2.4),
    };
    // Goods on the platform: outward crates and inward packages.
    this.heapOut = new THREE.InstancedMesh(this.geo.crate, this.mats.crate, 80);
    this.heapIn = new THREE.InstancedMesh(this.geo.bale, this.mats.bale, 80);
    for (const im of [this.heapOut, this.heapIn]) {
      im.count = 0;
      im.castShadow = true;
      this.group.add(im);
    }
    this.horse = this.makeHorse();
    this.group.add(this.horse);
  }

  sideMat(owner, kind) {
    const key = `${owner}:${kind === 'open' ? 'open' : 'van'}`;
    if (!this.textures[key]) this.textures[key] = new THREE.MeshStandardMaterial({ map: sideTexture(owner, kind === 'open' ? 'open' : 'van'), roughness: 0.9 });
    return this.textures[key];
  }

  makeHorse() {
    const parts = [
      new THREE.BoxGeometry(5.6, 2.6, 2.1).translate(0, 5.2, 0),
      new THREE.BoxGeometry(1.6, 2.6, 1.3).translate(3.1, 6.6, 0),
      new THREE.BoxGeometry(2.2, 1.0, 0.95).translate(4.2, 7.7, 0),
    ];
    for (const [x, z] of [[2.2, 0.6], [2.2, -0.6], [-2.2, 0.6], [-2.2, -0.6]]) parts.push(new THREE.BoxGeometry(0.55, 4.2, 0.55).translate(x, 2.1, z));
    const h = new THREE.Mesh(mergeGeometries(parts), this.mats.horse);
    h.castShadow = true;
    h.visible = false;
    return h;
  }

  build(w) {
    const g = new THREE.Group();
    const len = w.kind === 'open' ? 15 : 17;
    const wheels = new THREE.Mesh(w.kind === 'open' ? this.geo.wheels15 : this.geo.wheels17, this.mats.iron);
    g.add(wheels);
    const side = this.sideMat(w.owner, w.kind);
    const mats = [this.mats.grey, this.mats.grey, this.mats.grey, this.mats.grey, side, side];
    if (w.kind === 'open') {
      // Five planks of sides around an open floor.
      const floor = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, 7.2), this.mats.grey);
      floor.position.y = 3.2;
      const sides = [];
      for (const z of [-3.55, 3.55]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(len, 3, 0.25), mats);
        s.position.set(0, 4.9, z);
        sides.push(s);
      }
      for (const x of [-len / 2, len / 2]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 7.2), this.mats.grey);
        e.position.set(x, 4.9, 0);
        sides.push(e);
      }
      g.add(floor, ...sides);
      const crates = new THREE.InstancedMesh(this.geo.crate, this.mats.crate, 24);
      crates.count = 0;
      // A tarpaulin over the load, "rick-wise" (West).
      const sheet = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, len - 0.4, 12, 1, false, 0, Math.PI), this.mats.sheet);
      sheet.rotation.z = Math.PI / 2;
      sheet.scale.set(0.6, 1, 1);
      sheet.position.y = 6.2;
      sheet.visible = false;
      g.add(crates, sheet);
      g.userData = { crates, sheet };
    } else {
      // A covered van (or a cattle wagon, with open slats).
      const body = new THREE.Mesh(new THREE.BoxGeometry(len - 0.6, 7, 7.4), mats);
      body.position.y = 6.6;
      // A curved roof along the van's length.
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, len - 0.2, 14, 1, false, Math.PI / 2 - 0.85, 1.7), this.mats.roof);
      roof.rotation.z = Math.PI / 2;
      roof.position.y = 7.05;
      g.add(body, roof);
      g.userData = {};
    }
    for (const c of g.children) {
      c.castShadow = true;
      c.receiveShadow = true;
      c.userData = { ...(c.userData || {}), kind: 'wagon', id: w.id };
    }
    this.group.add(g);
    return g;
  }

  update(t, isVisible) {
    const R = this.R;
    const seen = new Set();
    const m = new THREE.Matrix4();
    for (const w of R.wagons) {
      seen.add(w.id);
      let it = this.items.get(w.id);
      if (!it) {
        it = this.build(w);
        this.items.set(w.id, it);
      }
      let x = w.x;
      if (w.moving) {
        const f = Math.min(1, Math.max(0, (t - w.moving.t0) / (w.moving.t1 - w.moving.t0)));
        x += f * w.moving.dx;
      }
      it.position.set(x, 0, w.z);
      it.visible = true;
      const { crates, sheet } = it.userData;
      if (crates) {
        const n = w.sheeted ? 0 : Math.min(24, w.crates || 0);
        for (let i = 0; i < n; i++) {
          m.makeTranslation(-6.6 + (i % 12) * 1.15, 3.4 + Math.floor(i / 12) * 3.4, 0);
          crates.setMatrixAt(i, m);
        }
        crates.count = n;
        crates.instanceMatrix.needsUpdate = true;
        sheet.visible = !!w.sheeted || (w.state === 'siding' && w.packages > 0);
      }
    }
    for (const [id, g] of this.items) {
      if (seen.has(id)) continue;
      this.group.remove(g);
      this.items.delete(id);
    }
    // The shunt horse walks ahead of the rake while it moves.
    const sh = R.shunt;
    if (sh && t >= sh.t0 && t < sh.t1) {
      const rake = R.wagons.filter((w) => w.slot !== undefined);
      const lead = rake.reduce((a, w) => (a && a.x > w.x ? a : w), null);
      if (lead) {
        const f = (t - sh.t0) / (sh.t1 - sh.t0);
        const dx = lead.moving ? f * lead.moving.dx : 0;
        this.horse.position.set(lead.x + dx + 14, 0, lead.z + 5.5);
        this.horse.rotation.y = 0;
        this.horse.visible = true;
      }
    } else {
      this.horse.visible = false;
    }
    // Goods on the platform.
    const site = this.sc.site;
    const place = (im, spotId, n, w, h, d) => {
      const s = site.nodes.get(spotId);
      if (!s || !isVisible(s.building, s.floor)) {
        im.count = 0;
        return;
      }
      const k = Math.min(n, 80);
      for (let i = 0; i < k; i++) {
        const row = Math.floor(i / 16);
        m.makeTranslation(s.x - 8 + (i % 16) * w, s.y + h / 2 + Math.floor(row / 3) * h, s.z - 2 + (row % 3) * d);
        im.setMatrixAt(i, m);
      }
      im.count = k;
      im.instanceMatrix.needsUpdate = true;
    };
    place(this.heapOut, 'gy-heap-out', R.heapOut.reduce((a, h) => a + (h.crates || 0) + Math.ceil((h.packages || 0) / 2), 0), 1.15, 3.3, 6.4);
    place(this.heapIn, 'gy-heap-in', R.inwardOnBank || 0, 2.6, 2, 2.6);
  }

  pickables() {
    return [...this.items.values()].flatMap((g) => g.children.filter((c) => c.isMesh));
  }

  wagonFor(object) {
    const id = object.userData?.id;
    return this.R.wagons.find((w) => w.id === id) || null;
  }
}

