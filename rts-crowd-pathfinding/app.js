// Drawing and controls. All the thinking happens in sim.js.
(function () {
  'use strict';
  const Sim = window.Sim;
  const $ = (id) => document.getElementById(id);
  const canvas = $('floor'), ctx = canvas.getContext('2d');
  const stage = $('stage');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    pattern: 'headon', map: 'bridges', count: 140, speed: reduceMotion ? 0 : 1,
    trails: true, arrows: false, heat: false, seed: 11,
    selected: null, hover: null,
  };

  let world = null;
  let cell = 16;            // CSS px per grid cell
  let dpr = 1;
  let T = null;             // theme colours
  let wallLayer = null, wallKey = '';
  let TR = null;            // worn-path field
  const rgbCache = new Map();
  const probe = document.createElement('canvas').getContext('2d');
  const fx = [];            // pop rings

  // ------------------------------------------------------------- theming
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    T = {
      floor: v('--floor'), dot: v('--floor-dot'), wall: v('--wall'), edge: v('--wall-edge'),
      shade: v('--wall-shade'), ink: v('--ink'), muted: v('--muted'), accent: v('--accent'),
      accentInk: v('--accent-ink'), go: v('--go'), hold: v('--hold'), stop: v('--stop'),
      eye: v('--eye'), pupil: v('--pupil'), sign: v('--sign-bg'), signInk: v('--sign-ink'),
      team: [0, 1, 2, 3, 4, 5].map((i) => v('--t' + i)),
      dark: cs.colorScheme.includes('dark'),
      display: v('--font-display'),
    };
    T.key = T.floor + T.wall;
    wallKey = '';
    if (world) for (const a of world.agents) a.col = null;
    clearTrails();
  }

  function colourOf(a) {
    if (a.col) return a.col;
    const L = T.dark ? 66 : 50;
    if (world.patternId === 'circle') a.col = `hsl(${Math.round(a.hue * 360)} 72% ${L}%)`;
    else if (world.patternId === 'rally') a.col = `hsl(${Math.round(150 + a.hue * 70)} 62% ${L - 6}%)`;
    else a.col = T.team[a.team % T.team.length];
    return a.col;
  }

  // -------------------------------------------------------------- layout
  function chooseGrid() {
    const r = stage.getBoundingClientRect();
    const cs = getComputedStyle(stage);
    const w = Math.max(200, r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    const h = Math.max(200, r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    const c = Math.sqrt(w * h / 1850);
    let gw = Math.round(w / c), gh = Math.round(h / c);
    const clampLong = (n) => Math.max(40, Math.min(66, n)), clampShort = (n) => Math.max(26, Math.min(40, n));
    if (gw >= gh) { gw = clampLong(gw); gh = clampShort(gh); } else { gh = clampLong(gh); gw = clampShort(gw); }
    return [gw, gh];
  }

  function fit() {
    const r = stage.getBoundingClientRect();
    const cs = getComputedStyle(stage);
    const w = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    cell = Math.max(4, Math.floor(Math.min(w / world.W, h / world.H) * 4) / 4);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(world.W * cell), ch = Math.round(world.H * cell);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    wallKey = '';
    if (!TR || TR.w !== world.W * TR.res || TR.h !== world.H * TR.res) {
      const res = 4, w = world.W * res, h = world.H * res, cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      const g = cvs.getContext('2d');
      TR = { res, w, h, cvs, g, img: g.createImageData(w, h),
        r: new Float32Array(w * h), gg: new Float32Array(w * h), b: new Float32Array(w * h), a: new Float32Array(w * h) };
    }
  }

  function clearTrails() {
    if (!TR) return;
    TR.r.fill(0); TR.gg.fill(0); TR.b.fill(0); TR.a.fill(0);
  }

  function rgbOf(col) {
    let v = rgbCache.get(col);
    if (!v) {
      probe.fillStyle = '#000'; probe.fillStyle = col;
      const h = probe.fillStyle;
      v = /^#[0-9a-f]{6}$/i.test(h) ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : [128, 128, 128];
      rgbCache.set(col, v);
    }
    return v;
  }

  // --------------------------------------------------------------- world
  function build() {
    const [gw, gh] = chooseGrid();
    world = new Sim.World(gw, gh, 5);
    world.opts.signals = $('opt-signals').checked;
    world.opts.reroute = $('opt-reroute').checked;
    world.setWalls(Sim.buildMap(state.map, gw, gh, state.seed));
    world.setPattern(state.pattern, state.count);
    state.selected = null;
    fit();
    // Warm up so that the very first frame already shows traffic.
    for (let i = 0; i < 150; i++) world.step(1 / 60);
    world.events.length = 0;
  }

  function loadMap(id) {
    if (id === state.map) state.seed = (state.seed * 7 + 3) % 9973;
    state.map = id;
    world.setWalls(Sim.buildMap(id, world.W, world.H, state.seed));
    restart();
  }

  function restart() {
    world.setPattern(state.pattern, state.count);
    state.selected = null;
    fx.length = 0;
    clearTrails();
  }

  // ------------------------------------------------------------- drawing
  function drawWallLayer() {
    const key = world.wallVersion + ':' + canvas.width + ':' + T.key;
    if (key === wallKey) return;
    wallKey = key;
    if (!wallLayer) wallLayer = document.createElement('canvas');
    wallLayer.width = canvas.width; wallLayer.height = canvas.height;
    const g = wallLayer.getContext('2d');
    const s = cell * dpr, W = world.W, H = world.H;
    g.clearRect(0, 0, wallLayer.width, wallLayer.height);
    // floor studs
    g.fillStyle = T.dot;
    const d = Math.max(1, Math.round(dpr));
    for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) g.fillRect(Math.round(x * s) - d / 2, Math.round(y * s) - d / 2, d, d);
    const B = (x, y) => world.blocked(x, y) && x >= 0 && y >= 0 && x < W && y < H;
    const lift = Math.max(2, s * 0.2), rad = s * 0.3;
    const block = (ox, oy) => {
      g.beginPath();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!world.wall[x + y * W]) continue;
          const n = B(x, y - 1), e = B(x + 1, y), so = B(x, y + 1), w = B(x - 1, y);
          const x0 = x * s + ox, y0 = y * s + oy;
          if (g.roundRect) {
            g.roundRect(x0 - (w ? 0.5 : 0), y0 - (n ? 0.5 : 0), s + (w ? 0.5 : 0) + (e ? 0.5 : 0), s + (n ? 0.5 : 0) + (so ? 0.5 : 0),
              [!n && !w ? rad : 0, !n && !e ? rad : 0, !so && !e ? rad : 0, !so && !w ? rad : 0]);
          } else g.rect(x0, y0, s, s);
        }
      }
      g.fill();
    };
    g.fillStyle = T.shade; block(0, lift);
    g.fillStyle = T.wall; block(0, 0);
    // a lit top edge
    g.strokeStyle = T.edge; g.lineWidth = Math.max(1, dpr);
    g.beginPath();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!world.wall[x + y * W] || B(x, y - 1)) continue;
        const l = B(x - 1, y) ? 0 : rad, r = B(x + 1, y) ? 0 : rad;
        g.moveTo(x * s + l, y * s + g.lineWidth / 2); g.lineTo((x + 1) * s - r, y * s + g.lineWidth / 2);
      }
    }
    g.stroke();
  }

  function drawSignals(s, t) {
    if (!world.opts.signals) return;
    const W = world.W;
    for (const seg of world.segs) {
      const horiz = seg.axis === 0;
      const state3 = (d) => seg.dir === 0 ? 'free' : (seg.dir === d ? (seg.draining ? 'hold' : 'go') : 'stop');
      // chevrons along the lane floor
      if (seg.dir !== 0) {
        ctx.strokeStyle = seg.draining ? T.hold : T.go;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = Math.max(1, s * 0.09);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        const ph = (t * 1.2) % 1;
        for (let i = seg.lo; i <= seg.hi; i++) {
          const c = i + 0.5 + (ph - 0.5) * seg.dir * 0.5;
          const a = seg.fixed + 0.5, k = 0.16 * seg.dir;
          if (horiz) { ctx.moveTo((c - k) * s, (a - 0.2) * s); ctx.lineTo((c + k) * s, a * s); ctx.lineTo((c - k) * s, (a + 0.2) * s); }
          else { ctx.moveTo((a - 0.2) * s, (c - k) * s); ctx.lineTo(a * s, (c + k) * s); ctx.lineTo((a + 0.2) * s, (c - k) * s); }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // a lamp on the wall beside each mouth
      for (const end of [0, 1]) {
        const i = end ? seg.hi : seg.lo, d = end ? -1 : 1;
        const mouthX = horiz ? i - d : seg.fixed, mouthY = horiz ? seg.fixed : i - d;
        if (world.blocked(mouthX, mouthY)) continue;
        const st = state3(d);
        if (st === 'free') continue;
        const side = (horiz ? seg.fixed - 1 : seg.fixed - 1) >= 0 ? -1 : 1;
        let lx, ly;
        if (horiz) { lx = i + 0.5 - d * 0.22; ly = seg.fixed + 0.5 + side * 1.0; }
        else { lx = seg.fixed + 0.5 + side * 1.0; ly = i + 0.5 - d * 0.22; }
        const col = st === 'go' ? T.go : st === 'hold' ? T.hold : st === 'stop' ? T.stop : T.muted;
        ctx.fillStyle = T.sign;
        ctx.beginPath(); ctx.arc(lx * s, ly * s, s * 0.3, 0, 6.3); ctx.fill();
        if (st !== 'free') { ctx.shadowColor = col; ctx.shadowBlur = s * 0.5; }
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(lx * s, ly * s, s * 0.17, 0, 6.3); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawMarkers(s, flagPass) {
    for (const m of world.markers) {
      const col = T.team[m.team % T.team.length];
      const x = m.x * s, y = m.y * s;
      if ((m.id === 'F') !== flagPass) continue;
      if (m.id === 'F') {
        // the flag
        ctx.fillStyle = T.floor; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(x, y + s * 0.5, s * 0.22, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = T.ink; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y + s * 0.5); ctx.lineTo(x, y - s * 1.3); ctx.stroke();
        ctx.fillStyle = T.accent;
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s * 1.1, y - s * 0.95); ctx.lineTo(x, y - s * 0.55); ctx.closePath(); ctx.fill();
        continue;
      }
      ctx.globalAlpha = 0.16; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, s * 2.2, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, s * 0.16); ctx.strokeStyle = col; ctx.fillStyle = T.floor;
      ctx.beginPath(); ctx.arc(x, y, s * 0.82, 0, 6.3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = T.ink;
      ctx.font = `700 ${Math.round(s * 1.15)}px ${T.display}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(m.label, x, y + s * 0.06);
    }
  }

  function focusField() {
    const a = state.selected && !state.selected.dead ? state.selected : world.agents[0];
    return a ? a.field : null;
  }

  function drawArrows(s) {
    const f = focusField();
    if (!f) return;
    const W = world.W, N = world.N;
    ctx.strokeStyle = T.ink; ctx.globalAlpha = 0.42; ctx.lineWidth = Math.max(1, s * 0.055); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let c = 0; c < N; c++) {
      const k = f.next[c];
      if (k < 0) continue;
      const dx = Sim.DX[k], dy = Sim.DY[k], l = Math.hypot(dx, dy);
      const ux = dx / l, uy = dy / l;
      const x = ((c % W) + 0.5) * s, y = (((c / W) | 0) + 0.5) * s, h = s * 0.26;
      const tx = x + ux * h, ty = y + uy * h;
      ctx.moveTo(x - ux * h, y - uy * h); ctx.lineTo(tx, ty);
      ctx.moveTo(tx - (ux * 0.5 - uy * 0.4) * h, ty - (uy * 0.5 + ux * 0.4) * h); ctx.lineTo(tx, ty);
      ctx.lineTo(tx - (ux * 0.5 + uy * 0.4) * h, ty - (uy * 0.5 - ux * 0.4) * h);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    const gx = ((f.goal % W) + 0.5) * s, gy = (((f.goal / W) | 0) + 0.5) * s;
    ctx.strokeStyle = T.accent; ctx.lineWidth = Math.max(2, s * 0.14);
    ctx.beginPath(); ctx.arc(gx, gy, s * 0.5, 0, 6.3); ctx.stroke();
  }

  function drawHeat(s) {
    const W = world.W, N = world.N, cong = world.cong;
    ctx.fillStyle = T.stop;
    for (let c = 0; c < N; c++) {
      const v = cong[c];
      if (v < 0.06) continue;
      ctx.globalAlpha = Math.min(0.6, v * 0.22);
      ctx.fillRect((c % W) * s, ((c / W) | 0) * s, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawRoute(s, a) {
    const pts = world.routeOf(a);
    const col = colourOf(a);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.13); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash([s * 0.3, s * 0.3]);
    ctx.beginPath();
    ctx.moveTo(pts[0] * s, pts[1] * s);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * s, pts[i + 1] * s);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(a.gx * s, a.gy * s, s * 0.22, 0, 6.3); ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.1);
    ctx.beginPath(); ctx.arc(a.gx * s, a.gy * s, s * 0.45, 0, 6.3); ctx.stroke();
  }

  // Worn paths: every step leaves a little colour that fades over a few
  // seconds, so lanes and desire lines show up on the floor.
  function stampTrails() {
    const { r, gg, b, a, w, h, res } = TR, n = w * h, agents = world.agents;
    for (let i = 0; i < n; i++) {
      if (a[i] === 0) continue;
      if (a[i] < 0.004) { a[i] = r[i] = gg[i] = b[i] = 0; continue; }
      a[i] *= 0.9955; r[i] *= 0.9955; gg[i] *= 0.9955; b[i] *= 0.9955;
    }
    for (let k = 0; k < agents.length; k++) {
      const ag = agents[k];
      if (ag.vx * ag.vx + ag.vy * ag.vy < 0.5) continue;
      const c = rgbOf(colourOf(ag));
      const fx = ag.x * res - 0.5, fy = ag.y * res - 0.5;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      for (let j = 0; j < 4; j++) {
        const x = x0 + (j & 1), y = y0 + (j >> 1);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const wt = ((j & 1) ? tx : 1 - tx) * ((j >> 1) ? ty : 1 - ty) * 0.3;
        const i = x + y * w;
        a[i] += wt; r[i] += wt * c[0]; gg[i] += wt * c[1]; b[i] += wt * c[2];
      }
    }
  }

  function drawTrails() {
    const { r, gg, b, a, w, h, img, g, cvs } = TR, d = img.data, n = w * h;
    const gain = 0.28, cap = T.dark ? 150 : 135;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const v = a[i];
      if (v < 0.01) { d[j + 3] = 0; continue; }
      d[j] = r[i] / v; d[j + 1] = gg[i] / v; d[j + 2] = b[i] / v;
      d[j + 3] = Math.min(cap, (1 - Math.exp(-v * gain)) * 255);
    }
    g.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cvs, 0, 0, canvas.width, canvas.height);
  }

  function drawAgents(s, t) {
    const agents = world.agents, R = Sim.R;
    // shadows
    ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.45)' : 'rgba(23,32,51,0.22)';
    ctx.beginPath();
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      ctx.moveTo(a.x * s + R * s, a.y * s + R * s * 0.45);
      ctx.ellipse(a.x * s, a.y * s + R * s * 0.45, R * s, R * s * 0.8, 0, 0, 6.3);
    }
    ctx.fill();
    // bodies, batched by colour
    const groups = new Map();
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const jam = a.stuck > 6 && !a.waiting;
      const col = jam ? T.stop : colourOf(a);
      let g = groups.get(col);
      if (!g) groups.set(col, g = []);
      g.push(a);
    }
    for (const [col, list] of groups) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (const a of list) {
        const grow = Math.min(1, (world.time - a.born) * 5 + 0.2);
        const wob = a.stuck > 6 && !a.waiting ? Math.sin(t * 30 + a.id) * 0.03 : 0;
        const r = R * s * grow;
        ctx.moveTo((a.x + wob) * s + r, a.y * s);
        ctx.arc((a.x + wob) * s, a.y * s, r, 0, 6.3);
      }
      ctx.fill();
    }
    // eyes: look where you're going; glance about while idle
    if (s * R < 2.6) return;
    const er = R * s * 0.3;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? T.pupil : T.eye;
      ctx.beginPath();
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        let hx = a.hx, hy = a.hy;
        if (a.state === Sim.IDLE) { const g = Math.sin(t * 0.7 + a.id * 1.7) * 1.2; const c = Math.cos(g), sn = Math.sin(g); const ox = hx; hx = ox * c - hy * sn; hy = ox * sn + hy * c; }
        else if (a.waiting) { hx = a.dx; hy = a.dy; }
        const l = Math.hypot(hx, hy) || 1; hx /= l; hy /= l;
        const blink = ((t * 0.9 + a.id * 0.37) % 4) < 0.09;
        if (blink || a.yieldT > 0) continue;   // eyes shut while giving way
        for (const side of [-1, 1]) {
          const ex = (a.x + hx * R * 0.42 - hy * side * R * 0.42) * s;
          const ey = (a.y + hy * R * 0.42 + hx * side * R * 0.42) * s;
          if (!pass) { ctx.moveTo(ex + er, ey); ctx.arc(ex, ey, er, 0, 6.3); }
          else { const px = ex + hx * er * 0.4, py = ey + hy * er * 0.4; ctx.moveTo(px + er * 0.52, py); ctx.arc(px, py, er * 0.52, 0, 6.3); }
        }
      }
      ctx.fill();
    }
    // lost souls
    ctx.fillStyle = T.ink; ctx.font = `700 ${Math.round(s * 0.8)}px ${T.display}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.lost > 0.5) ctx.fillText('?', a.x * s, (a.y - 0.45) * s);
    }
  }

  function drawFx(s, dt) {
    for (const e of world.events) fx.push({ x: e.x, y: e.y, team: e.team, t: 0, out: e.type === 'out' });
    world.events.length = 0;
    ctx.lineWidth = Math.max(1, s * 0.08);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt * 2.6;
      if (f.t >= 1) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - f.t;
      ctx.strokeStyle = T.team[f.team];
      ctx.beginPath(); ctx.arc(f.x * s, f.y * s, s * (0.3 + f.t * (f.out ? 0.9 : 0.5)), 0, 6.3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function draw(dt, t) {
    const s = cell * dpr;
    drawWallLayer();
    ctx.fillStyle = T.floor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state.trails) drawTrails();
    if (state.heat) drawHeat(s);
    drawMarkers(s, false);
    ctx.drawImage(wallLayer, 0, 0);
    drawSignals(s, t);
    if (state.arrows) drawArrows(s);
    const sel = state.selected;
    if (sel && sel.dead) state.selected = null;
    else if (sel) drawRoute(s, sel);
    drawAgents(s, t);
    if (state.selected) {
      const a = state.selected;
      ctx.strokeStyle = T.ink; ctx.lineWidth = Math.max(1.5, s * 0.09);
      ctx.beginPath(); ctx.arc(a.x * s, a.y * s, s * 0.52, 0, 6.3); ctx.stroke();
    }
    drawMarkers(s, true);
    drawFx(s, dt);
  }

  // ---------------------------------------------------------------- loop
  let last = 0, acc = 0, statClock = 0, shown = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const step = 1 / 60;
    acc += dt * state.speed;
    let n = 0;
    const t0 = performance.now();
    while (acc >= step && n < 8 && performance.now() - t0 < 11) {
      world.step(step);
      if (state.trails) stampTrails();
      acc -= step; n++;
    }
    if (acc > step) acc = 0;
    draw(dt, now / 1000);
    statClock += dt;
    if (statClock > 0.25 || !shown) {
      statClock = 0; shown = true;
      const st = world.stats;
      $('r-agents').textContent = st.agents;
      $('r-rate').textContent = st.perMin;
      $('r-pace').textContent = Math.round(st.pace * 100) + '%';
      $('r-wait').textContent = st.waiting;
      $('r-stuck').textContent = st.stuck;
    }
  }

  // --------------------------------------------------------------- input
  let drag = null;
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * world.W, (e.clientY - r.top) / r.height * world.H];
  }
  function markerAt(x, y) {
    let best = null, bd = 1.5 * 1.5;
    for (const m of world.markers) {
      const d = (m.x - x) ** 2 + (m.y - y) ** 2;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  function agentAt(x, y) {
    let best = null, bd = 0.55 * 0.55;
    for (const a of world.agents) {
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  function paintLine(x0, y0, x1, y1, v) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= n; i++) {
      world.setWall(Math.floor(x0 + (x1 - x0) * i / n), Math.floor(y0 + (y1 - y0) * i / n), v);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0 && e.button !== 2) return;
    const [x, y] = pos(e);
    $('hint').classList.add('gone');
    canvas.setPointerCapture(e.pointerId);
    const m = markerAt(x, y);
    if (m) { drag = { kind: 'marker', id: m.id }; canvas.style.cursor = 'grabbing'; return; }
    const a = agentAt(x, y);
    if (a) { state.selected = state.selected === a ? null : a; drag = { kind: 'none' }; return; }
    const cx = Math.floor(x), cy = Math.floor(y);
    const v = world.blocked(cx, cy) ? 0 : 1;
    drag = { kind: 'paint', v, x, y };
    world.setWall(cx, cy, v);
    markCustom();
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = pos(e);
    if (!drag) {
      canvas.style.cursor = markerAt(x, y) ? 'grab' : agentAt(x, y) ? 'pointer' : 'crosshair';
      return;
    }
    if (drag.kind === 'marker') {
      world.moveMarker(drag.id, Math.floor(x), Math.floor(y));
      if (drag.id === 'F') world.autoFlag = false;
    } else if (drag.kind === 'paint') {
      paintLine(drag.x, drag.y, x, y, drag.v);
      drag.x = x; drag.y = y;
    }
  });
  const end = () => { drag = null; canvas.style.cursor = 'crosshair'; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ------------------------------------------------------------ controls
  function markCustom() {
    for (const b of $('maps').children) b.setAttribute('aria-checked', 'false');
  }

  function buildControls() {
    const pat = $('patterns');
    for (const [id, p] of Object.entries(Sim.PATTERNS)) {
      const label = document.createElement('label');
      label.className = 'choice';
      label.htmlFor = 'pat-' + id;
      label.innerHTML = `<input type="radio" name="pattern" id="pat-${id}" value="${id}"><b></b><small></small>`;
      label.querySelector('b').textContent = p.name;
      label.querySelector('small').textContent = p.blurb;
      label.querySelector('input').checked = id === state.pattern;
      pat.appendChild(label);
    }
    pat.addEventListener('change', (e) => { state.pattern = e.target.value; restart(); });

    const maps = $('maps');
    for (const m of Sim.MAPS) {
      if (m.id === 'blank') continue;
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'map-' + m.id; b.dataset.map = m.id; b.title = m.blurb;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(m.id === state.map));
      b.textContent = m.name;
      maps.appendChild(b);
    }
    maps.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      loadMap(b.dataset.map);
      for (const o of maps.children) o.setAttribute('aria-checked', String(o === b));
    });

    const count = $('count');
    count.value = state.count;
    $('count-out').textContent = state.count;
    count.addEventListener('input', () => {
      state.count = +count.value;
      $('count-out').textContent = state.count;
      if (!world.pattern.fixed) world.setCount(state.count);
    });
    count.addEventListener('change', () => { if (world.pattern.fixed) { world.setCount(state.count); clearTrails(); } });

    const speed = $('speed');
    const showSpeed = () => { for (const b of speed.children) b.setAttribute('aria-checked', String(+b.dataset.speed === state.speed)); };
    speed.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.speed = +b.dataset.speed; showSpeed();
    });
    showSpeed();

    $('opt-signals').addEventListener('change', (e) => { world.opts.signals = e.target.checked; });
    $('opt-reroute').addEventListener('change', (e) => { world.opts.reroute = e.target.checked; for (const f of world.fieldList) f.dirty = true; });
    $('opt-trails').addEventListener('change', (e) => { state.trails = e.target.checked; clearTrails(); });
    $('opt-arrows').addEventListener('change', (e) => { state.arrows = e.target.checked; });
    $('opt-heat').addEventListener('change', (e) => { state.heat = e.target.checked; });
    state.trails = $('opt-trails').checked; state.arrows = $('opt-arrows').checked; state.heat = $('opt-heat').checked;

    $('restart').addEventListener('click', restart);
    $('clear').addEventListener('click', () => { loadMap('blank'); markCustom(); });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      if (e.key === ' ') { state.speed = state.speed ? 0 : 1; showSpeed(); e.preventDefault(); }
    });
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    readTheme();
    buildControls();
    build();
    let portrait = world.portrait, timer = 0;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const [gw, gh] = chooseGrid();
        if ((gh > gw) !== portrait) { build(); portrait = world.portrait; clearTrails(); }
        else fit();
      }, 120);
    };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', readTheme);
    new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { wallKey = ''; });
    setTimeout(() => $('hint').classList.add('gone'), 9000);
    window.__world = () => world;
    requestAnimationFrame(frame);
  }
  boot();
})();
