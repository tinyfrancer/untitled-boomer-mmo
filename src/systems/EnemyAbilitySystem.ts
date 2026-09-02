import { ENEMY_ABILITIES, type EnemyAbilityDefinition } from '../data/enemyAbilities';
import type { EnemyDefinition } from '../data/enemies';
import { resolveAttack } from './CombatSystem';

export function enemyAbilitiesFor(definition: EnemyDefinition): EnemyAbilityDefinition[] {
  return (definition.abilities ?? []).map((id) => ENEMY_ABILITIES[id]);
}

export interface EnemyAbilityContext {
  /** How far the player is right now. */
  distance: number;
  /**
   * Whether there is anything solid in between.
   *
   * One line for all of a creature's abilities rather than one per ability,
   * since it is the same two points either way — and passed in rather than
   * worked out here, because this module knows nothing about walls and the
   * whole of `EnemySystem` is arithmetic over the tables.
   */
  clearLine: boolean;
  /** Since this ability was last started; Infinity if it never has been. */
  elapsedSince(ability: EnemyAbilityDefinition): number;
}

/**
 * What a creature should start winding up this frame, if anything.
 *
 * Asked before the normal swing and answered first, so an ability is a swing
 * the creature chose to spend differently rather than an extra one. The first
 * one in the row that is off cooldown and in its own band wins — order in
 * `EnemyDefinition.abilities` is the priority, which is all the AI any of them
 * needs while none of them carries two.
 */
export function chooseEnemyAbility(
  definition: EnemyDefinition,
  context: EnemyAbilityContext,
): EnemyAbilityDefinition | null {
  if (!context.clearLine) return null;
  for (const ability of enemyAbilitiesFor(definition)) {
    if (context.elapsedSince(ability) < ability.cooldownMs) continue;
    if (context.distance > ability.range) continue;
    if (ability.minRange !== undefined && context.distance < ability.minRange) continue;
    return ability;
  }
  return null;
}

/**
 * Whether it lands, asked again when the wind-up runs out rather than only when
 * it started. That second question is the whole mechanic: the shout over the
 * creature's head is a second to walk out of reach in — or, now that a building
 * is a room rather than a block, a second to step behind a wall in, which is the
 * same dodge measured a different way.
 */
export function abilityConnects(
  ability: EnemyAbilityDefinition,
  distance: number,
  clearLine: boolean,
): boolean {
  return clearLine && distance <= ability.range;
}

/** The blow itself, with the same variance every other swing in the game has. */
export function resolveEnemyAbilityDamage(
  ability: EnemyAbilityDefinition,
  attackPower: number,
  rng: () => number = Math.random,
): number {
  return resolveAttack({ attackPower: attackPower * ability.powerMultiplier }, rng).damage;
}
