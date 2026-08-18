import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../../src/config/constants';
import { ENEMIES } from '../../src/data/enemies';
import { ZONES } from '../../src/data/zones';
import { arrivalPoint } from '../../src/systems/ZoneSystem';
import type { Point } from '../../src/systems/MovementSystem';
import type { ZoneEdge } from '../../src/types/ids';

/**
 * Where the game puts a player down, and what is allowed to be standing there.
 *
 * `CLAUDE.md` has stated for a long time that the spawn point is safe by
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

function threatsIn(zoneId: keyof typeof ZONES, centre: Point): Threat[] {
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
        at: { x: centre.x + spawn.dx, y: centre.y + spawn.dy },
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
   * to gather yourself. So the centre is held clear of an aggressive creature's
   * whole wander disc rather than of where its row happens to say it starts —
   * a creature is only ever *at* its spawn on the frame the zone was built,
   * which is the same argument `render3d/picking.test.ts` makes about tapping
   * one.
   *
   * Travelling from the world map lands on the same point, so this covers both.
   */
  it('is clear of every aggressive creature, wherever it has wandered to', () => {
    for (const zone of Object.values(ZONES)) {
      const { width, height } = sizeOf(zone.id);
      const centre = { x: width / 2, y: height / 2 };

      for (const threat of threatsIn(zone.id, centre)) {
        const reach = threat.aggro + threat.wander;
        expect(
          gap(centre, threat.at),
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
   * does not ask for the wander disc the way the centre does.
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
      const centre = { x: width / 2, y: height / 2 };
      const threats = threatsIn(zone.id, centre);

      // A zone is arrived on the edges its own exits sit on: walking out
      // through one and coming back lands on the same edge.
      for (const exit of zone.exits) {
        for (const threat of threats) {
          expect(
            gapToStrip(exit.edge, threat.at, width, height),
            `${zone.id}: arriving on the ${exit.edge} edge lands inside a ${threat.enemyId} (L${threat.level})`,
          ).toBeGreaterThan(threat.aggro);
        }
      }
    }
  });
});

/**
 * The closest a creature stands to **any** point on an arrival strip, which is
 * the whole of why this is not five sampled fractions any more.
 *
 * It used to probe 0.03, 0.25, 0.5, 0.75 and 0.97 of the edge, and a spawn that
 * sat between two of those passed a check it should have failed — Blackwater Fen
 * shipped a level 5 raider 192 from its north strip against an aggro radius of
 * 210, and it passed because the nearest sampled arrival was 214 away. A strip
 * spans the whole edge, so the only thing that can hold a creature clear of it is
 * distance *across* the edge: the point on the strip nearest anything is always
 * the one directly opposite it. Measuring that is exact and cheaper than
 * sampling, which is what `deepCut.test.ts` had already worked out for one zone.
 */
function gapToStrip(edge: ZoneEdge, at: Point, width: number, height: number): number {
  const anywhere = arrivalPoint(edge, 0.5, width, height, ARRIVAL_INSET);
  return edge === 'east' || edge === 'west'
    ? Math.abs(at.x - anywhere.x)
    : Math.abs(at.y - anywhere.y);
}
