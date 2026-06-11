import Phaser from 'phaser';
import { GAME_WIDTH, REGISTRY, SCENES } from '../config/game-config';
import type { CastingController } from '../spells/casting';
import type { RecognizeResult } from '../spells/recognizer';
import type { Glyph, MisfireReason, SpellSpec } from '../spells/types';
import { DrawButton } from '../ui/DrawButton';
import { SigilGuide } from '../ui/SigilGuide';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import type { GameScene } from './GameScene';

export class HudScene extends Phaser.Scene {
  private casting!: CastingController;
  private hpBar!: Phaser.GameObjects.Graphics;
  private toast!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private debugLines: string[] = [];

  constructor() {
    super(SCENES.HUD);
  }

  create(): void {
    this.casting = this.registry.get(REGISTRY.CASTING) as CastingController;

    const joystick = new VirtualJoystick(this);
    this.registry.set(REGISTRY.JOYSTICK, joystick);
    new DrawButton(this, this.casting);

    this.hpBar = this.add.graphics();
    this.toast = this.add
      .text(GAME_WIDTH / 2, 90, '', {
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    new SigilGuide(this, this.casting);

    // M1 debug overlay — the recognition tuning instrument. Toggle with D.
    this.debugText = this.add
      .text(GAME_WIDTH - 16, 80, '', {
        fontSize: '13px',
        color: '#aef3ff',
        align: 'right',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 0);
    this.input.keyboard?.on('keydown-D', () => {
      this.debugText.setVisible(!this.debugText.visible);
    });

    this.casting.on('glyph', (glyph: Glyph) => {
      const c = glyph.classified;
      if (c.kind === 'seal') {
        this.pushDebug(`seal  q=${c.fit.quality.toFixed(2)} r=${Math.round(c.fit.r)}`);
      } else if (c.kind === 'tail') {
        this.pushDebug(`tail  len=${c.lengthRatio.toFixed(2)}`);
      } else {
        this.pushDebug(c.kind);
      }
    });
    this.casting.on('recognition', (r: RecognizeResult) => {
      for (const s of r.all.slice(0, 4)) this.pushDebug(`  ${s.name}: ${s.score.toFixed(2)}`);
    });
    this.casting.on('cast', (spec: SpellSpec) => {
      this.pushDebug(
        `CAST ${spec.element} p=${spec.power.toFixed(2)} s=${spec.stability.toFixed(2)} ×${spec.count}` +
          (spec.corrupted ? ' CORRUPT' : ''),
      );
      let message = `${spec.element} ×${spec.count}`;
      if (spec.element === 'wind') message = 'the wind carries you';
      if (spec.corrupted) {
        message =
          spec.element === 'wind' ? 'the wind turns against you' : `the ${spec.element} spell corrupts!`;
      }
      this.showToast(message, spec.corrupted ? '#ff8888' : '#ffe9a8');
    });
    this.casting.on('misfire', (reason: MisfireReason) => {
      this.pushDebug(`MISFIRE ${reason}`);
      const msg: Record<MisfireReason, string> = {
        'no-seal': 'the seal never formed...',
        'no-sigil': 'an empty seal fizzles',
        'unknown-sigil': 'the sigil means nothing',
      };
      this.showToast(msg[reason], '#aaaaaa');
    });
  }

  override update(): void {
    const game = this.scene.get(SCENES.GAME) as GameScene;
    if (!game.player) return;
    const frac = Math.max(0, game.player.hp / game.player.maxHp);
    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.5).fillRoundedRect(16, 16, 224, 22, 6);
    this.hpBar
      .fillStyle(frac > 0.3 ? 0x6fd66f : 0xd65f5f, 1)
      .fillRoundedRect(18, 18, 220 * frac, 18, 5);
  }

  private pushDebug(line: string): void {
    this.debugLines.push(line);
    if (this.debugLines.length > 14) this.debugLines.shift();
    this.debugText.setText(this.debugLines.join('\n'));
  }

  private showToast(message: string, color: string): void {
    this.toast.setText(message).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1100, duration: 400 });
  }
}
