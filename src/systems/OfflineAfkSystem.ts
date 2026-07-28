import { ENEMIES } from '../data/enemies';
import { ZONES } from '../data/zones';
import { xpToReachLevel } from '../data/xpTable';
import type { AfkSession } from '../persistence/CharacterState';
import { AFK_XP_MULTIPLIER } from './AfkSystem';
import { canCarry } from './EncumbranceSystem';
import { scaleEnemyStats } from './EnemySystem';
import { addItemToInventory, type Inventory } from './InventorySystem';
import { rollLootTable } from './LootSystem';
import type { EnemyId } from '../types/ids';

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
  // Whether the pack ran out of room and later drops were left behind.
  packFilled: boolean;
}

const NOTHING: OfflineAfkReport = {
  elapsedMs: 0,
  kills: 0,
  enemyId: null,
  xp: 0,
  copper: 0,
  drops: {},
  packFilled: false,
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
function campQuarry(zoneId: keyof typeof ZONES, characterLevel: number) {
  const spawns = ZONES[zoneId]?.mobSpawns ?? [];
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

/**
 * What a camp left running while the tab was closed earned. Pure, with `now`
 * and the rng injected, because the only interesting cases (a clock that moved
 * backwards, a week away, a pack that fills up) are ones a live run can't
 * reach.
 */
export function resolveOfflineAfk(
  session: AfkSession,
  context: OfflineAfkContext,
): OfflineAfkReport {
  const elapsedMs = elapsedOfflineMs(session.startedAt, context.now);
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
  let packFilled = false;
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
      if (!canCarry(carried, drop.itemId, drop.quantity, context.capacity)) {
        packFilled = true;
        continue;
      }
      carried = addItemToInventory(carried, drop.itemId, drop.quantity);
      drops = addItemToInventory(drops, drop.itemId, drop.quantity);
    }
  }

  return {
    elapsedMs,
    kills,
    enemyId: quarry.enemyId,
    xp,
    copper: Math.floor(copper * OFFLINE_RATE_MULTIPLIER),
    drops,
    packFilled,
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
