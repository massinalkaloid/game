// Unit-level test of core fighter mechanics, executed inside the vm context.
const fs = require('fs');
const vm = require('vm');
function makeGradient() { return { addColorStop() {} }; }
const ctxStub = new Proxy({}, { get(_, p) {
  if (p === 'createLinearGradient' || p === 'createRadialGradient') return makeGradient;
  return () => {};
}, set() { return true; } });
const sandbox = { console, Math, Date, JSON, Object, Array, Set, Map, Proxy, isNaN, Infinity, NaN,
  requestAnimationFrame: () => 1,
  document: { getElementById: () => ({ width: 1280, height: 720, getContext: () => ctxStub }) },
  navigator: { getGamepads: () => [] },
  window: { addEventListener: () => {} } };
sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['utils','effects','stage','characters','fighter']) {
  vm.runInContext(fs.readFileSync(`src/${f}.js`,'utf8'), sandbox, { filename: f });
}

const test = `
const stage = new Stage(1280, 720);
const a = new Fighter(2, 0, false, stage); // TITAN
let pass = true;
function check(name, cond){ console.log((cond?'  ok  ':' FAIL ')+name); if(!cond) pass=false; }

const b = new Fighter(1, 1, false, stage); // VOLT
const before = b.percent;
b.takeHit(a.char.attacks.side, a);
check('hit deals damage', b.percent > before);
check('hit applies knockback', Math.abs(b.vx)>0 || Math.abs(b.vy)>0);
check('hit causes hitstun', b.hitstun > 0);

const c = new Fighter(1,1,false,stage); c.percent=0;   c.takeHit(a.char.attacks.side,a);
const d = new Fighter(1,1,false,stage); d.percent=150; d.takeHit(a.char.attacks.side,a);
check('knockback grows with %', Math.hypot(d.vx,d.vy) > Math.hypot(c.vx,c.vy));

const heavy=new Fighter(2,0,false,stage); heavy.percent=40; heavy.takeHit(a.char.attacks.side,a);
const light=new Fighter(1,1,false,stage); light.percent=40; light.takeHit(a.char.attacks.side,a);
check('heavier resists knockback', Math.hypot(heavy.vx,heavy.vy) < Math.hypot(light.vx,light.vy));

const e=new Fighter(1,1,false,stage); const s0=e.stocks;
e.x = stage.blast.right + 50; e.checkBlastZone();
check('blast zone costs a stock', e.stocks === s0-1);
check('KO triggers respawn', e.respawnTimer > 0);

const g=new Fighter(1,1,false,stage); g.shielding=true; g.shieldHealth=100; g.takeHit(a.char.attacks.side,a);
check('shield prevents launch', g.hitstun === 0);
check('shield drains on block', g.shieldHealth < 100);

console.log(pass ? '\\nALL MECHANICS TESTS PASSED' : '\\nMECHANICS TESTS FAILED');
globalThis.__pass = pass;
`;
vm.runInContext(test, sandbox, { filename: 'mechtest-inner' });
process.exit(sandbox.__pass ? 0 : 1);
