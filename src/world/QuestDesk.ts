import { QUESTS } from '../data/quests';
import { logQuestAccepted, logQuestCompleted } from '../systems/CombatLogSystem';
import type { CombatXpGain } from '../systems/CharacterController';
import type { QuestId, TitleId } from '../types/ids';
import { QUEST_LOG_CHANGED_EVENT, TITLE_CHANGED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';

/** What the desk needs from the rest of the zone, and the whole of it. */
export interface QuestDeskDeps {
  /** The quest board is a page of the shop window: closing it walks away from both. */
  isShopOpen: () => boolean;
  /**
   * Handing a quest in is something the player did, so its XP goes straight to
   * the publisher rather than through the camp's halving.
   */
  publishXpGain: (gain: CombatXpGain) => void;
}

/**
 * The shopkeeper's other counter: taking a quest, handing one in, and choosing
 * which earned title to wear.
 *
 * Progress is not tracked here and is not tracked anywhere — `QuestSystem`
 * counts a "bring me N of X" off the bag on read, which is what makes looting,
 * gathering, cooking, buying and an offline camp all count without any of them
 * knowing a quest exists.
 */
export class QuestDesk {
  private readonly ctx: WorldContext;
  private readonly deps: QuestDeskDeps;

  constructor(ctx: WorldContext, deps: QuestDeskDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  accept(questId: QuestId): void {
    if (!this.deps.isShopOpen()) return;
    if (!this.ctx.character.acceptQuest(questId)) return;
    this.ctx.log(logQuestAccepted(QUESTS[questId].name));
    this.announce();
    this.ctx.persistCharacter();
  }

  turnIn(questId: QuestId): void {
    if (!this.deps.isShopOpen()) return;
    // The controller refuses as a whole rather than half-applying: taking the
    // objective and finding no room for the reward is the one outcome that
    // cannot be undone.
    const result = this.ctx.character.turnInQuest(questId);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    this.ctx.log(logQuestCompleted(QUESTS[questId].name));
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
    this.announce();
    this.deps.publishXpGain(result.xp);
    this.ctx.persistCharacter();
  }

  /** Null takes the title off, which is always allowed. */
  wearTitle(titleId: TitleId | null): void {
    if (!this.ctx.character.setActiveTitle(titleId)) return;
    this.ctx.events.emit(TITLE_CHANGED_EVENT, this.ctx.character.state.activeTitleId);
    this.ctx.persistCharacter();
  }

  private announce(): void {
    this.ctx.events.emit(QUEST_LOG_CHANGED_EVENT, this.ctx.character.state.quests);
  }
}
