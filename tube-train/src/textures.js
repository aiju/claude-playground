// Textures drawn on canvases: the seat moquette, the floor, the LED displays.

import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

// deterministic pseudo-random numbers
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An original moquette: a deep blue ground with a lattice of little stepped
// diamonds in Victoria line blue, and red and white flecks, woven small
// enough that a seat shows a few repeats.
export function moquetteTexture() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#16255e';
  g.fillRect(0, 0, S, S);
  const cell = 64;
  const diamond = (cx, cy, r, colour) => {
    g.fillStyle = colour;
    // stepped, like a woven pattern
    const step = 4;
    for (let dy = -r; dy < r; dy += step) {
      const w = r - Math.abs(dy + step / 2);
      g.fillRect(cx - w, cy + dy, 2 * w, step);
    }
  };
  // each motif is drawn again one tile over wherever it crosses an edge, so
  // the texture repeats seamlessly
  const tiled = (x, y, r, colour) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (x + ox + r < 0 || x + ox - r > S || y + oy + r < 0 || y + oy - r > S) continue;
      diamond(x + ox, y + oy, r, colour);
    }
  };
  for (let y = 0; y < S; y += cell) {
    for (let x = 0; x < S; x += cell) {
      tiled(x, y, 22, '#2c8fd0');
      tiled(x, y, 14, '#16255e');
      tiled(x, y, 8, '#e7e2d4');
      tiled(x + cell / 2, y + cell / 2, 10, '#c8233a');
      tiled(x + cell / 2, y + cell / 2, 4, '#16255e');
    }
  }
  const img = g.getImageData(0, 0, S, S);
  // a woven grain
  const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % S, py = Math.floor(i / 4 / S);
    const k = 0.88 + 0.18 * r() + ((px + py) % 2 ? 0.04 : -0.04);
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, { repeat: true });
}

// speckled grey floor covering
export function floorTexture() {
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#6c7076';
  g.fillRect(0, 0, S, S);
  const r = rng(11);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? 'rgba(40,42,46,0.55)' : v < 0.85 ? 'rgba(170,172,176,0.5)' : 'rgba(210,190,120,0.45)';
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  return toTexture(c, { repeat: true });
}

// Dot-matrix text, drawn the way an LED display shows it: the text is
// rendered small, then each pixel becomes a round dot. `text` can be several
// lines, and a tab in a line pushes what follows it to the right.
export function ledTexture(text, { cols = 128, rows = 16, colour = [255, 150, 30], font = 'bold 13px sans-serif', align = 'center', dot = 6 } = {}) {
  const [small, sg] = canvas(cols, rows);
  sg.fillStyle = '#000';
  sg.fillRect(0, 0, cols, rows);
  sg.fillStyle = '#fff';
  sg.font = font;
  sg.textBaseline = 'middle';
  const lines = [].concat(text);
  lines.forEach((line, i) => {
    const y = rows * (i + 0.5) / lines.length + 1;
    const [left, right] = line.split('\t');
    sg.textAlign = right === undefined ? align : 'left';
    sg.fillText(left, sg.textAlign === 'center' ? cols / 2 : sg.textAlign === 'right' ? cols - 1 : 1, y);
    if (right !== undefined) { sg.textAlign = 'right'; sg.fillText(right, cols - 1, y); }
  });
  const px = sg.getImageData(0, 0, cols, rows).data;
  const [c, g] = canvas(cols * dot, rows * dot);
  g.fillStyle = '#050403';
  g.fillRect(0, 0, c.width, c.height);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const on = px[(j * cols + i) * 4] > 110;
      g.fillStyle = on ? `rgb(${colour.join(',')})` : 'rgba(255,255,255,0.035)';
      g.beginPath();
      g.arc((i + 0.5) * dot, (j + 0.5) * dot, dot * 0.36, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTexture(c);
}

// white lettering on a transparent ground, for the numbers on the cars
export function labelTexture(text, { w = 512, h = 128, font = '600 96px "Helvetica Neue", Arial, sans-serif', colour = '#fff', bg = null, align = 'center' } = {}) {
  const [c, g] = canvas(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = colour;
  g.font = font;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, align === 'center' ? w / 2 : align === 'left' ? h * 0.2 : w - h * 0.2, h / 2 + h * 0.04);
  return toTexture(c);
}

// small value noise, for grime
export function noiseTexture(size = 256, seed = 3, scale = 8, range = [0, 1]) {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  const r = rng(seed);
  const grid = [];
  const n = scale;
  for (let i = 0; i < n * n; i++) grid.push(r());
  const at = (x, y) => grid[((y % n + n) % n) * n + ((x % n + n) % n)];
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, freq = 1;
      for (let o = 0; o < 4; o++) {
        const fx = (x / size) * n * freq, fy = (y / size) * n * freq;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
        const a = at(x0, y0), b = at(x0 + 1, y0), cc = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
        v += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty);
        amp *= 0.5; freq *= 2;
      }
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round((range[0] + (range[1] - range[0]) * v) * 255);
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, { srgb: false, repeat: true });
}

// a soft round glow, for lamps seen through the murk
export function glowTexture() {
  const S = 128;
  const [c, g] = canvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return toTexture(c);
}
