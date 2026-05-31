// ---------- projectiles ----------
class Projectile {
  constructor(owner, spec, x, y, dir) {
    this.owner = owner;
    this.spec = spec;
    this.x = x; this.y = y;
    this.vx = spec.speed * dir;
    this.vy = 0;
    this.dir = dir;
    this.life = spec.life;
    this.size = spec.size;
    this.dead = false;
    this.homing = spec.homing;
    this.t = 0;
  }
  update(targets) {
    this.t++;
    if (this.homing) {
      let best = null, bd = 1e9;
      for (const tg of targets) {
        if (tg === this.owner || !tg.alive) continue;
        const d = U.dist(this.x, this.y, tg.x, tg.y);
        if (d < bd) { bd = d; best = tg; }
      }
      if (best) {
        const ang = Math.atan2(best.y - this.y, best.x - this.x);
        this.vx = U.lerp(this.vx, Math.cos(ang) * this.spec.speed, 0.08);
        this.vy = U.lerp(this.vy, Math.sin(ang) * this.spec.speed, 0.08);
      }
    }
    this.x += this.vx; this.y += this.vy;
    this.life--;
    FX.trail(this.x, this.y, this.spec.color, this.size * 0.6);
    if (this.life <= 0) this.dead = true;
    return !this.dead;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 1.6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, this.spec.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ---------- fighter ----------
class Fighter {
  constructor(charIndex, playerIndex, isAI, stage) {
    this.char = getCharacter(charIndex);
    this.playerIndex = playerIndex;
    this.isAI = isAI;
    this.stage = stage;
    this.col = this.char.colors;

    this.w = 44; this.h = 88;
    const sp = stage.spawnPoints[playerIndex % stage.spawnPoints.length];
    this.x = sp.x; this.y = sp.y;
    this.vx = 0; this.vy = 0;
    this.facing = playerIndex % 2 === 0 ? 1 : -1;

    this.percent = 0;
    this.stocks = 3;
    this.alive = true;

    this.onGround = false;
    this.jumps = 2;
    this.state = 'idle';
    this.stateTimer = 0;

    // attack
    this.attack = null;       // current move spec
    this.attackName = null;   // jab/side/up/down/air
    this.attackFrame = 0;
    this.hitList = new Set(); // fighters already hit by this active hitbox
    this.specialCooldown = 0;

    // defense
    this.shielding = false;
    this.shieldHealth = 100;
    this.invincible = 0;       // i-frames
    this.hitstun = 0;
    this.dodgeTimer = 0;

    // visuals
    this.anim = 0;             // walk cycle phase
    this.squash = 1;           // y-scale for landing/jump
    this.afterimages = [];     // {x,y,a,facing,pose}
    this.faceFlash = 0;
    this.dropThrough = 0;      // frames to ignore soft platforms
    this.respawnTimer = 0;
    this.flinch = 0;
  }

  get feet() { return this.y + this.h / 2; }
  get head() { return this.y - this.h / 2; }

  // ---- main update ----
  update(input, opponents, projectiles) {
    const s = this.char.stats;

    if (this.respawnTimer > 0) {
      this.respawnTimer--;
      if (this.respawnTimer === 0) this.finishRespawn();
      return;
    }
    if (!this.alive) return;

    if (this.invincible > 0) this.invincible--;
    if (this.specialCooldown > 0) this.specialCooldown--;
    if (this.faceFlash > 0) this.faceFlash--;
    if (this.dropThrough > 0) this.dropThrough--;
    if (this.flinch > 0) this.flinch--;

    const acting = this.state === 'attack' || this.state === 'special';
    const stunned = this.hitstun > 0;
    const dodging = this.state === 'dodge';

    // -------- knockback / hitstun --------
    if (stunned) {
      this.hitstun--;
      // light directional influence
      this.vx += input.lx * 0.18;
      this.vy += input.ly * 0.12;
      if (this.hitstun === 0 && this.state === 'launched') this.state = 'fall';
    }

    // -------- shield & dodge (only on ground/neutral, not while stunned/acting) --------
    if (!stunned && !acting && !dodging) {
      if (input.shield && this.shieldHealth > 4) {
        if (!this.shielding && (Math.abs(input.lx) > 0.5)) {
          // roll dodge
          this.startDodge(U.sign(input.lx) * 8, 18);
        } else if (!this.shielding && this.onGround && input.ly > 0.5) {
          this.startDodge(0, 16, true); // spot dodge
        } else if (!this.onGround && !this.shielding) {
          // air dodge
          this.startDodge(input.lx * 6, 22, false, input.ly * 6);
        } else {
          this.shielding = true;
        }
      } else {
        this.shielding = false;
      }
    } else {
      this.shielding = false;
    }

    if (this.shielding) {
      this.shieldHealth = Math.max(0, this.shieldHealth - 0.5);
      if (this.shieldHealth <= 4) { this.shielding = false; this.flinch = 40; }
      this.vx *= 0.7;
    } else if (this.shieldHealth < 100) {
      this.shieldHealth = Math.min(100, this.shieldHealth + 0.35);
    }

    if (dodging) {
      this.dodgeTimer--;
      if (this.dodgeTimer <= 0) { this.state = this.onGround ? 'idle' : 'fall'; }
    }

    const canMove = !stunned && !this.shielding && !dodging &&
                    this.state !== 'attack' && this.state !== 'special' && this.flinch === 0;
    const canAct = !stunned && !this.shielding && !dodging && this.flinch === 0;

    // -------- horizontal movement --------
    if (canMove) {
      if (this.onGround) {
        if (Math.abs(input.lx) > 0.2) {
          const target = input.lx * (Math.abs(input.lx) > 0.85 ? s.run : s.walk);
          this.vx = U.approach(this.vx, target, 1.2);
          this.facing = U.sign(input.lx);
          this.state = Math.abs(input.lx) > 0.85 ? 'run' : 'walk';
        } else {
          this.vx = U.approach(this.vx, 0, 1.4);
          if (this.state === 'run' || this.state === 'walk') this.state = 'idle';
          if (this.state === 'idle' || this.state === 'fall' || this.state === 'jump') this.state = 'idle';
        }
      } else {
        // air drift
        if (Math.abs(input.lx) > 0.2) {
          this.vx = U.approach(this.vx, input.lx * s.air, 0.5);
          this.facing = U.sign(input.lx);
        } else {
          this.vx = U.approach(this.vx, 0, 0.18);
        }
      }
    }

    // -------- jumping --------
    if (canAct && input.jumpEdge && this.jumps > 0 && input.ly < 0.5) {
      if (this.onGround) { this.vy = -s.jump; this.jumps = 1; this.squash = 0.7; }
      else { this.vy = -s.dJump; this.jumps--; this.squash = 0.75;
             FX.ring(this.x, this.feet, this.col.light, 60, 5);
             FX.burst(this.x, this.feet, this.char.element, 8, { speed: 4, up: 2 }); }
      this.onGround = false;
      this.state = 'jump';
    }
    // short hop / variable jump
    if (!input.jump && this.vy < -6 && !this.onGround && this.state === 'jump') this.vy *= 0.96;

    // -------- fast fall / drop through --------
    if (!this.onGround && input.ly > 0.6 && this.vy > 0 && canMove) {
      this.vy = Math.min(this.vy + 1.2, s.fall * 28 * s.fastFall);
    }

    // -------- attacks --------
    if (canAct && input.attackEdge) this.startAttack(input);
    if (canAct && input.specialEdge && this.specialCooldown <= 0) this.startSpecial(projectiles, opponents);

    // -------- gravity --------
    const grav = s.fall;
    this.vy += grav;
    const maxFall = (input.ly > 0.6 ? 26 : 18);
    if (this.vy > maxFall) this.vy = maxFall;

    // -------- integrate + collide --------
    this.x += this.vx;
    this.y += this.vy;
    this.collide(input);

    // -------- progress attack state machine --------
    if (this.state === 'attack') this.updateAttack(opponents);
    if (this.state === 'special') {
      this.attackFrame++;
      if (this.attackFrame >= this.attack.end) { this.state = this.onGround ? 'idle' : 'fall'; this.attack = null; }
    }

    // squash recover
    this.squash = U.approach(this.squash, 1, 0.06);

    // animation phase
    if (this.state === 'run' || this.state === 'walk') this.anim += 0.3;
    else this.anim += 0.08;

    // afterimages when fast
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 12 || this.hitstun > 0) {
      this.afterimages.push({ x: this.x, y: this.y, a: 0.5, facing: this.facing, squash: this.squash });
    }
    for (const ai of this.afterimages) ai.a -= 0.06;
    this.afterimages = this.afterimages.filter(ai => ai.a > 0);
    if (this.afterimages.length > 10) this.afterimages.shift();

    // blast zone KO
    this.checkBlastZone();
  }

  collide(input) {
    const st = this.stage;
    this.onGround = false;
    this.standingOnSoft = false;
    const half = this.w / 2;

    for (const p of st.platforms) {
      const withinX = this.x + half > p.left && this.x - half < p.right;
      if (!withinX) continue;
      const feet = this.feet;

      if (p.type === 'solid') {
        // land on top
        if (this.vy >= 0 && feet - this.vy <= p.top + 2 && feet >= p.top && feet < p.bottom) {
          this.land(p.top);
        }
        // hit underside
        else if (this.vy < 0 && this.head <= p.bottom && this.head - this.vy >= p.bottom - 2) {
          this.y = p.bottom + this.h / 2; this.vy = 1;
        }
        // side walls
        if (feet > p.top + 6 && this.head < p.bottom - 6) {
          if (this.vx > 0 && this.x + half > p.left && this.x - half < p.left) { this.x = p.left - half; this.vx = 0; }
          else if (this.vx < 0 && this.x - half < p.right && this.x + half > p.right) { this.x = p.right + half; this.vx = 0; }
        }
      } else { // soft
        const dropping = input.ly > 0.6;
        if (this.vy >= 0 && feet - this.vy <= p.top + 4 && feet >= p.top && feet < p.top + 24
            && this.dropThrough <= 0) {
          if (dropping) { this.dropThrough = 12; }
          else { this.land(p.top); this.standingOnSoft = true; }
        }
      }
    }
  }

  land(topY) {
    this.y = topY - this.h / 2;
    if (this.vy > 12) { FX.smoke(this.x, this.feet, 'rgba(220,220,255,0.5)'); this.squash = 0.7; FX.addShake(this.vy * 0.15); }
    this.vy = 0;
    this.onGround = true;
    this.jumps = 2;
    if (this.state === 'jump' || this.state === 'fall' || this.state === 'launched') {
      this.state = 'idle';
    }
  }

  // ---- attacks ----
  startAttack(input) {
    let name;
    if (!this.onGround) name = 'air';
    else if (input.ly < -0.5) name = 'up';
    else if (input.ly > 0.5) name = 'down';
    else if (Math.abs(input.lx) > 0.5) name = 'side';
    else name = 'jab';

    const move = this.char.attacks[name];
    this.attack = move; this.attackName = name; this.attackFrame = 0;
    this.hitList.clear();
    this.state = 'attack';
    if (this.onGround && name !== 'jab') this.vx *= 0.5;
    if (name === 'side' || name === 'down') this.vx += this.facing * 1.5;
  }

  updateAttack(opponents) {
    this.attackFrame++;
    const m = this.attack;
    const active = this.attackFrame > m.start && this.attackFrame <= m.start + m.active;
    if (active) {
      const hb = this.worldHitbox(m.hb);
      // spark at sword/fist on first active frame
      if (this.attackFrame === m.start + 1) {
        FX.burst(hb.cx, hb.cy, this.char.element, 6, { speed: 3, life: 12, size: 3 });
      }
      for (const o of opponents) {
        if (o === this || !o.alive || o.respawnTimer > 0) continue;
        if (this.hitList.has(o)) continue;
        if (o.invincible > 0 || o.state === 'dodge') continue;
        if (this.overlapHit(hb, o)) {
          this.hitList.add(o);
          o.takeHit(m, this);
        }
      }
    }
    if (this.attackFrame >= m.start + m.active + m.end) {
      this.state = this.onGround ? 'idle' : 'fall';
      this.attack = null;
    }
  }

  worldHitbox(hb) {
    const cx = this.x + this.facing * hb.sx;
    const cy = this.y + hb.sy;
    return { cx, cy, w: hb.w, h: hb.h, left: cx - hb.w / 2, right: cx + hb.w / 2, top: cy - hb.h / 2, bottom: cy + hb.h / 2 };
  }
  overlapHit(hb, o) {
    return hb.right > o.x - o.w / 2 && hb.left < o.x + o.w / 2 &&
           hb.bottom > o.head && hb.top < o.feet;
  }

  startSpecial(projectiles, opponents) {
    const sp = this.char.attacks.special;
    this.state = 'special';
    this.attack = sp; this.attackFrame = 0;
    this.specialCooldown = sp.cooldown;
    if (this.onGround) this.vx *= 0.3;
    // spawn projectile after a brief windup using a timeout-like check next frames:
    this._specSpawnAt = sp.start;
    this._specProjectiles = projectiles;
    // we fire via a hook in update by checking frame; simpler: spawn now scheduled
    const fire = () => {
      const px = this.x + this.facing * 40;
      const py = this.y - 6;
      projectiles.push(new Projectile(this, sp, px, py, this.facing));
      FX.ring(px, py, sp.color, 50, 5);
      FX.burst(px, py, sp.color, 10, { speed: 4 });
      FX.addShake(3);
    };
    this._fireSpecial = fire;
    this._specialFired = false;
  }

  // ---- taking damage ----
  takeHit(move, attacker) {
    if (this.shielding) {
      this.shieldHealth = Math.max(0, this.shieldHealth - move.dmg * 1.6 - 4);
      this.vx += attacker.facing * (move.dir[0]) * 2;
      FX.hitSpark(this.x + this.facing * -20, this.y - 10, '#9fd0ff', 4);
      FX.ring(this.x, this.y, '#bfe0ff', 50, 5);
      FX.hitstop(4);
      if (this.shieldHealth <= 0) { this.shielding = false; this.flinch = 80; FX.text(this.x, this.head - 10, 'SHIELD BREAK!', '#ff6', 22); }
      return;
    }

    const dir = move.dir;
    const facing = attacker.facing;
    // knockback grows with current percent (smash-like)
    // smash-like: base knockback + growth that scales with current damage %,
    // reduced by the receiver's weight. Tuned so jabs barely nudge while
    // smashes KO around 100-130%.
    const growth = move.kbScale * this.percent * 0.34;
    let power = (move.baseKb + growth) / (0.6 + this.char.stats.weight * 0.42);
    power = U.clamp(power, 2, 60);

    const dx = dir[0] * facing;
    const dy = dir[1];
    const mag = Math.hypot(dx, dy) || 1;
    this.vx = (dx / mag) * power;
    this.vy = (dy / mag) * power - 1.5;

    this.percent += move.dmg;
    this.hitstun = Math.floor(power * 1.7 + 6);
    this.state = 'launched';
    this.onGround = false;
    this.shielding = false;
    this.faceFlash = 8;
    this.flinch = 0;

    const hx = this.x, hy = this.y - 10;
    FX.hitSpark(hx, hy, attacker.char.element, move.dmg);
    FX.hitstop(move.hitstop || 6);
    FX.addShake(4 + move.dmg * 0.5);
    FX.addFlash(0.12 + Math.min(0.2, power * 0.006), '#fff');
    if (power > 24) {
      FX.text(hx, hy - 40, 'SMASH!', this.col.accent, 30);
      FX.addFlash(0.3, attacker.char.element);
    }
  }

  takeProjectile(proj) {
    if (this.shielding) {
      this.shieldHealth = Math.max(0, this.shieldHealth - proj.spec.dmg * 1.4 - 3);
      FX.hitSpark(this.x, this.y - 10, '#9fd0ff', 3);
      if (this.shieldHealth <= 0) { this.shielding = false; this.flinch = 80; }
      return;
    }
    if (this.invincible > 0 || this.state === 'dodge') return;
    const m = { baseKb: proj.spec.baseKb, kbScale: proj.spec.kbScale, dmg: proj.spec.dmg,
                dir: [1, -0.4], hitstop: 6 };
    const fakeAttacker = { facing: proj.dir, char: proj.owner.char };
    this.takeHit(m, fakeAttacker);
  }

  startDodge(vx, frames, spot = false, vy = 0) {
    this.state = 'dodge';
    this.dodgeTimer = frames;
    this.invincible = Math.max(this.invincible, frames - 2);
    this.vx = spot ? 0 : vx;
    if (vy) this.vy = vy;
    if (!spot && Math.abs(vx) > 1) this.facing = U.sign(vx) || this.facing;
    FX.burst(this.x, this.y, '#ffffff', 8, { speed: 3, life: 12, glow: true });
  }

  checkBlastZone() {
    const b = this.stage.blast;
    if (this.x < b.left || this.x > b.right || this.y < b.top || this.y > b.bottom) {
      this.die();
    }
  }

  die() {
    this.stocks--;
    this.alive = false;
    // big explosion at the edge
    const b = this.stage.blast;
    const ex = U.clamp(this.x, 20, this.stage.W - 20);
    const ey = U.clamp(this.y, 20, this.stage.H - 20);
    FX.burst(ex, ey, this.char.element, 30, { speed: 9, life: 30, size: 7 });
    FX.ring(ex, ey, this.char.element, 160, 12);
    FX.ring(ex, ey, '#fff', 110, 10);
    FX.addShake(18);
    FX.addFlash(0.4, this.char.element);
    FX.text(ex, ey, 'KO!', '#fff', 40);
    if (this.stocks > 0) {
      this.respawnTimer = 70;
    }
  }

  finishRespawn() {
    const sp = this.stage.spawnPoints[this.playerIndex % this.stage.spawnPoints.length];
    this.x = sp.x; this.y = sp.y - 60;
    this.vx = 0; this.vy = 0;
    this.percent = 0;
    this.alive = true;
    this.state = 'fall';
    this.hitstun = 0;
    this.invincible = 90;
    this.jumps = 2;
    this.shieldHealth = 100;
    this.afterimages = [];
  }

  // fire scheduled special projectile (called from main loop after update)
  tickSpecialFire() {
    if (this.state === 'special' && !this._specialFired && this.attackFrame >= this._specSpawnAt) {
      this._specialFired = true;
      if (this._fireSpecial) this._fireSpecial();
    }
  }

  // =================== DRAWING ===================
  draw(ctx) {
    if (!this.alive && this.respawnTimer <= 0) return;
    if (this.respawnTimer > 0) { this.drawRespawnGhost(ctx); return; }

    // afterimages
    for (const ai of this.afterimages) {
      ctx.globalAlpha = ai.a * 0.5;
      this.drawBody(ctx, ai.x, ai.y, ai.facing, ai.squash || 1, true);
      ctx.globalAlpha = 1;
    }

    const blink = this.invincible > 0 && Math.floor(this.invincible / 3) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.45;
    this.drawBody(ctx, this.x, this.y, this.facing, this.squash, false);
    ctx.globalAlpha = 1;

    if (this.shielding) this.drawShield(ctx);
    this.drawAttackFx(ctx);
  }

  drawRespawnGhost(ctx) {
    const sp = this.stage.spawnPoints[this.playerIndex % this.stage.spawnPoints.length];
    const t = 1 - this.respawnTimer / 70;
    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 20);
    ctx.strokeStyle = this.col.main;
    ctx.lineWidth = 2;
    roundRect(ctx, sp.x - 30, sp.y - 110, 60, 100, 12); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawBody(ctx, x, y, facing, squash, ghost) {
    const c = this.col;
    const w = this.w, h = this.h;
    const stretch = 1 / squash;
    ctx.save();
    ctx.translate(x, y + h / 2);
    ctx.scale(facing, 1);
    ctx.scale(squash, stretch);
    ctx.translate(0, -h / 2);

    const t = this.anim;
    const moving = this.state === 'run' || this.state === 'walk';
    const swing = moving ? Math.sin(t) : 0;
    const armSwing = moving ? Math.sin(t) : Math.sin(t * 0.5) * 0.15;

    // shadow under feet (only main)
    if (!ghost) {
      ctx.save();
      ctx.scale(1 / squash, squash);
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, h - 2, w * 0.6, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ---- legs ----
    const legY = h * 0.55;
    this.capsule(ctx, -8 + swing * 6, legY, 12, h * 0.42, c.dark, c.main, swing * 0.4);
    this.capsule(ctx, 8 - swing * 6, legY, 12, h * 0.42, c.dark, c.main, -swing * 0.4);

    // ---- torso ----
    const tg = ctx.createLinearGradient(-w / 2, h * 0.18, w / 2, h * 0.6);
    tg.addColorStop(0, c.light);
    tg.addColorStop(0.4, c.main);
    tg.addColorStop(1, c.dark);
    ctx.fillStyle = tg;
    roundRect(ctx, -w * 0.36, h * 0.2, w * 0.72, h * 0.42, 12); ctx.fill();
    // chest accent
    ctx.fillStyle = c.accent;
    roundRect(ctx, -w * 0.1, h * 0.24, w * 0.2, h * 0.30, 5); ctx.fill();
    // rim light
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    roundRect(ctx, -w * 0.36, h * 0.2, w * 0.72, h * 0.42, 12); ctx.stroke();

    // ---- arms (pose depends on state) ----
    this.drawArms(ctx, armSwing);

    // ---- head ----
    const hx = 0, hy = h * 0.1;
    const hg = ctx.createRadialGradient(hx - 5, hy - 5, 2, hx, hy, 22);
    hg.addColorStop(0, c.light);
    hg.addColorStop(1, c.main);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(hx, hy, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    // visor / eyes
    ctx.fillStyle = this.faceFlash > 0 ? '#fff' : c.eye;
    roundRect(ctx, 2, hy - 6, 12, 7, 3); ctx.fill();
    ctx.fillStyle = this.faceFlash > 0 ? '#f44' : c.dark;
    ctx.fillRect(6, hy - 5, 4, 5);
    // little crest
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(-2, hy - 18); ctx.lineTo(8, hy - 28); ctx.lineTo(10, hy - 16); ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawArms(ctx, armSwing) {
    const c = this.col, w = this.w, h = this.h;
    let frontArmAngle = 0.3 + armSwing * 0.5;
    let backArmAngle = -0.3 - armSwing * 0.5;

    if (this.state === 'attack' && this.attack) {
      const prog = this.attackFrame / (this.attack.start + this.attack.active + this.attack.end);
      if (this.attackName === 'up') frontArmAngle = -1.7 + prog * 0.6;
      else if (this.attackName === 'down') frontArmAngle = 1.4;
      else frontArmAngle = -0.2 + prog * 1.6; // forward swing
    } else if (this.state === 'special') {
      frontArmAngle = -0.1;
    } else if (this.shielding) {
      frontArmAngle = 0.1; backArmAngle = 0.1;
    } else if (!this.onGround) {
      frontArmAngle = -0.6 - armSwing * 0.3; backArmAngle = 0.5;
    }

    // back arm
    this.armPivot(ctx, -w * 0.28, h * 0.24, backArmAngle, c.dark, c.dark);
    // front arm
    this.armPivot(ctx, w * 0.28, h * 0.24, frontArmAngle, c.main, c.light);
  }

  armPivot(ctx, px, py, angle, col, hand) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    const len = this.h * 0.34, ww = 11;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, hand); g.addColorStop(1, col);
    ctx.fillStyle = g;
    roundRect(ctx, -ww / 2, -ww / 2, ww, len, ww / 2); ctx.fill();
    // hand
    ctx.fillStyle = this.col.light;
    ctx.beginPath(); ctx.arc(0, len, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  capsule(ctx, x, yTop, ww, len, col, hi, lean) {
    ctx.save();
    ctx.translate(x, yTop);
    ctx.rotate(lean || 0);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, hi); g.addColorStop(1, col);
    ctx.fillStyle = g;
    roundRect(ctx, -ww / 2, 0, ww, len, ww / 2); ctx.fill();
    // foot
    ctx.fillStyle = col;
    roundRect(ctx, -ww / 2 - 2, len - 6, ww + 8, 9, 4); ctx.fill();
    ctx.restore();
  }

  drawShield(ctx) {
    const r = 30 + this.shieldHealth * 0.28;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, r * 0.3, this.x, this.y, r);
    const a = 0.25 + this.shieldHealth / 400;
    g.addColorStop(0, `rgba(150,200,255,${a * 0.5})`);
    g.addColorStop(0.7, `rgba(120,170,255,${a})`);
    g.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = `rgba(190,220,255,${0.5 + this.shieldHealth / 300})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.stroke();
  }

  drawAttackFx(ctx) {
    if (this.state !== 'attack' || !this.attack) return;
    const m = this.attack;
    const active = this.attackFrame > m.start && this.attackFrame <= m.start + m.active;
    if (!active) return;
    const hb = this.worldHitbox(m.hb);
    // motion arc slash
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const prog = (this.attackFrame - m.start) / m.active;
    ctx.translate(hb.cx, hb.cy);
    ctx.rotate((this.attackName === 'up' ? -Math.PI / 2 : this.attackName === 'down' ? Math.PI / 2 : 0));
    const g = ctx.createLinearGradient(-hb.w / 2, 0, hb.w / 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, this.char.element);
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.strokeStyle = g;
    ctx.globalAlpha = 0.8 * (1 - Math.abs(prog - 0.5));
    ctx.lineWidth = hb.h * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, hb.w * 0.5, -1.1 + prog * 0.6, 0.9 + prog * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  // HUD portrait icon
  drawPortrait(ctx, x, y, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, this.col.light); g.addColorStop(1, this.col.dark);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = this.col.main;
    ctx.beginPath(); ctx.arc(x, y + r * 0.2, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.col.eye;
    ctx.fillRect(x - 4, y - 3, 8, 5);
    ctx.restore();
    ctx.strokeStyle = this.col.main; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }
}
