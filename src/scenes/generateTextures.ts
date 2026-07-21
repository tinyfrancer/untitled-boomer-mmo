import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { CLASSES } from '../data/classes';
import type { ClassId } from '../types/ids';

export const TILESET_KEY = 'tileset';

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  Object.values(CLASSES).forEach((classDef) => {
    generatePlayerTexture(scene, classDef.id, classDef.textureKey, classDef.color);
  });
  generateRatTexture(scene);
  generateTilesetTexture(scene);
}

// Landmark points of the stick figure, expressed as fractions of TILE_SIZE so the
// whole rig (and the class accessories anchored to it) scale cleanly with tile size.
interface StickFigure {
  cx: number;
  headCenterY: number;
  headRadius: number;
  shoulderY: number;
  hipY: number;
  footY: number;
  leftHandX: number;
  rightHandX: number;
  limbWidth: number;
}

function buildStickFigure(size: number): StickFigure {
  const cx = size / 2;
  const headRadius = size * 0.11;
  const headCenterY = size * 0.18;
  return {
    cx,
    headCenterY,
    headRadius,
    shoulderY: headCenterY + headRadius + size * 0.03,
    hipY: size * 0.6,
    footY: size * 0.92,
    leftHandX: cx - size * 0.22,
    rightHandX: cx + size * 0.22,
    limbWidth: size * 0.055,
  };
}

// Body skeleton is shared across classes; each class id adds its own accessory
// shapes on top so silhouettes read as distinct at a glance, not just by color.
function generatePlayerTexture(
  scene: Phaser.Scene,
  classId: ClassId,
  key: string,
  color: number,
): void {
  const size = TILE_SIZE;
  const figure = buildStickFigure(size);
  const graphics = scene.add.graphics();

  graphics.lineStyle(figure.limbWidth, color, 1);
  graphics.lineBetween(figure.cx, figure.shoulderY, figure.cx, figure.hipY); // torso
  graphics.lineBetween(figure.leftHandX, figure.shoulderY, figure.rightHandX, figure.shoulderY); // arms
  graphics.lineBetween(
    figure.cx,
    figure.hipY,
    figure.cx - size * 0.13,
    figure.footY,
  ); // left leg
  graphics.lineBetween(
    figure.cx,
    figure.hipY,
    figure.cx + size * 0.13,
    figure.footY,
  ); // right leg

  graphics.fillStyle(color, 1);
  graphics.fillCircle(figure.cx, figure.headCenterY, figure.headRadius);
  graphics.lineStyle(size * 0.03, 0xffffff, 1);
  graphics.strokeCircle(figure.cx, figure.headCenterY, figure.headRadius);

  drawClassAccessory(graphics, classId, figure, size);

  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function drawClassAccessory(
  graphics: Phaser.GameObjects.Graphics,
  classId: ClassId,
  figure: StickFigure,
  size: number,
): void {
  switch (classId) {
    case 'warrior': {
      // helmet band across the top of the head
      graphics.fillStyle(0xb0bec5, 1);
      graphics.fillRect(
        figure.cx - figure.headRadius,
        figure.headCenterY - figure.headRadius * 0.6,
        figure.headRadius * 2,
        figure.headRadius * 0.5,
      );
      // sword held in the right hand, blade down, with a small crossguard
      const swordTipY = figure.hipY + size * 0.15;
      graphics.lineStyle(size * 0.035, 0xcfd8dc, 1);
      graphics.lineBetween(figure.rightHandX, figure.shoulderY, figure.rightHandX, swordTipY);
      graphics.lineBetween(
        figure.rightHandX - size * 0.05,
        figure.shoulderY + size * 0.04,
        figure.rightHandX + size * 0.05,
        figure.shoulderY + size * 0.04,
      );
      break;
    }
    case 'wizard': {
      // pointed hat above the head
      const hatBaseY = figure.headCenterY - figure.headRadius * 0.3;
      graphics.fillStyle(0x4a148c, 1);
      graphics.fillTriangle(
        figure.cx,
        figure.headCenterY - figure.headRadius - size * 0.14,
        figure.cx - figure.headRadius * 1.3,
        hatBaseY,
        figure.cx + figure.headRadius * 1.3,
        hatBaseY,
      );
      // staff held in the left hand, angled up, with a glowing tip
      const staffTipX = figure.leftHandX - size * 0.06;
      const staffTipY = figure.shoulderY - size * 0.25;
      graphics.lineStyle(size * 0.035, 0x8d6e63, 1);
      graphics.lineBetween(figure.leftHandX, figure.shoulderY, staffTipX, staffTipY);
      graphics.fillStyle(0xffd54f, 1);
      graphics.fillCircle(staffTipX, staffTipY, size * 0.045);
      break;
    }
  }
}

function generateRatTexture(scene: Phaser.Scene): void {
  const width = TILE_SIZE * 0.8;
  const height = TILE_SIZE * 0.6;
  const graphics = scene.add.graphics();

  // tail
  graphics.lineStyle(2, 0x6d4c41, 1);
  graphics.lineBetween(width * 0.15, height * 0.6, -width * 0.25, height * 0.75);

  graphics.fillStyle(0x6d4c41, 1);
  graphics.fillEllipse(width / 2, height / 2, width, height);
  graphics.fillTriangle(width * 0.25, height * 0.2, width * 0.15, 0, width * 0.35, height * 0.05);
  graphics.fillTriangle(width * 0.65, height * 0.05, width * 0.75, 0, width * 0.85, height * 0.2);

  // eyes
  const eyeRadius = TILE_SIZE * 0.05;
  graphics.fillStyle(0x000000, 1);
  graphics.fillCircle(width * 0.68, height * 0.4, eyeRadius);
  graphics.fillCircle(width * 0.8, height * 0.42, eyeRadius);

  graphics.generateTexture('rat', width, height);
  graphics.destroy();
}

// A single tileset image with tiles laid out side by side, since
// Phaser's Tilemap API indexes tiles into one tileset texture rather
// than accepting separate textures per tile.
function generateTilesetTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();

  drawGrassTile(graphics, 0);
  drawPathTile(graphics, 1);

  graphics.generateTexture(TILESET_KEY, TILE_SIZE * 2, TILE_SIZE);
  graphics.destroy();
}

function drawGrassTile(graphics: Phaser.GameObjects.Graphics, index: number): void {
  const x = index * TILE_SIZE;
  graphics.fillStyle(0x2e7d32, 1);
  graphics.fillRect(x, 0, TILE_SIZE, TILE_SIZE);

  // scattered darker flecks so the field doesn't read as a flat color
  graphics.fillStyle(0x1b5e20, 0.5);
  const fleckFractions: Array<[number, number]> = [
    [0.125, 0.19],
    [0.56, 0.125],
    [0.31, 0.44],
    [0.75, 0.63],
    [0.19, 0.81],
    [0.63, 0.84],
  ];
  const fleckSize = TILE_SIZE * 0.06;
  fleckFractions.forEach(([fx, fy]) =>
    graphics.fillRect(x + fx * TILE_SIZE, fy * TILE_SIZE, fleckSize, fleckSize),
  );

  graphics.lineStyle(1, 0x000000, 0.15);
  graphics.strokeRect(x, 0, TILE_SIZE, TILE_SIZE);
}

function drawPathTile(graphics: Phaser.GameObjects.Graphics, index: number): void {
  const x = index * TILE_SIZE;
  graphics.fillStyle(0x8d6e63, 1);
  graphics.fillRect(x, 0, TILE_SIZE, TILE_SIZE);

  // a few pebbles for texture
  graphics.fillStyle(0x6d4c41, 0.6);
  const pebbleFractions: Array<[number, number, number]> = [
    [0.22, 0.28, 0.06],
    [0.66, 0.19, 0.045],
    [0.44, 0.56, 0.06],
    [0.78, 0.72, 0.045],
  ];
  pebbleFractions.forEach(([px, py, pr]) =>
    graphics.fillCircle(x + px * TILE_SIZE, py * TILE_SIZE, pr * TILE_SIZE),
  );

  graphics.lineStyle(1, 0x000000, 0.15);
  graphics.strokeRect(x, 0, TILE_SIZE, TILE_SIZE);
}
