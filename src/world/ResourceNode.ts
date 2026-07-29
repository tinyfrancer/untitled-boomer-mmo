import type { Rect } from '../systems/CollisionSystem';
import type { ResourceNodeDefinition } from '../data/resourceNodes';

// How much of a solid node's body is trunk. Only the trunk blocks movement —
// walking "behind" a tree means walking through its canopy, which is the usual
// top-down convention.
const TRUNK_FRACTION = 0.3;

/**
 * A gatherable thing in the world: a tree, a fishing spot. Deliberately much
 * thinner than Mob — no AI, no health, no combat. It owns only how many gathers
 * are left in it and when it comes back.
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
   * What actually stops the player: the trunk, anchored to the body's foot
   * rather than centred on its origin. A tree stands a tile and a half tall, so
   * a blocker centred on the origin would sit ~30px too high and put anything
   * standing at the tree's feet inside it.
   */
  blockerRect(): Rect {
    const { width, height } = this.definition.body;
    const trunkWidth = width * TRUNK_FRACTION;
    const bottom = this.y + height / 2;
    return {
      left: this.x - trunkWidth / 2,
      right: this.x + trunkWidth / 2,
      top: bottom - height * TRUNK_FRACTION,
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
