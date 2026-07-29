import { FIRE_BURN_MS } from '../data/recipes';

/**
 * A player-lit fire. Burns for a fixed time and then goes out, so logs stay
 * worth gathering rather than a single fire lasting the whole session.
 */
export class Campfire {
  readonly x: number;
  readonly y: number;
  private lit = true;
  private burnLeftMs = FIRE_BURN_MS;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  isLit(): boolean {
    return this.lit;
  }

  /** Returns whether it went out on this frame. */
  update(deltaMs: number): boolean {
    if (!this.lit) return false;
    this.burnLeftMs -= deltaMs;
    if (this.burnLeftMs > 0) return false;
    this.extinguish();
    return true;
  }

  extinguish(): void {
    this.lit = false;
  }
}
