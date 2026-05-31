// ---------- entry point: scenes, camera, game loop ----------
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const SCENE = { TITLE: 0, SELECT: 1, BATTLE: 2, RESULT: 3 };
  let scene = SCENE.TITLE;
  let frame = 0;

  // ---- selection state ----
  const sel = {
    cursor: [0, 1],          // which card each player hovers
    ready: [false, false],
    cpu: [false, true],      // P2 is CPU by default
    moveCD: [0, 0],
  };

  // ---- battle state ----
  let stage, fighters, ais, projectiles;
  let cam = { x: W / 2, y: H / 2, zoom: 1, tx: W / 2, ty: H / 2, tz: 1 };
  let battleTime = 99;       // seconds
  let battleFrames = 0;
  let result = null;
  let endTimer = 0;

  // =================== SCENE: TITLE ===================
  function drawTitle() {
    stageBackdrop();
    const cx = W / 2;
    const pulse = 1 + Math.sin(frame * 0.05) * 0.02;

    ctx.save();
    ctx.translate(cx, H * 0.34);
    ctx.scale(pulse, pulse);
    // title glow
    ctx.textAlign = 'center';
    ctx.font = '900 110px system-ui, sans-serif';
    ctx.shadowColor = '#6aa0ff'; ctx.shadowBlur = 40;
    const g = ctx.createLinearGradient(0, -70, 0, 50);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#9fc4ff');
    g.addColorStop(1, '#4a6bd6');
    ctx.fillStyle = g;
    ctx.fillText('SMASH', 0, 0);
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.shadowBlur = 24;
    const g2 = ctx.createLinearGradient(0, 20, 0, 90);
    g2.addColorStop(0, '#ffd86a');
    g2.addColorStop(1, '#ff6a3c');
    ctx.fillStyle = g2;
    ctx.fillText('ARENA', 0, 66);
    ctx.restore();

    // roster preview spinning
    for (let i = 0; i < CHARACTERS.length; i++) {
      const a = frame * 0.012 + i * (Math.PI * 2 / CHARACTERS.length);
      const px = cx + Math.cos(a) * 230;
      const py = H * 0.62 + Math.sin(a) * 46;
      const sc = 0.7 + (Math.sin(a) * 0.5 + 0.5) * 0.6;
      drawMiniFighter(px, py, CHARACTERS[i], sc);
    }

    if (Math.floor(frame / 30) % 2 === 0) {
      ctx.fillStyle = '#dfe7ff';
      ctx.font = '700 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAP  ▶  /  PRESS  F · SPACE  TO  START', cx, H * 0.86);
    }
    ctx.font = '600 14px system-ui';
    ctx.fillStyle = '#7e8bb5';
    ctx.fillText('2 player local · or fight the CPU', cx, H * 0.92);

    if (Input.keyEdge('KeyF') || Input.keyEdge('Period') || Input.menuConfirm()) {
      scene = SCENE.SELECT;
      sel.ready = [false, false];
    }
  }

  function drawMiniFighter(x, y, char, sc) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 44, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    // body
    const g = ctx.createLinearGradient(-20, -20, 20, 40);
    g.addColorStop(0, char.colors.light); g.addColorStop(1, char.colors.dark);
    ctx.fillStyle = g;
    roundRect(ctx, -18, -6, 36, 44, 12); ctx.fill();
    // head
    const hg = ctx.createRadialGradient(-4, -28, 2, 0, -24, 20);
    hg.addColorStop(0, char.colors.light); hg.addColorStop(1, char.colors.main);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, -24, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = char.colors.eye;
    ctx.fillRect(2, -27, 10, 6);
    ctx.restore();
  }

  // =================== SCENE: SELECT ===================
  function updateSelect() {
    stageBackdrop();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.shadowColor = '#6aa0ff'; ctx.shadowBlur = 20;
    ctx.fillText('CHOOSE  YOUR  FIGHTER', W / 2, 80);
    ctx.shadowBlur = 0;

    const n = CHARACTERS.length;
    const cardW = 210, gap = 28;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = (W - totalW) / 2;
    const cardY = 150, cardH = 300;

    // CPU auto-pick
    for (let p = 0; p < 2; p++) {
      if (sel.cpu[p] && !sel.ready[p]) {
        if (sel.moveCD[p] <= 0) {
          sel.cursor[p] = U.randInt(0, n - 1);
          sel.ready[p] = true;
          sel.moveCD[p] = 20;
        }
      }
    }

    // input for each player
    for (let p = 0; p < 2; p++) {
      sel.moveCD[p] = Math.max(0, sel.moveCD[p] - 1);
      if (sel.cpu[p]) continue;
      const inp = Input.getState(p);
      if (!sel.ready[p] && sel.moveCD[p] === 0) {
        if (inp.lx > 0.5) { sel.cursor[p] = (sel.cursor[p] + 1) % n; sel.moveCD[p] = 10; }
        else if (inp.lx < -0.5) { sel.cursor[p] = (sel.cursor[p] + n - 1) % n; sel.moveCD[p] = 10; }
      }
      if (inp.attackEdge) sel.ready[p] = !sel.ready[p];
    }
    // toggle P2 cpu/human with P2 shield key
    if (Input.keyEdge('Slash')) { sel.cpu[1] = !sel.cpu[1]; sel.ready[1] = false; }
    if (Input.keyEdge('KeyH')) { sel.cpu[0] = !sel.cpu[0]; sel.ready[0] = false; }

    // draw cards
    for (let i = 0; i < n; i++) {
      const x = startX + i * (cardW + gap);
      drawCard(CHARACTERS[i], x, cardY, cardW, cardH, i);
    }
    // cursors
    for (let p = 0; p < 2; p++) {
      const i = sel.cursor[p];
      const x = startX + i * (cardW + gap);
      const col = p === 0 ? '#5aa0ff' : '#ff6a6a';
      const off = p === 0 ? -6 : 6;
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.shadowColor = col; ctx.shadowBlur = 16;
      roundRect(ctx, x - 6 + off, cardY - 6, cardW + 12, cardH + 12, 18); ctx.stroke();
      ctx.shadowBlur = 0;
      // label
      ctx.fillStyle = col;
      ctx.font = '800 18px system-ui';
      ctx.textAlign = 'center';
      const label = `P${p + 1}${sel.cpu[p] ? ' (CPU)' : ''}${sel.ready[p] ? ' ✓' : ''}`;
      ctx.fillText(label, x + cardW / 2, cardY + cardH + 34 + p * 22);
    }

    ctx.fillStyle = '#7e8bb5';
    ctx.font = '600 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('P1: A/D 選択 · F 決定 · H でCPU切替    |    P2: ←/→ 選択 · . 決定 · / でCPU切替', W / 2, H - 40);

    if (sel.ready[0] && sel.ready[1]) {
      ctx.fillStyle = Math.floor(frame / 20) % 2 ? '#fff' : '#ffd86a';
      ctx.font = '900 22px system-ui';
      ctx.fillText('SPACE / ENTER ( ▶ ) で バトル開始！', W / 2, H - 70);
      if (Input.menuConfirm()) startBattle();
    }
  }

  function drawCard(char, x, y, w, h, i) {
    ctx.save();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(30,38,66,0.95)');
    g.addColorStop(1, 'rgba(14,18,36,0.95)');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 14); ctx.fill();
    // element banner
    ctx.fillStyle = char.colors.main;
    ctx.globalAlpha = 0.18;
    roundRect(ctx, x, y, w, 90, 14); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    drawMiniFighter(x + w / 2, y + 120, char, 1.7);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '900 26px system-ui';
    ctx.fillText(char.name, x + w / 2, y + 220);
    ctx.fillStyle = '#9fb0d8';
    ctx.font = '600 13px system-ui';
    ctx.fillText(char.desc, x + w / 2, y + 244);

    // stat bars
    const stats = [
      ['SPD', char.stats.run / 7],
      ['PWR', char.attacks.side.dmg / 18],
      ['JMP', char.stats.jump / 16],
      ['WGT', char.stats.weight / 1.4],
    ];
    let sy = y + 262;
    ctx.textAlign = 'left';
    for (const [lab, v] of stats) {
      ctx.fillStyle = '#7e8bb5'; ctx.font = '700 10px system-ui';
      ctx.fillText(lab, x + 16, sy + 8);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, x + 50, sy, w - 66, 6, 3); ctx.fill();
      ctx.fillStyle = char.colors.main;
      roundRect(ctx, x + 50, sy, (w - 66) * U.clamp(v, 0.1, 1), 6, 3); ctx.fill();
      sy += 12;
    }
  }

  // =================== BATTLE ===================
  function startBattle() {
    stage = new Stage(W, H);
    fighters = [];
    ais = [];
    projectiles = [];
    for (let p = 0; p < 2; p++) {
      const f = new Fighter(sel.cursor[p], p, sel.cpu[p], stage);
      fighters.push(f);
      ais.push(sel.cpu[p] ? new AIController(f, 0.75) : null);
    }
    battleTime = 99;
    battleFrames = 0;
    result = null;
    endTimer = 0;
    cam = { x: W / 2, y: H / 2, zoom: 1, tx: W / 2, ty: H / 2, tz: 1 };
    scene = SCENE.BATTLE;
  }

  function updateBattle() {
    const hitstop = FX.consumeHitstop();

    if (!hitstop) {
      stage.update();
      // gather inputs
      const inputs = fighters.map((f, i) => {
        if (ais[i]) return ais[i].think(fighters);
        return Input.getState(i);
      });
      // update fighters
      fighters.forEach((f, i) => f.update(inputs[i], fighters, projectiles));
      fighters.forEach(f => f.tickSpecialFire());

      // projectiles
      for (const pr of projectiles) {
        pr.update(fighters);
        for (const f of fighters) {
          if (f === pr.owner || !f.alive || f.respawnTimer > 0) continue;
          if (U.dist(pr.x, pr.y, f.x, f.y - 10) < pr.size + f.w / 2) {
            f.takeProjectile(pr);
            FX.hitSpark(pr.x, pr.y, pr.spec.color, pr.spec.dmg);
            pr.dead = true;
            break;
          }
        }
      }
      projectiles = projectiles.filter(p => !p.dead);

      FX.update();
      battleFrames++;
      if (battleFrames % 60 === 0 && battleTime > 0) battleTime--;

      // win check
      checkWin();
    }

    // camera follows fighters
    updateCamera();

    // ---- RENDER ----
    renderWorld();

    // HUD
    HUD.draw(ctx, fighters, W, H, battleTime);
    for (const f of fighters) drawOffscreenIndicatorScreen(f);
    FX.drawOverlay(ctx, W, H);

    if (result) drawResultOverlay();
  }

  function checkWin() {
    if (result) { endTimer--; if (endTimer < 0 && Input.menuConfirm()) { scene = SCENE.SELECT; sel.ready = [false, false]; } return; }
    const alive = fighters.filter(f => f.stocks > 0);
    let winner = null;
    if (alive.length <= 1) {
      winner = alive[0] || null;
    } else if (battleTime <= 0 && battleFrames % 60 === 0) {
      // time out: fewer stocks / higher percent loses
      winner = fighters.slice().sort((a, b) =>
        (b.stocks - a.stocks) || (a.percent - b.percent))[0];
    }
    if (winner !== null || (battleTime <= 0)) {
      result = { winner };
      endTimer = 80;
      FX.addFlash(0.5, winner ? winner.char.element : '#fff');
      FX.addShake(14);
    }
  }

  function updateCamera() {
    const live = fighters.filter(f => f.alive);
    let minX = W * 0.5, maxX = W * 0.5, minY = H * 0.5, maxY = H * 0.5;
    if (live.length) {
      minX = Math.min(...live.map(f => f.x));
      maxX = Math.max(...live.map(f => f.x));
      minY = Math.min(...live.map(f => f.head));
      maxY = Math.max(...live.map(f => f.feet));
    }
    const pad = 260;
    const spanX = (maxX - minX) + pad * 2;
    const spanY = (maxY - minY) + pad * 2;
    let zoom = Math.min(W / spanX, H / spanY);
    zoom = U.clamp(zoom, 0.72, 1.18);
    cam.tz = zoom;
    cam.tx = U.clamp((minX + maxX) / 2, W * 0.30, W * 0.70);
    cam.ty = U.clamp((minY + maxY) / 2, H * 0.30, H * 0.62);

    cam.x = U.lerp(cam.x, cam.tx, 0.10);
    cam.y = U.lerp(cam.y, cam.ty, 0.10);
    cam.zoom = U.lerp(cam.zoom, cam.tz, 0.08);
  }

  function renderWorld() {
    ctx.clearRect(0, 0, W, H);
    // background in screen space with subtle parallax from camera
    const px = (cam.x - W / 2) * 0.04;
    const py = (cam.y - H / 2) * 0.04;
    ctx.save();
    ctx.translate(-px, -py);
    stage.drawBackground(ctx, 0, 0);
    ctx.restore();

    // world (camera transform + shake)
    ctx.save();
    ctx.translate(W / 2 + FX.shakeX, H / 2 + FX.shakeY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    stage.drawPlatforms(ctx);
    for (const pr of projectiles) pr.draw(ctx);
    for (const f of fighters) f.draw(ctx);
    FX.drawWorld(ctx);

    ctx.restore();

    HUD.vignette(ctx, W, H);
  }

  function worldToScreen(wx, wy) {
    return {
      x: (wx - cam.x) * cam.zoom + W / 2 + FX.shakeX,
      y: (wy - cam.y) * cam.zoom + H / 2 + FX.shakeY,
    };
  }

  function drawOffscreenIndicatorScreen(f) {
    if (!f.alive) return;
    const s = worldToScreen(f.x, f.y);
    const margin = 46;
    if (s.x > margin && s.x < W - margin && s.y > margin && s.y < H - margin) return;
    const cx = U.clamp(s.x, margin, W - margin);
    const cy = U.clamp(s.y, margin, H - margin);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(s.y - cy, s.x - cx));
    ctx.fillStyle = f.col.main;
    ctx.shadowColor = f.col.main; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = HUD.percentColor(f.percent);
    ctx.font = '900 18px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(Math.floor(f.percent) + '%', cx, cy - 18);
  }

  function drawResultOverlay() {
    ctx.fillStyle = 'rgba(6,8,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const win = result.winner;
    if (win) {
      ctx.font = '900 30px system-ui';
      ctx.fillStyle = '#9fb0d8';
      ctx.fillText('WINNER', W / 2, H * 0.32);
      drawMiniFighter(W / 2, H * 0.5, win.char, 3.2);
      ctx.font = '900 64px system-ui';
      ctx.shadowColor = win.char.element; ctx.shadowBlur = 30;
      const g = ctx.createLinearGradient(0, H * 0.6, 0, H * 0.7);
      g.addColorStop(0, win.col.light); g.addColorStop(1, win.col.main);
      ctx.fillStyle = g;
      ctx.fillText(win.char.name, W / 2, H * 0.72);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = '900 56px system-ui';
      ctx.fillStyle = '#fff';
      ctx.fillText('DRAW', W / 2, H * 0.5);
    }
    if (endTimer < 0 && Math.floor(frame / 25) % 2 === 0) {
      ctx.font = '700 22px system-ui';
      ctx.fillStyle = '#dfe7ff';
      ctx.fillText('SPACE / ENTER ( ▶ ) で キャラ選択へ', W / 2, H * 0.86);
    }
  }

  // shared backdrop for menus
  function stageBackdrop() {
    if (!window._menuStage) window._menuStage = new Stage(W, H);
    window._menuStage.update();
    ctx.clearRect(0, 0, W, H);
    window._menuStage.drawBackground(ctx, 0, 0);
    ctx.fillStyle = 'rgba(6,8,18,0.35)';
    ctx.fillRect(0, 0, W, H);
    HUD.vignette(ctx, W, H);
  }

  // =================== LOOP ===================
  function loop() {
    frame++;
    if (scene === SCENE.TITLE) drawTitle();
    else if (scene === SCENE.SELECT) updateSelect();
    else if (scene === SCENE.BATTLE) updateBattle();

    Input.endFrame();
    requestAnimationFrame(loop);
  }
  loop();
})();
