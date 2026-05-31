// ---------- particles, sparks, shockwaves, floating text ----------
class Particle {
  constructor(o) {
    this.x = o.x; this.y = o.y;
    this.vx = o.vx; this.vy = o.vy;
    this.life = o.life; this.maxLife = o.life;
    this.size = o.size;
    this.color = o.color;
    this.grav = o.grav ?? 0.2;
    this.drag = o.drag ?? 0.98;
    this.shrink = o.shrink ?? true;
    this.glow = o.glow ?? true;
  }
  update() {
    this.vx *= this.drag; this.vy *= this.drag;
    this.vy += this.grav;
    this.x += this.vx; this.y += this.vy;
    this.life--;
    return this.life > 0;
  }
  draw(ctx) {
    const t = this.life / this.maxLife;
    const s = this.shrink ? this.size * t : this.size;
    ctx.globalAlpha = U.clamp(t, 0, 1);
    if (this.glow) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5, s), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

class Shockwave {
  constructor(x, y, color, max = 80, speed = 6) {
    this.x = x; this.y = y; this.r = 6; this.max = max;
    this.color = color; this.speed = speed; this.life = 1;
  }
  update() { this.r += this.speed; this.speed *= 0.92; this.life = 1 - this.r / this.max; return this.r < this.max; }
  draw(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = U.clamp(this.life, 0, 1) * 0.8;
    ctx.lineWidth = 3 + this.life * 4;
    ctx.strokeStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

class FloatText {
  constructor(x, y, text, color, size = 28) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.life = 50; this.maxLife = 50; this.size = size; this.vy = -1.2;
  }
  update() { this.y += this.vy; this.vy *= 0.94; this.life--; return this.life > 0; }
  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.globalAlpha = U.clamp(t * 1.5, 0, 1);
    ctx.font = `900 ${this.size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

const FX = (() => {
  let particles = [], waves = [], texts = [];
  let shake = 0, shakeX = 0, shakeY = 0;
  let flash = 0, flashColor = '#fff';
  let hitstopTimer = 0;

  function reset() { particles = []; waves = []; texts = []; shake = 0; flash = 0; hitstopTimer = 0; }

  function burst(x, y, color, count = 14, opt = {}) {
    const spd = opt.speed ?? 6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = U.rand(spd * 0.3, spd);
      particles.push(new Particle({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opt.up || 0),
        life: U.randInt(opt.life ? opt.life - 8 : 18, opt.life ? opt.life + 8 : 34),
        size: U.rand(opt.size ? opt.size * 0.5 : 2, opt.size || 5),
        color, grav: opt.grav ?? 0.18, drag: opt.drag ?? 0.93,
        glow: opt.glow ?? true, shrink: opt.shrink ?? true,
      }));
    }
  }

  function hitSpark(x, y, color, power) {
    waves.push(new Shockwave(x, y, color, 50 + power * 6, 5 + power * 0.6));
    burst(x, y, color, 10 + Math.floor(power), { speed: 4 + power * 0.7, life: 22 });
    burst(x, y, '#ffffff', 6, { speed: 6 + power, life: 14, size: 4 });
  }

  function smoke(x, y, color) {
    for (let i = 0; i < 6; i++) {
      particles.push(new Particle({
        x: x + U.rand(-8, 8), y: y + U.rand(-6, 6),
        vx: U.rand(-1, 1), vy: U.rand(-2.4, -0.6),
        life: U.randInt(26, 44), size: U.rand(6, 12),
        color, grav: -0.02, drag: 0.96, glow: false,
      }));
    }
  }

  function trail(x, y, color, size = 4) {
    particles.push(new Particle({
      x, y, vx: U.rand(-0.6, 0.6), vy: U.rand(-0.6, 0.6),
      life: 16, size, color, grav: 0, drag: 0.9, glow: true,
    }));
  }

  function ring(x, y, color, max, speed) { waves.push(new Shockwave(x, y, color, max, speed)); }
  function text(x, y, str, color, size) { texts.push(new FloatText(x, y, str, color, size)); }

  function addShake(amt) { shake = Math.min(shake + amt, 40); }
  function addFlash(amt, color = '#fff') { flash = Math.max(flash, amt); flashColor = color; }
  function hitstop(frames) { hitstopTimer = Math.max(hitstopTimer, frames); }
  function consumeHitstop() { if (hitstopTimer > 0) { hitstopTimer--; return true; } return false; }

  function update() {
    particles = particles.filter(p => p.update());
    waves = waves.filter(w => w.update());
    texts = texts.filter(t => t.update());
    shake *= 0.86; if (shake < 0.3) shake = 0;
    shakeX = U.rand(-shake, shake); shakeY = U.rand(-shake, shake);
    flash *= 0.88; if (flash < 0.02) flash = 0;
  }

  function drawWorld(ctx) {
    for (const w of waves) w.draw(ctx);
    for (const p of particles) p.draw(ctx);
    for (const t of texts) t.draw(ctx);
  }
  function drawOverlay(ctx, w, h) {
    if (flash > 0) {
      ctx.globalAlpha = U.clamp(flash, 0, 1);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  return {
    reset, burst, hitSpark, smoke, trail, ring, text,
    addShake, addFlash, hitstop, consumeHitstop, update,
    drawWorld, drawOverlay,
    get shakeX() { return shakeX; },
    get shakeY() { return shakeY; },
  };
})();
