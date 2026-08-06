import { TILE_SIZE } from '../config/constants';
import type { ZoneDefinition, ZoneExit } from '../data/zones';
import type { ZoneEdge } from '../types/ids';
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

// Signpost placement: near its edge's midpoint but nudged sideways, so a
// player arriving through the exit (who appears at that midpoint) doesn't
// spawn standing on the post.
export const SIGNPOST_INSET = TILE_SIZE * 1.25;
export const SIGNPOST_SIDE_OFFSET = TILE_SIZE;
// Standing this close to a signpost and tapping it (or walking up after a
// tap) triggers the transition.
export const SIGNPOST_INTERACT_RADIUS = 90;

/** Where an exit's signpost stands in its zone. */
export function signpostPoint(edge: ZoneEdge, worldWidth: number, worldHeight: number): Point {
  return edgePoint(
    edge,
    acrossAt(edge, SIGNPOST_INSET, worldWidth, worldHeight),
    alongSize(edge, worldWidth, worldHeight) / 2 + SIGNPOST_SIDE_OFFSET,
  );
}

export function oppositeEdge(edge: ZoneEdge): ZoneEdge {
  return EDGE_TABLE[edge].opposite;
}

// The exit the player is standing on, if any. `margin` is how close to the
// world edge counts as "on it" — it has to exceed half the player's body,
// since world-bounds collision stops the player's centre that far from the
// edge.
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
    const threshold = acrossAt(exit.edge, margin, worldWidth, worldHeight);
    if (far ? position >= threshold : position <= threshold) {
      return exit;
    }
  }
  return null;
}

// Where along the edge the player crossed, as a 0..1 fraction, so arrival in
// the next zone can line up with departure even when the two maps differ in
// size.
export function edgeFraction(
  edge: ZoneEdge,
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number,
): number {
  const along = EDGE_TABLE[edge].across === 'x' ? y : x;
  const fraction = along / alongSize(edge, worldWidth, worldHeight);
  return Math.min(Math.max(fraction, 0), 1);
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
  const clamp = (value: number, max: number): number =>
    Math.min(Math.max(value, inset), Math.max(inset, max - inset));
  return { x: clamp(saved.x, worldWidth), y: clamp(saved.y, worldHeight) };
}

// Spawn position for a player entering on `edge` of a zone. `inset` pushes
// them far enough inside that they don't stand on the return exit and bounce
// straight back.
export function arrivalPoint(
  edge: ZoneEdge,
  fraction: number,
  worldWidth: number,
  worldHeight: number,
  inset: number,
): Point {
  return edgePoint(
    edge,
    acrossAt(edge, inset, worldWidth, worldHeight),
    fraction * alongSize(edge, worldWidth, worldHeight),
  );
}
