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
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import { xpToReachLevel } from '../../src/data/xpTable';
import { ZONES } from '../../src/data/zones';
import type { EnemyId, ItemId, LootTableId } from '../../src/types/ids';

// The pacing contract for the starter arc, simulated rather than played: a
// character who does the two quests and gears up should arrive at level 3 and
// stop there. The duel tests hold how hard a fight is; this holds how long the
// whole thing takes, which is the number the XP curve is actually tuned to.
//
// Everything below is expected-value arithmetic. Drop chances and burn rates
// are averages, not rolls, so the test is deterministic and a change to any
// tuning constant moves it.

const chanceOf = (tableId: LootTableId, itemId: ItemId): number =>
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

/** Total character XP from level 1 to the cap — the whole game, in XP. */
function xpToCap(): number {
  let total = 0;
  for (let level = 2; level <= MAX_CHARACTER_LEVEL; level += 1) {
    total += xpToReachLevel(level);
  }
  return total;
}

const everySpawn = () => Object.values(ZONES).flatMap((zone) => zone.mobSpawns);

/**
 * The best kill anyone can actually grind. A boss is one key-gated fight at the
 * back of a locked zone, so counting a climb in chiefs would flatter it — the
 * same reason the offline camp leaves them off the list it picks a quarry from.
 */
function richestRepeatableKillXp(): number {
  return everySpawn()
    .filter((spawn) => ENEMIES[spawn.enemyId].boss !== true)
    .reduce(
      (best, spawn) =>
        Math.max(best, scaleEnemyStats(ENEMIES[spawn.enemyId], spawn.level).xpReward),
      0,
    );
}

/** The highest level the world actually puts in front of anyone. */
const highestSpawnLevel = (): number =>
  everySpawn().reduce((highest, spawn) => Math.max(highest, spawn.level), 0);

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

// The cap is a claim about the content rather than about the curve: it says the
// game has something for every level it offers. What follows is what makes that
// claim checkable, and every line of it failed at the level 10 cap this
// replaced — 30,720 XP and six levels past the hardest fight in the world.
describe('the level cap', () => {
  const arc = intendedArc();

  it('reaches the top of what the world actually spawns, and stops just past it', () => {
    expect(MAX_CHARACTER_LEVEL).toBeGreaterThanOrEqual(highestSpawnLevel());
    expect(MAX_CHARACTER_LEVEL - highestSpawnLevel()).toBeLessThanOrEqual(1);
  });

  it('is past the end of the starter arc rather than reached by it', () => {
    expect(levelAfter(arcXp(arc)).level).toBeLessThan(MAX_CHARACTER_LEVEL);
  });

  /**
   * Max level should be an achievement, not an asymptote. The climb from where
   * the two quests leave off is measured in the best thing there is to kill and
   * held against the arc that got you there: more than the arc, so the cap is
   * earned past the quests rather than fallen into, and a small multiple of it,
   * so it is another session or two rather than another game.
   *
   * At the old cap it was ~950 bandits against an arc of 71 — thirteen times
   * everything the player had done so far, for six levels with nothing in them.
   */
  it('is a session or two past the quests rather than an evening a level', () => {
    const remaining = xpToCap() - arcXp(arc);
    const kills = Math.ceil(remaining / richestRepeatableKillXp());
    const arcKills = arc.ratKills + arc.crabKills + arc.banditKills;

    expect(kills).toBeGreaterThan(arcKills * 0.5);
    expect(kills).toBeLessThan(arcKills * 3);
  });
});
