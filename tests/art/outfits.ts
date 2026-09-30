import type { SpriteDef } from '../../src/art/format';
import { getupSprite, playerGetup } from '../../src/art/outfit';
import { CLASSES } from '../../src/data/classes';
import { ITEMS } from '../../src/data/items';
import { DEFAULT_LOOK, HAIRSTYLES } from '../../src/data/looks';
import { NO_GEAR, type Gear } from '../../src/systems/InventorySystem';
import type { ClassId, HairstyleId, ItemId } from '../../src/types/ids';

/**
 * Figures put together for the art tests to hold to the budget, the palette
 * and the outline: each class as it starts, each hairstyle, and every piece of
 * gear the game has, one at a time on the class it suits.
 */

/** A class as it starts: its weapon, and the quiver a ranger carries. */
export function starting(classId: ClassId, gear: Partial<Gear> = {}): SpriteDef {
  const definition = CLASSES[classId];
  return getupSprite(
    `start-${classId}`,
    playerGetup(classId, DEFAULT_LOOK, {
      ...NO_GEAR,
      weapon: definition.startingWeaponId,
      offhand: definition.startingOffhandId ?? null,
      ...gear,
    }),
  );
}

export const WARRIOR = starting('warrior');
export const WIZARD = starting('wizard');
export const RANGER = starting('ranger');

// Who is shown wearing each kind of thing: a caster's things on the wizard, a
// bow and a quiver on the ranger, the rest on the warrior.
function wearer(itemId: ItemId): ClassId {
  const item = ITEMS[itemId];
  if (item.kind !== 'equipment') return 'warrior';
  if (item.weaponShape === 'staff' || item.offhandShape === 'orb') return 'wizard';
  if (item.weaponShape === 'bow' || item.offhandShape === 'quiver') return 'ranger';
  return 'warrior';
}

const EVERY_ITEM: readonly SpriteDef[] = (Object.keys(ITEMS) as ItemId[])
  .filter((itemId) => ITEMS[itemId].kind === 'equipment')
  .map((itemId) => {
    const item = ITEMS[itemId];
    if (item.kind !== 'equipment') throw new Error(itemId);
    const classId = wearer(itemId);
    const bow = item.slot === 'weapon' && item.weaponShape === 'bow';
    const gear: Gear = {
      ...NO_GEAR,
      [item.slot]: itemId,
      ...(bow ? { offhand: 'worn-quiver' } : {}),
    };
    return getupSprite(`wearing-${itemId}`, playerGetup(classId, DEFAULT_LOOK, gear));
  });

const EVERY_HAIRSTYLE: readonly SpriteDef[] = (Object.keys(HAIRSTYLES) as HairstyleId[]).map(
  (hairstyle) =>
    getupSprite(
      `hair-${hairstyle}`,
      playerGetup('warrior', { ...DEFAULT_LOOK, hairstyle }, { ...NO_GEAR, weapon: 'rusty-sword' }),
    ),
);

/** Every figure the tests hold to what a sprite must be. */
export const OUTFITS: readonly SpriteDef[] = [
  WARRIOR,
  WIZARD,
  RANGER,
  ...EVERY_HAIRSTYLE,
  ...EVERY_ITEM,
];
