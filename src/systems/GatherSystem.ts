import { SKILLS } from '../data/skills';
import { toolItemFor, toolSkill } from '../data/items';
import type { ResourceNodeDefinition } from '../data/resourceNodes';
import type { Gear } from './InventorySystem';
import { skillLevel, type Skills } from './SkillSystem';

// How much of the base gather time each skill level shaves off. At the level 10
// cap a gather takes 55% of what it did at level 1.
const SPEED_PER_LEVEL = 0.05;
// Chance per skill level above 1 of pulling a second resource from one gather.
// Exported because it is one of the two terms `rollGatherQuantity` adds, and the
// test that holds them to being *added* rather than rolled separately has to
// know where one ends and the other begins.
export const BONUS_YIELD_PER_LEVEL = 0.03;

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

export function gatherDurationMs(node: ResourceNodeDefinition, level: number): number {
  const speedup = 1 - SPEED_PER_LEVEL * (level - 1);
  return Math.round(node.baseGatherMs * speedup);
}

export function beginGather(node: ResourceNodeDefinition, level: number): GatherState {
  return {
    node,
    elapsedMs: 0,
    durationMs: gatherDurationMs(node, level),
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
  return rng() < BONUS_YIELD_PER_LEVEL * (level - 1) + masteryChance ? 2 : 1;
}
