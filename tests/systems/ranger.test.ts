import { describe, expect, it } from 'vitest';
import { CLASSES } from '../../src/data/classes';
import { UNARMED_ATTACK_RANGE, weaponAttackRange } from '../../src/data/items';
import { CharacterController } from '../../src/systems/CharacterController';
import { createNewCharacter } from '../../src/persistence/CharacterState';
import {
  agilityCritChance,
  critChance,
  resolveAttack,
  weaponSkillFor,
} from '../../src/systems/CombatSystem';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import { NO_GEAR } from '../../src/systems/InventorySystem';
import { resolveAbilityDamage } from '../../src/systems/AbilitySystem';
import { ABILITIES } from '../../src/data/abilities';
import type { ClassId } from '../../src/types/ids';

function ranger(): CharacterController {
  return new CharacterController(createNewCharacter('Robin', 'ranger'));
}

function make(classId: ClassId): CharacterController {
  return new CharacterController(createNewCharacter('Testy', classId));
}

describe('a new ranger', () => {
  it('starts holding a bow, wearing a quiver, and with arrows in it', () => {
    const state = ranger().state;
    expect(state.gear.weapon).toBe('shortbow');
    expect(state.gear.offhand).toBe('worn-quiver');
    expect(state.quiver).toEqual(CLASSES.ranger.startingArrows);
    // Nothing in the bag: the arrows are quivered, and quivered arrows weigh nothing.
    expect(state.inventory).toEqual({});
  });

  it('is the only class that starts with anything in the other hand', () => {
    expect(make('warrior').state.gear.offhand).toBeNull();
    expect(make('wizard').state.gear.offhand).toBeNull();
    expect(make('warrior').state.quiver).toBeNull();
  });

  it('trains archery with the bow while there is an arrow to nock', () => {
    const character = ranger();
    expect(character.activeWeaponSkill()).toBe('archery');
    character.state.quiver = null;
    expect(character.activeWeaponSkill()).toBe('unarmed');
  });
});

describe('a bow takes both hands', () => {
  it('puts a shield away when it is drawn', () => {
    const character = make('warrior');
    character.addItem('brown-shield', 1);
    character.addItem('hunting-bow', 1);
    character.equip('brown-shield');
    expect(character.equip('hunting-bow').ok).toBe(true);
    expect(character.state.gear.offhand).toBeNull();
    expect(character.itemCount('brown-shield')).toBe(1);
    expect(character.itemCount('rusty-sword')).toBe(1);
  });

  it('puts the bow away when a shield or an orb is taken up', () => {
    const character = ranger();
    character.addItem('apprentice-orb', 1);
    // A ranger can hold an orb; what it cannot do is hold one and a bow.
    character.state.quiver = null;
    expect(character.equip('apprentice-orb').ok).toBe(true);
    expect(character.state.gear.weapon).toBeNull();
    expect(character.itemCount('shortbow')).toBe(1);
  });

  it('keeps the quiver, the one thing a bow allows in the other hand', () => {
    const character = ranger();
    character.addItem('hunting-bow', 1);
    expect(character.equip('hunting-bow').ok).toBe(true);
    expect(character.state.gear.offhand).toBe('worn-quiver');
    expect(character.state.quiver?.count).toBe(50);
  });

  it('lets a quiver sit beside a one-handed weapon, where it does nothing', () => {
    const character = ranger();
    character.addItem('rusty-sword', 1);
    expect(character.equip('rusty-sword').ok).toBe(true);
    expect(character.state.gear.offhand).toBe('worn-quiver');
  });
});

describe('the quiver', () => {
  it('puts its arrows in the bag when it comes off', () => {
    const character = ranger();
    expect(character.unequip('offhand').ok).toBe(true);
    expect(character.state.quiver).toBeNull();
    expect(character.itemCount('crude-arrows')).toBe(50);
    expect(character.itemCount('worn-quiver')).toBe(1);
  });

  it('refuses to come off, changing nothing, when the pack cannot hold its arrows', () => {
    const character = ranger();
    character.addItem('rat-bones', character.carryCapacity() - 1);
    const before = structuredClone(character.state);
    const check = character.unequip('offhand');
    expect(check.ok).toBe(false);
    expect(character.state).toEqual(before);
  });

  it('fills itself from the bag when put on dry', () => {
    const character = ranger();
    character.unequip('offhand');
    expect(character.equip('worn-quiver').ok).toBe(true);
    expect(character.state.quiver).toEqual({ itemId: 'crude-arrows', count: 50 });
    expect(character.itemCount('crude-arrows')).toBe(0);
  });

  it('carries its arrows over to a bigger one, and spills what a smaller one cannot hold', () => {
    const character = ranger();
    character.addItem('grave-quiver', 1);
    character.addItem('crude-arrows', 30);
    character.equip('grave-quiver');
    // Fifty carried over, and the thirty in the bag stay there: a quiver with
    // arrows in it is topped up by what is picked up, not by the bag.
    expect(character.state.quiver).toEqual({ itemId: 'crude-arrows', count: 50 });

    character.state.quiver = { itemId: 'crude-arrows', count: 100 };
    character.equip('worn-quiver');
    expect(character.state.quiver).toEqual({ itemId: 'crude-arrows', count: 50 });
    expect(character.itemCount('crude-arrows')).toBe(80);
  });

  it('takes an arrow picked up before the bag sees it', () => {
    const character = ranger();
    character.state.quiver = { itemId: 'crude-arrows', count: 45 };
    expect(character.tryAddItem('crude-arrows', 8)).toBe(true);
    expect(character.state.quiver?.count).toBe(50);
    expect(character.itemCount('crude-arrows')).toBe(3);
  });

  it('takes arrows a full pack would refuse, as many as it has room for', () => {
    const character = ranger();
    character.addItem('rat-bones', character.carryCapacity());
    character.state.quiver = { itemId: 'crude-arrows', count: 40 };
    expect(character.canCarryItem('crude-arrows', 10)).toBe(true);
    expect(character.tryAddItem('crude-arrows', 10)).toBe(true);
    expect(character.state.quiver?.count).toBe(50);
    // And a pile or a withdrawal takes what fits of the rest.
    expect(character.addWhatFits('crude-arrows', 5)).toBe(0);
  });

  it('refills straight after the shot that empties it, and says it has', () => {
    const character = ranger();
    character.state.quiver = { itemId: 'crude-arrows', count: 1 };
    character.addItem('crude-arrows', 7);
    const draw = character.drawArrow();
    expect(draw.arrow).toBe('crude-arrows');
    expect(draw.refill).toEqual({ itemId: 'crude-arrows', count: 7 });
    expect(draw.lastArrow).toBe(false);
    expect(character.state.quiver).toEqual({ itemId: 'crude-arrows', count: 7 });
  });

  it('says so on the shot that spends the last arrow anywhere', () => {
    const character = ranger();
    character.state.quiver = { itemId: 'crude-arrows', count: 1 };
    const draw = character.drawArrow();
    expect(draw.arrow).toBe('crude-arrows');
    expect(draw.lastArrow).toBe(true);
    expect(character.loadedArrow()).toBeNull();
    expect(character.drawArrow().arrow).toBeNull();
  });
});

describe('a shot', () => {
  const quivered = { ...NO_GEAR, weapon: 'shortbow' as const, offhand: 'worn-quiver' as const };

  it('is agility, the bow and the arrow, and reaches as far as the bow', () => {
    const stats = computeEffectiveStats('ranger', quivered, 1, {}, 'crude-arrows');
    expect(stats.attackStat).toBe('agility');
    expect(stats.attackPower).toBe(CLASSES.ranger.baseStats.agility + 2 + 1);
    expect(stats.attackRange).toBe(weaponAttackRange('shortbow'));
  });

  it('is a punch with nothing nocked: the class’s stat, a fist’s reach, no bow and no arrow', () => {
    const stats = computeEffectiveStats('ranger', quivered, 1, {}, null);
    expect(stats.attackPower).toBe(CLASSES.ranger.baseStats.agility);
    expect(stats.attackRange).toBe(UNARMED_ATTACK_RANGE);
    expect(weaponSkillFor('shortbow', null)).toBe('unarmed');
    expect(weaponSkillFor('shortbow', 'crude-arrows')).toBe('archery');
  });

  it('is a bad idea for a warrior, who draws it with the little agility a warrior has', () => {
    const sword = computeEffectiveStats('warrior', { ...NO_GEAR, weapon: 'rusty-sword' }, 5);
    const bow = computeEffectiveStats('warrior', quivered, 5, {}, 'crude-arrows');
    expect(bow.attackStat).toBe('agility');
    expect(bow.attackPower).toBeLessThan(sword.attackPower / 2);
  });

  it('is the same bad idea for a wizard', () => {
    const staff = computeEffectiveStats('wizard', { ...NO_GEAR, weapon: 'apprentice-wand' }, 5);
    const bow = computeEffectiveStats('wizard', quivered, 5, {}, 'crude-arrows');
    expect(bow.attackPower).toBeLessThan(staff.attackPower / 2);
  });

  it('grows with the ranger along agility, and with nobody else', () => {
    expect(computeEffectiveStats('ranger', quivered, 5).agility).toBe(
      CLASSES.ranger.baseStats.agility + 4 * CLASSES.ranger.baseStats.perLevel.agility,
    );
    expect(CLASSES.warrior.baseStats.perLevel.agility).toBe(0);
    expect(CLASSES.wizard.baseStats.perLevel.agility).toBe(0);
  });
});

describe('agility and the crit', () => {
  it('adds to the weapon skill’s chance rather than sharing its ceiling', () => {
    expect(agilityCritChance(0)).toBe(0);
    expect(agilityCritChance(10)).toBeCloseTo(0.05);
    // Capped on its own, and on top of a skill that is capped on its own.
    expect(agilityCritChance(1000)).toBe(agilityCritChance(30));
    expect(critChance(1000) + agilityCritChance(1000)).toBeGreaterThan(critChance(1000));
  });

  it('lands a physical hit hard off agility alone', () => {
    // Variance roll, then the crit roll: under agility's share and no skill.
    const rolls = [0.5, 0.04];
    const rng = () => rolls.shift() ?? 0.5;
    expect(resolveAttack({ attackPower: 10, weaponSkillLevel: 0, agility: 10 }, rng).crit).toBe(
      true,
    );
  });

  it('is left out of a spell, and kept for a shot', () => {
    const rolls = () => {
      const queue = [0.5, 0.04];
      return () => queue.shift() ?? 0.5;
    };
    expect(resolveAbilityDamage(ABILITIES.fireball, 10, 0, rolls(), 40).crit).toBe(false);
    expect(resolveAbilityDamage(ABILITIES['aimed-shot'], 10, 0, rolls(), 40).crit).toBe(true);
  });
});
