export type ClassId = 'warrior' | 'wizard';

export type GearSlotId = 'helmet' | 'chest' | 'pants' | 'weapon' | 'offhand';

export type TierId = 'brown' | 'iron';

export type ArmorTypeId = 'cloth' | 'leather' | 'plate';

export type ItemId =
  | 'rusty-sword'
  | 'apprentice-wand'
  | 'rat-bones'
  | 'rat-meat'
  | 'brown-chestplate'
  | 'brown-helmet'
  | 'brown-legs'
  | 'brown-robe'
  | 'brown-cloth-hat'
  | 'brown-cloth-pants'
  | 'brown-axe'
  | 'felling-axe'
  | 'fishing-pole'
  | 'pickaxe'
  | 'logs'
  // What the quarry is for. Heavy on purpose: ore is the first thing worth
  // making a second trip for, which is what the bank behind the counter in town
  // is there to hold.
  | 'tin-ore'
  | 'iron-ore'
  // What the forge turns those into, and what it turns those into. Plate is the
  // one armour type that has sat in the data with nothing wearing it since
  // armour types landed.
  | 'tin-bar'
  | 'iron-bar'
  // Rat bones and logs burnt down together, and the only thing here made out of
  // two materials that used to lead nowhere.
  | 'bone-char'
  | 'iron-helmet'
  | 'iron-chestplate'
  | 'iron-legs'
  | 'raw-fish'
  | 'cooked-fish'
  | 'burnt-fish'
  | 'crab-meat'
  | 'cooked-crab'
  | 'burnt-crab'
  // The first food in the game that needs no tool to come by: a rat drops it
  // and a fire finishes it.
  | 'cooked-rat'
  | 'burnt-rat'
  | 'hideout-key'
  // The three the chief carries, and the only things in the game that come off
  // one creature. Nothing sells them and nothing else drops them.
  | 'cutthroats-bandana'
  | 'cutthroats-blade'
  | 'stolen-wand'
  // The offhand, which is the slot the game had a Block skill for and nothing
  // to put in.
  | 'brown-shield'
  | 'apprentice-orb';

// A recipe is named for what it makes, which is how one is asked for at a
// station: "what am I making?" rather than "what raw thing do I have?". It was
// keyed by its input while cooking was the only kind and every recipe took one
// of one thing — a list of inputs has no single item to key on.
export type RecipeId =
  | 'cooked-fish'
  | 'cooked-crab'
  | 'cooked-rat'
  | 'tin-bar'
  | 'iron-bar'
  | 'bone-char'
  | 'iron-helmet'
  | 'iron-chestplate'
  | 'iron-legs';

export type EnemyId = 'rat' | 'crab' | 'bandit' | 'bandit-chief';

// What an enemy is, which is what decides what it can carry: humanoids have
// pockets and wear gear, beasts drop the parts they are made of.
export type EnemyFamilyId = 'beast' | 'humanoid';

// Which body a renderer draws an enemy with, which is a different question from
// what it is — a rat and a crab share a family and not a shape. Naming it in
// the data is what lets a new ENEMIES row reuse a body rather than wait for
// view code written for its id.
export type CreatureShapeId = 'quadruped' | 'crustacean' | 'humanoid';

// One per creature that drops anything. Its own union rather than EnemyId: what
// a table is called is a fact about the table, and two creatures sharing one is
// a decision LOOT_TABLES should be free to make.
export type LootTableId = 'rat' | 'crab' | 'bandit' | 'bandit-chief';

export type WeaponShapeId = 'sword' | 'wand' | 'axe' | 'pole' | 'pick';

// What fills the hand that is not holding the weapon. Its own union rather than
// a slice of WeaponShapeId: nothing here is swung, and the two hands are drawn
// by different code on both the paperdoll and the figure.
export type OffhandShapeId = 'shield' | 'orb';

/**
 * What an item is drawn as in the bag, at the size of a thumbnail.
 *
 * Deliberately coarser than the item list: a raw fish, a cooked one and a burnt
 * one are one shape in three colours, because at 40px what tells them apart is
 * the colour and nothing else — and so are the two ores. The weapon shapes are
 * shared with `WeaponShapeId` by name so a new weapon gets an icon by
 * construction.
 */
export type ItemIconShape =
  | WeaponShapeId
  | OffhandShapeId
  | 'helmet'
  | 'chest'
  | 'pants'
  | 'bone'
  | 'meat'
  | 'fish'
  | 'log'
  | 'ore'
  | 'bar'
  | 'key';

export type GatherSkillId = 'fishing' | 'woodcutting' | 'mining' | 'cooking' | 'smithing';

// Skills that level by fighting rather than by gathering. Their cap rides the
// character's level (see combatSkillCap), so they can't be ground ahead of it.
export type CombatSkillId = 'one-handed' | 'unarmed' | 'block' | 'parry' | 'destruction';

export type SkillId = GatherSkillId | CombatSkillId;

export type ResourceNodeId =
  'tree' | 'fishing-spot' | 'ocean-fishing-spot' | 'tin-vein' | 'iron-vein';

/**
 * Which body a renderer draws a node with, and the same bargain `CreatureShapeId`
 * makes: a new `RESOURCE_NODES` row names a shape it is drawn as rather than
 * waiting for view code written for its id. Coarser than the node list on
 * purpose — the two fishing spots are one set of ripples and the two ore veins
 * one rock, which is what stops a third of either costing a builder.
 */
export type NodeShapeId = 'tree' | 'ripple' | 'vein';

export type ZoneId = 'town' | 'beach' | 'quarry' | 'bandit-camp' | 'bandit-hideout';

// Which side of a map an exit sits on. See EDGE_TABLE in systems/ZoneSystem.ts
// for the geometry each one implies.
export type ZoneEdge = 'north' | 'south' | 'east' | 'west';

// Who stands still in a town and is worth walking up to. What each one *does*
// is `NpcRoleId` in data/npcs.ts rather than a guess off the id, which is what
// stopped every NPC in the game opening a shop when tapped.
export type NpcId = 'shopkeeper' | 'banker' | 'trainer' | 'quartermaster';

export type QuestId =
  'rat-bones' | 'quarry-road' | 'crab-feast' | 'bandit-trouble' | 'the-cutthroat';

// Standing work, as opposed to a quest, which is a story told once. Its own
// union rather than a slice of QuestId for the reason `LootTableId` is its own:
// the two lists are read by different counters and have no reason to grow
// together — a quest is written to be finished, a bounty to be taken again.
export type BountyId =
  'rat-cull' | 'shore-patrol' | 'road-contract' | 'timber-order' | 'ore-order' | 'smith-order';

export type AbilityId =
  // The two each class opens with, and the two it buys.
  | 'fireball'
  | 'mana-shield'
  | 'mend'
  | 'firestorm'
  | 'power-slash'
  | 'battle-fury'
  | 'second-wind'
  | 'crushing-blow';

// What an enemy does instead of a swing. Its own union rather than a slice of
// AbilityId: nothing a creature does is on the player's action bar, and the two
// lists have no reason to grow together.
export type EnemyAbilityId = 'cleave' | 'throw-knife';

// What the player is carrying right now, as opposed to what applied it: eating
// is not an ability and two abilities could one day leave the same mark, so
// this is its own union rather than a slice of AbilityId.
export type EffectId = 'mana-shield' | 'haste' | 'well-fed';

// How many of a creature a slayer achievement asks for. Built into the ids
// below rather than listed separately, so the compiler knows the full grid and
// a new enemy cannot quietly ship without its chain.
export type SlayerTier = 25 | 50 | 100;

export type AchievementId = `${EnemyId}-slayer-${SlayerTier}`;

export type TitleId = `${EnemyId}-slayer`;
