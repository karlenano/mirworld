import Phaser from 'phaser';
import { BALANCE } from '../config/balance';

/**
 * One-shot lightning trap. Placed at the caster's feet; triggers on the
 * first enemy that walks over it, applying damage + electric stun, then
 * deactivates. Uses a static body so Arcade overlap detects enemies.
 */
export class LightningTrap extends Phaser.Physics.Arcade.Image {
  placedAt = 0;
  private triggered = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'trap-lightning');
  }

  place(x: number, y: number): void {
    this.triggered = false;
    this.placedAt = performance.now();
    this.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setScale(1);

    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = true;
    this.refreshBody();
    const r = BALANCE.spells.lightningTrap.radius;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);

    // Pulse to signal active trap
    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      yoyo: true,
      repeat: -1,
      duration: 550,
    });

    // Expire after lifetime without triggering
    this.scene.time.delayedCall(BALANCE.spells.lightningTrap.lifetimeMs - 600, () => {
      if (!this.active || this.triggered) return;
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 600,
        onComplete: () => this.release(),
      });
    });
  }

  /** Returns false if already triggered (caller should bail out). */
  trigger(): boolean {
    if (this.triggered) return false;
    this.triggered = true;

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 2.2,
      scaleY: 2.2,
      duration: 380,
      onComplete: () => this.release(),
    });
    return true;
  }

  release(): void {
    this.scene.tweens.killTweensOf(this);
    (this.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.setActive(false).setVisible(false).setScale(1).setAlpha(1);
    this.triggered = false;
  }
}
