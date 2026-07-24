import { describe, expect, it } from 'vitest';
import { CharacterController } from '../../src/systems/CharacterController';
import { createNewCharacter } from '../../src/persistence/CharacterState';
import { xpToNextLevel } from '../../src/systems/LevelingSystem';
import { xpToReachLevel } from '../../src/data/xpTable';

function makeController(): CharacterController {
  return new CharacterController(createNewCharacter('Testy', 'warrior'));
}

describe('CharacterController inventory', () => {
  it('adds and removes items through the state', () => {
    const character = makeController();
    character.addItem('logs', 3);
    expect(character.itemCount('logs')).toBe(3);
    character.removeItem('logs', 2);
    expect(character.itemCount('logs')).toBe(1);
    character.removeItem('logs', 1);
    expect(character.state.inventory.logs).toBeUndefined();
  });

  it('counts a missing item as zero', () => {
    expect(makeController().itemCount('logs')).toBe(0);
  });
});

describe('CharacterController encumbrance', () => {
  it('starts a fresh character with an empty pack and room in it', () => {
    const character = makeController();
    expect(character.carriedWeight()).toBe(0);
    expect(character.carryCapacity()).toBeGreaterThan(0);
  });

  it('takes an item that fits', () => {
    const character = makeController();
    expect(character.tryAddItem('logs', 2)).toBe(true);
    expect(character.itemCount('logs')).toBe(2);
  });

  it('refuses an item that does not fit, and adds nothing at all', () => {
    const character = makeController();
    const capacity = character.carryCapacity();
    // Fill the pack to the brim with weight-1 bones, then ask for one more.
    character.addItem('rat-bones', capacity);
    expect(character.tryAddItem('rat-bones', 1)).toBe(false);
    expect(character.itemCount('rat-bones')).toBe(capacity);
    expect(character.carriedWeight()).toBe(capacity);
  });

  it('reports what it would refuse before being asked to do it', () => {
    const character = makeController();
    character.addItem('rat-bones', character.carryCapacity());
    expect(character.canCarryItem('logs', 1)).toBe(false);
  });

  // Capacity comes from effective strength, so the leather that raises it
  // raises what the character can haul too.
  it('grows capacity with the strength gear buys', () => {
    const character = makeController();
    const bare = character.carryCapacity();
    character.addItem('brown-chestplate', 1);
    character.equip('brown-chestplate');
    expect(character.carryCapacity()).toBeGreaterThan(bare);
  });

  it('stops charging for gear once it is worn rather than carried', () => {
    const character = makeController();
    character.addItem('brown-helmet', 1);
    const carried = character.carriedWeight();
    character.equip('brown-helmet');
    expect(character.carriedWeight()).toBeLessThan(carried);
  });
});

describe('CharacterController currency', () => {
  it('adds and spends copper against the state', () => {
    const character = makeController();
    const start = character.state.currency;
    character.addCurrency(50);
    expect(character.state.currency).toBe(start + 50);
    expect(character.spendCurrency(30)).toBe(true);
    expect(character.state.currency).toBe(start + 20);
  });

  it('refuses to overspend and deducts nothing', () => {
    const character = makeController();
    const start = character.state.currency;
    expect(character.spendCurrency(start + 1)).toBe(false);
    expect(character.state.currency).toBe(start);
  });

  it('ignores negative amounts on both sides', () => {
    const character = makeController();
    const start = character.state.currency;
    character.addCurrency(-100);
    expect(character.state.currency).toBe(start);
    expect(character.spendCurrency(-5)).toBe(false);
  });
});

describe('CharacterController gear', () => {
  it('equips from the inventory and swaps the old piece back in', () => {
    const character = makeController();
    character.addItem('felling-axe', 1);
    // the warrior starts with the rusty sword equipped
    expect(character.state.gear.weapon).toBe('rusty-sword');
    character.equip('felling-axe');
    expect(character.state.gear.weapon).toBe('felling-axe');
    expect(character.itemCount('rusty-sword')).toBe(1);
    expect(character.itemCount('felling-axe')).toBe(0);
  });

  it('unequips back into the inventory', () => {
    const character = makeController();
    character.unequip('weapon');
    expect(character.state.gear.weapon).toBeNull();
    expect(character.itemCount('rusty-sword')).toBe(1);
  });
});

describe('CharacterController xp', () => {
  it('accumulates combat xp and reports the distance to the next level', () => {
    const character = makeController();
    const gain = character.awardXp(3);
    expect(gain.leveledUp).toBe(false);
    expect(gain.level).toBe(1);
    expect(gain.xp).toBe(3);
    expect(gain.xpToNext).toBe(xpToNextLevel(1));
    expect(character.state.xp).toBe(3);
  });

  it('levels up the underlying state', () => {
    const character = makeController();
    const gain = character.awardXp(xpToReachLevel(2));
    expect(gain.leveledUp).toBe(true);
    expect(gain.level).toBe(2);
    expect(character.state.level).toBe(2);
  });

  it('accumulates skill xp with the skill id in the result', () => {
    const character = makeController();
    const gain = character.awardSkillXp('woodcutting', 10);
    expect(gain.skillId).toBe('woodcutting');
    expect(gain.xp).toBe(10);
    expect(gain.leveledUp).toBe(false);
    expect(character.state.skills.woodcutting.xp).toBe(10);
    expect(character.skillLevelOf('woodcutting')).toBe(1);
  });
});

describe('CharacterController location', () => {
  it('records zone, rounded position, and touches updatedAt', () => {
    const character = makeController();
    const before = character.state.updatedAt;
    character.recordLocation('town', 123.6, 456.4);
    expect(character.state.zoneId).toBe('town');
    expect(character.state.position).toEqual({ x: 124, y: 456 });
    expect(Date.parse(character.state.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before));
  });
});
