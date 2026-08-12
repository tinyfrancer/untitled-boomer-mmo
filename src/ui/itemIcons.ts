import { ITEMS, type ItemIcon } from '../data/items';
import type { ItemId } from '../types/ids';

/**
 * What shape and colour an item is drawn as, for any item at all.
 *
 * Equipment answers this out of what it already carries — a weapon names its
 * `weaponShape` and armour fills a `slot`, and both name the `color` the
 * paperdoll paints them — so most of the item list needs no icon data of its own
 * and a new piece of gear gets a thumbnail by construction. Everything else
 * names an `icon` on its row.
 *
 * This is the vocabulary and `hud/itemIcon.ts` is the DOM that draws it, which
 * is the same split `ui/` and `hud/` are everywhere else: what an item looks
 * like is a decision worth testing without a document to hang it in.
 */
export function itemIcon(itemId: ItemId): ItemIcon {
  const item = ITEMS[itemId];
  if (item.kind !== 'equipment') {
    return item.icon;
  }
  if (item.slot === 'weapon') {
    // `weaponShape` is optional on the type because armour has none, so this
    // needs a fallback it will never reach: a test asserts every weapon row
    // names its shape, which is the thing that actually holds it.
    return { shape: item.weaponShape ?? 'sword', color: item.color };
  }
  if (item.slot === 'offhand') {
    // Same bargain, and held by the same test: what fills the other hand is
    // drawn as what it is rather than as the slot, since a shield and an orb
    // are not one outline in two colours.
    return { shape: item.offhandShape ?? 'shield', color: item.color };
  }
  // Armour is drawn as the slot it fills — the only three left once weapons and
  // the offhand are out, which is what makes this exhaustive rather than a
  // default.
  return { shape: item.slot, color: item.color };
}
