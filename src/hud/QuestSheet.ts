import { BUILDINGS } from '../data/buildings';
import { HOUSE_BUILDING } from '../data/house';
import { Sheet } from './Sheet';
import { el, emptyLine, sectionHeader, tag } from './dom';
import { bountyById, bountyProgress, type ActiveBounty } from '../systems/BountySystem';
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

  update(log: QuestLog, bounty: ActiveBounty | null, counters: QuestCounters): void {
    this.body.replaceChildren();

    const taken = QUEST_ORDER.map((id) => QUESTS[id]).filter((quest) => log[quest.id]);
    if (taken.length === 0 && !bounty) {
      this.body.append(
        emptyLine('Nobody has asked you for anything yet.'),
        emptyLine('Try the shopkeeper or the quartermaster in town.'),
      );
      return;
    }

    // The contract first and under its own heading, because the two are not the
    // same kind of thing: a quest is a story told once, and this is the work the
    // player picked up this afternoon and can give back.
    if (bounty) {
      this.body.append(sectionHeader('Contract'));
      this.body.append(this.contractBlock(bounty, counters));
    }
    if (taken.length > 0 && bounty) {
      this.body.append(sectionHeader('Quests'));
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
          : `${describeObjective(quest.objective)}  ${have} / ${need}${
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

  /**
   * The one contract in hand, drawn as a quest block with no chain behind it,
   * and marked as the one thing in the log that comes back once it is done.
   */
  private contractBlock(bounty: ActiveBounty, counters: QuestCounters): HTMLElement {
    const definition = bountyById(bounty.bountyId);
    const { have, need, met } = bountyProgress(definition, bounty, counters);

    const block = el('div', 'hud-quest');
    const name = el('div', 'hud-quest__name', definition.name);
    name.append(tag('Repeatable'));
    block.append(name);
    const progress = el(
      'div',
      'hud-quest__line',
      `${describeObjective(definition.objective)}  ${have} / ${need}${
        met ? '  — ready to hand in' : ''
      }`,
    );
    progress.classList.toggle('is-ready', met);
    block.append(
      progress,
      el(
        'div',
        'hud-quest__reward',
        `Pays ${formatCurrency(definition.reward.copper)}, ${definition.reward.xp} XP`,
      ),
    );
    return block;
  }

  // Most quests pay coin and XP alone, so the gear, the keepsake and the house
  // are written only when there is one to name rather than left as an empty
  // tail, and no coin is left out rather than written as nothing.
  private describeReward(reward: QuestReward): string {
    const parts = [
      ...(reward.copper > 0 ? [formatCurrency(reward.copper)] : []),
      `${reward.xp} XP`,
    ];
    const gear = reward.gear?.[this.classId];
    if (gear) parts.push(describeItemName(gear));
    if (reward.keepsake) parts.push(`${describeItemName(reward.keepsake)} to keep`);
    if (reward.house) parts.push(BUILDINGS[HOUSE_BUILDING].name);
    const last = parts.pop();
    return parts.length > 0 ? `${parts.join(', ')} and ${last}` : (last ?? '');
  }
}
