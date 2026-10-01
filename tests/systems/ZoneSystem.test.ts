import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import {
  SIGNPOST_INSET,
  SIGNPOST_INTERACT_RADIUS,
  SIGNPOST_SIDE_OFFSET,
  arrivalPoint,
  edgeFraction,
  findExit,
  oppositeEdge,
  resumePoint,
  sideOn,
  signpostPoint,
  zoneWorldSize,
} from '../../src/systems/ZoneSystem';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import { BLOCKING_TILES } from '../../src/data/tiles';
import { ZONES } from '../../src/data/zones';
import { ENEMIES } from '../../src/data/enemies';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import type { ZoneExit } from '../../src/data/zones';

const WORLD_W = 1600;
const WORLD_H = 1216;
const MARGIN = 38;

const exits: ZoneExit[] = [
  { edge: 'south', to: 'town' },
  { edge: 'east', to: 'town' },
];

describe('findExit', () => {
  it('returns null away from every edge', () => {
    expect(findExit(exits, WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, MARGIN)).toBeNull();
  });

  it('finds an exit inside the margin of its edge', () => {
    expect(findExit(exits, 800, WORLD_H - MARGIN, WORLD_W, WORLD_H, MARGIN)?.edge).toBe('south');
    expect(findExit(exits, WORLD_W - 10, 600, WORLD_W, WORLD_H, MARGIN)?.edge).toBe('east');
  });

  it('finds an exit on either end of either axis', () => {
    const all: ZoneExit[] = [
      { edge: 'north', to: 'town' },
      { edge: 'south', to: 'beach' },
      { edge: 'west', to: 'town' },
      { edge: 'east', to: 'bandit-camp' },
    ];
    expect(findExit(all, 800, 0, WORLD_W, WORLD_H, MARGIN)?.edge).toBe('north');
    expect(findExit(all, 800, WORLD_H, WORLD_W, WORLD_H, MARGIN)?.edge).toBe('south');
    expect(findExit(all, 0, 600, WORLD_W, WORLD_H, MARGIN)?.edge).toBe('west');
    expect(findExit(all, WORLD_W, 600, WORLD_W, WORLD_H, MARGIN)?.edge).toBe('east');
  });

  it('ignores edges with no exit', () => {
    // north and west have no exits in the table above
    expect(findExit(exits, 800, 0, WORLD_W, WORLD_H, MARGIN)).toBeNull();
    expect(findExit(exits, 0, 600, WORLD_W, WORLD_H, MARGIN)).toBeNull();
  });

  it('does not fire just outside the margin', () => {
    expect(findExit(exits, 800, WORLD_H - MARGIN - 1, WORLD_W, WORLD_H, MARGIN)).toBeNull();
  });
});

describe('oppositeEdge', () => {
  it('pairs the four edges', () => {
    expect(oppositeEdge('north')).toBe('south');
    expect(oppositeEdge('south')).toBe('north');
    expect(oppositeEdge('east')).toBe('west');
    expect(oppositeEdge('west')).toBe('east');
  });
});

describe('edgeFraction', () => {
  // Where a centre can cross a whole edge: half a body in from either end.
  const near = PLAYER_HALF_EXTENT;

  it('measures along x for horizontal edges and y for vertical ones', () => {
    expect(edgeFraction({ edge: 'south' }, WORLD_W / 2, WORLD_H, WORLD_W, WORLD_H)).toBeCloseTo(
      0.5,
    );
    expect(edgeFraction({ edge: 'north' }, WORLD_W - near, 0, WORLD_W, WORLD_H)).toBeCloseTo(1);
    expect(edgeFraction({ edge: 'east' }, WORLD_W, near, WORLD_W, WORLD_H)).toBeCloseTo(0);
    expect(edgeFraction({ edge: 'west' }, 0, WORLD_H / 2, WORLD_W, WORLD_H)).toBeCloseTo(0.5);
  });

  it('runs over where a centre can cross, so either end of the edge is 0 and 1', () => {
    expect(edgeFraction({ edge: 'south' }, near, WORLD_H, WORLD_W, WORLD_H)).toBe(0);
    expect(edgeFraction({ edge: 'south' }, WORLD_W - near, WORLD_H, WORLD_W, WORLD_H)).toBe(1);
  });

  it('clamps to 0..1 even if the position overshoots the world', () => {
    expect(edgeFraction({ edge: 'south' }, -50, WORLD_H, WORLD_W, WORLD_H)).toBe(0);
    expect(edgeFraction({ edge: 'south' }, WORLD_W + 50, WORLD_H, WORLD_W, WORLD_H)).toBe(1);
  });
});

describe('arrivalPoint', () => {
  it('places the player inset from the entry edge at the carried fraction', () => {
    expect(arrivalPoint({ edge: 'north' }, 0.5, WORLD_W, WORLD_H, 96)).toEqual({ x: 800, y: 96 });
    expect(arrivalPoint({ edge: 'south' }, 0.5, WORLD_W, WORLD_H, 96)).toEqual({
      x: 800,
      y: WORLD_H - 96,
    });
    expect(arrivalPoint({ edge: 'west' }, 0.5, WORLD_W, WORLD_H, 96)).toEqual({ x: 96, y: 608 });
    expect(arrivalPoint({ edge: 'east' }, 0.5, WORLD_W, WORLD_H, 96)).toEqual({
      x: WORLD_W - 96,
      y: 608,
    });
  });

  it('lands either end of an edge half a body in, where the bounds would hold the body', () => {
    expect(arrivalPoint({ edge: 'north' }, 0, WORLD_W, WORLD_H, 96).x).toBe(PLAYER_HALF_EXTENT);
    expect(arrivalPoint({ edge: 'north' }, 1, WORLD_W, WORLD_H, 96).x).toBe(
      WORLD_W - PLAYER_HALF_EXTENT,
    );
  });

  it('round-trips with findExit: an arrival never stands on the return exit', () => {
    const margin = 38;
    const inset = 96;
    const back: ZoneExit[] = [{ edge: 'north', to: 'town' }];
    const arrive = arrivalPoint({ edge: 'north' }, 0.5, WORLD_W, WORLD_H, inset);
    expect(findExit(back, arrive.x, arrive.y, WORLD_W, WORLD_H, margin)).toBeNull();
  });
});

/**
 * A mouth is the stretch of an edge an exit is open along (decision 119): a
 * vault's way in, a few tiles wide in a wall of rock, rather than a side open
 * end to end.
 */
describe('a mouth', () => {
  // Rows 10 to 13 of the west edge, a centre crossing it half a tile in from
  // either side of them.
  const mouth: ZoneExit = { edge: 'west', to: 'town', mouth: [10, 13] };
  const side = 10.5 * TILE_SIZE;
  const middle = 12 * TILE_SIZE;
  const far = 13.5 * TILE_SIZE;

  it('is the only part of its edge that leaves', () => {
    expect(findExit([mouth], 0, middle, WORLD_W, WORLD_H, MARGIN)).toBe(mouth);
    expect(findExit([mouth], 0, 9.5 * TILE_SIZE, WORLD_W, WORLD_H, MARGIN)).toBeNull();
    expect(findExit([mouth], 0, 14.5 * TILE_SIZE, WORLD_W, WORLD_H, MARGIN)).toBeNull();
  });

  it('measures a crossing across itself rather than across the edge', () => {
    expect(edgeFraction(mouth, 0, side, WORLD_W, WORLD_H)).toBe(0);
    expect(edgeFraction(mouth, 0, middle, WORLD_W, WORLD_H)).toBeCloseTo(0.5);
    expect(edgeFraction(mouth, 0, far, WORLD_W, WORLD_H)).toBe(1);
  });

  it('lands an arrival across itself, a body clear of the rock either side', () => {
    expect(arrivalPoint(mouth, 0, WORLD_W, WORLD_H, 96)).toEqual({ x: 96, y: side });
    expect(arrivalPoint(mouth, 0.5, WORLD_W, WORLD_H, 96)).toEqual({ x: 96, y: middle });
    expect(arrivalPoint(mouth, 1, WORLD_W, WORLD_H, 96)).toEqual({ x: 96, y: far });
  });

  it('stands its signpost by its own middle', () => {
    expect(signpostPoint(mouth, WORLD_W, WORLD_H)).toEqual({
      x: SIGNPOST_INSET,
      y: middle + SIGNPOST_SIDE_OFFSET,
    });
  });

  it('carries a crossing hard against one side of a whole edge to the same side of itself', () => {
    const crossed = edgeFraction({ edge: 'east' }, WORLD_W, PLAYER_HALF_EXTENT, WORLD_W, WORLD_H);
    expect(arrivalPoint(mouth, crossed, WORLD_W, WORLD_H, 96).y).toBe(side);
  });

  it('is the side of a zone an arrival on its edge comes in by', () => {
    const zone = { exits: [{ edge: 'north', to: 'town' } as const, mouth] };
    expect(sideOn(zone, 'west')).toBe(mouth);
    expect(sideOn(zone, 'south')).toEqual({ edge: 'south' });
  });
});

describe('zoneWorldSize', () => {
  it('measures a zone in pixels, not tiles', () => {
    const town = ZONES.town;
    expect(zoneWorldSize(town)).toEqual({
      width: nth(town.map, 0).length * TILE_SIZE,
      height: town.map.length * TILE_SIZE,
    });
  });

  it('agrees with what the exit math is handed for every zone', () => {
    Object.values(ZONES).forEach((zone) => {
      const { width, height } = zoneWorldSize(zone);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      // Rectangular maps only — arrivalPoint's fraction assumes one width.
      zone.map.forEach((row) => expect(row.length * TILE_SIZE).toBe(width));
    });
  });
});

describe('resumePoint', () => {
  const inset = TILE_SIZE * 1.5;

  it('puts a character back exactly where the save left them', () => {
    expect(resumePoint({ x: 700, y: 500 }, WORLD_W, WORLD_H, inset)).toEqual({ x: 700, y: 500 });
  });

  it('holds a spot from a since-shrunk map clear of the edge-walk band', () => {
    const resumed = resumePoint({ x: 3000, y: -40 }, WORLD_W, WORLD_H, inset);
    expect(resumed).toEqual({ x: WORLD_W - inset, y: inset });
    // Which is the point: landing in the band leaves for the next zone before
    // the player can move.
    const exits: ZoneExit[] = [
      { edge: 'east', to: 'beach' },
      { edge: 'north', to: 'beach' },
    ];
    expect(findExit(exits, resumed.x, resumed.y, WORLD_W, WORLD_H, TILE_SIZE * 0.6)).toBeNull();
  });

  it('survives a world smaller than two insets rather than inverting', () => {
    const tiny = TILE_SIZE;
    const resumed = resumePoint({ x: 0, y: 0 }, tiny, tiny, inset);
    expect(resumed).toEqual({ x: inset, y: inset });
  });
});

describe('ZONES data integrity', () => {
  const zones = Object.values(ZONES);

  it('every zone id matches its table key', () => {
    Object.entries(ZONES).forEach(([key, zone]) => expect(zone.id).toBe(key));
  });

  it('every exit leads to a defined zone, not back to itself', () => {
    zones.forEach((zone) => {
      zone.exits.forEach((exit) => {
        expect(ZONES[exit.to]).toBeDefined();
        expect(exit.to).not.toBe(zone.id);
      });
    });
  });

  it('every spawn references a defined enemy or node', () => {
    zones.forEach((zone) => {
      zone.mobSpawns.forEach((spawn) => expect(ENEMIES[spawn.enemyId]).toBeDefined());
      zone.nodeSpawns.forEach((spawn) => expect(RESOURCE_NODES[spawn.nodeId]).toBeDefined());
    });
  });

  /**
   * Spawn offsets are written against a map nobody has in front of them, and the
   * zones cut out of solid rock are where that goes wrong: a vein one row too far
   * north is a vein inside the quarry face — drawn in the wall, unreachable, and
   * never wandering out to prove it the way a misplaced rat would.
   *
   * The question is reachability rather than walkability, because a fishing spot
   * standing *on* blocking water is the whole design of one: what has to be true
   * is that there is somewhere to stand within the node's own interact radius.
   * That is the same rule for both kinds of node and needs no exception for
   * either.
   */
  it('leaves somewhere to stand within reach of every node', () => {
    zones.forEach((zone) => {
      zone.nodeSpawns.forEach(({ x: atX, y: atY, nodeId }) => {
        const { interactRadius } = RESOURCE_NODES[nodeId];
        const at = { x: atX, y: atY };
        const reachable = zone.map.some((row, y) =>
          row.some(
            (tile, x) =>
              !BLOCKING_TILES.includes(tile) &&
              Math.hypot(
                x * TILE_SIZE + TILE_SIZE / 2 - at.x,
                y * TILE_SIZE + TILE_SIZE / 2 - at.y,
              ) <= interactRadius,
          ),
        );
        expect(
          reachable,
          `${zone.id}: ${nodeId} at ${at.x},${at.y} has nowhere to work it from`,
        ).toBe(true);
      });
    });
  });

  // A mob, unlike a node, has to stand on the ground itself — nothing spawns
  // swimming or inside the rock.
  it('puts every mob spawn on walkable ground', () => {
    zones.forEach((zone) => {
      zone.mobSpawns.forEach(({ x, y, enemyId }) => {
        const row = nth(zone.map, Math.floor(y / TILE_SIZE));
        const tile = nth(row, Math.floor(x / TILE_SIZE));
        expect(BLOCKING_TILES, `${zone.id}: ${enemyId} at ${x},${y}`).not.toContain(tile);
      });
    });
  });

  // Where a character with no particular spot is put, which is the zone's `@`:
  // a start on rock would strand every new character and every death inside it.
  it('puts every zone start on walkable ground', () => {
    zones.forEach((zone) => {
      const row = nth(zone.map, Math.floor(zone.start.y / TILE_SIZE));
      expect(BLOCKING_TILES, zone.id).not.toContain(nth(row, Math.floor(zone.start.x / TILE_SIZE)));
    });
  });

  it('every map is a non-empty rectangular grid', () => {
    zones.forEach((zone) => {
      expect(zone.map.length).toBeGreaterThan(0);
      const width = nth(zone.map, 0).length;
      expect(width).toBeGreaterThan(0);
      zone.map.forEach((row) => expect(row.length).toBe(width));
    });
  });
});

describe('signpostPoint', () => {
  it('stands near its edge midpoint, nudged sideways off the arrival spot', () => {
    expect(signpostPoint({ edge: 'south' }, WORLD_W, WORLD_H)).toEqual({
      x: WORLD_W / 2 + SIGNPOST_SIDE_OFFSET,
      y: WORLD_H - SIGNPOST_INSET,
    });
    expect(signpostPoint({ edge: 'north' }, WORLD_W, WORLD_H)).toEqual({
      x: WORLD_W / 2 + SIGNPOST_SIDE_OFFSET,
      y: SIGNPOST_INSET,
    });
    expect(signpostPoint({ edge: 'west' }, WORLD_W, WORLD_H)).toEqual({
      x: SIGNPOST_INSET,
      y: WORLD_H / 2 + SIGNPOST_SIDE_OFFSET,
    });
    expect(signpostPoint({ edge: 'east' }, WORLD_W, WORLD_H)).toEqual({
      x: WORLD_W - SIGNPOST_INSET,
      y: WORLD_H / 2 + SIGNPOST_SIDE_OFFSET,
    });
  });

  it('sits clear of the arrival point but within tapping-then-walking reach', () => {
    const arrive = arrivalPoint({ edge: 'south' }, 0.5, WORLD_W, WORLD_H, 96);
    const post = signpostPoint({ edge: 'south' }, WORLD_W, WORLD_H);
    const gap = Math.hypot(arrive.x - post.x, arrive.y - post.y);
    expect(gap).toBeGreaterThan(30);
    expect(gap).toBeLessThan(SIGNPOST_INTERACT_RADIUS);
  });

  it('places every zone exit signpost on walkable ground', () => {
    Object.values(ZONES).forEach((zone) => {
      zone.exits.forEach((exit) => {
        const worldW = nth(zone.map, 0).length * TILE_SIZE;
        const worldH = zone.map.length * TILE_SIZE;
        const point = signpostPoint(exit, worldW, worldH);
        const row = nth(zone.map, Math.floor(point.y / TILE_SIZE));
        const tile = nth(row, Math.floor(point.x / TILE_SIZE));
        expect(BLOCKING_TILES).not.toContain(tile);
      });
    });
  });
});

/**
 * The generalisation of the signpost check above, and the one that matters more
 * for an interior map: a signpost stands at one spot per edge, but an *arrival*
 * lands anywhere along it — walking out of a zone keeps the fraction of the
 * edge it was crossed at, and the far side reproduces it.
 *
 * The bandit hideout is what made this worth writing. It is the first map built
 * out of solid rock rather than open ground, and its first draft had a doorway
 * only as tall as the corridor behind it: anyone crossing at any other height
 * arrived inside the wall.
 */
describe('arriving through an exit', () => {
  /**
   * The range a crossing can report runs over where a centre can cross, so 0
   * and 1 are the two ends of it, each half a body clear of whatever stands
   * either side of the mouth.
   */
  const FRACTIONS = [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1];

  it('lands on walkable ground wherever along the mouth it was crossed', () => {
    // Walked the way `leaveZone` does it: every exit in the table, arriving in
    // the zone it names by its exit on the opposite edge. An edge no exit leads
    // to is one nobody ever arrives on, so it is not asked about.
    for (const zone of Object.values(ZONES)) {
      for (const exit of zone.exits) {
        const destination = ZONES[exit.to];
        const worldW = nth(destination.map, 0).length * TILE_SIZE;
        const worldH = destination.map.length * TILE_SIZE;
        const side = sideOn(destination, oppositeEdge(exit.edge));

        for (const fraction of FRACTIONS) {
          const point = arrivalPoint(side, fraction, worldW, worldH, TILE_SIZE * 1.5);
          const row = nth(destination.map, Math.floor(point.y / TILE_SIZE));
          const tile = nth(row, Math.floor(point.x / TILE_SIZE));
          expect(
            BLOCKING_TILES,
            `${zone.id} -> ${exit.to}, arriving on its ${side.edge} edge at ${fraction}`,
          ).not.toContain(tile);
        }
      }
    }
  });

  /** A road goes both ways, and arrives by the exit back. */
  it('comes in by an exit leading back, on the opposite edge', () => {
    for (const zone of Object.values(ZONES)) {
      for (const exit of zone.exits) {
        const back = ZONES[exit.to].exits.find((other) => other.to === zone.id);
        expect(back?.edge, `${zone.id} -> ${exit.to} has no way back`).toBe(
          oppositeEdge(exit.edge),
        );
      }
    }
  });

  /**
   * A mouth is walked out of, so every tile of it on the edge itself is ground,
   * and it is wide enough that a body turns round in it (decision 119): the
   * corridor rule the hideout's first draft taught, two tiles and more.
   */
  it('opens every mouth on ground, inside its edge and wider than a corridor', () => {
    for (const zone of Object.values(ZONES)) {
      const cols = nth(zone.map, 0).length;
      const rows = zone.map.length;
      for (const exit of zone.exits) {
        if (!exit.mouth) continue;
        const [first, last] = exit.mouth;
        const length = exit.edge === 'north' || exit.edge === 'south' ? cols : rows;
        expect(first, `${zone.id}'s ${exit.edge} mouth`).toBeGreaterThanOrEqual(0);
        expect(last, `${zone.id}'s ${exit.edge} mouth`).toBeLessThan(length);
        expect(last - first + 1, `${zone.id}'s ${exit.edge} mouth`).toBeGreaterThanOrEqual(3);
        for (let along = first; along <= last; along++) {
          const [col, row] = {
            north: [along, 0],
            south: [along, rows - 1],
            west: [0, along],
            east: [cols - 1, along],
          }[exit.edge];
          expect(
            BLOCKING_TILES,
            `${zone.id}: the ${exit.edge} mouth is shut at tile ${along}`,
          ).not.toContain(nth(nth(zone.map, row), col));
        }
      }
    }
  });
});
