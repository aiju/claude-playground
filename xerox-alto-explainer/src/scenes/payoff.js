// 8. Payoff. Switch the display off and task 0 gets its cycles back; then
// the whole PROM by task, the display's 63 words, and the title.
// N15: "Switch the screen off, and programs run almost three times faster."
// N16: "All four display tasks together? Sixty-three microinstructions. Your
// program? Task zero. It gets whatever's left."
// Mandelbrot times: Ken Shirriff's restored Alto (righto.com), 24 min with
// the display on, 9 off. PROM counts: micromachine notes §3.1.

import { clear, rect, frameRect, text, header, ditherRect, titleTab, SANS } from '../lib/draw.js';
import { ramp, easeOut, easeBack, blink } from '../lib/time.js';
import { SCANLINE, TASKS, taskCell, altoScreen, COOKIE, promGrid, promCell, PROM, mouseBars } from './common.js';

const MINI = { cols: 16, cell: 20, gap: 2 };
const miniX = (540 - MINI.cols * (MINI.cell + MINI.gap)) / 2;
const DISPLAY_TASKS = new Set(['DWT', 'DHT', 'DVT', 'CURT']);

function miniLine(ctx, y0, taskOf) {
  SCANLINE.forEach((task, i) => {
    const x = miniX + (i % MINI.cols) * (MINI.cell + MINI.gap);
    const y = y0 + Math.floor(i / MINI.cols) * (MINI.cell + MINI.gap);
    taskCell(ctx, x, y, MINI.cell, MINI.cell, taskOf(task));
  });
}

export const screenOff = {
  draw(ctx, t, T) {
    clear(ctx);
    header(ctx, 'DISPLAY OFF', 'Mandelbrot on a restored Alto');
    const off = T.at('N15', 'off');
    const programs = T.at('N15', 'programs');
    const faster = T.at('N15', 'faster');
    // The Alto's screen collapsing to a line, then a dot, like a CRT.
    const c = ramp(t, off, off + 0.35);
    if (c < 1) {
      const h = 96 * (1 - Math.min(1, c * 1.6));
      const w = 72 * (c > 0.6 ? 1 - (c - 0.6) / 0.4 : 1);
      rect(ctx, 419, 31, 82, 106, 'ink');
      rect(ctx, 460 - w / 2, 84 - Math.max(2, h) / 2, Math.max(2, w), Math.max(2, h), 'paper');
    } else rect(ctx, 419, 31, 82, 106, 'ink');

    // One scanline: at "off", every display cycle goes to task 0.
    miniLine(ctx, 150, (task) => (t >= off && DISPLAY_TASKS.has(task) ? 'EMU' : task));
    if (t >= off && t < off + 0.5 && blink(t, off, 0.16)) frameRect(ctx, miniX - 5, 145, 16 * 22 + 8, 14 * 22 + 8, 'red', 3);
    if (t >= off) text(ctx, 'every display cycle → your program', 270, 470, { size: 15, align: 'center' });

    // The race: the same program, with and without the display.
    const bars = [
      { label: 'display on', mins: 24, y: 560 },
      { label: 'display off', mins: 9, y: 660 },
    ];
    if (t >= programs - 0.3) {
      const run = Math.max(0, t - programs);
      const offDone = faster - programs; // the off run finishes on "faster"
      bars.forEach((b) => {
        const k = Math.min(1, run / (offDone * (b.mins / 9)));
        text(ctx, b.label, 40, b.y - 24, { size: 16 });
        frameRect(ctx, 40, b.y, 460, 40, 'ink', 2);
        rect(ctx, 44, b.y + 4, 452 * k, 32, b.mins === 9 ? 'red' : 'ink');
        text(ctx, k >= 1 ? `${b.mins} min` : `${Math.round(b.mins * k)} min`, 500, b.y - 24, { size: 16, align: 'right' });
      });
    }
    if (t >= T.at('N15', 'three')) {
      const k = easeBack(ramp(t, T.at('N15', 'three'), T.at('N15', 'three') + 0.3));
      text(ctx, '24 ÷ 9 ≈ 2.7× faster', 270, 740, { size: 26 * k + 1, align: 'center', colour: 'red' });
      text(ctx, "Ken Shirriff's restored Alto, righto.com", 270, 790, { size: 12, align: 'center', weight: 'normal' });
    }
  },

  sounds(S, T) {
    const off = T.at('N15', 'off');
    S.sweep(off, { f0: 2400, f1: 60, dur: 0.35, gain: 0.05, wave: 'sine' });
    S.thunk(off + 0.05, { gain: 0.35, freq: 45 });
    const programs = T.at('N15', 'programs'), faster = T.at('N15', 'faster');
    for (let i = 0; i < 9; i++) S.tick(programs + (i / 9) * (faster - programs), { freq: 1800, gain: 0.03, decay: 0.006 });
    S.bell(faster, { freq: 1760, gain: 0.05, dur: 1.4 });
  },
};

// The PROM by task, in address blocks (the real code interleaves; the counts
// are from the listing).
const BLOCKS = [['EMU', 628], ['KSEC', 80], ['KWD', 65], ['ETH', 95], ['MRT', 73], ['PART', 17], ['DHT', 29], ['DWT', 18], ['DVT', 14], ['CURT', 2]];
const OWNER = [];
for (const [k, n] of BLOCKS) for (let i = 0; i < n; i++) OWNER.push(k);

export const payoff = {
  draw(ctx, t, T, shot, clock) {
    clear(ctx);
    const t0 = shot.from;
    const disp = T.at('N16', 'display');
    const sixty = T.at('N16', 'sixtythree');
    const your = T.at('N16', 'your');
    const zero = T.at('N16', 'task');
    const left = T.at('N16', 'it');
    const title = clock.end;

    if (t >= title) return titleCard(ctx, t, title);
    if (t >= left) {
      // Hard cut: one scanline, the leftovers glowing.
      header(ctx, 'WHAT’S LEFT', 'task 0, every scanline');
      miniLine(ctx, 200, (task) => task);
      const r0 = Math.floor(SCANLINE.indexOf('EMU') / 16);
      if (blink(t, left, 0.5)) frameRect(ctx, miniX - 6, 200 + r0 * 22 - 6, 16 * 22 + 10, (14 - r0) * 22 + 10, 'red', 4);
      text(ctx, 'your program', 270, 540, { size: 30, align: 'center', font: SANS });
      return;
    }

    header(ctx, 'THE WHOLE PROM', '1,024 microinstructions by task');
    const shown = Math.floor(ramp(t, t0, t0 + 0.7) * 1024);
    const focus = t >= your ? 'emu' : t >= disp ? 'display' : null;
    promGrid(ctx, (a) => {
      if (a >= shown) return null;
      return OWNER[a] || 'dim';
    });
    // Dim everything but the task being talked about.
    if (focus) {
      for (let a = 0; a < 1024; a++) {
        const o = OWNER[a];
        const keep = focus === 'display' ? DISPLAY_TASKS.has(o) : o === 'EMU';
        if (keep) continue;
        const c = promCell(a);
        ditherRect(ctx, c.x, c.y, c.w, c.h, 'paper', 0.7);
      }
      if (focus === 'display' && blink(t, disp, 0.4)) {
        const first = OWNER.indexOf('DHT');
        const a = promCell(first), b = promCell(first + 62);
        frameRect(ctx, PROM.x - 4, a.y - 4, 488, b.y - a.y + b.h + 8, 'blue', 3);
      }
    }
    // Labels under the grid.
    const y = PROM.y + 500;
    if (t >= sixty && t < your) {
      const k = easeBack(ramp(t, sixty, sixty + 0.3));
      rect(ctx, 270 - 200 * k, y, 400 * k, 60, 'blue');
      if (k > 0.9) {
        text(ctx, '63', 150, y + 8, { size: 40, colour: 'paper', align: 'center' });
        text(ctx, 'the whole display', 330, y + 10, { size: 17, colour: 'paper', align: 'center' });
        text(ctx, 'controller', 330, y + 32, { size: 17, colour: 'paper', align: 'center' });
      }
    } else if (t >= your) {
      const k = easeBack(ramp(t, your, your + 0.3));
      rect(ctx, 270 - 200 * k, y, 400 * k, 60, 'ink');
      if (k > 0.9) {
        text(ctx, '628', 150, y + 8, { size: 40, colour: 'paper', align: 'center' });
        text(ctx, t >= zero ? 'TASK 0' : 'your program', 330, y + 18, { size: 20, colour: 'paper', align: 'center' });
      }
    } else if (t >= t0 + 0.7) {
      // A compact key while the map is whole.
      [['EMU', 'your program 628'], ['KWD', 'disk 145'], ['ETH', 'Ethernet 95'], ['MRT', 'refresh 73'], ['DWT', 'display 63']].forEach(([k, s], i) => {
        const x = 40 + (i % 3) * 160, yy = y + Math.floor(i / 3) * 30;
        taskCell(ctx, x, yy, 18, 18, k);
        text(ctx, s, x + 26, yy + 1, { size: 13 });
      });
    }
  },

  sounds(S, T, shot, clock) {
    S.noise(shot.from, { dur: 0.7, gain: 0.04, fc: 600, fcEnd: 6000, q: 1.2 });
    const disp = T.at('N16', 'display');
    for (let i = 0; i < 4; i++) S.task('display', disp + i * 0.2, 0.08, 0.9);
    S.bell(T.at('N16', 'sixtythree'), { freq: 1318.51, gain: 0.04, dur: 1 });
    S.task('emulator', T.at('N16', 'your'), 1.2, 0.8);
    S.thunk(T.at('N16', 'task'), { gain: 0.35, freq: 50 });
    S.task('emulator', T.at('N16', 'it'), clock.end - T.at('N16', 'it'), 1);
    S.sweep(clock.end - 0.02, { f0: 300, f1: 1200, dur: 0.35, gain: 0.02, wave: 'sine' });
  },
};

function titleCard(ctx, t, t0) {
  const SX = 180, SY = 130, SW = 180, SH = 240;
  altoScreen(ctx, SX, SY, SW, SH, { bezel: 10 });
  const px = 3, cx = SX + (SW - 40 * px) / 2, cy = SY + 50;
  for (const [x, y] of COOKIE) rect(ctx, cx + x * px, cy + y * px, px, px, 'ink');
  const k = easeOut(ramp(t, t0, t0 + 0.4));
  text(ctx, 'TASK ZERO', 270, 430, { size: 56, align: 'center', font: SANS });
  if (k > 0.3) {
    text(ctx, 'inside the Xerox Alto’s', 270, 505, { size: 20, align: 'center', font: SANS, weight: 'normal' });
    text(ctx, 'one-processor computer', 270, 532, { size: 20, align: 'center', font: SANS, weight: 'normal' });
  }
  if (k > 0.6) mouseBars(ctx, 270, 600);
}
