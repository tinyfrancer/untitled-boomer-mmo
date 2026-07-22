import { describe, expect, it } from 'vitest';
import { ARRIVE_RADIUS, stepToward } from '../../src/systems/MovementSystem';

describe('stepToward', () => {
  it('moves at full speed straight toward the target', () => {
    const step = stepToward(0, 0, { x: 100, y: 0 }, 200);
    expect(step.arrived).toBe(false);
    expect(step.vx).toBeCloseTo(200);
    expect(step.vy).toBeCloseTo(0);
  });

  it('normalizes diagonal movement to the same speed', () => {
    const step = stepToward(0, 0, { x: 100, y: 100 }, 200);
    expect(Math.hypot(step.vx, step.vy)).toBeCloseTo(200);
    expect(step.vx).toBeCloseTo(step.vy);
  });

  it('arrives and stops inside the arrival radius', () => {
    const step = stepToward(100, 100, { x: 100 + ARRIVE_RADIUS, y: 100 }, 200);
    expect(step).toEqual({ vx: 0, vy: 0, arrived: true });
  });

  it('keeps moving just outside the arrival radius', () => {
    const step = stepToward(100, 100, { x: 100 + ARRIVE_RADIUS + 1, y: 100 }, 200);
    expect(step.arrived).toBe(false);
    expect(step.vx).toBeGreaterThan(0);
  });
});
