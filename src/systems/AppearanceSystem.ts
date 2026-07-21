import { ITEMS } from '../data/items';
import type { GearSlotId, WeaponShapeId } from '../types/ids';

export const BASE_FIGURE_COLOR = 0x111111;

export interface WeaponAppearance {
  shape: WeaponShapeId;
  color: number;
}

export interface Appearance {
  headColor: number;
  torsoColor: number;
  legColor: number;
  weapon: WeaponAppearance | null;
}

function equipmentColor(itemId: string | null): number | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return null;
  }
  return item.color;
}

function weaponAppearance(itemId: string | null): WeaponAppearance | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment' || !item.weaponShape) {
    return null;
  }
  return { shape: item.weaponShape, color: item.color };
}

export function computeAppearance(gear: Record<GearSlotId, string | null>): Appearance {
  return {
    headColor: equipmentColor(gear.helmet) ?? BASE_FIGURE_COLOR,
    torsoColor: equipmentColor(gear.chest) ?? BASE_FIGURE_COLOR,
    legColor: equipmentColor(gear.pants) ?? BASE_FIGURE_COLOR,
    weapon: weaponAppearance(gear.weapon),
  };
}

// The key is a pure function of everything the figure draws, which is what makes
// it safe to cache one generated texture per distinct look.
export function appearanceTextureKey(appearance: Appearance): string {
  const hex = (value: number) => value.toString(16).padStart(6, '0');
  const weapon = appearance.weapon
    ? `${appearance.weapon.shape}-${hex(appearance.weapon.color)}`
    : 'none';
  return [
    'player',
    hex(appearance.headColor),
    hex(appearance.torsoColor),
    hex(appearance.legColor),
    weapon,
  ].join(':');
}
