// The cab end of a driving car.
//
// The front is a flat face (the centre door and the panels either side of
// it) joined to the body by a broad rounded edge: deep at the sides, where
// the windscreens wrap round the corners, and tight over the roof. Along each
// point v of the body profile the rounded edge runs from the body (rho = 1)
// to a matching point on the edge of the flat face (rho = 0), with a
// quarter-ellipse section. Its paint scheme, the windscreens and the lettering
// are a texture projected from straight ahead.

import * as THREE from 'three';
import { BODY, COLOURS } from './dims.js';
import { profileAt, vAtY, PROFILE_LENGTH } from './profile.js';
import { MeshBuilder, IntervalShape, meshPanel } from './geom.js';

// The flat face: vertical sides at +-FACE_HALF, a flat top at FACE_TOP and
// rounded corners between.
const FACE_HALF = 0.47;
const FACE_TOP = 2.79;
const FACE_R = 0.34;
const EDGE_EXP = 2.0;         // 2 gives a quarter-ellipse section
const V_SIDE = vAtY(BODY.sideTop);

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

// how far back from the front the rounding starts, at each v
export function noseDepth(v) {
  return 0.50 + (0.12 - 0.50) * smooth(V_SIDE - 0.2, PROFILE_LENGTH, v);
}

// the front leans back a little towards the top
export function rake(y) {
  const t = Math.max(0, (y - 0.6) / 2.3);
  return -0.07 * t * t;
}

// The outline of the flat face, anticlockwise from its bottom right corner
// round to the top of the centre line, sampled by its own arc length.
const faceOutline = (() => {
  const pts = [];
  const y0 = BODY.bottom, yc = FACE_TOP - FACE_R;
  for (let i = 0; i <= 40; i++) pts.push([FACE_HALF, y0 + (yc - y0) * i / 40]);
  for (let i = 1; i <= 40; i++) {
    const a = (i / 40) * Math.PI / 2;
    pts.push([FACE_HALF - FACE_R + FACE_R * Math.cos(a), yc + FACE_R * Math.sin(a)]);
  }
  for (let i = 1; i <= 20; i++) pts.push([(FACE_HALF - FACE_R) * (1 - i / 20), FACE_TOP]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, length: cum[cum.length - 1] };
})();

function facePoint(s) {
  const { pts, cum } = faceOutline;
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < s) i++;
  const f = Math.min(Math.max((s - cum[i]) / (cum[i + 1] - cum[i]), 0), 1);
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
}

// the point on the face's edge that profile point v rounds on to
function faceMatch(v) {
  const sSide = BODY.sideTop - BODY.bottom;
  if (v <= V_SIDE) {
    const y = profileAt(v).y;
    return [FACE_HALF, y];
  }
  const t = (v - V_SIDE) / (PROFILE_LENGTH - V_SIDE);
  return facePoint(sSide + (faceOutline.length - sSide) * t);
}

// Half-width of the flat face at height y.
function faceHalfWidth(y) {
  const yc = FACE_TOP - FACE_R;
  if (y <= yc) return FACE_HALF;
  const dy = Math.min(y - yc, FACE_R);
  return FACE_HALF - FACE_R + Math.sqrt(Math.max(FACE_R * FACE_R - dy * dy, 0));
}

// Projection of the front onto the texture: z (viewer's left is +z) and y.
export const FRONT_TEX = { zMin: -1.4, zMax: 1.4, yMin: 0.3, yMax: 3.1 };
const texU = (z) => (FRONT_TEX.zMax - z) / (FRONT_TEX.zMax - FRONT_TEX.zMin);
const texV = (y) => (y - FRONT_TEX.yMin) / (FRONT_TEX.yMax - FRONT_TEX.yMin);

// Builds the nose surface for a car whose front is at x = xFront.
// Returns a geometry with a front-projected uv.
export function noseGeometry(xFront, { vSteps = 90, rhoSteps = 28 } = {}) {
  const b = new MeshBuilder();
  const grid = [];
  for (let i = 0; i <= vSteps; i++) {
    // denser near the bottom of the shoulder where the depth changes
    const v = (i / vSteps) * PROFILE_LENGTH;
    const p = profileAt(v);
    const q = faceMatch(v);
    const ax = noseDepth(v);
    const row = [];
    for (let j = 0; j <= rhoSteps; j++) {
      // spread samples towards rho = 1, where the surface turns fastest
      const rho = Math.sin((j / rhoSteps) * Math.PI / 2);
      const z = q[0] + (p.z - q[0]) * rho;
      const y = q[1] + (p.y - q[1]) * rho;
      const x = xFront - ax + ax * Math.pow(Math.max(1 - Math.pow(rho, EDGE_EXP), 0), 1 / EDGE_EXP) + rake(y);
      row.push([x, y, z]);
    }
    grid.push(row);
  }
  // normals from the grid, by finite differences
  const at = (i, j) => grid[Math.min(Math.max(i, 0), vSteps)][Math.min(Math.max(j, 0), rhoSteps)];
  const normal = (i, j) => {
    const a = at(i + 1, j), c = at(i - 1, j), d = at(i, j + 1), e = at(i, j - 1);
    const tv = [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
    const tr = [d[0] - e[0], d[1] - e[1], d[2] - e[2]];
    let n = [tv[1] * tr[2] - tv[2] * tr[1], tv[2] * tr[0] - tv[0] * tr[2], tv[0] * tr[1] - tv[1] * tr[0]];
    // at rho = 1 the surface meets the body side, so use the body's normal
    if (j === rhoSteps) {
      const pp = profileAt((i / vSteps) * PROFILE_LENGTH);
      n = [0, pp.ny, pp.nz];
    }
    const l = Math.hypot(...n) || 1;
    n = n.map(x => x / l);
    // point it forwards and outwards
    const P = at(i, j);
    if (n[0] * 1 + n[1] * (P[1] - 1.6) * 0.1 + n[2] * P[2] * 0.1 < 0) n = n.map(x => -x);
    return n;
  };
  const N = grid.map((row, i) => row.map((_, j) => normal(i, j)));
  for (const side of [1, -1]) {
    const P = (i, j) => { const g = grid[i][j]; return [g[0], g[1], side * g[2]]; };
    const Nn = (i, j) => { const n = N[i][j]; return [n[0], n[1], side * n[2]]; };
    const T = (i, j) => { const g = grid[i][j]; return [texU(side * g[2]), texV(g[1])]; };
    for (let i = 0; i < vSteps; i++) {
      for (let j = 0; j < rhoSteps; j++) {
        b.quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1),
          Nn(i, j), Nn(i + 1, j), Nn(i + 1, j + 1), Nn(i, j + 1),
          T(i, j), T(i + 1, j), T(i + 1, j + 1), T(i, j + 1));
      }
    }
  }
  // the flat face itself, in strips so that it follows the rake
  const face = new IntervalShape(BODY.bottom, FACE_TOP, (y) => { const w = faceHalfWidth(y); return [-w, w]; },
    Array.from({ length: 30 }, (_, k) => FACE_TOP - FACE_R + FACE_R * Math.sin((k / 30) * Math.PI / 2)));
  const faceMap = (z, y) => {
    const dz = 0.0001;
    const x = xFront + rake(y), x2 = xFront + rake(y + dz);
    const n = [1, -(x2 - x) / dz, 0];
    const l = Math.hypot(...n);
    return { pos: [x, y, z], normal: n.map(c => c / l) };
  };
  const fb = new MeshBuilder();
  meshPanel(fb, faceMap, face, [], { step: 0.05 });
  // give the face the same projected uv
  for (let k = 0; k < fb.pos.length / 3; k++) {
    fb.uv[2 * k] = texU(fb.pos[3 * k + 2]);
    fb.uv[2 * k + 1] = texV(fb.pos[3 * k + 1]);
  }
  b.pos.push(...fb.pos); b.nrm.push(...fb.nrm); b.uv.push(...fb.uv);
  return b.geometry();
}

// x of the front surface at (y, z), for placing things on it
export function frontSurfaceX(xFront, y, z) {
  const w = faceHalfWidth(y);
  if (Math.abs(z) <= w) return xFront + rake(y);
  // search the rounded edge for the nearest point in projection
  let best = null;
  for (let i = 0; i <= 200; i++) {
    const v = (i / 200) * PROFILE_LENGTH;
    const p = profileAt(v), q = faceMatch(v), ax = noseDepth(v);
    for (let j = 0; j <= 60; j++) {
      const rho = j / 60;
      const zz = q[0] + (p.z - q[0]) * rho, yy = q[1] + (p.y - q[1]) * rho;
      const d = Math.hypot(zz - Math.abs(z), yy - y);
      if (!best || d < best.d) best = { d, x: xFront - ax + ax * Math.sqrt(Math.max(1 - rho * rho, 0)) + rake(yy) };
    }
  }
  return best.x;
}

// ---- the paint scheme, drawn in the front projection ----

const TEX_SIZE = 2048;

function frontCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  // the paint and the glass are read back to combine them
  const g = c.getContext('2d', { willReadFrequently: true });
  // work in metres: canvas x is texU, y is 1 - texV
  const sx = TEX_SIZE / (FRONT_TEX.zMax - FRONT_TEX.zMin), sy = TEX_SIZE / (FRONT_TEX.yMax - FRONT_TEX.yMin);
  g.setTransform(-sx, 0, 0, -sy, FRONT_TEX.zMax * sx, FRONT_TEX.yMax * sy);
  return [c, g];
}

// Text centred at (z, y), `size` metres tall. It is drawn with a plain pixel
// transform, since fonts don't scale well from fractions of a pixel.
function textAt(g, text, z, y, size, weight, colour) {
  const sx = TEX_SIZE / (FRONT_TEX.zMax - FRONT_TEX.zMin), sy = TEX_SIZE / (FRONT_TEX.yMax - FRONT_TEX.yMin);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = colour;
  g.font = `${weight} ${Math.round(size * sy)}px "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, (FRONT_TEX.zMax - z) * sx, (FRONT_TEX.yMax - y) * sy);
  g.restore();
}

// A rounded rectangle in front coordinates (z from z0 to z1, y from y0 to y1).
function rrect(g, z0, z1, y0, y1, r) {
  const rr = typeof r === 'number' ? [r, r, r, r] : r; // [bottom left, bottom right, top right, top left] in z order
  g.beginPath();
  g.moveTo(z0 + rr[0], y0);
  g.lineTo(z1 - rr[1], y0);
  g.quadraticCurveTo(z1, y0, z1, y0 + rr[1]);
  g.lineTo(z1, y1 - rr[2]);
  g.quadraticCurveTo(z1, y1, z1 - rr[2], y1);
  g.lineTo(z0 + rr[3], y1);
  g.quadraticCurveTo(z0, y1, z0, y1 - rr[3]);
  g.lineTo(z0, y0 + rr[0]);
  g.quadraticCurveTo(z0, y0, z0 + rr[0], y0);
  g.closePath();
}

// the mask: the dark panel that carries the windscreens and lamps
function maskPath(g) {
  const pts = [];
  const bottom = 0.80;
  // right side of the mask in z >= 0, from bottom to top, following the body
  // outline in from the edge
  for (let y = bottom + 0.22; y <= 2.70; y += 0.01) {
    const v = vAtY(Math.min(y, BODY.height - 0.001));
    const p = profileAt(v);
    const inset = 0.105 + 0.07 * smooth(1.9, 2.75, y);
    pts.push([p.z - inset * (0.6 + 0.4 * Math.abs(p.nz)), y]);
  }
  g.beginPath();
  g.moveTo(0, bottom);
  // bottom edge with a rounded outer corner
  const zb = pts[0][0];
  g.lineTo(zb - 0.22, bottom);
  g.quadraticCurveTo(zb, bottom, zb, bottom + 0.22);
  for (const [z, y] of pts) g.lineTo(z, y);
  const top = pts[pts.length - 1][1];
  g.lineTo(0, top);
  for (let k = pts.length - 1; k >= 0; k--) g.lineTo(-pts[k][0], pts[k][1]);
  g.lineTo(-zb, bottom + 0.22);
  g.quadraticCurveTo(-zb, bottom, -zb + 0.22, bottom);
  g.closePath();
  return pts;
}

// the windscreen on one side (sign +1 is +z)
function windscreenPath(g, sign) {
  const zIn = 0.455, y0 = 1.40, y1 = 2.64;
  const outer = [];
  for (let y = y0; y <= y1 + 1e-6; y += 0.01) {
    const p = profileAt(vAtY(y));
    outer.push([p.z - 0.17 - 0.10 * smooth(1.8, 2.65, y), y]);
  }
  g.beginPath();
  g.moveTo(sign * zIn, y0);
  g.lineTo(sign * (outer[0][0] - 0.06), y0);
  g.quadraticCurveTo(sign * outer[0][0], y0, sign * outer[0][0], y0 + 0.06);
  // up the outer edge, with a big rounded corner at the top
  const rTop = 0.30;
  for (const [z, y] of outer) if (y < y1 - rTop) g.lineTo(sign * z, y);
  const zTop = outer[outer.length - 1][0];
  g.bezierCurveTo(sign * zTop, y1 - 0.02, sign * (zTop - 0.08), y1, sign * (zTop - rTop), y1);
  g.lineTo(sign * (zIn + 0.05), y1);
  g.quadraticCurveTo(sign * zIn, y1, sign * zIn, y1 - 0.05);
  g.closePath();
}

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// The painted front (colour, with holes where there is glass) and the glass
// mask. `number` is the car number on the front.
export function frontTextures({ number = '11047' } = {}) {
  const [c, g] = frontCanvas();
  g.fillStyle = hex(COLOURS.red);
  g.fillRect(FRONT_TEX.zMin, FRONT_TEX.yMin, FRONT_TEX.zMax - FRONT_TEX.zMin, FRONT_TEX.yMax - FRONT_TEX.yMin);
  // mask
  g.fillStyle = hex(COLOURS.mask);
  maskPath(g);
  g.fill();
  // destination display surround at the top
  g.fillStyle = '#111214';
  rrect(g, -0.46, 0.46, 2.705, 2.865, 0.03);
  g.fill();
  // centre door, with the shut lines round it
  g.fillStyle = '#141516';
  rrect(g, -0.375, 0.375, 0.815, 2.66, 0.035);
  g.fill();
  g.fillStyle = hex(COLOURS.red);
  rrect(g, -0.365, 0.365, 0.825, 2.65, 0.03);
  g.fill();
  // door window surround, the line name, and the train number display
  g.fillStyle = '#141516';
  rrect(g, -0.27, 0.27, 1.34, 2.60, 0.05);
  g.fill();
  g.fillStyle = hex(COLOURS.victoria);
  rrect(g, -0.235, 0.235, 1.365, 1.455, 0.02);
  g.fill();
  g.fillStyle = '#0b0b0c';
  rrect(g, -0.16, 0.16, 1.06, 1.26, 0.02);
  g.fill();
  // number on the lower left of the mask, and a grille on the right
  textAt(g, number, 0.93, 1.255, 0.105, '600', '#f2f2f2');
  textAt(g, 'Victoria line', 0, 1.41, 0.056, '500', '#ffffff');
  g.fillStyle = '#16171a';
  for (let k = 0; k < 8; k++) rrect(g, -1.02, -0.86, 0.93 + k * 0.03, 0.945 + k * 0.03, 0.006), g.fill();
  // where the lamps sit: darker round recesses
  g.fillStyle = '#1b1c1f';
  for (const s of [1, -1]) {
    g.beginPath(); g.arc(s * 0.66, 1.04, 0.07, 0, Math.PI * 2); g.fill();
  }
  // a faint shut line round the chin
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 0.004;
  g.beginPath(); g.moveTo(-1.4, 0.80); g.lineTo(1.4, 0.80); g.stroke();

  // glass: windscreens and the door window
  const [gc, gg] = frontCanvas();
  gg.fillStyle = '#000';
  gg.fillRect(FRONT_TEX.zMin, FRONT_TEX.yMin, FRONT_TEX.zMax - FRONT_TEX.zMin, FRONT_TEX.yMax - FRONT_TEX.yMin);
  gg.fillStyle = '#fff';
  windscreenPath(gg, 1); gg.fill();
  windscreenPath(gg, -1); gg.fill();
  rrect(gg, -0.235, 0.235, 1.48, 2.575, 0.045);
  gg.fill();
  // the glass is cut out of the paint
  const colour = g.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  const glass = gg.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  for (let i = 0; i < colour.data.length; i += 4) colour.data[i + 3] = 255 - glass.data[i];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.putImageData(colour, 0, 0);

  const paint = new THREE.CanvasTexture(c);
  paint.colorSpace = THREE.SRGBColorSpace;
  paint.anisotropy = 8;
  const glassMap = new THREE.CanvasTexture(gc);
  glassMap.anisotropy = 8;
  return { paint, glass: glassMap };
}

// The glowing parts of the front: destination and train number displays.
export function frontEmissive({ destination = 'Walthamstow Central', train = '211' } = {}) {
  const [c, g] = frontCanvas();
  g.fillStyle = '#000';
  g.fillRect(FRONT_TEX.zMin, FRONT_TEX.yMin, FRONT_TEX.zMax - FRONT_TEX.zMin, FRONT_TEX.yMax - FRONT_TEX.yMin);
  const dots = (text, z0, z1, y0, y1, cols, rows, font) => {
    const s = document.createElement('canvas');
    s.width = cols; s.height = rows;
    const sg = s.getContext('2d', { willReadFrequently: true });
    sg.fillStyle = '#000'; sg.fillRect(0, 0, cols, rows);
    sg.fillStyle = '#fff'; sg.font = font; sg.textAlign = 'center'; sg.textBaseline = 'middle';
    sg.fillText(text, cols / 2, rows / 2 + 1);
    const px = sg.getImageData(0, 0, cols, rows).data;
    const dz = (z1 - z0) / cols, dy = (y1 - y0) / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const on = px[(j * cols + i) * 4] > 110;
      g.fillStyle = on ? '#ff8a1c' : '#0c0703';
      g.beginPath();
      // canvas x runs from +z to -z
      g.arc(z1 - (i + 0.5) * dz, y1 - (j + 0.5) * dy, Math.min(dz, dy) * 0.38, 0, Math.PI * 2);
      g.fill();
    }
  };
  dots(destination, -0.43, 0.43, 2.725, 2.845, 144, 16, 'bold 12px Arial, sans-serif');
  dots(train, -0.13, 0.13, 1.09, 1.23, 28, 14, 'bold 12px Arial, sans-serif');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The bumper under the front: a red block with rounded corners following the
// nose, the black anticlimber in the middle and the coupler below it.
export function chinParts(xFront) {
  const top = 0.80, bottom = 0.33, back = 0.95, fwd = 0.05;
  const half = profileAt(0).z;
  const cx = 0.55, cz = 0.62;               // the corner rounding, as in the nose
  const s = new THREE.Shape();
  // plan outline in (x, z), drawn as shape (x, y) = (x, -z)
  const x0 = xFront - back, x1 = xFront + fwd;
  s.moveTo(x0, -half);
  s.lineTo(x1 - cx, -half);
  s.bezierCurveTo(x1 - cx * 0.45, -half, x1, -half + cz * 0.45, x1, -half + cz);
  s.lineTo(x1, half - cz);
  s.bezierCurveTo(x1, half - cz * 0.45, x1 - cx * 0.45, half, x1 - cx, half);
  s.lineTo(x0, half);
  s.closePath();
  const bevel = 0.035;
  const g = new THREE.ExtrudeGeometry(s, { depth: top - bottom - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24 });
  // shape (x, y, extrusion) -> world (x, extrusion, -y)... as a rotation
  g.applyMatrix4(new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, bottom + bevel,
    0, -1, 0, 0,
    0, 0, 0, 1));
  g.computeVertexNormals();
  return g;
}
