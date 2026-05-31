// ---------- input handling (keyboard + gamepad + touch) ----------
const Input = (() => {
  const keys = {};
  const pressed = {}; // edge: true only on the frame it went down

  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // Two keyboard control schemes.
  const SCHEMES = [
    { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
      jump: 'KeyW', attack: 'KeyF', special: 'KeyG', shield: 'KeyH' },
    { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
      jump: 'ArrowUp', attack: 'Period', special: 'Comma', shield: 'Slash' },
  ];

  // ---- touch state (drives player 0) ----
  const tjoy = { lx: 0, ly: 0 };
  const tbtn = { jump: false, attack: false, special: false, shield: false };
  const tedge = { jump: false, attack: false, special: false };
  let confirmEdge = false;
  let touchEnabled = false;

  function initTouch() {
    const isTouch = (typeof window !== 'undefined') &&
      ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window));
    const root = (typeof document !== 'undefined') ? document.getElementById('touch') : null;
    if (!root || !root.classList || !root.addEventListener) return; // headless / no DOM
    if (!isTouch) return; // keep hidden on desktop
    root.classList.remove('hidden');
    touchEnabled = true;

    // analog stick
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let joyId = null;
    const setKnob = (x, y) => { if (knob) knob.style.transform = `translate(${x}px,${y}px)`; };
    const updateJoy = (e) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width * 0.42;
      const m = Math.hypot(dx, dy) || 1;
      const cl = Math.min(m, max);
      tjoy.lx = (dx / m) * (cl / max);
      tjoy.ly = (dy / m) * (cl / max);
      // deadzone
      if (Math.abs(tjoy.lx) < 0.18) tjoy.lx = 0;
      if (Math.abs(tjoy.ly) < 0.18) tjoy.ly = 0;
      setKnob((dx / m) * cl, (dy / m) * cl);
    };
    stick.addEventListener('pointerdown', (e) => { e.preventDefault(); joyId = e.pointerId; stick.setPointerCapture(e.pointerId); updateJoy(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) updateJoy(e); });
    const releaseJoy = (e) => { if (e.pointerId === joyId) { joyId = null; tjoy.lx = 0; tjoy.ly = 0; setKnob(0, 0); } };
    stick.addEventListener('pointerup', releaseJoy);
    stick.addEventListener('pointercancel', releaseJoy);

    // action buttons
    const btns = root.querySelectorAll ? root.querySelectorAll('.tb') : [];
    btns.forEach((btn) => {
      const b = btn.dataset.b;
      const press = (e) => { e.preventDefault(); tbtn[b] = true; if (b in tedge) tedge[b] = true; btn.classList.add('pressed'); };
      const release = (e) => { e.preventDefault(); tbtn[b] = false; btn.classList.remove('pressed'); };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    });

    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); confirmEdge = true; });
  }

  function pollPad(index) {
    const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : [];
    const gp = pads[index];
    if (!gp) return null;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const b = gp.buttons;
    const down = (i) => b[i] && b[i].pressed;
    return {
      lx: Math.abs(ax) > 0.25 ? ax : 0,
      ly: Math.abs(ay) > 0.25 ? ay : 0,
      jump: down(0), attack: down(2), special: down(3) || down(1),
      shield: down(7) || down(6) || down(5) || down(4),
      dpadL: down(14), dpadR: down(15), dpadU: down(12), dpadD: down(13),
    };
  }

  function getState(playerIndex) {
    const s = SCHEMES[playerIndex] || SCHEMES[0];
    const pad = pollPad(playerIndex);

    let lx = 0, ly = 0;
    if (keys[s.left]) lx -= 1;
    if (keys[s.right]) lx += 1;
    if (keys[s.up]) ly -= 1;
    if (keys[s.down]) ly += 1;

    let jump = keys[s.jump], attack = keys[s.attack],
        special = keys[s.special], shield = keys[s.shield];
    let jumpEdge = pressed[s.jump], attackEdge = pressed[s.attack],
        specialEdge = pressed[s.special];

    if (pad) {
      lx += pad.lx + (pad.dpadR ? 1 : 0) - (pad.dpadL ? 1 : 0);
      ly += pad.ly + (pad.dpadD ? 1 : 0) - (pad.dpadU ? 1 : 0);
      jump = jump || pad.jump; attack = attack || pad.attack;
      special = special || pad.special; shield = shield || pad.shield;
    }

    // touch only drives player 0
    if (playerIndex === 0 && touchEnabled) {
      lx += tjoy.lx; ly += tjoy.ly;
      jump = jump || tbtn.jump; attack = attack || tbtn.attack;
      special = special || tbtn.special; shield = shield || tbtn.shield;
      jumpEdge = jumpEdge || tedge.jump;
      attackEdge = attackEdge || tedge.attack;
      specialEdge = specialEdge || tedge.special;
    }

    return {
      lx: U.clamp(lx, -1, 1), ly: U.clamp(ly, -1, 1),
      jump, attack, special, shield, jumpEdge, attackEdge, specialEdge,
    };
  }

  // menu confirm = keyboard Enter/Space OR the on-screen START button
  function menuConfirm() {
    return !!pressed['Enter'] || !!pressed['Space'] || confirmEdge;
  }

  function anyKeyEdge() { return Object.keys(pressed).some(k => pressed[k]); }
  function keyEdge(code) { return !!pressed[code]; }
  function endFrame() {
    for (const k in pressed) pressed[k] = false;
    tedge.jump = tedge.attack = tedge.special = false;
    confirmEdge = false;
  }

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', initTouch);
    else initTouch();
  }

  return { getState, endFrame, anyKeyEdge, keyEdge, menuConfirm };
})();
