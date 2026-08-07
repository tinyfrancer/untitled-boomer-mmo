import { SHOP_CLOSE_RADIUS, shopPriceFor } from '../data/shop';
import { itemValue } from '../data/items';
import { withinRadius } from '../systems/MovementSystem';
import type { ItemId } from '../types/ids';
import { SHOP_CLOSED_EVENT, SHOP_OPENED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';
import type { WorldNpc } from './ZoneWorld';

/**
 * Standing at a shopkeeper's counter: what is open, and what a coin buys.
 *
 * Buying and selling are gated on the window being open rather than on a
 * distance, because the window closing is what walking away from a vendor
 * means — and `updateRange` is what makes walking away close it.
 */
export class ShopSession {
  /** The shopkeeper the open window belongs to; null when it is shut. */
  npc: WorldNpc | null = null;

  private readonly ctx: WorldContext;

  constructor(ctx: WorldContext) {
    this.ctx = ctx;
  }

  isOpen(): boolean {
    return this.npc !== null;
  }

  open(npc: WorldNpc): void {
    this.ctx.player.stopMoving();
    this.npc = npc;
    this.ctx.events.emit(SHOP_OPENED_EVENT);
  }

  close(): void {
    if (!this.npc) return;
    this.npc = null;
    this.ctx.events.emit(SHOP_CLOSED_EVENT);
  }

  /** The UI's close button already tore the panel down; just drop the state. */
  closedByUi(): void {
    this.npc = null;
  }

  /** Walking off mid-trade closes the window, like any vendor would. */
  updateRange(): void {
    if (!this.npc) return;
    if (!withinRadius(this.ctx.player, this.npc, SHOP_CLOSE_RADIUS)) {
      this.close();
    }
  }

  buy(itemId: ItemId): void {
    if (!this.npc) return;
    const price = shopPriceFor(itemId);
    if (price === null) return;
    // Checked before the coin leaves the purse, so a full pack never sells the
    // player something they can't take home.
    if (!this.ctx.character.canCarryItem(itemId, 1)) {
      this.ctx.notice('Your pack is too full to carry that.');
      return;
    }
    if (!this.ctx.character.spendCurrency(price)) {
      this.ctx.notice("You can't afford that.");
      return;
    }
    this.ctx.character.addItem(itemId, 1);
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
  }

  sell(itemId: ItemId): void {
    if (!this.npc) return;
    const value = itemValue(itemId);
    if (value === null || this.ctx.character.itemCount(itemId) <= 0) return;
    this.ctx.character.removeItem(itemId, 1);
    this.ctx.character.addCurrency(value);
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
  }
}
