import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness } from './harness';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import {
  WALL_THICKNESS,
  buildingRect,
  buildingWalls,
  doorPoint,
  isInside,
} from '../../src/data/buildings';
import { hasLineOfSight, isBlocked } from '../../src/systems/CollisionSystem';
import { NPC_INTERACT_RADIUS } from '../../src/data/npcs';

/**
 * What a building is, once the world is running: a shell in the walkable map
 * that no tile says anything about.
 *
 * Buildings are placed by offset from the middle of a zone like everything else
 * that spawns, where the tile grid is written out in absolute rows — so they
 * block as `CollisionSystem` blockers rather than as painted-in `WALL_TILE`,
 * beside the tree trunks. These are the assertions that the two halves agree:
 * the footprint the prop is drawn from is the footprint that stops you.
 */
describe('a building in the world', () => {
  /**
   * Walls rather than a footprint, which is the whole of what hollowing them
   * did. A building used to be one blocker covering everything it stood on;
   * it is a shell now, and the thing that must not drift is that every slab a
   * player can be stopped by is a slab they can see.
   */
  it('blocks with its walls rather than with its footprint', () => {
    const { world } = harness();
    const blockers = world.collisionWorld.blockers;

    world.buildings.forEach((building) => {
      const walls = buildingWalls(building);
      expect(walls.length, `the ${building.definition.id} has no walls`).toBeGreaterThan(0);
      walls.forEach((wall) => {
        expect(
          blockers.some(
            (blocker) =>
              Math.abs(blocker.left - wall.left) < 0.01 &&
              Math.abs(blocker.right - wall.right) < 0.01 &&
              Math.abs(blocker.top - wall.top) < 0.01 &&
              Math.abs(blocker.bottom - wall.bottom) < 0.01,
          ),
          `a wall of the ${building.definition.id} stops nobody`,
        ).toBe(true);
      });
      // And the footprint itself is not one, or the room inside would be solid.
      const rect = buildingRect(building);
      expect(
        blockers.some(
          (blocker) =>
            blocker.left === rect.left &&
            blocker.right === rect.right &&
            blocker.top === rect.top &&
            blocker.bottom === rect.bottom,
        ),
        `the ${building.definition.id} is still solid`,
      ).toBe(false);
    });
  });

  // The middle of a building is a room now, and a room is somewhere to stand.
  it('leaves the room inside it walkable', () => {
    const { world } = harness();
    world.buildings.forEach((building) => {
      const box = {
        x: building.x,
        y: building.y,
        halfWidth: PLAYER_HALF_EXTENT,
        halfHeight: PLAYER_HALF_EXTENT,
      };
      expect(
        isBlocked(world.collisionWorld, box),
        `the ${building.definition.id} has no room in it`,
      ).toBe(false);
    });
  });

  /**
   * And the walls still stop you, which is the half that must not have been
   * lost. Measured at the middle of a wall the door is *not* in, so the gap
   * cannot be what is being walked through.
   */
  it('still stops the player at a wall', () => {
    const { world } = harness();
    const building = nth(world.buildings);
    const rect = buildingRect(building);
    const door = building.definition.door;
    // A point in the middle of a solid wall: the north one unless that is the
    // door, in which case the south.
    const y = door === 'north' ? rect.bottom - WALL_THICKNESS / 2 : rect.top + WALL_THICKNESS / 2;

    expect(
      isBlocked(world.collisionWorld, {
        x: building.x,
        y,
        halfWidth: PLAYER_HALF_EXTENT,
        halfHeight: PLAYER_HALF_EXTENT,
      }),
    ).toBe(true);
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

  /**
   * A room is somewhere to be *out of sight*, which is a thing the world did
   * not contain until a building had an inside. What it is for is the knife a
   * bandit throws: it used to be impossible to stand behind a wall, so nothing
   * ever had to ask.
   *
   * Measured through the wall the door is not in, since the doorway is a hole
   * and a line through it is meant to be clear.
   */
  it('breaks the line of sight into the room it makes', () => {
    const { world } = harness();
    const store = world.buildings.find((building) => building.definition.id === 'general-store');
    if (!store) throw new Error('the town has no general store');
    const rect = buildingRect(store);
    const inside = { x: store.x, y: store.y };

    // Behind the back wall, which is the one opposite the south door.
    const behind = { x: store.x, y: rect.top - TILE_SIZE * 2 };
    expect(hasLineOfSight(world.collisionWorld, behind, inside)).toBe(false);

    // And straight in through the door, which is a hole rather than a wall.
    expect(hasLineOfSight(world.collisionWorld, doorPoint(store), inside)).toBe(true);
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
   * And the walk that a tap on a shopfront actually asks for, now that the
   * person behind it is behind a wall.
   *
   * `BuildingActor.tapAnswer` resolves a tap on the store to the shopkeeper —
   * there is no pixel a thumb can put on them from outside — so this is that
   * answer driven through the world: from the middle of town, round the corner
   * of the shop, in through the door and up to the counter. The assertion that
   * matters is *where the player is standing* when the conversation opens.
   * Everything before this phase could be satisfied by being served in the
   * street.
   */
  it('walks the player in through its door and serves them at the counter', () => {
    const { world, until } = harness();
    const shopkeeper = world.npcs.find((npc) => npc.npcId === 'shopkeeper');
    if (!shopkeeper) throw new Error('the town has no shopkeeper');
    const store = world.buildings.find((building) => building.definition.id === 'general-store');
    if (!store) throw new Error('the town has no general store');
    expect(isInside(store, shopkeeper), 'the shopkeeper works out of the store').toBe(true);

    world.tap({ kind: 'npc', npc: shopkeeper });
    until(() => world.counterNpc('talk') !== null, 'the player to reach the shopkeeper', 20000);

    expect(isInside(store, world.player), 'the player is served inside the shop').toBe(true);
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
