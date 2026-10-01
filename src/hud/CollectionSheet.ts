import { Sheet } from './Sheet';
import { el, row, sectionHeader } from './dom';
import { bindItemCard } from './itemCard';
import { itemIconEl } from './hudArt';
import { ENEMIES } from '../data/enemies';
import { describeItemName } from '../data/items';
import { QUESTS } from '../data/quests';
import { ZONES } from '../data/zones';
import {
  bestiary,
  bestiaryEntry,
  collectionCounts,
  itemLog,
  trophies,
  type BestiaryEntry,
  type CollectedWay,
  type CollectionState,
  type Count,
  type ItemLogEntry,
  type TrophyEntry,
} from '../systems/CollectionSystem';
import { emptyHouse } from '../systems/HouseSystem';
import { emptyWhispers } from '../systems/WhispersSystem';
import { THEME } from '../ui/theme';
import type { EnemyId } from '../types/ids';

type Page = { kind: 'index' } | { kind: 'creature'; enemyId: EnemyId } | { kind: 'items' };

const WAYS: Record<CollectedWay, string> = {
  dropped: 'Dropped',
  gathered: 'Gathered',
  made: 'Made',
};

/**
 * The collection log and the bestiary (F3): a seat of its own behind Menu.
 *
 * An index of counts, every creature and every trophy, with a page for each
 * creature's drops and one for the items collected, reached the way the skills
 * book reaches a skill's page and left by the same Back. Everything drawn comes
 * out of `CollectionSystem`, and it draws only while it is showing, since the
 * kills it counts change on every corpse.
 */
export class CollectionSheet extends Sheet {
  private readonly back: HTMLButtonElement;
  private state: CollectionState = {
    kills: {},
    seen: {},
    mastery: {},
    quests: {},
    house: emptyHouse(),
    whispers: emptyWhispers(),
  };
  private page: Page = { kind: 'index' };
  private showing = false;
  private stale = true;

  constructor() {
    super('Collection', THEME.panelWidth.collection);
    this.back = el('button', 'hud-button hud-sheet__back', '‹ Back');
    this.back.type = 'button';
    this.back.dataset.action = 'collection-back';
    this.back.addEventListener('click', () => this.show({ kind: 'index' }));
    this.head.prepend(this.back);
  }

  update(state: CollectionState): void {
    this.state = state;
    this.stale = true;
    if (this.showing) this.draw(false);
  }

  override setVisible(visible: boolean): void {
    super.setVisible(visible);
    this.showing = visible;
    if (visible && this.stale) this.draw(false);
  }

  private show(page: Page): void {
    this.page = page;
    this.draw(true);
  }

  private draw(fromTop: boolean): void {
    const scroll = fromTop ? 0 : this.body.scrollTop;
    this.stale = false;
    const { page } = this;
    this.back.classList.toggle('hud-hidden', page.kind === 'index');
    this.root.dataset.page = page.kind === 'creature' ? page.enemyId : page.kind;
    if (page.kind === 'creature') {
      const entry = bestiaryEntry(page.enemyId, this.state);
      this.setTitle(entry.name);
      this.body.replaceChildren(...creatureView(entry));
    } else if (page.kind === 'items') {
      this.setTitle('Items Collected');
      this.body.replaceChildren(...itemsView(itemLog(this.state)));
    } else {
      this.setTitle('Collection');
      this.body.replaceChildren(...this.indexView());
    }
    this.body.scrollTop = scroll;
  }

  private indexView(): HTMLElement[] {
    const counts = collectionCounts(this.state);
    const items = countRow('Items collected', counts.items, () => this.show({ kind: 'items' }));
    items.dataset.collection = 'items';
    return [
      el('div', 'hud-sheet__intro', 'What you have slain, seen and earned, out of all there is.'),
      countRow('Creatures slain', counts.slain),
      countRow('Drops seen', counts.drops),
      countRow('Slayer ranks', counts.ranks),
      countRow('Trophies', counts.trophies),
      items,
      countRow('Lore found', counts.lore),
      sectionHeader('Bestiary', 'tap for drops'),
      ...bestiary(this.state).map((entry) => this.creatureRow(entry)),
      sectionHeader('Trophies'),
      ...trophies(this.state).map(trophyRow),
    ];
  }

  private creatureRow(entry: BestiaryEntry): HTMLElement {
    const line = row({
      className: 'hud-list-row hud-collection-row',
      label: entry.complete ? `✓ ${entry.name}` : entry.name,
      value: `${entry.slain} slain · ${of(entry.dropsSeen)} drops`,
      valueClass: 'hud-list-row__value',
      onClick: () => this.show({ kind: 'creature', enemyId: entry.enemyId }),
    });
    line.root.dataset.creature = entry.enemyId;
    line.root.classList.toggle('is-complete', entry.complete);
    return line.root;
  }
}

function of(count: Count): string {
  return `${count.have} / ${count.total}`;
}

function countRow(label: string, count: Count, onClick?: () => void): HTMLElement {
  return row({
    className: 'hud-list-row hud-collection-count',
    label,
    value: onClick ? `${of(count)} ›` : of(count),
    valueClass: 'hud-list-row__value',
    onClick,
  }).root;
}

function trophyRow(entry: TrophyEntry): HTMLElement {
  const line = row({
    className: 'hud-list-row hud-collection-row',
    label: describeItemName(entry.itemId),
    value: entry.displayed ? 'At home' : entry.collected ? 'Collected' : trophyFrom(entry),
    valueClass: 'hud-list-row__value',
    icon: itemIconEl(entry.itemId),
  });
  line.root.dataset.trophy = entry.itemId;
  line.root.classList.toggle('is-unseen', !entry.collected);
  bindItemCard(line.root, entry.itemId);
  return line.root;
}

// Where a trophy not yet earned is earned, since a stand waiting on something
// should say what.
function trophyFrom(entry: TrophyEntry): string {
  if (entry.source?.kind === 'boss') return `Off ${ENEMIES[entry.source.enemyId].name}`;
  if (entry.source?.kind === 'quest') return `Quest: ${QUESTS[entry.source.questId].name}`;
  return 'Not yet';
}

function creatureView(entry: BestiaryEntry): HTMLElement[] {
  const { zones, levels } = entry.haunt;
  const facts = [
    fact('Found in', zones.map((zoneId) => ZONES[zoneId].name).join(', ') || 'Nowhere yet'),
    fact(
      'Levels',
      levels ? (levels.min === levels.max ? `${levels.min}` : `${levels.min}-${levels.max}`) : '-',
    ),
    fact('Slain', `${entry.slain}`),
    fact('Slayer ranks', of(entry.ranks)),
  ];
  if (entry.boss) facts.push(fact('Boss', 'Its drops are trophies'));
  const drops =
    entry.drops.length > 0
      ? entry.drops.map((drop) => {
          const line = row({
            className: 'hud-list-row hud-collection-row',
            label: describeItemName(drop.itemId),
            value: drop.seen ? 'Seen' : 'Not yet seen',
            valueClass: 'hud-list-row__value',
            icon: itemIconEl(drop.itemId),
          });
          line.root.dataset.drop = drop.itemId;
          line.root.classList.toggle('is-unseen', !drop.seen);
          bindItemCard(line.root, drop.itemId);
          return line.root;
        })
      : [el('div', 'hud-empty', 'It drops nothing.')];
  return [...facts, sectionHeader('Drops', `${of(entry.dropsSeen)} seen`), ...drops];
}

function fact(label: string, value: string): HTMLElement {
  return row({
    className: 'hud-list-row hud-collection-count',
    label,
    value,
    valueClass: 'hud-list-row__value',
  }).root;
}

function itemsView(entries: ItemLogEntry[]): HTMLElement[] {
  const have = entries.filter((entry) => entry.collected).length;
  return [
    el(
      'div',
      'hud-sheet__intro',
      'Everything a creature drops, a node yields or a station makes, and how it has come to you.',
    ),
    sectionHeader('Items', `${have} / ${entries.length} collected`),
    ...entries.map((entry) => {
      const line = row({
        className: 'hud-list-row hud-collection-row',
        label: describeItemName(entry.itemId),
        value: entry.collected
          ? entry.had.map((way) => WAYS[way]).join(', ')
          : `Not yet · ${entry.ways.map((way) => WAYS[way].toLowerCase()).join(' or ')}`,
        valueClass: 'hud-list-row__value',
        icon: itemIconEl(entry.itemId),
      });
      line.root.dataset.item = entry.itemId;
      line.root.classList.toggle('is-unseen', !entry.collected);
      bindItemCard(line.root, entry.itemId);
      return line.root;
    }),
  ];
}
