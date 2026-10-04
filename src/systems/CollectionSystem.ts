import { ACHIEVEMENTS, ACHIEVEMENT_ORDER } from '../data/achievements';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { LOOT_TABLES } from '../data/lootTables';
import { LORE_FRAGMENTS } from '../data/loreFragments';
import { QUESTS, QUEST_ORDER } from '../data/quests';
import { RECIPES } from '../data/recipes';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { ZONES } from '../data/zones';
import type { EnemyId, ItemId, LoreFragmentId, QuestId, ZoneId } from '../types/ids';
import { isUnlocked, killCount, type KillCounts } from './AchievementSystem';
import { allTrophies, type HouseState } from './HouseSystem';
import { masteryXp, type MasteryXp } from './MasterySystem';
import { isQuestDone, type QuestLog } from './QuestSystem';
import { fragmentsOf, type WhispersState } from './WhispersSystem';

/**
 * The collection log and the bestiary (version 2 phase F3): what has been
 * slain, what each creature has been seen to drop, the trophies earned and the
 * things collected, each counted against everything there is.
 *
 * One thing in here is stored, and it is the fourth tally (`CharacterState.seen`):
 * which items each creature has been seen to drop. A drop seen leaves nothing
 * behind to count it off, since the item is eaten, sold or smelted, and the same
 * item off another creature says nothing about this one. Everything else is
 * read off a tally already kept: slain off the kills, a rank off the kills, an
 * item gathered off the node's mastery, an item made off the recipe's, a
 * keepsake off its quest, and what is at home off the house.
 */
export type SeenDrops = Partial<Record<EnemyId, ItemId[]>>;

/** A completion count: how many of how many. */
export interface Count {
  have: number;
  total: number;
}

/** Everything about the character the log is read off. */
export interface CollectionState {
  kills: KillCounts;
  seen: SeenDrops;
  mastery: MasteryXp;
  quests: QuestLog;
  house: HouseState;
  whispers: WhispersState;
}

export function hasSeenDrop(seen: SeenDrops, enemyId: EnemyId, itemId: ItemId): boolean {
  return seen[enemyId]?.includes(itemId) ?? false;
}

/**
 * Pure reducer, in the shape `recordKill` uses, handing back the record it was
 * given when nothing in `itemIds` is new, so a caller can tell a first sight
 * from the hundredth by identity alone.
 */
export function recordSeenDrops(
  seen: SeenDrops,
  enemyId: EnemyId,
  itemIds: readonly ItemId[],
): SeenDrops {
  const had = seen[enemyId] ?? [];
  const fresh = [...new Set(itemIds)].filter((itemId) => !had.includes(itemId));
  if (fresh.length === 0) return seen;
  return { ...seen, [enemyId]: [...had, ...fresh] };
}

/** What a creature can drop, in its table's order and each once. */
export function dropsOf(enemyId: EnemyId): ItemId[] {
  const tableId = ENEMIES[enemyId].lootTableId;
  if (!tableId) return [];
  return [...new Set(LOOT_TABLES[tableId].entries.map((entry) => entry.itemId))];
}

/** Where a creature lives and at what levels, read off the zones' spawns. */
export interface Haunt {
  zones: ZoneId[];
  levels: { min: number; max: number } | null;
}

export function hauntOf(enemyId: EnemyId): Haunt {
  const zones: ZoneId[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (const zone of Object.values(ZONES)) {
    const spawns = zone.mobSpawns.filter((spawn) => spawn.enemyId === enemyId);
    if (spawns.length === 0) continue;
    zones.push(zone.id);
    for (const spawn of spawns) {
      min = Math.min(min, spawn.level);
      max = Math.max(max, spawn.level);
    }
  }
  return { zones, levels: zones.length > 0 ? { min, max } : null };
}

export interface BestiaryDrop {
  itemId: ItemId;
  seen: boolean;
}

export interface BestiaryEntry {
  enemyId: EnemyId;
  name: string;
  boss: boolean;
  haunt: Haunt;
  slain: number;
  drops: BestiaryDrop[];
  dropsSeen: Count;
  /** The slayer ranks earned against it, out of the three every creature has. */
  ranks: Count;
  /** What of the history it carries (D2), found the first time it falls; most carry none. */
  lore: BestiaryLore[];
  /** Every drop seen and every rank earned: nothing about it left to find. */
  complete: boolean;
}

export interface BestiaryLore {
  fragmentId: LoreFragmentId;
  /** The journal's heading for it, said only once found: a title is half the find. */
  title: string;
  found: boolean;
}

function count(flags: readonly boolean[]): Count {
  return { have: flags.filter(Boolean).length, total: flags.length };
}

export function bestiaryEntry(
  enemyId: EnemyId,
  state: Pick<CollectionState, 'kills' | 'seen'> & Partial<Pick<CollectionState, 'whispers'>>,
): BestiaryEntry {
  const enemy = ENEMIES[enemyId];
  const drops = dropsOf(enemyId).map((itemId) => ({
    itemId,
    seen: hasSeenDrop(state.seen, enemyId, itemId),
  }));
  const dropsSeen = count(drops.map((drop) => drop.seen));
  const ranks = count(
    ACHIEVEMENT_ORDER.map((id) => ACHIEVEMENTS[id])
      .filter((definition) => definition.enemyId === enemyId)
      .map((definition) => isUnlocked(definition, state.kills)),
  );
  const lore = fragmentsOf(enemyId).map((fragmentId) => ({
    fragmentId,
    title: LORE_FRAGMENTS[fragmentId].title,
    found: state.whispers?.fragments.includes(fragmentId) ?? false,
  }));
  return {
    enemyId,
    name: enemy.name,
    boss: enemy.boss ?? false,
    haunt: hauntOf(enemyId),
    slain: killCount(state.kills, enemyId),
    drops,
    dropsSeen,
    ranks,
    lore,
    complete:
      dropsSeen.have === dropsSeen.total &&
      ranks.have === ranks.total &&
      lore.every((fragment) => fragment.found),
  };
}

/** Every creature, in the enemy table's order, which is the Feats sheet's. */
export function bestiary(
  state: Pick<CollectionState, 'kills' | 'seen'> & Partial<Pick<CollectionState, 'whispers'>>,
): BestiaryEntry[] {
  return (Object.keys(ENEMIES) as EnemyId[]).map((enemyId) => bestiaryEntry(enemyId, state));
}

/** Where a trophy comes from: the boss that drops it, or the quest that hands it over. */
export type TrophySource = { kind: 'boss'; enemyId: EnemyId } | { kind: 'quest'; questId: QuestId };

export interface TrophyEntry {
  itemId: ItemId;
  source: TrophySource | null;
  /** Earned: seen off its boss, its quest handed in, or already at home. */
  collected: boolean;
  /** Standing on one of the house's stands now. */
  displayed: boolean;
  /** Lying in the house's chest now. */
  stored: boolean;
}

export function trophySource(itemId: ItemId): TrophySource | null {
  for (const enemyId of Object.keys(ENEMIES) as EnemyId[]) {
    if (ENEMIES[enemyId].boss && dropsOf(enemyId).includes(itemId)) {
      return { kind: 'boss', enemyId };
    }
  }
  const questId = QUEST_ORDER.find((candidate) => QUESTS[candidate].reward.keepsake === itemId);
  return questId ? { kind: 'quest', questId } : null;
}

/**
 * Every trophy the house can stand (F1's), whether earned and whether at home.
 * One at home is collected whatever the tallies say: a save from before drops
 * were counted (F3) can have a trophy on a stand its boss was never seen to
 * drop, and a row saying "At home" over a count that leaves it out is a count
 * nobody believes (decision 138).
 */
export function trophies(state: Pick<CollectionState, 'seen' | 'quests' | 'house'>): TrophyEntry[] {
  return allTrophies().map((itemId) => {
    const source = trophySource(itemId);
    const displayed = state.house.stands.includes(itemId);
    const stored = (state.house.chest[itemId] ?? 0) > 0;
    const earned =
      source?.kind === 'boss'
        ? hasSeenDrop(state.seen, source.enemyId, itemId)
        : source?.kind === 'quest'
          ? isQuestDone(state.quests, source.questId)
          : false;
    return { itemId, source, collected: earned || displayed || stored, displayed, stored };
  });
}

/** The three ways the world hands an item over that the log can tell happened. */
export type CollectedWay = 'dropped' | 'gathered' | 'made';

export interface ItemLogEntry {
  itemId: ItemId;
  /** How it comes, whether or not it has yet. */
  ways: CollectedWay[];
  /** How it has come to this character, which is empty until it has. */
  had: CollectedWay[];
  collected: boolean;
}

/**
 * Every item something in the world hands over, in the item table's order: a
 * drop, a node's yield, or a recipe's result. What a recipe leaves when it
 * fails is left out, since nobody sets out to collect a burnt fish, and so is
 * whatever only the shelf sells.
 */
export function itemLog(state: Pick<CollectionState, 'seen' | 'mastery'>): ItemLogEntry[] {
  const entries: ItemLogEntry[] = [];
  for (const itemId of Object.keys(ITEMS) as ItemId[]) {
    const droppers = droppersOf(itemId);
    const nodes = Object.values(RESOURCE_NODES).filter((node) => node.yieldItemId === itemId);
    const recipes = Object.values(RECIPES).filter((recipe) => recipe.outputItemId === itemId);
    const ways: CollectedWay[] = [];
    const had: CollectedWay[] = [];
    if (droppers.length > 0) {
      ways.push('dropped');
      if (droppers.some((enemyId) => hasSeenDrop(state.seen, enemyId, itemId))) had.push('dropped');
    }
    if (nodes.length > 0) {
      ways.push('gathered');
      if (nodes.some((node) => masteryXp(state.mastery, node.id) > 0)) had.push('gathered');
    }
    if (recipes.length > 0) {
      ways.push('made');
      if (recipes.some((recipe) => masteryXp(state.mastery, recipe.id) > 0)) had.push('made');
    }
    if (ways.length === 0) continue;
    entries.push({ itemId, ways, had, collected: had.length > 0 });
  }
  return entries;
}

/** Every creature whose table names the item, in the enemy table's order. */
export function droppersOf(itemId: ItemId): EnemyId[] {
  return (Object.keys(ENEMIES) as EnemyId[]).filter((enemyId) => dropsOf(enemyId).includes(itemId));
}

/**
 * Lore found: the fragments D2's journal has heard, out of every one there is.
 * The journal keeps the hearing (`CharacterState.whispers`); this only reads it,
 * joined at wave 2's fold, where F3 had drawn an empty count until D2 landed.
 */
export function loreFound(whispers: WhispersState): Count {
  return { have: whispers.fragments.length, total: Object.keys(LORE_FRAGMENTS).length };
}

export interface CollectionCounts {
  slain: Count;
  drops: Count;
  ranks: Count;
  trophies: Count;
  items: Count;
  lore: Count;
}

/** The log's headline: each part's completion, out of everything there is. */
export function collectionCounts(state: CollectionState): CollectionCounts {
  const beasts = bestiary(state);
  const sum = (pick: (entry: BestiaryEntry) => Count): Count =>
    beasts.reduce(
      (total, entry) => ({
        have: total.have + pick(entry).have,
        total: total.total + pick(entry).total,
      }),
      { have: 0, total: 0 },
    );
  return {
    slain: count(beasts.map((entry) => entry.slain > 0)),
    drops: sum((entry) => entry.dropsSeen),
    ranks: sum((entry) => entry.ranks),
    trophies: count(trophies(state).map((entry) => entry.collected)),
    items: count(itemLog(state).map((entry) => entry.collected)),
    lore: loreFound(state.whispers),
  };
}
