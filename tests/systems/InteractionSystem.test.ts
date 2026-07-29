import { describe, expect, it } from 'vitest';
import { resolveApproach, type PendingInteraction } from '../../src/systems/InteractionSystem';

const NODE: PendingInteraction = { kind: 'gather', point: { x: 100, y: 100 }, radius: 80 };

describe('resolveApproach', () => {
  it('acts once the player is inside the radius', () => {
    expect(resolveApproach(NODE, { x: 100, y: 60 }, true, 0)).toEqual({ kind: 'act' });
  });

  it('acts when the player is standing exactly on the radius', () => {
    expect(resolveApproach(NODE, { x: 180, y: 100 }, true, 0)).toEqual({ kind: 'act' });
  });

  it('keeps walking while the player is outside it and still en route', () => {
    expect(resolveApproach(NODE, { x: 400, y: 100 }, true, 0)).toEqual({ kind: 'walking' });
  });

  it('abandons the intent when the walk ended short', () => {
    expect(resolveApproach(NODE, { x: 400, y: 100 }, false, 0)).toEqual({ kind: 'abandon' });
  });

  it('measures the gap diagonally, not per axis', () => {
    // 60/60 is 60px away on each axis but 84.9 in a straight line — outside a
    // radius of 80.
    expect(resolveApproach(NODE, { x: 40, y: 40 }, true, 0)).toEqual({ kind: 'walking' });
  });

  // The slow-frame case the movement code already documents: the mover stops
  // as soon as it is within its own arrival band, and that band grows with the
  // frame's travel. A walk that ended there arrived, however tight the
  // interact radius is.
  it('counts a walk that ended inside the frame arrival band as arrival', () => {
    const tight: PendingInteraction = { kind: 'shop', point: { x: 0, y: 0 }, radius: 10 };
    expect(resolveApproach(tight, { x: 30, y: 0 }, false, 40)).toEqual({ kind: 'act' });
  });

  it('still abandons a walk that ended beyond that band', () => {
    const tight: PendingInteraction = { kind: 'shop', point: { x: 0, y: 0 }, radius: 10 };
    expect(resolveApproach(tight, { x: 50, y: 0 }, false, 40)).toEqual({ kind: 'abandon' });
  });

  it('does not let the arrival band act while the walk is still running', () => {
    const tight: PendingInteraction = { kind: 'shop', point: { x: 0, y: 0 }, radius: 10 };
    expect(resolveApproach(tight, { x: 30, y: 0 }, true, 40)).toEqual({ kind: 'walking' });
  });

  it('applies the same rule to every kind of interaction', () => {
    const kinds = ['gather', 'shop', 'signpost'] as const;
    kinds.forEach((kind) => {
      const pending: PendingInteraction = { kind, point: { x: 0, y: 0 }, radius: 50 };
      expect(resolveApproach(pending, { x: 10, y: 0 }, true, 0)).toEqual({ kind: 'act' });
      expect(resolveApproach(pending, { x: 500, y: 0 }, false, 0)).toEqual({ kind: 'abandon' });
    });
  });
});
