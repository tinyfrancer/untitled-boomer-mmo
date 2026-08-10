import { inventoryEntries, type Inventory } from './InventorySystem';
import type { ItemId } from '../types/ids';

/**
 * The vault: weightless, and limited by how many *kinds* of thing it will hold.
 *
 * The pack is limited by weight and the bank deliberately is not, because the
 * two are answers to different questions. Weight is what makes a trip out of
 * town a decision about what to carry home; a second weight limit behind the
 * counter would only make it the same decision twice. What the bank costs
 * instead is shelf space — one slot per item id, however deep the stack on it —
 * which is RuneScape's answer and the one that leaves something worth selling.
 *
 * A stack of one and a stack of two hundred are the same slot on purpose. It is
 * what makes a gathering run's haul free to put away once the shelf exists, and
 * what makes the *first* of something the thing you pay for.
 */

// What a new character's vault holds. Enough for the raw ends of both gathering
// skills and a spare weapon, which is the point at which the pack stops being
// the only answer — and short enough that the first sink is felt within an hour.
export const STARTING_BANK_SLOTS = 8;

/**
 * The ceiling, which is close to one of everything the game contains.
 *
 * Deliberately so: the last slot bought is the one that stops the player
 * choosing what to keep, and a sink whose top end never arrives is a number
 * rather than a purchase. Move it when the item list grows.
 */
export const MAX_BANK_SLOTS = 24;

// The first slot past the free ones, and what each one after that adds. A
// rising price is what keeps this a sink that scales with a purse instead of a
// fixed shopping list: the first three cost 225 copper together, the last three
// cost 1,200.
const BANK_SLOT_BASE_PRICE = 50;
const BANK_SLOT_PRICE_STEP = 25;

/** How many shelves are spoken for. An emptied stack frees its slot. */
export function bankSlotsUsed(bank: Inventory): number {
  return inventoryEntries(bank).filter(([, quantity]) => quantity > 0).length;
}

/**
 * What the next slot costs, or null at the cap.
 *
 * Null rather than Infinity because "there are no more" and "you cannot afford
 * it" are different things to tell a player, and the panel draws them
 * differently.
 */
export function bankSlotPrice(slots: number): number | null {
  const bought = Math.max(0, Math.floor(slots) - STARTING_BANK_SLOTS);
  if (Math.floor(slots) >= MAX_BANK_SLOTS) {
    return null;
  }
  return BANK_SLOT_BASE_PRICE + BANK_SLOT_PRICE_STEP * bought;
}

/**
 * Whether this would fit on the shelves.
 *
 * Adding to a stack that is already banked is always free — the slot is spent
 * on the item id and not on the count — which is what makes putting a run's
 * haul away a decision made once rather than every trip.
 */
export function hasBankRoom(bank: Inventory, slots: number, itemId: ItemId): boolean {
  if ((bank[itemId] ?? 0) > 0) {
    return true;
  }
  return bankSlotsUsed(bank) < slots;
}
