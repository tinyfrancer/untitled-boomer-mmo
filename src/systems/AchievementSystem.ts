import {
  ACHIEVEMENTS,
  ACHIEVEMENT_ORDER,
  TITLES,
  type AchievementDefinition,
} from '../data/achievements';
import type { EnemyId, TitleId } from '../types/ids';

/**
 * How many of each creature this character has put down. Unlike a quest
 * objective there is no bag to count this off — a corpse leaves nothing behind
 * — so this is the one counter in the game that has to be stored and kept in
 * step. Everything derived from it (which achievements are unlocked, which
 * titles are earned) is computed on read, so there is only ever one number to
 * get wrong.
 */
export type KillCounts = Partial<Record<EnemyId, number>>;

export interface AchievementProgress {
  have: number;
  need: number;
  met: boolean;
}

export function killCount(kills: KillCounts, enemyId: EnemyId): number {
  return kills[enemyId] ?? 0;
}

export function achievementProgress(
  definition: AchievementDefinition,
  kills: KillCounts,
): AchievementProgress {
  const need = definition.threshold;
  const have = Math.min(killCount(kills, definition.enemyId), need);
  return { have, need, met: have >= need };
}

export function isUnlocked(definition: AchievementDefinition, kills: KillCounts): boolean {
  return killCount(kills, definition.enemyId) >= definition.threshold;
}

export function allAchievements(): AchievementDefinition[] {
  return ACHIEVEMENT_ORDER.map((id) => ACHIEVEMENTS[id]);
}

export function unlockedAchievements(kills: KillCounts): AchievementDefinition[] {
  return allAchievements().filter((definition) => isUnlocked(definition, kills));
}

/** Titles the character has the right to wear, in achievement order. */
export function earnedTitles(kills: KillCounts): TitleId[] {
  return unlockedAchievements(kills)
    .map((definition) => definition.titleId)
    .filter((titleId): titleId is TitleId => titleId !== undefined);
}

export function hasEarnedTitle(kills: KillCounts, titleId: TitleId): boolean {
  return earnedTitles(kills).includes(titleId);
}

/** Pure reducer, in the shape the quest log's mutators use. */
export function recordKill(kills: KillCounts, enemyId: EnemyId, count = 1): KillCounts {
  if (count <= 0) {
    return kills;
  }
  return { ...kills, [enemyId]: killCount(kills, enemyId) + count };
}

/**
 * Which achievements the jump from `before` to `after` crossed. Returns a list
 * rather than one result because an offline camp pays out its whole session at
 * once and can clear two tiers in a single call.
 */
export function crossedAchievements(
  before: KillCounts,
  after: KillCounts,
  enemyId: EnemyId,
): AchievementDefinition[] {
  const had = killCount(before, enemyId);
  const has = killCount(after, enemyId);
  return allAchievements().filter(
    (definition) =>
      definition.enemyId === enemyId &&
      definition.threshold > had &&
      definition.threshold <= has,
  );
}

export function titleName(titleId: TitleId): string {
  return TITLES[titleId].name;
}

/** The player's name as the HUD shows it, e.g. "Adventurer, Rat Slayer". */
export function formatDisplayName(name: string, titleId: TitleId | null): string {
  return titleId ? `${name}, ${titleName(titleId)}` : name;
}
