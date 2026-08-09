import { TILE_SIZE } from '../config/constants';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { ZONES } from '../data/zones';
import { signpostPoint, zoneWorldSize } from './ZoneSystem';
import type { NpcId, SkillId, ZoneId } from '../types/ids';

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

// The only NPC there is. Named here rather than reached for from the renderer,
// which holds the same string for the plate over their head: what a shopkeeper
// is called is a decision the whole game makes.
const NPC_NAMES: Record<NpcId, string> = { shopkeeper: 'Shopkeeper' };

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
      label: NPC_NAMES[npcId],
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
