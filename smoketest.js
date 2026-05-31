// Headless smoke test: stub the DOM/canvas, load game scripts, run many frames.
const fs = require('fs');
const vm = require('vm');

// --- stub 2D context: every method is a no-op, gradients return objects ---
function makeGradient() { return { addColorStop() {} }; }
const ctxStub = new Proxy({}, {
  get(_, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return makeGradient;
    if (prop === 'canvas') return { width: 1280, height: 720 };
    // return a no-op function for any method, undefined-ish for props we set
    return (...args) => {};
  },
  set() { return true; },
});

const canvasStub = {
  width: 1280, height: 720,
  getContext: () => ctxStub,
};

let rafCb = null;
const listeners = {};
const sandbox = {
  console,
  Math, Date, JSON, Object, Array, Set, Map, Proxy, isNaN, parseInt, parseFloat, Infinity, NaN,
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
  document: {
    getElementById: () => canvasStub,
  },
  navigator: { getGamepads: () => [] },
  window: {
    addEventListener: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); },
  },
};
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const files = ['utils', 'input', 'effects', 'stage', 'characters', 'fighter', 'ai', 'render', 'main'];
for (const f of files) {
  const code = fs.readFileSync(`src/${f}.js`, 'utf8');
  vm.runInContext(code, sandbox, { filename: `${f}.js` });
}

function key(code, type = 'keydown') {
  (listeners[type] || []).forEach(cb => cb({ code, preventDefault() {} }));
}

// helper to advance N frames
function frames(n) { for (let i = 0; i < n; i++) { if (rafCb) { const cb = rafCb; rafCb = null; cb(); } } }

// 1) Title screen
frames(5);
// start -> select
key('KeyF'); frames(2); key('KeyF', 'keyup');
frames(5);

// In SELECT: P1 human picks char 0 and readies; P2 is CPU (auto)
key('KeyF'); frames(2); key('KeyF', 'keyup'); // P1 ready toggle
frames(40); // let CPU auto-pick
// start battle
key('Space'); frames(2); key('Space', 'keyup');
frames(5);

// 2) Battle: simulate P1 mashing movement + attacks for a long time
let ok = true;
try {
  for (let t = 0; t < 1200; t++) {
    // random-ish P1 inputs
    if (t % 20 === 0) key('KeyD');
    if (t % 20 === 10) { key('KeyD', 'keyup'); key('KeyA'); }
    if (t % 20 === 15) key('KeyA', 'keyup');
    if (t % 13 === 0) key('KeyF');
    if (t % 13 === 3) key('KeyF', 'keyup');
    if (t % 31 === 0) key('KeyW');
    if (t % 31 === 4) key('KeyW', 'keyup');
    if (t % 17 === 0) key('KeyG');
    if (t % 17 === 2) key('KeyG', 'keyup');
    if (t % 23 === 0) key('KeyH');
    if (t % 23 === 8) key('KeyH', 'keyup');
    frames(1);
  }
} catch (e) {
  ok = false;
  console.error('RUNTIME ERROR during battle:', e);
}

console.log(ok ? 'SMOKE TEST PASSED: ran 1200 battle frames with no errors' : 'SMOKE TEST FAILED');
process.exit(ok ? 0 : 1);
