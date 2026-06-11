import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { classifyStroke } from './classifier';
import { compileSpell } from './compiler';
import { PDollarRecognizer } from './recognizer';
import { SIGIL_TEMPLATES } from './templates';
import type { CastState, CircleFit, Element, Glyph, Stroke } from './types';

/**
 * Casting state machine: idle → drawing → resolving → (cast | misfire) → idle.
 * All timers run on real time (performance.now()) so the in-game slow-motion
 * never affects drawing or recognition.
 *
 * Events:
 *  - 'state'   (state: CastState)
 *  - 'glyph'   (glyph: Glyph)            a stroke was classified
 *  - 'badStroke' (stroke: Stroke)        rejected (e.g. first stroke not a circle)
 *  - 'cast'    (spec: SpellSpec)         includes corrupted casts (backfires)
 *  - 'misfire' (reason: MisfireReason)   fizzle, nothing cast
 */
export class CastingController extends Phaser.Events.EventEmitter {
  state: CastState = 'idle';
  seal: CircleFit | null = null;
  glyphs: Glyph[] = [];

  // M3's Progression system will start this at just 'fire'; the slice keeps
  // all four sigils drawable.
  readonly unlocked = new Set<Element>(['fire', 'water', 'earth', 'wind']);

  private recognizer = new PDollarRecognizer(SIGIL_TEMPLATES);
  private drawStart = 0;
  private lastStrokeEnd = 0;
  private strokeActive = false;

  /** Draw button tapped: enter draw mode, or commit early. */
  toggle(): void {
    if (this.state === 'idle') {
      this.reset();
      this.state = 'drawing';
      this.drawStart = performance.now();
      this.emit('state', this.state);
    } else if (this.state === 'drawing') {
      this.resolve();
    }
  }

  cancel(): void {
    if (this.state === 'idle') return;
    this.reset();
    this.state = 'idle';
    this.emit('state', this.state);
  }

  strokeBegan(): void {
    this.strokeActive = true;
  }

  strokeEnded(stroke: Stroke): void {
    this.strokeActive = false;
    this.lastStrokeEnd = performance.now();
    if (this.state !== 'drawing') return;

    const hasSigil = this.glyphs.some((g) => g.classified.kind === 'sigil-stroke');
    const classified = classifyStroke(stroke, this.seal, hasSigil);

    if (!this.seal && classified.kind !== 'seal') {
      this.emit('badStroke', stroke);
      return;
    }
    if (classified.kind === 'seal') this.seal = classified.fit;

    const glyph: Glyph = { stroke, classified };
    this.glyphs.push(glyph);
    this.emit('glyph', glyph);
  }

  /** Call every frame with performance.now(). */
  update(now: number): void {
    if (this.state !== 'drawing' || this.strokeActive) return;
    const D = BALANCE.drawing;

    if (now - this.drawStart > D.hardCapMs) {
      this.resolve();
      return;
    }
    if (this.glyphs.length === 0) {
      if (now - this.drawStart > D.emptyCancelMs) this.cancel();
      return;
    }
    const readyToResolve =
      this.seal !== null && this.glyphs.length >= 2 && now - this.lastStrokeEnd > D.resolveAfterIdleMs;
    if (readyToResolve) this.resolve();
  }

  private resolve(): void {
    this.state = 'resolving';
    this.emit('state', this.state);

    const sigilStrokes = this.glyphs
      .filter((g) => g.classified.kind === 'sigil-stroke')
      .map((g) => g.stroke);
    const recognition = this.recognizer.recognize(sigilStrokes, this.unlocked);
    this.emit('recognition', recognition);

    const result = compileSpell(this.glyphs, recognition);
    this.reset();
    this.state = 'idle';
    this.emit('state', this.state);

    if (!result.ok) {
      this.emit('misfire', result.reason);
      return;
    }
    // Stability roll: a shaky seal can corrupt the spell into a backfire.
    if (Math.random() > result.spec.stability) {
      result.spec.corrupted = true;
      result.spec.power *= BALANCE.spells.corruptedPowerMult;
      result.spec.direction = Math.random() * Math.PI * 2;
    }
    this.emit('cast', result.spec);
  }

  private reset(): void {
    this.seal = null;
    this.glyphs = [];
    this.strokeActive = false;
  }
}
