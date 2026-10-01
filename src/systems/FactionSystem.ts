import {
  FACTIONS,
  FACTION_ORDER,
  FACTION_RANKS,
  FACTION_TITLE_ORDER,
  KILL_STANDING,
  MAX_STANDING,
  MIN_STANDING,
  type FactionRank,
  type StandingMove,
} from '../data/factions';
import type { EnemyId, FactionId, FactionRankId, FactionTitleId } from '../types/ids';

/**
 * Where this character stands with each faction (D3, decision 133).
 *
 * The fourth stored tally, beside kills, visits and mastery, and for their
 * reason: a deed leaves nothing behind to count it off. A contract paid is
 * cleared off the board and an answer given is one line among many, so the
 * standing they moved has to be written down when they happen. Which rank that
 * is, what it opens and which titles it pays are derived from this on read.
 * Absent is 0, a stranger.
 */
export type Standing = Partial<Record<FactionId, number>>;

/** A rank reached or fallen to by a move, for the log and the toast. */
export interface RankCrossing {
  factionId: FactionId;
  rank: FactionRank;
  rose: boolean;
}

export function standingWith(standing: Standing, factionId: FactionId): number {
  return standing[factionId] ?? 0;
}

/** The rank a standing stands on: the last whose `from` it has reached. */
export function rankAt(factionId: FactionId, value: number): FactionRank {
  const { ranks } = FACTIONS[factionId];
  return ranks.findLast((entry) => value >= entry.from) ?? ranks[0]!;
}

export function currentRank(standing: Standing, factionId: FactionId): FactionRank {
  return rankAt(factionId, standingWith(standing, factionId));
}

/** The rank above the one stood on, or null at the top. */
export function nextRank(standing: Standing, factionId: FactionId): FactionRank | null {
  const value = standingWith(standing, factionId);
  return FACTIONS[factionId].ranks.find((entry) => entry.from > value) ?? null;
}

/** Whether this character stands at that rank or above it. */
export function hasRank(standing: Standing, rankId: FactionRankId): boolean {
  const { factionId, from } = FACTION_RANKS[rankId];
  return standingWith(standing, factionId) >= from;
}

/** The word a locked row carries where its price or its progress would go. */
export function rankRequirement(rankId: FactionRankId): string {
  return `Needs ${FACTION_RANKS[rankId].name}`;
}

/** The sentence a refusal says, naming whose rank it is. */
export function rankReason(rankId: FactionRankId): string {
  const { factionId, name } = FACTION_RANKS[rankId];
  return `That wants ${name} with ${FACTIONS[factionId].name}.`;
}

/**
 * Applies a move `count` times over, held between the floor and the ceiling.
 * Pure, in the shape the kill and mastery reducers use.
 */
export function moveStanding(standing: Standing, move: StandingMove, count = 1): Standing {
  if (count <= 0) return standing;
  let next = standing;
  for (const factionId of FACTION_ORDER) {
    const by = move[factionId];
    if (!by) continue;
    const value = clamp(standingWith(next, factionId) + by * count);
    next = { ...next, [factionId]: value };
  }
  return next;
}

/**
 * Every rank a move crossed, up or down. A list, since an offline camp pays a
 * night of kills at once and can cross two ranks in one call; the highest rank
 * reached comes last on the way up and the lowest on the way down.
 */
export function crossedRanks(before: Standing, after: Standing): RankCrossing[] {
  const crossings: RankCrossing[] = [];
  for (const factionId of FACTION_ORDER) {
    const had = standingWith(before, factionId);
    const has = standingWith(after, factionId);
    if (had === has) continue;
    const rose = has > had;
    const ranks = FACTIONS[factionId].ranks.filter((entry) =>
      rose ? entry.from > had && entry.from <= has : entry.from > has && entry.from <= had,
    );
    if (rose) {
      ranks.forEach((entry) => crossings.push({ factionId, rank: entry, rose }));
    } else if (ranks.length > 0) {
      // Falling below a rank lands on the one under it, which is all worth saying.
      crossings.push({ factionId, rank: rankAt(factionId, has), rose });
    }
  }
  return crossings;
}

/** The faction titles this standing has the right to wear, in faction and rank order. */
export function earnedFactionTitles(standing: Standing): FactionTitleId[] {
  return FACTION_TITLE_ORDER.filter((titleId) => hasRank(standing, titleId));
}

/** What a kill of that creature moves, or nothing for one no faction minds. */
export function killStanding(enemyId: EnemyId): StandingMove {
  return KILL_STANDING[enemyId] ?? {};
}

/** A move said out loud: "+25 The Veymarch Company, −2 The Keepers". */
export function describeMove(move: StandingMove): string {
  return FACTION_ORDER.filter((factionId) => move[factionId])
    .map((factionId) => {
      const by = move[factionId] ?? 0;
      return `${by > 0 ? '+' : '−'}${Math.abs(by)} ${FACTIONS[factionId].name}`;
    })
    .join(', ');
}

export function isEmptyMove(move: StandingMove | undefined): boolean {
  return !move || FACTION_ORDER.every((factionId) => !move[factionId]);
}

function clamp(value: number): number {
  return Math.max(MIN_STANDING, Math.min(MAX_STANDING, value));
}
