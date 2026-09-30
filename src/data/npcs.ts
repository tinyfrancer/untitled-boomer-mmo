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
export type CounterId = 'talk' | NpcRoleId;

export interface NpcDefinition {
  id: NpcId;
  /**
   * What they are called, everywhere: the nameplate over their head, the marker
   * on the zone map, and the title of the card that describes them. One string,
   * because what a shopkeeper is called is a decision the whole game makes
   * rather than each renderer's own.
   */
  name: string;
  role: NpcRoleId;
  /**
   * What they open a conversation with: one line, in their own voice. It names
   * no place and no person, since the lore that will name them is not written
   * yet, and a greeting is the first thing a rewrite in that voice replaces.
   */
  greeting: string;
}

export const NPCS: Record<NpcId, NpcDefinition> = {
  shopkeeper: {
    id: 'shopkeeper',
    name: 'Shopkeeper',
    role: 'merchant',
    greeting: "Come in, and mind the rats. They've been at the flour again.",
  },
  banker: {
    id: 'banker',
    name: 'Banker',
    role: 'banker',
    greeting: "Whatever you leave with me stays exactly where you left it. That's the whole job.",
  },
  trainer: {
    id: 'trainer',
    name: 'Trainer',
    role: 'trainer',
    greeting: 'Talent is cheap. Knowing what to do with it costs a little more.',
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
    name: 'Quartermaster',
    role: 'quartermaster',
    greeting:
      "Always more work than hands. Take something off the board; it goes back up the moment you're paid.",
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
    name: 'Outfitter',
    role: 'outfitter',
    greeting:
      "Coin's no use to me out here. Bring me ore and timber and I'll see you properly kitted.",
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
    name: 'Fettler',
    role: 'reforger',
    greeting: "I don't make anything. I take what somebody else made and make it yours.",
  },
};

/** What an NPC is called, for the map's marker and for anyone examining them. */
export function npcName(npcId: NpcId): string {
  return NPCS[npcId].name;
}

export function npcRole(npcId: NpcId): NpcRoleId {
  return NPCS[npcId].role;
}

/** Whether that counter is one this person can open: their own, or talking to them. */
export function worksCounter(npcId: NpcId, counter: CounterId): boolean {
  return counter === 'talk' || npcRole(npcId) === counter;
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
