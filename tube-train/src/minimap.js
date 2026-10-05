// The minimap: the line from above round the train, turned so that the train
// runs left to right across it, with the stations, the train, the camera and
// what it sees, a scale bar, and under it a strip with the line's height
// (stretched, so the dips between the stations show; it says how much).
//
// It is drawn on its own canvas each frame. Clicking it steps through three
// zooms.

import * as THREE from 'three';
import { Frame } from './path.js';

const ZOOMS = [700, 1500, 3200];       // metres across the plan
const PROFILE_H = 34;                  // css px for the height strip
const HEIGHT_PX = 5;                   // px per metre of height on the strip

const C = {
  bg: 'rgba(20, 22, 26, 0.82)',
  tunnel: '#7b7068',
  tunnelEdge: '#2d2926',
  platform: '#e9e5da',
  blue: '#0098d4',
  train: '#e8352c',
  trainB: '#b0453d',
  front: '#fff4d6',
  ink: '#eceae4',
  muted: '#a9adb3',
  camera: 'rgba(255, 255, 255, 0.9)',
  cone: 'rgba(255, 255, 255, 0.16)',
};

// `other` is the other track ({ track, offset, train }), drawn beside ours.
export function createMinimap({ canvas, line, train, stationStart, stationLength, stationName, other = null }) {
  const g = canvas.getContext('2d');
  let zoom = 0;
  let angle = null;                    // the plan's rotation, eased
  const f = new Frame(), dir = new THREE.Vector3();

  canvas.addEventListener('click', () => { zoom = (zoom + 1) % ZOOMS.length; });

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }

  // a stroke along the line from s0 to s1, in plan, or beside it
  function along(toPx, s0, s1, step, offset = 0) {
    g.beginPath();
    const n = Math.max(2, Math.ceil((s1 - s0) / step));
    for (let i = 0; i <= n; i++) {
      line.frame(s0 + (s1 - s0) * i / n, f);
      const [x, y] = toPx(f.pos.x + f.r.x * offset, f.pos.z + f.r.z * offset);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
  }

  // a train as a red stroke from its back to its front, the front lit
  function trainStroke(toPx, frameAt, front, length, step, colour) {
    g.beginPath();
    const n = Math.max(2, Math.ceil(length / step));
    for (let i = 0; i <= n; i++) {
      const p = frameAt(front - length + length * i / n).pos;
      const [x, y] = toPx(p.x, p.z);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 8;
    g.stroke();
    g.strokeStyle = colour;
    g.lineWidth = 5;
    g.stroke();
    const p = frameAt(front).pos;
    const [fx, fy] = toPx(p.x, p.z);
    g.fillStyle = C.front;
    g.beginPath();
    g.arc(fx, fy, 2.6, 0, Math.PI * 2);
    g.fill();
  }

  // the boxes labels have taken, so that later ones can keep out of them
  let taken = [];
  function room(text, x, y, align, size) {
    g.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const tw = g.measureText(text).width;
    const x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    const box = [x0 - 3, y - size / 2 - 2, x0 + tw + 3, y + size / 2 + 2];
    if (taken.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return false;
    taken.push(box);
    return true;
  }

  function label(text, x, y, align = 'center', colour = C.ink, size = 11) {
    room(text, x, y, align, size);
    g.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(12, 13, 16, 0.9)';
    g.strokeText(text, x, y);
    g.fillStyle = colour;
    g.fillText(text, x, y);
  }

  return {
    // `s` is the front of the train along the line, `camera` the camera
    // otherBeta: where the other train's front is on its track, or null
    draw({ s, camera, nextStop, toNext, dt = 1 / 60, otherBeta = null }) {
      const [w, h] = size();
      const planH = h - PROFILE_H;
      const span = ZOOMS[zoom];
      const scale = w / span;                       // px per metre
      const step = Math.max(1, 2 / scale);          // sample every ~2 px
      // centre a little ahead of the middle of the train
      const mid = s - train.length / 2 + span * 0.12;
      const centre = line.frame(mid, new Frame()).pos.clone();
      // turn the plan so the line across it runs left to right
      const a = line.frame(mid - span / 2, new Frame()).pos, b = line.frame(mid + span / 2, new Frame()).pos;
      const want = Math.atan2(b.z - a.z, b.x - a.x);
      // ease round over a second or so, but snap after a jump
      if (angle === null) angle = want;
      let d = want - angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      angle += Math.abs(d) > 0.6 ? d : d * (1 - Math.exp(-dt / 0.8));
      const cos = Math.cos(-angle), sin = Math.sin(-angle);
      const toPx = (x, z) => {
        const dx = x - centre.x, dz = z - centre.z;
        return [w / 2 + (dx * cos - dz * sin) * scale, planH / 2 + (dx * sin + dz * cos) * scale];
      };

      taken = [];
      g.clearRect(0, 0, w, h);
      g.fillStyle = C.bg;
      g.beginPath();
      g.roundRect(0, 0, w, h, 12);
      g.fill();
      g.save();
      g.beginPath();
      g.roundRect(0, 0, w, h, 12);
      g.clip();

      // the tunnel
      const s0 = mid - span * 0.75, s1 = mid + span * 0.75;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const offset of other ? [other.offset, 0] : [0]) {
        along(toPx, s0, s1, step, offset);
        g.strokeStyle = C.tunnelEdge;
        g.lineWidth = 7;
        g.stroke();
        g.strokeStyle = C.tunnel;
        g.lineWidth = 3.5;
        g.stroke();
      }

      // stations
      const k0 = Math.max(0, Math.floor((s0 - stationStart(0)) / (stationStart(1) - stationStart(0))));
      const k1 = Math.ceil((s1 - stationStart(0)) / (stationStart(1) - stationStart(0)));
      const shown = [];
      for (let k = k0; k <= k1; k++) {
        const a0 = stationStart(k), a1 = a0 + stationLength;
        if (a1 < s0 || a0 > s1) continue;
        shown.push(k);
        g.lineCap = 'butt';
        for (const offset of other ? [other.offset, 0] : [0]) {
          along(toPx, a0, a1, step, offset);
          g.strokeStyle = C.platform;
          g.lineWidth = 9;
          g.stroke();
          g.strokeStyle = C.blue;
          g.lineWidth = 3;
          g.stroke();
        }
      }

      // the trains
      if (other && otherBeta !== null) trainStroke(toPx, (b) => other.track.frame(b, f), otherBeta, other.train.length, Math.min(step, 4), C.trainB);
      trainStroke(toPx, (u) => line.frame(u, f), s, train.length, Math.min(step, 4), C.train);

      // the camera and the way it looks
      const [cx, cy] = toPx(camera.position.x, camera.position.z);
      camera.getWorldDirection(dir);
      const ang = Math.atan2(dir.z, dir.x) - angle;
      const half = THREE.MathUtils.degToRad(camera.fov * camera.aspect) / 2;
      const reach = 26;
      g.fillStyle = C.cone;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, reach, ang - Math.min(half, 1.2), ang + Math.min(half, 1.2));
      g.closePath();
      g.fill();
      g.fillStyle = C.camera;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, 3.2, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // scale bar
      const nice = [50, 100, 200, 500, 1000].find(m => m * scale > w * 0.16) || 1000;
      const bx = w - 12 - nice * scale, by = planH - 10;
      g.strokeStyle = C.ink;
      g.lineWidth = 1.5;
      g.lineCap = 'butt';
      g.beginPath();
      g.moveTo(bx, by - 3); g.lineTo(bx, by); g.lineTo(bx + nice * scale, by); g.lineTo(bx + nice * scale, by - 3);
      g.stroke();
      label(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, bx + nice * scale / 2, by - 8, 'center', C.ink, 10);

      // next stop
      if (nextStop !== null) label(toNext < 1 ? `At ${stationName(nextStop)}` : `Next: ${stationName(nextStop)} · ${Math.round(toNext)} m`, 10, 12, 'left', C.ink, 11);

      // station names, on the left of the line (up, the way the plan is
      // turned), the next stop first and then the nearest, each where it
      // has room
      shown.sort((a, b) => (a === nextStop ? -1 : b === nextStop ? 1 : Math.abs(stationStart(a) - s) - Math.abs(stationStart(b) - s)));
      for (const k of shown) {
        const m = line.frame(stationStart(k) + stationLength / 2, f);
        const [lx, ly] = toPx(m.pos.x - m.r.x * 15 / scale, m.pos.z - m.r.z * 15 / scale);
        const x = Math.min(Math.max(lx, 60), w - 60), y = Math.min(Math.max(ly, 30), planH - 26);
        if (room(stationName(k), x, y, 'center', 11)) {
          taken.pop();
          label(stationName(k), x, y, 'center', k === nextStop ? C.ink : C.muted, 11);
        }
      }

      // the height strip: the line's height along the same stretch
      const top = planH + 2, bottom = h - 6;
      g.strokeStyle = 'rgba(255,255,255,0.1)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(8, top - 2); g.lineTo(w - 8, top - 2);
      g.stroke();
      const sx = (u) => w / 2 + (u - mid) * scale;
      const hy = (y) => top + 6 - y * HEIGHT_PX;
      const p0 = mid - span / 2, p1 = mid + span / 2;
      g.beginPath();
      const n = Math.ceil(w / 2);
      for (let i = 0; i <= n; i++) {
        const u = p0 + (p1 - p0) * i / n;
        const y = Math.min(hy(line.frame(u, f).pos.y), bottom);
        if (i) g.lineTo(sx(u), y); else g.moveTo(sx(u), y);
      }
      g.lineTo(sx(p1), bottom); g.lineTo(sx(p0), bottom); g.closePath();
      g.fillStyle = 'rgba(123, 112, 104, 0.35)';
      g.fill();
      g.strokeStyle = C.tunnel;
      g.lineWidth = 1.5;
      g.stroke();
      // stations on the strip, and the train
      for (let k = k0; k <= k1; k++) {
        const a0 = stationStart(k);
        g.strokeStyle = C.blue;
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(sx(a0), hy(0)); g.lineTo(sx(a0 + stationLength), hy(0)); g.stroke();
      }
      g.strokeStyle = C.train;
      g.lineWidth = 4;
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const u = s - train.length * (1 - i / 12);
        const y = hy(line.frame(u, f).pos.y) - 2;
        if (i) g.lineTo(sx(u), y); else g.moveTo(sx(u), y);
      }
      g.stroke();
      label(`height ×${Math.round(HEIGHT_PX / scale)}`, w - 10, bottom - 4, 'right', C.muted, 9);
      g.restore();

      // in tens of metres, so that it isn't rewritten every frame
      const aria = nextStop === null ? 'Map of the line'
        : `Map of the line. Next stop ${stationName(nextStop)}, ${Math.round(toNext / 10) * 10} metres.`;
      if (aria !== canvas.getAttribute('aria-label')) canvas.setAttribute('aria-label', aria);
    },
  };
}
