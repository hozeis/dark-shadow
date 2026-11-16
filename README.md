# Dark Shadow

A 2D fighting game where every fighter has a **shadow spirit** behind them that grows into a giant for the ultimate move.

Built with [Phaser 3](https://phaser.io) + TypeScript + Vite.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Controls

| | Move / Jump / Block | Punch | Kick | Shadow Ultimate |
|---|---|---|---|---|
| Player 1 | W A S D (S = block) | F | G | H |
| Player 2 | Arrow keys (↓ = block) | J | K | L |

Fill the shadow meter by hitting (and getting hit). When it says **SHADOW READY!**, press the ultimate key.

## Where things live

| File | What it does |
|---|---|
| `src/fighters/roster.ts` | **The fighters.** Names, colors, speed, damage, ultimate. Start here! |
| `src/config.ts` | Game settings: gravity, round time, keys, shadow size |
| `src/game/Fighter.ts` | How a fighter moves, attacks and gets hit |
| `src/game/Puppet.ts` | Draws a fighter's body out of shapes |
| `src/scenes/FightScene.ts` | Rounds, hits, and the **shadow ultimate cinematics** |
| `src/scenes/HudScene.ts` | Health bars, timer, meters, big text |
| `src/game/stage.ts` | The arena background |

## Publish to itch.io

```bash
npm run build
```

Zip the contents of the `dist/` folder, create a new project on itch.io, choose **HTML** as the kind of project, upload the zip and tick "This file will be played in the browser".
