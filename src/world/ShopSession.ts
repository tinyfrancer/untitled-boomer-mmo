import { shopEntryFor } from '../data/shop';
import { itemValue } from '../data/items';
import { stockAccess } from '../systems/ShopSystem';
import type { ItemId } from '../types/ids';
import { CounterSession } from './CounterSession';
import type { WorldContext } from './WorldContext';

/**
 * Standing at a shopkeeper's counter: what is open, and what a coin buys.
 *
 * Buying and selling are gated on the window being open rather than on a
 * distance, because the window closing is what walking away from a vendor
 * means — and `updateRange` is what makes walking away close it.
 */
export class ShopSession extends CounterSession {
  constructor(ctx: WorldContext) {
    super(ctx, 'merchant');
  }

  buy(itemId: ItemId): void {
    if (!this.npc) return;
    const entry = shopEntryFor(itemId);
    if (!entry) return;
    // What is on the shelf is settled here rather than trusted, for the same
    // reason a sale's count is: the panel asking was drawn from a copy of the
    // character, and only the character says whether the row has been earned.
    const { level, quests, standing } = this.ctx.character.state;
    const access = stockAccess(entry, { level, quests, standing });
    if (access.kind === 'gated') {
      this.ctx.notice(access.reason);
      return;
    }
    // Checked before the coin leaves the purse, so a full pack never sells the
    // player something they can't take home. Asked of the whole bundle, and of
    // the quiver as well as the bag, since an arrow bought goes into it first.
    const quantity = entry.quantity ?? 1;
    if (!this.ctx.character.canCarryItem(itemId, quantity)) {
      this.ctx.notice('Your pack is too full to carry that.');
      return;
    }
    if (!this.ctx.character.spendCurrency(entry.price)) {
      this.ctx.notice("You can't afford that.");
      return;
    }
    this.ctx.character.tryAddItem(itemId, quantity);
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
  }

  /**
   * Parts with some of a stack, or all of it. The count is clamped to what is
   * actually in the pack rather than trusted: the panel asking is drawn from a
   * copy of the bag, and the pack is the thing that holds it — so "sell all" is
   * a number the HUD sends and the counter agrees to, not a second code path.
   */
  sell(itemId: ItemId, quantity = 1): void {
    if (!this.npc) return;
    const value = itemValue(itemId);
    if (value === null) return;
    const count = Math.min(Math.floor(quantity), this.ctx.character.itemCount(itemId));
    if (count <= 0) return;
    this.ctx.character.removeItem(itemId, count);
    this.ctx.character.addCurrency(value * count);
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
  }
}
