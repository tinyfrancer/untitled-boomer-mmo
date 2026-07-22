export interface Point {
  x: number;
  y: number;
}

export interface MovementStep {
  vx: number;
  vy: number;
  arrived: boolean;
}

// Close enough to a click destination to count as standing on it. Wider than a
// frame's travel at top speed, so the player can't orbit a point forever.
export const ARRIVE_RADIUS = 8;

/** Velocity toward a target point at the given speed, or arrival. */
export function stepToward(x: number, y: number, target: Point, speed: number): MovementStep {
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.hypot(dx, dy);
  if (distance <= ARRIVE_RADIUS) {
    return { vx: 0, vy: 0, arrived: true };
  }
  return { vx: (dx / distance) * speed, vy: (dy / distance) * speed, arrived: false };
}
