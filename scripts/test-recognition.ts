/**
 * Headless sanity test for the spell-recognition math: feeds synthetic
 * hand-drawn-ish strokes (with jitter) through the circle fit, classifier,
 * and $P recognizer. Run with: npx tsx scripts/test-recognition.ts
 */
import { fitCircle } from '../src/spells/circle-fit';
import { classifyStroke } from '../src/spells/classifier';
import { bbox, pathLength, resample } from '../src/spells/geometry';
import { PDollarRecognizer } from '../src/spells/recognizer';
import { SIGIL_TEMPLATES } from '../src/spells/templates';
import type { Element, RawPoint, Stroke, Vec2 } from '../src/spells/types';

let nextId = 1;
function stroke(points: Vec2[]): Stroke {
  const pts: RawPoint[] = points.map((p, i) => ({ ...p, t: i * 8 }));
  return { id: nextId++, points: pts, bbox: bbox(pts), length: pathLength(pts) };
}

function jitter(points: Vec2[], amount: number): Vec2[] {
  return points.map((p) => ({
    x: p.x + (Math.random() - 0.5) * amount,
    y: p.y + (Math.random() - 0.5) * amount,
  }));
}

function circle(cx: number, cy: number, r: number, coverage = 1, n = 80): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= n * coverage; i++) {
    const theta = (i / n) * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }
  return pts;
}

// Hand-drawn-ish sigils, sized to fit inside a seal at (640, 360) r=140
function drawnCaret(): Vec2[] {
  return [
    { x: 590, y: 410 },
    { x: 640, y: 310 },
    { x: 690, y: 410 },
  ];
}
function drawnWave(): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    pts.push({ x: 540 + t * 200, y: 360 + 70 * Math.sin(Math.PI * 2 * 1 * t) });
  }
  return pts;
}
function drawnL(): Vec2[] {
  return [
    { x: 590, y: 310 },
    { x: 590, y: 410 },
    { x: 690, y: 410 },
  ];
}
function drawnCircle(): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= 40; i++) {
    const theta = (i / 40) * Math.PI * 2;
    pts.push({ x: 640 + 60 * Math.cos(theta), y: 360 + 60 * Math.sin(theta) });
  }
  return pts;
}
function drawnZ(): Vec2[] {
  return [
    { x: 590, y: 310 },
    { x: 690, y: 310 },
    { x: 590, y: 410 },
    { x: 690, y: 410 },
  ];
}

let failures = 0;
function check(label: string, ok: boolean, detail: string): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${detail})`);
}

// --- circle fit ---
const good = fitCircle(resample(jitter(circle(640, 360, 140), 2), 64));
check('clean circle → high quality', good.quality > 0.7, `q=${good.quality.toFixed(2)} r=${good.r.toFixed(0)}`);

const sloppy = fitCircle(resample(jitter(circle(640, 360, 140, 0.78), 10), 64));
check('sloppy open circle → lower quality', sloppy.quality < good.quality, `q=${sloppy.quality.toFixed(2)}`);

const line = fitCircle(resample(jitter(drawnCaret(), 3), 64));
check('caret is not a seal', line.quality < 0.35, `q=${line.quality.toFixed(2)}`);

// --- classifier ---
const seal = classifyStroke(stroke(jitter(circle(640, 360, 140), 5)), null, false);
check('first circle classifies as seal', seal.kind === 'seal', seal.kind);
const sealFit = seal.kind === 'seal' ? seal.fit : null!;

const dot = classifyStroke(stroke([{ x: 660, y: 380 }, { x: 662, y: 381 }, { x: 661, y: 383 }]), sealFit, true);
check('tap inside seal → dot', dot.kind === 'dot', dot.kind);

const tailPts: Vec2[] = [];
for (let i = 0; i <= 20; i++) tailPts.push({ x: 640 + 130 + i * 5, y: 360 + i * 1.5 });
const tail = classifyStroke(stroke(jitter(tailPts, 2)), sealFit, true);
check('straight stroke leaving seal → tail', tail.kind === 'tail', tail.kind);

const sigilStroke = classifyStroke(stroke(jitter(drawnCaret(), 3)), sealFit, false);
check('sigil shape inside seal → sigil-stroke', sigilStroke.kind === 'sigil-stroke', sigilStroke.kind);

// --- $P recognizer: 20 jittered attempts per sigil ---
const recognizer = new PDollarRecognizer(SIGIL_TEMPLATES);
const unlockedAll = new Set<Element>(['fire', 'water', 'earth', 'wind', 'lightning']);
const cases: [Element, () => Vec2[]][] = [
  ['fire', drawnCaret],
  ['water', drawnWave],
  ['earth', drawnL],
  ['wind', drawnCircle],
  ['lightning', drawnZ],
];
for (const [expected, gen] of cases) {
  let hits = 0;
  let scoreSum = 0;
  for (let i = 0; i < 20; i++) {
    const r = recognizer.recognize([stroke(jitter(gen(), 5))], unlockedAll);
    if (r.name === expected && r.score >= 0.25) hits++;
    scoreSum += r.score;
  }
  check(
    `${expected} sigil recognized (jitter ±5px)`,
    hits >= 16,
    `${hits}/20 hits, avg score ${(scoreSum / 20).toFixed(2)}`,
  );
}

console.log(failures === 0 ? '\nAll recognition checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
