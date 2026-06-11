import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { classifyStroke } from './classifier';
import { compileSpell } from './compiler';
import { PDollarRecognizer } from './recognizer';
import { SIGIL_TEMPLATES } from './templates';
import type { CastState, CircleFit, Element, Glyph, SpellSpec, Stroke } from './types';

/**
 * Casting state machine: idle → drawing → resolving → directing → idle.
 * Corrupted spells skip directing and fire immediately in their random direction.
 * All timers run on real time (performance.now()) so game slow-motion never
 * affects drawing, recognition, or the aim window.
 *
 * Events:
 *  - 'state'      (state: CastState)
 *  - 'glyph'      (glyph: Glyph)           a stroke was classified
 *  - 'badStroke'  (stroke: Stroke)          rejected (e.g. first stroke not a circle)
 *  - 'cast'       (spec: SpellSpec)         spell fires (direction already set or undefined = auto-aim)
 *  - 'misfire'    (reason: MisfireReason)   fizzle, nothing cast
 */
export class CastingController extends Phaser.Events.EventEmitter {
  state: CastState = 'idle';
  seal: CircleFit | null = null;
  glyphs: Glyph[] = [];
  pendingSpec: SpellSpec | null = null;

  readonly unlocked = new Set<Element>(['fire', 'water', 'earth', 'wind', 'lightning']);

  private recognizer = new PDollarRecognizer(SIGIL_TEMPLATES);
  private aimStart = 0;

  toggle(): void {
    if (this.state !== 'idle') return;
    this.reset();
    this.state = 'drawing';
    this.emit('state', this.state);
  }

  cancel(): void {
    if (this.state === 'idle') return;
    this.pendingSpec = null;
    this.reset();
    this.state = 'idle';
    this.emit('state', this.state);
  }

  strokeEnded(stroke: Stroke): void {
    if (this.state !== 'drawing') return;

    const hasSigil = this.glyphs.some((g) => g.classified.kind === 'sigil-stroke');
    const classified = classifyStroke(stroke, this.seal, hasSigil);

    if (classified.kind === 'seal') {
      // Circle drawn = activation. Set the seal, then re-classify any strokes
      // that were accumulated before we knew the seal's center.
      this.seal = classified.fit;
      for (const g of this.glyphs) {
        const reclassified = classifyStroke(g.stroke, this.seal, false);
        if (reclassified.kind !== g.classified.kind) {
          g.classified = reclassified;
          this.emit('glyph', g);
        }
      }
      const sealGlyph: Glyph = { stroke, classified };
      this.glyphs.push(sealGlyph);
      this.emit('glyph', sealGlyph);
      this.resolve();
      return;
    }

    if (!this.seal) {
      // No seal yet — accept every stroke as a sigil candidate.
      const glyph: Glyph = { stroke, classified: { kind: 'sigil-stroke' } };
      this.glyphs.push(glyph);
      this.emit('glyph', glyph);
      return;
    }

    // Seal set but not a circle stroke (shouldn't arrive in normal flow since
    // resolve fires when the seal is drawn, but handle defensively).
    const glyph: Glyph = { stroke, classified };
    this.glyphs.push(glyph);
    this.emit('glyph', glyph);
  }

  /** Update the aimed direction while the player is dragging (fire). */
  setAimAngle(angle: number): void {
    if (this.state !== 'directing' || !this.pendingSpec || this.pendingSpec.corrupted) return;
    this.pendingSpec.direction = angle;
  }

  /** Update the placement target while the player is dragging (earth). */
  setAimTarget(dx: number, dy: number): void {
    if (this.state !== 'directing' || !this.pendingSpec) return;
    this.pendingSpec.targetX = dx;
    this.pendingSpec.targetY = dy;
  }

  /** Commit the aim and fire the spell. Called by DrawScene on pointer-up or after timeout. */
  aim(): void {
    if (this.state !== 'directing' || !this.pendingSpec) return;
    const spec = this.pendingSpec;
    this.pendingSpec = null;
    this.state = 'idle';
    this.emit('state', this.state);
    this.emit('cast', spec);
  }

  update(now: number): void {
    if (this.state === 'directing') {
      if (now - this.aimStart > BALANCE.drawing.aimWindowMs) this.aim();
    }
    // Drawing: no timeouts — the circle is the only trigger for resolution.
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

    if (!result.ok) {
      this.reset();
      this.state = 'idle';
      this.emit('state', this.state);
      this.emit('misfire', result.reason);
      return;
    }

    // Stability roll: corrupted spells skip aiming and fire instantly in a random direction.
    if (Math.random() > result.spec.stability) {
      result.spec.corrupted = true;
      result.spec.power *= BALANCE.spells.corruptedPowerMult;
      result.spec.direction = Math.random() * Math.PI * 2;
      this.reset();
      this.state = 'idle';
      this.emit('state', this.state);
      this.emit('cast', result.spec);
      return;
    }

    // Wind/water/lightning all resolve immediately with no aiming phase.
    if (result.spec.element === 'wind' || result.spec.element === 'water' || result.spec.element === 'lightning') {
      this.reset();
      this.state = 'idle';
      this.emit('state', this.state);
      this.emit('cast', result.spec);
      return;
    }

    // Enter directing phase — player has aimWindowMs to flick-aim.
    this.reset();
    this.pendingSpec = result.spec;
    this.state = 'directing';
    this.aimStart = performance.now();
    this.emit('state', this.state);
  }

  private reset(): void {
    this.seal = null;
    this.glyphs = [];
  }
}
