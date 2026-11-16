import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { FightScene } from './scenes/FightScene';
import { HudScene } from './scenes/HudScene';
import { GAME_W, GAME_H } from './config';

async function boot() {
  // Wait (briefly) for the comic font so text doesn't flash in a default font
  try {
    await Promise.race([document.fonts.load('40px Bangers'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* ignore, fall back to Impact */
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#05020a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [TitleScene, FightScene, HudScene],
  });

  // Handy for debugging in the browser console (dev only)
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

boot();
