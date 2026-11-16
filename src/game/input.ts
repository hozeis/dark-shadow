import Phaser from 'phaser';

/** What a fighter wants to do this frame. Comes from the keyboard or the CPU. */
export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean; // true only on the frame the button is pressed
  kick: boolean;
  special: boolean;
  ult: boolean;
}

export const NO_INPUT: Input = {
  left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, ult: false,
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
    special: jd(k.special),
    ult: jd(k.ult),
  };
}

/** Combine several input sources (keyboard + touch, etc.) */
export function mergeInputs(...inputs: Input[]): Input {
  const out = { ...NO_INPUT };
  for (const i of inputs) for (const k of Object.keys(out) as (keyof Input)[]) out[k] = out[k] || i[k];
  return out;
}

/**
 * Inputs sent over the network. Button presses are counters, so a press is never
 * lost even if two network packets arrive in the same frame.
 */
export interface NetInput { l: 0 | 1; r: 0 | 1; u: 0 | 1; d: 0 | 1; pc: number; kc: number; sc: number; uc: number }

export class NetInputEncoder {
  private counts = { pc: 0, kc: 0, sc: 0, uc: 0 };
  encode(i: Input): NetInput {
    if (i.punch) this.counts.pc++;
    if (i.kick) this.counts.kc++;
    if (i.special) this.counts.sc++;
    if (i.ult) this.counts.uc++;
    return { l: i.left ? 1 : 0, r: i.right ? 1 : 0, u: i.up ? 1 : 0, d: i.down ? 1 : 0, ...this.counts };
  }
}

export class NetInputDecoder {
  private latest: NetInput | null = null;
  private seen = { pc: 0, kc: 0, sc: 0, uc: 0 };
  push(n: NetInput) {
    if (!this.latest) this.seen = { pc: n.pc, kc: n.kc, sc: n.sc, uc: n.uc };
    this.latest = n;
  }
  read(): Input {
    const n = this.latest;
    if (!n) return { ...NO_INPUT };
    const out: Input = {
      left: !!n.l, right: !!n.r, up: !!n.u, down: !!n.d,
      punch: n.pc !== this.seen.pc, kick: n.kc !== this.seen.kc, special: n.sc !== this.seen.sc, ult: n.uc !== this.seen.uc,
    };
    this.seen = { pc: n.pc, kc: n.kc, sc: n.sc, uc: n.uc };
    return out;
  }
}
