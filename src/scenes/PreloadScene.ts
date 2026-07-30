import Phaser from 'phaser';
import { generatePlaceholderTextures } from './generateTextures';
import { bootIntoGame } from './bootFlow';

/**
 * The one thing that still has to be a scene before the world exists: the
 * placeholder textures are baked with Phaser's `Graphics`, so they need a live
 * scene to be drawn into. Everything after that is plain TypeScript.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    generatePlaceholderTextures(this);
    bootIntoGame(this.game);
  }
}
