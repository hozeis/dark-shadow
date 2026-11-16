import Phaser from 'phaser';
import { Puppet, BASE_POSE, type Pose } from './Puppet';
import type { FighterDef, Move } from '../fighters/types';
import type { Input } from './input';
import {
  GROUND_Y, GRAVITY, STAGE_LEFT, STAGE_RIGHT, MAX_HP, SHADOW_SCALE, SHADOW_ALPHA,
} from '../config';

export type State =
  | 'idle' | 'walk' | 'jump' | 'block'
  | 'punch' | 'kick'
  | 'hit' | 'knockdown' | 'ko' | 'victory';

export interface Rect { x: number; y: number; w: number; h: number }

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
      }
    }
    this.x = Phaser.Math.Clamp(this.x, STAGE_LEFT, STAGE_RIGHT);
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
    if (!m || this.attackHit || (this.state !== 'punch' && this.state !== 'kick')) return null;
    if (this.t < m.startup || this.t >= m.startup + m.active) return null;
    return { x: this.x + this.facing * m.reach - 30, y: this.y - m.height - 20, w: 60, h: 40 };
  }

  /** The area where this fighter can be hit. */
  hurtbox(): Rect | null {
    if (this.state === 'ko' || this.state === 'knockdown') return null;
    return { x: this.x - 28, y: this.y - 185, w: 56, h: 185 };
  }

  takeHit(m: Move, attacker: Fighter): 'hit' | 'block' | 'ko' {
    const blocking = this.state === 'block' && this.facing === -attacker.facing;
    if (blocking) {
      this.hp = Math.max(1, this.hp - m.damage * 0.15);
      this.vx = attacker.facing * 220;
      this.addMeter(m.damage * 0.5);
      return 'block';
    }
    this.hp -= m.damage;
    this.addMeter(m.damage * 0.7);
    this.attack = null;
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('ko');
      this.vy = -650;
      this.vx = attacker.facing * 380;
      this.onGround = false;
      return 'ko';
    }
    this.setState('hit');
    this.hitstun = m.hitstun;
    this.vx = attacker.facing * m.knockback;
    if (!this.onGround) this.vy = -350;
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
}
