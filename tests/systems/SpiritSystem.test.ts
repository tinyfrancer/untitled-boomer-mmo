import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { SPIRIT_ASIDES, SPIRIT_BEAT_ORDER, SPIRIT_BEATS } from '../../src/data/spiritBeats';
import { ZONES } from '../../src/data/zones';
import { createNewCharacter } from '../../src/persistence';
import { dueBeat, spiritAside } from '../../src/systems/SpiritSystem';
import type { ZoneId } from '../../src/types/ids';

/**
 * Which of Wick's beats waits where (D4, `docs/lore/spirit.md`), derived from
 * the beats heard, the kills and where the character stands. Its waking first,
 * wherever they are; then each in its own place, once.
 */

function character(beats: string[] = []) {
  const state = createNewCharacter('Tester', 'warrior');
  state.beats = beats as typeof state.beats;
  return state;
}

describe('dueBeat', () => {
  it('wakes first, wherever the character is, a character from before Wick included', () => {
    for (const zoneId of Object.keys(ZONES) as ZoneId[]) {
      expect(dueBeat(character(), zoneId)).toBe('wake');
    }
  });

  it("is each zone's arrival in that zone, and nothing in a zone with none", () => {
    const awake = character(['wake']);
    expect(dueBeat(awake, 'beach')).toBe('candle-strand');
    expect(dueBeat(awake, 'greyford')).toBe('greyford');
    expect(dueBeat(awake, 'town')).toBeNull();
    expect(dueBeat(awake, 'bandit-camp')).toBeNull();
  });

  it('is gone once heard', () => {
    expect(dueBeat(character(['wake', 'candle-strand']), 'beach')).toBeNull();
  });

  it("waits for the barrow king's death, in the barrow", () => {
    const state = character(['wake']);
    expect(dueBeat(state, 'sunken-barrow')).toBeNull();
    state.kills['barrow-king'] = 1;
    expect(dueBeat(state, 'sunken-barrow')).toBe('orlath');
    expect(dueBeat(state, 'blackwater-fen')).toBe('blackwater-fen');
  });
});

describe('the beats', () => {
  it('number nine before Part G, in the order the table tells them', () => {
    expect(SPIRIT_BEAT_ORDER).toHaveLength(9);
    expect(Object.keys(SPIRIT_BEATS).sort()).toEqual([...SPIRIT_BEAT_ORDER].sort());
  });

  // The dead-end rule's shape: a beat keyed to a place or a creature the game
  // does not have would never be told.
  it('each name a zone and a creature the game has, and only the waking is unasked', () => {
    for (const beat of Object.values(SPIRIT_BEATS)) {
      if (beat.zoneId !== null) expect(ZONES[beat.zoneId], beat.id).toBeDefined();
      if (beat.when.kind === 'kill') {
        expect(ENEMIES[beat.when.enemyId]?.boss, beat.id).toBe(true);
        expect(beat.zoneId, beat.id).not.toBeNull();
      }
      expect(beat.unbidden, beat.id).toBe(beat.id === 'wake');
      expect(beat.line.length, beat.id).toBeGreaterThan(20);
    }
  });

  // Nothing before Part G says what Lorn did (`docs/lore/spirit.md`).
  it('never say what the lantern was for', () => {
    const told = [
      ...Object.values(SPIRIT_BEATS).map((beat) => beat.line),
      ...Object.values(SPIRIT_ASIDES).flat(),
    ].join(' ');
    for (const word of ['Kindling', 'Drowning', 'Merrath', 'Marhal', 'drowned']) {
      expect(told).not.toContain(word);
    }
  });
});

describe('spiritAside', () => {
  it('goes round the lines for each zone, every zone having some', () => {
    for (const zoneId of Object.keys(ZONES) as ZoneId[]) {
      const lines = SPIRIT_ASIDES[zoneId];
      expect(lines.length, zoneId).toBeGreaterThan(0);
      expect(spiritAside(zoneId, lines.length)).toBe(spiritAside(zoneId, 0));
    }
  });
});
