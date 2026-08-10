import { NPC_CLOSE_RADIUS } from '../data/npcs';
import { withinRadius } from '../systems/MovementSystem';
import type { ItemId } from '../types/ids';
import { BANK_CHANGED_EVENT, BANK_CLOSED_EVENT, BANK_OPENED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';
import type { WorldNpc } from './ZoneWorld';

/**
 * Standing at the bank counter: what is on the shelves, and what crosses them.
 *
 * The shop's twin down to the shape — a window gated on being open rather than
 * on a distance, `updateRange` being what walking away means, and a count that
 * is clamped by the thing that actually holds the goods rather than trusted
 * from the panel. What it is *not* is a second set of rules about inventories:
 * every move goes through `CharacterController`, which refuses as a whole, so
 * a deposit that finds no shelf leaves the pack exactly as it was.
 *
 * The vault itself never leaves this side of the wire. The HUD is handed a copy
 * on `BANK_CHANGED_EVENT` and sends back a bare item id, so a panel left open
 * across a zone change is describing shelves rather than holding them.
 */
export class BankSession {
  /** The banker the open window belongs to; null when it is shut. */
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
    this.ctx.events.emit(BANK_OPENED_EVENT);
    // Seeded on open rather than only on change: the HUD outlives every world,
    // so a panel built now has to be told what is on the shelves even when
    // nothing has moved since the last time it was.
    this.publish();
  }

  close(): void {
    if (!this.npc) return;
    this.npc = null;
    this.ctx.events.emit(BANK_CLOSED_EVENT);
  }

  /** The UI's close button already tore the panel down; just drop the state. */
  closedByUi(): void {
    this.npc = null;
  }

  /** Walking off mid-transaction shuts the counter, like any teller would. */
  updateRange(): void {
    if (!this.npc) return;
    if (!withinRadius(this.ctx.player, this.npc, NPC_CLOSE_RADIUS)) {
      this.close();
    }
  }

  deposit(itemId: ItemId, quantity = 1): void {
    if (!this.npc) return;
    const result = this.ctx.character.deposit(itemId, quantity);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    this.settle();
  }

  withdraw(itemId: ItemId, quantity = 1): void {
    if (!this.npc) return;
    const result = this.ctx.character.withdraw(itemId, quantity);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    // A partial withdrawal is the one outcome that looks like a bug from the
    // player's side — they asked for thirty and got twelve — so it says so.
    if (result.left) {
      this.ctx.notice(`Your pack holds ${result.moved}; ${result.left} stay in the bank.`);
    }
    this.settle();
  }

  /** The second coin sink, and the only thing sold from behind this counter. */
  buySlot(): void {
    if (!this.npc) return;
    const result = this.ctx.character.buyBankSlot();
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    this.ctx.notice(`Bank slot rented. You have ${result.slots}.`);
    this.settle();
  }

  /**
   * Everything a move across the counter touches, and the save that makes it
   * survive the tab closing.
   *
   * Persisted here rather than left to the autosave because the bank is the one
   * place a player deliberately parts with something: a haul put away and lost
   * to a closed tab is worse than one never put away at all.
   */
  private settle(): void {
    this.publish();
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
    this.ctx.persistCharacter();
  }

  private publish(): void {
    this.ctx.events.emit(BANK_CHANGED_EVENT, {
      contents: this.ctx.character.state.bank,
      slots: this.ctx.character.state.bankSlots,
    });
  }
}
