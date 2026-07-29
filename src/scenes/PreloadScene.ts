import Phaser from 'phaser';
import { generatePlaceholderTextures } from './generateTextures';
import { saveService } from '../persistence';
import { startGame } from '../world/GameContext';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    generatePlaceholderTextures(this);

    const savedCharacter = saveService.load();
    if (savedCharacter) {
      startGame({ character: savedCharacter, events: this.game.events });
      this.scene.start('Zone');
    } else {
      this.scene.start('CharacterCreate');
    }
  }
}
