export interface Vec2 {
  x: number;
  y: number;
}

/** t is real time (performance.now()), never scaled game time. */
export interface RawPoint extends Vec2 {
  t: number;
}

export interface Stroke {
  id: number;
  points: RawPoint[];
  bbox: { x: number; y: number; width: number; height: number };
  length: number; // polyline arc length
}

export type Element = 'fire' | 'water' | 'earth' | 'wind';

export interface CircleFit {
  cx: number;
  cy: number;
  r: number;
  quality: number; // 0..1
}

export type GlyphKind =
  | { kind: 'seal'; fit: CircleFit }
  | { kind: 'sigil-stroke' } // accumulated; recognized together at resolve
  | { kind: 'dot' }
  | { kind: 'tail'; angle: number; lengthRatio: number }
  | { kind: 'unknown' };

export interface Glyph {
  stroke: Stroke;
  classified: GlyphKind;
}

export interface SpellSpec {
  element: Element;
  power: number; // 0..1 from sigil score
  stability: number; // 0..1 from seal quality
  count: number; // projectile count
  rangeMult: number;
  direction?: number; // radians; undefined = aim at nearest enemy
  aoeMult: number; // reserved; 1 in the vertical slice
  corrupted: boolean; // stability roll failed — backfire
}

export type MisfireReason = 'no-seal' | 'no-sigil' | 'unknown-sigil';

export type CastState = 'idle' | 'drawing' | 'resolving';
