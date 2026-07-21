import { describe, expect, it } from 'vitest';
import { CHARACTER_STATE_VERSION, createNewCharacter } from '../../src/persistence/CharacterState';

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

  it('starts with an empty inventory', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.inventory).toEqual({});
  });

  it('stamps the current CHARACTER_STATE_VERSION', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.version).toBe(CHARACTER_STATE_VERSION);
  });
});
