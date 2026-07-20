import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { TOWN_MAP } from '../data/townMap';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import type { Mob } from '../entities/Mob';
import { TILESET_KEY } from './generateTextures';
import { TARGET_CLEARED_EVENT, TARGET_SELECTED_EVENT } from '../ui/uiEvents';

const RAT_SPAWN_OFFSETS: Array<[number, number]> = [
  [-96, -64],
  [96, -64],
  [-64, 96],
  [64, 96],
  [0, 128],
];

const SELECTION_RING_RADIUS = 18;
const SELECTION_RING_COLOR = 0xffee58;

export class TownScene extends Phaser.Scene {
  private player!: Player;
  private rats: Rat[] = [];
  private target: Mob | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;

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

    this.rats = RAT_SPAWN_OFFSETS.map(([dx, dy]) => {
      const rat = new Rat(this, worldWidth / 2 + dx, worldHeight / 2 + dy);
      rat.setInteractive();
      return rat;
    });

    this.selectionRing = this.add.graphics();
    this.selectionRing.setVisible(false);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.on('keydown-ESC', () => this.clearTarget());

    this.scene.launch('UI');
  }

  update(): void {
    this.player.update();
    this.rats.forEach((rat) => rat.update());
    this.updateSelectionRing();
  }

  private handlePointerDown(
    _pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ): void {
    const clickedRat = currentlyOver.find((obj): obj is Rat => obj instanceof Rat);
    if (clickedRat) {
      this.setTarget(clickedRat);
    } else {
      this.clearTarget();
    }
  }

  private setTarget(mob: Mob): void {
    this.target = mob;
    this.game.events.emit(TARGET_SELECTED_EVENT, 'Rat', mob.hp, mob.maxHp);
  }

  private clearTarget(): void {
    if (!this.target) return;
    this.target = null;
    this.selectionRing.setVisible(false);
    this.game.events.emit(TARGET_CLEARED_EVENT);
  }

  private updateSelectionRing(): void {
    if (!this.target) {
      return;
    }
    if (!this.target.isAlive()) {
      this.clearTarget();
      return;
    }
    this.selectionRing.clear();
    this.selectionRing.lineStyle(2, SELECTION_RING_COLOR, 1);
    this.selectionRing.strokeCircle(this.target.x, this.target.y, SELECTION_RING_RADIUS);
    this.selectionRing.setVisible(true);
  }
}
