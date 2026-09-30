import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import {
  BUILDINGS,
  buildingRect,
  counterPoint,
  doorPoint,
  isInside,
  occupant,
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
  return zone.buildingSpawns.map(({ x, y, buildingId }) => ({
    x,
    y,
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
      zone.buildingSpawns.forEach((spawn) => {
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
   * sweep, as `tests/render2d/picking.test.ts` makes over the counters.
   */
  it('leaves every mob its whole wander disc', () => {
    zones.forEach((zone) => {
      const buildings = placed(zone);

      zone.mobSpawns.forEach(({ x, y, enemyId }) => {
        const { radius } = ENEMIES[enemyId].wander;
        const disc = around(x, y, radius);
        buildings.forEach((building) => {
          expect(
            overlaps(disc, buildingRect(building)),
            `${zone.id}: ${enemyId} at ${x},${y} wanders into the ${building.definition.id}`,
          ).toBe(false);
        });
      });
    });
  });

  it('leaves every node the ground it is worked from', () => {
    zones.forEach((zone) => {
      const buildings = placed(zone);

      zone.nodeSpawns.forEach(({ x, y, nodeId }) => {
        const { body } = RESOURCE_NODES[nodeId];
        const footprint = around(x, y, body.width / 2, body.height / 2);
        buildings.forEach((building) => {
          expect(
            overlaps(footprint, buildingRect(building)),
            `${zone.id}: ${nodeId} at ${x},${y} stands in the ${building.definition.id}`,
          ).toBe(false);
        });
      });
    });
  });

  /**
   * The counters are the one thing this no longer says, and phase 5 of
   * `docs/archive/interiors_and_light_plan.md` is where it stopped saying it: a shop is
   * a room with somebody in it now. Everything else in a zone is still held to
   * standing outside, and a station most of all — it is a tile of furniture that
   * has to be *tapped*, and a tap cannot reach through a roof.
   */
  it('leaves every station and signpost standing outside', () => {
    zones.forEach((zone) => {
      const { width, height } = zoneWorldSize(zone);
      const buildings = placed(zone);
      const standing: Array<{ what: string; x: number; y: number }> = [
        ...zone.stationSpawns.map(({ x, y, station }) => ({ what: station, x, y })),
        ...zone.exits.map((exit) => ({
          what: `${exit.edge} signpost`,
          ...signpostPoint(exit.edge, width, height),
        })),
        { what: 'the start', ...zone.start },
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
 * The rule the buildings brought with them, asked of the doors now that the
 * counters are behind them.
 *
 * It used to sweep the lane due south of each *counter*, which was the same
 * question while a counter stood on its own doorstep and is a different one now:
 * the first thing south of a shopkeeper is the shop's own south wall. What it
 * was ever about is the approach — a door has to face open ground, or the room
 * behind it is a room nobody arrives at — so it is measured from the doorstep
 * outward, along whichever way the door faces.
 *
 * Every counter's building only, and not the cottages: which way an empty
 * house faces costs nobody anything, and the cottage by the quartermaster's post
 * fronts straight onto it. That is what decides where a *shopfront* may be
 * built, rather than the other way about: the town is one street with the
 * counters along the north of it precisely because that leaves every one of
 * them a clear walk up from the square.
 */
describe('the walk up to a counter', () => {
  /** As far back as the two approach tests stand, and then some. */
  const APPROACH = TILE_SIZE * 6;

  /** Which way is out through the door, as a unit step. */
  const OUT = {
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
    east: { x: 1, y: 0 },
  };

  it('is clear of every other building, out from the door it comes in through', () => {
    zones.forEach((zone) => {
      const buildings = placed(zone);
      const people = zone.npcSpawns.map(({ x, y, npcId }) => ({ what: npcId, x, y }));

      buildings.forEach((building) => {
        const counter = occupant(building, people);
        if (!counter) return;
        const door = doorPoint(building);
        const step = OUT[building.definition.door];
        // The whole lane the player's body sweeps walking up to the door.
        const far = { x: door.x + step.x * APPROACH, y: door.y + step.y * APPROACH };
        const lane = {
          left: Math.min(door.x, far.x) - PLAYER_HALF_EXTENT,
          right: Math.max(door.x, far.x) + PLAYER_HALF_EXTENT,
          top: Math.min(door.y, far.y) - PLAYER_HALF_EXTENT,
          bottom: Math.max(door.y, far.y) + PLAYER_HALF_EXTENT,
        };
        buildings.forEach((other) => {
          if (other === building) return;
          expect(
            overlaps(lane, buildingRect(other)),
            `${zone.id}: the ${other.definition.id} stands between the ${counter.what} and the open`,
          ).toBe(false);
        });
      });
    });
  });

  // The other half of the same rule: a counter standing on water or in the rock
  // is one nobody can reach from any direction at all.
  it('ends on walkable ground', () => {
    zones.forEach((zone) => {
      zone.npcSpawns.forEach(({ x, y, npcId }) => {
        const row = nth(zone.map, Math.floor(y / TILE_SIZE));
        const tile = nth(row, Math.floor(x / TILE_SIZE));
        expect(BLOCKING_TILES, `${zone.id}: ${npcId}`).not.toContain(tile);
      });
    });
  });
});

/**
 * Which building each counter works out of, asserted as the geometry rather than
 * as a table: nothing in the data links an `NpcId` to a `BuildingId`, and
 * deliberately so — a smithy has nobody behind it and a cottage is nobody's
 * counter. What has to be true is only that every person in a zone with
 * buildings in it is standing in one of them, rather than in a field beside
 * them.
 *
 * Every zone with counters and buildings both, rather than town alone, because
 * Greyford is the second and there was nothing holding it to any of this.
 */
describe('every counter', () => {
  const withCounters = zones.filter(
    (zone) => zone.npcSpawns.length > 0 && zone.buildingSpawns.length > 0,
  );

  it.each(withCounters.map((zone) => zone.id))('works out of a building in %s', (zoneId) => {
    const zone = ZONES[zoneId];

    zone.npcSpawns.forEach(({ x, y, npcId }) => {
      const npc = { x, y };
      const home = placed(zone).find((building) => isInside(building, npc));
      expect(home, `the ${npcId} works out of nowhere`).toBeDefined();
    });
  });

  /**
   * At the back of it rather than anywhere in it, which is the placement the
   * walk depends on: a counter on the near side of a room is served from the
   * doorstep, and a room nobody has to enter is a room nobody ever sees.
   */
  it.each(withCounters.map((zone) => zone.id))('stands at the back of the room in %s', (zoneId) => {
    const zone = ZONES[zoneId];

    zone.npcSpawns.forEach(({ x, y, npcId }) => {
      const npc = { x, y };
      const home = placed(zone).find((building) => isInside(building, npc));
      if (!home) throw new Error(`the ${npcId} works out of nowhere`);
      expect(counterPoint(home), npcId).toEqual(npc);
    });
  });

  // The rule that predates the buildings and survives them: which counter a tap
  // opens must never be a question about pixels. Walls make it harder to get
  // wrong rather than easier — the radius reaches straight through one.
  it.each(withCounters.map((zone) => zone.id))(
    'stands more than an interact radius from the next in %s',
    (zoneId) => {
      const people = ZONES[zoneId].npcSpawns;
      people.forEach((a) => {
        people.forEach((b) => {
          if (a === b) return;
          expect(
            Math.hypot(a.x - b.x, a.y - b.y),
            `${NPCS[a.npcId].name} and ${NPCS[b.npcId].name}`,
          ).toBeGreaterThan(NPC_INTERACT_RADIUS);
        });
      });
    },
  );
});

/**
 * The rule this file could only ever approximate before, and the reason phase 2
 * of `docs/archive/interiors_and_light_plan.md` came before phase 4.
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
    const buildings = zone.buildingSpawns;
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

/**
 * And the same question asked of the person rather than the room, which is what
 * phase 5 of `docs/archive/interiors_and_light_plan.md` was for.
 *
 * Not the same assertion as the one above, and the difference is the whole
 * point: a route into a building ends wherever the middle of it is, where a
 * route to a *counter* has to end at a spot chosen for somebody to stand at.
 * A\* walks tile centres, so a counter pushed one notch too far back is a
 * counter in the wall's own row — reachable to the eye, `null` to the walk, and
 * a shop that answers a tap by pressing the player into a shopfront.
 *
 * Routed from the zone's spawn point because that is where a player who has
 * just arrived, or just died, is standing.
 */
describe('every counter can be walked up to', () => {
  Object.values(ZONES).forEach((zone) => {
    if (zone.npcSpawns.length === 0) return;

    it(`reaches every counter in ${zone.id} from the spawn point`, () => {
      const entities = populateZone(zone, zoneWorldSize(zone), () => 0.5);
      const start = entities.spawnPoint;

      entities.npcs.forEach((npc) => {
        const route = findPath(
          entities.collisionWorld,
          start,
          { x: npc.x, y: npc.y },
          PLAYER_HALF_EXTENT,
        );
        expect(route, `${zone.id}: no way up to the ${npc.npcId}`).not.toBeNull();
      });
    });
  });
});

/**
 * How deep a room has to be to be one anybody stands in, which is arithmetic
 * rather than taste — and the reason two of the six counters are served from
 * their own doorway.
 *
 * The walk up to a counter ends `NPC_INTERACT_RADIUS` short of it, measured
 * from where the counter stands rather than from the door, so a room is entered
 * only when its floor reaches further back than that. A two-tile hut does not:
 * `counterPoint` puts the counter in the middle of one, and the middle of a
 * two-tile hut is a tile from the threshold. That is what building a hut costs,
 * and it is worth failing on rather than discovering as a shop nobody can see
 * into — so this asserts which buildings are which, and a room that changes
 * side has to be moved deliberately.
 */
describe('how far in the walk to a counter ends', () => {
  const entered = ['general-store', 'bank-house', 'training-hall', 'trading-post'];
  const served = ['quartermasters-post', 'longhouse'];

  it.each([...entered, ...served])('is decided by how deep the %s is', (id) => {
    const building = { x: 2000, y: 2000, definition: BUILDINGS[id as keyof typeof BUILDINGS] };
    const counter = counterPoint(building);
    const door = doorPoint(building);
    // Where the walk stops: the last point on the line in from the door that is
    // still an interact radius out.
    const toward = Math.hypot(door.x - counter.x, door.y - counter.y);
    const stop = {
      x: counter.x + ((door.x - counter.x) / toward) * NPC_INTERACT_RADIUS,
      y: counter.y + ((door.y - counter.y) / toward) * NPC_INTERACT_RADIUS,
    };

    expect(isInside(building, stop), id).toBe(entered.includes(id));
  });
});
