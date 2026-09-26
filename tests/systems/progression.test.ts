import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { QUESTS, QUEST_ORDER } from '../../src/data/quests';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { LOOT_TABLES } from '../../src/data/lootTables';
import {
  BANDIT_CAMP_MOB_SPAWNS,
  BEACH_MOB_SPAWNS,
  TOWN_MOB_SPAWNS,
  type MobSpawnPoint,
} from '../../src/data/spawns';
import { addXp, type LevelState } from '../../src/systems/LevelingSystem';
import { addSkillXp, createInitialSkills, skillLevel } from '../../src/systems/SkillSystem';
import { failureChance } from '../../src/systems/CraftingSystem';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import { canEquip } from '../../src/systems/EquipSystem';
import { CLASSES } from '../../src/data/classes';
import { SHOP_STOCK } from '../../src/data/shop';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import { xpToReachLevel } from '../../src/data/xpTable';
import { ZONES } from '../../src/data/zones';
import type { EnemyId, ItemId, LootTableId, QuestId } from '../../src/types/ids';

// The pacing contract, simulated rather than played: a character who does the
// starter arc's quests and gears up should arrive at level 3 and stop there, and
// the upper band's chain should ride the climb from there rather than make it.
// The duel tests hold how hard a fight is; this holds how long the whole thing
// takes, which is the number the XP curve is actually tuned to.
//
// Everything below is expected-value arithmetic. Drop chances and burn rates
// are averages, not rolls, so the test is deterministic and a change to any
// tuning constant moves it.

const chanceOf = (tableId: LootTableId, itemId: ItemId): number =>
  LOOT_TABLES[tableId].entries.find((entry) => entry.itemId === itemId)?.chance ?? 0;

/** The objective of a quest that asks for a bag, narrowed to say so. */
function collectObjective(questId: QuestId): { itemId: ItemId; quantity: number } {
  const objective = QUESTS[questId].objective;
  if (objective.kind !== 'collect') {
    throw new Error(`${questId} no longer asks for items`);
  }
  return objective;
}

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
  /** Which quests get handed in along the way, since each one pays XP. */
  quests: QuestId[];
}

/**
 * The quests the starter arc actually finishes. The chief is deliberately not
 * one of them: it is the capstone behind a 3% key and a level 4 fight, which is
 * what the climb *past* the arc is for.
 */
const ARC_QUESTS: QuestId[] = ['rat-bones', 'quarry-road', 'crab-feast', 'bandit-trouble'];

/** The path the arc's quests and a full gear set actually push a player down. */
function intendedArc(): Arc {
  const bones = collectObjective('rat-bones');
  const feast = collectObjective('crab-feast');

  const ratKills = killsFor(bones.quantity, chanceOf('rat', bones.itemId));

  // Cooking crab is gated on a cooking level, and the only way to that level is
  // cooking fish — so the fish quest-adjacent grind is part of the arc.
  const crabRecipe = RECIPES['cooked-crab'];
  const skills = createInitialSkills();
  let cooking = skills;
  let fishCooked = 0;
  while (skillLevel(cooking, 'cooking') < crabRecipe.requiredLevel) {
    fishCooked += 1;
    const successRate = 1 - failureChance(skillLevel(cooking, 'cooking'));
    cooking = addSkillXp(
      cooking,
      'cooking',
      RECIPES['cooked-fish'].xpReward * successRate,
      1,
    ).skills;
  }

  // Crab meat has to survive the burn rate on the way to 20 cooked.
  const crabCooked = Math.ceil(feast.quantity / (1 - failureChance(crabRecipe.requiredLevel)));
  const crabKills = killsFor(crabCooked, chanceOf('crab', 'crab-meat'));

  // A gear set is three armour slots and a weapon; the bandit table is the only
  // source, and a class can only wear one armour type.
  const armourPerKill =
    chanceOf('bandit', 'brown-helmet') +
    chanceOf('bandit', 'brown-chestplate') +
    chanceOf('bandit', 'brown-legs');
  const banditKills = killsFor(3, armourPerKill);

  return { ratKills, crabKills, banditKills, fishCooked, crabCooked, quests: ARC_QUESTS };
}

/** Total character XP the arc pays out, quest rewards included. */
function arcXp(arc: Arc): number {
  return (
    arc.ratKills * averageKillXp(TOWN_MOB_SPAWNS, 'rat') +
    arc.crabKills * averageKillXp(BEACH_MOB_SPAWNS, 'crab') +
    arc.banditKills * averageKillXp(BANDIT_CAMP_MOB_SPAWNS, 'bandit') +
    arc.quests.reduce((xp, questId) => xp + QUESTS[questId].reward.xp, 0)
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

/** Every place a creature stands, at the level it stands there. */
const spawnsOf = (enemyId: EnemyId): MobSpawnPoint[] =>
  everySpawn().filter((spawn) => spawn.enemyId === enemyId);

/** The level a character is at with this much XP from level 1. */
const levelAt = (xp: number): number => levelAfter(xp).level;

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

  it("lands the player at level 3 once the arc's quests and a gear set are done", () => {
    const finished = levelAfter(arcXp(arc));
    expect(finished.level).toBe(3);
  });

  // The failure this guards against is a curve so slow that the quests are done
  // long before the level is: level 3 should arrive at the end of the arc, not
  // well after it. The bandit contract comes off with the bandit kills, since
  // nobody hands in twelve of them without making them.
  it('leaves the player most of the way to 3 on the quests alone', () => {
    const withoutGearGrind = arcXp({
      ...arc,
      banditKills: 0,
      quests: arc.quests.filter((questId) => questId !== 'bandit-trouble'),
    });
    expect(levelAfter(withoutGearGrind).level).toBeGreaterThanOrEqual(2);
  });

  /**
   * What keeps a kill objective from being a second grind bolted onto the
   * first: it asks for fewer bandits than a full armour set already costs, so
   * the contract is something the player finishes on the way rather than a
   * reason to stand in the camp twice as long.
   */
  it('asks for no kills the gear grind was not already making', () => {
    const objective = QUESTS['bandit-trouble'].objective;
    expect(objective.kind).toBe('kill');
    expect(objective.kind === 'kill' && objective.quantity).toBeLessThanOrEqual(arc.banditKills);
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
    expect(RECIPES['cooked-crab'].requiredLevel).toBeGreaterThan(1);
    expect(arc.fishCooked).toBeGreaterThan(0);
    // Reaching the gate should be a detour, not a second grind.
    expect(arc.fishCooked).toBeLessThan(30);
  });
});

/**
 * The ranger walks the arc the warrior does — it wears the same leather, and
 * the quests hand it the same pieces — and pays for it in a coin the warrior
 * never spends: an arrow a shot. What this holds is that the arc pays for its
 * own arrows with room to spare, so the bow is a different fight rather than a
 * tax on one.
 *
 * Priced at level 1 throughout, which is the most a kill ever costs: a shot
 * only gets harder as the arc levels the ranger, so the real bill is smaller.
 */
describe("the ranger's arc", () => {
  const arc = intendedArc();
  const QUIVERED = {
    helmet: null,
    chest: null,
    pants: null,
    weapon: 'shortbow',
    offhand: 'worn-quiver',
  } as const;
  const shot = computeEffectiveStats('ranger', QUIVERED, 1, {}, 'crude-arrows').attackPower;
  const shotsFor = (spawns: MobSpawnPoint[], enemyId: EnemyId): number =>
    spawns.reduce(
      (total, spawn) =>
        total + Math.ceil(scaleEnemyStats(ENEMIES[enemyId], spawn.level).maxHp / shot),
      0,
    ) / spawns.length;

  it('wears everything the arc hands out', () => {
    Object.values(QUESTS).forEach((quest) => {
      const piece = quest.reward.gear?.ranger;
      if (piece) expect(canEquip(piece, 'ranger').ok, `${quest.id} pays ${piece}`).toBe(true);
    });
  });

  it('pays for every arrow it shoots out of well under half the coin it earns', () => {
    const shotAtArc =
      arc.ratKills * shotsFor(TOWN_MOB_SPAWNS, 'rat') +
      arc.crabKills * shotsFor(BEACH_MOB_SPAWNS, 'crab') +
      arc.banditKills * shotsFor(BANDIT_CAMP_MOB_SPAWNS, 'bandit');

    const handful = LOOT_TABLES.bandit.entries.find((entry) => entry.itemId === 'crude-arrows');
    const perHandful = handful?.quantity ? (handful.quantity.min + handful.quantity.max) / 2 : 1;
    const pickedUp = arc.banditKills * (handful?.chance ?? 0) * perHandful;
    const started = CLASSES.ranger.startingArrows?.count ?? 0;
    const bought = Math.max(0, shotAtArc - started - pickedUp);

    const shelf = SHOP_STOCK.find((entry) => entry.itemId === 'crude-arrows');
    if (!shelf) throw new Error('the shop sells no arrows');
    const cost = bought * (shelf.price / (shelf.quantity ?? 1));

    const purse = LOOT_TABLES.bandit.currency;
    const coin =
      arc.quests.reduce((total, questId) => total + QUESTS[questId].reward.copper, 0) +
      arc.banditKills * (purse ? (purse.chance * (purse.min + purse.max)) / 2 : 0);

    expect(bought).toBeGreaterThan(0);
    expect(cost / coin).toBeLessThan(0.45);
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
    // Every quest the table has, not only the arc's: the ones past it are paid on
    // the climb too, and counting them is the direction that can only shorten it.
    const pastTheArc = QUEST_ORDER.filter((questId) => !arc.quests.includes(questId)).reduce(
      (xp, questId) => xp + QUESTS[questId].reward.xp,
      0,
    );
    const remaining = xpToCap() - arcXp(arc) - pastTheArc;
    const kills = Math.ceil(remaining / richestRepeatableKillXp());
    const arcKills = arc.ratKills + arc.crabKills + arc.banditKills;

    expect(kills).toBeGreaterThan(arcKills * 0.5);
    expect(kills).toBeLessThan(arcKills * 3);
  });
});

/**
 * The upper band's pacing, simulated rather than eyeballed, and the other half of
 * the starter arc's contract pointed the other way. Down there the quests carry
 * a character most of the way to level 3; up here they are a bonus on a climb
 * the fighting makes, which is what a band six levels deep with a curve
 * quadratic in the level has to be — a chain that carried it would be a chain
 * that paid a level a quest.
 */
describe('the upper band', () => {
  const arc = intendedArc();

  /** The chain Greyford gives, in order, each link held back by the one before. */
  const CHAIN: QuestId[] = ['goblin-road', 'lurker-hides', 'blackwater-raiders', 'the-barrow-king'];
  /** Everything in the table past the starter chain: the chain, and its errand. */
  const upper = QUEST_ORDER.filter(
    (questId) => !arc.quests.includes(questId) && questId !== 'the-cutthroat',
  );

  it('is a chain of one line, each link waiting on the one before', () => {
    expect(CHAIN.every((questId) => upper.includes(questId))).toBe(true);
    CHAIN.slice(1).forEach((questId, index) => {
      expect(QUESTS[questId].requires, questId).toEqual([CHAIN[index]]);
    });
  });

  /** The kills a quest's objective stands for: a kill, or the kills behind a bag. */
  function killsBehind(questId: QuestId): { enemyId: EnemyId; kills: number } | null {
    const objective = QUESTS[questId].objective;
    if (objective.kind === 'kill') return { enemyId: objective.enemyId, kills: objective.quantity };
    if (objective.kind !== 'collect') return null;
    const carrier = Object.values(ENEMIES).find(
      (enemy) => enemy.lootTableId && chanceOf(enemy.lootTableId, objective.itemId) > 0,
    );
    if (!carrier?.lootTableId) return null;
    return {
      enemyId: carrier.id,
      kills: killsFor(objective.quantity, chanceOf(carrier.lootTableId, objective.itemId)),
    };
  }

  /**
   * A kill objective rides a grind the player is already making rather than
   * starting a second one — the rule `bandit-trouble` is held to, a band up. What
   * they are already making is the climb through one level of the zone the
   * creature stands in, at the lowest level it stands there.
   */
  it('asks for no more kills than one level of its zone already takes', () => {
    for (const questId of upper) {
      const behind = killsBehind(questId);
      if (!behind || ENEMIES[behind.enemyId].boss) continue;
      const spawns = spawnsOf(behind.enemyId);
      const shallowest = Math.min(...spawns.map((spawn) => spawn.level));
      const perLevel = xpToReachLevel(shallowest + 1) / averageKillXp(spawns, behind.enemyId);
      expect(behind.kills, questId).toBeLessThanOrEqual(perLevel);
    }
  });

  /**
   * The level a character first meets a quest's work at: the shallowest level
   * its creature stands at, or for something dug out of a seam, the shallowest
   * level anything stands at in the zone the seam is in.
   */
  function metAt(questId: QuestId): number {
    const behind = killsBehind(questId);
    if (behind) return Math.min(...spawnsOf(behind.enemyId).map((spawn) => spawn.level));
    const objective = QUESTS[questId].objective;
    const zone = Object.values(ZONES).find((candidate) =>
      candidate.nodeSpawns.some(
        (node) =>
          objective.kind === 'collect' &&
          RESOURCE_NODES[node.nodeId].yieldItemId === objective.itemId,
      ),
    );
    if (!zone) throw new Error(`${questId} asks for something nothing yields`);
    return Math.min(...zone.mobSpawns.map((spawn) => spawn.level));
  }

  /**
   * Each one pays a share of the level it is met at that is worth the walk to
   * Greyford, and none pays so much of it that the quest is the level.
   */
  it('pays each quest a real share of a level and never most of one', () => {
    for (const questId of upper) {
      const level = metAt(questId);
      const share = QUESTS[questId].reward.xp / xpToReachLevel(level + 1);
      expect(share, questId).toBeGreaterThanOrEqual(0.1);
      expect(share, questId).toBeLessThan(1 / 3);
    }
  });

  it('pays well under the climb from the end of the arc to the cap', () => {
    const paid = upper.reduce((xp, questId) => xp + QUESTS[questId].reward.xp, 0);
    expect(paid / (xpToCap() - arcXp(arc))).toBeLessThan(0.25);
  });

  /**
   * And so the capstone is somewhere a character grows into rather than one the
   * chain walks them up to: the chain's own kills and rewards, on top of the
   * whole starter arc, stop two levels short of the one the king stands at. The
   * rest of the way is the grind the kill objectives were riding.
   */
  it('leaves the barrow king a level the chain alone never reaches', () => {
    const chainXp = CHAIN.reduce((xp, questId) => {
      const behind = killsBehind(questId);
      const kills = behind
        ? behind.kills * averageKillXp(spawnsOf(behind.enemyId), behind.enemyId)
        : 0;
      return xp + kills + QUESTS[questId].reward.xp;
    }, 0);
    const kingLevel = Math.max(...spawnsOf('barrow-king').map((spawn) => spawn.level));

    expect(levelAt(arcXp(arc) + chainXp)).toBeLessThan(kingLevel - 1);
  });
});
