export type ClassId = 'warrior' | 'wizard';

export type GearSlotId = 'helmet' | 'chest' | 'pants' | 'weapon';

export type TierId = 'brown';

export type ArmorTypeId = 'cloth' | 'leather' | 'plate';

export type EnemyId = 'rat' | 'crab' | 'bandit';

// What an enemy is, which is what decides what it can carry: humanoids have
// pockets and wear gear, beasts drop the parts they are made of.
export type EnemyFamilyId = 'beast' | 'humanoid';

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
