import type { Vec2 } from './types';

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pathLength(points: Vec2[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += dist(points[i - 1], points[i]);
  return d;
}

export function centroid(points: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

export function bbox(points: Vec2[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Resample a polyline to n points equidistant along its arc length. */
export function resample(points: Vec2[], n: number): Vec2[] {
  if (points.length === 0) return [];
  if (points.length === 1) return new Array<Vec2>(n).fill({ ...points[0] });

  const interval = pathLength(points) / (n - 1);
  if (interval === 0) return new Array<Vec2>(n).fill({ ...points[0] });

  const out: Vec2[] = [{ x: points[0].x, y: points[0].y }];
  let acc = 0;
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (acc + d >= interval && d > 0) {
      const t = (interval - acc) / d;
      const q = {
        x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
        y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y),
      };
      out.push(q);
      pts.splice(i, 0, q); // q becomes the new previous point
      acc = 0;
    } else {
      acc += d;
    }
  }
  while (out.length < n) out.push({ ...out[out.length - 1] });
  return out.slice(0, n);
}

/**
 * Translate centroid to origin and scale uniformly so the longest bbox side is 1.
 * Uniform scaling preserves aspect ratio, which helps separate e.g. zigzag vs wave.
 */
export function normalize(points: Vec2[]): Vec2[] {
  const c = centroid(points);
  const b = bbox(points);
  const scale = Math.max(b.width, b.height) || 1;
  return points.map((p) => ({ x: (p.x - c.x) / scale, y: (p.y - c.y) / scale }));
}

/** directDistance / arcLength — 1 for a perfectly straight stroke. */
export function straightness(points: Vec2[]): number {
  const len = pathLength(points);
  if (len === 0) return 0;
  return dist(points[0], points[points.length - 1]) / len;
}
