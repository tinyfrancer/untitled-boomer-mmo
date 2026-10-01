import { ENEMIES } from '../data/enemies';
import { isArrow, isBow } from '../data/items';
import { RESOURCE_NODES, type ResourceNodeDefinition } from '../data/resourceNodes';
import { STATION_PERSISTS, type CraftingRecipe, type StationId } from '../data/recipes';
import type { MobSpawnPoint } from '../data/zoneText';
import { ZONES } from '../data/zones';
import { xpToReachLevel } from '../data/xpTable';
import type { AfkSession } from '../persistence/CharacterState';
import { afkGatherSkill } from './AfkSystem';
import { hasInputs, recipesAt, rollCraft } from './CraftingSystem';
import { canCarry } from './EncumbranceSystem';
import { scaleEnemyStats } from './EnemySystem';
import { gatherDurationMs } from './GatherSystem';
import {
  addItemToInventory,
  removeItemFromInventory,
  type Gear,
  type Inventory,
} from './InventorySystem';
import { rollLootTable } from './LootSystem';
import { skillLevel, skillXpToNextLevel, type Skills } from './SkillSystem';
import { arrowsCarried, loadedArrow, type Quiver } from './QuiverSystem';
import type { Reforges } from './ReforgeSystem';
import { computeEffectiveStats } from './StatsSystem';
import {
  idleXpMultiplier,
  potionGatherSpeed,
  potionLeftMs,
  type PotionTimers,
} from './PotionSystem';
import type { ClassId, EnemyId, MasteryTargetId, PotionEffectId, SkillId } from '../types/ids';

// Nothing accrues past this. A tab closed over a long weekend hands back a
// night's play, not a finished character.
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
// One kill per this long. Far slower than the awake AFK loop manages, since
// nothing here has to walk to the mob, wait out a respawn, or stop to heal.
export const OFFLINE_KILL_INTERVAL_MS = 60000;
// Stacked on top of the AFK penalty, which puts offline at roughly a quarter
// of what the same time played actively would pay.
export const OFFLINE_RATE_MULTIPLIER = 0.5;
/**
 * The ceiling that actually matters: however long they were away and however
 * rich the zone, a night away is worth at most this much of the level they are
 * on. A per-kill rate alone doesn't hold — eight hours at the bandit camp
 * out-earned the whole level curve seven times over — and a share of a level
 * keeps the same meaning at level 1, at the cap, and in whatever zone gets
 * added next.
 *
 * Half a level rather than the whole one it was, because the cap moved under
 * it. A level is a share of the game, and on a quadratic curve the last one is
 * the largest share of all: 1 to 10 was 30,720 XP, of which the last level was
 * a quarter, and 1 to 5 is 4,320, of which it is very nearly a half. Halving
 * this leaves a session worth what it has always been worth.
 */
export const OFFLINE_MAX_LEVEL_FRACTION = 0.5;

export interface OfflineAfkContext {
  now: number;
  classId: ClassId;
  characterLevel: number;
  inventory: Inventory;
  capacity: number;
  // What was in the character's hands when the tab closed, which is the whole
  // of what decides whether the session fought or gathered — the same question
  // the awake camp asks every frame.
  gear: Gear;
  skills: Skills;
  /**
   * What a bow in hand has to shoot with. A fight holding one is paid only for
   * the kills its arrows covered — see `arrowsSpent`.
   */
  quiver: Quiver | null;
  // What the fettler did to the gear, which moves how hard a shot lands and so
  // how many of them a kill takes.
  reforges?: Reforges;
  /**
   * What had been drunk when the game closed (version 2 phase E2). A potion
   * works for the time it had left, so a night away pays Keeper's Watch's share
   * and Samphire Tonic's speed for those first minutes and nothing after; the
   * fight and luck potions are for a hand on the controls and do nothing here.
   */
  potions?: PotionTimers;
  rng?: () => number;
}

export interface OfflineAfkReport {
  elapsedMs: number;
  kills: number;
  // What the camp was parked on. A session only ever grinds one spawn, so the
  // whole kill count belongs to this one creature — which is what lets an
  // offline session count toward a slayer achievement. Null when nothing died.
  enemyId: EnemyId | null;
  xp: number;
  copper: number;
  drops: Inventory;
  /**
   * What the session found and could not carry, itemised.
   *
   * A full pack never stops an unattended session — it keeps fighting or
   * working and keeps earning, and what it cannot pocket is lost. Naming each
   * one is the whole difference between "your pack filled up" and knowing that
   * a night away cost you fifteen fish.
   */
  missed: Inventory;
  /**
   * What the session spent, itemised, and the one field here that runs the
   * other way: every other branch only ever adds to the pack, where a making
   * camp works through it. The caller has to take these back off the character
   * as well as handing `drops` over — a payout that only did the second half
   * would be minting bars out of ore that was never used.
   */
  consumed: Inventory;
  // What a gathering camp brought back instead. A session is one of the three,
  // never two, so a fought session leaves these at zero and a worked one
  // leaves the kills and the coin there. The haul itself rides in `drops`,
  // which is already what the away report lists.
  gathers: number;
  // What a making camp finished, counted in things that actually came off the
  // bench: a roll that failed cost the time and is not something to claim in
  // the morning. `drops` names them, and `skill`/`skillXp` are shared with the
  // gathering branch, since both are a gathering-family skill being trained.
  crafts: number;
  skill: SkillId | null;
  skillXp: number;
  /**
   * The pool the session filled, or null for one that fought.
   *
   * Only the id is here because the amount is already on this report:
   * `skillXp` *is* what the session taught that target, since a target is
   * taught by the same XP the action pays its skill (see `MasteryTarget`).
   * Carrying it twice would be two numbers that must agree and one place to
   * make them disagree.
   */
  masteryTargetId: MasteryTargetId | null;
  /**
   * Arrows the session shot, which the caller takes back off the character the
   * way it takes `consumed` — out of the quiver first, then the bag best-first,
   * as that many shots would have. Zero for anything not holding a bow.
   */
  arrowsSpent: number;
  /**
   * Whether the night ended because the arrows did rather than because the
   * time or the ceiling did. A bow with nothing to shoot is a camp that stops
   * fighting: it is paid a kill a minute whatever it is holding, so paying a
   * punch like a shot would be a bow that never runs out (decision 64).
   */
  outOfArrows: boolean;
  /**
   * Whether the ceiling ended the night rather than the time, the arrows or the
   * bag: half a level for a fight, one level of the skill for work. The idle
   * panel says what the ceiling is, and this is how the report says it was met.
   */
  capped: boolean;
}

const NOTHING: OfflineAfkReport = {
  elapsedMs: 0,
  kills: 0,
  enemyId: null,
  xp: 0,
  copper: 0,
  drops: {},
  missed: {},
  consumed: {},
  gathers: 0,
  crafts: 0,
  skill: null,
  skillXp: 0,
  masteryTargetId: null,
  arrowsSpent: 0,
  outOfArrows: false,
  capped: false,
};

/** The potions a closed game honours: the two brewed for idle. */
export const OFFLINE_POTIONS: readonly PotionEffectId[] = ['keepers-watch', 'quick-hands'];

/**
 * What one thing done offline pays, at the share idle keeps when it was done:
 * Keeper's Watch's for whatever finished inside the time the potion had left,
 * idle's own half after it.
 */
function offlineRate(
  context: Pick<OfflineAfkContext, 'potions'>,
  baseXp: number,
  finishedAtMs: number,
): number {
  const watching = finishedAtMs <= potionLeftMs(context.potions ?? {}, 'keepers-watch');
  return baseXp * idleXpMultiplier(watching) * OFFLINE_RATE_MULTIPLIER;
}

/**
 * How long a parked session counts for. A clock that went backwards (a
 * timezone change, a machine that resynced) pays nothing rather than negative,
 * and nothing past the cap counts at all.
 */
export function elapsedOfflineMs(startedAt: string, now: number): number {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) {
    return 0;
  }
  return Math.min(OFFLINE_CAP_MS, Math.max(0, now - started));
}

/** The most XP a parked session may hand back to a character at this level. */
export function offlineXpCeiling(characterLevel: number): number {
  return xpToReachLevel(characterLevel + 1) * OFFLINE_MAX_LEVEL_FRACTION;
}

// What the camp was parked next to: the spawn in that zone closest to the
// character's own level, since that is what an anchored camp would have been
// grinding. Ties go to the easier one.
//
// A boss is not on the list at all, matching what the awake camp does: a night
// parked in the hideout is a night of bandits however high the character is,
// because sixty offline kills would empty a table meant to be run for.
function campQuarry(zoneId: keyof typeof ZONES, characterLevel: number) {
  const spawns = (ZONES[zoneId]?.mobSpawns ?? []).filter(
    (spawn) => ENEMIES[spawn.enemyId].boss !== true,
  );
  if (spawns.length === 0) {
    return null;
  }
  return spawns.reduce((best, spawn) => {
    const delta = Math.abs(spawn.level - characterLevel);
    const bestDelta = Math.abs(best.level - characterLevel);
    if (delta !== bestDelta) {
      return delta < bestDelta ? spawn : best;
    }
    return spawn.level < best.level ? spawn : best;
  });
}

// The node an unattended gatherer would have been working: the richest one in
// that zone their skill actually opens. A fisher who has earned the ocean is
// paid for the ocean; one who has not is paid for the pond.
function campNode(zoneId: keyof typeof ZONES, skill: SkillId, level: number) {
  const spawns = ZONES[zoneId]?.nodeSpawns ?? [];
  const workable = spawns
    .map((spawn) => RESOURCE_NODES[spawn.nodeId])
    .filter((node) => node.skill === skill && node.requiredLevel <= level);
  if (workable.length === 0) {
    return null;
  }
  return workable.reduce((best, node) => (node.xpReward > best.xpReward ? node : best));
}

// The recipe an unattended smith would have been running: the richest one the
// skill opens that the bag can actually supply, which is `campNode`'s rule at
// the other kind of station. Null when there is nothing on the bench, which is
// what sends the session back to the tool in its hands.
function campRecipe(
  station: StationId,
  skills: Skills,
  inventory: Inventory,
): CraftingRecipe | null {
  const workable = recipesAt(station).filter(
    (recipe) =>
      skillLevel(skills, recipe.skill) >= recipe.requiredLevel && hasInputs(recipe, inventory),
  );
  if (workable.length === 0) {
    return null;
  }
  return workable.reduce((best, recipe) => (recipe.xpReward > best.xpReward ? recipe : best));
}

/**
 * What a camp left running while the tab was closed earned. Pure, with `now`
 * and the rng injected, because the only interesting cases (a clock that moved
 * backwards, a week away, a pack that fills up) are ones a live run can't
 * reach.
 *
 * Which of the three branches it takes is the awake camp's own precedence read
 * back off the save: the station it settled at first, then the tool in its
 * hands, then the fight. The one thing that is *not* the same is which stations
 * count — see `STATION_PERSISTS`. A campfire is ninety seconds long and did not
 * survive the tab closing, so a session parked at one is paid for whatever it
 * would have been doing without it, which is what its gear says.
 */
export function resolveOfflineAfk(
  session: AfkSession,
  context: OfflineAfkContext,
): OfflineAfkReport {
  const elapsedMs = elapsedOfflineMs(session.startedAt, context.now);
  const job = offlineJob(session, context);
  if (job.kind === 'craft') {
    return resolveOfflineCraft(context, elapsedMs, job.recipe);
  }
  if (job.kind === 'gather') {
    return resolveOfflineGather(context, elapsedMs, job.skill, job.node);
  }
  return resolveOfflineFight(context, elapsedMs, job.quarry);
}

/**
 * What a parked session is paid for, which is all a payout and the idle panel
 * have to agree on: the panel says it before idle starts, and the payout is
 * held to it in the morning.
 *
 * The station first, if it is still standing and the bag supplies something
 * made at it; then the tool in hand, which works the richest node here its
 * level opens or, with none, nothing; then the spawn nearest the character's
 * level. A tool with no work here earns nothing, where the awake camp turns to
 * fighting: that one can see what is chasing it, and this has nothing to model
 * a fight from but a spawn nobody picked.
 */
export type OfflineJob =
  | { kind: 'craft'; recipe: CraftingRecipe }
  | { kind: 'gather'; skill: SkillId; node: ResourceNodeDefinition | null }
  | { kind: 'fight'; quarry: MobSpawnPoint | null };

export function offlineJob(
  session: Pick<AfkSession, 'zoneId' | 'station'>,
  context: Pick<OfflineAfkContext, 'characterLevel' | 'inventory' | 'gear' | 'skills'>,
): OfflineJob {
  const { station } = session;
  const recipe =
    station && STATION_PERSISTS[station]
      ? campRecipe(station, context.skills, context.inventory)
      : null;
  if (recipe) {
    return { kind: 'craft', recipe };
  }
  const skill = afkGatherSkill(context.gear);
  if (skill !== null) {
    const node = campNode(session.zoneId, skill, skillLevel(context.skills, skill));
    return { kind: 'gather', skill, node };
  }
  return { kind: 'fight', quarry: campQuarry(session.zoneId, context.characterLevel) };
}

/** The fighting branch: a kill a minute of the job's quarry, to the ceiling. */
function resolveOfflineFight(
  context: OfflineAfkContext,
  elapsedMs: number,
  quarry: MobSpawnPoint | null,
): OfflineAfkReport {
  const elapsedKills = Math.floor(elapsedMs / OFFLINE_KILL_INTERVAL_MS);
  if (elapsedKills <= 0) {
    return { ...NOTHING, elapsedMs };
  }

  const definition = quarry ? ENEMIES[quarry.enemyId] : null;
  if (!quarry || !definition) {
    return { ...NOTHING, elapsedMs };
  }

  const rng = context.rng ?? Math.random;
  const { xpReward } = scaleEnemyStats(definition, quarry.level);
  const perKillXp = (kill: number): number =>
    offlineRate(context, xpReward, (kill + 1) * OFFLINE_KILL_INTERVAL_MS);
  // The cap is applied to the kill count rather than to the xp, so the coin
  // and the loot in the report come from the same fights the xp did.
  const ceiling = offlineXpCeiling(context.characterLevel);
  const xpFor = (count: number): number =>
    Array.from({ length: count }, (_, kill) => perKillXp(kill)).reduce((a, b) => a + b, 0);
  let kills = 0;
  let earned = 0;
  while (kills < elapsedKills && perKillXp(kills) > 0 && earned + perKillXp(kills) <= ceiling) {
    earned += perKillXp(kills);
    kills += 1;
  }
  if (kills <= 0) {
    return { ...NOTHING, elapsedMs };
  }

  const ammo = offlineAmmo(context, scaleEnemyStats(definition, quarry.level).maxHp);
  let copper = 0;
  let drops: Inventory = {};
  let missed: Inventory = {};
  // Tracked against the pack as it fills, so a bag that ran out of room
  // partway through stops taking drops at exactly that point.
  let carried = context.inventory;
  let fought = 0;
  let arrowsSpent = 0;
  let outOfArrows = false;

  for (let kill = 0; kill < kills; kill += 1) {
    // Paid before the kill is: a bow that cannot finish the next fight does not
    // start it.
    if (ammo) {
      if (ammo.left < ammo.perKill) {
        outOfArrows = true;
        break;
      }
      ammo.left -= ammo.perKill;
      arrowsSpent += ammo.perKill;
    }
    fought += 1;
    if (!definition.lootTableId) {
      continue;
    }
    const loot = rollLootTable(definition.lootTableId, rng);
    // Coin is weightless, so it keeps coming in however full the pack is.
    copper += loot.copper;
    for (const drop of loot.drops) {
      // A drop with nowhere to go is named rather than merely counted: the
      // fights happened either way, and what they cost is the useful half.
      const bag = canCarry(carried, drop.itemId, drop.quantity, context.capacity) ? 'kept' : 'lost';
      if (bag === 'kept') {
        carried = addItemToInventory(carried, drop.itemId, drop.quantity);
        drops = addItemToInventory(drops, drop.itemId, drop.quantity);
        // Arrows off a body are arrows to shoot, the way they are awake.
        if (ammo && isArrow(drop.itemId)) {
          ammo.left += drop.quantity;
        }
      } else {
        missed = addItemToInventory(missed, drop.itemId, drop.quantity);
      }
    }
  }

  if (fought <= 0) {
    return { ...NOTHING, elapsedMs, outOfArrows };
  }
  return {
    ...NOTHING,
    elapsedMs,
    kills: fought,
    enemyId: quarry.enemyId,
    // Floored rather than rounded, so a session can never come out ahead of
    // the same kills made awake and camping.
    xp: Math.floor(xpFor(fought)),
    copper: Math.floor(copper * OFFLINE_RATE_MULTIPLIER),
    drops,
    missed,
    arrowsSpent,
    outOfArrows,
    capped: !outOfArrows && kills < elapsedKills,
  };
}

/**
 * What a bow in hand had to shoot, and what a kill cost in it: the shots it
 * takes to put the quarry down at the attack the first arrow nocked gives,
 * with no crits and no training counted — the direction that spends more
 * rather than less. Null for anything that is not a bow, which spends nothing.
 */
export function offlineAmmo(
  context: Pick<
    OfflineAfkContext,
    'classId' | 'characterLevel' | 'gear' | 'quiver' | 'inventory' | 'reforges'
  >,
  quarryHp: number,
): { left: number; perKill: number } | null {
  if (!isBow(context.gear.weapon)) return null;
  const arrow = loadedArrow(context.gear, context.quiver, context.inventory);
  if (!arrow) return { left: 0, perKill: 1 };
  const { attackPower } = computeEffectiveStats(
    context.classId,
    context.gear,
    context.characterLevel,
    context.reforges ?? {},
    arrow,
  );
  return {
    left: arrowsCarried(context.quiver, context.inventory),
    perKill: Math.max(1, Math.ceil(quarryHp / Math.max(1, attackPower))),
  };
}

/**
 * The same shape for a session that was chopping or fishing rather than
 * fighting: a rate per gather, the offline penalty on top of the AFK one, and a
 * cap that is what actually holds it.
 *
 * The cap is one *skill* level, which is the gathering analogue of the one
 * character level a fighting session is held to — and it is what makes the rate
 * safe to keep simple. Nothing here models a tree's four charges, the fifteen
 * seconds it takes to regrow or the walk to the next one, all of which make the
 * awake camp slower than this arithmetic; the level ceiling is what stops that
 * mattering however long the tab was shut and whatever zone gets added next.
 *
 * A full pack does not stop it. The session keeps working and keeps training —
 * the swing happened, and the skill is what the swing teaches — and every haul
 * with nowhere to go is named in `missed` instead. A skill already at its cap
 * earns no XP but still works, so a capped fisher away overnight comes back to
 * a bag of fish and nothing else.
 */
function resolveOfflineGather(
  context: OfflineAfkContext,
  elapsedMs: number,
  skill: SkillId,
  node: ResourceNodeDefinition | null,
): OfflineAfkReport {
  const level = skillLevel(context.skills, skill);
  if (!node) {
    return { ...NOTHING, elapsedMs };
  }

  // When each gather finished: quicker while a Samphire Tonic had time left,
  // at the skill's own pace after it.
  const quickMs = Math.min(elapsedMs, potionLeftMs(context.potions ?? {}, 'quick-hands'));
  const quick = gatherDurationMs(node, level, potionGatherSpeed(context.potions ?? {}));
  const plain = gatherDurationMs(node, level);
  const quickGathers = Math.floor(quickMs / quick);
  const elapsedGathers = quickGathers + Math.floor((elapsedMs - quickGathers * quick) / plain);
  if (elapsedGathers <= 0) {
    return { ...NOTHING, elapsedMs };
  }
  const finishedAt = (gather: number): number =>
    gather < quickGathers
      ? (gather + 1) * quick
      : quickGathers * quick + (gather + 1 - quickGathers) * plain;
  const perGatherXp = (gather: number): number =>
    offlineRate(context, node.xpReward, finishedAt(gather));

  const xpToNext = skillXpToNextLevel(skill, level, context.characterLevel);
  let gathers = 0;
  let skillXp = 0;
  while (
    gathers < elapsedGathers &&
    (xpToNext <= 0 || skillXp + perGatherXp(gathers) <= xpToNext)
  ) {
    skillXp += perGatherXp(gathers);
    gathers += 1;
  }
  let drops: Inventory = {};
  let missed: Inventory = {};
  // Tracked against the pack as it fills, so a bag that ran out of room partway
  // through starts losing the haul at exactly that point rather than from the
  // first gather or the last.
  let carried = context.inventory;

  for (let gather = 0; gather < gathers; gather += 1) {
    // One per gather: both bonus-yield rolls — the skill's and the node's
    // mastery — are perks for an attended player, the way the action bar is.
    if (canCarry(carried, node.yieldItemId, 1, context.capacity)) {
      carried = addItemToInventory(carried, node.yieldItemId, 1);
      drops = addItemToInventory(drops, node.yieldItemId, 1);
    } else {
      missed = addItemToInventory(missed, node.yieldItemId, 1);
    }
  }

  return {
    ...NOTHING,
    elapsedMs,
    drops,
    missed,
    gathers,
    skill,
    // Floored rather than rounded, so a session can never come out ahead of the
    // same gathers made awake.
    skillXp: Math.floor(skillXp),
    masteryTargetId: node.id,
    capped: gathers < elapsedGathers,
  };
}

/**
 * The same shape again for a session parked at a permanent station, and the one
 * of the three that *spends* something: a smith works through the bag rather
 * than filling it, so what stops this is running out of ore about as often as it
 * is running out of night.
 *
 * Three things are deliberately not modelled, and they are the same three the
 * gathering branch leaves out: the walk to the station, the level rising as the
 * session runs (so the failure rate is the one it logged out with, which is the
 * pessimistic direction), and picking a second recipe once the first runs dry.
 * The skill-level cap is what makes all of that safe to skip.
 *
 * Nothing here checks the pack, because nothing awake does either: a craft
 * consumes its inputs before it hands anything back, so a bench is the one place
 * in the game a full pack cannot refuse.
 */
function resolveOfflineCraft(
  context: OfflineAfkContext,
  elapsedMs: number,
  recipe: CraftingRecipe,
): OfflineAfkReport {
  const level = skillLevel(context.skills, recipe.skill);
  const attempts = Math.floor(elapsedMs / recipe.durationMs);
  if (attempts <= 0) {
    return { ...NOTHING, elapsedMs };
  }

  const perCraftXp = (attempt: number): number =>
    offlineRate(context, recipe.xpReward, (attempt + 1) * recipe.durationMs);
  const xpToNext = skillXpToNextLevel(recipe.skill, level, context.characterLevel);
  const rng = context.rng ?? Math.random;

  let drops: Inventory = {};
  let consumed: Inventory = {};
  let carried = context.inventory;
  let crafts = 0;
  let skillXp = 0;
  let capped = false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Checked before the roll rather than after it, so the ceiling is one a
    // session reaches rather than one it steps over — the gathering branch gets
    // the same guarantee out of flooring its count up front, which a run of
    // failed rolls makes impossible here.
    if (xpToNext > 0 && skillXp + perCraftXp(attempt) > xpToNext) {
      capped = true;
      break;
    }
    if (!hasInputs(recipe, carried)) {
      break;
    }

    // No mastery bonus, matching the one the gathering branch withholds above:
    // a second thing off the same action is a perk for an attended player, the
    // way the action bar and the skill's own bonus yield are. The pool still
    // *fills* — see `masteryTargetId` on the report — so a night away teaches
    // the recipe without paying what knowing it is worth.
    const result = rollCraft(recipe, level, 0, rng);
    if (result.consumed) {
      for (const input of recipe.inputs) {
        carried = removeItemFromInventory(carried, input.itemId, input.quantity);
        consumed = addItemToInventory(consumed, input.itemId, input.quantity);
      }
    }
    if (result.itemId) {
      carried = addItemToInventory(carried, result.itemId, result.quantity);
      drops = addItemToInventory(drops, result.itemId, result.quantity);
    }
    if (result.failed) {
      continue;
    }
    // Things, not jobs: a job at the bench is fifteen shafts, and "12 made"
    // over a report listing 180 of them would be two numbers disagreeing.
    crafts += result.quantity;
    skillXp += perCraftXp(attempt);
  }

  return {
    ...NOTHING,
    elapsedMs,
    drops,
    consumed,
    crafts,
    skill: recipe.skill,
    // Floored rather than rounded, so a session can never come out ahead of the
    // same work done awake.
    skillXp: Math.floor(skillXp),
    masteryTargetId: recipe.id,
    capped,
  };
}

/** "3h 20m" — how long the report says they were away. */
export function formatAwayDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
