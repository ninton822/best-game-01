// The towers: four kinds, three levels each, bought on stone plots. Targeting is
// "first" (the creature furthest along the road). Spark and Mortar fire projectiles;
// Coil chains instantly; Frost is an aura that slows everything in range.
export const TOWER_TYPES = {
  spark: {
    name: 'Spark Turret', key: '1', cost: 50, range: 135, rate: 2.2, damage: 9,
    projSpeed: 460, color: '#ffb347', dark: '#8a5a1a',
    desc: 'Fast bolts, cheap and reliable.',
    up: [
      { cost: 45, damage: 14, rate: 2.6 },
      { cost: 80, damage: 20, rate: 3.0 },
    ],
  },
  frost: {
    name: 'Frost Spire', key: '2', cost: 75, range: 115, rate: 1, damage: 2,
    slow: 0.35, color: '#9adfff', dark: '#2e5f7a',
    desc: 'Chills a pack: slows 35% and nips at it.',
    up: [
      { cost: 35, damage: 3, slow: 0.45 },
      { cost: 60, damage: 4, slow: 0.55 },
    ],
  },
  mortar: {
    name: 'Mortar', key: '3', cost: 110, range: 235, minRange: 60, rate: 0.55, damage: 30,
    splash: 55, projSpeed: 260, color: '#ff8a5b', dark: '#7a3a1a',
    desc: 'Long-range shells that burst in a splash — cracks armoured hide.',
    up: [
      { cost: 80, damage: 48, splash: 62 },
      { cost: 130, damage: 75, splash: 70 },
    ],
  },
  coil: {
    name: 'Storm Coil', key: '4', cost: 160, range: 150, rate: 0.9, damage: 16,
    chains: 3, color: '#c99aff', dark: '#4d2a7a',
    desc: 'Lightning that jumps between creatures — bites through armour.',
    up: [
      { cost: 110, damage: 24, chains: 4 },
      { cost: 170, damage: 34, chains: 5 },
    ],
  },
};

export function towerStats(type, level) {
  const def = TOWER_TYPES[type];
  const s = {
    name: def.name, cost: def.cost, range: def.range, rate: def.rate,
    damage: def.damage, color: def.color, dark: def.dark,
    slow: def.slow ?? 0, splash: def.splash ?? 0, chains: def.chains ?? 0,
    minRange: def.minRange ?? 0, projSpeed: def.projSpeed ?? 0,
  };
  for (let i = 0; i < level - 1; i += 1) {
    const u = def.up[i];
    if (!u) break;
    if (u.damage !== undefined) s.damage = u.damage;
    if (u.rate !== undefined) s.rate = u.rate;
    if (u.slow !== undefined) s.slow = u.slow;
    if (u.splash !== undefined) s.splash = u.splash;
    if (u.chains !== undefined) s.chains = u.chains;
  }
  return s;
}

export function upgradeCost(type, level) {
  const def = TOWER_TYPES[type];
  if (level >= 3) return null;
  return def.up[level - 1].cost;
}

export function makeTower(type, plot) {
  return {
    type, plot, level: 1, invested: TOWER_TYPES[type].cost,
    x: plot.x, y: plot.y, cooldown: 0, angle: -Math.PI / 2, flash: 0,
  };
}

export function sellValue(tower) {
  return Math.floor(tower.invested * 0.7);
}

/** The creature furthest along the road within `range` of (x, y). */
function firstInRange(enemies, x, y, range, minRange = 0) {
  let best = null;
  for (const e of enemies) {
    if (e.dead || e.reached) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > range || d < minRange) continue;
    if (!best || e.dist > best.dist) best = e;
  }
  return best;
}

function damageEnemy(e, dmg, fx, text) {
  // Armour soaks small hits: a Cinderhide shrugs off most of a spark bolt,
  // but a mortar shell still bites. Every hit deals at least 1.
  const dealt = Math.max(1, dmg - (e.def.armor ?? 0));
  e.hp -= dealt;
  e.hitFlash = 0.08;
  if (text) fx.text(e.x, e.y - e.radius - 6, `-${Math.round(dealt)}`, '#ffd977', 11);
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    fx.burst(e.x, e.y, e.def.body, 10, 90);
    fx.burst(e.x, e.y, '#ffb347', 5, 60);
  }
}

/**
 * One tower's work for `dt` seconds. Returns nothing; appends projectiles and
 * effects to the shared arrays, and plays sounds through `sfx`.
 */
export function updateTower(t, enemies, dt, now, fx, sfx, projectiles, bolts) {
  const s = towerStats(t.type, t.level);
  t.cooldown -= dt;
  if (t.flash > 0) t.flash -= dt;
  if (t.type === 'frost') {
    // Aura: slow everything in range, tick a little damage.
    for (const e of enemies) {
      if (e.dead || e.reached) continue;
      if (Math.hypot(e.x - t.x, e.y - t.y) <= s.range) {
        e.slowUntil = now + 0.35;
        e.slowFactor = 1 - s.slow;
      }
    }
    t.frostTick = (t.frostTick ?? 0) - dt;
    if (t.frostTick <= 0) {
      t.frostTick = 0.5;
      for (const e of enemies) {
        if (e.dead || e.reached) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) <= s.range) damageEnemy(e, s.damage * 0.5, fx, false);
      }
      if (enemies.some((e) => !e.dead && !e.reached && Math.hypot(e.x - t.x, e.y - t.y) <= s.range)) {
        sfx.frost();
        fx.ring(t.x, t.y, s.range, 'rgba(154, 223, 255, 0.25)');
      }
    }
    return;
  }
  if (t.cooldown > 0) return;
  const target = firstInRange(enemies, t.x, t.y, s.range, s.minRange);
  if (!target) return;
  t.angle = Math.atan2(target.y - t.y, target.x - t.x);
  t.cooldown = 1 / s.rate;
  t.flash = 0.09;
  if (t.type === 'coil') {
    // Instant chain lightning across the nearest creatures.
    let from = { x: t.x, y: t.y };
    let current = target;
    const hit = new Set();
    let dmg = s.damage;
    for (let i = 0; i < s.chains && current; i += 1) {
      bolts.push({ x1: from.x, y1: from.y, x2: current.x, y2: current.y, life: 0.16 });
      damageEnemy(current, dmg, fx, true);
      hit.add(current);
      from = { x: current.x, y: current.y };
      dmg *= 0.8;
      let next = null;
      let bestD = 110;
      for (const e of enemies) {
        if (e.dead || e.reached || hit.has(e)) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d < bestD) {
          bestD = d;
          next = e;
        }
      }
      current = next;
    }
    sfx.zap();
    return;
  }
  // Spark and Mortar fire a projectile.
  projectiles.push({
    type: t.type, x: t.x, y: t.y, target, damage: s.damage,
    speed: s.projSpeed, splash: s.splash, life: 2.5,
    tx: target.x, ty: target.y,
  });
  if (t.type === 'mortar') sfx.mortar();
  else sfx.shoot();
}

/** Advance projectiles; splash and expiry handled here. */
export function updateProjectiles(projectiles, enemies, dt, fx, sfx) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    p.life -= dt;
    // Retarget a moving creature (spark); mortar shells fall where aimed.
    if (p.type === 'spark' && p.target && !p.target.dead && !p.target.reached) {
      p.tx = p.target.x;
      p.ty = p.target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step || p.life <= 0) {
      if (p.type === 'mortar') {
        fx.burst(p.tx, p.ty, '#ff8a5b', 14, 130);
        fx.burst(p.tx, p.ty, '#5a4a3a', 8, 70);
        fx.addShake(3);
        for (const e of enemies) {
          if (e.dead || e.reached) continue;
          if (Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash) damageEnemy(e, p.damage, fx, false);
        }
      } else if (p.target && !p.target.dead && !p.target.reached) {
        damageEnemy(p.target, p.damage, fx, true);
      }
      projectiles.splice(i, 1);
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
  }
}

/** Draw one tower (base, barrel, level pips) and its range when `showRange`. */
export function drawTower(ctx, t, showRange) {
  const s = towerStats(t.type, t.level);
  if (showRange) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, s.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (s.minRange > 0) {
      ctx.strokeStyle = 'rgba(255, 120, 90, 0.4)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, s.minRange, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(t.x, t.y);
  // Base.
  ctx.fillStyle = s.dark;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d3a33';
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  // Barrel / head, aimed.
  ctx.rotate(t.angle);
  ctx.fillStyle = t.flash > 0 ? '#ffffff' : s.color;
  if (t.type === 'spark') {
    ctx.fillRect(0, -4, 22, 8);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.type === 'frost') {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.type === 'mortar') {
    ctx.fillRect(-2, -7, 24, 14);
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Coil: three prongs.
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    for (let k = -1; k <= 1; k += 1) {
      ctx.save();
      ctx.rotate(k * 0.5);
      ctx.fillRect(4, -2, 18, 4);
      ctx.restore();
    }
  }
  ctx.restore();
  // Level pips.
  for (let i = 0; i < t.level; i += 1) {
    ctx.fillStyle = '#ffd977';
    ctx.beginPath();
    ctx.arc(t.x - 8 + i * 8, t.y + 22, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
