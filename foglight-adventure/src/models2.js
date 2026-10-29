// More models: monsters, island folk and a few extra props.

import { defineModel as def, MODEL_BUILDERS as builders } from './models.js';
import { hexLin, hash2 } from './math.js';

const HALF_PI = Math.PI / 2;

const eyes = (b, x, y, z, r = 0.05, pupil = 0x1a1a22) => {
  for (const s of [-1, 1]) {
    b.color(0xffffff).sphere(s * x, y, z, r, 8, 6, { smooth: true });
    b.color(pupil).sphere(s * x, y, z + r * 0.6, r * 0.55, 6, 5, { smooth: true });
  }
};

// ---------------- monsters ----------------
def('slime.blue', (b) => {
  const g = 0x6ab4f0;
  b.color(g).sphere(0, 0.25, 0, 0.3, 12, 9, { smooth: true, sy: 0.85 });
  b.color(0x4a90d0).cylinder(0, 0, 0, 0.29, 0.3, 0.08, 12, { smooth: true });
  eyes(b, 0.1, 0.33, 0.22, 0.07);
  b.push(); b.emis = 0.5; b.color(0xeaf6ff).sphere(-0.1, 0.45, 0.08, 0.05, 5, 4, { sy: 0.6 }); b.pop();
});

def('sprout', (b) => {
  // a walking bulb with root feet
  b.color(0x8a6ac4).sphere(0, 0.36, 0, 0.27, 10, 8, { smooth: true, sy: 1.05 });
  b.color(0xb49ae8).sphere(0, 0.3, 0.12, 0.17, 8, 6, { smooth: true, sz: 0.7 });
  eyes(b, 0.11, 0.5, 0.2, 0.06);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.color(0x6a5a3a).cone(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16, 0.07, 0.16, 5);
  }
});
def('sprout.mouth', (b) => {
  b.push().rotateX(HALF_PI);
  b.color(0x6a4aa4).cylinder(0, -0.02, 0, 0.07, 0.09, 0.14, 8, { caps: false });
  b.color(0x2a1a3a).disc(0, 0.12, 0, 0.065, 8);
  b.pop();
});
def('sprout.leaves', (b) => {
  b.sway = 0.2;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.push().rotateY(a).rotateZ(0.6);
    b.color(0x5cc65a).prism([[0, 0], [0.06, 0.1], [0, 0.24], [-0.06, 0.1]].map(([x, z]) => [x, z]), -0.01, 0.01);
    b.pop();
  }
  b.color(0x5cc65a).cylinder(0, -0.06, 0, 0.02, 0.02, 0.08, 4);
});

def('bat', (b) => {
  b.color(0x5a4a7a).sphere(0, 0, 0, 0.16, 8, 6, { smooth: true });
  b.color(0x5a4a7a).cone(-0.08, 0.1, 0, 0.05, 0.13, 4);
  b.color(0x5a4a7a).cone(0.08, 0.1, 0, 0.05, 0.13, 4);
  for (const s of [-1, 1]) {
    b.push(); b.emis = 0.8;
    b.color(0xffd84a).sphere(s * 0.06, 0.03, 0.13, 0.03, 5, 4);
    b.pop();
  }
  b.color(0xffffff).cone(-0.03, -0.06, 0.13, 0.015, -0.05, 3);
  b.color(0xffffff).cone(0.03, -0.06, 0.13, 0.015, -0.05, 3);
});
def('bat.wing', (b) => {
  b.color(0x6a5a8a).prism([[0, -0.07], [0.28, -0.12], [0.36, 0.04], [0.24, 0.0], [0.16, 0.08], [0, 0.07]], -0.01, 0.01);
});

def('knight', (b) => {
  // a sturdy beetle in a helmet
  b.color(0x3a6a8a).sphere(0, 0.36, -0.03, 0.29, 10, 8, { smooth: true, sy: 1.0, sz: 1.1 });
  b.color(0x2a4a6a).box(0, 0.36, -0.04, 0.02, 0.5, 0.62);
  b.color(0xd8c89a).sphere(0, 0.3, 0.14, 0.18, 8, 6, { smooth: true });
  b.color(0x8a96a8).sphere(0, 0.62, 0.08, 0.17, 10, 6, { smooth: true, sy: 0.75 });
  b.color(0xe04848).cone(0, 0.7, 0.04, 0.05, 0.22, 4);
  eyes(b, 0.07, 0.5, 0.22, 0.045, 0xd02020);
  for (const s of [-1, 1]) b.color(0x2a2a3a).sphere(s * 0.13, 0.06, 0, 0.08, 6, 4, { sy: 0.7 });
});
def('knight.shield', (b) => {
  b.color(0xc0a050).cylinder(0, -0.02, 0, 0.27, 0.27, 0.05, 10, { rot: 0 });
  b.push().rotateX(HALF_PI);
  b.color(0xc0a050).cylinder(0, -0.03, 0, 0.27, 0.27, 0.06, 10);
  b.color(0x8a6a2a).cylinder(0, 0.03, 0, 0.12, 0.08, 0.04, 8);
  b.pop();
});
def('knight.spear', (b) => {
  b.color(0x7a5a3a).box(0, 0.25, 0, 0.04, 0.9, 0.04);
  b.color(0xc8ccd4).cone(0, 0.7, 0, 0.06, 0.18, 4);
});

def('crab', (b) => {
  b.color(0xe0603a).sphere(0, 0.2, 0, 0.26, 10, 6, { smooth: true, sy: 0.6, sz: 0.8 });
  b.color(0xf08a5a).sphere(0, 0.25, 0, 0.18, 8, 5, { smooth: true, sy: 0.5, sz: 0.7 });
  for (const s of [-1, 1]) {
    b.color(0xe0603a).cylinder(s * 0.07, 0.24, 0.12, 0.02, 0.02, 0.14, 4);
    b.color(0xffffff).sphere(s * 0.07, 0.4, 0.12, 0.045, 6, 4, { smooth: true });
    b.color(0x1a1a22).sphere(s * 0.07, 0.4, 0.155, 0.022, 5, 4);
    for (let i = 0; i < 3; i++) {
      b.push().translate(s * 0.2, 0.08, -0.1 + i * 0.1).rotateZ(s * 0.9);
      b.color(0xc04a2a).box(0, 0, 0, 0.04, 0.2, 0.04);
      b.pop();
    }
  }
});
def('crab.claw', (b) => {
  b.color(0xe0603a).sphere(0, 0, 0.06, 0.1, 8, 5, { smooth: true, sz: 1.3 });
  b.color(0xf07a4a).cone(0.03, 0, 0.14, 0.04, 0.12, 4);
});

def('lurker', (b) => {
  b.color(0x3a8a8a).sphere(0, 0.15, 0, 0.3, 10, 7, { smooth: true, sz: 1.3, sy: 0.85 });
  b.color(0xe8e0b0).sphere(0, 0.08, 0.12, 0.2, 8, 6, { smooth: true, sz: 1.2, sy: 0.6 });
  b.color(0x2a6a6a).prism([[0, -0.2], [0.04, -0.1], [0.03, 0.15], [0, 0.2], [-0.03, 0.15], [-0.04, -0.1]], 0.35, 0.5);
  eyes(b, 0.15, 0.25, 0.25, 0.07, 0x101010);
  b.color(0x1a2a2a).cylinder(0, 0.1, 0.36, 0.07, 0.07, 0.02, 8);
});
def('lurker.tail', (b) => {
  b.color(0x2a6a6a).prism([[0, 0], [0.18, -0.25], [0, -0.15], [-0.18, -0.25]], -0.02, 0.02);
});

def('ember', (b) => {
  b.color(0xff9a2a).sphere(0, 0.18, 0, 0.22, 10, 8, { smooth: true, sy: 1.1 });
  b.color(0xff6a1a).cone(0, 0.3, 0, 0.17, 0.35, 8, { smooth: true });
  b.color(0xffe08a).sphere(0, 0.12, 0.05, 0.14, 8, 6, { smooth: true });
  b.push(); b.emis = -0.9;
  for (const s of [-1, 1]) b.color(0x2a1408).sphere(s * 0.07, 0.22, 0.18, 0.035, 6, 4, { sy: 1.4 });
  b.color(0x2a1408).box(0, 0.11, 0.2, 0.08, 0.02, 0.01);
  b.pop();
});

def('skelly', (b) => {
  const bone = 0xeee8d8;
  b.color(bone).sphere(0, 0.62, 0, 0.19, 10, 8, { smooth: true, sz: 1.2 });
  for (const s of [-1, 1]) b.color(0x1a1a22).sphere(s * 0.08, 0.64, 0.17, 0.05, 6, 4);
  b.color(0x1a1a22).box(0, 0.54, 0.21, 0.12, 0.02, 0.01);
  b.color(bone).box(0, 0.32, 0, 0.05, 0.4, 0.05);
  for (let i = 0; i < 3; i++) b.color(bone).box(0, 0.42 - i * 0.09, 0.0, 0.3 - i * 0.05, 0.03, 0.16);
  b.color(bone).box(-0.07, 0.07, 0, 0.04, 0.14, 0.04);
  b.color(bone).box(0.07, 0.07, 0, 0.04, 0.14, 0.04);
  b.color(bone).prism([[0, -0.1], [0.12, -0.25], [-0.12, -0.25]], 0.25, 0.28);
});

def('roller', (b) => {
  b.color(0x6a6a7a).sphere(0, 0, 0, 0.3, 10, 8, { smooth: true });
  const n = 14;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), a = i * 2.4;
    const d = [Math.cos(a) * rr, y, Math.sin(a) * rr];
    b.push().translate(d[0] * 0.26, d[1] * 0.26, d[2] * 0.26);
    const yaw = Math.atan2(d[0], d[2]), pitch = Math.acos(d[1]);
    b.rotateY(yaw).rotateX(pitch);
    b.color(0xd8dce4).cone(0, 0, 0, 0.07, 0.22, 4);
    b.pop();
  }
  for (const s of [-1, 1]) {
    b.push(); b.emis = 0.6;
    b.color(0xff3a3a).sphere(s * 0.1, 0.06, 0.28, 0.04, 5, 4);
    b.pop();
  }
});

def('wisp', (b) => {
  b.color(0x6a5a9a).sphere(0, 0.1, 0, 0.27, 10, 8, { smooth: true, sy: 1.1 });
  b.color(0x6a5a9a).cone(0, -0.5, 0, 0.22, -0.0001, 8);
  b.push().translate(0, -0.15, 0).rotateX(Math.PI);
  b.color(0x5a4a8a).cone(0, 0, 0, 0.24, 0.45, 8, { smooth: true });
  b.pop();
  b.push(); b.emis = 1.2;
  for (const s of [-1, 1]) b.color(0xf8e8ff).sphere(s * 0.09, 0.14, 0.22, 0.05, 6, 4, { sy: 1.4 });
  b.pop();
});

def('seed', (b) => { b.color(0x8a6a3a).sphere(0, 0, 0, 0.11, 6, 5, { smooth: true, sy: 0.8 }); b.color(0x5cc65a).cone(0, 0.06, 0, 0.03, 0.08, 4); });
def('bubble', (b) => {
  b.push(); b.emis = 0.3;
  b.color(0xbfe8ff).sphere(0, 0, 0, 0.17, 10, 8, { smooth: true });
  b.color(0xffffff).sphere(-0.06, 0.07, 0.11, 0.035, 5, 4);
  b.pop();
});
def('bone', (b) => {
  const c = 0xeee8d8;
  b.color(c).box(0, 0, 0, 0.05, 0.05, 0.32);
  for (const s of [-1, 1]) for (const t of [-1, 1]) b.color(c).sphere(t * 0.035, 0, s * 0.16, 0.04, 5, 4);
});

// ---------------- island folk ----------------
// A small, configurable animal villager.
function critter(b, o) {
  const fur = o.fur, belly = o.belly ?? 0xfff1dc, cloth = o.cloth;
  // feet
  for (const s of [-1, 1]) b.color(o.feet ?? 0x5a3a2a).sphere(s * 0.1, 0.05, 0.02, 0.07, 6, 5, { smooth: true, sy: 0.7, sz: 1.3 });
  // body + clothes
  b.color(cloth).cylinder(0, 0.06, 0, 0.24 * (o.wide ?? 1), 0.18 * (o.wide ?? 1), 0.3, 10, { smooth: true });
  b.color(cloth).sphere(0, 0.36, 0, 0.19 * (o.wide ?? 1), 10, 8, { smooth: true });
  if (o.apron) b.color(o.apron).box(0, 0.24, 0.17 * (o.wide ?? 1), 0.24, 0.3, 0.03);
  // arms
  for (const s of [-1, 1]) b.color(fur).sphere(s * 0.22 * (o.wide ?? 1), 0.3, 0.03, 0.065, 6, 5, { smooth: true });
  // head
  const hy = 0.66, hr = o.headR ?? 0.21;
  b.color(fur).sphere(0, hy, 0, hr, 12, 9, { smooth: true });
  if (o.muzzle !== false) b.color(belly).sphere(0, hy - 0.05, hr * 0.75, 0.09, 8, 6, { smooth: true, sz: 0.9 });
  b.color(o.nose ?? 0x2a2026).sphere(0, hy - 0.02, hr * 0.75 + 0.08, 0.03, 6, 4);
  for (const s of [-1, 1]) {
    b.color(0x1a1a22).sphere(s * 0.08, hy + 0.04, hr * 0.8, 0.032, 6, 5, { smooth: true, sy: 1.3 });
    b.push(); b.emis = 1; b.color(0xffffff).sphere(s * 0.08 + 0.01, hy + 0.055, hr * 0.8 + 0.025, 0.01, 4, 3); b.pop();
  }
  if (o.blush) for (const s of [-1, 1]) b.color(0xff9aa8).sphere(s * 0.13, hy - 0.04, hr * 0.68, 0.035, 5, 4, { sz: 0.4 });
  // ears
  const ear = o.ears;
  for (const s of [-1, 1]) {
    if (ear === 'long') {
      b.push().translate(s * 0.08, hy + 0.15, -0.02).rotateZ(-s * 0.15);
      b.color(fur).sphere(0, 0.14, 0, 0.06, 8, 6, { smooth: true, sy: 3 });
      b.color(0xffc0c8).sphere(0, 0.14, 0.03, 0.035, 6, 4, { sy: 2.6, sz: 0.4 });
      b.pop();
    } else if (ear === 'round') {
      b.color(fur).sphere(s * 0.15, hy + 0.15, -0.02, 0.07, 8, 6, { smooth: true, sz: 0.6 });
      b.color(o.earIn ?? belly).sphere(s * 0.15, hy + 0.15, 0.015, 0.04, 6, 4, { sz: 0.4 });
    } else if (ear === 'pointy') {
      b.push().translate(s * 0.12, hy + 0.14, 0).rotateZ(-s * 0.3);
      b.color(fur).cone(0, 0, 0, 0.07, 0.15, 6);
      b.pop();
    }
  }
  if (o.mask) {
    // tanuki 狸 mask
    for (const s of [-1, 1]) b.color(o.mask).sphere(s * 0.08, hy + 0.03, hr * 0.72, 0.065, 6, 5, { sz: 0.45 });
  }
  if (o.tail === 'stripe') {
    for (let i = 0; i < 4; i++) b.color(i % 2 ? 0x3a2a22 : fur).sphere(0, 0.18 + i * 0.02, -0.24 - i * 0.07, 0.09 - i * 0.008, 7, 5, { smooth: true });
  } else if (o.tail === 'puff') {
    b.color(belly).sphere(0, 0.2, -0.22, 0.08, 7, 5, { smooth: true });
  }
}

const FOLK = {
  rabbit: { fur: 0xf4ece0, cloth: 0xe07a8a, ears: 'long', tail: 'puff', blush: true },
  bear: { fur: 0x9a6a44, cloth: 0x4a8a5a, ears: 'round', wide: 1.25, headR: 0.24, apron: 0xf0e8d8 },
  tanuki: { fur: 0x8a7058, cloth: 0x3e7ac0, ears: 'round', mask: 0x3a2a22, tail: 'stripe', apron: 0xf0e0b0, earIn: 0x3a2a22 },
  cat: { fur: 0x8a8a96, cloth: 0xd0a040, ears: 'pointy', blush: true },
  mouse: { fur: 0xc8b8a8, cloth: 0x8a5ac0, ears: 'round', headR: 0.18, earIn: 0xffc0c8 },
  hedgehog: { fur: 0xc89a6a, cloth: 0x5a7a3a, ears: 'round', muzzle: true },
  frog: { fur: 0x6ac45a, cloth: 0xe0a040, ears: null, muzzle: false, belly: 0xe8f0b0 },
  duck: { fur: 0xffffff, cloth: 0x4a86d0, ears: null, muzzle: false, nose: 0xf0a030 },
};
for (const [name, o] of Object.entries(FOLK)) def('npc.' + name, (b) => critter(b, o));

def('npc.turtle', (b) => {
  // Elder Moss, an old tortoise with a walking stick and a mossy shell
  const skin = 0x8ab07a;
  for (const s of [-1, 1]) b.color(skin).sphere(s * 0.14, 0.06, 0.04, 0.08, 6, 5, { smooth: true, sy: 0.7 });
  b.color(0x6a7a4a).sphere(0, 0.36, -0.08, 0.3, 10, 8, { smooth: true, sy: 0.9 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.color(0x5a6a3a).sphere(Math.sin(a) * 0.2, 0.4 + Math.cos(a) * 0.15, -0.2, 0.08, 6, 4, { sz: 0.5 });
  }
  b.color(0x6fae4c).sphere(0, 0.62, -0.12, 0.14, 6, 4, { jitter: 0.5, sy: 0.5 });
  b.color(0xe8d8a8).sphere(0, 0.3, 0.12, 0.2, 8, 6, { smooth: true, sz: 0.6 });
  b.color(skin).sphere(0, 0.62, 0.12, 0.17, 10, 8, { smooth: true });
  for (const s of [-1, 1]) {
    b.color(0x1a1a22).sphere(s * 0.07, 0.65, 0.27, 0.025, 5, 4);
    b.color(0xf0f0f0).sphere(s * 0.06, 0.7, 0.24, 0.04, 5, 3, { sy: 0.5 });
  }
  b.color(0xf0f0f0).cone(0, 0.42, 0.25, 0.06, 0.18, 6).color(0xf0f0f0);
  b.color(0x7a5236).box(0.27, 0.4, 0.15, 0.04, 0.8, 0.04);
  b.color(0x5cc65a).sphere(0.27, 0.82, 0.15, 0.05, 5, 4);
  b.color(skin).sphere(0.22, 0.38, 0.13, 0.06, 6, 4);
});

def('npc.owl', (b) => {
  // Hoot, the lighthouse keeper
  b.color(0x9a7a5a).sphere(0, 0.38, 0, 0.3, 10, 8, { smooth: true, sy: 1.15 });
  b.color(0xf0e0c0).sphere(0, 0.32, 0.12, 0.2, 8, 6, { smooth: true, sz: 0.6 });
  for (const s of [-1, 1]) {
    b.color(0xffffff).sphere(s * 0.1, 0.55, 0.2, 0.09, 8, 6, { smooth: true });
    b.color(0x1a1a22).sphere(s * 0.1, 0.55, 0.27, 0.045, 6, 4);
    b.color(0x9a7a5a).cone(s * 0.15, 0.68, 0, 0.06, 0.14, 4);
    b.color(0x8a6a4a).sphere(s * 0.27, 0.35, 0, 0.1, 6, 5, { sy: 1.8, sz: 0.6 });
  }
  b.color(0xf0a030).cone(0, 0.45, 0.27, 0.04, -0.08, 4);
  b.color(0x2a3a5a).cylinder(0, 0.7, 0, 0.2, 0.2, 0.05, 10);
  b.color(0x2a3a5a).cylinder(0, 0.74, 0, 0.14, 0.14, 0.1, 10);
  b.color(0xf0a030).box(0, 0.06, 0.08, 0.2, 0.06, 0.12);
});

def('npc.mole', (b) => critter(b, { fur: 0x5a4a5a, cloth: 0xd8a040, ears: null, nose: 0xff8aa0, headR: 0.2 }));

// hats and extras
def('hat.straw', (b) => {
  b.color(0xe8c870).cylinder(0, 0.83, 0, 0.3, 0.3, 0.03, 12);
  b.color(0xe8c870).cylinder(0, 0.85, 0, 0.15, 0.12, 0.12, 10);
  b.color(0xe04848).cylinder(0, 0.86, 0, 0.152, 0.152, 0.04, 10, { caps: false });
});
def('hat.chef', (b) => {
  b.color(0xffffff).cylinder(0, 0.82, 0, 0.14, 0.14, 0.1, 10);
  b.color(0xffffff).sphere(0, 0.98, 0, 0.17, 8, 6, { smooth: true, sy: 0.7 });
});
def('hat.flower', (b) => {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.color(0xffd84a).sphere(0.12 + Math.cos(a) * 0.05, 0.86, 0.05 + Math.sin(a) * 0.05, 0.035, 5, 4);
  }
  b.color(0xff8a3a).sphere(0.12, 0.86, 0.05, 0.03, 5, 4);
});
def('glasses', (b) => {
  for (const s of [-1, 1]) {
    b.push().translate(s * 0.08, 0.7, 0.2).rotateX(HALF_PI);
    b.color(0x2a2a2a).cylinder(0, 0, 0, 0.05, 0.05, 0.01, 10, { caps: false });
    b.pop();
  }
});

// ---------------- extra props ----------------
def('bramble', (b) => {
  const c = [0x6a3a5a, 0x7a4a6a, 0x5a2a4a];
  for (let i = 0; i < 7; i++) {
    const a = hash2(i, 1) * Math.PI * 2, r = hash2(i, 2) * 0.3;
    b.push().translate(Math.cos(a) * r, 0, Math.sin(a) * r).rotateZ((hash2(i, 3) - 0.5) * 1.2).rotateX((hash2(i, 4) - 0.5) * 1.2);
    b.color(c[i % 3]).cylinder(0, 0, 0, 0.05, 0.02, 0.8, 5);
    for (let k = 0; k < 4; k++) b.color(0xc8b0c0).cone(0.04, 0.15 + k * 0.17, 0, 0.02, 0.07, 3);
    b.pop();
  }
  b.color(0x4a2a3a).sphere(0, 0.2, 0, 0.32, 6, 4, { jitter: 0.5 });
});

def('stairs', (b) => {
  // steps going down into darkness
  b.color(0x0a0c0e).box(0, -0.6, 0, 0.9, 1.2, 0.9, { faces: { top: false } });
  for (let i = 0; i < 4; i++) b.color(hexLin(0x9a948a).map((x) => x * (1 - i * 0.22))).box(0, -0.1 - i * 0.15, -0.3 + i * 0.2, 0.86, 0.06, 0.24);
});
def('stairsUp', (b) => {
  for (let i = 0; i < 4; i++) b.color(0xb0aa9c).bevelBox(0, 0.08 + i * 0.16, 0.3 - i * 0.2, 0.9, 0.16 + i * 0.32, 0.22, 0.03);
});

def('lever.base', (b) => {
  b.color(0x8a8f96).bevelBox(0, 0.15, 0, 0.5, 0.3, 0.5, 0.05);
  b.push(); b.emis = 0.4; b.color(0xe04848).cylinder(0, 0.3, 0, 0.12, 0.12, 0.04, 8); b.pop();
});
def('lever.arm', (b) => {
  b.color(0x6a6f76).box(0, 0.25, 0, 0.05, 0.5, 0.05);
  b.color(0xe04848).sphere(0, 0.52, 0, 0.09, 8, 6, { smooth: true });
});
def('bridgeSeg', (b) => {
  const cols = [0xb8875a, 0xa87a4e, 0xc4956a];
  for (let k = 0; k < 4; k++) b.color(cols[k % 3]).box(-0.375 + k * 0.25, -0.04, 0, 0.22, 0.08, 1.0);
  b.color(0x7a5236).box(0, 0.0, -0.48, 1.0, 0.06, 0.05);
  b.color(0x7a5236).box(0, 0.0, 0.48, 1.0, 0.06, 0.05);
});
def('bridgePost', (b) => {
  b.color(0x7a5236).cylinder(0, -0.6, 0, 0.09, 0.08, 2.0, 6);
  b.color(0x8a8f96).sphere(0, 1.4, 0, 0.1, 6, 4);
});

def('eye.frame', (b) => {
  b.color(0x6e918c).cylinder(0, 0, -0.05, 0.3, 0.3, 0.1, 10, {});
  b.push().rotateX(HALF_PI);
  b.color(0x5a7a76).cylinder(0, -0.05, 0, 0.3, 0.3, 0.12, 10);
  b.pop();
});
def('eye.ball', (b) => {
  b.push().rotateX(HALF_PI);
  b.color(0xffffff).cylinder(0, 0.07, 0, 0.2, 0.2, 0.03, 10);
  b.color(0xd04848).cylinder(0, 0.1, 0, 0.1, 0.1, 0.01, 10);
  b.color(0x101010).cylinder(0, 0.11, 0, 0.05, 0.05, 0.01, 8);
  b.pop();
});

def('pedestal', (b) => {
  b.color(0x8fb0aa).cylinder(0, 0, 0, 0.45, 0.4, 0.2, 10);
  b.color(0x7f9f99).cylinder(0, 0.2, 0, 0.25, 0.3, 0.5, 10);
  b.color(0xd9b44a).cylinder(0, 0.7, 0, 0.36, 0.36, 0.06, 10);
});

def('portal', (b) => {
  b.push(); b.emis = 1.2;
  b.color(0x9ae6ff).cylinder(0, 0.01, 0, 0.45, 0.45, 0.02, 16);
  b.color(0xffffff).cylinder(0, 0.02, 0, 0.25, 0.25, 0.02, 16);
  b.pop();
});

def('signpost', (b) => builders.sign(b));

def('crate', (b) => {
  b.color(0xb08050).bevelBox(0, 0.32, 0, 0.64, 0.64, 0.64, 0.04);
  b.color(0x8a6038).box(0, 0.32, 0.325, 0.6, 0.06, 0.01);
  b.color(0x8a6038).box(0, 0.32, 0.325, 0.06, 0.6, 0.01);
});
def('barrel', (b) => {
  b.color(0xa8743e).cylinder(0, 0, 0, 0.28, 0.32, 0.35, 10, { smooth: true, caps: false });
  b.color(0xa8743e).cylinder(0, 0.35, 0, 0.32, 0.28, 0.35, 10, { smooth: true, topColor: 0x8a5a2a });
  b.color(0x5a5f66).cylinder(0, 0.15, 0, 0.3, 0.3, 0.04, 10, { caps: false });
  b.color(0x5a5f66).cylinder(0, 0.55, 0, 0.3, 0.3, 0.04, 10, { caps: false });
});
def('table', (b) => {
  b.color(0xb08050).bevelBox(0, 0.5, 0, 1.0, 0.08, 0.7, 0.02);
  for (const [x, z] of [[-0.42, -0.28], [0.42, -0.28], [-0.42, 0.28], [0.42, 0.28]]) b.color(0x8a6038).box(x, 0.25, z, 0.07, 0.5, 0.07);
  b.color(0xffffff).cylinder(0.2, 0.54, 0, 0.1, 0.08, 0.03, 8);
  b.color(0xe08a40).sphere(0.2, 0.6, 0, 0.06, 6, 4);
  b.color(0xd0e0f0).cylinder(-0.2, 0.54, 0.05, 0.05, 0.05, 0.12, 8);
});
def('bed', (b) => {
  b.color(0x8a6038).box(0, 0.2, 0, 0.9, 0.4, 1.8);
  b.color(0xf0f0f0).box(0, 0.42, -0.6, 0.7, 0.12, 0.4);
  b.color(0x4a86d0).box(0, 0.42, 0.25, 0.88, 0.1, 1.2);
  b.color(0x8a6038).box(0, 0.5, -0.88, 0.9, 0.6, 0.06);
});
def('stove', (b) => {
  b.color(0x4a4f56).bevelBox(0, 0.4, 0, 0.8, 0.8, 0.6, 0.05);
  b.push(); b.emis = 1.0; b.color(0xff8a3a).box(0, 0.3, 0.3, 0.4, 0.2, 0.02); b.pop();
  b.color(0x4a4f56).box(0.2, 1.3, -0.1, 0.18, 1.2, 0.18);
});
def('plant', (b) => {
  b.color(0xc87a4a).cylinder(0, 0, 0, 0.16, 0.2, 0.26, 8);
  b.sway = 0.2;
  b.color(0x4fae4c).sphere(0, 0.42, 0, 0.22, 7, 5, { jitter: 0.4 });
});
def('lantern', (b) => {
  b.color(0x3a3d44).box(0, 0.02, 0, 0.3, 0.04, 0.3);
  b.push(); b.emis = 1.5; b.color(0xffd27a).box(0, 0.2, 0, 0.22, 0.3, 0.22); b.pop();
  b.color(0x3a3d44).cone(0, 0.35, 0, 0.22, 0.12, 4, { rot: Math.PI / 4 });
});
def('brazier', (b) => {
  b.color(0x8a8f96).cylinder(0, 0, 0, 0.35, 0.25, 0.2, 8);
  b.color(0x6a6f76).cylinder(0, 0.2, 0, 0.12, 0.12, 0.5, 8);
  b.color(0x8a8f96).cylinder(0, 0.7, 0, 0.18, 0.45, 0.25, 10, { caps: false });
  b.color(0x2a2a2a).disc(0, 0.9, 0, 0.42, 10);
});
def('mirror', (b) => {
  b.color(0xd9b44a).cylinder(0, 0, 0, 0.3, 0.3, 0.1, 10);
  b.color(0xd9b44a).box(0, 0.5, 0, 0.08, 0.9, 0.08);
});

def('luckyShell', (b) => {
  // a little spiral conch with a pearly sheen
  b.push(); b.emis = 0.25;
  for (let i = 0; i < 6; i++) {
    const t = i / 6, r = 0.16 * (1 - t * 0.75);
    b.color([0xffd0e0, 0xffe8f0, 0xe8d0ff][i % 3]).sphere(Math.cos(t * 9) * 0.05 * (1 - t), 0.02 + t * 0.26, Math.sin(t * 9) * 0.05 * (1 - t), r, 8, 6, { smooth: true, sy: 0.7 });
  }
  b.color(0xffe8f0).cone(0, 0.26, 0, 0.05, 0.12, 6);
  b.pop();
});

// ---------------- bosses ----------------
def('eel.head', (b) => {
  const skin = 0x2f7f86, belly = 0xd8e8b0, fin = 0xe0604a;
  b.color(skin).sphere(0, 0.1, 0, 0.5, 12, 9, { smooth: true, sz: 1.35, sy: 0.75 });
  b.color(skin).sphere(0, 0.16, 0.42, 0.32, 10, 8, { smooth: true, sz: 1.2, sy: 0.6 });
  b.color(belly).sphere(0, -0.06, 0.3, 0.34, 10, 6, { smooth: true, sz: 1.3, sy: 0.4 });
  // crest and whiskers
  for (let i = 0; i < 4; i++) b.color(fin).prism([[0, -0.1], [0.03, 0.05], [0, 0.18], [-0.03, 0.05]], 0.3 + i * 0.02, 0.7 - i * 0.08).color(fin);
  b.push().translate(0, 0.42, -0.15);
  for (let i = 0; i < 4; i++) { b.color(fin).cone(0, 0, -i * 0.16, 0.08, 0.32 - i * 0.05, 4); }
  b.pop();
  for (const s of [-1, 1]) {
    b.push(); b.emis = 1.2;
    b.color(0xfff27a).sphere(s * 0.26, 0.3, 0.38, 0.1, 8, 6, { smooth: true });
    b.pop();
    b.color(0x101010).sphere(s * 0.29, 0.3, 0.46, 0.045, 6, 4, { sy: 1.6 });
    b.push().translate(s * 0.22, 0.05, 0.75).rotateZ(-s * 1.2).rotateX(0.4);
    b.color(0xe8d0a0).cone(0, 0, 0, 0.025, 0.55, 4);
    b.pop();
    b.push().translate(s * 0.5, 0.05, 0).rotateZ(-s * 0.4);
    b.color(fin).prism([[0, -0.2], [0.25, -0.35], [0.3, 0.1], [0, 0.15]], -0.02, 0.02);
    b.pop();
  }
});
def('eel.jaw', (b) => {
  b.color(0xd8e8b0).sphere(0, -0.08, 0.32, 0.28, 10, 6, { smooth: true, sz: 1.25, sy: 0.35 });
  for (let i = 0; i < 5; i++) b.color(0xffffff).cone(-0.16 + i * 0.08, -0.04, 0.5 - Math.abs(i - 2) * 0.05, 0.03, 0.09, 3);
});
def('eel.seg', (b) => {
  b.color(0x2f7f86).sphere(0, 0, 0, 0.42, 10, 7, { smooth: true, sz: 1.15, sy: 0.8 });
  b.color(0xd8e8b0).sphere(0, -0.12, 0, 0.32, 8, 5, { smooth: true, sz: 1.1, sy: 0.5 });
  b.color(0xe0604a).prism([[0, -0.25], [0.04, 0], [0, 0.25], [-0.04, 0]], 0.25, 0.62);
  for (const s of [-1, 1]) b.color(0x3f9fa6).sphere(s * 0.3, 0.15, 0, 0.08, 5, 4);
});
def('eel.tail', (b) => {
  b.color(0x2f7f86).sphere(0, 0, 0.1, 0.32, 8, 6, { smooth: true, sz: 1.3, sy: 0.8 });
  b.color(0xe0604a).prism([[0, 0], [0.45, -0.7], [0, -0.45], [-0.45, -0.7]], -0.03, 0.03);
});

def('gloom', (b) => {
  // a hooded shadow with a ragged cloak and two lantern eyes
  const c = 0x2a2440, c2 = 0x3a3258;
  b.color(c).sphere(0, 0.3, 0, 0.62, 12, 9, { smooth: true, sy: 1.1, jitter: 0.12, seed: 3 });
  b.color(c2).sphere(0, 0.55, 0.12, 0.48, 10, 8, { smooth: true, sy: 0.9 });
  b.color(0x0a0812).sphere(0, 0.52, 0.32, 0.33, 10, 8, { smooth: true, sz: 0.6 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.push().translate(Math.cos(a) * 0.45, -0.15, Math.sin(a) * 0.45).rotateZ(Math.PI + Math.cos(a) * 0.3).rotateX(Math.sin(a) * 0.3);
    b.color(i % 2 ? c : c2).cone(0, 0, 0, 0.2, 0.6 + (i % 3) * 0.15, 5);
    b.pop();
  }
  for (const s of [-1, 1]) {
    b.push(); b.emis = 2;
    b.color(0xffd25a).sphere(s * 0.13, 0.56, 0.5, 0.07, 6, 5, { sy: 0.7 });
    b.pop();
    b.push().translate(s * 0.62, 0.25, 0.05).rotateZ(-s * 0.9);
    b.color(c).cone(0, 0, 0, 0.16, 0.55, 5);
    b.pop();
  }
});

def('greatLamp', (b) => {
  const brass = 0xc8a050, dark = 0x3a3d44;
  b.color(dark).cylinder(0, 0, 0, 0.62, 0.55, 0.3, 12);
  b.color(brass).cylinder(0, 0.3, 0, 0.3, 0.4, 0.45, 10);
  b.color(brass).cylinder(0, 0.75, 0, 0.5, 0.5, 0.06, 12);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.color(dark).box(Math.cos(a) * 0.46, 1.15, Math.sin(a) * 0.46, 0.05, 0.8, 0.05);
  }
  b.color(brass).cylinder(0, 1.55, 0, 0.5, 0.5, 0.06, 12);
  b.color(dark).cone(0, 1.6, 0, 0.55, 0.45, 12);
  b.push(); b.emis = 0.3; b.color(0xd8e8f0).cylinder(0, 0.8, 0, 0.42, 0.42, 0.74, 12, { caps: false }); b.pop();
});

FOLK.fox = { fur: 0xe07a3a, cloth: 0x9a5ac0, ears: 'pointy', apron: 0xf0e8d8, belly: 0xfff1dc, tail: 'puff' };
def('npc.fox', (b) => critter(b, FOLK.fox));
