import { BALANCE } from '../config/balance';
import type { Glyph, MisfireReason, SpellSpec } from './types';
import type { RecognizeResult } from './recognizer';

export type CompileResult =
  | { ok: true; spec: SpellSpec }
  | { ok: false; reason: MisfireReason };

export function compileSpell(glyphs: Glyph[], sigil: RecognizeResult): CompileResult {
  const D = BALANCE.drawing;

  const seal = glyphs.find((g) => g.classified.kind === 'seal');
  if (!seal || seal.classified.kind !== 'seal') return { ok: false, reason: 'no-seal' };

  const hasSigilStrokes = glyphs.some((g) => g.classified.kind === 'sigil-stroke');
  if (!hasSigilStrokes) return { ok: false, reason: 'no-sigil' };
  if (!sigil.name || sigil.score < D.sigilMinScore) {
    return { ok: false, reason: 'unknown-sigil' };
  }

  const dots = glyphs.filter((g) => g.classified.kind === 'dot').length;
  const tail = glyphs
    .map((g) => g.classified)
    .find((c) => c.kind === 'tail');
  const unknowns = glyphs.filter((g) => g.classified.kind === 'unknown').length;

  const power = Math.min(1, Math.max(0.15, (sigil.score - D.sigilMinScore) / 0.6));
  // Seal quality lifts stability above a generous floor — a shaky circle means
  // a weaker, riskier spell, not constant misfires.
  const baseStability = D.stabilityFloor + (1 - D.stabilityFloor) * seal.classified.fit.quality;
  const stability = Math.min(
    1,
    Math.max(0, baseStability * (1 - D.unknownStrokeStabilityPenalty * unknowns)),
  );

  const spec: SpellSpec = {
    element: sigil.name,
    power,
    stability,
    count: Math.min(D.maxProjectiles, 1 + dots),
    rangeMult: tail && tail.kind === 'tail' ? 1 + tail.lengthRatio : 1,
    direction: tail && tail.kind === 'tail' ? tail.angle : undefined,
    aoeMult: 1,
    corrupted: false, // stability roll happens at cast time
  };
  return { ok: true, spec };
}
