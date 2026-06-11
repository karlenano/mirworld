import Phaser from 'phaser';
import { BALANCE } from '../config/balance';

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number = BALANCE.player.maxHp;
  readonly maxHp: number = BALANCE.player.maxHp;
  /** Angle (radians) of the last movement direction — fallback spell aim. */
  facing = -Math.PI / 2;
  /** Real-time timestamp until which movement is locked (misfire stagger). */
  staggeredUntil = 0;

  private invulnUntil = 0;
  private speedMult = 1;
  private speedBuffUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(10, 6, 10);
    this.setCollideWorldBounds(true);
    this.setDepth(10);
  }

  move(dx: number, dy: number): void {
    if (performance.now() < this.staggeredUntil) {
      this.setVelocity(0, 0);
      return;
    }
    const len = Math.hypot(dx, dy);
    if (len > 0.01) {
      const speed = BALANCE.player.speed * this.currentSpeedMult();
      this.setVelocity((dx / len) * speed, (dy / len) * speed);
      this.facing = Math.atan2(dy, dx);
    } else {
      this.setVelocity(0, 0);
    }
  }

  /** Wind sigil: multiply move speed for a duration. mult < 1 = corrupted backfire. */
  applySpeedBuff(mult: number, durationMs: number): void {
    this.speedMult = mult;
    this.speedBuffUntil = performance.now() + durationMs;

    const color = mult >= 1 ? 0xc5f5e8 : 0x8a8a9a;
    this.setTint(color);
    const ring = this.scene.add
      .circle(this.x, this.y, 16, color, 0)
      .setStrokeStyle(3, color, 0.8)
      .setDepth(9);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 450,
      onComplete: () => ring.destroy(),
    });
  }

  private currentSpeedMult(): number {
    if (performance.now() < this.speedBuffUntil) return this.speedMult;
    if (this.speedMult !== 1) {
      this.speedMult = 1;
      this.clearTint();
    }
    return 1;
  }

  /** Returns the damage actually applied (0 while invulnerable). */
  takeDamage(amount: number): number {
    const now = performance.now();
    if (now < this.invulnUntil || this.hp <= 0) return 0;
    this.invulnUntil = now + BALANCE.player.iframesMs;
    this.hp = Math.max(0, this.hp - amount);

    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    return amount;
  }

  stagger(ms: number): void {
    this.staggeredUntil = performance.now() + ms;
  }
}
