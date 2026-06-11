import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { ENEMY_DEFS, type EnemyType } from '../data/enemies';
import type { Player } from './Player';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  enemyType: EnemyType = 'slime';
  hp = 1;
  touchDamage = 0;

  private speed = 0;
  private knockbackUntil = 0;
  private burnUntil = 0;
  private burnDps = 0;
  private lastBurnTick = 0;
  private target: Player | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'slime');
  }

  spawn(x: number, y: number, type: EnemyType, target: Player): void {
    const def = ENEMY_DEFS[type];
    this.enemyType = type;
    this.hp = def.hp;
    this.speed = def.speed;
    this.touchDamage = def.touchDamage;
    this.target = target;
    this.knockbackUntil = 0;
    this.burnUntil = 0;
    this.burnDps = 0;
    this.lastBurnTick = 0;

    this.enableBody(true, x, y, true, true);
    this.setTexture(def.texture);
    this.setCircle(Math.min(this.width, this.height) / 2.4);
    this.clearTint();
    this.setAlpha(1);
  }

  override update(): void {
    if (!this.active || !this.target) return;
    const now = performance.now();

    // burn tick
    if (now < this.burnUntil && now - this.lastBurnTick >= BALANCE.spells.fireBurn.tickMs) {
      this.lastBurnTick = now;
      const dmg = this.burnDps * (BALANCE.spells.fireBurn.tickMs / 1000);
      this.hp -= dmg;
      if (this.hp <= 0) { this.die(); return; }
      this.emit('burntick', dmg);
    }

    if (now < this.knockbackUntil) return; // let knockback velocity play out

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    this.setVelocity((dx / len) * this.speed, (dy / len) * this.speed);
  }

  /** Returns true if the enemy died. */
  takeDamage(amount: number, fromAngle: number): boolean {
    this.hp -= amount;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.clearTint();
    });

    const kb = BALANCE.combat.knockback;
    this.setVelocity(Math.cos(fromAngle) * kb, Math.sin(fromAngle) * kb);
    this.knockbackUntil = performance.now() + BALANCE.combat.enemyKnockbackMs;

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  applyBurn(dps: number, durationMs: number): void {
    this.burnDps = dps;
    this.burnUntil = performance.now() + durationMs;
    this.lastBurnTick = performance.now();
    this.setTint(0xff6633);
  }

  /** Electric stun: freeze in place + yellow tint, no knockback velocity. */
  applyStun(durationMs: number): void {
    this.knockbackUntil = performance.now() + durationMs;
    // Delay slightly so the damage-flash (60 ms white) clears first.
    this.scene.time.delayedCall(70, () => { if (this.active) this.setTint(0xffee22); });
    this.scene.time.delayedCall(durationMs, () => { if (this.active) this.clearTint(); });
  }

  applyKnockback(fromX: number, fromY: number, force: number, stunMs: number): void {
    const angle = Math.atan2(this.y - fromY, this.x - fromX);
    this.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
    this.knockbackUntil = performance.now() + stunMs;
    this.setTint(0x88ccff);
    this.scene.time.delayedCall(stunMs, () => { if (this.active) this.clearTint(); });
  }

  private die(): void {
    this.disableBody(true, true);
  }
}
