import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import { ENEMIES } from '../../src/data/enemies';
import {
  approachRange,
  avoidanceChance,
  critChance,
  damageReduction,
  enemyAvoids,
  isCooldownReady,
  isInRange,
  mitigatedDamage,
  resolveAttack,
  rollDefense,
  weaponSkillBonus,
  weaponSkillFor,
} from '../../src/systems/CombatSystem';
import { MAX_CHARACTER_LEVEL, combatSkillCap } from '../../src/config/constants';

// What a character who has trained a combat skill as far as the game allows
// holds. Both ceilings are sloped against it, so the tests below read it off
// the cap rather than naming a number that moves when the cap does.
const TOP_SKILL = combatSkillCap(MAX_CHARACTER_LEVEL);

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
    // must not move, so this rounds back to the same number. 0.5 is the
    // no-variance midpoint and is above any crit chance, so neither roll fires.
    expect(resolveAttack({ attackPower: 10, weaponSkillLevel: 1 }, () => 0.5).damage).toBe(10);
    // A capped character, on a swing that did not crit: the flat half alone.
    expect(resolveAttack({ attackPower: 100, weaponSkillLevel: TOP_SKILL }, () => 0.5)).toEqual({
      damage: 117,
      crit: false,
    });
  });

  /**
   * The half that makes training felt. A crit is a moment where a multiplier is
   * not — which is the whole reason part of the same budget moved here.
   */
  it('doubles a swing that lands hard, and says that it did', () => {
    // Below the crit chance on the second roll and at the midpoint on the first.
    const rolls = [0.5, 0];
    const hard = resolveAttack(
      { attackPower: 100, weaponSkillLevel: TOP_SKILL },
      () => rolls.shift() ?? 0.5,
    );

    expect(hard.crit).toBe(true);
    expect(hard.damage).toBe(233);
  });

  it('never crits for something with no weapon skill at all', () => {
    const mob = resolveAttack({ attackPower: 100 }, () => 0);
    expect(mob.crit).toBe(false);
  });
});

describe('weaponSkillBonus', () => {
  it('is neutral with no skill and grows linearly with it', () => {
    expect(weaponSkillBonus()).toBe(1);
    expect(weaponSkillBonus(0)).toBe(1);
  });

  /**
   * The budget is still +40% at cap; what moved is how it is *paid*. Part of it
   * is a chance to land hard now, so the flat half alone is worth less and the
   * two together are worth exactly what the one used to be — which is the whole
   * claim of the change, and the reason the flat part is derived rather than
   * written down.
   */
  it('still averages exactly +40% to a capped character, crits included', () => {
    const flat = weaponSkillBonus(TOP_SKILL);
    const averageWithCrits = flat * (1 + critChance(TOP_SKILL));

    expect(flat).toBeLessThan(1.4);
    expect(averageWithCrits).toBeCloseTo(1.4);
  });

  // A save made under the old level 10 cap carries combat skills past this one,
  // and must not swing harder than the game says anyone can — on either half.
  it('goes no further than that on a skill above the cap', () => {
    expect(weaponSkillBonus(TOP_SKILL * 2)).toBeCloseTo(weaponSkillBonus(TOP_SKILL));
    expect(critChance(TOP_SKILL * 2)).toBeCloseTo(critChance(TOP_SKILL));
    expect(critChance(1000)).toBeCloseTo(critChance(TOP_SKILL));
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
    expect(avoidanceChance(1)).toBeCloseTo(0.005);
    expect(avoidanceChance(1000)).toBe(0.25);
  });

  // The finding this PR closes: the 25% ceiling wanted skill 125 and no cap the
  // game has ever had let anyone reach it, so the number in the source
  // described something impossible. Training a skill out is now worth what it
  // claims to be worth.
  it('reaches its ceiling exactly at the cap rather than short of it', () => {
    expect(avoidanceChance(TOP_SKILL)).toBeCloseTo(0.25);
    expect(avoidanceChance(TOP_SKILL - 1)).toBeLessThan(0.25);
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

describe('approachRange', () => {
  it('stops short of the boundary, so the swing that follows is still in range', () => {
    expect(approachRange(100)).toBeLessThan(100);
    expect(isInRange(approachRange(100), 100)).toBe(true);
  });

  it('scales with reach, which is what lets both directions of a chase share it', () => {
    // A mob's reach is its own; the player's rides the equipped weapon.
    expect(approachRange(72) / 72).toBeCloseTo(approachRange(64) / 64);
  });

  it('leaves enough margin to be worth having', () => {
    expect(100 - approachRange(100)).toBeGreaterThanOrEqual(20);
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

/**
 * Armour, which the game had none of: `armorType` was a class restriction and
 * nothing anywhere reduced a hit.
 */
describe('mitigatedDamage', () => {
  it('takes nothing off an unarmoured hit', () => {
    expect(mitigatedDamage(20, 0)).toBe(20);
  });

  it('takes proportionally more off the more is worn, and never all of it', () => {
    const steps = [0, 5, 14, 40, 200, 10000].map((armor) => mitigatedDamage(100, armor));
    // Strictly decreasing, so every point of armour is worth something...
    steps.forEach((damage, at) => {
      if (at > 0) expect(damage).toBeLessThan(nth(steps, at - 1));
    });
    // ...and never worth immunity, however much of it is stacked.
    steps.forEach((damage) => expect(damage).toBeGreaterThanOrEqual(1));
    expect(damageReduction(10000)).toBeLessThan(1);
  });

  /**
   * The number the plan was tuned to: a full brown set with the shield sits near
   * 15%, which is what makes the tier worth wearing without making a rat
   * harmless. Read off the items rather than restated, so retuning a piece moves
   * this rather than leaving it lying.
   */
  it('puts a full brown set near 15%', () => {
    const set = computeEffectiveStats(
      'warrior',
      {
        helmet: 'brown-helmet',
        chest: 'brown-chestplate',
        pants: 'brown-legs',
        weapon: 'brown-axe',
        offhand: 'brown-shield',
      },
      1,
    );

    expect(damageReduction(set.armor)).toBeGreaterThan(0.12);
    expect(damageReduction(set.armor)).toBeLessThan(0.18);
  });

  // MIN_DAMAGE already floors a hit at 1, so mitigation can only ever make a
  // blow the smallest blow there is.
  it('leaves the smallest hit landing', () => {
    expect(mitigatedDamage(1, 10000)).toBe(1);
  });
});

describe('a shield in the off hand', () => {
  // It helps Block rather than being required by it: requiring one would strand
  // every point of Block every existing character has already trained.
  it('makes a block likelier without being needed for one', () => {
    // A roll between the two chances: at skill 20 the bare skill blocks one hit
    // in ten and a shielded one blocks one in five.
    const roll = (): number => 0.15;
    const bare = { blockLevel: 20, parryLevel: 0, hasWeapon: false };

    expect(rollDefense(bare, roll).avoided).toBe(false);
    expect(rollDefense({ ...bare, hasShield: true }, roll)).toEqual({
      avoided: true,
      skillId: 'block',
    });
  });

  it('never turns blocking into immunity', () => {
    const always = rollDefense(
      { blockLevel: 10000, parryLevel: 0, hasWeapon: false, hasShield: true },
      () => 0.99,
    );
    expect(always.avoided).toBe(false);
  });
});

/**
 * The other half of the finding: `rollDefense` had exactly one caller and it was
 * the player being hit, so nothing in the game had ever avoided anything the
 * player swung at.
 */
describe('enemyAvoids', () => {
  it('slips a swing at its own rate, and never without one', () => {
    expect(enemyAvoids(0.15, () => 0.1)).toBe(true);
    expect(enemyAvoids(0.15, () => 0.2)).toBe(false);
    expect(enemyAvoids(undefined, () => 0)).toBe(false);
    expect(enemyAvoids(0, () => 0)).toBe(false);
  });

  // Nothing to roll for something that never dodges, which is every row but the
  // crab. Cheap, and it keeps a scripted rng meaning what it says: a swing at a
  // rat spends its rolls on the damage rather than on a question with one
  // answer.
  it('rolls nothing at all when there is no chance to roll against', () => {
    let rolled = 0;
    const counted = (): number => {
      rolled += 1;
      return 0;
    };

    expect(enemyAvoids(0, counted)).toBe(false);
    expect(rolled).toBe(0);
    expect(enemyAvoids(0.15, counted)).toBe(true);
    expect(rolled).toBe(1);
  });

  /**
   * One user the day it exists, and only one: a scuttling armoured thing already
   * designed as a long fight rather than a dangerous one is what a dodge is for,
   * and every other row leaving it at zero is what keeps this from being a tax
   * on every fight in the game.
   */
  it("is the crab's alone", () => {
    const dodgers = Object.values(ENEMIES).filter((enemy) => (enemy.avoidChance ?? 0) > 0);
    expect(dodgers.map((enemy) => enemy.id)).toEqual(['crab']);
  });
});
