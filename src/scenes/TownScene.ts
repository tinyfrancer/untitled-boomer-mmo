import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { TOWN_MAP } from '../data/townMap';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import type { Mob } from '../entities/Mob';
import { TILESET_KEY } from './generateTextures';
import {
  EQUIP_ITEM_REQUESTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  MOVE_VECTOR_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
} from '../ui/uiEvents';
import { isCooldownReady, isInRange, resolveAttack } from '../systems/CombatSystem';
import { addXp, xpToNextLevel } from '../systems/LevelingSystem';
import { rollLootTable } from '../systems/LootSystem';
import { addItemToInventory, equipItem, unequipItem } from '../systems/InventorySystem';
import { createNewCharacter, saveService, type CharacterState } from '../persistence';
import type { GearSlotId } from '../types/ids';

const RAT_SPAWN_OFFSETS: Array<[number, number]> = [
  [-96, -64],
  [96, -64],
  [-64, 96],
  [64, 96],
  [0, 128],
];

const SELECTION_RING_RADIUS = 18;
const SELECTION_RING_COLOR = 0xffee58;
const AUTOSAVE_INTERVAL_MS = 30000;

export class TownScene extends Phaser.Scene {
  private player!: Player;
  private rats: Rat[] = [];
  private target: Mob | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private lastAttackAt = 0;
  private characterState!: CharacterState;
  private handleWindowUnload = (): void => this.persistCharacter();

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

    this.characterState =
      (this.registry.get('character') as CharacterState | undefined) ??
      createNewCharacter('Adventurer', 'warrior');

    this.player = new Player(
      this,
      worldWidth / 2,
      worldHeight / 2,
      this.characterState.classId,
      this.characterState.gear,
    );
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
    this.input.keyboard?.on('keydown-F9', () => this.resetCharacter());
    this.game.events.on(MOVE_VECTOR_EVENT, this.handleMoveVector, this);
    this.game.events.on(EQUIP_ITEM_REQUESTED_EVENT, this.handleEquipRequested, this);
    this.game.events.on(UNEQUIP_SLOT_REQUESTED_EVENT, this.handleUnequipRequested, this);

    this.add
      .text(16, 72, 'F9: Reset Character (dev)', {
        fontSize: '10px',
        color: '#999999',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.time.addEvent({
      delay: AUTOSAVE_INTERVAL_MS,
      loop: true,
      callback: () => this.persistCharacter(),
    });
    window.addEventListener('pagehide', this.handleWindowUnload);
    window.addEventListener('beforeunload', this.handleWindowUnload);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pagehide', this.handleWindowUnload);
      window.removeEventListener('beforeunload', this.handleWindowUnload);
      this.game.events.off(MOVE_VECTOR_EVENT, this.handleMoveVector, this);
      this.game.events.off(EQUIP_ITEM_REQUESTED_EVENT, this.handleEquipRequested, this);
      this.game.events.off(UNEQUIP_SLOT_REQUESTED_EVENT, this.handleUnequipRequested, this);
    });

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

  private handleMoveVector(x: number, y: number): void {
    this.player.setTouchVector(x, y);
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
    const lootTableId = this.target.lootTableId;
    this.target.takeDamage(damage);
    if (!this.target.isAlive()) {
      this.awardXp(xpReward);
      this.grantLoot(lootTableId);
    }
  }

  private awardXp(amount: number): void {
    const result = addXp({ level: this.characterState.level, xp: this.characterState.xp }, amount);
    this.characterState.level = result.state.level;
    this.characterState.xp = result.state.xp;

    this.game.events.emit(
      XP_GAINED_EVENT,
      this.characterState.level,
      this.characterState.xp,
      xpToNextLevel(this.characterState.level),
    );

    if (result.leveledUp) {
      this.game.events.emit(LEVEL_UP_EVENT, this.characterState.level);
      this.persistCharacter();
    }
  }

  private grantLoot(lootTableId?: string): void {
    if (!lootTableId) return;
    const drops = rollLootTable(lootTableId);
    if (drops.length === 0) return;

    drops.forEach((drop) => {
      this.characterState.inventory = addItemToInventory(
        this.characterState.inventory,
        drop.itemId,
        drop.quantity,
      );
    });
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.characterState.inventory);
  }

  private handleEquipRequested(itemId: string): void {
    const result = equipItem(this.characterState.gear, this.characterState.inventory, itemId);
    this.characterState.gear = result.gear;
    this.characterState.inventory = result.inventory;
    this.player.setGear(this.characterState.gear);
    this.game.events.emit(GEAR_CHANGED_EVENT, this.characterState.gear);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.characterState.inventory);
  }

  private handleUnequipRequested(slot: GearSlotId): void {
    const result = unequipItem(this.characterState.gear, this.characterState.inventory, slot);
    this.characterState.gear = result.gear;
    this.characterState.inventory = result.inventory;
    this.player.setGear(this.characterState.gear);
    this.game.events.emit(GEAR_CHANGED_EVENT, this.characterState.gear);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.characterState.inventory);
  }

  private persistCharacter(): void {
    this.characterState.position = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    this.characterState.updatedAt = new Date().toISOString();
    saveService.save(this.characterState);
  }

  private resetCharacter(): void {
    saveService.clear();
    this.registry.remove('character');
    this.scene.stop('UI');
    this.scene.start('CharacterCreate');
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
