import { describe, expect, it } from 'vitest';
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
      weapon: 'apprentice-wand',
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
    expect(character.skills).toEqual({
      woodcutting: { level: 1, xp: 0 },
      fishing: { level: 1, xp: 0 },
      cooking: { level: 1, xp: 0 },
    });
  });

  it('stamps the current CHARACTER_STATE_VERSION', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.version).toBe(CHARACTER_STATE_VERSION);
  });
});
