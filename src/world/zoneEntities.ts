import {
  BUILDINGS,
  buildingWalls,
  doorPlug,
  isInside,
  type BuildingDefinition,
  type Rect,
} from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import {
  HOUSE_BUILDING,
  HOUSE_FIXTURES,
  HOUSE_YARD,
  SHUT_UNTIL,
  fixtureAccess,
  fixturePoint,
  type HouseFixture,
} from '../data/house';
import type { HouseUpgradeId } from '../types/ids';
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
  /**
   * The building whose room it lies in, if it lies in one (decision 120): it
   * is found from inside that room and nowhere else, since a wall is a quarter
   * of a tile and the reach would otherwise find it from the lane behind.
   */
  room: WorldBuilding | null;
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

/**
 * Something in the house a tap lands on (F1): a stand, the chest or the wall,
 * where `data/house.ts` stands it in the house's room. Not a blocker, as
 * nothing in a room is.
 */
export interface WorldFixture {
  x: number;
  y: number;
  fixture: HouseFixture;
  /** The ground it covers against its wall, in world pixels: its foot is the bottom edge. */
  area: Rect;
  /** Where a body stands to use it, which is what the walk up to it is aimed at. */
  access: Point;
  house: WorldBuilding;
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
  fixtures: WorldFixture[];
  signposts: WorldSignpost[];
  collisionWorld: CollisionWorld;
  /**
   * What stands in the doorway of each room shut until a stage of the house
   * is built (F2), keyed by the stage: a blocker in `collisionWorld` until then,
   * taken out of it when the stage is bought.
   */
  doorPlugs: Map<HouseUpgradeId, Rect[]>;
}

/**
 * What one stage of the house puts on the lot (F2), or what the house is let
 * with when `upgrade` is null: its fixtures, and the yard's beds and bench,
 * wherever the house stands. Placed off the buildings rather than written into
 * the zone's text, so moving the house moves all of it.
 */
export function houseEntities(
  buildings: readonly WorldBuilding[],
  upgrade: HouseUpgradeId | null,
): { fixtures: WorldFixture[]; nodes: ResourceNode[]; stations: WorldStation[] } {
  const fixtures = HOUSE_FIXTURES.filter(
    (placement) => (placement.upgrade ?? null) === upgrade,
  ).flatMap((placement) =>
    buildings
      .filter((building) => building.definition.id === placement.building)
      .map((room) => ({
        ...fixturePoint(room, placement),
        fixture: placement.fixture,
        area: {
          left: room.x + placement.rect.left,
          right: room.x + placement.rect.right,
          top: room.y + placement.rect.top,
          bottom: room.y + placement.rect.bottom,
        },
        access: fixtureAccess(room, placement),
        house: room,
      })),
  );
  const houses = buildings.filter((building) => building.definition.id === HOUSE_BUILDING);
  const yard = HOUSE_YARD.filter((placement) => placement.upgrade === upgrade).flatMap(
    (placement) =>
      houses.map((house) => ({
        placement,
        x: house.x + placement.at.x,
        y: house.y + placement.at.y,
      })),
  );
  const nodes = yard.flatMap(({ placement, x, y }) =>
    'node' in placement ? [new ResourceNode(x, y, RESOURCE_NODES[placement.node])] : [],
  );
  const stations = yard.flatMap(({ placement, x, y }) =>
    'station' in placement ? [{ x, y, station: placement.station }] : [],
  );
  return { fixtures, nodes, stations };
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
  built: readonly HouseUpgradeId[] = [],
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

  const buildings = zone.buildingSpawns.map(({ x, y, buildingId }) => ({
    x,
    y,
    definition: BUILDINGS[buildingId],
  }));

  const secrets = zone.secretSpawns.map(({ x, y, secretId }) => ({
    x,
    y,
    secretId,
    room: buildings.find((building) => isInside(building, { x, y })) ?? null,
  }));

  // What stands in the house and its yard, as far as it is built (F2).
  const fixtures: WorldFixture[] = [];
  for (const stage of [null, ...built]) {
    const raised = houseEntities(buildings, stage);
    fixtures.push(...raised.fixtures);
    nodes.push(...raised.nodes);
    stations.push(...raised.stations);
  }

  // A room shut until a stage is built has its doorway walled up till then.
  const doorPlugs = new Map<HouseUpgradeId, Rect[]>();
  for (const building of buildings) {
    const stage = SHUT_UNTIL[building.definition.id];
    if (!stage || built.includes(stage)) continue;
    doorPlugs.set(stage, [...(doorPlugs.get(stage) ?? []), doorPlug(building)]);
  }

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
    fixtures,
    signposts,
    doorPlugs,
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
        ...[...doorPlugs.values()].flat(),
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
