import { ZoneWorld } from '../../src/world/ZoneWorld';
import { CharacterController } from '../../src/systems/CharacterController';
import { InputState } from '../../src/systems/InputState';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import { ZONES } from '../../src/data/zones';
import { ABILITIES, CLASS_ABILITIES, type AbilityDefinition } from '../../src/data/abilities';
import { ENEMY_ABILITIES } from '../../src/data/enemyAbilities';
import { consumableFor, isArrow } from '../../src/data/items';
import { FIRE_INPUT_ITEM_ID } from '../../src/data/recipes';
import { recipeFromItem } from '../../src/systems/CraftingSystem';
import { knownAbilities } from '../../src/systems/AbilitySystem';
import { isBlocked } from '../../src/systems/CollisionSystem';
import { PLAYER_HALF_EXTENT, TILE_SIZE } from '../../src/config/constants';
import {
  CHANNEL_ENDED_EVENT,
  CHANNEL_STARTED_EVENT,
  PLAYER_DIED_EVENT,
} from '../../src/ui/uiEvents';
import { recordingBus, type Emitted } from './harness';
import type { Gear } from '../../src/systems/InventorySystem';
import type { Point } from '../../src/systems/MovementSystem';
import type { AbilityId, ClassId, ItemId, ZoneId } from '../../src/types/ids';
import type { Mob } from '../../src/world/Mob';

/**
 * A player who never stops to look: the pace of the game in minutes, measured
 * by playing it (decision 122).
 *
 * Counting kills says nothing about how long one takes, and how long one takes
 * is most of what the rebuilt zones changed: the walk to the next creature, the
 * fight, and the wait to be fit for another. This plays a zone the way somebody
 * grinding it does — the nearest thing worth fighting, abilities pressed as
 * they come up, out of a telegraph when there is the time to leave, a bow or a
 * staff fought from its reach, and between fights a meal, a fire for what
 * dropped raw, or a rest when there is nothing to eat — on the real map with
 * the real pathing, and reports the game time a level took.
 *
 * A person is slower than this: they read, they choose, they miss. What it
 * measures is the game's share of the time, which is the share tuning moves.
 */

/** A seeded roll, so a run is the same run every time and a change moves it. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PaceRun {
  zoneId: ZoneId;
  classId: ClassId;
  level: number;
  /** What is worn, over what the class starts with. */
  gear: Partial<Gear>;
  /** What is carried in to eat. */
  food?: Partial<Record<ItemId, number>>;
  /** Logs carried to light fires with, for whatever drops raw. */
  logs?: number;
  /** The cooking level, which decides what goes in the pan; the character's level unless said. */
  cooking?: number;
  /** Game time to give up after. */
  budgetMs?: number;
  seed?: number;
}

export interface PaceResult {
  /** Whether the level came inside the budget. */
  levelled: boolean;
  /** Game time to the next level, or the budget. */
  ms: number;
  kills: number;
  deaths: number;
  /** Stood still waiting on regen. */
  restingMs: number;
  /** Stood still while a meal worked. */
  eatingMs: number;
  /** Stood at a fire cooking what dropped. */
  cookingMs: number;
  /** What was eaten, by item. */
  eaten: Partial<Record<ItemId, number>>;
  /** Coin picked up along the way, before anything a death took back. */
  copper: number;
}

const STEP_MS = 100;
/** Between fights: a meal below the first, a rest below the second when there is no meal, until the third. */
const EAT_BELOW = 0.7;
const REST_BELOW = 0.7;
const FIT_AT = 0.95;
/** A fire is lit for this much raw food: one log, a pan's worth. */
const COOK_BATCH = 4;
/** A heal pressed below this in a fight. */
const HEAL_BELOW = 0.6;
/** A target gone untouched this long is given up on for a while. */
const STUCK_MS = 30000;
const SKIP_MS = 60000;
/** A dodge only tried with this much of the walk to spare. */
const DODGE_SLACK = 0.8;
/** A bow or a staff reaches at least this far, and is fought from it. */
const RANGED_REACH = 150;
/** How far from an edge a step back may end: well clear of the way out. */
const EDGE_CLEAR = TILE_SIZE * 2;
/** How long one step back is held before looking again. */
const KITE_MS = 1500;

/** The eight ways the keys walk, each with the keys that walk it. */
const WAYS: { keys: string[]; x: number; y: number }[] = [
  { keys: ['KeyW'], x: 0, y: -1 },
  { keys: ['KeyW', 'KeyD'], x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { keys: ['KeyD'], x: 1, y: 0 },
  { keys: ['KeyS', 'KeyD'], x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { keys: ['KeyS'], x: 0, y: 1 },
  { keys: ['KeyS', 'KeyA'], x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { keys: ['KeyA'], x: -1, y: 0 },
  { keys: ['KeyW', 'KeyA'], x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
];

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** What a character at `level` has bought from the trainer: everything it can have. */
function learnedAt(classId: ClassId, level: number): AbilityId[] {
  return CLASS_ABILITIES[classId].filter((id) => {
    const training = ABILITIES[id].training;
    return training !== undefined && training.level <= level;
  });
}

function characterFor(run: PaceRun): CharacterState {
  const state = createNewCharacter('Pacer', run.classId);
  state.level = run.level;
  state.gear = { ...state.gear, ...run.gear };
  state.learnedAbilities = learnedAt(run.classId, run.level);
  state.skills.cooking = { level: Math.min(10, run.cooking ?? run.level), xp: 0 };
  // Unrested, and it never idles to bank any: the pace is a level's play by
  // hand, and rested is a bonus on top of it rather than part of it (phase E1).
  state.rested = 0;
  return state;
}

export function playToNextLevel(run: PaceRun): PaceResult {
  const state = characterFor(run);
  const character = new CharacterController(state);
  Object.entries(run.food ?? {}).forEach(([itemId, count]) => {
    if (count) character.addItem(itemId as ItemId, count);
  });
  if (run.logs) character.addItem(FIRE_INPUT_ITEM_ID, run.logs);
  if (run.classId === 'ranger') {
    // Never runs dry: what arrows cost is held in coin by `progression.test.ts`.
    for (let i = 0; i < 40; i += 1) character.tryAddItem('crude-arrows', 50);
  }

  const emitted: Emitted[] = [];
  const bus = recordingBus(emitted);
  // A cast is broken by a step, so one under way is stood through; a pan is
  // the same channel and is stood over the same way.
  let channelling = false;
  bus.on(CHANNEL_STARTED_EVENT, () => {
    channelling = true;
  });
  bus.on(CHANNEL_ENDED_EVENT, () => {
    channelling = false;
  });
  const input = new InputState();
  const seed = run.seed ?? 1;
  const world = new ZoneWorld({
    zone: ZONES[run.zoneId],
    character,
    events: bus,
    input,
    rng: seeded(seed),
    rolls: seeded(seed + 1),
  });
  const player = world.player;

  const abilities = knownAbilities(run.classId, state.learnedAbilities);
  const heals = abilities.filter((ability) => ability.effect.kind === 'heal');
  // A shield before anything is cast, since a blow it eats leaves a cast standing.
  const others = abilities
    .filter((ability) => ability.effect.kind !== 'heal')
    .sort((a, b) => Number(b.effect.kind === 'absorb') - Number(a.effect.kind === 'absorb'));

  const startLevel = state.level;
  const budget = run.budgetMs ?? 60 * 60 * 1000;
  const skipUntil = new Map<Mob, number>();
  const eaten: Partial<Record<ItemId, number>> = {};
  let target = null as Mob | null;
  let targetSince = 0;
  let mode: 'fight' | 'rest' | 'eat' | 'cook' = 'fight';
  let panIdle = 0;
  let kills = 0;
  let restingMs = 0;
  let eatingMs = 0;
  let cookingMs = 0;
  let copper = 0;
  let purse = state.currency;
  let t = 0;

  const count = (itemId: ItemId): number => state.inventory[itemId] ?? 0;
  const carried = (): ItemId[] =>
    (Object.keys(state.inventory) as ItemId[]).filter((itemId) => count(itemId) > 0);
  const meals = (): ItemId[] => carried().filter((itemId) => consumableFor(itemId) !== null);
  /** The smallest meal that covers the gap, or the largest there is. */
  const mealFor = (gap: number): ItemId | null => {
    const heal = (itemId: ItemId): number => consumableFor(itemId)?.healAmount ?? 0;
    const sorted = meals().sort((a, b) => heal(a) - heal(b));
    return sorted.find((itemId) => heal(itemId) >= gap) ?? sorted.at(-1) ?? null;
  };
  /** Whatever dropped raw that this cook can put in a pan. */
  const raw = (): ItemId[] =>
    carried().filter((itemId) => {
      const recipe = recipeFromItem(itemId, 'fire');
      return recipe !== null && recipe.requiredLevel <= state.skills.cooking.level;
    });
  const rawCount = (): number => raw().reduce((sum, itemId) => sum + count(itemId), 0);
  /** Sold as it comes, so a full pack never stops the run: what selling costs is a walk, not counted here. */
  const sellLoot = (): void => {
    carried().forEach((itemId) => {
      const kept =
        consumableFor(itemId) !== null ||
        isArrow(itemId) ||
        itemId === FIRE_INPUT_ITEM_ID ||
        recipeFromItem(itemId, 'fire') !== null;
      if (!kept) delete state.inventory[itemId];
    });
  };

  /**
   * Whether a cast this long lands before anything engaged could close and
   * break it, or behind a shield that eats the blow that would: a cast is only
   * started with the room to finish it.
   */
  const roomFor = (ability: AbilityDefinition): boolean =>
    ability.castTimeMs === 0 ||
    player.hasManaShield() ||
    world.mobs.every(
      (mob) =>
        !mob.isAlive() ||
        !mob.isEngaged() ||
        distance(mob, player) - mob.attackRange >
          (mob.definition.chaseSpeed * ability.castTimeMs) / 1000,
    );
  const press = (ability: AbilityDefinition): void => {
    if (roomFor(ability)) world.handleAbilityRequested(ability.id);
  };

  const choose = (mob: Mob): void => {
    target = mob;
    targetSince = t;
    world.tap({ kind: 'mob', mob });
  };

  // Stepping back is done on the keys, which keep the target where a tap on
  // the ground would drop it, and a bow keeps loosing while its holder walks.
  let held: string[] = [];
  let backingFrom = null as Mob | null;
  let backingTo = 0;
  let backingUntil = 0;
  const hold = (keys: string[]): void => {
    held.filter((key) => !keys.includes(key)).forEach((key) => input.release(key));
    keys.forEach((key) => input.press(key));
    held = keys;
  };
  /**
   * The open way that ends furthest from `mob`, two tiles out, without leading
   * it past its leash: a creature drawn out of its ring walks home healed, so a
   * kite that only ever backs straight away undoes its own fight.
   */
  const wayFrom = (mob: Mob): string[] | null => {
    const home = { x: mob.spawnX, y: mob.spawnY };
    const ring = mob.definition.leashRadius - TILE_SIZE;
    let best: { keys: string[]; score: number; away: number } | null = null;
    for (const way of WAYS) {
      const at = (tiles: number): Point => ({
        x: player.x + way.x * TILE_SIZE * tiles,
        y: player.y + way.y * TILE_SIZE * tiles,
      });
      const open = [1, 2].every(
        (tiles) =>
          !isBlocked(world.collisionWorld, {
            ...at(tiles),
            halfWidth: PLAYER_HALF_EXTENT,
            halfHeight: PLAYER_HALF_EXTENT,
          }),
      );
      const to = at(2);
      const inside =
        to.x > EDGE_CLEAR &&
        to.y > EDGE_CLEAR &&
        to.x < world.worldWidth - EDGE_CLEAR &&
        to.y < world.worldHeight - EDGE_CLEAR;
      if (!open || !inside) continue;
      const away = distance(to, mob);
      const score = away - 3 * Math.max(0, distance(to, home) - ring);
      if (!best || score > best.score) best = { keys: way.keys, score, away };
    }
    return best && best.away > distance(player, mob) ? best.keys : null;
  };
  const backAway = (mob: Mob, far: number, forMs: number): void => {
    backingFrom = mob;
    backingTo = far;
    backingUntil = t + forMs;
  };
  /** One step of backing away, or false once there is no more to do. */
  const stepBack = (): boolean => {
    const from = backingFrom;
    const keys =
      from && t < backingUntil && from.isAlive() && distance(player, from) < backingTo
        ? wayFrom(from)
        : null;
    if (!keys) {
      backingFrom = null;
      hold([]);
      return false;
    }
    hold(keys);
    return true;
  };
  /** Out of whatever is being wound up, where there is the time to leave. */
  const dodge = (): void => {
    for (const mob of world.mobs) {
      if (!mob.isAlive() || !mob.windUp || backingFrom === mob) continue;
      const ability = ENEMY_ABILITIES[mob.windUp.abilityId];
      const short = ability.range + 32 - distance(mob, player);
      if (short <= 0) continue;
      if (short > player.speed * (ability.windUpMs / 1000) * DODGE_SLACK) continue;
      backAway(mob, ability.range + 48, ability.windUpMs + 200);
      return;
    }
  };
  /** A bow or a staff is fought from its reach, and walks back to it when closed on. */
  const kite = (): void => {
    if (channelling || backingFrom || !target || player.attackRange < RANGED_REACH) return;
    if (!target.isEngaged() || distance(target, player) > target.attackRange + 60) return;
    backAway(target, player.attackRange * 0.85, KITE_MS);
  };

  /** Between fights: a fire for what dropped raw, a meal, or a rest. */
  const recover = (hp: number): void => {
    if (mode === 'cook') {
      cookingMs += STEP_MS;
      if (channelling) {
        panIdle = 0;
        return;
      }
      // A pan that will not start again — the fire out, or nothing left this
      // cook can make — is walked away from.
      const next = raw()[0];
      if (next && panIdle < 3) world.handleCookRequested(next);
      else mode = 'fight';
      panIdle += 1;
      return;
    }
    if (mode === 'eat') {
      if (!player.isEating() || hp >= FIT_AT) mode = 'fight';
      else eatingMs += STEP_MS;
      return;
    }
    if (mode === 'rest') {
      if (hp >= FIT_AT) mode = 'fight';
      else restingMs += STEP_MS;
      return;
    }
    if (target) return;
    if (rawCount() >= COOK_BATCH && count(FIRE_INPUT_ITEM_ID) > 0) {
      world.handleLightFireRequested();
      mode = 'cook';
      panIdle = 0;
    } else if (hp < EAT_BELOW && meals().length > 0) {
      const meal = mealFor(player.maxHp * FIT_AT - player.hp);
      if (!meal) return;
      world.handleEatRequested(meal);
      eaten[meal] = (eaten[meal] ?? 0) + 1;
      mode = 'eat';
    } else if (hp < REST_BELOW) {
      mode = 'rest';
    }
  };

  /** The nearest thing worth fighting: nothing above a yellow, and never a boss. */
  const quarry = (): Mob | undefined =>
    world.mobs
      .filter(
        (mob) =>
          mob.isAlive() &&
          mob.definition.boss !== true &&
          mob.level <= state.level + 1 &&
          (skipUntil.get(mob) ?? -1) < t,
      )
      .sort((a, b) => distance(a, player) - distance(b, player))[0];

  const fight = (): void => {
    if (!target) {
      const next = quarry();
      if (next) choose(next);
      return;
    }
    if (t - targetSince > STUCK_MS && target.hp === target.maxHp && !target.isEngaged()) {
      skipUntil.set(target, t + SKIP_MS);
      target = null;
      world.clearTarget();
      return;
    }
    if (world.target !== target) world.tap({ kind: 'mob', mob: target });
    else if (distance(target, player) > player.attackRange) world.pursueTarget(target);
    if (!channelling && distance(target, player) <= player.attackRange + 40) {
      others.forEach(press);
    }
  };

  while (t < budget && state.level === startLevel) {
    if (target && !target.isAlive()) {
      kills += 1;
      target = null;
      sellLoot();
    }
    const engaged = world.mobs.filter((mob) => mob.isAlive() && mob.isEngaged());
    const hp = player.hp / player.maxHp;

    // A heal in a fight; out of one a meal does it, and a cast would spoil it.
    if (hp < HEAL_BELOW && !channelling && engaged.length > 0) heals.forEach(press);

    dodge();
    kite();
    if (!stepBack()) {
      if (engaged.length > 0) {
        mode = 'fight';
        const nearest = [...engaged].sort((a, b) => distance(a, player) - distance(b, player))[0];
        if (nearest && (!target || !target.isEngaged())) choose(nearest);
      } else {
        recover(hp);
      }
      if (mode === 'fight') fight();
    }

    world.update(STEP_MS);
    t += STEP_MS;
    if (world.changingZone) throw new Error(`the pacer walked out of ${run.zoneId}`);
    copper += Math.max(0, state.currency - purse);
    purse = state.currency;
  }

  return {
    levelled: state.level > startLevel,
    ms: t,
    kills,
    deaths: emitted.filter((entry) => entry.event === PLAYER_DIED_EVENT).length,
    restingMs,
    eatingMs,
    cookingMs,
    eaten,
    copper,
  };
}
