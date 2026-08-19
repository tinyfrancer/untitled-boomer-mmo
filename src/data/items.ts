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
  /**
   * How much of a gather this tool takes off, as a fraction.
   *
   * The first thing a tool has ever done beyond permitting the swing. Until the
   * steel tier there was one of each and nothing to choose between, so a tool
   * was a key rather than a piece of equipment — which made a second tier of
   * them a reskin with nothing behind it.
   *
   * Speed rather than yield, and that is the opposite call to the one
   * `MASTERY_TIERS` makes. A pool pays a second log because the *level* already
   * sells speed and selling it twice would be buying one thing twice; a tool is
   * not a curve laid over the same action but a discrete thing you go and get,
   * and what a better pick plainly does is cut rock faster.
   */
  gatherSpeedBonus?: number;
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
  // The same pelt with the rot taken out of it. Lighter and warmer than the raw
  // one, since the two sit in the bag together for as long as a tanning run
  // lasts and one blob in two browns is the whole of how they are told apart.
  curedHide: 0xb08457,
  // The Deep Cut's four. Coal is the darkest thing in the bag and stops short of
  // black, for the reason burnt food does: a cell is nearly black itself, and a
  // near-black item in it reads as an empty slot.
  coal: 0x3b3a38,
  hardwood: 0x5d4037,
  // Cooler and brighter than the iron bar it is made of, which is the whole of
  // how the two are told apart at the size a bar is drawn.
  steelBar: 0xe7eff5,
  // Chalk and cave water, and nothing like the crab's orange: what a shell looks
  // like on something that has never seen the sun.
  shell: 0x9aa6b0,
  // Hot and unlike every other rock in the bag, which are all greys and rusts.
  // This is the one thing on the shelf that does something to gear, and it has
  // to read as that at thumbnail size rather than as a third ore.
  reforgeStone: 0x7e57c2,
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
  // The second, on the same terms and at the same 3%: no price, because it is
  // spent on the barrow's door and `unlockedZones` remembers afterwards.
  'barrow-key': {
    id: 'barrow-key',
    name: 'Barrow Key',
    weight: 1,
    kind: 'material',
    icon: { shape: 'key', color: ICON_COLOR.bone },
  },
  /**
   * What the dead were buried holding, and the answer to the oldest dead slot in
   * the game.
   *
   * Both offhands in the world drop off bandits in the starter band and the only
   * thing above them is smithed, so a character who has not taken up a hammer has
   * been carrying level 1 gear in that hand for the whole climb — and a *caster*
   * has, whether they smithed or not, since the steel shield is plate. These are
   * the pair the bandits' two are, one band up: a shield for the hand that holds
   * one and a lantern for the hand that does not.
   *
   * Both sit under the steel shield on armour, deliberately. The forge is where
   * the best plate comes from and a drop that beat it would undo the zone the
   * whole steel tier was built for; what these beat is the starter band, which is
   * what anybody who walked here without a hammer is still wearing.
   */
  'grave-shield': {
    id: 'grave-shield',
    name: 'Grave Shield',
    value: 110,
    weight: 7,
    kind: 'equipment',
    slot: 'offhand',
    color: 0x6b6a5e,
    armorType: 'leather',
    offhandShape: 'shield',
    armorValue: 6,
    healthBonus: 3,
  },
  'grave-lantern': {
    id: 'grave-lantern',
    name: 'Grave Lantern',
    value: 110,
    weight: 2,
    kind: 'equipment',
    slot: 'offhand',
    color: 0x8ea89b,
    armorType: 'cloth',
    offhandShape: 'orb',
    armorValue: 3,
    intellectBonus: 4,
  },
  /**
   * The king's three, and the second set of things in the game that come off one
   * creature — held unique by every other table not naming them, which is what
   * `tests/systems/uniqueLoot.test.ts` sweeps.
   *
   * Built to the chief's own shape a band up, because that shape was right: the
   * crown always drops, since a fight this long has to be worth something every
   * time, and it is cloth so the trophy is the same trophy whoever took it. The
   * two weapons behind it are the chase, one per class — a warrior who rolls the
   * scepter is still carrying 260 copper out.
   */
  'barrow-crown': {
    id: 'barrow-crown',
    name: 'Barrow Crown',
    value: 220,
    weight: 2,
    kind: 'equipment',
    slot: 'helmet',
    color: 0xc9b458,
    armorType: 'cloth',
    armorValue: 5,
    healthBonus: 8,
    intellectBonus: 2,
  },
  'barrow-blade': {
    id: 'barrow-blade',
    name: 'Barrow Blade',
    value: 260,
    weight: 5,
    kind: 'equipment',
    slot: 'weapon',
    color: 0xb9c6cf,
    weaponShape: 'sword',
    attackPowerBonus: 9,
    strengthBonus: 2,
  },
  'barrow-scepter': {
    id: 'barrow-scepter',
    name: 'Barrow Scepter',
    value: 260,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    color: 0x9575cd,
    weaponShape: 'wand',
    attackRange: 240,
    attackPowerBonus: 7,
    intellectBonus: 3,
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
  /**
   * The steel tools, and the first things in the game bought with materials
   * rather than coin.
   *
   * What they do that the shop's three do not is `gatherSpeedBonus` — until
   * these existed a tool was a key, permitting the swing and nothing more, so a
   * second tier of them would have been a reskin. Fifteen percent off a swing is
   * felt without being a different game: at the skill cap it takes a tree from
   * 55% of base to 40%, which is a run of ore that is one trip rather than two.
   *
   * Each is worth more than the materials it swallows, which is a rule the shop
   * already follows pointed at a barter: a counter that handed back less than
   * the ore was worth to a vendor would be a way of destroying what you carried
   * in.
   *
   * They stay below the starting weapons on attack power, like the three they
   * replace. That rule is what keeps gathering gear from ever being a stealth
   * combat upgrade, and a tool bought with a pack of ore is exactly the thing
   * that would break it.
   */
  'steel-pickaxe': {
    id: 'steel-pickaxe',
    name: 'Steel Pickaxe',
    value: 210,
    weight: 6,
    kind: 'equipment',
    slot: 'weapon',
    color: TIER_COLORS.steel,
    tier: 'steel',
    weaponShape: 'pick',
    attackPowerBonus: 1,
    toolFor: 'mining',
    gatherSpeedBonus: 0.15,
  },
  'steel-axe': {
    id: 'steel-axe',
    name: 'Steel Axe',
    value: 190,
    weight: 5,
    kind: 'equipment',
    slot: 'weapon',
    color: TIER_COLORS.steel,
    tier: 'steel',
    weaponShape: 'axe',
    attackPowerBonus: 1,
    toolFor: 'woodcutting',
    gatherSpeedBonus: 0.15,
  },
  'steel-pole': {
    id: 'steel-pole',
    name: 'Steel Pole',
    value: 170,
    weight: 4,
    kind: 'equipment',
    slot: 'weapon',
    color: TIER_COLORS.steel,
    tier: 'steel',
    weaponShape: 'pole',
    attackPowerBonus: 0,
    toolFor: 'fishing',
    gatherSpeedBonus: 0.15,
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
   * What the road west finally has a tree worth chopping for.
   *
   * It was left out when that zone was built and the reason was written down at
   * the time: hardwood exists to be burnt into the charcoal the steel tier is
   * worked over, and a gathering skill yielding something no recipe consumes is
   * the strictest of the three rules `deadEnds.test.ts` holds. It lands with the
   * zone that gives it a use, which is what that note said would happen.
   */
  hardwood: {
    id: 'hardwood',
    name: 'Hardwood',
    value: 7,
    weight: 3,
    kind: 'material',
    icon: { shape: 'log', color: ICON_COLOR.hardwood },
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
  /**
   * What the Deep Cut is for, and the thing that turns iron into steel.
   *
   * Behind mining 6, which is a level the quarry's own two veins are what earns
   * — the same ladder the ocean makes over the pond. Lighter than the iron it is
   * smelted with and worth more, because what is behind a level should be worth
   * the level.
   */
  coal: {
    id: 'coal',
    name: 'Coal',
    value: 13,
    weight: 3,
    kind: 'material',
    icon: { shape: 'ore', color: ICON_COLOR.coal },
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
  /**
   * Hardwood burnt down, and what a steel piece is worked over.
   *
   * The two fuels do different jobs and that is what keeps both of them worth
   * carrying: coal is what a furnace melts iron into steel with, and charcoal is
   * what the finished piece is drawn and hardened over, hot and clean where coal
   * is hot and filthy. It is bone char's opposite number one tier up — the same
   * trick of turning something that was only ever vendor trash into the thing an
   * armour row is impossible without.
   *
   * A log burnt down weighs a third of what went in, the way a bar does.
   */
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal',
    value: 18,
    weight: 1,
    kind: 'material',
    icon: { shape: 'log', color: ICON_COLOR.burnt },
  },
  // Two iron bars married in a coal fire. Worth more than what went into it,
  // like every smelt here, and heavier than one bar and lighter than two.
  'steel-bar': {
    id: 'steel-bar',
    name: 'Steel Bar',
    value: 80,
    weight: 4,
    kind: 'material',
    icon: { shape: 'bar', color: ICON_COLOR.steelBar },
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
   * The steel tier: the deepest thing a forge makes, and the first set in the
   * game with four pieces in it.
   *
   * The shield is why. Both offhands in the world drop off bandits in the
   * starter band, so the slot filled once and then never again — and it is the
   * slot most of a warrior's armour comes from. A tier that stopped at three
   * pieces would have left the best set in the game wearing a starter shield.
   *
   * Plate, so a warrior's, and heavier again than the iron it replaces: what
   * stops more weighs more is the bargain every armour row here makes, and it is
   * what keeps a full set a decision about the pack rather than a free upgrade.
   */
  'steel-helmet': {
    id: 'steel-helmet',
    name: 'Steel Helmet',
    value: 130,
    weight: 7,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.steel,
    tier: 'steel',
    armorType: 'plate',
    armorValue: 7,
    healthBonus: 3,
  },
  'steel-chestplate': {
    id: 'steel-chestplate',
    name: 'Steel Chestplate',
    value: 200,
    weight: 11,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.steel,
    tier: 'steel',
    armorType: 'plate',
    armorValue: 12,
    healthBonus: 4,
    strengthBonus: 2,
  },
  'steel-legs': {
    id: 'steel-legs',
    name: 'Steel Legs',
    value: 165,
    weight: 10,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.steel,
    tier: 'steel',
    armorType: 'plate',
    armorValue: 10,
    healthBonus: 3,
    strengthBonus: 1,
  },
  'steel-shield': {
    id: 'steel-shield',
    name: 'Steel Shield',
    value: 145,
    weight: 9,
    kind: 'equipment',
    slot: 'offhand',
    color: TIER_COLORS.steel,
    tier: 'steel',
    armorType: 'plate',
    offhandShape: 'shield',
    armorValue: 8,
    healthBonus: 3,
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
   * A pick head off a broken haft, re-hung on a longer one. What the goblins in
   * the Deep Cut swing, and the first weapon upgrade in the game that comes off
   * something you can go and kill again.
   *
   * Deliberately **not** a mining tool. A tool sits below the starting weapons on
   * attack power so gathering gear can never double as a stealth combat upgrade,
   * and this is the other side of that line: it is what a pick becomes once
   * somebody stops digging with it.
   */
  'goblin-maul': {
    id: 'goblin-maul',
    name: 'Goblin Maul',
    value: 85,
    weight: 8,
    kind: 'equipment',
    slot: 'weapon',
    color: 0x6d6a63,
    weaponShape: 'pick',
    attackPowerBonus: 4,
    strengthBonus: 1,
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
   * The fenhide set, and the first armour a caster can *make*.
   *
   * The fen closed the dropped half of the cloth gap and this is the other one:
   * two making skills existed and both of them belonged to a warrior or to
   * nobody — smithing turns out plate, which a wizard cannot wear at all, and
   * cooking turns out dinner. A caster could level every skill in the game and
   * own nothing they had built.
   *
   * `cloth` rather than an armour type of its own, which is worth being clear
   * about: a cured hide is not a robe, but the type here decides *who may wear
   * it* rather than what it is woven from — a lantern and an orb are both cloth
   * — and inventing a fourth type to hold three rows would be a class
   * restriction wearing a costume.
   *
   * It stops less than the iron plate a smith of the same standing makes and
   * takes a higher level to reach, deliberately. A warrior can wear cloth and
   * always could; what stops this being a warrior's shortcut is that walking it
   * ends up behind where their own skill already had them.
   */
  'fenhide-cowl': {
    id: 'fenhide-cowl',
    name: 'Fenhide Cowl',
    value: 95,
    weight: 3,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.fenhide,
    tier: 'fenhide',
    armorType: 'cloth',
    armorValue: 4,
    healthBonus: 1,
    intellectBonus: 2,
  },
  'fenhide-vest': {
    id: 'fenhide-vest',
    name: 'Fenhide Vest',
    value: 195,
    weight: 5,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.fenhide,
    tier: 'fenhide',
    armorType: 'cloth',
    armorValue: 7,
    healthBonus: 2,
    intellectBonus: 3,
  },
  'fenhide-leggings': {
    id: 'fenhide-leggings',
    name: 'Fenhide Leggings',
    value: 140,
    weight: 4,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.fenhide,
    tier: 'fenhide',
    armorType: 'cloth',
    armorValue: 6,
    healthBonus: 1,
    intellectBonus: 2,
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
  /**
   * What a lurker is made of, which is all a beast may drop.
   *
   * It shipped as coin and nothing else, and was the last material in the game
   * passing `deadEnds.test.ts` on a vendor price alone. What it waited for was
   * somewhere to be worked: a hide is no use at the forge and none at a fire,
   * so closing it needed the second production vertical rather than a row on an
   * existing table.
   */
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
  /**
   * The hide with the rot taken out of it, and the tannery's only intermediate.
   *
   * It is `bone-char`'s and `charcoal`'s opposite number in the other vertical:
   * the cheap early row a new skill is climbed on, and the place the whole line
   * reaches out of its own zone from. A piece of fenhide names it and a tin
   * buckle and nothing else, and yet traces back to the fen, the woods and the
   * quarry — because the bark that cures it is a log, which is the same trick
   * bone char plays with a rat and a tree.
   */
  'cured-leather': {
    id: 'cured-leather',
    name: 'Cured Leather',
    value: 32,
    // Lighter than the pelt it came off: what a tanning run takes away is the
    // water and the parts of it nobody wants.
    weight: 2,
    kind: 'material',
    icon: { shape: 'meat', color: ICON_COLOR.curedHide },
  },
  /**
   * What a crawler is made of, and the one beast part in the game that was not
   * vendor trash: ground down, it is what a steel piece is case-hardened in.
   *
   * It was the first, and the argument it made — a beast whose parts feed a
   * recipe is part of the loop where one that pays coin is scenery — is what the
   * tannery finally paid the lurker as well.
   */
  'crawler-shell': {
    id: 'crawler-shell',
    name: 'Crawler Shell',
    value: 20,
    weight: 2,
    kind: 'material',
    icon: { shape: 'bone', color: ICON_COLOR.shell },
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
  /**
   * What a reforge costs, and the only thing in the game bought in one place to
   * be spent in another.
   *
   * The coin sink lives in town because Greyford's whole claim is that nothing
   * out there wants money — so the shop takes the copper for the stone and the
   * outpost takes the stone. What that buys beyond a tidy rule is the walk: a
   * reforge is a circuit of the loop rather than a button pressed at a counter,
   * which is what every offer on the outfitter's board already is.
   *
   * It is worth real coin back, and the shop's price then sits above that — so a
   * stone bought and sold again loses money the way everything on that shelf
   * does, and none of this is a way to make any.
   */
  'reforging-stone': {
    id: 'reforging-stone',
    name: 'Reforging Stone',
    value: 120,
    weight: 2,
    kind: 'material',
    icon: { shape: 'ore', color: ICON_COLOR.reforgeStone },
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
  return describeBonuses(getEquipmentBonuses(itemId), itemId);
}

/**
 * The same line, off numbers a caller worked out for itself.
 *
 * Split out for the one caller whose numbers are not the table's: a reforged
 * piece carries what `reforgedBonuses` says rather than what its row does, and a
 * sheet showing the row's numbers under a reforged name would be the panel
 * disagreeing with the swing. Everything about the *item* — the tool it is, the
 * armour class it is — still comes off the id, because a reforge changes none of
 * that.
 */
export function describeBonuses(bonuses: EquipmentBonuses, itemId: ItemId | null): string {
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
