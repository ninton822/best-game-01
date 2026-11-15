// Emberwatch: a tower defence game. The Warden defends the last Ember flame on
// the cliff from fifteen waves of ash creatures marching the winding road.
// State machine: title -> play (build/fight) -> victory | defeat, with pause.
// Fixed-step simulation (1/60 s) so replays and screenshot scenes are exact.
import { makeRng } from './rng.js';
import { makeSfx } from './audio.js';
import {
  VIEW_W, VIEW_H, PATH, PLOTS, EMBER, PATH_LENGTH, pointAt,
  createTerrain, drawPlot, drawEmber,
} from './map.js';
import {
  TOTAL_WAVES, ENEMY_TYPES, composeWave, waveBonus,
  makeEnemy, updateEnemy, drawEnemy,
} from './enemies.js';
import {
  TOWER_TYPES, towerStats, upgradeCost, makeTower, sellValue,
  updateTower, updateProjectiles, drawTower,
} from './towers.js';
import { makeFx } from './effects.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const START_GOLD = 200;
const START_LIVES = 20;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = {
  gold: document.getElementById('hud-gold'),
  lives: document.getElementById('hud-lives'),
  wave: document.getElementById('hud-wave'),
  foes: document.getElementById('hud-foes'),
  score: document.getElementById('hud-score'),
  best: document.getElementById('hud-best'),
  startWave: document.getElementById('btn-wave'),
  speed: document.getElementById('btn-speed'),
  pause: document.getElementById('btn-pause'),
  mute: document.getElementById('btn-mute'),
};
const buildPanel = document.getElementById('build-panel');
const towerPanel = document.getElementById('tower-panel');
const titleScreen = document.getElementById('title-screen');
const endScreen = document.getElementById('end-screen');
const pauseScreen = document.getElementById('pause-screen');
const statusLine = document.getElementById('status');

const terrain = createTerrain();
const sfx = makeSfx();
const fx = makeFx();

export const G = {
  screen: 'title',
  phase: 'build', // 'build' | 'fight'
  paused: false,
  speed: 1,
  time: 0,
  gold: START_GOLD,
  lives: START_LIVES,
  maxLives: START_LIVES,
  wave: 0,
  score: 0,
  kills: 0,
  leaks: 0,
  earned: 0,
  towers: [],
  enemies: [],
  projectiles: [],
  spawnQueue: [],
  spawnTimer: 0,
  spawned: 0,
  selectedPlot: -1,
  selectedTower: null,
  hoverPlot: -1,
  previewType: null,
  mouse: { x: -1, y: -1 },
  banner: '',
  bannerT: 0,
  emberFlash: 0,
  best: 0,
  rng: makeRng(20261116),
  shot: null,
};

try {
  G.best = Number(localStorage.getItem('emberwatch-best') ?? 0) || 0;
} catch {
  G.best = 0;
}

function saveBest() {
  if (G.score > G.best) {
    G.best = G.score;
    try {
      localStorage.setItem('emberwatch-best', String(G.best));
    } catch {
      /* storage is a nicety */
    }
  }
}

function newGame(seed = 20261116) {
  G.screen = 'play';
  G.phase = 'build';
  G.paused = false;
  G.time = 0;
  G.gold = START_GOLD;
  G.lives = START_LIVES;
  G.wave = 0;
  G.score = 0;
  G.kills = 0;
  G.leaks = 0;
  G.earned = 0;
  G.towers = [];
  G.enemies = [];
  G.projectiles = [];
  G.spawnQueue = [];
  G.spawnTimer = 0;
  G.spawned = 0;
  G.selectedPlot = -1;
  G.selectedTower = null;
  G.hoverPlot = -1;
  G.previewType = null;
  G.banner = '';
  G.bannerT = 0;
  G.emberFlash = 0;
  G.rng = makeRng(seed);
  fx.particles.length = 0;
  fx.texts.length = 0;
  fx.rings.length = 0;
  fx.bolts.length = 0;
  fx.shakeMag = 0;
  hidePanels();
  titleScreen.hidden = true;
  endScreen.hidden = true;
  pauseScreen.hidden = true;
  updateHUD();
  setStatus('Wave 1 ready. Build towers, then start the wave.');
}

function showBanner(text, seconds = 2.2) {
  G.banner = text;
  G.bannerT = seconds;
}

function setStatus(text) {
  statusLine.textContent = text;
}

// ---------- Waves ----------

function startWave() {
  if (G.screen !== 'play' || G.paused) return false;
  if (G.phase !== 'build' || G.wave >= TOTAL_WAVES) return false;
  G.wave += 1;
  G.spawnQueue = composeWave(G.wave).slice();
  G.spawnTimer = 0;
  G.spawned = 0;
  G.phase = 'fight';
  hidePanels();
  G.selectedPlot = -1;
  G.selectedTower = null;
  if (G.wave % 5 === 0) {
    showBanner(`WAVE ${G.wave} — THE ASH TITAN COMES`, 2.8);
    sfx.boss();
  } else {
    showBanner(`WAVE ${G.wave}`, 2.0);
    sfx.horn();
  }
  setStatus(`Wave ${G.wave} of ${TOTAL_WAVES} is marching.`);
  updateHUD();
  return true;
}

function clearWave() {
  const bonus = waveBonus(G.wave);
  G.gold += bonus;
  G.earned += bonus;
  G.score += 100 + 25 * G.wave;
  fx.text(EMBER.x - 40, EMBER.y - 60, `Wave bonus +${bonus}g`, '#ffd977', 15);
  if (G.wave >= TOTAL_WAVES) {
    G.score += G.lives * 100;
    saveBest();
    G.screen = 'victory';
    sfx.victory();
    showEnd(true);
    return;
  }
  G.phase = 'build';
  showBanner(`WAVE ${G.wave} CLEARED  •  +${bonus}g`, 2.2);
  sfx.coin();
  setStatus(`Wave ${G.wave} cleared. Build, then start wave ${G.wave + 1}.`);
  updateHUD();
}

function defeat() {
  saveBest();
  G.screen = 'defeat';
  sfx.defeat();
  showEnd(false);
}

function showEnd(won) {
  // Clean slate behind the end screen: no stray damage numbers or bolts.
  fx.texts.length = 0;
  fx.particles.length = 0;
  G.projectiles.length = 0;
  const title = document.getElementById('end-title');
  const sub = document.getElementById('end-sub');
  const stats = document.getElementById('end-stats');
  title.textContent = won ? 'The Ember Endures' : 'The Ember Goes Dark';
  title.className = won ? 'win' : 'lose';
  sub.textContent = won
    ? `All fifteen waves broke against your towers. The valley stays lit.`
    : `The ash creatures reached the Ember on wave ${G.wave}. The valley goes dark.`;
  stats.innerHTML =
    `Waves cleared <b>${won ? TOTAL_WAVES : G.wave - 1}</b> / ${TOTAL_WAVES} &nbsp;·&nbsp; ` +
    `Creatures felled <b>${G.kills}</b> &nbsp;·&nbsp; Leaks <b>${G.leaks}</b><br>` +
    `Gold earned <b>${G.earned}g</b> &nbsp;·&nbsp; Ember health <b>${Math.max(0, G.lives)}</b> / ${G.maxLives}<br>` +
    `Score <b>${G.score}</b> &nbsp;·&nbsp; Best <b>${G.best}</b>`;
  endScreen.hidden = false;
  setStatus(won ? 'Victory! The Ember endures.' : 'Defeat. The Ember goes dark.');
}

// ---------- Building ----------

function towerAtPlot(plotIndex) {
  return G.towers.find((t) => t.plot === plotIndex) ?? null;
}

function buildTower(type) {
  if (G.screen !== 'play' || G.selectedPlot < 0) return false;
  if (towerAtPlot(G.selectedPlot)) return false;
  const def = TOWER_TYPES[type];
  if (!def || G.gold < def.cost) return false;
  const tower = makeTower(type, PLOTS[G.selectedPlot]);
  G.towers.push(tower);
  G.gold -= def.cost;
  sfx.build();
  fx.ring(tower.x, tower.y, 30, 'rgba(255, 207, 122, 0.5)');
  fx.burst(tower.x, tower.y, '#cbb98a', 8, 60);
  G.selectedTower = tower;
  G.selectedPlot = -1;
  showTowerPanel(tower);
  updateHUD();
  return true;
}

function upgradeTower(tower) {
  const cost = upgradeCost(tower.type, tower.level);
  if (cost === null || G.gold < cost) return false;
  G.gold -= cost;
  tower.invested += cost;
  tower.level += 1;
  sfx.build();
  fx.ring(tower.x, tower.y, 34, 'rgba(255, 217, 119, 0.6)');
  fx.burst(tower.x, tower.y, '#ffd977', 10, 80);
  showTowerPanel(tower);
  updateHUD();
  return true;
}

function sellTower(tower) {
  const value = sellValue(tower);
  G.gold += value;
  G.towers = G.towers.filter((t) => t !== tower);
  sfx.coin();
  fx.text(tower.x, tower.y - 24, `+${value}g`, '#ffd977', 13);
  G.selectedTower = null;
  hidePanels();
  updateHUD();
}

// ---------- Update ----------

function update(dt) {
  G.time += dt;
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.emberFlash > 0) G.emberFlash -= dt;

  // Spawning.
  if (G.phase === 'fight' && G.spawnQueue.length > 0) {
    G.spawnTimer += dt;
    while (G.spawnQueue.length > 0 && G.spawnQueue[0].delay <= G.spawnTimer) {
      const entry = G.spawnQueue.shift();
      const e = makeEnemy(entry.type, G.wave);
      e.wispPhase = G.rng.range(0, Math.PI * 2);
      G.enemies.push(e);
      G.spawned += 1;
    }
  }

  // Enemies.
  for (let i = G.enemies.length - 1; i >= 0; i -= 1) {
    const e = G.enemies[i];
    const result = updateEnemy(e, dt, G.time);
    if (result === 'leaked') {
      G.lives -= e.leak;
      G.leaks += 1;
      G.emberFlash = 0.5;
      fx.addShake(5);
      fx.burst(EMBER.x, EMBER.y, '#ff6a3e', 16, 140);
      fx.text(EMBER.x - 30, EMBER.y - 70, `-${e.leak} Ember`, '#ff8a7a', 15);
      sfx.leak();
      G.enemies.splice(i, 1);
      if (G.lives <= 0) {
        G.lives = 0;
        updateHUD();
        defeat();
        return;
      }
      continue;
    }
    if (e.dead) {
      G.kills += 1;
      G.gold += e.gold;
      G.earned += e.gold;
      G.score += e.gold;
      fx.text(e.x, e.y - e.radius - 12, `+${e.gold}g`, '#ffd977', 12);
      if (G.rng.chance(0.25)) sfx.coin();
      G.enemies.splice(i, 1);
    }
  }

  // Towers and projectiles.
  for (const t of G.towers) updateTower(t, G.enemies, dt, G.time, fx, sfx, G.projectiles, fx.bolts);
  updateProjectiles(G.projectiles, G.enemies, dt, fx, sfx);
  fx.update(dt);

  // Wave cleared?
  if (
    G.phase === 'fight' &&
    G.spawnQueue.length === 0 &&
    G.enemies.length === 0 &&
    G.screen === 'play'
  ) {
    clearWave();
  }
  updateHUD();
}

// ---------- Render ----------

function render() {
  ctx.save();
  if (fx.shakeMag > 0.2) {
    ctx.translate((Math.random() - 0.5) * fx.shakeMag, (Math.random() - 0.5) * fx.shakeMag);
  }
  ctx.drawImage(terrain, 0, 0);
  // Plots.
  for (let i = 0; i < PLOTS.length; i += 1) {
    if (towerAtPlot(i)) continue;
    const state = G.selectedPlot === i ? 'selected' : G.hoverPlot === i ? 'hover' : '';
    drawPlot(ctx, PLOTS[i], state, G.gold >= TOWER_TYPES.spark.cost);
  }
  // Towers (range circle only for the selected one).
  for (const t of G.towers) drawTower(ctx, t, G.selectedTower === t);
  // Preview range while choosing a build.
  if (G.selectedPlot >= 0 && G.previewType) {
    const def = TOWER_TYPES[G.previewType];
    const p = PLOTS[G.selectedPlot];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, def.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Enemies.
  for (const e of G.enemies) drawEnemy(ctx, e, G.time);
  // Projectiles.
  for (const p of G.projectiles) {
    ctx.fillStyle = p.type === 'mortar' ? '#ff8a5b' : '#ffd977';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.type === 'mortar' ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (p.type === 'mortar') {
      ctx.strokeStyle = 'rgba(255, 138, 91, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  fx.draw(ctx);
  drawEmber(ctx, G.time, G.lives, G.maxLives);
  if (G.emberFlash > 0) {
    ctx.strokeStyle = `rgba(255, 80, 60, ${G.emberFlash})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(EMBER.x, EMBER.y, EMBER.radius + 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Wave banner.
  if (G.bannerT > 0 && G.screen === 'play') {
    const a = Math.min(1, G.bannerT / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = '#ece5d8';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 12;
    ctx.fillText(G.banner, VIEW_W / 2, 84);
    ctx.restore();
  }
}

// ---------- HUD / panels ----------

let lastHud = '';
function updateHUD() {
  const foesLeft =
    G.spawnQueue.length + G.enemies.filter((e) => !e.dead && !e.reached).length;
  const key = [
    G.gold, G.lives, G.wave, foesLeft, G.score, G.best,
    G.phase, G.screen, G.speed, G.paused, sfx.muted,
  ].join('|');
  if (key === lastHud) return;
  lastHud = key;
  hud.gold.textContent = `${G.gold}g`;
  hud.lives.textContent = `Ember ${Math.max(0, G.lives)}/${G.maxLives}`;
  hud.lives.classList.toggle('low', G.lives <= 5);
  hud.wave.textContent = G.wave === 0 ? `Wave — / ${TOTAL_WAVES}` : `Wave ${G.wave} / ${TOTAL_WAVES}`;
  hud.foes.textContent = G.phase === 'fight' ? `Foes left ${foesLeft}` : foesLeft > 0 ? `Foes left ${foesLeft}` : 'Build phase';
  hud.score.textContent = `Score ${G.score}`;
  hud.best.textContent = `Best ${G.best}`;
  hud.startWave.textContent =
    G.wave >= TOTAL_WAVES ? 'All waves done' : G.phase === 'fight' ? `Wave ${G.wave} running…` : `Start wave ${G.wave + 1}`;
  hud.startWave.disabled = G.phase !== 'build' || G.wave >= TOTAL_WAVES || G.screen !== 'play';
  hud.speed.textContent = `Speed ${G.speed}x`;
  hud.pause.textContent = G.paused ? 'Resume' : 'Pause';
  hud.mute.textContent = sfx.muted ? 'Unmute' : 'Mute';
}

function hidePanels() {
  buildPanel.hidden = true;
  towerPanel.hidden = true;
}

function showBuildPanel(plotIndex) {
  G.selectedPlot = plotIndex;
  G.selectedTower = null;
  const cards = buildPanel.querySelectorAll('.build-card');
  cards.forEach((card) => {
    const type = card.dataset.type;
    const def = TOWER_TYPES[type];
    const owned = towerAtPlot(plotIndex) !== null;
    card.classList.toggle('cant', G.gold < def.cost || owned);
    card.querySelector('.cost').textContent = `${def.cost}g`;
  });
  buildPanel.hidden = false;
  towerPanel.hidden = true;
}

function showTowerPanel(tower) {
  G.selectedTower = tower;
  G.selectedPlot = -1;
  const s = towerStats(tower.type, tower.level);
  const cost = upgradeCost(tower.type, tower.level);
  document.getElementById('tower-name').textContent = `${s.name} · Lv ${tower.level}`;
  document.getElementById('tower-stats').textContent =
    `Damage ${s.damage} · Rate ${s.rate}/s · Range ${s.range}` +
    (s.slow > 0 ? ` · Slow ${Math.round(s.slow * 100)}%` : '') +
    (s.splash > 0 ? ` · Splash ${s.splash}` : '') +
    (s.chains > 0 ? ` · Chains ${s.chains}` : '');
  const upBtn = document.getElementById('btn-upgrade');
  upBtn.textContent = cost === null ? 'Max level' : `Upgrade — ${cost}g`;
  upBtn.disabled = cost === null || G.gold < cost;
  document.getElementById('btn-sell').textContent = `Sell — ${sellValue(tower)}g`;
  towerPanel.hidden = false;
  buildPanel.hidden = true;
}

// ---------- Input ----------

function toGameCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_W,
    y: ((clientY - rect.top) / rect.height) * VIEW_H,
  };
}

function plotAt(x, y) {
  for (let i = 0; i < PLOTS.length; i += 1) {
    if (Math.hypot(PLOTS[i].x - x, PLOTS[i].y - y) <= 30) return i;
  }
  return -1;
}

canvas.addEventListener('mousemove', (ev) => {
  const p = toGameCoords(ev.clientX, ev.clientY);
  G.mouse = p;
  G.hoverPlot = G.screen === 'play' ? plotAt(p.x, p.y) : -1;
});

canvas.addEventListener('click', (ev) => {
  sfx.ensure();
  if (G.screen !== 'play' || G.paused) return;
  const p = toGameCoords(ev.clientX, ev.clientY);
  const plot = plotAt(p.x, p.y);
  if (plot >= 0) {
    const tower = towerAtPlot(plot);
    if (tower) showTowerPanel(tower);
    else showBuildPanel(plot);
    return;
  }
  // Clicking a tower directly (its circle is wider than the plot hitbox).
  for (const t of G.towers) {
    if (Math.hypot(t.x - p.x, t.y - p.y) <= 26) {
      showTowerPanel(t);
      return;
    }
  }
  G.selectedPlot = -1;
  G.selectedTower = null;
  hidePanels();
});

buildPanel.addEventListener('click', (ev) => {
  const card = ev.target.closest('.build-card');
  if (!card) return;
  sfx.ensure();
  buildTower(card.dataset.type);
});

buildPanel.addEventListener('mouseover', (ev) => {
  const card = ev.target.closest('.build-card');
  G.previewType = card ? card.dataset.type : null;
});
buildPanel.addEventListener('mouseleave', () => {
  G.previewType = null;
});

document.getElementById('btn-upgrade').addEventListener('click', () => {
  if (G.selectedTower) upgradeTower(G.selectedTower);
});
document.getElementById('btn-sell').addEventListener('click', () => {
  if (G.selectedTower) sellTower(G.selectedTower);
});
document.getElementById('btn-close-panels').addEventListener('click', hidePanels);
document.getElementById('btn-close-panels2').addEventListener('click', hidePanels);

hud.startWave.addEventListener('click', () => {
  sfx.ensure();
  startWave();
});
hud.speed.addEventListener('click', () => {
  G.speed = G.speed === 1 ? 2 : 1;
  updateHUD();
});
hud.pause.addEventListener('click', () => {
  if (G.screen !== 'play') return;
  G.paused = !G.paused;
  pauseScreen.hidden = !G.paused;
  updateHUD();
});
hud.mute.addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  updateHUD();
});
document.getElementById('btn-play').addEventListener('click', () => {
  sfx.ensure();
  newGame();
});
document.getElementById('btn-again').addEventListener('click', () => {
  sfx.ensure();
  newGame();
});
document.getElementById('btn-resume').addEventListener('click', () => {
  G.paused = false;
  pauseScreen.hidden = true;
  updateHUD();
});

window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  const k = ev.key.toLowerCase();
  if (G.screen === 'title' && (k === ' ' || k === 'enter')) {
    sfx.ensure();
    newGame();
    return;
  }
  if ((G.screen === 'victory' || G.screen === 'defeat') && (k === ' ' || k === 'enter' || k === 'r')) {
    sfx.ensure();
    newGame();
    return;
  }
  if (G.screen !== 'play') return;
  if (k === ' ') {
    ev.preventDefault();
    sfx.ensure();
    startWave();
  } else if (k === 'p') {
    G.paused = !G.paused;
    pauseScreen.hidden = !G.paused;
    updateHUD();
  } else if (k === 'f') {
    G.speed = G.speed === 1 ? 2 : 1;
    updateHUD();
  } else if (k === 'm') {
    sfx.muted = !sfx.muted;
    updateHUD();
  } else if (k === 'escape') {
    G.selectedPlot = -1;
    G.selectedTower = null;
    hidePanels();
  } else if (['1', '2', '3', '4'].includes(k) && G.selectedPlot >= 0) {
    const type = ['spark', 'frost', 'mortar', 'coil'][Number(k) - 1];
    buildTower(type);
  }
});

// ---------- Main loop ----------

let lastT = 0;
let acc = 0;
function frame(tms) {
  requestAnimationFrame(frame);
  const now = tms / 1000;
  let dt = Math.min(0.1, lastT === 0 ? 0.016 : now - lastT);
  lastT = now;
  if (G.screen === 'play' && !G.paused) {
    acc += dt * G.speed;
    let guard = 0;
    while (acc >= STEP && guard < 600) {
      update(STEP);
      acc -= STEP;
      guard += 1;
      if (G.screen !== 'play') break;
    }
    if (guard >= 600) acc = 0;
  }
  render();
}

// ---------- Test hooks (used by the playtest, not by players) ----------

window.__ew = {
  G,
  newGame,
  startWave,
  buildTower,
  upgradeTower,
  sellTower,
  selectPlot(i) {
    if (G.screen !== 'play') return false;
    if (towerAtPlot(i)) {
      showTowerPanel(towerAtPlot(i));
      return true;
    }
    showBuildPanel(i);
    return true;
  },
  // Run `seconds` of game time synchronously, without rendering: for tests.
  fastForward(seconds) {
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i += 1) {
      if (G.screen !== 'play' || G.paused) break;
      update(STEP);
    }
    render();
  },
};

// ---------- Boot ----------

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  const seed = Number(params.get('seed') ?? 1);
  G.shot = shotName;
  const result = stageShot(shotName, seed, window.__ew);
  if (result.screen === 'title') {
    hidePanels();
    titleScreen.hidden = false;
    endScreen.hidden = true;
    pauseScreen.hidden = true;
  } else if (result.screen === 'play') {
    titleScreen.hidden = true;
    endScreen.hidden = true;
    pauseScreen.hidden = true;
  } else {
    showEnd(result.screen === 'victory');
  }
  render();
  updateHUD();
  window.__shotReady = true;
} else {
  updateHUD();
  requestAnimationFrame(frame);
}
