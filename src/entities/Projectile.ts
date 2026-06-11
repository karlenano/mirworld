import Phaser from 'phaser';
import type { Element } from '../spells/types';
import type { Enemy } from './Enemy';

export class Projectile extends Phaser.Physics.Arcade.Image {
  element: Element = 'fire';
  damage = 0;
  pierce = false;
  /** Enemies already hit — pierce projectiles damage each enemy once. */
  hitSet = new Set<Enemy>();

  private startX = 0;
  private startY = 0;
  private range = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'proj-fire');
  }

  fire(
    x: number,
    y: number,
    angle: number,
    element: Element,
    damage: number,
    speed: number,
    range: number,
    pierce: boolean,
    scale = 1,
  ): void {
    this.element = element;
    this.damage = damage;
    this.pierce = pierce;
    this.range = range;
    this.startX = x;
    this.startY = y;
    this.hitSet.clear();

    this.enableBody(true, x, y, true, true);
    this.setTexture(`proj-${element}`);
    this.setScale(scale);
    this.setCircle(this.width / 2);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.setRotation(angle);
  }

  override update(): void {
    if (!this.active) return;
    if (Math.hypot(this.x - this.startX, this.y - this.startY) > this.range) {
      this.release();
    }
  }

  release(): void {
    this.disableBody(true, true);
  }
}
