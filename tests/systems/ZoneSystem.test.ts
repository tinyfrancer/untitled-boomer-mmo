import { describe, expect, it } from 'vitest';
import {
  SIGNPOST_INSET,
  SIGNPOST_INTERACT_RADIUS,
  SIGNPOST_SIDE_OFFSET,
  arrivalPoint,
  edgeFraction,
  findExit,
  oppositeEdge,
  signpostPoint,
} from '../../src/systems/ZoneSystem';
import { TILE_SIZE } from '../../src/config/constants';
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
  it('measures along x for horizontal edges and y for vertical ones', () => {
    expect(edgeFraction('south', 400, WORLD_H, WORLD_W, WORLD_H)).toBeCloseTo(0.25);
    expect(edgeFraction('north', 1200, 0, WORLD_W, WORLD_H)).toBeCloseTo(0.75);
    expect(edgeFraction('east', WORLD_W, 304, WORLD_W, WORLD_H)).toBeCloseTo(0.25);
  });

  it('clamps to 0..1 even if the position overshoots the world', () => {
    expect(edgeFraction('south', -50, WORLD_H, WORLD_W, WORLD_H)).toBe(0);
    expect(edgeFraction('south', WORLD_W + 50, WORLD_H, WORLD_W, WORLD_H)).toBe(1);
  });
});

describe('arrivalPoint', () => {
  it('places the player inset from the entry edge at the carried fraction', () => {
    expect(arrivalPoint('north', 0.25, WORLD_W, WORLD_H, 96)).toEqual({ x: 400, y: 96 });
    expect(arrivalPoint('south', 0.5, WORLD_W, WORLD_H, 96)).toEqual({
      x: 800,
      y: WORLD_H - 96,
    });
    expect(arrivalPoint('west', 0.5, WORLD_W, WORLD_H, 96)).toEqual({ x: 96, y: 608 });
    expect(arrivalPoint('east', 0.5, WORLD_W, WORLD_H, 96)).toEqual({
      x: WORLD_W - 96,
      y: 608,
    });
  });

  it('round-trips with findExit: an arrival never stands on the return exit', () => {
    const margin = 38;
    const inset = 96;
    const back: ZoneExit[] = [{ edge: 'north', to: 'town' }];
    const arrive = arrivalPoint('north', 0.5, WORLD_W, WORLD_H, inset);
    expect(findExit(back, arrive.x, arrive.y, WORLD_W, WORLD_H, margin)).toBeNull();
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

  it('every map is a non-empty rectangular grid', () => {
    zones.forEach((zone) => {
      expect(zone.map.length).toBeGreaterThan(0);
      const width = zone.map[0].length;
      expect(width).toBeGreaterThan(0);
      zone.map.forEach((row) => expect(row.length).toBe(width));
    });
  });
});

describe('signpostPoint', () => {
  it('stands near its edge midpoint, nudged sideways off the arrival spot', () => {
    expect(signpostPoint('south', WORLD_W, WORLD_H)).toEqual({
      x: WORLD_W / 2 + SIGNPOST_SIDE_OFFSET,
      y: WORLD_H - SIGNPOST_INSET,
    });
    expect(signpostPoint('north', WORLD_W, WORLD_H)).toEqual({
      x: WORLD_W / 2 + SIGNPOST_SIDE_OFFSET,
      y: SIGNPOST_INSET,
    });
    expect(signpostPoint('west', WORLD_W, WORLD_H)).toEqual({
      x: SIGNPOST_INSET,
      y: WORLD_H / 2 + SIGNPOST_SIDE_OFFSET,
    });
    expect(signpostPoint('east', WORLD_W, WORLD_H)).toEqual({
      x: WORLD_W - SIGNPOST_INSET,
      y: WORLD_H / 2 + SIGNPOST_SIDE_OFFSET,
    });
  });

  it('sits clear of the arrival point but within tapping-then-walking reach', () => {
    const arrive = arrivalPoint('south', 0.5, WORLD_W, WORLD_H, 96);
    const post = signpostPoint('south', WORLD_W, WORLD_H);
    const gap = Math.hypot(arrive.x - post.x, arrive.y - post.y);
    expect(gap).toBeGreaterThan(30);
    expect(gap).toBeLessThan(SIGNPOST_INTERACT_RADIUS);
  });

  it('places every zone exit signpost on walkable ground', () => {
    Object.values(ZONES).forEach((zone) => {
      zone.exits.forEach((exit) => {
        const worldW = zone.map[0].length * TILE_SIZE;
        const worldH = zone.map.length * TILE_SIZE;
        const point = signpostPoint(exit.edge, worldW, worldH);
        const tile = zone.map[Math.floor(point.y / TILE_SIZE)][Math.floor(point.x / TILE_SIZE)];
        expect(BLOCKING_TILES).not.toContain(tile);
      });
    });
  });
});
