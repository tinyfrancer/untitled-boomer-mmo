import type {
  ArmorTypeId,
  ClassId,
  GearSlotId,
  ItemIconShape,
  ItemId,
  OffhandShapeId,
  SkillId,
  TierId,
  WeaponShapeId,
} from '../types/ids';
import { SKILLS } from './skills';
import { TIER_COLORS } from './tiers';

// Who can wear what. Class restrictions hang off the armor type rather than off
// each item, so a new armor row inherits its rules from the type it names.
export const ARMOR_TYPE_CLASSES: Record<ArmorTypeId, ClassId[]> = {
  cloth: ['warrior', 'wizard'],
  leather: ['warrior'],
  plate: ['warrior'],
};

export const ARMOR_TYPE_LABELS: Record<ArmorTypeId, string> = {
  cloth: 'Cloth',
  leather: 'Leather',
  plate: 'Plate',
};

// What every item carries, whatever kind it is.
interface BaseItemDefinition {
  id: ItemId;
  name: string;
  // Vendor sell price in copper; absent means the item can't be sold.
  value?: number;
  // What it costs to haul around, against the carrying capacity strength buys.
  // Absent means DEFAULT_ITEM_WEIGHT — nothing is weightless.
  weight?: number;
}

interface EquipmentItemDefinition extends BaseItemDefinition {
  kind: 'equipment';
  slot: GearSlotId;
  // Color the stick figure paints this piece with: the matching body part for
  // armor, the weapon itself for weapons.
  color: number;
  tier?: TierId;
  // Armor pieces name a type, which is what decides who can wear them; weapons
  // and tools leave it unset and stay open to every class.
  armorType?: ArmorTypeId;
  weaponShape?: WeaponShapeId;
  // What fills the other hand. Same bargain `weaponShape` makes: the row says
  // what it is and both the figure and the paperdoll draw it from that.
  offhandShape?: OffhandShapeId;
  // How far this weapon can reach. Unset means melee — only something built to
  // strike at distance says so, and empty hands are shorter still.
  attackRange?: number;
  attackPowerBonus?: number;
  // What it stops, fed through the mitigation curve in CombatSystem. Armour and
  // the offhand carry it; a weapon does not.
  armorValue?: number;
  healthBonus?: number;
  strengthBonus?: number;
  intellectBonus?: number;
  // Gathering tools occupy the weapon slot, so holding one means putting your
  // sword away. This is what a resource node checks before letting you gather.
  toolFor?: SkillId;
}

/**
 * What the bag draws this as. Equipment needs none — it already says which slot
 * it fills, which shape of weapon it is and what colour to paint it, and that
 * is the whole of an icon. Everything else has to name one.
 */
export interface ItemIcon {
  shape: ItemIconShape;
  color: number;
}

interface MaterialItemDefinition extends BaseItemDefinition {
  kind: 'material';
  icon: ItemIcon;
}

interface ConsumableItemDefinition extends BaseItemDefinition {
  kind: 'consumable';
  healAmount: number;
  healDurationMs: number;
  icon: ItemIcon;
}

export type ItemDefinition =
  EquipmentItemDefinition | MaterialItemDefinition | ConsumableItemDefinition;

// The bag's palette. What cooking did to something is read off colour rather
// than shape — a raw fish, a cooked one and a burnt one are the same outline at
// the size a thumbnail is drawn — so these steps have to stay tellable apart.
const ICON_COLOR = {
  bone: 0xe8e4d8,
  rawMeat: 0xbf4a4a,
  rawCrab: 0xef9a9a,
  rawFish: 0x90a4ae,
  cookedFish: 0xc9944a,
  cookedCrab: 0xe0703c,
  // Roasted rather than seared: the worst food in the game should not look like
  // the best one, and beside the crab's orange this reads as the browner meat.
  cookedRat: 0x8a5a2b,
  // Charcoal rather than near-black: burnt food should look worthless, but the
  // cells it sits in are almost black themselves and #424242 read as an empty
  // slot rather than as a dark item.
  burnt: 0x6d6257,
  wood: 0x8d6e63,
  iron: 0xb0a48c,
  // A bar of it, which is the ore's colour cleaned up rather than a new one.
  ironBar: 0xcfd8dc,
  // The two ores, which are one rock in two colours the way the fish are one
  // outline in three: pale grey tin against the warm rust of iron.
  tinOre: 0x9aa7ad,
  ironOre: 0xa0562f,
  // Darker and greener than the fish, which is the whole of how an eel is told
  // from one at thumbnail size — the same trick the two ores play.
  rawEel: 0x4e6b52,
  cookedEel: 0xb07840,
  hide: 0x6b5140,
} as const;

export const ITEMS: Record<ItemId, ItemDefinition> = {
  'rusty-sword': {
    id: 'rusty-sword',
    name: 'Rusty Sword',
    value: 10,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    color: 0xcfd8dc,
    weaponShape: 'sword',
    attackPowerBonus: 2,
  },
  'apprentice-wand': {
    id: 'apprentice-wand',
    name: 'Apprentice Wand',
    value: 10,
    weight: 2,
    kind: 'equipment',
    slot: 'weapon',
    color: 0x8d6e63,
    weaponShape: 'wand',
    // The only weapon that reaches: shorter than Fireball, so a wizard who wants
    // real distance casts for it.
    attackRange: 200,
    attackPowerBonus: 2,
  },
  /**
   * The three off the chief, and the best of each kind in the game.
   *
   * They are the only reason to fight something that takes half a minute and
   * respawns on a timer, so they have to beat what the camp outside drops by a
   * margin worth the walk — and they are worth real coin, which is what makes a
   * second bandana something other than dead weight. The bandana is cloth on
   * purpose: it is the one piece here both classes can wear, so the trophy is
   * the same trophy whoever took it.
   */
  'cutthroats-bandana': {
    id: 'cutthroats-bandana',
    name: "Cutthroat's Bandana",
    value: 120,
    weight: 1,
    kind: 'equipment',
    slot: 'helmet',
    color: 0x8e1c1c,
    armorType: 'cloth',
    armorValue: 3,
    healthBonus: 5,
  },
  'cutthroats-blade': {
    id: 'cutthroats-blade',
    name: "Cutthroat's Blade",
    value: 150,
    weight: 4,
    kind: 'equipment',
    slot: 'weapon',
    color: 0xcfd8dc,
    weaponShape: 'sword',
    attackPowerBonus: 6,
    strengthBonus: 1,
  },
  // Taken off someone the chief robbed, which is the only reason a bandit is
  // holding one — and the only weapon upgrade a caster has ever had.
  'stolen-wand': {
    id: 'stolen-wand',
    name: 'Stolen Wand',
    value: 150,
    weight: 2,
    kind: 'equipment',
    slot: 'weapon',
    color: 0x7e57c2,
    weaponShape: 'wand',
    attackRange: 220,
    attackPowerBonus: 4,
    intellectBonus: 2,
  },
  /**
   * The offhand, and the first two things there have ever been to put in one.
   *
   * One per class, because a slot that is furniture for half the roster is a
   * dead button: the shield is leather and so a warrior's, the orb is cloth and
   * so anyone's — a warrior who wants +INT is welcome to the nothing it buys
   * them. The shield is where most of the armour on a warrior comes from, which
   * is what makes the slot worth filling rather than merely fillable.
   */
  'brown-shield': {
    id: 'brown-shield',
    name: 'Brown Shield',
    value: 45,
    weight: 6,
    kind: 'equipment',
    slot: 'offhand',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'leather',
    offhandShape: 'shield',
    armorValue: 5,
    healthBonus: 2,
  },
  'apprentice-orb': {
    id: 'apprentice-orb',
    name: 'Apprentice Orb',
    value: 45,
    weight: 2,
    kind: 'equipment',
    slot: 'offhand',
    color: 0x5c6bc0,
    armorType: 'cloth',
    offhandShape: 'orb',
    armorValue: 1,
    intellectBonus: 2,
  },
  // The one item that is not worth anything and cannot be sold: it opens a door
  // once and is gone, so a vendor price would only ever be a trap.
  'hideout-key': {
    id: 'hideout-key',
    name: 'Hideout Key',
    weight: 1,
    kind: 'material',
    icon: { shape: 'key', color: ICON_COLOR.iron },
  },
  'rat-bones': {
    id: 'rat-bones',
    name: 'Rat Bones',
    value: 2,
    kind: 'material',
    icon: { shape: 'bone', color: ICON_COLOR.bone },
  },
  'rat-meat': {
    id: 'rat-meat',
    name: 'Rat Meat',
    value: 3,
    kind: 'material',
    icon: { shape: 'meat', color: ICON_COLOR.rawMeat },
  },
  // The leather set carries strength and the cloth set intellect, never both:
  // armor that fed every stat was why nobody could tell which one mattered.
  'brown-chestplate': {
    id: 'brown-chestplate',
    name: 'Brown Chestplate',
    value: 35,
    weight: 6,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'leather',
    armorValue: 4,
    healthBonus: 1,
    strengthBonus: 1,
  },
  'brown-helmet': {
    id: 'brown-helmet',
    name: 'Brown Helmet',
    value: 25,
    weight: 4,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'leather',
    armorValue: 2,
    healthBonus: 1,
  },
  'brown-legs': {
    id: 'brown-legs',
    name: 'Brown Legs',
    value: 30,
    weight: 5,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'leather',
    armorValue: 3,
    healthBonus: 1,
    strengthBonus: 1,
  },
  'brown-robe': {
    id: 'brown-robe',
    name: 'Brown Robe',
    value: 35,
    weight: 3,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'cloth',
    armorValue: 2,
    healthBonus: 1,
    intellectBonus: 1,
  },
  'brown-cloth-hat': {
    id: 'brown-cloth-hat',
    name: 'Brown Cloth Hat',
    value: 25,
    weight: 2,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'cloth',
    armorValue: 1,
    healthBonus: 1,
  },
  'brown-cloth-pants': {
    id: 'brown-cloth-pants',
    name: 'Brown Cloth Pants',
    value: 30,
    weight: 3,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'cloth',
    armorValue: 1,
    healthBonus: 1,
    intellectBonus: 1,
  },
  'brown-axe': {
    id: 'brown-axe',
    name: 'Brown Axe',
    value: 40,
    weight: 5,
    kind: 'equipment',
    slot: 'weapon',
    color: TIER_COLORS.brown,
    tier: 'brown',
    weaponShape: 'axe',
    attackPowerBonus: 3,
  },
  // Both tools sit below the starting weapons on attack power, so gathering gear
  // can never double as a stealth combat upgrade.
  'felling-axe': {
    id: 'felling-axe',
    name: 'Felling Axe',
    value: 30,
    weight: 4,
    kind: 'equipment',
    slot: 'weapon',
    color: 0x9e9e9e,
    weaponShape: 'axe',
    attackPowerBonus: 1,
    toolFor: 'woodcutting',
  },
  'fishing-pole': {
    id: 'fishing-pole',
    name: 'Fishing Pole',
    value: 30,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    color: 0xa1887f,
    weaponShape: 'pole',
    attackPowerBonus: 0,
    toolFor: 'fishing',
  },
  // The heaviest of the three tools and the only one with a metal head, which is
  // also the only reason it hits harder than the pole: a swung rock is a swung
  // rock, and it still sits under both starting weapons.
  pickaxe: {
    id: 'pickaxe',
    name: 'Pickaxe',
    value: 30,
    weight: 6,
    kind: 'equipment',
    slot: 'weapon',
    color: 0x90a4ae,
    weaponShape: 'pick',
    attackPowerBonus: 1,
    toolFor: 'mining',
  },
  logs: {
    id: 'logs',
    name: 'Logs',
    value: 3,
    weight: 2,
    kind: 'material',
    icon: { shape: 'log', color: ICON_COLOR.wood },
  },
  /**
   * What comes out of the quarry, and the heaviest thing in the game that is
   * gathered by the armful.
   *
   * The weight is the feature. Everything else a gathering skill produces is
   * light enough that a full pack is a long session's problem; a run of ore is
   * over inside twenty swings, which is what turns the counter in town from
   * somewhere to dump loot into somewhere to keep it. Iron is the heavier and
   * the dearer of the two because it is the one behind a level.
   */
  'tin-ore': {
    id: 'tin-ore',
    name: 'Tin Ore',
    value: 5,
    weight: 3,
    kind: 'material',
    icon: { shape: 'ore', color: ICON_COLOR.tinOre },
  },
  'iron-ore': {
    id: 'iron-ore',
    name: 'Iron Ore',
    value: 10,
    weight: 4,
    kind: 'material',
    icon: { shape: 'ore', color: ICON_COLOR.ironOre },
  },
  // What the forge makes out of ore, and what it makes out of those. Bars are
  // lighter than the ore they came from: two trips of rock become one of metal,
  // which is the first thing smelting is actually worth.
  'tin-bar': {
    id: 'tin-bar',
    name: 'Tin Bar',
    value: 12,
    weight: 2,
    kind: 'material',
    icon: { shape: 'bar', color: ICON_COLOR.tinOre },
  },
  'iron-bar': {
    id: 'iron-bar',
    name: 'Iron Bar',
    value: 24,
    weight: 3,
    kind: 'material',
    icon: { shape: 'bar', color: ICON_COLOR.ironBar },
  },
  /**
   * Rat bones and a log burnt down together in the furnace, and what the plate
   * tier is case-hardened with.
   *
   * One row standing in for two dead ends: bones were ten for a quest and trash
   * forever after, and a log had exactly one use in the game. Making them into
   * one intermediate rather than naming both on every armour row is what keeps
   * a piece's cost line readable — a helmet takes bars, fittings and char, not
   * bars, fittings, bones and wood.
   *
   * Lighter than what went into it, the way a bar is lighter than its ore: what
   * comes off a fire is what is left after the water and the weight of it.
   */
  'bone-char': {
    id: 'bone-char',
    name: 'Bone Char',
    value: 8,
    weight: 1,
    kind: 'material',
    icon: { shape: 'bone', color: ICON_COLOR.burnt },
  },
  // The plate tier, and the first armour in the game nothing drops. Every piece
  // stops more than the leather it replaces and weighs more for it, which is
  // what keeps the pack a decision rather than plate being strictly better.
  'iron-helmet': {
    id: 'iron-helmet',
    name: 'Iron Helmet',
    value: 60,
    weight: 6,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.iron,
    tier: 'iron',
    armorType: 'plate',
    armorValue: 5,
    healthBonus: 2,
  },
  'iron-chestplate': {
    id: 'iron-chestplate',
    name: 'Iron Chestplate',
    value: 90,
    weight: 9,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.iron,
    tier: 'iron',
    armorType: 'plate',
    armorValue: 9,
    healthBonus: 3,
    strengthBonus: 1,
  },
  'iron-legs': {
    id: 'iron-legs',
    name: 'Iron Legs',
    value: 75,
    weight: 8,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.iron,
    tier: 'iron',
    armorType: 'plate',
    armorValue: 7,
    healthBonus: 2,
    strengthBonus: 1,
  },
  /**
   * The studded set, and the only armour in the game that is neither smithed nor
   * sold: it comes off the goblins on the road west and nowhere else.
   *
   * It sits between the brown leather it replaces and the plate a forge makes,
   * which is the point of it — the quarry is a long way from a character who has
   * just walked out of the starter band, and this is what that character wears
   * instead. Heavier than brown and lighter than iron, on the same bargain every
   * armour row makes: what stops more weighs more.
   */
  'studded-helmet': {
    id: 'studded-helmet',
    name: 'Studded Helmet',
    value: 45,
    weight: 5,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.studded,
    tier: 'studded',
    armorType: 'leather',
    armorValue: 3,
    healthBonus: 1,
  },
  'studded-jerkin': {
    id: 'studded-jerkin',
    name: 'Studded Jerkin',
    value: 65,
    weight: 7,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.studded,
    tier: 'studded',
    armorType: 'leather',
    armorValue: 6,
    healthBonus: 2,
  },
  'studded-legs': {
    id: 'studded-legs',
    name: 'Studded Legs',
    value: 55,
    weight: 6,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.studded,
    tier: 'studded',
    armorType: 'leather',
    armorValue: 5,
    healthBonus: 1,
  },
  /**
   * The fen's three, and the first armour a caster can go out and earn.
   *
   * Cloth has been the gap in the world since armour types landed: the shop
   * sells tools, the forge makes plate, and the bandits drop leather — so a
   * wizard's entire supply was two quest rewards, a bandana off a boss, and the
   * brown cloth they started in. This is what the studded set is for a warrior,
   * pointed at the other half of the roster.
   *
   * It stops less than the studded leather it sits beside and carries intellect
   * instead, which is the same bargain the brown sets already make: armour that
   * fed every stat was why nobody could tell which one mattered.
   */
  'fenweave-hood': {
    id: 'fenweave-hood',
    name: 'Fenweave Hood',
    value: 55,
    weight: 2,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.fenweave,
    tier: 'fenweave',
    armorType: 'cloth',
    armorValue: 3,
    healthBonus: 1,
    intellectBonus: 1,
  },
  'fenweave-robe': {
    id: 'fenweave-robe',
    name: 'Fenweave Robe',
    value: 80,
    weight: 4,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.fenweave,
    tier: 'fenweave',
    armorType: 'cloth',
    armorValue: 5,
    healthBonus: 2,
    intellectBonus: 2,
  },
  'fenweave-leggings': {
    id: 'fenweave-leggings',
    name: 'Fenweave Leggings',
    value: 65,
    weight: 3,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.fenweave,
    tier: 'fenweave',
    armorType: 'cloth',
    armorValue: 4,
    healthBonus: 1,
    intellectBonus: 1,
  },
  /**
   * What the deep pools hold, and what the fen is actually for.
   *
   * Cooked, it is the best heal in the game by a distance, which is the whole
   * reason to walk down here: every fight above the starter band lasts longer
   * than a cooked crab can carry anyone. Raw it is worth more than a fish for
   * the same reason the ocean spot is gated above the pond — what is behind a
   * level should be worth the level.
   */
  'raw-eel': {
    id: 'raw-eel',
    name: 'Raw Eel',
    value: 14,
    weight: 2,
    kind: 'material',
    icon: { shape: 'fish', color: ICON_COLOR.rawEel },
  },
  'cooked-eel': {
    id: 'cooked-eel',
    name: 'Cooked Eel',
    value: 26,
    kind: 'consumable',
    healAmount: 45,
    healDurationMs: 10000,
    icon: { shape: 'fish', color: ICON_COLOR.cookedEel },
  },
  'burnt-eel': {
    id: 'burnt-eel',
    name: 'Burnt Eel',
    value: 1,
    kind: 'material',
    icon: { shape: 'fish', color: ICON_COLOR.burnt },
  },
  // What a lurker is made of, which is all a beast may drop. It is worth real
  // coin and nothing else — the fen's crafting is the eel, and a hide that fed
  // a recipe would be a second production chain nobody asked for.
  'lurker-hide': {
    id: 'lurker-hide',
    name: 'Lurker Hide',
    value: 22,
    weight: 3,
    kind: 'material',
    // The meat outline in a leather colour, rather than a shape of its own: the
    // icon vocabulary is deliberately coarser than the item list, and at
    // thumbnail size a pelt and a cut are one blob in two colours.
    icon: { shape: 'meat', color: ICON_COLOR.hide },
  },
  'raw-fish': {
    id: 'raw-fish',
    name: 'Raw Fish',
    value: 4,
    kind: 'material',
    icon: { shape: 'fish', color: ICON_COLOR.rawFish },
  },
  'cooked-fish': {
    id: 'cooked-fish',
    name: 'Cooked Fish',
    value: 8,
    kind: 'consumable',
    healAmount: 15,
    healDurationMs: 10000,
    icon: { shape: 'fish', color: ICON_COLOR.cookedFish },
  },
  'burnt-fish': {
    id: 'burnt-fish',
    name: 'Burnt Fish',
    value: 1,
    kind: 'material',
    icon: { shape: 'fish', color: ICON_COLOR.burnt },
  },
  'crab-meat': {
    id: 'crab-meat',
    name: 'Crab Meat',
    value: 5,
    kind: 'material',
    icon: { shape: 'meat', color: ICON_COLOR.rawCrab },
  },
  // Heals more than cooked fish: beach-tier food for beach-tier fights.
  'cooked-crab': {
    id: 'cooked-crab',
    name: 'Cooked Crab',
    value: 12,
    kind: 'consumable',
    healAmount: 25,
    healDurationMs: 10000,
    icon: { shape: 'meat', color: ICON_COLOR.cookedCrab },
  },
  'burnt-crab': {
    id: 'burnt-crab',
    name: 'Burnt Crab',
    value: 1,
    kind: 'material',
    icon: { shape: 'meat', color: ICON_COLOR.burnt },
  },
  /**
   * What the first thing anyone kills is worth once there is a fire to put it
   * over.
   *
   * The weakest food in the game and the only one that costs no tool to come
   * by: a fish needs a sixty copper pole and a crab needs the beach, where a
   * rat needs a rat. That is what it is for — something to eat while earning
   * the pole — so it heals less than the fish it sits under and is worth less
   * than the fish's raw half.
   */
  'cooked-rat': {
    id: 'cooked-rat',
    name: 'Cooked Rat',
    value: 6,
    kind: 'consumable',
    healAmount: 10,
    healDurationMs: 10000,
    icon: { shape: 'meat', color: ICON_COLOR.cookedRat },
  },
  'burnt-rat': {
    id: 'burnt-rat',
    name: 'Burnt Rat',
    value: 1,
    kind: 'material',
    icon: { shape: 'meat', color: ICON_COLOR.burnt },
  },
};

// What an item weighs when no row says otherwise. Nothing is free to carry, so
// a new material row costs a point of capacity without having to remember to.
export const DEFAULT_ITEM_WEIGHT = 1;

export function itemWeight(itemId: ItemId | null): number {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.weight ?? DEFAULT_ITEM_WEIGHT;
}

// Auto-attack reach is a property of what you are swinging, not of your class:
// a wizard holding nothing punches from as close as anyone else.
export const MELEE_ATTACK_RANGE = 80;
export const UNARMED_ATTACK_RANGE = 64;

export function weaponAttackRange(itemId: ItemId | null): number {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return UNARMED_ATTACK_RANGE;
  }
  return item.attackRange ?? MELEE_ATTACK_RANGE;
}

export interface EquipmentBonuses {
  health: number;
  strength: number;
  intellect: number;
  attackPower: number;
  armor: number;
}

/** Whether what is in the off hand is a shield, which is what Block reads. */
export function isShield(itemId: ItemId | null): boolean {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.kind === 'equipment' && item.offhandShape === 'shield';
}

export function getEquipmentBonuses(itemId: ItemId | null): EquipmentBonuses {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return { health: 0, strength: 0, intellect: 0, attackPower: 0, armor: 0 };
  }
  return {
    health: item.healthBonus ?? 0,
    strength: item.strengthBonus ?? 0,
    intellect: item.intellectBonus ?? 0,
    attackPower: item.attackPowerBonus ?? 0,
    armor: item.armorValue ?? 0,
  };
}

export function describeItemBonuses(itemId: ItemId | null): string {
  const food = consumableFor(itemId);
  if (food) {
    return `Restores ${food.healAmount} HP over ${Math.round(food.healDurationMs / 1000)}s`;
  }

  const bonuses = getEquipmentBonuses(itemId);
  const parts: string[] = [];
  if (bonuses.attackPower) parts.push(`+${bonuses.attackPower} ATK`);
  if (bonuses.armor) parts.push(`+${bonuses.armor} ARM`);
  if (bonuses.health) parts.push(`+${bonuses.health} HP`);
  if (bonuses.strength) parts.push(`+${bonuses.strength} STR`);
  if (bonuses.intellect) parts.push(`+${bonuses.intellect} INT`);

  const tool = toolSkill(itemId);
  if (tool) parts.push(SKILLS[tool].name);

  const armor = armorTypeOf(itemId);
  if (armor) parts.push(ARMOR_TYPE_LABELS[armor]);

  return parts.join(', ');
}

// The armor type this item is, if it is armor at all.
export function armorTypeOf(itemId: ItemId | null): ArmorTypeId | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return null;
  }
  return item.armorType ?? null;
}

export function isEquippable(itemId: ItemId): boolean {
  return ITEMS[itemId]?.kind === 'equipment';
}

// The skill this item is a gathering tool for, if any.
export function toolSkill(itemId: ItemId | null): SkillId | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return null;
  }
  return item.toolFor ?? null;
}

// The tool item for a skill, used to tell the player what they are missing.
export function toolItemFor(skill: SkillId): ItemDefinition | null {
  return (
    Object.values(ITEMS).find((item) => item.kind === 'equipment' && item.toolFor === skill) ?? null
  );
}

export function consumableFor(
  itemId: ItemId | null,
): { healAmount: number; healDurationMs: number } | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'consumable') {
    return null;
  }
  return { healAmount: item.healAmount, healDurationMs: item.healDurationMs };
}

// Vendor sell price in copper, or null if the item can't be sold.
export function itemValue(itemId: ItemId | null): number | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.value ?? null;
}

export function describeItemName(itemId: ItemId | null): string {
  if (!itemId) {
    return '(empty)';
  }
  return ITEMS[itemId]?.name ?? itemId;
}
