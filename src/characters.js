// ---------- character roster: stats, palette, movesets ----------
// Attacks describe a hitbox spawned relative to the fighter, plus damage/knockback.
// hb: { sx, sy, w, h }  offsets in facing space (sx>0 = in front)
// kb base/scaling tuned so KOs happen around 90-150% depending on the move.

const CHARACTERS = [
  {
    id: 'blaze',
    name: 'BLAZE',
    desc: '炎の格闘家・バランス型',
    colors: { main: '#ff5a3c', dark: '#b8261a', light: '#ffd0a0', accent: '#ffcf3a', eye: '#fff' },
    element: '#ff7a3c',
    stats: { walk: 3.0, run: 5.6, air: 4.2, jump: 14.5, dJump: 14, fall: 0.62, fastFall: 1.05, weight: 1.0 },
    attacks: {
      jab:   { dmg: 4,  baseKb: 3,  kbScale: 0.10, dir: [1, -0.15], hb: { sx: 34, sy: -6, w: 48, h: 40 }, start: 3, active: 4, end: 8, hitstop: 5 },
      side:  { dmg: 12, baseKb: 7,  kbScale: 0.62, dir: [1, -0.35], hb: { sx: 40, sy: -4, w: 66, h: 50 }, start: 8, active: 5, end: 22, hitstop: 11, name: 'flame punch' },
      up:    { dmg: 10, baseKb: 8,  kbScale: 0.58, dir: [0.15, -1], hb: { sx: 6, sy: -64, w: 56, h: 70 }, start: 6, active: 5, end: 18, hitstop: 9 },
      down:  { dmg: 9,  baseKb: 6,  kbScale: 0.50, dir: [0.8, -0.55], hb: { sx: 18, sy: 30, w: 80, h: 38 }, start: 7, active: 4, end: 20, hitstop: 8 },
      air:   { dmg: 9,  baseKb: 6,  kbScale: 0.42, dir: [1, -0.4], hb: { sx: 30, sy: 0, w: 64, h: 64 }, start: 5, active: 6, end: 14, hitstop: 7 },
      special: {
        type: 'projectile', dmg: 7, baseKb: 5, kbScale: 0.30, speed: 11, life: 60,
        size: 22, color: '#ff7a2c', start: 12, end: 30, cooldown: 28, name: 'fireball',
      },
    },
  },
  {
    id: 'volt',
    name: 'VOLT',
    desc: '電撃の忍者・スピード型',
    colors: { main: '#36c6ff', dark: '#1858b8', light: '#d6f4ff', accent: '#b9ff3a', eye: '#fff' },
    element: '#7adcff',
    stats: { walk: 3.4, run: 6.6, air: 5.0, jump: 15.5, dJump: 14.5, fall: 0.58, fastFall: 1.0, weight: 0.85 },
    attacks: {
      jab:   { dmg: 3,  baseKb: 3,  kbScale: 0.08, dir: [1, -0.1], hb: { sx: 32, sy: -6, w: 46, h: 36 }, start: 2, active: 3, end: 6, hitstop: 4 },
      side:  { dmg: 10, baseKb: 6,  kbScale: 0.55, dir: [1, -0.25], hb: { sx: 44, sy: -2, w: 72, h: 40 }, start: 6, active: 4, end: 18, hitstop: 9, name: 'dash slash' },
      up:    { dmg: 9,  baseKb: 8,  kbScale: 0.60, dir: [0.1, -1], hb: { sx: 4, sy: -68, w: 50, h: 78 }, start: 5, active: 5, end: 16, hitstop: 8 },
      down:  { dmg: 8,  baseKb: 5,  kbScale: 0.46, dir: [0.7, -0.5], hb: { sx: 14, sy: 28, w: 76, h: 36 }, start: 6, active: 4, end: 18, hitstop: 7 },
      air:   { dmg: 7,  baseKb: 5,  kbScale: 0.40, dir: [1, -0.35], hb: { sx: 28, sy: 0, w: 60, h: 60 }, start: 4, active: 6, end: 12, hitstop: 6 },
      special: {
        type: 'projectile', dmg: 6, baseKb: 4, kbScale: 0.26, speed: 14, life: 50,
        size: 16, color: '#bff84a', start: 9, end: 24, cooldown: 22, name: 'spark',
      },
    },
  },
  {
    id: 'titan',
    name: 'TITAN',
    desc: '鋼鉄の巨人・パワー型',
    colors: { main: '#b9c2d0', dark: '#4a5466', light: '#eef3ff', accent: '#ffae3a', eye: '#ff5a5a' },
    element: '#ffae3a',
    stats: { walk: 2.4, run: 4.4, air: 3.4, jump: 13.0, dJump: 12.5, fall: 0.7, fastFall: 1.15, weight: 1.35 },
    attacks: {
      jab:   { dmg: 6,  baseKb: 4,  kbScale: 0.14, dir: [1, -0.2], hb: { sx: 40, sy: -8, w: 56, h: 48 }, start: 5, active: 4, end: 12, hitstop: 7 },
      side:  { dmg: 17, baseKb: 9,  kbScale: 0.74, dir: [1, -0.35], hb: { sx: 46, sy: -6, w: 78, h: 60 }, start: 13, active: 6, end: 30, hitstop: 14, name: 'mega swing' },
      up:    { dmg: 14, baseKb: 9,  kbScale: 0.66, dir: [0.2, -1], hb: { sx: 8, sy: -70, w: 70, h: 80 }, start: 9, active: 6, end: 24, hitstop: 12 },
      down:  { dmg: 13, baseKb: 8,  kbScale: 0.58, dir: [0.75, -0.5], hb: { sx: 20, sy: 32, w: 96, h: 44 }, start: 10, active: 5, end: 26, hitstop: 12 },
      air:   { dmg: 13, baseKb: 8,  kbScale: 0.5,  dir: [1, -0.4], hb: { sx: 34, sy: 2, w: 76, h: 76 }, start: 8, active: 6, end: 18, hitstop: 11 },
      special: {
        type: 'projectile', dmg: 10, baseKb: 7, kbScale: 0.34, speed: 8, life: 70,
        size: 30, color: '#ffae3a', start: 16, end: 38, cooldown: 40, name: 'boulder',
      },
    },
  },
  {
    id: 'lumen',
    name: 'LUMEN',
    desc: '光の魔導士・トリッキー型',
    colors: { main: '#c87aff', dark: '#5e2aa8', light: '#f2e0ff', accent: '#5affd0', eye: '#fff' },
    element: '#c87aff',
    stats: { walk: 3.1, run: 5.2, air: 4.6, jump: 15.0, dJump: 15.5, fall: 0.5, fastFall: 0.95, weight: 0.8 },
    attacks: {
      jab:   { dmg: 4,  baseKb: 3,  kbScale: 0.10, dir: [1, -0.15], hb: { sx: 34, sy: -8, w: 50, h: 44 }, start: 4, active: 3, end: 8, hitstop: 5 },
      side:  { dmg: 11, baseKb: 6,  kbScale: 0.58, dir: [1, -0.4], hb: { sx: 42, sy: -6, w: 70, h: 56 }, start: 9, active: 5, end: 22, hitstop: 10, name: 'prism beam' },
      up:    { dmg: 10, baseKb: 8,  kbScale: 0.6,  dir: [0.1, -1], hb: { sx: 4, sy: -66, w: 60, h: 76 }, start: 7, active: 5, end: 18, hitstop: 9 },
      down:  { dmg: 9,  baseKb: 6,  kbScale: 0.5,  dir: [0.7, -0.55], hb: { sx: 16, sy: 30, w: 82, h: 40 }, start: 8, active: 4, end: 20, hitstop: 8 },
      air:   { dmg: 8,  baseKb: 6,  kbScale: 0.44, dir: [1, -0.4], hb: { sx: 30, sy: 0, w: 66, h: 66 }, start: 5, active: 6, end: 14, hitstop: 7 },
      special: {
        type: 'projectile', dmg: 8, baseKb: 5, kbScale: 0.30, speed: 10, life: 64,
        size: 20, color: '#d28cff', start: 11, end: 28, cooldown: 30, name: 'starshot', homing: true,
      },
    },
  },
];

function getCharacter(i) { return CHARACTERS[i % CHARACTERS.length]; }
