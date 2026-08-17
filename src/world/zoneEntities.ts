import { BUILDINGS, buildingRect, type BuildingDefinition } from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { BLOCKING_TILES } from '../data/tiles';
import { ZONES, type ZoneDefinition, type ZoneExit } from '../data/zones';
import type { CollisionWorld } from '../systems/CollisionSystem';
import type { Point } from '../systems/MovementSystem';
import { signpostPoint } from '../systems/ZoneSystem';
import type { StationId } from '../data/recipes';
import type { NpcId } from '../types/ids';
import { Mob } from './Mob';
import { ResourceNode } from './ResourceNode';

/** A stationary, non-combat NPC. All of them are shopkeepers today. */
export interface WorldNpc {
  x: number;
  y: number;
  npcId: NpcId;
}

/**
 * A crafting station that came with the zone, which is the forge and nothing
 * else so far. It is `Campfire`'s opposite half: fixed, always lit, and never
 * disposed of, where a fire is placed by the player and burns out.
 */
export interface WorldStation {
  x: number;
  y: number;
  station: StationId;
}

/**
 * A building standing in a zone. Solid, permanent, and the only thing here that
 * takes up an area rather than a point.
 *
 * It carries its definition the way a `ResourceNode` does rather than an id the
 * way a `WorldNpc` does, because everything that meets one asks about its
 * footprint: what stops the player, what hides them, and what a tap on the roof
 * means are all questions about how much room it takes up.
 */
export interface WorldBuilding {
  x: number;
  y: number;
  definition: BuildingDefinition;
}

/** A tappable exit marker — the mobile counterpart to walking into the edge. */
export interface WorldSignpost {
  x: number;
  y: number;
  exit: ZoneExit;
  label: string;
}

/** Everything a zone is populated with, before anything starts moving. */
export interface ZoneEntities {
  /** The middle of the map: where a character with no particular spot stands. */
  spawnPoint: Point;
  mobs: Mob[];
  nodes: ResourceNode[];
  npcs: WorldNpc[];
  stations: WorldStation[];
  buildings: WorldBuilding[];
  signposts: WorldSignpost[];
  collisionWorld: CollisionWorld;
}

/**
 * A zone definition, read once into the things that live in it.
 *
 * Spawns are offsets from the middle of the map rather than absolute
 * coordinates, so a zone's contents survive its map growing. Everything here is
 * a pure function of the definition and the rng — no clock, no events, nothing
 * to tear down.
 */
export function populateZone(
  zone: ZoneDefinition,
  size: { width: number; height: number },
  rng: () => number,
): ZoneEntities {
  const spawnPoint: Point = { x: size.width / 2, y: size.height / 2 };

  const mobs = zone.mobSpawns.map(
    ({ dx, dy, enemyId, level }) =>
      new Mob(spawnPoint.x + dx, spawnPoint.y + dy, ENEMIES[enemyId], level, rng),
  );

  const nodes = zone.nodeSpawns.map(
    ({ dx, dy, nodeId }) =>
      new ResourceNode(spawnPoint.x + dx, spawnPoint.y + dy, RESOURCE_NODES[nodeId]),
  );

  const npcs = zone.npcSpawns.map(({ dx, dy, npcId }) => ({
    x: spawnPoint.x + dx,
    y: spawnPoint.y + dy,
    npcId,
  }));

  const stations = (zone.stationSpawns ?? []).map(({ dx, dy, station }) => ({
    x: spawnPoint.x + dx,
    y: spawnPoint.y + dy,
    station,
  }));

  const buildings = (zone.buildingSpawns ?? []).map(({ dx, dy, buildingId }) => ({
    x: spawnPoint.x + dx,
    y: spawnPoint.y + dy,
    definition: BUILDINGS[buildingId],
  }));

  // One tappable signpost per exit — the mobile way out of a zone.
  const signposts = zone.exits.map((exit) => {
    const point = signpostPoint(exit.edge, size.width, size.height);
    return { x: point.x, y: point.y, exit, label: ZONES[exit.to].name };
  });

  return {
    spawnPoint,
    mobs,
    nodes,
    npcs,
    stations,
    buildings,
    signposts,
    // Nothing walks into the pond, a tree trunk or a wall. One description of
    // the world, which the player and every mob integrate themselves against.
    //
    // A building is a blocker rather than a painted-in run of `WALL_TILE`
    // because it is placed by offset from the middle of the map like everything
    // else in a zone, where the tile grid is written out in absolute rows — and
    // one of those two has to be the map's own. Blocking it here also keeps the
    // footprint that stops you the same number the prop is drawn from.
    collisionWorld: {
      grid: zone.map,
      blockingTiles: new Set(BLOCKING_TILES),
      worldWidth: size.width,
      worldHeight: size.height,
      blockers: [
        ...nodes
          .filter((node) => node.definition.blocks !== null)
          .map((node) => node.blockerRect()),
        ...buildings.map(buildingRect),
      ],
    },
  };
}
