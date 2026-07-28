import { describe, expect, it } from 'vitest';
import {
  OFFLINE_CAP_MS,
  elapsedOfflineMs,
  formatAwayDuration,
  resolveOfflineAfk,
} from '../../src/systems/OfflineAfkSystem';
import { AFK_XP_MULTIPLIER, afkXpReward } from '../../src/systems/AfkSystem';
import { carryCapacity } from '../../src/systems/EncumbranceSystem';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import { ENEMIES } from '../../src/data/enemies';
import { xpToReachLevel } from '../../src/data/xpTable';
import type { AfkSession } from '../../src/persistence/CharacterState';

const NOW = Date.parse('2026-07-24T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

function sessionStartedAgo(ms: number, zoneId: AfkSession['zoneId'] = 'town'): AfkSession {
  return { startedAt: new Date(NOW - ms).toISOString(), zoneId };
}

function context(overrides: Partial<Parameters<typeof resolveOfflineAfk>[1]> = {}) {
  return {
    now: NOW,
    characterLevel: 1,
    inventory: {},
    capacity: carryCapacity(6),
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
  // at the bandit camp paid 20,520 xp — more than seven times the entire
  // level 1-10 curve.
  it('is worth at most one level, however long the session and however rich the zone', () => {
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
      expect(report.xp).toBeLessThanOrEqual(xpToReachLevel(level + 1));
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

  it('names no creature when nothing died', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(1000), context());
    expect(report.kills).toBe(0);
    expect(report.enemyId).toBeNull();
  });

  it('takes loot into a pack with room for it', () => {
    // Two kills' worth: short enough that everything dropping still fits.
    const report = resolveOfflineAfk(sessionStartedAgo(130000), context());
    expect(Object.keys(report.drops).length).toBeGreaterThan(0);
    expect(report.packFilled).toBe(false);
  });

  // Which is the point of the limit: a long enough camp fills the pack and the
  // rest of the night's drops are left where they fell.
  it('fills the pack over a long session and leaves the rest behind', () => {
    const report = resolveOfflineAfk(sessionStartedAgo(HOUR_MS), context());
    expect(report.packFilled).toBe(true);
  });

  it('takes no drops at all into a pack that was already full', () => {
    const capacity = carryCapacity(6);
    const report = resolveOfflineAfk(
      sessionStartedAgo(HOUR_MS),
      context({ inventory: { 'rat-bones': capacity }, capacity }),
    );
    expect(report.packFilled).toBe(true);
    expect(report.drops).toEqual({});
    // Levelling is weightless, so it carries on regardless.
    expect(report.xp).toBeGreaterThan(0);
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
