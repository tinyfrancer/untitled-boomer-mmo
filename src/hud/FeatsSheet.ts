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
import { FACTIONS, FACTION_ORDER, type FactionRank } from '../data/factions';
import { standingWith, type Standing } from '../systems/FactionSystem';
import { THEME } from '../ui/theme';
import type { EnemyId, FactionId, TitleId } from '../types/ids';

/**
 * The slayer chains, grouped by creature, then the faction ranks (D3), grouped
 * by faction, and which earned title is worn.
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
    super('Feats', THEME.panelWidth.feats);
    this.onSetTitle = onSetTitle;
    this.worn = el('div', 'hud-titles');
    this.root.insertBefore(this.worn, this.body);
  }

  update(kills: KillCounts, standing: Standing, activeTitleId: TitleId | null): void {
    this.buildWorn(kills, standing, activeTitleId);
    this.buildRows(kills, standing, activeTitleId);
  }

  private buildWorn(kills: KillCounts, standing: Standing, activeTitleId: TitleId | null): void {
    this.worn.replaceChildren();
    if (earnedTitles(kills, standing).length === 0) {
      this.worn.append(
        emptyLine('Every rank below is a title to wear, the first at 25 slain or 50 standing.'),
      );
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

  private buildRows(kills: KillCounts, standing: Standing, activeTitleId: TitleId | null): void {
    this.body.replaceChildren();
    this.buildFactionRows(standing, activeTitleId);
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

  /**
   * A group per faction: where the character stands, then each rank that pays
   * a title, earned ones a button that wears it as a slayer rank's is. First,
   * since there are three of them and a creature list that only grows.
   */
  private buildFactionRows(standing: Standing, activeTitleId: TitleId | null): void {
    for (const factionId of FACTION_ORDER) {
      const value = standingWith(standing, factionId);
      const group = el('div', 'hud-feat-group');
      group.dataset.faction = factionId;
      group.append(
        featRow('hud-row hud-row--group', FACTIONS[factionId].name, `${value} standing`).root,
      );
      for (const rank of FACTIONS[factionId].ranks) {
        if (!rank.title) continue;
        group.append(rankRow(factionId, rank, value, activeTitleId, this.onSetTitle));
      }
      this.body.append(group);
    }
  }
}

function rankRow(
  factionId: FactionId,
  rank: FactionRank,
  value: number,
  activeTitleId: TitleId | null,
  onSetTitle: (titleId: TitleId | null) => void,
): HTMLElement {
  if (value < rank.from) {
    const line = featRow('hud-row hud-row--tier', rank.name, `${value} / ${rank.from} standing`);
    line.root.dataset.rank = rank.id;
    return line.root;
  }
  // Every rank with a title is a title id: `FactionTitleId` is exactly those.
  const titleId = rank.id as TitleId;
  const worn = activeTitleId === titleId;
  const line = row({
    className: 'hud-list-row hud-feat-title',
    label: `✓ ${rank.name}`,
    value: worn ? 'Worn' : 'Wear',
    valueClass: 'hud-muted',
    onClick: () => onSetTitle(worn ? null : titleId),
  });
  line.root.dataset.title = titleId;
  line.root.dataset.rank = rank.id;
  line.root.dataset.faction = factionId;
  line.root.classList.add('is-earned');
  line.root.classList.toggle('is-selected', worn);
  return line.root;
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
