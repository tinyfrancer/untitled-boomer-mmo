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
export type NpcRoleId =
  'merchant' | 'banker' | 'trainer' | 'quartermaster' | 'outfitter' | 'reforger';

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
  /**
   * The fifth counter, out at Greyford, and the first that does not want money.
   *
   * Town trades in coin: the shopkeeper sells, the banker stores, the trainer
   * charges and the quartermaster pays. Everything here is priced in the things
   * a gathering skill produces, which is what makes the outpost worth the walk
   * rather than town in a different colour — and what makes the ore and timber
   * already in the pack worth something other than a vendor line.
   */
  outfitter: { id: 'outfitter', name: 'Outfitter', role: 'outfitter' },
  /**
   * The sixth counter, and a person rather than a station for the reason the
   * bounty board is one.
   *
   * A vat and a forge are `StationId`s, and that id means "where a recipe is
   * made" — `recipesAt`, `STATION_SKILLS`, `STATION_PERSISTS` and `afkCampJob`
   * all read it as one. A reforge is not a recipe: it takes a piece of gear and
   * hands the same piece back changed, with no skill behind it and nothing an
   * unattended camp could ever settle to. Wearing a station's clothes it would
   * have been dead data in four crafting tables, exactly as the board would
   * have been. A role was a row and a handful of cases.
   *
   * A fettler because of what the work is: not making anything and not selling
   * anything, but taking apart what somebody else made and putting it back
   * together to suit. There is no smith in this game to be confused with — the
   * forge in town has nobody behind it — but calling this one a smith would
   * still say "makes things", which is the one thing they do not do.
   */
  fettler: { id: 'fettler', name: 'Fettler', role: 'reforger' },
};

/** What an NPC is called, for the map's marker and for anyone examining them. */
export function npcName(npcId: NpcId): string {
  return NPCS[npcId].name;
}

export function npcRole(npcId: NpcId): NpcRoleId {
  return NPCS[npcId].role;
}

/**
 * How close the player has to stand to be served: a tile, which is the width of
 * their own body — near enough to be *at* the counter.
 *
 * It was nearly two tiles while the counters stood in the open, where being
 * generous cost nothing. Behind a wall it costs the room: a shop is two and a
 * half tiles of floor and its doorstep sits half a tile outside that, so a reach
 * of two tiles is one that hands a purse over through the shopfront and stops
 * the walk in the street. Nobody would ever go inside. So this is what decides
 * whether a room is somewhere you stand, and it is why a counter's room has to
 * be three tiles deep to be one — `tests/systems/BuildingSystem.test.ts` holds
 * that arithmetic rather than this comment.
 *
 * The pair is shared by every role rather than one each: counters that shut at
 * different distances would be a rule a player has to learn once per person for
 * no reason. They are deliberately far apart now — served at the counter, shut
 * only once well away from it — so that shuffling around a room, or stepping
 * back out through the door mid-trade, is free.
 */
export const NPC_INTERACT_RADIUS = 64;
export const NPC_CLOSE_RADIUS = 200;
