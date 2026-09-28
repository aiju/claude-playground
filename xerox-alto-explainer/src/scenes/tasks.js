// 4b + 5a. Sixteen tasks. The PROM grid collapses into 16 priority lanes
// with the emulator at the bottom; then the lanes run as a timeline, one
// microcycle per heartbeat tick: devices raise wakeups, the priority encoder
// picks the winner, and the running task hands over when it says TASK.
// N6: "That emulator is task zero: the lowest of sixteen priorities."
// N7: "Each task has its own micro-PC. Devices raise wakeup lines, a priority
// encoder picks the winner, and the running task yields whenever it says
// TASK. Nothing is saved, so switching is free."
// Task numbers: the reset table in the 1979 listing (µcode L25). At reset
// each task starts at the microaddress equal to its number (HW79 p. 11).

import { clear, rect, frameRect, text, header, patternRect, titleTab } from '../lib/draw.js';
import { ramp, easeInOut, easeOut, easeBack, hash, blink } from '../lib/time.js';
import { promCell, TASKS, TASK_BY_NUMBER, taskCell, oct } from './common.js';
import { tickIndex } from '../audio/music.js';

const LANE_Y = 150, LANE_H = 34, PITCH = 40;
const laneY = (n) => LANE_Y + (15 - n) * PITCH; // task 17 (octal) at the top, 0 at the bottom
const PC_X = 150, PC_W = 46;
const BAR_X = 204, BAR_R = 470;
const CELL = 8; // one microcycle on the timeline
const RESET_TABLE = 'NOVEM,,,,KSEC,,,EREST,MRT,DWT,CURT,DHT,DVT,PART,KWDX,';

// The run of tasks on the timeline, in microcycles, once the handovers
// start. Each run ends with the task saying TASK. Wakeups: each task's flag
// goes up some cycles before it runs and comes down when it's served.
const RUNS = [
  ['EMU', 4], ['KWD', 2], ['DWT', 6], ['MRT', 3], ['EMU', 5], ['DWT', 6], ['EMU', 4],
  ['KWD', 2], ['EMU', 3], ['DWT', 6], ['MRT', 2], ['EMU', 7], ['DWT', 6], ['EMU', 8],
];

// Cycle-by-cycle schedule from the first tick at or after `from`.
function schedule(clock, from) {
  const first = clock.ticks.findIndex((x) => x >= from);
  const cycles = [];
  for (const [task, len] of RUNS) for (let i = 0; i < len; i++) cycles.push({ task, last: i === len - 1 });
  return { first, cycles };
}

export const tasks = {
  draw(ctx, t, T, shot, clock) {
    clear(ctx);
    const t0 = shot.start ?? shot.from;
    const collapse = easeInOut(ramp(t, t0 + 0.05, t0 + 0.9));
    const zero = T.at('N6', 'task');
    const sixteen = T.at('N6', 'sixteen');
    const micropc = T.at('N7', 'micropc');
    const devices = T.at('N7', 'devices');
    const encoder = T.at('N7', 'priority');
    const yields = T.at('N7', 'yields');
    const saved = T.at('N7', 'nothing');

    if (t < devices) header(ctx, 'SIXTEEN TASKS', t >= sixteen ? 'priority: 17 (octal) is highest' : 'one processor, sixteen program counters');
    else header(ctx, 'SIXTEEN TASKS', t >= saved ? 'a switch costs 0 cycles' : 'one cycle per tick');

    // The collapse: each PROM row slides to its lane and its cells merge.
    if (collapse < 1) {
      for (let a = 0; a < 1024; a++) {
        const c = promCell(a);
        const lane = 15 - Math.floor(a / 64);
        const y = c.y + (laneY(lane) + ((a >> 5) & 1) * 17 - c.y) * collapse;
        const x = c.x + (BAR_X + ((a % 32) / 32) * (BAR_R - BAR_X) - c.x) * collapse;
        const w = c.w + ((BAR_R - BAR_X) / 32 - c.w + 1) * collapse;
        if (a < 628) patternRect(ctx, x, y, w, c.h * (1 - collapse * 0.3), 'ink', 'dots');
        else frameRect(ctx, x, y, w, c.h * (1 - collapse * 0.3), 'ink', 1);
      }
      return;
    }

    // Lanes, numbered in octal as in the listing.
    const names = RESET_TABLE.split(',');
    for (let n = 0; n < 16; n++) {
      const y = laneY(n);
      const task = TASK_BY_NUMBER[n];
      frameRect(ctx, BAR_X, y, BAR_R - BAR_X, LANE_H, 'ink', 1);
      text(ctx, oct(n, 2), 30, y + 9, { size: 15, colour: n === 0 && t >= zero ? 'red' : 'ink' });
      // The names fall in from the reset table, lowest first.
      const nameAt = sixteen + n * 0.05;
      if (t >= nameAt && names[n]) {
        const spec = TASKS[task];
        text(ctx, names[n], 58, y + 10, { size: 13, colour: spec && spec.colour !== 'yellow' ? spec.colour : 'ink' });
        if (spec && spec.colour === 'yellow') rect(ctx, 58, y + 26, names[n].length * 8, 3, 'yellow');
      }
    }
    // Task zero fills with ink: your program. (Once the timeline runs, lane
    // 0 shows only the cycles the emulator actually got.)
    if (t >= zero && t < devices) {
      const k = easeOut(ramp(t, zero, zero + 0.5));
      const y = laneY(0);
      rect(ctx, BAR_X, y, (BAR_R - BAR_X) * k, LANE_H, 'ink');
      if (t < devices && k > 0.6) text(ctx, 'YOUR PROGRAM', (BAR_X + BAR_R) / 2, y + 9, { size: 15, colour: 'paper', align: 'center' });
    }
    // The priority arrow down the side (until the encoder takes its place).
    if (t >= sixteen && t < encoder) {
      const k = easeOut(ramp(t, sixteen, sixteen + 0.6));
      rect(ctx, 510, laneY(0) + LANE_H - (laneY(0) + LANE_H - LANE_Y) * k, 3, (laneY(0) + LANE_H - LANE_Y) * k, 'ink');
      if (k >= 1) text(ctx, '▲', 511, LANE_Y - 18, { size: 14, align: 'center' });
    }

    // Each task has its own micro-PC. At reset, task n starts at address n.
    if (t >= micropc - 0.2) {
      const tick = tickIndex(clock, t);
      const run = runningAt(t, clock, T);
      for (let n = 0; n < 16; n++) {
        const at = micropc - 0.2 + (15 - n) * 0.03;
        if (t < at) continue;
        const y = laneY(n);
        const running = run && TASKS[run.task].n === n;
        // A task's micro-PC moves only while it runs; the others hold.
        const pc = running ? (n * 37 + tick * 5 + Math.floor(hash(tick, n) * 3)) % 1024 : pcHeld(n, t, clock, T);
        rect(ctx, PC_X - 4, y + 3, PC_W, LANE_H - 6, running ? 'red' : 'paper');
        frameRect(ctx, PC_X - 4, y + 3, PC_W, LANE_H - 6, running ? 'red' : 'ink', 2);
        text(ctx, oct(pc, 4), PC_X + PC_W / 2 - 4, y + 10, { size: 13, align: 'center', colour: running ? 'paper' : 'ink' });
      }
      if (t < devices) text(ctx, 'µPC', PC_X + PC_W / 2 - 4, LANE_Y - 22, { size: 13, align: 'center' });
    }

    if (t < devices) return;
    // From here the lanes are a timeline: time runs right to left past the
    // "now" edge, one cell per heartbeat tick.
    const tick = tickIndex(clock, t);
    const { first, cycles } = schedule(clock, yields);
    for (let k = 0; ; k++) {
      const tk = tick - k;
      const x = BAR_R - (k + 1) * CELL;
      if (x < BAR_X) break;
      // Before the first handover (and before the timeline started) the
      // emulator had every cycle.
      const c = tk >= first ? cycles[tk - first] : { task: 'EMU', last: false };
      if (!c) continue;
      const y = laneY(TASKS[c.task].n);
      taskCell(ctx, x, y + 2, CELL, LANE_H - 4, c.task);
      if (c.last) rect(ctx, x + CELL - 2, y - 4, 2, LANE_H + 8, 'red');
      // The handover: straight down (or up) to the next task's lane, no gap.
      const next = tk + 1 >= first ? cycles[tk + 1 - first] : null;
      if (c.last && next && k > 0) {
        const y2 = laneY(TASKS[next.task].n);
        rect(ctx, x + CELL - 2, Math.min(y, y2) + LANE_H / 2, 2, Math.abs(y2 - y), 'red');
      }
    }
    // The "now" edge.
    frameRect(ctx, BAR_R, LANE_Y - 6, 2, 16 * PITCH + 4, 'red', 2);

    // Wakeup flags and the encoder.
    const flags = flagsAt(t, clock, T, first, cycles);
    const raise = T.at('N7', 'wakeup');
    for (const f of flags) {
      const spec = TASKS[f];
      const y = laneY(spec.n);
      const pop = easeBack(ramp(t, raise, raise + 0.25));
      if (pop <= 0) continue;
      rect(ctx, BAR_R + 8, y + 4, 3, LANE_H - 8, 'ink');
      taskCell(ctx, BAR_R + 11, y + 4, 14 * pop, 12, f);
    }
    if (t >= encoder) {
      const k = easeOut(ramp(t, encoder, encoder + 0.3));
      frameRect(ctx, 505, LANE_Y, 30 * k, 16 * PITCH - 6, 'ink', 2);
      if (k >= 1) [...'ENCODER'].forEach((ch, i) => text(ctx, ch, 520, LANE_Y + 6 * PITCH + i * 15, { size: 12, align: 'center' }));
      const top = flags.map((f) => TASKS[f].n).sort((a, b) => b - a)[0];
      if (top !== undefined && k >= 1) {
        const y = laneY(top) + LANE_H / 2;
        rect(ctx, 478, y - 1, 26, 3, 'red');
        text(ctx, '◀', 474, y - 8, { size: 14, colour: 'red' });
      }
    }
    // Nothing saved: every switch costs nothing.
    const run = runningAt(t, clock, T);
    if (t >= yields && run && run.switched && blink(t, run.at, 0.3) && t - run.at < 0.4) {
      rect(ctx, BAR_R - 150, laneY(TASKS[run.task].n) - 24, 110, 20, 'red');
      text(ctx, '0 cycles', BAR_R - 95, laneY(TASKS[run.task].n) - 22, { size: 14, colour: 'paper', align: 'center' });
    }
    if (t >= saved) {
      const k = easeOut(ramp(t, saved, saved + 0.3));
      titleTab(ctx, 'SWITCH: 0 CYCLES · NOTHING SAVED', 30, 820 + (1 - k) * 80, { size: 16, colour: 'red' });
    }
  },

  sounds(S, T, shot, clock) {
    const t0 = shot.start ?? shot.from;
    S.sweep(t0 + 0.05, { f0: 1600, f1: 200, dur: 0.85, gain: 0.03, wave: 'square', lp: 2500 });
    S.thunk(T.at('N6', 'task'), { gain: 0.4, freq: 50 });
    const sixteen = T.at('N6', 'sixteen');
    for (let n = 0; n < 16; n++) S.tick(sixteen + n * 0.05, { freq: 900 + n * 110, gain: 0.03, decay: 0.008, noise: 0.2 });
    const raise = T.at('N7', 'wakeup');
    ['disk', 'display', 'refresh'].forEach((name, i) => S.task(name, raise + i * 0.06, 0.05, 0.8));
    S.flip(T.at('N7', 'priority') + 0.3);
    // The timeline: each run plays its task's voice; a switch is a pitch jump.
    const devices = T.at('N7', 'devices');
    const yields = T.at('N7', 'yields');
    const { first, cycles } = schedule(clock, yields);
    const end = T.at('N8') - 0.4;
    S.task('emulator', devices, clock.ticks[first] - devices, 0.45);
    let i = 0;
    while (i < cycles.length) {
      let j = i;
      while (j + 1 < cycles.length && !cycles[j].last) j++;
      const a = clock.ticks[first + i], b = clock.ticks[first + j + 1];
      if (a === undefined || a >= end) break;
      S.task(TASKS[cycles[i].task].sound, a, Math.min(b, end) - a, 0.45);
      i = j + 1;
    }
  },
};

// Which task is running at time t on the timeline, and when its run began.
function runningAt(t, clock, T) {
  const devices = T.at('N7', 'devices');
  if (t < devices) return null;
  const yields = T.at('N7', 'yields');
  const { first, cycles } = schedule(clock, yields);
  const tk = tickIndex(clock, t);
  if (tk < first) return { task: 'EMU', at: devices, switched: false };
  let i = tk - first;
  if (i >= cycles.length) return null;
  const task = cycles[i].task;
  let s = i;
  while (s > 0 && !cycles[s - 1].last) s--;
  return { task, at: clock.ticks[first + s], switched: s > 0 || true };
}

// A held micro-PC: where the task stopped last time (or its reset address).
function pcHeld(n, t, clock, T) {
  const yields = T.at('N7', 'yields');
  const { first, cycles } = schedule(clock, yields);
  const tk = tickIndex(clock, t);
  for (let k = Math.min(tk, first + cycles.length - 1); k >= first; k--) {
    const c = cycles[k - first];
    if (TASKS[c.task].n === n) return (n * 37 + k * 5 + Math.floor(hash(k, n) * 3)) % 1024;
  }
  return n;
}

// Wakeup flags up at time t: before the handovers, the three raised on
// "wakeup"; after, each task's flag is up from a few cycles before its run
// until the run starts.
function flagsAt(t, clock, T, first, cycles) {
  const raise = T.at('N7', 'wakeup');
  if (t < raise) return [];
  const tk = tickIndex(clock, t);
  if (tk < first) return ['KWD', 'DWT', 'MRT'];
  const up = new Set();
  let i = 0;
  while (i < cycles.length) {
    let j = i;
    while (j + 1 < cycles.length && !cycles[j].last) j++;
    const task = cycles[i].task;
    const lead = task === 'EMU' ? 0 : 5;
    if (task !== 'EMU' && tk >= first + i - lead && tk < first + i) up.add(task);
    i = j + 1;
  }
  // The first three wakeups stay up until they're served.
  for (const task of ['KWD', 'DWT', 'MRT']) {
    const s = cycles.findIndex((c) => c.task === task);
    if (tk < first + s) up.add(task);
  }
  return [...up];
}
