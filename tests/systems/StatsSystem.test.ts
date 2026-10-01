import { describe, expect, it } from 'vitest';
import { MELEE_ATTACK_RANGE, UNARMED_ATTACK_RANGE } from '../../src/data/items';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import type { Gear } from '../../src/systems/InventorySystem';
import { staleItemId } from '../staleIds';

const NO_GEAR: Gear = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
  offhand: null,
};

describe('computeEffectiveStats', () => {
  it('returns the class base stats when no gear is equipped', () => {
    const stats = computeEffectiveStats('warrior', NO_GEAR);
    expect(stats.maxHp).toBe(40);
    expect(stats.strength).toBe(6);
    expect(stats.intellect).toBe(1);
    expect(stats.attackPower).toBe(6);
  });

  it("adds the weapon's attack power bonus for a strength-based class", () => {
    const stats = computeEffectiveStats('warrior', { ...NO_GEAR, weapon: 'rusty-sword' });
    expect(stats.attackPower).toBe(6 + 2);
  });

  it("adds the weapon's attack power bonus for an intellect-based class", () => {
    const stats = computeEffectiveStats('wizard', { ...NO_GEAR, weapon: 'apprentice-staff' });
    expect(stats.attackPower).toBe(6 + 2);
  });

  it('adds health and strength from leather, health and intellect from cloth', () => {
    const leather = computeEffectiveStats('warrior', { ...NO_GEAR, chest: 'brown-chestplate' });
    expect(leather.maxHp).toBe(41);
    expect(leather.strength).toBe(7);
    // Armor feeds one stat or the other, never both.
    expect(leather.intellect).toBe(1);

    const cloth = computeEffectiveStats('wizard', { ...NO_GEAR, chest: 'brown-robe' });
    expect(cloth.maxHp).toBe(25);
    expect(cloth.intellect).toBe(7);
    expect(cloth.strength).toBe(1);
  });

  it("only the primary stat's bonus feeds attackPower", () => {
    const stats = computeEffectiveStats('wizard', { ...NO_GEAR, chest: 'brown-robe' });
    // wizard's primary stat is intellect: base 6 + 1 (robe) = 7
    expect(stats.attackPower).toBe(7);
    // The same robe does nothing for a warrior's swing.
    expect(computeEffectiveStats('warrior', { ...NO_GEAR, chest: 'brown-robe' }).attackPower).toBe(
      6,
    );
  });

  it('gives a mana pool only to the class that casts', () => {
    expect(computeEffectiveStats('wizard', NO_GEAR).maxMana).toBe(30);
    expect(computeEffectiveStats('warrior', NO_GEAR).maxMana).toBe(0);
    // Intellect from cloth buys more of it.
    expect(computeEffectiveStats('wizard', { ...NO_GEAR, chest: 'brown-robe' }).maxMana).toBe(35);
  });

  it('stacks bonuses across multiple equipped items', () => {
    const stats = computeEffectiveStats('warrior', {
      ...NO_GEAR,
      weapon: 'rusty-sword',
      chest: 'brown-chestplate',
    });
    expect(stats.attackPower).toBe(6 + 1 + 2); // strength base+bonus, then weapon bonus
    expect(stats.maxHp).toBe(41);
  });

  it('grants no growth at level 1, the implicit default', () => {
    expect(computeEffectiveStats('warrior', NO_GEAR, 1)).toEqual(
      computeEffectiveStats('warrior', NO_GEAR),
    );
  });

  it('adds one growth step per level past the first', () => {
    const stats = computeEffectiveStats('warrior', NO_GEAR, 3);
    expect(stats.maxHp).toBe(40 + 6 * 2);
    expect(stats.strength).toBe(6 + 2 * 2);
    expect(stats.intellect).toBe(1);
  });

  it("grows a class along its own axis: the wizard's is intellect", () => {
    const stats = computeEffectiveStats('wizard', NO_GEAR, 3);
    expect(stats.maxHp).toBe(24 + 6 * 2);
    expect(stats.intellect).toBe(6 + 2 * 2);
    expect(stats.strength).toBe(1);
  });

  it('feeds level growth into attackPower through the primary stat', () => {
    expect(computeEffectiveStats('warrior', NO_GEAR, 3).attackPower).toBe(6 + 2 * 2);
    expect(computeEffectiveStats('wizard', NO_GEAR, 3).attackPower).toBe(6 + 2 * 2);
  });

  it('stacks level growth with gear bonuses', () => {
    const stats = computeEffectiveStats('warrior', { ...NO_GEAR, weapon: 'rusty-sword' }, 2);
    expect(stats.attackPower).toBe(6 + 2 + 2); // base str, one growth step, weapon bonus
    expect(stats.maxHp).toBe(40 + 6);
  });

  it('treats an unknown item id in a gear slot as contributing no bonus', () => {
    const stats = computeEffectiveStats('warrior', {
      ...NO_GEAR,
      chest: staleItemId('nonexistent-item'),
    });
    expect(stats.maxHp).toBe(40);
    expect(stats.strength).toBe(6);
  });
});

describe('attack range', () => {
  it('takes its reach from the weapon, not the class', () => {
    for (const classId of ['warrior', 'wizard'] as const) {
      expect(
        computeEffectiveStats(classId, { ...NO_GEAR, weapon: 'apprentice-staff' }).attackRange,
      ).toBe(200);
      expect(
        computeEffectiveStats(classId, { ...NO_GEAR, weapon: 'rusty-sword' }).attackRange,
      ).toBe(MELEE_ATTACK_RANGE);
    }
  });

  // The bug this replaced: a wizard with an empty weapon slot kept the class's
  // 280 reach and sniped from across the zone bare-handed.
  it('puts an unarmed character in punching range whatever their class', () => {
    expect(computeEffectiveStats('wizard', NO_GEAR).attackRange).toBe(UNARMED_ATTACK_RANGE);
    expect(computeEffectiveStats('warrior', NO_GEAR).attackRange).toBe(UNARMED_ATTACK_RANGE);
  });

  it('treats a weapon that names no range as melee', () => {
    expect(
      computeEffectiveStats('warrior', { ...NO_GEAR, weapon: 'felling-axe' }).attackRange,
    ).toBe(MELEE_ATTACK_RANGE);
  });

  it('falls back to unarmed for an unknown weapon id', () => {
    expect(
      computeEffectiveStats('wizard', { ...NO_GEAR, weapon: staleItemId('nonexistent-item') })
        .attackRange,
    ).toBe(UNARMED_ATTACK_RANGE);
  });
});
