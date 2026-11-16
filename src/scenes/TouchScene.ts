import Phaser from 'phaser';
import { NO_INPUT, type Input } from '../game/input';
import { FONT } from '../config';

/** Is this a phone/tablet? (add ?touch=1 to the URL to test on a computer) */
export function isTouchDevice(game: Phaser.Game) {
  return game.device.input.touch || new URLSearchParams(location.search).has('touch');
}

interface Button {
  x: number; y: number; r: number;
  key: 'punch' | 'kick' | 'ult';
  gfx: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  pointer: number | null;
  count: number;
  seen: number;
}

/**
 * On-screen controls for phones: a joystick on the left (appears where your thumb
 * lands) and Punch / Kick / Shadow buttons on the right.
 */
export class TouchScene extends Phaser.Scene {
  private stickPointer: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();
  private stickVec = new Phaser.Math.Vector2();
  private base!: Phaser.GameObjects.Arc;
  private knob!: Phaser.GameObjects.Arc;
  private buttons: Button[] = [];
  private menuTaps = 0;
  /** Set by the fight scene: is the shadow ultimate ready? (makes the button glow) */
  ultReady = false;
  /** Set by the fight scene each frame */
  showRematch = false;
  onRematch?: () => void;
  onMenu?: () => void;
  private rematchBtn!: Phaser.GameObjects.Container;

  private static readonly HOME = { x: 170, y: 560 };
  private static readonly RADIUS = 75;

  constructor() {
    super('Touch');
  }

  create() {
    this.buttons = [];
    this.stickPointer = null;
    this.stickVec.set(0, 0);
    this.ultReady = false;
    this.showRematch = false;
    this.input.addPointer(3); // up to 4 fingers at once

    const { HOME, RADIUS } = TouchScene;
    this.base = this.add.circle(HOME.x, HOME.y, RADIUS, 0xffffff, 0.08).setStrokeStyle(4, 0xffffff, 0.35);
    this.knob = this.add.circle(HOME.x, HOME.y, 34, 0xb48cff, 0.55).setStrokeStyle(3, 0xffffff, 0.7);

    this.addButton(1020, 600, 58, 'punch', 'PUNCH', 0xffd23f);
    this.addButton(1150, 515, 58, 'kick', 'KICK', 0xff7a1a);
    this.addButton(1175, 650, 46, 'ult', 'SHADOW', 0x9b7bff);

    const menu = this.add.text(640, 120, 'MENU', {
      fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0.7).setInteractive();
    menu.on('pointerdown', () => {
      // tap twice so you don't quit by accident
      this.menuTaps++;
      if (this.menuTaps >= 2) this.onMenu?.();
      else {
        menu.setText('TAP AGAIN TO QUIT');
        this.time.delayedCall(1500, () => { this.menuTaps = 0; menu.setText('MENU'); });
      }
    });

    const rb = this.add.rectangle(0, 0, 360, 80, 0x000000, 0.75).setStrokeStyle(4, 0xffd23f);
    const rt = this.add.text(0, 0, 'REMATCH', { fontFamily: FONT, fontSize: '44px', color: '#ffd23f', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    this.rematchBtn = this.add.container(640, 520, [rb, rt]).setVisible(false).setSize(360, 80).setInteractive();
    this.rematchBtn.on('pointerdown', () => this.onRematch?.());

    this.input.on('pointerdown', this.down, this);
    this.input.on('pointermove', this.move, this);
    this.input.on('pointerup', this.up, this);
    this.input.on('pointerupoutside', this.up, this);
  }

  private addButton(x: number, y: number, r: number, key: Button['key'], text: string, color: number) {
    const gfx = this.add.circle(x, y, r, color, 0.28).setStrokeStyle(4, color, 0.9);
    const label = this.add.text(x, y, text, {
      fontFamily: FONT, fontSize: r > 50 ? '24px' : '19px', color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.buttons.push({ x, y, r, key, gfx, label, pointer: null, count: 0, seen: 0 });
  }

  private down(p: Phaser.Input.Pointer) {
    for (const b of this.buttons) {
      if (Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) <= b.r + 14) {
        b.pointer = p.id;
        b.count++;
        b.gfx.setScale(0.88).setFillStyle(b.gfx.strokeColor, 0.6);
        return;
      }
    }
    if (p.x < 560 && p.y > 160 && this.stickPointer === null) {
      this.stickPointer = p.id;
      this.stickOrigin.set(p.x, p.y);
      this.base.setPosition(p.x, p.y);
      this.knob.setPosition(p.x, p.y);
      this.stickVec.set(0, 0);
    }
  }

  private move(p: Phaser.Input.Pointer) {
    if (p.id !== this.stickPointer) return;
    const R = TouchScene.RADIUS;
    this.stickVec.set(p.x - this.stickOrigin.x, p.y - this.stickOrigin.y);
    if (this.stickVec.length() > R) this.stickVec.setLength(R);
    this.knob.setPosition(this.stickOrigin.x + this.stickVec.x, this.stickOrigin.y + this.stickVec.y);
  }

  private up(p: Phaser.Input.Pointer) {
    if (p.id === this.stickPointer) {
      this.stickPointer = null;
      this.stickVec.set(0, 0);
      const { HOME } = TouchScene;
      this.base.setPosition(HOME.x, HOME.y);
      this.knob.setPosition(HOME.x, HOME.y);
    }
    for (const b of this.buttons) {
      if (b.pointer === p.id) {
        b.pointer = null;
        b.gfx.setScale(1).setFillStyle(b.gfx.strokeColor, 0.28);
      }
    }
  }

  /** What the thumbs are pressing right now. Button presses are reported once. */
  read(): Input {
    const R = TouchScene.RADIUS;
    const nx = this.stickVec.x / R, ny = this.stickVec.y / R;
    const out: Input = { ...NO_INPUT, left: nx < -0.35, right: nx > 0.35, up: ny < -0.6, down: ny > 0.6 };
    for (const b of this.buttons) {
      if (b.count !== b.seen) {
        out[b.key] = true;
        b.seen = b.count;
      }
    }
    return out;
  }

  update(time: number) {
    const ult = this.buttons.find((b) => b.key === 'ult');
    if (ult && ult.pointer === null) {
      const pulse = this.ultReady ? 0.35 + 0.3 * (Math.sin(time * 0.012) + 1) / 2 : 0.15;
      ult.gfx.setFillStyle(0x9b7bff, pulse);
      ult.label.setAlpha(this.ultReady ? 1 : 0.5);
    }
    this.rematchBtn.setVisible(this.showRematch);
  }
}
