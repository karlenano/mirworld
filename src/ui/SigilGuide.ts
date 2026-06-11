import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/game-config';
import type { CastingController } from '../spells/casting';
import { normalize } from '../spells/geometry';
import { SIGIL_DISPLAY } from '../spells/templates';
import type { Element, Vec2 } from '../spells/types';

const ELEMENT_COLORS: Record<Element, number> = {
  fire: 0xff7a3c,
  water: 0x4fc3f7,
  earth: 0xb98a4f,
  wind: 0xc5f5e8,
};

const ALL_ELEMENTS: Element[] = ['fire', 'water', 'earth', 'wind'];

const ELEMENT_HINTS: Record<Element, string> = {
  fire: 'burn',
  water: 'push back',
  earth: 'blockage',
  wind: 'haste',
};

/**
 * Spellbook overlay: how to draw the seal, each unlocked sigil, and the
 * modifier marks. Pauses the game while open; opens once at run start.
 */
export class SigilGuide {
  private panel: Phaser.GameObjects.Container;
  private isOpen = false;

  constructor(
    private scene: Phaser.Scene,
    private casting: CastingController,
  ) {
    this.panel = this.buildPanel();

    // ❔ toggle button, top-right corner
    const btn = scene.add
      .circle(GAME_WIDTH - 44, 40, 24, 0x4a2f8f, 0.85)
      .setStrokeStyle(2, 0xffd766, 0.9)
      .setInteractive(new Phaser.Geom.Circle(24, 24, 24), Phaser.Geom.Circle.Contains);
    scene.add
      .text(GAME_WIDTH - 44, 40, '?', { fontSize: '26px', color: '#ffd766', fontStyle: 'bold' })
      .setOrigin(0.5);
    btn.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.toggle();
      },
    );

    this.open(); // teach the shapes before the first night ends badly
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.casting.cancel();
    this.scene.scene.pause(SCENES.GAME);
    this.scene.scene.pause(SCENES.DRAW);
    this.panel.setVisible(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.scene.scene.resume(SCENES.GAME);
    this.scene.scene.resume(SCENES.DRAW);
    this.panel.setVisible(false);
  }

  private buildPanel(): Phaser.GameObjects.Container {
    const cx = GAME_WIDTH / 2;
    const panel = this.scene.add.container(0, 0).setDepth(100).setVisible(false);

    const backdrop = this.scene.add
      .rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x060818, 0.88)
      .setInteractive();
    backdrop.on('pointerup', () => this.close());
    panel.add(backdrop);

    panel.add(
      this.scene.add
        .text(cx, 48, '~ spellcraft ~', { fontSize: '34px', color: '#cdb4ff' })
        .setOrigin(0.5),
    );

    const gfx = this.scene.add.graphics();
    panel.add(gfx);

    // Step 1 — the seal
    panel.add(
      this.scene.add
        .text(cx, 104, '1.  open the seal — draw a steady circle', {
          fontSize: '20px',
          color: '#ffd766',
        })
        .setOrigin(0.5),
    );
    gfx.lineStyle(3, 0xffd766, 0.9);
    gfx.strokeCircle(cx, 182, 46);

    // Step 2 — sigil cards
    panel.add(
      this.scene.add
        .text(cx, 264, '2.  draw a sigil inside the seal', {
          fontSize: '20px',
          color: '#7df0ff',
        })
        .setOrigin(0.5),
    );
    const cardW = 170;
    const startX = cx - ((ALL_ELEMENTS.length - 1) * cardW) / 2;
    ALL_ELEMENTS.forEach((element, i) => {
      const x = startX + i * cardW;
      const y = 350;
      const unlocked = this.casting.unlocked.has(element);

      gfx.lineStyle(2, unlocked ? 0xffffff : 0x555566, unlocked ? 0.35 : 0.3);
      gfx.strokeRoundedRect(x - 70, y - 56, 140, 112, 10);

      if (unlocked) {
        this.drawShape(gfx, SIGIL_DISPLAY[element], x, y - 6, 80, ELEMENT_COLORS[element]);
      }
      panel.add(
        this.scene.add
          .text(x, y + 30, unlocked ? element : '???', {
            fontSize: '17px',
            color: unlocked ? '#e8e8f0' : '#555566',
          })
          .setOrigin(0.5),
      );
      if (unlocked) {
        panel.add(
          this.scene.add
            .text(x, y + 47, ELEMENT_HINTS[element], { fontSize: '12px', color: '#8a8a9a' })
            .setOrigin(0.5),
        );
      }
      if (!unlocked) {
        panel.add(
          this.scene.add
            .text(x, y - 8, '?', { fontSize: '42px', color: '#555566' })
            .setOrigin(0.5),
        );
      }
    });

    // Step 3 — modifiers
    panel.add(
      this.scene.add
        .text(cx, 466, '3.  embellish (optional)', { fontSize: '20px', color: '#9dff8a' })
        .setOrigin(0.5),
    );

    // dots
    gfx.fillStyle(0xffffff, 0.95);
    gfx.fillCircle(cx - 232, 524, 4);
    gfx.fillCircle(cx - 216, 516, 4);
    gfx.fillCircle(cx - 200, 524, 4);
    panel.add(
      this.scene.add
        .text(cx - 130, 524, 'dots inside — more bolts', { fontSize: '16px', color: '#c8c8d8' })
        .setOrigin(0, 0.5),
    );

    // tail
    gfx.lineStyle(3, 0x9dff8a, 0.9);
    gfx.strokeCircle(cx + 120, 524, 18);
    gfx.lineBetween(cx + 136, 516, cx + 196, 496);
    panel.add(
      this.scene.add
        .text(cx + 210, 510, 'a stroke out of the seal —\nlonger reach, aims the spell', {
          fontSize: '16px',
          color: '#c8c8d8',
        })
        .setOrigin(0, 0.5),
    );

    panel.add(
      this.scene.add
        .text(cx, GAME_HEIGHT - 64, 'a shaky seal corrupts the spell.  tap anywhere to begin', {
          fontSize: '17px',
          color: '#8a8a9a',
        })
        .setOrigin(0.5),
    );

    return panel;
  }

  /** Render a template polyline scaled to fit a `size`-wide box at (cx, cy). */
  private drawShape(
    gfx: Phaser.GameObjects.Graphics,
    raw: Vec2[],
    cx: number,
    cy: number,
    size: number,
    color: number,
  ): void {
    const pts = normalize(raw); // centroid at origin, longest side = 1
    gfx.lineStyle(3, color, 0.95);
    for (let i = 1; i < pts.length; i++) {
      gfx.lineBetween(
        cx + pts[i - 1].x * size,
        cy + pts[i - 1].y * size,
        cx + pts[i].x * size,
        cy + pts[i].y * size,
      );
    }
  }
}
