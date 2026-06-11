import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { compileSpell } from './compiler';
import { PDollarRecognizer } from './recognizer';
import { SIGIL_TEMPLATES } from './templates';
import type { CastState, Element, SpellSpec, Stroke } from './types';

/**
 * Casting: draw a sigil stroke → instant recognition → spell fires.
 * No seal or circle needed. Each completed stroke is a full cast attempt.
 *
 * States: idle → drawing (finger down) → idle or directing (finger up).
 *
 * Events:
 *  - 'state'       (state: CastState)
 *  - 'recognition' (result: RecognizeResult)
 *  - 'cast'        (spec: SpellSpec)
 *  - 'misfire'     (reason: MisfireReason)
 */
export class CastingController extends Phaser.Events.EventEmitter {
  state: CastState = 'idle';
  pendingSpec: SpellSpec | null = null;

  readonly unlocked = new Set<Element>(['fire', 'water', 'earth', 'wind', 'lightning']);

  private recognizer = new PDollarRecognizer(SIGIL_TEMPLATES);
  private lastStrokeEnd = 0;
  private aimStart = 0;

  /** Enter draw mode (called automatically by DrawScene on pointer-down). */
  toggle(): void {
    if (this.state !== 'idle') return;
    this.state = 'drawing';
    this.lastStrokeEnd = performance.now();
    this.emit('state', this.state);
  }

  cancel(): void {
    if (this.state === 'idle') return;
    this.pendingSpec = null;
    this.state = 'idle';
    this.emit('state', this.state);
  }

  /** Called when the player lifts their finger. Recognizes the stroke and fires. */
  strokeEnded(stroke: Stroke): void {
    this.lastStrokeEnd = performance.now();
    if (this.state !== 'drawing') return;

    const recognition = this.recognizer.recognize([stroke], this.unlocked);
    this.emit('recognition', recognition);

    const result = compileSpell(recognition);

    if (!result.ok) {
      this.state = 'idle';
      this.emit('state', this.state);
      this.emit('misfire', result.reason);
      return;
    }

    if (Math.random() > result.spec.stability) {
      result.spec.corrupted = true;
      result.spec.power *= BALANCE.spells.corruptedPowerMult;
      result.spec.direction = Math.random() * Math.PI * 2;
      this.state = 'idle';
      this.emit('state', this.state);
      this.emit('cast', result.spec);
      return;
    }

    if (result.spec.element === 'wind' || result.spec.element === 'water' || result.spec.element === 'lightning') {
      this.state = 'idle';
      this.emit('state', this.state);
      this.emit('cast', result.spec);
      return;
    }

    // Fire and earth enter directing phase for aim/placement.
    this.pendingSpec = result.spec;
    this.state = 'directing';
    this.aimStart = performance.now();
    this.emit('state', this.state);
  }

  setAimAngle(angle: number): void {
    if (this.state !== 'directing' || !this.pendingSpec || this.pendingSpec.corrupted) return;
    this.pendingSpec.direction = angle;
  }

  setAimTarget(dx: number, dy: number): void {
    if (this.state !== 'directing' || !this.pendingSpec) return;
    this.pendingSpec.targetX = dx;
    this.pendingSpec.targetY = dy;
  }

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
    // Safety valve: clear stuck drawing state after prolonged inactivity.
    if (this.state === 'drawing' && now - this.lastStrokeEnd > BALANCE.drawing.idleClearMs) {
      this.cancel();
    }
  }
}
