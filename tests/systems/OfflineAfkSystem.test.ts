import { describe, expect, it } from 'vitest';
import {
  OFFLINE_CAP_MS,
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
import type { Gear } from '../../src/systems/InventorySystem';
import { ENEMIES } from '../../src/data/enemies';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { xpToReachLevel } from '../../src/data/xpTable';
import type { AfkSession } from '../../src/persistence/CharacterState';

const NOW = Date.parse('2026-07-24T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

function sessionStartedAgo(ms: number, zoneId: AfkSession['zoneId'] = 'town'): AfkSession {
  return { startedAt: new Date(NOW - ms).toISOString(), zoneId };
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
    characterLevel: 1,
    inventory: {},
    capacity: carryCapacity(6),
    gear: SWORD_IN_HAND,
    skills: createInitialSkills(),
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

  it('takes a gather as long as the skill says it does', () => {
    const oneGather = gatherDurationMs(TREE, 1);
    const report = resolveOfflineAfk(sessionStartedAgo(oneGather * 3 + 10), gathering(AXE));
    expect(report.gathers).toBe(3);
  });
});
