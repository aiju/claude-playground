// Procedural low-poly models for characters, props and pickups.
// Each model is built once into a Mesh and drawn with a transform.

import { MeshBuilder } from './mesh.js';
import { hexLin, hash2 } from './math.js';

const HALF_PI = Math.PI / 2;
const builders = {};
const def = (name, fn) => { builders[name] = fn; };

export class Models {
  constructor(gl) {
    this.gl = gl;
    this.cache = new Map();
  }
  get(name) {
    let m = this.cache.get(name);
    if (!m) {
      const fn = builders[name];
      if (!fn) throw new Error(`no model '${name}'`);
      const b = new MeshBuilder();
      fn(b);
      m = b.build(this.gl);
      this.cache.set(name, m);
    }
    return m;
  }
}

// ---------------- the hero: Pip the fox ----------------
export const HERO = { fur: 0xee8a3c, cream: 0xfff1dc, tunic: 0x4a86d0, belt: 0x7a4a2a, scarf: 0xf2c23c, boot: 0x5a3a2a, dark: 0x2a2026 };

def('hero.body', (b) => {
  const H = HERO;
  b.color(H.tunic).sphere(0, 0.3, 0, 0.19, 10, 8, { smooth: true, sy: 1.05 });
  b.color(H.tunic).cylinder(0, 0.1, 0, 0.21, 0.16, 0.17, 10, { smooth: true });
  b.color(H.belt).cylinder(0, 0.22, 0, 0.198, 0.196, 0.05, 12, { smooth: true, caps: false });
  b.color(0xf2c23c).box(0, 0.245, 0.195, 0.07, 0.06, 0.02);
  b.color(H.cream).sphere(0, 0.36, 0.1, 0.1, 8, 6, { smooth: true, sz: 0.65 });
  // satchel strap and bag
  b.push().translate(0, 0.32, 0).rotateZ(0.7);
  b.color(H.belt).cylinder(0, -0.01, 0, 0.198, 0.198, 0.035, 12, { smooth: true, caps: false });
  b.pop();
  b.color(0x9a6a3a).bevelBox(-0.17, 0.2, -0.05, 0.08, 0.13, 0.15, 0.03);
  // head
  b.color(H.fur).sphere(0, 0.62, 0, 0.21, 12, 9, { smooth: true });
  b.color(H.cream).sphere(-0.1, 0.55, 0.1, 0.1, 8, 6, { smooth: true });
  b.color(H.cream).sphere(0.1, 0.55, 0.1, 0.1, 8, 6, { smooth: true });
  b.color(H.cream).sphere(0, 0.56, 0.16, 0.085, 8, 6, { smooth: true, sz: 1.35, sy: 0.85 });
  b.color(H.dark).sphere(0, 0.585, 0.28, 0.034, 6, 5, { smooth: true });
  // eyes with a glint
  for (const s of [-1, 1]) {
    b.color(H.dark).sphere(s * 0.085, 0.665, 0.165, 0.034, 6, 5, { smooth: true, sy: 1.35 });
    b.push(); b.emis = 1;
    b.color(0xffffff).sphere(s * 0.085 + 0.012, 0.68, 0.192, 0.011, 4, 3);
    b.pop();
    // ears
    b.push().translate(s * 0.115, 0.76, -0.02).rotateZ(-s * 0.38).rotateX(-0.12);
    b.color(H.fur).cone(0, 0, 0, 0.075, 0.22, 7, { smooth: true });
    b.color(H.dark).cone(0, 0.13, 0.0, 0.045, 0.09, 6);
    b.color(H.cream).cone(0, 0.0, 0.035, 0.04, 0.13, 5);
    b.pop();
  }
  // scarf
  b.color(H.scarf).cylinder(0, 0.43, 0, 0.16, 0.15, 0.075, 12, { smooth: true });
  b.color(0xd9a22a).cylinder(0, 0.425, 0, 0.162, 0.162, 0.012, 12, { caps: false });
});

def('hero.scarfEnd', (b) => {
  // hangs from the origin backwards (-z) and down
  b.color(HERO.scarf).box(0, -0.08, -0.03, 0.08, 0.17, 0.03);
  b.color(HERO.scarf).box(0.02, -0.18, -0.045, 0.075, 0.08, 0.03);
});

def('hero.tail', (b) => {
  b.color(HERO.fur).sphere(0, 0.06, -0.16, 0.11, 9, 7, { smooth: true, sz: 1.8, sy: 1.0 });
  b.color(HERO.cream).sphere(0, 0.1, -0.33, 0.075, 8, 6, { smooth: true, sz: 1.2 });
});

def('hero.foot', (b) => {
  b.color(HERO.boot).sphere(0, 0.045, 0.02, 0.065, 8, 6, { smooth: true, sy: 0.7, sz: 1.3 });
});
def('hero.hand', (b) => {
  b.color(HERO.fur).sphere(0, 0, 0, 0.058, 8, 6, { smooth: true });
});

def('sword', (b) => {
  // along +z, grip at the origin
  b.color(0xf2c23c).sphere(0, 0, -0.04, 0.03, 6, 4);
  b.push().rotateX(HALF_PI);
  b.color(0x6a3e22).cylinder(0, -0.04, 0, 0.022, 0.022, 0.13, 6);
  b.pop();
  b.color(0xf2c23c).bevelBox(0, 0, 0.1, 0.2, 0.04, 0.045, 0.012);
  b.push(); b.emis = 0.12;
  b.color(0xdfe8f0).box(0, 0, 0.36, 0.065, 0.022, 0.48);
  b.color(0xb8c4d0).box(0, 0.012, 0.36, 0.012, 0.004, 0.44);
  b.push().translate(0, 0, 0.6).rotateX(HALF_PI);
  b.color(0xdfe8f0).cone(0, 0, 0, 0.046, 0.1, 4, { rot: Math.PI / 4 });
  b.pop();
  b.pop();
});

// ---------------- pickups and items ----------------

def('heart', (b) => {
  const red = 0xf0405a;
  b.push(); b.emis = 0.15;
  b.color(red).sphere(-0.075, 0.07, 0, 0.09, 8, 6, { smooth: true, sz: 0.6 });
  b.color(red).sphere(0.075, 0.07, 0, 0.09, 8, 6, { smooth: true, sz: 0.6 });
  b.push().translate(0, 0.02, 0).rotateZ(Math.PI);
  b.color(red).cone(0, 0, 0, 0.15, 0.17, 4, { rot: Math.PI / 4, smooth: false });
  b.pop();
  b.color(0xffffff).sphere(-0.09, 0.11, 0.045, 0.025, 4, 3);
  b.pop();
});

def('heartContainer', (b) => {
  b.push().scale(2.2);
  builders.heart(b);
  b.pop();
  b.push(); b.emis = 0.5;
  b.color(0xfff0a0).cylinder(0, -0.48, 0, 0.32, 0.38, 0.06, 12);
  b.pop();
});

def('heartPiece', (b) => {
  const red = 0xf0405a;
  b.push(); b.emis = 0.15;
  b.color(red).sphere(-0.075, 0.07, 0, 0.09, 8, 6, { smooth: true, sz: 0.6 });
  b.color(0xffffff).box(0.06, 0.05, 0, 0.12, 0.2, 0.1);
  b.pop();
});

const SHELL_COLS = { 1: 0x7ee08a, 5: 0x6ab4ff, 20: 0xff8a7a, 50: 0xffd84a };
for (const v of [1, 5, 20, 50]) {
  def('shell' + v, (b) => {
    // a little scallop shell: a fan of ribs
    const col = SHELL_COLS[v];
    b.push(); b.emis = 0.12;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a0 = -1.1 + (i / n) * 2.2, a1 = -1.1 + ((i + 1) / n) * 2.2;
      const r = 0.2;
      const c = i & 1 ? col : hexLin(col).map((x) => x * 0.8);
      b.color(c).tri([0, 0, 0], [Math.sin(a0) * r, Math.cos(a0) * r, 0.03], [Math.sin(a1) * r, Math.cos(a1) * r, 0.03]);
      b.color(c).tri([0, 0, 0], [Math.sin(a1) * r, Math.cos(a1) * r, -0.03], [Math.sin(a0) * r, Math.cos(a0) * r, -0.03]);
      b.color(c).quad([Math.sin(a0) * r, Math.cos(a0) * r, 0.03], [Math.sin(a0) * r, Math.cos(a0) * r, -0.03], [Math.sin(a1) * r, Math.cos(a1) * r, -0.03], [Math.sin(a1) * r, Math.cos(a1) * r, 0.03]);
    }
    b.color(col).box(0, 0.0, 0, 0.1, 0.06, 0.07);
    b.pop();
  });
}

def('key', (b) => {
  const gold = 0xf2c23c;
  b.push(); b.emis = 0.2;
  b.color(gold).cylinder(0, 0.16, 0, 0.07, 0.07, 0.03, 10);
  b.push().rotateX(HALF_PI);
  b.color(gold).cylinder(0, -0.015, -0.16, 0.08, 0.08, 0.03, 10);
  b.pop();
  b.color(0x6a4a10).box(0, 0.16, 0, 0.06, 0.06, 0.04);
  b.color(gold).box(0, -0.02, 0, 0.035, 0.32, 0.035);
  b.color(gold).box(0.04, -0.12, 0, 0.07, 0.035, 0.035);
  b.color(gold).box(0.035, -0.06, 0, 0.05, 0.035, 0.035);
  b.pop();
});

def('bigKey', (b) => {
  b.push().scale(1.7);
  builders.key(b);
  b.pop();
  b.push(); b.emis = 0.6;
  b.color(0xff5a6a).sphere(0, 0.27, 0.04, 0.05, 6, 4);
  b.pop();
});

def('boomerang', (b) => {
  // the Leafarang: a big curled leaf
  const g = 0x5cc65a, v = 0x3a8a3a;
  b.color(g).prism([[0, 0.05], [0.22, 0.17], [0.34, 0.06], [0.3, -0.04], [0.12, -0.02], [0, -0.06]], -0.02, 0.02);
  b.color(g).prism([[0, 0.05], [0, -0.06], [-0.12, -0.02], [-0.3, -0.04], [-0.34, 0.06], [-0.22, 0.17]], -0.02, 0.02);
  b.color(v).box(0, 0.025, 0.02, 0.58, 0.012, 0.025);
  b.color(0x8a5a2a).sphere(0, 0, 0, 0.05, 6, 4);
});

def('bomb', (b) => {
  // a puffball mushroom bomb
  b.color(0xe04a3a).sphere(0, 0.2, 0, 0.2, 10, 8, { smooth: true, sy: 0.95 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28, e = 0.6 + (i % 2) * 0.4;
    b.color(0xfff4e0).sphere(Math.cos(a) * 0.15 * Math.sin(e), 0.2 + Math.cos(e) * 0.17, Math.sin(a) * 0.15 * Math.sin(e), 0.04, 5, 4, { smooth: true });
  }
  b.color(0xfff4e0).sphere(0, 0.37, 0, 0.05, 5, 4, { smooth: true });
  b.color(0xf0e0c0).cylinder(0, 0.0, 0, 0.12, 0.14, 0.06, 8);
  b.color(0x6a4a2a).cylinder(0, 0.39, 0, 0.018, 0.012, 0.1, 5);
});

def('arrow', (b) => {
  // along +z, tip at +z
  b.push().rotateX(HALF_PI);
  b.color(0xc49a64).cylinder(0, -0.32, 0, 0.016, 0.016, 0.58, 5);
  b.pop();
  b.push().translate(0, 0, 0.26).rotateX(HALF_PI);
  b.color(0xc8ccd4).cone(0, 0, 0, 0.045, 0.1, 4);
  b.pop();
  b.color(0xf4f4f4).box(0, 0.035, -0.28, 0.008, 0.06, 0.12);
  b.color(0xe04848).box(0.035, 0, -0.28, 0.06, 0.008, 0.12);
  b.color(0xe04848).box(-0.035, 0, -0.28, 0.06, 0.008, 0.12);
});

def('bow', (b) => {
  const w = 0x9a6a3a;
  for (let i = 0; i < 6; i++) {
    const a0 = -1.1 + (i / 6) * 2.2, a1 = -1.1 + ((i + 1) / 6) * 2.2;
    const p0 = [Math.sin(a0) * 0.3, 0, Math.cos(a0) * 0.12], p1 = [Math.sin(a1) * 0.3, 0, Math.cos(a1) * 0.12];
    b.push().translate((p0[0] + p1[0]) / 2, 0, (p0[2] + p1[2]) / 2).rotateY(Math.atan2(p1[0] - p0[0], p1[2] - p0[2]));
    b.color(w).box(0, 0, 0, 0.04, 0.04, Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) + 0.02);
    b.pop();
  }
  b.color(0xf0f0e8).box(0, 0, Math.cos(1.1) * 0.12, Math.sin(1.1) * 0.6, 0.008, 0.008);
});

def('feather', (b) => {
  b.push(); b.emis = 0.15;
  b.color(0xf8f8ff).prism([[0, -0.2], [0.07, -0.05], [0.06, 0.12], [0, 0.22], [-0.06, 0.12], [-0.07, -0.05]], -0.012, 0.012);
  b.color(0x8ab8e8).box(0, 0, 0.0, 0.012, 0.03, 0.42);
  b.color(0x8ab8e8).prism([[0, 0.14], [0.05, 0.12], [0.04, 0.2], [0, 0.22], [-0.04, 0.2], [-0.05, 0.12]], -0.014, 0.014);
  b.pop();
});

def('frostwand', (b) => {
  b.color(0x8a6a4a).cylinder(0, -0.25, 0, 0.022, 0.026, 0.4, 6);
  b.color(0xd8e8f8).cylinder(0, 0.15, 0, 0.04, 0.04, 0.03, 8);
  b.push(); b.emis = 0.7;
  b.color(0x9ae6ff).sphere(0, 0.25, 0, 0.08, 4, 2, { sy: 1.5 });
  b.pop();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.28;
    b.push().translate(Math.cos(a) * 0.06, 0.2, Math.sin(a) * 0.06).rotateY(-a).rotateZ(-0.6);
    b.color(0xd8e8f8).cone(0, 0, 0, 0.02, 0.1, 4);
    b.pop();
  }
});

def('sunstone', (b) => {
  b.push(); b.emis = 1.5;
  b.color(0xffd25a).sphere(0, 0, 0, 0.18, 4, 2, { sy: 1.4 });
  b.pop();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28;
    b.push().translate(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0).rotateZ(a - HALF_PI);
    b.push(); b.emis = 1;
    b.color(0xffb030).cone(0, 0, 0, 0.04, 0.12, 4);
    b.pop();
    b.pop();
  }
});

def('arrowsPickup', (b) => {
  for (const s of [-0.06, 0, 0.06]) {
    b.push().translate(s, 0.12, 0).rotateX(-HALF_PI).scale(0.7);
    builders.arrow(b);
    b.pop();
  }
});

def('bombsPickup', (b) => {
  b.push().scale(0.6); builders.bomb(b); b.pop();
});

def('magicJar', (b) => {
  b.color(0x6ad4a4).cylinder(0, 0, 0, 0.12, 0.1, 0.22, 8, { smooth: true });
});

// ---------------- props ----------------

def('bush', (b) => {
  const cols = [0x4fae4c, 0x5ebc56, 0x46a044];
  b.sway = 0.18;
  const parts = [[0, 0.28, 0, 0.36], [-0.2, 0.2, 0.1, 0.25], [0.2, 0.22, 0.08, 0.26], [0.02, 0.2, -0.18, 0.25]];
  parts.forEach(([x, y, z, r], i) => b.color(cols[i % 3]).sphere(x, y, z, r, 7, 5, { jitter: 0.35, seed: i * 2.3 }));
  b.color(0xffffff).sphere(0.12, 0.5, 0.15, 0.04, 4, 3);
  b.color(0xffffff).sphere(-0.18, 0.38, 0.2, 0.035, 4, 3);
});

def('bushStump', (b) => {
  b.color(0x5a8a3a).cylinder(0, 0, 0, 0.2, 0.14, 0.07, 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28;
    b.color(0x4a7a30).cone(Math.cos(a) * 0.1, 0.05, Math.sin(a) * 0.1, 0.03, 0.08, 3);
  }
});

def('tallgrass', (b) => {
  const cols = [hexLin(0x5aae46), hexLin(0x6cc052), hexLin(0x4c9a3c)];
  for (let i = 0; i < 12; i++) {
    const a = hash2(i, 3) * 6.28, r = hash2(i, 5) * 0.32;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.32 + hash2(i, 9) * 0.22;
    const w = 0.05, o = a + 1.57;
    const c = cols[i % 3];
    const top = c.map((v) => v * 1.3);
    b.tri([x - Math.cos(o) * w, 0, z - Math.sin(o) * w], [x + Math.cos(o) * w, 0, z + Math.sin(o) * w], [x + (hash2(i, 1) - 0.5) * 0.15, h, z + (hash2(i, 2) - 0.5) * 0.15], c, c, top, [0, 0, 0.8]);
  }
});
def('grassStub', (b) => {
  const c = hexLin(0x5aa042);
  for (let i = 0; i < 8; i++) {
    const a = hash2(i, 3) * 6.28, r = hash2(i, 5) * 0.3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    b.tri([x - 0.04, 0, z], [x + 0.04, 0, z], [x, 0.08, z], c, c, c);
  }
});

def('pot', (b) => {
  const c = 0xd47e4c, band = 0xf3c47a;
  const prof = [[0, 0.16], [0.08, 0.24], [0.22, 0.29], [0.36, 0.25], [0.44, 0.16], [0.5, 0.17], [0.53, 0.2]];
  for (let i = 0; i < prof.length - 1; i++) {
    const [y0, r0] = prof[i], [y1, r1] = prof[i + 1];
    b.color(i === 2 ? band : c).cylinder(0, y0, 0, r0, r1, y1 - y0, 10, { smooth: true, caps: false });
  }
  b.color(0x3a2418).disc(0, 0.5, 0, 0.16, 10);
  b.color(c).disc(0, 0.0, 0, 0.16, 10);
});

def('shard', (b) => {
  b.color(0xd47e4c).tri([0, 0, 0], [0.12, 0, 0.03], [0.05, 0.1, 0]);
  b.color(0xb8683c).tri([0, 0, 0], [0.05, 0.1, 0], [0.04, 0.02, 0.07]);
});
def('leaf', (b) => {
  b.color(0x5cbc52).tri([0, 0, 0], [0.09, 0, 0.04], [0.02, 0, 0.13]);
  b.color(0x4aa044).tri([0, 0, 0], [0.02, 0, 0.13], [-0.06, 0, 0.05]);
});
def('chip', (b) => { b.color(0xa8a49c).box(0, 0, 0, 0.1, 0.08, 0.09); });
def('chipBrown', (b) => { b.color(0x8a7458).box(0, 0, 0, 0.1, 0.08, 0.09); });
def('iceChip', (b) => { b.push(); b.emis = 0.3; b.color(0xcff4ff).box(0, 0, 0, 0.1, 0.1, 0.07); b.pop(); });

def('rock', (b) => {
  b.color(0xa9a7a0).sphere(0, 0.18, 0, 0.32, 7, 5, { jitter: 0.4, sy: 0.65, seed: 3 });
  b.color(0x6fae4c).sphere(-0.1, 0.33, -0.05, 0.12, 5, 3, { sy: 0.4 });
});

def('boulder', (b) => {
  b.color(0x9a948a).sphere(0, 0.44, 0, 0.52, 8, 6, { jitter: 0.35, sy: 0.88, seed: 7 });
  b.color(0x4a4640).box(0.05, 0.6, 0.42, 0.04, 0.35, 0.04);
  b.color(0x4a4640).box(-0.06, 0.42, 0.46, 0.18, 0.04, 0.04);
  b.color(0x4a4640).box(0.18, 0.75, 0.36, 0.14, 0.035, 0.035);
});

def('block', (b) => {
  b.color(0xa9a394).bevelBox(0, 0.45, 0, 0.96, 0.9, 0.96, 0.08, { topColor: 0xbab4a4 });
  b.color(0x8a8476).box(0, 0.91, 0, 0.5, 0.02, 0.5);
  b.color(0xbab4a4).box(0, 0.92, 0, 0.3, 0.02, 0.3);
  for (const s of [-1, 1]) b.color(0x8a8476).box(0, 0.45, s * 0.485, 0.5, 0.5, 0.02);
  for (const s of [-1, 1]) b.color(0x8a8476).box(s * 0.485, 0.45, 0, 0.02, 0.5, 0.5);
});

def('chest.base', (b) => {
  const wood = 0xb4733e, gold = 0xf2c23c;
  b.color(wood).bevelBox(0, 0.22, 0, 0.8, 0.44, 0.58, 0.03);
  for (const x of [-0.3, 0.3]) b.color(gold).box(x, 0.22, 0, 0.07, 0.46, 0.6);
  b.color(gold).box(0, 0.4, 0.3, 0.14, 0.12, 0.03);
});
def('chest.lid', (b) => {
  // pivot at the back top edge (origin), lid extends towards +z
  const wood = 0xc4834a, gold = 0xf2c23c;
  b.push().translate(0, 0, 0.29).rotateZ(HALF_PI);
  b.color(wood).cylinder(0, -0.4, 0, 0.29, 0.29, 0.8, 8, { rot: 0 });
  b.pop();
  b.push().translate(0, 0, 0.29);
  for (const x of [-0.3, 0.3]) {
    b.push().translate(x, 0, 0).rotateZ(HALF_PI);
    b.color(gold).cylinder(0, -0.035, 0, 0.3, 0.3, 0.07, 8);
    b.pop();
  }
  b.pop();
});
def('bigchest.base', (b) => {
  b.push().scale(1.35);
  const wood = 0x3e6ab4, gold = 0xf2c23c;
  b.color(wood).bevelBox(0, 0.22, 0, 0.8, 0.44, 0.58, 0.03);
  for (const x of [-0.3, 0, 0.3]) b.color(gold).box(x, 0.22, 0, 0.07, 0.46, 0.6);
  b.color(gold).box(0, 0.4, 0.3, 0.16, 0.14, 0.03);
  b.pop();
});
def('bigchest.lid', (b) => {
  b.push().scale(1.35);
  const wood = 0x4a7ac4, gold = 0xf2c23c;
  b.push().translate(0, 0, 0.29).rotateZ(HALF_PI);
  b.color(wood).cylinder(0, -0.4, 0, 0.29, 0.29, 0.8, 8);
  b.pop();
  for (const x of [-0.3, 0, 0.3]) {
    b.push().translate(x, 0, 0.29).rotateZ(HALF_PI);
    b.color(gold).cylinder(0, -0.035, 0, 0.3, 0.3, 0.07, 8);
    b.pop();
  }
  b.pop();
});

def('sign', (b) => {
  const w = 0xc89a64;
  b.color(0x8a6038).box(0, 0.3, 0, 0.09, 0.6, 0.09);
  b.color(w).bevelBox(0, 0.62, 0.02, 0.7, 0.42, 0.07, 0.02);
  for (let i = 0; i < 3; i++) b.color(0x7a5232).box(-0.04 + (i % 2) * 0.05, 0.72 - i * 0.1, 0.06, 0.42 - (i === 2 ? 0.15 : 0), 0.03, 0.01);
});

def('torch', (b) => {
  const st = 0x8a8f96;
  b.color(st).cylinder(0, 0, 0, 0.25, 0.22, 0.12, 8);
  b.color(0x6a6f76).cylinder(0, 0.12, 0, 0.09, 0.08, 0.6, 6);
  b.color(st).cylinder(0, 0.72, 0, 0.12, 0.26, 0.18, 8, { caps: false });
  b.color(0x2a2a2a).disc(0, 0.85, 0, 0.22, 8);
  b.color(0x4a3a2a).sphere(0, 0.86, 0, 0.13, 6, 4, { sy: 0.5 });
});

def('plate', (b) => {
  b.color(0x6a7472).box(0, 0.02, 0, 0.92, 0.04, 0.92);
  b.color(0xc8a050).bevelBox(0, 0.07, 0, 0.74, 0.08, 0.74, 0.03);
  b.color(0x8a6a30).box(0, 0.115, 0, 0.3, 0.01, 0.3);
});
def('plate.down', (b) => {
  b.color(0x6a7472).box(0, 0.02, 0, 0.92, 0.04, 0.92);
  b.color(0xb08a40).bevelBox(0, 0.035, 0, 0.74, 0.03, 0.74, 0.01);
});

def('crystal.base', (b) => {
  b.color(0x7c8a8a).cylinder(0, 0, 0, 0.3, 0.24, 0.2, 8);
  b.color(0x6c7a7a).cylinder(0, 0.2, 0, 0.12, 0.16, 0.25, 8);
});
def('crystal.orb', (b) => {
  b.color(0xffffff).sphere(0, 0, 0, 0.26, 4, 2, { sy: 1.25 });
});

def('toggle.up', (b) => {
  b.color(0xffffff).bevelBox(0, 0.4, 0, 0.98, 0.8, 0.98, 0.07);
  b.color(0xeeeeee).box(0, 0.81, 0, 0.42, 0.02, 0.42);
});
def('toggle.down', (b) => {
  b.color(0xffffff).box(0, 0.015, 0, 0.98, 0.03, 0.98);
  b.color(0xdddddd).box(0, 0.032, 0, 0.42, 0.01, 0.42);
});

def('iceTile', (b) => {
  b.push(); b.emis = 0.12;
  b.color(0xd8f4ff).bevelBox(0, -0.07, 0, 1.0, 0.16, 1.0, 0.05, { topColor: 0xeefaff });
  b.color(0xffffff).box(0.12, 0.012, -0.1, 0.4, 0.004, 0.03);
  b.color(0xffffff).box(-0.15, 0.012, 0.18, 0.25, 0.004, 0.03);
  b.pop();
});
def('iceBlock', (b) => {
  b.push(); b.emis = 0.18;
  b.color(0xc4ecfc).bevelBox(0, 0.45, 0, 0.92, 0.9, 0.92, 0.12, { topColor: 0xe6f8ff });
  b.color(0xffffff).box(0.25, 0.65, 0.47, 0.05, 0.3, 0.01);
  b.color(0xffffff).box(0.33, 0.55, 0.47, 0.03, 0.18, 0.01);
  b.pop();
});

def('crackedRock', (b) => {
  // fits in a cliff tile; front face shows a crack
  const c = 0x9a8670;
  b.color(c).box(0, 0.75, 0, 1.0, 1.5, 1.0, { topColor: 0x76ba4e });
  const d = 0x3a3028;
  b.color(d).box(0, 0.75, 0.505, 0.05, 0.9, 0.01);
  b.color(d).box(-0.12, 0.95, 0.505, 0.28, 0.04, 0.01);
  b.color(d).box(0.12, 0.55, 0.505, 0.25, 0.04, 0.01);
  b.color(d).box(0.2, 1.05, 0.505, 0.04, 0.3, 0.01);
});

def('crackedWall', (b) => {
  const c = 0x6e918c;
  b.color(c).box(0, 1.05, 0, 1.0, 2.1, 1.0, { topColor: 0x263634 });
  const d = 0x1a2422;
  b.color(d).box(0, 0.9, 0.505, 0.05, 1.1, 0.01);
  b.color(d).box(-0.12, 1.15, 0.505, 0.3, 0.04, 0.01);
  b.color(d).box(0.14, 0.6, 0.505, 0.3, 0.04, 0.01);
  b.color(d).box(0.25, 1.3, 0.505, 0.04, 0.35, 0.01);
});

// ---------------- doors ----------------
// Built facing +z (as if in the north wall of a room); rotated for other walls.
def('door.frame', (b) => {
  const st = 0x5a7a76, gold = 0xd9b44a;
  b.color(st).box(-0.48, 1.0, 0.0, 0.16, 2.0, 1.02);
  b.color(st).box(0.48, 1.0, 0.0, 0.16, 2.0, 1.02);
  b.color(st).box(0, 1.6, 0.0, 1.1, 0.4, 1.02);
  b.color(gold).box(0, 1.42, 0.52, 0.8, 0.06, 0.04);
});
def('door.shutter', (b) => {
  for (let i = 0; i < 5; i++) b.color(0x4a4f56).box(-0.32 + i * 0.16, 0.7, 0.3, 0.06, 1.4, 0.06);
  b.color(0x4a4f56).box(0, 0.45, 0.3, 0.8, 0.06, 0.06);
  b.color(0x4a4f56).box(0, 1.05, 0.3, 0.8, 0.06, 0.06);
});
def('door.locked', (b) => {
  b.color(0x8a5a32).box(0, 0.7, 0.25, 0.82, 1.4, 0.12);
  for (let i = 0; i < 4; i++) b.color(0x7a4a26).box(-0.3 + i * 0.2, 0.7, 0.32, 0.02, 1.36, 0.02);
  b.color(0x4a4f56).box(0, 0.4, 0.32, 0.84, 0.06, 0.03);
  b.color(0x4a4f56).box(0, 1.0, 0.32, 0.84, 0.06, 0.03);
  b.push(); b.emis = 0.15;
  b.color(0xf2c23c).bevelBox(0, 0.72, 0.38, 0.24, 0.24, 0.08, 0.03);
  b.color(0x2a2a2a).box(0, 0.7, 0.425, 0.05, 0.1, 0.01);
  b.push().translate(0, 0.86, 0.38).rotateX(HALF_PI);
  b.color(0xc8ccd4).cylinder(0, -0.02, 0, 0.08, 0.08, 0.04, 8);
  b.pop();
  b.pop();
});
def('door.boss', (b) => {
  b.color(0x6a3a5a).box(0, 0.7, 0.25, 0.82, 1.4, 0.12);
  b.color(0xd9b44a).box(0, 0.7, 0.32, 0.86, 0.08, 0.03);
  b.color(0xd9b44a).box(0, 0.7, 0.32, 0.08, 1.4, 0.03);
  b.push(); b.emis = 0.4;
  b.color(0xff5a6a).sphere(0, 0.72, 0.4, 0.12, 6, 4);
  b.pop();
  b.color(0xd9b44a).cylinder(0, 0.62, 0.4, 0.18, 0.18, 0.04, 8);
});

// ---------------- enemies (simple ones; see also enemy models below) ----------------

def('slime', (b) => {
  const g = 0x6fd46a;
  b.color(g).sphere(0, 0.25, 0, 0.3, 12, 9, { smooth: true, sy: 0.85 });
  b.color(0x4fb04a).cylinder(0, 0, 0, 0.29, 0.3, 0.08, 12, { smooth: true });
  for (const s of [-1, 1]) {
    b.color(0xffffff).sphere(s * 0.1, 0.33, 0.22, 0.07, 8, 6, { smooth: true });
    b.color(0x1a1a22).sphere(s * 0.1, 0.33, 0.28, 0.035, 6, 5, { smooth: true });
  }
  b.push(); b.emis = 0.5;
  b.color(0xeaffea).sphere(-0.1, 0.45, 0.08, 0.05, 5, 4, { sy: 0.6 });
  b.pop();
});

export { builders as MODEL_BUILDERS, def as defineModel };
