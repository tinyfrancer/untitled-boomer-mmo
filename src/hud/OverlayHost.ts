import { AwayReportModal } from './AwayReportModal';
import { MenuOverlay } from './MenuOverlay';
import { OptionsModal } from './OptionsModal';
import { ShopModal, type ShopState } from './ShopModal';
import { SlotPicker } from './SlotPicker';
import {
  ACCEPT_QUEST_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
} from '../ui/uiEvents';
import type { PendingNotification } from '../world/GameContext';
import type { EventBus } from '../world/worldEvents';
import type { GearSlotId, ItemId } from '../types/ids';
import type { TabId } from '../ui/tabs';

/**
 * The five overlays, and the only thing that knows how many there are.
 *
 * Each of them is built on open and gone on close, so what is left to own is
 * which one is up — and every question about that crosses more than one of them:
 * the picker closes when the sheet under it does, Escape closes whatever the
 * player opened and nothing the world did, and a teardown has to reach all four
 * without naming them one at a time, which is exactly what the shop was left out
 * of when they were four fields on the HUD.
 *
 * It reads the shop's state through a getter rather than holding a copy: the
 * bag, the purse and the quest log are the HUD's model, and the shop is a view
 * of them that happens to be open sometimes.
 */
export class OverlayHost {
  private readonly root: HTMLElement;
  private readonly events: EventBus;
  private readonly shopState: () => ShopState;

  private options: OptionsModal | null = null;
  private shop: ShopModal | null = null;
  private picker: SlotPicker | null = null;
  private awayReport: AwayReportModal | null = null;
  private menu: MenuOverlay | null = null;

  constructor(root: HTMLElement, events: EventBus, shopState: () => ShopState) {
    this.root = root;
    this.events = events;
    this.shopState = shopState;
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

  openShop(): void {
    this.shop?.close();
    this.shop = new ShopModal(
      {
        onBuy: (itemId) => this.events.emit(BUY_ITEM_REQUESTED_EVENT, itemId),
        onSell: (itemId) => this.events.emit(SELL_ITEM_REQUESTED_EVENT, itemId),
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
    if (!this.options && !this.picker && !this.awayReport && !this.menu) {
      return false;
    }
    this.options?.close();
    this.picker?.close();
    this.awayReport?.close();
    this.menu?.close();
    return true;
  }

  closeAll(): void {
    this.options?.close();
    this.shop?.close();
    this.picker?.close();
    this.awayReport?.close();
    this.menu?.close();
  }
}
