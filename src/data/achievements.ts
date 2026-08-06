import { ENEMIES } from './enemies';
import type { AchievementId, EnemyId, SlayerTier, TitleId } from '../types/ids';

export interface AchievementDefinition {
  id: AchievementId;
  enemyId: EnemyId;
  threshold: SlayerTier;
  name: string;
  description: string;
  // Only the last tier pays a title; the first two are their own reward.
  titleId?: TitleId;
}

export interface TitleDefinition {
  id: TitleId;
  name: string;
}

// The rank word each tier earns. The top one matches the title it grants, so
// completing "Rat Slayer" is what makes you a Rat Slayer.
const TIER_RANKS: Record<SlayerTier, string> = {
  25: 'Culler',
  50: 'Hunter',
  100: 'Slayer',
};

export const SLAYER_TIERS: SlayerTier[] = [25, 50, 100];

// The tier that pays out a title. Kept as a named constant because two places
// need to agree on it: the row builder below and the test that guards the grid.
export const TITLE_TIER: SlayerTier = 100;

const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

function titleIdFor(enemyId: EnemyId): TitleId {
  return `${enemyId}-slayer`;
}

function achievementIdFor(enemyId: EnemyId, threshold: SlayerTier): AchievementId {
  return `${enemyId}-slayer-${threshold}`;
}

function buildAchievement(enemyId: EnemyId, threshold: SlayerTier): AchievementDefinition {
  const enemyName = ENEMIES[enemyId].name;
  return {
    id: achievementIdFor(enemyId, threshold),
    enemyId,
    threshold,
    name: `${enemyName} ${TIER_RANKS[threshold]}`,
    // Naive pluralization, which holds for every enemy name in the game today.
    // A name that doesn't take a bare "s" wants a plural on EnemyDefinition
    // rather than a special case here.
    description: `Defeat ${threshold} ${enemyName.toLowerCase()}s.`,
    titleId: threshold === TITLE_TIER ? titleIdFor(enemyId) : undefined,
  };
}

// Generated rather than hand-written: the whole point of the id being
// `${EnemyId}-slayer-${SlayerTier}` is that adding an enemy cannot ship a
// partial chain. A test still asserts the grid is complete, since that is the
// invariant callers depend on.
export const ACHIEVEMENT_ORDER: AchievementId[] = ENEMY_IDS.flatMap((enemyId) =>
  SLAYER_TIERS.map((threshold) => achievementIdFor(enemyId, threshold)),
);

export const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = Object.fromEntries(
  ENEMY_IDS.flatMap((enemyId) =>
    SLAYER_TIERS.map((threshold) => [
      achievementIdFor(enemyId, threshold),
      buildAchievement(enemyId, threshold),
    ]),
  ),
) as Record<AchievementId, AchievementDefinition>;

export const TITLES: Record<TitleId, TitleDefinition> = Object.fromEntries(
  ENEMY_IDS.map((enemyId) => [
    titleIdFor(enemyId),
    { id: titleIdFor(enemyId), name: `${ENEMIES[enemyId].name} Slayer` },
  ]),
) as Record<TitleId, TitleDefinition>;
