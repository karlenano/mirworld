import { BALANCE } from '../config/balance';
import type { CircleFit, Vec2 } from './types';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Kåsa least-squares circle fit: solve x² + y² + a·x + b·y + c = 0 for (a, b, c)
 * via the 3×3 normal equations, then center = (-a/2, -b/2), r = sqrt(cx² + cy² - c).
 *
 * quality = q_radial × q_closure × q_coverage, each 0..1 — this scalar becomes
 * the spell's stability (misfire chance).
 */
export function fitCircle(points: Vec2[]): CircleFit {
  const n = points.length;
  if (n < 8) return { cx: 0, cy: 0, r: 0, quality: 0 };

  let Sx = 0;
  let Sy = 0;
  let Sxx = 0;
  let Syy = 0;
  let Sxy = 0;
  let Sz = 0;
  let Sxz = 0;
  let Syz = 0;
  for (const p of points) {
    const z = p.x * p.x + p.y * p.y;
    Sx += p.x;
    Sy += p.y;
    Sxx += p.x * p.x;
    Syy += p.y * p.y;
    Sxy += p.x * p.y;
    Sz += z;
    Sxz += p.x * z;
    Syz += p.y * z;
  }

  // Solve [Sxx Sxy Sx; Sxy Syy Sy; Sx Sy n] · [a b c]ᵀ = [-Sxz -Syz -Sz]ᵀ (Cramer's rule)
  const det =
    Sxx * (Syy * n - Sy * Sy) - Sxy * (Sxy * n - Sy * Sx) + Sx * (Sxy * Sy - Syy * Sx);
  if (Math.abs(det) < 1e-9) return { cx: 0, cy: 0, r: 0, quality: 0 };

  const r1 = -Sxz;
  const r2 = -Syz;
  const r3 = -Sz;
  const a =
    (r1 * (Syy * n - Sy * Sy) - Sxy * (r2 * n - Sy * r3) + Sx * (r2 * Sy - Syy * r3)) / det;
  const b =
    (Sxx * (r2 * n - Sy * r3) - r1 * (Sxy * n - Sy * Sx) + Sx * (Sxy * r3 - r2 * Sx)) / det;
  const c =
    (Sxx * (Syy * r3 - r2 * Sy) - Sxy * (Sxy * r3 - r2 * Sx) + r1 * (Sxy * Sy - Syy * Sx)) / det;

  const cx = -a / 2;
  const cy = -b / 2;
  const r2v = cx * cx + cy * cy - c;
  if (r2v <= 0) return { cx, cy, r: 0, quality: 0 };
  const r = Math.sqrt(r2v);

  const D = BALANCE.drawing;

  // q1: radial error — stddev of point distances from center, relative to r
  let sum = 0;
  let sumSq = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    sum += d;
    sumSq += d * d;
  }
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const q1 = clamp01(1 - Math.sqrt(variance) / r / D.sealRadialTolerance);

  // q2: closure — gap between first and last point, relative to r
  const gap = Math.hypot(points[0].x - points[n - 1].x, points[0].y - points[n - 1].y) / r;
  const q2 = clamp01(1 - gap / D.sealClosureTolerance);

  // q3: angular coverage — swept angle must approach a full turn.
  // coverage = 2π − largest gap between consecutive sorted point angles.
  const angles = points.map((p) => Math.atan2(p.y - cy, p.x - cx)).sort((u, v) => u - v);
  let maxGap = angles[0] + Math.PI * 2 - angles[n - 1];
  for (let i = 1; i < n; i++) maxGap = Math.max(maxGap, angles[i] - angles[i - 1]);
  const coverageDeg = ((Math.PI * 2 - maxGap) * 180) / Math.PI;
  const q3 = clamp01(
    (coverageDeg - D.sealCoverageMinDeg) / (D.sealCoverageFullDeg - D.sealCoverageMinDeg),
  );

  // Closure and coverage both measure "did you complete the loop" — taking the
  // better of the two forgives circles that stop short or overshoot the start.
  return { cx, cy, r, quality: q1 * Math.max(q2, q3) };
}
