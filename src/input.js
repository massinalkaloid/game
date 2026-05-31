// ---------- input handling (keyboard + gamepad) ----------
const Input = (() => {
  const keys = {};
  const pressed = {}; // edge: true only on the frame it went down

  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    // stop page scrolling with arrows / space
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // Two keyboard control schemes.
  const SCHEMES = [
    { // Player 1 - WASD + FGH
      left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
      jump: 'KeyW', attack: 'KeyF', special: 'KeyG', shield: 'KeyH',
    },
    { // Player 2 - arrows + . , /
      left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
      jump: 'ArrowUp', attack: 'Period', special: 'Comma', shield: 'Slash',
    },
  ];

  function pollPad(index) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[index];
    if (!gp) return null;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const b = gp.buttons;
    const down = (i) => b[i] && b[i].pressed;
    return {
      lx: Math.abs(ax) > 0.25 ? ax : 0,
      ly: Math.abs(ay) > 0.25 ? ay : 0,
      jump: down(0),
      attack: down(2),
      special: down(3) || down(1),
      shield: down(7) || down(6) || down(5) || down(4),
      dpadL: down(14), dpadR: down(15), dpadU: down(12), dpadD: down(13),
    };
  }

  // Returns a per-player state object with held + edge values.
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
      jump = jump || pad.jump;
      attack = attack || pad.attack;
      special = special || pad.special;
      shield = shield || pad.shield;
    }

    return {
      lx: U.clamp(lx, -1, 1),
      ly: U.clamp(ly, -1, 1),
      jump, attack, special, shield,
      jumpEdge, attackEdge, specialEdge,
    };
  }

  function anyKeyEdge() {
    return Object.keys(pressed).some(k => pressed[k]);
  }
  function keyEdge(code) { return !!pressed[code]; }
  function endFrame() { for (const k in pressed) pressed[k] = false; }

  return { getState, endFrame, anyKeyEdge, keyEdge };
})();
