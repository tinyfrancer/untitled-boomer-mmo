import Phaser from 'phaser';
import { generatePlaceholderTextures } from './generateTextures';
import { saveService } from '../persistence';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    generatePlaceholderTextures(this);

    const savedCharacter = saveService.load();
    if (savedCharacter) {
      this.registry.set('character', savedCharacter);
      this.scene.start('Zone');
    } else {
      this.scene.start('CharacterCreate');
    }
  }
}
