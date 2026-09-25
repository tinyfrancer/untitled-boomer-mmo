import { NPC_CLOSE_RADIUS } from '../data/npcs';
import { bountyById } from '../systems/BountySystem';
import { withinRadius } from '../systems/MovementSystem';
import {
  logBountyAbandoned,
  logBountyAccepted,
  logBountyCompleted,
  logCoin,
} from '../systems/CombatLogSystem';
import type { CombatXpGain } from '../systems/CharacterController';
import type { BountyId } from '../types/ids';
import { BOUNTY_CHANGED_EVENT, BOUNTY_CLOSED_EVENT, BOUNTY_OPENED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';
import type { WorldNpc } from './zoneEntities';

/** What the board needs from the rest of the zone, and the whole of it. */
export interface BountySessionDeps {
  /**
   * Handing a contract in is something the player did, so its XP goes straight
   * to the publisher rather than through the camp's halving — the same road a
   * quest reward takes, and for the same reason. A camp can *finish* a kill
   * contract while nobody is watching; it cannot walk to town and hand one in.
   */
  publishXpGain: (gain: CombatXpGain) => void;
}

/**
 * Standing at the quartermaster: the standing work, and the taking and paying
 * of it.
 *
 * The counter's shape a fourth time and deliberately not a fourth set of rules —
 * a window gated on being open rather than on a distance, `updateRange` being
 * what walking away means, and the terms settled by the character rather than
 * trusted from the panel that asked. The overlay is handed nothing but the
 * contract in hand and sends back a bare `BountyId`, so a row tapped after the
 * zone changed, or naming work this character cannot take, resolves to nothing.
 *
 * What it does not share with the other three is that nothing here is ever spent
 * *by* the player: the shop, the bank and the trainer all take coin, and this is
 * the counter that gives it. That is the whole reason it is thirteenth in
 * `docs/archive/systems_plan.md` — a faucet is only safe once the drains exist.
 */
export class BountySession {
  /** The quartermaster the open board belongs to; null when it is shut. */
  npc: WorldNpc | null = null;

  private readonly ctx: WorldContext;
  private readonly deps: BountySessionDeps;

  constructor(ctx: WorldContext, deps: BountySessionDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  isOpen(): boolean {
    return this.npc !== null;
  }

  open(npc: WorldNpc): void {
    this.ctx.player.stopMoving();
    this.npc = npc;
    this.ctx.events.emit(BOUNTY_OPENED_EVENT);
  }

  close(): void {
    if (!this.npc) return;
    this.npc = null;
    this.ctx.events.emit(BOUNTY_CLOSED_EVENT);
  }

  /** The UI's close button already tore the panel down; just drop the state. */
  closedByUi(): void {
    this.npc = null;
  }

  /** Walking off mid-negotiation shuts the board, like every other counter. */
  updateRange(): void {
    if (!this.npc) return;
    if (!withinRadius(this.ctx.player, this.npc, NPC_CLOSE_RADIUS)) {
      this.close();
    }
  }

  accept(bountyId: BountyId): void {
    if (!this.npc) return;
    // Re-checked here rather than trusted from the row: the panel was drawn
    // from a copy of the character, and only the character knows what level it
    // has reached and what it is already holding.
    if (!this.ctx.character.acceptBounty(bountyId)) {
      this.ctx.notice(this.refusal(bountyId));
      return;
    }
    const { name } = bountyById(bountyId);
    this.ctx.log(logBountyAccepted(name));
    this.publish();
  }

  turnIn(bountyId: BountyId): void {
    if (!this.npc) return;
    const result = this.ctx.character.turnInBounty(bountyId);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }
    const { name } = bountyById(bountyId);
    this.ctx.log(logBountyCompleted(name));
    this.ctx.log(logCoin(result.copper));
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
    this.publish();
    this.deps.publishXpGain(result.xp);
  }

  /** Allowed from anywhere the board is open, and costs nothing either way. */
  abandon(): void {
    if (!this.npc) return;
    const held = this.ctx.character.state.bounty;
    if (!held || !this.ctx.character.abandonBounty()) return;
    this.ctx.log(logBountyAbandoned(bountyById(held.bountyId).name));
    this.publish();
  }

  /**
   * Why a row would not be taken, in the sentence a phone with no tooltip to
   * hover ever gets. Two answers because `bountyAccess` has two, plus the one
   * the one-at-a-time rule adds.
   */
  private refusal(bountyId: BountyId): string {
    const definition = bountyById(bountyId);
    if (this.ctx.character.state.bounty) {
      return 'You are already working a contract.';
    }
    const required = definition.requiredLevel;
    return required !== undefined
      ? `${definition.name} is posted at level ${required}.`
      : 'That work is not on the board.';
  }

  private publish(): void {
    this.ctx.events.emit(BOUNTY_CHANGED_EVENT, this.ctx.character.state.bounty);
    // Persisted here rather than left to the autosave, for the reason a bank
    // move and a lesson are: the coin has already moved, and a contract paid
    // that a closed tab un-pays is work done twice.
    this.ctx.persistCharacter();
  }
}
