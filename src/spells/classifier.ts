import { BALANCE } from '../config/balance';
import { fitCircle } from './circle-fit';
import { centroid, resample, straightness } from './geometry';
import type { CircleFit, GlyphKind, Stroke } from './types';

/**
 * Stroke disambiguation by draw order + geometry, per the fiction:
 * open the seal (circle), draw the sigil inside, embellish with modifiers.
 * Only sigil strokes ever reach the $P recognizer.
 */
export function classifyStroke(
  stroke: Stroke,
  seal: CircleFit | null,
  hasSigilStrokes: boolean,
): GlyphKind {
  const D = BALANCE.drawing;
  const pts = resample(
    stroke.points.map((p) => ({ x: p.x, y: p.y })),
    D.resampleN,
  );

  // 1. First stroke must open the seal.
  if (!seal) {
    const fit = fitCircle(pts);
    if (fit.quality > D.sealMinQuality && fit.r > D.sealMinRadiusPx) {
      return { kind: 'seal', fit };
    }
    return { kind: 'unknown' };
  }

  const sealDist = (x: number, y: number) => Math.hypot(x - seal.cx, y - seal.cy);
  const c = centroid(pts);
  const insideSeal = sealDist(c.x, c.y) < seal.r;

  // 2. Dot: a tap-sized mark inside the seal.
  const diag = Math.hypot(stroke.bbox.width, stroke.bbox.height);
  if (stroke.length < D.dotMaxLengthPx && diag < D.dotMaxBboxPx && insideSeal) {
    return { kind: 'dot' };
  }

  // 3. Tail: a straight stroke leaving the seal — sets range and aim.
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  if (
    sealDist(first.x, first.y) < seal.r * D.tailStartMaxR &&
    sealDist(last.x, last.y) > seal.r * D.tailEndMinR &&
    straightness(pts) > D.tailMinStraightness
  ) {
    return {
      kind: 'tail',
      angle: Math.atan2(last.y - seal.cy, last.x - seal.cx),
      lengthRatio: Math.min(1.5, stroke.length / seal.r),
    };
  }

  // 4. Sigil strokes accumulate inside the seal; recognized together at resolve.
  if (insideSeal) {
    return { kind: 'sigil-stroke' };
  }

  void hasSigilStrokes; // reserved for ring/AoE classification post-slice
  return { kind: 'unknown' };
}
