// ---------- simple but lively CPU controller ----------
// Produces an input-state object compatible with Fighter.update().
class AIController {
  constructor(fighter, level = 0.7) {
    this.f = fighter;
    this.level = level; // 0..1 aggressiveness / reaction
    this.timer = 0;
    this.jumpCD = 0;
    this.attackCD = 0;
    this.specialCD = 0;
    this.wantJump = false;
    this.decision = 0;
    this.target = null;
  }

  pickTarget(opponents) {
    let best = null, bd = 1e9;
    for (const o of opponents) {
      if (o === this.f || !o.alive) continue;
      const d = U.dist(this.f.x, this.f.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  think(opponents) {
    const f = this.f;
    const out = { lx: 0, ly: 0, jump: false, attack: false, special: false, shield: false,
                  jumpEdge: false, attackEdge: false, specialEdge: false };
    if (!f.alive || f.respawnTimer > 0 || f.hitstun > 0) return out;

    this.jumpCD = Math.max(0, this.jumpCD - 1);
    this.attackCD = Math.max(0, this.attackCD - 1);
    this.specialCD = Math.max(0, this.specialCD - 1);

    const t = this.pickTarget(opponents);
    this.target = t;
    if (!t) return out;

    const dx = t.x - f.x;
    const dy = t.y - f.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);

    // --- recovery: if off the main platform and falling, get back ---
    const main = f.stage.main;
    const offStage = f.x < main.left - 10 || f.x > main.right + 10;
    if (offStage && !f.onGround) {
      out.lx = f.x < main.left ? 1 : -1;
      if (f.vy > 1 && this.jumpCD === 0 && f.jumps > 0) {
        out.jump = true; out.jumpEdge = !this.wantJump; this.wantJump = true; this.jumpCD = 14;
      } else { this.wantJump = false; }
      return out;
    }
    this.wantJump = false;

    // --- approach ---
    const facingTarget = U.sign(dx) || f.facing;
    let move = 0;
    if (adx > 70) move = facingTarget;
    else if (adx < 40) move = -facingTarget * 0.3; // spacing
    out.lx = move * (this.level > 0.6 ? 1 : 0.7);

    // jump toward target if above
    if (dy < -50 && this.jumpCD === 0 && Math.random() < 0.05 + this.level * 0.05) {
      out.jump = true; out.jumpEdge = true; this.jumpCD = 25;
    }
    // jump if target is on a higher platform & close horizontally
    if (ady > 120 && adx < 120 && f.onGround && this.jumpCD === 0 && Math.random() < 0.04) {
      out.jump = true; out.jumpEdge = true; this.jumpCD = 30;
    }

    // --- attack when in range ---
    const inRange = adx < 95 && ady < 80;
    if (inRange && this.attackCD === 0 && Math.random() < 0.18 + this.level * 0.25) {
      out.attackEdge = true; out.attack = true;
      // choose direction
      if (dy < -40) out.ly = -1;
      else if (dy > 40) out.ly = 1;
      else out.lx = facingTarget;
      this.attackCD = U.randInt(16, 34);
    }

    // --- special / projectile at range ---
    if (!inRange && adx > 140 && adx < 600 && ady < 60 && this.specialCD === 0 && f.specialCooldown <= 0
        && Math.random() < 0.04 + this.level * 0.05) {
      out.specialEdge = true; out.special = true;
      out.lx = facingTarget * 0.1;
      f.facing = facingTarget;
      this.specialCD = U.randInt(40, 80);
    }

    // --- shield if opponent is attacking nearby ---
    if (inRange && (t.state === 'attack') && Math.random() < 0.2 + this.level * 0.3) {
      out.shield = true;
    }

    // occasional defensive jump when at high percent
    if (f.percent > 110 && adx < 120 && Math.random() < 0.02) {
      out.jump = true; out.jumpEdge = this.jumpCD === 0; this.jumpCD = 30;
    }

    return out;
  }
}
