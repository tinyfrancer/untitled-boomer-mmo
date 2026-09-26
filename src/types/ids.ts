export type ClassId = 'warrior' | 'wizard';

export type GearSlotId = 'helmet' | 'chest' | 'pants' | 'weapon' | 'offhand';

// `studded` is the first tier the world drops that nothing in town sells and no
// forge makes: it is what the goblins on the Old Mill Road are wearing, and the
// step a character takes who has not gone near a quarry. `steel` is the other
// end of that: the deepest thing a forge makes and the only tier with four
// pieces, the offhand included. `fenhide` is what `steel` is for the other half
// of the roster: the same marsh as `fenweave` answered again, made rather than
// dropped, and the first armour in the game a wizard can build instead of
// hoping for.
export type TierId = 'brown' | 'studded' | 'iron' | 'fenweave' | 'fenhide' | 'steel';

export type ArmorTypeId = 'cloth' | 'leather' | 'plate';

/**
 * What a piece can be reworked into being better at.
 *
 * A reforge moves power between two stats and never adds any, so this is a list
 * of *directions* rather than of upgrades — which is what makes a rolled one
 * something to live with rather than something to reroll.
 */
export type ReforgeId = 'keen' | 'bulwark' | 'arcane' | 'hale' | 'brawn';

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
  | 'apprentice-orb'
  // The studded set, off the goblins west of town. Leather, so a warrior's:
  // the cloth half of the world's supply is what the fen is for.
  | 'studded-helmet'
  | 'studded-jerkin'
  | 'studded-legs'
  // The fen's three, and the cloth half the line above was waiting on: the first
  // armour a caster has ever been able to walk out and earn.
  | 'fenweave-hood'
  | 'fenweave-robe'
  | 'fenweave-leggings'
  // What the deep pools hold, and the best heal in the game once it is cooked.
  | 'raw-eel'
  | 'cooked-eel'
  | 'burnt-eel'
  | 'lurker-hide'
  // A hide with the rot taken out of it, and the three pieces stitched from it.
  // The tannery's whole line: cloth-class armour above what the raiders drop,
  // which is the half of the caster's supply killing things was never going to
  // reach.
  | 'cured-leather'
  | 'fenhide-cowl'
  | 'fenhide-vest'
  | 'fenhide-leggings'
  // What the Deep Cut holds, and the three places the steel tier reaches back
  // into: the coal under the quarry, the hardwood on the road west, and the
  // shell off the thing that lives in the dark down there.
  | 'coal'
  | 'hardwood'
  | 'charcoal'
  | 'crawler-shell'
  | 'steel-bar'
  // The deepest thing a forge makes, and the first tier with an offhand in it.
  | 'steel-helmet'
  | 'steel-chestplate'
  | 'steel-legs'
  | 'steel-shield'
  // A pick head re-hafted as a weapon, which is why it is not a mining tool.
  | 'goblin-maul'
  // The way into the barrow, and the fen's rarest thing: the hideout key's own
  // rate, one band up.
  | 'barrow-key'
  // What the dead were buried holding. Both are off hands, which is the slot
  // nothing has filled since the starter band for anyone who has not smithed —
  // and the lantern is the first thing a caster has ever had to put in one.
  | 'grave-shield'
  | 'grave-lantern'
  // The king's own three, and the second set of things in the game that come off
  // one creature. Nothing sells them and nothing else drops them.
  | 'barrow-crown'
  | 'barrow-blade'
  | 'barrow-scepter'
  // The steel tools, and the first things in the game bought with materials
  // rather than coin. What the quarry and the road west are *for*, handed back
  // as the means of working them faster.
  | 'steel-pickaxe'
  | 'steel-axe'
  | 'steel-pole'
  // What a reforge is paid for with. Bought in town and spent at Greyford,
  // which is how the coin sink sits at one end of the loop and the work at the
  // other without the outpost starting to want money.
  | 'reforging-stone';

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
  | 'iron-legs'
  | 'cooked-eel'
  | 'charcoal'
  | 'steel-bar'
  | 'steel-helmet'
  | 'steel-chestplate'
  | 'steel-legs'
  | 'steel-shield'
  | 'cured-leather'
  | 'fenhide-cowl'
  | 'fenhide-vest'
  | 'fenhide-leggings';

export type EnemyId =
  | 'rat'
  | 'crab'
  | 'bandit'
  | 'bandit-chief'
  | 'goblin-scavenger'
  | 'bog-lurker'
  | 'fen-raider'
  | 'cave-crawler'
  | 'goblin-miner'
  | 'barrow-wight'
  | 'barrow-king';

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
export type LootTableId =
  | 'rat'
  | 'crab'
  | 'bandit'
  | 'bandit-chief'
  | 'goblin-scavenger'
  | 'bog-lurker'
  | 'fen-raider'
  | 'cave-crawler'
  | 'goblin-miner'
  | 'barrow-wight'
  | 'barrow-king';

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

export type GatherSkillId =
  'fishing' | 'woodcutting' | 'mining' | 'cooking' | 'smithing' | 'leatherworking';

// Skills that level by fighting rather than by gathering. Their cap rides the
// character's level (see combatSkillCap), so they can't be ground ahead of it.
export type CombatSkillId = 'one-handed' | 'unarmed' | 'block' | 'parry' | 'destruction';

export type SkillId = GatherSkillId | CombatSkillId;

export type ResourceNodeId =
  | 'tree'
  | 'hardwood'
  | 'fishing-spot'
  | 'ocean-fishing-spot'
  | 'deep-fishing-spot'
  | 'tin-vein'
  | 'iron-vein'
  | 'coal-vein'
  | 'rich-iron-vein';

/**
 * Which body a renderer draws a node with, and the same bargain `CreatureShapeId`
 * makes: a new `RESOURCE_NODES` row names a shape it is drawn as rather than
 * waiting for view code written for its id. Coarser than the node list on
 * purpose — the two fishing spots are one set of ripples and the two ore veins
 * one rock, which is what stops a third of either costing a builder.
 */
export type NodeShapeId = 'tree' | 'ripple' | 'vein';

/**
 * Something a mastery pool can be kept for: one thing worked, or one thing made.
 *
 * The union of the two id sets rather than a third set of names, because what is
 * being mastered is the *target* a skill was pointed at — and both tables
 * already name every one of those exactly once. It is what lets one flat record
 * hold both halves, which is only safe while the two unions stay disjoint;
 * `tests/systems/MasterySystem.test.ts` is what holds that, since a recipe named
 * for a node would otherwise silently share its pool.
 */
export type MasteryTargetId = ResourceNodeId | RecipeId;

export type ZoneId =
  | 'town'
  | 'beach'
  | 'quarry'
  | 'bandit-camp'
  | 'bandit-hideout'
  | 'old-mill-road'
  | 'blackwater-fen'
  | 'deep-cut'
  | 'sunken-barrow'
  // The second place with counters in it, and the zone that makes the world a
  // loop rather than a star: the mill road to the south, the quarry to the east.
  | 'greyford';

// What is built on a zone rather than spawned in it: solid, permanent, and the
// thing a counter stands at the door of. Its own union rather than a slice of
// NpcId because the two lists do not line up in either direction — a smithy has
// nobody behind it and a cottage is nobody's counter at all.
export type BuildingId =
  | 'general-store'
  | 'bank-house'
  | 'training-hall'
  | 'quartermasters-post'
  | 'smithy'
  | 'inn'
  | 'cottage'
  // The first building in the game standing outside a town, and the first with
  // no door worth walking to: it is scenery, which is a thing a zone can have
  // now that a zone can have buildings at all.
  | 'mill'
  // Greyford's two: the counter that trades in materials, and the long hall
  // beside it that is scenery.
  | 'trading-post'
  | 'longhouse';

// Which body a renderer draws a building with, and the same bargain
// `CreatureShapeId` and `NodeShapeId` make: a new BUILDINGS row names a shape it
// is drawn as rather than waiting for view code written for its id. Coarser than
// the building list on purpose — four of the eight are one roof over a different
// sized floor, and what tells them apart at a distance is the sign over the door.
// The mill is what that bought: a building in a zone with no town in it, drawn
// with the smithy's roof and costing the renderer nothing.
export type BuildingShapeId = 'hall' | 'workshop' | 'cottage';

// Which side of a map an exit sits on. See EDGE_TABLE in systems/ZoneSystem.ts
// for the geometry each one implies.
export type ZoneEdge = 'north' | 'south' | 'east' | 'west';

// What kind of place a zone is, which is the game's to say — the fen is a marsh
// whatever draws it — and what the air there looks like is the renderer's
// (`render3d/atmosphere.ts`). Underground is anywhere cut out of rock: the
// hideout, the Deep Cut and the barrow.
export type ZoneSetting = 'open' | 'marsh' | 'underground';

// Who stands still in a town and is worth walking up to. What each one *does*
// is `NpcRoleId` in data/npcs.ts rather than a guess off the id, which is what
// stopped every NPC in the game opening a shop when tapped.
export type NpcId = 'shopkeeper' | 'banker' | 'trainer' | 'quartermaster' | 'outfitter' | 'fettler';

export type QuestId =
  | 'rat-bones'
  | 'quarry-road'
  | 'crab-feast'
  | 'bandit-trouble'
  | 'the-cutthroat'
  // The upper band's, given at Greyford: the outfitter's three, then the fettler's.
  | 'goblin-road'
  | 'cut-coal'
  | 'lurker-hides'
  | 'blackwater-raiders'
  | 'the-barrow-king';

// Standing work, as opposed to a quest, which is a story told once. Its own
// union rather than a slice of QuestId for the reason `LootTableId` is its own:
// the two lists are read by different counters and have no reason to grow
// together — a quest is written to be finished, a bounty to be taken again.
export type BountyId =
  'rat-cull' | 'shore-patrol' | 'road-contract' | 'timber-order' | 'ore-order' | 'smith-order';

export type AbilityId =
  // The one each class opens with, and the three it buys.
  | 'fireball'
  | 'mana-shield'
  | 'mend'
  | 'firestorm'
  | 'power-slash'
  | 'battle-fury'
  | 'second-wind'
  | 'crushing-blow'
  // The second rank of each, sold at levels 5 to 8. An id of its own rather than
  // a number on the first rank's, so a save stores a rank bought exactly as it
  // stores any other lesson and needed no migration to start holding one.
  | 'fireball-2'
  | 'mana-shield-2'
  | 'mend-2'
  | 'firestorm-2'
  | 'power-slash-2'
  | 'battle-fury-2'
  | 'second-wind-2'
  | 'crushing-blow-2';

// What an enemy does instead of a swing. Its own union rather than a slice of
// AbilityId: nothing a creature does is on the player's action bar, and the two
// lists have no reason to grow together.
export type EnemyAbilityId = 'cleave' | 'throw-knife' | 'grave-chill' | 'barrow-wail';

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
