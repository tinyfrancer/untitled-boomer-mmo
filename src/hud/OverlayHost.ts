import { AwayReportModal } from './AwayReportModal';
import { BankModal, type BankPanelState } from './BankModal';
import { ContextMenu, type ContextMenuEntry } from './ContextMenu';
import { InspectModal } from './InspectModal';
import { MenuOverlay } from './MenuOverlay';
import { OptionsModal } from './OptionsModal';
import { ShopModal, type ShopState } from './ShopModal';
import { SlotPicker } from './SlotPicker';
import {
  ACCEPT_QUEST_REQUESTED_EVENT,
  BANK_CLOSED_EVENT,
  BUY_BANK_SLOT_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  DEPOSIT_ITEM_REQUESTED_EVENT,
  WITHDRAW_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
} from '../ui/uiEvents';
import type { InspectPanel } from '../systems/InspectSystem';
import type { ScreenPoint } from '../ui/uiEvents';
import type { PendingNotification } from '../world/GameContext';
import type { EventBus } from '../world/worldEvents';
import type { GearSlotId, ItemId } from '../types/ids';
import type { TabId } from '../ui/tabs';

/**
 * How the two counters' panels read the HUD's model.
 *
 * Getters rather than copies handed over once: the bag, the purse, the quest
 * log and the shelves are the HUD's own state, and each panel is a view of some
 * of it that happens to be open sometimes.
 */
export interface OverlayPanelState {
  shop: () => ShopState;
  bank: () => BankPanelState;
}

/** What a context menu is opened with, once the caller has named its lines. */
export interface ContextMenuSpec {
  title: string;
  titleColor?: string;
  entries: ContextMenuEntry[];
  at: ScreenPoint;
}

/**
 * The overlays, and the only thing that knows how many there are.
 *
 * Each of them is built on open and gone on close, so what is left to own is
 * which one is up — and every question about that crosses more than one of them:
 * the picker closes when the sheet under it does, Escape closes whatever the
 * player opened and nothing the world did, and a teardown has to reach all four
 * without naming them one at a time, which is exactly what the shop was left out
 * of when they were four fields on the HUD.
 *
 * It reads each panel's state through a getter rather than holding a copy: the
 * bag, the purse, the quest log and the shelves are the HUD's model, and the
 * shop and the bank are views of them that happen to be open sometimes.
 */
export class OverlayHost {
  private readonly root: HTMLElement;
  private readonly events: EventBus;
  private readonly shopState: () => ShopState;
  private readonly bankState: () => BankPanelState;

  private options: OptionsModal | null = null;
  private shop: ShopModal | null = null;
  private bank: BankModal | null = null;
  private picker: SlotPicker | null = null;
  private awayReport: AwayReportModal | null = null;
  private menu: MenuOverlay | null = null;
  private contextMenu: ContextMenu | null = null;
  private inspect: InspectModal | null = null;

  constructor(root: HTMLElement, events: EventBus, panels: OverlayPanelState) {
    this.root = root;
    this.events = events;
    this.shopState = panels.shop;
    this.bankState = panels.bank;
  }

  openOptions(): void {
    this.options?.close();
    this.options = new OptionsModal({
      onResetCharacter: () => {
        this.options?.close();
        this.events.emit(RESET_CHARACTER_REQUESTED_EVENT);
      },
      onClose: () => {
        this.options = null;
      },
    });
    this.root.append(this.options.root);
  }

  openMenu(onSelect: (tab: TabId) => void): void {
    this.menu?.close();
    this.menu = new MenuOverlay(onSelect, () => {
      this.menu = null;
    });
    this.root.append(this.menu.root);
  }

  /**
   * The list a right click or a held finger puts under the pointer.
   *
   * What the lines say and what they do is the caller's — a rat's come off the
   * wire and a bag item's are built out of the HUD's own model — so all this
   * owns is that there is only ever one of them up.
   */
  openContextMenu(spec: ContextMenuSpec): void {
    this.contextMenu?.close();
    this.contextMenu = new ContextMenu({
      title: spec.title,
      titleColor: spec.titleColor,
      entries: spec.entries,
      at: spec.at,
      bounds: { width: this.root.clientWidth, height: this.root.clientHeight },
      onClosed: () => {
        this.contextMenu = null;
      },
    });
    this.root.append(this.contextMenu.root);
  }

  closeContextMenu(): void {
    this.contextMenu?.close();
  }

  /** The card behind Inspect and Loot: a stat block, or a drop table. */
  openInspect(panel: InspectPanel): void {
    this.inspect?.close();
    this.inspect = new InspectModal(panel, () => {
      this.inspect = null;
    });
    this.root.append(this.inspect.root);
  }

  openSlotPicker(slot: GearSlotId, itemIds: ItemId[], anchor: DOMRect): void {
    this.picker?.close();
    this.picker = new SlotPicker(
      slot,
      itemIds,
      anchor,
      { width: this.root.clientWidth, height: this.root.clientHeight },
      (itemId) => this.events.emit(EQUIP_ITEM_REQUESTED_EVENT, itemId),
      () => {
        this.picker = null;
      },
    );
    this.root.append(this.picker.root);
  }

  closeSlotPicker(): void {
    this.picker?.close();
  }

  openBank(): void {
    this.bank?.close();
    this.bank = new BankModal(
      {
        onDeposit: (itemId, quantity) =>
          this.events.emit(DEPOSIT_ITEM_REQUESTED_EVENT, itemId, quantity),
        onWithdraw: (itemId, quantity) =>
          this.events.emit(WITHDRAW_ITEM_REQUESTED_EVENT, itemId, quantity),
        onBuySlot: () => this.events.emit(BUY_BANK_SLOT_REQUESTED_EVENT),
        // Same ask as the shop's X: the world owns whether the counter is open.
        onDismiss: () => this.events.emit(BANK_CLOSED_EVENT),
      },
      () => {
        this.bank = null;
      },
    );
    this.bank.update(this.bankState());
    this.root.append(this.bank.root);
  }

  closeBank(): void {
    this.bank?.close();
  }

  /** The shelves, the pack and the purse all move while this is open. */
  refreshBank(): void {
    this.bank?.update(this.bankState());
  }

  openShop(): void {
    this.shop?.close();
    this.shop = new ShopModal(
      {
        onBuy: (itemId) => this.events.emit(BUY_ITEM_REQUESTED_EVENT, itemId),
        onSell: (itemId, quantity) => this.events.emit(SELL_ITEM_REQUESTED_EVENT, itemId, quantity),
        onAcceptQuest: (questId) => this.events.emit(ACCEPT_QUEST_REQUESTED_EVENT, questId),
        onTurnInQuest: (questId) => this.events.emit(TURN_IN_QUEST_REQUESTED_EVENT, questId),
        // The shop closes when the world says so, which is what this asks for.
        onDismiss: () => this.events.emit(SHOP_CLOSED_EVENT),
      },
      () => {
        this.shop = null;
      },
    );
    this.shop.update(this.shopState());
    this.root.append(this.shop.root);
  }

  closeShop(): void {
    this.shop?.close();
  }

  /** Anything the shop draws itself from can change while it is open. */
  refreshShop(): void {
    this.shop?.update(this.shopState());
  }

  // The session queues these on the boot that resolved a parked camp. It had
  // already paid the character out by then, so a missed panel costs nothing but
  // the news.
  showAwayReport(pending: PendingNotification[], onDismissed: () => void): void {
    const report = pending.find((item) => item.kind === 'offline-afk');
    if (!report) {
      return;
    }
    this.awayReport = new AwayReportModal(report.report, () => {
      this.awayReport = null;
      onDismissed();
    });
    this.root.append(this.awayReport.root);
  }

  /**
   * Escape closes what the player opened, and answers whether it found anything
   * — with nothing up the key falls through to whatever else wants it. The shop
   * is not one of these: the world owns whether it is open.
   */
  closeDismissable(): boolean {
    if (
      !this.options &&
      !this.picker &&
      !this.awayReport &&
      !this.menu &&
      !this.contextMenu &&
      !this.inspect
    ) {
      return false;
    }
    this.options?.close();
    this.picker?.close();
    this.awayReport?.close();
    this.menu?.close();
    this.contextMenu?.close();
    this.inspect?.close();
    return true;
  }

  closeAll(): void {
    this.options?.close();
    this.shop?.close();
    this.bank?.close();
    this.picker?.close();
    this.awayReport?.close();
    this.menu?.close();
    this.contextMenu?.close();
    this.inspect?.close();
  }
}
