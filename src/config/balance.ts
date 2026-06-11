import type { Element } from '../spells/types';

/** Every tuning number in the game lives here. */
export const BALANCE = {
  drawing: {
    timeScale: 0.15, // game speed while drawing
    resampleN: 64, // points per stroke after resampling
    recognizerN: 32, // points fed to the $P recognizer
    noiseGatePx: 2, // min distance between captured points
    sealMinQuality: 0.2,
    sealMinRadiusPx: 50,
    // Forgiveness of the circle-fit quality terms (higher = more lenient):
    sealRadialTolerance: 0.4, // stddev of radius up to 40% of r still scores
    sealClosureTolerance: 1.2, // start/end gap up to 1.2 × r still scores
    sealCoverageMinDeg: 180, // sweep this much of the circle to score at all
    sealCoverageFullDeg: 290, // full credit at this sweep (no need to overlap)
    stabilityFloor: 0.55, // even the shakiest accepted seal casts >half the time
    sigilMinScore: 0.25,
    resolveAfterIdleMs: 1200, // commit after this long with no new stroke
    hardCapMs: 12000, // max real-time in draw mode
    emptyCancelMs: 4000, // cancel if nothing drawn
    cancelLongPressMs: 400,
    dotMaxLengthPx: 20,
    dotMaxBboxPx: 16,
    tailMinStraightness: 0.75,
    tailStartMaxR: 1.25, // tail must start within this × seal radius
    tailEndMinR: 1.35, // ...and end beyond this × seal radius
    maxProjectiles: 5,
    extraDotPowerMult: 0.85, // per-projectile power falloff per extra dot
    unknownStrokeStabilityPenalty: 0.1,
    interruptDamageFraction: 0.15, // damage > this × maxHP cancels a cast
  },

  spells: {
    baseDamage: { fire: 10, water: 6, earth: 16, wind: 8 } as Record<Element, number>,
    projectileSpeed: { fire: 520, water: 420, earth: 260, wind: 600 } as Record<Element, number>,
    projectileRange: { fire: 320, water: 380, earth: 240, wind: 420 } as Record<Element, number>,
    fireBurn: {
      dps: 8,           // damage per second while burning
      durationMs: 3000,
      tickMs: 500,      // damage tick interval
    },
    waterPush: {
      knockback: 700,   // pixels/s impulse
      stunMs: 250,      // brief stun so enemies don't instantly re-approach
      radius: 120,      // AoE push radius around impact point
    },
    earthBlock: {
      radius: 36,       // collision circle of the rock
      lifetimeMs: 6000,
      placeDist: 180,   // how far in front of player to place (no tail)
    },
    windBuff: {
      baseMult: 1.35, // speed multiplier floor for a barely-recognized spiral
      powerMult: 0.45, // + this × power — a clean spiral approaches 1.8×
      baseDurationMs: 4000,
      perDotDurationMs: 1500, // each dot extends the gust
      corruptedSlowMult: 0.6, // backfire: the wind turns against you
      corruptedSlowMs: 2000,
    },
    earthRadiusMult: 1.6, // earth projectiles are big
    fanSpreadDeg: 12, // per extra projectile
    corruptedPowerMult: 0.5,
    corruptedSelfDamage: { fire: 5, water: 0, earth: 3, wind: 0 } as Record<Element, number>,
    castCooldownMs: 250,
  },

  player: {
    maxHp: 100,
    speed: 180,
    iframesMs: 800,
  },

  combat: {
    enemyCap: 40,
    projectileCap: 60,
    knockback: 220,
    enemyKnockbackMs: 120,
  },

  spawner: {
    // M2 free-fight trickle spawner; replaced by WaveSpawner in M3
    intervalMs: 2200,
    perTick: { min: 1, max: 3 },
    batChance: 0.35,
  },
} as const;
