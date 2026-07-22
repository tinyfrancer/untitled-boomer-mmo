import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { TOWN_RAT_SPAWNS } from '../../src/data/spawns';
import { conColor, enemyDisplayName, scaleEnemyStats } from '../../src/systems/EnemySystem';
import { THEME } from '../../src/ui/theme';

describe('scaleEnemyStats', () => {
  it('returns the base stats at level 1', () => {
    const stats = scaleEnemyStats(ENEMIES.rat, 1);
    expect(stats).toEqual(ENEMIES.rat.base);
  });

  it('adds one growth step per level past the first', () => {
    const { base, perLevel } = ENEMIES.rat;
    expect(scaleEnemyStats(ENEMIES.rat, 3)).toEqual({
      maxHp: base.maxHp + perLevel.maxHp * 2,
      attackPower: base.attackPower + perLevel.attackPower * 2,
      xpReward: base.xpReward + perLevel.xpReward * 2,
    });
  });

  it('makes higher levels tougher and worth more xp', () => {
    const low = scaleEnemyStats(ENEMIES.rat, 1);
    const mid = scaleEnemyStats(ENEMIES.rat, 2);
    const high = scaleEnemyStats(ENEMIES.rat, 3);

    expect(mid.maxHp).toBeGreaterThan(low.maxHp);
    expect(high.maxHp).toBeGreaterThan(mid.maxHp);
    expect(high.attackPower).toBeGreaterThan(mid.attackPower);
    expect(high.xpReward).toBeGreaterThan(mid.xpReward);
  });

  it('clamps growth at level 1 rather than scaling below the base stats', () => {
    expect(scaleEnemyStats(ENEMIES.rat, 0)).toEqual(ENEMIES.rat.base);
  });
});

describe('conColor', () => {
  it('is white for an even-level enemy', () => {
    expect(conColor(5, 5)).toBe(THEME.color.con.even);
  });

  it('is yellow exactly one level above the player', () => {
    expect(conColor(5, 6)).toBe(THEME.color.con.high);
  });

  it('is red from two levels above the player', () => {
    expect(conColor(5, 7)).toBe(THEME.color.con.deadly);
    expect(conColor(5, 8)).toBe(THEME.color.con.deadly);
    expect(conColor(1, 10)).toBe(THEME.color.con.deadly);
  });

  // The starting zone caps at level 3, so a level 1 character has to be able to
  // see a red name there or the warning never fires where it matters most.
  it('cons a level 3 rat red to a fresh level 1 character', () => {
    expect(conColor(1, 3)).toBe(THEME.color.con.deadly);
  });

  it('is green one to two levels below the player', () => {
    expect(conColor(5, 4)).toBe(THEME.color.con.low);
    expect(conColor(5, 3)).toBe(THEME.color.con.low);
  });

  it('is gray from three levels below the player', () => {
    expect(conColor(5, 2)).toBe(THEME.color.con.trivial);
    expect(conColor(10, 1)).toBe(THEME.color.con.trivial);
  });
});

describe('enemyDisplayName', () => {
  it('appends the level to the enemy name', () => {
    expect(enemyDisplayName(ENEMIES.rat, 3)).toBe('Rat (3)');
  });
});

describe('TOWN_RAT_SPAWNS', () => {
  it('spawns fewer enemies at each higher level', () => {
    const countAt = (level: number): number =>
      TOWN_RAT_SPAWNS.filter((spawn) => spawn.level === level).length;

    expect(countAt(1)).toBeGreaterThan(countAt(2));
    expect(countAt(2)).toBeGreaterThan(countAt(3));
    expect(countAt(3)).toBeGreaterThan(0);
  });

  it('only uses levels the starting area is tuned for', () => {
    TOWN_RAT_SPAWNS.forEach((spawn) => {
      expect(spawn.level).toBeGreaterThanOrEqual(1);
      expect(spawn.level).toBeLessThanOrEqual(3);
    });
  });
});
