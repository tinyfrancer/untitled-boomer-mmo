import type { ItemId } from '../src/types/ids';

/**
 * An item id no row in ITEMS answers to. `ItemId` cannot spell one, which is
 * the point of it — but a bag saved before an item was retired still hands the
 * runtime one on load, and nothing rewrites inventory ids on the way through a
 * migration. The defensive reads that absorb it are real, so this is what keeps
 * them under test without loosening the union everywhere else.
 *
 * Only for ids that reach code from persistence. A `LootTableId` is read off an
 * ENEMIES row and never stored, so there is deliberately no twin of this for it.
 */
export const staleItemId = (id: string): ItemId => id as ItemId;
