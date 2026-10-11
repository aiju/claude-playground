// Sounds, synthesized with Web Audio: the rumble of the train in the tunnel,
// the whine of its motors when it pulls away or brakes, the wheels clicking
// over rail joints, and the beeps of the doors.
//
// Nothing here is recorded; it only has to suggest the real thing.

const JOINT = 18.29;            // 60 ft rails

function noiseBuffer(ctx, seconds, brown) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}

// a short burst of decaying noise, for the tunnel's echo
function impulse(ctx, seconds) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
  }
  return buf;
}

export function createSound(wheelXs) {
  let ctx = null, n = null;
  let lastJoint = null;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 1.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    verb.connect(wet).connect(master);
    const bus = ctx.createGain();
    bus.connect(master);
    bus.connect(verb);

    const loop = (buffer) => { const s = ctx.createBufferSource(); s.buffer = buffer; s.loop = true; s.start(); return s; };
    // rumble
    const rumbleF = ctx.createBiquadFilter();
    rumbleF.type = 'lowpass';
    const rumbleG = ctx.createGain();
    rumbleG.gain.value = 0;
    loop(noiseBuffer(ctx, 4, true)).connect(rumbleF).connect(rumbleG).connect(bus);
    // rush of air
    const airF = ctx.createBiquadFilter();
    airF.type = 'bandpass'; airF.Q.value = 0.6;
    const airG = ctx.createGain();
    airG.gain.value = 0;
    loop(noiseBuffer(ctx, 3, false)).connect(airF).connect(airG).connect(bus);
    // motors: two tones that rise with speed
    const motorG = ctx.createGain();
    motorG.gain.value = 0;
    const motorF = ctx.createBiquadFilter();
    motorF.type = 'bandpass'; motorF.Q.value = 2.5;
    motorF.connect(motorG).connect(bus);
    const oscs = [1, 2.02, 3.01].map((k, i) => {
      const o = ctx.createOscillator();
      o.type = i ? 'sine' : 'sawtooth';
      const g = ctx.createGain();
      g.gain.value = [0.5, 0.25, 0.12][i];
      o.connect(g).connect(motorF);
      o.start();
      return { o, k };
    });
    n = { master, bus, rumbleF, rumbleG, airF, airG, motorG, motorF, oscs };
  }

  function click(time, gain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.06, false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    src.connect(f).connect(g).connect(n.bus);
    src.start(time);
  }

  function beep(time, freq, len, gain = 0.12) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.005);
    g.gain.setValueAtTime(gain, time + len - 0.01);
    g.gain.linearRampToValueAtTime(0, time + len);
    o.connect(f).connect(g).connect(n.bus);
    o.start(time);
    o.stop(time + len + 0.02);
  }

  return {
    get on() { return !!ctx && ctx.state === 'running' && n.master.gain.value > 0; },
    async enable(on) {
      if (on && !ctx) build();
      if (!ctx) return;
      if (on) await ctx.resume();
      n.master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.1);
    },
    // speed in m/s, accel in m/s², listener: x of the camera along the train
    update({ speed, accel, distance, listener, tunnel }) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime, v = tunnel ? speed : 0;
      n.rumbleF.frequency.setTargetAtTime(90 + v * 22, t, 0.2);
      n.rumbleG.gain.setTargetAtTime(Math.min(v / 20, 1) * 0.55, t, 0.2);
      n.airF.frequency.setTargetAtTime(300 + v * 40, t, 0.2);
      n.airG.gain.setTargetAtTime(Math.min(v / 22, 1) ** 2 * 0.12, t, 0.2);
      const effort = v > 0.05 ? Math.min(Math.abs(accel) / 1.1, 1) : 0;
      const f0 = 35 + v * 62;
      for (const { o, k } of n.oscs) o.frequency.setTargetAtTime(f0 * k, t, 0.05);
      n.motorF.frequency.setTargetAtTime(f0 * 1.6, t, 0.05);
      n.motorG.gain.setTargetAtTime(effort * 0.16 + (v > 0.5 ? 0.015 : 0), t, 0.15);
      // wheels over rail joints, loudest near the listener
      if (lastJoint === null) lastJoint = wheelXs.map(x => Math.floor((x + distance) / JOINT));
      wheelXs.forEach((x, i) => {
        const j = Math.floor((x + distance) / JOINT);
        if (j !== lastJoint[i] && v > 0.3) {
          const near = 1 / (1 + ((x - listener) / 6) ** 2);
          if (near > 0.02) click(t + Math.random() * 0.005, Math.min(0.5, 0.15 + v * 0.02) * near);
        }
        lastJoint[i] = j;
      });
    },
    // the doors' warning before they close, and a chime as they open
    doors(opening) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.02;
      if (opening) { beep(t, 1320, 0.18, 0.08); beep(t + 0.2, 990, 0.3, 0.08); return; }
      for (let i = 0; i < 6; i++) beep(t + i * 0.26, 2350, 0.13);
    },
  };
}
