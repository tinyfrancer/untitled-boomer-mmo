import Phaser from 'phaser';
import { generatePlaceholderTextures } from './generateTextures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    generatePlaceholderTextures(this);

    // TODO: once CharacterCreateScene/SaveService exist, route to
    // CharacterCreateScene when there's no save, else load and go to Town.
    this.scene.start('Town');
  }
}
