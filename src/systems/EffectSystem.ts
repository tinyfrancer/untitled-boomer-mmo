import { EFFECTS, EFFECT_IDS, type EffectDefinition } from '../data/effects';
import { clamp } from './math';
import type { EffectId } from '../types/ids';

/**
 * Anything with a clock on it, which is the only thing an icon needs to know
 * about a buff: `AbilitySystem`'s shield and haste and `FoodSystem`'s meal all
 * satisfy this without any of them knowing the HUD exists.
 */
export interface TimedEffect {
  remainingMs: number;
  durationMs: number;
}

/** One mark the player is carrying, as the row of icons draws it. */
export interface ActiveEffect {
  effectId: EffectId;
  remainingMs: number;
  durationMs: number;
}

/** Whichever of the player's timers are still running, in table order. */
export type EffectTimers = Partial<Record<EffectId, TimedEffect | null>>;

export function effectById(id: EffectId): EffectDefinition {
  return EFFECTS[id];
}

/**
 * The icons a set of timers amounts to.
 *
 * Walked in `EFFECTS` order rather than in the order the caller happened to
 * name them, so an expiring buff never shuffles the two beside it — an icon
 * that moves is one the player has to re-find mid-fight.
 */
export function collectEffects(timers: EffectTimers): ActiveEffect[] {
  const active: ActiveEffect[] = [];
  for (const effectId of EFFECT_IDS) {
    const timer = timers[effectId];
    if (timer && timer.remainingMs > 0 && timer.durationMs > 0) {
      active.push({ effectId, remainingMs: timer.remainingMs, durationMs: timer.durationMs });
    }
  }
  return active;
}

/** How far through an effect is: 0 the moment it lands, 1 as it expires. */
export function effectElapsed(effect: ActiveEffect): number {
  if (effect.durationMs <= 0) {
    return 1;
  }
  return clamp(1 - effect.remainingMs / effect.durationMs, 0, 1);
}

/**
 * The countdown under an icon. Rounded up, so a buff that is still up never
 * reads "0s" — the number and the icon have to agree about whether it is there.
 */
export function effectSeconds(effect: ActiveEffect): number {
  return Math.max(0, Math.ceil(effect.remainingMs / 1000));
}
