import Phaser from 'phaser';
import type { ResourceNode } from '../world/ResourceNode';

/**
 * What draws a ResourceNode: the full sprite while it has charges, the stump
 * texture (or nothing, for a node without one) while it is spent.
 */
export class ResourceNodeSprite extends Phaser.GameObjects.Sprite {
  readonly node: ResourceNode;
  private drawnAvailable = true;

  constructor(scene: Phaser.Scene, node: ResourceNode) {
    super(scene, node.x, node.y, node.definition.textureKey);
    scene.add.existing(this);

    this.node = node;
    this.name = node.name;
    // A fishing spot is a marking on the water, not an object: nothing to walk
    // into, and drawn under the player rather than over their feet.
    if (!node.definition.solid) {
      this.setDepth(-1);
    }
  }

  sync(): void {
    const available = this.node.isAvailable();
    if (available === this.drawnAvailable) return;
    this.drawnAvailable = available;

    const { textureKey, depletedTextureKey } = this.node.definition;
    if (available) {
      this.setTexture(textureKey);
      this.setVisible(true);
      return;
    }
    if (depletedTextureKey) {
      this.setTexture(depletedTextureKey);
    } else {
      this.setVisible(false);
    }
  }
}
