import { MAX_CHARACTER_LEVEL } from '../config/constants';
import { xpToNextLevel } from './LevelingSystem';
import { OFFLINE_CAP_MS, OFFLINE_MAX_LEVEL_FRACTION } from './OfflineAfkSystem';

/**
 * Rested (decision 85, phase E1): time idle or away banks a bonus that speeds
 * up the XP the player earns by hand.
 *
 * It is the other half of what idle is for. Idle pays half the XP and never an
 * ability, which keeps it behind active play (decision 15); rested is what it
 * hands back to active play for the time, so stepping away is worth something
 * to the player who comes back. Every number here is behind a function the
 * idle panel reads, so the panel cannot promise a bank the camp does not fill.
 */

/**
 * The most that banks: half a level's worth, the share of a level a parked
 * night is held to, so a night's two rewards are the same size and both move
 * with the curve.
 */
export const RESTED_MAX_LEVEL_FRACTION = OFFLINE_MAX_LEVEL_FRACTION;
/**
 * How long an empty bank takes to fill: the eight hours a parked night counts,
 * so a full night tops it up, the same rate with the game open or closed.
 */
export const RESTED_FILL_MS = OFFLINE_CAP_MS;
/** While any is banked, XP earned by hand pays this many times over. */
export const RESTED_XP_MULTIPLIER = 2;

/** The most rested a character at this level can hold; none at the top level. */
export function restedCap(level: number): number {
  return xpToNextLevel(level) * RESTED_MAX_LEVEL_FRACTION;
}

/**
 * The bank after this long idle. Never takes any away: a bank over the cap is
 * one the cap has not caught up with, which a level only ever raises.
 */
export function bankRested(rested: number, level: number, ms: number): number {
  const cap = restedCap(level);
  if (ms <= 0 || rested >= cap) return rested;
  return Math.min(cap, rested + (cap * ms) / RESTED_FILL_MS);
}

export interface RestedSpend {
  /** What the bank adds to the award, in whole XP. */
  bonus: number;
  /** The bank after paying it. */
  rested: number;
}

/**
 * What a by-hand award of `amount` takes out of the bank. Whole XP only, since
 * XP is counted in whole points; the fraction left in the bank keeps banking.
 * Nothing at the top level, where the XP goes nowhere and the bank would be
 * spent for nothing.
 */
export function spendRested(amount: number, rested: number, level: number): RestedSpend {
  if (level >= MAX_CHARACTER_LEVEL || amount <= 0) return { bonus: 0, rested };
  const bonus = Math.min(Math.floor(rested), Math.floor(amount * (RESTED_XP_MULTIPLIER - 1)));
  return { bonus, rested: rested - bonus };
}

/**
 * How far along the XP bar the bank carries the player before it runs out, in
 * XP past where they are now. Each point of bonus comes with the XP it was paid
 * on, so the bank reaches further than its size, twice as far while it doubles;
 * the paler segment is drawn this long, and its far end stays put while it is
 * spent.
 */
export function restedReach(rested: number): number {
  const bonus = Math.floor(rested);
  return Math.floor((bonus * RESTED_XP_MULTIPLIER) / (RESTED_XP_MULTIPLIER - 1));
}
