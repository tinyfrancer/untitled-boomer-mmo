import { QUESTS } from '../data/quests';
import { logQuestAccepted, logQuestCompleted } from '../systems/CombatLogSystem';
import type { CombatXpGain } from '../systems/CharacterController';
import type { QuestId, TitleId } from '../types/ids';
import type { WorldNpc } from './zoneEntities';
import { QUEST_LOG_CHANGED_EVENT, TITLE_CHANGED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';

/** What the desk needs from the rest of the zone, and the whole of it. */
export interface QuestDeskDeps {
  /**
   * Whoever the player is standing at — talking to, or served by — or null.
   *
   * A quest is taken from and handed to the person who gives it, so this is
   * asked rather than whether a particular window is open: while the shopkeeper
   * was the only giver the two were the same question, and a second giver is
   * exactly where they stop being.
   */
  servingNpc: () => WorldNpc | null;
  /**
   * Handing a quest in is something the player did, so its XP goes straight to
   * the publisher rather than through the camp's halving.
   */
  publishXpGain: (gain: CombatXpGain) => void;
}

/**
 * Taking a quest, handing one in, and choosing which earned title to wear.
 *
 * Offered in a conversation rather than from a panel of its own: a quest is
 * taken from the person who gives it, so it is open exactly while the player is
 * standing at them. The talk panel is where the HUD draws it; the world asks
 * only who, so a counter of theirs answers the same.
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
    if (!this.isServedBy(questId)) return;
    if (!this.ctx.character.acceptQuest(questId)) return;
    this.ctx.log(logQuestAccepted(QUESTS[questId].name));
    this.announce();
    this.ctx.persistCharacter();
  }

  turnIn(questId: QuestId): void {
    if (!this.isServedBy(questId)) return;
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

  // Asked on every request rather than trusted from the panel, which was drawn
  // from a copy of the log and may be describing a counter walked away from.
  private isServedBy(questId: QuestId): boolean {
    return this.deps.servingNpc()?.npcId === QUESTS[questId].giverNpcId;
  }

  private announce(): void {
    this.ctx.events.emit(QUEST_LOG_CHANGED_EVENT, this.ctx.character.state.quests);
  }
}
