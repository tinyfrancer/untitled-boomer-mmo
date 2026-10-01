import { potionEffectOf } from '../data/items';
import {
  DULLED_PAIN_ARMOR,
  FORTUNE_DROP_MULTIPLIER,
  FORTUNE_YIELD_CHANCE,
  KEEPERS_WATCH_XP_MULTIPLIER,
  POTION_EFFECTS,
  POTION_EFFECT_IDS,
  QUICK_HANDS_SPEED,
} from '../data/potions';
import { AFK_XP_MULTIPLIER } from './AfkSystem';
import type { ActiveEffect } from './EffectSystem';
import type { ItemId, PotionEffectId } from '../types/ids';

/**
 * The potions a character has drunk, as the time each has left (version 2
 * phase E2).
 *
 * Kept on the character rather than on the body, where food's clock is, for
 * two reasons the user chose: a potion lasts minutes, so it has to outlive a
 * zone change and a reload, and it works for the time it has left while the
 * game is closed, so the away payout has to be able to read it. Only the time
 * left is stored; what each one does is read off `data/potions.ts`.
 */
export type PotionTimers = Partial<Record<PotionEffectId, number>>;

export function potionLeftMs(timers: PotionTimers, effectId: PotionEffectId): number {
  return Math.max(0, timers[effectId] ?? 0);
}

export function isPotionActive(timers: PotionTimers, effectId: PotionEffectId): boolean {
  return potionLeftMs(timers, effectId) > 0;
}

/**
 * The timers with this potion drunk, or null for an item that is not one.
 *
 * A second of the same kind starts its clock again rather than adding to it:
 * stacking would make a pack of them a whole night drunk at the door, where
 * the potion is meant to be something brewed for the hour ahead. Different
 * kinds run side by side, since each does a different thing.
 */
export function drinkPotion(timers: PotionTimers, itemId: ItemId): PotionTimers | null {
  const effectId = potionEffectOf(itemId);
  if (!effectId) return null;
  return { ...timers, [effectId]: POTION_EFFECTS[effectId].durationMs };
}

/** The timers a stretch of time later, every one run down and the spent ones gone. */
export function spendPotionTime(timers: PotionTimers, elapsedMs: number): PotionTimers {
  const next: PotionTimers = {};
  for (const effectId of POTION_EFFECT_IDS) {
    const left = potionLeftMs(timers, effectId) - Math.max(0, elapsedMs);
    if (left > 0) next[effectId] = left;
  }
  return next;
}

/** What Quick Hands takes off a gather while it lasts, beside the skill's own speed. */
export function potionGatherSpeed(timers: PotionTimers): number {
  return isPotionActive(timers, 'quick-hands') ? QUICK_HANDS_SPEED : 0;
}

/** The armour Dulled Pain adds while it lasts. */
export function potionArmor(timers: PotionTimers): number {
  return isPotionActive(timers, 'dulled-pain') ? DULLED_PAIN_ARMOR : 0;
}

/** The share of XP idle keeps, which Keeper's Watch lifts from a half to three-quarters. */
export function idleXpMultiplier(watching: boolean): number {
  return watching ? KEEPERS_WATCH_XP_MULTIPLIER : AFK_XP_MULTIPLIER;
}

/** What Fortune adds to the chance of a second one off a gather or a job. */
export function fortuneYieldChance(timers: PotionTimers): number {
  return isPotionActive(timers, 'fortune') ? FORTUNE_YIELD_CHANCE : 0;
}

/** What Fortune multiplies each drop's chance by. */
export function fortuneDropMultiplier(timers: PotionTimers): number {
  return isPotionActive(timers, 'fortune') ? FORTUNE_DROP_MULTIPLIER : 1;
}

/** Every potion still running, as the row of icons draws it, in table order. */
export function potionEffects(timers: PotionTimers): ActiveEffect[] {
  return POTION_EFFECT_IDS.filter((effectId) => isPotionActive(timers, effectId)).map(
    (effectId) => ({
      effectId,
      remainingMs: potionLeftMs(timers, effectId),
      durationMs: POTION_EFFECTS[effectId].durationMs,
    }),
  );
}

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/**
 * What a potion does, in one line for its card and its strip, read off the
 * numbers the rolls use so the two cannot disagree.
 */
export function describePotionEffect(effectId: PotionEffectId): string {
  switch (effectId) {
    case 'quick-hands':
      return `Gathers ${percent(QUICK_HANDS_SPEED)} quicker`;
    case 'dulled-pain':
      return `+${DULLED_PAIN_ARMOR} Armour`;
    case 'keepers-watch':
      return `Idle earns ${percent(KEEPERS_WATCH_XP_MULTIPLIER)} of the XP, not ${percent(AFK_XP_MULTIPLIER)}`;
    case 'fortune':
      return (
        `+${percent(FORTUNE_YIELD_CHANCE)} chance of a second one off a gather or a job, ` +
        `and each drop ${percent(FORTUNE_DROP_MULTIPLIER - 1)} likelier`
      );
  }
}

/** "10 min", how long one lasts. */
export function potionDuration(effectId: PotionEffectId): string {
  return `${Math.round(POTION_EFFECTS[effectId].durationMs / 60_000)} min`;
}
