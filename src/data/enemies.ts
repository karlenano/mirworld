export type EnemyType = 'slime' | 'bat';

export interface EnemyDef {
  texture: string;
  hp: number;
  speed: number;
  touchDamage: number;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  slime: { texture: 'slime', hp: 3, speed: 45, touchDamage: 8 },
  bat: { texture: 'bat', hp: 1, speed: 115, touchDamage: 5 },
};
