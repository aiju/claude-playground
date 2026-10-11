// The ground, the street, terraces, the canal and the boundary wall: the
// world around the site, from the scenario's scenery description.
import * as THREE from 'three';
import { terraceFront, groundTexture, slateTexture } from './textures.js';

export function buildScenery(scenario) {
  const pal = scenario.palette;
  const sc = scenario.scenery;
  const g = new THREE.Group();
  g.name = 'scenery';
  const lit = [];

  const groundTex = groundTexture(pal.ground, 'rgba(255,255,255,0.05)');
  groundTex.repeat.set(160, 160);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  g.add(ground);

  // The works yard: packed cinders inside the boundary wall.
  const bw = sc.boundaryWall;
  const yardTex = groundTexture(pal.yard, 'rgba(0,0,0,0.1)');
  yardTex.repeat.set(30, 20);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(bw.x1 - bw.x0, bw.z1 - bw.z0), new THREE.MeshStandardMaterial({ map: yardTex, roughness: 1 }));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set((bw.x0 + bw.x1) / 2, 0.01, (bw.z0 + bw.z1) / 2);
  yard.receiveShadow = true;
  g.add(yard);

  // Street with setts and pavements.
  const st = sc.street;
  const streetTex = groundTexture(pal.street, 'rgba(255,255,255,0.06)');
  streetTex.repeat.set(200, 3);
  addStrip(g, st.x0, st.x1, st.z - st.width / 2 + 6, st.z + st.width / 2 - 6, 0.03, new THREE.MeshStandardMaterial({ map: streetTex, roughness: 0.95 }));
  const paveMat = new THREE.MeshStandardMaterial({ color: pal.pavement, roughness: 1 });
  addStrip(g, st.x0, st.x1, st.z - st.width / 2, st.z - st.width / 2 + 6, 0.25, paveMat);
  addStrip(g, st.x0, st.x1, st.z + st.width / 2 - 6, st.z + st.width / 2, 0.25, paveMat);
  const ss = sc.sideStreet;
  addStrip(g, ss.x - ss.width / 2 + 5, ss.x + ss.width / 2 - 5, ss.z0 + st.width / 2, ss.z1, 0.03, new THREE.MeshStandardMaterial({ map: streetTex.clone(), roughness: 0.95 }));

  // Gas lamps along the street; their glass glows after dark.
  const lampMat = new THREE.MeshStandardMaterial({ color: '#f6d58e', emissive: new THREE.Color('#f6c56e'), emissiveIntensity: 0 });
  lit.push({ mat: lampMat, kind: 'street' });
  const postMat = new THREE.MeshStandardMaterial({ color: '#25302a', roughness: 0.7 });
  for (let x = st.x0 + 60; x < st.x1; x += 130) {
    for (const z of [st.z - st.width / 2 + 1.5, st.z + st.width / 2 - 1.5]) {
      if (z < st.z && x > bw.x0 - 10 && x < bw.x1 + 10) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 10, 6), postMat);
      post.position.set(x + (z > st.z ? 65 : 0), 5, z);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.9), lampMat);
      lantern.position.set(post.position.x, 10.5, z);
      g.add(post, lantern);
    }
  }

  // Terraces.
  const brickTone = ['#8a4a36', '#7f4533', '#93533c', '#86503b'];
  const slate = new THREE.MeshStandardMaterial({ map: slateTexture(pal.slate), roughness: 0.9, side: THREE.DoubleSide });
  sc.terraces.forEach((t, k) => {
    const len = t.x1 - t.x0;
    const h = 18.5;
    const brick = brickTone[k % brickTone.length];
    const front = terraceFront(len, h, { brick, joinery: pal.joinery });
    const frontLit = terraceFront(len, h, { brick, joinery: pal.joinery, lit: true });
    const fm = new THREE.MeshStandardMaterial({ map: front, roughness: 1, emissive: new THREE.Color('#f2c27a'), emissiveMap: frontLit, emissiveIntensity: 0 });
    lit.push({ mat: fm, kind: 'house' });
    const plain = new THREE.MeshStandardMaterial({ color: brick, roughness: 1 });
    const mats = [plain, plain, plain, plain, plain, plain];
    // Fronts on the street side; the backs get the same windows (est.).
    mats[4] = fm;
    mats[5] = fm;
    const body = new THREE.Mesh(new THREE.BoxGeometry(len, h, t.depth), mats);
    body.position.set((t.x0 + t.x1) / 2, h / 2, t.z + t.depth / 2);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // Roof, ridge along the street.
    const roofGeo = gable(t.x0 - 1, t.x1 + 1, t.z - 1, t.z + t.depth + 1, h, 7);
    const roof = new THREE.Mesh(roofGeo, slate);
    roof.castShadow = true;
    g.add(roof);
    // Chimney stacks on the party walls, every other house.
    const stackMat = new THREE.MeshStandardMaterial({ color: '#6e3a2b', roughness: 1 });
    for (let x = t.x0 + 15; x < t.x1 - 5; x += 30) {
      const stack = new THREE.Mesh(new THREE.BoxGeometry(2.5, 6, 4), stackMat);
      stack.position.set(x, h + 7, t.z + t.depth / 2);
      stack.castShadow = true;
      g.add(stack);
    }
  });

  // The pub on the corner of Cross Street.
  if (sc.pub) {
    const p = sc.pub;
    // It stands at the end of the terrace, a little taller and a little
    // forward of the houses.
    const body = new THREE.Mesh(new THREE.BoxGeometry(p.w + 1, 22, p.d), new THREE.MeshStandardMaterial({ color: '#7a4232', roughness: 1 }));
    body.position.set(p.x - p.w / 2 + 0.5, 11, p.z + p.d / 2 - 16.5);
    body.castShadow = true;
    g.add(body);
  }

  // The canal: water between brick copings, a towpath on the far side.
  const cn = sc.canal;
  // The ground plane is flat, so the water sits just above it between raised
  // brick copings rather than in a cutting.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(cn.x1 - cn.x0, cn.width), new THREE.MeshStandardMaterial({ color: pal.water, roughness: 0.2, metalness: 0.25 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set((cn.x0 + cn.x1) / 2, 0.12, cn.z);
  water.receiveShadow = true;
  g.add(water);
  const coping = new THREE.MeshStandardMaterial({ color: '#5a4a40', roughness: 1 });
  for (const side of [-1, 1]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(cn.x1 - cn.x0, 1.0, 1.6), coping);
    bank.position.set((cn.x0 + cn.x1) / 2, 0.5, cn.z + side * (cn.width / 2 + 0.8));
    bank.receiveShadow = true;
    g.add(bank);
  }
  const towTex = groundTexture(pal.towpath, 'rgba(0,0,0,0.08)');
  towTex.repeat.set(200, 2);
  addStrip(g, cn.x0, cn.x1, cn.z - cn.width / 2 - 14, cn.z - cn.width / 2, 0.04, new THREE.MeshStandardMaterial({ map: towTex, roughness: 1 }));

  // Boundary wall, with the gate and the office entrance left open.
  const wallMat = new THREE.MeshStandardMaterial({ color: pal.brickDark, roughness: 1 });
  const wallRuns = [];
  const southGaps = [...bw.gates, ...(bw.gaps || [])].sort((a, b) => a[0] - b[0]);
  let x = bw.x0;
  for (const [a, b] of southGaps) {
    wallRuns.push([[x, bw.z1], [a, bw.z1]]);
    x = b;
  }
  wallRuns.push([[x, bw.z1], [bw.x1, bw.z1]]);
  wallRuns.push([[bw.x0, bw.z0], [bw.x1, bw.z0]], [[bw.x0, bw.z0], [bw.x0, bw.z1]], [[bw.x1, bw.z0], [bw.x1, bw.z1]]);
  for (const [[x0, z0], [x1, z1]] of wallRuns) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1) continue;
    const w = new THREE.Mesh(new THREE.BoxGeometry(x1 === x0 ? 1.2 : len, bw.height, x1 === x0 ? len : 1.2), wallMat);
    w.position.set((x0 + x1) / 2, bw.height / 2, (z0 + z1) / 2);
    w.castShadow = true;
    w.receiveShadow = true;
    g.add(w);
  }
  // Gate piers.
  for (const [a, b] of bw.gates) {
    for (const px of [a, b]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.6, 12, 2.6), new THREE.MeshStandardMaterial({ color: pal.stone, roughness: 1 }));
      pier.position.set(px, 6, bw.z1);
      pier.castShadow = true;
      g.add(pier);
    }
  }

  // A neighbouring mill across the canal.
  for (const nw of sc.neighbourWorks || []) {
    const h = nw.floors * 13;
    const m = new THREE.Mesh(new THREE.BoxGeometry(nw.w, h, nw.d), new THREE.MeshStandardMaterial({ color: '#7d4636', roughness: 1 }));
    m.position.set(nw.x + nw.w / 2, h / 2, nw.z - 120);
    m.castShadow = true;
    g.add(m);
    const r = new THREE.Mesh(gable(nw.x - 1, nw.x + nw.w + 1, nw.z - 120 - nw.d / 2 - 1, nw.z - 120 + nw.d / 2 + 1, h, 9), slate);
    g.add(r);
  }
  return { group: g, lit };
}

function addStrip(g, x0, x1, z0, z1, y, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  g.add(m);
}

function gable(x0, x1, z0, z1, y0, h) {
  const zc = (z0 + z1) / 2;
  const tris = [
    [[x0, y0, z1], [x1, y0, z1], [x1, y0 + h, zc]], [[x0, y0, z1], [x1, y0 + h, zc], [x0, y0 + h, zc]],
    [[x1, y0, z0], [x0, y0, z0], [x0, y0 + h, zc]], [[x1, y0, z0], [x0, y0 + h, zc], [x1, y0 + h, zc]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y0 + h, zc]], [[x1, y0, z1], [x1, y0, z0], [x1, y0 + h, zc]],
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat(2)), 3));
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = pos.getX(i) / 8;
    uv[2 * i + 1] = (pos.getZ(i) + pos.getY(i)) / 8;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
