// The "shape" of a fighter. Every fighter in roster.ts must fill these in.

export type HeadStyle = 'cap' | 'mask' | 'hair' | 'bandana';

/** Colors and style for drawing a fighter (or a shadow spirit). Colors are hex: 0xRRGGBB */
export interface Look {
  skin: number;
  shirt: number;
  pants: number;
  shoes: number;
  head: HeadStyle;
  accent: number; // cap / hair / mask / bandana color
  belt?: number;
  letter?: string; // letter printed on the cap
  pads?: number; // shoulder pads color
  stripe?: number; // mask stripe color
  art?: string; // id of a hand-drawn rig in src/art/rigs.json (made by `npm run art`)
  sheetArt?: string; // id of a rig cut from a character sheet (used by the "SHEET" art style)
}

export interface Move {
  name: string;
  damage: number;
  startup: number; // ms before the hit comes out
  active: number; // ms the hit can connect
  recovery: number; // ms before you can move again
  reach: number; // how far in front of the body it hits
  height: number; // how high off the floor it hits
  knockback: number; // how hard it pushes the enemy
  hitstun: number; // ms the enemy is stunned
  launch?: number; // throws the enemy up into the air this hard
}

/**
 * Special moves: press SPECIAL alone, or with a direction.
 *  dash   - rush forward, hitting anyone in the way
 *  wave   - shoot an energy blast across the screen
 *  rising - jumping uppercut that launches the enemy
 *  bind   - the shadow throws chains that grab the enemy and pull them in
 */
export type SpecialKind = 'dash' | 'wave' | 'rising' | 'bind';
export type SpecialInput = 'neutral' | 'forward' | 'up' | 'down';

export interface Special extends Move {
  kind: SpecialKind;
  cooldown: number; // ms before you can use it again
}

export interface Ultimate {
  name: string;
  /**
   * Which shadow cinematic plays:
   *  quake - shadow smashes the ground, a rock spike launches the enemy, shadow kicks them
   *  throw - shadow grabs its fighter and throws them like a cannonball at the enemy
   */
  kind: 'quake' | 'throw';
  damage: number;
}

export interface FighterDef {
  id: string;
  name: string;
  shadowName: string;
  look: Look;
  shadowLook: Look;
  shadowGlow: number;
  speed: number;
  jump: number;
  punch: Move;
  kick: Move;
  specials: Record<SpecialInput, Special>;
  ultimate: Ultimate;
}
