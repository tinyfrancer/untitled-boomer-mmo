import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../../src/data/abilities';
import {
  abilitiesFor,
  absorbDamage,
  canUseAbility,
  resolveAbilityDamage,
  rollSpellFailure,
  spellFailureChance,
  startHaste,
  startManaShield,
  tickBuff,
} from '../../src/systems/AbilitySystem';

const READY = { mana: 100, elapsedMs: Infinity, hasTarget: true, targetDistance: 10 };

describe('abilitiesFor', () => {
  it('gives each class only its own abilities', () => {
    expect(abilitiesFor('wizard').map((a) => a.id)).toEqual(['fireball', 'mana-shield']);
    expect(abilitiesFor('warrior').map((a) => a.id)).toEqual(['power-slash', 'battle-fury']);
    abilitiesFor('wizard').forEach((a) => expect(a.classId).toBe('wizard'));
  });
});

describe('canUseAbility', () => {
  it('allows a ready ability with mana and a target in range', () => {
    expect(canUseAbility(ABILITIES.fireball, READY)).toEqual({ ok: true });
  });

  it('refuses while the cooldown is still running, and says how long', () => {
    const check = canUseAbility(ABILITIES.fireball, { ...READY, elapsedMs: 1000 });
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toContain('5s');
  });

  it('refuses when mana is short', () => {
    const check = canUseAbility(ABILITIES.fireball, { ...READY, mana: 1 });
    expect(check.ok === false && check.reason).toBe('Not enough mana.');
  });

  it('refuses a targeted ability with no target, or one out of reach', () => {
    expect(canUseAbility(ABILITIES.fireball, { ...READY, hasTarget: false }).ok).toBe(false);
    expect(canUseAbility(ABILITIES.fireball, { ...READY, targetDistance: 9999 }).ok).toBe(false);
  });

  it('needs no target for a self-cast, even with nothing selected', () => {
    expect(
      canUseAbility(ABILITIES['battle-fury'], {
        ...READY,
        hasTarget: false,
        targetDistance: Infinity,
      }),
    ).toEqual({ ok: true });
  });

  it('lets a warrior ability through on an empty pool, since it costs none', () => {
    expect(canUseAbility(ABILITIES['power-slash'], { ...READY, mana: 0 }).ok).toBe(true);
  });
});

describe('spellFailureChance', () => {
  it('is the base chance at no skill and falls as Destruction rises', () => {
    expect(spellFailureChance(ABILITIES.fireball, 0)).toBe(0.2);
    expect(spellFailureChance(ABILITIES.fireball, 50)).toBeCloseTo(0.125);
  });

  it('never reaches zero, however high the skill', () => {
    expect(spellFailureChance(ABILITIES.fireball, 100000)).toBe(0.02);
  });

  it('is zero for a physical ability, which cannot fizzle at all', () => {
    expect(spellFailureChance(ABILITIES['power-slash'], 0)).toBe(0);
    expect(rollSpellFailure(ABILITIES['power-slash'], 0, () => 0)).toBe(false);
  });
});

describe('resolveAbilityDamage', () => {
  it('multiplies a normal swing by the ability’s power', () => {
    // rng 0.5 is the no-variance midpoint; skill 0 leaves the bonus neutral and
    // cannot crit, since the chance comes out of the skill.
    expect(resolveAbilityDamage(ABILITIES.fireball, 10, 0, () => 0.5)).toEqual({
      damage: 20,
      crit: false,
    });
    expect(resolveAbilityDamage(ABILITIES['power-slash'], 10, 0, () => 0.5)).toEqual({
      damage: 22,
      crit: false,
    });
  });

  it('scales with the governing skill', () => {
    const unskilled = resolveAbilityDamage(ABILITIES.fireball, 100, 0, () => 0.5);
    const skilled = resolveAbilityDamage(ABILITIES.fireball, 100, 100, () => 0.5);
    expect(skilled.damage).toBeGreaterThan(unskilled.damage);
  });

  it('is zero for an ability that deals no damage', () => {
    expect(resolveAbilityDamage(ABILITIES['mana-shield'], 100, 0, () => 0.5)).toEqual({
      damage: 0,
      crit: false,
    });
  });
});

describe('buffs', () => {
  it('starts only from the matching effect kind', () => {
    expect(startManaShield(ABILITIES['mana-shield'])).toEqual({
      remaining: 25,
      remainingMs: 20000,
      durationMs: 20000,
    });
    expect(startManaShield(ABILITIES.fireball)).toBeNull();
    expect(startHaste(ABILITIES['battle-fury'])?.cooldownMultiplier).toBe(0.6);
    expect(startHaste(ABILITIES['power-slash'])).toBeNull();
  });

  it('runs the clock down and expires exactly once it hits zero', () => {
    const haste = startHaste(ABILITIES['battle-fury']);
    expect(tickBuff(haste, 1000)?.remainingMs).toBe(7000);
    expect(tickBuff(haste, 8000)).toBeNull();
    expect(tickBuff(null, 100)).toBeNull();
  });

  it('does not mutate the buff it ticks', () => {
    const haste = startHaste(ABILITIES['battle-fury']);
    tickBuff(haste, 1000);
    expect(haste?.remainingMs).toBe(8000);
  });

  // What a countdown icon is drawn against: the clock runs down and the length
  // it started at does not, or the sweep would never move.
  it('keeps the duration it started with as the clock runs down', () => {
    const haste = startHaste(ABILITIES['battle-fury']);
    expect(tickBuff(haste, 1000)).toMatchObject({ remainingMs: 7000, durationMs: 8000 });
  });
});

describe('absorbDamage', () => {
  const shield = { remaining: 25, remainingMs: 20000, durationMs: 20000 };

  it('soaks a hit smaller than the pool and keeps the rest', () => {
    const result = absorbDamage(shield, 10);
    expect(result).toMatchObject({ damage: 0, absorbed: 10 });
    expect(result.shield?.remaining).toBe(15);
  });

  it('lets the overflow through and spends the shield', () => {
    const result = absorbDamage(shield, 40);
    expect(result).toMatchObject({ damage: 15, absorbed: 25 });
    expect(result.shield).toBeNull();
  });

  it('spends a shield that exactly covers the hit', () => {
    expect(absorbDamage(shield, 25).shield).toBeNull();
  });

  it('passes damage straight through with no shield up', () => {
    expect(absorbDamage(null, 10)).toEqual({ damage: 10, shield: null, absorbed: 0 });
  });
});
