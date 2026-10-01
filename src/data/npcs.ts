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
  | 'merchant'
  | 'banker'
  | 'trainer'
  | 'quartermaster'
  | 'outfitter'
  | 'reforger'
  // Somebody who works no counter: talking is all there is across from them
  // (D1b's answer). A role of its own rather than a nullable one, so every table
  // keyed by role still says what it means here.
  | 'none';

/**
 * What can be open across from a person: the conversation everybody has, or the
 * counter their role works.
 *
 * Talking is a counter in every sense the world and the HUD care about — it is
 * opened by walking up, shut by walking off or by its X, and one of them is open
 * at a time — so it rides the same session, the same pair of events and the same
 * panel slot. What it is not is a role: nobody's job is to talk, which is why it
 * is its own member here rather than a seventh `NpcRoleId`.
 */
export type CounterId = 'talk' | Exclude<NpcRoleId, 'none'>;

export interface NpcDefinition {
  id: NpcId;
  /**
   * Who they are: the name the lore gives them (`docs/lore/places.md`), and
   * the whole of what is written over their head. A nameplate is one line, and
   * a person is somebody before they are a till.
   */
  name: string;
  /**
   * What they do, said beside their name wherever there is room for it: the
   * card, the zone map and the talk panel (decision 92's shell, D1's answer).
   * Pillar 1 wants it kept somewhere, since "Tilda Pell" alone says nothing
   * about where to sell a crab.
   */
  trade: string;
  role: NpcRoleId;
}

export const NPCS: Record<NpcId, NpcDefinition> = {
  shopkeeper: {
    id: 'shopkeeper',
    name: 'Tilda Pell',
    trade: 'Shopkeeper',
    role: 'merchant',
  },
  banker: {
    id: 'banker',
    name: 'Ambrose Tally',
    trade: 'Banker',
    role: 'banker',
  },
  trainer: {
    id: 'trainer',
    name: 'Marta Hale',
    trade: 'Trainer',
    role: 'trainer',
  },
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
  quartermaster: {
    id: 'quartermaster',
    name: 'Jory Stroud',
    trade: 'Quartermaster',
    role: 'quartermaster',
  },
  /**
   * The fifth counter, out at Greyford, and the first that does not want money.
   *
   * Town trades in coin: the shopkeeper sells, the banker stores, the trainer
   * charges and the quartermaster pays. Everything here is priced in the things
   * a gathering skill produces, which is what makes the outpost worth the walk
   * rather than town in a different colour — and what makes the ore and timber
   * already in the pack worth something other than a vendor line.
   */
  outfitter: {
    id: 'outfitter',
    name: 'Oona Rook',
    trade: 'Outfitter',
    role: 'outfitter',
  },
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
  fettler: {
    id: 'fettler',
    name: 'Silas Quill',
    trade: 'Fettler',
    role: 'reforger',
  },
  /*
   * The lore's people (D1b, `docs/lore/places.md`): somebody the realm has and
   * the game lacked, each with nothing to sell and something to say. Bess keeps
   * the inn the player wakes in and stands behind its bar like any counter; the
   * other three stand in the open, placed in their zone's text.
   */
  innkeeper: {
    id: 'innkeeper',
    name: 'Bess Mallow',
    trade: 'Innkeeper',
    role: 'none',
  },
  fisher: {
    id: 'fisher',
    name: 'Amos Keel',
    trade: 'Fisher',
    role: 'none',
  },
  // Not a person, and on the same rows as one: it stands still, is tapped and
  // talks back, which is all a row here has ever meant.
  crow: {
    id: 'crow',
    name: 'Pocket',
    trade: 'Crow',
    role: 'none',
  },
  // A fenfolk has one name and is known by the light they keep (`naming.md`).
  keeper: {
    id: 'keeper',
    name: 'Maren',
    trade: 'Keeper of the third light',
    role: 'none',
  },
};

/** Who an NPC is, for the plate over their head and anywhere else a name stands alone. */
export function npcName(npcId: NpcId): string {
  return NPCS[npcId].name;
}

/** Their name with their trade beside it, for the zone map's marker. */
export function npcNameAndTrade(npcId: NpcId): string {
  const { name, trade } = NPCS[npcId];
  return `${name}, ${trade}`;
}

export function npcRole(npcId: NpcId): NpcRoleId {
  return NPCS[npcId].role;
}

/** Whether that counter is one this person can open: their own, or talking to them. */
export function worksCounter(npcId: NpcId, counter: CounterId): boolean {
  return counter === 'talk' || npcRole(npcId) === counter;
}

/** The counter a role works: its own, or for somebody who works none, talking to them. */
export function roleCounter(role: NpcRoleId): CounterId {
  return role === 'none' ? 'talk' : role;
}

/**
 * What each role's counter is called, on the button that opens it from a
 * conversation and the line that opens it from a held finger, and what it is
 * for, said under that button once.
 */
export const ROLE_SERVICES: Record<NpcRoleId, { label: string; blurb: string }> = {
  merchant: { label: 'Shop', blurb: 'Buy tools and supplies, sell what you carry' },
  banker: { label: 'Bank', blurb: 'Keep anything here, at no weight' },
  trainer: { label: 'Train', blurb: "Learn your class's abilities, for coin" },
  quartermaster: { label: 'Contracts', blurb: 'Paid work, as often as you like, one at a time' },
  // Trade rather than Shop: the word the other counter uses means coin, and
  // this one does not take any.
  outfitter: { label: 'Trade', blurb: 'Steel tools, for ore, coal and hardwood' },
  // Not Trade either: what happens here is work done to something you already
  // own, and nothing changes hands but a stone.
  reforger: { label: 'Reforge', blurb: "Move a piece of gear's power between stats" },
  // Never drawn as a button, since the conversation it would open is the one
  // already open; it is the held finger's one line and the card's word.
  none: { label: 'Talk', blurb: 'Nothing to sell, and something to say' },
};

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
