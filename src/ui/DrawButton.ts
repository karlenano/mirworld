import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game-config';
import type { CastingController } from '../spells/casting';

const RADIUS = 48;

/**
 * Right-thumb draw-mode toggle. Tap: enter draw mode / commit early.
 * Long-press while drawing: cancel.
 */
export class DrawButton {
  constructor(scene: Phaser.Scene, casting: CastingController) {
    const x = GAME_WIDTH - 90;
    const y = GAME_HEIGHT - 90;

    const circle = scene.add
      .circle(x, y, RADIUS, 0x4a2f8f, 0.85)
      .setStrokeStyle(3, 0xffd766, 0.9)
      .setInteractive(
        new Phaser.Geom.Circle(RADIUS, RADIUS, RADIUS),
        Phaser.Geom.Circle.Contains,
      );
    scene.add
      .text(x, y, '✦', { fontSize: '42px', color: '#ffd766' })
      .setOrigin(0.5);

    let downAt = 0;
    circle.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        downAt = performance.now();
        event.stopPropagation(); // don't let the tap become an ink stroke
      },
    );
    circle.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (performance.now() - downAt >= BALANCE.drawing.cancelLongPressMs) {
          casting.cancel();
        } else {
          casting.toggle();
        }
      },
    );

    casting.on('state', (state: string) => {
      circle.setFillStyle(state === 'drawing' ? 0x8a5fd6 : 0x4a2f8f, 0.85);
    });
  }
}
