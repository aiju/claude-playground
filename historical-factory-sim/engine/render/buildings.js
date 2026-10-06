// Buildings from the site's declarative spec: brick walls with windows and
// doors, limewashed interiors, floor slabs, partitions, roofs, chimneys,
// fire escapes and painted signs. Each floor is its own group so the view can
// peel a building open like an architect's model.
import * as THREE from 'three';
import { brickWall, limewashWall, paintedSign, slateTexture, labelTexture } from './textures.js';

const WALL = 1.5; // wall thickness, feet

const WINDOWS = {
  works: { spacing: 10, width: 5.5, height: 8, sill: 3 },
  office: { spacing: 8, width: 3.8, height: 6.2, sill: 3 },
  engine: { spacing: 11, width: 5, height: 13, sill: 6 },
  timber: { spacing: 14, width: 3, height: 3, sill: 5 },
  shed: { spacing: 12, width: 6, height: 7, sill: 4 },
};

export function buildBuildings(site, pal) {
  const root = new THREE.Group();
  root.name = 'buildings';
  const byId = new Map();
  const slate = new THREE.MeshStandardMaterial({ map: slateTexture(pal.slate), roughness: 0.9, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: pal.glazing, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const floorMat = new THREE.MeshStandardMaterial({ color: pal.floor, roughness: 1 });
  const limewash = new THREE.MeshStandardMaterial({ color: pal.limewash, roughness: 1 });
  const iron = new THREE.MeshStandardMaterial({ color: pal.iron, roughness: 0.7, metalness: 0.3 });
  const brickPlain = new THREE.MeshStandardMaterial({ color: pal.brick, roughness: 1, side: THREE.DoubleSide });
  const flatRoof = new THREE.MeshStandardMaterial({ color: '#3b3a37', roughness: 1 });

  for (const b of site.buildings.values()) {
    const style = b.style || 'works';
    const win = b.roof?.type === 'northlight' ? WINDOWS.shed : WINDOWS[style] || WINDOWS.works;
    const brick = style === 'office' ? pal.officeBrick : style === 'timber' ? pal.timber : pal.brick;
    const group = new THREE.Group();
    group.name = b.id;
    const floors = [];
    const litMats = [];
    const fh = b.floorHeight;

    const floorMats = [];
    for (let f = 0; f < b.floors; f++) {
      const fg = new THREE.Group();
      fg.name = `${b.id}:${f}`;
      const y0 = f * fh;
      // Materials on this floor that are cut away when it's the top floor
      // shown, like the horizontal cut of an architect's plan.
      const clip = [];
      floorMats.push(clip);
      const edge = brickPlain.clone();
      const partition = limewash.clone();
      partition.side = THREE.DoubleSide;
      clip.push(edge, partition);
      // Floor slab.
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.2, 0.8, b.d - 0.2), floorMat);
      slab.position.set(b.x + b.w / 2, y0 - 0.4 + 0.02, b.z + b.d / 2);
      slab.receiveShadow = true;
      slab.userData = { kind: 'floor', building: b.id, floor: f };
      fg.add(slab);

      const doorsOn = (side) => (b.doors || []).filter((dd) => (dd.floor || 0) === f && dd.side === side);
      const ground = f === 0;
      const common = { brick, plinth: pal.engineeringBrick, joinery: pal.joinery, style, ground, window: win, stringCourse: style === 'office' && f > 0 };
      // [length, outer texture opts, position, size, outer face index, inner face index]
      const walls = [
        { len: b.w, side: 'S', pos: [b.x + b.w / 2, y0 + fh / 2, b.z + b.d - WALL / 2], size: [b.w, fh, WALL], outer: 4, inner: 5,
          doors: doorsOn('S').map((dd) => dd.x - b.x) },
        { len: b.w, side: 'N', pos: [b.x + b.w / 2, y0 + fh / 2, b.z + WALL / 2], size: [b.w, fh, WALL], outer: 5, inner: 4,
          doors: doorsOn('N').map((dd) => b.x + b.w - dd.x) },
        { len: b.d, side: 'W', pos: [b.x + WALL / 2, y0 + fh / 2, b.z + b.d / 2], size: [WALL, fh, b.d - 2 * WALL], outer: 1, inner: 0, doors: [] },
        { len: b.d, side: 'E', pos: [b.x + b.w - WALL / 2, y0 + fh / 2, b.z + b.d / 2], size: [WALL, fh, b.d - 2 * WALL], outer: 0, inner: 1, doors: [] },
      ];
      for (const w of walls) {
        const outerTex = brickWall(w.len, fh, { ...common, doors: w.doors });
        const litTex = brickWall(w.len, fh, { ...common, doors: w.doors, lit: true });
        const outerMat = new THREE.MeshStandardMaterial({ map: outerTex, roughness: 0.95, emissive: new THREE.Color(pal.windowLit), emissiveMap: litTex, emissiveIntensity: 0 });
        litMats.push({ mat: outerMat, floor: f });
        const innerMat = new THREE.MeshStandardMaterial({ map: limewashWall(w.len, fh, { window: win, limewash: style === 'timber' ? '#a89478' : pal.limewash }), roughness: 1 });
        clip.push(outerMat, innerMat);
        const mats = [edge, edge, edge, edge, edge, edge];
        mats[w.outer] = outerMat;
        mats[w.inner] = innerMat;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), mats);
        mesh.position.set(...w.pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { kind: 'wall', building: b.id, floor: f };
        fg.add(mesh);
      }

      // Partitions between rooms, with a doorway at the aisle.
      const rooms = [...site.rooms.values()].filter((r) => r.building === b.id && r.floor === f).sort((p, q) => p.x0 - q.x0);
      for (let i = 1; i < rooms.length; i++) {
        const x = rooms[i].x0;
        const a = b.aisleZ - 3;
        const c = b.aisleZ + 3;
        for (const [z0, z1] of [[b.z + WALL, a], [c, b.z + b.d - WALL]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, fh - 0.4, z1 - z0), partition);
          m.position.set(x, y0 + fh / 2 - 0.2, (z0 + z1) / 2);
          m.receiveShadow = true;
          m.castShadow = true;
          fg.add(m);
        }
      }
      group.add(fg);
      floors.push(fg);
    }

    // Roof.
    const roof = new THREE.Group();
    roof.name = `${b.id}:roof`;
    const yTop = b.floors * fh;
    const r = b.roof || { type: 'flat' };
    if (r.type === 'hipped' || r.type === 'gable') {
      const geo = r.type === 'hipped' ? hippedRoof(b, yTop, r.pitch, 1.5) : gableRoof(b, yTop, r.pitch, 1.5);
      const m = new THREE.Mesh(geo, r.glazed ? glass : slate);
      m.castShadow = !r.glazed;
      m.receiveShadow = true;
      roof.add(m);
      if (r.type === 'gable') {
        const g = gableEnds(b, yTop, r.pitch);
        const ends = new THREE.Mesh(g, brickPlain);
        ends.castShadow = true;
        roof.add(ends);
      }
    } else if (r.type === 'northlight') {
      const { slopes, glazing, ends } = northLightRoof(b, yTop, r.teeth || 6);
      const ms = new THREE.Mesh(slopes, slate);
      ms.castShadow = true;
      ms.receiveShadow = true;
      roof.add(ms, new THREE.Mesh(glazing, glass), new THREE.Mesh(ends, brickPlain));
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1, 1, b.d + 1), flatRoof);
      m.position.set(b.x + b.w / 2, yTop + 0.5, b.z + b.d / 2);
      m.castShadow = true;
      roof.add(m);
    }
    roof.traverse((o) => { o.userData = { kind: 'roof', building: b.id }; });
    group.add(roof);

    // Chimney, fire escapes and signs stay visible whatever is peeled away.
    const always = new THREE.Group();
    if (b.chimney) always.add(chimney(b.chimney, pal));
    for (const fe of b.fireEscapes || []) always.add(fireEscape(b, fe, iron));
    for (const s of b.signs || []) always.add(sign(b, s, pal));
    group.add(always);

    root.add(group);
    byId.set(b.id, { spec: b, group, floors, roof, litMats, floorMats });
  }
  return { root, byId };
}

// Room labels, one sprite per room, shown when the room's floor is the top
// one visible.
export function buildRoomLabels(site) {
  const labels = [];
  for (const r of site.rooms.values()) {
    const { texture, aspect } = labelTexture(r.name, { size: 30 });
    // Labels keep the same size on screen however close the camera is.
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, sizeAttenuation: false });
    const sp = new THREE.Sprite(mat);
    const h = 0.018;
    sp.scale.set(h * aspect, h, 1);
    sp.center.set(0.5, 0);
    const b = site.buildings.get(r.building);
    sp.position.set((r.x0 + r.x1) / 2, r.y + 6, b.z + 2);
    sp.renderOrder = 10;
    sp.userData = { kind: 'label', room: r.id, building: r.building, floor: r.floor };
    sp.visible = false;
    labels.push(sp);
  }
  return labels;
}

function planarUVs(geo, scale = 8) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[2 * i] = pos.getX(i) / scale;
    uv[2 * i + 1] = (pos.getZ(i) + pos.getY(i)) / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function fromTriangles(tris) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat(2)), 3));
  geo.computeVertexNormals();
  planarUVs(geo);
  return geo;
}

function hippedRoof(b, y0, pitch, o) {
  const X0 = b.x - o, X1 = b.x + b.w + o, Z0 = b.z - o, Z1 = b.z + b.d + o;
  const half = b.d / 2 + o;
  const h = half * pitch;
  const zc = b.z + b.d / 2;
  const r1 = [b.x + b.d / 2, y0 + h, zc];
  const r2 = [b.x + b.w - b.d / 2, y0 + h, zc];
  const A = [X0, y0, Z0], B = [X1, y0, Z0], C = [X1, y0, Z1], D = [X0, y0, Z1];
  return fromTriangles([[D, C, r2], [D, r2, r1], [B, A, r1], [B, r1, r2], [A, D, r1], [C, B, r2]]);
}

function gableRoof(b, y0, pitch, o) {
  const X0 = b.x - o, X1 = b.x + b.w + o, Z0 = b.z - o, Z1 = b.z + b.d + o;
  const h = (b.d / 2 + o) * pitch;
  const zc = b.z + b.d / 2;
  const top0 = [X0, y0 + h, zc], top1 = [X1, y0 + h, zc];
  return fromTriangles([
    [[X0, y0, Z1], [X1, y0, Z1], top1], [[X0, y0, Z1], top1, top0],
    [[X1, y0, Z0], [X0, y0, Z0], top0], [[X1, y0, Z0], top0, top1],
  ]);
}

function gableEnds(b, y0, pitch) {
  const h = (b.d / 2 + 1.5) * pitch - 1.5 * pitch;
  const zc = b.z + b.d / 2;
  const tris = [];
  for (const x of [b.x + 0.75, b.x + b.w - 0.75]) tris.push([[x, y0, b.z], [x, y0, b.z + b.d], [x, y0 + h, zc]]);
  return fromTriangles(tris);
}

function northLightRoof(b, y0, teeth) {
  const dz = b.d / teeth;
  const h = Math.min(dz * 0.62, 12);
  const X0 = b.x - 0.5, X1 = b.x + b.w + 0.5;
  const slopes = [];
  const glazing = [];
  const ends = [];
  for (let i = 0; i < teeth; i++) {
    const zA = b.z + i * dz;
    const zB = zA + dz;
    // Slate slope falls from the ridge (north) to the valley (south).
    slopes.push([[X0, y0 + h, zA], [X0, y0, zB], [X1, y0, zB]], [[X0, y0 + h, zA], [X1, y0, zB], [X1, y0 + h, zA]]);
    // Glazing faces north.
    glazing.push([[X0, y0, zA], [X0, y0 + h, zA], [X1, y0 + h, zA]], [[X0, y0, zA], [X1, y0 + h, zA], [X1, y0, zA]]);
    for (const x of [b.x + 0.4, b.x + b.w - 0.4]) ends.push([[x, y0, zA], [x, y0 + h, zA], [x, y0, zB]]);
  }
  return { slopes: fromTriangles(slopes), glazing: fromTriangles(glazing), ends: fromTriangles(ends) };
}

function chimney(c, pal) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(c.top / 2, c.base / 2, c.height, 16, 1),
    new THREE.MeshStandardMaterial({ color: pal.brickDark, roughness: 1 }),
  );
  shaft.position.set(c.x, c.height / 2 + 6, c.z);
  shaft.castShadow = true;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(c.base + 4, 12, c.base + 4), new THREE.MeshStandardMaterial({ color: pal.engineeringBrick, roughness: 1 }));
  plinth.position.set(c.x, 6, c.z);
  plinth.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(c.top / 2 + 0.8, c.top / 2 + 0.6, 4, 16), new THREE.MeshStandardMaterial({ color: pal.soot, roughness: 1 }));
  cap.position.set(c.x, c.height + 6 - 1, c.z);
  g.add(shaft, plinth, cap);
  g.userData = { chimneyTop: new THREE.Vector3(c.x, c.height + 7, c.z) };
  g.name = 'chimney';
  return g;
}

function fireEscape(b, fe, mat) {
  const g = new THREE.Group();
  const z = fe.side === 'N' ? b.z - 2.5 : b.z + b.d + 2.5;
  for (let f = 1; f < b.floors; f++) {
    const y = f * b.floorHeight;
    const landing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 4), mat);
    landing.position.set(fe.x, y, z);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 0.15), mat);
    rail.position.set(fe.x, y + 1.6, z + (fe.side === 'N' ? -2 : 2));
    const run = b.floorHeight;
    const len = Math.hypot(run, 10);
    const flight = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), mat);
    flight.position.set(fe.x + (f % 2 ? -9 : 9), y - run / 2, z);
    flight.rotation.z = (f % 2 ? 1 : -1) * Math.atan2(run, 10);
    g.add(landing, rail, flight);
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

function sign(b, s, pal) {
  const width = s.width;
  const height = s.height || 2.4;
  const tex = paintedSign(s.text, { width, height, colour: s.colour || '#ece2c6', ground: s.ground || null });
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: !s.ground, roughness: 1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  const y = s.y;
  if (s.side === 'S') {
    m.position.set(s.x ?? b.x + b.w / 2, y, b.z + b.d + 0.08);
  } else if (s.side === 'N') {
    m.position.set(s.x ?? b.x + b.w / 2, y, b.z - 0.08);
    m.rotation.y = Math.PI;
  } else if (s.side === 'E') {
    m.position.set(b.x + b.w + 0.08, y, s.z ?? b.z + b.d / 2);
    m.rotation.y = Math.PI / 2;
  } else {
    m.position.set(b.x - 0.08, y, s.z ?? b.z + b.d / 2);
    m.rotation.y = -Math.PI / 2;
  }
  return m;
}
