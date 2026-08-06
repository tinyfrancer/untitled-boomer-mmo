import { consumableFor } from '../data/items';
import { inventoryEntries, type Inventory } from './InventorySystem';
import type { ItemId } from '../types/ids';

// AFK play has to stay behind active play, and two things hold it there: the
// mode never presses an ability, and what it does earn is halved.
export const AFK_XP_MULTIPLIER = 0.5;
// How far a mob can be and still be worth walking to. Short on purpose — an
// AFK character holds a camp, it does not tour the zone.
export const AFK_ENGAGE_RADIUS = 260;
// How far a chase may drag them from where they settled before the target is
// dropped: the leash on the player's side of the fight.
export const AFK_ANCHOR_RADIUS = 360;
// Below this, with nothing already on them, they stop pulling and rest...
const AFK_RETREAT_FRACTION = 0.5;
// ...and stay resting until this, so the two thresholds can't flap against
// each other at a single point.
const AFK_RESUME_FRACTION = 0.85;
// Worth spending food on rather than waiting out regen.
const AFK_EAT_FRACTION = 0.7;

export function afkXpReward(baseXp: number, isAfk: boolean): number {
  if (!isAfk) {
    return baseXp;
  }
  // Never rounds a reward away entirely: a kill that paid something awake has
  // to pay something asleep.
  return Math.max(1, Math.round(baseXp * AFK_XP_MULTIPLIER));
}

export interface AfkCandidate {
  index: number;
  distance: number;
  alive: boolean;
  // Whether it is already chasing the player, rather than merely nearby.
  engaged: boolean;
}

export interface AfkHealth {
  hp: number;
  maxHp: number;
  // Whether the character was already resting last frame, which is what the
  // two-threshold hysteresis is measured against.
  recovering: boolean;
}

export type AfkAction =
  // Stand down: stop pulling, let regen and food work.
  | { kind: 'recover' }
  // Fight the candidate at this index.
  | { kind: 'engage'; index: number }
  // Healthy, with nothing in reach worth walking to.
  | { kind: 'idle' };

function nearest(candidates: AfkCandidate[]): AfkCandidate {
  return candidates.reduce((best, c) => (c.distance < best.distance ? c : best));
}

/**
 * What an unattended character should do this frame. Anything already chasing
 * them is answered whatever their health or its distance — it is coming
 * regardless, and ignoring it is how an AFK character dies. Only with nothing
 * on them is resting an option.
 */
export function decideAfkAction(
  candidates: AfkCandidate[],
  health: AfkHealth,
  radius = AFK_ENGAGE_RADIUS,
): AfkAction {
  const living = candidates.filter((candidate) => candidate.alive);

  const engaged = living.filter((candidate) => candidate.engaged);
  if (engaged.length > 0) {
    return { kind: 'engage', index: nearest(engaged).index };
  }

  const fraction = health.maxHp > 0 ? health.hp / health.maxHp : 1;
  const floor = health.recovering ? AFK_RESUME_FRACTION : AFK_RETREAT_FRACTION;
  if (fraction < floor) {
    return { kind: 'recover' };
  }

  const inReach = living.filter((candidate) => candidate.distance <= radius);
  if (inReach.length === 0) {
    return { kind: 'idle' };
  }
  return { kind: 'engage', index: nearest(inReach).index };
}

/**
 * Whether to spend food rather than wait out regen. Out-of-combat only,
 * because markInCombat drops the buff — eating mid-fight throws the item away.
 */
export function shouldAfkEat(hp: number, maxHp: number, inCombat: boolean): boolean {
  if (inCombat || maxHp <= 0) {
    return false;
  }
  return hp / maxHp <= AFK_EAT_FRACTION;
}

/**
 * The food an unattended character reaches for: the weakest thing in the bag
 * that still heals. Nothing is in a hurry between respawns, and it leaves the
 * good food for when the player is actually at the keyboard.
 */
export function chooseAfkFood(inventory: Inventory): ItemId | null {
  let best: { itemId: ItemId; healAmount: number } | null = null;
  for (const [itemId, quantity] of inventoryEntries(inventory)) {
    const food = quantity > 0 ? consumableFor(itemId) : null;
    if (food && (best === null || food.healAmount < best.healAmount)) {
      best = { itemId, healAmount: food.healAmount };
    }
  }
  return best?.itemId ?? null;
}
