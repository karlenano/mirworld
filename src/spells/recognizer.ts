import { normalize, resample } from './geometry';
import type { Element, Stroke, Vec2 } from './types';
import { BALANCE } from '../config/balance';

export interface PTemplate {
  name: Element;
  points: Vec2[]; // pre-resampled + normalized
}

export interface RecognizeResult {
  name: Element | null;
  score: number; // 0..1
  all: { name: Element; score: number }[]; // per-template, for the debug overlay
}

/**
 * $P point-cloud recognizer (Vatavu, Anthony, Wobbrock 2012).
 * Treats the gesture as an unordered point cloud, so multi-stroke sigils and
 * either drawing direction match the same template.
 */
export class PDollarRecognizer {
  constructor(private templates: PTemplate[]) {}

  recognize(strokes: Stroke[], unlocked: ReadonlySet<Element>): RecognizeResult {
    const raw: Vec2[] = strokes.flatMap((s) => s.points.map((p) => ({ x: p.x, y: p.y })));
    if (raw.length < 4) return { name: null, score: 0, all: [] };

    const n = BALANCE.drawing.recognizerN;
    const candidate = normalize(resample(raw, n));

    // Several templates may share an element (aspect-ratio variants) — keep
    // the best score per element.
    const byElement = new Map<Element, number>();
    for (const tpl of this.templates) {
      if (!unlocked.has(tpl.name)) continue;
      const d = greedyCloudMatch(candidate, tpl.points);
      const score = Math.max(0, (2 - d) / 2); // standard $P score mapping
      byElement.set(tpl.name, Math.max(byElement.get(tpl.name) ?? 0, score));
    }
    const all = [...byElement.entries()]
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score);
    const best = all[0] ?? null;
    return { name: best?.name ?? null, score: best?.score ?? 0, all };
  }
}

/** Minimum greedy-match distance over both directions and several start offsets. */
function greedyCloudMatch(a: Vec2[], b: Vec2[]): number {
  const n = a.length;
  const step = Math.max(1, Math.floor(Math.sqrt(n)));
  let min = Infinity;
  for (let start = 0; start < n; start += step) {
    min = Math.min(min, cloudDistance(a, b, start), cloudDistance(b, a, start));
  }
  return min;
}

function cloudDistance(a: Vec2[], b: Vec2[], start: number): number {
  const n = a.length;
  const matched = new Array<boolean>(n).fill(false);
  let sum = 0;
  let i = start;
  do {
    let bestDist = Infinity;
    let bestJ = -1;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y);
      if (d < bestDist) {
        bestDist = d;
        bestJ = j;
      }
    }
    matched[bestJ] = true;
    const weight = 1 - ((i - start + n) % n) / n;
    sum += weight * bestDist;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}
