import type { EnemyDefinition, EnemyLevelStats } from '../data/enemies';
import { THEME } from '../ui/theme';

export function scaleEnemyStats(definition: EnemyDefinition, level: number): EnemyLevelStats {
  const steps = Math.max(0, level - 1);
  const { base, perLevel } = definition;
  return {
    maxHp: base.maxHp + perLevel.maxHp * steps,
    attackPower: base.attackPower + perLevel.attackPower * steps,
    xpReward: base.xpReward + perLevel.xpReward * steps,
  };
}

/**
 * Name color for an enemy, by how far above the player it cons. Gray means it
 * is too far beneath the player to be worth fighting; red means it will
 * probably win.
 */
export function conColor(playerLevel: number, enemyLevel: number): string {
  const delta = enemyLevel - playerLevel;
  if (delta <= -3) return THEME.color.con.trivial;
  if (delta < 0) return THEME.color.con.low;
  if (delta === 0) return THEME.color.con.even;
  // Red starts at +2 rather than +3: two levels up already wins most fights,
  // and at +3 the starting zone could never show a red name at all.
  if (delta === 1) return THEME.color.con.high;
  return THEME.color.con.deadly;
}

export function enemyDisplayName(definition: EnemyDefinition, level: number): string {
  return `${definition.name} (Lv ${level})`;
}
