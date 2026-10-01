import type {
  ArmorTypeId,
  ClassId,
  GearSlotId,
  ItemIconShape,
  ItemId,
  OffhandShapeId,
  PotionEffectId,
  SkillId,
  TierId,
  WeaponShapeId,
} from '../types/ids';
import { SKILLS } from './skills';

// Who can wear what. Class restrictions hang off the armor type rather than off
// each item, so a new armor row inherits its rules from the type it names.
export const ARMOR_TYPE_CLASSES: Record<ArmorTypeId, ClassId[]> = {
  cloth: ['warrior', 'wizard', 'ranger'],
  // A ranger wears what a warrior wears short of plate: it is out in the same
  // weather, and it is never the one standing in front of the swing.
  leather: ['warrior', 'ranger'],
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
  tier?: TierId;
  // Armor pieces name a type, which is what decides who can wear them; weapons
  // and tools leave it unset and stay open to every class.
  armorType?: ArmorTypeId;
  weaponShape?: WeaponShapeId;
  // What fills the other hand. Same bargain `weaponShape` makes: the row says
  // what it is, and the figure and its icon are drawn from that.
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
  agilityBonus?: number;
  /**
   * How many arrows this holds, which is what makes it a quiver rather than
   * only something shaped like one. The one stat an offhand has ever had that
   * is not a bonus: a bigger quiver is worth having for its own sake, since the
   * arrows in it weigh nothing and only the spares in the bag do.
   */
  quiverCapacity?: number;
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
 * What the item is, as a picture: what `art/icons.ts` draws it as when it has
 * no row of its own. Equipment needs none, since its slot and its shape of
 * weapon already say it.
 */
export interface ItemIcon {
  shape: ItemIconShape;
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

/**
 * An arrow, and the fourth kind of item: not worn, not eaten and not made into
 * anything, but spent a shot at a time out of the quiver it rides in.
 *
 * Its own kind rather than a material with a field, because what it carries is
 * read off the arrow that is nocked rather than off anything worn — and a new
 * kind is a compile error at every switch over `kind`, which is how the bag,
 * the inspect card and the sell price were told there is a fourth.
 */
interface AmmunitionItemDefinition extends BaseItemDefinition {
  kind: 'ammunition';
  // What a shot with this nocked adds, beside the archer's agility and the bow.
  damage: number;
  icon: ItemIcon;
}

/**
 * A potion, and the fifth kind: drunk rather than eaten, for a mark that lasts
 * minutes rather than a heal that lasts seconds (version 2 phase E2). Its own
 * kind rather than food with a field, because nothing about it heals and idle's
 * food order must not reach for one; what the mark does and how long it lasts
 * are its effect's row in `data/potions.ts`.
 */
interface PotionItemDefinition extends BaseItemDefinition {
  kind: 'potion';
  effect: PotionEffectId;
  icon: ItemIcon;
}

export type ItemDefinition =
  | EquipmentItemDefinition
  | MaterialItemDefinition
  | ConsumableItemDefinition
  | AmmunitionItemDefinition
  | PotionItemDefinition;

export const ITEMS: Record<ItemId, ItemDefinition> = {
  'rusty-sword': {
    id: 'rusty-sword',
    name: 'Rusty Sword',
    value: 10,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    weaponShape: 'sword',
    attackPowerBonus: 2,
  },
  // The three wizard's weapons are staves, since a wand reads as a dagger at
  // the size a figure is drawn (decision 107). Their ids said wand and scepter
  // until version 1's saves, which named them, retired (decision 113).
  'apprentice-staff': {
    id: 'apprentice-staff',
    name: 'Apprentice Staff',
    value: 10,
    weight: 2,
    kind: 'equipment',
    slot: 'weapon',
    weaponShape: 'staff',
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
    weaponShape: 'sword',
    attackPowerBonus: 6,
    strengthBonus: 1,
  },
  // Taken off someone the chief robbed, which is the only reason a bandit is
  // holding one — and the only weapon upgrade a caster has ever had.
  'stolen-staff': {
    id: 'stolen-staff',
    name: 'Stolen Staff',
    value: 150,
    weight: 2,
    kind: 'equipment',
    slot: 'weapon',
    weaponShape: 'staff',
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
    armorType: 'cloth',
    offhandShape: 'orb',
    armorValue: 1,
    intellectBonus: 2,
  },
  // The one item that is not worth anything and cannot be sold: it opens a door
  // once and is gone, so a vendor price would only ever be a trap.
  'hideout-key': {
    id: 'hideout-key',
    name: 'Cellar Key',
    weight: 1,
    kind: 'material',
    icon: { shape: 'key' },
  },
  // The second, on the same terms and at the same 3%: no price, because it is
  // spent on the barrow's door and `unlockedZones` remembers afterwards.
  'barrow-key': {
    id: 'barrow-key',
    name: 'Barrow Key',
    weight: 1,
    kind: 'material',
    icon: { shape: 'key' },
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
   * staff is still carrying 260 copper out.
   */
  'barrow-crown': {
    id: 'barrow-crown',
    name: 'Barrow Crown',
    value: 220,
    weight: 2,
    kind: 'equipment',
    slot: 'helmet',
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
    weaponShape: 'sword',
    attackPowerBonus: 9,
    strengthBonus: 2,
  },
  'barrow-staff': {
    id: 'barrow-staff',
    name: 'Barrow Staff',
    value: 260,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    weaponShape: 'staff',
    attackRange: 240,
    attackPowerBonus: 7,
    intellectBonus: 3,
  },
  /**
   * The ranger's bows, one for every rung a sword and a staff already stand on:
   * the one it starts with, the one bandits carry, the chief's and the king's.
   *
   * A bow is two-handed, shoots arrows and scales with agility whoever draws it
   * (`isBow`) — so a warrior can hold one and it is a bad idea by arithmetic
   * rather than by rule. Reach is priced against the staff's, rung for rung: the
   * same 200 to start and the same 240 at the top, since the difference between
   * a bow and a staff is the arrow each shot costs rather than the distance.
   */
  shortbow: {
    id: 'shortbow',
    name: 'Shortbow',
    value: 10,
    weight: 2,
    kind: 'equipment',
    slot: 'weapon',
    weaponShape: 'bow',
    attackRange: 200,
    attackPowerBonus: 2,
  },
  // The brown axe's opposite number: off a bandit, at the axe's rate.
  'hunting-bow': {
    id: 'hunting-bow',
    name: 'Hunting Bow',
    value: 40,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    tier: 'brown',
    weaponShape: 'bow',
    attackRange: 210,
    attackPowerBonus: 3,
  },
  // Taken off a poacher the chief robbed, which is the stolen staff's story told
  // about the third class — and the third weapon on his table, so a run at him
  // is worth making whichever of the three took it.
  'poachers-bow': {
    id: 'poachers-bow',
    name: "Poacher's Bow",
    value: 150,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    weaponShape: 'bow',
    attackRange: 220,
    attackPowerBonus: 4,
    agilityBonus: 2,
  },
  'barrow-longbow': {
    id: 'barrow-longbow',
    name: 'Barrow Longbow',
    value: 260,
    weight: 4,
    kind: 'equipment',
    slot: 'weapon',
    weaponShape: 'bow',
    attackRange: 240,
    attackPowerBonus: 7,
    agilityBonus: 3,
  },
  /**
   * The quivers, and the hand a bow leaves free.
   *
   * No armour type, so open to anybody the way the bow it serves is: a quiver is
   * half of a weapon rather than a piece of armour. What each one holds is its
   * natural stat and the one that grows most rung to rung; the bonuses beside it
   * are small, because the offhand a ranger gives up is a shield.
   */
  'worn-quiver': {
    id: 'worn-quiver',
    name: 'Worn Quiver',
    value: 10,
    weight: 1,
    kind: 'equipment',
    slot: 'offhand',
    offhandShape: 'quiver',
    quiverCapacity: 50,
  },
  // Off the goblins on the road west, beside the studded set it is cut from.
  'studded-quiver': {
    id: 'studded-quiver',
    name: 'Studded Quiver',
    value: 45,
    weight: 2,
    kind: 'equipment',
    slot: 'offhand',
    tier: 'studded',
    offhandShape: 'quiver',
    quiverCapacity: 80,
    armorValue: 1,
    agilityBonus: 1,
  },
  // What the dead were buried with, beside the shield and the lantern: the
  // barrow's answer to the offhand, for the third hand that fills one.
  'grave-quiver': {
    id: 'grave-quiver',
    name: 'Grave Quiver',
    value: 110,
    weight: 2,
    kind: 'equipment',
    slot: 'offhand',
    offhandShape: 'quiver',
    quiverCapacity: 120,
    armorValue: 2,
    agilityBonus: 3,
  },
  /**
   * The bottom rung of arrow, and the only one anybody can buy: sold in town by
   * the bundle and carried by everything with pockets.
   *
   * A tenth of a point each, so a hundred spares weigh what a helmet does and
   * the ones in the quiver weigh nothing at all.
   */
  'crude-arrows': {
    id: 'crude-arrows',
    name: 'Crude Arrows',
    value: 1,
    weight: 0.1,
    kind: 'ammunition',
    damage: 1,
    icon: { shape: 'arrow' },
  },
  /**
   * The two made arrows, and the rungs above the crude one: each doubles what
   * the arrow under it adds to a shot (decision 76). Nothing sells them and
   * nothing drops them — they come off the fletcher's bench or not at all.
   *
   * Priced just over what went into them, the way a bar is over its ore: a
   * log and an iron bar are 27c and fifteen iron arrows 30c, and a willow and a
   * steel bar are 89c and fifteen steel arrows 90c. Enough that the bench is
   * never a way to end up poorer, and nowhere near a way to get rich.
   */
  'iron-arrows': {
    id: 'iron-arrows',
    name: 'Iron Arrows',
    value: 2,
    weight: 0.1,
    kind: 'ammunition',
    damage: 2,
    icon: { shape: 'arrow' },
  },
  'steel-arrows': {
    id: 'steel-arrows',
    name: 'Steel Arrows',
    value: 6,
    weight: 0.1,
    kind: 'ammunition',
    damage: 4,
    icon: { shape: 'arrow' },
  },
  /**
   * The halves of an arrow, fifteen to a log or a bar.
   *
   * No price, which is the key's argument made for a different reason: fifteen
   * shafts off a three-copper log at even a copper each would be the best trade
   * in the game, and a head's copper would make the forge a mint. What they are
   * worth is the arrow they become, and `deadEnds.test.ts` holds that they
   * become one.
   */
  'arrow-shafts': {
    id: 'arrow-shafts',
    name: 'Arrow Shafts',
    weight: 0.1,
    kind: 'material',
    icon: { shape: 'shaft' },
  },
  'willow-shafts': {
    id: 'willow-shafts',
    name: 'Willow Shafts',
    weight: 0.1,
    kind: 'material',
    icon: { shape: 'shaft' },
  },
  'iron-arrowheads': {
    id: 'iron-arrowheads',
    name: 'Iron Arrowheads',
    weight: 0.1,
    kind: 'material',
    icon: { shape: 'arrowhead' },
  },
  'steel-arrowheads': {
    id: 'steel-arrowheads',
    name: 'Steel Arrowheads',
    weight: 0.1,
    kind: 'material',
    icon: { shape: 'arrowhead' },
  },
  'rat-bones': {
    id: 'rat-bones',
    name: 'Rat Bones',
    value: 2,
    kind: 'material',
    icon: { shape: 'bone' },
  },
  'rat-meat': {
    id: 'rat-meat',
    name: 'Rat Meat',
    value: 3,
    kind: 'material',
    icon: { shape: 'meat' },
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
    tier: 'steel',
    weaponShape: 'pole',
    attackPowerBonus: 0,
    toolFor: 'fishing',
    gatherSpeedBonus: 0.15,
  },
  /**
   * Foraging's tool, sold beside the other three. A hand blade for cutting
   * stems, and the weakest thing anyone can swing: it sits under the pole.
   */
  sickle: {
    id: 'sickle',
    name: 'Sickle',
    value: 30,
    weight: 2,
    kind: 'equipment',
    slot: 'weapon',
    weaponShape: 'sickle',
    attackPowerBonus: 0,
    toolFor: 'foraging',
  },
  logs: {
    id: 'logs',
    name: 'Logs',
    value: 3,
    weight: 2,
    kind: 'material',
    icon: { shape: 'log' },
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
    icon: { shape: 'log' },
  },
  /**
   * What the millpond grows, and the third rung woodcutting climbs to.
   *
   * It waited for the bow the way hardwood waited for the Deep Cut: a gathering
   * skill yielding something no recipe takes is the strictest rule in
   * `deadEnds.test.ts`, and a willow had nothing to be until there was an arrow
   * worth a better shaft. Lighter than hardwood and dearer, since it is behind
   * two more levels of axe.
   */
  willow: {
    id: 'willow',
    name: 'Willow',
    value: 9,
    weight: 2,
    kind: 'material',
    icon: { shape: 'log' },
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
    icon: { shape: 'ore' },
  },
  'iron-ore': {
    id: 'iron-ore',
    name: 'Iron Ore',
    value: 10,
    weight: 4,
    kind: 'material',
    icon: { shape: 'ore' },
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
    icon: { shape: 'ore' },
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
    icon: { shape: 'bar' },
  },
  'iron-bar': {
    id: 'iron-bar',
    name: 'Iron Bar',
    value: 24,
    weight: 3,
    kind: 'material',
    icon: { shape: 'bar' },
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
    icon: { shape: 'bone' },
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
    icon: { shape: 'log' },
  },
  // Two iron bars married in a coal fire. Worth more than what went into it,
  // like every smelt here, and heavier than one bar and lighter than two.
  'steel-bar': {
    id: 'steel-bar',
    name: 'Steel Bar',
    value: 80,
    weight: 4,
    kind: 'material',
    icon: { shape: 'bar' },
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
    icon: { shape: 'fish' },
  },
  'cooked-eel': {
    id: 'cooked-eel',
    name: 'Cooked Eel',
    value: 26,
    kind: 'consumable',
    healAmount: 70,
    healDurationMs: 6000,
    icon: { shape: 'fish' },
  },
  'burnt-eel': {
    id: 'burnt-eel',
    name: 'Burnt Eel',
    value: 1,
    kind: 'material',
    icon: { shape: 'fish' },
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
    icon: { shape: 'meat' },
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
    icon: { shape: 'meat' },
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
    icon: { shape: 'bone' },
  },
  'raw-fish': {
    id: 'raw-fish',
    name: 'Raw Fish',
    value: 4,
    kind: 'material',
    icon: { shape: 'fish' },
  },
  'cooked-fish': {
    id: 'cooked-fish',
    name: 'Cooked Fish',
    value: 8,
    kind: 'consumable',
    healAmount: 30,
    healDurationMs: 6000,
    icon: { shape: 'fish' },
  },
  'burnt-fish': {
    id: 'burnt-fish',
    name: 'Burnt Fish',
    value: 1,
    kind: 'material',
    icon: { shape: 'fish' },
  },
  'crab-meat': {
    id: 'crab-meat',
    name: 'Crab Meat',
    value: 5,
    kind: 'material',
    icon: { shape: 'meat' },
  },
  // Heals more than cooked fish: beach-tier food for beach-tier fights.
  'cooked-crab': {
    id: 'cooked-crab',
    name: 'Cooked Crab',
    value: 12,
    kind: 'consumable',
    healAmount: 40,
    healDurationMs: 6000,
    icon: { shape: 'meat' },
  },
  'burnt-crab': {
    id: 'burnt-crab',
    name: 'Burnt Crab',
    value: 1,
    kind: 'material',
    icon: { shape: 'meat' },
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
    healAmount: 20,
    healDurationMs: 6000,
    icon: { shape: 'meat' },
  },
  'burnt-rat': {
    id: 'burnt-rat',
    name: 'Burnt Rat',
    value: 1,
    kind: 'material',
    icon: { shape: 'meat' },
  },
  /**
   * Foraging's four, one a potion. Light, since a herb is a handful of stems,
   * and each worth a little over the rung below, the way the woods and the ores
   * are. The samphire is the strand's and the starter band's; the meadowsweet
   * grows on the mill road's bank; the bog myrtle and the bogbean are the fen's,
   * and the fenfolk's brewing is built on them (`docs/lore/peoples.md`).
   */
  samphire: {
    id: 'samphire',
    name: 'Samphire',
    value: 2,
    weight: 0.5,
    kind: 'material',
    icon: { shape: 'herb' },
  },
  meadowsweet: {
    id: 'meadowsweet',
    name: 'Meadowsweet',
    value: 4,
    weight: 0.5,
    kind: 'material',
    icon: { shape: 'herb' },
  },
  'bog-myrtle': {
    id: 'bog-myrtle',
    name: 'Bog Myrtle',
    value: 6,
    weight: 0.5,
    kind: 'material',
    icon: { shape: 'herb' },
  },
  bogbean: {
    id: 'bogbean',
    name: 'Bogbean',
    value: 8,
    weight: 0.5,
    kind: 'material',
    icon: { shape: 'herb' },
  },
  /**
   * Brewing's four. Each sells for a little over the herbs behind it, so the
   * still never makes anyone poor or rich; what a potion is worth is what it
   * does, which is `data/potions.ts`.
   */
  'samphire-tonic': {
    id: 'samphire-tonic',
    name: 'Samphire Tonic',
    value: 6,
    weight: 0.5,
    kind: 'potion',
    effect: 'quick-hands',
    icon: { shape: 'potion' },
  },
  'meadowsweet-draught': {
    id: 'meadowsweet-draught',
    name: 'Meadowsweet Draught',
    value: 11,
    weight: 0.5,
    kind: 'potion',
    effect: 'dulled-pain',
    icon: { shape: 'potion' },
  },
  'keepers-draught': {
    id: 'keepers-draught',
    name: "Keeper's Draught",
    value: 17,
    weight: 0.5,
    kind: 'potion',
    effect: 'keepers-watch',
    icon: { shape: 'potion' },
  },
  'bogbean-cordial': {
    id: 'bogbean-cordial',
    name: 'Bogbean Cordial',
    value: 24,
    weight: 0.5,
    kind: 'potion',
    effect: 'fortune',
    icon: { shape: 'potion' },
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
    icon: { shape: 'ore' },
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
  agility: number;
  attackPower: number;
  armor: number;
}

/**
 * What each bonus is called wherever an item or a stat is described: in full,
 * because the character sheet already said Strength over gear rows saying STR,
 * and ARM was the largest number on most armour (decision 99).
 */
export const BONUS_NAMES: Record<keyof EquipmentBonuses, string> = {
  attackPower: 'Attack',
  armor: 'Armour',
  health: 'Health',
  strength: 'Strength',
  intellect: 'Intellect',
  agility: 'Agility',
};

/** Whether what is in the off hand is a shield, which is what Block reads. */
export function isShield(itemId: ItemId | null): boolean {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.kind === 'equipment' && item.offhandShape === 'shield';
}

export function getEquipmentBonuses(itemId: ItemId | null): EquipmentBonuses {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return { health: 0, strength: 0, intellect: 0, agility: 0, attackPower: 0, armor: 0 };
  }
  return {
    health: item.healthBonus ?? 0,
    strength: item.strengthBonus ?? 0,
    intellect: item.intellectBonus ?? 0,
    agility: item.agilityBonus ?? 0,
    attackPower: item.attackPowerBonus ?? 0,
    armor: item.armorValue ?? 0,
  };
}

/**
 * Whether this is a bow, which is four rules at once: it takes both hands (the
 * one thing it allows in the other is a quiver), it shoots arrows, it trains
 * archery, and a shot off it scales with agility whoever draws it.
 *
 * Read off the shape rather than a flag per rule, because the four always
 * travel together — a bow that took one hand, or shot nothing, would be a
 * different weapon wearing the name.
 */
export function isBow(itemId: ItemId | null): boolean {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.kind === 'equipment' && item.weaponShape === 'bow';
}

/** How many arrows what is in the off hand holds: none, unless it is a quiver. */
export function quiverCapacity(itemId: ItemId | null): number {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.kind === 'equipment' ? (item.quiverCapacity ?? 0) : 0;
}

export function isQuiver(itemId: ItemId | null): boolean {
  return quiverCapacity(itemId) > 0;
}

export function isArrow(itemId: ItemId | null): boolean {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.kind === 'ammunition';
}

/** What a shot with this nocked adds; nothing, for no arrow at all. */
export function arrowDamage(itemId: ItemId | null): number {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.kind === 'ammunition' ? item.damage : 0;
}

export function describeItemBonuses(itemId: ItemId | null): string {
  const food = consumableFor(itemId);
  if (food) {
    return `Restores ${food.healAmount} ${BONUS_NAMES.health} over ${Math.round(food.healDurationMs / 1000)}s`;
  }
  if (isArrow(itemId)) {
    return `+${arrowDamage(itemId)} ${BONUS_NAMES.attackPower} a shot, from a quiver`;
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
  const order: (keyof EquipmentBonuses)[] = [
    'attackPower',
    'armor',
    'health',
    'strength',
    'intellect',
    'agility',
  ];
  const parts = order
    .filter((stat) => bonuses[stat])
    .map((stat) => `+${bonuses[stat]} ${BONUS_NAMES[stat]}`);

  const holds = quiverCapacity(itemId);
  if (holds) parts.push(`Holds ${holds}`);
  if (isBow(itemId)) parts.push('Two-handed');

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

// The mark a potion leaves, or null for anything that is not one.
export function potionEffectOf(itemId: ItemId | null): PotionEffectId | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.kind === 'potion' ? item.effect : null;
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
