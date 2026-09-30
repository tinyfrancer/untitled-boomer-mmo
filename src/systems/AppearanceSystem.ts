import { ITEMS } from '../data/items';
import type { ItemId, OffhandShapeId, WeaponShapeId } from '../types/ids';
import type { Gear } from './InventorySystem';

export const BASE_FIGURE_COLOR = 0x111111;
// The bare head is drawn in skin rather than the limb black: a near-black head
// needed a white rim to stay readable on dark tiles, and that rim read as a halo.
export const SKIN_COLOR = 0xe0b088;

/**
 * The stick figure's landmark points, as fractions of whatever box it is drawn
 * in: the character sheet's paperdoll (`hud/paperdoll.ts`). The 3D figure in
 * the world was built on the same rig so the two agreed about where a shoulder
 * is; the world's figure is pixel art put together from what is worn since B4
 * (`art/outfit.ts`), and the sheet is B8's to redraw to match it.
 */
export interface StickFigure {
  cx: number;
  headCenterY: number;
  headRadius: number;
  shoulderY: number;
  hipY: number;
  footY: number;
  leftHandX: number;
  rightHandX: number;
  limbWidth: number;
}

export function stickFigure(size: number): StickFigure {
  const cx = size / 2;
  const headRadius = size * 0.11;
  const headCenterY = size * 0.18;
  return {
    cx,
    headCenterY,
    headRadius,
    shoulderY: headCenterY + headRadius + size * 0.03,
    hipY: size * 0.6,
    footY: size * 0.92,
    leftHandX: cx - size * 0.22,
    rightHandX: cx + size * 0.22,
    limbWidth: size * 0.055,
  };
}

export interface WeaponAppearance {
  shape: WeaponShapeId;
  color: number;
}

/** The stone a staff is topped with, which is not the item's own colour. */
export const WEAPON_GEM_COLOR = 0xffd54f;

export type WeaponHead =
  | { kind: 'gem'; radius: number }
  // A wedge biting outward from the end of the haft.
  | { kind: 'blade'; reach: number; drop: number }
  /**
   * A stave bent away from its string: `depth` is how far the middle of the
   * bow stands off the straight line between its two ends, where the string
   * runs. The only head that is not at the tip, since a bow is held by its
   * middle and is all head.
   */
  | { kind: 'bend'; depth: number };

/**
 * How a weapon hangs off the grip, measured along the weapon's own axis:
 * `butt` of it runs behind the hand and `tip` in front, and the far end stands
 * `lean` off the line straight up out of the grip — so the shaft is always
 * `butt + tip` long, however far it is tipped over.
 */
export interface WeaponRig {
  butt: number;
  tip: number;
  lean: number;
  thickness: number;
  /** A crossguard: how far above the grip, and how far out each side. */
  guard: { above: number; reach: number } | null;
  head: WeaponHead | null;
}

// As fractions of the figure's size, so the sheet can draw them in whatever
// box it is laid out in.
const WEAPON_RIGS: Record<WeaponShapeId, WeaponRig> = {
  sword: {
    butt: 0.07,
    tip: 0.32,
    lean: 0,
    thickness: 0.04,
    guard: { above: 0.035, reach: 0.05 },
    head: null,
  },
  // Taller than a sword and planted upright, a stone at its head: a staff, which
  // is what the wizard's weapons are drawn as since a wand read as a dagger
  // (decision 107).
  staff: {
    butt: 0.2,
    tip: 0.36,
    lean: 0,
    thickness: 0.03,
    guard: null,
    head: { kind: 'gem', radius: 0.045 },
  },
  pole: { butt: 0.22, tip: 0.36, lean: 0.16, thickness: 0.03, guard: null, head: null },
  axe: {
    butt: 0.16,
    tip: 0.32,
    lean: 0,
    thickness: 0.035,
    guard: null,
    head: { kind: 'blade', reach: 0.11, drop: 0.14 },
  },
  // The axe's haft under a head that reaches further and bites shallower: a
  // wedge for splitting where the axe's is a wedge for chopping, which is the
  // whole of what separates the two at the size either is ever drawn.
  pick: {
    butt: 0.18,
    tip: 0.34,
    lean: 0,
    thickness: 0.035,
    guard: null,
    head: { kind: 'blade', reach: 0.17, drop: 0.05 },
  },
  // Held by the middle, so as much of it runs below the hand as above, and
  // stood straight up: a bow leant over like a pole reads as a stick with a
  // thread on it at the size a figure is drawn.
  bow: {
    butt: 0.27,
    tip: 0.27,
    lean: 0,
    thickness: 0.03,
    guard: null,
    head: { kind: 'bend', depth: 0.09 },
  },
};

export function weaponRig(shape: WeaponShapeId, size: number): WeaponRig {
  const rig = WEAPON_RIGS[shape];
  return {
    butt: rig.butt * size,
    tip: rig.tip * size,
    lean: rig.lean * size,
    thickness: rig.thickness * size,
    guard: rig.guard ? { above: rig.guard.above * size, reach: rig.guard.reach * size } : null,
    head: scaleHead(rig.head, size),
  };
}

function scaleHead(head: WeaponHead | null, size: number): WeaponHead | null {
  if (!head) {
    return null;
  }
  switch (head.kind) {
    case 'gem':
      return { kind: 'gem', radius: head.radius * size };
    case 'blade':
      return { kind: 'blade', reach: head.reach * size, drop: head.drop * size };
    case 'bend':
      return { kind: 'bend', depth: head.depth * size };
  }
}

/** What a bow's string is drawn in: pale, and thin. */
export const BOWSTRING_COLOR = 0xeceff1;

export interface Appearance {
  headColor: number;
  torsoColor: number;
  legColor: number;
  weapon: WeaponAppearance | null;
  // What the other hand is holding. Null for everyone who is holding nothing,
  // which is every NPC and every character with the slot empty.
  offhand: OffhandAppearance | null;
}

export interface OffhandAppearance {
  shape: OffhandShapeId;
  color: number;
}

function equipmentColor(itemId: ItemId | null): number | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return null;
  }
  return item.color;
}

function weaponAppearance(itemId: ItemId | null): WeaponAppearance | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment' || !item.weaponShape) {
    return null;
  }
  return { shape: item.weaponShape, color: item.color };
}

function offhandAppearance(itemId: ItemId | null): OffhandAppearance | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment' || !item.offhandShape) {
    return null;
  }
  return { shape: item.offhandShape, color: item.color };
}

export function computeAppearance(gear: Gear): Appearance {
  return {
    headColor: equipmentColor(gear.helmet) ?? SKIN_COLOR,
    torsoColor: equipmentColor(gear.chest) ?? BASE_FIGURE_COLOR,
    legColor: equipmentColor(gear.pants) ?? BASE_FIGURE_COLOR,
    weapon: weaponAppearance(gear.weapon),
    offhand: offhandAppearance(gear.offhand),
  };
}
