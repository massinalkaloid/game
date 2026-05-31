// Render real frames to PNGs using node-canvas to verify visuals.
const fs = require('fs');
const vm = require('vm');
const { createCanvas } = require('canvas');

const canvas = createCanvas(1280, 720);
const realCtx = canvas.getContext('2d');

let rafCb = null;
const listeners = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, Set, Map, Proxy, isNaN, parseInt, parseFloat, Infinity, NaN,
  requestAnimationFrame: (cb) => { rafCb = cb; },
  document: { getElementById: () => canvas },
  navigator: { getGamepads: () => [] },
  window: { addEventListener: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); } },
};
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['utils','input','effects','stage','characters','fighter','ai','render','main']) {
  vm.runInContext(fs.readFileSync(`src/${f}.js`,'utf8'), sandbox, { filename: f });
}
const key = (code, type='keydown') => (listeners[type]||[]).forEach(cb=>cb({code, preventDefault(){}}));
const step = (n=1) => { for (let i=0;i<n;i++){ if(rafCb){const cb=rafCb; rafCb=null; cb();} } };
const save = (name) => { fs.writeFileSync(name, canvas.toBuffer('image/png')); console.log('wrote', name); };

step(30); save('shot_title.png');
key('KeyF'); step(2); key('KeyF','keyup'); step(20); save('shot_select.png');
key('KeyF'); step(2); key('KeyF','keyup');   // P1 ready
step(40);                                      // CPU auto-ready
key('Space'); step(2); key('Space','keyup');
step(2); save('shot_battle_start.png');
// play a bit so fighters move and clash
for (let t=0;t<200;t++){
  if(t%18===0) key('KeyD'); if(t%18===9){key('KeyD','keyup');}
  if(t%11===0) key('KeyF'); if(t%11===3) key('KeyF','keyup');
  if(t%29===0) key('KeyW'); if(t%29===4) key('KeyW','keyup');
  if(t%15===0) key('KeyG'); if(t%15===2) key('KeyG','keyup');
  step(1);
}
save('shot_battle_action.png');
