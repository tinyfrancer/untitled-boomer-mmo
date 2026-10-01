import type { EnemyId, FactionId, FactionRankId, FactionTitleId } from '../types/ids';

/**
 * Standing to add to each faction, by the faction, for one deed: a kill, a
 * quest handed in, a contract paid, an answer given. Negative costs standing.
 */
export type StandingMove = Partial<Record<FactionId, number>>;

/**
 * Where standing is held between. A floor and a ceiling so that a long grind
 * one way is never a hole a player cannot climb out of, and so a faction's top
 * rank is a goal rather than a number that keeps on counting.
 */
export const MIN_STANDING = -1000;
export const MAX_STANDING = 1000;

export interface FactionRank {
  id: FactionRankId;
  /** In the faction's own words (`docs/lore/naming.md`), and the title it pays. */
  name: string;
  /** The standing it starts at. The first rank of a faction starts at the floor. */
  from: number;
  /** Whether it pays a title: every rank above where a stranger stands does. */
  title: boolean;
}

export interface FactionDefinition {
  id: FactionId;
  name: string;
  /** What the faction wants, in a line, for the character sheet's row. */
  wants: string;
  /** Lowest first; a character stands on the last whose `from` they have reached. */
  ranks: readonly FactionRank[];
}

const rank = (id: FactionRankId, name: string, from: number, title = true): FactionRank => ({
  id,
  name,
  from,
  title,
});

/**
 * The three factions with standing before level 9 (decision 133), from
 * `docs/lore/factions.md`. Every one starts a character at 0, a stranger, and
 * climbs at 50, 250 and 750. Only the Keepers have a rank below it, since only
 * the Keepers are set against anything the game asks a player to do.
 */
export const FACTIONS: Record<FactionId, FactionDefinition> = {
  company: {
    id: 'company',
    name: 'The Veymarch Company',
    wants: 'The Veymarch safe and paying.',
    ranks: [
      rank('company-stranger', 'Stranger', MIN_STANDING, false),
      rank('company-hand', 'Company Hand', 50),
      rank('company-contractor', 'Company Contractor', 250),
      rank('company-factor', 'Company Factor', 750),
    ],
  },
  keepers: {
    id: 'keepers',
    name: 'The Keepers',
    wants: 'The lanterns kept, the barrows shut, the Company off the fen.',
    ranks: [
      rank('keepers-drainer', 'Drainer', MIN_STANDING, false),
      rank('keepers-outsider', 'Outsider', -50, false),
      rank('keepers-guest', 'Guest of the Fen', 50),
      rank('keepers-lightfriend', 'Lightfriend', 250),
      rank('keepers-fenkin', 'Fenkin', 750),
    ],
  },
  greyford: {
    id: 'greyford',
    name: 'Greyford',
    wants: 'The road open and something worth trading.',
    ranks: [
      rank('greyford-stranger', 'Stranger', MIN_STANDING, false),
      rank('greyford-regular', 'Greyford Regular', 50),
      rank('greyford-trader', 'Greyford Trader', 250),
      rank('greyford-friend', 'Friend of the Yard', 750),
    ],
  },
};

export const FACTION_ORDER: readonly FactionId[] = ['company', 'keepers', 'greyford'];

/**
 * What a kill is worth to whom. The Company pays for the road and the fen; the
 * Keepers count every raider down against the player, since the raiders are
 * their young, and every wight laid as a mercy, since its light is out and
 * nothing else would lay it; Greyford counts the goblins off its road. A
 * creature nobody minds is not on it.
 */
export const KILL_STANDING: Partial<Record<EnemyId, StandingMove>> = {
  bandit: { company: 1 },
  'bandit-chief': { company: 10 },
  'goblin-scavenger': { greyford: 1 },
  'fen-raider': { company: 1, keepers: -2 },
  'barrow-wight': { keepers: 1 },
};

/** Every rank by its id, for a requirement or a title that names one. */
export const FACTION_RANKS: Record<FactionRankId, FactionRank & { factionId: FactionId }> =
  Object.fromEntries(
    FACTION_ORDER.flatMap((factionId) =>
      FACTIONS[factionId].ranks.map((entry) => [entry.id, { ...entry, factionId }]),
    ),
  ) as Record<FactionRankId, FactionRank & { factionId: FactionId }>;

/** The ranks that pay a title, in faction and rank order. */
export const FACTION_TITLE_ORDER: FactionTitleId[] = FACTION_ORDER.flatMap((factionId) =>
  FACTIONS[factionId].ranks.filter((entry) => entry.title).map((entry) => entry.id),
) as FactionTitleId[];
