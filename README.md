# Dark Shadow

A 2D fighting game where every fighter has a **shadow spirit** behind them that grows into a giant for the ultimate move.

Built with [Phaser 3](https://phaser.io) + TypeScript + Vite.

**Play it:** https://hozeis.github.io/dark-shadow/

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Controls

| | Move / Jump / Block | Punch | Kick | Special | Shadow Ultimate |
|---|---|---|---|---|---|
| Player 1 | W A S D (S = block) | F | G | R | H |
| Player 2 | Arrow keys (↓ = block) | J | K | U | L |

**Special moves:** press Special alone or with a direction. R's moves (from his character sheet):

| Press | Move | What it does |
|---|---|---|
| Special | Energy Wave | Shoots an energy blast that pushes the enemy back |
| Forward + Special | Shadow Dash | Rushes forward and hits anyone in the way |
| Up + Special | Rising Breaker | Jumping uppercut that launches the enemy |
| Down + Special | Spirit Bind | The shadow's chains grab the enemy and pull them in |

Every fighter has the same four kinds of moves with their own names (see `specials(...)` in `src/fighters/roster.ts`).

Fill the shadow meter by hitting (and getting hit). When it says **SHADOW READY!**, press the ultimate key.

## On iPhone

1. Open the game's web address in **Safari**.
2. Tap **Share → Add to Home Screen**. It gets its own icon and runs full screen.
3. Hold the phone sideways. Left thumb: joystick (appears wherever you touch). Right thumb: PUNCH, KICK, SPECIAL, SHADOW.

To test touch controls on a computer, add `?touch=1` to the address.

## Online multiplayer

Title screen → **PLAY ONLINE**:
- **Create room** gives you a 4-letter code. Tap **Share invite link** to send it (opening the link joins automatically).
- **Join room**: type your friend's code.

The two devices connect directly (WebRTC via the free PeerJS service). The player who created the room runs the fight; the other player sees what the host sees. Phones and computers can play each other.

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
| `src/scenes/TouchScene.ts` | On-screen joystick and buttons for phones |
| `src/scenes/OnlineScene.ts` | Online lobby: create/join rooms |
| `src/net/NetSession.ts` | Online connection between two devices |

## Adding a new drawing

1. Take a photo of the drawing from straight above, in good light, and put it in `art/drawings/`.
2. In `art/characters.mjs`, copy one of the characters and set the pixel coordinates (on the photo) of each body part and joint.
3. Run `npm run art`. It cleans the photo, cuts the parts into `public/art/` and writes `src/art/rigs.json`.
4. In `src/fighters/roster.ts`, add `art: '<id>'` to the fighter's `look` (or `shadowLook`).

### From a character sheet

Digital art on a dark background works too (see `r-sheet` in `art/characters.mjs`): set `source: 'sheet'`, `mirror: true` if the figure faces left, and `faceCamera: false` for a 3/4 or side view. Then use `sheetArt: '<id>'` in the fighter's look.

### Art styles

Press **T** on the title screen to cycle: **SHEET** (character-sheet art), **HAND-DRAWN** (the original drawing) and **SHAPES** (the original shape style).
The shape-only version is also saved in git as the tag `shape-style-v1`.

## Publish an update

```bash
npm run deploy
```

Builds the game and pushes it to the `gh-pages` branch. The site updates in about a minute.

## Publish to itch.io

```bash
npm run build
```

Zip the contents of the `dist/` folder, create a new project on itch.io, choose **HTML** as the kind of project, upload the zip and tick "This file will be played in the browser".
