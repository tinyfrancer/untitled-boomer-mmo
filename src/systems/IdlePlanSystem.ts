import { ENEMIES } from '../data/enemies';
import { describeItemName, isBow } from '../data/items';
import { RESOURCE_NODES, type ResourceNodeDefinition } from '../data/resourceNodes';
import { STATION_LABELS, type CraftingRecipe, type StationId } from '../data/recipes';
import { SKILLS } from '../data/skills';
import { ZONES } from '../data/zones';
import { EFFECTS } from '../data/effects';
import type { ClassId, PotionEffectId, SkillId, ZoneId } from '../types/ids';
import {
  AFK_EAT_FRACTION,
  AFK_RESUME_FRACTION,
  AFK_RETREAT_FRACTION,
  AFK_XP_MULTIPLIER,
  afkCampJob,
  afkJobSkill,
  type AfkCampJob,
} from './AfkSystem';
import { hasInputs } from './CraftingSystem';
import { canCarry, carryCapacity, inventoryWeight } from './EncumbranceSystem';
import { canGather, gatherDurationMs } from './GatherSystem';
import { idleFoods, type IdleFoodChoice, type IdleFoodRow } from './IdleFoodSystem';
import { describePotionEffect } from './PotionSystem';
import type { Gear, Inventory } from './InventorySystem';
import { ingredients, recipeOutput } from './ItemUseSystem';
import {
  OFFLINE_CAP_MS,
  OFFLINE_KILL_INTERVAL_MS,
  OFFLINE_MAX_LEVEL_FRACTION,
  OFFLINE_POTIONS,
  OFFLINE_RATE_MULTIPLIER,
  offlineAmmo,
  offlineJob,
  offlineXpCeiling,
  type OfflineJob,
} from './OfflineAfkSystem';
import { arrowsCarried, loadedArrow, type Quiver } from './QuiverSystem';
import type { Reforges } from './ReforgeSystem';
import { scaleEnemyStats } from './EnemySystem';
import { skillLevel, skillXpToNextLevel, type Skills } from './SkillSystem';
import { computeEffectiveStats } from './StatsSystem';

/**
 * What idle will do, said before it starts (decision 96).
 *
 * Nothing here is written per job: every line is read off the same functions
 * the camp and the offline payout run on — `afkCampJob` for what it works with
 * the game open, `offlineJob` for what a closed game pays for, and the
 * constants both are held to — so a retune moves the panel's words with it,
 * and the panel cannot promise a night the payout will not honour.
 */
export interface IdlePlanInput {
  classId: ClassId;
  level: number;
  gear: Gear;
  skills: Skills;
  inventory: Inventory;
  quiver: Quiver | null;
  reforges: Reforges;
  idleFood: IdleFoodChoice;
  /** The stations the player is standing at, which is half of what the job is. */
  stations: StationId[];
  zoneId: ZoneId;
  /** The potions running (version 2 phase E2); absent is none. */
  potionsRunning?: readonly PotionEffectId[];
}

export interface IdlePlan {
  /** What it works with the game open. */
  job: string[];
  /** What that pays, set against doing it by hand. */
  xp: string;
  /** When it eats, or why it will not. */
  foodRule: string;
  /** The food in the bag, in the order it is eaten: the rows the player sets. */
  food: IdleFoodRow[];
  /** What a bow in hand spends; empty for anything else. */
  arrows: string[];
  /** What each potion running does for idle, open and closed; empty with none. */
  potions: string[];
  /** What a closed game pays. */
  away: string[];
  /** A pack with no room left, the one thing here said in the warning colour. */
  warning: string | null;
}

export function idlePlan(input: IdlePlanInput): IdlePlan {
  const job = afkCampJob({
    gear: input.gear,
    skills: input.skills,
    inventory: input.inventory,
    stations: input.stations,
  });
  // A tool with nothing to work in this zone fights instead, which is
  // `chooseAfkNode`'s `none` asked of the zone's table rather than of its nodes.
  const nodes = job.kind === 'gather' ? workableNodes(input, job.skill) : [];
  const fights = job.kind === 'fight' || (job.kind === 'gather' && nodes.length === 0);
  const food = idleFoods(input.inventory, input.idleFood);
  const skill = afkJobSkill(job);
  return {
    job: jobLines(input, job, nodes),
    xp:
      fights || !skill
        ? `${capitalise(share(AFK_XP_MULTIPLIER, 'XP'))} for kills, and no abilities`
        : `Full ${SKILLS[skill].name} XP, the same as by hand`,
    foodRule: foodRule(food),
    food,
    arrows: fights ? arrowLines(input) : [],
    potions: (input.potionsRunning ?? []).map(potionLine),
    away: awayLines(input, job),
    warning: packFull(input, job, nodes)
      ? 'Your pack is full: nothing idle finds will be kept'
      : null,
  };
}

/**
 * The lines the away report adds when a night stopped at its ceiling, in the
 * words the panel promised it in: the panel says "at most half a level" and the
 * report says it got there.
 */
export function awayCeilingReached(skill: SkillId | null): string {
  return `Stopped at the most a night pays: ${ceilingWords(skill)}`;
}

// The zone's nodes this tool can work at this level, named once each.
function workableNodes(input: IdlePlanInput, skill: SkillId): ResourceNodeDefinition[] {
  const nodes = (ZONES[input.zoneId]?.nodeSpawns ?? [])
    .map((spawn) => RESOURCE_NODES[spawn.nodeId])
    .filter((node) => node.skill === skill && canGather(node, input.skills, input.gear).ok);
  return [...new Set(nodes)];
}

function jobLines(
  input: IdlePlanInput,
  job: AfkCampJob,
  nodes: ResourceNodeDefinition[],
): string[] {
  if (job.kind === 'craft') {
    const { recipe } = job;
    return [
      `${capitalise(SKILLS[recipe.skill].verb)} at ${stationName(recipe.station)}: ${made(recipe)}`,
      `Enough in the bag for ${jobsInBag(recipe, input.inventory)}`,
      `With nothing left to make: ${afterMaking(input)}`,
    ];
  }
  if (job.kind === 'gather' && nodes.length > 0) {
    return [
      `${capitalise(SKILLS[job.skill].verb)} near where you start: ${nodes.map((node) => node.name).join(', ')}`,
    ];
  }
  const fight = [
    'Fight what comes near where you start, never starting on a boss',
    `Below ${percent(AFK_RETREAT_FRACTION)} health, rest until ${percent(AFK_RESUME_FRACTION)}`,
  ];
  if (job.kind === 'gather') {
    return [`No work here for your ${describeItemName(input.gear.weapon)}, so:`, ...fight];
  }
  return fight;
}

// What the camp turns to once the bag has nothing left to make: the tool in
// hand where this zone has work for it, and the fight where it has none.
function afterMaking(input: IdlePlanInput): string {
  const next = afkCampJob({ ...input, stations: [] });
  if (next.kind === 'gather' && workableNodes(input, next.skill).length > 0) {
    return `${SKILLS[next.skill].verb} near where you start`;
  }
  return 'fight what comes near where you start';
}

function foodRule(food: IdleFoodRow[]): string {
  if (food.length === 0) return 'No food in the bag: idle rests instead';
  if (food.every((row) => row.keep)) return 'All of it kept: idle rests instead';
  return `Eaten top first, out of a fight and below ${percent(AFK_EAT_FRACTION)} health`;
}

/**
 * What one running potion does for idle. Only the two brewed for it count with
 * the game closed (`OfflineAfkSystem`), and the panel says which, since
 * drinking Fortune before a night away would otherwise look like a plan.
 */
function potionLine(effectId: PotionEffectId): string {
  const away = OFFLINE_POTIONS.includes(effectId)
    ? 'away too, for the time it has left'
    : 'with the game open only';
  return `${EFFECTS[effectId].name}: ${describePotionEffect(effectId)}, ${away}`;
}

function arrowLines(input: IdlePlanInput): string[] {
  if (!isBow(input.gear.weapon)) return [];
  const arrow = loadedArrow(input.gear, input.quiver, input.inventory);
  if (!arrow) return ['No arrows: fists instead'];
  const carried = arrowsCarried(input.quiver, input.inventory);
  return [`${describeItemName(arrow)} first, ${carried} carried`, 'Fists when they run out'];
}

function awayLines(input: IdlePlanInput, job: AfkCampJob): string[] {
  const station = job.kind === 'craft' ? job.recipe.station : null;
  const away = offlineJob(
    { zoneId: input.zoneId, station },
    {
      characterLevel: input.level,
      inventory: input.inventory,
      gear: input.gear,
      skills: input.skills,
    },
  );
  const lines = [`Counts up to ${OFFLINE_CAP_MS / 3_600_000} hours`];
  // A campfire does not outlast the tab, so a night parked at one is paid for
  // what the gear says instead, and the panel says so rather than letting the
  // morning say it.
  if (station && away.kind !== 'craft') {
    lines.push(`The ${STATION_LABELS[station].toLowerCase()} goes out, so instead:`);
  }
  lines.push(...awayJobLines(input, away));
  lines.push('Eats nothing, and what the pack cannot hold is lost');
  return lines;
}

function awayJobLines(input: IdlePlanInput, away: OfflineJob): string[] {
  const rate = capitalise(share(AFK_XP_MULTIPLIER * OFFLINE_RATE_MULTIPLIER, 'XP'));
  if (away.kind === 'craft') {
    const { recipe } = away;
    return [
      `${made(recipe)} at ${stationName(recipe.station)}, while the bag lasts`,
      rate,
      skillCeiling(input, recipe.skill),
    ];
  }
  if (away.kind === 'gather') {
    const { node } = away;
    if (!node) return [`Nothing here to ${SKILLS[away.skill].verb}: it earns nothing`];
    const every = gatherDurationMs(node, skillLevel(input.skills, away.skill));
    return [`A ${node.name} every ${seconds(every)}`, rate, skillCeiling(input, away.skill)];
  }
  const { quarry } = away;
  if (!quarry) return ['Nothing here to fight: it earns nothing'];
  const enemy = ENEMIES[quarry.enemyId];
  const lines = [
    `A kill every ${minutes(OFFLINE_KILL_INTERVAL_MS)}: ${enemy.name}, level ${quarry.level}`,
    `${rate} and ${share(OFFLINE_RATE_MULTIPLIER, 'coin')}`,
    `At most ${ceilingWords(null)}: ${Math.floor(offlineXpCeiling(input.level))} XP`,
  ];
  const ammo = offlineAmmo(
    { ...input, characterLevel: input.level },
    scaleEnemyStats(enemy, quarry.level).maxHp,
  );
  if (ammo) {
    lines.push(
      ammo.left < ammo.perKill
        ? 'No arrows to shoot: it earns nothing'
        : `${ammo.perKill} arrows a kill, ${ammo.left} carried: it stops when they run out`,
    );
  }
  return lines;
}

function skillCeiling(input: IdlePlanInput, skill: SkillId): string {
  const perLevel = skillXpToNextLevel(skill, skillLevel(input.skills, skill), input.level);
  if (perLevel <= 0) return `No XP: ${SKILLS[skill].name} is at its most`;
  return `At most ${ceilingWords(skill)}: ${perLevel} XP`;
}

// "half a level" for a fight, "one Fishing level" for work: the two ceilings
// `OfflineAfkSystem` holds a night to.
function ceilingWords(skill: SkillId | null): string {
  if (skill) return `one ${SKILLS[skill].name} level`;
  return levelShare(OFFLINE_MAX_LEVEL_FRACTION);
}

// Whether what it is about to collect has anywhere to go. A making camp spends
// what it carries to make what it makes, so it is the one job a full pack is no
// warning about.
function packFull(input: IdlePlanInput, job: AfkCampJob, nodes: ResourceNodeDefinition[]): boolean {
  if (job.kind === 'craft') return false;
  const { strength } = computeEffectiveStats(
    input.classId,
    input.gear,
    input.level,
    input.reforges,
  );
  const capacity = carryCapacity(strength);
  const node = nodes[0];
  if (node) return !canCarry(input.inventory, node.yieldItemId, 1, capacity);
  return inventoryWeight(input.inventory) >= capacity;
}

// "Copper Ore, Tin Ore → Bronze Bar", the line a station's list and the skills
// book print under a recipe.
function made(recipe: CraftingRecipe): string {
  return `${ingredients(recipe.inputs)} → ${recipeOutput(recipe)}`;
}

// How many jobs the bag supplies, stopping at the input that runs out first.
function jobsInBag(recipe: CraftingRecipe, inventory: Inventory): number {
  if (!hasInputs(recipe, inventory)) return 0;
  return Math.min(
    ...recipe.inputs.map(({ itemId, quantity }) => Math.floor((inventory[itemId] ?? 0) / quantity)),
  );
}

function stationName(station: StationId): string {
  return station === 'fire' ? 'the campfire' : `the ${STATION_LABELS[station]}`;
}

// A share of something, in the words a person would use for the ones the game
// has, and a percentage for any a retune adds.
export function share(fraction: number, noun: string): string {
  if (fraction === 1) return `all the ${noun}`;
  if (fraction === 0.5) return `half the ${noun}`;
  if (fraction === 0.25) return `a quarter of the ${noun}`;
  return `${percent(fraction)} of the ${noun}`;
}

function levelShare(fraction: number): string {
  if (fraction === 1) return 'one level';
  if (fraction === 0.5) return 'half a level';
  if (fraction === 0.25) return 'a quarter of a level';
  return `${percent(fraction)} of a level`;
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function seconds(ms: number): string {
  return `${Number((ms / 1000).toFixed(1))}s`;
}

function minutes(ms: number): string {
  const count = ms / 60_000;
  return count === 1 ? 'minute' : `${count} minutes`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
