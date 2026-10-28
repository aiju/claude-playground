// Particles: glowing sprites (sparkles, fire, magic) and little 3D debris
// (leaves, pot shards, rock chips) that bounce on the ground.

import { rand, hexLin } from './math.js';

export class Particles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  add(p) {
    p.age = 0;
    p.vx ??= 0; p.vy ??= 0; p.vz ??= 0;
    p.gravity ??= 0; p.drag ??= 0;
    p.size1 ??= p.size;
    p.alpha ??= 1;
    p.shape ??= 0;
    p.additive ??= true;
    p.spin ??= 0;
    p.rot ??= rand(0, 6.28);
    this.list.push(p);
    return p;
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.age += dt;
      if (p.age >= p.life) { l[i] = l[l.length - 1]; l.pop(); continue; }
      p.vy -= p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      if (p.mesh && p.y < (p.floor ?? 0)) {
        p.y = p.floor ?? 0;
        p.vy = -p.vy * 0.35; p.vx *= 0.6; p.vz *= 0.6; p.spin *= 0.5;
      }
    }
  }

  draw(r) {
    for (const p of this.list) {
      const t = p.age / p.life;
      const fade = p.fadeIn ? Math.min(1, p.age / p.fadeIn) : 1;
      if (p.mesh) {
        const s = p.size * (t > 0.75 ? (1 - t) / 0.25 : 1);
        r.push(); r.translate(p.x, p.y, p.z); r.rotY(p.rot); r.rotX(p.rot * 0.7); r.scale(s);
        r.draw(p.mesh, { shadow: false, tint: p.tint });
        r.pop();
        continue;
      }
      const size = p.size + (p.size1 - p.size) * t;
      let a = p.alpha * fade * (p.fadeOut === false ? 1 : 1 - t);
      const c = p.col1 ? [p.col[0] + (p.col1[0] - p.col[0]) * t, p.col[1] + (p.col1[1] - p.col[1]) * t, p.col[2] + (p.col1[2] - p.col[2]) * t] : p.col;
      r.sprite(p.x, p.y, p.z, size, c[0], c[1], c[2], a, p.shape, p.additive);
    }
  }

  // ---- presets ----
  puff(x, y, z, n = 8, col = [0.9, 0.9, 0.9], size = 0.5, speed = 1.5) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), s = rand(0.4, 1) * speed;
      this.add({ x, y: y + rand(0, 0.2), z, vx: Math.cos(a) * s, vy: rand(0.3, 1.2), vz: Math.sin(a) * s, drag: 3, life: rand(0.35, 0.6), size: size * rand(0.6, 1), size1: size * 1.6, col, alpha: 0.8, shape: 3, additive: false });
    }
  }
  sparks(x, y, z, n = 8, col = [1, 0.85, 0.4], speed = 4) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), s = rand(0.3, 1) * speed;
      this.add({ x, y, z, vx: Math.cos(a) * s, vy: rand(0.5, 3), vz: Math.sin(a) * s, gravity: 9, drag: 2, life: rand(0.2, 0.45), size: rand(0.08, 0.16), col, shape: 1 });
    }
  }
  twinkle(x, y, z, col = [1, 0.95, 0.6], size = 0.35, life = 0.6) {
    this.add({ x, y, z, vy: 0.4, life, size, size1: 0, col, shape: 2, fadeOut: false });
  }
  debris(x, y, z, mesh, n = 6, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), s = rand(0.5, 1) * (opts.speed ?? 2.5);
      this.add({ x, y: y + rand(0, 0.2), z, vx: Math.cos(a) * s, vy: rand(2, 4.5), vz: Math.sin(a) * s, gravity: 14, life: rand(0.6, 1.0), size: (opts.size ?? 1) * rand(0.6, 1.1), mesh, spin: rand(-12, 12), floor: opts.floor ?? 0.02, tint: opts.tint });
    }
  }
  leaves(x, y, z, mesh, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), s = rand(0.5, 2.2);
      this.add({ x, y: y + rand(0, 0.3), z, vx: Math.cos(a) * s, vy: rand(1.5, 3.5), vz: Math.sin(a) * s, gravity: 5, drag: 2.5, life: rand(0.7, 1.2), size: rand(0.7, 1.1), mesh, spin: rand(-8, 8), floor: 0.02 });
    }
  }
  splash(x, y, z, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), s = rand(0.5, 2);
      this.add({ x, y, z, vx: Math.cos(a) * s, vy: rand(2, 4.5), vz: Math.sin(a) * s, gravity: 12, life: rand(0.35, 0.6), size: rand(0.1, 0.18), col: [0.8, 0.95, 1], shape: 1, additive: false, alpha: 0.9 });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.28;
      this.add({ x: x + Math.cos(a) * 0.2, y: y + 0.05, z: z + Math.sin(a) * 0.2, vx: Math.cos(a) * 1.2, vz: Math.sin(a) * 1.2, drag: 3, life: 0.5, size: 0.3, size1: 0.6, col: [0.9, 1, 1], shape: 3, additive: false, alpha: 0.6 });
    }
  }
  fire(x, y, z, scale = 1, dt = 1 / 60) {
    if (Math.random() < 0.6) {
      this.add({ x: x + rand(-0.06, 0.06) * scale, y, z: z + rand(-0.06, 0.06) * scale, vy: rand(0.8, 1.6) * scale, vx: rand(-0.2, 0.2), vz: rand(-0.2, 0.2), life: rand(0.3, 0.55), size: 0.32 * scale, size1: 0.05, col: [1, 0.75, 0.25], col1: [1, 0.25, 0.05], shape: 0 });
    }
    if (Math.random() < 0.15) this.add({ x, y: y + 0.2 * scale, z, vy: 1.2, vx: rand(-0.3, 0.3), life: 0.7, size: 0.06, col: [1, 0.8, 0.3], shape: 1 });
  }
  ring(x, y, z, col = [1, 1, 1], n = 16, speed = 3, size = 0.18) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28;
      this.add({ x, y, z, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, drag: 3, life: 0.45, size, size1: 0.02, col, shape: 0 });
    }
  }
}
