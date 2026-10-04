import { ACHIEVEMENT_ORDER, ACHIEVEMENTS, slayerRankOf } from '../data/achievements';
import { ENEMIES } from '../data/enemies';
import {
  CHEST_SLOTS,
  HOUSE_STANDS,
  HOUSE_BUILDING,
  HOUSE_UPGRADE_ORDER,
  HOUSE_UPGRADES,
  HOUSE_YARD,
  standUpgrade,
  type HouseUpgrade,
} from '../data/house';
import { ITEMS } from '../data/items';
import { LOOT_TABLES } from '../data/lootTables';
import { QUESTS, QUEST_ORDER } from '../data/quests';
import { RESOURCE_NODES, type ResourceNodeDefinition } from '../data/resourceNodes';
import { ZONES } from '../data/zones';
import type { EnemyId, HouseUpgradeId, ItemId, QuestId, SlayerRank, ZoneId } from '../types/ids';
import { hasBankRoom, bankSlotsUsed } from './BankSystem';
import { isUnlocked, type KillCounts } from './AchievementSystem';
import type { Inventory } from './InventorySystem';
import { isQuestDone, type QuestLog } from './QuestSystem';

/**
 * The house's rules (F1): whose it is, what may stand on a stand, what hangs
 * on the wall, and what fits in the chest.
 *
 * Three things about the house are stored (`CharacterState.house`): what
 * stands on each stand, what is in the chest, and which stages of it have been
 * built (F2), since each is a choice that leaves nothing else behind. Whose it
 * is, what counts as a trophy, which plaques hang and what each stage puts on
 * the lot are each read off a table on the way past.
 */

/** What the character keeps at home: a trophy or nothing on each stand, the chest, and what is built. */
export interface HouseState {
  stands: (ItemId | null)[];
  chest: Inventory;
  /** The stages bought, in the order they were (F2). */
  built: HouseUpgradeId[];
}

/** The house as a new character finds it: every stand bare, the chest empty, nothing built. */
export function emptyHouse(): HouseState {
  return { stands: Array.from({ length: HOUSE_STANDS }, () => null), chest: {}, built: [] };
}

/** Whether a stage of the house is built. */
export function isBuilt(house: HouseState, upgrade: HouseUpgradeId): boolean {
  return house.built.includes(upgrade);
}

/** The next stage the plans offer, or null once the lot is built out. */
export function nextUpgrade(house: HouseState): HouseUpgrade | null {
  const next = HOUSE_UPGRADE_ORDER.find((id) => !isBuilt(house, id));
  return next ? HOUSE_UPGRADES[next] : null;
}

/** Whether a stand is in the house yet: F1's four always, the drawing room's once built. */
export function standBuilt(house: HouseState, stand: number): boolean {
  const upgrade = standUpgrade(stand);
  return upgrade === null || isBuilt(house, upgrade);
}

/** How many stands stand in the house as it is built. */
export function standsBuilt(house: HouseState): number {
  return Array.from({ length: HOUSE_STANDS }, (_, stand) => stand).filter((stand) =>
    standBuilt(house, stand),
  ).length;
}

/** The quest that lets the house, read off the table rather than named twice. */
export const HOUSE_QUEST: QuestId = (() => {
  const questId = QUEST_ORDER.find((candidate) => QUESTS[candidate].reward.house);
  if (!questId) throw new Error('no quest lets the house');
  return questId;
})();

/** Whether the house is the character's: whether the quest that lets it is handed in. */
export function ownsHouse(quests: QuestLog): boolean {
  return isQuestDone(quests, HOUSE_QUEST);
}

/** Every drop off a boss's own table: the things nothing else in the game hands out. */
function bossDrops(): Set<ItemId> {
  const drops = new Set<ItemId>();
  for (const enemy of Object.values(ENEMIES)) {
    if (!enemy.boss || !enemy.lootTableId) continue;
    LOOT_TABLES[enemy.lootTableId].entries.forEach((entry) => drops.add(entry.itemId));
  }
  return drops;
}

const BOSS_DROPS = bossDrops();

/**
 * Whether something may stand on a stand: a boss's drop, or a keepsake. The
 * plaques are the third kind of trophy and are nobody's to place, since they
 * hang themselves as they are earned.
 */
export function isTrophy(itemId: ItemId): boolean {
  return ITEMS[itemId]?.kind === 'keepsake' || BOSS_DROPS.has(itemId);
}

/** Every trophy in the game, in the item table's order. */
export function allTrophies(): ItemId[] {
  return (Object.keys(ITEMS) as ItemId[]).filter(isTrophy);
}

/** What stands on a stand, which may be nothing. */
export function onStand(house: HouseState, stand: number): ItemId | null {
  return house.stands[stand] ?? null;
}

/** The house with something set on a stand, or taken off one with `null`. */
export function withStand(house: HouseState, stand: number, itemId: ItemId | null): HouseState {
  const stands = Array.from({ length: HOUSE_STANDS }, (_, index) => onStand(house, index));
  stands[stand] = itemId;
  return { ...house, stands };
}

/** Whether this would fit in the chest: the bank's rule, at the chest's fixed size. */
export function hasChestRoom(chest: Inventory, itemId: ItemId): boolean {
  return hasBankRoom(chest, CHEST_SLOTS, itemId);
}

/** How many of the chest's slots are spoken for. */
export function chestSlotsUsed(chest: Inventory): number {
  return bankSlotsUsed(chest);
}

/** A plaque on the wall: one creature, at the highest slayer rank earned against it. */
export interface Plaque {
  enemyId: EnemyId;
  rank: SlayerRank;
  /** The rank's name, which is the title it pays: "Rat Hunter". */
  name: string;
}

/**
 * What hangs on the wall: a plaque for every creature with a slayer rank
 * earned against it, showing the highest, in the achievements' own order.
 * Derived from the kills alone (the plaques are F1's third kind of trophy),
 * so nothing about the wall is stored.
 */
export function plaques(kills: KillCounts): Plaque[] {
  const highest = new Map<EnemyId, Plaque>();
  for (const id of ACHIEVEMENT_ORDER) {
    const definition = ACHIEVEMENTS[id];
    if (!isUnlocked(definition, kills)) continue;
    highest.set(definition.enemyId, {
      enemyId: definition.enemyId,
      rank: slayerRankOf(definition.threshold),
      name: definition.name,
    });
  }
  return [...highest.values()];
}

/**
 * The garden's beds as nodes, in the zone the house stands in and once its
 * stage is built (F2): what a camp there can cut besides the zone's own spawns.
 * The beds are placed off the house rather than written into the zone's text,
 * so a zone's table never lists them, and anything that asks what grows here
 * for *this* character (the idle panel, the parked payout) reads this beside it;
 * what asks where a herb grows wild (the skills book, the card) still reads the
 * zone alone, since a garden one character paid for is nobody's wild patch.
 */
export function gardenNodesIn(
  zoneId: ZoneId,
  built: readonly HouseUpgradeId[],
): ResourceNodeDefinition[] {
  const hasHouse = ZONES[zoneId]?.buildingSpawns.some(
    (spawn) => spawn.buildingId === HOUSE_BUILDING,
  );
  if (!hasHouse) return [];
  return HOUSE_YARD.flatMap((placement) =>
    'node' in placement && built.includes(placement.upgrade)
      ? [RESOURCE_NODES[placement.node]]
      : [],
  );
}
