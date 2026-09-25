import { describe, expect, it } from 'vitest';
import { GATHER_BEATS, GatherBeat } from '../../src/ui/gatherBeat';

/** The strokes found in a run of progress readings, as the progress each was found on. */
function strokes(beat: GatherBeat, readings: number[]): number[] {
  return readings.filter((progress) => beat.beat(progress));
}

describe('GatherBeat', () => {
  it('finds each beat once, on the first reading past it', () => {
    expect(strokes(new GatherBeat(), [0.1, 0.29, 0.31, 0.5, 0.79, 0.81, 0.95])).toEqual([
      0.31, 0.81,
    ]);
  });

  /**
   * A slow frame can carry a channel past both beats at once. That is still one
   * stroke rather than none — a chop that could vanish on a cheap phone is the
   * frame-rate bug this game keeps finding in new places.
   */
  it('finds a beat a slow frame stepped clean over', () => {
    expect(strokes(new GatherBeat(), [0.1, 0.9])).toEqual([0.9]);
  });

  it('starts again when the next channel begins', () => {
    const beat = new GatherBeat();
    strokes(beat, [0.5, 0.9]);
    expect(strokes(beat, [0.05, 0.4])).toEqual([0.4]);
  });

  it('forgets the last channel on a reset, so a new zone does not inherit it', () => {
    const beat = new GatherBeat();
    beat.beat(0.9);
    beat.reset();
    expect(beat.beat(0.5)).toBe(true);
  });

  it('strikes twice a channel', () => {
    expect(GATHER_BEATS).toHaveLength(2);
  });
});
