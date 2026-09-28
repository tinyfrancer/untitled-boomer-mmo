import { el, place } from './dom';
import {
  activeQuests,
  formatQuestProgress,
  questProgress,
  type QuestCounters,
  type QuestLog,
} from '../systems/QuestSystem';
import { bountyById, bountyProgress, type ActiveBounty } from '../systems/BountySystem';
import { MAX_TRACKED_QUESTS, type Rect } from '../ui/layout';

/**
 * One line per quest in progress, pinned above the ability bar. No background
 * and no hit area: a player should never have to open a sheet to find out what
 * they are in the middle of, and the strip costs nothing but its own lines.
 */
export class QuestTracker {
  readonly root: HTMLElement;

  constructor() {
    this.root = el('div', 'hud-tracker');
  }

  layout(rect: Rect): void {
    place(this.root, rect, 'width');
  }

  /**
   * The contract in hand goes *first*, above the quests.
   *
   * A quest is finished once and then stops moving; a bounty is what the player
   * chose to be doing this afternoon, and it is the line they came back to the
   * strip to read. There is only ever one, so it costs the quests at most one of
   * their two seats.
   */
  update(log: QuestLog, bounty: ActiveBounty | null, counters: QuestCounters): void {
    this.root.replaceChildren();
    const lines: { text: string; met: boolean }[] = [];

    if (bounty) {
      const definition = bountyById(bounty.bountyId);
      const { have, need, met } = bountyProgress(definition, bounty, counters);
      lines.push({ text: `${definition.name}  ${have} / ${need}`, met });
    }
    for (const definition of activeQuests(log)) {
      const { met } = questProgress(definition, log, counters);
      lines.push({ text: formatQuestProgress(definition, log, counters), met });
    }

    for (const { text, met } of lines.slice(0, MAX_TRACKED_QUESTS)) {
      const line = el('div', 'hud-tracker__line', `◆ ${text}`);
      // Complete reads as "go and hand this in", which is the only moment the
      // strip is asking for something.
      line.classList.toggle('is-met', met);
      this.root.append(line);
    }
  }
}
