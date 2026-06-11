import { normalize, resample } from './geometry';
import type { Element, Vec2 } from './types';
import { BALANCE } from '../config/balance';
import type { PTemplate } from './recognizer';

/**
 * Sigil templates are generated from parametric curves, not hand-recorded
 * drawings — tweakable as data, and consistent across resolutions.
 */

function tpl(name: Element, raw: Vec2[]): PTemplate {
  return { name, points: normalize(resample(raw, BALANCE.drawing.recognizerN)) };
}

/**
 * Sharp triangle wave (2 oscillations). xStretch variants cover the range of
 * aspect ratios players naturally draw — $P matches the closest one.
 */
function zigzag(segments: number, xStretch = 1): Vec2[] {
  const pts: Vec2[] = [];
  const pointsPerSegment = 8;
  for (let i = 0; i < segments; i++) {
    const x1 = (i / segments) * xStretch;
    const y1 = i % 2 === 0 ? 1 : 0;
    const x2 = ((i + 1) / segments) * xStretch;
    const y2 = (i + 1) % 2 === 0 ? 1 : 0;
    for (let j = 0; j < pointsPerSegment; j++) {
      const t = j / pointsPerSegment;
      pts.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) });
    }
  }
  pts.push({ x: xStretch, y: segments % 2 === 0 ? 1 : 0 });
  return pts;
}

/**
 * Smooth sine wave. More periods than the zigzag has oscillations — the
 * point-density pattern, not the aspect ratio, is what separates the two.
 */
function sineWave(periods: number, xStretch = 1): Vec2[] {
  const pts: Vec2[] = [];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: t * xStretch, y: 0.35 * Math.sin(Math.PI * 2 * periods * t) });
  }
  return pts;
}

/** L shape. */
function lShape(): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= 10; i++) pts.push({ x: 0, y: i / 10 });
  for (let i = 1; i <= 10; i++) pts.push({ x: i / 10, y: 1 });
  return pts;
}

/** 3-segment Z shape. */
function zShape(xStretch = 1): Vec2[] {
  return [
    { x: 0, y: 0 },
    { x: 1 * xStretch, y: 0 },
    { x: 0, y: 1 },
    { x: 1 * xStretch, y: 1 },
  ];
}

/** Unit circle. */
function circle(): Vec2[] {
  const pts: Vec2[] = [];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t) });
  }
  return pts;
}

export const SIGIL_TEMPLATES: PTemplate[] = [
  tpl('fire', zigzag(2, 1)),
  tpl('fire', zigzag(2, 1.4)),
  tpl('water', sineWave(1, 1)),
  tpl('water', sineWave(1, 1.8)),
  tpl('earth', lShape()),
  tpl('wind', circle()),
  tpl('lightning', zShape(1)),
  tpl('lightning', zShape(1.4)),
];

/** Reference shapes for UI (sigil unlock moment, tutorials). */
export const SIGIL_DISPLAY: Record<Element, Vec2[]> = {
  fire: zigzag(2),
  water: sineWave(1),
  earth: lShape(),
  wind: circle(),
  lightning: zShape(1),
};
