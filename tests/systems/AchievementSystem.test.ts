import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_ORDER,
  SLAYER_TIERS,
  TITLES,
  TITLE_TIER,
} from '../../src/data/achievements';
import {
  achievementProgress,
  allAchievements,
  crossedAchievements,
  earnedTitles,
  formatDisplayName,
  hasEarnedTitle,
  isUnlocked,
  killCount,
  recordKill,
  titleName,
} from '../../src/systems/AchievementSystem';
import type { EnemyId } from '../../src/types/ids';

const ratCuller = ACHIEVEMENTS['rat-slayer-25'];
const enemyIds = Object.keys(ENEMIES) as EnemyId[];

describe('the achievement grid', () => {
  // The ids are a template literal over EnemyId x SlayerTier, so a new enemy
  // gets its chain by construction. This is the test that says so out loud —
  // the same way the humanoid/loot rule is enforced over the data tables.
  it('gives every enemy a row at every tier', () => {
    expect(ACHIEVEMENT_ORDER).toHaveLength(enemyIds.length * SLAYER_TIERS.length);
    for (const enemyId of enemyIds) {
      for (const threshold of SLAYER_TIERS) {
        const definition = ACHIEVEMENTS[`${enemyId}-slayer-${threshold}`];
        expect(definition).toBeDefined();
        expect(definition.enemyId).toBe(enemyId);
        expect(definition.threshold).toBe(threshold);
      }
    }
  });

  it('pays a title at the top tier and nowhere else', () => {
    for (const definition of allAchievements()) {
      if (definition.threshold === TITLE_TIER) {
        expect(definition.titleId).toBe(`${definition.enemyId}-slayer`);
      } else {
        expect(definition.titleId).toBeUndefined();
      }
    }
  });

  it('names every title after the creature it was earned on', () => {
    for (const enemyId of enemyIds) {
      expect(TITLES[`${enemyId}-slayer`].name).toBe(`${ENEMIES[enemyId].name} Slayer`);
    }
  });
});

describe('killCount', () => {
  it('treats a creature never killed as zero rather than undefined', () => {
    expect(killCount({}, 'rat')).toBe(0);
  });
});

describe('achievementProgress', () => {
  it('counts kills of the achievement’s own creature', () => {
    expect(achievementProgress(ratCuller, { rat: 4 })).toEqual({ have: 4, need: 25, met: false });
  });

  it('ignores kills of every other creature', () => {
    expect(achievementProgress(ratCuller, { crab: 90, bandit: 90 }).have).toBe(0);
  });

  it('clamps the surplus once it is met', () => {
    expect(achievementProgress(ratCuller, { rat: 400 })).toEqual({
      have: 25,
      need: 25,
      met: true,
    });
  });

  // Unlike a quest objective, kills only ever go up — nothing can sell or eat
  // them back down, which is why they are stored rather than derived.
  it('stays met once the threshold is passed', () => {
    expect(isUnlocked(ratCuller, { rat: 25 })).toBe(true);
    expect(isUnlocked(ratCuller, { rat: 26 })).toBe(true);
  });
});

describe('recordKill', () => {
  it('starts a creature at the count it was credited', () => {
    expect(recordKill({}, 'rat')).toEqual({ rat: 1 });
  });

  it('adds to a count that already exists without touching the others', () => {
    expect(recordKill({ rat: 3, crab: 9 }, 'rat', 2)).toEqual({ rat: 5, crab: 9 });
  });

  it('leaves the counts alone when credited nothing', () => {
    const kills = { rat: 3 };
    expect(recordKill(kills, 'rat', 0)).toBe(kills);
  });
});

describe('crossedAchievements', () => {
  it('reports the tier a single kill completed', () => {
    const before = { rat: 24 };
    const after = recordKill(before, 'rat');
    expect(crossedAchievements(before, after, 'rat').map((a) => a.id)).toEqual(['rat-slayer-25']);
  });

  it('reports nothing for a kill that completed no tier', () => {
    expect(crossedAchievements({ rat: 5 }, { rat: 6 }, 'rat')).toEqual([]);
  });

  // An offline camp pays out its whole session in one call, so a long enough
  // stint clears more than one tier at once. Returning only the highest — or
  // only one — would swallow achievements the player actually earned.
  it('reports every tier a single large payout cleared', () => {
    const before = { rat: 10 };
    const after = recordKill(before, 'rat', 95);
    expect(crossedAchievements(before, after, 'rat').map((a) => a.id)).toEqual([
      'rat-slayer-25',
      'rat-slayer-50',
      'rat-slayer-100',
    ]);
  });

  it('never reports a tier that was already passed', () => {
    expect(crossedAchievements({ rat: 30 }, { rat: 60 }, 'rat').map((a) => a.id)).toEqual([
      'rat-slayer-50',
    ]);
  });

  it('reports only the creature that was killed', () => {
    const crossed = crossedAchievements({ rat: 24, crab: 24 }, { rat: 25, crab: 24 }, 'rat');
    expect(crossed.every((a) => a.enemyId === 'rat')).toBe(true);
  });
});

describe('earnedTitles', () => {
  it('gives nothing until the top tier is reached', () => {
    expect(earnedTitles({ rat: 99 })).toEqual([]);
  });

  it('gives the creature’s title at the top tier', () => {
    expect(earnedTitles({ rat: 100 })).toEqual(['rat-slayer']);
  });

  it('accumulates a title per creature', () => {
    expect(earnedTitles({ rat: 100, bandit: 250 })).toEqual(['rat-slayer', 'bandit-slayer']);
  });

  it('refuses a title the kills do not back', () => {
    expect(hasEarnedTitle({ rat: 99 }, 'rat-slayer')).toBe(false);
    expect(hasEarnedTitle({ rat: 100 }, 'crab-slayer')).toBe(false);
  });
});

describe('formatDisplayName', () => {
  it('reads as the brief describes it', () => {
    expect(formatDisplayName('Adventurer', 'rat-slayer')).toBe('Adventurer, Rat Slayer');
  });

  it('is the bare name when no title is worn', () => {
    expect(formatDisplayName('Adventurer', null)).toBe('Adventurer');
  });

  it('names a title on its own for the picker', () => {
    expect(titleName('bandit-slayer')).toBe('Bandit Slayer');
  });
});
