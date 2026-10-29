// Sound: every effect and tune is synthesized with WebAudio at runtime.
// Effects are little recipes of oscillators and filtered noise; music is a
// step sequencer playing note strings through a few simple instruments.

import { SONGS } from './music.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(n) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) return 0;
  let s = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (+m[3] + 1) * 12 + s;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// "A4.4 E5.2 -.2 C4+E4+G4.8": note(s).lengthInSteps
function parseTrack(str) {
  const ev = [];
  let step = 0;
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [n, l] = tok.split('.');
    const len = l ? +l : 2;
    if (n !== '-') ev.push({ step, len, freqs: n.split('+').map(noteFreq) });
    step += len;
  }
  return { ev, len: step };
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.current = null;
    this.wanted = null;
    this.duckT = 0;
    this.musicVol = 0.55;
    this.sfxVol = 0.75;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(comp);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol; this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
    // a soft hall reverb from decaying noise
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.32;
    this.reverb.connect(this.revGain); this.revGain.connect(this.master);
    this.musicRev = ctx.createGain(); this.musicRev.gain.value = 0.5; this.musicRev.connect(this.reverb);
    this.sfxRev = ctx.createGain(); this.sfxRev.gain.value = 0.25; this.sfxRev.connect(this.reverb);
    // white noise for drums and effects
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.timer = setInterval(() => this.schedule(), 25);
    if (this.wanted !== null) { const w = this.wanted; this.wanted = null; this.music(w); }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  // ---------------- music ----------------
  music(name) {
    if (!this.ctx) { this.wanted = name; return; }
    if (this.wanted === name && this.current) return;
    this.wanted = name;
    const ctx = this.ctx;
    if (this.current) {
      const g = this.current.gain;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      const old = g;
      setTimeout(() => old.disconnect(), 800);
      this.current = null;
    }
    if (!name) return;
    const song = SONGS[name];
    if (!song) return;
    if (!song.parsed) song.parsed = song.tracks.map((t) => ({ ...t, ...parseTrack(t.notes) }));
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
    gain.connect(this.musicBus);
    const rev = ctx.createGain(); rev.gain.value = song.reverb ?? 1; gain.connect(rev); rev.connect(this.musicRev);
    const stepDur = 60 / song.bpm / 4;
    this.current = { song, gain, step: 0, next: ctx.currentTime + 0.1, stepDur, total: Math.max(...song.parsed.map((t) => t.len)) };
  }

  schedule() {
    const c = this.current;
    if (!c || !this.ctx) return;
    const ctx = this.ctx;
    while (c.next < ctx.currentTime + 0.15) {
      if (c.step >= c.total) {
        if (c.song.loop === false) { this.current = null; return; }
        c.step = c.song.loopFrom ?? 0;
      }
      for (const tr of c.song.parsed) {
        const s = c.step % tr.len;
        for (const e of tr.ev) {
          if (e.step !== s) continue;
          for (const f of e.freqs) INST[tr.inst](this, c.next, f, e.len * c.stepDur, tr.vol ?? 0.5, c.gain);
        }
      }
      c.step++;
      c.next += c.stepDur;
    }
  }

  duck(seconds, level = 0.15) {
    if (!this.ctx) return;
    const g = this.musicBus.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.musicVol * level, t + 0.1);
    if (seconds < 50) g.linearRampToValueAtTime(this.musicVol * level, t + seconds), g.linearRampToValueAtTime(this.musicVol, t + seconds + 0.8);
  }
  unduck() {
    if (!this.ctx) return;
    const g = this.musicBus.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.musicVol, t + 0.3);
  }

  // ---------------- effects ----------------
  sfx(name, vol = 1) {
    if (!this.ctx || this.muted) return;
    const fn = SFX[name];
    if (!fn) return;
    // don't stack the same sound many times in one instant
    const now = this.ctx.currentTime;
    this.lastPlayed ||= {};
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < 0.03) return;
    this.lastPlayed[name] = now;
    fn(this, now, vol);
  }

  // building blocks
  env(t, a, d, peak, out, sustain = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
    g.connect(out);
    return g;
  }
  tone(t, type, f0, f1, dur, vol, out = this.sfxBus, attack = 0.004, rev = false) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.env(t, attack, dur, vol, out);
    if (rev) g.connect(this.sfxRev);
    o.connect(g);
    o.start(t); o.stop(t + attack + dur + 0.05);
    return o;
  }
  noise(t, dur, vol, ftype, f0, f1, q = 1, out = this.sfxBus, attack = 0.003, rev = false) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.env(t, attack, dur, vol, out);
    if (rev) g.connect(this.sfxRev);
    s.connect(f); f.connect(g);
    s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
  }
  notes(t, list, type, step, vol, len = 0.25, rev = true) {
    list.forEach((n, i) => { if (n) this.tone(t + i * step, type, noteFreq(n), 0, len, vol, this.sfxBus, 0.005, rev); });
  }
}

// ---------------- instruments ----------------
const INST = {
  lead(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.type = 'square'; o2.type = 'triangle';
    o.frequency.value = f; o2.frequency.value = f;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 5.2; lg.gain.value = f * 0.006;
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = Math.min(4000, f * 5);
    const g = ctx.createGain();
    const d = Math.max(0.08, dur * 0.95);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.16, t + 0.02);
    g.gain.setValueAtTime(vol * 0.16, t + d * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
    const m = ctx.createGain(); m.gain.value = 0.5;
    o.connect(m); m.connect(filt); o2.connect(filt); filt.connect(g); g.connect(out);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + d + 0.1); }
  },
  flute(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 4.8; lg.gain.value = f * 0.008;
    lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain();
    const d = Math.max(0.1, dur * 0.95);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.05);
    g.gain.setValueAtTime(vol * 0.27, t + d * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
    const g2 = ctx.createGain(); g2.gain.value = 0.08;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + d + 0.15); }
    a.noise(t, 0.08, vol * 0.04, 'bandpass', f * 2, f * 2, 3, out);
  },
  pluck(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 2;
    filt.frequency.setValueAtTime(f * 7, t); filt.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.25);
    const g = a.env(t, 0.003, Math.min(0.9, dur + 0.2), vol * 0.16, out);
    o.connect(filt); filt.connect(g);
    o.start(t); o.stop(t + Math.min(1, dur + 0.3));
  },
  marimba(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4;
    const g = a.env(t, 0.002, 0.5, vol * 0.4, out);
    const g2 = a.env(t, 0.002, 0.08, vol * 0.12, out);
    o.connect(g); o2.connect(g2);
    o.start(t); o2.start(t); o.stop(t + 0.6); o2.stop(t + 0.15);
  },
  bell(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 3.5;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.2);
    mod.connect(mg); mg.connect(car.frequency);
    const g = a.env(t, 0.003, 1.6, vol * 0.22, out);
    car.connect(g);
    car.start(t); mod.start(t); car.stop(t + 1.8); mod.stop(t + 1.8);
  },
  musicbox(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f * 2;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4.01;
    const g = a.env(t, 0.002, 1.1, vol * 0.2, out);
    const g2 = a.env(t, 0.002, 0.4, vol * 0.06, out);
    o.connect(g); o2.connect(g2);
    o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 0.5);
  },
  bass(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = f / 2;
    const g = ctx.createGain();
    const d = Math.max(0.08, dur * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vol * 0.25, t + d * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    o.connect(g); s.connect(g2); g2.connect(g); g.connect(out);
    o.start(t); s.start(t); o.stop(t + d + 0.1); s.stop(t + d + 0.1);
  },
  pad(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = Math.min(2400, f * 3); filt.Q.value = 0.5;
    const g = ctx.createGain();
    const d = Math.max(0.3, dur);
    const at = Math.min(0.6, d * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.08, t + at);
    g.gain.setValueAtTime(vol * 0.08, t + d * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5);
    filt.connect(g); g.connect(out);
    for (const det of [-7, 0, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(filt); o.start(t); o.stop(t + d + 0.6);
    }
  },
  organ(a, t, f, dur, vol, out) {
    const ctx = a.ctx;
    const g = ctx.createGain();
    const d = Math.max(0.1, dur * 0.95);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.09, t + 0.03);
    g.gain.setValueAtTime(vol * 0.09, t + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
    g.connect(out);
    for (const [m, w] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.2]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const og = ctx.createGain(); og.gain.value = w;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.2);
    }
  },
  kick(a, t, f, dur, vol, out) {
    const o = a.tone(t, 'sine', 140, 42, 0.18, vol * 0.9, out, 0.002);
  },
  snare(a, t, f, dur, vol, out) {
    a.noise(t, 0.14, vol * 0.35, 'highpass', 1500, 1500, 0.7, out);
    a.tone(t, 'triangle', 220, 160, 0.08, vol * 0.25, out, 0.002);
  },
  hat(a, t, f, dur, vol, out) { a.noise(t, 0.04, vol * 0.18, 'highpass', 7000, 7000, 1, out, 0.001); },
  shaker(a, t, f, dur, vol, out) { a.noise(t, 0.07, vol * 0.1, 'bandpass', 6000, 5000, 2, out, 0.02); },
  tom(a, t, f, dur, vol, out) { a.tone(t, 'sine', f || 120, (f || 120) * 0.6, 0.22, vol * 0.6, out, 0.002); },
};

// ---------------- effects ----------------
const SFX = {
  swing: (a, t, v) => a.noise(t, 0.12, 0.35 * v, 'bandpass', 800, 3200, 1.5),
  spin: (a, t, v) => { a.noise(t, 0.4, 0.4 * v, 'bandpass', 600, 4000, 1.2); a.tone(t, 'triangle', 300, 900, 0.35, 0.12 * v); },
  charged: (a, t, v) => a.notes(t, ['E6', 'B6'], 'sine', 0.07, 0.12 * v, 0.2),
  tink: (a, t, v) => { a.tone(t, 'square', 2100, 1900, 0.06, 0.08 * v); a.tone(t, 'sine', 3200, 3000, 0.12, 0.08 * v, a.sfxBus, 0.002, true); },
  hurt: (a, t, v) => { a.tone(t, 'square', 420, 140, 0.22, 0.16 * v); a.noise(t, 0.1, 0.2 * v, 'lowpass', 1200, 400); },
  die: (a, t, v) => a.notes(t, ['E5', 'C5', 'A4', 'F4', 'D4'], 'triangle', 0.14, 0.2 * v, 0.3),
  fall: (a, t, v) => a.tone(t, 'triangle', 700, 90, 0.7, 0.18 * v),
  splash: (a, t, v) => { a.noise(t, 0.45, 0.4 * v, 'lowpass', 3000, 400, 1); a.noise(t + 0.05, 0.3, 0.15 * v, 'highpass', 4000, 2000, 1); },
  splashSmall: (a, t, v) => a.noise(t, 0.25, 0.2 * v, 'lowpass', 2500, 500, 1),
  land: (a, t, v) => a.noise(t, 0.08, 0.2 * v, 'lowpass', 600, 200, 1),
  jump: (a, t, v) => a.tone(t, 'triangle', 300, 700, 0.15, 0.15 * v),
  lift: (a, t, v) => a.tone(t, 'triangle', 200, 400, 0.12, 0.12 * v),
  throw: (a, t, v) => a.noise(t, 0.15, 0.25 * v, 'bandpass', 1500, 500, 1.5),
  cut: (a, t, v) => { a.noise(t, 0.12, 0.3 * v, 'highpass', 2500, 1200, 1); a.noise(t + 0.03, 0.2, 0.15 * v, 'bandpass', 900, 700, 2); },
  grass: (a, t, v) => a.noise(t, 0.12, 0.22 * v, 'highpass', 3000, 2000, 1),
  rustle: (a, t, v) => a.noise(t, 0.15, 0.08 * v, 'bandpass', 3500, 2500, 2, a.sfxBus, 0.03),
  shatter: (a, t, v) => { for (let i = 0; i < 4; i++) a.tone(t + i * 0.025, 'square', 1800 + Math.random() * 1500, 900, 0.05, 0.05 * v); a.noise(t, 0.2, 0.25 * v, 'highpass', 3000, 1500, 1); },
  rockbreak: (a, t, v) => { a.noise(t, 0.4, 0.5 * v, 'lowpass', 1200, 150, 1); a.tone(t, 'sine', 90, 40, 0.3, 0.3 * v); },
  push: (a, t, v) => a.noise(t, 0.3, 0.2 * v, 'lowpass', 500, 300, 1, a.sfxBus, 0.05),
  thud: (a, t, v) => { a.tone(t, 'sine', 110, 45, 0.25, 0.35 * v); a.noise(t, 0.1, 0.2 * v, 'lowpass', 500, 200, 1); },
  chest: (a, t, v) => { a.tone(t, 'triangle', 180, 260, 0.2, 0.15 * v); a.notes(t + 0.15, ['C5', 'E5', 'G5'], 'triangle', 0.06, 0.1 * v, 0.2); },
  itemget: (a, t, v) => a.notes(t, ['G4', 'C5', 'E5', 'G5', 'C6'], 'square', 0.08, 0.07 * v, 0.35),
  fanfare: (a, t, v) => {
    // ta-da-da-DAAA
    const seq = [['C5', 0, 0.12], ['E5', 0.12, 0.12], ['G5', 0.24, 0.12], ['C6', 0.42, 0.9], ['G4+B4+D5', 1.5, 0.25], ['A4+C5+E5', 1.8, 0.25], ['B4+D5+F#5', 2.1, 0.3], ['C5+E5+G5+C6', 2.45, 1.2]];
    for (const [n, dt, d] of seq) for (const nn of n.split('+')) { INST.lead(a, t + dt, noteFreq(nn), d, 0.9 * v, a.sfxBus); INST.bell(a, t + dt, noteFreq(nn), d, 0.3 * v, a.sfxRev); }
    INST.bass(a, t + 2.45, noteFreq('C3'), 1.2, 0.8 * v, a.sfxBus);
  },
  secret: (a, t, v) => {
    // a little rising sparkle when a puzzle gives way
    ['G5', 'F#5', 'D#5', 'A4', 'G#4', 'E5', 'G#5', 'C6'].forEach((n, i) => INST.musicbox(a, t + i * 0.1, noteFreq(n) / 2, 0.3, 1.4 * v, a.sfxBus));
  },
  appear: (a, t, v) => { a.noise(t, 0.4, 0.2 * v, 'bandpass', 2000, 6000, 2); a.notes(t + 0.1, ['C6', 'G6'], 'sine', 0.1, 0.1 * v, 0.3); },
  unlock: (a, t, v) => { a.tone(t, 'square', 900, 1200, 0.05, 0.08 * v); a.tone(t + 0.08, 'square', 1200, 700, 0.08, 0.08 * v); a.noise(t + 0.12, 0.2, 0.2 * v, 'lowpass', 800, 300, 1); },
  shutterOpen: (a, t, v) => { a.noise(t, 0.35, 0.25 * v, 'bandpass', 400, 900, 2); a.tone(t, 'square', 90, 140, 0.3, 0.06 * v); },
  shutterClose: (a, t, v) => { a.noise(t, 0.25, 0.3 * v, 'bandpass', 900, 300, 2); a.tone(t + 0.2, 'sine', 100, 50, 0.2, 0.3 * v); },
  door: (a, t, v) => { a.noise(t, 0.2, 0.15 * v, 'lowpass', 900, 300, 1); a.tone(t, 'triangle', 220, 180, 0.15, 0.08 * v); },
  key: (a, t, v) => a.notes(t, ['A5', 'E6', 'A6'], 'square', 0.06, 0.06 * v, 0.2),
  heart: (a, t, v) => a.notes(t, ['C6', 'E6', 'G6', 'C7'], 'sine', 0.05, 0.13 * v, 0.15),
  shell: (a, t, v) => a.notes(t, ['E6', 'B6'], 'square', 0.05, 0.06 * v, 0.12),
  shellBig: (a, t, v) => a.notes(t, ['E6', 'G#6', 'B6', 'E7'], 'square', 0.04, 0.06 * v, 0.15),
  pickup: (a, t, v) => a.notes(t, ['G5', 'D6'], 'triangle', 0.06, 0.12 * v, 0.15),
  buy: (a, t, v) => a.notes(t, ['C6', 'E6', 'G6'], 'square', 0.05, 0.06 * v, 0.15),
  error: (a, t, v) => a.tone(t, 'square', 160, 120, 0.15, 0.08 * v),
  stun: (a, t, v) => a.tone(t, 'square', 1400, 400, 0.18, 0.06 * v),
  enemyHit: (a, t, v) => { a.tone(t, 'square', 600, 200, 0.1, 0.1 * v); a.noise(t, 0.08, 0.2 * v, 'bandpass', 1500, 600, 1.5); },
  enemyDie: (a, t, v) => { a.noise(t, 0.3, 0.3 * v, 'bandpass', 3000, 400, 1); a.tone(t, 'triangle', 800, 150, 0.25, 0.12 * v); },
  squish: (a, t, v) => a.tone(t, 'sine', 300, 120, 0.12, 0.12 * v),
  spit: (a, t, v) => { a.tone(t, 'square', 500, 250, 0.08, 0.07 * v); a.noise(t, 0.06, 0.15 * v, 'bandpass', 2000, 1000, 2); },
  bat: (a, t, v) => a.tone(t, 'square', 2400, 1800, 0.08, 0.04 * v),
  alert: (a, t, v) => a.notes(t, ['A5', 'A5'], 'square', 0.09, 0.06 * v, 0.06, false),
  bubble: (a, t, v) => { for (let i = 0; i < 3; i++) a.tone(t + i * 0.05, 'sine', 400 + i * 150, 900 + i * 200, 0.08, 0.1 * v); },
  roll: (a, t, v) => a.noise(t, 0.4, 0.2 * v, 'lowpass', 300, 800, 2),
  fireup: (a, t, v) => { a.noise(t, 0.4, 0.3 * v, 'bandpass', 500, 2500, 1); a.tone(t, 'sine', 120, 260, 0.3, 0.1 * v); },
  fizzle: (a, t, v) => a.noise(t, 0.35, 0.25 * v, 'highpass', 5000, 2000, 1),
  crystal: (a, t, v) => { INST.bell(a, t, noteFreq('E6'), 0.5, 1.2 * v, a.sfxBus); INST.bell(a, t + 0.08, noteFreq('B6'), 0.5, 0.8 * v, a.sfxBus); },
  plateDown: (a, t, v) => { a.tone(t, 'sine', 160, 90, 0.12, 0.25 * v); a.notes(t + 0.05, ['C5'], 'triangle', 0, 0.06 * v, 0.1); },
  plateUp: (a, t, v) => a.tone(t, 'sine', 90, 160, 0.1, 0.15 * v),
  lever: (a, t, v) => { a.tone(t, 'square', 200, 120, 0.15, 0.1 * v); a.noise(t + 0.1, 0.4, 0.2 * v, 'lowpass', 400, 200, 2); },
  freeze: (a, t, v) => { for (let i = 0; i < 5; i++) a.tone(t + i * 0.03, 'sine', 2000 + i * 400, 3000 + i * 300, 0.12, 0.05 * v, a.sfxBus, 0.002, true); },
  melt: (a, t, v) => a.noise(t, 0.3, 0.12 * v, 'bandpass', 1200, 400, 2),
  iceSlide: (a, t, v) => a.noise(t, 0.35, 0.2 * v, 'bandpass', 2500, 1500, 3),
  iceBreak: (a, t, v) => { for (let i = 0; i < 6; i++) a.tone(t + i * 0.02, 'square', 2500 + Math.random() * 2000, 1500, 0.06, 0.04 * v); a.noise(t, 0.3, 0.3 * v, 'highpass', 3000, 1500, 1); },
  frost: (a, t, v) => { a.noise(t, 0.3, 0.2 * v, 'bandpass', 4000, 8000, 3); a.tone(t, 'sine', 1200, 2400, 0.25, 0.06 * v, a.sfxBus, 0.005, true); },
  frostHit: (a, t, v) => a.notes(t, ['E7', 'B6'], 'sine', 0.04, 0.06 * v, 0.2),
  arrow: (a, t, v) => { a.tone(t, 'triangle', 180, 90, 0.1, 0.2 * v); a.noise(t, 0.15, 0.15 * v, 'bandpass', 2500, 1200, 2); },
  thunk: (a, t, v) => a.tone(t, 'sine', 300, 150, 0.08, 0.2 * v),
  reflect: (a, t, v) => a.tone(t, 'square', 800, 1600, 0.1, 0.08 * v),
  whirr: (a, t, v) => a.noise(t, 0.1, 0.12 * v, 'bandpass', 1800, 1200, 4),
  catch: (a, t, v) => a.tone(t, 'triangle', 500, 700, 0.06, 0.1 * v),
  bombPlace: (a, t, v) => { a.tone(t, 'sine', 180, 120, 0.1, 0.2 * v); a.noise(t + 0.05, 0.6, 0.06 * v, 'highpass', 6000, 5000, 1); },
  explode: (a, t, v) => {
    a.noise(t, 0.9, 0.9 * v, 'lowpass', 2400, 80, 0.8, a.sfxBus, 0.002, true);
    a.tone(t, 'sine', 120, 30, 0.5, 0.6 * v);
  },
  blip: (a, t, v) => a.tone(t, 'square', 880 + Math.random() * 60, 0, 0.025, 0.035 * v),
  talk: (a, t, v) => a.notes(t, ['A5', 'D6'], 'triangle', 0.05, 0.06 * v, 0.08, false),
  menuMove: (a, t, v) => a.tone(t, 'square', 700, 0, 0.04, 0.05 * v),
  menuSelect: (a, t, v) => a.notes(t, ['E6', 'A6'], 'square', 0.05, 0.05 * v, 0.1, false),
  menuOpen: (a, t, v) => a.notes(t, ['C5', 'G5', 'C6'], 'triangle', 0.04, 0.1 * v, 0.12),
  menuClose: (a, t, v) => a.notes(t, ['C6', 'G5', 'C5'], 'triangle', 0.04, 0.1 * v, 0.12),
  fairy: (a, t, v) => ['C6', 'E6', 'G6', 'B6', 'D7', 'B6', 'G6', 'E6', 'C7'].forEach((n, i) => INST.musicbox(a, t + i * 0.07, noteFreq(n) / 2, 0.3, 1.2 * v, a.sfxBus)),
  portal: (a, t, v) => { a.noise(t, 0.6, 0.2 * v, 'bandpass', 500, 4000, 3); a.notes(t, ['C5', 'G5', 'C6', 'G6'], 'sine', 0.08, 0.1 * v, 0.3); },
  bossRoar: (a, t, v) => {
    a.noise(t, 1.1, 0.6 * v, 'lowpass', 900, 200, 3, a.sfxBus, 0.08, true);
    a.tone(t, 'sawtooth', 90, 55, 1.0, 0.18 * v, a.sfxBus, 0.08);
    a.tone(t, 'sawtooth', 93, 57, 1.0, 0.18 * v, a.sfxBus, 0.08);
  },
  bossHurt: (a, t, v) => { a.tone(t, 'sawtooth', 300, 120, 0.3, 0.15 * v); a.noise(t, 0.2, 0.3 * v, 'bandpass', 1500, 500, 2); },
  bossDie: (a, t, v) => { a.tone(t, 'sawtooth', 200, 30, 2.5, 0.2 * v, a.sfxBus, 0.05, true); a.noise(t, 2.5, 0.4 * v, 'lowpass', 2000, 100, 1, a.sfxBus, 0.05, true); },
  gloomOrbs: (a, t, v) => { a.tone(t, 'sine', 300, 120, 0.5, 0.15 * v, a.sfxBus, 0.02, true); a.noise(t, 0.5, 0.15 * v, 'bandpass', 600, 300, 3); },
  swoosh: (a, t, v) => a.noise(t, 0.5, 0.35 * v, 'bandpass', 300, 1500, 2),
  summon: (a, t, v) => a.notes(t, ['C4', 'F#4', 'C5'], 'sawtooth', 0.1, 0.06 * v, 0.4),
  gust: (a, t, v) => a.noise(t, 1.0, 0.4 * v, 'bandpass', 400, 1500, 1, a.sfxBus, 0.1, true),
  lampLight: (a, t, v) => {
    a.noise(t, 2.0, 0.3 * v, 'bandpass', 200, 3000, 1, a.sfxBus, 0.3, true);
    ['C5+E5+G5', 'D5+F5+A5', 'E5+G5+B5', 'C5+E5+G5+C6'].forEach((ch, i) => ch.split('+').forEach((n) => INST.pad(a, t + 0.4 + i * 0.5, noteFreq(n), 1.2, 1.5 * v, a.sfxBus)));
  },
};
