import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import {
  BUILDINGS,
  buildingRect,
  doorPoint,
  type BuildingDefinition,
} from '../../src/data/buildings';
import { ENEMIES } from '../../src/data/enemies';
import { NPCS, NPC_INTERACT_RADIUS } from '../../src/data/npcs';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { BLOCKING_TILES } from '../../src/data/tiles';
import { ZONES, type ZoneDefinition } from '../../src/data/zones';
import { findPath } from '../../src/systems/PathSystem';
import {
  arrivalPoint,
  oppositeEdge,
  signpostPoint,
  zoneWorldSize,
} from '../../src/systems/ZoneSystem';
import { populateZone } from '../../src/world/zoneEntities';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Strict overlap, which is what `CollisionSystem` means by blocked. */
function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function around(x: number, y: number, halfWidth: number, halfHeight = halfWidth): Rect {
  return { left: x - halfWidth, top: y - halfHeight, right: x + halfWidth, bottom: y + halfHeight };
}

/** Every building in a zone, placed the way `populateZone` places them. */
function placed(
  zone: ZoneDefinition,
): Array<{ x: number; y: number; definition: BuildingDefinition }> {
  const { width, height } = zoneWorldSize(zone);
  return (zone.buildingSpawns ?? []).map(({ dx, dy, buildingId }) => ({
    x: width / 2 + dx,
    y: height / 2 + dy,
    definition: BUILDINGS[buildingId],
  }));
}

const zones = Object.values(ZONES);

describe('BUILDINGS data integrity', () => {
  it('every building id matches its table key', () => {
    Object.entries(BUILDINGS).forEach(([key, building]) => expect(building.id).toBe(key));
  });

  it('every spawn references a defined building', () => {
    zones.forEach((zone) => {
      (zone.buildingSpawns ?? []).forEach((spawn) => {
        expect(BUILDINGS[spawn.buildingId], `${zone.id}: ${spawn.buildingId}`).toBeDefined();
      });
    });
  });

  /**
   * A footprint under a tile in either direction would be a building the player
   * is wider than, which reads as a crate rather than as somewhere anyone works.
   */
  it('gives every building at least a tile in each direction', () => {
    Object.values(BUILDINGS).forEach((building) => {
      expect(building.body.width, building.id).toBeGreaterThanOrEqual(TILE_SIZE);
      expect(building.body.height, building.id).toBeGreaterThanOrEqual(TILE_SIZE);
    });
  });

  // There are no art assets, so four shopfronts are one box in one colour until
  // something says which is which: the name over the door is load-bearing here
  // in a way a decorative label would not be.
  it('names every building, since the sign over the door is what tells them apart', () => {
    Object.values(BUILDINGS).forEach((building) => expect(building.name, building.id).toBeTruthy());
  });
});

describe('doorPoint', () => {
  it('stands outside the wall it is in, on all four sides', () => {
    const at = (door: BuildingDefinition['door']) => ({
      x: 1000,
      y: 1000,
      definition: { ...BUILDINGS.cottage, door },
    });
    const half = BUILDINGS.cottage.body.width / 2;

    expect(doorPoint(at('south'))).toEqual({ x: 1000, y: 1000 + half + TILE_SIZE / 2 });
    expect(doorPoint(at('north'))).toEqual({ x: 1000, y: 1000 - half - TILE_SIZE / 2 });
    expect(doorPoint(at('east'))).toEqual({ x: 1000 + half + TILE_SIZE / 2, y: 1000 });
    expect(doorPoint(at('west'))).toEqual({ x: 1000 - half - TILE_SIZE / 2, y: 1000 });
  });

  /**
   * A tap on a building walks to this point, so a doorstep inside the walls
   * would be a walk that collision stops short of and that therefore never
   * arrives — the player would stand against the wall with a pending move
   * target forever.
   */
  it('leaves room for the player to stand in, outside every building', () => {
    Object.values(BUILDINGS).forEach((definition) => {
      const building = { x: 2000, y: 2000, definition };
      const door = doorPoint(building);
      expect(
        overlaps(around(door.x, door.y, PLAYER_HALF_EXTENT), buildingRect(building)),
        definition.id,
      ).toBe(false);
    });
  });
});

/**
 * Where a building may stand, which is a level design rule with teeth.
 *
 * A building is the only thing in a zone placed by area rather than by a point,
 * and it is solid — so it is the only thing that can silently swallow another.
 * A rat inside a wall is drawn inside it and never wanders out to prove it; a
 * tree inside one is chopped through it; a signpost inside one cannot be reached
 * at all. None of that fails any existing assertion, which is why these do.
 */
describe('where the buildings stand', () => {
  it('never overlaps another building', () => {
    zones.forEach((zone) => {
      const buildings = placed(zone);
      buildings.forEach((a, index) => {
        buildings.slice(index + 1).forEach((b) => {
          expect(
            overlaps(buildingRect(a), buildingRect(b)),
            `${zone.id}: ${a.definition.id} and ${b.definition.id}`,
          ).toBe(false);
        });
      });
    });
  });

  /**
   * The whole wander disc, not the spawn point: a creature is only ever *at* its
   * spawn on the frame the zone was built, and one that can walk behind a
   * shopfront is one a player cannot see to tap. Same argument, and the same
   * sweep, as `tests/render3d/picking.test.ts` makes over the counters.
   */
  it('leaves every mob its whole wander disc', () => {
    zones.forEach((zone) => {
      const { width, height } = zoneWorldSize(zone);
      const buildings = placed(zone);

      zone.mobSpawns.forEach(({ dx, dy, enemyId }) => {
        const { radius } = ENEMIES[enemyId].wander;
        const disc = around(width / 2 + dx, height / 2 + dy, radius);
        buildings.forEach((building) => {
          expect(
            overlaps(disc, buildingRect(building)),
            `${zone.id}: ${enemyId} at ${dx},${dy} wanders into the ${building.definition.id}`,
          ).toBe(false);
        });
      });
    });
  });

  it('leaves every node the ground it is worked from', () => {
    zones.forEach((zone) => {
      const { width, height } = zoneWorldSize(zone);
      const buildings = placed(zone);

      zone.nodeSpawns.forEach(({ dx, dy, nodeId }) => {
        const { body } = RESOURCE_NODES[nodeId];
        const footprint = around(width / 2 + dx, height / 2 + dy, body.width / 2, body.height / 2);
        buildings.forEach((building) => {
          expect(
            overlaps(footprint, buildingRect(building)),
            `${zone.id}: ${nodeId} at ${dx},${dy} stands in the ${building.definition.id}`,
          ).toBe(false);
        });
      });
    });
  });

  it('leaves every counter, station and signpost standing outside', () => {
    zones.forEach((zone) => {
      const { width, height } = zoneWorldSize(zone);
      const buildings = placed(zone);
      const standing: Array<{ what: string; x: number; y: number }> = [
        ...zone.npcSpawns.map(({ dx, dy, npcId }) => ({
          what: npcId,
          x: width / 2 + dx,
          y: height / 2 + dy,
        })),
        ...(zone.stationSpawns ?? []).map(({ dx, dy, station }) => ({
          what: station,
          x: width / 2 + dx,
          y: height / 2 + dy,
        })),
        ...zone.exits.map((exit) => ({
          what: `${exit.edge} signpost`,
          ...signpostPoint(exit.edge, width, height),
        })),
        { what: 'the spawn point', x: width / 2, y: height / 2 },
      ];

      standing.forEach((thing) => {
        buildings.forEach((building) => {
          expect(
            overlaps(around(thing.x, thing.y, PLAYER_HALF_EXTENT), buildingRect(building)),
            `${zone.id}: ${thing.what} stands in the ${building.definition.id}`,
          ).toBe(false);
        });
      });
    });
  });

  /**
   * An arrival lands anywhere along an edge — walking out of a zone keeps the
   * fraction it was crossed at — so a building against an entry edge is one that
   * a traveller materialises inside of. `ZoneSystem.test.ts` asks the same
   * question of the tiles; this asks it of the things standing on them.
   */
  it('is clear of every band a traveller can arrive on', () => {
    const fractions = [0.03, 0.25, 0.5, 0.75, 0.97];
    for (const zone of zones) {
      for (const exit of zone.exits) {
        const destination = ZONES[exit.to];
        const { width, height } = zoneWorldSize(destination);
        const buildings = placed(destination);
        const edge = oppositeEdge(exit.edge);

        for (const fraction of fractions) {
          const point = arrivalPoint(edge, fraction, width, height, TILE_SIZE * 1.5);
          buildings.forEach((building) => {
            expect(
              overlaps(around(point.x, point.y, PLAYER_HALF_EXTENT), buildingRect(building)),
              `${zone.id} -> ${exit.to}: arriving at ${fraction} lands in the ${building.definition.id}`,
            ).toBe(false);
          });
        }
      }
    }
  });
});

/**
 * The rule solid buildings brought with them, and the one nothing else can hold.
 *
 * `ApproachDriver` walks a straight line and slides along whatever it meets —
 * there is no pathfinding anywhere in this game — so a tap on a counter is only
 * answered if the line to it is clear. The camera stands to the south, which
 * makes due south the direction a player is overwhelmingly likely to be tapping
 * from, and it is the direction `tests/world/trainer.test.ts` and
 * `tests/world/bounty.test.ts` each walk one counter in from.
 *
 * So every counter's door faces the open ground it is approached across, and the
 * lane between the two is clear of everything solid. That is what decides where
 * a shopfront may be built, rather than the other way about: the town is one
 * street with the counters along the north of it precisely because that leaves
 * every one of them a clear walk up from the square.
 */
describe('the walk up to a counter', () => {
  /** As far back as the two approach tests stand, and then some. */
  const APPROACH = NPC_INTERACT_RADIUS * 3;

  it('is clear of every building, from due south of the counter', () => {
    zones.forEach((zone) => {
      const { width, height } = zoneWorldSize(zone);
      const buildings = placed(zone);

      zone.npcSpawns.forEach(({ dx, dy, npcId }) => {
        const npc = { x: width / 2 + dx, y: height / 2 + dy };
        // The whole lane the player's body sweeps walking north to the counter.
        const lane = {
          left: npc.x - PLAYER_HALF_EXTENT,
          right: npc.x + PLAYER_HALF_EXTENT,
          top: npc.y,
          bottom: npc.y + APPROACH,
        };
        buildings.forEach((building) => {
          expect(
            overlaps(lane, buildingRect(building)),
            `${zone.id}: the ${building.definition.id} stands between the ${npcId} and the square`,
          ).toBe(false);
        });
      });
    });
  });

  // The other half of the same rule: a counter standing on water or in the rock
  // is one nobody can reach from any direction at all.
  it('ends on walkable ground', () => {
    zones.forEach((zone) => {
      const { width, height } = zoneWorldSize(zone);
      zone.npcSpawns.forEach(({ dx, dy, npcId }) => {
        const row = nth(zone.map, Math.floor((height / 2 + dy) / TILE_SIZE));
        const tile = nth(row, Math.floor((width / 2 + dx) / TILE_SIZE));
        expect(BLOCKING_TILES, `${zone.id}: ${npcId}`).not.toContain(tile);
      });
    });
  });
});

/**
 * Which building each counter works out of, asserted as the geometry rather than
 * as a table: nothing in the data links an `NpcId` to a `BuildingId`, and
 * deliberately so — a smithy has nobody behind it and a cottage is nobody's
 * counter. What has to be true is only that every person in a town with
 * buildings in it is standing at one of their doors, rather than in a field
 * beside them.
 */
describe('every counter in town', () => {
  const town = ZONES.town;
  const { width, height } = zoneWorldSize(town);

  it('stands on the doorstep of a building', () => {
    const doors = placed(town).map(doorPoint);

    town.npcSpawns.forEach(({ dx, dy, npcId }) => {
      const npc = { x: width / 2 + dx, y: height / 2 + dy };
      const onADoorstep = doors.some(
        (door) => Math.hypot(door.x - npc.x, door.y - npc.y) < TILE_SIZE / 2,
      );
      expect(onADoorstep, `the ${npcId} works out of nowhere`).toBe(true);
    });
  });

  // The rule that predates the buildings and survives them: which counter a tap
  // opens must never be a question about pixels.
  it('stands more than an interact radius from the next', () => {
    const people = town.npcSpawns;
    people.forEach((a) => {
      people.forEach((b) => {
        if (a === b) return;
        expect(
          Math.hypot(a.dx - b.dx, a.dy - b.dy),
          `${NPCS[a.npcId].name} and ${NPCS[b.npcId].name}`,
        ).toBeGreaterThan(NPC_INTERACT_RADIUS);
      });
    });
  });
});

/**
 * The rule this file could only ever approximate before, and the reason phase 2
 * of `docs/interiors_and_light_plan.md` came before phase 4.
 *
 * "Is this counter reachable" used to be checked as *lane clearance* — is the
 * ground between the door and the open street free of anything solid — because
 * a straight-line mover was all there was to reason about. With a pathfinder in
 * the codebase the real question can be asked instead: route a body from where
 * the zone puts a player to the middle of every building in the game, through
 * whatever door it has, and fail if any of them cannot be walked into.
 *
 * It is the sharpest test of the hollowing, because it fails for every way of
 * getting it wrong at once: a doorway too narrow for the body, a wall drawn
 * across its own gap, a room too small to stand in, a building whose door faces
 * something solid.
 */
describe('every building can be walked into', () => {
  Object.values(ZONES).forEach((zone) => {
    const buildings = zone.buildingSpawns ?? [];
    if (buildings.length === 0) return;

    it(`lets a player into every building in ${zone.id}`, () => {
      const entities = populateZone(zone, zoneWorldSize(zone), () => 0.5);
      const start = entities.spawnPoint;

      entities.buildings.forEach((building) => {
        const inside = { x: building.x, y: building.y };
        const route = findPath(entities.collisionWorld, start, inside, PLAYER_HALF_EXTENT);
        expect(route, `${zone.id}: no way into the ${building.definition.id}`).not.toBeNull();
      });
    });
  });
});
