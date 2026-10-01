import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../../src/config/constants';
import { ENEMIES } from '../../src/data/enemies';
import { ZONES } from '../../src/data/zones';
import { clampToWorld, isBlocked } from '../../src/systems/CollisionSystem';
import { arriveRadius, distance } from '../../src/systems/MovementSystem';
import { hasClearLine } from '../../src/systems/PathSystem';
import { arrivalPoint, zoneWorldSize, type ExitSide } from '../../src/systems/ZoneSystem';
import type { Point } from '../../src/systems/MovementSystem';
import type { Mob } from '../../src/world/Mob';
import { populateZone } from '../../src/world/zoneEntities';

/**
 * Where the game puts a player down, and what is allowed to be standing there.
 *
 * `CLAUDE.md` stated for a long time that the spawn point is safe by
 * construction — "it is the middle of the map, where travelling from the world
 * map already puts someone, and no zone's centre sits inside an aggro radius".
 * It was not true. Blackwater Fen shipped with a level 5 raider 71 units from
 * its own centre against an aggro radius of 210, the Old Mill Road had a goblin
 * at 187 against 200, and the bandit camp's east arrival strip — which is how
 * anybody walks back out of the hideout — passed 128 from a level 3 bandit.
 *
 * Each was found by hand, one zone at a time, after the zone had shipped. This
 * is the sweep that finds the next one before it does.
 */

// The same inset `ZoneWorld` puts an arriving traveller at.
const ARRIVAL_INSET = TILE_SIZE * 1.5;

interface Threat {
  enemyId: string;
  level: number;
  at: Point;
  /** What it opens a fight at. */
  aggro: number;
  /** How far it can have drifted from the table by the time anyone sees it. */
  wander: number;
}

function threatsIn(zoneId: keyof typeof ZONES): Threat[] {
  return ZONES[zoneId].mobSpawns
    .filter((spawn) => {
      const definition = ENEMIES[spawn.enemyId];
      return definition.aggressive && (definition.aggroRadius ?? 0) > 0;
    })
    .map((spawn) => {
      const definition = ENEMIES[spawn.enemyId];
      return {
        enemyId: spawn.enemyId,
        level: spawn.level,
        at: { x: spawn.x, y: spawn.y },
        aggro: definition.aggroRadius ?? 0,
        wander: definition.wander.radius,
      };
    });
}

const sizeOf = (zoneId: keyof typeof ZONES): { width: number; height: number } => {
  const map = ZONES[zoneId].map;
  return { width: (map[0]?.length ?? 0) * TILE_SIZE, height: map.length * TILE_SIZE };
};

const gap = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('the spawn point', () => {
  /**
   * The strong rule, and it is the strong one because **a respawn is not a
   * choice.** Dying already costs the walk back and a fee in copper, and the
   * thing that keeps that from being a spiral is arriving at full with a moment
   * to gather yourself. So the start is held clear of an aggressive creature's
   * whole wander disc rather than of where its row happens to say it starts —
   * a creature is only ever *at* its spawn on the frame the zone was built,
   * which is the same argument `tests/render2d/picking.test.ts` makes about tapping
   * one.
   *
   * Travelling from the world map lands on the same point, so this covers both.
   */
  it('is clear of every aggressive creature, wherever it has wandered to', () => {
    for (const zone of Object.values(ZONES)) {
      for (const threat of threatsIn(zone.id)) {
        const reach = threat.aggro + threat.wander;
        expect(
          gap(zone.start, threat.at),
          `${zone.id}: respawning lands within reach of a ${threat.enemyId} (L${threat.level})`,
        ).toBeGreaterThan(reach);
      }
    }
  });
});

describe('an arrival strip', () => {
  /**
   * The weaker rule, and deliberately weaker: **walking through a door is a
   * choice.** Something wandering over to meet you on the far side of it is the
   * zone working — the bandit camp is supposed to be full of bandits — so this
   * does not ask for the wander disc the way the start does.
   *
   * What it does refuse is materialising *already* inside a fight, before there
   * is a frame in which to walk back out. That is the difference between a
   * hostile zone and a trap, and the bandit camp's east edge was a trap: it is
   * the way out of the hideout, and it put a level 3 bandit 128 away from an
   * arrival that could land anywhere along it.
   */
  it('never lands a traveller already inside an aggro radius', () => {
    for (const zone of Object.values(ZONES)) {
      const { width, height } = sizeOf(zone.id);
      const threats = threatsIn(zone.id);

      // A zone is arrived at by the mouths its own exits open: walking out
      // through one and coming back lands in the same one.
      for (const exit of zone.exits) {
        for (const threat of threats) {
          expect(
            gapToStrip(exit, threat.at, width, height),
            `${zone.id}: arriving on the ${exit.edge} edge lands inside a ${threat.enemyId} (L${threat.level})`,
          ).toBeGreaterThan(threat.aggro);
        }
      }
    }
  });
});

/**
 * Where a creature goes when a fight is over (decision 116): home, by the way
 * round whatever it was led round. A creature that cannot get there never
 * wanders again, and only a wandering creature notices anyone, so one stuck on
 * the way is a hole in its zone. It is put there after a chase's worth of
 * getting nowhere, which is the net under this sweep rather than the plan.
 */
describe("a creature's way home", () => {
  /**
   * The weaker half, and the one that failed first. A home the body does not
   * fit is a home no walk can end at, so a creature led off it was never coming
   * back: two did, since zones were written as text and every placement moved
   * onto a cell's middle — a goblin on the mill road into the trunk of the
   * hardwood beside it, and the barrow king, a tile and a half tall, into the
   * rock at the foot of his chamber.
   */
  it('is somewhere its body stands', () => {
    for (const zone of Object.values(ZONES)) {
      const { mobs, collisionWorld } = populateZone(zone, zoneWorldSize(zone), () => 0.5);
      for (const mob of mobs) {
        expect(
          isBlocked(collisionWorld, mob.bounds()),
          `${zone.id}: the ${mob.definition.id} at ${mob.spawnX},${mob.spawnY} stands in something`,
        ).toBe(false);
      }
    }
  });

  /**
   * Walked home from every cell a chase could have led it to — inside its
   * leash ring, reached from home without leaving the ring — where the way home
   * is not a straight line, at 60fps and at 5. The fen had a raider and a
   * lurker living in slots between two pools a tile wide, which a search will
   * not stand a body in, and they pressed at the slot a fraction of a pixel a
   * frame for good.
   */
  it('is walked back to, by the way round, from anywhere a chase can lead it', () => {
    for (const zone of Object.values(ZONES)) {
      const { mobs, collisionWorld } = populateZone(zone, zoneWorldSize(zone), () => 0.5);
      for (const mob of mobs) {
        for (const from of ledTo(mob, zone.map, collisionWorld)) {
          for (const deltaMs of [16, 200]) {
            expect(
              walksHome(mob, from, collisionWorld, deltaMs),
              `${zone.id}: the ${mob.definition.id} at ${mob.spawnX},${mob.spawnY} never gets home from ${from.x},${from.y} at ${deltaMs}ms a frame`,
            ).toBe(true);
          }
        }
      }
    }
  });
});

type World = ReturnType<typeof populateZone>['collisionWorld'];

/** The room a body needs on each axis to turn round in a cell: `PathSystem`'s clearance. */
const SLACK = TILE_SIZE / 4;

/**
 * The middles of every cell the creature's body fits in, inside the world's
 * edge as well as clear of anything solid, joined to its home
 * without leaving the leash ring, from which it cannot see its way straight
 * home. The ones that can are the walk every creature took before creatures
 * pathed.
 */
function ledTo(mob: Mob, map: readonly (readonly number[])[], world: World): Point[] {
  const cols = map[0]?.length ?? 0;
  const rows = map.length;
  const home = { x: mob.spawnX, y: mob.spawnY };
  const { width, height } = mob.definition.body;
  const middle = (col: number, row: number): Point => ({
    x: (col + 0.5) * TILE_SIZE,
    y: (row + 0.5) * TILE_SIZE,
  });
  const inRing = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return false;
    const at = middle(col, row);
    return distance(at, home) <= mob.definition.leashRadius && standsIn(at);
  };
  // Clear of anything solid and inside the world's edge, with room to turn
  // round: a slot exactly the body's width is somewhere a press can push it
  // and no route will take it out of (decision 35), and the net is for that.
  const standsIn = (at: Point): boolean => {
    const fits = (dx: number, dy: number): boolean => {
      const body = { x: at.x + dx, y: at.y + dy, halfWidth: width / 2, halfHeight: height / 2 };
      const inside = clampToWorld(body, world);
      return inside.x === body.x && inside.y === body.y && !isBlocked(world, body);
    };
    const room = (dx: number, dy: number): number =>
      [SLACK / 2, SLACK].filter((shift) => fits(dx * shift, dy * shift)).length * (SLACK / 2);
    return fits(0, 0) && room(1, 0) + room(-1, 0) >= SLACK && room(0, 1) + room(0, -1) >= SLACK;
  };
  const first = { col: Math.floor(home.x / TILE_SIZE), row: Math.floor(home.y / TILE_SIZE) };
  const seen = new Set([first.row * cols + first.col]);
  const queue = [first];
  for (let cell = queue.shift(); cell !== undefined; cell = queue.shift()) {
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { col: cell.col + dc, row: cell.row + dr };
      const index = next.row * cols + next.col;
      if (seen.has(index) || !inRing(next.col, next.row)) continue;
      seen.add(index);
      queue.push(next);
    }
  }
  const extent = { halfWidth: width / 2, halfHeight: height / 2 };
  return [...seen]
    .map((index) => middle(index % cols, Math.floor(index / cols)))
    .filter((at) => !hasClearLine(world, at, home, extent));
}

/**
 * Whether it walks home from `from` inside a generous minute, with nobody
 * anywhere near. Walks: a frame that carries it further than a step is the net
 * putting it there, which is the failure this is looking for.
 */
function walksHome(mob: Mob, from: Point, world: World, deltaMs: number): boolean {
  mob.setPosition(from.x, from.y);
  mob.engage();
  mob.disengage();
  const { chaseSpeed } = mob.definition;
  const band = arriveRadius(chaseSpeed, deltaMs);
  const step = (chaseSpeed * deltaMs) / 1000 + 1;
  for (let elapsed = 0; elapsed < 60_000; elapsed += deltaMs) {
    if (distance(mob, { x: mob.spawnX, y: mob.spawnY }) <= band) return true;
    const before = { x: mob.x, y: mob.y };
    mob.update(-TILE_SIZE * 100, -TILE_SIZE * 100, deltaMs, world);
    if (distance(before, mob) > step) return false;
  }
  return false;
}

/**
 * The closest a creature stands to **any** point on an arrival strip, which is
 * the whole of why this is not five sampled fractions any more.
 *
 * It used to probe 0.03, 0.25, 0.5, 0.75 and 0.97 of the edge, and a spawn that
 * sat between two of those passed a check it should have failed — Blackwater Fen
 * shipped a level 5 raider 192 from its north strip against an aggro radius of
 * 210, and it passed because the nearest sampled arrival was 214 away. A strip
 * is a line across its mouth, the whole edge or a few tiles of it (decision 119),
 * so the exact answer is the distance to that segment, which is cheaper than
 * sampling too.
 */
function gapToStrip(side: ExitSide, at: Point, width: number, height: number): number {
  const a = arrivalPoint(side, 0, width, height, ARRIVAL_INSET);
  const b = arrivalPoint(side, 1, width, height, ARRIVAL_INSET);
  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t =
    lengthSq === 0
      ? 0
      : Math.min(
          1,
          Math.max(0, ((at.x - a.x) * (b.x - a.x) + (at.y - a.y) * (b.y - a.y)) / lengthSq),
        );
  return gap(at, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}
