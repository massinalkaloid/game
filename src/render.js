// ---------- HUD + screen framing ----------
const HUD = (() => {

  function percentColor(p) {
    // green -> yellow -> orange -> red as damage rises
    const t = U.clamp(p / 180, 0, 1);
    const hue = U.lerp(60, 0, t);      // 60=yellow .. 0=red
    const light = U.lerp(70, 52, t);
    return `hsl(${hue},90%,${light}%)`;
  }

  function drawPlayer(ctx, f, x, y, idx) {
    const w = 230, h = 96;
    // panel
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(28,34,58,0.92)');
    g.addColorStop(1, 'rgba(12,16,32,0.92)');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 14); ctx.fill();
    ctx.restore();
    // accent stripe
    ctx.fillStyle = f.col.main;
    roundRect(ctx, x, y, 6, h, 3); ctx.fill();

    // portrait
    f.drawPortrait(ctx, x + 46, y + 40, 30);

    // name
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cdd8ff';
    ctx.fillText(f.char.name, x + 86, y + 26);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#7e8bb5';
    ctx.fillText('P' + (idx + 1) + (f.isAI ? ' · CPU' : ''), x + 86, y + 42);

    // percent
    const pc = percentColor(f.percent);
    ctx.textAlign = 'right';
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.fillStyle = pc;
    ctx.shadowColor = pc; ctx.shadowBlur = f.percent > 100 ? 14 : 4;
    ctx.fillText(Math.floor(f.percent), x + w - 16, y + 56);
    ctx.shadowBlur = 0;
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = pc;
    ctx.fillText('%', x + w - 8, y + 56);

    // stocks (little icons)
    ctx.textAlign = 'left';
    for (let i = 0; i < f.stocks; i++) {
      const sx = x + 88 + i * 18, sy = y + 64;
      ctx.fillStyle = f.col.main;
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // shield bar
    if (f.shieldHealth < 100) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, x + 88, y + 76, 120, 6, 3); ctx.fill();
      ctx.fillStyle = f.shieldHealth < 30 ? '#ff6a6a' : '#7fd0ff';
      roundRect(ctx, x + 88, y + 76, 120 * f.shieldHealth / 100, 6, 3); ctx.fill();
    }
  }

  function draw(ctx, fighters, W, H, time) {
    drawPlayer(ctx, fighters[0], 24, H - 120, 0);
    drawPlayer(ctx, fighters[1], W - 24 - 230, H - 120, 1);

    // timer
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const mm = Math.floor(time / 60), ss = Math.floor(time % 60);
    const ts = `${mm}:${ss.toString().padStart(2, '0')}`;
    ctx.fillStyle = 'rgba(10,14,28,0.7)';
    roundRect(ctx, W / 2 - 60, 18, 120, 48, 12); ctx.fill();
    ctx.fillStyle = time < 10 ? '#ff6a6a' : '#e8eeff';
    ctx.fillText(ts, W / 2, 52);
  }

  function vignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.9);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  return { draw, vignette, percentColor };
})();

// off-screen arrow indicator when a fighter is far out of view
function drawOffscreenIndicator(ctx, f, W, H) {
  if (!f.alive) return;
  const margin = 40;
  if (f.x > margin && f.x < W - margin && f.y > margin && f.y < H - margin) return;
  const cx = U.clamp(f.x, margin, W - margin);
  const cy = U.clamp(f.y, margin, H - margin);
  ctx.save();
  ctx.translate(cx, cy);
  const ang = Math.atan2(f.y - cy, f.x - cx);
  ctx.rotate(ang);
  ctx.fillStyle = f.col.main;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // percent near arrow
  ctx.fillStyle = HUD.percentColor(f.percent);
  ctx.font = '900 18px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(Math.floor(f.percent) + '%', cx, cy - 16);
}
