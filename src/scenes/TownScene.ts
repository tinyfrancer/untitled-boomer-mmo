import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { TOWN_MAP } from '../data/townMap';
import { Player } from '../entities/Player';
import { TILESET_KEY } from './generateTextures';

export class TownScene extends Phaser.Scene {
  private player!: Player;

  constructor() {
    super('Town');
  }

  create(): void {
    const tilemap = this.make.tilemap({
      data: TOWN_MAP,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) {
      throw new Error(`Failed to register tileset image "${TILESET_KEY}"`);
    }
    const groundLayer = tilemap.createLayer(0, tileset, 0, 0);
    if (!groundLayer) {
      throw new Error('Failed to create ground layer');
    }

    const worldWidth = tilemap.widthInPixels;
    const worldHeight = tilemap.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    this.player = new Player(this, worldWidth / 2, worldHeight / 2, 'player-warrior');
    this.cameras.main.startFollow(this.player, true);
  }

  update(): void {
    this.player.update();
  }
}
