import type { DrawTime } from '../types/debugView';

/**
 * How many drawn frames the reading is averaged over.
 *
 * Small enough that a throttled smoke section fills it from its own frames
 * rather than from whatever the page was doing a second ago, and large enough
 * that one unlucky frame does not decide the answer. A window this size refills
 * in under half a second at 60fps and in four seconds at the 7fps the throttled
 * pass runs at.
 */
export const FRAME_WINDOW = 30;

/**
 * A rolling mean of what the last frames cost to draw.
 *
 * This is the whole of the frame budget's instrument: `drawnCounts()` answers
 * what is drawn and `canvases()` what the view holds, and until this existed
 * nothing answered what it costs in *time* — so the rule that every lighting
 * change is measured before it lands was a comment rather than a check.
 *
 * It measures the call into whatever is drawing, which is CPU time spent
 * issuing a frame rather than the GPU's own. That is the half a throttled CPU
 * inflates, which is what the gate in `scripts/smoke.mjs` is about; a
 * fill-rate regression would need a different instrument and does not have one.
 *
 * Kept by the host rather than by the view, like the gesture beside it: the
 * host times its own call to the view, so whatever draws is measured with
 * nothing written for it.
 */
export class FrameTimer {
  private readonly window: number;
  private readonly samples: number[] = [];
  private next = 0;

  constructor(window = FRAME_WINDOW) {
    this.window = window;
  }

  /** One drawn frame, in milliseconds. */
  sample(ms: number): void {
    if (this.samples.length < this.window) {
      this.samples.push(ms);
      return;
    }
    this.samples[this.next] = ms;
    this.next = (this.next + 1) % this.window;
  }

  reading(): DrawTime {
    const samples = this.samples.length;
    if (samples === 0) return { averageMs: 0, worstMs: 0, samples: 0 };
    const total = this.samples.reduce((sum, ms) => sum + ms, 0);
    return {
      averageMs: total / samples,
      worstMs: Math.max(...this.samples),
      samples,
    };
  }
}
