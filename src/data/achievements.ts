import { ENEMIES } from './enemies';
import { FACTION_RANKS, FACTION_TITLE_ORDER } from './factions';
import type { AchievementId, EnemyId, SlayerRank, SlayerTier, TitleId } from '../types/ids';

export interface AchievementDefinition {
  id: AchievementId;
  enemyId: EnemyId;
  threshold: SlayerTier;
  name: string;
  description: string;
  // Every rank pays the title it is named for, so a player can wear the rank
  // they like rather than only the last one reached.
  titleId: TitleId;
}

export interface TitleDefinition {
  id: TitleId;
  name: string;
}

// The rank word each tier earns, which is also the title it grants: completing
// "Rat Culler" is what makes you a Rat Culler.
const TIER_RANKS: Record<SlayerTier, string> = {
  25: 'Culler',
  50: 'Hunter',
  100: 'Slayer',
};

const TIER_KEYS: Record<SlayerTier, SlayerRank> = {
  25: 'culler',
  50: 'hunter',
  100: 'slayer',
};

export const SLAYER_TIERS: SlayerTier[] = [25, 50, 100];

/** The rank word a tier earns, as an id: what a plaque on the house's wall is cast in. */
export function slayerRankOf(threshold: SlayerTier): SlayerRank {
  return TIER_KEYS[threshold];
}

const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

function titleIdFor(enemyId: EnemyId, threshold: SlayerTier): TitleId {
  return `${enemyId}-${TIER_KEYS[threshold]}`;
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
    titleId: titleIdFor(enemyId, threshold),
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

/**
 * Every title: a slayer rank's, and a faction rank's (D3), whose name is the
 * rank's own in that faction's words.
 */
export const TITLES: Record<TitleId, TitleDefinition> = Object.fromEntries([
  ...ENEMY_IDS.flatMap((enemyId) =>
    SLAYER_TIERS.map((threshold) => [
      titleIdFor(enemyId, threshold),
      {
        id: titleIdFor(enemyId, threshold),
        name: `${ENEMIES[enemyId].name} ${TIER_RANKS[threshold]}`,
      },
    ]),
  ),
  ...FACTION_TITLE_ORDER.map((titleId) => [
    titleId,
    { id: titleId, name: FACTION_RANKS[titleId].name },
  ]),
]) as Record<TitleId, TitleDefinition>;
