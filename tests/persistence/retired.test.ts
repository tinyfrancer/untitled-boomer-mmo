import { describe, expect, it } from 'vitest';
import { CHARACTER_STATE_VERSION, createNewCharacter } from '../../src/persistence/CharacterState';
import { retiredCharacter, retiredLine, retiredReason } from '../../src/persistence/retired';

// The last save version 1 wrote, as it wrote it.
const brom = { ...createNewCharacter('Brom', 'warrior'), version: 27, level: 8 };

describe('who retired with version 1', () => {
  it('is read off a version 1 save', () => {
    expect(retiredCharacter(brom)).toEqual({ name: 'Brom', level: 8, classId: 'warrior' });
    expect(retiredCharacter({ ...brom, version: 4, name: '  Brom ' })?.name).toBe('Brom');
  });

  it('is nobody for a version 2 save, or one too damaged to name them', () => {
    expect(retiredCharacter({ ...brom, version: CHARACTER_STATE_VERSION })).toBeNull();
    expect(retiredCharacter({ ...brom, name: ' ' })).toBeNull();
    expect(retiredCharacter({ ...brom, level: 0 })).toBeNull();
    expect(retiredCharacter({ ...brom, classId: 'paladin' })).toBeNull();
    expect(retiredCharacter({ ...brom, classId: 'toString' })).toBeNull();
    expect(retiredCharacter({ version: 27 })).toBeNull();
    expect(retiredCharacter(null)).toBeNull();
  });

  it('is named once on the creation screen, with what their class was', () => {
    expect(retiredLine({ name: 'Brom', level: 8, classId: 'warrior' })).toBe(
      'Brom, level 8 warrior, retired with version 1. Version 2 is a fresh start.',
    );
  });

  it('is the reason a version 1 file does not load, in its own words', () => {
    expect(retiredReason({ ...brom, classId: 'ranger', name: 'Wren', level: 3 })).toBe(
      'That save is from version 1, and Wren, level 3 ranger, retired with it. Version 2 is a fresh start.',
    );
    expect(retiredReason({ version: 4 })).toBe(
      'That save is from version 1, whose characters retired with it. Version 2 is a fresh start.',
    );
  });
});
