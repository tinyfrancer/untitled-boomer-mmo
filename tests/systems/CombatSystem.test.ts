import { describe, expect, it } from 'vitest';
import {
  avoidanceChance,
  isCooldownReady,
  isInRange,
  resolveAttack,
  rollDefense,
  weaponSkillBonus,
  weaponSkillFor,
} from '../../src/systems/CombatSystem';

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

  it('leaves an attacker without weapon skill exactly as it was — mobs have none', () => {
    expect(resolveAttack({ attackPower: 100 }, () => 0.5).damage).toBe(100);
  });

  it('hits harder with weapon skill, but barely at the level a fresh character has', () => {
    // Skill 1 is where every new character starts: the level-1 combat curve
    // must not move, so this rounds back to the same number.
    expect(resolveAttack({ attackPower: 10, weaponSkillLevel: 1 }, () => 0.5).damage).toBe(10);
    // A capped level 10 character is the other end of the range.
    expect(resolveAttack({ attackPower: 100, weaponSkillLevel: 100 }, () => 0.5).damage).toBe(140);
  });
});

describe('weaponSkillBonus', () => {
  it('is neutral with no skill and grows linearly with it', () => {
    expect(weaponSkillBonus()).toBe(1);
    expect(weaponSkillBonus(0)).toBe(1);
    expect(weaponSkillBonus(100)).toBeCloseTo(1.4);
  });

  it('never goes below neutral on a nonsense level', () => {
    expect(weaponSkillBonus(-50)).toBe(1);
  });
});

describe('weaponSkillFor', () => {
  it('trains one-handed with a weapon and fists without', () => {
    expect(weaponSkillFor('rusty-sword')).toBe('one-handed');
    expect(weaponSkillFor('felling-axe')).toBe('one-handed');
    expect(weaponSkillFor(null)).toBe('unarmed');
    // Something that isn't equipment can't be in the slot; treat it as bare hands.
    expect(weaponSkillFor('rat-bones')).toBe('unarmed');
  });
});

describe('avoidanceChance', () => {
  it('is negligible at level 1 and capped well short of immunity', () => {
    expect(avoidanceChance(1)).toBeCloseTo(0.002);
    expect(avoidanceChance(100)).toBe(0.2);
    expect(avoidanceChance(1000)).toBe(0.25);
  });
});

describe('rollDefense', () => {
  const armed = { blockLevel: 50, parryLevel: 50, hasWeapon: true };

  it('parries first when both would have saved, so the armed skill trains', () => {
    expect(rollDefense(armed, () => 0)).toEqual({ avoided: true, skillId: 'parry' });
  });

  it('falls through to block when the parry roll misses', () => {
    const rolls = [0.99, 0];
    expect(rollDefense(armed, () => rolls.shift() ?? 1)).toEqual({
      avoided: true,
      skillId: 'block',
    });
  });

  it('cannot parry bare-handed, but can still block', () => {
    const unarmed = { ...armed, hasWeapon: false };
    expect(rollDefense(unarmed, () => 0)).toEqual({ avoided: true, skillId: 'block' });
  });

  it('lets the hit through when both rolls miss', () => {
    expect(rollDefense(armed, () => 0.99)).toEqual({ avoided: false, skillId: null });
  });

  it('is effectively never a save for a fresh character', () => {
    const fresh = { blockLevel: 1, parryLevel: 1, hasWeapon: true };
    expect(rollDefense(fresh, () => 0.5).avoided).toBe(false);
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
