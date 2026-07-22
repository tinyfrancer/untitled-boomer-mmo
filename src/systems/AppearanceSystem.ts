import { ITEMS } from '../data/items';
import type { GearSlotId, WeaponShapeId } from '../types/ids';

export const BASE_FIGURE_COLOR = 0x111111;
// The bare head is drawn in skin rather than the limb black: a near-black head
// needed a white rim to stay readable on dark tiles, and that rim read as a halo.
export const SKIN_COLOR = 0xe0b088;

// Where the two feet sit, as fractions of the figure's size either side of
// centre. Phase 0 is the stance the figure stands in; 1 and 2 are the halves of
// a stride, alternated to make a walk.
export type LegPhase = 0 | 1 | 2;

export const LEG_PHASES: LegPhase[] = [0, 1, 2];

export interface LegOffsets {
  leftX: number;
  rightX: number;
}

export function legOffsets(phase: LegPhase): LegOffsets {
  switch (phase) {
    case 1:
      return { leftX: -0.2, rightX: 0.06 };
    case 2:
      return { leftX: -0.06, rightX: 0.2 };
    default:
      return { leftX: -0.13, rightX: 0.13 };
  }
}

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
    headColor: equipmentColor(gear.helmet) ?? SKIN_COLOR,
    torsoColor: equipmentColor(gear.chest) ?? BASE_FIGURE_COLOR,
    legColor: equipmentColor(gear.pants) ?? BASE_FIGURE_COLOR,
    weapon: weaponAppearance(gear.weapon),
  };
}

// The key is a pure function of everything the figure draws, which is what makes
// it safe to cache one generated texture per distinct look. The leg phase is part
// of that, so one appearance bakes one texture per frame of its walk.
export function appearanceTextureKey(appearance: Appearance, phase: LegPhase = 0): string {
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
    phase,
  ].join(':');
}

// The animation built from those textures; one per distinct look.
export function walkAnimationKey(appearance: Appearance): string {
  return `${appearanceTextureKey(appearance)}:walk`;
}
