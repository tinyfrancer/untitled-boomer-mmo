import { describe, expect, it } from 'vitest';
import { createInitialSkills } from '../../src/systems/SkillSystem';
import {
  CHARACTER_STATE_VERSION,
  STARTING_COPPER,
  createNewCharacter,
} from '../../src/persistence/CharacterState';

describe('createNewCharacter', () => {
  it('sets the starting weapon and leaves helmet/chest/pants empty', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.gear).toEqual({
      helmet: null,
      chest: null,
      pants: null,
      weapon: 'apprentice-staff',
      offhand: null,
    });
  });

  it('starts with an empty bag and coin for one shop tool', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.inventory).toEqual({});
    expect(character.currency).toBe(STARTING_COPPER);
  });

  it('starts in the town zone', () => {
    expect(createNewCharacter('Aria', 'wizard').zoneId).toBe('town');
  });

  it('starts every skill at level 1 with no xp', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.skills).toEqual(createInitialSkills());
    expect(Object.values(character.skills)).not.toHaveLength(0);
    Object.values(character.skills).forEach((skill) => expect(skill).toEqual({ level: 1, xp: 0 }));
  });

  it('starts with nothing killed and no title worn', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.kills).toEqual({});
    expect(character.activeTitleId).toBeNull();
  });

  it('stamps the current CHARACTER_STATE_VERSION', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.version).toBe(CHARACTER_STATE_VERSION);
  });
});
