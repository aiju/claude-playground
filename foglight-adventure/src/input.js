// Keyboard and gamepad input, reduced to a handful of actions.

const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyJ: 'sword', KeyZ: 'sword',
  KeyK: 'item1', KeyX: 'item1',
  KeyL: 'item2', KeyC: 'item2',
  Space: 'action', KeyE: 'action',
  Enter: 'menu', Escape: 'menu', KeyI: 'menu', KeyP: 'menu',
};
// Standard gamepad layout: A sword, B action, X item 1, Y item 2.
const PAD = { 0: 'sword', 1: 'action', 2: 'item1', 3: 'item2', 9: 'menu', 8: 'map', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const ACTIONS = ['up', 'down', 'left', 'right', 'sword', 'item1', 'item2', 'action', 'menu', 'map'];

export class Input {
  constructor() {
    this.held = new Set();      // actions held via keyboard
    this.fresh = new Set();     // pressed since the last poll (so quick taps aren't lost)
    this.state = {};
    this.prev = {};
    this.stick = [0, 0];
    this.usingPad = false;
    this.anyKey = false;
    window.addEventListener('keydown', (e) => {
      const a = KEYS[e.code];
      this.anyKey = true;
      this.usingPad = false;
      if (!a) return;
      e.preventDefault();
      if (!e.repeat) this.fresh.add(a);
      this.held.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYS[e.code];
      if (a) { this.held.delete(a); e.preventDefault(); }
    });
    window.addEventListener('blur', () => { this.held.clear(); this.touchHeld.clear(); });
    this.touchHeld = new Set();
    this.touchStick = [0, 0];
    this.usingTouch = false;
    this.setupTouch();
  }

  // On-screen stick and buttons, shown once the screen is touched.
  setupTouch() {
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="stick"><div class="knob"></div></div>
      <div class="tbtns">
        <button data-a="item2" class="b-i2"><span>2</span></button>
        <button data-a="item1" class="b-i1"><span>1</span></button>
        <button data-a="action" class="b-act"><span>✋</span></button>
        <button data-a="sword" class="b-sw"><span>⚔</span></button>
      </div>
      <button data-a="menu" class="tmenu">☰</button>`;
    document.body.appendChild(root);
    this.touchRoot = root;
    const on = () => {
      if (this.usingTouch) return;
      this.usingTouch = true;
      root.classList.add('on');
    };
    window.addEventListener('touchstart', on, { passive: true });
    for (const btn of root.querySelectorAll('button')) {
      const a = btn.dataset.a;
      const down = (e) => { e.preventDefault(); on(); this.fresh.add(a); this.touchHeld.add(a); btn.classList.add('down'); this.usingPad = false; };
      const up = (e) => { e.preventDefault(); this.touchHeld.delete(a); btn.classList.remove('down'); };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    }
    const stick = root.querySelector('.stick'), knob = root.querySelector('.knob');
    let id = null, cx = 0, cy = 0;
    const move = (e) => {
      const r = 55;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > r) { dx *= r / l; dy *= r / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchStick = Math.hypot(dx, dy) > 12 ? [dx / r, dy / r] : [0, 0];
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault(); on();
      id = e.pointerId;
      const b = stick.getBoundingClientRect();
      cx = b.left + b.width / 2; cy = b.top + b.height / 2;
      stick.setPointerCapture(id);
      move(e);
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.touchStick = [0, 0]; knob.style.transform = ''; };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    // tapping the picture itself counts as "action" (handy for dialogs and menus)
    window.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#touch') || e.target.closest('.opt')) return;
      if (e.pointerType === 'touch') { on(); this.fresh.add('action'); return; }
      // a mouse click moves dialogue along
      if (this.onClick) this.onClick();
    });
  }

  poll() {
    this.prev = this.state;
    const s = {};
    for (const a of ACTIONS) s[a] = this.held.has(a) || this.touchHeld.has(a);
    this.stick = [0, 0];
    if (this.touchStick[0] || this.touchStick[1]) {
      this.stick = this.touchStick;
      const [x, y] = this.touchStick;
      // let the stick also drive menus
      if (y < -0.6) s.up = true; if (y > 0.6) s.down = true;
      if (x < -0.6) s.left = true; if (x > 0.6) s.right = true;
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      for (const [i, a] of Object.entries(PAD)) {
        if (p.buttons[i] && p.buttons[i].pressed) { s[a] = true; this.usingPad = true; this.anyKey = true; }
      }
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.3) { this.stick = [ax, ay]; this.usingPad = true; }
    }
    this.pressedSet = new Set();
    for (const a of ACTIONS) {
      if ((s[a] && !this.prev[a]) || this.fresh.has(a)) this.pressedSet.add(a);
    }
    this.fresh.clear();
    this.state = s;
  }

  down(a) { return !!this.state[a]; }
  pressed(a) { return this.pressedSet?.has(a) ?? false; }
  released(a) { return !this.state[a] && !!this.prev[a]; }
  consume(a) { this.pressedSet?.delete(a); }

  // Movement as [x, z] with length <= 1.
  axis() {
    let x = (this.state.right ? 1 : 0) - (this.state.left ? 1 : 0);
    let z = (this.state.down ? 1 : 0) - (this.state.up ? 1 : 0);
    if (this.stick[0] || this.stick[1]) {
      x = this.stick[0]; z = this.stick[1];
      const l = Math.hypot(x, z);
      const m = Math.min(1, Math.max(0, (l - 0.2) / 0.6));
      return [(x / l) * m, (z / l) * m];
    }
    const l = Math.hypot(x, z);
    return l ? [x / l, z / l] : [0, 0];
  }
}
