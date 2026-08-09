import { describe, expect, it } from 'vitest';
import {
  terrainBands,
  tileOf,
  toTile,
  worldMap,
  zoneLevels,
  zoneMap,
} from '../../src/systems/MapSystem';
import { TILE_SIZE, WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../../src/config/constants';
import { ZONES } from '../../src/data/zones';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { zoneWorldSize } from '../../src/systems/ZoneSystem';
import type { ZoneId } from '../../src/types/ids';

const ZONE_IDS = Object.keys(ZONES) as ZoneId[];

describe('placing a world point on the map', () => {
  it('measures in tiles, fractionally', () => {
    expect(toTile(TILE_SIZE * 3, TILE_SIZE * 1.5)).toEqual({ x: 3, y: 1.5 });
  });

  it('names the whole tile a point is standing in', () => {
    expect(tileOf(TILE_SIZE * 3.9, TILE_SIZE * 0.1)).toEqual({ x: 3, y: 0 });
  });
});

/**
 * Terrain is banded rather than drawn a tile at a time. A zone is 475 tiles and
 * mostly one colour, so this is what keeps the sheet from holding a rectangle
 * for every one of them — and it is arithmetic, so it is checked here rather
 * than by counting nodes in a browser.
 */
describe('terrainBands', () => {
  it('runs identical tiles together and breaks on a change', () => {
    expect(terrainBands([[0, 0, 0, 1, 1, 0]])).toEqual([
      { x: 0, y: 0, width: 3, tile: 0 },
      { x: 3, y: 0, width: 2, tile: 1 },
      { x: 5, y: 0, width: 1, tile: 0 },
    ]);
  });

  it('never runs a band across the end of a row', () => {
    const bands = terrainBands([
      [0, 0],
      [0, 0],
    ]);
    expect(bands).toEqual([
      { x: 0, y: 0, width: 2, tile: 0 },
      { x: 0, y: 1, width: 2, tile: 0 },
    ]);
  });

  it('covers every tile it was given exactly once', () => {
    for (const zoneId of ZONE_IDS) {
      const { map } = ZONES[zoneId];
      const covered = terrainBands(map).reduce((total, band) => total + band.width, 0);
      expect(covered).toBe(map.length * (map[0]?.length ?? 0));
    }
  });

  it('is worth doing: a real zone bands to a fraction of its tiles', () => {
    const bands = terrainBands(ZONES.town.map);
    expect(bands.length).toBeLessThan((WORLD_WIDTH_TILES * WORLD_HEIGHT_TILES) / 3);
  });

  it('holds a band’s colour to the tile it came from', () => {
    const map = ZONES.beach.map;
    for (const band of terrainBands(map)) {
      expect(map[band.y]?.[band.x]).toBe(band.tile);
    }
  });
});

describe('zoneMap', () => {
  it('is drawn from the zone id alone, at the size the world is built at', () => {
    const map = zoneMap('town');
    expect(map.name).toBe('Town');
    expect(map.columns).toBe(WORLD_WIDTH_TILES);
    expect(map.rows).toBe(WORLD_HEIGHT_TILES);
  });

  /**
   * The point of reading it off the same tables: a marker on the map has to be
   * where the world actually puts the thing, and `populateZone` places a spawn
   * at the middle of the map plus its offset.
   */
  it('puts a marker where the world puts the thing it stands for', () => {
    const zone = ZONES.town;
    const size = zoneWorldSize(zone);
    const spawn = zone.nodeSpawns[0];
    if (!spawn) throw new Error('town has no nodes');

    const marker = zoneMap('town').markers.find(
      (candidate) =>
        candidate.kind === 'node' && candidate.label === RESOURCE_NODES[spawn.nodeId].name,
    );

    expect(marker).toMatchObject(toTile(size.width / 2 + spawn.dx, size.height / 2 + spawn.dy));
  });

  it('marks the shopkeeper and every node the zone holds', () => {
    const map = zoneMap('town');
    expect(map.markers.filter((marker) => marker.kind === 'npc')).toHaveLength(1);
    expect(map.markers.filter((marker) => marker.kind === 'node')).toHaveLength(
      ZONES.town.nodeSpawns.length,
    );
  });

  // What a signpost is *for* is where it goes, so that is what the map says.
  it('names an exit by its destination rather than by its edge', () => {
    const exits = zoneMap('town').markers.filter((marker) => marker.kind === 'exit');
    expect(exits.map((exit) => exit.label).sort()).toEqual(['Bandit Camp', 'Beach']);
  });

  /**
   * Mobs are deliberately absent: they wander, so drawing them means feeding a
   * moving position to the HUD every frame, and a map of where the rats were a
   * second ago is worse than a map with no rats on it.
   */
  it('leaves the mobs off, even in a zone that is nothing but mobs', () => {
    const map = zoneMap('bandit-camp');
    expect(ZONES['bandit-camp'].mobSpawns.length).toBeGreaterThan(0);
    expect(map.markers.every((marker) => marker.kind === 'exit')).toBe(true);
  });

  it('keeps every marker inside the map it is drawn on', () => {
    for (const zoneId of ZONE_IDS) {
      const map = zoneMap(zoneId);
      for (const marker of map.markers) {
        expect(marker.x).toBeGreaterThanOrEqual(0);
        expect(marker.y).toBeGreaterThanOrEqual(0);
        expect(marker.x).toBeLessThanOrEqual(map.columns);
        expect(marker.y).toBeLessThanOrEqual(map.rows);
      }
    }
  });

  it('draws every zone there is', () => {
    for (const zoneId of ZONE_IDS) {
      const map = zoneMap(zoneId);
      expect(map.terrain.length).toBeGreaterThan(0);
      expect(map.markers.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The zoomed-out view. Its whole layout is derived from the exits already in
 * `ZONES` — nothing is hand-placed — so what is worth asserting is that the
 * derivation agrees with where walking actually takes you.
 */
describe('worldMap', () => {
  it('places a zone in the direction the edge that reaches it points', () => {
    const map = worldMap();
    const at = (zoneId: ZoneId) => map.zones.find((zone) => zone.zoneId === zoneId);
    const town = at('town');
    const beach = at('beach');
    const camp = at('bandit-camp');
    if (!town || !beach || !camp) throw new Error('a zone went missing from the map');

    // Town's exits are south to the beach and east to the bandit camp.
    expect(beach.row).toBe(town.row + 1);
    expect(beach.column).toBe(town.column);
    expect(camp.column).toBe(town.column + 1);
    expect(camp.row).toBe(town.row);
  });

  it('reaches every zone that is connected to the world', () => {
    expect(
      worldMap()
        .zones.map((zone) => zone.zoneId)
        .sort(),
    ).toEqual(ZONE_IDS.sort());
  });

  it('never stacks two zones on the same cell', () => {
    const cells = worldMap().zones.map((zone) => `${zone.column},${zone.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('keeps every zone inside the grid it reports', () => {
    const map = worldMap();
    for (const zone of map.zones) {
      expect(zone.column).toBeGreaterThanOrEqual(0);
      expect(zone.row).toBeGreaterThanOrEqual(0);
      expect(zone.column).toBeLessThan(map.columns);
      expect(zone.row).toBeLessThan(map.rows);
    }
  });

  // One road per pair however many ways it can be walked: town→beach and
  // beach→town are the same road, and drawing it twice would double its ink.
  it('names each road once rather than once per direction', () => {
    const links = worldMap().links;
    const pairs = links.map((link) => [link.from, link.to].sort().join('-'));
    expect(new Set(pairs).size).toBe(links.length);
    // One per connected pair in the table, however many zones there are.
    const wired = new Set(
      Object.values(ZONES).flatMap((zone) =>
        zone.exits.map((exit) => [zone.id, exit.to].sort().join('-')),
      ),
    );
    expect(links).toHaveLength(wired.size);
  });

  it('carries what each zone is for, so the map can say more than its name', () => {
    for (const zone of worldMap().zones) {
      expect(zone.name.length).toBeGreaterThan(0);
      expect(zone.description.length).toBeGreaterThan(0);
    }
  });
});

describe('zoneLevels', () => {
  it('reports the band a zone spawns, off its own table', () => {
    const town = zoneLevels('town');
    const levels = ZONES.town.mobSpawns.map((spawn) => spawn.level);
    expect(town).toEqual({ min: Math.min(...levels), max: Math.max(...levels) });
  });

  it('answers null for a zone nothing lives in', () => {
    expect(zoneLevels('beach')).not.toBeNull();
    // A zone with no mob spawns has no band to report, and "Lv 0-0" would be a
    // lie rather than an absence.
    const empty = ZONE_IDS.filter((id) => ZONES[id].mobSpawns.length === 0);
    for (const id of empty) expect(zoneLevels(id)).toBeNull();
  });
});
