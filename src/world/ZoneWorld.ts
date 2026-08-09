import { EXIT_MARGIN, TILE_SIZE } from '../config/constants';
import { ZONES, type ZoneDefinition, type ZoneExit } from '../data/zones';
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
  PLAYER_EFFECTS_CHANGED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  PLAYER_TILE_CHANGED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  ZONE_ENTERED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  CONTEXT_ACTION_REQUESTED_EVENT,
  type AchievementUnlock,
  type ContextSubject,
} from '../ui/uiEvents';
import { afkXpReward } from '../systems/AfkSystem';
import { logLevelUp, logNotice, logXpGain } from '../systems/CombatLogSystem';
import { conColor } from '../systems/EnemySystem';
import { effectElapsed } from '../systems/EffectSystem';
import { tileOf, toTile } from '../systems/MapSystem';
import { SHOP_INTERACT_RADIUS } from '../data/shop';
import type { GatherState } from '../systems/GatherSystem';
import type { CharacterController, CombatXpGain } from '../systems/CharacterController';
import { withinRadius, type Point } from '../systems/MovementSystem';
import type { InputState } from '../systems/InputState';
import type { CollisionWorld } from '../systems/CollisionSystem';
import {
  SIGNPOST_INTERACT_RADIUS,
  arrivalPoint,
  edgeFraction,
  findExit,
  oppositeEdge,
  resumePoint,
  zoneWorldSize,
} from '../systems/ZoneSystem';
import { saveService } from '../persistence';
import { Player } from './Player';
import { Mob } from './Mob';
import { populateZone, type WorldNpc, type WorldSignpost } from './zoneEntities';
import { ResourceNode } from './ResourceNode';
import { Campfire } from './Campfire';
import { createSubscriptions, type Subscriptions } from './eventBus';
import { AbilityCaster } from './AbilityCaster';
import { ApproachDriver } from './ApproachDriver';
import { CombatDirector } from './CombatDirector';
import { ContextMenuSession } from './ContextMenuSession';
import { GatherSession } from './GatherSession';
import { AfkCamp, type ParkedAfkResult } from './AfkCamp';
import { QuestDesk } from './QuestDesk';
import { ShopSession } from './ShopSession';
import { WorldContext } from './WorldContext';
import { publishOnChange } from './publishOnChange';
import type { Targeting } from './targeting';
import type { EventBus, WorldEvent } from './worldEvents';
import type { AbilityId, EnemyId, GearSlotId, ItemId, ZoneEdge } from '../types/ids';

// Far enough inside the new zone that the player doesn't stand on the return
// exit and bounce straight back.
const ARRIVAL_INSET = TILE_SIZE * 1.5;
// A walk up to a node has to finish a little inside the radius that lets a tap
// gather from where the player already stands: the gather channel cancels the
// moment the player is further out than that radius, so ending the approach
// exactly on it makes the first tick a coin toss.
const GATHER_APPROACH_FRACTION = 0.9;

// Re-exported so a view can ask what it is looking at without knowing which
// module built it.
export type { WorldNpc, WorldSignpost };

// The offline payout's shape, re-exported for the host that has somewhere to
// put it.
export type { ParkedAfkResult };

/** What the player just tapped, once the view has worked out what it was. */
export type WorldTap =
  | { kind: 'node'; node: ResourceNode }
  | { kind: 'signpost'; signpost: WorldSignpost }
  | { kind: 'npc'; npc: WorldNpc }
  | { kind: 'mob'; mob: Mob }
  | { kind: 'ground'; point: Point };

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

/**
 * One zone, simulated: the player, the mobs, the nodes, and the tick that moves
 * them all. Nothing here draws, and nothing here knows what is drawing — the
 * frame's `WorldEvent[]` is everything a view has to be told.
 *
 * The rules themselves live in the collaborators it composes — the fight, the
 * gather channel, the shop counter, the action bar, the camp, the quest desk
 * and the two click-to-move walks — each of which owns its own state and
 * reaches the rest of the zone through the `WorldContext` they share and a
 * handful of named hooks. What is left here is what none of them can own: the
 * entities, the order the tick runs in, the publishers that speak only on
 * change, what is selected, and the three things that stop everything at once —
 * a zone change, a death, a teardown.
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
  private readonly approach: ApproachDriver;
  private readonly quests: QuestDesk;
  private readonly contextMenu: ContextMenuSession;
  private readonly input: InputState;
  private readonly subscriptions: Subscriptions;
  // The seven HUD publishers that only speak when what they publish moves; the
  // constructor says what each one counts as a change.
  private readonly publishPlayerHp: () => void;
  private readonly publishPlayerMana: () => void;
  private readonly publishPlayerEffects: () => void;
  private readonly publishAbilityState: () => void;
  private readonly publishActions: () => void;
  private readonly publishZone: () => void;
  private readonly publishPlayerTile: () => void;

  constructor(options: ZoneWorldOptions) {
    const { zone, character, events, input, entry, hp, rng } = options;
    this.zone = zone;
    this.character = character;
    this.input = input;
    this.subscriptions = createSubscriptions(events);

    const size = zoneWorldSize(zone);
    this.worldWidth = size.width;
    this.worldHeight = size.height;
    const entities = populateZone(zone, size, rng ?? Math.random);
    this.spawnPoint = entities.spawnPoint;
    this.mobs = entities.mobs;
    this.nodes = entities.nodes;
    this.npcs = entities.npcs;
    this.signposts = entities.signposts;
    this.collisionWorld = entities.collisionWorld;

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
    // Compared on how far through each buff is rather than on its raw clock, so
    // an icon redraws about as often as its sweep visibly moves. It carries no
    // seed on purpose: a world that opens with nothing up still has to say so,
    // since the HUD outlives the world and may be holding the last one's buffs.
    this.publishPlayerEffects = publishOnChange(
      () => this.player.activeEffects(),
      (effects) =>
        effects.map((effect) => `${effect.effectId}:${effectElapsed(effect).toFixed(2)}`).join('|'),
      (effects) => this.ctx.events.emit(PLAYER_EFFECTS_CHANGED_EVENT, effects),
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
    // The map's two. Neither carries a seed, and both are read from the tick
    // rather than sent from here: the host mounts the HUD after building the
    // world, so anything emitted in this constructor on first boot arrives
    // before there is a listener. An unseeded publisher speaks on the first
    // frame instead, which every new world gets a fresh set of.
    this.publishZone = publishOnChange(
      () => this.zone.id,
      String,
      (zoneId) => this.ctx.events.emit(ZONE_ENTERED_EVENT, zoneId),
    );
    // Keyed to whole tiles so this speaks on a crossing rather than every
    // frame, but carrying the fractional position, so the dot sits where the
    // player is rather than snapping to the corner of a tile.
    this.publishPlayerTile = publishOnChange(
      () => toTile(this.player.x, this.player.y),
      () => {
        const tile = tileOf(this.player.x, this.player.y);
        return `${tile.x},${tile.y}`;
      },
      (tile) => this.ctx.events.emit(PLAYER_TILE_CHANGED_EVENT, tile),
    );

    this.approach = new ApproachDriver(this.ctx, {
      targeting: this,
      // A hand on the keyboard is a hand on the controls, camp included.
      onKeyboardMove: () => this.afk.set(false),
    });
    this.gathering = new GatherSession(this.ctx, { isCamping: () => this.afk.active });
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
      nodes: this.nodes,
      targeting: this,
      stopGathering: () => this.gathering.stop(),
      closeShop: () => this.shop.close(),
      eat: (itemId) => this.gathering.eat(itemId),
      gatherAt: (node) => this.approachAndGather(node),
      isGathering: () => this.gathering.state !== null,
      awardXp: (reward) => this.awardXp(reward),
      creditKill: (enemyId, count) => this.combat.creditKill(enemyId, count),
    });
    this.quests = new QuestDesk(this.ctx, {
      isShopOpen: () => this.shop.isOpen(),
      publishXpGain: (gain) => this.publishXpGain(gain),
    });
    this.contextMenu = new ContextMenuSession(this.ctx, {
      perform: (subject) => this.tap(subject),
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
    listen(EQUIP_ITEM_REQUESTED_EVENT, (itemId) => this.handleEquipRequested(itemId));
    listen(UNEQUIP_SLOT_REQUESTED_EVENT, (slot) => this.handleUnequipRequested(slot));
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
    listen(CONTEXT_ACTION_REQUESTED_EVENT, (actionId) => this.contextMenu.run(actionId));
  }

  /** Drops every subscription. The host calls this before building the next world. */
  destroy(): void {
    this.subscriptions.clear();
  }

  /** Pays out a camp left running when the tab closed. See `AfkCamp`. */
  resolveParkedAfk(): ParkedAfkResult | null {
    return this.afk.resolveParked();
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
    this.approach.update(deltaMs);
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
    this.publishPlayerEffects();
    this.publishAbilityState();
    this.publishActions();
    this.publishZone();
    this.publishPlayerTile();
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
    this.approach.cancel();
  }

  /** What the view calls when the player touches the world. */
  tap(target: WorldTap): void {
    // Touching the world is taking the controls back.
    this.afk.set(false);

    if (target.kind === 'mob') {
      this.stopGathering();
      this.approach.cancel();
      this.setTarget(target.mob);
      // Auto-approach: walking into range is implied by choosing a target.
      this.approach.pursue();
      return;
    }

    // Every other tap gives up whatever was selected — and, unless it is a tap
    // on the node currently being worked, gives up the gather too: walking off
    // is a choice to stop chopping.
    if (target.kind !== 'node') {
      this.stopGathering();
      this.approach.cancel();
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

  /**
   * What the view calls when the player asks *about* something rather than
   * asking for it — a right click, or a press held on a phone.
   *
   * It answers with the menu and remembers what the menu is about, so a line
   * chosen later comes back as nothing but an action id. `null` is the ground,
   * which has nothing to say for itself. Unlike `tap` this changes nothing:
   * asking what a rat drops must not drop the gather in progress, nor end the
   * camp, nor even select the rat.
   */
  inspect(target: WorldTap): ContextSubject | null {
    return this.contextMenu.open(target);
  }

  // Walk toward a tapped node and start the gather once inside its interact
  // radius; startGathering fires immediately when already there.
  approachAndGather(node: ResourceNode): void {
    if (withinRadius(this.player, node, node.definition.interactRadius)) {
      this.startGathering(node);
      return;
    }
    this.approach.walkTo(
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
    this.approach.walkTo({ kind: 'signpost', radius: SIGNPOST_INTERACT_RADIUS }, signpost, () =>
      this.leaveZone(signpost.exit),
    );
  }

  approachShop(npc: WorldNpc): void {
    if (withinRadius(this.player, npc, SHOP_INTERACT_RADIUS)) {
      this.shop.open(npc);
      return;
    }
    this.approach.walkTo({ kind: 'shop', radius: SHOP_INTERACT_RADIUS }, npc, () =>
      this.shop.open(npc),
    );
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
    this.contextMenu.clear();
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
    this.approach.pursue();
  }

  stopPursuit(): void {
    this.approach.stopPursuit();
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
    this.approach.stopPursuit();
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
    this.contextMenu.clear();
    this.approach.cancel();
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
