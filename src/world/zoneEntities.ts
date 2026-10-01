import { BUILDINGS, buildingWalls, type BuildingDefinition } from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { SECRETS } from '../data/secrets';
import { BLOCKING_TILES } from '../data/tiles';
import { ZONES, type ZoneDefinition, type ZoneExit } from '../data/zones';
import type { CollisionWorld } from '../systems/CollisionSystem';
import type { Point } from '../systems/MovementSystem';
import { signpostPoint } from '../systems/ZoneSystem';
import type { StationId } from '../data/recipes';
import type { NpcId, SecretId } from '../types/ids';
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
 * Something the zone hides (decision 117): where it lies, and which it is. Found
 * or not is the character's to say, so the same list serves either.
 */
export interface WorldSecret {
  x: number;
  y: number;
  secretId: SecretId;
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
  /** The zone's `@`: where a character with no particular spot stands. */
  spawnPoint: Point;
  mobs: Mob[];
  nodes: ResourceNode[];
  npcs: WorldNpc[];
  stations: WorldStation[];
  secrets: WorldSecret[];
  buildings: WorldBuilding[];
  signposts: WorldSignpost[];
  collisionWorld: CollisionWorld;
}

/**
 * A zone definition, read once into the things that live in it.
 *
 * Everything here is where the zone's text put it (`data/zoneText.ts`), and a
 * pure function of the definition and the rng: no clock, no events, nothing to
 * tear down.
 */
export function populateZone(
  zone: ZoneDefinition,
  size: { width: number; height: number },
  rng: () => number,
): ZoneEntities {
  const spawnPoint: Point = { ...zone.start };

  const mobs = zone.mobSpawns.map(
    ({ x, y, enemyId, level }) => new Mob(x, y, ENEMIES[enemyId], level, rng),
  );

  const nodes = zone.nodeSpawns.map(
    ({ x, y, nodeId }) => new ResourceNode(x, y, RESOURCE_NODES[nodeId]),
  );

  const npcs = zone.npcSpawns.map(({ x, y, npcId }) => ({ x, y, npcId }));

  const stations = zone.stationSpawns.map(({ x, y, station }) => ({ x, y, station }));

  const secrets = zone.secretSpawns.map(({ x, y, secretId }) => ({ x, y, secretId }));

  const buildings = zone.buildingSpawns.map(({ x, y, buildingId }) => ({
    x,
    y,
    definition: BUILDINGS[buildingId],
  }));

  // One tappable signpost per exit — the mobile way out of a zone.
  const signposts = zone.exits.map((exit) => {
    const point = signpostPoint(exit, size.width, size.height);
    return { x: point.x, y: point.y, exit, label: ZONES[exit.to].name };
  });

  return {
    spawnPoint,
    mobs,
    nodes,
    npcs,
    stations,
    secrets,
    buildings,
    signposts,
    // Nothing walks into the pond, a tree trunk or a wall. One description of
    // the world, which the player and every mob integrate themselves against.
    //
    // A building is a blocker rather than a painted-in run of `WALL_TILE`
    // because it is a shell with a door in it, and a tile is solid or not.
    // Blocking it here also keeps the footprint that stops you the same number
    // the prop is drawn from.
    collisionWorld: {
      grid: zone.map,
      blockingTiles: new Set(BLOCKING_TILES),
      worldWidth: size.width,
      worldHeight: size.height,
      blockers: [
        ...nodes
          .filter((node) => node.definition.blocks !== null)
          .map((node) => node.blockerRect()),
        // Walls rather than footprints: a building is a shell you can walk
        // into now, so what stops you is four wall slabs with a gap in one of
        // them. `buildingRect` is still the footprint — the map, the pick box
        // and the fade all want that — and these are the other question.
        ...buildings.flatMap(buildingWalls),
        // The one that stands up out of the ground, as a trunk does.
        ...secrets.flatMap(({ x, y, secretId }) => {
          const body = SECRETS[secretId].blocks;
          if (!body) return [];
          return [
            {
              left: x - body.width / 2,
              right: x + body.width / 2,
              top: y - body.height / 2,
              bottom: y + body.height / 2,
            },
          ];
        }),
      ],
    },
  };
}
