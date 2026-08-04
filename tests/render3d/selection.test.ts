import { describe, expect, it } from 'vitest';
import { SelectionRing } from '../../src/render3d/selection';
import { harness } from '../world/harness';

describe('SelectionRing', () => {
  it('shows nothing until something is targeted', () => {
    const ring = new SelectionRing();
    expect(ring.object.visible).toBe(false);

    ring.follow({ x: 100, y: 200 });
    expect(ring.object.visible).toBe(true);

    ring.follow(null);
    expect(ring.object.visible).toBe(false);
  });

  // Every frame rather than on a target-changed event: the thing being fought
  // is usually running at you.
  it('keeps up with a target that is moving', () => {
    const { world, tick } = harness();
    const mob = world.mobs[0];
    const ring = new SelectionRing();

    ring.follow(mob);
    const startedAt = { x: ring.object.position.x, z: ring.object.position.z };

    mob.engage();
    tick(30);
    ring.follow(mob);
    expect(ring.object.position.x).toBe(mob.x);
    expect(ring.object.position.z).toBe(mob.y);
    expect({ x: ring.object.position.x, z: ring.object.position.z }).not.toEqual(startedAt);
  });

  // Lying on the floor rather than standing up in the air: from a camera at an
  // angle a ring facing the player reads as a hoop round them, and one that is
  // exactly coplanar with the terrain z-fights as the camera turns.
  it('lies flat on the ground and just clear of it', () => {
    const ring = new SelectionRing();
    expect(ring.object.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
    expect(ring.object.position.y).toBeGreaterThan(0);
    expect(ring.object.position.y).toBeLessThan(2);
  });
});
