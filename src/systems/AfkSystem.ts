import { consumableFor, toolSkill } from '../data/items';
import type { CraftingRecipe, StationId } from '../data/recipes';
import { canCraft, recipesAt } from './CraftingSystem';
import { inventoryEntries, type Gear, type Inventory } from './InventorySystem';
import type { Skills } from './SkillSystem';
import type { ItemId, SkillId } from '../types/ids';

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
  // A named mob, which an unattended character never starts a fight with. It
  // still has to be answered once it starts one.
  boss?: boolean;
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

function nearest<T extends { distance: number }>(candidates: T[]): T {
  return candidates.reduce((best, c) => (c.distance < best.distance ? c : best));
}

/**
 * What an unattended character would be working, which is simply what is in
 * their hands.
 *
 * A gathering tool *is* the weapon slot, so this needs nothing stored and
 * nothing chosen twice: a fishing pole says fish, an axe says chop, and a sword
 * or an empty hand says fight. It is the same question `canGather` already asks
 * before letting anyone swing at a tree, and it means a player who wants to
 * camp a skill does what they would do anyway — equip the tool and settle in.
 */
export function afkGatherSkill(gear: Gear): SkillId | null {
  return toolSkill(gear.weapon);
}

/**
 * What the camp is actually doing, which is the tool in hand *and* the station
 * underfoot rather than the tool alone.
 *
 * `afkGatherSkill` above is the whole of what a camp used to read, and it left
 * the two making skills campable by nobody: cooking has no tool, so the skill
 * with the deepest active loop was the one skill that could never be parked, and
 * smithing inherited the same hole the day the forge landed.
 *
 * This is the one place the "read it off the tool" rule bends, and the reason it
 * is a bend rather than drift is that **a station is a tool you cannot carry**.
 * Nothing is stored and nothing is chosen twice — the derivation stays a
 * derivation, it just reads two inputs instead of one.
 */
export type AfkCampJob =
  // Standing at a station with something on the bench worth making.
  | { kind: 'craft'; recipe: CraftingRecipe }
  // A gathering tool in hand. Whether this zone holds anything it works is the
  // caller's question, not this one's — see `chooseAfkNode`.
  | { kind: 'gather'; skill: SkillId }
  // Empty hands, or hands full of things there is no work for here.
  | { kind: 'fight' };

export interface AfkCampSurroundings {
  gear: Gear;
  skills: Skills;
  inventory: Inventory;
  /** Which stations are within reach right now, in whatever order. */
  stations: StationId[];
}

/**
 * The best thing makeable at any station in reach, or null.
 *
 * The richest one the skill opens, which is `campNode`'s rule at the other kind
 * of station: a smith who has earned the iron smelts iron rather than being held
 * to the first row in the table.
 */
export function bestCraftInReach(surroundings: AfkCampSurroundings): CraftingRecipe | null {
  let best: CraftingRecipe | null = null;
  for (const station of surroundings.stations) {
    for (const recipe of recipesAt(station)) {
      const check = canCraft(recipe, surroundings.skills, surroundings.inventory, true);
      if (check.ok && (best === null || recipe.xpReward > best.xpReward)) {
        best = recipe;
      }
    }
  }
  return best;
}

/**
 * Which of the three a camp is, and the order is the whole of the rule.
 *
 * **A station beats a tool**, because standing at one is something the player
 * went and did where a tool is merely what they happen to be holding. The two
 * cannot deadlock: a craft job needs its inputs in the bag and the bag runs
 * out, at which point the gatherer that filled it takes over again — which is
 * what makes settling in at a fire on the beach a camp that fishes and cooks
 * rather than one that does either.
 */
export function afkCampJob(surroundings: AfkCampSurroundings): AfkCampJob {
  const recipe = bestCraftInReach(surroundings);
  if (recipe) {
    return { kind: 'craft', recipe };
  }
  const skill = afkGatherSkill(surroundings.gear);
  return skill === null ? { kind: 'fight' } : { kind: 'gather', skill };
}

/** The skill a job trains, for the one line that has to read as English. */
export function afkJobSkill(job: AfkCampJob): SkillId | null {
  if (job.kind === 'craft') return job.recipe.skill;
  return job.kind === 'gather' ? job.skill : null;
}

export interface AfkNodeCandidate {
  index: number;
  distance: number;
  /** Whether it has charges left, as opposed to chopped out and regrowing. */
  available: boolean;
  skill: SkillId;
  /** Whether the character could work it at all: tool in hand, skill high enough. */
  workable: boolean;
}

export type AfkGatherAction =
  // Work the node at this index.
  | { kind: 'gather'; index: number }
  // Nodes this tool could work exist here, but none is ready right now: chopped
  // out and not yet regrown, or too far from where the character settled.
  | { kind: 'wait' }
  // Nothing in this zone this tool will ever work, so the camp is not a
  // gathering one however it is equipped.
  | { kind: 'none' };

/**
 * Which node an unattended character should walk to next.
 *
 * The nearest ready one inside the anchor radius, which is what makes a
 * woodcutting camp work a stand of trees rather than one: a tree runs out after
 * four swings and takes fifteen seconds to regrow, so a camp that could only
 * see the tree it started on would spend most of its time waiting beside it.
 *
 * `none` and `wait` are deliberately different answers. Waiting is what a camp
 * does between respawns; `none` means the tool has no work here at all, and the
 * caller falls back to fighting rather than standing still forever.
 */
export function chooseAfkNode(
  candidates: AfkNodeCandidate[],
  skill: SkillId,
  radius = AFK_ENGAGE_RADIUS,
): AfkGatherAction {
  const matching = candidates.filter(
    (candidate) => candidate.skill === skill && candidate.workable,
  );
  if (matching.length === 0) {
    return { kind: 'none' };
  }

  const ready = matching.filter((candidate) => candidate.available && candidate.distance <= radius);
  if (ready.length === 0) {
    return { kind: 'wait' };
  }
  return { kind: 'gather', index: nearest(ready).index };
}

/**
 * What an unattended character should do this frame. Anything already chasing
 * them is answered whatever their health or its distance — it is coming
 * regardless, and ignoring it is how an AFK character dies. Only with nothing
 * on them is resting an option.
 *
 * A boss is the one thing never *picked*, only answered. It is where the unique
 * loot is, and a camp that ground one down overnight would turn a drop worth
 * making the trip for into a stack of them.
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

  const inReach = living.filter((candidate) => candidate.distance <= radius && !candidate.boss);
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
