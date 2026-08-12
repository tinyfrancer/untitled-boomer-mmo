import { beforeEach, describe, expect, it } from 'vitest';
import { harness, nodeNamed } from './harness';
import { NOTICE_EVENT } from '../../src/ui/uiEvents';

/**
 * The third gathering skill, driven in the zone it was built for.
 *
 * Almost none of mining is new code — a vein is a `RESOURCE_NODES` row and the
 * quarry is a `ZONES` row — so what is worth a test here is not the channel,
 * which `gathering.test.ts` already runs end to end. It is the two things a
 * table cannot promise on its own: that the row a skill was added as actually
 * pays out in the zone it was added to, and that a vein stops the player where a
 * tree's trunk would not have.
 */

beforeEach(() => {
  localStorage.clear();
});

function mining(): ReturnType<typeof harness> {
  const kit = harness({ zoneId: 'quarry' });
  kit.character.addItem('pickaxe', 1);
  kit.world.handleEquipRequested('pickaxe');
  return kit;
}

describe('working a vein', () => {
  it('pays ore and mining xp for the tool the quarry is for', () => {
    const kit = mining();
    const vein = nodeNamed(kit.world, 'tin-vein');

    kit.world.teleport(vein.x, vein.y + 72);
    kit.world.startGathering(vein);

    kit.until(() => kit.character.itemCount('tin-ore') > 0, 'the vein to yield ore');
    expect(kit.character.state.skills.mining.xp).toBeGreaterThan(0);
  });

  it('runs out after its charges and comes back on its own clock', () => {
    const kit = mining();
    const vein = nodeNamed(kit.world, 'tin-vein');

    kit.world.teleport(vein.x, vein.y + 72);
    kit.world.startGathering(vein);

    kit.until(() => !vein.isAvailable(), 'the vein to be worked out');
    // Which is the whole difference between a vein and a fishing spot, and the
    // reason a mining camp works a face rather than standing at one rock.
    expect(vein.isAvailable()).toBe(false);
    kit.until(() => vein.isAvailable(), 'the vein to come back', 40000);
  });

  it('holds the iron behind the level the tin is there to earn', () => {
    const kit = mining();
    const iron = nodeNamed(kit.world, 'iron-vein');

    kit.world.teleport(iron.x, iron.y + 72);
    kit.world.startGathering(iron);

    expect(kit.world.gatherState).toBeNull();
    const refusals = kit.emitted
      .filter((entry) => entry.event === NOTICE_EVENT)
      .map((entry) => String(entry.args[0]));
    expect(refusals.join(' ')).toContain('5');
  });
});

/**
 * The blocker fraction became data in the same change that added veins, and this
 * is why: a boulder wearing a tree's third-of-a-tile trunk would have let the
 * player walk most of the way into it.
 */
describe('a vein in the way', () => {
  it('stops the player where a canopy would have let them through', () => {
    const kit = mining();
    const vein = nodeNamed(kit.world, 'tin-vein');
    const blocker = vein.blockerRect();

    // Walked into from the south, which is the side the road comes in on, and
    // aimed at a spot on the far side of it so the walk never arrives.
    const from = blocker.bottom + 100;
    kit.world.teleport(vein.x, from);
    kit.world.tap({ kind: 'ground', point: { x: vein.x, y: blocker.top - 100 } });
    kit.tick(60);

    // Both halves matter: stopped short of the rock, and stopped *at* it rather
    // than never having set off, which is what a walk that silently failed to
    // start would look like from the near side.
    expect(kit.world.player.y).toBeGreaterThan(blocker.bottom);
    expect(kit.world.player.y).toBeLessThan(from - 32);
    expect(Math.abs(kit.world.player.x - vein.x)).toBeLessThan(24);
  });
});
