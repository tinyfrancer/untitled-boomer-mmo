import { AwayReportModal } from './AwayReportModal';
import { BankModal, type BankPanelState } from './BankModal';
import { ContextMenu, type ContextMenuEntry } from './ContextMenu';
import { InspectModal } from './InspectModal';
import { MenuOverlay } from './MenuOverlay';
import { OptionsModal } from './OptionsModal';
import { ShopModal, type ShopState } from './ShopModal';
import { TrainerModal, type TrainerState } from './TrainerModal';
import { OutfitterModal } from './OutfitterModal';
import { ReforgeModal, type ReforgePanelState } from './ReforgeModal';
import type { Inventory } from '../systems/InventorySystem';
import { BountyModal, type BountyPanelState } from './BountyModal';
import { StationModal, type StationPanelState } from './StationModal';
import { SlotPicker } from './SlotPicker';
import {
  ABANDON_BOUNTY_REQUESTED_EVENT,
  ACCEPT_BOUNTY_REQUESTED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  BANK_CLOSED_EVENT,
  BOUNTY_CLOSED_EVENT,
  OUTFITTER_CLOSED_EVENT,
  TRADE_REQUESTED_EVENT,
  REFORGE_CLOSED_EVENT,
  REFORGE_REQUESTED_EVENT,
  TURN_IN_BOUNTY_REQUESTED_EVENT,
  BUY_BANK_SLOT_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  DEPOSIT_ITEM_REQUESTED_EVENT,
  WITHDRAW_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  LEARN_ABILITY_REQUESTED_EVENT,
  CRAFT_REQUESTED_EVENT,
  TRAINER_CLOSED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
} from '../ui/uiEvents';
import type { StationId } from '../data/recipes';
import type { InspectPanel } from '../systems/InspectSystem';
import type { ScreenPoint } from '../ui/uiEvents';
import type { PendingNotification } from '../world/GameContext';
import type { EventBus } from '../world/worldEvents';
import type { GearSlotId, ItemId } from '../types/ids';
import type { TabId } from '../ui/tabs';

/**
 * How the four counters' panels read the HUD's model.
 *
 * Getters rather than copies handed over once: the bag, the purse, the quest
 * log, the shelves and what has been learned are the HUD's own state, and each
 * panel is a view of some of it that happens to be open sometimes.
 */
export interface OverlayPanelState {
  shop: () => ShopState;
  bank: () => BankPanelState;
  trainer: () => TrainerState;
  bounty: () => BountyPanelState;
  /** The bag, which is the outfitter's whole price list. */
  outfitter: () => Inventory;
  /** The gear, the pack and what has been worked, which is the fettler's whole list. */
  reforge: () => ReforgePanelState;
  station: () => StationPanelState;
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
 * player opened and nothing the world did, and a teardown has to reach every one
 * of them without naming them one at a time, which is exactly what the shop was
 * left out of when they were four fields on the HUD.
 *
 * It reads each panel's state through a getter rather than holding a copy: the
 * bag, the purse, the quest log, the shelves and what has been learned are the
 * HUD's model, and the four counters are views of them that happen to be open
 * sometimes.
 */
export class OverlayHost {
  private readonly root: HTMLElement;
  private readonly events: EventBus;
  private readonly shopState: () => ShopState;
  private readonly bankState: () => BankPanelState;
  private readonly trainerState: () => TrainerState;
  private readonly bountyState: () => BountyPanelState;
  private readonly outfitterState: () => Inventory;
  private readonly reforgeState: () => ReforgePanelState;
  private readonly stationState: () => StationPanelState;

  private options: OptionsModal | null = null;
  private shop: ShopModal | null = null;
  private bank: BankModal | null = null;
  private trainer: TrainerModal | null = null;
  private bounty: BountyModal | null = null;
  private outfitter: OutfitterModal | null = null;
  private reforge: ReforgeModal | null = null;
  private station: StationModal | null = null;
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
    this.trainerState = panels.trainer;
    this.bountyState = panels.bounty;
    this.outfitterState = panels.outfitter;
    this.reforgeState = panels.reforge;
    this.stationState = panels.station;
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

  openTrainer(): void {
    this.trainer?.close();
    this.trainer = new TrainerModal(
      {
        onLearn: (abilityId) => this.events.emit(LEARN_ABILITY_REQUESTED_EVENT, abilityId),
        // Same ask as the other two X's: the world owns whether it is open.
        onDismiss: () => this.events.emit(TRAINER_CLOSED_EVENT),
      },
      () => {
        this.trainer = null;
      },
    );
    this.trainer.update(this.trainerState());
    this.root.append(this.trainer.root);
  }

  closeTrainer(): void {
    this.trainer?.close();
  }

  openBounty(): void {
    this.bounty?.close();
    this.bounty = new BountyModal(
      {
        onAccept: (bountyId) => this.events.emit(ACCEPT_BOUNTY_REQUESTED_EVENT, bountyId),
        onTurnIn: (bountyId) => this.events.emit(TURN_IN_BOUNTY_REQUESTED_EVENT, bountyId),
        onAbandon: () => this.events.emit(ABANDON_BOUNTY_REQUESTED_EVENT),
        // Same ask as the other three X's: the world owns whether it is open.
        onDismiss: () => this.events.emit(BOUNTY_CLOSED_EVENT),
      },
      () => {
        this.bounty = null;
      },
    );
    this.bounty.update(this.bountyState());
    this.root.append(this.bounty.root);
  }

  closeBounty(): void {
    this.bounty?.close();
  }

  openOutfitter(): void {
    this.outfitter?.close();
    this.outfitter = new OutfitterModal(
      this.outfitterState(),
      {
        onTrade: (itemId) => this.events.emit(TRADE_REQUESTED_EVENT, itemId),
        // Same ask as the other four X's: the world owns whether it is open.
        onDismiss: () => this.events.emit(OUTFITTER_CLOSED_EVENT),
      },
      () => {
        this.outfitter = null;
      },
    );
    this.root.append(this.outfitter.root);
  }

  closeOutfitter(): void {
    this.outfitter?.close();
  }

  /** Every row is priced in the bag, so a trade redraws the whole counter. */
  refreshOutfitter(): void {
    this.outfitter?.update(this.outfitterState());
  }

  openReforge(): void {
    this.reforge?.close();
    this.reforge = new ReforgeModal(
      this.reforgeState(),
      {
        onReforge: (itemId) => this.events.emit(REFORGE_REQUESTED_EVENT, itemId),
        // Same ask as the other five X's: the world owns whether it is open.
        onDismiss: () => this.events.emit(REFORGE_CLOSED_EVENT),
      },
      () => {
        this.reforge = null;
      },
    );
    this.root.append(this.reforge.root);
  }

  closeReforge(): void {
    this.reforge?.close();
  }

  /**
   * Redrawn on the gear, the bag *and* what has been worked — three inputs where
   * every other counter has one, because a reforge moves all three at once: a
   * stone and a piece leave the pack, and the piece being worn becomes something
   * with a different name on it.
   */
  refreshReforge(): void {
    this.reforge?.update(this.reforgeState());
  }

  /**
   * The purse, the level, the bag and every tally move while this is open — and
   * a kill contract's count moves *out in the world*, with the panel left up
   * behind the player, which no other counter has to cope with.
   */
  refreshBounty(): void {
    this.bounty?.update(this.bountyState());
  }

  /**
   * A station's list, opened by tapping one rather than by a session: see
   * `StationModal`. Idempotent for the station already up, since what opens it
   * is an event that can be republished without having changed — but a *second*
   * station replaces the first rather than sitting behind it, which is the only
   * shape that stays right now there is more than one. Two are never in reach
   * at once today; a panel that would have to be closed twice is not a thing to
   * find out about later.
   */
  openStation(stationId: StationId): void {
    if (this.station?.station === stationId) {
      this.refreshStation();
      return;
    }
    this.station?.close();
    this.station = new StationModal(
      stationId,
      {
        onMake: (recipeId) => this.events.emit(CRAFT_REQUESTED_EVENT, recipeId),
        onDismiss: () => this.closeStation(),
      },
      () => {
        this.station = null;
      },
    );
    this.station.update(this.stationState());
    this.root.append(this.station.root);
  }

  closeStation(): void {
    this.station?.close();
  }

  /** Which station's list is up, or null: what proximity is checked against. */
  openStationId(): StationId | null {
    return this.station?.station ?? null;
  }

  /** The bag moves under it with every bar made, so every tick may redraw it. */
  refreshStation(): void {
    this.station?.update(this.stationState());
  }

  /**
   * The purse, the level and what is known all move while this is open — and
   * the last two move *because* of it, since a lesson bought is a row that has
   * to stop being for sale in the panel that just sold it.
   */
  refreshTrainer(): void {
    this.trainer?.update(this.trainerState());
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
    this.trainer?.close();
    this.bounty?.close();
    this.outfitter?.close();
    this.reforge?.close();
    this.station?.close();
    this.picker?.close();
    this.awayReport?.close();
    this.menu?.close();
    this.contextMenu?.close();
    this.inspect?.close();
  }
}
