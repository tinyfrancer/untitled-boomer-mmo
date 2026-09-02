import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { ENEMY_ABILITIES } from '../../src/data/enemyAbilities';
import {
  abilityConnects,
  chooseEnemyAbility,
  enemyAbilitiesFor,
  resolveEnemyAbilityDamage,
} from '../../src/systems/EnemyAbilitySystem';

const READY = { elapsedSince: () => Infinity, clearLine: true };
const CLEAVE = ENEMY_ABILITIES.cleave;
const KNIFE = ENEMY_ABILITIES['throw-knife'];

describe('chooseEnemyAbility', () => {
  it('answers nothing for a creature that has none', () => {
    expect(chooseEnemyAbility(ENEMIES.rat, { ...READY, distance: 10 })).toBeNull();
  });

  it('picks one that is off cooldown and in its own band', () => {
    expect(chooseEnemyAbility(ENEMIES['bandit-chief'], { ...READY, distance: 60 })).toBe(CLEAVE);
  });

  it('waits out its cooldown like everything else does', () => {
    const chosen = chooseEnemyAbility(ENEMIES['bandit-chief'], {
      distance: 60,
      clearLine: true,
      elapsedSince: () => CLEAVE.cooldownMs - 1,
    });
    expect(chosen).toBeNull();
  });

  it('leaves it alone from beyond its reach', () => {
    const chosen = chooseEnemyAbility(ENEMIES['bandit-chief'], {
      ...READY,
      distance: CLEAVE.range + 1,
    });
    expect(chosen).toBeNull();
  });

  /**
   * The knife is what a bandit reaches for when it *cannot* reach you, and that
   * is not a flavour note: every duel in `EnemySystem.test.ts` is fought at
   * swinging distance, so a bandit that threw one there would move the melee
   * curve those tests hold without any of them noticing.
   */
  it('keeps the thrown one out of melee, where the swing belongs', () => {
    const inMelee = chooseEnemyAbility(ENEMIES.bandit, {
      ...READY,
      distance: ENEMIES.bandit.attackRange,
    });
    const backedOff = chooseEnemyAbility(ENEMIES.bandit, { ...READY, distance: 200 });

    expect(inMelee).toBeNull();
    expect(backedOff).toBe(KNIFE);
    expect(KNIFE.minRange ?? 0).toBeGreaterThan(ENEMIES.bandit.attackRange);
  });

  it('runs out of reach eventually, so walking away still works', () => {
    expect(chooseEnemyAbility(ENEMIES.bandit, { ...READY, distance: KNIFE.range + 1 })).toBeNull();
  });
});

describe('abilityConnects', () => {
  // Asked again when the wind-up runs out rather than only when it started,
  // which is the whole mechanic: the shout is a second to step out in.
  it('lands on whoever is still inside its reach, and misses whoever left', () => {
    expect(abilityConnects(CLEAVE, CLEAVE.range, true)).toBe(true);
    expect(abilityConnects(CLEAVE, CLEAVE.range + 1, true)).toBe(false);
  });

  /**
   * The other way out of one, and the only one a room makes possible: stepping
   * behind a wall while it winds up is the same dodge measured differently.
   */
  it('misses whoever put a wall in the way, however close they still are', () => {
    expect(abilityConnects(KNIFE, 0, false)).toBe(false);
  });
});

describe('a line that is not clear', () => {
  // Refused at the start as well as at the end, because a telegraph that always
  // misses is a telegraph that lies.
  it('stops a creature winding one up at all', () => {
    const blocked = chooseEnemyAbility(ENEMIES.bandit, {
      ...READY,
      clearLine: false,
      distance: 200,
    });
    expect(blocked).toBeNull();
    expect(chooseEnemyAbility(ENEMIES.bandit, { ...READY, distance: 200 })).toBe(KNIFE);
  });
});

describe('the abilities themselves', () => {
  it('are all telegraphed — an instant one would be unavoidable by construction', () => {
    Object.values(ENEMY_ABILITIES).forEach((ability) => {
      expect(ability.windUpMs, ability.id).toBeGreaterThan(0);
    });
  });

  it('all hit at least as hard as the swing they replace', () => {
    Object.values(ENEMY_ABILITIES).forEach((ability) => {
      expect(ability.powerMultiplier, ability.id).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * A learned thing, so a beast has none. The same line `family` already draws
   * for what a loot table may hold, held over the table rather than by
   * construction since the rows are hand-written.
   */
  it('belong to humanoids only', () => {
    Object.values(ENEMIES).forEach((enemy) => {
      if (enemy.family === 'humanoid') return;
      expect(enemyAbilitiesFor(enemy), enemy.id).toEqual([]);
    });
    expect(enemyAbilitiesFor(ENEMIES['bandit-chief'])).toEqual([CLEAVE]);
  });

  it('scale off the creature that swings them, with the usual variance', () => {
    const damage = resolveEnemyAbilityDamage(CLEAVE, 10, () => 0.5);
    expect(damage).toBeGreaterThan(10);
  });
});
