import Phaser from 'phaser';
import { SCENES } from '../config/game-config';

/**
 * No external assets in the vertical slice — all textures are generated
 * procedurally so art never blocks code.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.PRELOAD);
  }

  create(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Player: little witch — robe + hat
    g.fillStyle(0x6c4ab6);
    g.fillCircle(16, 20, 10);
    g.fillStyle(0x4a2f8f);
    g.fillTriangle(16, 0, 6, 16, 26, 16);
    g.fillStyle(0xf2d5b1);
    g.fillCircle(16, 16, 5);
    g.generateTexture('player', 32, 32);
    g.clear();

    // Slime
    g.fillStyle(0x59c455);
    g.fillEllipse(12, 14, 22, 16);
    g.fillStyle(0x2e7d32);
    g.fillCircle(8, 12, 2);
    g.fillCircle(16, 12, 2);
    g.generateTexture('slime', 24, 24);
    g.clear();

    // Bat
    g.fillStyle(0x5d5470);
    g.fillTriangle(0, 4, 10, 10, 2, 14);
    g.fillTriangle(20, 4, 10, 10, 18, 14);
    g.fillCircle(10, 10, 4);
    g.generateTexture('bat', 20, 18);
    g.clear();

    // Projectiles per element
    const projectile = (key: string, color: number, r: number) => {
      g.fillStyle(color, 0.4);
      g.fillCircle(r + 2, r + 2, r + 2);
      g.fillStyle(color);
      g.fillCircle(r + 2, r + 2, r);
      g.generateTexture(key, (r + 2) * 2, (r + 2) * 2);
      g.clear();
    };
    projectile('proj-fire', 0xff7a3c, 6);
    projectile('proj-water', 0x4fc3f7, 6);
    projectile('proj-earth', 0xb98a4f, 10);
    projectile('proj-wind', 0xc5f5e8, 6);

    // Earth block / barrier rock
    g.fillStyle(0x7a5c3a);
    g.fillCircle(36, 36, 34);
    g.fillStyle(0x5c3e24);
    g.fillCircle(28, 30, 14);
    g.fillStyle(0x9c7a52);
    g.fillCircle(44, 26, 10);
    g.fillStyle(0x6b4d2e);
    g.fillCircle(38, 46, 8);
    g.generateTexture('block', 72, 72);
    g.clear();

    // Ground tile
    g.fillStyle(0x2f5d3a);
    g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x35693f);
    for (let i = 0; i < 14; i++) {
      const x = (i * 37) % 64;
      const y = (i * 23) % 64;
      g.fillRect(x, y, 3, 3);
    }
    g.generateTexture('grass', 64, 64);
    g.clear();

    g.destroy();
    this.scene.start(SCENES.GAME);
  }
}
