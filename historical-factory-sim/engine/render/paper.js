// Paper in the 3D view: stacks of documents where they wait (time cards in
// the racks, slips in the boxes, pay tins at the window), and papers in the
// hands of whoever is carrying them. With the paper layer on, it's drawn
// larger and brighter so its movements stand out.
import * as THREE from 'three';

const MAX = 600;

export class PaperLayer {
  constructor(scenario) {
    this.sc = scenario;
    this.paper = scenario.world.paper;
    this.group = new THREE.Group();
    this.group.name = 'paper';
    this.emphasis = false;
    const stackGeo = new THREE.BoxGeometry(0.9, 1, 1.15);
    stackGeo.translate(0, 0.5, 0);
    const tinGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.2, 10);
    tinGeo.translate(0, 0.1, 0);
    const sheetGeo = new THREE.BoxGeometry(0.55, 0.04, 0.75);
    const mk = (geo, colour, opts = {}) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8, ...opts }), MAX);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      m.userData = { kind: 'paper', ids: [] };
      this.group.add(m);
      return m;
    };
    this.stacks = mk(stackGeo, '#ffffff');
    this.tins = mk(tinGeo, '#9ea3a6', { metalness: 0.6, roughness: 0.4 });
    this.carried = mk(sheetGeo, '#ffffff');
    for (const m of [this.stacks, this.carried]) m.material.emissive = new THREE.Color('#fff4d6');
  }

  setEmphasis(on) {
    this.emphasis = on;
  }

  update(figures, isVisible) {
    const site = this.sc.site;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const big = this.emphasis ? 2.6 : 1;
    const glow = this.emphasis ? 0.6 : 0;
    this.stacks.material.emissiveIntensity = glow;
    this.carried.material.emissiveIntensity = glow;
    let ns = 0;
    let nt = 0;
    this.stacks.userData.ids = [];
    for (const cont of this.paper.containers.values()) {
      if (!cont.node || !cont.docs.size) continue;
      const node = site.nodes.get(cont.node);
      if (!node || (node.building !== undefined && !isVisible(node.building, node.floor))) continue;
      const height = node.type === 'time-recorder' ? 4.2 : node.type === 'foreman-box' ? 2.9 : 2.7;
      if (cont.kind === 'tins') {
        // Pay tins in rows on the trays at the pay window.
        const n = Math.min(cont.docs.size, 400);
        for (let i = 0; i < n && nt < MAX; i++) {
          const row = Math.floor(i / 20);
          pos.set(node.x - 2 + (i % 20) * 0.22, node.y + 3.6 + Math.floor(row / 10) * 0.25, node.z - 1.5 + (row % 10) * 0.25);
          m.compose(pos, q.identity(), s.set(big, big, big));
          this.tins.setMatrixAt(nt++, m);
        }
        continue;
      }
      const top = [...cont.docs].at(-1);
      const h = Math.min(1.6, 0.04 + cont.docs.size * 0.006) * (this.emphasis ? 1.6 : 1);
      const off = cont.id === 'rack-in' ? 1.2 : cont.id === 'rack-out' ? -1.2 : 0.4;
      pos.set(node.x + off * Math.cos(node.facing || 0), node.y + height, node.z + off * Math.sin(node.facing || 0));
      m.compose(pos, q.identity(), s.set(big, h, big));
      if (ns >= MAX) break;
      this.stacks.setMatrixAt(ns, m);
      this.stacks.setColorAt(ns, c.set(colourOf(top)));
      this.stacks.userData.ids[ns] = cont.id;
      ns++;
    }
    let nc = 0;
    this.carried.userData.ids = [];
    const people = this.sc.world.people;
    for (let i = 0; i < people.length && nc < MAX; i++) {
      const p = people[i];
      if (!p.papers || !p.papers.size || !figures.visible[i]) continue;
      // A workman's own slip or pay slip isn't worth drawing; paper on the
      // move between offices is.
      if ([...p.papers].every((dd) => dd.type === 'time-slip' || dd.type === 'pay-slip')) continue;
      const v = figures.positions[i];
      const yaw = figures.info[i].yaw;
      pos.set(v.x + Math.sin(yaw) * 0.7, v.y + 3.1, v.z + Math.cos(yaw) * 0.7);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const th = Math.min(0.5, 0.05 + p.papers.size * 0.002);
      m.compose(pos, q, s.set(big, big * (1 + th * 10), big));
      this.carried.setMatrixAt(nc, m);
      this.carried.setColorAt(nc, c.set(colourOf([...p.papers][0])));
      this.carried.userData.ids[nc] = p.id;
      nc++;
    }
    this.stacks.count = ns;
    this.tins.count = nt;
    this.carried.count = nc;
    for (const im of [this.stacks, this.tins, this.carried]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
}

function colourOf(doc) {
  if (!doc) return '#ffffff';
  return {
    'time-card': '#e8d9a8', 'time-slip': '#fbf8ef', 'work-tally': '#e2cf8f', 'pay-slip': '#ffffff',
    'ni-card': '#d9cdb4', 'unemployment-book': '#c7d2dc', 'coin-list': '#ffffff', 'wages-abstract': '#ffffff',
  }[doc.type] || doc.colour || '#ffffff';
}
