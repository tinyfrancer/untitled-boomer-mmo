import { SKILLS } from '../data/skills';
import { toolItemFor, toolSkill } from '../data/items';
import type { ResourceNodeDefinition } from '../data/resourceNodes';
import type { Gear } from './InventorySystem';
import { skillLevel, type Skills } from './SkillSystem';

// How much of the base gather time each skill level shaves off. At the level 20
// cap a gather takes 52.5% of what it did at level 1, which is about what the
// old cap of 10 bought at 5% a level (decision 139): the cap moved and what a
// capped skill buys did not, since at the old rate the skill alone would have
// met MIN_GATHER_FRACTION at 14 and every tool above steel would have bought
// nothing.
const SPEED_PER_LEVEL = 0.025;
// Chance per skill level above 1 of pulling a second resource from one gather.
// Exported because it is one of the two terms `rollGatherQuantity` adds, and the
// test that holds them to being *added* rather than rolled separately has to
// know where one ends and the other begins. Halved with the speed when the cap
// doubled, for the same reason: 3% a level to 20 is a second one more often
// than not.
export const BONUS_YIELD_PER_LEVEL = 0.015;
// The fastest a swing can ever get, however much skill and tool are stacked.
const MIN_GATHER_FRACTION = 0.35;

export interface GatherState {
  node: ResourceNodeDefinition;
  elapsedMs: number;
  durationMs: number;
  maxRange: number;
}

export type GatherCheck = { ok: true } | { ok: false; reason: string };

export type GatherOutcome =
  | { status: 'gathering'; state: GatherState; progress: number }
  | { status: 'complete' }
  | { status: 'cancelled'; reason: 'out-of-range' };

/**
 * Whether the player can gather this node at all: right tool in hand, skill high
 * enough. The reason is written for the player, since the HUD shows it verbatim.
 */
export function canGather(node: ResourceNodeDefinition, skills: Skills, gear: Gear): GatherCheck {
  if (toolSkill(gear.weapon) !== node.skill) {
    const tool = toolItemFor(node.skill);
    return { ok: false, reason: `You need a ${tool?.name ?? 'tool'} equipped.` };
  }

  const level = skillLevel(skills, node.skill);
  if (level < node.requiredLevel) {
    return {
      ok: false,
      reason: `Requires ${SKILLS[node.skill].name} level ${node.requiredLevel}.`,
    };
  }

  return { ok: true };
}

/**
 * How long one swing takes: the base, shaved by the skill and again by whatever
 * else is speeding it, a tool or a potion.
 *
 * Floored at `MIN_GATHER_FRACTION` of the base rather than left to run down to
 * nothing, because the two terms are bought separately and a capped skill
 * holding a steel tool would otherwise gather instantly — which is not a reward,
 * it is the channel disappearing.
 */
export function gatherDurationMs(
  node: ResourceNodeDefinition,
  level: number,
  speedBonus = 0,
): number {
  const speedup = 1 - gatherSpeedBonus(level) - Math.max(0, speedBonus);
  return Math.round(node.baseGatherMs * Math.max(MIN_GATHER_FRACTION, speedup));
}

/** How much of a swing's base time the skill alone has shaved off, as a fraction. */
export function gatherSpeedBonus(level: number): number {
  return SPEED_PER_LEVEL * (level - 1);
}

/** The skill's own chance of a second one off a gather, before any mastery. */
export function skillYieldChance(level: number): number {
  return BONUS_YIELD_PER_LEVEL * (level - 1);
}

export function beginGather(
  node: ResourceNodeDefinition,
  level: number,
  speedBonus = 0,
): GatherState {
  return {
    node,
    elapsedMs: 0,
    durationMs: gatherDurationMs(node, level, speedBonus),
    maxRange: node.interactRadius,
  };
}

/**
 * Advances the channel by one frame. Walking out of range cancels it; every
 * other interruption (taking a hit, clicking elsewhere) is the caller dropping
 * the session, since only the caller knows those happened.
 */
export function advanceGather(
  state: GatherState,
  deltaMs: number,
  distance: number,
): GatherOutcome {
  if (distance > state.maxRange) {
    return { status: 'cancelled', reason: 'out-of-range' };
  }

  const elapsedMs = state.elapsedMs + deltaMs;
  if (elapsedMs >= state.durationMs) {
    return { status: 'complete' };
  }

  return {
    status: 'gathering',
    state: { ...state, elapsedMs },
    progress: elapsedMs / state.durationMs,
  };
}

/**
 * One swing's haul, which is one or two and never three.
 *
 * The skill's own bonus and the node's mastery are two terms in one roll rather
 * than two rolls: what a player is owed is "sometimes a second log", and rolling
 * twice would make a third one possible at exactly the point both curves are
 * paying out. The mastery term is a chance the *node* bought and the level term
 * is one the skill bought — see `MASTERY_TIERS` for why the two are allowed to
 * sell the same thing.
 */
export function rollGatherQuantity(
  level: number,
  masteryChance = 0,
  rng: () => number = Math.random,
): number {
  return rng() < skillYieldChance(level) + masteryChance ? 2 : 1;
}
