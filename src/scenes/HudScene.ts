import Phaser from 'phaser';
import type { FightScene } from './FightScene';
import type { Fighter } from '../game/Fighter';
import { FONT, MAX_HP, P1_KEYS, P2_KEYS, WINS_NEEDED } from '../config';
import { net } from '../net/NetSession';
import { isTouchDevice } from './TouchScene';

/** Health bars, timer, shadow meters and big announcements. Drawn on top, never zooms. */
export class HudScene extends Phaser.Scene {
  private fight!: FightScene;
  private g!: Phaser.GameObjects.Graphics;
  private shown = [MAX_HP, MAX_HP];
  private timerText!: Phaser.GameObjects.Text;
  private annText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private meterText: Phaser.GameObjects.Text[] = [];
  private banner!: Phaser.GameObjects.Container;
  private bannerBg!: Phaser.GameObjects.Rectangle;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private onlineText!: Phaser.GameObjects.Text;
  private touch = false;
  private annId = 0;
  private bannerId = 0;

  constructor() {
    super('Hud');
  }

  create() {
    this.fight = this.scene.get('Fight') as FightScene;
    this.shown = [MAX_HP, MAX_HP];
    this.annId = 0;
    this.bannerId = 0;
    this.g = this.add.graphics();

    const style = (size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: Math.max(4, size / 8),
    });

    this.add.text(60, 72, this.fight.p1.def.name, style(30));
    this.add.text(1220, 72, this.fight.p2.def.name, style(30)).setOrigin(1, 0);
    this.timerText = this.add.text(640, 50, '99', style(52)).setOrigin(0.5);

    this.meterText[0] = this.add.text(60, 618, '', style(24, '#d9c4ff'));
    this.meterText[1] = this.add.text(1220, 618, '', style(24, '#d9c4ff')).setOrigin(1, 0);

    this.touch = isTouchDevice(this.game);
    this.onlineText = this.add.text(640, 96, '', style(18, '#a8ffb3')).setOrigin(0.5);
    if (this.touch) for (const t of this.meterText) t.setVisible(false); // the SHADOW button glows instead

    this.annText = this.add.text(640, 320, '', style(130)).setOrigin(0.5).setAlpha(0);
    this.hint = this.add.text(640, 440, 'ENTER — Rematch      ESC — Menu', style(34)).setOrigin(0.5).setVisible(false);

    this.bannerBg = this.add.rectangle(0, 0, 1280, 92, 0x000000, 0.8);
    this.bannerTitle = this.add.text(0, -14, '', style(50)).setOrigin(0.5);
    this.bannerSub = this.add.text(0, 26, '', style(26, '#ffe9a8')).setOrigin(0.5);
    this.banner = this.add.container(-1280, 150, [this.bannerBg, this.bannerTitle, this.bannerSub]).setVisible(false);
  }

  update(time: number) {
    const f = this.fight;
    if (!f.p1) return;
    const g = this.g;
    g.clear();

    this.drawHealth(0, f.p1, 60, 30, 500, false);
    this.drawHealth(1, f.p2, 720, 30, 500, true);

    // Timer box
    g.fillStyle(0x000000, 0.55).fillRoundedRect(590, 14, 100, 72, 10);
    g.lineStyle(3, 0xffffff, 0.35).strokeRoundedRect(590, 14, 100, 72, 10);
    this.timerText.setText(String(Math.ceil(Math.max(0, f.timeLeft))));

    // Round win pips
    for (let i = 0; i < WINS_NEEDED; i++) {
      this.pip(552 - i * 26, 82, f.p1.wins > i);
      this.pip(728 + i * 26, 82, f.p2.wins > i);
    }

    // On phones the thumbs cover the bottom of the screen, so the meters go under the health bars
    if (this.touch) {
      this.drawMeter(0, f.p1, 60, 112, 260, false, time, P1_KEYS.ult);
      this.drawMeter(1, f.p2, 960, 112, 260, true, time, P2_KEYS.ult);
    } else {
      this.drawMeter(0, f.p1, 60, 650, 320, false, time, P1_KEYS.ult);
      this.drawMeter(1, f.p2, 900, 650, 320, true, time, P2_KEYS.ult);
    }

    // Announcements (ROUND 1, FIGHT!, K.O.!)
    if (f.announcement.id !== this.annId) {
      this.annId = f.announcement.id;
      const a = f.announcement;
      this.tweens.killTweensOf(this.annText);
      this.annText.setText(a.text).setColor(a.color).setAlpha(1).setScale(2.2);
      this.tweens.add({ targets: this.annText, scale: 1, duration: 260, ease: 'Back.easeOut' });
      if (!a.hold) this.tweens.add({ targets: this.annText, alpha: 0, delay: 950, duration: 300 });
    }
    this.hint.setVisible(f.roundState === 'matchEnd' && !this.touch);
    const s = net.session;
    this.onlineText.setText(
      (f.mode === 'host' || f.mode === 'guest') && s
        ? `ONLINE · ROOM ${s.code} · YOU ARE ${f.mode === 'host' ? 'LEFT' : 'RIGHT'} · ${s.ping} MS`
        : '',
    );

    // Ultimate banner
    if (f.banner.id !== this.bannerId) {
      this.bannerId = f.banner.id;
      this.bannerBg.setStrokeStyle(4, f.banner.color);
      this.bannerTitle.setText(f.banner.title).setColor(Phaser.Display.Color.IntegerToColor(f.banner.color).rgba);
      this.bannerSub.setText(f.banner.sub);
      this.tweens.killTweensOf(this.banner);
      this.banner.setVisible(true).setX(-640);
      this.tweens.chain({
        targets: this.banner,
        tweens: [
          { x: 640, duration: 220, ease: 'Cubic.easeOut' },
          { x: 1920, duration: 220, delay: 1100, ease: 'Cubic.easeIn' },
        ],
      });
    }
  }

  private drawHealth(i: number, p: Fighter, x: number, y: number, w: number, rightSide: boolean) {
    const g = this.g;
    const h = 28;
    // the red "damage" bar slides down after the yellow one
    if (this.shown[i] > p.hp) this.shown[i] -= Math.max(0.25, (this.shown[i] - p.hp) * 0.04);
    else this.shown[i] = p.hp;

    const bar = (frac: number, color: number) => {
      const bw = w * Phaser.Math.Clamp(frac, 0, 1);
      g.fillStyle(color, 1).fillRect(rightSide ? x : x + w - bw, y, bw, h);
    };
    g.fillStyle(0x000000, 0.7).fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle(0x3a0d18, 1).fillRect(x, y, w, h);
    bar(this.shown[i] / MAX_HP, 0xff3355);
    bar(p.hp / MAX_HP, p.hp / MAX_HP > 0.3 ? 0xffd23f : 0xff7a1a);
    g.fillStyle(0xffffff, 0.25).fillRect(x, y, w, h * 0.35);
  }

  private drawMeter(i: number, p: Fighter, x: number, y: number, w: number, rightSide: boolean, time: number, key: string) {
    const g = this.g;
    const h = 16;
    const full = p.meter >= 100;
    const bw = w * (p.meter / 100);
    g.fillStyle(0x000000, 0.7).fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle(0x1d1033, 1).fillRect(x, y, w, h);
    const pulse = full ? (Math.sin(time * 0.012) + 1) / 2 : 0;
    const color = full
      ? Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(p.def.shadowGlow), Phaser.Display.Color.IntegerToColor(0xffffff), 1, pulse)
      : null;
    g.fillStyle(color ? Phaser.Display.Color.GetColor(color.r, color.g, color.b) : p.def.shadowGlow, 1);
    g.fillRect(rightSide ? x + w - bw : x, y, bw, h);
    this.meterText[i].setText(full ? (this.touch ? 'SHADOW READY!' : `SHADOW READY!  [${key}]`) : `${p.def.shadowName}`);
    this.meterText[i].setColor(full ? '#ffffff' : '#bfa8ee');
  }

  private pip(x: number, y: number, on: boolean) {
    this.g.fillStyle(on ? 0xffd23f : 0x222222, 1).fillCircle(x, y, 9);
    this.g.lineStyle(2, 0x000000, 1).strokeCircle(x, y, 9);
  }
}
