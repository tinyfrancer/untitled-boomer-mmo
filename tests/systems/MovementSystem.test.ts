import { describe, expect, it } from 'vitest';
import {
  ARRIVE_RADIUS,
  arriveRadius,
  distance,
  stepToward,
  withinRadius,
} from '../../src/systems/MovementSystem';

const FRAME_60FPS_MS = 1000 / 60;

describe('distance', () => {
  it('measures a straight line, not a per-axis gap', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('does not care which point comes first', () => {
    expect(distance({ x: 10, y: -20 }, { x: -5, y: 4 })).toBeCloseTo(
      distance({ x: -5, y: 4 }, { x: 10, y: -20 }),
    );
  });
});

describe('withinRadius', () => {
  it('counts the boundary as inside, matching every interact radius in the game', () => {
    expect(withinRadius({ x: 0, y: 0 }, { x: 0, y: 50 }, 50)).toBe(true);
  });

  it('excludes a point just past it', () => {
    expect(withinRadius({ x: 0, y: 0 }, { x: 0, y: 50.5 }, 50)).toBe(false);
  });

  it('is round, not square', () => {
    // Inside a 50px box on both axes, outside a 50px circle.
    expect(withinRadius({ x: 0, y: 0 }, { x: 40, y: 40 }, 50)).toBe(false);
  });
});

describe('stepToward', () => {
  it('moves at full speed straight toward the target', () => {
    const step = stepToward(0, 0, { x: 100, y: 0 }, 200, FRAME_60FPS_MS);
    expect(step.arrived).toBe(false);
    expect(step.vx).toBeCloseTo(200);
    expect(step.vy).toBeCloseTo(0);
  });

  it('normalizes diagonal movement to the same speed', () => {
    const step = stepToward(0, 0, { x: 100, y: 100 }, 200, FRAME_60FPS_MS);
    expect(Math.hypot(step.vx, step.vy)).toBeCloseTo(200);
    expect(step.vx).toBeCloseTo(step.vy);
  });

  it('arrives and stops inside the arrival radius', () => {
    const step = stepToward(100, 100, { x: 100 + ARRIVE_RADIUS, y: 100 }, 200, FRAME_60FPS_MS);
    expect(step).toEqual({ vx: 0, vy: 0, arrived: true });
  });

  it('keeps moving just outside the arrival radius', () => {
    const step = stepToward(100, 100, { x: 100 + ARRIVE_RADIUS + 1, y: 100 }, 200, FRAME_60FPS_MS);
    expect(step.arrived).toBe(false);
    expect(step.vx).toBeGreaterThan(0);
  });
});

// The regression this guards: the arrival radius alone only works while a
// frame's travel is smaller than it. On a slow frame the player used to
// overshoot, turn round and orbit the destination forever — at 7fps, two
// thirds of destinations never resolved. Both a loaded CI runner and a cheap
// phone reach that frame rate.
describe('stepToward on a slow frame', () => {
  const walk = (distance: number, fps: number): { arrived: boolean; x: number } => {
    const deltaMs = 1000 / fps;
    let x = 0;
    for (let frame = 0; frame < 500; frame += 1) {
      const step = stepToward(x, 0, { x: distance, y: 0 }, 320, deltaMs);
      x += (step.vx * deltaMs) / 1000;
      if (step.arrived) {
        return { arrived: true, x };
      }
    }
    return { arrived: false, x };
  };

  it('lands on every destination at every playable frame rate', () => {
    for (const fps of [60, 30, 15, 10, 7, 5]) {
      for (let distance = 20; distance <= 400; distance += 7) {
        const walked = walk(distance, fps);
        expect(walked.arrived, `${distance}px at ${fps}fps`).toBe(true);
        // Within the band for this frame rate, which widens as the step does.
        expect(Math.abs(walked.x - distance)).toBeLessThanOrEqual(arriveRadius(320, 1000 / fps));
      }
    }
  });

  it('never exceeds walking speed, even on the step that lands', () => {
    // The caller integrates this over the physics timestep rather than over
    // deltaMs, so a faster-than-walking final step overshoots the point.
    for (const fps of [60, 30, 15, 10, 7, 5]) {
      for (let distance = 10; distance <= 400; distance += 3) {
        const step = stepToward(0, 0, { x: distance, y: 0 }, 320, 1000 / fps);
        expect(Math.hypot(step.vx, step.vy)).toBeLessThanOrEqual(320);
      }
    }
  });

  it('stops inside the band for its frame rate', () => {
    for (const fps of [60, 7]) {
      const deltaMs = 1000 / fps;
      const walked = walk(400, fps);
      expect(Math.abs(walked.x - 400)).toBeLessThanOrEqual(arriveRadius(320, deltaMs));
    }
  });
});
