import Phaser from 'phaser';
import { Fighter, type FighterNet } from '../game/Fighter';
import { ROSTER } from '../fighters/roster';
import { drawStage } from '../game/stage';
import {
  makeKeys, readKeys, mergeInputs, NO_INPUT, NetInputDecoder, NetInputEncoder, type KeySet, type Input,
} from '../game/input';
import { net, type NetMessage } from '../net/NetSession';
import { isTouchDevice, type TouchScene } from './TouchScene';
import { CpuBrain } from '../game/cpu';
import {
  GAME_W, GAME_H, GROUND_Y, STAGE_LEFT, STAGE_RIGHT, P1_KEYS, P2_KEYS,
  SHADOW_SCALE, SHADOW_ALPHA, ROUND_TIME, WINS_NEEDED,
} from '../config';

type RoundState = 'intro' | 'fight' | 'cinematic' | 'roundEnd' | 'matchEnd';
/** pvp = 2 players on one device, cpu = vs computer, host/guest = online */
export type Mode = 'pvp' | 'cpu' | 'host' | 'guest';

/** Visual effects the host tells the guest to play */
type Fx =
  | { k: 'sparks'; x: number; y: number; c: number; n: number; b: boolean }
  | { k: 'dust'; x: number; y: number }
  | { k: 'spike'; x: number }
  | { k: 'shake'; d: number; i: number }
  | { k: 'flash'; p: 1 | 2; c: number; ms: number };

interface Snapshot {
  t: 's'; rs: RoundState; tl: number; ann: Announcement; ban: Banner;
  cam: [number, number, number]; ov: number; f: [FighterNet, FighterNet]; fx: Fx[];
}
export interface Announcement { id: number; text: string; color: string; hold: boolean }
export interface Banner { id: number; title: string; sub: string; color: number }

export class FightScene extends Phaser.Scene {
  p1!: Fighter;
  p2!: Fighter;
  mode: Mode = 'pvp';
  round = 1;
  roundState: RoundState = 'intro';
  timeLeft = ROUND_TIME;
  // The HUD scene reads these to show big text
  announcement: Announcement = { id: 0, text: '', color: '#fff', hold: false };
  banner: Banner = { id: 0, title: '', sub: '', color: 0 };

  private hitstop = 0;
  private keys1!: KeySet;
  private keys2!: KeySet;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private cpu: CpuBrain | null = null;
  private overlay!: Phaser.GameObjects.Rectangle;
  private touch: TouchScene | null = null;
  // online
  private remote = new NetInputDecoder();
  private encoder = new NetInputEncoder();
  private fxQueue: Fx[] = [];
  private snapshot: Snapshot | null = null;
  private lastSent = 0;
  private leaving = false;

  constructor() {
    super('Fight');
  }

  init(data: { mode?: Mode }) {
    this.mode = data.mode ?? 'pvp';
    this.fxQueue = [];
    this.snapshot = null;
    this.leaving = false;
    this.remote = new NetInputDecoder();
    this.round = 1;
    this.roundState = 'intro';
    this.hitstop = 0;
    this.announcement = { id: 0, text: '', color: '#fff', hold: false };
    this.banner = { id: 0, title: '', sub: '', color: 0 };
  }

  create() {
    drawStage(this);
    this.overlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, 5000, 4000, 0x05000d, 1).setAlpha(0).setDepth(50);

    this.p1 = new Fighter(this, ROSTER[0], 380, 1);
    this.p2 = new Fighter(this, ROSTER[1], 900, -1);

    this.keys1 = makeKeys(this, P1_KEYS);
    this.keys2 = makeKeys(this, P2_KEYS);
    this.enterKey = this.input.keyboard!.addKey('ENTER');
    this.escKey = this.input.keyboard!.addKey('ESC');
    this.cpu = this.mode === 'cpu' ? new CpuBrain() : null;

    this.cameras.main.setZoom(1).centerOn(GAME_W / 2, GAME_H / 2);
    this.scene.launch('Hud');

    if (isTouchDevice(this.game)) {
      this.scene.launch('Touch');
      this.touch = this.scene.get('Touch') as TouchScene;
      this.touch.onRematch = () => this.requestRematch();
      this.touch.onMenu = () => this.quitToMenu();
    } else {
      this.touch = null;
      this.scene.stop('Touch');
    }

    const session = net.session;
    if (this.mode === 'host' || this.mode === 'guest') {
      if (!session) {
        this.quitToMenu();
        return;
      }
      session.onMessage = (m) => this.onNetMessage(m);
      session.onClose = () => this.opponentLeft();
    }

    if (this.mode !== 'guest') this.startRound();
  }

  /** Which fighter does this device control? (online guest plays P2) */
  get localFighter() {
    return this.mode === 'guest' ? this.p2 : this.p1;
  }

  private touchInput(): Input {
    return this.touch?.read() ?? { ...NO_INPUT };
  }

  private onNetMessage(m: NetMessage) {
    if (this.mode === 'host') {
      if (m.t === 'in') this.remote.push(m.i);
      else if (m.t === 'rematch' && this.roundState === 'matchEnd') this.scene.restart({ mode: this.mode });
    } else if (m.t === 's') {
      this.snapshot = m as unknown as Snapshot;
    }
  }

  private requestRematch() {
    if (this.roundState !== 'matchEnd') return;
    if (this.mode === 'guest') net.session?.send({ t: 'rematch' });
    else this.scene.restart({ mode: this.mode });
  }

  quitToMenu() {
    if (this.leaving) return;
    this.leaving = true;
    if (net.session) {
      net.session.onClose = null;
      net.session.close();
      net.session = null;
    }
    this.scene.stop('Hud');
    this.scene.stop('Touch');
    this.scene.start('Title');
  }

  private opponentLeft() {
    net.session = null;
    this.announce('OPPONENT LEFT', '#ff3355', true);
    this.roundState = 'matchEnd';
    this.time.delayedCall(2500, () => this.quitToMenu());
  }

  private startRound() {
    this.p1.reset(380, 1);
    this.p2.reset(900, -1);
    this.timeLeft = ROUND_TIME;
    this.roundState = 'intro';
    this.announce(`ROUND ${this.round}`, '#ffffff');
    this.time.delayedCall(1200, () => {
      this.announce('FIGHT!', '#ffd23f');
      this.roundState = 'fight';
    });
  }

  announce(text: string, color = '#ffffff', hold = false) {
    this.announcement = { id: this.announcement.id + 1, text, color, hold };
  }

  update(time: number, delta: number) {
    if (this.leaving) return;
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.quitToMenu();
      return;
    }
    if (this.roundState === 'matchEnd' && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.requestRematch();
      return;
    }
    if (this.touch) {
      this.touch.ultReady = this.localFighter.meter >= 100;
      this.touch.showRematch = this.roundState === 'matchEnd' && !!(this.mode !== 'host' && this.mode !== 'guest' || net.session);
    }

    const dt = Math.min(delta, 50) / 1000;
    if (this.mode === 'guest') {
      this.guestUpdate(time, dt);
      return;
    }
    if (this.mode === 'host') this.sendSnapshot(time);

    if (this.hitstop > 0) {
      this.hitstop -= delta; // freeze-frame on hits makes them feel heavy
      return;
    }

    const fighting = this.roundState === 'fight';
    const local = readKeys(this.keys1);
    const k1 = mergeInputs(local, this.touchInput());
    let k2: Input;
    if (this.mode === 'cpu') k2 = this.cpu!.think(this.p2, this.p1, time);
    else if (this.mode === 'host') k2 = this.remote.read();
    else k2 = readKeys(this.keys2);
    this.p1.update(dt, fighting ? k1 : NO_INPUT, this.p2);
    this.p2.update(dt, fighting ? k2 : NO_INPUT, this.p1);
    this.separate();

    if (fighting) {
      this.resolveHit(this.p1, this.p2);
      this.resolveHit(this.p2, this.p1);
      for (const f of [this.p1, this.p2]) {
        if (f.wantsUltimate && this.roundState === 'fight') this.startUltimate(f);
        f.wantsUltimate = false;
      }
    }

    this.p1.sync(time, dt);
    this.p2.sync(time, dt);

    if (this.roundState === 'fight') {
      this.timeLeft -= dt;
      if (this.p1.state === 'ko' || this.p2.state === 'ko') this.endRound(true);
      else if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRound(false);
      }
    }
  }

  // ============================================================
  //  ONLINE
  // ============================================================

  /** Host: send the whole fight state to the guest (every frame). */
  private sendSnapshot(time: number) {
    const s = net.session;
    if (!s || time - this.lastSent < 15) return;
    this.lastSent = time;
    const cam = this.cameras.main;
    const snap: Snapshot = {
      t: 's', rs: this.roundState, tl: Math.round(this.timeLeft * 10) / 10,
      ann: this.announcement, ban: this.banner,
      cam: [Math.round(cam.zoom * 1000) / 1000, Math.round(cam.scrollX), Math.round(cam.scrollY)],
      ov: Math.round(this.overlay.alpha * 100) / 100,
      f: [this.p1.toNet(), this.p2.toNet()],
      fx: this.fxQueue,
    };
    this.fxQueue = [];
    s.send(snap as unknown as NetMessage);
  }

  /** Guest: send my buttons, then draw what the host says. */
  private guestUpdate(time: number, dt: number) {
    const mine = mergeInputs(readKeys(this.keys1), readKeys(this.keys2), this.touchInput());
    net.session?.send({ t: 'in', i: this.encoder.encode(mine) });

    const snap = this.snapshot;
    if (snap) {
      this.snapshot = null;
      this.roundState = snap.rs;
      this.timeLeft = snap.tl;
      this.announcement = snap.ann;
      this.banner = snap.ban;
      this.overlay.setAlpha(snap.ov);
      this.cameras.main.setZoom(snap.cam[0]).setScroll(snap.cam[1], snap.cam[2]);
      this.p1.fromNet(snap.f[0]);
      this.p2.fromNet(snap.f[1]);
      for (const fx of snap.fx) this.playFx(fx);
    }
    this.p1.sync(time, dt);
    this.p2.sync(time, dt);
  }

  private record(fx: Fx) {
    if (this.mode === 'host') this.fxQueue.push(fx);
  }

  private playFx(fx: Fx) {
    switch (fx.k) {
      case 'sparks': this.sparks(fx.x, fx.y, fx.c, fx.n, fx.b); break;
      case 'dust': this.dust(fx.x, fx.y); break;
      case 'spike': this.spike(fx.x); break;
      case 'shake': this.shake(fx.d, fx.i); break;
      case 'flash': this.flash(fx.p === 1 ? this.p1 : this.p2, fx.c, fx.ms); break;
    }
  }

  private shake(duration: number, intensity: number) {
    this.record({ k: 'shake', d: duration, i: intensity });
    this.cameras.main.shake(duration, intensity);
  }

  private flash(f: Fighter, color = 0xffffff, ms = 80) {
    this.record({ k: 'flash', p: f === this.p1 ? 1 : 2, c: color, ms });
    f.puppet.flash(color, ms);
  }

  /** Stop fighters from walking through each other. */
  private separate() {
    const a = this.p1, b = this.p2;
    if (a.frozen || b.frozen || a.state === 'ko' || b.state === 'ko') return;
    const min = 58;
    const dx = b.x - a.x;
    if (Math.abs(dx) >= min || Math.abs(a.y - b.y) > 140) return;
    const dir = dx === 0 ? a.facing : Math.sign(dx);
    const push = (min - Math.abs(dx)) / 2;
    a.x = Phaser.Math.Clamp(a.x - dir * push, STAGE_LEFT, STAGE_RIGHT);
    b.x = Phaser.Math.Clamp(b.x + dir * push, STAGE_LEFT, STAGE_RIGHT);
    if (Math.abs(b.x - a.x) < min) {
      // one of them is against the wall: push the other one
      if (a.x <= STAGE_LEFT || a.x >= STAGE_RIGHT) b.x = a.x + dir * min;
      else a.x = b.x - dir * min;
    }
  }

  private resolveHit(a: Fighter, b: Fighter) {
    const hb = a.hitbox();
    const hu = b.hurtbox();
    if (!hb || !hu || !a.attack) return;
    const overlap = hb.x < hu.x + hu.w && hb.x + hb.w > hu.x && hb.y < hu.y + hu.h && hb.y + hb.h > hu.y;
    if (!overlap) return;

    a.attackHit = true;
    const move = a.attack;
    const res = b.takeHit(move, a);
    const px = hb.x + hb.w / 2, py = hb.y + hb.h / 2;
    if (res === 'block') {
      this.sparks(px, py, 0x66ccff, 6);
      this.hitstop = 40;
    } else {
      a.addMeter(move.damage * 1.2);
      this.flash(b);
      this.sparks(px, py, 0xffdd44, res === 'ko' ? 18 : 10, res === 'ko');
      this.hitstop = res === 'ko' ? 260 : 70;
      this.shake(res === 'ko' ? 400 : 100, res === 'ko' ? 0.015 : 0.004);
    }
  }

  private endRound(ko: boolean) {
    this.roundState = 'roundEnd';
    const { p1, p2 } = this;
    const winner = p1.hp > p2.hp ? p1 : p2.hp > p1.hp ? p2 : null;
    this.announce(ko ? 'K.O.!' : 'TIME!', '#ff3355');
    if (winner) winner.wins++;

    this.time.delayedCall(1500, () => {
      if (winner && winner.state !== 'ko') winner.setState('victory');
      if (!winner) this.announce('DRAW', '#ffffff');
      if (winner && winner.wins >= WINS_NEEDED) {
        this.announce(`${winner.def.name} WINS!`, '#ffd23f', true);
        this.roundState = 'matchEnd';
      } else {
        this.time.delayedCall(1800, () => {
          this.round++;
          this.startRound();
        });
      }
    });
  }

  // ============================================================
  //  SHADOW ULTIMATES
  // ============================================================

  private startUltimate(a: Fighter) {
    const v = a === this.p1 ? this.p2 : this.p1;
    a.meter = 0;
    this.roundState = 'cinematic';

    for (const f of [a, v]) {
      f.frozen = true;
      f.vx = f.vy = 0;
      f.attack = null;
    }
    a.facing = v.x >= a.x ? 1 : -1;
    v.facing = a.facing === 1 ? -1 : 1;
    const f = a.facing;

    a.setState('idle');
    a.poseOverride = { armF: -165, armB: -155, lean: -6, bob: 4 }; // power up!
    v.setState('hit');
    a.setDepth(72);
    v.setDepth(71);
    a.shadow.root.setDepth(60);
    this.flash(a, a.def.shadowGlow, 220);

    this.tweens.add({ targets: this.overlay, alpha: 0.7, duration: 300 });
    this.cameras.main.zoomTo(0.7, 450, 'Sine.easeInOut');
    this.cameras.main.pan(GAME_W / 2, GAME_H / 2 - 40, 450, 'Sine.easeInOut');
    this.banner = {
      id: this.banner.id + 1,
      title: 'SHADOW ULTIMATE',
      sub: `${a.def.shadowName} — ${a.def.ultimate.name}`,
      color: a.def.shadowGlow,
    };

    // The shadow grows into a giant
    a.sFollow = false;
    this.tweens.add({ targets: a, sx: a.x - f * 80, sScale: 2.6, sAlpha: 0.95, duration: 550, ease: 'Back.easeOut' });
    if (!v.onGround) this.tweens.add({ targets: v, y: GROUND_Y, duration: 250 });

    if (a.def.ultimate.kind === 'quake') this.ultQuake(a, v);
    else this.ultThrow(a, v);
  }

  /** Shadow punches the ground, a rock spike launches the enemy, then the shadow kicks them away. */
  private ultQuake(a: Fighter, v: Fighter) {
    const f = a.facing;
    this.at(650, () => {
      a.shadowPoseOverride = { armF: -175, armB: -150, lean: -12, bob: -6 };
    });
    this.at(1000, () => {
      a.shadowPoseOverride = { armF: -10, armB: -40, lean: 35, bob: 30, legF: -35, legB: 20 };
      this.shake(380, 0.02);
      this.dust(a.sx + f * 150, GROUND_Y);
      this.spike(v.x);
      v.poseOverride = { lean: -30, armF: -150, armB: -170, legF: 20, legB: -20 };
      this.tweens.add({ targets: v, y: GROUND_Y - 200, duration: 320, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: v, spin: -25, duration: 320 });
    });
    this.at(1420, () => {
      a.shadowPoseOverride = { legF: -125, legB: 15, lean: -22, armF: -40, armB: -90, bob: -10 };
      this.tweens.add({ targets: a, sx: v.x - f * 250, duration: 200, ease: 'Quad.easeOut' });
    });
    this.at(1620, () => this.impact(a, v, 380, 160));
    this.at(2600, () => this.finishUltimate(a, v));
  }

  /** Shadow grabs its own fighter and throws them like a cannonball. */
  private ultThrow(a: Fighter, v: Fighter) {
    const f = a.facing;
    this.at(650, () => {
      a.shadowPoseOverride = { armF: -150, armB: -140, lean: 5 };
      a.poseOverride = { armF: -170, armB: -170, legF: -70, legB: -50, lean: 15, bob: 10 };
      this.tweens.add({ targets: a, y: GROUND_Y - 330, x: a.x - f * 10, duration: 380, ease: 'Quad.easeOut' });
    });
    this.at(1080, () => {
      a.shadowPoseOverride = { armF: -215, armB: -60, lean: -25 };
      this.tweens.add({ targets: a, x: a.x - f * 120, y: GROUND_Y - 360, duration: 260, ease: 'Sine.easeInOut' });
    });
    this.at(1380, () => {
      a.shadowPoseOverride = { armF: -70, armB: -20, lean: 30, bob: 10 };
      this.tweens.add({ targets: a, x: v.x - f * 70, y: GROUND_Y - 30, duration: 260, ease: 'Quad.easeIn' });
      this.tweens.add({ targets: a, spin: 720, duration: 260 });
    });
    this.at(1650, () => {
      this.impact(a, v, 420, 200);
      a.spin = 0;
      a.poseOverride = { armF: -90, armB: -60, legF: -60, lean: 10 };
      this.arc(a, -f * 160, 140, 500);
    });
    this.at(2600, () => this.finishUltimate(a, v));
  }

  private impact(a: Fighter, v: Fighter, dx: number, height: number) {
    const hx = v.x, hy = v.y - 100;
    this.sparks(hx, hy, 0xffffff, 18, true);
    this.sparks(hx, hy, a.def.shadowGlow, 14, true);
    this.shake(320, 0.03);
    this.flash(v, 0xffffff, 120);
    v.hp = Math.max(0, v.hp - a.def.ultimate.damage);
    v.poseOverride = { lean: -35, armF: -170, armB: -160, legF: -30, legB: 10 };
    this.arc(v, a.facing * dx, height, 650);
    this.tweens.add({ targets: v, spin: -360, duration: 650 });
  }

  private finishUltimate(a: Fighter, v: Fighter) {
    this.tweens.add({ targets: this.overlay, alpha: 0, duration: 350 });
    this.cameras.main.zoomTo(1, 450, 'Sine.easeInOut');
    this.cameras.main.pan(GAME_W / 2, GAME_H / 2, 450, 'Sine.easeInOut');
    this.tweens.add({ targets: a, sScale: SHADOW_SCALE, sAlpha: SHADOW_ALPHA, duration: 400 });
    a.sFollow = true;
    for (const f of [a, v]) {
      f.poseOverride = null;
      f.spin = 0;
      f.y = GROUND_Y;
      f.onGround = true;
      f.frozen = false;
      f.setDepth(10);
    }
    a.shadowPoseOverride = null;
    a.shadow.root.setDepth(5);
    a.setState('idle');
    v.setState(v.hp <= 0 ? 'ko' : 'knockdown');
    this.roundState = 'fight'; // update() will notice a KO and end the round
  }

  // ============================================================
  //  EFFECTS
  // ============================================================

  private at(ms: number, fn: () => void) {
    this.time.delayedCall(ms, fn);
  }

  /** Fly a fighter in an arc and land on the floor. */
  private arc(fighter: Fighter, dx: number, h: number, dur: number) {
    const x0 = fighter.x, y0 = fighter.y;
    const x1 = Phaser.Math.Clamp(x0 + dx, STAGE_LEFT, STAGE_RIGHT);
    this.tweens.addCounter({
      from: 0, to: 1, duration: dur,
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        fighter.x = x0 + (x1 - x0) * p;
        fighter.y = y0 + (GROUND_Y - y0) * p - Math.sin(Math.PI * p) * h;
      },
      onComplete: () => {
        fighter.y = GROUND_Y;
        this.dust(fighter.x, GROUND_Y);
        this.shake(150, 0.008);
      },
    });
  }

  sparks(x: number, y: number, color: number, n: number, big = false) {
    this.record({ k: 'sparks', x: Math.round(x), y: Math.round(y), c: color, n, b: big });
    const ring = this.add.circle(x, y, big ? 20 : 10).setStrokeStyle(big ? 6 : 4, color).setDepth(80);
    this.tweens.add({ targets: ring, scale: big ? 6 : 3, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = (big ? 150 : 60) * (0.5 + Math.random());
      const s = this.add.rectangle(x, y, big ? 14 : 8, big ? 4 : 3, color).setDepth(80).setRotation(ang);
      this.tweens.add({
        targets: s, x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d, alpha: 0, scaleX: 0.2,
        duration: 220 + Math.random() * 150, onComplete: () => s.destroy(),
      });
    }
  }

  private dust(x: number, y: number) {
    this.record({ k: 'dust', x: Math.round(x), y: Math.round(y) });
    for (let i = 0; i < 10; i++) {
      const c = this.add.circle(x, y - 6, 10 + Math.random() * 12, 0xc8b8d8, 0.6).setDepth(66);
      const side = i % 2 === 0 ? 1 : -1;
      this.tweens.add({
        targets: c, x: x + side * (40 + Math.random() * 110), y: y - 10 - Math.random() * 40,
        scale: 2, alpha: 0, duration: 500, onComplete: () => c.destroy(),
      });
    }
  }

  private spike(x: number) {
    this.record({ k: 'spike', x: Math.round(x) });
    const g = this.add.graphics({ x, y: GROUND_Y }).setDepth(65);
    g.fillStyle(0x3d2a55, 1).fillTriangle(-80, 0, 80, 0, -5, -260);
    g.fillStyle(0x6b4f8f, 1).fillTriangle(-5, -260, 80, 0, 20, 0);
    g.lineStyle(4, 0x000000, 0.7).strokeTriangle(-80, 0, 80, 0, -5, -260);
    g.scaleY = 0;
    this.tweens.add({ targets: g, scaleY: 1, duration: 140, ease: 'Back.easeOut' });
    this.time.delayedCall(900, () =>
      this.tweens.add({ targets: g, scaleY: 0, alpha: 0, duration: 300, onComplete: () => g.destroy() }));
    for (let i = 0; i < 8; i++) {
      const r = this.add.rectangle(x, GROUND_Y - 10, 12, 12, 0x6b4f8f).setDepth(66);
      this.tweens.add({
        targets: r, x: x + (Math.random() - 0.5) * 300, y: GROUND_Y - 150 - Math.random() * 200,
        angle: 360, alpha: 0, duration: 600, onComplete: () => r.destroy(),
      });
    }
  }
}
