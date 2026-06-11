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
  for (let i = 0; i <= segments; i++) {
    pts.push({ x: (i / segments) * xStretch, y: i % 2 === 0 ? 1 : 0 });
  }
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

/** Closed equilateral triangle. */
function triangle(): Vec2[] {
  return [
    { x: 0.5, y: 0 },
    { x: 1, y: 0.87 },
    { x: 0, y: 0.87 },
    { x: 0.5, y: 0 },
  ];
}

/** Archimedean spiral, r = k·θ. */
function spiral(turns: number): Vec2[] {
  const pts: Vec2[] = [];
  const n = 64;
  const maxTheta = Math.PI * 2 * turns;
  for (let i = 0; i <= n; i++) {
    const theta = (i / n) * maxTheta;
    const r = theta / maxTheta;
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  }
  return pts;
}

export const SIGIL_TEMPLATES: PTemplate[] = [
  tpl('fire', zigzag(4, 1)),
  tpl('fire', zigzag(4, 1.6)),
  tpl('water', sineWave(2.5, 1.8)),
  tpl('water', sineWave(2.5, 2.8)),
  tpl('earth', triangle()),
  tpl('wind', spiral(2.25)),
];

/** Reference shapes for UI (sigil unlock moment, tutorials). */
export const SIGIL_DISPLAY: Record<Element, Vec2[]> = {
  fire: zigzag(4),
  water: sineWave(2.5),
  earth: triangle(),
  wind: spiral(2.25),
};
