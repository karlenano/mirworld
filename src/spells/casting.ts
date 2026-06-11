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

  readonly unlocked = new Set<Element>(['fire', 'water', 'earth', 'wind']);

  private recognizer = new PDollarRecognizer(SIGIL_TEMPLATES);
  private drawStart = 0;
  private lastStrokeEnd = 0;
  private strokeActive = false;
  private aimStart = 0;

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
    this.pendingSpec = null;
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

  /** Update the aimed direction while the player is dragging. */
  setAimAngle(angle: number): void {
    if (this.state !== 'directing' || !this.pendingSpec || this.pendingSpec.corrupted) return;
    this.pendingSpec.direction = angle;
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
      return;
    }
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

    // Wind is a self-buff; water auto-pushes toward nearest enemies — neither needs aiming.
    if (result.spec.element === 'wind' || result.spec.element === 'water') {
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
    this.strokeActive = false;
  }
}
