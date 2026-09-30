import { describe, expect, it } from 'vitest';
import { expandFrames } from '../../src/art/compile';
import type { SpriteDef } from '../../src/art/format';
import {
  PLAYER_SPRITE,
  getupSprite,
  playerGetup,
  playerSprite,
  portrait,
} from '../../src/art/outfit';
import { parseColourRef } from '../../src/art/palette';
import { OFFHANDS, WIELDS, WORN } from '../../src/art/wardrobe';
import { ITEMS } from '../../src/data/items';
import { DEFAULT_LOOK, HAIRSTYLES } from '../../src/data/looks';
import { NO_GEAR, type Gear } from '../../src/systems/InventorySystem';
import type { ClassId, HairstyleId, ItemId } from '../../src/types/ids';

/**
 * A person put together from what they are and what they have on (decision
 * 107). The budget, the palette and the outline are held for every item by
 * `sprites.test.ts` (over `outfits.ts`); this holds what the putting together
 * promises.
 */

const dressed = (gear: Partial<Gear>, classId: ClassId = 'warrior', look = DEFAULT_LOOK) =>
  playerSprite(classId, look, { ...NO_GEAR, ...gear });

/** Every ramp a sprite is drawn in. */
const ramps = (def: SpriteDef): Set<string> =>
  new Set(Object.values(def.legend).map((ref) => parseColourRef(ref)?.ramp ?? ref));

/** Its standing frame facing the viewer, as text. */
const standing = (def: SpriteDef): string => {
  const idle = def.animations.idle;
  if (!idle || !('down' in idle)) throw new Error(`${def.id} does not stand`);
  return (idle.down[0] ?? []).join('\n');
};

describe('the wardrobe', () => {
  it('draws every piece of gear the game has as itself, not by a fallback', () => {
    const undrawn = (Object.keys(ITEMS) as ItemId[]).filter((itemId) => {
      const item = ITEMS[itemId];
      if (item.kind !== 'equipment') return false;
      if (item.slot === 'weapon') return !WIELDS[itemId];
      if (item.slot === 'offhand') return !OFFHANDS[itemId];
      return !WORN[itemId];
    });
    expect(undrawn).toEqual([]);
  });

  it('dyes each slot a ramp of its own, so a steel helm can sit over studded legs', () => {
    const def = dressed({
      helmet: 'steel-helmet',
      chest: 'iron-chestplate',
      pants: 'studded-legs',
      offhand: 'grave-shield',
      weapon: 'steel-axe',
    });
    const drawn = ramps(def);
    for (const ramp of ['tierSteel', 'tierIron', 'tierStudded', 'grave']) {
      expect(drawn.has(ramp), ramp).toBe(true);
    }
    expect(drawn.has('tier'), 'the neutral ramp is never drawn').toBe(false);
  });

  it('draws a tier as a recolour of one piece, not a drawing of its own', () => {
    const iron = dressed({ helmet: 'iron-helmet' });
    const steel = dressed({ helmet: 'steel-helmet' });
    expect(standing(iron)).toBe(standing(steel));
    expect(iron.legend).not.toEqual(steel.legend);
  });

  it('puts every piece somewhere on the figure', () => {
    const bare = standing(dressed({}));
    for (const itemId of Object.keys(ITEMS) as ItemId[]) {
      const item = ITEMS[itemId];
      if (item.kind !== 'equipment') continue;
      const def = dressed({ [item.slot]: itemId });
      const same =
        standing(def) === bare && JSON.stringify(def.legend) === JSON.stringify(dressed({}).legend);
      expect(same, itemId).toBe(false);
    }
  });
});

describe('the look', () => {
  it('draws the skin and the hair chosen', () => {
    const def = dressed({}, 'warrior', { skin: 'deep', hair: 'red', hairstyle: 'long' });
    expect(ramps(def).has('skinDeep')).toBe(true);
    expect(ramps(def).has('hairRed')).toBe(true);
    expect(ramps(def).has('skin')).toBe(false);
  });

  it('draws every hairstyle as a head of its own', () => {
    const heads = (Object.keys(HAIRSTYLES) as HairstyleId[]).map((hairstyle) =>
      standing(dressed({}, 'warrior', { ...DEFAULT_LOOK, hairstyle })),
    );
    expect(new Set(heads).size).toBe(heads.length);
  });

  it('draws the same person whatever the class, bar what the class starts in', () => {
    // The look is the character's; the class decides the garment and its colour.
    const warrior = dressed({}, 'warrior');
    const ranger = dressed({}, 'ranger');
    expect(standing(warrior)).toBe(standing(ranger));
    expect(ramps(warrior).has('blue')).toBe(true);
    expect(ramps(ranger).has('forest')).toBe(true);
  });
});

describe('what a figure does', () => {
  const animations = (gear: Partial<Gear>, classId: ClassId = 'warrior') =>
    Object.keys(
      getupSprite('test', playerGetup(classId, DEFAULT_LOOK, { ...NO_GEAR, ...gear })).animations,
    );

  it('swings what it holds, casts from its other hand, and shoots only with a bow', () => {
    expect(animations({ weapon: 'rusty-sword' })).toEqual(
      expect.arrayContaining(['idle', 'walk', 'attack', 'cast', 'hurt', 'death']),
    );
    expect(animations({ weapon: 'rusty-sword' })).not.toContain('shoot');
    expect(animations({ weapon: 'apprentice-wand' }, 'wizard')).toContain('cast');
    expect(animations({ weapon: 'shortbow', offhand: 'worn-quiver' }, 'ranger')).toContain('shoot');
  });

  it('leaves no hand to cast from with a bow drawn or a shield on the arm', () => {
    expect(animations({ weapon: 'shortbow' }, 'ranger')).not.toContain('cast');
    expect(animations({ weapon: 'rusty-sword', offhand: 'brown-shield' })).not.toContain('cast');
    // An orb or a lantern is held up in the hand the spell leaves.
    expect(
      animations({ weapon: 'apprentice-wand', offhand: 'apprentice-orb' }, 'wizard'),
    ).toContain('cast');
  });

  it('is drawn under one id whatever it has on, which the view compiles again when that changes', () => {
    expect(dressed({}).id).toBe(PLAYER_SPRITE);
    expect(dressed({ helmet: 'barrow-crown' }).id).toBe(PLAYER_SPRITE);
    expect(expandFrames(dressed({})).length).toBe(
      expandFrames(dressed({ helmet: 'barrow-crown' })).length,
    );
  });

  it('pictures a person facing the viewer, for the creation screen', () => {
    const picture = portrait(
      playerGetup('wizard', DEFAULT_LOOK, { ...NO_GEAR, weapon: 'apprentice-wand' }),
    );
    expect([picture.width, picture.height]).toEqual([32, 48]);
    expect(picture.pixels).toHaveLength(32 * 48 * 4);
    expect([...picture.pixels].some((byte, index) => index % 4 === 3 && byte === 0xff)).toBe(true);
  });
});
