import { BALANCE } from '../config/balance';
import type { MisfireReason, SpellSpec } from './types';
import type { RecognizeResult } from './recognizer';

export type CompileResult =
  | { ok: true; spec: SpellSpec }
  | { ok: false; reason: MisfireReason };

/** Build a SpellSpec from a single recognised sigil stroke. No seal required. */
export function compileSpell(sigil: RecognizeResult): CompileResult {
  const D = BALANCE.drawing;
  if (!sigil.name || sigil.score < D.sigilMinScore) {
    return { ok: false, reason: 'unknown-sigil' };
  }
  const power = Math.min(1, Math.max(0.15, (sigil.score - D.sigilMinScore) / 0.6));
  const spec: SpellSpec = {
    element: sigil.name,
    power,
    stability: 1.0,
    count: 1,
    rangeMult: 1,
    direction: undefined,
    aoeMult: 1,
    corrupted: false,
  };
  return { ok: true, spec };
}
