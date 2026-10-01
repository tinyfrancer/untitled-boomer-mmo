import { ITEMS } from '../data/items';
import type { ArmorTypeId, GearSlotId, ItemId } from '../types/ids';
import { TIER_RAMPS, type SharedRampId } from './palette';
import {
  BANDANA,
  BREECHES,
  CAP,
  CLOAKED_PLATE,
  COWL,
  CROWN,
  GREAVES,
  HAT,
  HELM,
  HOOD,
  JERKIN,
  PLATE,
  ROBE_PIECE,
  STUDDED_JERKIN,
  TRIMMED_ROBE,
  VEST,
  type Piece,
} from './sprites/armour';
import type { Carried, Wielded } from './sprites/figure';
import {
  APPRENTICE_STAFF,
  BARROW_STAFF,
  BEARDED_AXE,
  CRYSTAL_STAFF,
  CUTLASS,
  FELLING_AXE,
  FISHING_POLE,
  HEATER_SHIELD,
  LANTERN,
  LEAF_BLADE,
  LONGBOW,
  MAUL,
  ORB,
  PICKAXE,
  ROUND_SHIELD,
  RUSTY_SWORD,
  SHORT_BOW,
  SICKLE,
} from './sprites/weapons';

/**
 * What each item is drawn as when it is worn or held (decision 107): which
 * piece a helmet, a chest or the legs put on the figure, which weapon is in
 * the hand and what fills the other one, and the ramp each is drawn in.
 *
 * Partial on purpose, the bargain `cast.ts` makes: an item with no row is drawn
 * by what the data says it is, a helmet by its armour type, a weapon by its
 * shape, so a new item is on the figure the day its row is. `wardrobe.test.ts`
 * holds every item the game has to a row of its own, so the fallback is for a
 * row added tomorrow rather than for one nobody drew.
 *
 * A ramp left unsaid is the item's tier's (`TIER_RAMPS`), which is how a tier
 * is a recolour of a piece rather than a drawing of its own.
 */

/** A helmet, a chest or the legs: the piece, and what it is dyed. */
export interface Worn {
  piece: Piece;
  ramp?: SharedRampId;
}

/** A weapon, and what each of its parts is drawn in. */
export interface Wield {
  art: Wielded;
  blade?: SharedRampId;
  haft?: SharedRampId;
  fitting?: SharedRampId;
  gem?: SharedRampId;
}

/** What fills the other hand, or the back: a shield, a light, a quiver. */
export interface Offhand {
  art: Carried | 'quiver';
  ramp?: SharedRampId;
  /** What a light casts: the glow of a spell from the hand that holds it. */
  glow?: SharedRampId;
}

export const WORN: Readonly<Partial<Record<ItemId, Worn>>> = {
  'brown-helmet': { piece: CAP },
  'studded-helmet': { piece: CAP },
  'iron-helmet': { piece: HELM },
  'steel-helmet': { piece: HELM },
  'brown-cloth-hat': { piece: HAT },
  'fenweave-hood': { piece: HOOD },
  'fenhide-cowl': { piece: COWL },
  'cutthroats-bandana': { piece: BANDANA, ramp: 'crimson' },
  'barrow-crown': { piece: CROWN, ramp: 'gold' },
  'brown-chestplate': { piece: JERKIN },
  'studded-jerkin': { piece: STUDDED_JERKIN },
  'iron-chestplate': { piece: PLATE },
  'steel-chestplate': { piece: CLOAKED_PLATE },
  'brown-robe': { piece: ROBE_PIECE },
  'fenweave-robe': { piece: TRIMMED_ROBE },
  'fenhide-vest': { piece: VEST },
  'brown-legs': { piece: BREECHES },
  'studded-legs': { piece: BREECHES },
  'brown-cloth-pants': { piece: BREECHES },
  'fenweave-leggings': { piece: BREECHES },
  'fenhide-leggings': { piece: BREECHES },
  'iron-legs': { piece: GREAVES },
  'steel-legs': { piece: GREAVES },
};

export const WIELDS: Readonly<Partial<Record<ItemId, Wield>>> = {
  'rusty-sword': { art: RUSTY_SWORD },
  'cutthroats-blade': { art: CUTLASS },
  'barrow-blade': { art: LEAF_BLADE, blade: 'tierIron', fitting: 'gold' },
  'apprentice-staff': { art: APPRENTICE_STAFF },
  'stolen-staff': { art: CRYSTAL_STAFF, gem: 'purple' },
  'barrow-staff': { art: BARROW_STAFF, haft: 'grave', gem: 'purple' },
  'brown-axe': { art: BEARDED_AXE, blade: 'tierBrown' },
  'felling-axe': { art: FELLING_AXE },
  'steel-axe': { art: FELLING_AXE, blade: 'tierSteel' },
  pickaxe: { art: PICKAXE },
  'steel-pickaxe': { art: PICKAXE, blade: 'tierSteel' },
  'goblin-maul': { art: MAUL, blade: 'masonry' },
  'fishing-pole': { art: FISHING_POLE },
  'steel-pole': { art: FISHING_POLE, haft: 'tierSteel' },
  sickle: { art: SICKLE },
  shortbow: { art: SHORT_BOW },
  'hunting-bow': { art: SHORT_BOW, haft: 'tierBrown' },
  'poachers-bow': { art: SHORT_BOW, haft: 'leather' },
  'barrow-longbow': { art: LONGBOW, haft: 'bone' },
};

export const OFFHANDS: Readonly<Partial<Record<ItemId, Offhand>>> = {
  'brown-shield': { art: ROUND_SHIELD },
  'grave-shield': { art: ROUND_SHIELD, ramp: 'grave' },
  'steel-shield': { art: HEATER_SHIELD },
  'apprentice-orb': { art: ORB, ramp: 'arcane', glow: 'arcane' },
  'grave-lantern': { art: LANTERN, ramp: 'grave', glow: 'nature' },
  'worn-quiver': { art: 'quiver', ramp: 'leather' },
  'studded-quiver': { art: 'quiver' },
  'grave-quiver': { art: 'quiver', ramp: 'grave' },
};

// What an item with no row is drawn as, by what the data says it is.
const BY_ARMOUR: Readonly<
  Record<Exclude<GearSlotId, 'weapon' | 'offhand'>, Record<ArmorTypeId, Piece>>
> = {
  helmet: { cloth: HAT, leather: CAP, plate: HELM },
  chest: { cloth: ROBE_PIECE, leather: JERKIN, plate: PLATE },
  pants: { cloth: BREECHES, leather: BREECHES, plate: GREAVES },
};

const BY_SHAPE = {
  sword: RUSTY_SWORD,
  staff: APPRENTICE_STAFF,
  axe: FELLING_AXE,
  pick: PICKAXE,
  pole: FISHING_POLE,
  bow: SHORT_BOW,
  sickle: SICKLE,
} as const;

const BY_OFFHAND = { shield: ROUND_SHIELD, orb: ORB, quiver: 'quiver' } as const;

/** The piece an armour item puts on, and its ramp; null for anything that is not armour. */
export function wornAs(itemId: ItemId | null): (Worn & { ramp: SharedRampId }) | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment' || item.slot === 'weapon' || item.slot === 'offhand') {
    return null;
  }
  const tier = item.tier ? TIER_RAMPS[item.tier] : 'leather';
  const row = WORN[item.id];
  if (row) return { piece: row.piece, ramp: row.ramp ?? tier };
  return { piece: BY_ARMOUR[item.slot][item.armorType ?? 'cloth'], ramp: tier };
}

/** The weapon a hand holds, by the item it is. */
export function wieldedAs(itemId: ItemId | null): Wield | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment' || !item.weaponShape) return null;
  const row = WIELDS[item.id];
  if (row) return row;
  const tier = item.tier ? TIER_RAMPS[item.tier] : undefined;
  return { art: BY_SHAPE[item.weaponShape], ...(tier ? { blade: tier } : {}) };
}

/** What the other hand carries, by the item it is. */
export function offhandAs(itemId: ItemId | null): (Offhand & { ramp: SharedRampId }) | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment' || !item.offhandShape) return null;
  const tier = item.tier ? TIER_RAMPS[item.tier] : 'leather';
  const row = OFFHANDS[item.id];
  if (row) return { ...row, ramp: row.ramp ?? tier };
  return { art: BY_OFFHAND[item.offhandShape], ramp: tier };
}
