import { describe, expect, it } from 'vitest';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import { BLOCKING_TILES, GRASS_TILE, WATER_TILE } from '../../src/data/tiles';
import {
  isBlocked,
  moveWithCollision,
  type Bounds,
  type CollisionWorld,
} from '../../src/systems/CollisionSystem';
import { arriveRadius, stepToward, type Point } from '../../src/systems/MovementSystem';
import { zoneWorldSize } from '../../src/systems/ZoneSystem';
import { ZONES } from '../../src/data/zones';
import { populateZone } from '../../src/world/zoneEntities';
import { findPath, hasClearLine, standNear } from '../../src/systems/PathSystem';

// A map drawn as rows of characters, one per tile: '.' walkable, '#' water.
function world(rows: string[], blockers: Bounds[] = []): CollisionWorld {
  const grid = rows.map((row) => [...row].map((cell) => (cell === '#' ? WATER_TILE : GRASS_TILE)));
  return {
    grid,
    blockingTiles: new Set(BLOCKING_TILES),
    worldWidth: (grid[0]?.length ?? 0) * TILE_SIZE,
    worldHeight: grid.length * TILE_SIZE,
    blockers,
  };
}

/** The centre of tile (col, row). */
function at(col: number, row: number): Point {
  return { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
}

function body(point: Point) {
  return { x: point.x, y: point.y, halfWidth: PLAYER_HALF_EXTENT, halfHeight: PLAYER_HALF_EXTENT };
}

const WALK_SPEED = 200;

/**
 * Where the body actually ends up walking the route, integrated the way the
 * game integrates it: one leg at a time through `stepToward`, moved through
 * `moveWithCollision`, giving up if a leg stops making progress.
 *
 * This is the only proof that matters. A path is a claim about a body fitting
 * somewhere, and a list of waypoints that reads correctly can still describe a
 * gap the player grinds to a halt in.
 */
function walk(map: CollisionWorld, from: Point, path: readonly Point[], deltaMs: number): Point {
  let here = { ...from };
  for (const leg of path) {
    // Generous: a leg is a handful of frames at 60fps and a couple at 5.
    for (let frame = 0; frame < 2000; frame += 1) {
      const step = stepToward(here.x, here.y, leg, WALK_SPEED, deltaMs);
      if (step.arrived) break;
      const moved = moveWithCollision(
        body(here),
        (step.vx * deltaMs) / 1000,
        (step.vy * deltaMs) / 1000,
        map,
      );
      // Pressed against something and going nowhere: the walk has failed.
      if (Math.hypot(moved.x - here.x, moved.y - here.y) < 1e-3) return here;
      here = moved;
    }
  }
  return here;
}

/** Walked at a normal frame rate and at the 5fps a cheap phone reaches. */
function arrivesAt(map: CollisionWorld, from: Point, path: readonly Point[], goal: Point): boolean {
  return [16, 200].every((deltaMs) => {
    const landed = walk(map, from, path, deltaMs);
    return (
      Math.hypot(landed.x - goal.x, landed.y - goal.y) <= arriveRadius(WALK_SPEED, deltaMs) &&
      !isBlocked(map, body(landed))
    );
  });
}

describe('open ground', () => {
  const map = world(['.....', '.....', '.....']);

  it('answers with the goal alone when the line is already clear', () => {
    expect(findPath(map, at(0, 1), at(4, 1), PLAYER_HALF_EXTENT)).toEqual([at(4, 1)]);
  });

  it('answers with the goal itself rather than the middle of its tile', () => {
    const goal = { x: at(4, 1).x - 20, y: at(4, 1).y + 11 };
    expect(findPath(map, at(0, 1), goal, PLAYER_HALF_EXTENT)).toEqual([goal]);
  });

  it('is never empty, even standing on the goal', () => {
    const here = at(2, 1);
    expect(findPath(map, here, here, PLAYER_HALF_EXTENT)).toEqual([here]);
  });
});

describe('a wall with a gap', () => {
  //         col 3 is the wall, with a two-tile gap at rows 1 and 2.
  const map = world(['...#...', '.......', '.......', '...#...', '...#...']);
  const start = at(0, 0);
  const goal = at(6, 0);

  it('routes through the gap rather than reporting no way round', () => {
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(goal);
    // The straight line it did not take is genuinely blocked, or this whole
    // block would pass against a world with no wall in it.
    expect(hasClearLine(map, start, goal, PLAYER_HALF_EXTENT)).toBe(false);
  });

  it('walks a body through it at 60fps and at 5', () => {
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT);
    expect(arrivesAt(map, start, path ?? [], goal)).toBe(true);
  });

  it('stops nowhere the body cannot stand', () => {
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT) ?? [];
    path.forEach((point) => expect(isBlocked(map, body(point))).toBe(false));
  });
});

describe('elbow room', () => {
  /**
   * A\* answers with whichever cell is cheapest, which down a corridor two
   * tiles wide is whichever of the two it reached first — flush against one of
   * its walls. Left there, the walk lands a hair off that line and stops dead
   * with a corner in the wall, a tile short of the door.
   */
  it('puts a waypoint in the middle of a corridor rather than against a wall', () => {
    const map = world(['...#...', '.......', '.......', '...#...', '...#...']);
    const path = findPath(map, at(0, 0), at(6, 0), PLAYER_HALF_EXTENT) ?? [];
    const inTheGap = path.filter((point) => Math.abs(point.x - at(3, 0).x) < TILE_SIZE);
    inTheGap.forEach((point) => {
      // The gap spans rows 1 and 2 — y from 64 to 192, and its middle is 128.
      expect(point.y).toBeCloseTo(128);
    });
  });

  it('leaves a waypoint where it is when there is nothing to move away from', () => {
    const map = world(['.......', '.......', '.......', '...#...', '.......']);
    const path = findPath(map, at(0, 4), at(6, 4), PLAYER_HALF_EXTENT) ?? [];
    path.forEach((point) => {
      expect(isBlocked(map, body(point))).toBe(false);
    });
    expect(arrivesAt(map, at(0, 4), path, at(6, 4))).toBe(true);
  });

  /**
   * The narrowest thing this grid can describe, and the reason a doorway has to
   * be wider than one tile. A body a tile wide fits a gap a tile wide only in
   * exact arithmetic: there is no elbow room to take, the walk lands within
   * `arriveRadius` of the waypoint rather than on it, and a hair off the axis
   * is a corner in the doorframe — refused on the one axis it was travelling
   * along, and correcting back onto the line at a fraction of a pixel a frame.
   *
   * So the route is refused rather than handed back for the walk to fail at.
   * `null` is the caller's cue to do what it did before there was a pathfinder,
   * which is press into the wall and let the player sort it out.
   */
  it('refuses to turn a corner inside a gap exactly the body wide', () => {
    const map = world(['...#...', '...#...', '.......', '...#...', '...#...']);
    expect(findPath(map, at(0, 0), at(6, 0), PLAYER_HALF_EXTENT)).toBeNull();
  });

  it('walks straight down that same gap, having no corner to turn in it', () => {
    const map = world(['...#...', '...#...', '.......', '...#...', '...#...']);
    const start = at(0, 2);
    const goal = at(6, 2);
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT) ?? [];
    expect(path).toEqual([goal]);
    expect(arrivesAt(map, start, path, goal)).toBe(true);
  });
});

describe('a room with a door', () => {
  // Four walls, a two-tile doorway in the south one, and open ground outside.
  const map = world([
    '.........',
    '.#######.',
    '.#.....#.',
    '.#.....#.',
    '.#.....#.',
    '.###..##.',
    '.........',
    '.........',
  ]);
  const inside = at(3, 3);
  // Hard against the outside of the south wall, which is where a counter's
  // doorstep is and so the tap a walk out of a building has to answer.
  const outside = at(7, 6);

  it('walks in through the doorway', () => {
    const path = findPath(map, outside, inside, PLAYER_HALF_EXTENT);
    expect(path).not.toBeNull();
    expect(arrivesAt(map, outside, path ?? [], inside)).toBe(true);
  });

  it('walks back out of it', () => {
    const path = findPath(map, inside, outside, PLAYER_HALF_EXTENT);
    expect(path).not.toBeNull();
    expect(arrivesAt(map, inside, path ?? [], outside)).toBe(true);
  });

  it('is the doorway it goes through and not the wall beside it', () => {
    expect(hasClearLine(map, outside, inside, PLAYER_HALF_EXTENT)).toBe(false);
    const path = findPath(map, outside, inside, PLAYER_HALF_EXTENT) ?? [];
    path.forEach((point) => expect(isBlocked(map, body(point))).toBe(false));
  });
});

/**
 * A room two tiles deep with its walls on tile lines, which is every building
 * since zones are written as text: the body fits inside it, but at the middle of
 * neither cell, and its door is centred on the line between them.
 */
describe('a room two tiles deep, on tile lines', () => {
  const wall = TILE_SIZE / 4;
  // A smithy's shell over tiles 3-5 across and 1-2 down, open to the west.
  const [left, top, right, bottom] = [3 * TILE_SIZE, TILE_SIZE, 6 * TILE_SIZE, 3 * TILE_SIZE];
  const map = world(
    ['........', '........', '........', '........', '........', '........'],
    [
      { left, right, top, bottom: top + wall },
      { left, right, top: bottom - wall, bottom },
      { left: right - wall, right, top, bottom },
    ],
  );
  const inside = { x: (left + right) / 2, y: (top + bottom) / 2 };

  it('has no cell whose middle the body fits in', () => {
    expect(isBlocked(map, body(at(4, 1)))).toBe(true);
    expect(isBlocked(map, body(at(4, 2)))).toBe(true);
    expect(isBlocked(map, body(inside))).toBe(false);
  });

  it('walks in around the corner from the far side of its back wall', () => {
    const from = at(6, 4);
    expect(hasClearLine(map, from, inside, PLAYER_HALF_EXTENT)).toBe(false);
    const path = findPath(map, from, inside, PLAYER_HALF_EXTENT);
    expect(path).not.toBeNull();
    expect(arrivesAt(map, from, path ?? [], inside)).toBe(true);
  });

  it('walks back out of it', () => {
    const to = at(4, 4);
    const path = findPath(map, inside, to, PLAYER_HALF_EXTENT);
    expect(path).not.toBeNull();
    expect(arrivesAt(map, inside, path ?? [], to)).toBe(true);
  });
});

describe('a goal nothing can reach', () => {
  it('answers null for a room with no door', () => {
    const map = world(['.....', '.###.', '.#.#.', '.###.', '.....']);
    expect(findPath(map, at(0, 0), at(2, 2), PLAYER_HALF_EXTENT)).toBeNull();
  });

  it('answers null for a goal inside a blocking tile', () => {
    const map = world(['...#.']);
    expect(findPath(map, at(0, 0), at(3, 0), PLAYER_HALF_EXTENT)).toBeNull();
  });

  it('answers null for a goal inside a standing blocker', () => {
    const trunk: Bounds = { left: 190, right: 210, top: 220, bottom: 250 };
    const map = world(['.....', '.....', '.....', '.....'], [trunk]);
    expect(findPath(map, at(0, 0), { x: 200, y: 235 }, PLAYER_HALF_EXTENT)).toBeNull();
  });
});

describe('standing blockers', () => {
  // Three trunks in a row across the middle of a five-wide map: the thing a
  // straight-line walk presses into until the player gives up.
  const stand: Bounds[] = [1, 2, 3].map((col) => ({
    left: col * TILE_SIZE + 22,
    right: col * TILE_SIZE + 42,
    top: 2 * TILE_SIZE + 22,
    bottom: 2 * TILE_SIZE + 42,
  }));
  const map = world(['.....', '.....', '.....', '.....', '.....'], stand);

  it('goes round a tree stand instead of into it', () => {
    const start = at(2, 0);
    const goal = at(2, 4);
    expect(hasClearLine(map, start, goal, PLAYER_HALF_EXTENT)).toBe(false);
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT);
    expect(path).not.toBeNull();
    expect(arrivesAt(map, start, path ?? [], goal)).toBe(true);
  });

  it('lets a body already inside one walk its way out', () => {
    const stuck = { x: 1 * TILE_SIZE + 32, y: 2 * TILE_SIZE + 32 };
    expect(isBlocked(map, body(stuck))).toBe(true);
    const goal = at(4, 4);
    const path = findPath(map, stuck, goal, PLAYER_HALF_EXTENT);
    expect(path).not.toBeNull();
    expect(arrivesAt(map, stuck, path ?? [], goal)).toBe(true);
  });
});

describe('corners', () => {
  /**
   * Two blocking tiles meeting at their corners leave a gap of no width at all.
   * A grid walk that allows the diagonal calls it a route; a body a whole tile
   * wide grinds to a halt in it.
   */
  it('does not squeeze diagonally between two blockers that touch', () => {
    const map = world(['..#..', '..#..', '##.##', '..#..', '..#..']);
    const start = at(1, 1);
    const goal = at(3, 3);
    expect(findPath(map, start, goal, PLAYER_HALF_EXTENT)).toBeNull();
  });

  it('takes the diagonal when there is room for one', () => {
    const map = world(['.....', '.....', '..#..', '.....', '.....']);
    const start = at(0, 0);
    const goal = at(4, 4);
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT);
    expect(path).not.toBeNull();
    expect(arrivesAt(map, start, path ?? [], goal)).toBe(true);
  });
});

describe('the route it hands back', () => {
  // Fifteen tiles across, with a wall two thirds of the way along it and a
  // two-tile gap in the middle of that.
  const map = world([
    '.......#.......',
    '...............',
    '...............',
    '.......#.......',
    '.......#.......',
  ]);
  const start = at(0, 0);
  const goal = at(14, 0);

  it('is pulled straight rather than left as a staircase of tiles', () => {
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT) ?? [];
    // Sixteen cells of grid walk between those two corners. What is left is
    // the arc around the wall — the straight runs either side of it collapse.
    expect(path.length).toBeLessThanOrEqual(7);
    expect(path.length).toBeGreaterThan(1);
  });

  it('crosses the open half of the map in one leg', () => {
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT) ?? [];
    const last = path.at(-1);
    const before = path.at(-2) ?? start;
    expect(Math.hypot((last?.x ?? 0) - before.x, (last?.y ?? 0) - before.y)).toBeGreaterThan(
      4 * TILE_SIZE,
    );
  });

  it('never doubles back through a waypoint it has already passed', () => {
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT) ?? [];
    const seen = new Set(path.map((point) => `${point.x},${point.y}`));
    expect(seen.size).toBe(path.length);
  });

  it('walks it', () => {
    const path = findPath(map, start, goal, PLAYER_HALF_EXTENT) ?? [];
    expect(arrivesAt(map, start, path, goal)).toBe(true);
  });
});

describe('a body of another size', () => {
  // A one-tile door, and something two tiles across asking to come through it.
  const map = world(['.#.', '...', '.#.']);

  it('refuses a gap the body does not fit through', () => {
    expect(findPath(map, at(0, 1), at(2, 1), TILE_SIZE)).toBeNull();
  });

  it('lets a smaller body through the same gap', () => {
    expect(findPath(map, at(0, 1), at(2, 1), PLAYER_HALF_EXTENT)).not.toBeNull();
  });
});

describe('the zones as they are built', () => {
  const zones = Object.values(ZONES).map((zone) => ({
    id: zone.id,
    entities: populateZone(zone, zoneWorldSize(zone), () => 0.5),
  }));

  /**
   * Not a claim about the pathfinder so much as one about the plumbing: the
   * grid, the tile set and the blockers a zone is actually built from, rather
   * than the hand-drawn worlds everything above this runs against.
   */
  it('routes from the middle of every zone to everything worth walking to', () => {
    zones.forEach(({ id, entities }) => {
      const { spawnPoint, npcs, stations, signposts } = entities;
      [...npcs, ...stations, ...signposts].forEach((thing) => {
        const path = findPath(entities.collisionWorld, spawnPoint, thing, PLAYER_HALF_EXTENT);
        expect(path, `${id}: ${thing.x},${thing.y}`).not.toBeNull();
      });
    });
  });

  it('walks those routes', () => {
    zones.forEach(({ id, entities }) => {
      const { collisionWorld, spawnPoint, npcs, stations, signposts } = entities;
      [...npcs, ...stations, ...signposts].forEach((thing) => {
        const goal = { x: thing.x, y: thing.y };
        const path = findPath(collisionWorld, spawnPoint, goal, PLAYER_HALF_EXTENT) ?? [];
        expect(
          arrivesAt(collisionWorld, spawnPoint, path, goal),
          `${id}: ${goal.x},${goal.y}`,
        ).toBe(true);
      });
    });
  });
});

describe('hasClearLine', () => {
  it('sees a blocker a coarser sample would step over on a diagonal', () => {
    // A trunk sitting where two half-tile-apart sample boxes would meet at
    // their corners, on the diagonal from one corner of the map to the other.
    const trunk: Bounds = { left: 150, right: 170, top: 150, bottom: 170 };
    const map = world(['.....', '.....', '.....', '.....', '.....'], [trunk]);
    expect(hasClearLine(map, at(0, 0), at(4, 4), PLAYER_HALF_EXTENT)).toBe(false);
  });

  it('is happy with a line that clears everything', () => {
    const map = world(['.....', '.....', '.....']);
    expect(hasClearLine(map, at(0, 0), at(4, 2), PLAYER_HALF_EXTENT)).toBe(true);
  });
});

/**
 * Choosing where to walk to is not the same question as finding the way there,
 * which is why this is beside `findPath` rather than inside it: a route may
 * never end inside a wall, and a walk toward a tree was always going to end
 * beside one.
 */
describe('standNear', () => {
  it('hands back a goal the body already fits at, untouched', () => {
    const map = world(['.....', '.....', '.....']);
    const goal = at(3, 1);
    expect(standNear(map, at(0, 1), goal, PLAYER_HALF_EXTENT)).toEqual(goal);
  });

  it('backs off something solid, along the line the walk comes in on', () => {
    const map = world(['.....', '..#..', '.....']);
    const from = at(0, 1);
    const stood = standNear(map, from, at(2, 1), PLAYER_HALF_EXTENT);

    expect(isBlocked(map, body(stood))).toBe(false);
    // Between the two, and nearer the thing than the walker: as close as the
    // straight line would ever have got.
    expect(stood.x).toBeGreaterThan(from.x);
    expect(stood.x).toBeLessThan(at(2, 1).x);
    expect(stood.y).toBeCloseTo(from.y);
  });

  it('backs off no further than the feet it started from', () => {
    // A wall the full width of the map with the goal inside it: every point on
    // the line is solid until the walker's own spot, which is the one place on
    // it the body is known to fit. Standing still is the right answer — there
    // is nowhere nearer the thing to be.
    const map = world(['.....', '#####', '.....']);
    const from = at(2, 0);
    expect(standNear(map, from, at(2, 1), PLAYER_HALF_EXTENT)).toEqual(from);
  });

  it('gives the goal back when even those are solid', () => {
    // Standing inside something, which the mover allows and this has no better
    // answer for: the caller falls through to `findPath`, which refuses a goal
    // nothing fits in, and the straight line is what is left.
    const map = world(['.....', '#####', '.....']);
    const goal = at(2, 1);
    expect(standNear(map, at(1, 1), goal, PLAYER_HALF_EXTENT)).toEqual(goal);
  });
});
