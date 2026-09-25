import { outfitterOfferFor } from '../data/outfitter';
import { tradeRefusal } from '../systems/OutfitterSystem';
import type { ItemId } from '../types/ids';
import { CounterSession } from './CounterSession';
import type { WorldContext } from './WorldContext';

/**
 * Standing at the outfitter's counter in Greyford, where nothing costs money.
 *
 * The shop's twin down to the shape — opened at `NPC_INTERACT_RADIUS`, shut by
 * walking past `NPC_CLOSE_RADIUS`, handed a description of the offers rather
 * than the offers themselves — because that shape is what keeps a panel in an
 * HTML overlay from ever holding the goods.
 */
export class OutfitterSession extends CounterSession {
  constructor(ctx: WorldContext) {
    super(ctx, 'outfitter');
  }

  /**
   * Hands over the materials and takes the tool.
   *
   * Settled here rather than trusted from the panel, for the reason a sale's
   * count is: the row that was tapped was drawn from a copy of the bag, and the
   * pack is the thing that actually holds it.
   *
   * All or nothing, and in that order — the refusal is checked against the whole
   * price before a single material is spent, so a trade that cannot complete
   * leaves the pack exactly as it was. The same rule `turnInQuest` follows, and
   * for the same reason: taking the goods and finding no room for what they buy
   * is the one outcome that cannot be undone.
   */
  trade(itemId: ItemId): void {
    if (!this.npc) return;
    const offer = outfitterOfferFor(itemId);
    if (!offer) return;

    const refusal = tradeRefusal(offer, this.ctx.character.state.inventory);
    if (refusal) {
      this.ctx.notice(refusal);
      return;
    }
    // A tool is heavy and the materials are heavier, so this all but always
    // passes — but it is checked rather than assumed, because a pack that is
    // full of something *else* is a pack with no room for what is bought.
    if (!this.ctx.character.canCarryItem(itemId, 1)) {
      this.ctx.notice('Your pack is too full to carry that.');
      return;
    }

    for (const line of offer.cost) {
      this.ctx.character.removeItem(line.itemId, line.quantity);
    }
    this.ctx.character.addItem(itemId, 1);
    this.ctx.publishInventory();
  }
}
