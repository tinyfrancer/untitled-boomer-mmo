import { TILE_SIZE } from '../config/constants';
import { LOOT_PILE_LIFETIME_MS, type LootDrop } from '../systems/LootSystem';
import type { Point } from '../systems/MovementSystem';
import type { ItemId } from '../types/ids';

/**
 * How near a pile the player has to stand to take from it: a tile. A pile is
 * not solid, so a walk to one ends on top of it, and this only has to cover a
 * body stopped short by whatever the creature was standing against when it
 * fell — a rat is narrower than the player.
 */
export const LOOT_PILE_REACH = TILE_SIZE;

/**
 * What a kill left behind because the pack could not take it: the zone's, like
 * a campfire, and on the world's clock like one.
 *
 * It holds exactly what was refused and nothing else — coin is never refused,
 * so it is never in one — and it is gone when it has been emptied or when its
 * minute is up, whichever comes first. Taking from it does not restart the
 * clock: what is left keeps the minute the kill started.
 */
export class LootPile {
  readonly x: number;
  readonly y: number;
  // In the order the table rolled them, which is the order the log named them.
  private readonly held: LootDrop[];
  private leftMs = LOOT_PILE_LIFETIME_MS;

  constructor(at: Point, drops: readonly LootDrop[]) {
    this.x = at.x;
    this.y = at.y;
    this.held = drops.map((drop) => ({ ...drop }));
  }

  /** What is still in it, as copies — a menu settles its card from these. */
  contents(): LootDrop[] {
    return this.held.map((drop) => ({ ...drop }));
  }

  /** How much of its minute is left, which is what a view blinks against. */
  get remainingMs(): number {
    return Math.max(0, this.leftMs);
  }

  /** Emptied, or lapsed. Either way there is nothing here to walk to. */
  isGone(): boolean {
    return this.leftMs <= 0 || this.held.length === 0;
  }

  /** Takes some of one stack out; a stack taken to nothing is gone from the list. */
  remove(itemId: ItemId, quantity: number): void {
    const at = this.held.findIndex((drop) => drop.itemId === itemId);
    const stack = this.held[at];
    if (!stack) return;
    stack.quantity -= quantity;
    if (stack.quantity <= 0) {
      this.held.splice(at, 1);
    }
  }

  /** Returns whether it lapsed on this frame. */
  update(deltaMs: number): boolean {
    if (this.leftMs <= 0) return false;
    this.leftMs -= deltaMs;
    return this.leftMs <= 0;
  }
}
