import type { ClassId, CreatureShapeId, EnemyId, NpcId } from '../types/ids';
import { PLACEHOLDERS } from './sprites/placeholders';
import { RAT } from './sprites/rat';
import { SHOPKEEPER, WARRIOR } from './sprites/people';

/**
 * Who is drawn with which sprite.
 *
 * Partial on purpose: anything not in a table is drawn as its kind's
 * placeholder (`docs/architecture/art.md`), so a new creature or person is on
 * screen the day its row is, and drawing it properly is a line here. The kind
 * a creature falls back to is read off its `shape`, the same bargain the 3D
 * view made: what it is decides what it looks like.
 */

const CLASS_SPRITES: Readonly<Partial<Record<ClassId, string>>> = {
  warrior: WARRIOR.id,
};

const NPC_SPRITES: Readonly<Partial<Record<NpcId, string>>> = {
  shopkeeper: SHOPKEEPER.id,
};

const CREATURE_SPRITES: Readonly<Partial<Record<EnemyId, string>>> = {
  rat: RAT.id,
};

/** The player, by class. */
export function classSprite(classId: ClassId): string {
  return CLASS_SPRITES[classId] ?? PLACEHOLDERS.person.id;
}

/** A person who stands behind a counter. */
export function npcSprite(npcId: NpcId): string {
  return NPC_SPRITES[npcId] ?? PLACEHOLDERS.person.id;
}

/** A creature, falling back on the kind of body its shape says it has. */
export function creatureSprite(enemyId: EnemyId, shape: CreatureShapeId): string {
  const drawn = CREATURE_SPRITES[enemyId];
  if (drawn) return drawn;
  return shape === 'humanoid' ? PLACEHOLDERS.person.id : PLACEHOLDERS.beast.id;
}
