import { ITEMS, getEquipmentBonuses, type EquipmentBonuses } from '../data/items';
import {
  REFORGES,
  REFORGE_IDS,
  REFORGE_STONE_ITEM_ID,
  STAT_WEIGHTS,
  type ReforgeStatId,
} from '../data/reforges';
import type { ItemId, ReforgeId } from '../types/ids';
import type { Inventory } from './InventorySystem';

/**
 * What a reforge does to a piece, and what one costs.
 *
 * Engine-free and a pure function of the tables plus a bag, the same shape
 * `ShopSystem.stockAccess` and `OutfitterSystem.outfitterRows` are: the panel is
 * drawn from a *copy* of the character, so what it renders is a description and
 * the counter settles the work itself.
 */

/**
 * Which reforges are stored, and against what.
 *
 * **Keyed by item id, not by an instance**, because the game has no instances to
 * key against: an inventory is a count per id and there is no such thing as
 * *this particular* chestplate. So a reforge is a fact about your steel
 * chestplates rather than about one of them — which sounds like a compromise and
 * behaves like the right answer. It survives being unequipped, banked, and
 * withdrawn again with nothing tracking it, where a reforge keyed by gear slot
 * would silently jump onto whatever was equipped next.
 *
 * What it costs is that a second one of the same piece cannot be reforged
 * differently. Nobody has ever wanted two steel chestplates.
 */
export type Reforges = Partial<Record<ItemId, ReforgeId>>;

/** What the counter would do to this piece, and whether it can. */
export interface ReforgeOffer {
  itemId: ItemId;
  /** What it already carries, or null for a piece nobody has touched. */
  current: ReforgeId | null;
  /** Which reforges this piece has the stats to take at all. */
  eligible: ReforgeId[];
  /** Why it cannot be done right now, or null when it can. */
  refusal: string | null;
}

/** The power a set of bonuses adds up to, at `STAT_WEIGHTS` par. */
export function bonusWeight(bonuses: EquipmentBonuses): number {
  return (
    bonuses.attackPower * STAT_WEIGHTS.attackPower +
    bonuses.strength * STAT_WEIGHTS.strength +
    bonuses.intellect * STAT_WEIGHTS.intellect +
    bonuses.agility * STAT_WEIGHTS.agility +
    bonuses.armor * STAT_WEIGHTS.armor +
    bonuses.health * STAT_WEIGHTS.health
  );
}

/**
 * What a piece is worth wearing once it has been reworked.
 *
 * The one place a reforge is applied, so the character sheet, the paperdoll's
 * numbers and what actually swings can never disagree — they all read this.
 * A reforge naming a stat the piece has too little of returns the bonuses
 * untouched rather than driving one negative: `eligibleReforges` is what keeps
 * that from happening in the first place, and this is the belt to its braces,
 * since a save can outlive a table.
 */
export function reforgedBonuses(itemId: ItemId | null, reforgeId: ReforgeId | null | undefined) {
  const bonuses = getEquipmentBonuses(itemId);
  if (!reforgeId) return bonuses;

  const reforge = REFORGES[reforgeId];
  if (bonuses[reforge.from] < reforge.take) return bonuses;

  return {
    ...bonuses,
    [reforge.from]: bonuses[reforge.from] - reforge.take,
    [reforge.to]: bonuses[reforge.to] + reforge.give,
  };
}

/**
 * Which reforges a piece has the stats to take.
 *
 * A reforge moves points it can only move if they are there: `keen` takes three
 * armour, so it has nothing to do to a sword. That is what makes the roll worth
 * anything on a piece with one real stat on it — the eligible set is narrow, so
 * a helmet with four armour is a helmet the counter can do three things to
 * rather than six, and none of them is nothing.
 */
export function eligibleReforges(itemId: ItemId): ReforgeId[] {
  const bonuses = getEquipmentBonuses(itemId);
  return REFORGE_IDS.filter((id) => {
    const reforge = REFORGES[id];
    return bonuses[reforge.from] >= reforge.take;
  });
}

/** Whether this piece can feed a reforge of that one: same slot, and not itself. */
export function canFeed(fedId: ItemId, targetId: ItemId): boolean {
  const fed = ITEMS[fedId];
  const target = ITEMS[targetId];
  if (fed.kind !== 'equipment' || target.kind !== 'equipment') return false;
  return fed.slot === target.slot;
}

/**
 * Everything in the pack this piece could be fed.
 *
 * Same slot and nothing else, which is one sentence rather than a table of what
 * may be melted into what: a helmet feeds a helmet. That covers both of the
 * things this is for at once — the second crown off a king that was pure vendor
 * fodder, and the brown set nobody has worn since the bandit camp.
 *
 * A piece counts as its own fuel only when the pack holds more than one, which
 * is the duplicate case said precisely: reforging the crown you are wearing with
 * the crown you are wearing is not a trade.
 */
export function feedableFrom(inventory: Inventory, targetId: ItemId, worn: boolean): ItemId[] {
  return Object.keys(inventory)
    .filter((id): id is ItemId => {
      const held = inventory[id as ItemId] ?? 0;
      if (held <= 0) return false;
      if (!canFeed(id as ItemId, targetId)) return false;
      // The piece being reforged is either on the character or in the pack. If
      // it is in the pack, one of the stack is the target and cannot also be
      // the fuel.
      return id === targetId && !worn ? held > 1 : true;
    })
    .sort();
}

/**
 * Why this piece cannot be reforged right now, or null when it can.
 *
 * One line naming the first thing missing, the way `tradeRefusal` does: a toast
 * is a sentence, and a list read off one is a sentence nobody finishes. The
 * order is deliberate — what is wrong with the *piece* comes before what is
 * missing from the pack, because a piece nothing can be done to is a fact the
 * player should hear before they go and buy a stone for it.
 */
export function reforgeRefusal(
  itemId: ItemId,
  reforges: Reforges,
  inventory: Inventory,
  worn: boolean,
): string | null {
  const item = ITEMS[itemId];
  if (item.kind !== 'equipment') {
    return 'Only gear can be reforged.';
  }
  if (reforges[itemId]) {
    return `Your ${item.name} has been reforged already. It cannot be worked twice.`;
  }
  if (eligibleReforges(itemId).length === 0) {
    return `There is nothing in a ${item.name} to move.`;
  }
  if (feedableFrom(inventory, itemId, worn).length === 0) {
    return `You need a second piece for that slot to feed the fire.`;
  }
  if ((inventory[REFORGE_STONE_ITEM_ID] ?? 0) <= 0) {
    return 'You need a Reforging Stone. The shop in town sells them.';
  }
  return null;
}

/**
 * Everything the counter can say about one piece, for the panel to draw.
 *
 * `eligible` is on it even when `refusal` is set, so a row short of a stone
 * still shows what it *would* become — which is the whole reason a locked shop
 * row is drawn rather than hidden, and the reason to walk back to town.
 */
export function reforgeOffer(
  itemId: ItemId,
  reforges: Reforges,
  inventory: Inventory,
  worn: boolean,
): ReforgeOffer {
  return {
    itemId,
    current: reforges[itemId] ?? null,
    eligible: eligibleReforges(itemId),
    refusal: reforgeRefusal(itemId, reforges, inventory, worn),
  };
}

/**
 * The roll, over the reforges this piece can take.
 *
 * One roll and it is permanent, which is livable only because a reforge trades
 * rather than adds: there is no outcome that leaves the piece worse than it was,
 * only a direction the player would not have picked. Permanence with an upgrade
 * on the table would have been the version where a bad roll on a 20% drop costs
 * an evening.
 */
export function rollReforge(itemId: ItemId, rng: () => number = Math.random): ReforgeId | null {
  const eligible = eligibleReforges(itemId);
  if (eligible.length === 0) return null;
  const index = Math.min(eligible.length - 1, Math.floor(rng() * eligible.length));
  return eligible[index] ?? null;
}

/** What a reforge did, in the words the toast and the bag row both use. */
export function describeReforge(reforgeId: ReforgeId): string {
  const { take, give, from, to } = REFORGES[reforgeId];
  return `-${take} ${STAT_LABELS[from]}, +${give} ${STAT_LABELS[to]}`;
}

/** The short names the bag already uses for these, kept in step with them. */
const STAT_LABELS: Record<ReforgeStatId, string> = {
  attackPower: 'ATK',
  armor: 'ARM',
  health: 'HP',
  strength: 'STR',
  intellect: 'INT',
  agility: 'AGI',
};

/** What a reforged piece is called: "Keen Steel Helmet". */
export function reforgedName(itemId: ItemId, reforgeId: ReforgeId | null | undefined): string {
  const name = ITEMS[itemId].name;
  return reforgeId ? `${REFORGES[reforgeId].name} ${name}` : name;
}
