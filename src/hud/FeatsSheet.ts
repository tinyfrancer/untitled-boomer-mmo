import { Sheet } from './Sheet';
import { el, emptyLine, row } from './dom';
import { ENEMIES } from '../data/enemies';
import type { AchievementDefinition } from '../data/achievements';
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
 * The slayer chains, grouped by creature, and which earned title is worn.
 *
 * Every rank pays a title, so an earned rank's row is the button that wears it:
 * a picker of its own would be up to three buttons a creature pinned above the
 * list. What stays pinned is the one line saying what is worn, and the way to
 * take it off, since that is the only thing on the sheet that is not a row.
 */
export class FeatsSheet extends Sheet {
  private readonly worn: HTMLElement;
  private readonly onSetTitle: (titleId: TitleId | null) => void;

  constructor(onSetTitle: (titleId: TitleId | null) => void) {
    super('Feats', THEME.panelWidth.character);
    this.onSetTitle = onSetTitle;
    this.worn = el('div', 'hud-titles');
    this.root.insertBefore(this.worn, this.body);
  }

  update(kills: KillCounts, activeTitleId: TitleId | null): void {
    this.buildWorn(kills, activeTitleId);
    this.buildRows(kills, activeTitleId);
  }

  private buildWorn(kills: KillCounts, activeTitleId: TitleId | null): void {
    this.worn.replaceChildren();
    if (earnedTitles(kills).length === 0) {
      this.worn.append(emptyLine('Every rank below is a title to wear, the first at 25 slain.'));
      return;
    }
    this.worn.append(
      el(
        'div',
        'hud-titles__worn',
        activeTitleId
          ? `Title: ${titleName(activeTitleId)}`
          : 'No title worn. Tap a rank to wear it.',
      ),
    );
    if (activeTitleId) {
      const off = el('button', 'hud-button', 'Take off');
      off.type = 'button';
      off.dataset.title = 'none';
      off.addEventListener('click', () => this.onSetTitle(null));
      this.worn.append(off);
    }
  }

  private buildRows(kills: KillCounts, activeTitleId: TitleId | null): void {
    this.body.replaceChildren();
    for (const enemyId of Object.keys(ENEMIES) as EnemyId[]) {
      const slain = killCount(kills, enemyId);
      const group = el('div', 'hud-feat-group');
      group.append(featRow('hud-row hud-row--group', ENEMIES[enemyId].name, `${slain} slain`).root);

      for (const definition of allAchievements()) {
        if (definition.enemyId !== enemyId) continue;
        group.append(tierRow(definition, slain, activeTitleId, this.onSetTitle));
      }
      this.body.append(group);
    }
  }
}

function tierRow(
  definition: AchievementDefinition,
  slain: number,
  activeTitleId: TitleId | null,
  onSetTitle: (titleId: TitleId | null) => void,
): HTMLElement {
  if (slain < definition.threshold) {
    const line = featRow(
      'hud-row hud-row--tier',
      definition.name,
      `${slain} / ${definition.threshold} slain`,
    );
    return line.root;
  }
  const worn = activeTitleId === definition.titleId;
  const line = row({
    className: 'hud-list-row hud-feat-title',
    label: `✓ ${definition.name}`,
    value: worn ? 'Worn' : 'Wear',
    valueClass: 'hud-muted',
    // Tapping the worn rank takes it off, so the row is a toggle like the
    // button that sits pinned above.
    onClick: () => onSetTitle(worn ? null : definition.titleId),
  });
  line.root.dataset.title = definition.titleId;
  line.root.classList.add('is-earned');
  line.root.classList.toggle('is-selected', worn);
  return line.root;
}

function featRow(className: string, label: string, value: string) {
  return row({ className, label, value, valueClass: 'hud-muted' });
}
