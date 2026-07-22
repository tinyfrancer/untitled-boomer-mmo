import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { BLOCKING_TILES, TOWN_MAP } from '../data/townMap';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { TOWN_NODE_SPAWNS, TOWN_RAT_SPAWNS } from '../data/spawns';
import { Player } from '../entities/Player';
import { Rat } from '../entities/Rat';
import { ResourceNode } from '../entities/ResourceNode';
import type { Mob } from '../entities/Mob';
import { TILESET_KEY } from './generateTextures';
import {
  ACTIONS_CHANGED_EVENT,
  COOK_REQUESTED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GATHER_ENDED_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  GATHER_PROGRESS_EVENT,
  GATHER_REFUSED_EVENT,
  GATHER_STARTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  MOVE_VECTOR_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  SKILL_XP_GAINED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
} from '../ui/uiEvents';
import { THEME, fontPx, px, scenePxScale } from '../ui/theme';
import { isCooldownReady, isInRange, resolveAttack } from '../systems/CombatSystem';
import { conColor } from '../systems/EnemySystem';
import { addXp, xpToNextLevel } from '../systems/LevelingSystem';
import { rollLootTable } from '../systems/LootSystem';
import {
  addItemToInventory,
  equipItem,
  removeItemFromInventory,
  unequipItem,
} from '../systems/InventorySystem';
import { canCook, findCookableItem, rollCook } from '../systems/CookingSystem';
import { Campfire } from '../entities/Campfire';
import { FIRE_COOK_RADIUS, FIRE_INPUT_ITEM_ID } from '../data/recipes';
import { consumableFor } from '../data/items';
import {
  advanceGather,
  beginGather,
  canGather,
  rollGatherQuantity,
  type GatherState,
} from '../systems/GatherSystem';
import { addSkillXp, skillLevel, skillXpToNextLevel } from '../systems/SkillSystem';
import { createNewCharacter, saveService, type CharacterState } from '../persistence';
import type { GearSlotId, SkillId } from '../types/ids';

const GROUND_DEPTH = -10;
const SELECTION_RING_RADIUS = 36;
const SELECTION_RING_COLOR = 0xffee58;
const AUTOSAVE_INTERVAL_MS = 30000;

export class TownScene extends Phaser.Scene {
  private player!: Player;
  private rats: Rat[] = [];
  private nodes: ResourceNode[] = [];
  private gatherState: GatherState | null = null;
  private gatherNode: ResourceNode | null = null;
  private campfire: Campfire | null = null;
  private lastActions = { canLightFire: false, canCook: false };
  private target: Mob | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private lastAttackAt = 0;
  private spawnPoint = new Phaser.Math.Vector2();
  private lastReportedHp = 0;
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
    // Below everything, so flat decals drawn onto the terrain (fishing spots)
    // can sit at a negative depth and still be visible above it.
    groundLayer.setDepth(GROUND_DEPTH);

    const worldWidth = tilemap.widthInPixels;
    const worldHeight = tilemap.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    this.characterState =
      (this.registry.get('character') as CharacterState | undefined) ??
      createNewCharacter('Adventurer', 'warrior');

    this.spawnPoint.set(worldWidth / 2, worldHeight / 2);
    this.player = new Player(
      this,
      this.spawnPoint.x,
      this.spawnPoint.y,
      this.characterState.classId,
      this.characterState.gear,
      this.characterState.name,
      this.characterState.level,
    );
    this.lastReportedHp = this.player.hp;
    this.cameras.main.startFollow(this.player, true);

    this.rats = TOWN_RAT_SPAWNS.map(({ dx, dy, level }) => {
      const rat = new Rat(
        this,
        this.spawnPoint.x + dx,
        this.spawnPoint.y + dy,
        level,
        this.characterState.level,
      );
      rat.setInteractive();
      return rat;
    });

    this.nodes = TOWN_NODE_SPAWNS.map(({ dx, dy, nodeId }) => {
      const node = new ResourceNode(
        this,
        this.spawnPoint.x + dx,
        this.spawnPoint.y + dy,
        RESOURCE_NODES[nodeId],
      );
      node.setInteractive();
      return node;
    });

    // Nothing walks into the pond.
    groundLayer.setCollision(BLOCKING_TILES);
    this.physics.add.collider(this.player, groundLayer);
    this.rats.forEach((rat) => this.physics.add.collider(rat, groundLayer));
    const solidNodes = this.nodes.filter((node) => node.definition.solid);
    solidNodes.forEach((node) => {
      this.physics.add.collider(this.player, node);
      this.rats.forEach((rat) => this.physics.add.collider(rat, node));
    });

    this.selectionRing = this.add.graphics();
    this.selectionRing.setVisible(false);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.on('keydown-ESC', () => this.clearTarget());
    this.input.keyboard?.on('keydown-F9', () => this.resetCharacter());
    this.game.events.on(MOVE_VECTOR_EVENT, this.handleMoveVector, this);
    this.game.events.on(EQUIP_ITEM_REQUESTED_EVENT, this.handleEquipRequested, this);
    this.game.events.on(UNEQUIP_SLOT_REQUESTED_EVENT, this.handleUnequipRequested, this);
    this.game.events.on(EAT_ITEM_REQUESTED_EVENT, this.handleEatRequested, this);
    this.game.events.on(COOK_REQUESTED_EVENT, this.handleCookRequested, this);
    this.game.events.on(LIGHT_FIRE_REQUESTED_EVENT, this.handleLightFireRequested, this);

    // bottom edge, clear of the joystick corner and the HUD's top-left column
    const uiScale = scenePxScale(this);
    this.add
      .text(px(200, uiScale), this.scale.height - px(24, uiScale), 'F9: Reset Character (dev)', {
        fontSize: fontPx(THEME.font.xs, uiScale),
        color: THEME.color.dim,
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
      this.game.events.off(EAT_ITEM_REQUESTED_EVENT, this.handleEatRequested, this);
      this.game.events.off(COOK_REQUESTED_EVENT, this.handleCookRequested, this);
      this.game.events.off(LIGHT_FIRE_REQUESTED_EVENT, this.handleLightFireRequested, this);
    });

    this.scene.launch('UI');
  }

  update(time: number, delta: number): void {
    this.player.update(delta);
    this.rats.forEach((rat) => rat.update(this.player.x, this.player.y));
    this.updateSelectionRing();
    this.updateGathering(delta);
    this.updateCombat(time);
    this.updateEnemyAttacks(time);
    this.publishPlayerHp();
    this.publishActions();
  }

  private handlePointerDown(
    _pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ): void {
    const clickedNode = currentlyOver.find(
      (obj): obj is ResourceNode => obj instanceof ResourceNode,
    );
    if (clickedNode) {
      this.clearTarget();
      this.startGathering(clickedNode);
      return;
    }

    // Any other click ends a gather: picking a fight or walking off is a choice
    // to stop chopping.
    this.stopGathering();

    const clickedRat = currentlyOver.find((obj): obj is Rat => obj instanceof Rat);
    if (clickedRat) {
      this.setTarget(clickedRat);
    } else {
      this.clearTarget();
    }
  }

  private startGathering(node: ResourceNode): void {
    if (!node.isAvailable()) {
      this.game.events.emit(GATHER_REFUSED_EVENT, `The ${node.definition.name} is spent.`);
      return;
    }

    const check = canGather(node.definition, this.characterState.skills, this.characterState.gear);
    if (!check.ok) {
      this.game.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }

    this.gatherNode = node;
    this.gatherState = beginGather(
      node.definition,
      skillLevel(this.characterState.skills, node.definition.skill),
    );
    this.game.events.emit(GATHER_STARTED_EVENT, node.definition.name);
  }

  private stopGathering(): void {
    if (!this.gatherState) return;
    this.gatherState = null;
    this.gatherNode = null;
    this.game.events.emit(GATHER_ENDED_EVENT);
  }

  private updateGathering(delta: number): void {
    if (!this.gatherState || !this.gatherNode) return;

    const node = this.gatherNode;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
    const outcome = advanceGather(this.gatherState, delta, distance);

    if (outcome.status === 'gathering') {
      this.gatherState = outcome.state;
      this.game.events.emit(GATHER_PROGRESS_EVENT, outcome.progress);
      return;
    }

    if (outcome.status === 'cancelled') {
      this.stopGathering();
      return;
    }

    this.completeGather(node);
  }

  private completeGather(node: ResourceNode): void {
    const { definition } = node;
    const level = skillLevel(this.characterState.skills, definition.skill);

    const quantity = rollGatherQuantity(level);
    this.characterState.inventory = addItemToInventory(
      this.characterState.inventory,
      definition.yieldItemId,
      quantity,
    );
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.characterState.inventory);
    this.awardSkillXp(definition.skill, definition.xpReward);

    const emptied = node.consumeCharge();
    if (emptied) {
      this.stopGathering();
      return;
    }

    // Auto-repeat: re-arm the channel so gathering runs unattended until
    // something interrupts it.
    this.gatherState = beginGather(
      definition,
      skillLevel(this.characterState.skills, definition.skill),
    );
    this.game.events.emit(GATHER_PROGRESS_EVENT, 0);
  }

  private isNearFire(): boolean {
    if (!this.campfire?.isLit()) return false;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.campfire.x,
      this.campfire.y,
    );
    return distance <= FIRE_COOK_RADIUS;
  }

  // The action bar is driven off what is actually possible right now, so it can
  // show only the buttons that would succeed. Emitted on change rather than
  // every frame, the same way player HP is.
  private publishActions(): void {
    const next = {
      canLightFire:
        !this.isNearFire() && (this.characterState.inventory[FIRE_INPUT_ITEM_ID] ?? 0) > 0,
      canCook: this.isNearFire() && findCookableItem(this.characterState.inventory) !== null,
    };
    if (
      next.canLightFire === this.lastActions.canLightFire &&
      next.canCook === this.lastActions.canCook
    ) {
      return;
    }
    this.lastActions = next;
    this.game.events.emit(ACTIONS_CHANGED_EVENT, next);
  }

  private handleLightFireRequested(): void {
    if ((this.characterState.inventory[FIRE_INPUT_ITEM_ID] ?? 0) <= 0) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'You have no logs to burn.');
      return;
    }

    // One fire at a time: lighting a new one replaces the old, rather than
    // letting the player carpet the town in campfires.
    this.campfire?.extinguish();
    this.characterState.inventory = removeItemFromInventory(
      this.characterState.inventory,
      FIRE_INPUT_ITEM_ID,
      1,
    );
    this.campfire = new Campfire(this, this.player.x, this.player.y + 32);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.characterState.inventory);
  }

  private handleCookRequested(): void {
    const recipe = findCookableItem(this.characterState.inventory);
    if (!recipe) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'You have nothing to cook.');
      return;
    }

    const check = canCook(
      recipe,
      this.characterState.skills,
      this.characterState.inventory,
      this.isNearFire(),
    );
    if (!check.ok) {
      this.game.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }

    const result = rollCook(recipe, skillLevel(this.characterState.skills, 'cooking'));
    this.characterState.inventory = addItemToInventory(
      removeItemFromInventory(this.characterState.inventory, recipe.inputItemId, 1),
      result.itemId,
      1,
    );
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.characterState.inventory);
    if (result.burnt) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'You burn it.');
    } else {
      this.awardSkillXp('cooking', result.xp);
    }
  }

  private handleEatRequested(itemId: string): void {
    if ((this.characterState.inventory[itemId] ?? 0) <= 0 || !consumableFor(itemId)) {
      return;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'You are already at full health.');
      return;
    }
    if (!this.player.eat(itemId)) {
      return;
    }

    this.characterState.inventory = removeItemFromInventory(
      this.characterState.inventory,
      itemId,
      1,
    );
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.characterState.inventory);
  }

  private awardSkillXp(skill: SkillId, amount: number): void {
    const result = addSkillXp(this.characterState.skills, skill, amount);
    this.characterState.skills = result.skills;

    const state = result.skills[skill];
    this.game.events.emit(SKILL_XP_GAINED_EVENT, {
      skillId: skill,
      level: state.level,
      xp: state.xp,
      xpToNext: skillXpToNextLevel(state.level),
      leveledUp: result.leveledUp,
    });

    if (result.leveledUp) {
      this.persistCharacter();
    }
  }

  private handleMoveVector(x: number, y: number): void {
    this.player.setTouchVector(x, y);
  }

  private setTarget(mob: Mob): void {
    this.target = mob;
    this.publishTarget();
  }

  private publishTarget(): void {
    if (!this.target) return;
    this.game.events.emit(TARGET_SELECTED_EVENT, {
      name: this.target.name,
      level: this.target.level,
      hp: this.target.hp,
      maxHp: this.target.maxHp,
      conColor: conColor(this.characterState.level, this.target.level),
    });
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
    this.showDamageNumber(this.target.x, this.target.y, damage, THEME.color.equippable);
    const xpReward = this.target.xpReward;
    const lootTableId = this.target.lootTableId;
    this.player.markInCombat();
    this.target.takeDamage(damage);
    // Anything the player hits fights back, whether or not it opens combat itself.
    this.target.engage();
    this.publishTarget();
    if (!this.target.isAlive()) {
      this.awardXp(xpReward);
      this.grantLoot(lootTableId);
    }
  }

  private updateEnemyAttacks(time: number): void {
    if (!this.player.isAlive()) return;

    for (const rat of this.rats) {
      if (!rat.isEngaged()) continue;

      const distance = Phaser.Math.Distance.Between(rat.x, rat.y, this.player.x, this.player.y);
      if (!isInRange(distance, rat.attackRange)) continue;
      if (!isCooldownReady(time - rat.lastAttackAt, rat.attackCooldownMs)) continue;

      rat.lastAttackAt = time;
      const { damage } = resolveAttack({ attackPower: rat.attackPower });
      this.player.takeDamage(damage);
      this.showDamageNumber(this.player.x, this.player.y, damage, THEME.color.playerDamage);
      // Taking a hit breaks the channel, so gathering is never a way to ignore a
      // mob already chewing on you.
      if (this.gatherState) {
        this.game.events.emit(GATHER_REFUSED_EVENT, 'You are interrupted!');
        this.stopGathering();
      }

      if (!this.player.isAlive()) {
        this.handlePlayerDeath();
        return;
      }
    }
  }

  private handlePlayerDeath(): void {
    this.rats.forEach((rat) => rat.disengage());
    this.stopGathering();
    this.clearTarget();
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.player.setVelocity(0, 0);
    this.player.restoreToFull();
    this.game.events.emit(PLAYER_DIED_EVENT);
    this.persistCharacter();
  }

  // Regen and enemy hits both move HP outside of any single event, so the HUD is
  // driven off the rounded value changing rather than off each damage source.
  private publishPlayerHp(): void {
    if (this.player.hp === this.lastReportedHp) return;
    this.lastReportedHp = this.player.hp;
    this.game.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
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
      this.player.setLevel(this.characterState.level);
      // Con colors are relative to the player, so every name has to be redrawn.
      this.rats.forEach((rat) => rat.refreshLabel(this.characterState.level));
      this.publishTarget();
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
    this.applyGearChange();
  }

  private handleUnequipRequested(slot: GearSlotId): void {
    const result = unequipItem(this.characterState.gear, this.characterState.inventory, slot);
    this.characterState.gear = result.gear;
    this.characterState.inventory = result.inventory;
    this.applyGearChange();
  }

  // Gear moves max HP, so the HUD needs the new current HP alongside the gear.
  private applyGearChange(): void {
    this.player.setGear(this.characterState.gear);
    this.game.events.emit(GEAR_CHANGED_EVENT, this.characterState.gear);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.characterState.inventory);
    this.game.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
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

  private showDamageNumber(x: number, y: number, amount: number, color: string): void {
    const text = this.add
      // world-space, so this scales with the camera rather than the ui scale
      .text(x, y - 20, `-${amount}`, {
        fontSize: '20px',
        color,
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
