import type { ZoneEdge, ZoneExit } from '../data/zones';

export interface ArrivalPoint {
  x: number;
  y: number;
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
