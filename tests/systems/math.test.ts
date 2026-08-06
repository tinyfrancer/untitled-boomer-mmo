import { describe, expect, it } from 'vitest';
import { barFill, clamp } from '../../src/systems/math';

describe('clamp', () => {
  it('passes a value already inside the range through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('holds a value at whichever end it ran past', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('barFill', () => {
  it('is the ratio of the two', () => {
    expect(barFill(3, 4)).toBe(0.75);
  });

  it('never leaves the bar, whichever side the value is off', () => {
    expect(barFill(-1, 4)).toBe(0);
    expect(barFill(9, 4)).toBe(1);
  });

  // The case the six hand-written copies disagreed about. Empty is the answer
  // here; a cap that reads full says so where it knows it is a cap.
  it('draws nothing for a bar with nothing to fill', () => {
    expect(barFill(5, 0)).toBe(0);
    expect(barFill(5, -1)).toBe(0);
  });
});
