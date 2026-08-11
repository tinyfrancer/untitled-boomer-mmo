import type { NpcId } from '../types/ids';

/**
 * What standing at an NPC gets you. One counter each, so far.
 *
 * It exists because the second NPC did: every place that met a `WorldNpc` —
 * the tap, the context menu, the plate over their head, the inspect card —
 * assumed there was only ever one of them and opened a shop. A role is what
 * those five switch on now, so the day a third counter arrives it is a row
 * here and a case in each of them rather than another silent assumption.
 */
export type NpcRoleId = 'merchant' | 'banker';

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
};

/** What an NPC is called, for the map's marker and for anyone examining them. */
export function npcName(npcId: NpcId): string {
  return NPCS[npcId].name;
}

export function npcRole(npcId: NpcId): NpcRoleId {
  return NPCS[npcId].role;
}

// How close the player has to stand to be served, and how far they can drift
// before the counter closes on them. Shared by both roles rather than one pair
// each: two counters that shut at different distances would be a rule a player
// has to learn twice for no reason.
export const NPC_INTERACT_RADIUS = 120;
export const NPC_CLOSE_RADIUS = 200;
