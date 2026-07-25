import { QUESTS, QUEST_ORDER, type QuestDefinition } from '../data/quests';
import type { Inventory } from './InventorySystem';
import type { NpcId, QuestId } from '../types/ids';

export type QuestStatus = 'active' | 'done';

/**
 * The only quest state worth storing. Progress is *not* in here: both quests
 * are "hold N of an item", and items arrive from loot, gathering, cooking,
 * buying and offline camping alike. Counting the bag on read means there is no
 * counter to keep in step with it, and no path that can forget to bump one.
 */
export type QuestLog = Partial<Record<QuestId, QuestStatus>>;

export interface QuestProgress {
  have: number;
  need: number;
  met: boolean;
}

export type QuestOfferState = 'available' | 'active' | 'ready' | 'done';

export interface QuestOffer {
  definition: QuestDefinition;
  state: QuestOfferState;
  progress: QuestProgress;
}

export function questProgress(definition: QuestDefinition, inventory: Inventory): QuestProgress {
  const need = definition.objective.quantity;
  const have = Math.min(inventory[definition.objective.itemId] ?? 0, need);
  return { have, need, met: have >= need };
}

export function questState(
  definition: QuestDefinition,
  log: QuestLog,
  inventory: Inventory,
): QuestOfferState {
  const status = log[definition.id];
  if (status === 'done') {
    return 'done';
  }
  if (status !== 'active') {
    return 'available';
  }
  return questProgress(definition, inventory).met ? 'ready' : 'active';
}

/** Everything this NPC has to say, in a fixed order so the panel doesn't reshuffle. */
export function questsForNpc(npcId: NpcId, log: QuestLog, inventory: Inventory): QuestOffer[] {
  return QUEST_ORDER.map((id) => QUESTS[id])
    .filter((definition) => definition.giverNpcId === npcId)
    .map((definition) => ({
      definition,
      state: questState(definition, log, inventory),
      progress: questProgress(definition, inventory),
    }));
}

export function activeQuests(log: QuestLog): QuestDefinition[] {
  return QUEST_ORDER.map((id) => QUESTS[id]).filter(
    (definition) => log[definition.id] === 'active',
  );
}

export function canAccept(definition: QuestDefinition, log: QuestLog): boolean {
  return log[definition.id] === undefined;
}

/** One-time only: a quest already turned in is never offered again. */
export function canTurnIn(
  definition: QuestDefinition,
  log: QuestLog,
  inventory: Inventory,
): boolean {
  return log[definition.id] === 'active' && questProgress(definition, inventory).met;
}

export function acceptQuest(log: QuestLog, questId: QuestId): QuestLog {
  return { ...log, [questId]: 'active' };
}

export function completeQuest(log: QuestLog, questId: QuestId): QuestLog {
  return { ...log, [questId]: 'done' };
}

/** The tracker strip's line for one quest, e.g. "Bones for the Broth  4/10". */
export function formatQuestProgress(definition: QuestDefinition, inventory: Inventory): string {
  const { have, need } = questProgress(definition, inventory);
  return `${definition.name}  ${have}/${need}`;
}
