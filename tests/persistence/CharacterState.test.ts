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

  it('starts carrying both gathering tools and nothing else', () => {
    const character = createNewCharacter('Aria', 'wizard');
    expect(character.inventory).toEqual({ 'felling-axe': 1, 'fishing-pole': 1 });
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
