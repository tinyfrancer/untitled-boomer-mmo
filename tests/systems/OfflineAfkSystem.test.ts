import { describe, expect, it } from 'vitest';
import {
  OFFLINE_CAP_MS,
  OFFLINE_KILL_INTERVAL_MS,
  elapsedOfflineMs,
  formatAwayDuration,
  offlineXpCeiling,
  resolveOfflineAfk,
} from '../../src/systems/OfflineAfkSystem';
import { AFK_XP_MULTIPLIER, afkXpReward } from '../../src/systems/AfkSystem';
import { carryCapacity } from '../../src/systems/EncumbranceSystem';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import { gatherDurationMs } from '../../src/systems/GatherSystem';
import { createInitialSkills, skillXpToNextLevel } from '../../src/systems/SkillSystem';
import type { Gear, Inventory } from '../../src/systems/InventorySystem';
import { POTION_EFFECTS } from '../../src/data/potions';
import { ENEMIES } from '../../src/data/enemies';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { xpToReachLevel } from '../../src/data/xpTable';
import type { AfkSession } from '../../src/persistence/CharacterState';

const NOW = Date.parse('2026-07-24T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

function sessionStartedAgo(
  ms: number,
  zoneId: AfkSession['zoneId'] = 'town',
  station: AfkSession['station'] = null,
): AfkSession {
  return { startedAt: new Date(NOW - ms).toISOString(), zoneId, station, restedMs: 0 };
}

// A fighter by default: what is in the weapon slot is what decides whether a
// parked session fought or gathered, so a sword is what makes these the
// combat cases.
const SWORD_IN_HAND: Gear = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: 'rusty-sword',
  offhand: null,
};

function context(overrides: Partial<Parameters<typeof resolveOfflineAfk>[1]> = {}) {
  return {
    now: NOW,
    classId: 'warrior' as const,
    characterLevel: 1,
    inventory: {},
    capacity: carryCapacity(6),
    gear: SWORD_IN_HAND,
    skills: createInitialSkills(),
    quiver: null,
    // Everything drops, so loot is deterministic rather than flaky.
    rng: () => 0,
    ...overrides,
  };
}

describe('elapsedOfflineMs', () => {
  it('measures the gap since the camp was parked', () => {
    expect(elapsedOfflineMs(new Date(NOW - HOUR_MS).toISOString(), NOW)).toBe(HOUR_MS);
  });

  // A clock that moved backwards — a timezone change, a machine that resynced —
  // must pay nothing rather than a negative amount.
  it('pays nothing for a clock that went backwards', () => {
    expect(elapsedOfflineMs(new Date(NOW + HOUR_MS).toISOString(), NOW)).toBe(0);
  });

  it('stops counting at the cap', () => {
    expect(elapsedOfflineMs(new Date(NOW - OFFLINE_CAP_MS * 10).toISOString(), NOW)).toBe(
      OFFLINE_CAP_MS,
    );
  });

  it('treats an unparsable timestamp as no time at all', () => {
    expect(elapsedOfflineMs('not a date', NOW)).toBe(0);
  });
});

describe('resolveOfflineAfk', () => {
  it('pays nothing for a session shorter than one kill', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(1000), context());
    expect(report.kills).toBe(0);
    expect(report.xp).toBe(0);
    expect(report.drops).toEqual({});
  });

  it('pays xp and kills for a real session', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context());
    expect(report.kills).toBeGreaterThan(0);
    expect(report.xp).toBeGreaterThan(0);
  });

  // The rule from the brief, at its hardest point: time away must be worth
  // less than the same time camped awake, which is already worth less than
  // playing.
  it('pays strictly less than the same kills made awake and camping', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context());
    const rat = scaleEnemyStats(ENEMIES.rat, 1);
    const awakeCamping = afkXpReward(rat.xpReward, true) * report.kills;
    expect(report.xp).toBeLessThan(awakeCamping);
    // ...and less again than playing it actively.
    expect(report.xp).toBeLessThan(rat.xpReward * report.kills);
  });

  // The ceiling that keeps the whole feature honest. Without it, eight hours
  // at the bandit camp paid 20,520 xp — more than seven times the whole level
  // curve. It is a share of a level rather than a level because the cap moved:
  // against five levels a whole one is nearly half the game.
  it('is worth at most a share of a level, however long the session and however rich the zone', () => {
    for (const [level, zoneId] of [
      [1, 'town'],
      [1, 'bandit-camp'],
      [3, 'beach'],
      [3, 'bandit-camp'],
    ] as const) {
      const report = resolveOfflineAfk(
        sessionStartedAgo(OFFLINE_CAP_MS, zoneId),
        context({ characterLevel: level }),
      );
      expect(report.xp).toBeLessThanOrEqual(offlineXpCeiling(level));
      // And short of the level itself, which is what changed here.
      expect(report.xp).toBeLessThan(xpToReachLevel(level + 1));
    }
  });

  it('still pays a short session by the clock rather than by the cap', () => {
    const short = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context());
    const long = resolveOfflineAfk(sessionStartedAgo(OFFLINE_CAP_MS), context());
    expect(short.kills).toBeLessThan(long.kills);
  });

  it('caps a week away at the same yield as the cap itself', () => {
    const week = resolveOfflineAfk(sessionStartedAgo(HOUR_MS * 24 * 7), context());
    const capped = resolveOfflineAfk(sessionStartedAgo(OFFLINE_CAP_MS), context());
    expect(week.xp).toBe(capped.xp);
    expect(week.kills).toBe(capped.kills);
  });

  it('camps whatever in the zone is closest to the character, not the easiest', () => {
    const lowbie = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context({ characterLevel: 1 }));
    const veteran = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context({ characterLevel: 3 }));
    expect(veteran.xp).toBeGreaterThan(lowbie.xp);
  });

  // The whole session grinds one spawn, so the kill count belongs to a single
  // creature — which is what lets a camp count toward a slayer achievement.
  it('names the creature the session was camped on', () => {
    expect(resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context()).enemyId).toBe('rat');
    expect(resolveOfflineAfk(sessionStartedAgo(HOUR_MS, 'beach'), context()).enemyId).toBe('crab');
  });

  /**
   * A night parked in the hideout is a night of bandits, whatever level the
   * character is. The awake camp refuses to pick a boss for the same reason:
   * sixty offline kills would empty a table meant to be run for, and the drop
   * that made the trip worth making would arrive in a stack.
   */
  it('grinds the hideout bandits rather than the chief, at every level', () => {
    for (const characterLevel of [1, 3, 4, 6]) {
      const report = resolveOfflineAfk(
        sessionStartedAgo(OFFLINE_CAP_MS, 'bandit-hideout'),
        context({ characterLevel }),
      );
      expect(report.enemyId, `parked at level ${characterLevel}`).toBe('bandit');
      expect(Object.keys(report.drops)).not.toContain('cutthroats-bandana');
    }
  });

  it('names no creature when nothing died', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(1000), context());
    expect(report.kills).toBe(0);
    expect(report.enemyId).toBeNull();
  });

  it('takes loot into a pack with room for it', () => {
    // Two kills' worth: short enough that everything dropping still fits.
    const report = resolveOfflineAfk(sessionStartedAgo(130000), context());
    expect(Object.keys(report.drops).length).toBeGreaterThan(0);
    expect(report.missed).toEqual({});
  });

  // Which is the point of the limit: a long enough camp fills the pack and the
  // rest of the night's drops are left where they fell — named rather than
  // merely counted, since a report that says "your pack filled up" does not
  // tell you what it cost.
  it('names what a long session could not carry', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context());
    expect(Object.keys(report.missed).length).toBeGreaterThan(0);
    expect(Object.values(report.missed).every((quantity) => quantity > 0)).toBe(true);
  });

  it('takes no drops at all into a pack that was already full, and lists them all', () => {
    const capacity = carryCapacity(6);
    const report = resolveOfflineAfk(
      sessionStartedAgo(HOUR_MS),
      context({ inventory: { 'rat-bones': capacity }, capacity }),
    );
    expect(report.drops).toEqual({});
    expect(Object.keys(report.missed).length).toBeGreaterThan(0);
    // A full pack never stops the session: levelling is weightless and the
    // fights happened either way.
    expect(report.xp).toBeGreaterThan(0);
    expect(report.kills).toBeGreaterThan(0);
  });

  // Coin has no weight either, so it keeps coming in past a full pack. Only
  // the bandits carry any — the animals drop parts.
  it('keeps paying coin from a humanoid camp with the pack full', () => {
    const capacity = carryCapacity(6);
    const report = resolveOfflineAfk(
      sessionStartedAgo(HOUR_MS, 'bandit-camp'),
      context({ characterLevel: 7, inventory: { 'rat-bones': capacity }, capacity }),
    );
    expect(report.drops).toEqual({});
    expect(report.copper).toBeGreaterThan(0);
  });

  it('never pays more than half of what camping awake would, before rounding', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context());
    const rat = scaleEnemyStats(ENEMIES.rat, 1);
    expect(report.xp).toBeLessThanOrEqual(rat.xpReward * AFK_XP_MULTIPLIER * report.kills * 0.5);
  });
});

/**
 * Whether the ceiling ended a night, which the away report says in the words
 * the idle panel promised it in. The time running out, the bag running dry and
 * the arrows running out are each something else.
 */
describe('a night that reached its ceiling', () => {
  const AXE: Gear = { ...SWORD_IN_HAND, weapon: 'felling-axe' };

  it('is capped when a fight reached half a level, and not before', () => {
    expect(resolveOfflineAfk(sessionStartedAgo(OFFLINE_CAP_MS), context()).capped).toBe(true);
    expect(resolveOfflineAfk(sessionStartedAgo(HOUR_MS / 6), context()).capped).toBe(false);
  });

  it('is capped when work reached a level of its skill', () => {
    const night = resolveOfflineAfk(sessionStartedAgo(OFFLINE_CAP_MS), context({ gear: AXE }));
    expect(night.capped).toBe(true);
    const minute = resolveOfflineAfk(sessionStartedAgo(60_000), context({ gear: AXE }));
    expect(minute.capped).toBe(false);
  });

  it('is capped at the forge only when the level, not the ore, ran out', () => {
    const atTheForge = sessionStartedAgo(OFFLINE_CAP_MS, 'town', 'forge');
    const plenty = context({ gear: AXE, inventory: { 'tin-ore': 400 }, rng: () => 1 });
    expect(resolveOfflineAfk(atTheForge, plenty).capped).toBe(true);
    const few = context({ gear: AXE, inventory: { 'tin-ore': 3 }, rng: () => 1 });
    expect(resolveOfflineAfk(atTheForge, few).capped).toBe(false);
  });
});

describe('formatAwayDuration', () => {
  it('reads in minutes under an hour', () => {
    expect(formatAwayDuration(90 * 60 * 1000)).toBe('1h 30m');
    expect(formatAwayDuration(45 * 60 * 1000)).toBe('45m');
  });

  it('reads as no time at all for nothing', () => {
    expect(formatAwayDuration(0)).toBe('0m');
  });
});

/**
 * A parked session that was gathering rather than fighting. Which branch it
 * takes is read off the gear, the same question the awake camp asks every
 * frame, so nothing new had to be written into the save for this.
 */
describe('a parked gathering camp', () => {
  const AXE: Gear = {
    helmet: null,
    chest: null,
    pants: null,
    weapon: 'felling-axe',
    offhand: null,
  };
  const POLE: Gear = {
    helmet: null,
    chest: null,
    pants: null,
    weapon: 'fishing-pole',
    offhand: null,
  };
  const PICKAXE: Gear = {
    helmet: null,
    chest: null,
    pants: null,
    weapon: 'pickaxe',
    offhand: null,
  };
  const TREE = RESOURCE_NODES.tree;

  const gathering = (gear: Gear, overrides = {}) => context({ gear, ...overrides });

  it('pays the skill rather than the character, and hauls what it cut', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), gathering(AXE));

    expect(report.skill).toBe('woodcutting');
    expect(report.gathers).toBeGreaterThan(0);
    expect(report.skillXp).toBeGreaterThan(0);
    expect(report.drops.logs).toBe(report.gathers);
    // A session is one or the other, never both.
    expect(report.kills).toBe(0);
    expect(report.xp).toBe(0);
    expect(report.copper).toBe(0);
  });

  it('pays nothing for a session shorter than one gather', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(100), gathering(AXE));
    expect(report.gathers).toBe(0);
    expect(report.skillXp).toBe(0);
  });

  /**
   * The ceiling that actually matters, and the gathering half of the one level
   * a fighting session is held to. Nothing here models a tree's four charges,
   * the fifteen seconds it takes to regrow or the walk to the next one — the
   * cap is what makes leaving that out safe.
   */
  it('never earns more than a single skill level, however long the tab was shut', () => {
    const night = resolveOfflineAfk(sessionStartedAgo(OFFLINE_CAP_MS), gathering(AXE));
    const week = resolveOfflineAfk(sessionStartedAgo(OFFLINE_CAP_MS * 20), gathering(AXE));

    expect(week.skillXp).toBe(night.skillXp);
    expect(skillXpToNextLevel('woodcutting', 1)).toBeGreaterThan(night.skillXp);
  });

  it('is paid at the offline rate on top of the camp’s own penalty', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), gathering(AXE));
    const awake = report.gathers * TREE.xpReward;

    expect(report.skillXp).toBeLessThan(awake);
    expect(report.skillXp).toBe(Math.floor(awake * AFK_XP_MULTIPLIER * 0.5));
  });

  /**
   * A full pack does not stop an unattended session, it only stops it keeping
   * anything: the swing happened, and the skill is what the swing teaches. What
   * it cost is named rather than lost silently.
   */
  it('keeps working past a full pack, training the skill and naming the losses', () => {
    const roomy = resolveOfflineAfk(sessionStartedAgo(OFFLINE_CAP_MS), gathering(AXE));
    const full = resolveOfflineAfk(
      sessionStartedAgo(OFFLINE_CAP_MS),
      gathering(AXE, { inventory: { logs: 200 }, capacity: 12 }),
    );

    expect(full.gathers).toBe(roomy.gathers);
    expect(full.skillXp).toBe(roomy.skillXp);
    expect(full.drops).toEqual({});
    expect(full.missed).toEqual({ logs: full.gathers });
  });

  it('splits a haul at the point the pack actually ran out', () => {
    const report = resolveOfflineAfk(
      sessionStartedAgo(OFFLINE_CAP_MS),
      gathering(AXE, { capacity: 12 }),
    );

    const kept = report.drops.logs ?? 0;
    const lost = report.missed.logs ?? 0;
    expect(kept).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
    // Every gather is accounted for on one side or the other, and none twice.
    expect(kept + lost).toBe(report.gathers);
    expect(report.skillXp).toBe(
      Math.floor(report.gathers * TREE.xpReward * AFK_XP_MULTIPLIER * 0.5),
    );
  });

  it('pays nothing for a tool the parked zone has no work for', () => {
    // The bandit camp has neither trees nor water.
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS, 'bandit-camp'), gathering(AXE));
    expect(report).toMatchObject({ gathers: 0, skillXp: 0, kills: 0, skill: null });
  });

  /**
   * The beach has nothing but ocean spots, and those are gated behind fishing
   * 5 — so the level requirement has to hold with the tab shut exactly as it
   * does at the keyboard. Parking overnight is not a way past a gate.
   */
  it('honours the level a node requires, even offline', () => {
    const parked = sessionStartedAgo(HOUR_MS, 'beach');
    const novice = resolveOfflineAfk(parked, gathering(POLE));
    const veteran = resolveOfflineAfk(
      parked,
      gathering(POLE, { skills: { ...createInitialSkills(), fishing: { level: 5, xp: 0 } } }),
    );

    expect(novice).toMatchObject({ gathers: 0, skillXp: 0, skill: null });
    expect(veteran.skill).toBe('fishing');
    // Every fish is on one side of the ledger or the other.
    expect((veteran.drops['raw-fish'] ?? 0) + (veteran.missed['raw-fish'] ?? 0)).toBe(
      veteran.gathers,
    );
  });

  it('pays a town fisher for the pond, which needs no level at all', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), gathering(POLE));
    expect(report.skill).toBe('fishing');
    expect(report.drops['raw-fish']).toBeGreaterThan(0);
  });

  /**
   * The quarry is the first zone holding a gated node and an ungated one for the
   * same skill, which is the case `campNode` was written for and had never once
   * been asked. The beach only ever narrowed to nothing: its spots are all
   * ocean, so a novice fisher parked there is the "no work here" answer wearing
   * a level requirement. Here a novice has somewhere to go and still must not be
   * paid for the better rock.
   */
  it('works the best vein the miner has actually earned, not the best one there', () => {
    const parked = sessionStartedAgo(HOUR_MS, 'quarry');
    const novice = resolveOfflineAfk(parked, gathering(PICKAXE));
    const veteran = resolveOfflineAfk(
      parked,
      gathering(PICKAXE, { skills: { ...createInitialSkills(), mining: { level: 5, xp: 0 } } }),
    );

    expect(novice.skill).toBe('mining');
    expect(novice.gathers).toBeGreaterThan(0);
    expect((novice.drops['tin-ore'] ?? 0) + (novice.missed['tin-ore'] ?? 0)).toBe(novice.gathers);
    expect(novice.drops['iron-ore']).toBeUndefined();
    expect(novice.missed['iron-ore']).toBeUndefined();

    expect((veteran.drops['iron-ore'] ?? 0) + (veteran.missed['iron-ore'] ?? 0)).toBe(
      veteran.gathers,
    );
  });

  it('takes a gather as long as the skill says it does', () => {
    const oneGather = gatherDurationMs(TREE, 1);
    const report = resolveOfflineAfk(sessionStartedAgo(oneGather * 3 + 10), gathering(AXE));
    expect(report.gathers).toBe(3);
  });
});

/**
 * The third branch, and the only one that spends anything.
 *
 * Two rules carry it. A session parked at a station is paid for that station
 * ahead of whatever is in its hands, which is the awake camp's own precedence
 * read back off the save — and a campfire is not a station this can pay for at
 * all, because ninety seconds of `FIRE_BURN_MS` did not survive the tab closing.
 */
describe('a parked making camp', () => {
  // An axe rather than a pickaxe, and the reason is the map: the forge stands
  // in town and the ore veins are a zone north, so a fallback to mining from
  // this bench would be a camp with nothing to mine. Town has trees.
  const AXE: Gear = {
    helmet: null,
    chest: null,
    pants: null,
    weapon: 'felling-axe',
    offhand: null,
  };
  const TIN = RECIPES['tin-bar'];

  // `context` rolls a 0, which is under the failure curve at every level a
  // smith starts at — the arithmetic here is about time and inputs, not dice.
  const making = (overrides = {}) =>
    context({ inventory: { 'tin-ore': 40 }, rng: () => 1, ...overrides });

  const atTheForge = (ms: number) => sessionStartedAgo(ms, 'town', 'forge');

  it('smelts through the night and pays the skill for it', () => {
    const report = resolveOfflineAfk(atTheForge(HOUR_MS), making());

    expect(report.skill).toBe('smithing');
    expect(report.crafts).toBeGreaterThan(0);
    expect(report.skillXp).toBeGreaterThan(0);
    expect(report.drops['tin-bar']).toBe(report.crafts);
    // One of the three, never two.
    expect(report.kills).toBe(0);
    expect(report.gathers).toBe(0);
  });

  // The half that runs the other way, and the one a payout that only handed
  // `drops` over would have got wrong: forty bars out of nothing.
  it('says what it spent, one input per thing it made', () => {
    const report = resolveOfflineAfk(atTheForge(HOUR_MS), making());

    expect(report.consumed['tin-ore']).toBe(report.crafts);
  });

  it('stops when the ore runs out rather than when the night does', () => {
    const report = resolveOfflineAfk(
      atTheForge(OFFLINE_CAP_MS),
      making({ inventory: { 'tin-ore': 3 } }),
    );

    expect(report.crafts).toBe(3);
    expect(report.consumed['tin-ore']).toBe(3);
  });

  it('takes a craft as long as the recipe says it does', () => {
    const report = resolveOfflineAfk(atTheForge(TIN.durationMs * 3 + 10), making());
    expect(report.crafts).toBe(3);
  });

  /**
   * A job at the fletcher's bench makes fifteen, and the night pays all fifteen
   * — counted as things rather than jobs, so "made" on the away report agrees
   * with the shafts it lists, while what was spent is still one log a job.
   */
  it('pays a whole batch a job at the bench, and counts the things made', () => {
    const SHAFTS = RECIPES['arrow-shafts'];
    const report = resolveOfflineAfk(
      sessionStartedAgo(SHAFTS.durationMs * 3 + 10, 'greyford', 'bench'),
      making({ inventory: { logs: 40 } }),
    );

    expect(report.skill).toBe('fletching');
    expect(report.consumed.logs).toBe(3);
    expect(report.drops['arrow-shafts']).toBe(45);
    expect(report.crafts).toBe(45);
  });

  // The same ceiling the gathering branch is held to, and for the same reason:
  // it is what makes the rest of the arithmetic safe to keep simple.
  it('never earns more than a single skill level, however long the tab was shut', () => {
    const night = resolveOfflineAfk(
      atTheForge(OFFLINE_CAP_MS),
      making({ inventory: { 'tin-ore': 9999 } }),
    );
    const week = resolveOfflineAfk(
      atTheForge(OFFLINE_CAP_MS * 20),
      making({ inventory: { 'tin-ore': 9999 } }),
    );

    expect(week.skillXp).toBe(night.skillXp);
    expect(skillXpToNextLevel('smithing', 1)).toBeGreaterThan(night.skillXp);
  });

  // A failure at the forge names no `failureItemId`, so it costs the time and
  // nothing else — which is the one thing that would be wrong to charge for
  // when nobody was there to watch the roll.
  it('spends nothing on a roll that failed', () => {
    const report = resolveOfflineAfk(atTheForge(HOUR_MS), making({ rng: () => 0 }));

    expect(report.crafts).toBe(0);
    expect(report.consumed).toEqual({});
    expect(report.drops).toEqual({});
  });

  it('falls back to the tool in hand when there is nothing on the bench', () => {
    const report = resolveOfflineAfk(atTheForge(HOUR_MS), making({ gear: AXE, inventory: {} }));

    expect(report.crafts).toBe(0);
    expect(report.skill).toBe('woodcutting');
    expect(report.gathers).toBeGreaterThan(0);
  });

  /**
   * The consequence the plan asked to be honoured rather than papered over: a
   * fire is ninety seconds long and a session paid out at one would be paying
   * for eight hours at a fire that went out in the first two minutes. So a camp
   * parked at one is paid for whatever it would have been doing without it.
   */
  it('pays nothing for a campfire, and falls back to the tool', () => {
    const fireside = sessionStartedAgo(HOUR_MS, 'town', 'fire');
    const report = resolveOfflineAfk(
      fireside,
      making({ gear: AXE, inventory: { 'raw-fish': 40 } }),
    );

    expect(report.crafts).toBe(0);
    expect(report.drops['cooked-fish']).toBeUndefined();
    expect(report.skill).toBe('woodcutting');
  });
});

/**
 * A bow spends an arrow a shot, awake or not. Offline pays a kill a minute
 * whatever is in hand, so the arrows are what hold a ranger's night: each kill
 * costs the shots it takes, and a bow with nothing to shoot stops fighting
 * rather than being paid for punches as though they were shots.
 */
describe('a parked ranger', () => {
  const BOW_AND_QUIVER: Gear = {
    ...SWORD_IN_HAND,
    weapon: 'shortbow',
    offhand: 'worn-quiver',
  };
  const ranger = (arrows: number, overrides = {}) =>
    context({
      classId: 'ranger',
      gear: BOW_AND_QUIVER,
      quiver: arrows > 0 ? { itemId: 'crude-arrows', count: arrows } : null,
      ...overrides,
    });

  it('pays for the kills its arrows covered, and says it stopped for want of more', () => {
    // A level 1 rat is 20 health against a shot of 6 agility, 2 bow and 1
    // arrow: three shots a rat, so twenty arrows are six rats and change.
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), ranger(20));
    expect(report.kills).toBe(6);
    expect(report.arrowsSpent).toBe(18);
    expect(report.outOfArrows).toBe(true);
  });

  it('counts the spares in the bag as well as the quiver', () => {
    const report = resolveOfflineAfk(
      sessionStartedAgo(HOUR_MS),
      ranger(20, { inventory: { 'crude-arrows': 10 } }),
    );
    expect(report.kills).toBe(10);
    expect(report.arrowsSpent).toBe(30);
  });

  it('fights not at all with nothing to shoot', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), ranger(0));
    expect(report.kills).toBe(0);
    expect(report.xp).toBe(0);
    expect(report.outOfArrows).toBe(true);
  });

  it('spends nothing and never runs dry holding anything but a bow', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context());
    expect(report.arrowsSpent).toBe(0);
    expect(report.outOfArrows).toBe(false);
  });

  it('shoots the arrows it picks up off a body at the next one', () => {
    // Bandits carry a handful each, and every roll a zero drops every entry at
    // the least of it: two arrows back per bandit, against the shots one takes.
    const dry = resolveOfflineAfk(sessionStartedAgo(HOUR_MS, 'bandit-camp'), ranger(30));
    expect(dry.drops['crude-arrows'] ?? 0).toBeGreaterThan(0);
    expect(dry.arrowsSpent).toBeGreaterThan(30);
  });
});

// Version 2 phase E3: a parked night drinks what Keep allows, one at a time, a
// potion's minutes counted against the hours away.
describe('a night that drinks', () => {
  const WATCH_MS = POTION_EFFECTS['keepers-watch'].durationMs;
  const fighter = (inventory: Inventory, extra: Partial<Parameters<typeof context>[0]> = {}) =>
    context({
      characterLevel: 5,
      capacity: carryCapacity(50),
      inventory,
      rng: () => 0.99,
      ...extra,
    });

  it("drinks Keeper's Draughts in turn, and pays them", () => {
    const away = sessionStartedAgo(HOUR_MS, 'old-mill-road');
    const plain = resolveOfflineAfk(away, fighter({}));
    const drank = resolveOfflineAfk(away, fighter({ 'keepers-draught': 9 }));
    expect(drank.drunk).toEqual({ 'keepers-draught': HOUR_MS / WATCH_MS });
    expect(drank.capped).toBe(false);
    expect(drank.kills).toBe(plain.kills);
    expect(drank.xp).toBe(Math.floor(plain.xp * 1.5));
    expect(drank.potions).toEqual({});
  });

  it('leaves a kept potion alone, and one that does nothing for the job', () => {
    const away = sessionStartedAgo(HOUR_MS, 'old-mill-road');
    const plain = resolveOfflineAfk(away, fighter({}));
    const kept = resolveOfflineAfk(
      away,
      fighter(
        { 'keepers-draught': 2, 'samphire-tonic': 2, 'bogbean-cordial': 2 },
        { idleFood: { order: [], keep: ['keepers-draught'] } },
      ),
    );
    expect(kept.drunk).toEqual({});
    expect(kept.xp).toBe(plain.xp);
  });

  // Half a level is the most a night pays, and the potions after it stay in the bag.
  it('drinks nothing after the ceiling ends the night', () => {
    const night = resolveOfflineAfk(
      sessionStartedAgo(OFFLINE_CAP_MS, 'old-mill-road'),
      fighter({ 'keepers-draught': 16 }),
    );
    expect(night.capped).toBe(true);
    const drunk = night.drunk['keepers-draught'] ?? 0;
    expect(drunk).toBeGreaterThan(0);
    expect(drunk).toBeLessThan(16);
    expect(drunk).toBe(Math.ceil((night.kills * OFFLINE_KILL_INTERVAL_MS) / WATCH_MS));
  });

  it('wakes to the clock of the last one drunk', () => {
    const night = resolveOfflineAfk(
      sessionStartedAgo(WATCH_MS * 1.5, 'old-mill-road'),
      fighter({ 'keepers-draught': 2 }),
    );
    expect(night.drunk).toEqual({ 'keepers-draught': 2 });
    expect(night.potions).toEqual({ 'keepers-watch': WATCH_MS / 2 });
  });

  // The clocks were read when the tab closed, twenty minutes after idle started,
  // and what was running then runs out before the night drinks.
  it('counts from when the tab closed, after what was running wears off', () => {
    const away = { ...sessionStartedAgo(HOUR_MS, 'old-mill-road'), restedMs: 20 * 60_000 };
    const night = resolveOfflineAfk(
      away,
      fighter({ 'keepers-draught': 5 }, { potions: { 'keepers-watch': 10 * 60_000 } }),
    );
    expect(night.drunk).toEqual({ 'keepers-draught': 1 });
    expect(night.potions).toEqual({});
  });

  it('drinks Samphire Tonics for a night of foraging, and cuts more for them', () => {
    const forager = context({
      skills: { ...createInitialSkills(), foraging: { level: 9, xp: 0 } },
      gear: { ...SWORD_IN_HAND, weapon: 'sickle' },
      capacity: carryCapacity(50),
    });
    const away = sessionStartedAgo(15 * 60_000, 'beach');
    const plain = resolveOfflineAfk(away, forager);
    const quick = resolveOfflineAfk(away, { ...forager, inventory: { 'samphire-tonic': 3 } });
    expect(plain.capped).toBe(false);
    expect(quick.drunk).toEqual({ 'samphire-tonic': 2 });
    expect(quick.gathers).toBeGreaterThan(plain.gathers);
  });
});
