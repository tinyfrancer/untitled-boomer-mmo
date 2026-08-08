import { describe, expect, it } from 'vitest';
import {
  collectEffects,
  effectById,
  effectElapsed,
  effectSeconds,
  type ActiveEffect,
} from '../../src/systems/EffectSystem';
import { EFFECTS, EFFECT_IDS } from '../../src/data/effects';
import { EFFECT_STYLE } from '../../src/ui/theme';
import type { EffectId } from '../../src/types/ids';

const active = (effectId: EffectId, remainingMs: number, durationMs: number): ActiveEffect => ({
  effectId,
  remainingMs,
  durationMs,
});

describe('collectEffects', () => {
  it('keeps only the timers that are still running', () => {
    const effects = collectEffects({
      'mana-shield': { remainingMs: 5000, durationMs: 20000 },
      haste: null,
      'well-fed': { remainingMs: 0, durationMs: 10000 },
    });

    expect(effects).toEqual([active('mana-shield', 5000, 20000)]);
  });

  it('carries the clock and the length it started at, which the icon needs both of', () => {
    expect(collectEffects({ haste: { remainingMs: 3000, durationMs: 8000 } })).toEqual([
      active('haste', 3000, 8000),
    ]);
  });

  /**
   * The one that matters at a glance: an icon that changes place when a
   * neighbour expires is one the player has to find again mid-fight.
   */
  it('draws them in table order however they were named', () => {
    const effects = collectEffects({
      'well-fed': { remainingMs: 1000, durationMs: 10000 },
      haste: { remainingMs: 1000, durationMs: 8000 },
      'mana-shield': { remainingMs: 1000, durationMs: 20000 },
    });

    expect(effects.map((effect) => effect.effectId)).toEqual(EFFECT_IDS);
  });

  it('is empty when nothing is up', () => {
    expect(collectEffects({})).toEqual([]);
  });
});

describe('what an icon draws', () => {
  it('sweeps from nothing to full as the buff is spent', () => {
    expect(effectElapsed(active('haste', 8000, 8000))).toBe(0);
    expect(effectElapsed(active('haste', 2000, 8000))).toBe(0.75);
    expect(effectElapsed(active('haste', 0, 8000))).toBe(1);
  });

  it('never leaves the sweep outside the square, however the numbers arrive', () => {
    expect(effectElapsed(active('haste', 9000, 8000))).toBe(0);
    expect(effectElapsed(active('haste', -1000, 8000))).toBe(1);
    expect(effectElapsed(active('haste', 1, 0))).toBe(1);
  });

  // Rounded up, so the number and the icon never disagree about whether the
  // buff is there: "0s" under a square that is still lit reads as a bug.
  it('rounds the countdown up while any time is left', () => {
    expect(effectSeconds(active('well-fed', 8001, 10000))).toBe(9);
    expect(effectSeconds(active('well-fed', 1, 10000))).toBe(1);
    expect(effectSeconds(active('well-fed', 0, 10000))).toBe(0);
  });
});

describe('the effect table', () => {
  it('answers for every id', () => {
    for (const id of EFFECT_IDS) {
      expect(effectById(id).id).toBe(id);
    }
  });

  // The pair `QUEST_MARKER_STYLE` makes with `QuestSystem`: the table says what
  // an effect is and the theme says what it looks like, so a new row without a
  // glyph would otherwise draw an empty square.
  it('has a glyph for every row, and no two the same', () => {
    const glyphs = EFFECT_IDS.map((id) => EFFECT_STYLE[id].glyph);
    expect(glyphs.every((glyph) => glyph.length > 0)).toBe(true);
    expect(new Set(glyphs).size).toBe(EFFECT_IDS.length);
  });

  it('gives every row a short name that fits under a 30px icon', () => {
    for (const definition of Object.values(EFFECTS)) {
      expect(definition.short.length).toBeLessThanOrEqual(8);
    }
  });
});
