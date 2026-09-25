import { NPC_CLOSE_RADIUS, type NpcRoleId } from '../data/npcs';
import { withinRadius } from '../systems/MovementSystem';
import { COUNTER_CLOSED_EVENT, COUNTER_OPENED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';
import type { WorldNpc } from './zoneEntities';

/**
 * Standing at somebody's counter: whether it is open, who is behind it, and
 * what walking away from it means.
 *
 * Every counter in the game is this shape and always was — the shop, the bank,
 * the trainer, the board, the outfitter and the fettler each wrote out the same
 * five members, and each had its own pair of opened and closed events for the
 * one idea. What differs is only what can be done while it is open, which is
 * what a subclass adds. The window is gated on being open rather than on a
 * distance, because the window closing is what walking away from a counter
 * means, and `updateRange` is what makes walking away close it.
 *
 * Both events carry the role, which is how the HUD knows which panel to put up
 * and the world knows which session a close button meant.
 */
export abstract class CounterSession {
  /** Who is behind the counter while it is open; null when it is shut. */
  npc: WorldNpc | null = null;

  readonly role: NpcRoleId;
  protected readonly ctx: WorldContext;

  constructor(ctx: WorldContext, role: NpcRoleId) {
    this.ctx = ctx;
    this.role = role;
  }

  isOpen(): boolean {
    return this.npc !== null;
  }

  open(npc: WorldNpc): void {
    this.ctx.player.stopMoving();
    this.npc = npc;
    this.ctx.events.emit(COUNTER_OPENED_EVENT, this.role);
    this.opened();
  }

  close(): void {
    if (!this.npc) return;
    this.npc = null;
    this.ctx.events.emit(COUNTER_CLOSED_EVENT, this.role);
  }

  /** The panel's close button already tore it down; just drop the state. */
  closedByUi(): void {
    this.npc = null;
  }

  /** Walking off mid-transaction shuts the counter, like anybody behind one would. */
  updateRange(): void {
    if (!this.npc) return;
    if (!withinRadius(this.ctx.player, this.npc, NPC_CLOSE_RADIUS)) {
      this.close();
    }
  }

  /**
   * What a counter has to say the moment it opens, beyond that it has. Most
   * have nothing: their panel is drawn from what the HUD already holds.
   */
  protected opened(): void {}
}
