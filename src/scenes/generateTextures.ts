import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { appearanceTextureKey, computeAppearance } from '../systems/AppearanceSystem';
import type { Appearance } from '../systems/AppearanceSystem';
import type { WeaponShapeId } from '../types/ids';

export const TILESET_KEY = 'tileset';

const NO_GEAR = { helmet: null, chest: null, pants: null, weapon: null };
const OUTLINE_COLOR = 0x14140f;

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  // the bare figure, so a Player always has a texture to construct against
  ensurePlayerTexture(scene, computeAppearance(NO_GEAR));
  generateRatTexture(scene);
  generateTreeTextures(scene);
  generateFishingSpotTexture(scene);
  generateCampfireTexture(scene);
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

// One baked texture per distinct look. The key covers everything drawn, so a
// cache hit is always safe and the handful of gear combinations stay cheap.
export function ensurePlayerTexture(scene: Phaser.Scene, appearance: Appearance): string {
  const key = appearanceTextureKey(appearance);
  if (scene.textures.exists(key)) {
    return key;
  }

  const size = TILE_SIZE;
  const figure = buildStickFigure(size);
  const graphics = scene.add.graphics();

  const torso = (): void => {
    graphics.lineBetween(figure.cx, figure.shoulderY, figure.cx, figure.hipY);
    graphics.lineBetween(figure.leftHandX, figure.shoulderY, figure.rightHandX, figure.shoulderY);
  };
  const legs = (): void => {
    graphics.lineBetween(figure.cx, figure.hipY, figure.cx - size * 0.13, figure.footY);
    graphics.lineBetween(figure.cx, figure.hipY, figure.cx + size * 0.13, figure.footY);
  };

  // Dark backing pass: without it a limb painted in gear color disappears into
  // terrain of the same color — brown armor standing on the brown path.
  graphics.lineStyle(figure.limbWidth + size * 0.03, OUTLINE_COLOR, 1);
  torso();
  legs();

  graphics.lineStyle(figure.limbWidth, appearance.torsoColor, 1);
  torso();
  graphics.lineStyle(figure.limbWidth, appearance.legColor, 1);
  legs();

  graphics.fillStyle(appearance.headColor, 1);
  graphics.fillCircle(figure.cx, figure.headCenterY, figure.headRadius);
  // white outline keeps the default black head readable against dark tiles
  graphics.lineStyle(size * 0.03, 0xffffff, 1);
  graphics.strokeCircle(figure.cx, figure.headCenterY, figure.headRadius);

  if (appearance.weapon) {
    drawWeapon(graphics, appearance.weapon.shape, appearance.weapon.color, figure, size);
  }

  graphics.generateTexture(key, size, size);
  graphics.destroy();
  return key;
}

// Weapons hang from the right hand and stay inside the size x size texture box,
// so swapping one never changes the sprite's physics body.
function drawWeapon(
  graphics: Phaser.GameObjects.Graphics,
  shape: WeaponShapeId,
  color: number,
  figure: StickFigure,
  size: number,
): void {
  const width = size * 0.035;
  // Same two-pass trick as the limbs: dark backing, then the item's own color.
  const passes: Array<[number, number]> = [
    [width + size * 0.03, OUTLINE_COLOR],
    [width, color],
  ];

  switch (shape) {
    case 'sword': {
      const tipY = figure.hipY + size * 0.15;
      const guardY = figure.shoulderY + size * 0.04;
      passes.forEach(([lineWidth, lineColor]) => {
        graphics.lineStyle(lineWidth, lineColor, 1);
        graphics.lineBetween(figure.rightHandX, figure.shoulderY, figure.rightHandX, tipY);
        graphics.lineBetween(
          figure.rightHandX - size * 0.05,
          guardY,
          figure.rightHandX + size * 0.05,
          guardY,
        );
      });
      break;
    }
    case 'wand': {
      const tipX = figure.rightHandX + size * 0.06;
      const tipY = figure.shoulderY - size * 0.22;
      passes.forEach(([lineWidth, lineColor]) => {
        graphics.lineStyle(lineWidth, lineColor, 1);
        graphics.lineBetween(figure.rightHandX, figure.shoulderY, tipX, tipY);
      });
      graphics.fillStyle(0xffd54f, 1);
      graphics.fillCircle(tipX, tipY, size * 0.045);
      break;
    }
    case 'pole': {
      // Angled back over the shoulder with a slack line, so it reads as a rod
      // rather than a spear at this size.
      const tipX = figure.rightHandX + size * 0.2;
      const tipY = figure.shoulderY - size * 0.28;
      passes.forEach(([lineWidth, lineColor]) => {
        graphics.lineStyle(lineWidth, lineColor, 1);
        graphics.lineBetween(figure.rightHandX - size * 0.06, figure.hipY, tipX, tipY);
      });
      graphics.lineStyle(size * 0.012, 0xeceff1, 0.9);
      graphics.lineBetween(tipX, tipY, tipX + size * 0.02, tipY + size * 0.16);
      break;
    }
    case 'axe': {
      const haftTopY = figure.shoulderY - size * 0.1;
      const haftBottomY = figure.hipY + size * 0.12;
      // wedge head, biting outward from the top of the haft
      const head: Array<[number, number]> = [
        [figure.rightHandX, haftTopY],
        [figure.rightHandX + size * 0.11, haftTopY + size * 0.05],
        [figure.rightHandX, haftTopY + size * 0.14],
      ];
      passes.forEach(([lineWidth, lineColor]) => {
        graphics.lineStyle(lineWidth, lineColor, 1);
        graphics.lineBetween(figure.rightHandX, haftTopY, figure.rightHandX, haftBottomY);
        graphics.fillStyle(lineColor, 1);
        graphics.fillTriangle(
          head[0][0],
          head[0][1],
          head[1][0],
          head[1][1],
          head[2][0],
          head[2][1],
        );
      });
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

// Trees stand a tile and a half tall so the canopy reads above the player, but
// the trunk is what the physics body covers — see ResourceNode.
function generateTreeTextures(scene: Phaser.Scene): void {
  const width = TILE_SIZE;
  const height = TILE_SIZE * 1.5;
  const trunkWidth = width * 0.18;
  const trunkTop = height * 0.55;

  const graphics = scene.add.graphics();
  const trunk = (): void => {
    graphics.fillStyle(0x5d4037, 1);
    graphics.fillRect(width / 2 - trunkWidth / 2, trunkTop, trunkWidth, height - trunkTop);
  };

  trunk();
  graphics.fillStyle(0x1b5e20, 1);
  graphics.fillCircle(width / 2, height * 0.34, width * 0.42);
  graphics.fillStyle(0x2e7d32, 1);
  graphics.fillCircle(width * 0.38, height * 0.28, width * 0.26);
  graphics.fillCircle(width * 0.64, height * 0.36, width * 0.22);
  graphics.generateTexture('tree', width, height);
  graphics.clear();

  // Same footprint as the tree so a depleted node swaps texture without the
  // sprite jumping; only the canopy is gone.
  trunk();
  graphics.fillStyle(0x6d4c41, 1);
  graphics.fillEllipse(width / 2, trunkTop, trunkWidth * 1.6, trunkWidth * 0.7);
  graphics.generateTexture('tree-stump', width, height);
  graphics.destroy();
}

// Ripple rings, drawn to sit on top of a water tile.
function generateFishingSpotTexture(scene: Phaser.Scene): void {
  const size = TILE_SIZE * 0.75;
  const graphics = scene.add.graphics();

  graphics.lineStyle(3, 0xe0f7fa, 0.85);
  graphics.strokeCircle(size / 2, size / 2, size * 0.42);
  graphics.lineStyle(2, 0xe0f7fa, 0.55);
  graphics.strokeCircle(size / 2, size / 2, size * 0.26);
  graphics.fillStyle(0xe0f7fa, 0.7);
  graphics.fillCircle(size / 2, size / 2, size * 0.08);

  graphics.generateTexture('fishing-spot', size, size);
  graphics.destroy();
}

// Crossed logs with a flame above them. Drawn around a centre origin so the
// Campfire's flicker tween scales it in place.
function generateCampfireTexture(scene: Phaser.Scene): void {
  const size = TILE_SIZE * 0.8;
  const graphics = scene.add.graphics();
  const cx = size / 2;
  const baseY = size * 0.72;

  graphics.lineStyle(size * 0.11, 0x5d4037, 1);
  graphics.lineBetween(
    cx - size * 0.28,
    baseY + size * 0.08,
    cx + size * 0.28,
    baseY - size * 0.08,
  );
  graphics.lineBetween(
    cx - size * 0.28,
    baseY - size * 0.08,
    cx + size * 0.28,
    baseY + size * 0.08,
  );

  graphics.fillStyle(0xe65100, 1);
  graphics.fillTriangle(cx, size * 0.14, cx - size * 0.26, baseY, cx + size * 0.26, baseY);
  graphics.fillStyle(0xffb300, 1);
  graphics.fillTriangle(cx, size * 0.34, cx - size * 0.15, baseY, cx + size * 0.15, baseY);
  graphics.fillStyle(0xfff59d, 0.9);
  graphics.fillTriangle(cx, size * 0.5, cx - size * 0.07, baseY, cx + size * 0.07, baseY);

  graphics.generateTexture('campfire', size, size);
  graphics.destroy();
}

// A single tileset image with tiles laid out side by side, since
// Phaser's Tilemap API indexes tiles into one tileset texture rather
// than accepting separate textures per tile.
function generateTilesetTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();

  drawGrassTile(graphics, 0);
  drawPathTile(graphics, 1);
  drawWaterTile(graphics, 2);

  graphics.generateTexture(TILESET_KEY, TILE_SIZE * 3, TILE_SIZE);
  graphics.destroy();
}

function drawWaterTile(graphics: Phaser.GameObjects.Graphics, index: number): void {
  const x = index * TILE_SIZE;
  graphics.fillStyle(0x1565c0, 1);
  graphics.fillRect(x, 0, TILE_SIZE, TILE_SIZE);

  // a couple of lighter wave strokes so the surface isn't a flat block of blue
  graphics.lineStyle(2, 0x64b5f6, 0.5);
  const waveFractions: Array<[number, number]> = [
    [0.15, 0.3],
    [0.5, 0.62],
  ];
  waveFractions.forEach(([wx, wy]) => {
    graphics.lineBetween(
      x + wx * TILE_SIZE,
      wy * TILE_SIZE,
      x + (wx + 0.34) * TILE_SIZE,
      wy * TILE_SIZE,
    );
  });

  graphics.lineStyle(1, 0x000000, 0.15);
  graphics.strokeRect(x, 0, TILE_SIZE, TILE_SIZE);
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
