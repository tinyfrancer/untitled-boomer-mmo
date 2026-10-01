import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../config/constants';
import type { ZoneDefinition, ZoneExit } from '../data/zones';
import type { ZoneEdge } from '../types/ids';
import { clamp } from './math';
import type { Point } from './MovementSystem';

/**
 * What an edge is, geometrically. Every question below — where its signpost
 * stands, whether the player is on it, where they arrive from it — is the same
 * two facts asked four ways, so they are stated once here rather than as four
 * `switch (edge)` statements that a fifth edge would have to be added to in
 * four places. Three of those four used `default:` in place of `case 'east'`,
 * so a fifth edge would silently have been treated as east.
 */
interface EdgeGeometry {
  opposite: ZoneEdge;
  // Which axis crosses the edge. The other one runs along it.
  across: 'x' | 'y';
  // Whether the edge is at that axis's far end rather than at zero.
  far: boolean;
}

const EDGE_TABLE: Record<ZoneEdge, EdgeGeometry> = {
  north: { opposite: 'south', across: 'y', far: false },
  south: { opposite: 'north', across: 'y', far: true },
  west: { opposite: 'east', across: 'x', far: false },
  east: { opposite: 'west', across: 'x', far: true },
};

/** How far along the crossing axis a point `inset` inside this edge sits. */
function acrossAt(edge: ZoneEdge, inset: number, worldWidth: number, worldHeight: number): number {
  const { across, far } = EDGE_TABLE[edge];
  const size = across === 'x' ? worldWidth : worldHeight;
  return far ? size - inset : inset;
}

/** A point from its distance across the edge and its distance along it. */
function edgePoint(edge: ZoneEdge, across: number, along: number): Point {
  return EDGE_TABLE[edge].across === 'x' ? { x: across, y: along } : { x: along, y: across };
}

/** The length of the edge itself, which is the axis the fraction runs along. */
function alongSize(edge: ZoneEdge, worldWidth: number, worldHeight: number): number {
  return EDGE_TABLE[edge].across === 'x' ? worldHeight : worldWidth;
}

/**
 * One zone's end of an exit: the edge it is on, and the stretch of that edge
 * that is open. An exit row is one, and so is a bare edge, which is open end to
 * end.
 */
export type ExitSide = Pick<ZoneExit, 'edge' | 'mouth'>;

/** The open stretch of an exit's edge, in pixels from the edge's north or west end. */
function mouthSpan(
  side: ExitSide,
  worldWidth: number,
  worldHeight: number,
): { from: number; to: number } {
  if (!side.mouth) return { from: 0, to: alongSize(side.edge, worldWidth, worldHeight) };
  const [first, last] = side.mouth;
  return { from: first * TILE_SIZE, to: (last + 1) * TILE_SIZE };
}

/**
 * Where along its edge a body's centre can cross an exit: the mouth, held half
 * a body in from either end, since the rock beside a mouth and the world's bounds
 * at the end of a whole edge each stop the centre that far off them. A crossing's
 * fraction is measured along this and an arrival is laid along it, so a body
 * crossing hard against one side of a mouth arrives hard against the same side
 * of the other, and never in its wall (decision 119).
 */
function crossingSpan(
  side: ExitSide,
  worldWidth: number,
  worldHeight: number,
): { from: number; to: number } {
  const { from, to } = mouthSpan(side, worldWidth, worldHeight);
  return { from: from + PLAYER_HALF_EXTENT, to: to - PLAYER_HALF_EXTENT };
}

/**
 * The side of a zone an arrival on `edge` comes in by: the zone's own exit on
 * that edge, whose mouth it lands in, or the bare edge for a zone with none
 * there.
 */
export function sideOn(zone: Pick<ZoneDefinition, 'exits'>, edge: ZoneEdge): ExitSide {
  return zone.exits.find((exit) => exit.edge === edge) ?? { edge };
}

// Signpost placement: near its mouth's middle but nudged sideways, so a
// player arriving through the exit (who appears at that middle) doesn't
// spawn standing on the post.
export const SIGNPOST_INSET = TILE_SIZE * 1.25;
export const SIGNPOST_SIDE_OFFSET = TILE_SIZE;
// Standing this close to a signpost and tapping it (or walking up after a
// tap) triggers the transition.
export const SIGNPOST_INTERACT_RADIUS = 90;

/** Where an exit's signpost stands in its zone. */
export function signpostPoint(side: ExitSide, worldWidth: number, worldHeight: number): Point {
  const { from, to } = mouthSpan(side, worldWidth, worldHeight);
  return edgePoint(
    side.edge,
    acrossAt(side.edge, SIGNPOST_INSET, worldWidth, worldHeight),
    (from + to) / 2 + SIGNPOST_SIDE_OFFSET,
  );
}

export function oppositeEdge(edge: ZoneEdge): ZoneEdge {
  return EDGE_TABLE[edge].opposite;
}

// The exit the player is standing on, if any. `margin` is how close to the
// world edge counts as "on it" — it has to exceed half the player's body,
// since world-bounds collision stops the player's centre that far from the
// edge. Only the mouth is the way out: the edge either side of it leaves for
// nowhere.
export function findExit(
  exits: ZoneExit[],
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number,
  margin: number,
): ZoneExit | null {
  for (const exit of exits) {
    const { across, far } = EDGE_TABLE[exit.edge];
    const position = across === 'x' ? x : y;
    const along = across === 'x' ? y : x;
    const threshold = acrossAt(exit.edge, margin, worldWidth, worldHeight);
    const { from, to } = mouthSpan(exit, worldWidth, worldHeight);
    if ((far ? position >= threshold : position <= threshold) && along >= from && along <= to) {
      return exit;
    }
  }
  return null;
}

// Where along the mouth the player crossed, as a 0..1 fraction, so arrival in
// the next zone can line up with departure even when the two mouths differ in
// size.
export function edgeFraction(
  side: ExitSide,
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number,
): number {
  const along = EDGE_TABLE[side.edge].across === 'x' ? y : x;
  const { from, to } = crossingSpan(side, worldWidth, worldHeight);
  return clamp((along - from) / (to - from), 0, 1);
}

/** A zone's map measured in pixels rather than tiles. */
export function zoneWorldSize(zone: ZoneDefinition): { width: number; height: number } {
  return {
    width: (zone.map[0]?.length ?? 0) * TILE_SIZE,
    height: zone.map.length * TILE_SIZE,
  };
}

/**
 * Where a character saved in this zone comes back in. The saved spot, but held
 * `inset` clear of the world edge: a map edited smaller than it was when the
 * save was written would otherwise drop them in the edge-walk band and bounce
 * them straight into the next zone before they could move.
 */
export function resumePoint(
  saved: Point,
  worldWidth: number,
  worldHeight: number,
  inset: number,
): Point {
  const inside = (value: number, max: number): number =>
    clamp(value, inset, Math.max(inset, max - inset));
  return { x: inside(saved.x, worldWidth), y: inside(saved.y, worldHeight) };
}

// Spawn position for a player entering by `side` of a zone, at the fraction of
// its mouth they crossed the other at. `inset` pushes them far enough inside
// that they don't stand on the return exit and bounce straight back.
export function arrivalPoint(
  side: ExitSide,
  fraction: number,
  worldWidth: number,
  worldHeight: number,
  inset: number,
): Point {
  const { from, to } = crossingSpan(side, worldWidth, worldHeight);
  return edgePoint(
    side.edge,
    acrossAt(side.edge, inset, worldWidth, worldHeight),
    from + fraction * (to - from),
  );
}
