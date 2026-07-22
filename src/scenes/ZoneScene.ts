import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { BLOCKING_TILES } from '../data/tiles';
import { ZONES, type ZoneDefinition, type ZoneEdge, type ZoneExit } from '../data/zones';
import { ENEMIES } from '../data/enemies';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { Player } from '../entities/Player';
import { Mob } from '../entities/Mob';
import { ResourceNode } from '../entities/ResourceNode';
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
  PLAYER_DIED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  SKILL_XP_GAINED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SHOP_OPENED_EVENT,
  SHOP_CLOSED_EVENT,
  CURRENCY_CHANGED_EVENT,
} from '../ui/uiEvents';
import { THEME, fontPx, px, scenePxScale, worldZoom } from '../ui/theme';
import { isCooldownReady, isInRange, resolveAttack } from '../systems/CombatSystem';
import { conColor } from '../systems/EnemySystem';
import { rollLootTable } from '../systems/LootSystem';
import { canCook, findCookableItem, recipeForInput, rollCook } from '../systems/CookingSystem';
import { Campfire } from '../entities/Campfire';
import { FIRE_COOK_RADIUS, FIRE_INPUT_ITEM_ID } from '../data/recipes';
import { consumableFor, itemValue } from '../data/items';
import { SKILLS } from '../data/skills';
import { SHOP_CLOSE_RADIUS, SHOP_INTERACT_RADIUS, shopPriceFor } from '../data/shop';
import { formatCurrency } from '../systems/CurrencySystem';
import { Shopkeeper } from '../entities/Shopkeeper';
import {
  advanceGather,
  beginGather,
  canGather,
  rollGatherQuantity,
  type GatherState,
} from '../systems/GatherSystem';
import { CharacterController } from '../systems/CharacterController';
import { arrivalPoint, edgeFraction, findExit, oppositeEdge } from '../systems/ZoneSystem';
import { createNewCharacter, saveService, type CharacterState } from '../persistence';
import type { GearSlotId, SkillId, ZoneId } from '../types/ids';

const GROUND_DEPTH = -10;
const SELECTION_RING_RADIUS = 36;
const SELECTION_RING_COLOR = 0xffee58;
const AUTOSAVE_INTERVAL_MS = 30000;
// Wider than half the player's body, since world-bounds collision stops the
// sprite's center that far from the edge.
const EXIT_MARGIN = TILE_SIZE * 0.6;
// Far enough inside the new zone that the player doesn't stand on the return
// exit and bounce straight back.
const ARRIVAL_INSET = TILE_SIZE * 1.5;

// Passed through scene.restart on a zone change; absent on the first boot.
interface ZoneSceneData {
  zoneId?: ZoneId;
  entryEdge?: ZoneEdge;
  entryFraction?: number;
  // Carried across the restart so walking through an exit is never a heal;
  // omitted on death, where respawning at full is the point.
  hp?: number;
}

export class ZoneScene extends Phaser.Scene {
  private zone!: ZoneDefinition;
  private worldWidth = 0;
  private worldHeight = 0;
  private initData: ZoneSceneData = {};
  private player!: Player;
  private mobs: Mob[] = [];
  private nodes: ResourceNode[] = [];
  private gatherState: GatherState | null = null;
  private gatherNode: ResourceNode | null = null;
  // Click-to-move approach state: a node the player is walking toward to
  // gather, a shopkeeper they are walking toward to trade, or whether they
  // are closing on the current combat target.
  private pendingGatherNode: ResourceNode | null = null;
  private pendingShopNpc: Shopkeeper | null = null;
  private pursuingTarget = false;
  // The shopkeeper the open shop belongs to; null when the shop is closed.
  private shopNpc: Shopkeeper | null = null;
  private campfire: Campfire | null = null;
  private lastActions = { nearFire: false };
  private target: Mob | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private lastAttackAt = 0;
  private spawnPoint = new Phaser.Math.Vector2();
  private lastReportedHp = 0;
  private character!: CharacterController;
  private changingZone = false;
  private handleWindowUnload = (): void => this.persistCharacter();

  constructor() {
    super('Zone');
  }

  init(data: ZoneSceneData): void {
    this.initData = data ?? {};
  }

  create(): void {
    const state =
      (this.registry.get('character') as CharacterState | undefined) ??
      createNewCharacter('Adventurer', 'warrior');
    this.character = new CharacterController(state);
    this.zone = ZONES[this.initData.zoneId ?? state.zoneId ?? 'town'];
    this.changingZone = false;

    const tilemap = this.make.tilemap({
      data: this.zone.map,
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

    this.worldWidth = tilemap.widthInPixels;
    this.worldHeight = tilemap.heightInPixels;
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    this.spawnPoint.set(this.worldWidth / 2, this.worldHeight / 2);
    const start =
      this.initData.entryEdge !== undefined
        ? arrivalPoint(
            this.initData.entryEdge,
            this.initData.entryFraction ?? 0.5,
            this.worldWidth,
            this.worldHeight,
            ARRIVAL_INSET,
          )
        : this.spawnPoint;
    this.player = new Player(
      this,
      start.x,
      start.y,
      state.classId,
      state.gear,
      state.name,
      state.level,
    );
    if (this.initData.hp !== undefined) {
      this.player.setHp(this.initData.hp);
    }
    this.lastReportedHp = this.player.hp;
    // The HUD may be carrying HP from before a restart (a zone walk, or the
    // death that sent us here) — resync it unconditionally.
    this.game.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
    this.cameras.main.startFollow(this.player, true);
    this.applyCameraZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyCameraZoom, this);

    this.mobs = this.zone.mobSpawns.map(({ dx, dy, enemyId, level }) => {
      const mob = new Mob(
        this,
        this.spawnPoint.x + dx,
        this.spawnPoint.y + dy,
        ENEMIES[enemyId],
        level,
        state.level,
      );
      mob.setInteractive();
      return mob;
    });

    this.nodes = this.zone.nodeSpawns.map(({ dx, dy, nodeId }) => {
      const node = new ResourceNode(
        this,
        this.spawnPoint.x + dx,
        this.spawnPoint.y + dy,
        RESOURCE_NODES[nodeId],
      );
      node.setInteractive();
      return node;
    });

    // All NPCs are shopkeepers today; a second npcId would branch here. The
    // scene owns them; clicks find them through the pointer's currentlyOver.
    this.zone.npcSpawns.forEach(
      ({ dx, dy }) => new Shopkeeper(this, this.spawnPoint.x + dx, this.spawnPoint.y + dy),
    );
    this.shopNpc = null;

    // Nothing walks into the pond.
    groundLayer.setCollision(BLOCKING_TILES);
    this.physics.add.collider(this.player, groundLayer);
    this.mobs.forEach((mob) => this.physics.add.collider(mob, groundLayer));
    const solidNodes = this.nodes.filter((node) => node.definition.solid);
    solidNodes.forEach((node) => {
      this.physics.add.collider(this.player, node);
      this.mobs.forEach((mob) => this.physics.add.collider(mob, node));
    });

    this.selectionRing = this.add.graphics();
    this.selectionRing.setVisible(false);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.on('keydown-ESC', () => this.clearTarget());
    this.input.keyboard?.on('keydown-F9', () => this.resetCharacter());
    this.game.events.on(EQUIP_ITEM_REQUESTED_EVENT, this.handleEquipRequested, this);
    this.game.events.on(UNEQUIP_SLOT_REQUESTED_EVENT, this.handleUnequipRequested, this);
    this.game.events.on(EAT_ITEM_REQUESTED_EVENT, this.handleEatRequested, this);
    this.game.events.on(COOK_REQUESTED_EVENT, this.handleCookRequested, this);
    this.game.events.on(LIGHT_FIRE_REQUESTED_EVENT, this.handleLightFireRequested, this);
    this.game.events.on(BUY_ITEM_REQUESTED_EVENT, this.handleBuyRequested, this);
    this.game.events.on(SELL_ITEM_REQUESTED_EVENT, this.handleSellRequested, this);
    this.game.events.on(SHOP_CLOSED_EVENT, this.handleShopClosedByUi, this);

    // bottom-left corner, under the HUD's top-left column
    const uiScale = scenePxScale();
    this.add
      .text(
        px(THEME.margin, uiScale),
        this.scale.height - px(24, uiScale),
        'F9: Reset Character (dev)',
        {
          fontSize: fontPx(THEME.font.xs, uiScale),
          color: THEME.color.dim,
        },
      )
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
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyCameraZoom, this);
      this.game.events.off(EQUIP_ITEM_REQUESTED_EVENT, this.handleEquipRequested, this);
      this.game.events.off(UNEQUIP_SLOT_REQUESTED_EVENT, this.handleUnequipRequested, this);
      this.game.events.off(EAT_ITEM_REQUESTED_EVENT, this.handleEatRequested, this);
      this.game.events.off(COOK_REQUESTED_EVENT, this.handleCookRequested, this);
      this.game.events.off(LIGHT_FIRE_REQUESTED_EVENT, this.handleLightFireRequested, this);
      this.game.events.off(BUY_ITEM_REQUESTED_EVENT, this.handleBuyRequested, this);
      this.game.events.off(SELL_ITEM_REQUESTED_EVENT, this.handleSellRequested, this);
      this.game.events.off(SHOP_CLOSED_EVENT, this.handleShopClosedByUi, this);
    });

    // The HUD survives zone changes: launched once on first boot, and left
    // running when this scene restarts into another zone.
    if (!this.scene.isActive('UI')) {
      this.scene.launch('UI');
    }
  }

  update(time: number, delta: number): void {
    if (this.changingZone) return;
    this.updateApproach();
    this.player.update(delta);
    const healed = this.player.takeHealPulse();
    if (healed > 0) {
      this.showFloatingText(this.player.x, this.player.y, `+${healed}`, THEME.color.heal);
    }
    this.mobs.forEach((mob) => mob.update(this.player.x, this.player.y));
    this.updateSelectionRing();
    this.updateGathering(delta);
    this.updateCombat(time);
    this.updateEnemyAttacks(time);
    this.publishPlayerHp();
    this.publishActions();
    this.updateShopRange();
    this.checkZoneExit();
  }

  // Walking off mid-trade closes the window, like any vendor would.
  private updateShopRange(): void {
    if (!this.shopNpc) return;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.shopNpc.x,
      this.shopNpc.y,
    );
    if (distance > SHOP_CLOSE_RADIUS) {
      this.closeShop();
    }
  }

  private handleBuyRequested(itemId: string): void {
    if (!this.shopNpc) return;
    const price = shopPriceFor(itemId);
    if (price === null) return;
    if (!this.character.spendCurrency(price)) {
      this.game.events.emit(GATHER_REFUSED_EVENT, "You can't afford that.");
      return;
    }
    this.character.addItem(itemId, 1);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.game.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
  }

  private handleSellRequested(itemId: string): void {
    if (!this.shopNpc) return;
    const value = itemValue(itemId);
    if (value === null || this.character.itemCount(itemId) <= 0) return;
    this.character.removeItem(itemId, 1);
    this.character.addCurrency(value);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.game.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
  }

  private checkZoneExit(): void {
    const exit = findExit(
      this.zone.exits,
      this.player.x,
      this.player.y,
      this.worldWidth,
      this.worldHeight,
      EXIT_MARGIN,
    );
    if (exit) {
      this.changeZone(exit);
    }
  }

  private changeZone(exit: ZoneExit): void {
    this.changingZone = true;
    const fraction = edgeFraction(
      exit.edge,
      this.player.x,
      this.player.y,
      this.worldWidth,
      this.worldHeight,
    );
    this.stopGathering();
    this.clearTarget();
    this.closeShop();
    this.character.recordLocation(exit.to, this.player.x, this.player.y);
    saveService.save(this.character.state);
    const data: ZoneSceneData = {
      zoneId: exit.to,
      entryEdge: oppositeEdge(exit.edge),
      entryFraction: fraction,
      hp: this.player.hp,
    };
    this.scene.restart(data);
  }

  private applyCameraZoom(): void {
    this.cameras.main.setZoom(
      worldZoom(this.scale.width, this.scale.height, this.worldWidth, this.worldHeight),
    );
  }

  private handlePointerDown(
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ): void {
    // Clicks that land on the HUD belong to it, not the world.
    const ui = this.scene.get('UI');
    if (ui?.input && ui.input.hitTestPointer(pointer).length > 0) {
      return;
    }

    const clickedNode = currentlyOver.find(
      (obj): obj is ResourceNode => obj instanceof ResourceNode,
    );
    if (clickedNode) {
      this.clearTarget();
      this.pursuingTarget = false;
      this.approachAndGather(clickedNode);
      return;
    }

    // Any other click ends a gather: picking a fight or walking off is a choice
    // to stop chopping.
    this.stopGathering();
    this.pendingGatherNode = null;
    this.pendingShopNpc = null;

    const clickedNpc = currentlyOver.find((obj): obj is Shopkeeper => obj instanceof Shopkeeper);
    if (clickedNpc) {
      this.clearTarget();
      this.pursuingTarget = false;
      this.approachShop(clickedNpc);
      return;
    }

    const clickedMob = currentlyOver.find((obj): obj is Mob => obj instanceof Mob);
    if (clickedMob) {
      this.setTarget(clickedMob);
      // Auto-approach: walking into range is implied by choosing a target.
      this.pursuingTarget = true;
      return;
    }

    this.clearTarget();
    this.pursuingTarget = false;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.player.moveTo(worldPoint.x, worldPoint.y);
  }

  // Walk toward a clicked node and start the gather once inside its
  // interact radius; startGathering fires immediately when already there.
  private approachAndGather(node: ResourceNode): void {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
    if (distance <= node.definition.interactRadius) {
      this.startGathering(node);
      return;
    }
    this.pendingGatherNode = node;
    this.player.moveTo(node.x, node.y);
  }

  private approachShop(npc: Shopkeeper): void {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
    if (distance <= SHOP_INTERACT_RADIUS) {
      this.openShop(npc);
      return;
    }
    this.pendingShopNpc = npc;
    this.player.moveTo(npc.x, npc.y);
  }

  private openShop(npc: Shopkeeper): void {
    this.player.stopMoving();
    this.shopNpc = npc;
    this.game.events.emit(SHOP_OPENED_EVENT);
  }

  private closeShop(): void {
    if (!this.shopNpc) return;
    this.shopNpc = null;
    this.game.events.emit(SHOP_CLOSED_EVENT);
  }

  // The UI's close button already tore the panel down; just drop the state.
  private handleShopClosedByUi(): void {
    this.shopNpc = null;
  }

  // Drives the click-to-move approaches: closing on a combat target, walking
  // up to a node before gathering, or up to a shopkeeper before trading. WASD
  // input cancels all of them.
  private updateApproach(): void {
    if (this.player.isKeyboardMoving()) {
      this.pursuingTarget = false;
      this.pendingGatherNode = null;
      this.pendingShopNpc = null;
      return;
    }

    if (this.pendingShopNpc) {
      const npc = this.pendingShopNpc;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (distance <= SHOP_INTERACT_RADIUS) {
        this.pendingShopNpc = null;
        this.openShop(npc);
      } else if (!this.player.hasMoveTarget()) {
        this.pendingShopNpc = null;
      }
      return;
    }

    if (this.pendingGatherNode) {
      const node = this.pendingGatherNode;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.x, node.y);
      if (distance <= node.definition.interactRadius * 0.9) {
        this.pendingGatherNode = null;
        this.player.stopMoving();
        this.startGathering(node);
      } else if (!this.player.hasMoveTarget()) {
        // The walk ended short (blocked or arrived at a stale point) — give up
        // rather than pushing into a wall forever.
        this.pendingGatherNode = null;
      }
      return;
    }

    if (this.pursuingTarget) {
      if (!this.target || !this.target.isAlive()) {
        this.pursuingTarget = false;
        return;
      }
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.target.x,
        this.target.y,
      );
      // Stop a little inside attack range, mirroring how mobs close in, so the
      // player doesn't hover exactly on the boundary of their own reach.
      if (isInRange(distance, this.player.attackRange * 0.8)) {
        this.pursuingTarget = false;
        this.player.stopMoving();
      } else {
        this.player.moveTo(this.target.x, this.target.y);
      }
    }
  }

  private startGathering(node: ResourceNode): void {
    if (!node.isAvailable()) {
      this.game.events.emit(GATHER_REFUSED_EVENT, `The ${node.definition.name} is spent.`);
      return;
    }

    const check = canGather(
      node.definition,
      this.character.state.skills,
      this.character.state.gear,
    );
    if (!check.ok) {
      this.game.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }

    this.gatherNode = node;
    this.gatherState = beginGather(
      node.definition,
      this.character.skillLevelOf(node.definition.skill),
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

    const quantity = rollGatherQuantity(this.character.skillLevelOf(definition.skill));
    this.character.addItem(definition.yieldItemId, quantity);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.awardSkillXp(definition.skill, definition.xpReward);

    const emptied = node.consumeCharge();
    if (emptied) {
      this.stopGathering();
      return;
    }

    // Auto-repeat: re-arm the channel so gathering runs unattended until
    // something interrupts it.
    this.gatherState = beginGather(definition, this.character.skillLevelOf(definition.skill));
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

  // The HUD's item actions are driven off what is actually possible right now,
  // so they show only buttons that would succeed. Emitted on change rather
  // than every frame, the same way player HP is.
  private publishActions(): void {
    const next = { nearFire: this.isNearFire() };
    if (next.nearFire === this.lastActions.nearFire) {
      return;
    }
    this.lastActions = next;
    this.game.events.emit(ACTIONS_CHANGED_EVENT, next);
  }

  private handleLightFireRequested(): void {
    if (this.character.itemCount(FIRE_INPUT_ITEM_ID) <= 0) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'You have no logs to burn.');
      return;
    }

    // One fire at a time: lighting a new one replaces the old, rather than
    // letting the player carpet the town in campfires.
    this.campfire?.extinguish();
    this.character.removeItem(FIRE_INPUT_ITEM_ID, 1);
    this.campfire = new Campfire(this, this.player.x, this.player.y + 32);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
  }

  // With an item selected in the bag the HUD names what to cook; without one
  // (dev console, older callers) fall back to the first cookable thing.
  private handleCookRequested(itemId?: string): void {
    const recipe =
      (itemId ? recipeForInput(itemId) : null) ?? findCookableItem(this.character.state.inventory);
    if (!recipe) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'You have nothing to cook.');
      return;
    }

    const check = canCook(
      recipe,
      this.character.state.skills,
      this.character.state.inventory,
      this.isNearFire(),
    );
    if (!check.ok) {
      this.game.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }

    const result = rollCook(recipe, this.character.skillLevelOf('cooking'));
    this.character.removeItem(recipe.inputItemId, 1);
    this.character.addItem(result.itemId, 1);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    if (result.burnt) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'You burn it.');
    } else {
      this.awardSkillXp('cooking', result.xp);
    }
  }

  private handleEatRequested(itemId: string): void {
    if (this.character.itemCount(itemId) <= 0 || !consumableFor(itemId)) {
      return;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'You are already at full health.');
      return;
    }
    if (!this.player.eat(itemId)) {
      return;
    }

    this.character.removeItem(itemId, 1);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
  }

  private awardSkillXp(skill: SkillId, amount: number): void {
    const gain = this.character.awardSkillXp(skill, amount);
    this.showFloatingText(
      this.player.x,
      this.player.y - 20,
      `+${amount} ${SKILLS[skill].name} XP`,
      THEME.color.skillUp,
    );
    this.game.events.emit(SKILL_XP_GAINED_EVENT, gain);
    if (gain.leveledUp) {
      this.persistCharacter();
    }
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
      conColor: conColor(this.character.state.level, this.target.level),
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
    this.showFloatingText(this.target.x, this.target.y, `-${damage}`, THEME.color.equippable);
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

    for (const mob of this.mobs) {
      if (!mob.isEngaged()) continue;

      const distance = Phaser.Math.Distance.Between(mob.x, mob.y, this.player.x, this.player.y);
      if (!isInRange(distance, mob.attackRange)) continue;
      if (!isCooldownReady(time - mob.lastAttackAt, mob.attackCooldownMs)) continue;

      mob.lastAttackAt = time;
      const { damage } = resolveAttack({ attackPower: mob.attackPower });
      this.player.takeDamage(damage);
      this.showFloatingText(this.player.x, this.player.y, `-${damage}`, THEME.color.playerDamage);
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
    this.mobs.forEach((mob) => mob.disengage());
    this.stopGathering();
    this.clearTarget();
    this.closeShop();
    this.pendingGatherNode = null;
    this.pendingShopNpc = null;
    this.pursuingTarget = false;
    this.player.stopMoving();
    this.game.events.emit(PLAYER_DIED_EVENT);

    // Dying away from home sends you back to town — respawning in the middle
    // of a hostile zone would just feed the same bandit again.
    if (this.zone.id !== 'town') {
      this.changingZone = true;
      this.character.recordLocation('town', this.spawnPoint.x, this.spawnPoint.y);
      saveService.save(this.character.state);
      this.scene.restart({ zoneId: 'town' } satisfies ZoneSceneData);
      return;
    }

    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.player.setVelocity(0, 0);
    this.player.restoreToFull();
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
    const gain = this.character.awardXp(amount);
    this.showFloatingText(this.player.x, this.player.y - 20, `+${amount} XP`, THEME.color.levelUp);
    this.game.events.emit(XP_GAINED_EVENT, gain.level, gain.xp, gain.xpToNext);

    if (gain.leveledUp) {
      this.player.setLevel(gain.level);
      // Con colors are relative to the player, so every name has to be redrawn.
      this.mobs.forEach((mob) => mob.refreshLabel(gain.level));
      this.publishTarget();
      this.game.events.emit(LEVEL_UP_EVENT, gain.level);
      this.persistCharacter();
    }
  }

  private grantLoot(lootTableId?: string): void {
    if (!lootTableId) return;
    const { drops, copper } = rollLootTable(lootTableId);

    if (drops.length > 0) {
      drops.forEach((drop) => this.character.addItem(drop.itemId, drop.quantity));
      this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    }
    if (copper > 0) {
      this.character.addCurrency(copper);
      this.showFloatingText(
        this.player.x,
        this.player.y - 40,
        `+${formatCurrency(copper)}`,
        THEME.color.levelUp,
      );
      this.game.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
    }
  }

  private handleEquipRequested(itemId: string): void {
    this.character.equip(itemId);
    this.applyGearChange();
  }

  private handleUnequipRequested(slot: GearSlotId): void {
    this.character.unequip(slot);
    this.applyGearChange();
  }

  // Gear moves max HP, so the HUD needs the new current HP alongside the gear.
  private applyGearChange(): void {
    this.player.setGear(this.character.state.gear);
    this.game.events.emit(GEAR_CHANGED_EVENT, this.character.state.gear);
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.game.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
  }

  private persistCharacter(): void {
    this.character.recordLocation(this.zone.id, this.player.x, this.player.y);
    saveService.save(this.character.state);
  }

  private resetCharacter(): void {
    saveService.clear();
    this.registry.remove('character');
    this.scene.stop('UI');
    this.scene.start('CharacterCreate');
  }

  private showFloatingText(x: number, y: number, message: string, color: string): void {
    const text = this.add
      // world-space, so this scales with the camera rather than the ui scale
      .text(x, y - 20, message, {
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
