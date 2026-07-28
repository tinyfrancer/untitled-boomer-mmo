export interface Point {
  x: number;
  y: number;
}

export interface MovementStep {
  vx: number;
  vy: number;
  arrived: boolean;
}

// Close enough to a click destination to count as standing on it at a normal
// frame rate. A slow frame widens it — see arriveRadius below.
export const ARRIVE_RADIUS = 8;

/**
 * How close counts as arrived, for a frame that carries the player `frameTravel`
 * pixels. It has to grow with the step or a slow frame walks clean over a fixed
 * 8px band: at 60fps a step is 5px and every walk lands, but at 7fps — which a
 * loaded CI runner and a cheap phone both reach — it is 46px, and the player
 * overshoots, turns round and orbits the point forever without ever landing
 * inside it. Two thirds of destinations never resolved at that frame rate.
 *
 * From further out the player closes by a whole step each frame, and the first
 * step that would pass the target leaves it no more than one step beyond. Half
 * a step is therefore the critical width — but exactly half converges only in
 * exact arithmetic, and a destination sitting on the boundary oscillates across
 * it forever on rounding alone. A little over half is what actually always
 * lands.
 */
const ARRIVE_STEP_FRACTION = 0.6;

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Whether `b` is inside `radius` of `a`, counting the boundary as inside. */
export function withinRadius(a: Point, b: Point, radius: number): boolean {
  return distance(a, b) <= radius;
}

export function arriveRadius(speed: number, deltaMs: number): number {
  const frameTravel = (speed * Math.max(0, deltaMs)) / 1000;
  return Math.max(ARRIVE_RADIUS, frameTravel * ARRIVE_STEP_FRACTION);
}

/**
 * Velocity toward a target point at the given speed, or arrival.
 *
 * Deliberately never returns a velocity above `speed`, even to land exactly on
 * the point: the caller integrates this over the physics world's own timestep
 * rather than over `deltaMs`, so a faster-than-walking final step turns that
 * small mismatch into a visible overshoot past the destination.
 */
export function stepToward(
  x: number,
  y: number,
  target: Point,
  speed: number,
  deltaMs: number,
): MovementStep {
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.hypot(dx, dy);
  if (distance <= arriveRadius(speed, deltaMs)) {
    return { vx: 0, vy: 0, arrived: true };
  }
  return { vx: (dx / distance) * speed, vy: (dy / distance) * speed, arrived: false };
}
