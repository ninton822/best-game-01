// The valley: a winding road from the dark portals to the Ember, and the stone
// plots where towers can be built. The terrain is pre-rendered once to an offscreen
// canvas (mountains, pines, stars, the road) and blitted every frame; only the
// Ember flame and the plots' hover states are drawn live.
import { makeRng } from './rng.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const PATH_W = 46;

// Waypoints of the road, spawn portal to Ember.
export const PATH = [
  { x: -50, y: 110 },
  { x: 1150, y: 110 },
  { x: 1150, y: 320 },
  { x: 130, y: 320 },
  { x: 130, y: 530 },
  { x: 1150, y: 530 },
];

// The Ember sits just past the road's end.
export const EMBER = { x: 1196, y: 530, radius: 34 };

// Stone plots: tower build spots, kept clear of the road.
export const PLOTS = [
  { x: 250, y: 196 }, { x: 450, y: 196 }, { x: 650, y: 196 }, { x: 850, y: 196 }, { x: 1050, y: 196 },
  { x: 1060, y: 420 }, { x: 850, y: 420 }, { x: 650, y: 420 }, { x: 450, y: 420 }, { x: 250, y: 420 },
  { x: 250, y: 618 }, { x: 450, y: 618 }, { x: 650, y: 618 }, { x: 850, y: 618 }, { x: 1050, y: 618 },
];

// Segment lengths and total path length, for distance-along-path movement.
const SEGMENTS = [];
let PATH_LEN = 0;
for (let i = 0; i < PATH.length - 1; i += 1) {
  const a = PATH[i];
  const b = PATH[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  SEGMENTS.push({ a, b, len, start: PATH_LEN });
  PATH_LEN += len;
}
export const PATH_LENGTH = PATH_LEN;

/** Position and heading at `dist` metres along the road. */
export function pointAt(dist) {
  const d = Math.max(0, Math.min(PATH_LENGTH, dist));
  for (const s of SEGMENTS) {
    if (d <= s.start + s.len || s === SEGMENTS[SEGMENTS.length - 1]) {
      const t = Math.min(1, Math.max(0, (d - s.start) / s.len));
      return {
        x: s.a.x + (s.b.x - s.a.x) * t,
        y: s.a.y + (s.b.y - s.a.y) * t,
        angle: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x),
      };
    }
  }
  const last = PATH[PATH.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

/** True when (x, y) is within `pad` of the road centreline. */
export function nearPath(x, y, pad = 0) {
  for (const s of SEGMENTS) {
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((x - s.a.x) * dx + (y - s.a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = s.a.x + dx * t;
    const py = s.a.y + dy * t;
    if (Math.hypot(x - px, y - py) < PATH_W / 2 + pad) return true;
  }
  return false;
}

function drawPine(ctx, x, y, s, tone) {
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.moveTo(x, y - 26 * s);
  ctx.lineTo(x - 15 * s, y + 8 * s);
  ctx.lineTo(x - 7 * s, y + 4 * s);
  ctx.lineTo(x - 12 * s, y + 16 * s);
  ctx.lineTo(x + 12 * s, y + 16 * s);
  ctx.lineTo(x + 7 * s, y + 4 * s);
  ctx.lineTo(x + 15 * s, y + 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a2c1e';
  ctx.fillRect(x - 2 * s, y + 14 * s, 4 * s, 8 * s);
}

/** Pre-render the static valley once; returns a canvas to blit each frame. */
export function createTerrain() {
  const rng = makeRng(20261116);
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const ctx = c.getContext('2d');

  // Night sky.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#0b1026');
  sky.addColorStop(0.55, '#141a33');
  sky.addColorStop(1, '#1d2338');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Stars.
  for (let i = 0; i < 130; i += 1) {
    const x = rng.range(0, VIEW_W);
    const y = rng.range(0, 300);
    const r = rng.range(0.5, 1.8);
    ctx.fillStyle = rng.chance(0.2) ? '#ffd9a0' : `rgba(230,235,255,${rng.range(0.35, 0.9)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon with a soft halo.
  const halo = ctx.createRadialGradient(1120, 62, 8, 1120, 62, 90);
  halo.addColorStop(0, 'rgba(255, 236, 190, 0.5)');
  halo.addColorStop(1, 'rgba(255, 236, 190, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(1020, -40, 200, 200);
  ctx.fillStyle = '#ffedb8';
  ctx.beginPath();
  ctx.arc(1120, 62, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(210, 180, 120, 0.5)';
  ctx.beginPath();
  ctx.arc(1112, 56, 5, 0, Math.PI * 2);
  ctx.arc(1128, 70, 7, 0, Math.PI * 2);
  ctx.fill();

  // Mountain silhouettes.
  const ridge = (base, amp, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    let y = base;
    for (let x = 0; x <= VIEW_W; x += 64) {
      y = base + Math.sin(x * 0.011 + base) * amp * 0.6 + rng.range(-amp * 0.4, amp * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();
  };
  ridge(150, 70, '#0e1428');
  ridge(230, 60, '#131a30');

  // Valley floor.
  const floor = ctx.createLinearGradient(0, 240, 0, VIEW_H);
  floor.addColorStop(0, '#1c2417');
  floor.addColorStop(1, '#232b1c');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 240, VIEW_W, VIEW_H - 240);

  // Pines, kept off the road and the plots.
  for (let i = 0; i < 70; i += 1) {
    const x = rng.range(20, VIEW_W - 20);
    const y = rng.range(255, VIEW_H - 30);
    if (nearPath(x, y, 42)) continue;
    if (PLOTS.some((p) => Math.hypot(p.x - x, p.y - y) < 52)) continue;
    if (Math.hypot(x - EMBER.x, y - EMBER.y) < 70) continue;
    drawPine(ctx, x, y, rng.range(0.7, 1.5), rng.pick(['#16241a', '#1a2c1e', '#14201a']));
  }

  // The road: dark cobbles with a lighter rim.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#4a4238';
  ctx.lineWidth = PATH_W + 10;
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = '#5d5346';
  ctx.lineWidth = PATH_W;
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  // Cobble speckles.
  for (let i = 0; i < 260; i += 1) {
    const d = rng.range(0, PATH_LENGTH);
    const p = pointAt(d);
    const off = rng.range(-PATH_W / 2 + 6, PATH_W / 2 - 6);
    const nx = p.x + Math.cos(p.angle + Math.PI / 2) * off;
    const ny = p.y + Math.sin(p.angle + Math.PI / 2) * off;
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.18)' : 'rgba(255,240,210,0.07)';
    ctx.beginPath();
    ctx.arc(nx, ny, rng.range(1.5, 3.5), 0, Math.PI * 2);
    ctx.fill();
  }

  // Spawn portal: a dark gate where the creatures crawl out.
  const portal = ctx.createRadialGradient(6, 110, 4, 6, 110, 46);
  portal.addColorStop(0, '#2a1030');
  portal.addColorStop(0.7, '#160a24');
  portal.addColorStop(1, 'rgba(22,10,36,0)');
  ctx.fillStyle = portal;
  ctx.beginPath();
  ctx.arc(6, 110, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4a8a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(6, 110, 34, 0, Math.PI * 2);
  ctx.stroke();

  // Warm glow around the Ember's cliff.
  const glow = ctx.createRadialGradient(EMBER.x, EMBER.y, 10, EMBER.x, EMBER.y, 150);
  glow.addColorStop(0, 'rgba(255, 170, 60, 0.28)');
  glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(EMBER.x - 150, EMBER.y - 150, 300, 300);
  // Stone ring under the Ember.
  ctx.fillStyle = '#3d3a33';
  ctx.beginPath();
  ctx.arc(EMBER.x, EMBER.y, EMBER.radius + 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c2a25';
  ctx.beginPath();
  ctx.arc(EMBER.x, EMBER.y, EMBER.radius + 2, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/** Draw one build plot (stone pad); `state` is '', 'hover' or 'selected'. */
export function drawPlot(ctx, plot, state, canAfford) {
  ctx.save();
  ctx.translate(plot.x, plot.y);
  ctx.fillStyle = state === 'selected' ? '#5a5142' : '#454033';
  ctx.strokeStyle = state === 'hover' ? '#ffcf7a' : '#6b6250';
  ctx.lineWidth = state === 'hover' || state === 'selected' ? 3 : 2;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 220, 150, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();
  if (state === 'hover' && !canAfford) {
    ctx.strokeStyle = 'rgba(220, 90, 70, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(9, 9);
    ctx.moveTo(9, -9);
    ctx.lineTo(-9, 9);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw the Ember flame, flickering with time `t` (seconds). */
export function drawEmber(ctx, t, hp, maxHp) {
  const x = EMBER.x;
  const y = EMBER.y;
  const flick = 1 + Math.sin(t * 7) * 0.06 + Math.sin(t * 13.7) * 0.04;
  const outer = ctx.createRadialGradient(x, y - 6, 2, x, y - 6, 44 * flick);
  outer.addColorStop(0, 'rgba(255, 220, 130, 0.95)');
  outer.addColorStop(0.45, 'rgba(255, 150, 50, 0.75)');
  outer.addColorStop(1, 'rgba(200, 60, 20, 0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(x, y - 6, 44 * flick, 0, Math.PI * 2);
  ctx.fill();
  // Flame tongue.
  ctx.fillStyle = '#ffd977';
  ctx.beginPath();
  ctx.moveTo(x - 13, y + 8);
  ctx.quadraticCurveTo(x - 18 * flick, y - 26, x + Math.sin(t * 5) * 4, y - 34 * flick);
  ctx.quadraticCurveTo(x + 18 * flick, y - 26, x + 13, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff9a2e';
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 8);
  ctx.quadraticCurveTo(x - 10, y - 14, x, y - 22 * flick);
  ctx.quadraticCurveTo(x + 10, y - 14, x + 8, y + 8);
  ctx.closePath();
  ctx.fill();
  // Ember health ring.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, EMBER.radius + 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = hp / maxHp > 0.35 ? '#ffb347' : '#e05b4e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, EMBER.radius + 16, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * hp) / maxHp);
  ctx.stroke();
}
