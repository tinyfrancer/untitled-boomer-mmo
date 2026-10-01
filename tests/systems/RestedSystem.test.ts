import { describe, expect, it } from 'vitest';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import { xpToNextLevel } from '../../src/systems/LevelingSystem';
import { OFFLINE_CAP_MS, offlineXpCeiling } from '../../src/systems/OfflineAfkSystem';
import {
  RESTED_FILL_MS,
  RESTED_XP_MULTIPLIER,
  bankRested,
  restedCap,
  restedReach,
  spendRested,
} from '../../src/systems/RestedSystem';

/**
 * Rested (phase E1): what idle banks for the XP earned by hand, and how it is
 * spent. The numbers are the user's: half a level at most, as a night is held
 * to; full in a night; double while it lasts.
 */

describe('the bank', () => {
  it('holds half a level at most, the share a parked night is held to', () => {
    for (let level = 1; level < MAX_CHARACTER_LEVEL; level += 1) {
      expect(restedCap(level)).toBe(xpToNextLevel(level) / 2);
      expect(restedCap(level)).toBe(offlineXpCeiling(level));
    }
  });

  it('holds nothing at the top level, where there is no level to speed', () => {
    expect(restedCap(MAX_CHARACTER_LEVEL)).toBe(0);
    expect(bankRested(0, MAX_CHARACTER_LEVEL, RESTED_FILL_MS)).toBe(0);
  });

  it('fills from empty in the hours a night counts, and no further', () => {
    expect(RESTED_FILL_MS).toBe(OFFLINE_CAP_MS);
    expect(bankRested(0, 3, RESTED_FILL_MS)).toBe(restedCap(3));
    expect(bankRested(0, 3, RESTED_FILL_MS / 4)).toBeCloseTo(restedCap(3) / 4);
    expect(bankRested(0, 3, RESTED_FILL_MS * 3)).toBe(restedCap(3));
  });

  it('banks the same a frame at a time as all at once', () => {
    let rested = 0;
    for (let frame = 0; frame < 3600; frame += 1) rested = bankRested(rested, 4, 1000);
    expect(rested).toBeCloseTo(bankRested(0, 4, 3_600_000));
  });

  it('never takes any away, from a bank a level has not yet caught up with', () => {
    expect(bankRested(10_000, 1, 60_000)).toBe(10_000);
    expect(bankRested(5, 2, 0)).toBe(5);
    expect(bankRested(5, 2, -1000)).toBe(5);
  });
});

describe('spending it', () => {
  it('doubles an award while it lasts, in whole points', () => {
    expect(RESTED_XP_MULTIPLIER).toBe(2);
    expect(spendRested(30, 100.5, 2)).toEqual({ bonus: 30, rested: 70.5 });
  });

  it('pays what is left when the award is bigger than the bank', () => {
    expect(spendRested(30, 12.75, 2)).toEqual({ bonus: 12, rested: 0.75 });
  });

  it('pays nothing from an empty bank, or a fraction of a point', () => {
    expect(spendRested(30, 0, 2)).toEqual({ bonus: 0, rested: 0 });
    expect(spendRested(30, 0.9, 2)).toEqual({ bonus: 0, rested: 0.9 });
  });

  it('keeps the bank at the top level, where the XP would go nowhere', () => {
    expect(spendRested(30, 50, MAX_CHARACTER_LEVEL)).toEqual({ bonus: 0, rested: 50 });
  });
});

describe('how far the bar is carried', () => {
  it('reaches twice the bank while it doubles, so its far end stays put as it is spent', () => {
    expect(restedReach(100)).toBe(200);
    expect(restedReach(100.9)).toBe(200);
    const xp = 40;
    const spent = spendRested(30, 100, 2);
    expect(xp + 30 + spent.bonus + restedReach(spent.rested)).toBe(xp + restedReach(100));
  });
});
