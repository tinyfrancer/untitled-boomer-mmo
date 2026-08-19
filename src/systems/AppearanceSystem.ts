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
  // The fifth, out at Greyford. Leather and canvas rather than a shopkeeper's
  // apron: everything they deal in arrives on somebody's back.
  outfitter: {
    headColor: SKIN_COLOR,
    torsoColor: 0x6d4c41,
    legColor: 0x4e342e,
    weapon: null,
    offhand: null,
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
  // Nothing like either outlaw, and it has to be: a goblin knot and a bandit
  // knot are the same rig at the same size on the same grass, so the colour is
  // the whole of how a player knows which zone they are looking at.
  'goblin-scavenger': {
    headColor: 0x7cb342,
    torsoColor: 0x55632f,
    legColor: 0x3e4a23,
    // Scavenged and re-hafted, which is what a goblin is carrying rather than a
    // dagger it was issued.
    weapon: { shape: 'axe', color: 0x9e9e9e },
    offhand: null,
  },
  // The men who work the fen. Drab and waterlogged beside the goblins' green
  // and the bandits' red, which is the same job every one of these does: two
  // knots of the same rig at the same size are told apart by colour and by
  // nothing else.
  'fen-raider': {
    headColor: 0x8d7f6a,
    torsoColor: 0x3f4a3a,
    legColor: 0x2f3830,
    // A gaff off a boat, which is what a man robbing a marsh is carrying.
    weapon: { shape: 'axe', color: 0x7a6a53 },
    offhand: null,
  },
  // The same goblin underground, and told from the one on the road west by what
  // the dark has done to it: paler, sootier, and carrying the pick it works with
  // rather than something it found.
  'goblin-miner': {
    headColor: 0x9ccc65,
    torsoColor: 0x4e463a,
    legColor: 0x33302a,
    weapon: { shape: 'pick', color: 0x8d8d8d },
    offhand: null,
  },
  // Bone-pale, and the only figure in the game with no skin colour on it at all:
  // there being no art behind any of this, a face the colour of everyone else's
  // is a face, and what a player has to see here is that this one is not alive.
  'barrow-wight': {
    headColor: 0xd9d4c2,
    torsoColor: 0x5b5a4e,
    legColor: 0x403f38,
    // The blade it was buried holding, gone the colour of the barrow.
    weapon: { shape: 'sword', color: 0x8a8f86 },
    offhand: { shape: 'shield', color: 0x6b6a5e },
  },
  // The same dead, in what he was buried in. Gold against the wights' grey, which
  // is how a room full of one rig at one size says which of them is the king.
  'barrow-king': {
    headColor: 0xe6e0c8,
    torsoColor: 0x4a4636,
    legColor: 0x33302a,
    weapon: { shape: 'sword', color: 0xc9b458 },
    offhand: null,
  },
  /**
   * Greyford's second counter, and the only person in the game holding a hammer.
   *
   * Sooted and dark against the outfitter beside them, because the two stand
   * within sight of each other in one yard and a player crossing it has to know
   * which is which before they are close enough to read a nameplate — the same
   * argument the two goblins and the two dead are told apart by.
   */
  fettler: {
    headColor: 0xd0a97f,
    torsoColor: 0x4a3f38,
    legColor: 0x2f2a26,
    // A hammer, which the forge in town has nobody to hold.
    weapon: { shape: 'pick', color: 0x6d6a63 },
    offhand: null,
  },
  // Keyed by `NpcId` rather than by a hand-written list of names, so a new
  // person standing in a town is a compile error here until they have a look.
} as const satisfies Record<
  | NpcId
  | 'bandit'
  | 'bandit-chief'
  | 'goblin-scavenger'
  | 'fen-raider'
  | 'goblin-miner'
  | 'barrow-wight'
  | 'barrow-king',
  Appearance
>;

/** The bandana over the bandit's face, which is not part of the rig. */
export const BANDIT_MASK_COLOR = 0xc62828;

// The chief's, which is the thing he drops: dark where the men outside wear
// red, so a glance at the room says which one he is.
export const CHIEF_MASK_COLOR = 0x8e1c1c;

// The rag a goblin has tied over its face. Filthy where both bandits wear a
// colour, which is what stops a knot on the mill road reading as a knot in the
// camp from the distance the camera actually sits at.
export const GOBLIN_MASK_COLOR = 0x4a4a2e;

/** Oilskin pulled up over the mouth, against the water rather than the law. */
export const RAIDER_MASK_COLOR = 0x5a5f4a;

/** A rag against the dust, which is the one thing down there worth covering for. */
export const MINER_MASK_COLOR = 0x6b5f4a;

/**
 * The grave-wrapping across the wight's face, and the one entry here that is not
 * a mask in the sense the others are — nobody tied it on to hide behind it. It
 * is the same slot on the rig, which is the point: the wights are drawn with the
 * machinery the outlaws already needed rather than with a bandage of their own.
 */
export const WIGHT_WRAP_COLOR = 0xb9b3a0;

/** His, in the gold he was laid out in. */
export const BARROW_KING_WRAP_COLOR = 0xc9b458;

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
