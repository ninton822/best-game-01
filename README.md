# Emberwatch — a tower defence game

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ninton822/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ninton822/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Built for the make.fun bounty: https://make.fun/bounty/best-game-01

A tower defence game in a mountain valley at night. You are the **Warden of the Ember** — the last beacon flame on the cliff. Waves of ash creatures march the winding road from the dark portals to your flame. Build towers on the stone plots, hold all **15 waves**, and keep the Ember alive.

## The game

- **Four towers, three levels each.** Spark Turret (fast, cheap), Frost Spire (slows a whole pack), Mortar (long-range splash), Storm Coil (chain lightning). Every tower can be upgraded twice and sold back.
- **Five creatures.** Ashlings, quick Skitters, armoured Cinderhides, drifting Wisps, and the Ash Titan — a boss on waves 5, 10 and 15 that takes five lives if it gets through.
- **Real choices.** Gold comes from kills and wave bonuses, so every tower is a bet: choke the early bends, save for a Coil, or blanket the road in frost. Leaks cost Ember health — 20 lives, no more.
- **Everything procedural.** All art is drawn in code on a 2D canvas and every sound is synthesized with WebAudio — no assets, no network requests. The whole game is static files under `game/`.

## Controls

| Key | Action |
|---|---|
| Mouse | Click a plot to build, click a tower to upgrade or sell |
| 1 / 2 / 3 / 4 | Build Spark / Frost / Mortar / Coil on the selected plot |
| Space | Start the next wave |
| F | Toggle 2x speed |
| P | Pause |
| M | Mute |
| Esc | Close panel / deselect |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Layout

- `game/index.html` — canvas, HUD, overlays (title, build panel, wave banner, victory, defeat)
- `game/src/main.js` — bootstrap, fixed-step loop, state machine, input, rendering
- `game/src/map.js` — the winding road, build plots, valley drawing
- `game/src/towers.js` — tower types, targeting, firing, upgrades
- `game/src/enemies.js` — creature types, wave composer, spawning, pathing
- `game/src/effects.js` — particles, floating texts, screen shake
- `game/src/audio.js` — procedural WebAudio sounds
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=start|play|boss|end`)
- `game/src/rng.js` — seeded random (mulberry32)
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output` and writes the dossier
