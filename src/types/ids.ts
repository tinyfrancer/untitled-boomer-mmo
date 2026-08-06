export type ClassId = 'warrior' | 'wizard';

export type GearSlotId = 'helmet' | 'chest' | 'pants' | 'weapon';

export type TierId = 'brown';

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
  | 'logs'
  | 'raw-fish'
  | 'cooked-fish'
  | 'burnt-fish'
  | 'crab-meat'
  | 'cooked-crab'
  | 'burnt-crab';

// Recipes are keyed by what goes in the pan, so a recipe id is the id of a raw
// item. Spelling that as a subset of ItemId rather than as its own list is what
// lets recipeForInput narrow an arbitrary item down to a recipe without a cast.
export type RecipeId = Extract<ItemId, 'raw-fish' | 'crab-meat'>;

export type EnemyId = 'rat' | 'crab' | 'bandit';

// What an enemy is, which is what decides what it can carry: humanoids have
// pockets and wear gear, beasts drop the parts they are made of.
export type EnemyFamilyId = 'beast' | 'humanoid';

// One per creature that drops anything. Its own union rather than EnemyId: what
// a table is called is a fact about the table, and two creatures sharing one is
// a decision LOOT_TABLES should be free to make.
export type LootTableId = 'rat' | 'crab' | 'bandit';

export type WeaponShapeId = 'sword' | 'wand' | 'axe' | 'pole';

export type GatherSkillId = 'fishing' | 'woodcutting' | 'cooking';

// Skills that level by fighting rather than by gathering. Their cap rides the
// character's level (see combatSkillCap), so they can't be ground ahead of it.
export type CombatSkillId = 'one-handed' | 'unarmed' | 'block' | 'parry' | 'destruction';

export type SkillId = GatherSkillId | CombatSkillId;

export type ResourceNodeId = 'tree' | 'fishing-spot' | 'ocean-fishing-spot';

export type ZoneId = 'town' | 'beach' | 'bandit-camp';

export type NpcId = 'shopkeeper';

export type QuestId = 'rat-bones' | 'crab-feast';

export type AbilityId = 'fireball' | 'mana-shield' | 'power-slash' | 'battle-fury';

// How many of a creature a slayer achievement asks for. Built into the ids
// below rather than listed separately, so the compiler knows the full grid and
// a new enemy cannot quietly ship without its chain.
export type SlayerTier = 25 | 50 | 100;

export type AchievementId = `${EnemyId}-slayer-${SlayerTier}`;

export type TitleId = `${EnemyId}-slayer`;
