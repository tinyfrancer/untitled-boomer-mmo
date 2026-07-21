import { describe, expect, it } from 'vitest';
import { isCooldownReady, isInRange, resolveAttack } from '../../src/systems/CombatSystem';

describe('resolveAttack', () => {
  it('returns base damage when rng lands exactly on the midpoint (no variance)', () => {
    const result = resolveAttack({ attackPower: 10 }, () => 0.5);
    expect(result.damage).toBe(10);
  });

  it('applies the maximum positive variance when rng returns 1', () => {
    const result = resolveAttack({ attackPower: 10 }, () => 1);
    expect(result.damage).toBe(13); // 10 * 1.25 = 12.5, rounds to 13
  });

  it('applies the maximum negative variance when rng returns 0', () => {
    const result = resolveAttack({ attackPower: 10 }, () => 0);
    expect(result.damage).toBe(8); // 10 * 0.75 = 7.5, rounds to 8
  });

  it('clamps damage to a minimum of 1 even when computed damage would be zero', () => {
    const result = resolveAttack({ attackPower: 0 }, () => 0);
    expect(result.damage).toBe(1);
  });
});

describe('isInRange', () => {
  it('is true when distance is within range', () => {
    expect(isInRange(10, 20)).toBe(true);
  });

  it('is true when distance exactly equals range', () => {
    expect(isInRange(20, 20)).toBe(true);
  });

  it('is false when distance exceeds range', () => {
    expect(isInRange(21, 20)).toBe(false);
  });
});

describe('isCooldownReady', () => {
  it('is false before the cooldown has elapsed', () => {
    expect(isCooldownReady(500, 1000)).toBe(false);
  });

  it('is true once the cooldown has exactly elapsed', () => {
    expect(isCooldownReady(1000, 1000)).toBe(true);
  });

  it('is true once the cooldown has been exceeded', () => {
    expect(isCooldownReady(1500, 1000)).toBe(true);
  });
});
