import { EXIT_MARGIN, TILE_SIZE } from '../config/constants';
import { ZONES, type ZoneDefinition, type ZoneExit } from '../data/zones';
import {
  ABANDON_BOUNTY_REQUESTED_EVENT,
  ABILITY_REQUESTED_EVENT,
  ACCEPT_BOUNTY_REQUESTED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  ACTIONS_CHANGED_EVENT,
  AFK_SET_REQUESTED_EVENT,
  IDLE_FOOD_KEEP_REQUESTED_EVENT,
  IDLE_FOOD_MOVE_REQUESTED_EVENT,
  ASK_TOPIC_REQUESTED_EVENT,
  COUNTER_CLOSED_EVENT,
  COUNTER_REQUESTED_EVENT,
  REFORGE_REQUESTED_EVENT,
  TRADE_REQUESTED_EVENT,
  BUY_BANK_SLOT_REQUESTED_EVENT,
  TURN_IN_BOUNTY_REQUESTED_EVENT,
  STATION_OPENED_EVENT,
  LEARN_ABILITY_REQUESTED_EVENT,
  CRAFT_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  COOK_REQUESTED_EVENT,
  DEPOSIT_ITEM_REQUESTED_EVENT,
  WITHDRAW_ITEM_REQUESTED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  DRINK_POTION_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GEAR_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_EFFECTS_CHANGED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  PLAYER_TILE_CHANGED_EVENT,
  CREATURES_CHANGED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  UNLOCKED_ZONES_CHANGED_EVENT,
  SECRETS_CHANGED_EVENT,
  VISITS_CHANGED_EVENT,
  XP_GAINED_EVENT,
  ZONE_ENTERED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  CONTEXT_ACTION_REQUESTED_EVENT,
  TIP_HEARD_EVENT,
  TIPS_SET_REQUESTED_EVENT,
  SPIRIT_BEAT_HEARD_EVENT,
  HOUSE_CLOSED_EVENT,
  DISPLAY_TROPHY_REQUESTED_EVENT,
  CHEST_DEPOSIT_REQUESTED_EVENT,
  CHEST_WITHDRAW_REQUESTED_EVENT,
  type AchievementUnlock,
  type ContextSubject,
} from '../ui/uiEvents';
import { describeItemName } from '../data/items';
import { afkXpReward } from '../systems/AfkSystem';
import { idleXpMultiplier, isPotionActive } from '../systems/PotionSystem';
import { logDeathToll, logLevelUp, logNotice, logXpGain } from '../systems/CombatLogSystem';
import { deathToll } from '../systems/DeathSystem';
import { conColor } from '../systems/EnemySystem';
import { effectElapsed } from '../systems/EffectSystem';
import { zoneAccess } from '../systems/ZoneAccessSystem';
import { MINIMAP_REACH, tileOf, toTile } from '../systems/MapSystem';
import { ENEMY_ABILITIES } from '../data/enemyAbilities';
import { NPC_INTERACT_RADIUS, worksCounter, type CounterId } from '../data/npcs';
import { STATION_RADIUS } from '../data/recipes';
import { FIXTURE_REACH } from '../data/house';
import type { InteractionKind } from '../systems/InteractionSystem';
import type { GatherState } from '../systems/GatherSystem';
import type { CraftState } from '../systems/CraftingSystem';
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
  sideOn,
  zoneWorldSize,
} from '../systems/ZoneSystem';
import { saveService } from '../persistence';
import { Player } from './Player';
import { Mob } from './Mob';
import {
  populateZone,
  type WorldBuilding,
  type WorldFixture,
  type WorldNpc,
  type WorldSignpost,
  type WorldSecret,
  type WorldStation,
} from './zoneEntities';
import { ResourceNode } from './ResourceNode';
import { Campfire } from './Campfire';
import { LOOT_PILE_REACH, type LootPile } from './LootPile';
import { LootPiles } from './LootPiles';
import { createSubscriptions, type Subscriptions } from './eventBus';
import { AbilityCaster } from './AbilityCaster';
import { ApproachDriver } from './ApproachDriver';
import { BankSession } from './BankSession';
import { TrainerSession } from './TrainerSession';
import { BountySession } from './BountySession';
import { OutfitterSession } from './OutfitterSession';
import { ReforgeSession } from './ReforgeSession';
import type { CounterSession } from './CounterSession';
import { CombatDirector } from './CombatDirector';
import { ContextMenuSession } from './ContextMenuSession';
import { GatherSession } from './GatherSession';
import { AfkCamp, type ParkedAfkResult } from './AfkCamp';
import { QuestDesk } from './QuestDesk';
import { ShopSession } from './ShopSession';
import { TalkSession } from './TalkSession';
import { TipDesk } from './TipDesk';
import { SecretFinder } from './SecretFinder';
import { Spirit } from './Spirit';
import { HouseSession } from './HouseSession';
import { WorldContext } from './WorldContext';
import { publishOnChange } from './publishOnChange';
import type { Targeting } from './targeting';
import type { EventBus, WorldEvent } from './worldEvents';
import type {
  AbilityId,
  BountyId,
  EnemyId,
  GearSlotId,
  ItemId,
  RecipeId,
  ZoneEdge,
  ZoneId,
} from '../types/ids';

// Far enough inside the new zone that the player doesn't stand on the return
// exit and bounce straight back.
const ARRIVAL_INSET = TILE_SIZE * 1.5;
// A walk up to a node has to finish a little inside the radius that lets a tap
// gather from where the player already stands: the gather channel cancels the
// moment the player is further out than that radius, so ending the approach
// exactly on it makes the first tick a coin toss.
const GATHER_APPROACH_FRACTION = 0.9;
// How near where a body stands to use a fixture the walk there has to end:
// half a tile, which leaves every fixture in `FIXTURE_REACH` from it.
const FIXTURE_ACCESS_RADIUS = TILE_SIZE / 2;

// Re-exported so a view can ask what it is looking at without knowing which
// module built it.
export type { WorldBuilding, WorldFixture, WorldNpc, WorldSignpost, WorldStation };

// The offline payout's shape, re-exported for the host that has somewhere to
// put it.
export type { ParkedAfkResult };

/** What the player just tapped, once the view has worked out what it was. */
export type WorldTap =
  | { kind: 'node'; node: ResourceNode }
  | { kind: 'signpost'; signpost: WorldSignpost }
  /**
   * A person. Talking to them is what a tap asks for; a held finger's menu may
   * name one of their counters instead, which is the same walk ending at a
   * different panel.
   */
  | { kind: 'npc'; npc: WorldNpc; counter?: CounterId }
  | { kind: 'station'; station: WorldStation }
  | { kind: 'mob'; mob: Mob }
  | { kind: 'pile'; pile: LootPile }
  /** Wick, the light at the player's shoulder: a tap asks it what it has to say. */
  | { kind: 'spirit' }
  /** A stand, the chest or the wall in the house (F1). */
  | { kind: 'fixture'; fixture: WorldFixture }
  | { kind: 'ground'; point: Point };

/**
 * What the walk toward each counter is called.
 *
 * Keyed by `CounterId` so a new counter is a compile error here until someone
 * says what walking up to it is — the same argument `TOWNSFOLK` in `art/cast.ts`
 * makes for what a person looks like, and `Counters` below makes for what
 * standing at them does.
 */
const COUNTER_WALKS = {
  talk: 'talk',
  merchant: 'shop',
  banker: 'bank',
  trainer: 'train',
  quartermaster: 'bounty',
  outfitter: 'outfit',
  reforger: 'reforge',
} as const satisfies Record<CounterId, InteractionKind>;

/**
 * The session behind each counter. Typed per counter rather than as a bare
 * `Record<CounterId, CounterSession>`, so the listener for a sale can reach the
 * shop's `sell` without a cast — and it still has to name every one.
 */
interface Counters extends Record<CounterId, CounterSession> {
  talk: TalkSession;
  merchant: ShopSession;
  banker: BankSession;
  trainer: TrainerSession;
  quartermaster: BountySession;
  outfitter: OutfitterSession;
  reforger: ReforgeSession;
}

export interface ZoneWorldOptions {
  zone: ZoneDefinition;
  character: CharacterController;
  events: EventBus;
  input: InputState;
  /** Which edge the player walked in through, when they did. */
  entry?: { edge: ZoneEdge; fraction: number };
  /** HP carried across a zone walk; absent on a session's first world. */
  hp?: number;
  /** Where the mobs wander and where the zone's spawns fall. */
  rng?: () => number;
  /** Every roll in the fight, the gather and the counters; see `WorldContext.rolls`. */
  rolls?: () => number;
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
  readonly stations: WorldStation[];
  readonly buildings: WorldBuilding[];
  readonly secrets: WorldSecret[];
  readonly fixtures: WorldFixture[];
  readonly signposts: WorldSignpost[];
  readonly collisionWorld: CollisionWorld;
  target: Mob | null = null;
  /** Set once the player has walked out; the world stops stepping after it. */
  changingZone = false;
  /** The clock, the channels and the character — everything shared. */
  private readonly ctx: WorldContext;
  private readonly gathering: GatherSession;
  private readonly counters: Counters;
  private readonly afk: AfkCamp;
  private readonly abilities: AbilityCaster;
  private readonly combat: CombatDirector;
  private readonly approach: ApproachDriver;
  private readonly quests: QuestDesk;
  private readonly contextMenu: ContextMenuSession;
  private readonly tips: TipDesk;
  private readonly secretFinder: SecretFinder;
  /** Wick, following the player: drawn from here, and tapped through `tap`. */
  readonly spirit: Spirit;
  private readonly house: HouseSession;
  private readonly loot: LootPiles;
  private readonly input: InputState;
  private readonly subscriptions: Subscriptions;
  // The ten HUD publishers that only speak when what they publish moves; the
  // constructor says what each one counts as a change.
  private readonly publishPlayerHp: () => void;
  private readonly publishPlayerMana: () => void;
  private readonly publishPlayerEffects: () => void;
  private readonly publishAbilityState: () => void;
  private readonly publishActions: () => void;
  private readonly publishZone: () => void;
  private readonly publishVisits: () => void;
  private readonly publishUnlockedZones: () => void;
  private readonly publishSecrets: () => void;
  private readonly publishPlayerTile: () => void;
  private readonly publishCreatures: () => void;
  /**
   * The locked edge the player is currently standing against, if any.
   *
   * Leaning on a shut door is one refusal rather than one a frame: `findExit`
   * keeps answering for as long as they are inside the exit margin, and without
   * this the toast would re-fire sixty times a second.
   */
  private blockedAtEdge: ZoneId | null = null;

  constructor(options: ZoneWorldOptions) {
    const { zone, character, events, input, entry, hp, rng, rolls } = options;
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
    this.stations = entities.stations;
    this.buildings = entities.buildings;
    this.secrets = entities.secrets;
    this.fixtures = entities.fixtures;
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
      character.state.reforges,
      character.loadedArrow(),
    );
    if (hp !== undefined) {
      this.player.setHp(hp);
    }
    this.ctx = new WorldContext(character, events, this.player, zone.id, rolls);
    // A world built for a zone *is* an arrival in it, which is what makes this
    // the one place a visit is credited: the walk and the session resumed both
    // end here, and a third route in would too. It is deliberately
    // not `recordLocation`, which is called on every save and says where the
    // character is rather than that they have just got there.
    character.recordVisit(zone.id);

    // What each publisher counts as a change. HP and mana are their own
    // signature; the action bar compares only what it draws, and the item
    // buttons only whether a fire or a station is in reach. The two seeds are
    // what the world opens already having said: the constructor sends HP
    // unconditionally below, and a class with nothing learned has no bar for a
    // list of no abilities to redraw.
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
    // Unseeded, like the map's two below: the HUD outlives the world, and a
    // player who walks out of a zone beside a fire would arrive with a Cook
    // button still lit unless the new world says otherwise.
    this.publishActions = publishOnChange(
      () => ({
        nearFire: this.gathering.isNearFire(),
        nearStations: this.gathering.stationsInReach(),
      }),
      (actions) => `${actions.nearFire}/${actions.nearStations.join(',')}`,
      (actions) => this.ctx.events.emit(ACTIONS_CHANGED_EVENT, actions),
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
    // The arrival this world was built by, told to the HUD on the same first
    // frame and for the same reason: a visit objective's progress lives in this
    // tally, and the counter that moved it did so before the HUD existed.
    this.publishVisits = publishOnChange(
      () => ({ ...this.character.state.visits }),
      (visits) =>
        Object.entries(visits)
          .map(([zoneId, count]) => `${zoneId}:${count}`)
          .join('|'),
      (visits) => this.ctx.events.emit(VISITS_CHANGED_EVENT, visits),
    );
    // Unseeded for the same reason, and it needs no more than that: a key is
    // spent on the way through a door, so the world that opens one is a world
    // about to be torn down and the next one says so on its first frame.
    this.publishUnlockedZones = publishOnChange(
      () => [...this.character.state.unlockedZones],
      (zoneIds) => zoneIds.join('|'),
      (zoneIds) => this.ctx.events.emit(UNLOCKED_ZONES_CHANGED_EVENT, zoneIds),
    );
    // Every secret found, for the zone map's count; unseeded for the same
    // reason, since the HUD may be holding the last character's.
    this.publishSecrets = publishOnChange(
      () => [...this.character.state.secrets],
      (found) => found.join('|'),
      (found) => this.ctx.events.emit(SECRETS_CHANGED_EVENT, found),
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
    // The minimap's creatures, on the player's terms: only those it can show,
    // and only when one of them crosses a tile, so a rat wandering the far end of
    // a rebuilt zone says nothing to anybody. Keyed by place in the list as well
    // as by tile, since two rats swapping tiles is still two rats moving.
    this.publishCreatures = publishOnChange(
      () => this.creaturesInReach(),
      (near) =>
        near
          .map(({ index, mob }) => {
            const tile = tileOf(mob.x, mob.y);
            return `${index}:${tile.x},${tile.y}`;
          })
          .join('|'),
      (near) =>
        this.ctx.events.emit(
          CREATURES_CHANGED_EVENT,
          near.map(({ mob }) => ({
            ...toTile(mob.x, mob.y),
            level: mob.level,
            boss: mob.definition.boss === true,
          })),
        ),
    );

    this.approach = new ApproachDriver(this.ctx, {
      targeting: this,
      collisionWorld: this.collisionWorld,
      // A hand on the keyboard is a hand on the controls, camp included.
      onKeyboardMove: () => this.afk.set(false),
    });
    this.gathering = new GatherSession(this.ctx, {
      stations: this.stations,
      isCamping: () => this.afk.active,
    });
    this.loot = new LootPiles(this.ctx);
    this.counters = {
      talk: new TalkSession(this.ctx),
      merchant: new ShopSession(this.ctx),
      banker: new BankSession(this.ctx),
      trainer: new TrainerSession(this.ctx, {
        publishAbilityState: () => this.publishAbilityState(),
      }),
      quartermaster: new BountySession(this.ctx, {
        publishXpGain: (gain) => this.publishXpGain(gain),
      }),
      outfitter: new OutfitterSession(this.ctx),
      reforger: new ReforgeSession(this.ctx),
    };
    this.combat = new CombatDirector(this.ctx, {
      mobs: this.mobs,
      targeting: this,
      collisionWorld: this.collisionWorld,
      awardXp: (reward) => this.awardXp(reward),
      interruptGather: () => this.gathering.interrupt(),
      interruptCast: () => this.abilities.interrupt(),
      onPlayerDeath: () => this.handlePlayerDeath(),
      isCamping: () => this.afk.active,
      leavePile: (at, drops) => this.loot.leave(at, drops),
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
      closeCounters: () => this.closeCounters(),
      eat: (itemId) => this.gathering.eat(itemId),
      gatherAt: (node) => this.approachAndGather(node),
      stationsInReach: () => this.gathering.stationsInReach(),
      craft: (recipe) => this.gathering.craft(recipe),
      isChanneling: () => this.gathering.isChanneling(),
      awardIdleXp: (amount) => this.awardIdleXp(amount),
      creditKill: (enemyId, count) => this.combat.creditKill(enemyId, count),
      noteDropsSeen: (enemyId, itemIds) => this.combat.noteDropsSeen(enemyId, itemIds),
    });
    this.quests = new QuestDesk(this.ctx, {
      servingNpc: () => this.openCounter()?.npc ?? null,
      publishXpGain: (gain) => this.publishXpGain(gain),
    });
    this.contextMenu = new ContextMenuSession(this.ctx, {
      perform: (subject) => this.tap(subject),
    });
    this.tips = new TipDesk(this.ctx, { isIdle: () => this.afk.active });
    this.spirit = new Spirit(this.ctx, {
      tipWaiting: () => this.tips.waiting !== null,
      sayTip: () => this.tips.say(),
    });
    this.secretFinder = new SecretFinder(this.ctx, {
      secrets: this.secrets,
      leavePile: (at, drops) => this.loot.leave(at, drops),
      voice: () => this.spirit.voice(),
    });
    this.house = new HouseSession(this.ctx, {
      closeCounters: () => this.closeCounters(),
    });

    this.subscribe();
    // The HUD may be carrying HP from before the world was rebuilt by a zone
    // walk — resync it unconditionally.
    this.ctx.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
  }

  // Where the player stands when this world opens: the arrival point if they
  // walked in through an exit, the spot the save was left at if they are
  // resuming into the zone that save names, and the zone's start otherwise —
  // a new character, or a save that names no particular spot.
  private startPoint(entry: ZoneWorldOptions['entry']): Point {
    if (entry) {
      return arrivalPoint(
        sideOn(this.zone, entry.edge),
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
    return { ...this.spawnPoint };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  private subscribe(): void {
    const { listen } = this.subscriptions;
    listen(EQUIP_ITEM_REQUESTED_EVENT, (itemId) => this.handleEquipRequested(itemId));
    listen(UNEQUIP_SLOT_REQUESTED_EVENT, (slot) => this.handleUnequipRequested(slot));
    listen(EAT_ITEM_REQUESTED_EVENT, (itemId) => this.gathering.eat(itemId));
    listen(DRINK_POTION_REQUESTED_EVENT, (itemId) => this.drinkPotion(itemId));
    listen(COOK_REQUESTED_EVENT, (itemId) => this.gathering.cook(itemId));
    listen(LIGHT_FIRE_REQUESTED_EVENT, () => this.gathering.lightFire());
    const { counters } = this;
    // A panel's close button, which the world hears as the counter already shut.
    listen(COUNTER_CLOSED_EVENT, (counter) => counters[counter].closedByUi());
    listen(COUNTER_REQUESTED_EVENT, (counter) => this.switchCounter(counter));
    listen(BUY_ITEM_REQUESTED_EVENT, (itemId) => counters.merchant.buy(itemId));
    listen(SELL_ITEM_REQUESTED_EVENT, (itemId, quantity) =>
      counters.merchant.sell(itemId, quantity),
    );
    listen(DEPOSIT_ITEM_REQUESTED_EVENT, (itemId, quantity) =>
      counters.banker.deposit(itemId, quantity),
    );
    listen(WITHDRAW_ITEM_REQUESTED_EVENT, (itemId, quantity) =>
      counters.banker.withdraw(itemId, quantity),
    );
    listen(BUY_BANK_SLOT_REQUESTED_EVENT, () => counters.banker.buySlot());
    listen(LEARN_ABILITY_REQUESTED_EVENT, (abilityId) => counters.trainer.learn(abilityId));
    listen(ACCEPT_BOUNTY_REQUESTED_EVENT, (bountyId) => counters.quartermaster.accept(bountyId));
    listen(TURN_IN_BOUNTY_REQUESTED_EVENT, (bountyId) => counters.quartermaster.turnIn(bountyId));
    listen(ABANDON_BOUNTY_REQUESTED_EVENT, () => counters.quartermaster.abandon());
    listen(TRADE_REQUESTED_EVENT, (itemId) => counters.outfitter.trade(itemId));
    listen(REFORGE_REQUESTED_EVENT, (itemId) => counters.reforger.reforge(itemId));
    listen(CRAFT_REQUESTED_EVENT, (recipeId) => this.gathering.makeRecipe(recipeId));
    listen(ABILITY_REQUESTED_EVENT, (abilityId) => this.abilities.cast(abilityId));
    listen(AFK_SET_REQUESTED_EVENT, (active) => this.afk.set(active));
    listen(IDLE_FOOD_MOVE_REQUESTED_EVENT, (itemId, move) => this.afk.moveFood(itemId, move));
    listen(IDLE_FOOD_KEEP_REQUESTED_EVENT, (itemId, keep) => this.afk.keepFood(itemId, keep));
    listen(ACCEPT_QUEST_REQUESTED_EVENT, (questId) => this.quests.accept(questId));
    listen(TURN_IN_QUEST_REQUESTED_EVENT, (questId) => this.quests.turnIn(questId));
    listen(SET_TITLE_REQUESTED_EVENT, (titleId) => this.quests.wearTitle(titleId));
    listen(CONTEXT_ACTION_REQUESTED_EVENT, (actionId) => this.contextMenu.run(actionId));
    listen(TIP_HEARD_EVENT, (tipId) => this.tips.heard(tipId));
    listen(TIPS_SET_REQUESTED_EVENT, (on) => this.tips.set(on));
    listen(ASK_TOPIC_REQUESTED_EVENT, (topicId) => counters.talk.ask(topicId));
    listen(SPIRIT_BEAT_HEARD_EVENT, (beatId) => this.spirit.heard(beatId));
    listen(HOUSE_CLOSED_EVENT, () => this.house.closedByUi());
    listen(DISPLAY_TROPHY_REQUESTED_EVENT, (itemId) => this.house.display(itemId));
    listen(CHEST_DEPOSIT_REQUESTED_EVENT, (itemId, quantity) =>
      this.house.deposit(itemId, quantity),
    );
    listen(CHEST_WITHDRAW_REQUESTED_EVENT, (itemId, quantity) =>
      this.house.withdraw(itemId, quantity),
    );
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
    this.afk.update(deltaMs);
    this.approach.update(deltaMs);
    this.tickPotions(deltaMs);
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
    this.loot.update(deltaMs);
    this.dropDeadTarget();
    this.gathering.update(deltaMs);
    this.abilities.update(deltaMs);
    this.combat.update();
    this.publishPlayerHp();
    this.publishPlayerMana();
    this.publishPlayerEffects();
    this.publishAbilityState();
    this.publishActions();
    this.publishZone();
    this.publishVisits();
    this.publishUnlockedZones();
    this.publishPlayerTile();
    this.publishCreatures();
    this.secretFinder.update();
    this.publishSecrets();
    this.tips.update();
    this.spirit.update(deltaMs);
    this.updateNpcRange();
    this.house.updateRange();
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
    // Asking Wick something is not taking the controls back: the camp, the
    // walk, the gather and the target are all as they were, and an open
    // counter stays open while the card waits for it to close.
    if (target.kind === 'spirit') {
      this.spirit.tap();
      return;
    }
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
        this.approachNpc(target.npc, target.counter);
        return;
      case 'station':
        this.approachStation(target.station);
        return;
      case 'pile':
        this.approachPile(target.pile);
        return;
      case 'fixture':
        this.approachFixture(target.fixture);
        return;
      case 'ground':
        this.approach.walk(target.point);
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
    // Asked on arrival rather than on the tap: the key could be picked up on
    // the way, and a door refusing before the walk even starts would be
    // answering a question about a moment that has not happened yet.
    const enter = (): void => {
      if (this.openWayInto(signpost.exit.to)) {
        this.leaveZone(signpost.exit);
      }
    };
    if (withinRadius(this.player, signpost, SIGNPOST_INTERACT_RADIUS)) {
      enter();
      return;
    }
    this.approach.walkTo({ kind: 'signpost', radius: SIGNPOST_INTERACT_RADIUS }, signpost, enter);
  }

  /**
   * Walk up to whoever was tapped and talk to them — or, when a held finger's
   * menu named one, open that counter of theirs instead.
   *
   * Which counter a person has is a fact about them and not about the tap,
   * which is exactly what this used to assume: every NPC in the game opened the
   * shop, and the second one to exist would have sold tools from behind the
   * bank's desk. Everybody talks and the role decides the rest, so a counter
   * nobody behind this one works is refused rather than opened.
   */
  approachNpc(npc: WorldNpc, counter: CounterId = 'talk'): void {
    if (!worksCounter(npc.npcId, counter)) return;
    // Both keyed by the same counter: which one to open and what the walk
    // toward it is called are the same fact, and the two drifting apart is
    // exactly how a walk ends at the wrong desk.
    const serve = (): void => this.serveAt(npc, counter);
    if (withinRadius(this.player, npc, NPC_INTERACT_RADIUS)) {
      serve();
      return;
    }
    this.approach.walkTo({ kind: COUNTER_WALKS[counter], radius: NPC_INTERACT_RADIUS }, npc, serve);
  }

  /**
   * A button across from somebody asking for another of their counters: Shop
   * from the conversation, or Back to it from the shop.
   *
   * Asked of whoever is being served rather than walked to, since the player is
   * already standing there — the one open counter's range is what keeps it
   * honest. With nobody served, or a counter this person does not work, it
   * answers nothing.
   */
  private switchCounter(counter: CounterId): void {
    const npc = this.openCounter()?.npc;
    if (!npc || !worksCounter(npc.npcId, counter)) return;
    this.serveAt(npc, counter);
  }

  // One counter at a time, which is what lets the HUD hold one counter panel
  // and the quest desk ask "who am I talking to" and get one answer.
  private serveAt(npc: WorldNpc, counter: CounterId): void {
    this.closeCounters();
    this.counters[counter].open(npc);
  }

  /**
   * Walk up to a station and open what is made there.
   *
   * A counter's shape with nobody behind it: the walk is the same, and what
   * makes the panel legal afterwards is the same distance the channel is
   * checked against. It is *opened by tapping* rather than by proximity, which
   * is the whole difference — a panel that appeared whenever the player came
   * within reach would put itself in the face of anyone walking past on their
   * way somewhere, and on a map this size that is most of the reasons to be
   * near one.
   */
  approachStation(station: WorldStation): void {
    const open = (): void => {
      this.ctx.events.emit(STATION_OPENED_EVENT, station.station);
    };
    if (withinRadius(this.player, station, STATION_RADIUS)) {
      open();
      return;
    }
    this.approach.walkTo({ kind: 'station', radius: STATION_RADIUS }, station, open);
  }

  /**
   * Walk onto a pile and take what fits. Not solid, so the walk ends on top of
   * it; the reach only has to cover a body stopped short of where something
   * narrower fell.
   */
  approachPile(pile: LootPile): void {
    const take = (): void => this.loot.take(pile);
    if (withinRadius(this.player, pile, LOOT_PILE_REACH)) {
      take();
      return;
    }
    this.approach.walkTo({ kind: 'loot', radius: LOOT_PILE_REACH }, pile, take);
  }

  /**
   * Walk up to a stand, the chest or the wall in the house and use it (F1):
   * the station's shape, ending in `HouseSession` rather than a panel of its
   * own, since what a stand does depends on whether something is on it.
   */
  approachFixture(fixture: WorldFixture): void {
    const use = (): void => this.house.use(fixture);
    if (withinRadius(this.player, fixture, FIXTURE_REACH)) {
      use();
      return;
    }
    // Aimed at where a body stands to use it rather than at the fixture, which
    // stands against a wall the walk would otherwise go round the outside of.
    this.approach.walkTo({ kind: 'house', radius: FIXTURE_ACCESS_RADIUS }, fixture.access, use);
  }

  /**
   * The living creatures within the minimap's reach of the player's tile, each
   * with its place in `mobs`. Measured in whole tiles, square rather than round,
   * because the minimap is a square.
   */
  private creaturesInReach(): { index: number; mob: Mob }[] {
    const here = tileOf(this.player.x, this.player.y);
    const near: { index: number; mob: Mob }[] = [];
    this.mobs.forEach((mob, index) => {
      if (!mob.isAlive()) return;
      const tile = tileOf(mob.x, mob.y);
      if (Math.max(Math.abs(tile.x - here.x), Math.abs(tile.y - here.y)) > MINIMAP_REACH) return;
      near.push({ index, mob });
    });
    return near;
  }

  // ---------------------------------------------------------------------------
  // Zones
  // ---------------------------------------------------------------------------

  /**
   * Whether the way into a zone is open, spending the key if this is the moment
   * it opens.
   *
   * Both routes into a zone ask this — the edge walk and the signpost — so a
   * door cannot be locked against one of them and open to the other. It is the
   * only place a key is ever spent, which is what makes "consumed once, open
   * for good" one rule rather than two.
   */
  private openWayInto(zoneId: ZoneId): boolean {
    const access = zoneAccess(zoneId, {
      inventory: this.character.state.inventory,
      unlockedZones: this.character.state.unlockedZones,
    });
    if (access.kind === 'open') return true;
    if (access.kind === 'locked') {
      this.ctx.notice(access.reason);
      return false;
    }

    if (!this.character.unlockZone(zoneId, access.keyItemId)) {
      return false;
    }
    // Both channels: a door opening for good is worth a toast as it happens and
    // a line in the log to find again afterwards.
    this.ctx.notice(access.reason);
    this.ctx.log(logNotice(access.reason));
    this.ctx.publishInventory();
    return true;
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
    if (!exit) {
      this.blockedAtEdge = null;
      return;
    }
    if (this.blockedAtEdge === exit.to) return;
    if (this.openWayInto(exit.to)) {
      this.leaveZone(exit);
      return;
    }
    this.blockedAtEdge = exit.to;
  }

  private leaveZone(exit: ZoneExit): void {
    this.changingZone = true;
    const entryEdge = oppositeEdge(exit.edge);
    const fraction = edgeFraction(
      exit,
      this.player.x,
      this.player.y,
      this.worldWidth,
      this.worldHeight,
    );
    // The camp is a spot in the zone being left, so it can't survive the walk.
    this.afk.set(false);
    this.stopGathering();
    this.clearTarget();
    this.closeCounters();
    this.contextMenu.clear();
    // Save the spot in the zone being *entered*, not the one being left: a tab
    // closed mid-walk should come back where the walk was going. The next world
    // computes the same point from the entry edge.
    const destination = zoneWorldSize(ZONES[exit.to]);
    this.character.recordLocation(
      exit.to,
      arrivalPoint(
        sideOn(ZONES[exit.to], entryEdge),
        fraction,
        destination.width,
        destination.height,
        ARRIVAL_INSET,
      ),
    );
    saveService.save(this.character.state);
    this.ctx.push({ kind: 'zone-exit', to: exit.to, edge: entryEdge, fraction });
  }

  // ---------------------------------------------------------------------------
  // The counters: talking, vendoring, the bank, the trainer, the board, the
  // outfitter and the fettler
  // ---------------------------------------------------------------------------

  /** Who is behind that counter while it is open; null when it is shut. */
  counterNpc(counter: CounterId): WorldNpc | null {
    return this.counters[counter].npc;
  }

  /** The one counter that is open, if any is. */
  openCounter(): CounterSession | null {
    return Object.values(this.counters).find((counter) => counter.isOpen()) ?? null;
  }

  /** Whether the character has been left camping. */
  get afkActive(): boolean {
    return this.afk.active;
  }

  /** Walking away shuts whichever counter is open; all ask the same distance. */
  updateNpcRange(): void {
    Object.values(this.counters).forEach((counter) => counter.updateRange());
  }

  /**
   * Everything that stops a session at once shuts all of them, never one, and
   * whatever is open in the house with them: one thing is served at a time.
   */
  closeCounters(): void {
    Object.values(this.counters).forEach((counter) => counter.close());
    this.house.close();
  }

  handleReforgeRequested(itemId: ItemId): void {
    this.counters.reforger.reforge(itemId);
  }

  handleCraftRequested(recipeId: RecipeId): void {
    this.gathering.makeRecipe(recipeId);
  }

  handleLearnRequested(abilityId: AbilityId): void {
    this.counters.trainer.learn(abilityId);
  }

  handleAcceptBountyRequested(bountyId: BountyId): void {
    this.counters.quartermaster.accept(bountyId);
  }

  handleTurnInBountyRequested(bountyId: BountyId): void {
    this.counters.quartermaster.turnIn(bountyId);
  }

  handleAbandonBountyRequested(): void {
    this.counters.quartermaster.abandon();
  }

  handleBuyRequested(itemId: ItemId): void {
    this.counters.merchant.buy(itemId);
  }

  handleSellRequested(itemId: ItemId, quantity = 1): void {
    this.counters.merchant.sell(itemId, quantity);
  }

  handleDepositRequested(itemId: ItemId, quantity = 1): void {
    this.counters.banker.deposit(itemId, quantity);
  }

  handleWithdrawRequested(itemId: ItemId, quantity = 1): void {
    this.counters.banker.withdraw(itemId, quantity);
  }

  handleBuyBankSlotRequested(): void {
    this.counters.banker.buySlot();
  }

  // ---------------------------------------------------------------------------
  // Loot piles
  // ---------------------------------------------------------------------------

  /** Every pile on the ground in this zone, for whatever is drawing them. */
  get lootPiles(): readonly LootPile[] {
    return this.loot.piles;
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

  /** What is over the fire, or null. The gather channel's twin; see `GatherSession`. */
  get cookState(): CraftState | null {
    return this.gathering.cooking;
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
      winding: this.target.windUp ? ENEMY_ABILITIES[this.target.windUp.abilityId].name : null,
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
    this.closeCounters();
    this.contextMenu.clear();
    this.approach.cancel();
    this.player.stopMoving();
    // The loot piles are left where they lie (decision 63): the respawn is in
    // this zone, and a pile is still the player's to walk back to.
    this.ctx.log(logNotice('You have died.'));
    this.ctx.events.emit(PLAYER_DIED_EVENT);
    this.tips.noteDeath(this.chargeDeathToll());

    // Back on your feet where you fell, rather than carried home. Being moved
    // to town for nothing made dying the fastest way to travel and a free heal
    // on arrival; what it costs now is the walk back.
    //
    // The spawn point is the zone's start, and `spawnSafety.test.ts` holds
    // it clear of every aggressive creature's whole wander disc — so getting up
    // is never getting straight back into the fight that ended.
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.player.setVelocity(0, 0);
    this.player.restoreToFull();
    this.persistCharacter();
    this.ctx.push({ kind: 'death', on: 'player' });
  }

  /**
   * The fee, taken on the way back up. Never refused for want of coin: a purse
   * too thin pays what it has, since a character who cannot afford to die is
   * the one who can least afford to stay dead. Answers what was paid.
   */
  private chargeDeathToll(): number {
    const { paid } = deathToll(this.character.state.level, this.character.state.currency);
    if (paid <= 0) return 0;
    this.character.spendCurrency(paid);
    this.ctx.log(logDeathToll(paid));
    this.ctx.publishCurrency();
    return paid;
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

  /**
   * A potion out of the bag, at full health or in a fight: unlike food it heals
   * nothing, so neither is a reason to refuse it.
   */
  drinkPotion(itemId: ItemId): void {
    if (!this.character.drinkPotion(itemId)) return;
    this.player.setPotions(this.character.state.potions);
    this.ctx.notice(`You drink the ${describeItemName(itemId)}.`);
    this.ctx.publishInventory();
  }

  // Every potion's clock runs on game time, and the body is told what is left.
  private tickPotions(deltaMs: number): void {
    this.character.spendPotionTime(deltaMs);
    this.player.setPotions(this.character.state.potions);
  }

  private awardXp(reward: number): void {
    // The one choke point both the swing and the ability paths run through, so
    // it is the one place the AFK penalty has to be applied. A quest reward is
    // not one of them — handing a quest in is something the player did — so it
    // comes in through publishXpGain instead. A kill made by hand spends the
    // rested bank; one idle made is halved, raised by a Keeper's Watch if one is
    // drunk, and never rested as well.
    if (this.afk.active) {
      this.awardIdleXp(
        afkXpReward(
          reward,
          true,
          idleXpMultiplier(isPotionActive(this.character.state.potions, 'keepers-watch')),
        ),
      );
      return;
    }
    this.creditXp(reward, this.character.awardPlayedXp(reward));
  }

  // XP idle earned, awake or on a parked night, which is never rested as well:
  // idle's XP is not the player's to double.
  private awardIdleXp(amount: number): void {
    this.creditXp(amount, this.character.awardXp(amount));
  }

  private creditXp(amount: number, gain: CombatXpGain): void {
    this.ctx.float(`+${amount + gain.bonus} XP`, 'reward', 20);
    this.ctx.log(logXpGain(amount, gain.bonus));
    this.publishXpGain(gain);
  }

  // Everything a level costs the rest of the world, for XP however it arrived.
  private publishXpGain(gain: CombatXpGain): void {
    this.ctx.events.emit(XP_GAINED_EVENT, gain);

    if (gain.leveledUp) {
      this.ctx.push({ kind: 'level-up', at: this.ctx.playerPoint() });
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
    const check = this.character.unequip(slot);
    if (!check.ok) {
      this.ctx.notice(check.reason);
      return;
    }
    this.applyGearChange();
  }

  // Gear moves max HP, so the HUD needs the new current HP alongside the gear —
  // and the quiver, which `publishInventory` sends with the bag, since a quiver
  // taken off or put on moves arrows between the two.
  private applyGearChange(): void {
    this.player.setGear(this.character.state.gear, this.character.state.reforges);
    this.ctx.events.emit(GEAR_CHANGED_EVENT, this.character.state.gear);
    this.ctx.publishInventory();
    this.ctx.events.emit(PLAYER_HP_CHANGED_EVENT, this.player.hp);
  }

  persistCharacter(): void {
    this.ctx.persistCharacter();
  }
}
