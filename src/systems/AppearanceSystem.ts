import { ITEMS } from '../data/items';
import type { ItemId, NpcId, OffhandShapeId, WeaponShapeId } from '../types/ids';
import type { Gear } from './InventorySystem';

export const BASE_FIGURE_COLOR = 0x111111;
// The bare head is drawn in skin rather than the limb black: a near-black head
// needed a white rim to stay readable on dark tiles, and that rim read as a halo.
export const SKIN_COLOR = 0xe0b088;

// Where the two feet sit, as fractions of the figure's size either side of
// centre. Phase 0 is the stance the figure stands in; 1 and 2 are the halves of
// a stride, alternated to make a walk.
export type LegPhase = 0 | 1 | 2;

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

/**
 * The stick figure's landmark points, as fractions of whatever box it is drawn
 * in. Two things draw from this rig — the figure in the world
 * (`render3d/figure.ts`) and the character sheet's paperdoll — and they have to
 * agree about where a shoulder is or the sheet stops being a picture of your
 * character.
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

/** The gem a wand is tipped with, which is not the item's own colour. */
export const WEAPON_GEM_COLOR = 0xffd54f;

export type WeaponHead =
  | { kind: 'gem'; radius: number }
  // A wedge biting outward from the end of the haft.
  | { kind: 'blade'; reach: number; drop: number };

/**
 * How a weapon hangs off the grip, measured along the weapon's own axis:
 * `butt` of it runs behind the hand and `tip` in front, and the far end stands
 * `lean` off the line straight up out of the grip — so the shaft is always
 * `butt + tip` long, however far it is tipped over.
 *
 * Both drawers had their own `switch (shape)` with proportions matched by eye,
 * which is the argument that put the body's rig here: a sword the sheet draws
 * two thirds the length the world draws it is the sheet drawing a different
 * sword. What each one still owns is what it draws them *out of* — strokes on a
 * 100-unit box, meshes standing in tiles — and the flourishes beyond the rig,
 * the way the bandit's bandana stays with whatever is drawing the bandit.
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

// As fractions of the figure's size, which is the only form both drawers can
// share — one measures in a box a hundred units tall, the other in tiles.
const WEAPON_RIGS: Record<WeaponShapeId, WeaponRig> = {
  sword: {
    butt: 0.07,
    tip: 0.32,
    lean: 0,
    thickness: 0.04,
    guard: { above: 0.035, reach: 0.05 },
    head: null,
  },
  wand: {
    butt: 0,
    tip: 0.23,
    lean: 0.06,
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
  return head.kind === 'gem'
    ? { kind: 'gem', radius: head.radius * size }
    : { kind: 'blade', reach: head.reach * size, drop: head.drop * size };
}

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

/**
 * The figures nobody is wearing gear for: the three who stand in town, the
 * bandit, and the one bandit worth telling apart from the rest.
 *
 * They are the same rig as the player with no `CharacterState` behind them, so
 * the colours have to come from somewhere — and from here rather than from
 * either renderer, for the reason `TILE_COLORS` is shared: a bandit in outlaw
 * grey on one renderer and in something else on the other is two renderers
 * drawing different games. The flourishes each one carries beyond the rig (the
 * shopkeeper's coin, the bandit's bandana) stay with whatever is drawing them.
 */
export const NPC_APPEARANCES = {
  shopkeeper: {
    headColor: SKIN_COLOR,
    torsoColor: 0xffb300,
    legColor: 0x8d6e63,
    weapon: null,
    offhand: null,
  },
  // The other counter, and deliberately nothing like the first: the two stand
  // a few steps apart either side of the crossroads, so which one you are
  // walking toward has to be answerable at a glance rather than off the plate.
  banker: {
    headColor: SKIN_COLOR,
    torsoColor: 0x26a69a,
    legColor: 0x37474f,
    weapon: null,
    offhand: null,
  },
  // The third counter, and the only one of them holding anything: what they
  // teach is swung, so they are drawn carrying the thing a warrior opens with.
  trainer: {
    headColor: SKIN_COLOR,
    torsoColor: 0x8e24aa,
    legColor: 0x4a148c,
    weapon: { shape: 'sword', color: 0xd7ccc8 },
    offhand: null,
  },
  // The fourth, and the second one holding something: the board's work is out
  // in the zones, so they are drawn kitted for the road rather than for a desk.
  quartermaster: {
    headColor: SKIN_COLOR,
    torsoColor: 0x33691e,
    legColor: 0x1b5e20,
    weapon: null,
    offhand: { shape: 'shield', color: 0x795548 },
  },
  bandit: {
    headColor: SKIN_COLOR,
    torsoColor: 0x757575,
    legColor: 0x424242,
    // The short dagger it holds; a sword's blade-up shape at a smaller size.
    weapon: { shape: 'sword', color: 0xb0bec5 },
    offhand: null,
  },
  // Same outlaw, richer: a stolen coat over the grey, and the blade he drops.
  'bandit-chief': {
    headColor: SKIN_COLOR,
    torsoColor: 0x4e342e,
    legColor: 0x3e2723,
    weapon: { shape: 'sword', color: 0xeceff1 },
    offhand: null,
  },
  // Keyed by `NpcId` rather than by a hand-written list of names, so a new
  // person standing in a town is a compile error here until they have a look.
} as const satisfies Record<NpcId | 'bandit' | 'bandit-chief', Appearance>;

/** The bandana over the bandit's face, which is not part of the rig. */
export const BANDIT_MASK_COLOR = 0xc62828;

// The chief's, which is the thing he drops: dark where the men outside wear
// red, so a glance at the room says which one he is.
export const CHIEF_MASK_COLOR = 0x8e1c1c;

// A pure function of everything the figure draws, so two looks share a key
// exactly when they draw the same. That is what lets a view detect a gear
// change by comparison rather than by being told about one.
export function appearanceKey(appearance: Appearance): string {
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
