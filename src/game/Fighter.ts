import Phaser from 'phaser';
import { Puppet, BASE_POSE, type Pose } from './Puppet';
import type { FighterDef, Move, Special, SpecialInput } from '../fighters/types';
import type { Input } from './input';
import {
  GROUND_Y, GRAVITY, STAGE_LEFT, STAGE_RIGHT, MAX_HP, SHADOW_SCALE, SHADOW_ALPHA,
} from '../config';

export type State =
  | 'idle' | 'walk' | 'jump' | 'block'
  | 'punch' | 'kick' | 'special'
  | 'hit' | 'knockdown' | 'ko' | 'victory';

export interface Rect { x: number; y: number; w: number; h: number }

/** Everything the guest needs to draw a fighter exactly like the host sees it. */
export interface FighterNet {
  x: number; y: number; f: 1 | -1; st: State; t: number; hp: number; m: number; w: number;
  sp: number; po: Partial<Pose> | null; spo: Partial<Pose> | null;
  sx: number; sy: number; ss: number; sa: number; atk: string | null; d: number; sd: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export class Fighter {
  readonly puppet: Puppet;
  readonly shadow: Puppet;

  x = 0;
  y = GROUND_Y;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  onGround = true;

  hp = MAX_HP;
  meter = 0; // shadow meter, 100 = ultimate ready
  wins = 0;

  state: State = 'idle';
  t = 0; // ms spent in current state
  hitstun = 0;
  attack: Move | null = null;
  attackHit = false;

  // Special moves
  special: Special | null = null; // the special being done right now
  specialInput: SpecialInput | null = null;
  cooldowns: Record<SpecialInput, number> = { neutral: 0, forward: 0, up: 0, down: 0 };
  /** Set when a special starts; the fight scene shows its name and clears it */
  justUsed: Special | null = null;
  /** Set when an energy wave should fly out; the fight scene spawns it and clears it */
  fireWave = false;
  /** Set by the fight scene: this fighter's energy wave is still on screen */
  waveAlive = false;
  private specialFired = false;

  // Used by the ultimate cinematics
  wantsUltimate = false;
  frozen = false;
  spin = 0;
  poseOverride: Partial<Pose> | null = null;
  shadowPoseOverride: Partial<Pose> | null = null;
  sx = 0;
  sy = GROUND_Y;
  sScale = SHADOW_SCALE;
  sAlpha = SHADOW_ALPHA;
  sFollow = true;

  constructor(scene: Phaser.Scene, readonly def: FighterDef, x: number, facing: 1 | -1) {
    this.shadow = new Puppet(scene, def.shadowLook, x, GROUND_Y, def.shadowGlow, 0.9);
    this.shadow.addGlow(def.shadowGlow);
    this.shadow.root.setDepth(5);
    this.puppet = new Puppet(scene, def.look, x, GROUND_Y);
    this.puppet.root.setDepth(10);
    this.reset(x, facing);
  }

  reset(x: number, facing: 1 | -1) {
    this.x = x;
    this.y = GROUND_Y;
    this.vx = this.vy = 0;
    this.facing = facing;
    this.onGround = true;
    this.hp = MAX_HP;
    this.attack = null;
    this.special = this.specialInput = this.justUsed = null;
    this.cooldowns = { neutral: 0, forward: 0, up: 0, down: 0 };
    this.fireWave = this.waveAlive = false;
    this.spin = 0;
    this.poseOverride = this.shadowPoseOverride = null;
    this.frozen = false;
    this.wantsUltimate = false;
    this.sx = x - facing * 48;
    this.sy = GROUND_Y;
    this.sScale = SHADOW_SCALE;
    this.sAlpha = SHADOW_ALPHA;
    this.sFollow = true;
    this.setState('idle');
  }

  setState(s: State) {
    this.state = s;
    this.t = 0;
  }

  /** Change state but keep the timer if we're already in it (for looping anims) */
  private keepState(s: State) {
    if (this.state !== s) this.setState(s);
  }

  addMeter(n: number) {
    this.meter = Math.min(100, this.meter + n);
  }

  update(dt: number, input: Input, opp: Fighter) {
    this.t += dt * 1000;
    if (this.frozen) return;
    for (const k of Object.keys(this.cooldowns) as SpecialInput[]) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt * 1000);

    const s = this.state;
    if (this.onGround && (s === 'idle' || s === 'walk' || s === 'block')) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }

    // Timed states
    if (s === 'punch' || s === 'kick') {
      const m = this.attack!;
      if (this.t >= m.startup + m.active + m.recovery) {
        this.attack = null;
        this.setState(this.onGround ? 'idle' : 'jump');
      }
    } else if (s === 'special') {
      this.updateSpecial();
    } else if (s === 'hit') {
      if (this.t >= this.hitstun && this.onGround) this.setState('idle');
    } else if (s === 'knockdown') {
      if (this.t >= 650) this.setState('idle');
    }

    // Player control
    const free = this.state === 'idle' || this.state === 'walk' || this.state === 'block' || this.state === 'jump';
    if (free) {
      if (input.ult && this.meter >= 100 && this.onGround) {
        this.wantsUltimate = true;
      } else if (input.special && this.tryStartSpecial(input)) {
        // started a special move
      } else if (input.punch) {
        this.startAttack(this.def.punch, 'punch');
      } else if (input.kick) {
        this.startAttack(this.def.kick, 'kick');
      } else if (this.onGround) {
        const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (input.down) {
          this.vx = 0;
          this.keepState('block');
        } else if (input.up) {
          this.vy = -this.def.jump;
          this.vx = dir * this.def.speed * 0.9;
          this.onGround = false;
          this.setState('jump');
        } else if (dir !== 0) {
          const backwards = dir !== this.facing;
          this.vx = dir * this.def.speed * (backwards ? 0.75 : 1);
          this.keepState('walk');
        } else {
          this.vx = 0;
          this.keepState('idle');
        }
      }
    }

    // Slide to a stop when not walking
    const controlled = this.state === 'walk' || this.state === 'idle' || this.state === 'block';
    if (this.onGround && !controlled) this.vx *= Math.exp(-7 * dt);

    // Physics
    if (!this.onGround) this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      this.vy = 0;
      if (!this.onGround) {
        this.onGround = true;
        if (this.state === 'jump') this.setState('idle');
        if (this.state === 'punch' || this.state === 'kick') {
          this.attack = null;
          this.setState('idle');
        }
        if (this.state === 'special' && this.special && this.t >= this.special.startup + this.special.active) {
          this.endSpecial();
        }
      }
    }
    this.x = Phaser.Math.Clamp(this.x, STAGE_LEFT, STAGE_RIGHT);
  }

  /** SPECIAL alone = neutral, or with forward / up / down */
  private tryStartSpecial(input: Input): boolean {
    const forward = this.facing === 1 ? input.right : input.left;
    const dir: SpecialInput = input.up ? 'up' : input.down ? 'down' : forward ? 'forward' : 'neutral';
    const sp = this.def.specials?.[dir];
    if (!sp || this.cooldowns[dir] > 0) return false;
    if (sp.kind === 'wave' && this.waveAlive) return false; // one energy wave at a time
    this.special = sp;
    this.specialInput = dir;
    this.attack = sp;
    this.attackHit = false;
    this.specialFired = false;
    this.cooldowns[dir] = sp.cooldown;
    this.justUsed = sp;
    this.setState('special');
    if (this.onGround) this.vx = 0;
    return true;
  }

  private updateSpecial() {
    const sp = this.special!;
    const t = this.t;
    const activeNow = t >= sp.startup && t < sp.startup + sp.active;
    if (sp.kind === 'dash') {
      if (activeNow) {
        this.vx = this.facing * 1050;
        if (!this.onGround) this.vy = 0; // dash straight through the air
      }
    } else if (sp.kind === 'rising') {
      if (t >= sp.startup && !this.specialFired) {
        this.specialFired = true;
        this.vy = -950;
        this.vx = this.facing * 120;
        this.onGround = false;
      }
    } else if (sp.kind === 'wave') {
      if (t >= sp.startup && !this.specialFired) {
        this.specialFired = true;
        this.fireWave = true;
      }
    }
    if (t >= sp.startup + sp.active + sp.recovery && (this.onGround || sp.kind !== 'rising')) this.endSpecial();
  }

  private endSpecial() {
    this.special = this.specialInput = null;
    this.attack = null;
    this.setState(this.onGround ? 'idle' : 'jump');
  }

  private startAttack(m: Move, s: 'punch' | 'kick') {
    this.attack = m;
    this.attackHit = false;
    this.setState(s);
    if (this.onGround) this.vx = this.facing * 70; // tiny lunge
  }

  /** The area that hurts the enemy right now (or null). */
  hitbox(): Rect | null {
    const m = this.attack;
    if (!m || this.attackHit || (this.state !== 'punch' && this.state !== 'kick' && this.state !== 'special')) return null;
    if (this.t < m.startup || this.t >= m.startup + m.active) return null;
    const sp = this.state === 'special' ? this.special : null;
    if (sp) {
      const f = this.facing;
      switch (sp.kind) {
        case 'wave': return null; // the energy wave itself does the hitting
        case 'dash': return { x: this.x + f * sp.reach - 45, y: this.y - 150, w: 90, h: 120 };
        case 'rising': return { x: this.x + f * sp.reach - 35, y: this.y - sp.height - 60, w: 70, h: 160 };
        case 'bind': {
          // the chains shoot out over the active time
          const len = sp.reach * Math.min(1, ((this.t - sp.startup) / sp.active) * 1.6);
          return { x: f > 0 ? this.x + 20 : this.x - 20 - len, y: this.y - sp.height - 50, w: len, h: 100 };
        }
      }
    }
    return { x: this.x + this.facing * m.reach - 30, y: this.y - m.height - 20, w: 60, h: 40 };
  }

  /** The area where this fighter can be hit. */
  hurtbox(): Rect | null {
    if (this.state === 'ko' || this.state === 'knockdown') return null;
    return { x: this.x - 28, y: this.y - 185, w: 56, h: 185 };
  }

  /** dir = which way the hit pushes (defaults to the attacker's facing; energy waves pass their own) */
  takeHit(m: Move, attacker: Fighter, dir: 1 | -1 = attacker.facing): 'hit' | 'block' | 'ko' {
    const blocking = this.state === 'block' && this.facing === -dir;
    if (blocking) {
      this.hp = Math.max(1, this.hp - m.damage * 0.15);
      this.vx = dir * 220;
      this.addMeter(m.damage * 0.5);
      return 'block';
    }
    this.hp -= m.damage;
    this.addMeter(m.damage * 0.7);
    this.attack = null;
    this.special = this.specialInput = null;
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('ko');
      this.vy = -650;
      this.vx = dir * 380;
      this.onGround = false;
      return 'ko';
    }
    this.setState('hit');
    this.hitstun = m.hitstun;
    this.vx = dir * m.knockback;
    if (m.launch) {
      this.vy = -m.launch;
      this.onGround = false;
    } else if (!this.onGround) this.vy = -350;
    return 'hit';
  }

  computePose(time: number): Pose {
    const p: Pose = { ...BASE_POSE };
    const m = this.attack;
    switch (this.state) {
      case 'idle': {
        const b = Math.sin(time * 0.006);
        p.bob = b * 3;
        p.armF = -55 + b * 4;
        p.armB = -40;
        p.legF = -12;
        p.legB = 12;
        break;
      }
      case 'walk': {
        const ph = time * 0.016;
        p.legF = Math.sin(ph) * 28;
        p.legB = -Math.sin(ph) * 28;
        p.bob = -Math.abs(Math.cos(ph)) * 4;
        p.armF = -55;
        p.armB = -40;
        break;
      }
      case 'jump':
        Object.assign(p, { legF: -55, legB: -10, armF: -80, armB: -60 });
        break;
      case 'punch':
        if (m && this.t < m.startup) Object.assign(p, { armF: -30, armB: -45, lean: -4 });
        else if (m && this.t < m.startup + m.active) Object.assign(p, { armF: -92, armB: -20, lean: 10 });
        else Object.assign(p, { armF: -70, armB: -35, lean: 4 });
        break;
      case 'kick':
        if (m && this.t < m.startup) Object.assign(p, { legF: -40, lean: -6 });
        else if (m && this.t < m.startup + m.active) Object.assign(p, { legF: -100, legB: 8, lean: -18, armF: -20, armB: -60 });
        else Object.assign(p, { legF: -50, lean: -8 });
        break;
      case 'special':
        if (this.special) Object.assign(p, this.specialPose(this.special, time));
        break;
      case 'block':
        Object.assign(p, { armF: -150, armB: -140, lean: -6, legF: -18, legB: 16, bob: 6 });
        break;
      case 'hit':
        Object.assign(p, { lean: -22, armF: 30, armB: 40, legF: 10, legB: -5 });
        break;
      case 'knockdown':
      case 'ko':
        Object.assign(p, { tilt: -86, armF: -160, armB: -170, legF: -10, legB: 10 });
        break;
      case 'victory':
        Object.assign(p, { armF: -175, armB: 15, bob: Math.sin(time * 0.008) * 4 });
        break;
    }
    if (this.poseOverride) Object.assign(p, this.poseOverride);
    return p;
  }

  private specialPose(sp: Special, time: number): Partial<Pose> {
    const phase = this.t < sp.startup ? 0 : this.t < sp.startup + sp.active ? 1 : 2;
    switch (sp.kind) {
      case 'dash':
        return [
          { lean: 18, armF: 30, armB: 40, legF: -30, legB: 30, bob: 8 },
          { lean: 28, armF: -95, armB: 45, legF: -60, legB: 45, bob: 10 + Math.sin(time * 0.05) * 2 },
          { lean: 10, armF: -70, armB: 10, legF: -25, legB: 20, bob: 4 },
        ][phase];
      case 'wave':
        return [
          { lean: -10, armF: 35, armB: 25, legF: -25, legB: 20, bob: 6 },
          { lean: 10, armF: -92, armB: -86, legF: -30, legB: 25, bob: 6 },
          { lean: 6, armF: -85, armB: -78, legF: -25, legB: 22, bob: 5 },
        ][phase];
      case 'rising':
        return [
          { lean: 8, armF: 10, armB: -20, legF: -40, legB: 30, bob: 16 },
          { lean: -10, armF: -178, armB: -30, legF: -60, legB: 15, bob: -8 },
          { lean: -4, armF: -150, armB: -40, legF: -40, legB: 10 },
        ][phase];
      case 'bind':
        return [
          { lean: -8, armF: -40, armB: -70, legF: -20, legB: 20, bob: 4 },
          { lean: 8, armF: -95, armB: -60, legF: -30, legB: 25, bob: 6 },
          { lean: -10, armF: -60, armB: -30, legF: -20, legB: 20, bob: 4 },
        ][phase];
    }
  }

  /** Move the drawings to match the game state. Called every frame. */
  sync(time: number, dt: number) {
    const pose = this.computePose(time);
    this.puppet.root.setPosition(this.x, this.y);
    this.puppet.root.setScale(this.facing, 1);
    this.puppet.setFacing(this.facing);
    this.puppet.applyPose(pose, 1 - Math.pow(0.4, dt * 60), this.spin);

    // The shadow drifts behind its fighter, copying the pose with a little lag
    if (this.sFollow) {
      const k = 1 - Math.pow(0.86, dt * 60);
      this.sx += (this.x - this.facing * 48 - this.sx) * k;
      this.sy += (this.y - this.sy) * k;
      const targetAlpha = this.state === 'ko' ? 0.1 : this.state === 'victory' ? 0.65 : SHADOW_ALPHA;
      this.sAlpha += (targetAlpha - this.sAlpha) * k;
    }
    this.shadow.root.setPosition(this.sx, this.sy);
    this.shadow.root.setScale(this.facing * this.sScale, this.sScale);
    this.shadow.root.setAlpha(this.sAlpha);

    const lying = this.state === 'ko' || this.state === 'knockdown';
    const shadowPose = this.shadowPoseOverride
      ? { ...BASE_POSE, ...this.shadowPoseOverride }
      : { ...pose, tilt: lying ? 0 : pose.tilt };
    this.shadow.applyPose(shadowPose, 1 - Math.pow(this.shadowPoseOverride ? 0.6 : 0.82, dt * 60));
  }

  setDepth(d: number) {
    this.puppet.root.setDepth(d);
  }

  toNet(): FighterNet {
    return {
      x: r1(this.x), y: r1(this.y), f: this.facing, st: this.state, t: Math.round(this.t),
      hp: r1(this.hp), m: r1(this.meter), w: this.wins, sp: r1(this.spin),
      po: this.poseOverride, spo: this.shadowPoseOverride,
      sx: r1(this.sx), sy: r1(this.sy), ss: Math.round(this.sScale * 100) / 100, sa: Math.round(this.sAlpha * 100) / 100,
      atk: this.specialInput ? `s:${this.specialInput}` : this.attack === this.def.punch ? 'punch' : this.attack === this.def.kick ? 'kick' : null,
      d: this.puppet.root.depth, sd: this.shadow.root.depth,
    };
  }

  fromNet(n: FighterNet) {
    this.x = n.x; this.y = n.y; this.facing = n.f; this.state = n.st; this.t = n.t;
    this.hp = n.hp; this.meter = n.m; this.wins = n.w; this.spin = n.sp;
    this.poseOverride = n.po; this.shadowPoseOverride = n.spo;
    this.sx = n.sx; this.sy = n.sy; this.sScale = n.ss; this.sAlpha = n.sa;
    this.sFollow = false; // the host already moved the shadow
    this.specialInput = n.atk?.startsWith('s:') ? (n.atk.slice(2) as SpecialInput) : null;
    this.special = this.specialInput ? this.def.specials[this.specialInput] : null;
    this.attack = this.special ?? (n.atk === 'punch' ? this.def.punch : n.atk === 'kick' ? this.def.kick : null);
    this.puppet.root.setDepth(n.d);
    this.shadow.root.setDepth(n.sd);
  }
}
