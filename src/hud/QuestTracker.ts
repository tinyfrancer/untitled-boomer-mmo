import { el, place } from './dom';
import {
  activeQuests,
  formatQuestProgress,
  questProgress,
  type QuestLog,
} from '../systems/QuestSystem';
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
    place(this.root, rect, 'position');
    this.root.style.width = `${rect.width}px`;
  }

  update(log: QuestLog, inventory: Record<string, number>): void {
    this.root.replaceChildren();
    for (const definition of activeQuests(log).slice(0, MAX_TRACKED_QUESTS)) {
      const { met } = questProgress(definition, inventory);
      const line = el(
        'div',
        'hud-tracker__line',
        `◆ ${formatQuestProgress(definition, inventory)}`,
      );
      // Complete reads as "go and hand this in", which is the only moment the
      // strip is asking for something.
      line.classList.toggle('is-met', met);
      this.root.append(line);
    }
  }
}
