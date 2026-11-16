import Phaser from 'phaser';
import { Fighter, type FighterNet } from '../game/Fighter';
import { ROSTER } from '../fighters/roster';
import type { Special, SpecialInput } from '../fighters/types';
import { drawStage } from '../game/stage';
import {
  makeKeys, readKeys, mergeInputs, NO_INPUT, NetInputDecoder, NetInputEncoder, type KeySet, type Input,
} from '../game/input';
import { net, type NetMessage } from '../net/NetSession';
import { isTouchDevice, type TouchScene } from './TouchScene';
import { CpuBrain } from '../game/cpu';
import {
  GAME_W, GAME_H, GROUND_Y, STAGE_LEFT, STAGE_RIGHT, P1_KEYS, P2_KEYS, FONT,
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
  | { k: 'flash'; p: 1 | 2; c: number; ms: number }
  | { k: 'label'; p: 1 | 2; d: SpecialInput }
  | { k: 'rocks'; x: number; c: number }
  | { k: 'bind'; p: 1 | 2; ms: number }
  | { k: 'burst'; x: number; y: number; c: number };

/** An energy wave flying across the screen */
interface Wave {
  id: number; owner: Fighter; x: number; y: number; dir: 1 | -1; move: Special;
  gfx: Phaser.GameObjects.Container;
}

/** Shadow chains holding someone */
interface Chain { a: Fighter; v: Fighter; until: number }

interface Snapshot {
  t: 's'; rs: RoundState; tl: number; ann: Announcement; ban: Banner;
  cam: [number, number, number]; ov: number; f: [FighterNet, FighterNet]; fx: Fx[];
  wv: [number, number, number, 1 | -1, 1 | 2][]; // energy waves: id, x, y, dir, owner
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
  // special moves
  private waves: Wave[] = [];
  private waveId = 0;
  private chains: Chain[] = [];
  private chainGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Fight');
  }

  init(data: { mode?: Mode }) {
    this.mode = data.mode ?? 'pvp';
    this.fxQueue = [];
    this.snapshot = null;
    this.leaving = false;
    this.waves = [];
    this.chains = [];
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
    this.chainGfx = this.add.graphics().setDepth(9);

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
      // keep the effects of a snapshot we haven't drawn yet (two can arrive in one frame)
      const snap = m as unknown as Snapshot;
      if (this.snapshot) snap.fx = [...this.snapshot.fx, ...snap.fx];
      this.snapshot = snap;
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
    this.clearSpecials();
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

    for (const f of [this.p1, this.p2]) this.specialEvents(f);
    this.updateWaves(dt);

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
    this.specialVisuals(time);

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
      wv: this.waves.map((w) => [w.id, Math.round(w.x), Math.round(w.y), w.dir, w.owner === this.p1 ? 1 : 2]),
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
      this.syncWaves(snap.wv);
    }
    this.p1.sync(time, dt);
    this.p2.sync(time, dt);
    this.specialVisuals(time);
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
      case 'label': { const f = fx.p === 1 ? this.p1 : this.p2; this.specialLabel(f, f.def.specials[fx.d]); break; }
      case 'rocks': this.rocks(fx.x, fx.c); break;
      case 'bind': { const a = fx.p === 1 ? this.p1 : this.p2; this.bind(a, a === this.p1 ? this.p2 : this.p1, fx.ms); break; }
      case 'burst': this.burst(fx.x, fx.y, fx.c); break;
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
      const special = a.special;
      this.sparks(px, py, special ? a.def.shadowGlow : 0xffdd44, res === 'ko' ? 18 : special ? 14 : 10, res === 'ko' || !!special);
      if (special?.kind === 'bind' && res === 'hit') this.bind(a, b, special.hitstun);
      this.hitstop = res === 'ko' ? 260 : special ? 90 : 70;
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

    this.clearSpecials();
    for (const f of [a, v]) {
      f.frozen = true;
      f.vx = f.vy = 0;
      f.attack = null;
      f.special = f.specialInput = null;
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
  //  SPECIAL MOVES
  // ============================================================

  private pIndex(f: Fighter): 1 | 2 {
    return f === this.p1 ? 1 : 2;
  }

  /** React to what a fighter just did (host / offline only). */
  private specialEvents(f: Fighter) {
    const sp = f.justUsed;
    if (sp) {
      f.justUsed = null;
      this.record({ k: 'label', p: this.pIndex(f), d: f.specialInput ?? 'neutral' });
      this.specialLabel(f, sp);
      if (sp.kind === 'rising') this.rocks(f.x, f.def.shadowGlow);
    }
    if (f.fireWave) {
      f.fireWave = false;
      const move = f.special ?? f.def.specials.neutral;
      this.spawnWave(++this.waveId, f, f.x + f.facing * move.reach, f.y - move.height, f.facing, move);
    }
  }

  private spawnWave(id: number, owner: Fighter, x: number, y: number, dir: 1 | -1, move: Special) {
    const c = owner.def.shadowGlow;
    const glow = this.add.ellipse(0, 0, 120, 70, c, 0.35);
    const mid = this.add.ellipse(6 * dir, 0, 80, 46, c, 0.8);
    const core = this.add.ellipse(14 * dir, 0, 44, 26, 0xffffff, 1);
    const gfx = this.add.container(x, y, [glow, mid, core]).setDepth(30);
    gfx.setScale(0.3);
    this.tweens.add({ targets: gfx, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: glow, scaleX: 1.25, scaleY: 0.8, yoyo: true, repeat: -1, duration: 90 });
    this.waves.push({ id, owner, x, y, dir, move, gfx });
    owner.waveAlive = true;
  }

  private removeWave(w: Wave, burst: boolean) {
    if (burst) this.burst(w.x, w.y, w.owner.def.shadowGlow);
    w.gfx.destroy();
    this.waves = this.waves.filter((o) => o !== w);
    w.owner.waveAlive = this.waves.some((o) => o.owner === w.owner);
  }

  private updateWaves(dt: number) {
    for (const w of [...this.waves]) {
      w.x += w.dir * 720 * dt;
      w.gfx.setPosition(w.x, w.y);
      this.waveTrail(w);
      if (w.x < STAGE_LEFT - 120 || w.x > STAGE_RIGHT + 120) {
        this.removeWave(w, false);
        continue;
      }
      // two waves cancel each other out
      const other = this.waves.find((o) => o !== w && o.owner !== w.owner && Math.abs(o.x - w.x) < 60 && Math.abs(o.y - w.y) < 60);
      if (other) {
        this.removeWave(other, true);
        this.removeWave(w, true);
        continue;
      }
      const v = w.owner === this.p1 ? this.p2 : this.p1;
      const hu = v.hurtbox();
      if (this.roundState === 'fight' && hu && w.x + 35 > hu.x && w.x - 35 < hu.x + hu.w && w.y + 30 > hu.y && w.y - 30 < hu.y + hu.h) {
        const res = v.takeHit(w.move, w.owner, w.dir);
        this.removeWave(w, true);
        if (res !== 'block') {
          w.owner.addMeter(w.move.damage * 1.2);
          this.flash(v);
          this.shake(res === 'ko' ? 400 : 140, res === 'ko' ? 0.015 : 0.006);
          this.hitstop = res === 'ko' ? 260 : 80;
        } else this.hitstop = 40;
      }
    }
  }

  /** Guest: make the energy waves match the host's. */
  private syncWaves(list: Snapshot['wv']) {
    const ids = new Set(list.map((w) => w[0]));
    for (const w of [...this.waves]) if (!ids.has(w.id)) this.removeWave(w, false);
    for (const [id, x, y, dir, p] of list) {
      const w = this.waves.find((o) => o.id === id);
      if (w) {
        w.x = x;
        w.y = y;
        w.gfx.setPosition(x, y);
        this.waveTrail(w);
      } else {
        const owner = p === 1 ? this.p1 : this.p2;
        this.spawnWave(id, owner, x, y, dir, owner.def.specials.neutral);
      }
    }
  }

  private waveTrail(w: Wave) {
    if (Math.random() < 0.5) return;
    const d = this.add.circle(w.x - w.dir * 40, w.y + (Math.random() - 0.5) * 40, 6 + Math.random() * 8, w.owner.def.shadowGlow, 0.7).setDepth(29);
    this.tweens.add({ targets: d, x: d.x - w.dir * 60, alpha: 0, scale: 0.2, duration: 260, onComplete: () => d.destroy() });
  }

  private bind(a: Fighter, v: Fighter, ms: number) {
    this.record({ k: 'bind', p: this.pIndex(a), ms });
    this.chains = this.chains.filter((c) => c.v !== v);
    this.chains.push({ a, v, until: this.time.now + ms });
  }

  private clearSpecials() {
    for (const w of [...this.waves]) this.removeWave(w, false);
    this.chains = [];
    this.chainGfx?.clear();
  }

  /** Effects that come straight from what the fighters are doing (works the same online). */
  private specialVisuals(time: number) {
    const g = this.chainGfx;
    g.clear();
    this.chains = this.chains.filter((c) => time < c.until && c.v.state === 'hit');
    for (const f of [this.p1, this.p2]) {
      const sp = f.state === 'special' ? f.special : null;
      if (!sp) continue;
      const active = f.t >= sp.startup && f.t < sp.startup + sp.active;
      if (sp.kind === 'dash' && active) this.speedLines(f);
      if (sp.kind === 'rising' && active) this.risingSparks(f);
      if (sp.kind === 'bind' && f.t >= sp.startup && !this.chains.some((c) => c.a === f)) {
        // chains reaching out
        const len = sp.reach * Math.min(1, ((f.t - sp.startup) / sp.active) * 1.6);
        const [hx, hy] = this.shadowHand(f);
        this.drawChain(hx, hy, f.x + f.facing * (20 + len), f.y - sp.height, f.def.shadowGlow, time);
      }
    }
    for (const c of this.chains) {
      const [hx, hy] = this.shadowHand(c.a);
      this.drawChain(hx, hy, c.v.x, c.v.y - 110, c.a.def.shadowGlow, time);
      this.drawChain(hx, hy - 30, c.v.x, c.v.y - 70, c.a.def.shadowGlow, time + 400);
    }
  }

  private shadowHand(f: Fighter): [number, number] {
    return [f.sx + f.facing * 70 * f.sScale, f.sy - 130 * f.sScale];
  }

  private drawChain(x0: number, y0: number, x1: number, y1: number, color: number, time: number) {
    const g = this.chainGfx;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 4) return;
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    const pt = (p: number): [number, number] => {
      const wave = Math.sin(p * 9 + time * 0.012) * 10 * Math.sin(Math.PI * p);
      return [x0 + (x1 - x0) * p + nx * wave, y0 + (y1 - y0) * p + ny * wave];
    };
    g.lineStyle(12, color, 0.25).beginPath();
    for (let i = 0; i <= 24; i++) {
      const [x, y] = pt(i / 24);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
    const links = Math.floor(len / 13);
    for (let i = 0; i <= links; i++) {
      const [x, y] = pt(i / Math.max(1, links));
      g.lineStyle(3, 0x000000, 0.6).strokeCircle(x, y, i % 2 ? 4 : 6);
      g.lineStyle(2, i % 2 ? 0xffffff : color, 1).strokeCircle(x, y, i % 2 ? 4 : 6);
    }
  }

  private speedLines(f: Fighter) {
    const c = f.def.shadowGlow;
    for (let i = 0; i < 2; i++) {
      const y = f.y - 30 - Math.random() * 150;
      const l = this.add.rectangle(f.x - f.facing * (30 + Math.random() * 30), y, 50 + Math.random() * 60, 4, i ? 0xffffff : c, 0.8).setDepth(8);
      this.tweens.add({ targets: l, x: l.x - f.facing * 80, alpha: 0, scaleX: 0.3, duration: 220, onComplete: () => l.destroy() });
    }
  }

  private risingSparks(f: Fighter) {
    const x = f.x + f.facing * 25, y = f.y - 210;
    const s = this.add.circle(x + (Math.random() - 0.5) * 30, y + Math.random() * 60, 4 + Math.random() * 5, f.def.shadowGlow, 0.9).setDepth(31);
    this.tweens.add({ targets: s, y: s.y + 60, alpha: 0, duration: 300, onComplete: () => s.destroy() });
  }

  /** Big name of the special above the fighter, so everyone learns the moves */
  private specialLabel(f: Fighter, sp: Special) {
    const color = Phaser.Display.Color.IntegerToColor(f.def.shadowGlow).rgba;
    const t = this.add.text(f.x, f.y - 250, sp.name.toUpperCase() + '!', {
      fontFamily: FONT, fontSize: '34px', color, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(85).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, delay: 500, duration: 350, onComplete: () => t.destroy() });
  }

  private rocks(x: number, color: number) {
    this.record({ k: 'rocks', x: Math.round(x), c: color });
    this.dust(x, GROUND_Y);
    for (let i = 0; i < 9; i++) {
      const r = this.add.rectangle(x + (Math.random() - 0.5) * 60, GROUND_Y - 8, 8 + Math.random() * 10, 8 + Math.random() * 10, i % 3 ? 0x4a4550 : color).setDepth(66);
      this.tweens.add({
        targets: r, x: r.x + (Math.random() - 0.5) * 220, y: GROUND_Y - 80 - Math.random() * 160,
        angle: 360, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => r.destroy(),
      });
    }
  }

  private burst(x: number, y: number, color: number) {
    this.record({ k: 'burst', x: Math.round(x), y: Math.round(y), c: color });
    const ring = this.add.circle(x, y, 18).setStrokeStyle(6, color).setDepth(80);
    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const d = this.add.circle(x, y, 6, i % 2 ? 0xffffff : color).setDepth(80);
      this.tweens.add({ targets: d, x: x + Math.cos(a) * 70, y: y + Math.sin(a) * 70, alpha: 0, duration: 280, onComplete: () => d.destroy() });
    }
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
