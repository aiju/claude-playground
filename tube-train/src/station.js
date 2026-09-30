// A deep-level station platform, like the Victoria line's: a big tiled tube
// with the platform on one side and the track on the other, a pit between
// the rails, posters on the wall across the track, the station's name along
// both walls and a train indicator hanging over the platform.
//
// Station-local coordinates: x runs from 0 at the end the trains come in to
// LENGTH at the end they leave by, as in the rest of the model y is height
// above the rails and z is across; the platform is on the +z side. The
// tile motif and the posters are original designs, not the real stations'.

import * as THREE from 'three';
import { addLightTerms, stationTerm } from './materials.js';
import { MeshBuilder, matrixFrom } from './geom.js';
import { TUNNEL } from './tunnel.js';
import { rng, ledTexture } from './textures.js';

export const STATION = {
  length: 140,           // the platform tunnel
  radius: 3.4,           // 6.8 m across
  cy: 1.6, cz: 1.4,      // its centre, off to the platform side of the track
  platform: 0.72,        // platform height above the rails
  edge: 1.42,            // the platform edge, 0.1 m from the doors
  bed: TUNNEL.bed,
};

const { length: LEN, radius: R, cy: CY, cz: CZ, platform: PH, edge: EDGE, bed: BED } = STATION;
const PHI0 = Math.asin((PH - CY) / R);                  // where the wall meets the platform
const PHI1 = Math.PI - Math.asin((BED - CY) / R);       // and where it meets the track bed
const circle = (phi, r = R) => [CZ + r * Math.cos(phi), CY + r * Math.sin(phi)];  // (z, y)
const WALL_Z = circle(PHI0)[0];                         // back of the platform

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function texture(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// glazed wall tiles, 150 by 75 mm, laid in a stretcher bond; the texture
// covers 1.2 m square
function tileTexture(base, seed) {
  const S = 512, [c, g] = canvas(S, S);
  const r = rng(seed);
  const tw = S / 8, th = S / 16;
  for (let j = 0; j < 16; j++) {
    for (let i = -1; i < 8; i++) {
      const x = i * tw + (j % 2 ? tw / 2 : 0);
      const k = 0.94 + r() * 0.08;
      g.fillStyle = `rgb(${base.map(v => Math.min(255, Math.round(v * k))).join(',')})`;
      g.fillRect(x + 1, j * th + 1, tw - 2, th - 2);
    }
  }
  // grout
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = '#8f8b82';
  g.fillRect(0, 0, S, S);
  return c;
}

// the platform surface across its width, from the edge (canvas left) to the
// wall: coping, the yellow line, tactile paving and the platform tiles
function platformTexture() {
  const W = 1024, H = 256, [c, g] = canvas(W, H);
  const width = WALL_Z - EDGE, px = (m) => (m / width) * W;
  g.fillStyle = '#6e6c68';
  g.fillRect(0, 0, W, H);
  for (let x = px(1.0); x < W; x += px(0.3)) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 0, 2, H); }
  for (let y = 0; y < H; y += H / 4) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(px(1.0), y, W, 2); }
  g.fillStyle = '#d9d6cc';                       // coping
  g.fillRect(0, 0, px(0.32), H);
  g.fillStyle = '#58565a';
  g.fillRect(px(0.32), 0, px(0.18), H);
  g.fillStyle = '#f2c200';                       // the yellow line
  g.fillRect(px(0.5), 0, px(0.1), H);
  g.fillStyle = '#cdb98a';                       // tactile paving
  g.fillRect(px(0.6), 0, px(0.4), H);
  g.fillStyle = 'rgba(80,60,20,0.35)';
  for (let x = px(0.63); x < px(0.98); x += px(0.066)) for (let y = 6; y < H; y += px(0.066)) { g.beginPath(); g.arc(x, y, px(0.013), 0, Math.PI * 2); g.fill(); }
  const r = rng(5);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},0.07)`; g.fillRect(r() * W, r() * H, 2, 2); }
  return c;
}

// An original tile motif for the seat recesses: a ring of leaves round a
// wheel, in the station's own colours.
function motifTexture(colours, seed) {
  const S = 512, [c, g] = canvas(S, S);
  const r = rng(seed);
  g.fillStyle = colours[0];
  g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  const n = 6 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    g.save();
    g.rotate((i / n) * Math.PI * 2);
    g.fillStyle = colours[1];
    g.beginPath();
    g.ellipse(0, -S * 0.3, S * 0.06, S * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = colours[2];
    g.beginPath();
    g.ellipse(0, -S * 0.3, S * 0.02, S * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.strokeStyle = colours[1];
  g.lineWidth = S * 0.035;
  g.beginPath(); g.arc(0, 0, S * 0.12, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * S * 0.12, Math.sin(a) * S * 0.12); g.stroke();
  }
  // the tile joints
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let k = 1; k < 4; k++) { g.fillRect(k * S / 4 - 1, 0, 2, S); g.fillRect(0, k * S / 4 - 1, S, 2); }
  return c;
}

// Posters: made-up things to do, in bold flat colours.
const POSTERS = [
  { bg: '#2f6b4f', fg: '#f4e7c5', title: 'Out on the marshes', sub: 'Walks every weekend', art: 'hills' },
  { bg: '#f0c53a', fg: '#1d1d2b', title: 'Night market', sub: 'Fridays from six', art: 'dots' },
  { bg: '#1e3f8f', fg: '#ffffff', title: 'Birds of the reservoirs', sub: 'A guide for the patient', art: 'birds' },
  { bg: '#e4572e', fg: '#fff4e8', title: 'Stories for the journey', sub: 'Short enough for three stops', art: 'lines' },
  { bg: '#efe7da', fg: '#27323a', title: 'A season of silent films', sub: 'Live piano every night', art: 'frames' },
  { bg: '#6a3d7a', fg: '#fbe3ff', title: 'Choir in the crypt', sub: 'All voices welcome', art: 'arches' },
];

function posterTexture(p, w = 512, h = 768) {
  const [c, g] = canvas(w, h);
  g.fillStyle = p.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = p.fg;
  g.strokeStyle = p.fg;
  const r = rng(p.title.length * 13);
  const art = { x: w * 0.1, y: h * 0.08, w: w * 0.8, h: h * 0.55 };
  if (p.art === 'hills') {
    g.beginPath(); g.arc(art.x + art.w * 0.7, art.y + art.h * 0.35, art.w * 0.16, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 3; k++) {
      g.globalAlpha = 0.4 + k * 0.25;
      g.beginPath(); g.moveTo(art.x, art.y + art.h);
      for (let i = 0; i <= 20; i++) g.lineTo(art.x + art.w * i / 20, art.y + art.h * (0.55 + k * 0.13) + Math.sin(i * 0.7 + k * 2) * art.h * 0.06);
      g.lineTo(art.x + art.w, art.y + art.h); g.fill();
    }
    g.globalAlpha = 1;
  } else if (p.art === 'dots') {
    for (let i = 0; i < 40; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.beginPath(); g.arc(art.x + r() * art.w, art.y + r() * art.h, 8 + r() * 30, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  } else if (p.art === 'birds') {
    g.lineWidth = 7;
    for (let i = 0; i < 9; i++) {
      const x = art.x + r() * art.w, y = art.y + r() * art.h * 0.8, s = 18 + r() * 30;
      g.beginPath(); g.moveTo(x - s, y - s * 0.3); g.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y); g.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - s * 0.3); g.stroke();
    }
  } else if (p.art === 'lines') {
    for (let i = 0; i < 12; i++) g.fillRect(art.x, art.y + i * art.h / 12, art.w * (0.5 + r() * 0.5), art.h / 30);
  } else if (p.art === 'frames') {
    g.lineWidth = 10;
    for (let i = 0; i < 3; i++) g.strokeRect(art.x + i * art.w / 3 + 8, art.y + art.h * 0.2, art.w / 3 - 16, art.h * 0.6);
  } else {
    g.lineWidth = 12;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(art.x + art.w / 2, art.y + art.h, art.w * (0.15 + i * 0.12), Math.PI, 0); g.stroke(); }
  }
  g.fillStyle = p.fg;
  g.font = `700 ${Math.round(w * 0.085)}px "Helvetica Neue", Arial, sans-serif`;
  g.textBaseline = 'top';
  const words = p.title.split(' ');
  let line = '', y = h * 0.68;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > w * 0.8 && line) { g.fillText(line, w * 0.1, y); line = word; y += w * 0.1; } else line = test;
  }
  g.fillText(line, w * 0.1, y);
  g.font = `400 ${Math.round(w * 0.045)}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText(p.sub, w * 0.1, y + w * 0.13);
  return c;
}

// the station's name on a blue frieze
function nameCanvas(name) {
  const [c, g] = canvas(1024, 160);
  g.fillStyle = '#10318c';
  g.fillRect(0, 0, 1024, 160);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 10, 1024, 6);
  g.fillRect(0, 144, 1024, 6);
  g.font = '600 84px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 84;
  while (g.measureText(name).width > 960 && size > 40) { size -= 4; g.font = `600 ${size}px "Helvetica Neue", Arial, sans-serif`; }
  g.fillText(name, 512, 84);
  return c;
}

function box(b, size, pos, rot) { b.addGeometry(new THREE.BoxGeometry(...size), matrixFrom(pos, rot)); }

// a flat panel on the curved wall at arc angle phi, facing into the tunnel
// and upright, so that its text reads the right way round
function wallPanel(b, x, phi, w, h, inset = 0.03) {
  const [z, y] = circle(phi, R - inset);
  const n = new THREE.Vector3(0, CY - y, CZ - z).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const up = n.clone().cross(right);
  const m = new THREE.Matrix4().makeBasis(right, up, n).setPosition(x, y, z);
  b.addGeometry(new THREE.PlaneGeometry(w, h), m);
}

export function buildStation() {
  const group = new THREE.Group();
  group.name = 'station';
  const lit = (m) => addLightTerms(m, [stationTerm()]);
  const tileC = tileTexture([236, 232, 220], 3);
  const tileMap = texture(tileC, true);
  const tileBump = new THREE.CanvasTexture(tileC);
  tileBump.wrapS = tileBump.wrapT = THREE.RepeatWrapping;
  const dadoMap = texture(tileTexture([88, 110, 128], 8), true);
  const mats = {
    tile: lit(new THREE.MeshStandardMaterial({ map: tileMap, bumpMap: tileBump, bumpScale: 0.6, roughness: 0.3, envMapIntensity: 0.3 })),
    dado: lit(new THREE.MeshStandardMaterial({ map: dadoMap, bumpMap: tileBump, bumpScale: 0.6, roughness: 0.3, envMapIntensity: 0.3 })),
    band: lit(new THREE.MeshStandardMaterial({ color: 0x0098d4, roughness: 0.25 })),
    ceiling: lit(new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.8 })),
    soot: lit(new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 0.95 })),
    platform: lit(new THREE.MeshStandardMaterial({ map: texture(platformTexture(), true), roughness: 0.7 })),
    concrete: lit(new THREE.MeshStandardMaterial({ color: 0x5c5a57, roughness: 0.95 })),
    metal: lit(new THREE.MeshStandardMaterial({ color: 0x3a3d41, roughness: 0.5, metalness: 0.6 })),
    frame: lit(new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.4, metalness: 0.3 })),
    wood: lit(new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.6 })),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e2, emissiveIntensity: 2.5 }),
    black: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  };
  mats.platform.map.repeat.set(1, LEN / 2);

  // ---- the tube itself, in bands: dado, tiles, a blue band, a dark crown
  const shell = { tile: new MeshBuilder(), dado: new MeshBuilder(), band: new MeshBuilder(), ceiling: new MeshBuilder(), soot: new MeshBuilder() };
  const N = 96;
  const pick = (phi) => {
    const [z, y] = circle(phi);
    if (y > 3.75) return 'ceiling';
    if (y > 3.05 && y < 3.2) return 'band';
    if (z > CZ) return y < 1.05 ? 'dado' : 'tile';
    return y < PH + 0.1 ? 'soot' : 'tile';
  };
  // cut the bands at their edges so the colours change on a line
  const cuts = [PHI0, PHI1];
  for (const y of [1.05, 3.05, 3.2, 3.75]) {
    const a = Math.asin((y - CY) / R);
    for (const phi of [a, Math.PI - a]) if (phi > PHI0 && phi < PHI1) cuts.push(phi);
  }
  const trackSideStep = Math.asin((PH + 0.1 - CY) / R);
  cuts.push(Math.PI - trackSideStep);
  for (let i = 1; i < N; i++) cuts.push(PHI0 + (PHI1 - PHI0) * i / N);
  cuts.sort((a, b) => a - b);
  let arc = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1];
    if (b - a < 1e-5) continue;
    const [za, ya] = circle(a), [zb, yb] = circle(b);
    const na = [0, -Math.sin(a), -Math.cos(a)], nb = [0, -Math.sin(b), -Math.cos(b)];
    const va = arc / 1.2, vb = (arc + R * (b - a)) / 1.2;
    arc += R * (b - a);
    shell[pick((a + b) / 2)].quad([0, ya, za], [LEN, ya, za], [LEN, yb, zb], [0, yb, zb], na, na, nb, nb,
      [0, va], [LEN / 1.2, va], [LEN / 1.2, vb], [0, vb]);
  }

  // ---- the platform: top, edge and face
  const plat = new MeshBuilder(), conc = new MeshBuilder();
  const up = [0, 1, 0];
  // the texture runs across the platform (u) and repeats along it (v)
  plat.quad([0, PH, EDGE], [LEN, PH, EDGE], [LEN, PH, WALL_Z], [0, PH, WALL_Z], up, up, up, up, [0, 0], [0, 1], [1, 1], [1, 0]);
  const out = [0, 0, -1];
  conc.quad([0, PH - 0.12, EDGE], [LEN, PH - 0.12, EDGE], [LEN, PH, EDGE], [0, PH, EDGE], out, out, out, out);
  conc.quad([0, BED, EDGE + 0.12], [LEN, BED, EDGE + 0.12], [LEN, PH - 0.12, EDGE + 0.12], [0, PH - 0.12, EDGE + 0.12], out, out, out, out);
  const down = [0, -1, 0];
  conc.quad([0, PH - 0.12, EDGE], [LEN, PH - 0.12, EDGE], [LEN, PH - 0.12, EDGE + 0.12], [0, PH - 0.12, EDGE + 0.12], down, down, down, down);
  // the track bed, with the pit between the rails
  const zTrackWall = circle(PHI1)[0];
  const pitW = 0.62, pitD = 0.95;
  conc.quad([0, BED, zTrackWall], [LEN, BED, zTrackWall], [LEN, BED, -pitW], [0, BED, -pitW], up, up, up, up);
  conc.quad([0, BED, pitW], [LEN, BED, pitW], [LEN, BED, EDGE + 0.12], [0, BED, EDGE + 0.12], up, up, up, up);
  conc.quad([0, BED - pitD, -pitW], [LEN, BED - pitD, -pitW], [LEN, BED - pitD, pitW], [0, BED - pitD, pitW], up, up, up, up);
  conc.quad([0, BED - pitD, -pitW], [LEN, BED - pitD, -pitW], [LEN, BED, -pitW], [0, BED, -pitW], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]);
  conc.quad([0, BED - pitD, pitW], [LEN, BED - pitD, pitW], [LEN, BED, pitW], [0, BED, pitW], [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]);
  // the ends of the platform
  for (const [x, nx] of [[0, -1], [LEN, 1]]) {
    const n = [nx, 0, 0];
    conc.quad([x, BED, EDGE], [x, BED, WALL_Z], [x, PH, WALL_Z], [x, PH, EDGE], n, n, n, n);
  }

  // ---- the ends: the platform tunnel's end wall, with the running tunnel's mouth
  const endPts = [];
  for (let i = 0; i <= 64; i++) endPts.push(circle(PHI0 + (PHI1 - PHI0) * i / 64));
  // round the running tunnel's mouth, from the track bed on the far side
  // to the platform
  const RS = TUNNEL.skin, TCY = TUNNEL.centreY;
  const a0 = Math.PI - Math.asin((BED - TCY) / RS), a1 = Math.asin((PH - TCY) / RS);
  for (let i = 0; i <= 48; i++) {
    const a = a0 + (a1 - a0) * (i / 48);
    endPts.push([RS * Math.cos(a), TCY + RS * Math.sin(a)]);
  }
  const contour = endPts.map(([z, y]) => new THREE.Vector2(z, y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const ends = new MeshBuilder();
  for (const [x, nx] of [[0, 1], [LEN, -1]]) {
    for (const [a, b, c] of tris) {
      const P = (k) => [x, contour[k].y, contour[k].x];
      ends.tri(P(a), P(b), P(c), [nx, 0, 0], [nx, 0, 0], [nx, 0, 0]);
    }
  }

  // ---- lights, trays and signs
  const lampB = new MeshBuilder(), metal = new MeshBuilder(), frames = new MeshBuilder(), wood = new MeshBuilder();
  box(metal, [LEN - 6, 0.16, 0.42], [LEN / 2, 4.02, 3.0]);
  box(lampB, [LEN - 6.2, 0.02, 0.32], [LEN / 2, 3.935, 3.0]);
  box(metal, [LEN - 6, 0.12, 0.36], [LEN / 2, 4.52, 0.3]);
  box(lampB, [LEN - 6.2, 0.02, 0.28], [LEN / 2, 4.455, 0.3]);
  for (let x = 6; x < LEN - 4; x += 6) {
    box(metal, [0.04, 0.35, 0.04], [x, 4.25, 3.0]);
    box(metal, [0.04, 0.3, 0.04], [x, 4.7, 0.3]);
  }
  // cable tray along the track-side wall, above the posters
  { const [z, y] = circle(Math.PI - Math.asin((3.4 - CY) / R), R - 0.25); box(metal, [LEN - 2, 0.06, 0.4], [LEN / 2, y, z]); }
  // benches against the platform wall, in front of the motif panels
  const benchXs = [22, 50, 90, 118];
  for (const x of benchXs) {
    box(wood, [1.9, 0.05, 0.42], [x, PH + 0.45, WALL_Z - 0.4]);
    box(wood, [1.9, 0.4, 0.05], [x, PH + 0.75, WALL_Z - 0.16], [-0.12, 0, 0]);
    for (const dx of [-0.8, 0.8]) box(metal, [0.05, 0.45, 0.4], [x + dx, PH + 0.22, WALL_Z - 0.4]);
  }

  const meshes = [
    [shell.tile, mats.tile], [shell.dado, mats.dado], [shell.band, mats.band], [shell.ceiling, mats.ceiling], [shell.soot, mats.soot],
    [plat, mats.platform], [conc, mats.concrete], [ends, mats.soot], [lampB, mats.lamp], [metal, mats.metal], [wood, mats.wood],
  ];
  for (const [b, m] of meshes) {
    if (b.empty) continue;
    const mesh = new THREE.Mesh(b.geometry(), m);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  mats.soot.side = THREE.DoubleSide;

  // ---- posters on the wall across the track, and on the platform wall
  const posterMats = POSTERS.map(p => lit(new THREE.MeshStandardMaterial({ map: texture(posterTexture(p)), roughness: 0.35 })));
  const wideMats = POSTERS.map(p => lit(new THREE.MeshStandardMaterial({ map: texture(posterTexture(p, 1024, 512)), roughness: 0.35 })));
  const panel = (mat, x, y, side, w, h, inset) => {
    const b = new MeshBuilder();
    const phi = side > 0 ? Math.asin((y - CY) / R) : Math.PI - Math.asin((y - CY) / R);
    wallPanel(b, x, phi, w, h, inset);
    const mesh = new THREE.Mesh(b.geometry(), mat);
    group.add(mesh);
    return mesh;
  };
  let pi = 0;
  for (let x = 14; x < LEN - 10; x += 16) {
    panel(mats.frame, x, 1.95, -1, 3.1, 1.6, 0.02);
    panel(wideMats[pi++ % wideMats.length], x, 1.95, -1, 3.0, 1.5, 0.03);
  }
  // the station's name, along both walls, and between the posters
  const nameTex = texture(nameCanvas('Walthamstow Central'));
  const nameMat = lit(new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.3 }));
  for (let x = 6; x < LEN; x += 16) panel(nameMat, x, 2.0, -1, 2.2, 0.34, 0.025);
  const motifMat = lit(new THREE.MeshStandardMaterial({ map: texture(motifTexture(['#e9e4d6', '#1d6f8f', '#e2a33b'], 11)), roughness: 0.25 }));
  for (let x = 8; x < LEN - 4; x += 14) {
    const bench = benchXs.find(b => Math.abs(b - x) < 7);
    if (bench) {
      panel(motifMat, bench, 1.75, 1, 0.9, 0.9, 0.02);
      continue;
    }
    if ((x / 14) % 2 < 1) {
      panel(nameMat, x, 2.45, 1, 2.6, 0.4, 0.025);
    } else {
      panel(mats.frame, x, 1.85, 1, 0.8, 1.2, 0.02);
      panel(posterMats[pi++ % posterMats.length], x, 1.85, 1, 0.74, 1.12, 0.025);
    }
  }
  // "MIND THE GAP" along the edge
  const [gc, gg] = canvas(512, 64);
  gg.fillStyle = '#f5f2e8';
  gg.font = '700 46px "Helvetica Neue", Arial, sans-serif';
  gg.textAlign = 'center'; gg.textBaseline = 'middle';
  gg.fillText('MIND THE GAP', 256, 34);
  const gapMat = new THREE.MeshStandardMaterial({ map: texture(gc), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  lit(gapMat);
  for (let x = 10; x < LEN - 5; x += 18) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), gapMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, PH + 0.002, EDGE + 0.24);
    group.add(m);
  }

  // ---- the train indicator, hanging over the platform, and way out signs
  const indicatorMat = new THREE.MeshBasicMaterial({ map: ledTexture(['1 Walthamstow Central\t2 min', 'Stand behind the yellow line'], { cols: 160, rows: 22, font: 'bold 10px Arial, sans-serif', dot: 5 }), toneMapped: false });
  const hang = new MeshBuilder();
  for (const x of [LEN * 0.33, LEN * 0.66]) {
    box(hang, [0.14, 0.36, 1.8], [x, 3.2, 3.2]);
    for (const dz of [-0.7, 0.7]) box(hang, [0.03, 0.4, 0.03], [x, 3.58, 3.2 + dz]);
    for (const s of [1, -1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.26), indicatorMat);
      d.position.set(x + s * 0.071, 3.2, 3.2);
      d.rotation.y = s * Math.PI / 2;
      group.add(d);
    }
  }
  const signTex = (() => {
    const [c, g] = canvas(512, 128);
    g.fillStyle = '#111';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#f7d117';
    g.font = '700 64px "Helvetica Neue", Arial, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('Way out', 120, 68);
    g.beginPath(); g.moveTo(30, 64); g.lineTo(80, 30); g.lineTo(80, 50); g.lineTo(104, 50); g.lineTo(104, 78); g.lineTo(80, 78); g.lineTo(80, 98); g.closePath(); g.fill();
    return texture(c);
  })();
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false });
  for (const x of [LEN * 0.18, LEN * 0.82]) {
    box(hang, [0.12, 0.36, 1.2], [x, 3.3, 3.6]);
    for (const s of [1, -1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.3), signMat);
      d.position.set(x + s * 0.061, 3.3, 3.6);
      d.rotation.y = s * Math.PI / 2;
      group.add(d);
    }
  }
  group.add(new THREE.Mesh(hang.geometry(), mats.frame));

  return {
    group,
    length: LEN,
    setName(name) {
      nameMat.map.dispose();
      nameMat.map = texture(nameCanvas(name));
    },
    setIndicator(lines) {
      indicatorMat.map.dispose();
      indicatorMat.map = ledTexture(lines, { cols: 160, rows: 22, font: 'bold 10px Arial, sans-serif', dot: 5 });
    },
  };
}
