export type ClassId = 'warrior' | 'wizard';

export type GearSlotId = 'helmet' | 'chest' | 'pants' | 'weapon';

export type TierId = 'brown';

export type ArmorTypeId = 'cloth' | 'leather' | 'plate';

export type EnemyId = 'rat' | 'crab' | 'bandit';

export type WeaponShapeId = 'sword' | 'wand' | 'axe' | 'pole';

export type GatherSkillId = 'fishing' | 'woodcutting' | 'cooking';

// Skills that level by fighting rather than by gathering. Their cap rides the
// character's level (see combatSkillCap), so they can't be ground ahead of it.
export type CombatSkillId = 'one-handed' | 'unarmed' | 'block' | 'parry' | 'destruction';

export type SkillId = GatherSkillId | CombatSkillId;

export type ResourceNodeId = 'tree' | 'fishing-spot' | 'ocean-fishing-spot';

export type ZoneId = 'town' | 'beach' | 'bandit-camp';

export type NpcId = 'shopkeeper';
