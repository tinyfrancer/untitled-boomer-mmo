import { ITEMS } from '../data/items';
import { REFORGE_STONE_ITEM_ID } from '../data/reforges';
import {
  describeReforge,
  feedableFrom,
  reforgeRefusal,
  reforgedName,
  rollReforge,
} from '../systems/ReforgeSystem';
import type { ItemId } from '../types/ids';
import { REFORGES_CHANGED_EVENT } from '../ui/uiEvents';
import { CounterSession } from './CounterSession';
import type { WorldContext } from './WorldContext';

/**
 * Standing at the fettler's counter in Greyford, where gear is reworked.
 *
 * The shop's twin down to the shape — opened at `NPC_INTERACT_RADIUS`, shut by
 * walking past `NPC_CLOSE_RADIUS`, handed a description rather than the goods —
 * because that shape is what keeps a panel in an HTML overlay from ever holding
 * anything the world owns. A row tapped after the piece was banked, or after the
 * player walked away, names an item id that no longer answers, and nothing
 * happens.
 */
export class ReforgeSession extends CounterSession {
  private readonly rng: () => number;

  constructor(ctx: WorldContext, rng: () => number = Math.random) {
    super(ctx, 'reforger');
    this.rng = rng;
  }

  /**
   * Reworks one piece: spends the stone and a second piece for the slot, rolls,
   * and hands the same item back changed.
   *
   * Settled here rather than trusted from the panel, for the reason a sale's
   * count is: the row that was tapped was drawn from a copy of the character,
   * and the pack is the thing that actually holds it.
   *
   * All or nothing, and in that order — the refusal is checked against the whole
   * price before a single thing is spent, and the roll happens before anything
   * is taken, so a piece with nothing to move cannot cost a stone. Every other
   * counter in the game refuses the same way, and this one has the most to lose
   * by not: a reforge is permanent, so a half-applied one is not something a
   * player can undo by doing it again.
   */
  reforge(itemId: ItemId): void {
    if (!this.npc) return;
    const { character, events } = this.ctx;
    const state = character.state;

    const worn = Object.values(state.gear).includes(itemId);
    const refusal = reforgeRefusal(itemId, state.reforges, state.inventory, worn);
    if (refusal) {
      this.ctx.notice(refusal);
      return;
    }

    const rolled = rollReforge(itemId, this.rng);
    if (!rolled) return;

    // The fuel is chosen here rather than by the player, and it is the cheapest
    // thing that fits: a panel asking which of four helmets to melt is a second
    // decision on top of the one that matters, and nobody has ever wanted to
    // feed the better one.
    const fuel = this.cheapestFuel(itemId, worn);
    if (!fuel) return;

    character.removeItem(REFORGE_STONE_ITEM_ID, 1);
    character.removeItem(fuel, 1);
    character.setReforge(itemId, rolled);

    this.ctx.publishInventory();
    events.emit(REFORGES_CHANGED_EVENT, { ...state.reforges });
    this.ctx.notice(
      `${reforgedName(itemId, rolled)}: ${describeReforge(rolled)}. ${ITEMS[fuel].name} gone into it.`,
    );
  }

  /** The least valuable thing in the pack that could feed this reforge. */
  private cheapestFuel(itemId: ItemId, worn: boolean): ItemId | null {
    const candidates = feedableFrom(this.ctx.character.state.inventory, itemId, worn);
    let best: ItemId | null = null;
    let bestValue = Infinity;
    for (const candidate of candidates) {
      const value = ITEMS[candidate].value ?? 0;
      if (value < bestValue) {
        best = candidate;
        bestValue = value;
      }
    }
    return best;
  }
}
