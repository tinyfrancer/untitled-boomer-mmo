import Phaser from 'phaser';
import { MAX_CHARACTER_LEVEL, TILE_SIZE } from '../config/constants';
import { TOWN_MAP } from '../data/townMap';
import { xpToReachLevel } from '../data/xpTable';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import type { Mob } from '../entities/Mob';
import { TILESET_KEY } from './generateTextures';
import {
  LEVEL_UP_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  XP_GAINED_EVENT,
} from '../ui/uiEvents';
import { isCooldownReady, isInRange, resolveAttack } from '../systems/CombatSystem';
import { addXp, type LevelState } from '../systems/LevelingSystem';

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
  private lastAttackAt = 0;
  private playerLevelState: LevelState = { level: 1, xp: 0 };

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

  update(time: number): void {
    this.player.update();
    this.rats.forEach((rat) => rat.update());
    this.updateSelectionRing();
    this.updateCombat(time);
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

  private updateCombat(time: number): void {
    if (!this.target || !this.target.isAlive()) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.target.x,
      this.target.y,
    );
    if (!isInRange(distance, this.player.attackRange)) {
      return;
    }
    if (!isCooldownReady(time - this.lastAttackAt, this.player.attackCooldownMs)) {
      return;
    }

    this.lastAttackAt = time;
    const { damage } = resolveAttack({ attackPower: this.player.attackPower });
    this.showDamageNumber(this.target.x, this.target.y, damage);
    const xpReward = this.target.xpReward;
    this.target.takeDamage(damage);
    if (!this.target.isAlive()) {
      this.awardXp(xpReward);
    }
  }

  private awardXp(amount: number): void {
    const result = addXp(this.playerLevelState, amount);
    this.playerLevelState = result.state;

    const nextLevel = Math.min(this.playerLevelState.level + 1, MAX_CHARACTER_LEVEL);
    const xpToNext =
      this.playerLevelState.level >= MAX_CHARACTER_LEVEL ? 0 : xpToReachLevel(nextLevel);
    this.game.events.emit(
      XP_GAINED_EVENT,
      this.playerLevelState.level,
      this.playerLevelState.xp,
      xpToNext,
    );

    if (result.leveledUp) {
      this.game.events.emit(LEVEL_UP_EVENT, this.playerLevelState.level);
    }
  }

  private showDamageNumber(x: number, y: number, amount: number): void {
    const text = this.add
      .text(x, y - 20, `-${amount}`, {
        fontSize: '14px',
        color: '#ffee58',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }
}
