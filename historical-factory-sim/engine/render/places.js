// Other places on the map with their own ground: for now, railway goods
// yards. Draws a scenario's place description: a walled yard, the street
// outside, rails on sleepers, wagon turntables, a hand crane, a weighbridge,
// cattle pens and gas lamps.
import * as THREE from 'three';
import { groundTexture } from './textures.js';

const GAUGE = 4.71; // 4 ft 8½ in.

export function buildPlace(spec, pal) {
  const g = new THREE.Group();
  g.name = `place:${spec.name}`;
  const lit = [];
  const strip = (x0, x1, z0, z1, y, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // The yard surface: setts and cinders.
  const gr = spec.ground;
  const tex = groundTexture(gr.colour, 'rgba(0,0,0,0.12)');
  tex.repeat.set((gr.x1 - gr.x0) / 20, (gr.z1 - gr.z0) / 20);
  strip(gr.x0, gr.x1, gr.z0, gr.z1, 0.02, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));

  // The street outside, with pavements.
  if (spec.road) {
    const r = spec.road;
    const st = groundTexture(pal.street, 'rgba(255,255,255,0.06)');
    st.repeat.set((r.x1 - r.x0) / 25, 3);
    strip(r.x0, r.x1, r.z - r.width / 2 + 6, r.z + r.width / 2 - 6, 0.03, new THREE.MeshStandardMaterial({ map: st, roughness: 0.95 }));
    const pave = new THREE.MeshStandardMaterial({ color: pal.pavement, roughness: 1 });
    for (const [a, b] of [[r.z - r.width / 2, r.z - r.width / 2 + 6], [r.z + r.width / 2 - 6, r.z + r.width / 2]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, 0.5, b - a), pave);
      p.position.set((r.x0 + r.x1) / 2, 0.25, (a + b) / 2);
      p.receiveShadow = true;
      g.add(p);
    }
  }

  // Rails on sleepers, on a bed of ballast.
  const railMat = new THREE.MeshStandardMaterial({ color: '#5c5a57', metalness: 0.6, roughness: 0.45 });
  const sleeperMat = new THREE.MeshStandardMaterial({ color: '#3a2f27', roughness: 1 });
  const ballastMat = new THREE.MeshStandardMaterial({ color: '#4f4b45', roughness: 1 });
  let sleepers = 0;
  for (const t of spec.tracks || []) sleepers += Math.ceil((t.x1 - t.x0) / 2.6);
  const sleeperMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.4, 8.5), sleeperMat, sleepers);
  sleeperMesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  let k = 0;
  for (const t of spec.tracks || []) {
    strip(t.x0, t.x1, t.z - 5.5, t.z + 5.5, 0.04, ballastMat);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(t.x1 - t.x0, 0.35, 0.25), railMat);
      rail.position.set((t.x0 + t.x1) / 2, 0.5, t.z + (side * GAUGE) / 2);
      g.add(rail);
    }
    for (let x = t.x0 + 1; x < t.x1; x += 2.6) {
      m.makeTranslation(x, 0.22, t.z);
      sleeperMesh.setMatrixAt(k++, m);
    }
  }
  sleeperMesh.count = k;
  g.add(sleeperMesh);

  // Wagon turntables.
  for (const [x, z] of spec.turntables || []) {
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 0.3, 28), new THREE.MeshStandardMaterial({ color: '#3d3935', roughness: 0.9 }));
    pit.position.set(x, 0.1, z);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 0.5, 28), new THREE.MeshStandardMaterial({ color: '#4a4744', metalness: 0.5, roughness: 0.6 }));
    table.position.set(x, 0.35, z);
    g.add(pit, table);
  }

  // The hand crane: a cast-iron post, a timber jib, a winch and a hook.
  if (spec.crane) {
    const c = spec.crane;
    const iron = new THREE.MeshStandardMaterial({ color: '#2b2d2f', roughness: 0.6, metalness: 0.4 });
    const wood = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.9 });
    const crane = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 1, 12), iron);
    base.position.y = 0.5;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 14, 10), iron);
    post.position.y = 7.5;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 1), wood);
    jib.position.set(8, 13, 0);
    jib.rotation.z = 0.5;
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 15, 6), iron);
    tie.position.set(8, 17.5, 0);
    tie.rotation.z = -1.25;
    const winch = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 2.5), iron);
    winch.position.set(-1.5, 3.5, 0);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8, 4), iron);
    chain.position.set(15.6, 13.5, 0);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 6, 10), iron);
    hook.position.set(15.6, 9.2, 0);
    crane.add(base, post, jib, tie, winch, chain, hook);
    for (const part of crane.children) part.castShadow = true;
    crane.position.set(c.x, 0, c.z);
    crane.rotation.y = c.facing || 0;
    g.add(crane);
  }

  // The weighbridge plate at the gate.
  if (spec.weighbridge) {
    const w = spec.weighbridge;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w.w, 0.15, w.d), new THREE.MeshStandardMaterial({ color: '#3f3d3a', metalness: 0.5, roughness: 0.5 }));
    plate.position.set(w.x, 0.08, w.z);
    g.add(plate);
  }

  // Cattle pens: post-and-rail fences.
  if (spec.pens) {
    const p = spec.pens;
    const rail = new THREE.MeshStandardMaterial({ color: '#d8d2c2', roughness: 0.9 });
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (const y of [1.5, 3, 4.5]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(x0 === x1 ? 0.25 : len, 0.3, x0 === x1 ? len : 0.25), rail);
        r.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
        g.add(r);
      }
    };
    fence(p.x0, p.z0, p.x1, p.z0);
    fence(p.x0, p.z1, p.x1, p.z1);
    fence(p.x0, p.z0, p.x0, p.z1);
    fence(p.x1, p.z0, p.x1, p.z1);
    fence((p.x0 + p.x1) / 2, p.z0, (p.x0 + p.x1) / 2, p.z1);
  }

  // The boundary wall, with the gate open.
  if (spec.wall) {
    const w = spec.wall;
    const mat = new THREE.MeshStandardMaterial({ color: pal.brickDark, roughness: 1 });
    const runs = [];
    let x = w.x0;
    for (const [a, b] of w.gates || []) {
      runs.push([[x, w.z1], [a, w.z1]]);
      x = b;
    }
    runs.push([[x, w.z1], [w.x1, w.z1]], [[w.x0, w.z0], [w.x1, w.z0]], [[w.x0, w.z0], [w.x0, w.z1]], [[w.x1, w.z0], [w.x1, w.z1]]);
    for (const [[x0, z0], [x1, z1]] of runs) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1) continue;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(x1 === x0 ? 1.4 : len, w.height, x1 === x0 ? len : 1.4), mat);
      wall.position.set((x0 + x1) / 2, w.height / 2, (z0 + z1) / 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      g.add(wall);
    }
    for (const [a, b] of w.gates || []) {
      for (const px of [a, b]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(2.8, 13, 2.8), new THREE.MeshStandardMaterial({ color: pal.stone, roughness: 1 }));
        pier.position.set(px, 6.5, w.z1);
        pier.castShadow = true;
        g.add(pier);
      }
    }
  }

  // Gas lamps on posts; their glass glows after dark.
  if (spec.lamps?.length) {
    const lampMat = new THREE.MeshStandardMaterial({ color: '#f6d58e', emissive: new THREE.Color('#f6c56e'), emissiveIntensity: 0 });
    lit.push({ mat: lampMat, kind: 'street' });
    const postMat = new THREE.MeshStandardMaterial({ color: '#25302a', roughness: 0.7 });
    for (const [x, z] of spec.lamps) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 13, 6), postMat);
      post.position.set(x, 6.5, z);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), lampMat);
      lantern.position.set(x, 13.6, z);
      g.add(post, lantern);
    }
  }
  return { group: g, lit };
}
