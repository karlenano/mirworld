import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/game-config';

const RADIUS = 70;

/**
 * Floating virtual joystick: touching anywhere in the left third of the
 * screen plants the base; dragging sets the output vector.
 */
export class VirtualJoystick {
  /** Normalized output, each component in [-1, 1]. */
  readonly vector = { x: 0, y: 0 };

  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId = -1;
  private origin = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.base = scene.add.circle(0, 0, RADIUS, 0xffffff, 0.08).setVisible(false);
    this.base.setStrokeStyle(2, 0xffffff, 0.25);
    this.thumb = scene.add.circle(0, 0, 28, 0xffffff, 0.22).setVisible(false);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== -1 || p.x > GAME_WIDTH * 0.35) return;
      this.pointerId = p.id;
      this.origin = { x: p.x, y: p.y };
      this.base.setPosition(p.x, p.y).setVisible(true);
      this.thumb.setPosition(p.x, p.y).setVisible(true);
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      const dx = p.x - this.origin.x;
      const dy = p.y - this.origin.y;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, RADIUS);
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      this.vector.x = (nx * clamped) / RADIUS;
      this.vector.y = (ny * clamped) / RADIUS;
      this.thumb.setPosition(this.origin.x + nx * clamped, this.origin.y + ny * clamped);
    });

    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      this.pointerId = -1;
      this.vector.x = 0;
      this.vector.y = 0;
      this.base.setVisible(false);
      this.thumb.setVisible(false);
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }
}
