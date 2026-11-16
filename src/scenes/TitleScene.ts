import Phaser from 'phaser';
import { drawStage } from '../game/stage';
import { Puppet, BASE_POSE } from '../game/Puppet';
import { ROSTER } from '../fighters/roster';
import { FONT, GROUND_Y } from '../config';
import { RIGS } from '../art/rigs';
import { settings } from '../settings';

export class TitleScene extends Phaser.Scene {
  private hero!: Puppet;
  private spirit!: Puppet;

  constructor() {
    super('Title');
  }

  preload() {
    // Load every hand-drawn body part (made by `npm run art`)
    for (const rig of Object.values(RIGS)) {
      for (const img of rig.images) if (!this.textures.exists(img.key)) this.load.image(img.key, img.file);
    }
  }

  create() {
    this.cameras.main.setZoom(1).centerOn(640, 360);
    drawStage(this);
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.3).setDepth(2);

    const def = ROSTER[0];
    this.spirit = new Puppet(this, def.shadowLook, 600, GROUND_Y, def.shadowGlow, 0.9);
    this.spirit.addGlow(def.shadowGlow);
    this.spirit.root.setScale(1.8).setAlpha(0.55).setDepth(3);
    this.hero = new Puppet(this, def.look, 650, GROUND_Y);
    this.hero.root.setDepth(4);

    const title = this.add.text(640, 110, 'DARK SHADOW', {
      fontFamily: FONT, fontSize: '140px', color: '#ffffff', stroke: '#2a0f55', strokeThickness: 14,
    }).setOrigin(0.5).setDepth(5);
    (title as unknown as { postFX?: Phaser.GameObjects.Components.FX }).postFX?.addGlow(0x9b7bff, 6, 0, false, 0.1, 14);
    this.add.text(640, 190, 'Unleash your shadow', {
      fontFamily: FONT, fontSize: '32px', color: '#d9c4ff', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(5);

    // Opened an invite link? Go straight to the friend's room.
    const room = new URLSearchParams(location.search).get('room');
    if (room) {
      history.replaceState(null, '', location.pathname);
      this.scene.start('Online', { join: room });
      return;
    }

    const menu = [
      { label: '1   PLAYER  vs  PLAYER', mode: 'pvp' as const, x: 240, y: 370 },
      { label: '2   PLAYER  vs  CPU', mode: 'cpu' as const, x: 240, y: 450 },
      { label: '3   PLAY  ONLINE', mode: 'online' as const, x: 1040, y: 410 },
    ];
    for (const m of menu) {
      const t = this.add.text(m.x, m.y, m.label, {
        fontFamily: FONT, fontSize: '40px', color: '#ffd23f', stroke: '#000', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setScale(1.1));
      t.on('pointerout', () => t.setScale(1));
      t.on('pointerdown', () => this.start(m.mode));
      this.tweens.add({ targets: t, alpha: 0.6, yoyo: true, repeat: -1, duration: 700 });
    }

    const controls = [
      'P1:  W A S D  move/jump/block   ·   F  punch   ·   G  kick   ·   H  shadow ultimate',
      'P2:  ARROWS  move/jump/block   ·   J  punch   ·   K  kick   ·   L  shadow ultimate',
    ];
    this.add.text(640, 668, controls.join('\n'), {
      fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5).setDepth(5);

    const styleText = this.add.text(1260, 20, '', {
      fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#000', strokeThickness: 5,
    }).setOrigin(1, 0).setDepth(5).setInteractive({ useHandCursor: true });
    styleText.setText(`ART STYLE:  ${settings.artStyle === 'drawn' ? 'DRAWN' : 'SHAPES'}   [T]`);
    styleText.on('pointerdown', () => this.toggleStyle());

    const kb = this.input.keyboard!;
    kb.once('keydown-T', () => this.toggleStyle());
    kb.once('keydown-ONE', () => this.start('pvp'));
    kb.once('keydown-TWO', () => this.start('cpu'));
    kb.once('keydown-THREE', () => this.start('online'));
    kb.once('keydown-ENTER', () => this.start('pvp'));
  }

  update(time: number) {
    const b = Math.sin(time * 0.004);
    this.hero.applyPose({ ...BASE_POSE, armF: -55 + b * 4, armB: -40, legF: -12, legB: 12, bob: b * 3 }, 1);
    this.spirit.applyPose({ ...BASE_POSE, armF: -60 + b * 8, armB: -45, legF: -12, legB: 12, bob: b * 5 }, 1);
  }

  private toggleStyle() {
    settings.toggleArtStyle();
    this.input.keyboard!.removeAllListeners();
    this.scene.restart();
  }

  private start(mode: 'pvp' | 'cpu' | 'online') {
    this.input.keyboard!.removeAllListeners();
    if (mode === 'online') this.scene.start('Online');
    else this.scene.start('Fight', { mode });
  }
}
