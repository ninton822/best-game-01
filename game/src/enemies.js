// The creatures that march the road, and the wave composer that sends them.
// Every number here is the balance surface: the playtests tune these, nothing else.
import { PATH_LENGTH, pointAt } from './map.js';

export const TOTAL_WAVES = 15;

export const ENEMY_TYPES = {
  ashling: {
    name: 'Ashling', hp: 34, speed: 56, gold: 5, leak: 1, radius: 13,
    body: '#8a7a68', belly: '#5d5346', eye: '#ffb347',
  },
  skitter: {
    name: 'Skitter', hp: 20, speed: 98, gold: 6, leak: 1, radius: 10,
    body: '#7a6a9a', belly: '#4d4266', eye: '#e08aff',
  },
  cinderhide: {
    name: 'Cinderhide', hp: 150, speed: 34, gold: 13, leak: 2, radius: 17,
    body: '#6e4a3a', belly: '#472e22', eye: '#ff6a3e', armor: 5,
  },
  wisp: {
    name: 'Wisp', hp: 26, speed: 82, gold: 8, leak: 1, radius: 11,
    body: '#9ab8c8', belly: '#5d7a8c', eye: '#dff6ff',
  },
  titan: {
    name: 'Ash Titan', hp: 650, speed: 27, gold: 160, leak: 5, radius: 30,
    body: '#5a3a4a', belly: '#3a2430', eye: '#ff3e2e', armor: 3,
  },
};

function hpMultiplier(wave) {
  return Math.pow(1.17, wave - 1);
}

function speedMultiplier(wave) {
  return Math.min(1.35, 1 + 0.015 * (wave - 1));
}

/** The spawn list for wave `n`: entries of { type, delay } in spawn order. */
export function composeWave(n) {
  const list = [];
  let t = 0;
  const push = (type, gap) => {
    list.push({ type, delay: t });
    t += gap;
  };
  const count = 8 + n * 2;
  for (let i = 0; i < count; i += 1) {
    let type = 'ashling';
    const roll = (i * 37 + n * 11) % 100;
    if (n >= 7 && roll < 18) type = 'wisp';
    else if (n >= 5 && roll < 38) type = 'cinderhide';
    else if (n >= 3 && roll < 62) type = 'skitter';
    push(type, Math.max(0.45, 0.95 - n * 0.03));
  }
  if (n % 5 === 0) {
    // A boss walks in the middle of the pack, with an honour guard.
    const at = Math.floor(list.length / 2);
    list.splice(at, 0, { type: 'titan', delay: t * 0.5 });
    list.splice(at + 1, 0, { type: 'cinderhide', delay: t * 0.5 + 0.8 });
    list.splice(at + 2, 0, { type: 'cinderhide', delay: t * 0.5 + 1.6 });
  }
  list.sort((a, b) => a.delay - b.delay);
  return list;
}

/** Gold value of clearing wave `n` (kills excluded). */
export function waveBonus(n) {
  return 20 + 5 * n;
}

/** Create one creature of `type` for wave `n`, at the road's start. */
export function makeEnemy(type, wave) {
  const def = ENEMY_TYPES[type];
  const hp = Math.round(def.hp * hpMultiplier(wave));
  return {
    type,
    def,
    hp,
    maxHp: hp,
    speed: def.speed * speedMultiplier(wave),
    gold: def.gold,
    leak: def.leak,
    radius: def.radius,
    dist: 0,
    x: -40,
    y: 110,
    angle: 0,
    slowUntil: 0,
    slowFactor: 1,
    wispPhase: Math.random() * Math.PI * 2,
    dead: false,
    reached: false,
    hitFlash: 0,
  };
}

/**
 * Advance one creature along the road for `dt` seconds of game time.
 * Returns 'leaked' when it reaches the Ember, else ''.
 */
export function updateEnemy(e, dt, now) {
  if (e.dead) return '';
  const slowed = now < e.slowUntil;
  const speed = e.speed * (slowed ? e.slowFactor : 1);
  e.dist += speed * dt;
  if (e.dist >= PATH_LENGTH) {
    e.reached = true;
    return 'leaked';
  }
  const p = pointAt(e.dist);
  let px = p.x;
  let py = p.y;
  if (e.type === 'wisp') {
    // Wisps drift sideways across the road as they walk.
    const wobble = Math.sin(e.dist * 0.045 + e.wispPhase) * 12;
    px += Math.cos(p.angle + Math.PI / 2) * wobble;
    py += Math.sin(p.angle + Math.PI / 2) * wobble;
  }
  e.x = px;
  e.y = py;
  e.angle = p.angle;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  return '';
}

/** Draw one creature: body, belly, eyes, and a health bar when hurt. */
export function drawEnemy(ctx, e, now) {
  const slowed = now < e.slowUntil;
  ctx.save();
  ctx.translate(e.x, e.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, e.radius * 0.75, e.radius * 0.9, e.radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.def.body;
  ctx.beginPath();
  ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.def.belly;
  ctx.beginPath();
  ctx.arc(0, e.radius * 0.25, e.radius * 0.62, 0, Math.PI * 2);
  ctx.fill();
  // Horns for the big ones.
  if (e.type === 'cinderhide' || e.type === 'titan') {
    ctx.fillStyle = e.def.belly;
    ctx.beginPath();
    ctx.moveTo(-e.radius * 0.7, -e.radius * 0.5);
    ctx.lineTo(-e.radius * 1.05, -e.radius * 1.15);
    ctx.lineTo(-e.radius * 0.25, -e.radius * 0.75);
    ctx.closePath();
    ctx.moveTo(e.radius * 0.7, -e.radius * 0.5);
    ctx.lineTo(e.radius * 1.05, -e.radius * 1.15);
    ctx.lineTo(e.radius * 0.25, -e.radius * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  // Eyes, looking along the road.
  const ex = Math.cos(e.angle) * e.radius * 0.35;
  const ey = Math.sin(e.angle) * e.radius * 0.35;
  ctx.fillStyle = e.def.eye;
  ctx.beginPath();
  ctx.arc(ex - e.radius * 0.32, ey - e.radius * 0.25, e.radius * 0.2, 0, Math.PI * 2);
  ctx.arc(ex + e.radius * 0.32, ey - e.radius * 0.25, e.radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
  if (slowed) {
    // Frost tint while slowed.
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (e.type === 'titan') {
    // Menacing pulsing aura, so the boss reads at a glance.
    const pulse = 0.45 + 0.2 * Math.sin(now * 4);
    ctx.strokeStyle = `rgba(255, 62, 46, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Health bar (thicker for the boss).
  if (e.hp < e.maxHp) {
    const w = e.radius * 2;
    const bh = e.type === 'titan' ? 6 : 4;
    const by = e.y - e.radius - (e.type === 'titan' ? 16 : 10);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, by, w, bh);
    ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#7ec850' : '#e05b4e';
    ctx.fillRect(e.x - w / 2, by, (w * e.hp) / e.maxHp, bh);
  }
}
