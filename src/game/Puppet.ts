import Phaser from 'phaser';
import type { Look } from '../fighters/types';
import { FONT } from '../config';
import { RIGS, type Rig } from '../art/rigs';
import { SPRITES, type SpriteSet } from '../art/sprites';
import { settings } from '../settings';

/**
 * A paper-puppet body made of simple shapes (head, torso, arms, legs).
 * Each limb rotates around its joint, so poses are just angles.
 * If the look has hand-drawn art (and the art style is "drawn"), the pieces
 * are cut-outs of the real drawing instead of shapes.
 */

export interface Pose {
  armF: number; // front arm angle (0 = hanging down, -90 = pointing forward)
  armB: number; // back arm
  legF: number;
  legB: number;
  lean: number; // upper body lean (+ = forward)
  bob: number; // upper body up/down offset
  tilt: number; // whole body rotation (-85 = lying on the back)
}

export const BASE_POSE: Pose = { armF: -50, armB: -35, legF: -10, legB: 10, lean: 0, bob: 0, tilt: 0 };
const POSE_KEYS = Object.keys(BASE_POSE) as (keyof Pose)[];

export function shade(color: number, f: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return Phaser.Display.Color.GetColor(m(c.red), m(c.green), m(c.blue));
}

type Shape = Phaser.GameObjects.Shape;

export class Puppet {
  readonly root: Phaser.GameObjects.Container; // position + facing
  readonly rig: Phaser.GameObjects.Container; // tilt / spin
  upper!: Phaser.GameObjects.Container; // torso, head, arms
  armF!: Phaser.GameObjects.Container;
  armB!: Phaser.GameObjects.Container;
  legF!: Phaser.GameObjects.Container;
  legB!: Phaser.GameObjects.Container;
  pose: Pose = { ...BASE_POSE };
  readonly drawn: boolean;

  private hipY = -80;
  private shapes: { s: Shape; color: number }[] = [];
  private images: { img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; tint: number }[] = [];
  /** Sprite-sheet mode: one animated picture instead of limbs */
  private sprite?: Phaser.GameObjects.Sprite;
  private spriteSet?: SpriteSet;
  private frameName = '';
  private head?: Phaser.GameObjects.Container;
  private headFacesCamera = true;
  private letter?: Phaser.GameObjects.Text;
  private flashTimer?: Phaser.Time.TimerEvent;

  constructor(
    private scene: Phaser.Scene,
    look: Look,
    x: number,
    y: number,
    private outline = 0x000000,
    private outlineAlpha = 0.85,
  ) {
    this.root = scene.add.container(x, y);
    this.rig = scene.add.container(0, 0);
    this.root.add(this.rig);

    const style = settings.artStyle;
    const sprites = style === 'sprites' && look.sprite ? SPRITES[look.sprite] : undefined;
    const artId = style === 'sprites' || style === 'sheet' ? look.sheetArt ?? look.art : style === 'drawn' ? look.art : undefined;
    const art = artId ? RIGS[artId] : undefined;
    this.drawn = !!art && art.images.every((i) => scene.textures.exists(i.key));
    if (sprites && scene.textures.exists(sprites.key)) {
      this.drawn = true;
      this.buildSprite(sprites);
    } else if (this.drawn) this.buildDrawn(art!);
    else this.buildShapes(look);
  }

  get isSprite() {
    return !!this.sprite;
  }

  /** Does the sprite sheet have this animation? */
  hasAnim(anim: string) {
    return !!this.spriteSet?.anims[anim];
  }

  /** Show one frame of a sprite animation (the index wraps around). */
  showFrame(anim: string, index: number) {
    const n = this.spriteSet?.anims[anim];
    if (!this.sprite || !n) return;
    const name = `${anim}-${((Math.floor(index) % n) + n) % n}`;
    if (name !== this.frameName) {
      this.frameName = name;
      this.sprite.setFrame(name); // the atlas tells Phaser where the feet are
    }
  }

  /** Build the body from a sprite sheet: one picture that changes frames. */
  private buildSprite(set: SpriteSet) {
    this.spriteSet = set;
    this.sprite = this.scene.add.sprite(0, 0, set.key, 'idle-0').setScale(set.displayScale);
    this.frameName = 'idle-0';
    this.images.push({ img: this.sprite, tint: 0xffffff });
    // invisible limbs, so poses can still be set (they just don't show)
    const c = () => this.scene.add.container(0, 0);
    this.legB = c();
    this.legF = c();
    this.armB = c();
    this.armF = c();
    this.upper = c();
    this.upper.add([this.armB, this.armF]);
    this.rig.add([this.sprite, this.legB, this.legF, this.upper]);
  }

  /** Build the body from pieces of the hand drawing. */
  private buildDrawn(rig: Rig) {
    const BACK = 0xb8b0c4; // back arm/leg slightly darker so the body reads in 3D
    const piece = (slot: keyof Rig['slots'], tint = 0xffffff) => {
      const sl = rig.slots[slot];
      const c = this.scene.add.container(sl.pos[0], sl.pos[1]);
      const img = this.scene.add.image(0, 0, sl.image).setOrigin(sl.origin[0], sl.origin[1]).setScale(rig.displayScale);
      if (tint !== 0xffffff) img.setTint(tint);
      this.images.push({ img, tint });
      c.add(img);
      return c;
    };
    this.hipY = rig.hip[1];
    this.headFacesCamera = rig.faceCamera !== false;
    this.legB = piece('legB', BACK);
    this.legF = piece('legF');
    this.upper = this.scene.add.container(rig.hip[0], rig.hip[1]);
    this.armB = piece('armB', BACK);
    const torso = piece('torso');
    // torso/head/arm positions are relative to the hip
    this.head = piece('head');
    this.armF = piece('armF');
    this.upper.add([this.armB, torso, this.head, this.armF]);
    this.rig.add([this.legB, this.legF, this.upper]);
  }

  /** Build the body out of simple shapes (the original style). */
  private buildShapes(look: Look) {
    const scene = this.scene;
    this.legB = this.limb(-9, -80, 22, 80, shade(look.pants, 0.75), 'foot', shade(look.shoes, 0.75));
    this.legF = this.limb(9, -80, 22, 80, look.pants, 'foot', look.shoes);

    this.upper = scene.add.container(0, -80);
    this.armB = this.limb(-14, -62, 17, 66, shade(look.shirt, 0.75), 'hand', shade(look.skin, 0.8),
      look.pads !== undefined ? shade(look.pads, 0.75) : undefined);
    this.armF = this.limb(16, -62, 17, 66, look.shirt, 'hand', look.skin, look.pads);

    const torso = this.rect(0, -36, 54, 72, look.shirt);
    const chest = this.rect(0, -30, 2, 50, shade(look.shirt, 0.8)); // little center seam
    const belt = this.rect(0, -4, 58, 10, look.belt ?? shade(look.pants, 0.7));
    this.upper.add([this.armB, torso, chest, belt]);
    this.buildHead(look);
    this.upper.add(this.armF);

    this.rig.add([this.legB, this.legF, this.upper]);
  }

  private buildHead(look: Look) {
    const y = -94;
    const add = (...objs: Phaser.GameObjects.GameObject[]) => this.upper.add(objs);
    add(this.rect(0, -74, 18, 12, look.skin)); // neck

    if (look.head === 'mask') {
      const stripe = look.stripe ?? 0xffcc33;
      add(
        this.rect(0, y, 46, 52, look.accent),
        this.rect(0, y, 10, 52, stripe),
        this.rect(4, y - 2, 40, 8, stripe),
        this.rect(0, y + 21, 34, 10, shade(look.accent, 0.6)),
      );
      return;
    }

    add(this.circle(0, y, 21, look.skin));
    if (look.head === 'cap') {
      add(this.rect(0, y - 16, 44, 22, look.accent), this.rect(18, y - 6, 26, 6, shade(look.accent, 0.8)));
      if (look.letter) {
        this.letter = this.scene.add
          .text(-1, y - 16, look.letter, {
            fontFamily: FONT, fontSize: '20px',
            color: Phaser.Display.Color.IntegerToColor(look.accent).v < 0.5 ? '#f4f4f4' : '#2a2a33',
          })
          .setOrigin(0.5);
        add(this.letter);
      }
    } else if (look.head === 'hair') {
      add(this.ellipse(-2, y - 13, 46, 26, look.accent));
    } else if (look.head === 'bandana') {
      add(this.rect(0, y - 10, 44, 9, look.accent), this.rect(-26, y - 4, 16, 6, look.accent));
    }
    add(this.rect(11, y - 2, 4, 7, 0x111111)); // eye
  }

  private limb(x: number, y: number, w: number, len: number, color: number,
    end: 'hand' | 'foot', endColor: number, pad?: number) {
    const c = this.scene.add.container(x, y);
    c.add(this.rect(0, len / 2, w, len, color));
    if (end === 'hand') c.add(this.circle(0, len + 2, w * 0.62, endColor));
    else c.add(this.rect(7, len + 1, w + 14, 12, endColor));
    if (pad !== undefined) c.add(this.rect(0, 4, w + 14, 16, pad));
    return c;
  }

  private track<T extends Shape>(s: T, color: number): T {
    s.setStrokeStyle(3, this.outline, this.outlineAlpha);
    this.shapes.push({ s, color });
    return s;
  }
  private rect(x: number, y: number, w: number, h: number, color: number) {
    return this.track(this.scene.add.rectangle(x, y, w, h, color), color);
  }
  private circle(x: number, y: number, r: number, color: number) {
    return this.track(this.scene.add.circle(x, y, r, color), color);
  }
  private ellipse(x: number, y: number, w: number, h: number, color: number) {
    return this.track(this.scene.add.ellipse(x, y, w, h, color), color);
  }

  /** Smoothly move toward a pose. k = 0..1 (1 = snap instantly). */
  applyPose(target: Pose, k: number, spin = 0) {
    for (const key of POSE_KEYS) this.pose[key] += (target[key] - this.pose[key]) * k;
    const p = this.pose;
    this.armF.angle = p.armF;
    this.armB.angle = p.armB;
    this.legF.angle = p.legF;
    this.legB.angle = p.legB;
    this.upper.angle = p.lean;
    this.upper.y = this.hipY + p.bob;
    this.rig.angle = this.sprite ? spin : p.tilt + spin; // sprite frames already lie down on their own
  }

  /** Keep the cap letter readable when the body is mirrored. */
  setFacing(facing: number) {
    this.letter?.setScale(facing, 1);
    if (this.headFacesCamera) this.head?.setScale(facing, 1); // a face drawn looking at you is never mirrored
  }

  flash(color = 0xffffff, ms = 80) {
    for (const { s } of this.shapes) s.setFillStyle(color);
    for (const { img } of this.images) img.setTintFill(color);
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(ms, () => {
      for (const { s, color: c } of this.shapes) s.setFillStyle(c);
      for (const { img, tint } of this.images) {
        img.clearTint();
        if (tint !== 0xffffff) img.setTint(tint);
      }
    });
  }

  addGlow(color: number) {
    // WebGL only; silently skipped on canvas
    const fx = (this.root as unknown as { postFX?: Phaser.GameObjects.Components.FX }).postFX;
    fx?.addGlow(color, 5, 0, false, 0.1, 12);
  }
}
