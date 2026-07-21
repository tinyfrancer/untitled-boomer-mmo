import Phaser from 'phaser';
import { generatePlaceholderTextures } from './generateTextures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    generatePlaceholderTextures(this);

    // TODO(task 13): once SaveService exists, skip straight to Town (with
    // the saved character loaded) when a save is present.
    this.scene.start('CharacterCreate');
  }
}
