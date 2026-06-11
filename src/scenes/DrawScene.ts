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
 * CastingController is in draw mode, renders the ink, and shows the
 * flick-to-aim UI during the 'directing' phase.
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

  // Directing phase UI
  private aimGfx: Phaser.GameObjects.Graphics | null = null;
  private aimOrigin: Phaser.GameObjects.Arc | null = null;
  private aimHint: Phaser.GameObjects.Text | null = null;
  private aimPointer = -1;
  private aimDragStart: { x: number; y: number } | null = null;

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
      this.vignette.setVisible(state === 'drawing' || state === 'directing');
      if (state === 'directing') {
        this.fadeAllInk();
        this.enterDirecting();
      }
      if (state === 'idle') {
        this.fadeAllInk();
        this.exitDirecting();
      }
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

  // ─── Directing phase ────────────────────────────────────────────────────────

  private enterDirecting(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Pulsing ring that shrinks away over the aim window — doubles as a countdown.
    this.aimOrigin = this.add.circle(cx, cy, 30, 0xffffff, 0.0)
      .setStrokeStyle(2, 0xffffff, 0.55)
      .setDepth(20) as Phaser.GameObjects.Arc;
    this.tweens.add({
      targets: this.aimOrigin,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: BALANCE.drawing.aimWindowMs,
      ease: 'Sine.easeIn',
    });

    this.aimHint = this.add
      .text(cx, cy - 62, 'FLICK TO AIM', {
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({ targets: this.aimHint, alpha: 0.75, duration: 200 });

    this.aimGfx = this.add.graphics().setDepth(20);
  }

  private exitDirecting(): void {
    this.aimOrigin?.destroy();
    this.aimOrigin = null;
    this.aimGfx?.destroy();
    this.aimGfx = null;
    this.aimHint?.destroy();
    this.aimHint = null;
    this.aimPointer = -1;
    this.aimDragStart = null;
  }

  private drawAimArrow(angle: number): void {
    if (!this.aimGfx) return;
    this.aimGfx.clear();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const shaftStart = 28; // leave room for the origin ring
    const shaftEnd = 80;
    const sx = cx + Math.cos(angle) * shaftStart;
    const sy = cy + Math.sin(angle) * shaftStart;
    const ex = cx + Math.cos(angle) * shaftEnd;
    const ey = cy + Math.sin(angle) * shaftEnd;

    this.aimGfx.lineStyle(3, 0xffffff, 0.9);
    this.aimGfx.lineBetween(sx, sy, ex, ey);

    // Arrowhead
    const hLen = 14;
    const hSpread = 0.45;
    this.aimGfx.lineBetween(
      ex, ey,
      ex - Math.cos(angle - hSpread) * hLen,
      ey - Math.sin(angle - hSpread) * hLen,
    );
    this.aimGfx.lineBetween(
      ex, ey,
      ex - Math.cos(angle + hSpread) * hLen,
      ey - Math.sin(angle + hSpread) * hLen,
    );
  }

  // ─── Input ──────────────────────────────────────────────────────────────────

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.casting.state === 'directing') {
      if (this.aimPointer !== -1) return; // one finger at a time
      this.aimPointer = pointer.id;
      this.aimDragStart = { x: pointer.x, y: pointer.y };
      return;
    }
    if (this.casting.state !== 'drawing') return;
    if (pointer.x < this.regionLeft) return;
    if (this.activePoints) return;

    this.activePointerId = pointer.id;
    this.activePoints = [{ x: pointer.x, y: pointer.y, t: performance.now() }];
    this.activeGfx = this.add.graphics();
    this.activeGfx.lineStyle(4, INK_COLORS.pending, 0.95);
    this.inkLayer.add(this.activeGfx);
    this.casting.strokeBegan();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.casting.state === 'directing') {
      if (pointer.id !== this.aimPointer || !this.aimDragStart) return;
      const dx = pointer.x - this.aimDragStart.x;
      const dy = pointer.y - this.aimDragStart.y;
      if (Math.hypot(dx, dy) > 12) {
        const angle = Math.atan2(dy, dx);
        this.casting.setAimAngle(angle);
        this.drawAimArrow(angle);
      }
      return;
    }
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
    if (this.casting.state === 'directing') {
      if (pointer.id !== this.aimPointer) return;
      this.casting.aim();
      this.aimPointer = -1;
      this.aimDragStart = null;
      return;
    }
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

  // ─── Ink rendering ──────────────────────────────────────────────────────────

  private recolorStroke(glyph: Glyph): void {
    const ink = this.strokeInk.get(glyph.stroke.id);
    if (!ink) return;
    const color = INK_COLORS[glyph.classified.kind] ?? INK_COLORS.pending;
    this.redraw(ink.gfx, ink.points, color);

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
