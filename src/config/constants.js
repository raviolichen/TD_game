export const COLS = 20;
export const ROWS = 12;
export const TILE = 40;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

export const STEP = 1 / 60;
export const WAVES_PER_MAP = 20;
export const VICTORY_WAVE = 100;

export const MAX_LEVEL = 5;
export const MAX_STAR = 4;
export const RECIPE_MIN_STAR = 2;
export const SELL_RATIO = 0.7;
export const POWER_TILE_BONUS = 0.25;

export const RELOCATE_BONUS = 150;
export const INTEREST_RATE = 0.03;
export const INTEREST_CAP = 30;
export const AUTO_START_DELAY = 6;

export const DIFFICULTIES = {
  easy: { name: '簡單', gold: 300, lives: 30, hp: 0.8 },
  normal: { name: '普通', gold: 220, lives: 20, hp: 1 },
  hard: { name: '困難', gold: 200, lives: 12, hp: 1.2 }
};
