import { describe, expect, it } from 'vitest';
import { FRAME_WINDOW, FrameTimer } from '../../src/host/frameTimer';

describe('FrameTimer', () => {
  it('answers nothing before anything has been drawn', () => {
    expect(new FrameTimer().reading()).toEqual({ averageMs: 0, worstMs: 0, samples: 0 });
  });

  it('means what it has, rather than waiting for a full window', () => {
    const timer = new FrameTimer(4);
    timer.sample(2);
    timer.sample(4);
    expect(timer.reading()).toEqual({ averageMs: 3, worstMs: 4, samples: 2 });
  });

  it('forgets frames older than the window', () => {
    const timer = new FrameTimer(3);
    [100, 100, 100, 1, 1, 1].forEach((ms) => timer.sample(ms));
    expect(timer.reading()).toEqual({ averageMs: 1, worstMs: 1, samples: 3 });
  });

  // The gate is on the mean precisely because it isn't this: one bad frame in
  // thirty moves the worst reading to it and the average by a thirtieth.
  it('carries a hitch on the worst without letting it decide the mean', () => {
    const timer = new FrameTimer(10);
    for (let frame = 0; frame < 9; frame += 1) timer.sample(2);
    timer.sample(200);
    const reading = timer.reading();
    expect(reading.worstMs).toBe(200);
    expect(reading.averageMs).toBeCloseTo(21.8);
  });

  it('rolls a full window without the mean drifting off the frames in it', () => {
    const timer = new FrameTimer();
    for (let frame = 0; frame < FRAME_WINDOW * 3 + 7; frame += 1) timer.sample(5);
    expect(timer.reading()).toEqual({ averageMs: 5, worstMs: 5, samples: FRAME_WINDOW });
  });
});
