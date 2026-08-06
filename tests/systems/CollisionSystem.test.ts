import { describe, expect, it } from 'vitest';
import { EXIT_MARGIN, PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import { BLOCKING_TILES, GRASS_TILE, WATER_TILE } from '../../src/data/tiles';
import {
  clampToWorld,
  isBlocked,
  moveWithCollision,
  type Aabb,
  type CollisionWorld,
  type Bounds,
} from '../../src/systems/CollisionSystem';
import { findExit } from '../../src/systems/ZoneSystem';

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

// The centre of tile (col, row).
function tileCentre(col: number, row: number): { x: number; y: number } {
  return { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
}

function player(x: number, y: number): Aabb {
  return { x, y, halfWidth: PLAYER_HALF_EXTENT, halfHeight: PLAYER_HALF_EXTENT };
}

describe('the tile test', () => {
  // The case a four-corner test gets wrong. A rat's box is 80px against a 64px
  // tile, so it can sit astride a one-tile blocking column with all four
  // corners on dry land.
  it('catches a blocking column no corner of a wide body lands in', () => {
    const map = world(['.#.']);
    const wide = { x: TILE_SIZE * 1.5, y: TILE_SIZE / 2, halfWidth: 40, halfHeight: 19 };
    expect(isBlocked(map, wide)).toBe(true);
  });

  it('counts a body resting exactly on a boundary as touching, not inside', () => {
    const map = world(['..', '##']);
    // Sitting on row 0 with its bottom edge flush against the water row.
    expect(isBlocked(map, player(TILE_SIZE, TILE_SIZE / 2))).toBe(false);
    expect(isBlocked(map, player(TILE_SIZE, TILE_SIZE / 2 + 1))).toBe(true);
  });
});

describe('moveWithCollision against tiles', () => {
  it('walks freely across open ground', () => {
    const map = world(['....', '....', '....']);
    const from = tileCentre(1, 1);
    expect(moveWithCollision(player(from.x, from.y), 20, 0, map)).toEqual({
      x: from.x + 20,
      y: from.y,
    });
  });

  // The frame that motivated the whole substep: a loaded CI runner steps the
  // game at 7fps, where one frame carries the player ~46px.
  it('stops a 46px step into water at the shore', () => {
    const map = world(['...#']);
    const start = tileCentre(2, 0);
    const after = moveWithCollision(player(start.x, start.y), 46, 0, map);
    expect(after.x).toBeLessThan(start.x + 46);
    expect(isBlocked(map, player(after.x, after.y))).toBe(false);
  });

  // Without substepping a single huge displacement jumps clean over a one-tile
  // strip and lands, legally, on the far side.
  it('does not tunnel through a one-tile wall in a single frame', () => {
    const map = world(['..#..']);
    const start = tileCentre(0, 0);
    const after = moveWithCollision(player(start.x, start.y), 4 * TILE_SIZE, 0, map);
    expect(after.x).toBeLessThan(2 * TILE_SIZE);
    expect(isBlocked(map, player(after.x, after.y))).toBe(false);
  });

  it('slides along a wall instead of stopping dead on a diagonal', () => {
    const map = world(['....', '####']);
    const start = tileCentre(0, 0);
    // Down-and-right into the water row: the southward half is refused, the
    // eastward half is not.
    const after = moveWithCollision(player(start.x, start.y), 30, 30, map);
    expect(after.x).toBeCloseTo(start.x + 30);
    expect(after.y).toBeCloseTo(start.y);
  });

  it('stops on both axes in an inside corner', () => {
    const map = world(['..#', '..#', '###']);
    const start = tileCentre(1, 1);
    const after = moveWithCollision(player(start.x, start.y), 30, 30, map);
    expect(after).toEqual({ x: start.x, y: start.y });
  });

  it('lets a body already inside a blocker walk back out', () => {
    const map = world(['.#.']);
    const stuck = tileCentre(1, 0);
    expect(isBlocked(map, player(stuck.x, stuck.y))).toBe(true);
    const after = moveWithCollision(player(stuck.x, stuck.y), -30, 0, map);
    expect(after.x).toBeCloseTo(stuck.x - 30);
  });

  it('does nothing when nothing pushed it', () => {
    const map = world(['...']);
    const start = tileCentre(1, 0);
    expect(moveWithCollision(player(start.x, start.y), 0, 0, map)).toEqual(start);
  });
});

describe('moveWithCollision against solid nodes', () => {
  // A tree stands a tile and a half tall and only its trunk blocks, so the
  // blocker is anchored to the sprite's foot. A blocker centred on the sprite
  // origin would sit ~30px high and stop the player short of the trunk.
  const trunk: Bounds = { left: 190, right: 210, top: 220, bottom: 250 };

  it('refuses a step into the trunk', () => {
    const map = world(['.....', '.....', '.....'], [trunk]);
    const after = moveWithCollision(player(140, 235), 40, 0, map);
    expect(after.x).toBeLessThan(180);
  });

  it('lets the player walk behind the canopy, above the trunk', () => {
    const map = world(['.....', '.....', '.....'], [trunk]);
    const after = moveWithCollision(player(140, 150), 40, 0, map);
    expect(after.x).toBeCloseTo(180);
  });
});

describe('the world-bounds clamp', () => {
  const map = world(['...', '...', '...']);

  it('holds the body inside the world on every edge', () => {
    expect(clampToWorld(player(-500, -500), map)).toEqual({
      x: PLAYER_HALF_EXTENT,
      y: PLAYER_HALF_EXTENT,
    });
    expect(clampToWorld(player(9999, 9999), map)).toEqual({
      x: map.worldWidth - PLAYER_HALF_EXTENT,
      y: map.worldHeight - PLAYER_HALF_EXTENT,
    });
  });

  /**
   * The clamp and the exit band are the same number seen from two sides. If the
   * half-extent ever grows past EXIT_MARGIN, the clamp stops the player outside
   * the band and zone transitions silently stop firing on some edges — a bug
   * with no error and no failing test anywhere else.
   */
  it('leaves the player inside the exit band on every edge', () => {
    expect(EXIT_MARGIN).toBeGreaterThan(PLAYER_HALF_EXTENT);

    const exits = [
      { to: 'beach', edge: 'north' },
      { to: 'beach', edge: 'south' },
      { to: 'beach', edge: 'west' },
      { to: 'beach', edge: 'east' },
    ] as const;
    const corners = [
      clampToWorld(player(-9999, -9999), map),
      clampToWorld(player(9999, 9999), map),
    ];
    corners.forEach((at) => {
      expect(
        findExit([...exits], at.x, at.y, map.worldWidth, map.worldHeight, EXIT_MARGIN),
      ).not.toBeNull();
    });
  });
});
