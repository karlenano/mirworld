export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1600;

export const SCENES = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  GAME: 'Game',
  DRAW: 'Draw',
  HUD: 'Hud',
  GAME_OVER: 'GameOver',
} as const;

export const REGISTRY = {
  CASTING: 'casting',
  JOYSTICK: 'joystick',
} as const;
