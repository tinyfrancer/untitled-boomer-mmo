import { describe, expect, it } from 'vitest';
import {
  MINIMAP_REACH,
  MINIMAP_TILES,
  minimapOrigin,
  onMinimapRim,
  secretsFound,
  terrainBands,
  tileOf,
  toTile,
  worldMap,
  zoneLevels,
  zoneMap,
} from '../../src/systems/MapSystem';
import { TILE_SIZE } from '../../src/config/constants';
import { ZONES } from '../../src/data/zones';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { BUILDINGS } from '../../src/data/buildings';
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

/** The minimap's window onto the zone map (decision 115). */
describe('the minimap window', () => {
  it('puts the player in the middle of it, on a whole pixel', () => {
    const origin = minimapOrigin({ x: 10.3, y: 7.9 }, 4);
    expect(origin.x + MINIMAP_TILES / 2).toBeCloseTo(10.3, 0);
    expect(origin.y + MINIMAP_TILES / 2).toBeCloseTo(7.9, 0);
    expect(Number.isInteger(origin.x * 4)).toBe(true);
    expect(Number.isInteger(origin.y * 4)).toBe(true);
  });

  it('reaches a creature standing anywhere in the window', () => {
    expect(MINIMAP_REACH).toBeGreaterThanOrEqual(MINIMAP_TILES / 2);
  });

  it('draws a point in the window where it is', () => {
    expect(onMinimapRim({ x: 14, y: 3 }, { x: 10, y: 10 }, 1)).toEqual({
      x: 14,
      y: 3,
      onRim: false,
    });
  });

  it('draws a point off the window on its rim, in its direction', () => {
    const center = { x: 10, y: 10 };
    const half = MINIMAP_TILES / 2 - 1;

    const east = onMinimapRim({ x: 60, y: 10 }, center, 1);
    expect(east).toEqual({ x: center.x + half, y: 10, onRim: true });

    // Along the line to it, so a road off the corner is drawn toward the corner.
    const southWest = onMinimapRim({ x: -40, y: 60 }, center, 1);
    expect(southWest.onRim).toBe(true);
    expect(southWest.x).toBeCloseTo(center.x - half);
    expect(southWest.y).toBeCloseTo(center.y + half);
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
    const { map } = ZONES.town;
    const bands = terrainBands(map);
    expect(bands.length).toBeLessThan((map.length * (map[0]?.length ?? 0)) / 3);
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
    const size = zoneWorldSize(ZONES.town);
    expect(map.name).toBe('Lampton');
    expect(map.columns).toBe(size.width / TILE_SIZE);
    expect(map.rows).toBe(size.height / TILE_SIZE);
  });

  /**
   * The point of reading it off the same tables: a marker on the map has to be
   * where the world actually puts the thing, which is where the zone's text
   * drew it.
   */
  it('puts a marker where the world puts the thing it stands for', () => {
    const spawn = ZONES.town.nodeSpawns[0];
    if (!spawn) throw new Error('town has no nodes');

    const marker = zoneMap('town').markers.find(
      (candidate) =>
        candidate.kind === 'node' && candidate.label === RESOURCE_NODES[spawn.nodeId].name,
    );

    expect(marker).toMatchObject(toTile(spawn.x, spawn.y));
  });

  /**
   * A building is the one thing on the map that is an area rather than a point,
   * and the useful fact about it is the room it takes up: the *shape* of a town
   * is what makes a map of one worth opening. Read off the same table
   * `populateZone` reads, so the map cannot disagree with where the walls are.
   */
  it('draws a footprint where the world puts each building', () => {
    const zone = ZONES.town;
    const spawn = zone.buildingSpawns[0];
    if (!spawn) throw new Error('town has no buildings');
    const { body, name } = BUILDINGS[spawn.buildingId];

    const drawn = zoneMap('town').buildings;
    expect(drawn).toHaveLength(zone.buildingSpawns.length);
    expect(drawn[0]).toEqual({
      ...toTile(spawn.x - body.width / 2, spawn.y - body.height / 2),
      width: body.width / TILE_SIZE,
      height: body.height / TILE_SIZE,
      label: name,
    });
  });

  // A zone with nothing built on it says so with an empty list rather than with
  // an absent field, so the sheet needs no case for the four zones out of five
  // that have no walls in them.
  it('draws no footprints in a zone nobody has built in', () => {
    expect(zoneMap('beach').buildings).toEqual([]);
  });

  it('marks everyone standing in the zone and every node it holds', () => {
    const map = zoneMap('town');
    // Counted off the table rather than written down, so the next counter to
    // open in town appears on the map with no test to edit.
    expect(map.markers.filter((marker) => marker.kind === 'npc')).toHaveLength(
      ZONES.town.npcSpawns.length,
    );
    expect(map.markers.filter((marker) => marker.kind === 'node')).toHaveLength(
      ZONES.town.nodeSpawns.length,
    );
  });

  // What a signpost is *for* is where it goes, so that is what the map says.
  it('names an exit by its destination rather than by its edge', () => {
    const exits = zoneMap('town').markers.filter((marker) => marker.kind === 'exit');
    expect(exits.map((exit) => exit.label).sort()).toEqual(
      ZONES.town.exits.map((exit) => ZONES[exit.to].name).sort(),
    );
    // Which is only worth asserting because a name is not an edge: nothing on
    // the map says "south".
    expect(exits.map((exit) => exit.label)).not.toContain('south');
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

describe('secretsFound', () => {
  // Decision 117: where a secret lies is on no map, and the zone map says only
  // how many of the zone's own are found.
  it("counts only the zone's own, found or not", () => {
    expect(secretsFound('town', [])).toEqual({ found: 0, total: 2 });
    expect(secretsFound('town', ['lamp-stone', 'warden-niche'])).toEqual({ found: 1, total: 2 });
  });

  it('says nothing for a zone that hides none', () => {
    expect(secretsFound('deep-cut', ['lamp-stone'])).toBeNull();
  });
});
