import { EXIT_MARGIN, TILE_SIZE } from '../config/constants';
import { BLOCKING_TILES } from '../data/tiles';
import { ZONES, type ZoneDefinition, type ZoneExit } from '../data/zones';
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
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GATHER_ENDED_EVENT,
  GATHER_PROGRESS_EVENT,
  GATHER_STARTED_EVENT,
  GEAR_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TITLE_CHANGED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  type AbilityState,
  type AchievementUnlock,
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
  logSpellFailed,
  logTitleEarned,
  logXpGain,
} from '../systems/CombatLogSystem';
import { isCooldownReady, isInRange, resolveAttack, rollDefense } from '../systems/CombatSystem';
import { conColor } from '../systems/EnemySystem';
import { rollLootTable } from '../systems/LootSystem';
import { canCook, findCookableItem, recipeForInput, rollCook } from '../systems/CookingSystem';
import { FIRE_COOK_RADIUS, FIRE_INPUT_ITEM_ID } from '../data/recipes';
import { consumableFor, describeItemName } from '../data/items';
import { SKILLS } from '../data/skills';
import { SHOP_INTERACT_RADIUS } from '../data/shop';
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
import { createSubscriptions, type Subscriptions } from './eventBus';
import { QuestDesk } from './QuestDesk';
import { ShopSession } from './ShopSession';
import { WorldContext } from './WorldContext';
import { publishOnChange } from './publishOnChange';
import type { EventBus, WorldEvent } from './worldEvents';
import type {
  AbilityId,
  EnemyId,
  GearSlotId,
  ItemId,
  LootTableId,
  NpcId,
  ZoneEdge,
} from '../types/ids';
import { inventoryEntries } from '../systems/InventorySystem';

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
  afkActive = false;
  /** Set once the player has walked out; the world stops stepping after it. */
  changingZone = false;
  /** When each ability was last cast, for the cooldown check and the bar's sweep. */
  readonly lastAbilityAt = new Map<AbilityId, number>();

  /** The clock, the channels and the character — everything shared. */
  private readonly ctx: WorldContext;
  private readonly shop: ShopSession;
  private readonly quests: QuestDesk;
  private readonly input: InputState;
  private readonly subscriptions: Subscriptions;
  private gatherNode: ResourceNode | null = null;
  // Click-to-move approach state: the node, shopkeeper or signpost the player
  // tapped and is walking toward, and whether they are closing on the current
  // combat target. Chasing a target is a different rule — it stops inside
  // attack range and never abandons — so it stays its own flag.
  private pendingApproach: PendingApproach | null = null;
  private pursuingTarget = false;
  private lastAttackAt = -Infinity;
  // The four HUD publishers that only speak when what they publish moves; see
  // installPublishers for what each one counts as a change.
  private readonly publishPlayerHp: () => void;
  private readonly publishPlayerMana: () => void;
  private readonly publishAbilityState: () => void;
  private readonly publishActions: () => void;
  // AFK camping: the spot the character settled at (fights are leashed to it)
  // and whether they are currently standing down to heal.
  private afkAnchor: Point = { x: 0, y: 0 };
  private afkRecovering = false;

  constructor(options: ZoneWorldOptions) {
    const { zone, character, events, input, entry, hp, rng } = options;
    this.zone = zone;
    this.character = character;
    this.input = input;
    this.subscriptions = createSubscriptions(events);

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
    this.ctx = new WorldContext(character, events, this.player, zone.id);

    // What each publisher counts as a change. HP and mana are their own
    // signature; the action bar compares only what it draws, and the item
    // buttons only whether a fire is in reach. The two seeds are what the world
    // opens already having said: the constructor sends HP unconditionally
    // below, and there is no fire lit in the first frame of any zone.
    this.publishPlayerHp = publishOnChange(
      () => this.player.hp,
      String,
      (hp) => this.ctx.events.emit(PLAYER_HP_CHANGED_EVENT, hp),
      String(this.player.hp),
    );
    this.publishPlayerMana = publishOnChange(
      () => ({ mana: this.player.mana, maxMana: this.player.maxMana }),
      (pool) => String(pool.mana),
      (pool) => this.ctx.events.emit(PLAYER_MANA_CHANGED_EVENT, pool),
    );
    this.publishAbilityState = publishOnChange(
      () => this.abilityStates(),
      (states) =>
        states
          .map(
            (state) => `${state.abilityId}:${state.cooldownRemaining.toFixed(2)}:${state.usable}`,
          )
          .join('|'),
      (states) => this.ctx.events.emit(ABILITY_STATE_CHANGED_EVENT, states),
      '',
    );
    this.publishActions = publishOnChange(
      () => ({ nearFire: this.isNearFire() }),
      (actions) => String(actions.nearFire),
      (actions) => this.ctx.events.emit(ACTIONS_CHANGED_EVENT, actions),
      'false',
    );

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

    this.shop = new ShopSession(this.ctx);
    this.quests = new QuestDesk(this.ctx, {
      isShopOpen: () => this.shop.isOpen(),
      publishXpGain: (gain) => this.publishXpGain(gain),
    });

    this.subscribe();
    // The HUD may be carrying HP from before the world was rebuilt (a zone
    // walk, or the death that sent us here) — resync it unconditionally.
    this.ctx.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
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
    const { listen } = this.subscriptions;
    listen(EQUIP_ITEM_REQUESTED_EVENT, this.handleEquipRequested.bind(this));
    listen(UNEQUIP_SLOT_REQUESTED_EVENT, this.handleUnequipRequested.bind(this));
    listen(EAT_ITEM_REQUESTED_EVENT, this.handleEatRequested.bind(this));
    listen(COOK_REQUESTED_EVENT, this.handleCookRequested.bind(this));
    listen(LIGHT_FIRE_REQUESTED_EVENT, this.handleLightFireRequested.bind(this));
    listen(BUY_ITEM_REQUESTED_EVENT, (itemId) => this.shop.buy(itemId));
    listen(SELL_ITEM_REQUESTED_EVENT, (itemId) => this.shop.sell(itemId));
    listen(SHOP_CLOSED_EVENT, () => this.shop.closedByUi());
    listen(ABILITY_REQUESTED_EVENT, this.handleAbilityRequested.bind(this));
    listen(AFK_TOGGLE_REQUESTED_EVENT, this.toggleAfk.bind(this));
    listen(ACCEPT_QUEST_REQUESTED_EVENT, (questId) => this.quests.accept(questId));
    listen(TURN_IN_QUEST_REQUESTED_EVENT, (questId) => this.quests.turnIn(questId));
    listen(SET_TITLE_REQUESTED_EVENT, (titleId) => this.quests.wearTitle(titleId));
  }

  /** Drops every subscription. The host calls this before building the next world. */
  destroy(): void {
    this.subscriptions.clear();
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

    for (const [itemId, quantity] of inventoryEntries(report.drops)) {
      this.character.addItem(itemId, quantity);
    }
    this.character.addCurrency(report.copper);
    this.awardXp(report.xp);
    const unlocks = report.enemyId ? this.creditKill(report.enemyId, report.kills) : [];
    this.ctx.publishInventory();
    this.ctx.publishCurrency();
    this.persistCharacter();
    return { report, unlocks };
  }

  // ---------------------------------------------------------------------------
  // The tick
  // ---------------------------------------------------------------------------

  /** Steps the world one frame and hands back everything a view has to draw. */
  update(deltaMs: number): WorldEvent[] {
    if (this.changingZone) return this.ctx.drain();
    this.ctx.now += deltaMs;

    this.applyInputActions();
    this.updateAfk();
    this.updateApproach(deltaMs);
    this.player.update(deltaMs, this.collisionWorld);
    const healed = this.player.takeHealPulse();
    if (healed > 0) {
      this.ctx.push({ kind: 'heal', at: this.ctx.playerPoint(), amount: healed });
    }
    this.mobs.forEach((mob) => {
      if (mob.update(this.player.x, this.player.y, deltaMs, this.collisionWorld)) {
        this.ctx.push({ kind: 'spawn', mob });
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
    return this.ctx.drain();
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
        this.ctx.events.emit(RESET_CHARACTER_REQUESTED_EVENT);
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

    if (target.kind === 'mob') {
      this.stopGathering();
      this.pendingApproach = null;
      this.setTarget(target.mob);
      // Auto-approach: walking into range is implied by choosing a target.
      this.pursuingTarget = true;
      return;
    }

    // Every other tap gives up whatever was selected — and, unless it is a tap
    // on the node currently being worked, gives up the gather too: walking off
    // is a choice to stop chopping.
    if (target.kind !== 'node') {
      this.stopGathering();
      this.pendingApproach = null;
    }
    this.clearTarget();

    switch (target.kind) {
      case 'node':
        this.approachAndGather(target.node);
        return;
      case 'signpost':
        this.approachSignpost(target.signpost);
        return;
      case 'npc':
        this.approachShop(target.npc);
        return;
      case 'ground':
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
      this.shop.open(npc);
      return;
    }
    this.beginApproach({ kind: 'shop', radius: SHOP_INTERACT_RADIUS }, npc, () =>
      this.shop.open(npc),
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
    this.ctx.push({ kind: 'zone-exit', to: exit.to, edge: entryEdge, fraction });
  }

  // ---------------------------------------------------------------------------
  // Shop and vendoring
  // ---------------------------------------------------------------------------

  /** The shopkeeper the open shop belongs to; null when the shop is closed. */
  get shopNpc(): WorldNpc | null {
    return this.shop.npc;
  }

  updateShopRange(): void {
    this.shop.updateRange();
  }

  closeShop(): void {
    this.shop.close();
  }

  handleBuyRequested(itemId: ItemId): void {
    this.shop.buy(itemId);
  }

  handleSellRequested(itemId: ItemId): void {
    this.shop.sell(itemId);
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
      this.afkAnchor = this.ctx.playerPoint();
      this.ctx.log(logNotice('You settle in to camp.'));
    } else {
      this.ctx.log(logNotice('You snap out of it.'));
    }
    // Written to the save, not just held here: it is the only record that
    // survives the tab closing, and the only thing offline progress is paid on.
    this.character.state.afk = active
      ? { startedAt: new Date().toISOString(), zoneId: this.zone.id }
      : null;
    this.persistCharacter();
    this.ctx.events.emit(AFK_STATE_CHANGED_EVENT, this.afkActive);
  }

  private updateAfk(): void {
    if (!this.afkActive || !this.player.isAlive()) return;

    // A fight that wandered off the camp is dropped rather than followed: the
    // anchor is what keeps an unattended character where they were left.
    if (this.target && !withinRadius(this.afkAnchor, this.target, AFK_ANCHOR_RADIUS)) {
      this.clearTarget();
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
      this.player.stopMoving();
      this.afkEat();
      return;
    }
    if (action.kind === 'idle') {
      this.pursuingTarget = false;
      return;
    }

    const mob = this.mobs[action.index];
    if (!mob) return;
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
      this.ctx.notice(`The ${node.definition.name} is spent.`);
      return;
    }

    const check = canGather(
      node.definition,
      this.character.state.skills,
      this.character.state.gear,
    );
    if (!check.ok) {
      this.ctx.notice(check.reason);
      return;
    }

    this.gatherNode = node;
    this.gatherState = beginGather(
      node.definition,
      this.character.skillLevelOf(node.definition.skill),
    );
    this.ctx.events.emit(GATHER_STARTED_EVENT, node.definition.name);
  }

  stopGathering(): void {
    if (!this.gatherState) return;
    this.gatherState = null;
    this.gatherNode = null;
    this.ctx.events.emit(GATHER_ENDED_EVENT);
  }

  private updateGathering(deltaMs: number): void {
    if (!this.gatherState || !this.gatherNode) return;

    const node = this.gatherNode;
    const outcome = advanceGather(this.gatherState, deltaMs, distance(this.player, node));

    if (outcome.status === 'gathering') {
      this.gatherState = outcome.state;
      this.ctx.events.emit(GATHER_PROGRESS_EVENT, outcome.progress);
      this.ctx.push({
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
      this.ctx.notice('Your pack is full.');
      this.stopGathering();
      return;
    }
    this.ctx.publishInventory();
    this.ctx.awardSkillXp(definition.skill, definition.xpReward);

    const emptied = node.consumeCharge();
    if (emptied) {
      this.stopGathering();
      return;
    }

    // Auto-repeat: re-arm the channel so gathering runs unattended until
    // something interrupts it.
    this.gatherState = beginGather(definition, this.character.skillLevelOf(definition.skill));
    this.ctx.events.emit(GATHER_PROGRESS_EVENT, 0);
  }

  private isNearFire(): boolean {
    if (!this.campfire?.isLit()) return false;
    return withinRadius(this.player, this.campfire, FIRE_COOK_RADIUS);
  }

  handleLightFireRequested(): void {
    if (this.character.itemCount(FIRE_INPUT_ITEM_ID) <= 0) {
      this.ctx.notice('You have no logs to burn.');
      return;
    }

    // One fire at a time: lighting a new one replaces the old, rather than
    // letting the player carpet the town in campfires.
    this.campfire?.extinguish();
    this.character.removeItem(FIRE_INPUT_ITEM_ID, 1);
    this.campfire = new Campfire(this.player.x, this.player.y + 32);
    this.ctx.publishInventory();
  }

  // With an item selected in the bag the HUD names what to cook; without one
  // (dev console, older callers) fall back to the first cookable thing.
  handleCookRequested(itemId?: ItemId): void {
    const recipe =
      (itemId ? recipeForInput(itemId) : null) ?? findCookableItem(this.character.state.inventory);
    if (!recipe) {
      this.ctx.notice('You have nothing to cook.');
      return;
    }

    const check = canCook(
      recipe,
      this.character.state.skills,
      this.character.state.inventory,
      this.isNearFire(),
    );
    if (!check.ok) {
      this.ctx.notice(check.reason);
      return;
    }

    const result = rollCook(recipe, this.character.skillLevelOf('cooking'));
    this.character.removeItem(recipe.inputItemId, 1);
    this.character.addItem(result.itemId, 1);
    this.ctx.publishInventory();
    if (result.burnt) {
      this.ctx.notice('You burn it.');
    } else {
      this.ctx.awardSkillXp('cooking', result.xp);
    }
  }

  handleEatRequested(itemId: ItemId): void {
    if (this.character.itemCount(itemId) <= 0 || !consumableFor(itemId)) {
      return;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.ctx.notice('You are already at full health.');
      return;
    }
    if (!this.player.eat(itemId)) {
      return;
    }

    this.character.removeItem(itemId, 1);
    this.ctx.publishInventory();
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
    this.ctx.events.emit(TARGET_SELECTED_EVENT, {
      name: this.target.name,
      level: this.target.level,
      hp: this.target.hp,
      maxHp: this.target.maxHp,
      conColor: conColor(this.character.state.level, this.target.level),
    });
  }

  clearTarget(): void {
    // Pursuit belongs to the target rather than beside it: there is nothing to
    // close on once there is nothing selected, and the two moved together at
    // every call site anyway.
    this.pursuingTarget = false;
    if (!this.target) return;
    this.target = null;
    this.ctx.events.emit(TARGET_CLEARED_EVENT);
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
    if (
      !isCooldownReady(this.ctx.now - this.lastAttackAt, this.player.effectiveAttackCooldownMs())
    ) {
      return;
    }

    this.lastAttackAt = this.ctx.now;
    const weaponSkill = this.character.activeWeaponSkill();
    const { damage } = resolveAttack({
      attackPower: this.player.attackPower,
      weaponSkillLevel: this.character.skillLevelOf(weaponSkill),
    });
    this.ctx.push({
      kind: 'hit',
      on: 'mob',
      via: 'weapon',
      at: { x: this.target.x, y: this.target.y },
      damage,
      absorbed: 0,
    });
    this.ctx.log(logDamageDealt(this.target.name, damage));
    this.player.markInCombat();
    this.target.takeDamage(damage);
    // Anything the player hits fights back, whether or not it opens combat itself.
    this.target.engage();
    this.publishTarget();
    // Skill comes from swinging, not from killing: a landed hit is the rep.
    this.ctx.awardSkillXp(weaponSkill, WEAPON_SKILL_XP_PER_HIT, { silent: true });
    if (!this.target.isAlive()) {
      this.resolveKill(this.target);
    }
  }

  private updateEnemyAttacks(): void {
    if (!this.player.isAlive()) return;

    for (const mob of this.mobs) {
      if (!mob.isEngaged()) continue;

      if (!isInRange(distance(mob, this.player), mob.attackRange)) continue;
      if (!isCooldownReady(this.ctx.now - mob.lastAttackAt, mob.attackCooldownMs)) continue;

      mob.lastAttackAt = this.ctx.now;

      // A turned-aside hit trains the skill that turned it aside and stops
      // there — no damage, and nothing to interrupt a gather.
      const defense = rollDefense({
        blockLevel: this.character.skillLevelOf('block'),
        parryLevel: this.character.skillLevelOf('parry'),
        hasWeapon: this.character.state.gear.weapon !== null,
      });
      if (defense.avoided && defense.skillId) {
        this.ctx.push({
          kind: 'defend',
          at: this.ctx.playerPoint(),
          skillName: SKILLS[defense.skillId].name,
        });
        this.ctx.log(logDefense(SKILLS[defense.skillId].name, mob.name));
        this.ctx.awardSkillXp(defense.skillId, DEFENSE_SKILL_XP_PER_SAVE, { silent: true });
        continue;
      }

      const { damage } = resolveAttack({ attackPower: mob.attackPower });
      const absorbed = this.player.takeDamage(damage);
      this.ctx.push({
        kind: 'hit',
        on: 'player',
        via: 'weapon',
        at: this.ctx.playerPoint(),
        damage,
        absorbed,
      });
      if (absorbed > 0) {
        this.ctx.log(logAbsorbed(absorbed));
      }
      if (damage > absorbed) {
        this.ctx.log(logDamageTaken(mob.name, damage - absorbed));
      }
      // Taking a hit breaks the channel, so gathering is never a way to ignore a
      // mob already chewing on you.
      if (this.gatherState) {
        this.ctx.notice('You are interrupted!');
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
    this.player.stopMoving();
    this.ctx.log(logNotice('You have died.'));
    this.ctx.events.emit(PLAYER_DIED_EVENT);

    // Dying away from home sends you back to town — respawning in the middle
    // of a hostile zone would just feed the same bandit again.
    if (this.zone.id !== 'town') {
      this.changingZone = true;
      // No spot: a corpse owes a respawn, and town's default spawn is where
      // the host's next world puts them anyway.
      this.character.recordLocation('town', null);
      saveService.save(this.character.state);
      this.ctx.push({ kind: 'death', on: 'player', respawnZone: 'town' });
      return;
    }

    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.player.setVelocity(0, 0);
    this.player.restoreToFull();
    this.persistCharacter();
    this.ctx.push({ kind: 'death', on: 'player', respawnZone: null });
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
    this.ctx.push({ kind: 'death', on: 'mob', mob });
    this.ctx.log(logKill(mob.name));
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
    this.ctx.events.emit(KILLS_CHANGED_EVENT, this.character.state.kills);
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
      this.ctx.log(logAchievement(unlock.name));
      this.ctx.float(unlock.name, 'skill', 60);
      this.ctx.events.emit(ACHIEVEMENT_UNLOCKED_EVENT, unlock);
      if (unlock.titleWorn && unlock.titleId) {
        this.ctx.log(logTitleEarned(titleName(unlock.titleId)));
        this.ctx.events.emit(TITLE_CHANGED_EVENT, unlock.titleId);
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
    this.ctx.float(`+${amount} XP`, 'reward', 20);
    this.ctx.log(logXpGain(amount));
    this.publishXpGain(gain);
  }

  // Everything a level costs the rest of the world, for XP however it arrived.
  private publishXpGain(gain: CombatXpGain): void {
    this.ctx.events.emit(XP_GAINED_EVENT, gain);

    if (gain.leveledUp) {
      this.ctx.log(logLevelUp(gain.level));
      this.player.setLevel(gain.level);
      this.publishTarget();
      this.ctx.events.emit(LEVEL_UP_EVENT, gain.level);
      this.persistCharacter();
    }
  }

  private grantLoot(lootTableId?: LootTableId): void {
    if (!lootTableId) return;
    const { drops, copper } = rollLootTable(lootTableId);

    let took = false;
    drops.forEach((drop) => {
      const name = describeItemName(drop.itemId);
      // A full pack leaves the drop on the corpse rather than silently eating
      // it: the log line is the only way the player would ever know.
      if (!this.character.tryAddItem(drop.itemId, drop.quantity)) {
        this.ctx.log(logNotice(`Your pack is too full to carry ${name}.`));
        return;
      }
      this.ctx.log(logLoot(name, drop.quantity));
      took = true;
    });
    if (took) {
      this.ctx.publishInventory();
    }
    if (copper > 0) {
      this.character.addCurrency(copper);
      this.ctx.log(logCoin(copper));
      this.ctx.float(`+${formatCurrency(copper)}`, 'reward', 40);
      this.ctx.publishCurrency();
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
      elapsedMs: this.ctx.now - (this.lastAbilityAt.get(abilityId) ?? -Infinity),
      hasTarget: this.target !== null && this.target.isAlive(),
      targetDistance: this.target ? distance(this.player, this.target) : Infinity,
    });
    if (!check.ok) {
      this.ctx.notice(check.reason);
      return;
    }

    if (!this.player.spendMana(ability.manaCost)) return;
    this.lastAbilityAt.set(abilityId, this.ctx.now);
    this.stopGathering();
    this.player.markInCombat();
    this.publishAbilityState();

    // A spell that fizzles still costs the mana and the cooldown; that is what
    // makes Destruction worth levelling.
    const skillLevel = ability.skill ? this.character.skillLevelOf(ability.skill) : 0;
    this.ctx.log(logAbilityUsed(ability.name));
    if (ability.skill && rollSpellFailure(ability, skillLevel)) {
      this.ctx.float('Fizzle!', 'dim');
      this.ctx.log(logSpellFailed(ability.name));
      this.ctx.awardSkillXp(ability.skill, ABILITY_SKILL_XP_PER_CAST, { silent: true });
      return;
    }

    this.applyAbilityEffect(ability, skillLevel);
    if (ability.skill) {
      this.ctx.awardSkillXp(ability.skill, ABILITY_SKILL_XP_PER_CAST, { silent: true });
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
          this.ctx.push({
            kind: 'bolt-cast',
            abilityId: ability.id,
            from: this.ctx.playerPoint(),
            to: { x: target.x, y: target.y },
          });
        }
        this.ctx.push({
          kind: 'hit',
          on: 'mob',
          via: 'ability',
          at: { x: target.x, y: target.y },
          damage,
          absorbed: 0,
        });
        this.ctx.log(logDamageDealt(target.name, damage));
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
        this.ctx.float(ability.name, 'skill');
        return;
      }
      case 'haste': {
        const haste = startHaste(ability);
        if (haste) this.player.applyHaste(haste);
        this.ctx.float(ability.name, 'reward');
        return;
      }
    }
  }

  /** What the action bar draws, for the class the player chose. */
  private abilityStates(): AbilityState[] {
    return abilitiesFor(this.character.state.classId).map((ability) => {
      const elapsedMs = this.ctx.now - (this.lastAbilityAt.get(ability.id) ?? -Infinity);
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
  }

  // ---------------------------------------------------------------------------
  // Gear and persistence
  // ---------------------------------------------------------------------------

  handleEquipRequested(itemId: ItemId): void {
    const check = this.character.equip(itemId);
    if (!check.ok) {
      this.ctx.notice(check.reason);
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
    this.ctx.events.emit(GEAR_CHANGED_EVENT, this.character.state.gear);
    this.ctx.publishInventory();
    this.ctx.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
  }

  persistCharacter(): void {
    this.ctx.persistCharacter();
  }
}
