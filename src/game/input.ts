import Phaser from 'phaser';

/** What a fighter wants to do this frame. Comes from the keyboard or the CPU. */
export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean; // true only on the frame the button is pressed
  kick: boolean;
  ult: boolean;
}

export const NO_INPUT: Input = {
  left: false, right: false, up: false, down: false, punch: false, kick: false, ult: false,
};

export type KeySet = Record<keyof Input, Phaser.Input.Keyboard.Key>;

export function makeKeys(scene: Phaser.Scene, map: Record<keyof Input, string>): KeySet {
  return scene.input.keyboard!.addKeys(map) as KeySet;
}

export function readKeys(k: KeySet): Input {
  const jd = Phaser.Input.Keyboard.JustDown;
  return {
    left: k.left.isDown,
    right: k.right.isDown,
    up: k.up.isDown,
    down: k.down.isDown,
    punch: jd(k.punch),
    kick: jd(k.kick),
    ult: jd(k.ult),
  };
}
