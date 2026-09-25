/**
 * Where in a gather's channel the tool comes down, as fractions of it: twice a
 * gather, so a chop reads — and sounds — as chopping rather than as standing
 * beside a tree while a bar fills.
 */
export const GATHER_BEATS = [0.3, 0.8] as const;

/**
 * Finds a gather's beats in the stream of its progress.
 *
 * The world says how far through a channel the gather is on every tick and
 * nothing about strokes, which are presentation. Both the view and the sound
 * want the same strokes, so both hold one of these rather than each keeping its
 * own idea of when the axe lands. A tick behind the last one is a new channel:
 * the last gather landed and the next one began.
 */
export class GatherBeat {
  private last = 0;

  /** Whether this tick's progress crossed a beat since the last tick. */
  beat(progress: number): boolean {
    const last = progress < this.last ? 0 : this.last;
    this.last = progress;
    return GATHER_BEATS.some((beat) => last < beat && progress >= beat);
  }

  reset(): void {
    this.last = 0;
  }
}
