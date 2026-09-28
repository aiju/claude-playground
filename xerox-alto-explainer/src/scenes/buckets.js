// 5b. Priority follows buffering. The disk has room for one word, so a word
// must be taken before the next arrives; the Ethernet has sixteen, so it
// can wait its turn.
// N8: "Priority follows buffering: the disk holds one word, so it outranks
// everything. The Ethernet holds sixteen, so it can wait."
// Rates: a disk word about every 10 µs; an Ethernet word every 5.44 µs
// (16 bits at 2.94 Mbit/s), into a 16-word FIFO (disk and Ethernet notes).

import { clear, rect, frameRect, text, header, titleTab } from '../lib/draw.js';
import { ramp, easeOut, easeBack, blink } from '../lib/time.js';

const DISK = { x: 70, w: 150, colour: 'red' };
const ETH = { x: 320, w: 150, colour: 'yellow' };
const FLOOR = 640;
const SLOT = 20; // one word in a bucket

// Arrival times of words (drips), from `from` on.
const drips = (from, to, every) => {
  const out = [];
  for (let t = from; t < to; t += every) out.push(t);
  return out;
};

export const buckets = {
  draw(ctx, t, T, shot) {
    clear(ctx);
    header(ctx, 'PRIORITY FOLLOWS BUFFERING', 'how long can a device wait?');
    const t0 = shot.from;
    const disk = T.at('N8', 'disk');
    const outranks = T.at('N8', 'outranks');
    const eth = T.at('N8', 'ethernet');
    const sixteen = T.at('N8', 'sixteen');
    const wait = T.at('N8', 'wait');

    // Disk: one slot, fed fast, emptied at once by the highest-priority task.
    const dIn = easeBack(ramp(t, disk - 0.2, disk + 0.2));
    if (dIn > 0) {
      const y0 = FLOOR - SLOT - 8;
      titleTab(ctx, 'DISK', DISK.x, 150, { size: 15, colour: 'red' });
      text(ctx, 'a word every ~10 µs', DISK.x, 180, { size: 13, weight: 'normal' });
      // Feeder pipe.
      rect(ctx, DISK.x + DISK.w / 2 - 6, 210, 3, y0 - 214, 'ink');
      rect(ctx, DISK.x + DISK.w / 2 + 4, 210, 3, y0 - 214, 'ink');
      frameRect(ctx, DISK.x, y0 - 4, DISK.w * dIn, SLOT + 12, 'ink', 3);
      for (const d of drips(disk + 0.2, T.at('N9') + 1, 0.55)) {
        const fall = ramp(t, d, d + 0.3);
        if (fall <= 0 || t > d + 0.5) continue;
        const y = 214 + (y0 - 214) * easeOut(fall);
        rect(ctx, DISK.x + DISK.w / 2 - 20, y, 40, SLOT - 4, 'red');
      }
      text(ctx, 'holds 1 word', DISK.x, FLOOR + 16, { size: 16 });
      text(ctx, 'task 16: top priority', DISK.x, FLOOR + 40, { size: 13, weight: 'normal' });
      // The lamp that would light if a word were missed.
      const lampOn = t >= outranks && blink(t, outranks, 0.4) && t < outranks + 1.2;
      rect(ctx, DISK.x + DISK.w + 8, y0, 14, 14, lampOn ? 'red' : 'paper');
      frameRect(ctx, DISK.x + DISK.w + 8, y0, 14, 14, 'red', 2);
      text(ctx, 'LATE', DISK.x + DISK.w + 8, y0 + 18, { size: 10, colour: 'red' });
    }
    if (t >= outranks) {
      const k = easeBack(ramp(t, outranks, outranks + 0.3));
      rect(ctx, DISK.x - 10, 300, (DISK.w + 20) * k, 40, 'red');
      if (k > 0.9) text(ctx, 'GOES FIRST', DISK.x + DISK.w / 2, 310, { size: 18, colour: 'paper', align: 'center' });
    }

    // Ethernet: sixteen slots, fills slowly, drained in a batch.
    const eIn = easeBack(ramp(t, eth - 0.2, eth + 0.2));
    if (eIn > 0) {
      titleTab(ctx, 'ETHERNET', ETH.x, 150, { size: 15 });
      rect(ctx, ETH.x, 172, 82, 3, 'yellow');
      text(ctx, 'a word every 5.44 µs', ETH.x, 180, { size: 13, weight: 'normal' });
      const top = FLOOR - 16 * SLOT - 8;
      rect(ctx, ETH.x + ETH.w / 2 - 6, 210, 3, top - 214, 'ink');
      rect(ctx, ETH.x + ETH.w / 2 + 4, 210, 3, top - 214, 'ink');
      frameRect(ctx, ETH.x, top - 4, ETH.w * eIn, 16 * SLOT + 12, 'ink', 3);
      const words = drips(eth + 0.15, T.at('N9') + 1, 0.16);
      let held = 0;
      for (const d of words) {
        if (t < d + 0.25) {
          const fall = ramp(t, d, d + 0.25);
          if (fall > 0) rect(ctx, ETH.x + ETH.w / 2 - 20, 214 + (top + (15 - held) * SLOT - 214) * fall, 40, SLOT - 4, 'yellow');
          break;
        }
        held++;
      }
      // Drained in a batch once it's had its turn.
      const drained = t >= wait + 0.4 ? Math.min(held, Math.floor((t - wait - 0.4) / 0.05)) : 0;
      held = Math.min(16, held);
      for (let i = drained; i < held; i++) {
        const y = FLOOR - 8 - (i + 1) * SLOT + (i - drained) * 0 ;
        rect(ctx, ETH.x + 8, y + 2, ETH.w - 16, SLOT - 4, 'yellow');
        frameRect(ctx, ETH.x + 8, y + 2, ETH.w - 16, SLOT - 4, 'ink', 1);
      }
      if (t >= sixteen) text(ctx, 'holds 16 words', ETH.x, FLOOR + 16, { size: 16 });
      if (t >= sixteen) text(ctx, 'task 7: can wait', ETH.x, FLOOR + 40, { size: 13, weight: 'normal' });
    }
  },

  sounds(S, T) {
    const disk = T.at('N8', 'disk');
    for (const d of drips(disk + 0.2, T.at('N9') - 0.4, 0.55)) S.task('disk', d + 0.3, 0.03, 0.9);
    S.bell(T.at('N8', 'outranks'), { freq: 1396.91, gain: 0.04, dur: 1 });
    const eth = T.at('N8', 'ethernet');
    for (const d of drips(eth + 0.15, T.at('N9') - 0.4, 0.16)) S.task('ethernet', d + 0.25, 0.04, 0.5);
    S.sweep(T.at('N8', 'wait') + 0.4, { f0: 900, f1: 300, dur: 0.6, gain: 0.04, wave: 'tri' });
  },
};
