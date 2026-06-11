import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_HEIGHT, GAME_WIDTH, REGISTRY, SCENES } from '../config/game-config';
import type { CastingController } from '../spells/casting';
import { bbox, pathLength } from '../spells/geometry';
import type { Glyph, RawPoint, Stroke } from '../spells/types';

const INK_COLORS: Record<string, number> = {
  pending: 0x9be8ff,
  seal: 0xffd766,
  'sigil-stroke': 0x7df0ff,
  dot: 0xffffff,
  tail: 0x9dff8a,
  unknown: 0x8a8a9a,
};

/**
 * Screen-space overlay scene: captures finger strokes while the
 * CastingController is in draw mode and renders the ink.
 * Runs in parallel above GameScene, below HudScene.
 */
export class DrawScene extends Phaser.Scene {
  private casting!: CastingController;
  private vignette!: Phaser.GameObjects.Rectangle;
  private inkLayer!: Phaser.GameObjects.Container;
  private strokeInk = new Map<number, { gfx: Phaser.GameObjects.Graphics; points: RawPoint[] }>();
  private activePoints: RawPoint[] | null = null;
  private activeGfx: Phaser.GameObjects.Graphics | null = null;
  private activePointerId = -1;
  private nextStrokeId = 1;

  // Draw region: the right 65% of the screen (left third belongs to the joystick).
  private regionLeft = GAME_WIDTH * 0.35;

  constructor() {
    super(SCENES.DRAW);
  }

  create(): void {
    this.casting = this.registry.get(REGISTRY.CASTING) as CastingController;

    this.vignette = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x060818, 0.4)
      .setVisible(false);
    this.inkLayer = this.add.container(0, 0);

    this.casting.on('state', (state: string) => {
      this.vignette.setVisible(state === 'drawing');
      if (state === 'idle') this.fadeAllInk();
    });
    this.casting.on('glyph', (glyph: Glyph) => this.recolorStroke(glyph));
    this.casting.on('badStroke', (stroke: Stroke) => this.flashBadStroke(stroke.id));

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
  }

  override update(): void {
    this.casting.update(performance.now());
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.casting.state !== 'drawing') return;
    if (pointer.x < this.regionLeft) return;
    if (this.activePoints) return; // one drawing finger at a time

    this.activePointerId = pointer.id;
    this.activePoints = [{ x: pointer.x, y: pointer.y, t: performance.now() }];
    this.activeGfx = this.add.graphics();
    this.activeGfx.lineStyle(4, INK_COLORS.pending, 0.95);
    this.inkLayer.add(this.activeGfx);
    this.casting.strokeBegan();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.activePoints || pointer.id !== this.activePointerId) return;
    const pts = this.activePoints;
    const last = pts[pts.length - 1];
    const dx = pointer.x - last.x;
    const dy = pointer.y - last.y;
    if (Math.hypot(dx, dy) < BALANCE.drawing.noiseGatePx) return;

    pts.push({ x: pointer.x, y: pointer.y, t: performance.now() });
    this.activeGfx!.lineBetween(last.x, last.y, pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.activePoints || pointer.id !== this.activePointerId) return;

    const points = this.activePoints;
    const stroke: Stroke = {
      id: this.nextStrokeId++,
      points,
      bbox: bbox(points),
      length: pathLength(points),
    };
    this.strokeInk.set(stroke.id, { gfx: this.activeGfx!, points });
    this.activePoints = null;
    this.activeGfx = null;
    this.activePointerId = -1;
    this.casting.strokeEnded(stroke);
  }

  private recolorStroke(glyph: Glyph): void {
    const ink = this.strokeInk.get(glyph.stroke.id);
    if (!ink) return;
    const color = INK_COLORS[glyph.classified.kind] ?? INK_COLORS.pending;
    this.redraw(ink.gfx, ink.points, color);

    // Snap the seal stroke to its fitted circle — satisfying "click" feedback.
    if (glyph.classified.kind === 'seal') {
      const { cx, cy, r } = glyph.classified.fit;
      ink.gfx.lineStyle(2, 0xffd766, 0.5);
      ink.gfx.strokeCircle(cx, cy, r);
    }
  }

  private flashBadStroke(strokeId: number): void {
    const ink = this.strokeInk.get(strokeId);
    if (!ink) return;
    this.redraw(ink.gfx, ink.points, 0xff5555);
    this.tweens.add({
      targets: ink.gfx,
      alpha: 0,
      duration: 350,
      onComplete: () => {
        ink.gfx.destroy();
        this.strokeInk.delete(strokeId);
      },
    });
  }

  private redraw(gfx: Phaser.GameObjects.Graphics, points: RawPoint[], color: number): void {
    gfx.clear();
    gfx.lineStyle(4, color, 0.95);
    for (let i = 1; i < points.length; i++) {
      gfx.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }
    if (points.length === 1) {
      gfx.fillStyle(color, 0.95);
      gfx.fillCircle(points[0].x, points[0].y, 4);
    }
  }

  private fadeAllInk(): void {
    for (const [id, ink] of this.strokeInk) {
      this.tweens.add({
        targets: ink.gfx,
        alpha: 0,
        duration: 400,
        onComplete: () => ink.gfx.destroy(),
      });
      this.strokeInk.delete(id);
    }
    if (this.activeGfx) {
      this.activeGfx.destroy();
      this.activeGfx = null;
      this.activePoints = null;
      this.activePointerId = -1;
    }
  }
}
