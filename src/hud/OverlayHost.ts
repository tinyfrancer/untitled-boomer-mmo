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
import type { SoundSettings } from '../audio/settings';
import type { Inventory } from '../systems/InventorySystem';
import { BountyModal, type BountyPanelState } from './BountyModal';
import { counterQuests, type QuestPanelState } from './counterQuests';
import { StationModal, type StationPanelState } from './StationModal';
import { SlotPicker } from './SlotPicker';
import {
  ABANDON_BOUNTY_REQUESTED_EVENT,
  ACCEPT_BOUNTY_REQUESTED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  COUNTER_CLOSED_EVENT,
  TRADE_REQUESTED_EVENT,
  REFORGE_REQUESTED_EVENT,
  TURN_IN_BOUNTY_REQUESTED_EVENT,
  BUY_BANK_SLOT_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  DEPOSIT_ITEM_REQUESTED_EVENT,
  WITHDRAW_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SOUND_SETTINGS_CHANGED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  LEARN_ABILITY_REQUESTED_EVENT,
  CRAFT_REQUESTED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
} from '../ui/uiEvents';
import type { NpcRoleId } from '../data/npcs';
import type { StationId } from '../data/recipes';
import type { InspectPanel } from '../systems/InspectSystem';
import type { ScreenPoint } from '../ui/uiEvents';
import type { PendingNotification } from '../world/GameContext';
import type { EventBus } from '../world/worldEvents';
import type { GearSlotId, ItemId, NpcId } from '../types/ids';
import type { TabId } from '../ui/tabs';

/**
 * How the panels read the HUD's model: one getter per counter role, and one for
 * whichever station is up.
 *
 * Getters rather than copies handed over once: the bag, the purse, the quest
 * log, the shelves and what has been learned are the HUD's own state, and each
 * panel is a view of some of it that happens to be open sometimes. Keyed by role
 * so a seventh counter is a compile error here until it says what it draws from.
 */
export interface OverlayPanelState {
  merchant: () => ShopState;
  banker: () => BankPanelState;
  trainer: () => TrainerState;
  quartermaster: () => BountyPanelState;
  /** The bag, which is the outfitter's whole price list. */
  outfitter: () => Inventory;
  /** The gear, the pack and what has been worked, which is the fettler's whole list. */
  reforger: () => ReforgePanelState;
  /** The log and its tallies, which any counter's person may have work in. */
  quests: () => QuestPanelState;
  station: () => StationPanelState;
}

/**
 * What a counter's panel is to the host: something to redraw from the model,
 * and something to take down. Each role's modal has its own handlers and its
 * own state, and the table in the constructor is the only place that knows
 * which is which.
 *
 * `body` is the panel's scrolling list, which its own redraw empties and fills.
 * What the host adds to the top of it afterwards is the person's quests, which
 * no panel draws for itself (see `counterQuests`).
 */
interface CounterPanel {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  refresh(): void;
  layout(viewportWidth: number): void;
  close(): void;
}

/**
 * A role's modal, as far as the host needs to know it. `layout` is for the
 * two that deal both ways (`CounterSides`), which stand their sides across or
 * one over the other by the width they are opened at.
 */
interface CounterModal {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  layout?(viewportWidth: number): void;
  close(): void;
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
 * HUD's model, and the counters are views of them that happen to be open
 * sometimes. **One counter is up at a time** — the world opens one and shuts the
 * rest — so what is held is the one that is, and redrawing it after the model
 * moves is one call that needs to know nothing about which it is.
 */
export class OverlayHost {
  private readonly root: HTMLElement;
  private readonly events: EventBus;
  private readonly counterPanels: Record<NpcRoleId, (onClosed: () => void) => CounterPanel>;
  private readonly stationState: () => StationPanelState;
  private readonly questState: () => QuestPanelState;
  private viewportWidth = 0;

  private options: OptionsModal | null = null;
  private counter: { role: NpcRoleId; npcId: NpcId; panel: CounterPanel } | null = null;
  private station: StationModal | null = null;
  private picker: SlotPicker | null = null;
  private awayReport: AwayReportModal | null = null;
  private menu: MenuOverlay | null = null;
  private contextMenu: ContextMenu | null = null;
  private inspect: InspectModal | null = null;

  constructor(root: HTMLElement, events: EventBus, panels: OverlayPanelState) {
    this.root = root;
    this.events = events;
    this.stationState = panels.station;
    this.questState = panels.quests;
    const emit = events.emit.bind(events);
    // Every X asks rather than does: the world owns whether a counter is open,
    // and closes it with the same event it hears this on.
    const dismiss = (role: NpcRoleId) => () => emit(COUNTER_CLOSED_EVENT, role);
    this.counterPanels = {
      merchant: (onClosed) => {
        const modal = new ShopModal(
          {
            onBuy: (itemId) => emit(BUY_ITEM_REQUESTED_EVENT, itemId),
            onSell: (itemId, quantity) => emit(SELL_ITEM_REQUESTED_EVENT, itemId, quantity),
            onDismiss: dismiss('merchant'),
          },
          onClosed,
        );
        return counterPanel(modal, () => modal.update(panels.merchant()));
      },
      banker: (onClosed) => {
        const modal = new BankModal(
          {
            onDeposit: (itemId, quantity) => emit(DEPOSIT_ITEM_REQUESTED_EVENT, itemId, quantity),
            onWithdraw: (itemId, quantity) => emit(WITHDRAW_ITEM_REQUESTED_EVENT, itemId, quantity),
            onBuySlot: () => emit(BUY_BANK_SLOT_REQUESTED_EVENT),
            onDismiss: dismiss('banker'),
          },
          onClosed,
        );
        return counterPanel(modal, () => modal.update(panels.banker()));
      },
      trainer: (onClosed) => {
        const modal = new TrainerModal(
          {
            onLearn: (abilityId) => emit(LEARN_ABILITY_REQUESTED_EVENT, abilityId),
            onDismiss: dismiss('trainer'),
          },
          onClosed,
        );
        return counterPanel(modal, () => modal.update(panels.trainer()));
      },
      quartermaster: (onClosed) => {
        const modal = new BountyModal(
          {
            onAccept: (bountyId) => emit(ACCEPT_BOUNTY_REQUESTED_EVENT, bountyId),
            onTurnIn: (bountyId) => emit(TURN_IN_BOUNTY_REQUESTED_EVENT, bountyId),
            onAbandon: () => emit(ABANDON_BOUNTY_REQUESTED_EVENT),
            onDismiss: dismiss('quartermaster'),
          },
          onClosed,
        );
        return counterPanel(modal, () => modal.update(panels.quartermaster()));
      },
      outfitter: (onClosed) => {
        const modal = new OutfitterModal(
          panels.outfitter(),
          {
            onTrade: (itemId) => emit(TRADE_REQUESTED_EVENT, itemId),
            onDismiss: dismiss('outfitter'),
          },
          onClosed,
        );
        return counterPanel(modal, () => modal.update(panels.outfitter()));
      },
      reforger: (onClosed) => {
        const modal = new ReforgeModal(
          panels.reforger(),
          {
            onReforge: (itemId) => emit(REFORGE_REQUESTED_EVENT, itemId),
            onDismiss: dismiss('reforger'),
          },
          onClosed,
        );
        return counterPanel(modal, () => modal.update(panels.reforger()));
      },
    };
  }

  openOptions(sound: SoundSettings): void {
    this.options?.close();
    this.options = new OptionsModal({
      sound,
      onSoundChanged: (settings) => this.events.emit(SOUND_SETTINGS_CHANGED_EVENT, settings),
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

  /**
   * Puts up a role's counter, taking down whichever one was up — the world
   * never has two open, and a panel left behind one would be selling from a
   * counter nobody is standing at.
   */
  openCounter(role: NpcRoleId, npcId: NpcId): void {
    this.counter?.panel.close();
    const panel = this.counterPanels[role](() => {
      if (this.counter?.role === role) this.counter = null;
    });
    this.counter = { role, npcId, panel };
    panel.layout(this.viewportWidth);
    this.refreshCounter();
    this.root.append(panel.root);
  }

  /**
   * The HUD's width, from the same resize the rest of its furniture is laid
   * out on — so a phone turned on its side with the shop open stands the
   * shop's two sides across it.
   */
  layout(viewportWidth: number): void {
    this.viewportWidth = viewportWidth;
    this.counter?.panel.layout(viewportWidth);
  }

  /** Takes down that role's counter if it is the one up. */
  closeCounter(role: NpcRoleId): void {
    if (this.counter?.role === role) this.counter.panel.close();
  }

  /** Which counter is up, or null. */
  openCounterRole(): NpcRoleId | null {
    return this.counter?.role ?? null;
  }

  /**
   * Redraws whatever counter or station is up from the model.
   *
   * Every panel is a function of the HUD's model, so a change to the model is a
   * reason to redraw whichever one is open — and only that one, since the rest
   * are not built. This is the whole rule the HUD's listeners used to spell out
   * panel by panel, which is exactly the list a new panel was left out of.
   */
  refreshOpen(): void {
    this.refreshCounter();
    this.refreshStation();
  }

  /**
   * The counter's own list, then whatever work the person behind it has going
   * on top of it. Drawn here rather than by each panel, so anybody who gives
   * quests shows them at whatever counter they stand behind — the shop, the
   * outfitter's and the fettler's today — and a panel cannot be the one that
   * forgot to.
   */
  private refreshCounter(): void {
    if (!this.counter) return;
    const { npcId, panel } = this.counter;
    panel.refresh();
    const quests = counterQuests(npcId, this.questState(), {
      onAccept: (questId) => this.events.emit(ACCEPT_QUEST_REQUESTED_EVENT, questId),
      onTurnIn: (questId) => this.events.emit(TURN_IN_QUEST_REQUESTED_EVENT, questId),
    });
    if (quests) panel.body.prepend(quests);
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
   * — with nothing up the key falls through to whatever else wants it. No
   * counter is one of these: the world owns whether it is open.
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
    this.counter?.panel.close();
    this.station?.close();
    this.picker?.close();
    this.awayReport?.close();
    this.menu?.close();
    this.contextMenu?.close();
    this.inspect?.close();
  }
}

// A role's modal, as the host holds it.
function counterPanel(modal: CounterModal, refresh: () => void): CounterPanel {
  return {
    root: modal.root,
    body: modal.body,
    refresh,
    layout: (viewportWidth) => modal.layout?.(viewportWidth),
    close: () => modal.close(),
  };
}
