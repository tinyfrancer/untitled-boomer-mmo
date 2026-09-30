import { describe, expect, it } from 'vitest';
import { TRANSPARENT } from '../../src/art/format';
import { ARM_POSES, hurt } from '../../src/art/sprites/figure';
import { RANGER, WARRIOR, WIZARD } from '../../src/art/sprites/people';

describe('the figure kit', () => {
  it('closes every hand in sight on a fist, so what it holds comes out of the fist', () => {
    // A sword laid near a hand rather than in it is what decision 104 mended:
    // each pose says where its hand is, and that pixel has to be the hand.
    for (const [view, limbs] of Object.entries(ARM_POSES)) {
      limbs.forEach((limb, index) => {
        if (limb.hidden) return;
        const [x, y] = limb.hand;
        const key = limb.grid[y - limb.y]?.[x - limb.x];
        expect('abcd', `${view} arm ${index} at ${x},${y} holds '${key}'`).toContain(key);
      });
    }
  });

  it('flushes a hurt frame red all over', () => {
    for (const def of [WARRIOR, WIZARD, RANGER]) {
      const idle = def.animations.idle;
      const frame = idle && !Array.isArray(idle) && 'down' in idle ? idle.down[0] : undefined;
      if (!frame) throw new Error(`${def.id} has no idle`);
      const keys = new Set(hurt(frame).join(''));
      keys.delete(TRANSPARENT);
      expect(
        [...keys].every((key) => 'PQRS'.includes(key)),
        def.id,
      ).toBe(true);
    }
  });
});
