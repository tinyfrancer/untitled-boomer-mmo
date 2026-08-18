import { NPC_CLOSE_RADIUS } from '../data/npcs';
import { outfitterOfferFor } from '../data/outfitter';
import { withinRadius } from '../systems/MovementSystem';
import { tradeRefusal } from '../systems/OutfitterSystem';
import type { ItemId } from '../types/ids';
import { OUTFITTER_CLOSED_EVENT, OUTFITTER_OPENED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';
import type { WorldNpc } from './ZoneWorld';

/**
 * Standing at the outfitter's counter in Greyford, where nothing costs money.
 *
 * The shop's twin down to the shape — opened at `NPC_INTERACT_RADIUS`, shut by
 * walking past `NPC_CLOSE_RADIUS`, handed a description of the offers rather
 * than the offers themselves — because that shape is what keeps a panel in an
 * HTML overlay from ever holding the goods.
 */
export class OutfitterSession {
  /** The outfitter the open window belongs to; null when it is shut. */
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
    this.ctx.events.emit(OUTFITTER_OPENED_EVENT);
  }

  close(): void {
    if (!this.npc) return;
    this.npc = null;
    this.ctx.events.emit(OUTFITTER_CLOSED_EVENT);
  }

  /** The UI's close button already tore the panel down; just drop the state. */
  closedByUi(): void {
    this.npc = null;
  }

  updateRange(): void {
    if (!this.npc) return;
    if (!withinRadius(this.ctx.player, this.npc, NPC_CLOSE_RADIUS)) {
      this.close();
    }
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
