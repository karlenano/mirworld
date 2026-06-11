import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  REGISTRY,
  SCENES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/game-config';
import type { EnemyType } from '../data/enemies';
import { Block } from '../entities/Block';
import { Enemy } from '../entities/Enemy';
import { LightningTrap } from '../entities/LightningTrap';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { CastingController } from '../spells/casting';
import { SpellExecutor } from '../spells/executor';
import type { SpellSpec } from '../spells/types';
import type { VirtualJoystick } from '../ui/VirtualJoystick';

export class GameScene extends Phaser.Scene {
  player!: Player;
  enemies!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  blocks!: Phaser.Physics.Arcade.StaticGroup;
  traps!: Phaser.Physics.Arcade.StaticGroup;
  kills = 0;

  private casting!: CastingController;
  private executor!: SpellExecutor;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private startedAt = 0;

  constructor() {
    super(SCENES.GAME);
  }

  create(): void {
    this.kills = 0;
    this.startedAt = performance.now();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'grass').setOrigin(0);

    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: BALANCE.combat.enemyCap,
      runChildUpdate: true,
    });
    this.projectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: BALANCE.combat.projectileCap,
      runChildUpdate: true,
    });
    this.blocks = this.physics.add.staticGroup({ classType: Block, maxSize: 12 });
    this.traps = this.physics.add.staticGroup({
      classType: LightningTrap,
      maxSize: BALANCE.spells.lightningTrap.maxTraps,
    });

    // Fresh controller per run — old listeners die with the old instance.
    this.casting = new CastingController();
    this.registry.set(REGISTRY.CASTING, this.casting);
    this.executor = new SpellExecutor(this.projectiles, this.enemies, this.blocks, this.traps, this.player);

    this.casting.on('cast', (spec: SpellSpec) => this.executor.execute(spec));
    this.casting.on('misfire', () => this.onMisfire());

    this.physics.add.overlap(this.projectiles, this.enemies, (p, e) =>
      this.onProjectileHit(p as Projectile, e as Enemy),
    );
    this.physics.add.overlap(this.player, this.enemies, (_p, e) =>
      this.onEnemyTouch(e as Enemy),
    );
    this.physics.add.collider(this.enemies, this.blocks);
    this.physics.add.collider(this.player, this.blocks);
    this.physics.add.overlap(this.enemies, this.traps, (e, t) =>
      this.onTrapTrigger(e as Enemy, t as LightningTrap),
    );

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as GameScene['wasd'];

    // M2 trickle spawner (WaveSpawner replaces this in M3). Uses the scene
    // clock, so spawning slows down with the drawing time-dilation.
    this.time.addEvent({
      delay: BALANCE.spawner.intervalMs,
      loop: true,
      callback: () => this.spawnEnemies(),
    });

    this.scene.launch(SCENES.DRAW);
    this.scene.launch(SCENES.HUD);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.casting.removeAllListeners();
    });
  }

  override update(): void {
    const joystick = this.registry.get(REGISTRY.JOYSTICK) as VirtualJoystick | undefined;
    let dx = joystick?.vector.x ?? 0;
    let dy = joystick?.vector.y ?? 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;
    this.player.move(dx, dy);
  }

  private onProjectileHit(proj: Projectile, enemy: Enemy): void {
    if (!proj.active || !enemy.active || proj.hitSet.has(enemy)) return;
    proj.hitSet.add(enemy);

    const angle = Math.atan2(proj.body!.velocity.y, proj.body!.velocity.x);
    const died = enemy.takeDamage(proj.damage, angle);
    this.spawnDamageNumber(enemy.x, enemy.y, proj.damage, '#ffe9a8');

    if (!died && proj.element === 'fire') {
      const B = BALANCE.spells.fireBurn;
      enemy.applyBurn(B.dps, B.durationMs);
      enemy.on('burntick', (dmg: number) => {
        if (!enemy.active) { enemy.removeAllListeners('burntick'); return; }
        this.spawnDamageNumber(enemy.x, enemy.y - 12, dmg, '#ff8844');
        if (enemy.hp <= 0) { this.kills++; enemy.removeAllListeners('burntick'); }
      });
    }

    if (died) this.kills++;
    if (!proj.pierce) proj.release();
  }

  private onEnemyTouch(enemy: Enemy): void {
    if (!enemy.active) return;
    const applied = this.player.takeDamage(enemy.touchDamage);
    if (applied <= 0) return;

    this.cameras.main.shake(120, 0.004);
    this.spawnDamageNumber(this.player.x, this.player.y, applied, '#ff6b6b');
    if (applied > this.player.maxHp * BALANCE.drawing.interruptDamageFraction) {
      this.casting.cancel(); // big hits break concentration mid-draw
    }
    if (this.player.hp <= 0) this.gameOver();
  }

  private onTrapTrigger(enemy: Enemy, trap: LightningTrap): void {
    if (!enemy.active || !trap.active) return;
    if (!trap.trigger()) return; // already triggered by another enemy this frame

    const T = BALANCE.spells.lightningTrap;
    const angle = Math.atan2(enemy.y - trap.y, enemy.x - trap.x);
    const died = enemy.takeDamage(T.damage, angle);
    this.spawnDamageNumber(enemy.x, enemy.y, T.damage, '#ffee22');
    if (!died) enemy.applyStun(T.stunMs);
    if (died) this.kills++;
  }

  private onMisfire(): void {
    this.player.stagger(300);
    const puff = this.add
      .circle(this.player.x, this.player.y, 14, 0x999999, 0.7)
      .setDepth(15);
    this.tweens.add({
      targets: puff,
      scale: 2.4,
      alpha: 0,
      duration: 420,
      onComplete: () => puff.destroy(),
    });
  }

  private spawnEnemies(): void {
    const S = BALANCE.spawner;
    const count = Phaser.Math.Between(S.perTick.min, S.perTick.max);
    for (let i = 0; i < count; i++) {
      const enemy = this.enemies.get() as Enemy | null;
      if (!enemy) return; // at cap
      const type: EnemyType = Math.random() < S.batChance ? 'bat' : 'slime';
      const { x, y } = this.edgeSpawnPoint();
      enemy.spawn(x, y, type, this.player);
    }
  }

  /** Random point on the world edge, biased away from the player's view. */
  private edgeSpawnPoint(): { x: number; y: number } {
    const margin = 24;
    for (let attempt = 0; attempt < 6; attempt++) {
      const side = Phaser.Math.Between(0, 3);
      const x =
        side === 0 ? margin : side === 1 ? WORLD_WIDTH - margin : Phaser.Math.Between(margin, WORLD_WIDTH - margin);
      const y =
        side === 2 ? margin : side === 3 ? WORLD_HEIGHT - margin : Phaser.Math.Between(margin, WORLD_HEIGHT - margin);
      const visible = Math.abs(x - this.player.x) < GAME_WIDTH / 2 + 60 &&
        Math.abs(y - this.player.y) < GAME_HEIGHT / 2 + 60;
      if (!visible || attempt === 5) return { x, y };
    }
    return { x: margin, y: margin };
  }

  private spawnDamageNumber(x: number, y: number, amount: number, color: string): void {
    const text = this.add
      .text(x, y - 12, String(Math.max(1, Math.round(amount))), {
        fontSize: '15px',
        color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: text,
      y: y - 44,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  private gameOver(): void {
    const survivedMs = performance.now() - this.startedAt;
    this.scene.stop(SCENES.DRAW);
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME_OVER, { kills: this.kills, survivedMs });
  }
}
