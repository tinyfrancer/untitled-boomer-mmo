import { el, fillPercent } from './dom';
import {
  effectById,
  effectElapsed,
  effectSeconds,
  type ActiveEffect,
} from '../systems/EffectSystem';
import { iconEl } from './hudArt';
import { effectIconKey } from '../art/icons';
import type { EffectId } from '../types/ids';

interface EffectIcon {
  root: HTMLElement;
  sweep: HTMLElement;
  time: HTMLElement;
}

/**
 * The row of buff and debuff icons under the player column.
 *
 * Rebuilt only when the *set* of effects changes and updated in place
 * otherwise, the same bargain `ActionBar` makes with its cooldown sweeps: the
 * world republishes several times a second while anything is ticking, and
 * rebuilding three elements at that rate would throw away the tooltip a desktop
 * player is currently reading.
 */
export class EffectBar {
  readonly root: HTMLElement;
  private readonly icons = new Map<EffectId, EffectIcon>();
  private drawn = '';

  constructor() {
    this.root = el('div', 'hud-effects hud-hidden');
  }

  /** Whether anything is up, which is what decides the column's height. */
  isEmpty(): boolean {
    return this.icons.size === 0;
  }

  update(effects: ActiveEffect[]): void {
    const signature = effects.map((effect) => effect.effectId).join('|');
    if (signature !== this.drawn) {
      this.drawn = signature;
      this.rebuild(effects);
    }
    for (const effect of effects) {
      const icon = this.icons.get(effect.effectId);
      if (!icon) continue;
      // Drawn as the *spent* share, growing from the bottom, so a full square
      // is a buff about to drop off — the opposite of a bar being drained.
      icon.sweep.style.height = fillPercent(effectElapsed(effect));
      icon.time.textContent = effectClock(effect);
    }
  }

  private rebuild(effects: ActiveEffect[]): void {
    this.root.replaceChildren();
    this.icons.clear();
    for (const effect of effects) {
      const definition = effectById(effect.effectId);

      const root = el('div', 'hud-effect');
      root.dataset.effect = effect.effectId;
      // The whole name, for the one player who has a pointer to hover with.
      root.title = definition.name;

      const icon = el('div', `hud-effect__icon is-${definition.kind}`);
      icon.append(iconEl(effectIconKey(effect.effectId)));
      const sweep = el('div', 'hud-effect__sweep');
      icon.append(sweep);

      const time = el('div', 'hud-effect__time');
      root.append(icon, el('div', 'hud-effect__name', definition.short), time);
      this.root.append(root);
      this.icons.set(effect.effectId, { root, sweep, time });
    }
    this.root.classList.toggle('hud-hidden', effects.length === 0);
  }
}

/**
 * What is left on a buff, in the unit a player counts it in: a spell's seconds,
 * and a potion's half hour in minutes rather than as "1800s", rounded up so the
 * last minute reads as one until it is seconds.
 */
export function effectClock(effect: ActiveEffect): string {
  const seconds = effectSeconds(effect);
  return seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`;
}
