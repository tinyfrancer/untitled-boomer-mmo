import { describeItemName } from '../data/items';
import { logLoot } from '../systems/CombatLogSystem';
import type { LootDrop } from '../systems/LootSystem';
import type { Point } from '../systems/MovementSystem';
import { LootPile } from './LootPile';
import type { WorldContext } from './WorldContext';

/**
 * The zone's loot piles: where a kill's refusals are left, how long they lie,
 * and taking from one.
 *
 * Whether a refusal becomes a pile at all is not decided here — `CombatDirector`
 * draws that line at the camp, the same one `GatherSession` draws for what a
 * full pack means — so everything that arrives here is a pile somebody is
 * standing by to come back for.
 *
 * The piles are the zone's rather than the character's, so nothing here is
 * saved and nothing survives a zone change: the world that held them is torn
 * down whole, which is what a fire does too. A death is not a zone change, and
 * leaves them where they are.
 */
export class LootPiles {
  private readonly ctx: WorldContext;
  private readonly lying: LootPile[] = [];

  constructor(ctx: WorldContext) {
    this.ctx = ctx;
  }

  /** Every pile on the ground, for whatever is drawing them. */
  get piles(): readonly LootPile[] {
    return this.lying;
  }

  /** Each kill's refusals are a pile of their own, beside another or not. */
  leave(at: Point, drops: readonly LootDrop[]): LootPile {
    const pile = new LootPile(at, drops);
    this.lying.push(pile);
    this.ctx.push({ kind: 'loot-left', at: { x: pile.x, y: pile.y } });
    this.ctx.notice('Your pack is full. What it could not take is left where it fell.');
    return pile;
  }

  /** Counts every pile's minute down, and takes away the ones that ran out. */
  update(deltaMs: number): void {
    // Backwards so a splice does not skip the pile after it, and in place since
    // this runs every frame for a list that is almost always empty.
    for (let at = this.lying.length - 1; at >= 0; at -= 1) {
      const pile = this.lying[at];
      if (!pile) continue;
      pile.update(deltaMs);
      if (pile.isGone()) {
        this.lying.splice(at, 1);
      }
    }
  }

  /**
   * Takes what fits and leaves the rest, a stack at a time.
   *
   * Each stack is asked on its own, so a heavy thing that does not fit does not
   * stop a light one after it going in. What is left is still the player's and
   * keeps the pile's original minute. A pile gone by the time the walk reaches
   * it — lapsed on the way, or emptied by an earlier tap — is nothing to say
   * anything about: the sack has already vanished in front of them.
   */
  take(pile: LootPile): void {
    if (pile.isGone() || !this.lying.includes(pile)) return;
    const { character } = this.ctx;

    let took = false;
    for (const { itemId, quantity } of pile.contents()) {
      const count = character.addWhatFits(itemId, quantity);
      if (count <= 0) continue;
      pile.remove(itemId, count);
      this.ctx.log(logLoot(describeItemName(itemId), count));
      took = true;
    }
    if (took) {
      this.ctx.publishInventory();
    }

    if (pile.isGone()) {
      this.lying.splice(this.lying.indexOf(pile), 1);
      return;
    }
    this.ctx.notice(
      took
        ? 'Your pack is full. The rest is still on the ground.'
        : 'Your pack is too full to take any of it.',
    );
  }
}
