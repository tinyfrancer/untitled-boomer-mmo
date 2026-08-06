import { Sheet } from './Sheet';
import { el } from './dom';
import { QUESTS, QUEST_ORDER } from '../data/quests';
import { describeItemName } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import { questProgress, questState, type QuestLog } from '../systems/QuestSystem';
import { THEME } from '../ui/theme';
import type { ClassId } from '../types/ids';
import type { Inventory } from '../systems/InventorySystem';

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

  update(log: QuestLog, inventory: Inventory): void {
    this.body.replaceChildren();

    const taken = QUEST_ORDER.map((id) => QUESTS[id]).filter((quest) => log[quest.id]);
    if (taken.length === 0) {
      this.body.append(
        el('div', 'hud-quest__line is-done', 'Nobody has asked you for anything yet.'),
        el('div', 'hud-quest__line is-done', 'Try the shopkeeper in town.'),
      );
      return;
    }

    for (const quest of taken) {
      const state = questState(quest, log, inventory);
      const { have, need } = questProgress(quest, inventory);
      const done = state === 'done';

      const block = el('div', 'hud-quest');
      const name = el('div', 'hud-quest__name', quest.name);
      name.classList.toggle('is-done', done);

      const progress = el(
        'div',
        'hud-quest__line',
        done
          ? 'Handed in.'
          : `${describeItemName(quest.objective.itemId)}  ${have}/${need}${
              state === 'ready' ? '  — ready to hand in' : ''
            }`,
      );
      progress.classList.toggle('is-done', done);
      progress.classList.toggle('is-ready', state === 'ready');
      block.append(name, progress);

      if (!done) {
        const reward = quest.reward;
        block.append(
          el(
            'div',
            'hud-quest__reward',
            `Pays ${formatCurrency(reward.copper)}, ${reward.xp} XP and ${describeItemName(
              reward.gear[this.classId],
            )}`,
          ),
        );
      }
      this.body.append(block);
    }
  }
}
