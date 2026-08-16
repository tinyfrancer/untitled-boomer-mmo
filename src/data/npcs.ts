import type { NpcId } from '../types/ids';

/**
 * What standing at an NPC gets you. One counter each.
 *
 * It exists because the second NPC did: every place that met a `WorldNpc` —
 * the tap, the context menu, the plate over their head, the inspect card —
 * assumed there was only ever one of them and opened a shop. A role is what
 * those five switch on now, and the trainer is the third counter that arrived
 * to collect on it: a row here, a case in each of them, and no place left where
 * a person in a town is assumed to be selling something.
 */
export type NpcRoleId = 'merchant' | 'banker' | 'trainer' | 'quartermaster';

export interface NpcDefinition {
  id: NpcId;
  /**
   * What they are called, everywhere: the nameplate over their head, the marker
   * on the zone map, and the title of the card that describes them. One string,
   * for the reason `TILE_COLORS` is one table — what a shopkeeper is called is a
   * decision the whole game makes rather than each renderer's own.
   */
  name: string;
  role: NpcRoleId;
}

export const NPCS: Record<NpcId, NpcDefinition> = {
  shopkeeper: { id: 'shopkeeper', name: 'Shopkeeper', role: 'merchant' },
  banker: { id: 'banker', name: 'Banker', role: 'banker' },
  trainer: { id: 'trainer', name: 'Trainer', role: 'trainer' },
  // The fourth counter, and the one the plan called a board. A board would have
  // been a second kind of tappable furniture — a pick priority, a prop, a map
  // marker and an inspect card of its own — where `NpcRoleId` is the seam this
  // codebase already built for a fourth counter, down to `COUNTERS` refusing to
  // compile until somebody says what standing here does.
  //
  // A quartermaster rather than a bailiff or a guard because of what the board
  // holds: it asks for raiders put down *and* for timber, ore and worked iron
  // brought in, and a quartermaster is the one person in a town who plausibly
  // wants both.
  quartermaster: { id: 'quartermaster', name: 'Quartermaster', role: 'quartermaster' },
};

/** What an NPC is called, for the map's marker and for anyone examining them. */
export function npcName(npcId: NpcId): string {
  return NPCS[npcId].name;
}

export function npcRole(npcId: NpcId): NpcRoleId {
  return NPCS[npcId].role;
}

// How close the player has to stand to be served, and how far they can drift
// before the counter closes on them. Shared by every role rather than one pair
// each: counters that shut at different distances would be a rule a player has
// to learn once per person for no reason.
export const NPC_INTERACT_RADIUS = 120;
export const NPC_CLOSE_RADIUS = 200;
