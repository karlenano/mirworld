import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/game-config';
import { BootScene } from './scenes/BootScene';
import { DrawScene } from './scenes/DrawScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { PreloadScene } from './scenes/PreloadScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a1030',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  // Launch order matters: DrawScene renders above Game, Hud above Draw.
  scene: [BootScene, PreloadScene, GameScene, DrawScene, HudScene, GameOverScene],
});
