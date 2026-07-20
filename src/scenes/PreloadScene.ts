import Phaser from 'phaser';
import { generatePlaceholderTextures } from './generateTextures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    generatePlaceholderTextures(this);

    // Temporary until CharacterCreateScene/TownScene exist to take over
    // routing — proves texture generation actually rendered something.
    this.add.sprite(this.scale.width / 2, this.scale.height / 2, 'player-warrior');
  }
}
