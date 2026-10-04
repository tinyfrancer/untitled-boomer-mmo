import { Overlay } from './Overlay';
import { CounterSides } from './counterSides';
import { el, emptyLine, row, sectionHeader, stackRow } from './dom';
import { Purse } from './purse';
import { itemIconEl } from './hudArt';
import { bindItemCard } from './itemCard';
import { ENEMIES } from '../data/enemies';
import {
  CHEST_SLOTS,
  HOUSE_UPGRADE_ORDER,
  HOUSE_UPGRADES,
  fixtureKey,
  type HouseFixture,
} from '../data/house';
import { describeItemName } from '../data/items';
import type { KillCounts } from '../systems/AchievementSystem';
import {
  chestSlotsUsed,
  isBuilt,
  isTrophy,
  nextUpgrade,
  onStand,
  plaques,
  type HouseState,
} from '../systems/HouseSystem';
import { inventoryEntries, type Inventory } from '../systems/InventorySystem';
import { THEME } from '../ui/theme';
import { formatCurrency } from '../systems/CurrencySystem';
import type { HouseUpgradeId, ItemId } from '../types/ids';

/** Everything the panel draws, all of it a copy the world still owns. */
export interface HousePanelState {
  house: HouseState;
  inventory: Inventory;
  kills: KillCounts;
  /** The coin in hand, which the plans are bought with (F2). */
  currency: number;
}

export interface HouseHandlers {
  onDisplay: (itemId: ItemId) => void;
  /** How many to move: the row takes one, the button beside it the lot. */
  onDeposit: (itemId: ItemId, quantity: number) => void;
  onWithdraw: (itemId: ItemId, quantity: number) => void;
  /** Builds the next stage off the plans (F2). */
  onBuild: (upgrade: HouseUpgradeId) => void;
  /** The X: the world owns whether anything in the house is open, so this asks. */
  onDismiss: () => void;
}

const TITLES: Record<HouseFixture['kind'], string> = {
  stand: 'Stand',
  chest: 'Chest',
  wall: 'Wall of Plaques',
  plans: 'The Plans',
};

/**
 * Whatever in the house was walked up to (F1): a bare stand's choice of
 * trophy, the chest with the bag beside it, or the wall's plaques named.
 *
 * One panel for the three, since only one is ever open and each is a short
 * list. The chest is the bank's panel at a smaller size, down to a row moving
 * one and the button beside it the stack (`CounterSides`), so the two read
 * the same; it has no shelf to rent, since the chest is the size it is. A
 * stand that holds something never opens this: a tap on it hands the trophy
 * back.
 *
 * Not a scrim, for the shop's reason: a tap outside it still reaches the
 * world, or the player could not walk across the room.
 */
export class HouseModal extends Overlay {
  readonly fixture: HouseFixture;
  private readonly handlers: HouseHandlers;
  private readonly count: HTMLElement;
  private readonly body: HTMLElement;
  private readonly sides: CounterSides | null;
  private readonly purse: Purse | null;

  constructor(fixture: HouseFixture, handlers: HouseHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.fixture = fixture;
    this.handlers = handlers;
    this.root.dataset.house = fixtureKey(fixture);
    const chest = fixture.kind === 'chest';
    const box = el('div', `hud-modal__box hud-modal__box--${chest ? 'bank' : 'station'}`);

    const head = el('div', 'hud-modal__head');
    head.append(el('div', 'hud-modal__title', TITLES[fixture.kind]));
    this.count = el('div', 'hud-house__count');
    // The plans are bought from, so they show the coin in hand as a counter does.
    this.purse = fixture.kind === 'plans' ? new Purse() : null;
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-house';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(this.count, ...(this.purse ? [this.purse.root] : []), close);

    if (chest) {
      this.sides = new CounterSides(box);
      this.body = this.sides.theirs;
      box.append(head, this.sides.root);
    } else {
      this.sides = null;
      this.body = el('div', 'hud-modal__body');
      box.append(head, this.body);
    }
    this.root.append(box);
  }

  layout(viewportWidth: number): void {
    this.sides?.layout(viewportWidth);
  }

  update(state: HousePanelState): void {
    switch (this.fixture.kind) {
      case 'stand':
        this.drawStand(this.fixture.stand, state);
        return;
      case 'chest':
        this.drawChest(state);
        return;
      case 'wall':
        this.drawWall(state);
        return;
      case 'plans':
        this.drawPlans(state);
    }
  }

  /**
   * The lot as the surveyor drew it (F2): every stage in the order it is
   * built, what it builds and what it costs, the built ones marked and the
   * next one a tap to buy. The ones after it are greyed, since each needs the
   * one before.
   */
  private drawPlans(state: HousePanelState): void {
    const built = HOUSE_UPGRADE_ORDER.filter((id) => isBuilt(state.house, id)).length;
    this.count.textContent = `${built} / ${HOUSE_UPGRADE_ORDER.length} built`;
    this.count.style.color = THEME.color.muted;
    this.purse?.set(state.currency);
    const next = nextUpgrade(state.house);
    this.body.replaceChildren(
      sectionHeader('The lot, as it was drawn', 'tap the next to build it'),
    );
    for (const id of HOUSE_UPGRADE_ORDER) {
      const upgrade = HOUSE_UPGRADES[id];
      const done = isBuilt(state.house, id);
      const isNext = next?.id === id;
      const entry = row({
        className: 'hud-list-row',
        label: upgrade.name,
        value: done ? 'Built' : formatCurrency(upgrade.price),
        valueClass: 'hud-list-row__value',
        onClick: isNext ? () => this.handlers.onBuild(id) : undefined,
      });
      entry.root.dataset.upgrade = id;
      if (isNext) entry.root.dataset.action = 'build-upgrade';
      const affordable = isNext && state.currency >= upgrade.price;
      entry.label.style.color = done
        ? THEME.color.levelUp
        : affordable
          ? THEME.color.equippable
          : THEME.color.dim;
      entry.value.style.color = done ? THEME.color.muted : THEME.color.levelUp;
      this.body.append(entry.root, emptyLine(upgrade.builds));
      // A row that cannot be tapped says what it Needs: the stage before it,
      // or the coin the purse is short by (decision 138).
      const before = HOUSE_UPGRADE_ORDER[HOUSE_UPGRADE_ORDER.indexOf(id) - 1];
      if (!done && !isNext && before) {
        this.body.append(emptyLine(`Needs ${HOUSE_UPGRADES[before].name} built first`));
      } else if (isNext && !affordable) {
        this.body.append(emptyLine(`Needs ${formatCurrency(upgrade.price - state.currency)} more`));
      }
    }
    if (!next) this.body.append(emptyLine('(everything on the plans is built)'));
  }

  /** A bare stand: every trophy in the bag, a tap setting one out. */
  private drawStand(stand: number, state: HousePanelState): void {
    this.count.textContent = '';
    this.body.replaceChildren(sectionHeader('Set out a trophy', 'tap to set it here'));
    const held = onStand(state.house, stand);
    if (held) {
      this.body.append(emptyLine(`${describeItemName(held)} stands here.`));
      return;
    }
    const trophies = entriesOf(state.inventory).filter(([itemId]) => isTrophy(itemId));
    if (trophies.length === 0) {
      this.body.append(
        emptyLine("(no trophy in your bag: a boss's drop or a keepsake stands here)"),
      );
      return;
    }
    for (const [itemId, quantity] of trophies) {
      const entry = row({
        className: 'hud-list-row',
        label: describeItemName(itemId),
        value: `x${quantity}`,
        valueClass: 'hud-list-row__value',
        icon: itemIconEl(itemId),
        onClick: () => this.handlers.onDisplay(itemId),
      });
      entry.root.dataset.item = itemId;
      entry.root.dataset.display = itemId;
      bindItemCard(entry.root, itemId);
      entry.value.style.color = THEME.color.muted;
      this.body.append(entry.root);
    }
  }

  /** The chest on one side and the bag on the other, as the bank draws its counter. */
  private drawChest(state: HousePanelState): void {
    const used = chestSlotsUsed(state.house.chest);
    this.count.textContent = `${used} / ${CHEST_SLOTS} slots`;
    this.count.style.color = used >= CHEST_SLOTS ? THEME.color.playerDamage : THEME.color.muted;

    const stored = entriesOf(state.house.chest);
    this.body.replaceChildren(sectionHeader('In the chest', 'tap to take'));
    if (stored.length === 0) this.body.append(emptyLine('(the chest is empty)'));
    for (const [itemId, quantity] of stored) {
      this.body.append(this.moveRow('withdraw', itemId, quantity));
    }

    const bag = this.sides?.yours;
    if (!bag) return;
    const carried = entriesOf(state.inventory);
    bag.replaceChildren(sectionHeader('Your bag', 'tap to store'));
    if (carried.length === 0) bag.append(emptyLine('(nothing to store)'));
    for (const [itemId, quantity] of carried) {
      bag.append(this.moveRow('deposit', itemId, quantity));
    }
  }

  /** The plaques hung, each named for the rank it marks, and how many could hang. */
  private drawWall(state: HousePanelState): void {
    const hung = plaques(state.kills);
    const creatures = Object.keys(ENEMIES).length;
    this.count.textContent = `${hung.length} / ${creatures} plaques`;
    this.count.style.color = THEME.color.muted;
    this.body.replaceChildren(sectionHeader('On the wall', 'one a creature, at its highest rank'));
    if (hung.length === 0) {
      this.body.append(
        emptyLine('(no plaques yet: a slayer rank against any creature hangs one here)'),
      );
      return;
    }
    for (const plaque of hung) {
      const entry = row({
        className: 'hud-list-row',
        label: plaque.name,
        value: ENEMIES[plaque.enemyId].name,
        valueClass: 'hud-list-row__value',
      });
      entry.root.dataset.plaque = plaque.enemyId;
      entry.label.style.color = THEME.color.levelUp;
      entry.value.style.color = THEME.color.muted;
      this.body.append(entry.root);
    }
  }

  private moveRow(
    direction: 'deposit' | 'withdraw',
    itemId: ItemId,
    quantity: number,
  ): HTMLElement {
    const move = direction === 'deposit' ? this.handlers.onDeposit : this.handlers.onWithdraw;
    const entry = row({
      className: 'hud-list-row',
      label: describeItemName(itemId),
      value: `x${quantity}`,
      valueClass: 'hud-list-row__value',
      icon: itemIconEl(itemId),
      onClick: () => move(itemId, 1),
    });
    entry.root.dataset.item = itemId;
    entry.root.dataset.chest = direction;
    bindItemCard(entry.root, itemId);
    entry.value.style.color = THEME.color.muted;
    if (quantity < 2) return entry.root;

    const verb = direction === 'deposit' ? 'Store' : 'Take';
    const pair = stackRow(entry.root, {
      title: `${verb} all ${quantity}`,
      onClick: () => move(itemId, quantity),
    });
    pair.all.dataset.chestAll = itemId;
    return pair.root;
  }
}

// What a bag or the chest holds, with the zero-count keys a sparse Inventory can carry left out.
function entriesOf(inventory: Inventory): [ItemId, number][] {
  return inventoryEntries(inventory).filter(([, quantity]) => quantity > 0);
}
