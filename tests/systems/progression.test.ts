import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { QUESTS } from '../../src/data/quests';
import { COOKING_RECIPES } from '../../src/data/recipes';
import { LOOT_TABLES } from '../../src/data/lootTables';
import {
  BANDIT_CAMP_MOB_SPAWNS,
  BEACH_MOB_SPAWNS,
  TOWN_MOB_SPAWNS,
  type MobSpawnPoint,
} from '../../src/data/spawns';
import { addXp, type LevelState } from '../../src/systems/LevelingSystem';
import { addSkillXp, createInitialSkills, skillLevel } from '../../src/systems/SkillSystem';
import { burnChance } from '../../src/systems/CookingSystem';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import type { EnemyId } from '../../src/types/ids';

// The pacing contract for the starter arc, simulated rather than played: a
// character who does the two quests and gears up should arrive at level 3 and
// stop there. The duel tests hold how hard a fight is; this holds how long the
// whole thing takes, which is the number the XP curve is actually tuned to.
//
// Everything below is expected-value arithmetic. Drop chances and burn rates
// are averages, not rolls, so the test is deterministic and a change to any
// tuning constant moves it.

const chanceOf = (tableId: string, itemId: string): number =>
  LOOT_TABLES[tableId].entries.find((entry) => entry.itemId === itemId)?.chance ?? 0;

/** Average XP for a kill in a zone, weighted by how many spawns sit at each level. */
function averageKillXp(spawns: MobSpawnPoint[], enemyId: EnemyId): number {
  const total = spawns.reduce(
    (sum, spawn) => sum + scaleEnemyStats(ENEMIES[enemyId], spawn.level).xpReward,
    0,
  );
  return total / spawns.length;
}

/** Kills needed to collect `count` of an item dropping at `chance` per kill. */
const killsFor = (count: number, chance: number): number => Math.ceil(count / chance);

interface Arc {
  ratKills: number;
  crabKills: number;
  banditKills: number;
  fishCooked: number;
  crabCooked: number;
}

/** The path the two quests and a full gear set actually push a player down. */
function intendedArc(): Arc {
  const bones = QUESTS['rat-bones'].objective;
  const feast = QUESTS['crab-feast'].objective;

  const ratKills = killsFor(bones.quantity, chanceOf('rat', bones.itemId));

  // Cooking crab is gated on a cooking level, and the only way to that level is
  // cooking fish — so the fish quest-adjacent grind is part of the arc.
  const crabRecipe = COOKING_RECIPES['crab-meat'];
  const skills = createInitialSkills();
  let cooking = skills;
  let fishCooked = 0;
  while (skillLevel(cooking, 'cooking') < crabRecipe.requiredLevel) {
    fishCooked += 1;
    const successRate = 1 - burnChance(skillLevel(cooking, 'cooking'));
    cooking = addSkillXp(
      cooking,
      'cooking',
      COOKING_RECIPES['raw-fish'].xpReward * successRate,
      1,
    ).skills;
  }

  // Crab meat has to survive the burn rate on the way to 20 cooked.
  const crabCooked = Math.ceil(feast.quantity / (1 - burnChance(crabRecipe.requiredLevel)));
  const crabKills = killsFor(crabCooked, chanceOf('crab', 'crab-meat'));

  // A gear set is three armour slots and a weapon; the bandit table is the only
  // source, and a class can only wear one armour type.
  const armourPerKill =
    chanceOf('bandit', 'brown-helmet') +
    chanceOf('bandit', 'brown-chestplate') +
    chanceOf('bandit', 'brown-legs');
  const banditKills = killsFor(3, armourPerKill);

  return { ratKills, crabKills, banditKills, fishCooked, crabCooked };
}

/** Total character XP the arc pays out, quest rewards included. */
function arcXp(arc: Arc): number {
  return (
    arc.ratKills * averageKillXp(TOWN_MOB_SPAWNS, 'rat') +
    arc.crabKills * averageKillXp(BEACH_MOB_SPAWNS, 'crab') +
    arc.banditKills * averageKillXp(BANDIT_CAMP_MOB_SPAWNS, 'bandit') +
    QUESTS['rat-bones'].reward.xp +
    QUESTS['crab-feast'].reward.xp
  );
}

function levelAfter(xp: number): LevelState {
  return addXp({ level: 1, xp: 0 }, xp).state;
}

describe('the starter arc', () => {
  const arc = intendedArc();

  it('lands the player at level 3 once both quests and a gear set are done', () => {
    const finished = levelAfter(arcXp(arc));
    expect(finished.level).toBe(3);
  });

  // The failure this guards against is a curve so slow that the quests are done
  // long before the level is: level 3 should arrive at the end of the arc, not
  // well after it.
  it('leaves the player most of the way to 3 on the quests alone', () => {
    const withoutGearGrind = arcXp({ ...arc, banditKills: 0 });
    expect(levelAfter(withoutGearGrind).level).toBeGreaterThanOrEqual(2);
  });

  it('does not let a single zone carry the whole arc', () => {
    const perZone = [
      arc.ratKills * averageKillXp(TOWN_MOB_SPAWNS, 'rat'),
      arc.crabKills * averageKillXp(BEACH_MOB_SPAWNS, 'crab'),
      arc.banditKills * averageKillXp(BANDIT_CAMP_MOB_SPAWNS, 'bandit'),
    ];
    perZone.forEach((zoneXp) => {
      expect(zoneXp / arcXp(arc)).toBeLessThan(0.75);
    });
  });

  // ~45-60 minutes was the target. A kill is a fight plus the walk to the next
  // one plus waiting on a respawn; 30s is the conservative end of that, so this
  // brackets the arc at roughly 40-90 minutes of play.
  it('is a session long rather than an evening long', () => {
    const kills = arc.ratKills + arc.crabKills + arc.banditKills;
    expect(kills).toBeGreaterThan(60);
    expect(kills).toBeLessThan(180);
  });

  it('needs the cooking skill levelled before the crab quest is possible at all', () => {
    expect(COOKING_RECIPES['crab-meat'].requiredLevel).toBeGreaterThan(1);
    expect(arc.fishCooked).toBeGreaterThan(0);
    // Reaching the gate should be a detour, not a second grind.
    expect(arc.fishCooked).toBeLessThan(30);
  });
});
