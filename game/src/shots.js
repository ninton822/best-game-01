// Deterministic screenshot scenes behind ?shot=start|play|boss|end. Each one plays
// the real rules forward from a fresh game with a simple autopilot (build the plan
// in order, upgrade the weakest tower, start each wave when nothing affordable is
// left), so the frame is what a real game looks like and the same seed always
// gives the same frame. The autopilot is also the balance probe the playtests use.
import { TOWER_TYPES, towerStats, upgradeCost } from './towers.js';

// Build order: plots by coverage of the road, best first.
const PLAN = [
  { plot: 2, type: 'spark' },
  { plot: 7, type: 'spark' },
  { plot: 1, type: 'spark' },
  { plot: 6, type: 'frost' },
  { plot: 3, type: 'spark' },
  { plot: 8, type: 'mortar' },
  { plot: 12, type: 'spark' },
  { plot: 11, type: 'coil' },
  { plot: 4, type: 'frost' },
  { plot: 13, type: 'mortar' },
  { plot: 0, type: 'spark' },
  { plot: 5, type: 'spark' },
  { plot: 9, type: 'coil' },
  { plot: 10, type: 'frost' },
  { plot: 14, type: 'mortar' },
];

/** Spend the build phase: next planned tower, else the cheapest upgrade. */
function spendBuildPhase(api, planIndex) {
  const G = api.G;
  let idx = planIndex;
  for (let guard = 0; guard < 40; guard += 1) {
    if (G.phase !== 'build' || G.screen !== 'play') break;
    // Next planned tower, if its plot is free and we can afford it.
    let acted = false;
    while (idx < PLAN.length) {
      const step = PLAN[idx];
      const occupied = G.towers.some((t) => t.plot === step.plot);
      if (occupied) {
        idx += 1;
        continue;
      }
      if (G.gold < TOWER_TYPES[step.type].cost) break;
      api.selectPlot(step.plot);
      if (api.buildTower(step.type)) idx += 1;
      acted = true;
      break;
    }
    if (acted) continue;
    // Cheapest affordable upgrade.
    let best = null;
    let bestCost = Infinity;
    for (const t of G.towers) {
      const cost = upgradeCost(t.type, t.level);
      if (cost !== null && cost <= G.gold && cost < bestCost) {
        best = t;
        bestCost = cost;
      }
    }
    if (best) {
      api.upgradeTower(best);
      continue;
    }
    break;
  }
  return idx;
}

/** Run the fight until the phase flips back to build, or the game ends. */
function runWave(api, maxSeconds) {
  const G = api.G;
  let spent = 0;
  while (G.screen === 'play' && G.phase === 'fight' && spent < maxSeconds) {
    api.fastForward(0.5);
    spent += 0.5;
  }
}

/** Play whole waves until `targetWave` is reached (or the game ends). */
function playUntilWave(api, targetWave) {
  const G = api.G;
  let planIndex = 0;
  let guard = 0;
  while (G.screen === 'play' && G.wave < targetWave && guard < 40) {
    guard += 1;
    planIndex = spendBuildPhase(api, planIndex);
    if (G.screen !== 'play' || G.phase !== 'build') break;
    api.startWave();
    runWave(api, 240);
  }
  return planIndex;
}

/**
 * Stage the named scene and return the screen to show over it:
 * 'title' | 'play' | 'victory' | 'defeat'.
 */
export function stageShot(name, seed, api) {
  const G = api.G;
  api.newGame(seed);
  if (name === 'start') {
    let idx = 0;
    for (let i = 0; i < 3; i += 1) {
      const step = PLAN[idx];
      idx += 1;
      api.selectPlot(step.plot);
      api.buildTower(step.type);
    }
    // No wave yet: the title stands over a fresh game in build phase.
    G.screen = 'title';
    return { screen: 'title' };
  }
  if (name === 'play') {
    playUntilWave(api, 3);
    const idx = spendBuildPhase(api, 0);
    void idx;
    if (G.screen === 'play' && G.phase === 'build') api.startWave();
    api.fastForward(14);
    return { screen: G.screen };
  }
  if (name === 'boss') {
    playUntilWave(api, 4);
    spendBuildPhase(api, 0);
    if (G.screen === 'play' && G.phase === 'build') api.startWave();
    // Wait until the Titan is on the road, then until it is mid-screen on
    // the top road — the boss shot must actually show the boss.
    let spent = 0;
    while (G.screen === 'play' && G.phase === 'fight' && spent < 120) {
      api.fastForward(0.5);
      spent += 0.5;
      const titan = G.enemies.find((e) => e.type === 'titan');
      if (titan && titan.x >= 620) break;
      if (!titan && spent > 30) break;
    }
    return { screen: G.screen };
  }
  // 'end': play the whole game with the autopilot.
  let planIndex = 0;
  let total = 0;
  while (G.screen === 'play' && total < 1500) {
    planIndex = spendBuildPhase(api, planIndex);
    if (G.screen !== 'play' || G.phase !== 'build') break;
    api.startWave();
    runWave(api, 240);
    total += 60;
  }
  return { screen: G.screen };
}
