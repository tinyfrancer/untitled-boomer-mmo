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

describe('CharacterController gear', () => {
  it('equips from the inventory and swaps the old piece back in', () => {
    const character = makeController();
    // warrior starts with the rusty sword equipped and the tools in the bag
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
