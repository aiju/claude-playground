// Procedural canvas textures: brick walls with windows, limewashed
// interiors, painted signs and floating labels. Everything is drawn at a few
// pixels per foot, which is plenty for a diorama seen from a distance.
import * as THREE from 'three';

const PPF = 4; // pixels per foot

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(w));
  c.height = Math.max(4, Math.round(h));
  return c;
}

function texture(c, { repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A simple deterministic hash for texture noise.
function noise(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

// Window layout for one wall of one floor: centred bays at a fixed spacing,
// skipping any that would overlap a door.
export function windowBays(length, { spacing, width }, doors = []) {
  const n = Math.max(0, Math.floor((length - 4) / spacing));
  const start = (length - n * spacing) / 2 + spacing / 2;
  const bays = [];
  for (let i = 0; i < n; i++) {
    const u = start + i * spacing;
    if (doors.some((dx) => Math.abs(dx - u) < (width + 8) / 2)) continue;
    bays.push(u);
  }
  return bays;
}

// The outside of one wall on one floor. `doors` are distances along the wall
// (from the left as seen from outside) of doorways on this floor.
export function brickWall(length, height, opts) {
  const {
    brick, plinth, joinery, glazing = '#2b3439', style = 'works', ground = false,
    window: win = { spacing: 10, width: 5, height: 7.5, sill: 3 }, doors = [], doorWidth = 8,
    doorHeight = 10, stringCourse = false, segmental = true, lit = false,
  } = opts;
  const W = length * PPF;
  const H = height * PPF;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  if (lit) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  } else {
    g.fillStyle = brick;
    g.fillRect(0, 0, W, H);
    // Courses of brick: alternate faint bands and speckle.
    for (let y = 0; y < H; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.05 + 0.05 * noise(y)})`;
      g.fillRect(0, y, W, 1);
    }
    for (let i = 0; i < (W * H) / 40; i++) {
      const x = noise(i * 3.1) * W;
      const y = noise(i * 7.7) * H;
      g.fillStyle = noise(i) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      g.fillRect(x, y, 3, 1);
    }
    // Soot towards the top of works buildings.
    if (style === 'works') {
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(20,16,14,0.18)');
      grd.addColorStop(1, 'rgba(20,16,14,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    if (ground && plinth) {
      g.fillStyle = plinth;
      g.fillRect(0, H - 2.2 * PPF, W, 2.2 * PPF);
    }
    if (stringCourse) {
      g.fillStyle = 'rgba(205,190,160,0.9)';
      g.fillRect(0, 0, W, 0.6 * PPF);
    }
  }

  const bays = windowBays(length, win, doors);
  for (const u of bays) {
    const x = (u - win.width / 2) * PPF;
    const w = win.width * PPF;
    const top = (height - win.sill - win.height) * PPF;
    const h = win.height * PPF;
    if (lit) {
      g.fillStyle = '#fff';
      g.fillRect(x + 2, top + 2, w - 4, h - 4);
      continue;
    }
    // Segmental brick arch over the window.
    if (segmental) {
      g.fillStyle = shade(brick, 0.78);
      g.beginPath();
      g.ellipse(x + w / 2, top + 1, w / 2 + 3, 5, 0, Math.PI, 0);
      g.fill();
    }
    // Frame, glazing and glazing bars.
    g.fillStyle = joinery;
    g.fillRect(x, top, w, h);
    g.fillStyle = glazing;
    g.fillRect(x + 2, top + 2, w - 4, h - 4);
    g.fillStyle = joinery;
    const panesX = style === 'office' ? 2 : 4;
    const panesY = style === 'office' ? 3 : 5;
    for (let i = 1; i < panesX; i++) g.fillRect(x + (w * i) / panesX - 0.5, top, 1, h);
    for (let j = 1; j < panesY; j++) g.fillRect(x, top + (h * j) / panesY - 0.5, w, 1);
    // Stone sill.
    g.fillStyle = '#b9ad94';
    g.fillRect(x - 2, top + h, w + 4, 3);
  }
  if (!lit) {
    for (const u of doors) {
      const w = doorWidth * PPF;
      const x = u * PPF - w / 2;
      const h = Math.min(doorHeight, height - 1) * PPF;
      g.fillStyle = shade(brick, 0.75);
      g.fillRect(x - 3, H - h - 4, w + 6, h + 4);
      g.fillStyle = joinery;
      g.fillRect(x, H - h, w, h);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < 6; i++) g.fillRect(x + (w * i) / 6, H - h, 1, h);
    }
  }
  return texture(c);
}

// The inside of a wall: limewash, with the windows as pale light.
export function limewashWall(length, height, { window: win = { spacing: 10, width: 5, height: 7.5, sill: 3 }, limewash = '#e8e2d2' } = {}) {
  const W = length * PPF;
  const H = height * PPF;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = limewash;
  g.fillRect(0, 0, W, H);
  // A dado of darker paint, as shops often had.
  g.fillStyle = 'rgba(70,80,70,0.35)';
  g.fillRect(0, H - 3.5 * PPF, W, 3.5 * PPF);
  for (const u of windowBays(length, win)) {
    const x = (u - win.width / 2) * PPF;
    const top = (height - win.sill - win.height) * PPF;
    g.fillStyle = '#c8d3d4';
    g.fillRect(x, top, win.width * PPF, win.height * PPF);
    g.fillStyle = 'rgba(40,50,50,0.5)';
    for (let i = 1; i < 4; i++) g.fillRect(x + (win.width * PPF * i) / 4, top, 1, win.height * PPF);
  }
  return texture(c);
}

// Rows of terraced houses: front door, front window, two bedroom windows.
export function terraceFront(length, height, { brick, joinery = '#2f3a33', houseWidth = 15, lit = false }) {
  const W = length * PPF;
  const H = height * PPF;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = lit ? '#000' : brick;
  g.fillRect(0, 0, W, H);
  if (!lit) {
    for (let y = 0; y < H; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.04 + 0.05 * noise(y + 9)})`;
      g.fillRect(0, y, W, 1);
    }
  }
  const n = Math.floor(length / houseWidth);
  for (let i = 0; i < n; i++) {
    const x0 = i * houseWidth * PPF;
    const flip = i % 2 === 1;
    const doorX = x0 + (flip ? 11 : 1.5) * PPF;
    const winX = x0 + (flip ? 2.5 : 7.5) * PPF;
    const glow = noise(i * 5.3) > 0.55;
    if (lit) {
      g.fillStyle = glow ? '#fff' : '#000';
      g.fillRect(winX + 2, H - 8.2 * PPF, 4.5 * PPF, 4.8 * PPF);
      if (noise(i * 2.1) > 0.7) g.fillRect(x0 + 5 * PPF, H - 15.8 * PPF, 4 * PPF, 4.2 * PPF);
      continue;
    }
    g.fillStyle = '#2a201b';
    g.fillRect(doorX, H - 7.3 * PPF, 3 * PPF, 7.3 * PPF);
    g.fillStyle = '#b9ad94';
    g.fillRect(doorX - 2, H - 7.8 * PPF, 3 * PPF + 4, 2);
    g.fillStyle = joinery;
    g.fillRect(winX, H - 8.4 * PPF, 5 * PPF, 5.2 * PPF);
    g.fillStyle = '#29343a';
    g.fillRect(winX + 2, H - 8.2 * PPF, 5 * PPF - 4, 5.2 * PPF - 4);
    g.fillStyle = '#e9e1cf';
    g.fillRect(winX + 2, H - 8.2 * PPF, 5 * PPF - 4, 1.4 * PPF);
    for (const wx of [x0 + 2.5 * PPF, x0 + 8.5 * PPF]) {
      g.fillStyle = joinery;
      g.fillRect(wx, H - 16 * PPF, 4 * PPF, 4.5 * PPF);
      g.fillStyle = '#29343a';
      g.fillRect(wx + 2, H - 15.8 * PPF, 4 * PPF - 4, 4.5 * PPF - 4);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x0, 0, 1, H);
  }
  return texture(c);
}

// Painted lettering on brick, as the Companies Act required on the
// outside of the registered office: cream paint, serif capitals.
export function paintedSign(text, { width, height, colour = '#ece2c6', ground = null, font = 'Libre Caslon Text, Georgia, serif' }) {
  const W = width * PPF * 2;
  const H = height * PPF * 2;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  if (ground) {
    g.fillStyle = ground;
    g.fillRect(0, 0, W, H);
  }
  g.fillStyle = colour;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = H * 0.72;
  g.font = `700 ${size}px ${font}`;
  while (g.measureText(text).width > W * 0.96 && size > 6) {
    size *= 0.95;
    g.font = `700 ${size}px ${font}`;
  }
  g.fillText(text, W / 2, H / 2 + size * 0.05);
  const t = texture(c);
  return t;
}

// A floating label for a room or place.
export function labelTexture(text, { sub = '', size = 34 } = {}) {
  const pad = 14;
  const c0 = canvas(8, 8).getContext('2d');
  c0.font = `600 ${size}px 'Libre Caslon Text', Georgia, serif`;
  const w1 = c0.measureText(text).width;
  c0.font = `italic ${size * 0.62}px 'Libre Caslon Text', Georgia, serif`;
  const w2 = sub ? c0.measureText(sub).width : 0;
  const W = Math.ceil(Math.max(w1, w2) + pad * 2);
  const H = Math.ceil(size * (sub ? 1.9 : 1.25) + pad);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(246,240,226,0.9)';
  roundRect(g, 0, 0, W, H, 8);
  g.fill();
  g.strokeStyle = 'rgba(60,45,30,0.6)';
  g.lineWidth = 2;
  roundRect(g, 1, 1, W - 2, H - 2, 8);
  g.stroke();
  g.fillStyle = '#2b2118';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.font = `600 ${size}px 'Libre Caslon Text', Georgia, serif`;
  g.fillText(text, W / 2, pad * 0.6);
  if (sub) {
    g.fillStyle = '#5a4a3a';
    g.font = `italic ${size * 0.62}px 'Libre Caslon Text', Georgia, serif`;
    g.fillText(sub, W / 2, pad * 0.6 + size * 1.1);
  }
  const t = texture(c);
  t.anisotropy = 1;
  return { texture: t, aspect: W / H };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Slates: a repeating texture of overlapping courses.
export function slateTexture(colour) {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = colour;
  g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 8; row++) {
    const y = row * 8;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, y, 64, 1);
    for (let i = 0; i < 6; i++) {
      const x = ((i * 12 + (row % 2) * 6) % 64);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x, y, 1, 8);
      g.fillStyle = `rgba(255,255,255,${0.03 + 0.05 * noise(row * 7 + i)})`;
      g.fillRect(x + 1, y + 1, 10, 6);
    }
  }
  return texture(c, { repeat: true });
}

// Moving stripes for line shafting and belts, so motion shows.
// With { across: true } the stripes run across u instead of v (for turning
// a cylinder about its own axis).
export function stripeTexture(a, b, { across = false } = {}) {
  const c = across ? canvas(64, 16) : canvas(16, 64);
  const g = c.getContext('2d');
  g.fillStyle = a;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = b;
  if (across) {
    g.fillRect(0, 0, 10, 16);
    g.fillRect(32, 0, 6, 16);
  } else {
    g.fillRect(0, 0, 16, 10);
    g.fillRect(0, 32, 16, 6);
  }
  return texture(c, { repeat: true });
}

export function groundTexture(base, speck, size = 128) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.15; i++) {
    g.fillStyle = noise(i * 1.7) > 0.5 ? speck : 'rgba(0,0,0,0.06)';
    g.fillRect(noise(i * 3.3) * size, noise(i * 5.9) * size, 1 + noise(i) * 2, 1);
  }
  return texture(c, { repeat: true });
}
