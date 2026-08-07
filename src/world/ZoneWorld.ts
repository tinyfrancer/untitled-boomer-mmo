import { EXIT_MARGIN, TILE_SIZE } from '../config/constants';
import { BLOCKING_TILES } from '../data/tiles';
import { ZONES, type ZoneDefinition, type ZoneExit } from '../data/zones';
import { ENEMIES } from '../data/enemies';
import { RESOURCE_NODES } from '../data/resourceNodes';
import {
  ABILITY_REQUESTED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  ACTIONS_CHANGED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  COOK_REQUESTED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GEAR_CHANGED_EVENT,
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
  TURN_IN_QUEST_REQUESTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  type AchievementUnlock,
} from '../ui/uiEvents';
import { resolveOfflineAfk, type OfflineAfkReport } from '../systems/OfflineAfkSystem';
import { afkXpReward } from '../systems/AfkSystem';
import { logLevelUp, logNotice, logXpGain } from '../systems/CombatLogSystem';
import { isInRange } from '../systems/CombatSystem';
import { conColor } from '../systems/EnemySystem';
import { SHOP_INTERACT_RADIUS } from '../data/shop';
import type { GatherState } from '../systems/GatherSystem';
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
import { AbilityCaster } from './AbilityCaster';
import { CombatDirector } from './CombatDirector';
import { GatherSession } from './GatherSession';
import { AfkCamp } from './AfkCamp';
import { QuestDesk } from './QuestDesk';
import { ShopSession } from './ShopSession';
import { WorldContext } from './WorldContext';
import { publishOnChange } from './publishOnChange';
import type { Targeting } from './targeting';
import type { EventBus, WorldEvent } from './worldEvents';
import type { AbilityId, EnemyId, GearSlotId, ItemId, NpcId, ZoneEdge } from '../types/ids';
import { inventoryEntries } from '../systems/InventorySystem';

// Far enough inside the new zone that the player doesn't stand on the return
// exit and bounce straight back.
const ARRIVAL_INSET = TILE_SIZE * 1.5;
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
export class ZoneWorld implements Targeting {
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
  target: Mob | null = null;
  /** Set once the player has walked out; the world stops stepping after it. */
  changingZone = false;
  /** The clock, the channels and the character — everything shared. */
  private readonly ctx: WorldContext;
  private readonly gathering: GatherSession;
  private readonly shop: ShopSession;
  private readonly afk: AfkCamp;
  private readonly abilities: AbilityCaster;
  private readonly combat: CombatDirector;
  private readonly quests: QuestDesk;
  private readonly input: InputState;
  private readonly subscriptions: Subscriptions;
  // Click-to-move approach state: the node, shopkeeper or signpost the player
  // tapped and is walking toward, and whether they are closing on the current
  // combat target. Chasing a target is a different rule — it stops inside
  // attack range and never abandons — so it stays its own flag.
  private pendingApproach: PendingApproach | null = null;
  private pursuingTarget = false;
  // The four HUD publishers that only speak when what they publish moves; see
  // installPublishers for what each one counts as a change.
  private readonly publishPlayerHp: () => void;
  private readonly publishPlayerMana: () => void;
  private readonly publishAbilityState: () => void;
  private readonly publishActions: () => void;

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
      () => this.abilities.states(),
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
      () => ({ nearFire: this.gathering.isNearFire() }),
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

    this.gathering = new GatherSession(this.ctx);
    this.shop = new ShopSession(this.ctx);
    this.combat = new CombatDirector(this.ctx, {
      mobs: this.mobs,
      targeting: this,
      awardXp: (reward) => this.awardXp(reward),
      interruptGather: () => this.gathering.interrupt(),
      onPlayerDeath: () => this.handlePlayerDeath(),
    });
    this.abilities = new AbilityCaster(this.ctx, {
      targeting: this,
      stopGathering: () => this.gathering.stop(),
      resolveKill: (mob) => this.combat.resolveKill(mob),
      publishAbilityState: () => this.publishAbilityState(),
    });
    this.afk = new AfkCamp(this.ctx, {
      mobs: this.mobs,
      targeting: this,
      stopGathering: () => this.gathering.stop(),
      closeShop: () => this.shop.close(),
      eat: (itemId) => this.gathering.eat(itemId),
    });
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
    listen(EAT_ITEM_REQUESTED_EVENT, (itemId) => this.gathering.eat(itemId));
    listen(COOK_REQUESTED_EVENT, (itemId) => this.gathering.cook(itemId));
    listen(LIGHT_FIRE_REQUESTED_EVENT, () => this.gathering.lightFire());
    listen(BUY_ITEM_REQUESTED_EVENT, (itemId) => this.shop.buy(itemId));
    listen(SELL_ITEM_REQUESTED_EVENT, (itemId) => this.shop.sell(itemId));
    listen(SHOP_CLOSED_EVENT, () => this.shop.closedByUi());
    listen(ABILITY_REQUESTED_EVENT, (abilityId) => this.abilities.cast(abilityId));
    listen(AFK_TOGGLE_REQUESTED_EVENT, () => this.afk.toggle());
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
    this.afk.update();
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
    this.dropDeadTarget();
    this.gathering.update(deltaMs);
    this.combat.update();
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
    this.afk.set(false);

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
      this.afk.set(false);
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
    this.afk.set(false);
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

  /** Whether the character has been left camping. */
  get afkActive(): boolean {
    return this.afk.active;
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
  // Gathering, fire and cooking
  // ---------------------------------------------------------------------------

  /** The fire currently burning in this zone, for whatever is drawing it. */
  get campfire(): Campfire | null {
    return this.gathering.campfire;
  }

  /** The gather channel in flight, or null. */
  get gatherState(): GatherState | null {
    return this.gathering.state;
  }

  startGathering(node: ResourceNode): void {
    this.gathering.start(node);
  }

  stopGathering(): void {
    this.gathering.stop();
  }

  handleLightFireRequested(): void {
    this.gathering.lightFire();
  }

  handleCookRequested(itemId?: ItemId): void {
    this.gathering.cook(itemId);
  }

  handleEatRequested(itemId: ItemId): void {
    this.gathering.eat(itemId);
  }

  // ---------------------------------------------------------------------------
  // Targeting and combat
  // ---------------------------------------------------------------------------

  setTarget(mob: Mob): void {
    this.target = mob;
    this.publishTarget();
  }

  /** Select and close in. Re-selecting what is already selected says nothing. */
  pursueTarget(mob: Mob): void {
    if (this.target !== mob) {
      this.setTarget(mob);
    }
    this.pursuingTarget = true;
  }

  stopPursuit(): void {
    this.pursuingTarget = false;
  }

  publishTarget(): void {
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

  private handlePlayerDeath(): void {
    // Dying is where an unattended session ends: it took the camp with it, and
    // resuming would just feed the same mob until the player came back.
    this.afk.set(false);
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

  /** Everything a corpse is worth. Both kill paths end here. */
  resolveKill(mob: Mob): void {
    this.combat.resolveKill(mob);
  }

  /** Credits kills to the slayer chains and reports what they completed. */
  creditKill(enemyId: EnemyId, count = 1): AchievementUnlock[] {
    return this.combat.creditKill(enemyId, count);
  }

  // ---------------------------------------------------------------------------
  // Rewards
  // ---------------------------------------------------------------------------

  private awardXp(reward: number): void {
    // The one choke point both the swing and the ability paths run through, so
    // it is the one place the AFK penalty has to be applied. A quest reward is
    // not one of them — handing a quest in is something the player did — so it
    // comes in through publishXpGain instead.
    const amount = afkXpReward(reward, this.afk.active);
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

  // ---------------------------------------------------------------------------
  // Abilities
  // ---------------------------------------------------------------------------

  /** When each ability was last cast, for the cooldown check and the bar's sweep. */
  get lastAbilityAt(): Map<AbilityId, number> {
    return this.abilities.lastCastAt;
  }

  handleAbilityRequested(abilityId: AbilityId): void {
    this.abilities.cast(abilityId);
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
