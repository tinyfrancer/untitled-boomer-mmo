import Phaser from 'phaser';
import type { ResourceNodeDefinition } from '../data/resourceNodes';

/**
 * A gatherable thing in the world: a tree, a fishing spot. Deliberately much
 * thinner than Mob — no AI, no health bar, no combat. It owns only how many
 * gathers are left in it and when it comes back.
 */
export class ResourceNode extends Phaser.Physics.Arcade.Sprite {
  readonly definition: ResourceNodeDefinition;
  private chargesLeft: number;
  private depleted = false;

  constructor(scene: Phaser.Scene, x: number, y: number, definition: ResourceNodeDefinition) {
    super(scene, x, y, definition.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.definition = definition;
    this.name = definition.name;
    this.chargesLeft = definition.charges ?? Number.POSITIVE_INFINITY;

    if (definition.solid) {
      // Only the trunk blocks movement — walking "behind" a tree means walking
      // through its canopy, which is the usual top-down convention.
      const body = this.body as Phaser.Physics.Arcade.StaticBody;
      const trunkWidth = this.width * 0.3;
      const trunkHeight = this.height * 0.3;
      body.setSize(trunkWidth, trunkHeight);
      body.setOffset((this.width - trunkWidth) / 2, this.height - trunkHeight);
      body.updateFromGameObject();
    } else {
      // A fishing spot is a marking on the water, not an object: no body, and
      // drawn under the player rather than over their feet.
      (this.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.setDepth(-1);
    }
  }

  isAvailable(): boolean {
    return !this.depleted;
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

  private deplete(): void {
    this.depleted = true;
    if (this.definition.depletedTextureKey) {
      this.setTexture(this.definition.depletedTextureKey);
    } else {
      this.setVisible(false);
    }
    if (this.definition.solid) {
      // A stump is still solid; only its charges are gone.
      (this.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    }

    this.scene.time.delayedCall(this.definition.respawnDelayMs, () => this.respawn());
  }

  private respawn(): void {
    this.depleted = false;
    this.chargesLeft = this.definition.charges ?? Number.POSITIVE_INFINITY;
    this.setTexture(this.definition.textureKey);
    this.setVisible(true);
    if (this.definition.solid) {
      (this.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    }
  }
}
