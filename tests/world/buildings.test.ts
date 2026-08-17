import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness } from './harness';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import { buildingRect, doorPoint } from '../../src/data/buildings';
import { isBlocked } from '../../src/systems/CollisionSystem';
import { NPC_INTERACT_RADIUS } from '../../src/data/npcs';

/**
 * What a building is, once the world is running: a hole in the walkable map that
 * no tile says anything about.
 *
 * Buildings are placed by offset from the middle of a zone like everything else
 * that spawns, where the tile grid is written out in absolute rows — so they
 * block as `CollisionSystem` blockers rather than as painted-in `WALL_TILE`,
 * beside the tree trunks. These are the assertions that the two halves agree:
 * the footprint the prop is drawn from is the footprint that stops you.
 */
describe('a building in the world', () => {
  it('is a blocker in the collision world, one per building', () => {
    const { world } = harness();
    const blockers = world.collisionWorld.blockers;

    world.buildings.forEach((building) => {
      const rect = buildingRect(building);
      expect(
        blockers.some(
          (blocker) =>
            blocker.left === rect.left &&
            blocker.right === rect.right &&
            blocker.top === rect.top &&
            blocker.bottom === rect.bottom,
        ),
        `nothing stops the player at the ${building.definition.id}`,
      ).toBe(true);
    });
  });

  it('stops the player walking into it', () => {
    const { world } = harness();
    const building = nth(world.buildings);
    const box = {
      x: building.x,
      y: building.y,
      halfWidth: PLAYER_HALF_EXTENT,
      halfHeight: PLAYER_HALF_EXTENT,
    };

    expect(isBlocked(world.collisionWorld, box)).toBe(true);
  });

  /**
   * The other half, and the one that would otherwise be found by a player rather
   * than by a test: a doorstep inside the walls is a walk that collision stops
   * short of, so the tap never arrives and the counter never opens.
   */
  it('leaves its own doorstep walkable', () => {
    const { world } = harness();

    world.buildings.forEach((building) => {
      const door = doorPoint(building);
      expect(
        isBlocked(world.collisionWorld, {
          x: door.x,
          y: door.y,
          halfWidth: PLAYER_HALF_EXTENT,
          halfHeight: PLAYER_HALF_EXTENT,
        }),
        `the ${building.definition.id}'s door is inside it`,
      ).toBe(false);
    });
  });

  // The walk a player actually makes: a tap on a shopfront is a tap on the roof,
  // and what it has to mean is the person standing at the door of it.
  it('is walked up to rather than into', () => {
    const { world, until } = harness();
    const store = world.buildings.find((building) => building.definition.id === 'general-store');
    if (!store) throw new Error('the town has no general store');
    const door = doorPoint(store);

    world.tap({ kind: 'ground', point: door });
    until(() => !world.player.hasMoveTarget(), 'the player to reach the shop door', 20000);

    expect(Math.hypot(world.player.x - door.x, world.player.y - door.y)).toBeLessThan(TILE_SIZE);
  });

  /**
   * The whole point of putting the counters at the doors: arriving at the door
   * is arriving at the person, so a tap on the building and a tap on the
   * shopkeeper end in the same place.
   */
  it('puts the player in reach of the counter it houses, having only tapped the door', () => {
    const { world, until } = harness();
    const shopkeeper = world.npcs.find((npc) => npc.npcId === 'shopkeeper');
    if (!shopkeeper) throw new Error('the town has no shopkeeper');
    const store = world.buildings.find((building) => building.definition.id === 'general-store');
    if (!store) throw new Error('the town has no general store');

    world.tap({ kind: 'ground', point: doorPoint(store) });
    until(() => !world.player.hasMoveTarget(), 'the player to reach the shop door', 20000);

    expect(
      Math.hypot(world.player.x - shopkeeper.x, world.player.y - shopkeeper.y),
    ).toBeLessThanOrEqual(NPC_INTERACT_RADIUS);
  });

  // Rebuilt per zone like everything else in the world, and gone with it: a
  // zone that kept the last one's walls would stop the player in open country.
  it('belongs to its own zone and no other', () => {
    expect(harness({ zoneId: 'town' }).world.buildings.length).toBeGreaterThan(0);
    expect(harness({ zoneId: 'beach' }).world.buildings).toEqual([]);
  });
});
