import { QUESTS } from '../data/quests';
import { SHOP_STOCK, type ShopStockEntry } from '../data/shop';
import { isQuestDone, type QuestLog } from './QuestSystem';

/**
 * Whether something is on the shelf yet, and what to say when it is not.
 *
 * Two answers where `zoneAccess` needs three, and the missing one is the reason:
 * a shut door with the key in the pack is a thing about to happen at a cost, so
 * the caller has to be told about it before walking through. A gated shelf is
 * simply not yet — there is nothing to spend, so there is nothing to warn about.
 */
export type StockAccess =
  | { kind: 'stocked' }
  /**
   * `requirement` is the two or three words the row carries where a price would
   * go; `reason` is the sentence a refusal says out loud. The same split the
   * world map makes between a cell reading "Locked" and the toast that explains
   * it — a row is 200-odd pixels across, and a phone has no tooltip to hover.
   */
  | { kind: 'gated'; requirement: string; reason: string };

/** The part of a character the shelf is ruled on, and no more of one. */
export interface StockContext {
  level: number;
  quests: QuestLog;
}

export interface StockOffer {
  entry: ShopStockEntry;
  access: StockAccess;
}

export function stockAccess(entry: ShopStockEntry, context: StockContext): StockAccess {
  const requires = entry.requires;
  if (!requires) {
    return { kind: 'stocked' };
  }

  if (requires.kind === 'level') {
    if (context.level >= requires.level) {
      return { kind: 'stocked' };
    }
    return {
      kind: 'gated',
      requirement: `Needs Level ${requires.level}`,
      reason: `The shopkeeper keeps that for level ${requires.level} and up.`,
    };
  }

  if (isQuestDone(context.quests, requires.questId)) {
    return { kind: 'stocked' };
  }
  const questName = QUESTS[requires.questId].name;
  return {
    kind: 'gated',
    requirement: `Needs ${questName}`,
    reason: `The shopkeeper will stock that once you have finished ${questName}.`,
  };
}

export function isStocked(entry: ShopStockEntry, context: StockContext): boolean {
  return stockAccess(entry, context).kind === 'stocked';
}

/**
 * The whole shelf in table order, gated rows included.
 *
 * A locked row is drawn rather than hidden, for the same reason a locked zone is
 * drawn shut on the world map instead of being left off it: what is not on the
 * shelf yet is the entire reason to come back, and a player who cannot see it
 * has been told nothing.
 */
export function shopOffers(context: StockContext): StockOffer[] {
  return SHOP_STOCK.map((entry) => ({ entry, access: stockAccess(entry, context) }));
}
