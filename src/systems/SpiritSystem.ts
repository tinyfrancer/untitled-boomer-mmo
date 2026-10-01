import { SPIRIT_ASIDES, SPIRIT_BEAT_ORDER, SPIRIT_BEATS } from '../data/spiritBeats';
import type { CharacterState } from '../persistence/CharacterState';
import type { SpiritBeatId, ZoneId } from '../types/ids';

/**
 * Which of Wick's beats is waiting to be told here, or null.
 *
 * Derived from what the save already keeps, the beats heard, the kills and
 * where the character stands, so nothing but the hearing is stored. The waking
 * goes ahead of everything, wherever the character is, since it is what says
 * the light can be tapped; after it, the first in order whose moment has come
 * and whose place this is.
 */
export function dueBeat(state: CharacterState, zoneId: ZoneId): SpiritBeatId | null {
  const heard = state.beats;
  if (!heard.includes('wake')) return 'wake';
  for (const beatId of SPIRIT_BEAT_ORDER) {
    if (heard.includes(beatId)) continue;
    const beat = SPIRIT_BEATS[beatId];
    if (beat.zoneId !== null && beat.zoneId !== zoneId) continue;
    if (beat.when.kind === 'kill' && (state.kills[beat.when.enemyId] ?? 0) < 1) continue;
    return beatId;
  }
  return null;
}

/** Wick's line of its own in a zone, the `turn`th, going round. */
export function spiritAside(zoneId: ZoneId, turn: number): string {
  const lines = SPIRIT_ASIDES[zoneId];
  return lines[turn % lines.length] ?? '';
}
