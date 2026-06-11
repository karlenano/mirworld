import Phaser from 'phaser';
import { BALANCE } from '../config/balance';

/**
 * Static earth barrier. Belongs to a StaticGroup — the body never moves.
 * After repositioning, refreshBody() syncs the static body to the new
 * sprite position, which is the correct Phaser 3 pool pattern for statics.
 */
export class Block extends Phaser.Physics.Arcade.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'block');
  }

  place(x: number, y: number): void {
    const r = BALANCE.spells.earthBlock.radius;
    this.setPosition(x, y);
    this.setActive(true).setVisible(true).setAlpha(1);

    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = true;
    // refreshBody() resets the StaticBody position to match the sprite —
    // required whenever you reposition a static physics object.
    this.refreshBody();
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);

    this.scene.time.delayedCall(BALANCE.spells.earthBlock.lifetimeMs - 800, () => {
      if (!this.active) return;
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 800,
        onComplete: () => this.release(),
      });
    });
  }

  release(): void {
    (this.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.setActive(false).setVisible(false);
  }
}
