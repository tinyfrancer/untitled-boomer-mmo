import type { Bounds } from '../systems/CollisionSystem';
import type { ResourceNodeDefinition } from '../data/resourceNodes';

/**
 * A gatherable thing in the world: a tree, a fishing spot, an ore vein.
 * Deliberately much thinner than Mob — no AI, no health, no combat. It owns only
 * how many gathers are left in it and when it comes back.
 */
export class ResourceNode {
  readonly definition: ResourceNodeDefinition;
  readonly x: number;
  readonly y: number;
  readonly name: string;
  private chargesLeft: number;
  private depleted = false;
  private respawnInMs = 0;

  constructor(x: number, y: number, definition: ResourceNodeDefinition) {
    this.x = x;
    this.y = y;
    this.definition = definition;
    this.name = definition.name;
    this.chargesLeft = definition.charges ?? Number.POSITIVE_INFINITY;
  }

  isAvailable(): boolean {
    return !this.depleted;
  }

  /**
   * What actually stops the player — the trunk of a tree, the rock of a vein —
   * anchored to the body's foot rather than centred on its origin. A tree stands
   * a tile and a half tall, so a blocker centred on the origin would sit ~30px
   * too high and put anything standing at the tree's feet inside it.
   *
   * A node that blocks nothing gets an empty rect rather than a special case —
   * `populateZone` leaves those out of the collision world, and an empty one
   * would stop nobody if it ever reached it.
   */
  blockerRect(): Bounds {
    const fraction = this.definition.blocks ?? 0;
    const { width, height } = this.definition.body;
    const blockerWidth = width * fraction;
    const bottom = this.y + height / 2;
    return {
      left: this.x - blockerWidth / 2,
      right: this.x + blockerWidth / 2,
      top: bottom - height * fraction,
      bottom,
    };
  }

  /** Consumes one gather. Returns whether that emptied the node. */
  consumeCharge(): boolean {
    if (this.depleted) return false;

    this.chargesLeft -= 1;
    if (this.chargesLeft > 0) {
      return false;
    }

    this.deplete();
    return true;
  }

  /** Returns whether the node came back on this frame. */
  update(deltaMs: number): boolean {
    if (!this.depleted) return false;
    this.respawnInMs -= deltaMs;
    if (this.respawnInMs > 0) return false;
    this.respawn();
    return true;
  }

  private deplete(): void {
    this.depleted = true;
    this.respawnInMs = this.definition.respawnDelayMs;
  }

  private respawn(): void {
    this.depleted = false;
    this.chargesLeft = this.definition.charges ?? Number.POSITIVE_INFINITY;
  }
}
