import { Sheet } from './Sheet';
import { el, emptyLine } from './dom';
import { QUESTS, QUEST_ORDER, type QuestReward } from '../data/quests';
import { describeItemName } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import {
  describeObjective,
  questProgress,
  questState,
  type QuestCounters,
  type QuestLog,
} from '../systems/QuestSystem';
import { THEME } from '../ui/theme';
import type { ClassId } from '../types/ids';

/**
 * The quest log: what has been taken on, how far along it is, and what it pays.
 * Read-only — quests are accepted and handed in at the shopkeeper, because that
 * is where the conversation is.
 */
export class QuestSheet extends Sheet {
  private readonly classId: ClassId;

  constructor(classId: ClassId) {
    super('Quests', THEME.panelWidth.character);
    this.classId = classId;
  }

  update(log: QuestLog, counters: QuestCounters): void {
    this.body.replaceChildren();

    const taken = QUEST_ORDER.map((id) => QUESTS[id]).filter((quest) => log[quest.id]);
    if (taken.length === 0) {
      this.body.append(
        emptyLine('Nobody has asked you for anything yet.'),
        emptyLine('Try the shopkeeper in town.'),
      );
      return;
    }

    for (const quest of taken) {
      const state = questState(quest, log, counters);
      const { have, need } = questProgress(quest, log, counters);
      const done = state === 'done';

      const block = el('div', 'hud-quest');
      const name = el('div', 'hud-quest__name', quest.name);
      name.classList.toggle('is-done', done);

      const progress = el(
        'div',
        'hud-quest__line',
        done
          ? 'Handed in.'
          : `${describeObjective(quest.objective)}  ${have}/${need}${
              state === 'ready' ? '  — ready to hand in' : ''
            }`,
      );
      progress.classList.toggle('is-done', done);
      progress.classList.toggle('is-ready', state === 'ready');
      block.append(name, progress);

      if (!done) {
        block.append(el('div', 'hud-quest__reward', `Pays ${this.describeReward(quest.reward)}`));
      }
      this.body.append(block);
    }
  }

  // Most quests pay coin and XP alone, so the gear clause is written only when
  // there is a piece to name rather than left as an empty tail.
  private describeReward(reward: QuestReward): string {
    const gear = reward.gear?.[this.classId];
    const paid = `${formatCurrency(reward.copper)}, ${reward.xp} XP`;
    return gear ? `${paid} and ${describeItemName(gear)}` : paid;
  }
}
