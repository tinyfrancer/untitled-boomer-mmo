import { Sheet } from './Sheet';
import { el } from './dom';
import { ENEMIES } from '../data/enemies';
import {
  allAchievements,
  earnedTitles,
  killCount,
  titleName,
  type KillCounts,
} from '../systems/AchievementSystem';
import { THEME } from '../ui/theme';
import type { EnemyId, TitleId } from '../types/ids';

/**
 * The slayer chains, grouped by creature, plus the picker for which earned
 * title to wear.
 *
 * The picker sits above the scrolling body rather than inside it: it is the
 * only interactive thing here, and pinning it means the scrolling region holds
 * nothing but text.
 */
export class FeatsSheet extends Sheet {
  private readonly picker: HTMLElement;
  private readonly onSetTitle: (titleId: TitleId | null) => void;

  constructor(onSetTitle: (titleId: TitleId | null) => void) {
    super('Achievements', THEME.panelWidth.character);
    this.onSetTitle = onSetTitle;
    this.picker = el('div', 'hud-titles');
    this.root.insertBefore(this.picker, this.body);
  }

  update(kills: KillCounts, activeTitleId: TitleId | null): void {
    this.buildPicker(kills, activeTitleId);
    this.buildRows(kills);
  }

  private buildPicker(kills: KillCounts, activeTitleId: TitleId | null): void {
    this.picker.replaceChildren();
    const earned = earnedTitles(kills);
    if (earned.length === 0) {
      this.picker.append(el('div', 'hud-dim', 'Slay 100 of a creature to earn its title.'));
      return;
    }
    const choices: (TitleId | null)[] = [null, ...earned];
    for (const titleId of choices) {
      const button = el('button', 'hud-button', titleId ? titleName(titleId) : 'None');
      button.type = 'button';
      button.dataset.title = titleId ?? 'none';
      button.classList.toggle('is-selected', activeTitleId === titleId);
      button.addEventListener('click', () => this.onSetTitle(titleId));
      this.picker.append(button);
    }
  }

  private buildRows(kills: KillCounts): void {
    this.body.replaceChildren();
    for (const enemyId of Object.keys(ENEMIES) as EnemyId[]) {
      const slain = killCount(kills, enemyId);
      const group = el('div', 'hud-feat-group');
      group.append(row('hud-row hud-row--group', ENEMIES[enemyId].name, `${slain} slain`));

      for (const definition of allAchievements()) {
        if (definition.enemyId !== enemyId) continue;
        const done = slain >= definition.threshold;
        const line = row(
          'hud-row hud-row--tier',
          done ? `✓ ${definition.name}` : definition.name,
          done ? 'earned' : `${slain}/${definition.threshold}`,
        );
        line.classList.toggle('is-earned', done);
        group.append(line);
      }
      this.body.append(group);
    }
  }
}

function row(className: string, label: string, value: string): HTMLElement {
  const node = el('div', className);
  node.append(el('span', undefined, label), el('span', 'hud-muted', value));
  return node;
}
