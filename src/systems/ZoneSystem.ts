import { TILE_SIZE } from '../config/constants';
import type { ZoneEdge, ZoneExit } from '../data/zones';

export interface ArrivalPoint {
  x: number;
  y: number;
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
export function signpostPoint(
  edge: ZoneEdge,
  worldWidth: number,
  worldHeight: number,
): ArrivalPoint {
  switch (edge) {
    case 'north':
      return { x: worldWidth / 2 + SIGNPOST_SIDE_OFFSET, y: SIGNPOST_INSET };
    case 'south':
      return { x: worldWidth / 2 + SIGNPOST_SIDE_OFFSET, y: worldHeight - SIGNPOST_INSET };
    case 'west':
      return { x: SIGNPOST_INSET, y: worldHeight / 2 + SIGNPOST_SIDE_OFFSET };
    default:
      return { x: worldWidth - SIGNPOST_INSET, y: worldHeight / 2 + SIGNPOST_SIDE_OFFSET };
  }
}

export function oppositeEdge(edge: ZoneEdge): ZoneEdge {
  switch (edge) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    default:
      return 'east';
  }
}

// The exit the player is standing on, if any. `margin` is how close to the
// world edge counts as "on it" — it has to exceed half the player's body,
// since world-bounds collision stops the sprite's center that far from the
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
    switch (exit.edge) {
      case 'north':
        if (y <= margin) return exit;
        break;
      case 'south':
        if (y >= worldHeight - margin) return exit;
        break;
      case 'west':
        if (x <= margin) return exit;
        break;
      case 'east':
        if (x >= worldWidth - margin) return exit;
        break;
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
  const fraction = edge === 'north' || edge === 'south' ? x / worldWidth : y / worldHeight;
  return Math.min(Math.max(fraction, 0), 1);
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
): ArrivalPoint {
  switch (edge) {
    case 'north':
      return { x: fraction * worldWidth, y: inset };
    case 'south':
      return { x: fraction * worldWidth, y: worldHeight - inset };
    case 'west':
      return { x: inset, y: fraction * worldHeight };
    default:
      return { x: worldWidth - inset, y: fraction * worldHeight };
  }
}
