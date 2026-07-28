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
  ABILITY_REQUESTED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  COMBAT_LOG_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  OFFLINE_AFK_RESOLVED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  ACHIEVEMENT_UNLOCKED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  TITLE_CHANGED_EVENT,
  type AchievementUnlock,
} from '../ui/uiEvents';
import { titleName } from '../systems/AchievementSystem';
import { resolveOfflineAfk } from '../systems/OfflineAfkSystem';
import {
  AFK_ANCHOR_RADIUS,
  afkXpReward,
  chooseAfkFood,
  decideAfkAction,
  shouldAfkEat,
} from '../systems/AfkSystem';
import {
  abilitiesFor,
  abilityById,
  canUseAbility,
  resolveAbilityDamage,
  rollSpellFailure,
  startHaste,
  startManaShield,
} from '../systems/AbilitySystem';
import type { AbilityDefinition } from '../data/abilities';
import {
  logAbilityUsed,
  logAbsorbed,
  logAchievement,
  logCoin,
  logDamageDealt,
  logDamageTaken,
  logDefense,
  logKill,
  logLevelUp,
  logLoot,
  logNotice,
  logQuestAccepted,
  logQuestCompleted,
  logSkillLevelUp,
  logSpellFailed,
  logTitleEarned,
  logXpGain,
  type CombatLogEntry,
} from '../systems/CombatLogSystem';
import { THEME, worldZoom } from '../ui/theme';
import { worldViewportHeight } from '../ui/layout';
import { isCooldownReady, isInRange, resolveAttack, rollDefense } from '../systems/CombatSystem';
import { conColor } from '../systems/EnemySystem';
import { rollLootTable } from '../systems/LootSystem';
import { canCook, findCookableItem, recipeForInput, rollCook } from '../systems/CookingSystem';
import { Campfire } from '../entities/Campfire';
import { FIRE_COOK_RADIUS, FIRE_INPUT_ITEM_ID } from '../data/recipes';
import { consumableFor, describeItemName, itemValue } from '../data/items';
import { SKILLS } from '../data/skills';
import { SHOP_CLOSE_RADIUS, SHOP_INTERACT_RADIUS, shopPriceFor } from '../data/shop';
import { QUESTS } from '../data/quests';
import { formatCurrency } from '../systems/CurrencySystem';
import { Shopkeeper } from '../entities/Shopkeeper';
import {
  advanceGather,
  beginGather,
  canGather,
  rollGatherQuantity,
  type GatherState,
} from '../systems/GatherSystem';
import { CharacterController, type CombatXpGain } from '../systems/CharacterController';
import {
  SIGNPOST_INTERACT_RADIUS,
  arrivalPoint,
  edgeFraction,
  findExit,
  oppositeEdge,
  signpostPoint,
} from '../systems/ZoneSystem';
import { ZoneSignpost } from '../entities/ZoneSignpost';
import { createNewCharacter, saveService, type CharacterState } from '../persistence';
import type {
  AbilityId,
  EnemyId,
  GearSlotId,
  QuestId,
  SkillId,
  TitleId,
  ZoneId,
} from '../types/ids';

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
// Combat skills are earned a rep at a time — one landed swing, one hit turned
// aside — rather than in the lumps a gather or a kill pays out.
const WEAPON_SKILL_XP_PER_HIT = 1;
const DEFENSE_SKILL_XP_PER_SAVE = 1;
// A cast is worth more than a swing: abilities sit behind long cooldowns, so
// paying a swing's rate would make Destruction unlevellable.
const ABILITY_SKILL_XP_PER_CAST = 3;

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
  private pendingSignpost: ZoneSignpost | null = null;
  private pursuingTarget = false;
  private npcs: Shopkeeper[] = [];
  private signposts: ZoneSignpost[] = [];
  // The shopkeeper the open shop belongs to; null when the shop is closed.
  private shopNpc: Shopkeeper | null = null;
  private campfire: Campfire | null = null;
  private lastActions = { nearFire: false };
  private target: Mob | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private lastAttackAt = 0;
  // When each ability was last cast, for the cooldown check and the bar's sweep.
  private lastAbilityAt = new Map<AbilityId, number>();
  private lastAbilitySignature = '';
  private spawnPoint = new Phaser.Math.Vector2();
  private lastReportedHp = 0;
  private lastReportedMana = -1;
  private character!: CharacterController;
  // AFK camping: whether it is on, the spot the character settled at (fights
  // are leashed to it), and whether they are currently standing down to heal.
  private afkActive = false;
  private afkAnchor = new Phaser.Math.Vector2();
  private afkRecovering = false;
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
    // A restart reuses this instance, and the camp was a spot in the zone being
    // left; nothing carries over.
    this.afkActive = false;
    this.afkRecovering = false;

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

    // All NPCs are shopkeepers today; a second npcId would branch here.
    this.npcs = this.zone.npcSpawns.map(
      ({ dx, dy }) => new Shopkeeper(this, this.spawnPoint.x + dx, this.spawnPoint.y + dy),
    );
    this.shopNpc = null;

    // One tappable signpost per exit — the mobile way out of a zone.
    this.signposts = this.zone.exits.map((exit) => {
      const point = signpostPoint(exit.edge, this.worldWidth, this.worldHeight);
      return new ZoneSignpost(this, point.x, point.y, exit, ZONES[exit.to].name);
    });

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
    // Kept as a desktop shortcut; the options menu is the way a phone gets here.
    this.input.keyboard?.on('keydown-F9', () => this.resetCharacter());
    this.game.events.on(EQUIP_ITEM_REQUESTED_EVENT, this.handleEquipRequested, this);
    this.game.events.on(UNEQUIP_SLOT_REQUESTED_EVENT, this.handleUnequipRequested, this);
    this.game.events.on(EAT_ITEM_REQUESTED_EVENT, this.handleEatRequested, this);
    this.game.events.on(COOK_REQUESTED_EVENT, this.handleCookRequested, this);
    this.game.events.on(LIGHT_FIRE_REQUESTED_EVENT, this.handleLightFireRequested, this);
    this.game.events.on(BUY_ITEM_REQUESTED_EVENT, this.handleBuyRequested, this);
    this.game.events.on(SELL_ITEM_REQUESTED_EVENT, this.handleSellRequested, this);
    this.game.events.on(SHOP_CLOSED_EVENT, this.handleShopClosedByUi, this);
    this.game.events.on(ABILITY_REQUESTED_EVENT, this.handleAbilityRequested, this);
    this.game.events.on(RESET_CHARACTER_REQUESTED_EVENT, this.resetCharacter, this);
    this.game.events.on(AFK_TOGGLE_REQUESTED_EVENT, this.toggleAfk, this);
    this.game.events.on(ACCEPT_QUEST_REQUESTED_EVENT, this.handleAcceptQuestRequested, this);
    this.game.events.on(TURN_IN_QUEST_REQUESTED_EVENT, this.handleTurnInQuestRequested, this);
    this.game.events.on(SET_TITLE_REQUESTED_EVENT, this.handleSetTitleRequested, this);

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
      this.game.events.off(ABILITY_REQUESTED_EVENT, this.handleAbilityRequested, this);
      this.game.events.off(RESET_CHARACTER_REQUESTED_EVENT, this.resetCharacter, this);
      this.game.events.off(AFK_TOGGLE_REQUESTED_EVENT, this.toggleAfk, this);
      this.game.events.off(ACCEPT_QUEST_REQUESTED_EVENT, this.handleAcceptQuestRequested, this);
      this.game.events.off(TURN_IN_QUEST_REQUESTED_EVENT, this.handleTurnInQuestRequested, this);
      this.game.events.off(SET_TITLE_REQUESTED_EVENT, this.handleSetTitleRequested, this);
    });

    // Last, so the player, the mobs and the log are all there to pay it into.
    this.resolveParkedAfk();

    // The HUD survives zone changes: launched once on first boot, and left
    // running when this scene restarts into another zone.
    if (!this.scene.isActive('UI')) {
      this.scene.launch('UI');
    }
  }

  update(time: number, delta: number): void {
    if (this.changingZone) return;
    this.updateAfk();
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
    this.publishPlayerMana();
    this.publishAbilityState();
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
    // Checked before the coin leaves the purse, so a full pack never sells the
    // player something they can't take home.
    if (!this.character.canCarryItem(itemId, 1)) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'Your pack is too full to carry that.');
      return;
    }
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

  private handleAcceptQuestRequested(questId: QuestId): void {
    if (!this.shopNpc) return;
    if (!this.character.acceptQuest(questId)) return;
    this.log(logQuestAccepted(QUESTS[questId].name));
    this.announceQuests();
    this.persistCharacter();
  }

  private handleTurnInQuestRequested(questId: QuestId): void {
    if (!this.shopNpc) return;
    const result = this.character.turnInQuest(questId);
    if (!result.ok) {
      this.game.events.emit(GATHER_REFUSED_EVENT, result.reason);
      return;
    }
    this.log(logQuestCompleted(QUESTS[questId].name));
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.game.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
    this.announceQuests();
    this.publishXpGain(result.xp);
    this.persistCharacter();
  }

  private announceQuests(): void {
    this.game.events.emit(QUEST_LOG_CHANGED_EVENT, this.character.state.quests);
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
    // The camp is a spot in the zone being left, so it can't survive the walk.
    this.setAfk(false);
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

  /**
   * Fits the world camera into the screen *above* the tab bar.
   *
   * The bar is opaque HUD furniture that eats every tap landing on it, so any
   * world drawn underneath it is unreachable — which is exactly what happened
   * to the south signpost in town, rendering four pixels inside the bar on a
   * portrait phone with no way to tap it. Shrinking the viewport instead of
   * nudging pixels makes "every world object can be tapped" true by
   * construction rather than by luck.
   */
  private applyCameraZoom(): void {
    const height = worldViewportHeight(this.scale.width, this.scale.height);
    this.cameras.main.setViewport(0, 0, this.scale.width, height);
    this.cameras.main.setZoom(
      worldZoom(this.scale.width, height, this.worldWidth, this.worldHeight),
    );
  }

  // What world objects are under this pointer, tested explicitly. The
  // currentlyOver list the pointerdown event carries is NOT used: with two
  // active scenes (UI above this one), Phaser 3.90 computes every scene's
  // list into one shared internal array, and on pointerdown this scene's
  // copy is intermittently stale/empty depending on event/frame timing —
  // clicks on mobs and NPCs silently fell through to the ground path. An
  // explicit hit test against our own clickables, with a private output
  // array, is deterministic.
  private hitTestWorld(pointer: Phaser.Input.Pointer): Phaser.GameObjects.GameObject[] {
    const candidates: Phaser.GameObjects.GameObject[] = [
      ...this.nodes,
      ...this.npcs,
      ...this.signposts,
      ...this.mobs,
    ];
    return this.input.manager.hitTest(pointer, candidates, this.cameras.main, []);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Clicks that land on the HUD belong to it, not the world.
    const ui = this.scene.get('UI');
    if (ui?.input && ui.input.hitTestPointer(pointer).length > 0) {
      return;
    }

    // Touching the world is taking the controls back.
    this.setAfk(false);

    const currentlyOver = this.hitTestWorld(pointer);

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
    this.pendingSignpost = null;

    const clickedSignpost = currentlyOver.find(
      (obj): obj is ZoneSignpost => obj instanceof ZoneSignpost,
    );
    if (clickedSignpost) {
      this.clearTarget();
      this.pursuingTarget = false;
      this.approachSignpost(clickedSignpost);
      return;
    }

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

  // Walk toward a tapped signpost and take its exit on arrival — the mobile
  // route out of a zone; walking into the map edge still works for WASD.
  private approachSignpost(signpost: ZoneSignpost): void {
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      signpost.x,
      signpost.y,
    );
    if (distance <= SIGNPOST_INTERACT_RADIUS) {
      this.changeZone(signpost.exit);
      return;
    }
    this.pendingSignpost = signpost;
    this.player.moveTo(signpost.x, signpost.y);
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
      this.setAfk(false);
      this.pursuingTarget = false;
      this.pendingGatherNode = null;
      this.pendingShopNpc = null;
      this.pendingSignpost = null;
      return;
    }

    if (this.pendingSignpost) {
      const signpost = this.pendingSignpost;
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        signpost.x,
        signpost.y,
      );
      if (distance <= SIGNPOST_INTERACT_RADIUS) {
        this.pendingSignpost = null;
        this.player.stopMoving();
        this.changeZone(signpost.exit);
      } else if (!this.player.hasMoveTarget()) {
        this.pendingSignpost = null;
      }
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

  // AFK camping. Deliberately a worse player than the person it stands in for:
  // it picks targets and eats, but never casts, and everything it earns is
  // halved on the way in (see awardXp).
  private toggleAfk(): void {
    this.setAfk(!this.afkActive);
  }

  private setAfk(active: boolean): void {
    if (this.afkActive === active) return;
    this.afkActive = active;
    this.afkRecovering = false;
    if (active) {
      this.stopGathering();
      this.closeShop();
      this.afkAnchor.set(this.player.x, this.player.y);
      this.log(logNotice('You settle in to camp.'));
    } else {
      this.log(logNotice('You snap out of it.'));
    }
    // Written to the save, not just held here: it is the only record that
    // survives the tab closing, and the only thing offline progress is paid on.
    this.character.state.afk = active
      ? { startedAt: new Date().toISOString(), zoneId: this.zone.id }
      : null;
    this.persistCharacter();
    this.game.events.emit(AFK_STATE_CHANGED_EVENT, this.afkActive);
  }

  /**
   * Pays out a camp that was left running when the tab closed. Runs once, on
   * the load that finds the session, and clears it either way — a session that
   * paid nothing must not be able to pay again on the next load.
   */
  private resolveParkedAfk(): void {
    const session = this.character.state.afk;
    if (!session) return;
    this.character.state.afk = null;

    const report = resolveOfflineAfk(session, {
      now: Date.now(),
      characterLevel: this.character.state.level,
      inventory: this.character.state.inventory,
      capacity: this.character.carryCapacity(),
    });
    if (report.kills <= 0) {
      this.persistCharacter();
      return;
    }

    for (const [itemId, quantity] of Object.entries(report.drops)) {
      this.character.addItem(itemId, quantity);
    }
    this.character.addCurrency(report.copper);
    this.awardXp(report.xp);
    const unlocks = report.enemyId ? this.creditKill(report.enemyId, report.kills) : [];
    this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.game.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
    // Handed over through the registry rather than as an event, because the
    // only load that can find a parked session is the first boot into this
    // scene — a zone change clears the camp on its way out — and the HUD is
    // not listening yet at that point.
    this.registry.set(OFFLINE_AFK_RESOLVED_EVENT, report);
    // Same reason as the report above: a chain finished while the tab was shut
    // has nobody listening for the event, so it is left where the HUD can pick
    // it up once it builds.
    if (unlocks.length > 0) {
      this.registry.set(ACHIEVEMENT_UNLOCKED_EVENT, unlocks);
    }
    this.persistCharacter();
  }

  private updateAfk(): void {
    if (!this.afkActive || !this.player.isAlive()) return;

    // A fight that wandered off the camp is dropped rather than followed: the
    // anchor is what keeps an unattended character where they were left.
    if (
      this.target &&
      Phaser.Math.Distance.Between(
        this.afkAnchor.x,
        this.afkAnchor.y,
        this.target.x,
        this.target.y,
      ) > AFK_ANCHOR_RADIUS
    ) {
      this.clearTarget();
      this.pursuingTarget = false;
    }

    const action = decideAfkAction(
      this.mobs.map((mob, index) => ({
        index,
        distance: Phaser.Math.Distance.Between(this.afkAnchor.x, this.afkAnchor.y, mob.x, mob.y),
        alive: mob.isAlive(),
        engaged: mob.isEngaged(),
      })),
      { hp: this.player.hp, maxHp: this.player.maxHp, recovering: this.afkRecovering },
    );
    this.afkRecovering = action.kind === 'recover';

    if (action.kind === 'recover') {
      this.clearTarget();
      this.pursuingTarget = false;
      this.player.stopMoving();
      this.afkEat();
      return;
    }
    if (action.kind === 'idle') {
      this.pursuingTarget = false;
      return;
    }

    const mob = this.mobs[action.index];
    if (this.target !== mob) {
      this.setTarget(mob);
    }
    // The existing approach code walks into range and updateCombat swings, so
    // AFK combat is the same combat, just without a hand on the mouse.
    this.pursuingTarget = true;
  }

  private afkEat(): void {
    if (
      this.player.isEating() ||
      !shouldAfkEat(this.player.hp, this.player.maxHp, this.player.isInCombat())
    ) {
      return;
    }
    const food = chooseAfkFood(this.character.state.inventory);
    if (food) {
      this.handleEatRequested(food);
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
    // A haul with nowhere to go is not a gather: the node keeps its charge, the
    // skill earns nothing, and the channel stops rather than spinning forever.
    // This is what ends an unattended gathering session.
    if (!this.character.tryAddItem(definition.yieldItemId, quantity)) {
      this.game.events.emit(GATHER_REFUSED_EVENT, 'Your pack is full.');
      this.stopGathering();
      return;
    }
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

  // Combat skills tick up a point at a time on every swing, which would bury
  // the screen in floating text — those pass `silent` and are seen only on the
  // sheet and at the level-up toast.
  private awardSkillXp(skill: SkillId, amount: number, options?: { silent: boolean }): void {
    const gain = this.character.awardSkillXp(skill, amount);
    if (!options?.silent) {
      this.showFloatingText(
        this.player.x,
        this.player.y - 20,
        `+${amount} ${SKILLS[skill].name} XP`,
        THEME.color.skillUp,
      );
    }
    this.game.events.emit(SKILL_XP_GAINED_EVENT, gain);
    if (gain.leveledUp) {
      this.log(logSkillLevelUp(SKILLS[skill].name, gain.level));
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
    if (!isCooldownReady(time - this.lastAttackAt, this.player.effectiveAttackCooldownMs())) {
      return;
    }

    this.lastAttackAt = time;
    const weaponSkill = this.character.activeWeaponSkill();
    const { damage } = resolveAttack({
      attackPower: this.player.attackPower,
      weaponSkillLevel: this.character.skillLevelOf(weaponSkill),
    });
    this.showFloatingText(this.target.x, this.target.y, `-${damage}`, THEME.color.equippable);
    this.log(logDamageDealt(this.target.name, damage));
    this.player.markInCombat();
    this.target.takeDamage(damage);
    // Anything the player hits fights back, whether or not it opens combat itself.
    this.target.engage();
    this.publishTarget();
    // Skill comes from swinging, not from killing: a landed hit is the rep.
    this.awardSkillXp(weaponSkill, WEAPON_SKILL_XP_PER_HIT, { silent: true });
    if (!this.target.isAlive()) {
      this.resolveKill(this.target);
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

      // A turned-aside hit trains the skill that turned it aside and stops
      // there — no damage, and nothing to interrupt a gather.
      const defense = rollDefense({
        blockLevel: this.character.skillLevelOf('block'),
        parryLevel: this.character.skillLevelOf('parry'),
        hasWeapon: this.character.state.gear.weapon !== null,
      });
      if (defense.avoided && defense.skillId) {
        this.showFloatingText(
          this.player.x,
          this.player.y,
          SKILLS[defense.skillId].name,
          THEME.color.heal,
        );
        this.log(logDefense(SKILLS[defense.skillId].name, mob.name));
        this.awardSkillXp(defense.skillId, DEFENSE_SKILL_XP_PER_SAVE, { silent: true });
        continue;
      }

      const { damage } = resolveAttack({ attackPower: mob.attackPower });
      const absorbed = this.player.takeDamage(damage);
      if (absorbed > 0) {
        this.showFloatingText(
          this.player.x,
          this.player.y - 16,
          `(${absorbed} absorbed)`,
          THEME.color.skillUp,
        );
        this.log(logAbsorbed(absorbed));
      }
      if (damage > absorbed) {
        this.showFloatingText(
          this.player.x,
          this.player.y,
          `-${damage - absorbed}`,
          THEME.color.playerDamage,
        );
        this.log(logDamageTaken(mob.name, damage - absorbed));
      }
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
    // Dying is where an unattended session ends: it took the camp with it, and
    // resuming would just feed the same mob until the player came back.
    this.setAfk(false);
    this.mobs.forEach((mob) => mob.disengage());
    this.stopGathering();
    this.clearTarget();
    this.closeShop();
    this.pendingGatherNode = null;
    this.pendingShopNpc = null;
    this.pendingSignpost = null;
    this.pursuingTarget = false;
    this.player.stopMoving();
    this.log(logNotice('You have died.'));
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

  /**
   * Everything a corpse is worth, for a mob that has already died this frame.
   * Both the swing path and the ability path end here so a new reward can only
   * ever be added once — the two used to carry their own copy of this, which is
   * how a reward gets wired into melee and silently missed on spellcasting.
   * Safe to read the mob after death: its reward fields are readonly and set in
   * the constructor, so dying does not clear them.
   */
  private resolveKill(mob: Mob): void {
    this.log(logKill(mob.name));
    this.awardXp(mob.xpReward);
    this.grantLoot(mob.lootTableId);
    this.announceUnlocks(this.creditKill(mob.definition.id));
  }

  /**
   * Credits kills to the slayer chains and reports what they completed. Does
   * not announce anything itself: a live kill can emit, but an offline camp
   * settles up during create() when the HUD is not listening yet, so the caller
   * decides how the news travels.
   */
  private creditKill(enemyId: EnemyId, count = 1): AchievementUnlock[] {
    const worn = this.character.state.activeTitleId;
    const crossed = this.character.recordKill(enemyId, count);
    this.game.events.emit(KILLS_CHANGED_EVENT, this.character.state.kills);
    if (crossed.length > 0) {
      this.persistCharacter();
    }
    return crossed.map((definition) => ({
      achievementId: definition.id,
      name: definition.name,
      titleId: definition.titleId,
      titleWorn:
        definition.titleId !== undefined &&
        worn === null &&
        this.character.state.activeTitleId === definition.titleId,
    }));
  }

  private announceUnlocks(unlocks: AchievementUnlock[]): void {
    for (const unlock of unlocks) {
      this.log(logAchievement(unlock.name));
      this.showFloatingText(this.player.x, this.player.y - 60, unlock.name, THEME.color.skillUp);
      this.game.events.emit(ACHIEVEMENT_UNLOCKED_EVENT, unlock);
      if (unlock.titleWorn && unlock.titleId) {
        this.log(logTitleEarned(titleName(unlock.titleId)));
        this.game.events.emit(TITLE_CHANGED_EVENT, unlock.titleId);
      }
    }
  }

  private handleSetTitleRequested(titleId: TitleId | null): void {
    if (!this.character.setActiveTitle(titleId)) return;
    this.game.events.emit(TITLE_CHANGED_EVENT, this.character.state.activeTitleId);
    this.persistCharacter();
  }

  private awardXp(reward: number): void {
    // The one choke point both the swing and the ability paths run through, so
    // it is the one place the AFK penalty has to be applied. A quest reward is
    // not one of them — handing a quest in is something the player did — so it
    // comes in through publishXpGain instead.
    const amount = afkXpReward(reward, this.afkActive);
    const gain = this.character.awardXp(amount);
    this.showFloatingText(this.player.x, this.player.y - 20, `+${amount} XP`, THEME.color.levelUp);
    this.log(logXpGain(amount));
    this.publishXpGain(gain);
  }

  // Everything a level costs the rest of the world, for XP however it arrived.
  private publishXpGain(gain: CombatXpGain): void {
    this.game.events.emit(XP_GAINED_EVENT, gain.level, gain.xp, gain.xpToNext);

    if (gain.leveledUp) {
      this.log(logLevelUp(gain.level));
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

    let took = false;
    drops.forEach((drop) => {
      const name = describeItemName(drop.itemId);
      // A full pack leaves the drop on the corpse rather than silently eating
      // it: the log line is the only way the player would ever know.
      if (!this.character.tryAddItem(drop.itemId, drop.quantity)) {
        this.log(logNotice(`Your pack is too full to carry ${name}.`));
        return;
      }
      this.log(logLoot(name, drop.quantity));
      took = true;
    });
    if (took) {
      this.game.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    }
    if (copper > 0) {
      this.character.addCurrency(copper);
      this.log(logCoin(copper));
      this.showFloatingText(
        this.player.x,
        this.player.y - 40,
        `+${formatCurrency(copper)}`,
        THEME.color.levelUp,
      );
      this.game.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
    }
  }

  // Abilities. The scene owns the decision because it is the only thing that
  // knows about targets and range; the HUD just asks.
  private handleAbilityRequested(abilityId: AbilityId): void {
    if (!this.player.isAlive()) return;
    const ability = abilityById(abilityId);
    if (ability.classId !== this.character.state.classId) return;

    const distance = this.target
      ? Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y)
      : Infinity;
    const check = canUseAbility(ability, {
      mana: this.player.mana,
      elapsedMs: this.time.now - (this.lastAbilityAt.get(abilityId) ?? -Infinity),
      hasTarget: this.target !== null && this.target.isAlive(),
      targetDistance: distance,
    });
    if (!check.ok) {
      this.game.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }

    if (!this.player.spendMana(ability.manaCost)) return;
    this.lastAbilityAt.set(abilityId, this.time.now);
    this.stopGathering();
    this.player.markInCombat();
    this.publishAbilityState();

    // A spell that fizzles still costs the mana and the cooldown; that is what
    // makes Destruction worth levelling.
    const skillLevel = ability.skill ? this.character.skillLevelOf(ability.skill) : 0;
    this.log(logAbilityUsed(ability.name));
    if (ability.skill && rollSpellFailure(ability, skillLevel)) {
      this.showFloatingText(this.player.x, this.player.y, 'Fizzle!', THEME.color.dim);
      this.log(logSpellFailed(ability.name));
      this.awardSkillXp(ability.skill, ABILITY_SKILL_XP_PER_CAST, { silent: true });
      return;
    }

    this.applyAbilityEffect(ability, skillLevel);
    if (ability.skill) {
      this.awardSkillXp(ability.skill, ABILITY_SKILL_XP_PER_CAST, { silent: true });
    }
  }

  private applyAbilityEffect(ability: AbilityDefinition, skillLevel: number): void {
    switch (ability.effect.kind) {
      case 'damage': {
        if (!this.target?.isAlive()) return;
        const damage = resolveAbilityDamage(ability, this.player.attackPower, skillLevel);
        const target = this.target;
        this.castBolt(target, ability);
        this.showFloatingText(target.x, target.y, `-${damage}`, THEME.color.levelUp);
        this.log(logDamageDealt(target.name, damage));
        target.takeDamage(damage);
        target.engage();
        this.publishTarget();
        if (!target.isAlive()) {
          this.resolveKill(target);
        }
        return;
      }
      case 'absorb': {
        const shield = startManaShield(ability);
        if (shield) this.player.applyManaShield(shield);
        this.showFloatingText(this.player.x, this.player.y, ability.name, THEME.color.skillUp);
        return;
      }
      case 'haste': {
        const haste = startHaste(ability);
        if (haste) this.player.applyHaste(haste);
        this.showFloatingText(this.player.x, this.player.y, ability.name, THEME.color.levelUp);
        return;
      }
    }
  }

  // A bolt thrown from the caster to the target. Purely cosmetic, but a ranged
  // nuke that produced only a number over the mob read as nothing happening.
  private castBolt(target: Mob, ability: AbilityDefinition): void {
    if (ability.range <= 0) return;
    const bolt = this.add.circle(this.player.x, this.player.y, 8, 0xff7043, 1);
    bolt.setStrokeStyle(2, 0xffd54f, 1);
    this.tweens.add({
      targets: bolt,
      x: target.x,
      y: target.y,
      duration: 180,
      onComplete: () => bolt.destroy(),
    });
  }

  // The bar redraws off this; emitted only when a button's rendered state moves.
  private publishAbilityState(): void {
    const states = abilitiesFor(this.character.state.classId).map((ability) => {
      const elapsedMs = this.time.now - (this.lastAbilityAt.get(ability.id) ?? -Infinity);
      const cooldownRemaining = Phaser.Math.Clamp(
        (ability.cooldownMs - elapsedMs) / ability.cooldownMs,
        0,
        1,
      );
      return {
        abilityId: ability.id,
        cooldownRemaining,
        usable: cooldownRemaining === 0 && this.player.mana >= ability.manaCost,
      };
    });

    const signature = states
      .map((s) => `${s.abilityId}:${s.cooldownRemaining.toFixed(2)}:${s.usable}`)
      .join('|');
    if (signature === this.lastAbilitySignature) return;
    this.lastAbilitySignature = signature;
    this.game.events.emit(ABILITY_STATE_CHANGED_EVENT, states);
  }

  private publishPlayerMana(): void {
    if (this.player.mana === this.lastReportedMana) return;
    this.lastReportedMana = this.player.mana;
    this.game.events.emit(PLAYER_MANA_CHANGED_EVENT, this.player.mana, this.player.maxMana);
  }

  private handleEquipRequested(itemId: string): void {
    const check = this.character.equip(itemId);
    if (!check.ok) {
      this.game.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }
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

  private log(entry: CombatLogEntry): void {
    this.game.events.emit(COMBAT_LOG_EVENT, entry);
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
