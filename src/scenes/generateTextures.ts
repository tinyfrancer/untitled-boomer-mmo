import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';

export const TILESET_KEY = 'tileset';

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  generatePlayerTexture(scene, 'player-warrior', 0x3d5afe);
  generatePlayerTexture(scene, 'player-wizard', 0x7c3aed);
  generateRatTexture(scene);
  generateTilesetTexture(scene);
}

function generatePlayerTexture(scene: Phaser.Scene, key: string, color: number): void {
  const size = TILE_SIZE;
  const radius = size / 2 - 2;
  const graphics = scene.add.graphics();
  graphics.fillStyle(color, 1);
  graphics.fillCircle(size / 2, size / 2, radius);
  graphics.lineStyle(2, 0xffffff, 1);
  graphics.strokeCircle(size / 2, size / 2, radius);
  graphics.fillStyle(0xffffff, 1);
  graphics.fillTriangle(
    size / 2,
    size / 2 - radius + 2,
    size / 2 - 5,
    size / 2 - 2,
    size / 2 + 5,
    size / 2 - 2,
  );
  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function generateRatTexture(scene: Phaser.Scene): void {
  const width = TILE_SIZE * 0.8;
  const height = TILE_SIZE * 0.6;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x6d4c41, 1);
  graphics.fillEllipse(width / 2, height / 2, width, height);
  graphics.fillTriangle(width * 0.25, height * 0.2, width * 0.15, 0, width * 0.35, height * 0.05);
  graphics.fillTriangle(width * 0.65, height * 0.05, width * 0.75, 0, width * 0.85, height * 0.2);
  graphics.generateTexture('rat', width, height);
  graphics.destroy();
}

// A single tileset image with tiles laid out side by side, since
// Phaser's Tilemap API indexes tiles into one tileset texture rather
// than accepting separate textures per tile.
function generateTilesetTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();

  drawTile(graphics, 0, 0x2e7d32); // index 0: grass
  drawTile(graphics, 1, 0x8d6e63); // index 1: path

  graphics.generateTexture(TILESET_KEY, TILE_SIZE * 2, TILE_SIZE);
  graphics.destroy();
}

function drawTile(graphics: Phaser.GameObjects.Graphics, index: number, color: number): void {
  const x = index * TILE_SIZE;
  graphics.fillStyle(color, 1);
  graphics.fillRect(x, 0, TILE_SIZE, TILE_SIZE);
  graphics.lineStyle(1, 0x000000, 0.15);
  graphics.strokeRect(x, 0, TILE_SIZE, TILE_SIZE);
}
