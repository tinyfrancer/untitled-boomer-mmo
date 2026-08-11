import { TILE_SIZE } from '../config/constants';
import { npcName } from '../data/npcs';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { ZONES } from '../data/zones';
import { signpostPoint, zoneWorldSize } from './ZoneSystem';
import type { SkillId, ZoneEdge, ZoneId } from '../types/ids';

/** What a marker stands for, which is the whole of how it is drawn. */
export type MapMarkerKind = 'node' | 'npc' | 'exit';

export interface MapMarker {
  kind: MapMarkerKind;
  /** In tiles, fractional: the middle of the thing it stands for. */
  x: number;
  y: number;
  /** What it is. An exit names where it goes rather than what it is. */
  label: string;
  /**
   * Which skill works it, for the nodes. What tells a tree from a fishing spot
   * at this size is the colour, and the colour is the drawing's decision — so
   * this carries the fact and not the shade.
   */
  skill: SkillId | null;
}

/**
 * A run of identical tiles along one row, which is what the terrain is drawn
 * as. A 25x19 zone is 475 tiles and mostly one colour, so banding it cuts the
 * drawn rectangles to a fraction of that without the sheet knowing anything
 * about terrain.
 */
export interface TerrainBand {
  x: number;
  y: number;
  width: number;
  tile: number;
}

export interface ZoneMap {
  zoneId: ZoneId;
  name: string;
  columns: number;
  rows: number;
  terrain: TerrainBand[];
  markers: MapMarker[];
}

/** Where a world point falls on the map. Fractional — a dot is not on a grid. */
export function toTile(x: number, y: number): { x: number; y: number } {
  return { x: x / TILE_SIZE, y: y / TILE_SIZE };
}

/** Which whole tile a world point is standing in. */
export function tileOf(x: number, y: number): { x: number; y: number } {
  return { x: Math.floor(x / TILE_SIZE), y: Math.floor(y / TILE_SIZE) };
}

export function terrainBands(tiles: number[][]): TerrainBand[] {
  const bands: TerrainBand[] = [];
  tiles.forEach((row, y) => {
    let start = 0;
    for (let x = 1; x <= row.length; x += 1) {
      // A row ends a band as surely as a different tile does.
      if (x < row.length && row[x] === row[start]) continue;
      bands.push({ x: start, y, width: x - start, tile: row[start] ?? 0 });
      start = x;
    }
  });
  return bands;
}

/**
 * Everything about a zone that can be drawn without the world running.
 *
 * All of it is a pure function of the zone definition, which is what lets the
 * HUD draw a map having been told nothing but the zone's id: the spawn offsets
 * are read with the same arithmetic `populateZone` uses, so the map cannot
 * disagree with where things actually stand.
 *
 * Mobs are deliberately absent. They wander, so drawing them means a per-frame
 * channel into the HUD — and a map of where the rats were a second ago is worse
 * than a map with no rats on it.
 */
export function zoneMap(zoneId: ZoneId): ZoneMap {
  const zone = ZONES[zoneId];
  const size = zoneWorldSize(zone);
  const centre = { x: size.width / 2, y: size.height / 2 };
  const markers: MapMarker[] = [];

  for (const { dx, dy, nodeId } of zone.nodeSpawns) {
    const node = RESOURCE_NODES[nodeId];
    markers.push({
      kind: 'node',
      ...toTile(centre.x + dx, centre.y + dy),
      label: node.name,
      skill: node.skill,
    });
  }
  for (const { dx, dy, npcId } of zone.npcSpawns) {
    markers.push({
      kind: 'npc',
      ...toTile(centre.x + dx, centre.y + dy),
      label: npcName(npcId),
      skill: null,
    });
  }
  for (const exit of zone.exits) {
    const point = signpostPoint(exit.edge, size.width, size.height);
    markers.push({
      kind: 'exit',
      ...toTile(point.x, point.y),
      // Where it goes, not what it is: "Beach" is the useful half of a signpost.
      label: ZONES[exit.to].name,
      skill: null,
    });
  }

  return {
    zoneId,
    name: zone.name,
    columns: zone.map[0]?.length ?? 0,
    rows: zone.map.length,
    terrain: terrainBands(zone.map),
    markers,
  };
}

/** One zone as the zoomed-out view draws it: a cell on a grid of zones. */
export interface WorldMapZone {
  zoneId: ZoneId;
  name: string;
  description: string;
  /** Where it sits on the world grid, derived from the edges that reach it. */
  column: number;
  row: number;
  /** The band its spawns sit in, or null for a zone nothing lives in. */
  levels: { min: number; max: number } | null;
}

/** A road between two zones, named once rather than once per direction. */
export interface WorldMapLink {
  from: ZoneId;
  to: ZoneId;
}

export interface WorldMap {
  zones: WorldMapZone[];
  links: WorldMapLink[];
  columns: number;
  rows: number;
}

// Which way each edge moves you on the world grid. A zone reached by walking
// off the south edge is drawn below the one you left, which is the only
// arrangement that agrees with what walking actually does.
const EDGE_STEP: Record<ZoneEdge, { column: number; row: number }> = {
  north: { column: 0, row: -1 },
  south: { column: 0, row: 1 },
  west: { column: -1, row: 0 },
  east: { column: 1, row: 0 },
};

/** The band a zone's spawns sit in, which is what makes it worth visiting or not. */
export function zoneLevels(zoneId: ZoneId): { min: number; max: number } | null {
  const levels = ZONES[zoneId].mobSpawns.map((spawn) => spawn.level);
  if (levels.length === 0) {
    return null;
  }
  return { min: Math.min(...levels), max: Math.max(...levels) };
}

/**
 * Every zone and how they join up, laid out for the zoomed-out map.
 *
 * The layout is **derived from the exits**, walked breadth-first from the
 * starting town and placing each zone one step from its neighbour in the
 * direction the edge that reaches it points. Nothing is hand-placed, so a
 * coordinate cannot drift out of step with where walking actually takes you,
 * and a zone added to `ZONES` with its exits wired appears on the map with
 * nothing else written down.
 *
 * A zone no exit reaches would be unreachable in play, so it is left off rather
 * than parked in a corner of the map pretending otherwise.
 */
export function worldMap(root: ZoneId = 'town'): WorldMap {
  const placed = new Map<ZoneId, { column: number; row: number }>([[root, { column: 0, row: 0 }]]);
  const links: WorldMapLink[] = [];
  const seen = new Set<string>();
  const queue: ZoneId[] = [root];

  while (queue.length > 0) {
    const zoneId = queue.shift();
    if (!zoneId) break;
    const at = placed.get(zoneId);
    if (!at) continue;

    for (const exit of ZONES[zoneId].exits) {
      // One road per pair, whichever end of it is walked first.
      const key = [zoneId, exit.to].sort().join('->');
      if (!seen.has(key)) {
        seen.add(key);
        links.push({ from: zoneId, to: exit.to });
      }
      if (placed.has(exit.to)) continue;
      const step = EDGE_STEP[exit.edge];
      placed.set(exit.to, { column: at.column + step.column, row: at.row + step.row });
      queue.push(exit.to);
    }
  }

  // Shifted so the top-left of whatever was reached is the origin: the root
  // being (0,0) is an implementation detail, not a corner of the map.
  const columns = [...placed.values()].map((cell) => cell.column);
  const rows = [...placed.values()].map((cell) => cell.row);
  const left = Math.min(...columns);
  const top = Math.min(...rows);

  return {
    zones: [...placed.entries()].map(([zoneId, cell]) => ({
      zoneId,
      name: ZONES[zoneId].name,
      description: ZONES[zoneId].description,
      column: cell.column - left,
      row: cell.row - top,
      levels: zoneLevels(zoneId),
    })),
    links,
    columns: Math.max(...columns) - left + 1,
    rows: Math.max(...rows) - top + 1,
  };
}
