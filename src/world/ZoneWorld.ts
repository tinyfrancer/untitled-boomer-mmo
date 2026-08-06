import { EXIT_MARGIN, TILE_SIZE } from '../config/constants';
import { BLOCKING_TILES } from '../data/tiles';
import { ZONES, type ZoneDefinition, type ZoneEdge, type ZoneExit } from '../data/zones';
import { ENEMIES } from '../data/enemies';
import { RESOURCE_NODES } from '../data/resourceNodes';
import {
  ABILITY_REQUESTED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  ACTIONS_CHANGED_EVENT,
  ACHIEVEMENT_UNLOCKED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  COOK_REQUESTED_EVENT,
  CURRENCY_CHANGED_EVENT,
  COMBAT_LOG_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GATHER_ENDED_EVENT,
  GATHER_PROGRESS_EVENT,
  GATHER_REFUSED_EVENT,
  GATHER_STARTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  SHOP_OPENED_EVENT,
  SKILL_XP_GAINED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TITLE_CHANGED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  type AchievementUnlock,
  type UiEventMap,
  type UiEventName,
} from '../ui/uiEvents';
import { titleName } from '../systems/AchievementSystem';
import { resolveOfflineAfk, type OfflineAfkReport } from '../systems/OfflineAfkSystem';
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
import { isCooldownReady, isInRange, resolveAttack, rollDefense } from '../systems/CombatSystem';
import { conColor } from '../systems/EnemySystem';
import { rollLootTable } from '../systems/LootSystem';
import { canCook, findCookableItem, recipeForInput, rollCook } from '../systems/CookingSystem';
import { FIRE_COOK_RADIUS, FIRE_INPUT_ITEM_ID } from '../data/recipes';
import { consumableFor, describeItemName, itemValue } from '../data/items';
import { SKILLS } from '../data/skills';
import { SHOP_CLOSE_RADIUS, SHOP_INTERACT_RADIUS, shopPriceFor } from '../data/shop';
import { QUESTS } from '../data/quests';
import { formatCurrency } from '../systems/CurrencySystem';
import {
  advanceGather,
  beginGather,
  canGather,
  rollGatherQuantity,
  type GatherState,
} from '../systems/GatherSystem';
import type { CharacterController, CombatXpGain } from '../systems/CharacterController';
import { arriveRadius, distance, withinRadius, type Point } from '../systems/MovementSystem';
import type { InputState } from '../systems/InputState';
import type { CollisionWorld } from '../systems/CollisionSystem';
import { resolveApproach, type PendingInteraction } from '../systems/InteractionSystem';
import {
  SIGNPOST_INTERACT_RADIUS,
  arrivalPoint,
  edgeFraction,
  findExit,
  oppositeEdge,
  resumePoint,
  signpostPoint,
  zoneWorldSize,
} from '../systems/ZoneSystem';
import { saveService } from '../persistence';
import { Player } from './Player';
import { Mob } from './Mob';
import { ResourceNode } from './ResourceNode';
import { Campfire } from './Campfire';
import type { EventBus, WorldEvent } from './worldEvents';
import type {
  AbilityId,
  EnemyId,
  GearSlotId,
  NpcId,
  QuestId,
  SkillId,
  TitleId,
} from '../types/ids';

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
// A walk up to a node has to finish a little inside the radius that lets a tap
// gather from where the player already stands: the gather channel cancels the
// moment the player is further out than that radius, so ending the approach
// exactly on it makes the first tick a coin toss.
const GATHER_APPROACH_FRACTION = 0.9;

/** A stationary, non-combat NPC. All of them are shopkeepers today. */
export interface WorldNpc {
  x: number;
  y: number;
  npcId: NpcId;
}

/** A tappable exit marker — the mobile counterpart to walking into the edge. */
export interface WorldSignpost {
  x: number;
  y: number;
  exit: ZoneExit;
  label: string;
}

/** What the player just tapped, once the view has worked out what it was. */
export type WorldTap =
  | { kind: 'node'; node: ResourceNode }
  | { kind: 'signpost'; signpost: WorldSignpost }
  | { kind: 'npc'; npc: WorldNpc }
  | { kind: 'mob'; mob: Mob }
  | { kind: 'ground'; point: Point };

// What the world still owns once InteractionSystem has the rule: the thing to
// do when the walk arrives.
interface PendingApproach {
  interaction: PendingInteraction;
  act: () => void;
}

export interface ZoneWorldOptions {
  zone: ZoneDefinition;
  character: CharacterController;
  events: EventBus;
  input: InputState;
  /** Which edge the player walked in through, when they did. */
  entry?: { edge: ZoneEdge; fraction: number };
  /** HP carried across a zone walk; absent on death, where full is the point. */
  hp?: number;
  rng?: () => number;
}

/** The offline camp's payout, for a host that has somewhere to put it. */
export interface ParkedAfkResult {
  report: OfflineAfkReport;
  unlocks: AchievementUnlock[];
}

/**
 * One zone, simulated. Owns the player, the mobs, the nodes and every rule that
 * moves them: combat both ways, gathering, the shop, abilities, the AFK camp
 * and what a corpse is worth. Nothing here draws, and nothing here knows what
 * is drawing — the frame's `WorldEvent[]` is everything a view has to be told.
 *
 * It deliberately does **not** load zones. Walking onto an exit emits
 * `zone-exit` and stops the world; building the next one is the `GameContext`'s
 * job, because tearing this one down is too — a pile of `.dispose()` calls the
 * simulation has no business knowing about.
 */
export class ZoneWorld {
  readonly zone: ZoneDefinition;
  readonly character: CharacterController;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly spawnPoint: Point;
  readonly player: Player;
  readonly mobs: Mob[];
  readonly nodes: ResourceNode[];
  readonly npcs: WorldNpc[];
  readonly signposts: WorldSignpost[];
  readonly collisionWorld: CollisionWorld;
  campfire: Campfire | null = null;
  gatherState: GatherState | null = null;
  target: Mob | null = null;
  /** The shopkeeper the open shop belongs to; null when the shop is closed. */
  shopNpc: WorldNpc | null = null;
  afkActive = false;
  /** Set once the player has walked out; the world stops stepping after it. */
  changingZone = false;
  /** When each ability was last cast, for the cooldown check and the bar's sweep. */
  readonly lastAbilityAt = new Map<AbilityId, number>();

  private readonly events: EventBus;
  private readonly input: InputState;
  private readonly subscriptions: Array<() => void> = [];
  private pending: WorldEvent[] = [];
  // The world's own clock, and it starts at zero — which is why "never swung"
  // is marked with -Infinity below rather than with 0.
  private now = 0;
  private gatherNode: ResourceNode | null = null;
  // Click-to-move approach state: the node, shopkeeper or signpost the player
  // tapped and is walking toward, and whether they are closing on the current
  // combat target. Chasing a target is a different rule — it stops inside
  // attack range and never abandons — so it stays its own flag.
  private pendingApproach: PendingApproach | null = null;
  private pursuingTarget = false;
  private lastAttackAt = -Infinity;
  private lastAbilitySignature = '';
  private lastReportedHp = 0;
  private lastReportedMana = -1;
  private lastActions = { nearFire: false };
  // AFK camping: the spot the character settled at (fights are leashed to it)
  // and whether they are currently standing down to heal.
  private afkAnchor: Point = { x: 0, y: 0 };
  private afkRecovering = false;

  constructor(options: ZoneWorldOptions) {
    const { zone, character, events, input, entry, hp, rng } = options;
    this.zone = zone;
    this.character = character;
    this.events = events;
    this.input = input;

    const size = zoneWorldSize(zone);
    this.worldWidth = size.width;
    this.worldHeight = size.height;
    this.spawnPoint = { x: this.worldWidth / 2, y: this.worldHeight / 2 };

    const start = this.startPoint(entry);
    this.player = new Player(
      start.x,
      start.y,
      character.state.classId,
      input,
      character.state.gear,
      character.state.name,
      character.state.level,
    );
    if (hp !== undefined) {
      this.player.setHp(hp);
    }
    this.lastReportedHp = this.player.hp;

    this.mobs = zone.mobSpawns.map(
      ({ dx, dy, enemyId, level }) =>
        new Mob(
          this.spawnPoint.x + dx,
          this.spawnPoint.y + dy,
          ENEMIES[enemyId],
          level,
          rng ?? Math.random,
        ),
    );

    this.nodes = zone.nodeSpawns.map(
      ({ dx, dy, nodeId }) =>
        new ResourceNode(this.spawnPoint.x + dx, this.spawnPoint.y + dy, RESOURCE_NODES[nodeId]),
    );

    this.npcs = zone.npcSpawns.map(({ dx, dy, npcId }) => ({
      x: this.spawnPoint.x + dx,
      y: this.spawnPoint.y + dy,
      npcId,
    }));

    // One tappable signpost per exit — the mobile way out of a zone.
    this.signposts = zone.exits.map((exit) => {
      const point = signpostPoint(exit.edge, this.worldWidth, this.worldHeight);
      return { x: point.x, y: point.y, exit, label: ZONES[exit.to].name };
    });

    // Nothing walks into the pond. One description of the world, which the
    // player and every mob integrate themselves against.
    this.collisionWorld = {
      grid: zone.map,
      blockingTiles: new Set(BLOCKING_TILES),
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      blockers: this.nodes
        .filter((node) => node.definition.solid)
        .map((node) => node.blockerRect()),
    };

    this.subscribe();
    // The HUD may be carrying HP from before the world was rebuilt (a zone
    // walk, or the death that sent us here) — resync it unconditionally.
    this.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
  }

  // Where the player stands when this world opens: the arrival point if they
  // walked in through an exit, the spot the save was left at if they are
  // resuming into the zone that save names, and the middle of the map
  // otherwise — a new character, or one who owes a respawn.
  private startPoint(entry: ZoneWorldOptions['entry']): Point {
    if (entry) {
      return arrivalPoint(
        entry.edge,
        entry.fraction,
        this.worldWidth,
        this.worldHeight,
        ARRIVAL_INSET,
      );
    }
    const { position, zoneId } = this.character.state;
    if (position && zoneId === this.zone.id) {
      return resumePoint(position, this.worldWidth, this.worldHeight, ARRIVAL_INSET);
    }
    return { x: this.worldWidth / 2, y: this.worldHeight / 2 };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  private subscribe(): void {
    const listen = <K extends UiEventName>(
      event: K,
      handler: (...args: UiEventMap[K]) => void,
    ): void => {
      this.events.on(event, handler);
      this.subscriptions.push(() => this.events.off(event, handler));
    };
    listen(EQUIP_ITEM_REQUESTED_EVENT, this.handleEquipRequested.bind(this));
    listen(UNEQUIP_SLOT_REQUESTED_EVENT, this.handleUnequipRequested.bind(this));
    listen(EAT_ITEM_REQUESTED_EVENT, this.handleEatRequested.bind(this));
    listen(COOK_REQUESTED_EVENT, this.handleCookRequested.bind(this));
    listen(LIGHT_FIRE_REQUESTED_EVENT, this.handleLightFireRequested.bind(this));
    listen(BUY_ITEM_REQUESTED_EVENT, this.handleBuyRequested.bind(this));
    listen(SELL_ITEM_REQUESTED_EVENT, this.handleSellRequested.bind(this));
    listen(SHOP_CLOSED_EVENT, this.handleShopClosedByUi.bind(this));
    listen(ABILITY_REQUESTED_EVENT, this.handleAbilityRequested.bind(this));
    listen(AFK_TOGGLE_REQUESTED_EVENT, this.toggleAfk.bind(this));
    listen(ACCEPT_QUEST_REQUESTED_EVENT, this.handleAcceptQuestRequested.bind(this));
    listen(TURN_IN_QUEST_REQUESTED_EVENT, this.handleTurnInQuestRequested.bind(this));
    listen(SET_TITLE_REQUESTED_EVENT, this.handleSetTitleRequested.bind(this));
  }

  /** Drops every subscription. The host calls this before building the next world. */
  destroy(): void {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.length = 0;
  }

  /**
   * Pays out a camp that was left running when the tab closed, and hands the
   * report back rather than announcing it: the only load that can find a parked
   * session is the first boot into a world, and the HUD is not listening yet at
   * that point. Runs once and clears the session either way — a session that
   * paid nothing must not be able to pay again on the next load.
   */
  resolveParkedAfk(): ParkedAfkResult | null {
    const session = this.character.state.afk;
    if (!session) return null;
    this.character.state.afk = null;

    const report = resolveOfflineAfk(session, {
      now: Date.now(),
      characterLevel: this.character.state.level,
      inventory: this.character.state.inventory,
      capacity: this.character.carryCapacity(),
    });
    if (report.kills <= 0) {
      this.persistCharacter();
      return null;
    }

    for (const [itemId, quantity] of Object.entries(report.drops)) {
      this.character.addItem(itemId, quantity);
    }
    this.character.addCurrency(report.copper);
    this.awardXp(report.xp);
    const unlocks = report.enemyId ? this.creditKill(report.enemyId, report.kills) : [];
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
    this.persistCharacter();
    return { report, unlocks };
  }

  // ---------------------------------------------------------------------------
  // The tick
  // ---------------------------------------------------------------------------

  /** Steps the world one frame and hands back everything a view has to draw. */
  update(deltaMs: number): WorldEvent[] {
    if (this.changingZone) return this.drain();
    this.now += deltaMs;

    this.applyInputActions();
    this.updateAfk();
    this.updateApproach(deltaMs);
    this.player.update(deltaMs, this.collisionWorld);
    const healed = this.player.takeHealPulse();
    if (healed > 0) {
      this.pending.push({ kind: 'heal', at: this.playerPoint(), amount: healed });
    }
    this.mobs.forEach((mob) => {
      if (mob.update(this.player.x, this.player.y, deltaMs, this.collisionWorld)) {
        this.pending.push({ kind: 'spawn', mob });
      }
    });
    this.nodes.forEach((node) => node.update(deltaMs));
    if (this.campfire?.update(deltaMs)) {
      this.campfire = null;
    }
    this.dropDeadTarget();
    this.updateGathering(deltaMs);
    this.updateCombat();
    this.updateEnemyAttacks();
    this.publishPlayerHp();
    this.publishPlayerMana();
    this.publishAbilityState();
    this.publishActions();
    this.updateShopRange();
    this.checkZoneExit();
    return this.drain();
  }

  private drain(): WorldEvent[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }

  private playerPoint(): Point {
    return { x: this.player.x, y: this.player.y };
  }

  // One-shot keys, taken once a frame rather than fired from a listener, so the
  // whole of a tick's input arrives through the same door the port will use.
  // F9 stays a desktop shortcut; the options menu is the way a phone gets there.
  private applyInputActions(): void {
    this.input.takeActions().forEach((action) => {
      if (action === 'clear-target') {
        this.clearTarget();
      } else {
        // The host owns everything a reset touches — the save, the HUD scene,
        // the character creator — and already listens for this from the
        // options panel, so the key press takes the same road.
        this.events.emit(RESET_CHARACTER_REQUESTED_EVENT);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Taps and approaches
  // ---------------------------------------------------------------------------

  /**
   * Puts the player somewhere with no walk left over and no momentum. Almost
   * every scenario in `scripts/smoke.mjs` is staged with this; it goes through
   * the world rather than reaching into `player` so it is one call to keep
   * renderer-agnostic, and one place to clear anything a teleport should void.
   */
  teleport(x: number, y: number): void {
    this.player.setPosition(x, y);
    this.player.setVelocity(0, 0);
    this.player.stopMoving();
    this.pendingApproach = null;
    this.pursuingTarget = false;
  }

  /** What the view calls when the player touches the world. */
  tap(target: WorldTap): void {
    // Touching the world is taking the controls back.
    this.setAfk(false);

    if (target.kind === 'node') {
      this.clearTarget();
      this.pursuingTarget = false;
      this.approachAndGather(target.node);
      return;
    }

    // Any other tap ends a gather: picking a fight or walking off is a choice
    // to stop chopping.
    this.stopGathering();
    this.pendingApproach = null;

    switch (target.kind) {
      case 'signpost':
        this.clearTarget();
        this.pursuingTarget = false;
        this.approachSignpost(target.signpost);
        return;
      case 'npc':
        this.clearTarget();
        this.pursuingTarget = false;
        this.approachShop(target.npc);
        return;
      case 'mob':
        this.setTarget(target.mob);
        // Auto-approach: walking into range is implied by choosing a target.
        this.pursuingTarget = true;
        return;
      default:
        this.clearTarget();
        this.pursuingTarget = false;
        this.player.moveTo(target.point.x, target.point.y);
    }
  }

  // Walk toward a tapped node and start the gather once inside its interact
  // radius; startGathering fires immediately when already there.
  approachAndGather(node: ResourceNode): void {
    if (withinRadius(this.player, node, node.definition.interactRadius)) {
      this.startGathering(node);
      return;
    }
    this.beginApproach(
      { kind: 'gather', radius: node.definition.interactRadius * GATHER_APPROACH_FRACTION },
      node,
      () => this.startGathering(node),
    );
  }

  // Walk toward a tapped signpost and take its exit on arrival — the mobile
  // route out of a zone; walking into the map edge still works for WASD.
  approachSignpost(signpost: WorldSignpost): void {
    if (withinRadius(this.player, signpost, SIGNPOST_INTERACT_RADIUS)) {
      this.leaveZone(signpost.exit);
      return;
    }
    this.beginApproach({ kind: 'signpost', radius: SIGNPOST_INTERACT_RADIUS }, signpost, () =>
      this.leaveZone(signpost.exit),
    );
  }

  approachShop(npc: WorldNpc): void {
    if (withinRadius(this.player, npc, SHOP_INTERACT_RADIUS)) {
      this.openShop(npc);
      return;
    }
    this.beginApproach({ kind: 'shop', radius: SHOP_INTERACT_RADIUS }, npc, () =>
      this.openShop(npc),
    );
  }

  // Nodes, shopkeepers and signposts all stand still, so the destination is
  // captured once here rather than re-read every frame.
  private beginApproach(
    interaction: Pick<PendingInteraction, 'kind' | 'radius'>,
    at: Point,
    act: () => void,
  ): void {
    this.pendingApproach = {
      interaction: { ...interaction, point: { x: at.x, y: at.y } },
      act,
    };
    this.player.moveTo(at.x, at.y);
  }

  // Drives the click-to-move approaches: closing on a combat target, walking
  // up to a node before gathering, or up to a shopkeeper before trading. WASD
  // input cancels all of them.
  private updateApproach(deltaMs: number): void {
    if (this.player.isKeyboardMoving()) {
      this.setAfk(false);
      this.pursuingTarget = false;
      this.pendingApproach = null;
      return;
    }

    if (this.pendingApproach) {
      const { interaction, act } = this.pendingApproach;
      const result = resolveApproach(
        interaction,
        this.player,
        this.player.hasMoveTarget(),
        arriveRadius(this.player.speed, deltaMs),
      );
      if (result.kind === 'walking') {
        return;
      }
      this.pendingApproach = null;
      if (result.kind === 'act') {
        this.player.stopMoving();
        act();
      }
      return;
    }

    if (this.pursuingTarget) {
      if (!this.target || !this.target.isAlive()) {
        this.pursuingTarget = false;
        return;
      }
      // Stop a little inside attack range, mirroring how mobs close in, so the
      // player doesn't hover exactly on the boundary of their own reach.
      if (isInRange(distance(this.player, this.target), this.player.attackRange * 0.8)) {
        this.pursuingTarget = false;
        this.player.stopMoving();
      } else {
        this.player.moveTo(this.target.x, this.target.y);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zones
  // ---------------------------------------------------------------------------

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
      this.leaveZone(exit);
    }
  }

  private leaveZone(exit: ZoneExit): void {
    this.changingZone = true;
    const entryEdge = oppositeEdge(exit.edge);
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
    // Save the spot in the zone being *entered*, not the one being left: a tab
    // closed mid-walk should come back where the walk was going. The next world
    // computes the same point from the entry edge.
    const destination = zoneWorldSize(ZONES[exit.to]);
    this.character.recordLocation(
      exit.to,
      arrivalPoint(entryEdge, fraction, destination.width, destination.height, ARRIVAL_INSET),
    );
    saveService.save(this.character.state);
    this.pending.push({ kind: 'zone-exit', to: exit.to, edge: entryEdge, fraction });
  }

  // ---------------------------------------------------------------------------
  // Shop and vendoring
  // ---------------------------------------------------------------------------

  // Walking off mid-trade closes the window, like any vendor would.
  updateShopRange(): void {
    if (!this.shopNpc) return;
    if (!withinRadius(this.player, this.shopNpc, SHOP_CLOSE_RADIUS)) {
      this.closeShop();
    }
  }

  private openShop(npc: WorldNpc): void {
    this.player.stopMoving();
    this.shopNpc = npc;
    this.events.emit(SHOP_OPENED_EVENT);
  }

  closeShop(): void {
    if (!this.shopNpc) return;
    this.shopNpc = null;
    this.events.emit(SHOP_CLOSED_EVENT);
  }

  // The UI's close button already tore the panel down; just drop the state.
  private handleShopClosedByUi(): void {
    this.shopNpc = null;
  }

  handleBuyRequested(itemId: string): void {
    if (!this.shopNpc) return;
    const price = shopPriceFor(itemId);
    if (price === null) return;
    // Checked before the coin leaves the purse, so a full pack never sells the
    // player something they can't take home.
    if (!this.character.canCarryItem(itemId, 1)) {
      this.events.emit(GATHER_REFUSED_EVENT, 'Your pack is too full to carry that.');
      return;
    }
    if (!this.character.spendCurrency(price)) {
      this.events.emit(GATHER_REFUSED_EVENT, "You can't afford that.");
      return;
    }
    this.character.addItem(itemId, 1);
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
  }

  handleSellRequested(itemId: string): void {
    if (!this.shopNpc) return;
    const value = itemValue(itemId);
    if (value === null || this.character.itemCount(itemId) <= 0) return;
    this.character.removeItem(itemId, 1);
    this.character.addCurrency(value);
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
  }

  // ---------------------------------------------------------------------------
  // Quests and titles
  // ---------------------------------------------------------------------------

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
      this.events.emit(GATHER_REFUSED_EVENT, result.reason);
      return;
    }
    this.log(logQuestCompleted(QUESTS[questId].name));
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
    this.announceQuests();
    this.publishXpGain(result.xp);
    this.persistCharacter();
  }

  private announceQuests(): void {
    this.events.emit(QUEST_LOG_CHANGED_EVENT, this.character.state.quests);
  }

  private handleSetTitleRequested(titleId: TitleId | null): void {
    if (!this.character.setActiveTitle(titleId)) return;
    this.events.emit(TITLE_CHANGED_EVENT, this.character.state.activeTitleId);
    this.persistCharacter();
  }

  // ---------------------------------------------------------------------------
  // AFK camping
  // ---------------------------------------------------------------------------

  // Deliberately a worse player than the person it stands in for: it picks
  // targets and eats, but never casts, and everything it earns is halved on the
  // way in (see awardXp).
  toggleAfk(): void {
    this.setAfk(!this.afkActive);
  }

  setAfk(active: boolean): void {
    if (this.afkActive === active) return;
    this.afkActive = active;
    this.afkRecovering = false;
    if (active) {
      this.stopGathering();
      this.closeShop();
      this.afkAnchor = this.playerPoint();
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
    this.events.emit(AFK_STATE_CHANGED_EVENT, this.afkActive);
  }

  private updateAfk(): void {
    if (!this.afkActive || !this.player.isAlive()) return;

    // A fight that wandered off the camp is dropped rather than followed: the
    // anchor is what keeps an unattended character where they were left.
    if (this.target && !withinRadius(this.afkAnchor, this.target, AFK_ANCHOR_RADIUS)) {
      this.clearTarget();
      this.pursuingTarget = false;
    }

    const action = decideAfkAction(
      this.mobs.map((mob, index) => ({
        index,
        distance: distance(this.afkAnchor, mob),
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

  // ---------------------------------------------------------------------------
  // Gathering, fire and cooking
  // ---------------------------------------------------------------------------

  startGathering(node: ResourceNode): void {
    if (!node.isAvailable()) {
      this.events.emit(GATHER_REFUSED_EVENT, `The ${node.definition.name} is spent.`);
      return;
    }

    const check = canGather(
      node.definition,
      this.character.state.skills,
      this.character.state.gear,
    );
    if (!check.ok) {
      this.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }

    this.gatherNode = node;
    this.gatherState = beginGather(
      node.definition,
      this.character.skillLevelOf(node.definition.skill),
    );
    this.events.emit(GATHER_STARTED_EVENT, node.definition.name);
  }

  stopGathering(): void {
    if (!this.gatherState) return;
    this.gatherState = null;
    this.gatherNode = null;
    this.events.emit(GATHER_ENDED_EVENT);
  }

  private updateGathering(deltaMs: number): void {
    if (!this.gatherState || !this.gatherNode) return;

    const node = this.gatherNode;
    const outcome = advanceGather(this.gatherState, deltaMs, distance(this.player, node));

    if (outcome.status === 'gathering') {
      this.gatherState = outcome.state;
      this.events.emit(GATHER_PROGRESS_EVENT, outcome.progress);
      this.pending.push({
        kind: 'gather-tick',
        at: { x: node.x, y: node.y },
        nodeId: node.definition.id,
        progress: outcome.progress,
      });
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
      this.events.emit(GATHER_REFUSED_EVENT, 'Your pack is full.');
      this.stopGathering();
      return;
    }
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.awardSkillXp(definition.skill, definition.xpReward);

    const emptied = node.consumeCharge();
    if (emptied) {
      this.stopGathering();
      return;
    }

    // Auto-repeat: re-arm the channel so gathering runs unattended until
    // something interrupts it.
    this.gatherState = beginGather(definition, this.character.skillLevelOf(definition.skill));
    this.events.emit(GATHER_PROGRESS_EVENT, 0);
  }

  private isNearFire(): boolean {
    if (!this.campfire?.isLit()) return false;
    return withinRadius(this.player, this.campfire, FIRE_COOK_RADIUS);
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
    this.events.emit(ACTIONS_CHANGED_EVENT, next);
  }

  handleLightFireRequested(): void {
    if (this.character.itemCount(FIRE_INPUT_ITEM_ID) <= 0) {
      this.events.emit(GATHER_REFUSED_EVENT, 'You have no logs to burn.');
      return;
    }

    // One fire at a time: lighting a new one replaces the old, rather than
    // letting the player carpet the town in campfires.
    this.campfire?.extinguish();
    this.character.removeItem(FIRE_INPUT_ITEM_ID, 1);
    this.campfire = new Campfire(this.player.x, this.player.y + 32);
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
  }

  // With an item selected in the bag the HUD names what to cook; without one
  // (dev console, older callers) fall back to the first cookable thing.
  handleCookRequested(itemId?: string): void {
    const recipe =
      (itemId ? recipeForInput(itemId) : null) ?? findCookableItem(this.character.state.inventory);
    if (!recipe) {
      this.events.emit(GATHER_REFUSED_EVENT, 'You have nothing to cook.');
      return;
    }

    const check = canCook(
      recipe,
      this.character.state.skills,
      this.character.state.inventory,
      this.isNearFire(),
    );
    if (!check.ok) {
      this.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }

    const result = rollCook(recipe, this.character.skillLevelOf('cooking'));
    this.character.removeItem(recipe.inputItemId, 1);
    this.character.addItem(result.itemId, 1);
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    if (result.burnt) {
      this.events.emit(GATHER_REFUSED_EVENT, 'You burn it.');
    } else {
      this.awardSkillXp('cooking', result.xp);
    }
  }

  handleEatRequested(itemId: string): void {
    if (this.character.itemCount(itemId) <= 0 || !consumableFor(itemId)) {
      return;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.events.emit(GATHER_REFUSED_EVENT, 'You are already at full health.');
      return;
    }
    if (!this.player.eat(itemId)) {
      return;
    }

    this.character.removeItem(itemId, 1);
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
  }

  // ---------------------------------------------------------------------------
  // Targeting and combat
  // ---------------------------------------------------------------------------

  setTarget(mob: Mob): void {
    this.target = mob;
    this.publishTarget();
  }

  private publishTarget(): void {
    if (!this.target) return;
    this.events.emit(TARGET_SELECTED_EVENT, {
      name: this.target.name,
      level: this.target.level,
      hp: this.target.hp,
      maxHp: this.target.maxHp,
      conColor: conColor(this.character.state.level, this.target.level),
    });
  }

  clearTarget(): void {
    if (!this.target) return;
    this.target = null;
    this.events.emit(TARGET_CLEARED_EVENT);
  }

  private dropDeadTarget(): void {
    if (this.target && !this.target.isAlive()) {
      this.clearTarget();
    }
  }

  private updateCombat(): void {
    if (!this.target || !this.target.isAlive()) {
      return;
    }

    if (!isInRange(distance(this.player, this.target), this.player.attackRange)) {
      return;
    }
    if (!isCooldownReady(this.now - this.lastAttackAt, this.player.effectiveAttackCooldownMs())) {
      return;
    }

    this.lastAttackAt = this.now;
    const weaponSkill = this.character.activeWeaponSkill();
    const { damage } = resolveAttack({
      attackPower: this.player.attackPower,
      weaponSkillLevel: this.character.skillLevelOf(weaponSkill),
    });
    this.pending.push({
      kind: 'hit',
      on: 'mob',
      via: 'weapon',
      at: { x: this.target.x, y: this.target.y },
      damage,
      absorbed: 0,
    });
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

  private updateEnemyAttacks(): void {
    if (!this.player.isAlive()) return;

    for (const mob of this.mobs) {
      if (!mob.isEngaged()) continue;

      if (!isInRange(distance(mob, this.player), mob.attackRange)) continue;
      if (!isCooldownReady(this.now - mob.lastAttackAt, mob.attackCooldownMs)) continue;

      mob.lastAttackAt = this.now;

      // A turned-aside hit trains the skill that turned it aside and stops
      // there — no damage, and nothing to interrupt a gather.
      const defense = rollDefense({
        blockLevel: this.character.skillLevelOf('block'),
        parryLevel: this.character.skillLevelOf('parry'),
        hasWeapon: this.character.state.gear.weapon !== null,
      });
      if (defense.avoided && defense.skillId) {
        this.pending.push({
          kind: 'defend',
          at: this.playerPoint(),
          skillName: SKILLS[defense.skillId].name,
        });
        this.log(logDefense(SKILLS[defense.skillId].name, mob.name));
        this.awardSkillXp(defense.skillId, DEFENSE_SKILL_XP_PER_SAVE, { silent: true });
        continue;
      }

      const { damage } = resolveAttack({ attackPower: mob.attackPower });
      const absorbed = this.player.takeDamage(damage);
      this.pending.push({
        kind: 'hit',
        on: 'player',
        via: 'weapon',
        at: this.playerPoint(),
        damage,
        absorbed,
      });
      if (absorbed > 0) {
        this.log(logAbsorbed(absorbed));
      }
      if (damage > absorbed) {
        this.log(logDamageTaken(mob.name, damage - absorbed));
      }
      // Taking a hit breaks the channel, so gathering is never a way to ignore a
      // mob already chewing on you.
      if (this.gatherState) {
        this.events.emit(GATHER_REFUSED_EVENT, 'You are interrupted!');
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
    this.pendingApproach = null;
    this.pursuingTarget = false;
    this.player.stopMoving();
    this.log(logNotice('You have died.'));
    this.events.emit(PLAYER_DIED_EVENT);

    // Dying away from home sends you back to town — respawning in the middle
    // of a hostile zone would just feed the same bandit again.
    if (this.zone.id !== 'town') {
      this.changingZone = true;
      // No spot: a corpse owes a respawn, and town's default spawn is where
      // the host's next world puts them anyway.
      this.character.recordLocation('town', null);
      saveService.save(this.character.state);
      this.pending.push({ kind: 'death', on: 'player', respawnZone: 'town' });
      return;
    }

    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.player.setVelocity(0, 0);
    this.player.restoreToFull();
    this.persistCharacter();
    this.pending.push({ kind: 'death', on: 'player', respawnZone: null });
  }

  // Regen and enemy hits both move HP outside of any single event, so the HUD is
  // driven off the rounded value changing rather than off each damage source.
  private publishPlayerHp(): void {
    if (this.player.hp === this.lastReportedHp) return;
    this.lastReportedHp = this.player.hp;
    this.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
  }

  /**
   * Everything a corpse is worth, for a mob that has already died this frame.
   * Both the swing path and the ability path end here so a new reward can only
   * ever be added once — the two used to carry their own copy of this, which is
   * how a reward gets wired into melee and silently missed on spellcasting.
   * Safe to read the mob after death: its reward fields are readonly and set in
   * the constructor, so dying does not clear them.
   */
  resolveKill(mob: Mob): void {
    this.pending.push({ kind: 'death', on: 'mob', mob });
    this.log(logKill(mob.name));
    this.awardXp(mob.xpReward);
    this.grantLoot(mob.lootTableId);
    this.announceUnlocks(this.creditKill(mob.definition.id));
  }

  /**
   * Credits kills to the slayer chains and reports what they completed. Does
   * not announce anything itself: a live kill can emit, but an offline camp
   * settles up before the HUD is listening, so the caller decides how the news
   * travels.
   */
  creditKill(enemyId: EnemyId, count = 1): AchievementUnlock[] {
    const worn = this.character.state.activeTitleId;
    const crossed = this.character.recordKill(enemyId, count);
    this.events.emit(KILLS_CHANGED_EVENT, this.character.state.kills);
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
      this.pending.push({
        kind: 'float',
        at: { x: this.player.x, y: this.player.y - 60 },
        text: unlock.name,
        tone: 'skill',
      });
      this.events.emit(ACHIEVEMENT_UNLOCKED_EVENT, unlock);
      if (unlock.titleWorn && unlock.titleId) {
        this.log(logTitleEarned(titleName(unlock.titleId)));
        this.events.emit(TITLE_CHANGED_EVENT, unlock.titleId);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rewards
  // ---------------------------------------------------------------------------

  private awardXp(reward: number): void {
    // The one choke point both the swing and the ability paths run through, so
    // it is the one place the AFK penalty has to be applied. A quest reward is
    // not one of them — handing a quest in is something the player did — so it
    // comes in through publishXpGain instead.
    const amount = afkXpReward(reward, this.afkActive);
    const gain = this.character.awardXp(amount);
    this.pending.push({
      kind: 'float',
      at: { x: this.player.x, y: this.player.y - 20 },
      text: `+${amount} XP`,
      tone: 'reward',
    });
    this.log(logXpGain(amount));
    this.publishXpGain(gain);
  }

  // Everything a level costs the rest of the world, for XP however it arrived.
  private publishXpGain(gain: CombatXpGain): void {
    this.events.emit(XP_GAINED_EVENT, gain.level, gain.xp, gain.xpToNext);

    if (gain.leveledUp) {
      this.log(logLevelUp(gain.level));
      this.player.setLevel(gain.level);
      this.publishTarget();
      this.events.emit(LEVEL_UP_EVENT, gain.level);
      this.persistCharacter();
    }
  }

  // Combat skills tick up a point at a time on every swing, which would bury
  // the screen in floating text — those pass `silent` and are seen only on the
  // sheet and at the level-up toast.
  private awardSkillXp(skill: SkillId, amount: number, options?: { silent: boolean }): void {
    const gain = this.character.awardSkillXp(skill, amount);
    if (!options?.silent) {
      this.pending.push({
        kind: 'float',
        at: { x: this.player.x, y: this.player.y - 20 },
        text: `+${amount} ${SKILLS[skill].name} XP`,
        tone: 'skill',
      });
    }
    this.events.emit(SKILL_XP_GAINED_EVENT, gain);
    if (gain.leveledUp) {
      this.log(logSkillLevelUp(SKILLS[skill].name, gain.level));
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
      this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    }
    if (copper > 0) {
      this.character.addCurrency(copper);
      this.log(logCoin(copper));
      this.pending.push({
        kind: 'float',
        at: { x: this.player.x, y: this.player.y - 40 },
        text: `+${formatCurrency(copper)}`,
        tone: 'reward',
      });
      this.events.emit(CURRENCY_CHANGED_EVENT, this.character.state.currency);
    }
  }

  // ---------------------------------------------------------------------------
  // Abilities
  // ---------------------------------------------------------------------------

  // The world owns the decision because it is the only thing that knows about
  // targets and range; the HUD just asks.
  handleAbilityRequested(abilityId: AbilityId): void {
    if (!this.player.isAlive()) return;
    const ability = abilityById(abilityId);
    if (ability.classId !== this.character.state.classId) return;

    const check = canUseAbility(ability, {
      mana: this.player.mana,
      elapsedMs: this.now - (this.lastAbilityAt.get(abilityId) ?? -Infinity),
      hasTarget: this.target !== null && this.target.isAlive(),
      targetDistance: this.target ? distance(this.player, this.target) : Infinity,
    });
    if (!check.ok) {
      this.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }

    if (!this.player.spendMana(ability.manaCost)) return;
    this.lastAbilityAt.set(abilityId, this.now);
    this.stopGathering();
    this.player.markInCombat();
    this.publishAbilityState();

    // A spell that fizzles still costs the mana and the cooldown; that is what
    // makes Destruction worth levelling.
    const skillLevel = ability.skill ? this.character.skillLevelOf(ability.skill) : 0;
    this.log(logAbilityUsed(ability.name));
    if (ability.skill && rollSpellFailure(ability, skillLevel)) {
      this.pending.push({
        kind: 'float',
        at: this.playerPoint(),
        text: 'Fizzle!',
        tone: 'dim',
      });
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
        // A bolt thrown from the caster to the target. Purely cosmetic, but a
        // ranged nuke that produced only a number over the mob read as nothing
        // happening. A melee ability has no flight to draw.
        if (ability.range > 0) {
          this.pending.push({
            kind: 'bolt-cast',
            abilityId: ability.id,
            from: this.playerPoint(),
            to: { x: target.x, y: target.y },
          });
        }
        this.pending.push({
          kind: 'hit',
          on: 'mob',
          via: 'ability',
          at: { x: target.x, y: target.y },
          damage,
          absorbed: 0,
        });
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
        this.pending.push({
          kind: 'float',
          at: this.playerPoint(),
          text: ability.name,
          tone: 'skill',
        });
        return;
      }
      case 'haste': {
        const haste = startHaste(ability);
        if (haste) this.player.applyHaste(haste);
        this.pending.push({
          kind: 'float',
          at: this.playerPoint(),
          text: ability.name,
          tone: 'reward',
        });
        return;
      }
    }
  }

  // The bar redraws off this; emitted only when a button's rendered state moves.
  private publishAbilityState(): void {
    const states = abilitiesFor(this.character.state.classId).map((ability) => {
      const elapsedMs = this.now - (this.lastAbilityAt.get(ability.id) ?? -Infinity);
      const cooldownRemaining = Math.min(
        1,
        Math.max(0, (ability.cooldownMs - elapsedMs) / ability.cooldownMs),
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
    this.events.emit(ABILITY_STATE_CHANGED_EVENT, states);
  }

  private publishPlayerMana(): void {
    if (this.player.mana === this.lastReportedMana) return;
    this.lastReportedMana = this.player.mana;
    this.events.emit(PLAYER_MANA_CHANGED_EVENT, this.player.mana, this.player.maxMana);
  }

  // ---------------------------------------------------------------------------
  // Gear and persistence
  // ---------------------------------------------------------------------------

  handleEquipRequested(itemId: string): void {
    const check = this.character.equip(itemId);
    if (!check.ok) {
      this.events.emit(GATHER_REFUSED_EVENT, check.reason);
      return;
    }
    this.applyGearChange();
  }

  handleUnequipRequested(slot: GearSlotId): void {
    this.character.unequip(slot);
    this.applyGearChange();
  }

  // Gear moves max HP, so the HUD needs the new current HP alongside the gear.
  private applyGearChange(): void {
    this.player.setGear(this.character.state.gear);
    this.events.emit(GEAR_CHANGED_EVENT, this.character.state.gear);
    this.events.emit(INVENTORY_CHANGED_EVENT, this.character.state.inventory);
    this.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
  }

  persistCharacter(): void {
    this.character.recordLocation(this.zone.id, this.player);
    saveService.save(this.character.state);
  }

  private log(entry: CombatLogEntry): void {
    this.events.emit(COMBAT_LOG_EVENT, entry);
  }
}
