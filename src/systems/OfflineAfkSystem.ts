import { ENEMIES } from '../data/enemies';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { ZONES } from '../data/zones';
import { xpToReachLevel } from '../data/xpTable';
import type { AfkSession } from '../persistence/CharacterState';
import { AFK_XP_MULTIPLIER, afkGatherSkill } from './AfkSystem';
import { canCarry } from './EncumbranceSystem';
import { scaleEnemyStats } from './EnemySystem';
import { gatherDurationMs } from './GatherSystem';
import { addItemToInventory, type Gear, type Inventory } from './InventorySystem';
import { rollLootTable } from './LootSystem';
import { skillLevel, skillXpToNextLevel, type Skills } from './SkillSystem';
import type { EnemyId, SkillId } from '../types/ids';

// Nothing accrues past this. A tab closed over a long weekend hands back a
// night's play, not a finished character.
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
// One kill per this long. Far slower than the awake AFK loop manages, since
// nothing here has to walk to the mob, wait out a respawn, or stop to heal.
const OFFLINE_KILL_INTERVAL_MS = 60000;
// Stacked on top of the AFK penalty, which puts offline at roughly a quarter
// of what the same time played actively would pay.
const OFFLINE_RATE_MULTIPLIER = 0.5;
// The ceiling that actually matters: however long they were away and however
// rich the zone, a night away is worth at most one level. A per-kill rate
// alone doesn't hold — eight hours at the bandit camp out-earned the entire
// level 1-10 curve seven times over — and this keeps the same meaning at
// level 1, at level 9, and in whatever zone gets added next.
const OFFLINE_MAX_LEVELS_GAINED = 1;

export interface OfflineAfkContext {
  now: number;
  characterLevel: number;
  inventory: Inventory;
  capacity: number;
  // What was in the character's hands when the tab closed, which is the whole
  // of what decides whether the session fought or gathered — the same question
  // the awake camp asks every frame.
  gear: Gear;
  skills: Skills;
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
  // What a gathering camp brought back instead. A session is one or the other,
  // never both, so a fought session leaves these at zero and a worked one
  // leaves the kills and the coin there. The haul itself rides in `drops`,
  // which is already what the away report lists.
  gathers: number;
  skill: SkillId | null;
  skillXp: number;
}

const NOTHING: OfflineAfkReport = {
  elapsedMs: 0,
  kills: 0,
  enemyId: null,
  xp: 0,
  copper: 0,
  drops: {},
  missed: {},
  gathers: 0,
  skill: null,
  skillXp: 0,
};

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

/**
 * What a camp left running while the tab was closed earned. Pure, with `now`
 * and the rng injected, because the only interesting cases (a clock that moved
 * backwards, a week away, a pack that fills up) are ones a live run can't
 * reach.
 *
 * Which of the two branches it takes is read off the gear, exactly as the awake
 * camp reads it: a tool in the weapon slot means the session was gathering.
 */
export function resolveOfflineAfk(
  session: AfkSession,
  context: OfflineAfkContext,
): OfflineAfkReport {
  const elapsedMs = elapsedOfflineMs(session.startedAt, context.now);
  const skill = afkGatherSkill(context.gear);
  if (skill !== null) {
    return resolveOfflineGather(session, context, elapsedMs, skill);
  }

  const elapsedKills = Math.floor(elapsedMs / OFFLINE_KILL_INTERVAL_MS);
  if (elapsedKills <= 0) {
    return { ...NOTHING, elapsedMs };
  }

  const quarry = campQuarry(session.zoneId, context.characterLevel);
  const definition = quarry ? ENEMIES[quarry.enemyId] : null;
  if (!quarry || !definition) {
    return { ...NOTHING, elapsedMs };
  }

  const rng = context.rng ?? Math.random;
  const { xpReward } = scaleEnemyStats(definition, quarry.level);
  const perKillXp = xpReward * AFK_XP_MULTIPLIER * OFFLINE_RATE_MULTIPLIER;
  // The cap is applied to the kill count rather than to the xp, so the coin
  // and the loot in the report come from the same fights the xp did.
  const affordableKills =
    perKillXp > 0
      ? Math.floor(xpToReachLevel(context.characterLevel + OFFLINE_MAX_LEVELS_GAINED) / perKillXp)
      : 0;
  const kills = Math.min(elapsedKills, affordableKills);
  if (kills <= 0) {
    return { ...NOTHING, elapsedMs };
  }
  // Floored rather than rounded, so a session can never come out ahead of the
  // same kills made awake and camping.
  const xp = Math.floor(perKillXp * kills);

  let copper = 0;
  let drops: Inventory = {};
  let missed: Inventory = {};
  // Tracked against the pack as it fills, so a bag that ran out of room
  // partway through stops taking drops at exactly that point.
  let carried = context.inventory;

  for (let kill = 0; kill < kills; kill += 1) {
    if (!definition.lootTableId) {
      break;
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
      } else {
        missed = addItemToInventory(missed, drop.itemId, drop.quantity);
      }
    }
  }

  return {
    ...NOTHING,
    elapsedMs,
    kills,
    enemyId: quarry.enemyId,
    xp,
    copper: Math.floor(copper * OFFLINE_RATE_MULTIPLIER),
    drops,
    missed,
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
  session: AfkSession,
  context: OfflineAfkContext,
  elapsedMs: number,
  skill: SkillId,
): OfflineAfkReport {
  const level = skillLevel(context.skills, skill);
  const node = campNode(session.zoneId, skill, level);
  if (!node) {
    return { ...NOTHING, elapsedMs };
  }

  const elapsedGathers = Math.floor(elapsedMs / gatherDurationMs(node, level));
  if (elapsedGathers <= 0) {
    return { ...NOTHING, elapsedMs };
  }

  const perGatherXp = node.xpReward * AFK_XP_MULTIPLIER * OFFLINE_RATE_MULTIPLIER;
  const xpToNext = skillXpToNextLevel(skill, level, context.characterLevel);
  const affordable = xpToNext > 0 ? Math.floor(xpToNext / perGatherXp) : Number.POSITIVE_INFINITY;

  const gathers = Math.min(elapsedGathers, affordable);
  let drops: Inventory = {};
  let missed: Inventory = {};
  // Tracked against the pack as it fills, so a bag that ran out of room partway
  // through starts losing the haul at exactly that point rather than from the
  // first gather or the last.
  let carried = context.inventory;

  for (let gather = 0; gather < gathers; gather += 1) {
    // One per gather: the bonus-yield roll is a perk for an attended player,
    // the way the action bar is.
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
    skillXp: Math.floor(perGatherXp * gathers),
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
