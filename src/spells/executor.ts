import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { Block } from '../entities/Block';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import type { SpellSpec } from './types';

/** Turns a compiled SpellSpec into world effects. */
export class SpellExecutor {
  constructor(
    private projectiles: Phaser.Physics.Arcade.Group,
    private enemies: Phaser.Physics.Arcade.Group,
    private blocks: Phaser.Physics.Arcade.StaticGroup,
    private player: Player,
  ) {}

  execute(spec: SpellSpec): void {
    switch (spec.element) {
      case 'wind':  return this.executeWind(spec);
      case 'earth': return this.executeEarth(spec);
      case 'water': return this.executeWater(spec);
      case 'fire':  return this.executeFire(spec);
    }
  }

  /** Fire — fast projectiles that set enemies ablaze on hit. */
  private executeFire(spec: SpellSpec): void {
    const S = BALANCE.spells;
    const baseAngle = spec.direction ?? this.nearestEnemyAngle() ?? this.player.facing;
    const power = spec.power * Math.pow(BALANCE.drawing.extraDotPowerMult, spec.count - 1);
    const damage = S.baseDamage['fire'] * power * (0.6 + 0.4 * spec.stability);
    const range = S.projectileRange['fire'] * spec.rangeMult;
    const spread = Phaser.Math.DegToRad(S.fanSpreadDeg);

    for (let i = 0; i < spec.count; i++) {
      const offset = (i - (spec.count - 1) / 2) * spread;
      const proj = this.projectiles.get(this.player.x, this.player.y) as Projectile | null;
      if (!proj) break;
      proj.fire(this.player.x, this.player.y, baseAngle + offset, 'fire', damage, S.projectileSpeed['fire'], range, false);
    }

    if (spec.corrupted && S.corruptedSelfDamage['fire'] > 0)
      this.player.takeDamage(S.corruptedSelfDamage['fire']);
  }

  /**
   * Water — no damage; fires a wave that blasts all nearby enemies back.
   * More dots = wider radius. Tail sets the push direction (arc in front).
   */
  private executeWater(spec: SpellSpec): void {
    const W = BALANCE.spells.waterPush;
    const baseAngle = spec.direction ?? this.nearestEnemyAngle() ?? this.player.facing;
    const force = W.knockback * (0.6 + 0.4 * spec.power) * (spec.corrupted ? 0.4 : 1);
    const radius = W.radius * (1 + (spec.count - 1) * 0.25) * spec.rangeMult;

    // Visualise the wave ring
    const ring = (this.player.scene as Phaser.Scene).add
      .circle(this.player.x, this.player.y, 10, 0x4fc3f7, 0.55)
      .setDepth(8);
    (this.player.scene as Phaser.Scene).tweens.add({
      targets: ring,
      scaleX: (radius * 2) / 10,
      scaleY: (radius * 2) / 10,
      alpha: 0,
      duration: 320,
      onComplete: () => ring.destroy(),
    });

    const arcHalf = spec.direction !== undefined
      ? Phaser.Math.DegToRad(70) // directional push: 140° arc
      : Math.PI; // no tail: push full half-circle in facing direction

    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist > radius) continue;
      const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      const diff = Phaser.Math.Angle.Wrap(angleToEnemy - baseAngle);
      if (Math.abs(diff) > arcHalf) continue;
      enemy.applyKnockback(this.player.x, this.player.y, force, W.stunMs);
    }

    if (spec.corrupted) this.player.takeDamage(BALANCE.spells.corruptedSelfDamage['water']);
  }

  /**
   * Earth — places a static rock barrier at the targeted spot.
   * Tail sets placement direction + distance; dots add extra rocks (fanned out).
   */
  private executeEarth(spec: SpellSpec): void {
    const E = BALANCE.spells.earthBlock;
    if (spec.corrupted) {
      // Corrupted: rock appears under the player
      const block = this.blocks.get(this.player.x, this.player.y) as Block | null;
      block?.place(this.player.x, this.player.y);
      return;
    }

    const angle = spec.direction ?? this.player.facing;
    const dist = E.placeDist * spec.rangeMult;
    const spread = Phaser.Math.DegToRad(28);

    for (let i = 0; i < spec.count; i++) {
      const offset = (i - (spec.count - 1) / 2) * spread;
      const a = angle + offset;
      const bx = this.player.x + Math.cos(a) * dist;
      const by = this.player.y + Math.sin(a) * dist;
      const block = this.blocks.get(bx, by) as Block | null;
      block?.place(bx, by);
    }
  }

  /** Wind — haste buff. Power → speed multiplier, dots → duration. */
  private executeWind(spec: SpellSpec): void {
    const W = BALANCE.spells.windBuff;
    if (spec.corrupted) {
      this.player.applySpeedBuff(W.corruptedSlowMult, W.corruptedSlowMs);
      return;
    }
    const mult = W.baseMult + W.powerMult * spec.power;
    const duration = (W.baseDurationMs + W.perDotDurationMs * (spec.count - 1)) * spec.rangeMult;
    this.player.applySpeedBuff(mult, duration);
  }

  private nearestEnemyAngle(): number | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (d < bestDist) { bestDist = d; best = enemy; }
    }
    return best ? Phaser.Math.Angle.Between(this.player.x, this.player.y, best.x, best.y) : null;
  }
}
