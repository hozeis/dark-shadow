// Global game settings. Tweak these numbers to change how the game feels!

export const GAME_W = 1280;
export const GAME_H = 720;
export const GROUND_Y = 620; // where the fighters' feet touch the floor
export const GRAVITY = 2600; // bigger = fighters fall faster
export const STAGE_LEFT = 50;
export const STAGE_RIGHT = 1230;

export const MAX_HP = 100;
export const ROUND_TIME = 99; // seconds
export const WINS_NEEDED = 2; // best of 3

// The shadow spirit standing behind each fighter
export const SHADOW_SCALE = 1.3; // how much bigger than the fighter
export const SHADOW_ALPHA = 0.42; // how see-through (0 = invisible, 1 = solid)

export const FONT = 'Bangers, Impact, sans-serif';

// Keyboard controls
export const P1_KEYS = { left: 'A', right: 'D', up: 'W', down: 'S', punch: 'F', kick: 'G', ult: 'H' };
export const P2_KEYS = { left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN', punch: 'J', kick: 'K', ult: 'L' };
