import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/game-config';

export class GameOverScene extends Phaser.Scene {
  private kills = 0;
  private survivedMs = 0;

  constructor() {
    super(SCENES.GAME_OVER);
  }

  init(data: { kills?: number; survivedMs?: number }): void {
    this.kills = data.kills ?? 0;
    this.survivedMs = data.survivedMs ?? 0;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a1030, 0.92);
    this.add
      .text(cx, 240, 'the ink runs dry...', { fontSize: '48px', color: '#cdb4ff' })
      .setOrigin(0.5);
    const seconds = Math.round(this.survivedMs / 1000);
    this.add
      .text(cx, 330, `survived ${seconds}s  ·  ${this.kills} monsters dispelled`, {
        fontSize: '24px',
        color: '#9be8ff',
      })
      .setOrigin(0.5);
    const retry = this.add
      .text(cx, 440, 'tap to draw again', { fontSize: '28px', color: '#ffd766' })
      .setOrigin(0.5);
    this.tweens.add({ targets: retry, alpha: 0.4, yoyo: true, repeat: -1, duration: 700 });

    this.input.once('pointerdown', () => this.scene.start(SCENES.GAME));
  }
}
