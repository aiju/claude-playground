// Helpers for animating as a pure function of time: every frame is drawn from
// the clock alone, so the player can seek anywhere.

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);

// 0 before a, 1 after b, linear in between.
export const ramp = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));

export const lerp = (a, b, k) => a + (b - a) * k;
export const easeOut = (k) => 1 - (1 - k) ** 3;
export const easeIn = (k) => k ** 3;
export const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);

// Overshoots a little and settles: for things that land.
export const easeBack = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

// Snap a time to steps of `dt` (for things that should tick, not glide).
export const step = (t, dt) => Math.floor(t / dt) * dt;

// Deterministic hash noise in [0, 1) from integers.
export function hash(...n) {
  let h = 0x9e3779b9;
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

// On/off blinking with the given period, starting on at t0.
export const blink = (t, t0, period = 0.5) => t >= t0 && Math.floor((t - t0) / (period / 2)) % 2 === 0;
