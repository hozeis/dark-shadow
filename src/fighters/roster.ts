import type { FighterDef, Move } from './types';

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

export const ROSTER: FighterDef[] = [
  {
    // From the drawing: the guy with the R cap and the masked giant behind him
    id: 'r',
    name: 'R',
    shadowName: 'Masked Giant',
    look: {
      skin: 0xc68863, shirt: 0xe9e9ee, pants: 0xbcbdc6, shoes: 0x3a3a48,
      head: 'cap', accent: 0xf4f4f4, letter: 'R', belt: 0x8a8a96,
      art: 'r', // his drawing!
    },
    shadowLook: {
      skin: 0x9d8fd6, shirt: 0xa99be0, pants: 0xf2c230, shoes: 0x8f82c8,
      head: 'mask', accent: 0x5b4b9e, stripe: 0xf2c230, pads: 0xf2c230, belt: 0xe08a2e,
      art: 'r-shadow',
    },
    shadowGlow: 0x9b7bff,
    speed: 300,
    jump: 1000,
    punch: { ...PUNCH },
    kick: { ...KICK },
    ultimate: { name: 'Earth Breaker', kind: 'quake', damage: 30 },
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
    ultimate: { name: 'Venom Fling', kind: 'throw', damage: 30 },
  },
];
