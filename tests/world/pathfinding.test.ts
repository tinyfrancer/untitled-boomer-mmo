import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import { BLOCKING_TILES, GRASS_TILE, WATER_TILE } from '../../src/data/tiles';
import type { CollisionWorld } from '../../src/systems/CollisionSystem';
import { ApproachDriver } from '../../src/world/ApproachDriver';
import { harness, nodeNamed } from './harness';
import { testContext } from './context';

/**
 * The pathfinder, as the walk it is wired into.
 *
 * `tests/systems/PathSystem.test.ts` proves a route is one a body can walk, over
 * hand-built worlds and over every zone as `populateZone` builds it. What is
 * left for here is the wiring, which is three separate claims: that the legs of
 * a route are walked in order without stalling on any of them, that a tap asks
 * for one at all, and that `null` still means the walk the game had before there
 * was a pathfinder rather than no walk.
 */

// A map drawn as rows of characters, one per tile: '.' walkable, '#' water.
function map(rows: string[]): CollisionWorld {
  const grid = rows.map((row) => [...row].map((cell) => (cell === '#' ? WATER_TILE : GRASS_TILE)));
  return {
    grid,
    blockingTiles: new Set(BLOCKING_TILES),
    worldWidth: (grid[0]?.length ?? 0) * TILE_SIZE,
    worldHeight: grid.length * TILE_SIZE,
    blockers: [],
  };
}

/** The centre of tile (col, row). */
function at(col: number, row: number) {
  return { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
}

function driver(world: CollisionWorld, from: { x: number; y: number }) {
  const kit = testContext();
  kit.player.setPosition(from.x, from.y);
  const onKeyboardMove = vi.fn();
  const approach = new ApproachDriver(kit.ctx, {
    targeting: { target: null },
    collisionWorld: world,
    onKeyboardMove,
  });
  const step = (deltaMs = 100) => {
    approach.update(deltaMs);
    kit.player.update(deltaMs, world);
  };
  return { ...kit, approach, onKeyboardMove, step };
}

beforeEach(() => {
  localStorage.clear();
});

/**
 * Nothing above `Player` decides how a route is consumed, so this is the only
 * place the rule is visible: a leg is given up and the next one steered for
 * inside the same frame.
 */
describe('the legs of a route', () => {
  it('walks them in order and stops on the last one', () => {
    const open = map(['..........', '..........', '..........']);
    const kit = driver(open, at(0, 1));

    kit.player.followPath([at(4, 1), at(8, 1)]);
    for (let frame = 0; frame < 200 && kit.player.hasMoveTarget(); frame += 1) {
      kit.player.update(100, open);
    }

    expect(kit.player.hasMoveTarget()).toBe(false);
    expect(kit.player.x).toBeGreaterThan(at(7, 1).x);
  });

  it('gives up a leg it is already standing on without spending a frame on it', () => {
    const open = map(['..........', '..........', '..........']);
    const kit = driver(open, at(1, 1));
    const from = kit.player.x;

    // The first leg is where the player already is, which is what a route
    // pulled straight around a corner looks like the moment the corner is
    // reached. A frame spent arriving at it is a frame the walk does not move.
    kit.player.followPath([{ x: from, y: kit.player.y }, at(8, 1)]);
    kit.player.update(100, open);

    expect(kit.player.x).toBeGreaterThan(from);
  });

  it('is dropped whole by a hand on the keyboard', () => {
    const open = map(['..........', '..........', '..........']);
    const kit = driver(open, at(0, 1));

    kit.player.followPath([at(4, 1), at(8, 1)]);
    kit.input.press('KeyS');
    kit.player.update(100, open);

    expect(kit.player.hasMoveTarget()).toBe(false);
  });
});

describe('a walk with a wall in the way', () => {
  // A three-tile gap in a wall, which is over the two-tile minimum a body needs
  // to turn a corner in.
  const WALLED = map(['...........', '...........', '####...####', '...........', '...........']);
  const START = at(1, 4);
  const BEYOND = at(1, 1);

  it('goes through the gap and acts on arrival', () => {
    const kit = driver(WALLED, START);
    const act = vi.fn();

    kit.approach.walkTo({ kind: 'shop', radius: 20 }, BEYOND, act);
    let widest = 0;
    for (let frame = 0; frame < 400 && act.mock.calls.length === 0; frame += 1) {
      widest = Math.max(widest, kit.player.x - START.x);
      kit.step();
    }

    expect(act).toHaveBeenCalledTimes(1);
    expect(kit.player.y).toBeLessThan(TILE_SIZE * 2);
    // It got there by going east to the gap rather than by squeezing through
    // the wall, which is the only other way to be standing where it is.
    expect(widest).toBeGreaterThan(TILE_SIZE * 2);
  });

  it('walks a route the same way at 60fps and at 5', () => {
    const landings = [16, 200].map((deltaMs) => {
      const kit = driver(WALLED, START);
      kit.approach.walk(BEYOND);
      for (let frame = 0; frame < 4000 && kit.player.hasMoveTarget(); frame += 1) {
        kit.step(deltaMs);
      }
      return kit.player;
    });

    landings.forEach((player) => {
      expect(player.hasMoveTarget()).toBe(false);
      expect(Math.hypot(player.x - BEYOND.x, player.y - BEYOND.y)).toBeLessThan(TILE_SIZE);
    });
  });

  /**
   * `findPath` answers `null` freely — a sealed room, a goal nothing fits in —
   * and that is the design: it means "walk the way you walked before there was a
   * pathfinder". What it must never mean is standing still.
   */
  it('sets off anyway when there is no route at all', () => {
    const sealed = map([
      '.........',
      '...#####.',
      '...#...#.',
      '...#...#.',
      '...#...#.',
      '...#####.',
      '.........',
    ]);
    const kit = driver(sealed, at(0, 3));

    kit.approach.walk(at(5, 3));
    for (let frame = 0; frame < 100; frame += 1) kit.step();

    expect(kit.player.x).toBeGreaterThan(at(0, 3).x);
    expect(kit.player.hasMoveTarget()).toBe(true);
  });
});

/**
 * The same thing in a real zone, which is where the tap comes in and where the
 * blockers are the ones the game actually has. The mill road is the zone with
 * hardwood on it, and every one of them stands in open ground.
 */
describe('in the world', () => {
  it('goes round a tree rather than pressing into it', () => {
    const kit = harness({ zoneId: 'old-mill-road' });
    const tree = nodeNamed(kit.world, 'hardwood');
    const blocker = tree.blockerRect();
    const goal = { x: tree.x, y: blocker.top - 140 };

    kit.world.teleport(tree.x, blocker.bottom + 140);
    kit.world.tap({ kind: 'ground', point: goal });

    let widest = 0;
    kit.until(
      () => {
        widest = Math.max(widest, Math.abs(kit.world.player.x - tree.x));
        return !kit.world.player.hasMoveTarget();
      },
      'the player to get round the tree',
      20000,
    );

    expect(Math.hypot(kit.world.player.x - goal.x, kit.world.player.y - goal.y)).toBeLessThan(
      TILE_SIZE,
    );
    expect(widest).toBeGreaterThan(PLAYER_HALF_EXTENT);
  });

  /**
   * The walk a tap on a tree asks for ends beside it rather than on it, which is
   * what `standNear` is for: a route to the trunk itself is one `findPath`
   * refuses outright, and refusing it here would mean every gather in the game
   * quietly fell back to the straight line.
   */
  it('walks up to a node it could never stand in, and gathers', () => {
    const kit = harness({ zoneId: 'quarry' });
    kit.character.addItem('pickaxe', 1);
    kit.world.handleEquipRequested('pickaxe');
    const vein = nodeNamed(kit.world, 'tin-vein');

    kit.world.teleport(vein.x, vein.blockerRect().bottom + 250);
    kit.world.tap({ kind: 'node', node: vein });

    // Driven at 60fps rather than at the harness's usual fifth of that, and the
    // reason is the mover's rather than the route's: `moveWithCollision` cuts a
    // frame into half-tile substeps and reverts a blocked one whole, so below
    // about 10fps the body stalls a substep short of the rock and a hair
    // outside a gather's reach. That is as true of the straight line this walk
    // used to be as it is of the route it is now.
    for (let frame = 0; frame < 2000 && kit.world.gatherState === null; frame += 1) {
      kit.tick(1, 16);
    }

    expect(kit.world.gatherState).not.toBeNull();
  });
});
