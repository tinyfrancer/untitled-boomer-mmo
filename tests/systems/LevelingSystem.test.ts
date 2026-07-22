import { describe, expect, it } from 'vitest';
import { addXp, formatXpProgress, xpToNextLevel } from '../../src/systems/LevelingSystem';
import { xpToReachLevel } from '../../src/data/xpTable';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';

describe('addXp', () => {
  it('accumulates xp without leveling up when below the next threshold', () => {
    const result = addXp({ level: 1, xp: 0 }, 10);
    expect(result.state).toEqual({ level: 1, xp: 10 });
    expect(result.leveledUp).toBe(false);
  });

  it('levels up exactly at the threshold and carries over remaining xp', () => {
    const threshold = xpToReachLevel(2);
    const result = addXp({ level: 1, xp: 0 }, threshold + 5);
    expect(result.state).toEqual({ level: 2, xp: 5 });
    expect(result.leveledUp).toBe(true);
  });

  it('handles multiple level-ups from a single large xp gain', () => {
    const bigAmount = xpToReachLevel(2) + xpToReachLevel(3) + 1;
    const result = addXp({ level: 1, xp: 0 }, bigAmount);
    expect(result.state).toEqual({ level: 3, xp: 1 });
    expect(result.leveledUp).toBe(true);
  });

  it('caps at MAX_CHARACTER_LEVEL and discards overflow xp', () => {
    const result = addXp({ level: MAX_CHARACTER_LEVEL - 1, xp: 0 }, 1_000_000);
    expect(result.state).toEqual({ level: MAX_CHARACTER_LEVEL, xp: 0 });
    expect(result.leveledUp).toBe(true);
  });

  it('is a no-op once already at MAX_CHARACTER_LEVEL', () => {
    const result = addXp({ level: MAX_CHARACTER_LEVEL, xp: 0 }, 500);
    expect(result.state).toEqual({ level: MAX_CHARACTER_LEVEL, xp: 0 });
    expect(result.leveledUp).toBe(false);
  });

  it('is a no-op for zero or negative xp amounts', () => {
    const result = addXp({ level: 2, xp: 10 }, 0);
    expect(result.state).toEqual({ level: 2, xp: 10 });
    expect(result.leveledUp).toBe(false);
  });
});

describe('xpToNextLevel', () => {
  it('matches the xp table for levels below the cap', () => {
    expect(xpToNextLevel(1)).toBe(xpToReachLevel(2));
  });

  it('returns 0 at the level cap', () => {
    expect(xpToNextLevel(MAX_CHARACTER_LEVEL)).toBe(0);
  });
});

describe('formatXpProgress', () => {
  it('shows current, needed, and percent', () => {
    expect(formatXpProgress(120, 250)).toBe('120 / 250 XP (48%)');
  });

  it('floors the percent rather than rounding past progress', () => {
    expect(formatXpProgress(1, 300)).toBe('1 / 300 XP (0%)');
    expect(formatXpProgress(299, 300)).toBe('299 / 300 XP (99%)');
  });

  it('reads max level at the cap', () => {
    expect(formatXpProgress(0, 0)).toBe('Max level');
  });

  it('groups thousands for readability', () => {
    expect(formatXpProgress(1240, 2000)).toBe('1,240 / 2,000 XP (62%)');
  });
});
