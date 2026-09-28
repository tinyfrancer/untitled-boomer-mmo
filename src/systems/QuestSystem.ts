import { ENEMIES } from '../data/enemies';
import { describeItemName } from '../data/items';
import { QUESTS, QUEST_ORDER, type QuestDefinition, type QuestObjective } from '../data/quests';
import { ZONES } from '../data/zones';
import type { KillCounts } from './AchievementSystem';
import type { Inventory } from './InventorySystem';
import type { NpcId, QuestId, ZoneId } from '../types/ids';

export type QuestStatus = 'active' | 'done';

/**
 * How many times each zone has been arrived in.
 *
 * Stored for the reason `kills` is: walking into a zone leaves nothing behind
 * to count it off, and the character's current `zoneId` says where they are
 * rather than where they have been. A count rather than a visited set, because
 * that makes a visit objective exactly a kill objective with a different tally
 * behind it — one rule, two counters, and no second way to be half-finished.
 */
export type ZoneVisits = Partial<Record<ZoneId, number>>;

/**
 * A quest that has been taken on, and where its counter stood when it was.
 *
 * The baseline is the whole of what this PR had to store, and it is deliberately
 * not progress. Kills and visits are *lifetime* tallies, so "kill 12 bandits"
 * read straight off them is already finished for anyone who has been playing —
 * it would hand itself in the moment it was accepted. Remembering where the
 * tally started keeps `have` derived (`tally − baseline`), which is what leaves
 * no counter for any of the five paths that credit a kill to forget to bump.
 *
 * It means nothing for a `collect` objective and is left at zero there: a bag is
 * not a tally. It goes down as well as up, so subtracting where it started would
 * read a spent stack as progress.
 */
export interface QuestEntry {
  status: QuestStatus;
  baseline: number;
}

export type QuestLog = Partial<Record<QuestId, QuestEntry>>;

/** Everything the three kinds of objective are counted off, and no more. */
export interface QuestCounters {
  inventory: Inventory;
  kills: KillCounts;
  visits: ZoneVisits;
}

export interface QuestProgress {
  have: number;
  need: number;
  met: boolean;
}

export type QuestOfferState = 'locked' | 'available' | 'active' | 'ready' | 'done';

export interface QuestOffer {
  definition: QuestDefinition;
  state: QuestOfferState;
  progress: QuestProgress;
  /** What a locked offer is waiting on, in the shape the shop's gated rows use. */
  requirement: string | null;
}

/** How many of the thing an objective wants. A visit wants one arrival. */
export function objectiveQuantity(objective: QuestObjective): number {
  return objective.kind === 'visit' ? 1 : objective.quantity;
}

/**
 * The lifetime tally an objective is measured against, which is what gets
 * remembered as a baseline at the accept. Zero for a collect objective, which
 * counts the bag instead.
 */
export function objectiveTally(objective: QuestObjective, counters: QuestCounters): number {
  switch (objective.kind) {
    case 'kill':
      return counters.kills[objective.enemyId] ?? 0;
    case 'visit':
      return counters.visits[objective.zoneId] ?? 0;
    case 'collect':
      return 0;
  }
}

/** What the objective names: an item, a creature, or a place. */
export function describeObjective(objective: QuestObjective): string {
  switch (objective.kind) {
    case 'collect':
      return describeItemName(objective.itemId);
    case 'kill':
      return ENEMIES[objective.enemyId].name;
    case 'visit':
      return ZONES[objective.zoneId].name;
  }
}

/**
 * How far along an objective is, given where its tally stood when it was taken.
 *
 * The whole of the counting, and deliberately not a method on a quest: a bounty
 * asks for the same two things a quest does and is counted off the same three
 * tallies, so what the two share is this and what differs is who is asking.
 *
 * A `null` baseline is an offer nobody has taken, and it previews from where
 * taking it now would start — which is none of whatever it counts, and so is
 * the same arithmetic one moment earlier rather than a case of its own.
 */
export function objectiveProgress(
  objective: QuestObjective,
  baseline: number | null,
  counters: QuestCounters,
): QuestProgress {
  const need = objectiveQuantity(objective);
  let counted: number;
  if (objective.kind === 'collect') {
    counted = counters.inventory[objective.itemId] ?? 0;
  } else {
    const tally = objectiveTally(objective, counters);
    counted = tally - (baseline ?? tally);
  }
  const have = Math.max(0, Math.min(counted, need));
  return { have, need, met: have >= need };
}

export function questProgress(
  definition: QuestDefinition,
  log: QuestLog,
  counters: QuestCounters,
): QuestProgress {
  return objectiveProgress(definition.objective, log[definition.id]?.baseline ?? null, counters);
}

export function questStatus(log: QuestLog, questId: QuestId): QuestStatus | undefined {
  return log[questId]?.status;
}

export function isQuestDone(log: QuestLog, questId: QuestId): boolean {
  return questStatus(log, questId) === 'done';
}

/** A chain link is finished business: accepting the prerequisite is not enough. */
export function prerequisitesMet(definition: QuestDefinition, log: QuestLog): boolean {
  return (definition.requires ?? []).every((questId) => isQuestDone(log, questId));
}

/** The prerequisite a locked quest is waiting on, named, or null once it is open. */
export function blockingRequirement(definition: QuestDefinition, log: QuestLog): string | null {
  const waiting = (definition.requires ?? []).find((questId) => !isQuestDone(log, questId));
  return waiting ? QUESTS[waiting].name : null;
}

export function questState(
  definition: QuestDefinition,
  log: QuestLog,
  counters: QuestCounters,
): QuestOfferState {
  const status = questStatus(log, definition.id);
  if (status === 'done') {
    return 'done';
  }
  if (status !== 'active') {
    return prerequisitesMet(definition, log) ? 'available' : 'locked';
  }
  return questProgress(definition, log, counters).met ? 'ready' : 'active';
}

/** Everything this NPC has to say, in a fixed order so the panel doesn't reshuffle. */
export function questsForNpc(npcId: NpcId, log: QuestLog, counters: QuestCounters): QuestOffer[] {
  return QUEST_ORDER.map((id) => QUESTS[id])
    .filter((definition) => definition.giverNpcId === npcId)
    .map((definition) => ({
      definition,
      state: questState(definition, log, counters),
      progress: questProgress(definition, log, counters),
      requirement: blockingRequirement(definition, log),
    }));
}

/** What is worth drawing over a quest giver's head. `done` never is. */
export type QuestMarker = Exclude<QuestOfferState, 'done' | 'locked'>;

// How much each glyph is worth being told, which is what "most actionable"
// means: something to take beats something to hand in beats something to work.
const MARKER_RANK: Record<QuestMarker, number> = { available: 3, ready: 2, active: 1 };

/**
 * The more actionable of two markers, for a person with more than one kind of
 * thing to say.
 *
 * Nobody stands in a town both giving quests and posting bounties today, so
 * every call to this has one answer and one `null` — which is precisely when the
 * rule is worth writing down rather than left to whichever of the two happened
 * to be asked first.
 */
export function strongerMarker(
  first: QuestMarker | null,
  second: QuestMarker | null,
): QuestMarker | null {
  if (!first) return second;
  if (!second) return first;
  return MARKER_RANK[first] >= MARKER_RANK[second] ? first : second;
}

/**
 * The one marker an NPC wears, out of everything they currently have to say.
 *
 * The most actionable thing wins rather than the first one in `QUEST_ORDER`: a
 * quest waiting to be taken outranks one waiting to be handed in, and both
 * outrank one still being worked. A player who can see only one glyph should be
 * told the thing that gets them furthest for walking over. A quest still behind
 * its prerequisites is not one of those things and wears nothing.
 */
export function npcMarker(
  npcId: NpcId,
  log: QuestLog,
  counters: QuestCounters,
): QuestMarker | null {
  let ready = false;
  let active = false;
  for (const id of QUEST_ORDER) {
    const definition = QUESTS[id];
    if (definition.giverNpcId !== npcId) continue;
    const state = questState(definition, log, counters);
    if (state === 'available') return 'available';
    if (state === 'ready') ready = true;
    if (state === 'active') active = true;
  }
  return ready ? 'ready' : active ? 'active' : null;
}

export function activeQuests(log: QuestLog): QuestDefinition[] {
  return QUEST_ORDER.map((id) => QUESTS[id]).filter(
    (definition) => questStatus(log, definition.id) === 'active',
  );
}

export function canAccept(definition: QuestDefinition, log: QuestLog): boolean {
  return log[definition.id] === undefined && prerequisitesMet(definition, log);
}

/** One-time only: a quest already turned in is never offered again. */
export function canTurnIn(
  definition: QuestDefinition,
  log: QuestLog,
  counters: QuestCounters,
): boolean {
  return (
    questStatus(log, definition.id) === 'active' && questProgress(definition, log, counters).met
  );
}

/**
 * Takes the quest on, remembering where its tally stood. The caller reads the
 * baseline off the character (`objectiveTally`), because this reducer is handed
 * the log and nothing else.
 */
export function acceptQuest(log: QuestLog, questId: QuestId, baseline: number): QuestLog {
  return { ...log, [questId]: { status: 'active', baseline } };
}

export function completeQuest(log: QuestLog, questId: QuestId): QuestLog {
  return { ...log, [questId]: { status: 'done', baseline: log[questId]?.baseline ?? 0 } };
}

/** The tracker strip's line for one quest, e.g. "Bones for the Broth  4/10". */
export function formatQuestProgress(
  definition: QuestDefinition,
  log: QuestLog,
  counters: QuestCounters,
): string {
  const { have, need } = questProgress(definition, log, counters);
  return `${definition.name}  ${have} / ${need}`;
}
