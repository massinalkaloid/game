// ---------- stage: platforms, blast zones, layered background ----------
class Platform {
  // type: 'solid' (collide from all sides) or 'soft' (land on top, drop through)
  constructor(x, y, w, h, type = 'solid') {
    this.x = x; this.y = y; this.w = w; this.h = h; this.type = type;
  }
  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }
}

class Stage {
  constructor(W, H) {
    this.W = W; this.H = H;
    // blast zones (KO boundaries) extend beyond the visible canvas
    this.blast = { left: -360, right: W + 360, top: -340, bottom: H + 320 };

    const groundY = H * 0.74;
    const mainW = W * 0.52;
    const mainX = (W - mainW) / 2;
    this.platforms = [
      new Platform(mainX, groundY, mainW, 60, 'solid'),
      new Platform(W * 0.28, groundY - 150, W * 0.16, 18, 'soft'),
      new Platform(W * 0.56, groundY - 150, W * 0.16, 18, 'soft'),
      new Platform(W * 0.42, groundY - 280, W * 0.16, 18, 'soft'),
    ];
    this.main = this.platforms[0];
    this.spawnPoints = [
      { x: W * 0.40, y: groundY - 80 },
      { x: W * 0.60, y: groundY - 80 },
      { x: W * 0.34, y: groundY - 200 },
      { x: W * 0.64, y: groundY - 200 },
    ];

    // background decor
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.8,
      r: U.rand(0.4, 1.8), tw: Math.random() * Math.PI * 2, sp: U.rand(0.01, 0.04),
    }));
    this.t = 0;
  }

  update() { this.t += 1; }

  drawBackground(ctx, camShakeX, camShakeY) {
    const { W, H, t } = this;
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1030');
    g.addColorStop(0.45, '#241947');
    g.addColorStop(0.7, '#5b2a5e');
    g.addColorStop(1, '#9a4a52');
    ctx.fillStyle = g;
    ctx.fillRect(-200, -200, W + 400, H + 400);

    // sun / moon glow
    const sx = W * 0.5, sy = H * 0.42;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 280);
    sun.addColorStop(0, 'rgba(255,225,180,0.55)');
    sun.addColorStop(0.4, 'rgba(255,160,120,0.22)');
    sun.addColorStop(1, 'rgba(255,120,120,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(-200, -200, W + 400, H + 400);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,210,170,0.9)';
    ctx.beginPath(); ctx.arc(sx, sy, 70, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // stars
    for (const s of this.stars) {
      s.tw += s.sp;
      const a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#dfe7ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // distant mountains (parallax layers)
    this.drawMountains(ctx, H * 0.62, '#1b1538', 1.0, 120, 0);
    this.drawMountains(ctx, H * 0.70, '#2a1c44', 0.7, 90, 40);

    // floating clouds
    for (let i = 0; i < 5; i++) {
      const cx = (W * 0.2 * i + t * (0.3 + i * 0.05)) % (W + 300) - 150;
      const cy = H * (0.2 + i * 0.07);
      ctx.fillStyle = `rgba(255,200,210,${0.05 + i * 0.015})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 120 - i * 8, 28 - i * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMountains(ctx, baseY, color, amp, step, seed) {
    const { W, H } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-50, H + 50);
    for (let x = -50; x <= W + 50; x += step) {
      const h = (Math.sin((x + seed) * 0.004) * 0.5 + 0.5) * 120 * amp
              + (Math.sin((x + seed) * 0.013) * 0.5 + 0.5) * 50 * amp;
      ctx.lineTo(x, baseY - h);
    }
    ctx.lineTo(W + 50, H + 50);
    ctx.closePath();
    ctx.fill();
  }

  drawPlatforms(ctx) {
    for (const p of this.platforms) {
      if (p === this.main) this.drawMainPlatform(ctx, p);
      else this.drawSoftPlatform(ctx, p);
    }
  }

  drawMainPlatform(ctx, p) {
    // grassy floating island
    const g = ctx.createLinearGradient(0, p.top, 0, p.bottom + 90);
    g.addColorStop(0, '#5fd06a');
    g.addColorStop(0.18, '#3a9e4a');
    g.addColorStop(0.4, '#6b4a2a');
    g.addColorStop(1, '#2c1c14');
    // dirt body tapering down
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p.left, p.top);
    ctx.lineTo(p.right, p.top);
    ctx.lineTo(p.right - 30, p.bottom + 70);
    ctx.lineTo(p.left + 30, p.bottom + 70);
    ctx.closePath();
    ctx.fill();
    // grass top highlight
    ctx.fillStyle = '#7ef07f';
    roundRect(ctx, p.left, p.top - 6, p.w, 14, 6); ctx.fill();
    // top rim shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(p.left, p.top + 12, p.w, 5);
    // edge glow
    ctx.strokeStyle = 'rgba(160,255,170,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.left, p.top); ctx.lineTo(p.right, p.top); ctx.stroke();
  }

  drawSoftPlatform(ctx, p) {
    ctx.save();
    ctx.shadowColor = 'rgba(120,170,255,0.5)';
    ctx.shadowBlur = 16;
    const g = ctx.createLinearGradient(0, p.top, 0, p.bottom);
    g.addColorStop(0, '#9fd2ff');
    g.addColorStop(1, '#3f6bd6');
    ctx.fillStyle = g;
    roundRect(ctx, p.left, p.top, p.w, p.h, p.h / 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, p.left, p.top, p.w, p.h, p.h / 2); ctx.stroke();
  }
}
