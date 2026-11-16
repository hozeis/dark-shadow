import type { FighterDef, Move, Special, SpecialInput } from './types';

// ============================================================
//  THE FIGHTERS
//  Copy one block to make a new fighter, then change it!
//  Names below (except R) are placeholders — rename them.
// ============================================================

const PUNCH: Move = {
  name: 'Punch', damage: 6, startup: 60, active: 90, recovery: 150,
  reach: 62, height: 140, knockback: 240, hitstun: 260,
};

const KICK: Move = {
  name: 'Kick', damage: 9, startup: 110, active: 100, recovery: 230,
  reach: 80, height: 80, knockback: 380, hitstun: 320,
};

// The four special moves. Each fighter gets them with their own names (and can tweak the numbers).
//   SPECIAL alone       -> wave     (energy blast)
//   forward + SPECIAL   -> dash     (rush forward)
//   up + SPECIAL        -> rising   (launching uppercut)
//   down + SPECIAL      -> bind     (shadow chains pull the enemy in)
function specials(
  names: Record<SpecialInput, string>,
  tweak: Partial<Record<SpecialInput, Partial<Special>>> = {},
): Record<SpecialInput, Special> {
  const base: Record<SpecialInput, Special> = {
    neutral: {
      name: names.neutral, kind: 'wave', cooldown: 1400, damage: 9, startup: 220, active: 60, recovery: 260,
      reach: 60, height: 115, knockback: 620, hitstun: 400,
    },
    forward: {
      name: names.forward, kind: 'dash', cooldown: 900, damage: 10, startup: 90, active: 260, recovery: 220,
      reach: 40, height: 120, knockback: 420, hitstun: 380,
    },
    up: {
      name: names.up, kind: 'rising', cooldown: 900, damage: 12, startup: 100, active: 260, recovery: 300,
      reach: 45, height: 170, knockback: 120, hitstun: 650, launch: 1050,
    },
    down: {
      name: names.down, kind: 'bind', cooldown: 3000, damage: 7, startup: 280, active: 220, recovery: 380,
      reach: 420, height: 120, knockback: -380, hitstun: 1100, // negative knockback = pulls the enemy in
    },
  };
  for (const k of Object.keys(tweak) as SpecialInput[]) base[k] = { ...base[k], ...tweak[k] };
  return base;
}

export const ROSTER: FighterDef[] = [
  {
    // Rondo: from the drawing (R with his cap and the masked giant), the character sheet and the sprite sheets
    id: 'r',
    name: 'Rondo',
    shadowName: 'Shadow Spirit',
    look: {
      skin: 0xc68863, shirt: 0x55555c, pants: 0x3e3e44, shoes: 0x1d1d22,
      head: 'cap', accent: 0x1f1f24, letter: 'R', belt: 0x1a1a1e,
      art: 'r', // his drawing!
      sheetArt: 'r-sheet', // the character sheet
      sprite: 'rondo', // the sprite sheets (animated)
    },
    shadowLook: {
      skin: 0x4c4a52, shirt: 0x4c4a52, pants: 0xf2c230, shoes: 0x6d6d76,
      head: 'mask', accent: 0x8c8c96, stripe: 0xf2c230, pads: 0xf2c230, belt: 0xf2c230,
      art: 'r-shadow',
      sheetArt: 'r-sheet-shadow',
    },
    shadowGlow: 0xffc928,
    speed: 300,
    jump: 1000,
    punch: { ...PUNCH },
    kick: { ...KICK },
    specials: specials({ neutral: 'Energy Wave', forward: 'Shadow Dash', up: 'Rising Breaker', down: 'Spirit Bind' }),
    ultimate: { name: 'Shadow Overdrive', kind: 'quake', damage: 30 },
  },
  {
    id: 'blaze',
    name: 'Blaze',
    shadowName: 'Fire Fox',
    look: {
      skin: 0xe0ac84, shirt: 0xc0392b, pants: 0x2c2c34, shoes: 0x111111,
      head: 'bandana', accent: 0xf39c12, belt: 0x111111,
    },
    shadowLook: {
      skin: 0xff9a3c, shirt: 0xff7a1a, pants: 0xffb347, shoes: 0xff7a1a,
      head: 'mask', accent: 0xb3400a, stripe: 0xffe066, pads: 0xffe066,
    },
    shadowGlow: 0xff6a1a,
    speed: 340,
    jump: 1040,
    punch: { ...PUNCH, damage: 5, startup: 50 },
    kick: { ...KICK, damage: 8 },
    specials: specials({ neutral: 'Fireball', forward: 'Flame Dash', up: 'Fox Flip', down: 'Fire Leash' }, { forward: { cooldown: 700 } }),
    ultimate: { name: 'Fox Toss', kind: 'throw', damage: 28 },
  },
  {
    id: 'stone',
    name: 'Stone',
    shadowName: 'Rock Bear',
    look: {
      skin: 0x8d5a3b, shirt: 0x6d4c33, pants: 0x3e2f24, shoes: 0x1c1410,
      head: 'hair', accent: 0x1c1410, belt: 0xc9a227,
    },
    shadowLook: {
      skin: 0x7a6a5a, shirt: 0x8c7b6b, pants: 0x5a4a3a, shoes: 0x7a6a5a,
      head: 'mask', accent: 0x3d3128, stripe: 0x67e0a3, pads: 0x67e0a3,
    },
    shadowGlow: 0x5fd39a,
    speed: 250,
    jump: 940,
    punch: { ...PUNCH, damage: 8, startup: 80 },
    kick: { ...KICK, damage: 11, startup: 130 },
    specials: specials({ neutral: 'Boulder Shot', forward: 'Bear Charge', up: 'Rock Uppercut', down: 'Root Grab' }, { up: { damage: 14 } }),
    ultimate: { name: 'Bear Quake', kind: 'quake', damage: 34 },
  },
  {
    id: 'viper',
    name: 'Viper',
    shadowName: 'Cobra Spirit',
    look: {
      skin: 0xf1c27d, shirt: 0x1e8449, pants: 0x14281d, shoes: 0x0b0b0b,
      head: 'hair', accent: 0x0b0b0b, belt: 0x7dcea0,
    },
    shadowLook: {
      skin: 0x4fd18b, shirt: 0x2ecc71, pants: 0x145a32, shoes: 0x2ecc71,
      head: 'mask', accent: 0x0e3b22, stripe: 0xd4ff4f, pads: 0xd4ff4f,
    },
    shadowGlow: 0x3dff8f,
    speed: 320,
    jump: 1020,
    punch: { ...PUNCH },
    kick: { ...KICK, reach: 90 },
    specials: specials({ neutral: 'Venom Spit', forward: 'Snake Strike', up: 'Cobra Rise', down: 'Tail Whip' }, { down: { reach: 460 } }),
    ultimate: { name: 'Venom Fling', kind: 'throw', damage: 30 },
  },
];
