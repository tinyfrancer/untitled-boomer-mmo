import { TILE_SIZE } from '../config/constants';
import type { BuildingId, EnemyId, NpcId, ResourceNodeId, SecretId } from '../types/ids';
import { BUILDINGS, counterPoint } from './buildings';
import type { StationId } from './recipes';
import {
  GRASS_TILE,
  MARSH_TILE,
  PATH_TILE,
  SAND_TILE,
  STONE_TILE,
  WALL_TILE,
  WATER_TILE,
} from './tiles';

/**
 * A zone written as text: one character a tile, the ground in characters every
 * zone shares and everything standing on it in markers of the zone's own
 * (decision 113).
 *
 * Version 2's zones are three times the area of version 1's (decision 86), and
 * at that size a zone painted in rectangles of code with its contents listed
 * as offsets from the middle of the map cannot be read, let alone laid out: a
 * rat twelve tiles east of a pond was a pair of numbers in one file and a
 * rectangle in another. Written as text, the zone is the picture of itself,
 * and what stands where is where it is drawn.
 *
 * Everything placed by a marker stands in the middle of its tile, and a
 * building is a block of its marker exactly the size of its footprint. The
 * people who work somewhere are not markers: they stand behind their counter,
 * which is `counterPoint` of the building the legend says they work in, so a
 * shopfront moved is a shopkeeper moved.
 */

/** The grounds, by the name a legend uses and the character every map writes them in. */
export const GROUNDS = {
  grass: { key: '.', tile: GRASS_TILE },
  road: { key: '=', tile: PATH_TILE },
  water: { key: '~', tile: WATER_TILE },
  sand: { key: ':', tile: SAND_TILE },
  stone: { key: '_', tile: STONE_TILE },
  rock: { key: '#', tile: WALL_TILE },
  marsh: { key: ',', tile: MARSH_TILE },
} as const;

export type GroundName = keyof typeof GROUNDS;

const GROUND_BY_KEY: ReadonlyMap<string, number> = new Map(
  Object.values(GROUNDS).map(({ key, tile }) => [key, tile]),
);

/** What a zone's own character stands for, and the ground under it. */
export type Marker =
  | { start: true; on: GroundName }
  | { mob: EnemyId; level: number; on: GroundName }
  | { node: ResourceNodeId; on: GroundName }
  | { station: StationId; on: GroundName }
  | { secret: SecretId; on: GroundName }
  | { building: BuildingId; worker?: NpcId; on: GroundName };

export type ZoneLegend = Readonly<Record<string, Marker>>;

export interface MobSpawnPoint {
  x: number;
  y: number;
  enemyId: EnemyId;
  level: number;
}

export interface NodeSpawnPoint {
  x: number;
  y: number;
  nodeId: ResourceNodeId;
}

export interface NpcSpawnPoint {
  x: number;
  y: number;
  npcId: NpcId;
}

export interface StationSpawnPoint {
  x: number;
  y: number;
  station: StationId;
}

/** Where a building stands, as the middle of its footprint. */
export interface BuildingSpawnPoint {
  x: number;
  y: number;
  buildingId: BuildingId;
}

export interface SecretSpawnPoint {
  x: number;
  y: number;
  secretId: SecretId;
}

/** Everything a zone's text says, in world pixels. */
export interface ZoneLayout {
  /** The ground, a row of tile ids a line. Its size is the zone's. */
  map: number[][];
  /** Where a character with nowhere better to be stands: the `@`. */
  start: { x: number; y: number };
  mobSpawns: MobSpawnPoint[];
  nodeSpawns: NodeSpawnPoint[];
  npcSpawns: NpcSpawnPoint[];
  /**
   * The fixed crafting stations. A campfire is not one: that is lit by the
   * player and burns out, so this is only what a zone comes with.
   */
  stationSpawns: StationSpawnPoint[];
  /**
   * What is built here: solid, permanent, and the only thing placed by how much
   * room it takes up rather than by a point alone, which is why nothing else in
   * a zone may stand inside one (`tests/systems/BuildingSystem.test.ts`).
   */
  buildingSpawns: BuildingSpawnPoint[];
  /** What the zone hides (`data/secrets.ts`), each drawn where it lies and on no map. */
  secretSpawns: SecretSpawnPoint[];
}

/** The rows of a block of text: blank lines at either end and the shared indent dropped. */
function rowsOf(text: string): string[] {
  const lines = text.split('\n');
  while (lines.length > 0 && lines[0]?.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent).trimEnd());
}

const middle = (cell: number): number => (cell + 0.5) * TILE_SIZE;

/**
 * Reads a zone's text and legend into its ground and everything placed on it,
 * or throws saying what is wrong with it: a zone that does not read is not a
 * zone the game can load, so it fails at the first import rather than in play.
 */
export function layoutZone(name: string, text: string, legend: ZoneLegend): ZoneLayout {
  const fail = (why: string): never => {
    throw new Error(`${name}: ${why}`);
  };
  for (const key of Object.keys(legend)) {
    if (key.length !== 1) fail(`the legend's '${key}' is not one character`);
    if (GROUND_BY_KEY.has(key)) fail(`the legend's '${key}' is a ground's character`);
  }

  const rows = rowsOf(text);
  const width = rows[0]?.length ?? 0;
  if (rows.length === 0 || width === 0) fail('has no rows');
  rows.forEach((row, y) => {
    if (row.length !== width) fail(`row ${y} is ${row.length} wide, not ${width}`);
  });

  const map = rows.map((row, y) =>
    [...row].map((key, x) => {
      const ground = GROUND_BY_KEY.get(key);
      if (ground !== undefined) return ground;
      const marker = legend[key];
      if (!marker) return fail(`'${key}' at ${x},${y} is neither a ground nor in the legend`);
      return GROUNDS[marker.on].tile;
    }),
  );

  const layout: ZoneLayout = {
    map,
    start: { x: 0, y: 0 },
    mobSpawns: [],
    nodeSpawns: [],
    npcSpawns: [],
    stationSpawns: [],
    buildingSpawns: [],
    secretSpawns: [],
  };
  let starts = 0;
  const claimed = rows.map((row) => [...row].map(() => false));

  rows.forEach((row, y) => {
    [...row].forEach((key, x) => {
      const marker = legend[key];
      if (!marker || claimed[y]?.[x]) return;
      if ('start' in marker) {
        starts += 1;
        layout.start = { x: middle(x), y: middle(y) };
      } else if ('mob' in marker) {
        layout.mobSpawns.push({
          x: middle(x),
          y: middle(y),
          enemyId: marker.mob,
          level: marker.level,
        });
      } else if ('node' in marker) {
        layout.nodeSpawns.push({ x: middle(x), y: middle(y), nodeId: marker.node });
      } else if ('station' in marker) {
        layout.stationSpawns.push({ x: middle(x), y: middle(y), station: marker.station });
      } else if ('secret' in marker) {
        layout.secretSpawns.push({ x: middle(x), y: middle(y), secretId: marker.secret });
      } else {
        placeBuilding(marker, key, x, y);
      }
    });
  });

  /**
   * A building is the block of its marker at this corner, which has to be a
   * filled rectangle exactly its footprint: a block the wrong size is a
   * building drawn one size and walked into as another.
   */
  function placeBuilding(
    marker: Extract<Marker, { building: BuildingId }>,
    key: string,
    left: number,
    top: number,
  ): void {
    const definition = BUILDINGS[marker.building];
    const across = definition.body.width / TILE_SIZE;
    const down = definition.body.height / TILE_SIZE;
    for (let y = top; y < top + down; y += 1) {
      for (let x = left; x < left + across; x += 1) {
        if (rows[y]?.[x] !== key || claimed[y]?.[x]) {
          fail(`${marker.building} at ${left},${top} is not a ${across}×${down} block of '${key}'`);
        }
        const line = claimed[y];
        if (line) line[x] = true;
      }
    }
    // A block of the same marker running on past the footprint is two buildings
    // touching, which no footprint can tell apart from one building too big.
    const spills =
      rows[top + down]?.slice(left, left + across).includes(key) ||
      rows.slice(top, top + down).some((line) => line[left + across] === key);
    if (spills) fail(`${marker.building} at ${left},${top} runs on past its ${across}×${down}`);

    const standing = {
      x: (left + across / 2) * TILE_SIZE,
      y: (top + down / 2) * TILE_SIZE,
      definition,
    };
    layout.buildingSpawns.push({ x: standing.x, y: standing.y, buildingId: marker.building });
    if (marker.worker) layout.npcSpawns.push({ ...counterPoint(standing), npcId: marker.worker });
  }

  if (starts !== 1) fail(`has ${starts} starts rather than one`);
  // A key nothing on the map uses is a thing somebody meant to place and did
  // not, which the game would otherwise go on without saying so.
  for (const key of Object.keys(legend)) {
    if (!rows.some((row) => row.includes(key))) fail(`the legend's '${key}' is on no tile`);
  }
  return layout;
}
