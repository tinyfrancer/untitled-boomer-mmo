import { MAX_CHARACTER_LEVEL, combatSkillCap } from '../config/constants';
import { describeItemBonuses, describeItemName, toolItemFor } from '../data/items';
import { MASTERY_TIERS } from '../data/mastery';
import { RECIPES, STATION_IDS, STATION_SKILLS, type CraftingRecipe } from '../data/recipes';
import { RESOURCE_NODES, type ResourceNodeDefinition } from '../data/resourceNodes';
import { COMBAT_SKILL_TRAINING, SKILLS, skillFamily } from '../data/skills';
import { ZONES } from '../data/zones';
import { MIN_FAILURE_CHANCE, fizzleReduction } from './AbilitySystem';
import {
  CRIT_MULTIPLIER,
  avoidanceChance,
  blockChance,
  critChance,
  weaponSkillBonus,
} from './CombatSystem';
import { failureChance } from './CraftingSystem';
import { gatherSpeedBonus, skillYieldChance } from './GatherSystem';
import { ingredients, recipeOutput, stationPlace } from './ItemUseSystem';
import { masteryProgress, masteryXp, type MasteryProgress, type MasteryXp } from './MasterySystem';
import { skillCap, skillLevel, skillXpToNextLevel, type Skills } from './SkillSystem';
import type { CombatSkillId, ItemId, MasteryTargetId, SkillId } from '../types/ids';

/**
 * The skills book, as plain data: a page per skill saying what it is, what
 * training it buys, and everything it works or makes (decision 86).
 *
 * Nothing on a page is written per row. A node or a recipe added to its table is
 * on its skill's page, in level order, with its inputs, what it makes and that
 * thing's numbers, the moment it is a row — and what a level buys is read off the
 * same functions the rolls call, so a retune moves the sentence with the curve.
 * The only hand-written words are what earns a combat skill its XP
 * (`COMBAT_SKILL_TRAINING`), which is a fact about a fight rather than a table.
 */

/** Everything about the character a page reads. */
export interface SkillBookState {
  skills: Skills;
  /** The character's level, which is what a combat skill's cap rides. */
  level: number;
  mastery: MasteryXp;
}

/** Which of the three kinds of page a skill gets: what fills it decides the rest. */
export type SkillBookKind = 'gathering' | 'making' | 'combat';

/** Where a row's pool stands, for a row the character can work at all. */
export interface BookMastery {
  progress: MasteryProgress;
  /** The pool's whole total, which is what a maxed one shows. */
  xp: number;
}

/** One node or recipe, as its skill's page lists it. */
export interface BookEntry {
  /** The node's or recipe's id, which is also the mastery pool it fills. */
  id: MasteryTargetId;
  name: string;
  requiredLevel: number;
  unlocked: boolean;
  /** What comes of it — a node's yield, a recipe's output — and what a row's card is about. */
  resultItemId: ItemId;
  /** What goes in and comes out, the result's numbers, the XP and where, a line each. */
  lines: string[];
  /**
   * Null for a row still out of reach, whose pool cannot have been started: a
   * level is never lost, so a gate that shuts a row has shut it since the start.
   */
  mastery: BookMastery | null;
}

export interface SkillPage {
  skillId: SkillId;
  name: string;
  kind: SkillBookKind;
  level: number;
  xp: number;
  /** XP to the next level, or 0 at the cap. */
  xpToNext: number;
  /** How it trains and what a level buys, with this character's numbers, a sentence each. */
  about: string[];
  /** What the rows are called as a group, or null for a skill with none. */
  entriesTitle: string | null;
  entries: BookEntry[];
}

export function skillBookKind(skillId: SkillId): SkillBookKind {
  if (skillFamily(skillId) === 'combat') return 'combat';
  return nodesFor(skillId).length > 0 ? 'gathering' : 'making';
}

export function skillPage(skillId: SkillId, state: SkillBookState): SkillPage {
  const level = skillLevel(state.skills, skillId);
  const kind = skillBookKind(skillId);
  const entries =
    kind === 'gathering'
      ? nodesFor(skillId).map((node) => nodeEntry(node, level, state.mastery))
      : kind === 'making'
        ? recipesFor(skillId).map((recipe) => recipeEntry(recipe, level, state.mastery))
        : [];
  return {
    skillId,
    name: SKILLS[skillId].name,
    kind,
    level,
    xp: state.skills[skillId]?.xp ?? 0,
    xpToNext: skillXpToNextLevel(skillId, level, state.level),
    about: aboutSkill(skillId, kind, level, state.level),
    entriesTitle: ENTRIES_TITLES[kind],
    // Stable, so rows at one level keep the order their table gives them.
    entries: entries.sort((a, b) => a.requiredLevel - b.requiredLevel),
  };
}

/**
 * What mastery is and what its ranks pay, said once over a page's rows from the
 * rank table itself. The first rank is left out because it pays nothing, and
 * naming it would only say so.
 */
export function masteryRule(): string {
  const paying = MASTERY_TIERS.filter((tier) => tier.bonusChance > 0)
    .map((tier) => `${tier.name} ${percent(tier.bonusChance)}`)
    .join(', ');
  return (
    'Every row keeps a mastery of its own, filled by the XP it pays on a success. ' +
    `Its ranks pay a chance of a second one from the same action: ${paying}.`
  );
}

const ENTRIES_TITLES: Record<SkillBookKind, string | null> = {
  gathering: 'Gathered from',
  making: 'Recipes',
  combat: null,
};

function nodesFor(skillId: SkillId): ResourceNodeDefinition[] {
  return Object.values(RESOURCE_NODES).filter((node) => node.skill === skillId);
}

function recipesFor(skillId: SkillId): CraftingRecipe[] {
  return Object.values(RECIPES).filter((recipe) => recipe.skill === skillId);
}

function nodeEntry(node: ResourceNodeDefinition, level: number, mastery: MasteryXp): BookEntry {
  const lines = [`Yields ${describeItemName(node.yieldItemId)} · ${node.xpReward} XP`];
  const stats = describeItemBonuses(node.yieldItemId);
  if (stats) lines.push(stats);
  // Read off the zones that spawn it, the way a station is named with the zone
  // it stands in: a node moved to another zone takes its line along.
  const zones = Object.values(ZONES)
    .filter((zone) => zone.nodeSpawns.some((spawn) => spawn.nodeId === node.id))
    .map((zone) => zone.name);
  if (zones.length > 0) lines.push(`Found in: ${zones.join(', ')}`);
  return entry(node.id, node.name, node.requiredLevel, level, node.yieldItemId, lines, mastery);
}

function recipeEntry(recipe: CraftingRecipe, level: number, mastery: MasteryXp): BookEntry {
  const lines = [`${ingredients(recipe.inputs)} → ${recipeOutput(recipe)}`];
  const stats = describeItemBonuses(recipe.outputItemId);
  if (stats) lines.push(stats);
  const failure = recipe.failureItemId
    ? ` · a failure makes ${describeItemName(recipe.failureItemId)}`
    : '';
  lines.push(`${recipe.xpReward} XP${failure}`);
  return entry(
    recipe.id,
    recipe.name,
    recipe.requiredLevel,
    level,
    recipe.outputItemId,
    lines,
    mastery,
  );
}

function entry(
  id: MasteryTargetId,
  name: string,
  requiredLevel: number,
  level: number,
  resultItemId: ItemId,
  lines: string[],
  mastery: MasteryXp,
): BookEntry {
  const unlocked = level >= requiredLevel;
  return {
    id,
    name,
    requiredLevel,
    unlocked,
    resultItemId,
    lines,
    mastery: unlocked
      ? { progress: masteryProgress(mastery, id), xp: masteryXp(mastery, id) }
      : null,
  };
}

function aboutSkill(
  skillId: SkillId,
  kind: SkillBookKind,
  level: number,
  characterLevel: number,
): string[] {
  switch (kind) {
    case 'gathering':
      return aboutGathering(skillId, level, characterLevel);
    case 'making':
      return aboutMaking(skillId, level, characterLevel);
    case 'combat':
      return aboutCombat(skillId as CombatSkillId, level, characterLevel);
  }
}

function aboutGathering(skillId: SkillId, level: number, characterLevel: number): string[] {
  const cap = skillCap(skillId, characterLevel);
  const at = (l: number) =>
    `${percent(gatherSpeedBonus(l))} quicker, and a ${percent(skillYieldChance(l))} chance of a second`;
  const about = [
    `Trained by gathering: each one pays the XP on its row, up to level ${cap}.`,
    `Each level makes a gather ${percent(gatherSpeedBonus(2))} quicker and adds a ` +
      `${percent(skillYieldChance(2))} chance of a second one.`,
    atLevel(level, cap, at(level), at(cap), gatherSpeedBonus(level) + skillYieldChance(level) <= 0),
  ];
  const tool = toolItemFor(skillId);
  if (tool) about.push(`Needs a ${tool.name} in hand.`);
  return about;
}

function aboutMaking(skillId: SkillId, level: number, characterLevel: number): string[] {
  const cap = skillCap(skillId, characterLevel);
  const stations = STATION_IDS.filter((station) => STATION_SKILLS[station] === skillId);
  const perLevel = failureChance(1) - failureChance(2);
  const sure = levelsUpTo(cap).find((l) => failureChance(l) <= EPSILON);
  const now = failureChance(level);
  const about = [
    `Trained by making: each job pays the XP on its row and a failure pays none, up to level ${cap}.`,
    `Worked at ${stations.map(stationPlace).join(' and ')}.`,
    `Each level takes ${points(perLevel)} off the chance a job fails` +
      (sure ? `, and from level ${sure} none do.` : '.'),
    now > EPSILON
      ? `At level ${level}: ${percent(now)} of jobs fail.`
      : `At level ${level}: no job fails.`,
  ];
  // What a failure costs is the recipe's to say (`failureItemId`), so the page
  // says it only where every row agrees, and each row that spends says what it
  // leaves.
  const recipes = recipesFor(skillId);
  if (recipes.every((recipe) => !recipe.failureItemId)) {
    about.push('A failure costs only the time, and keeps what went in.');
  } else if (recipes.every((recipe) => recipe.failureItemId)) {
    about.push('A failure spends what went in.');
  }
  return about;
}

function aboutCombat(skillId: CombatSkillId, level: number, characterLevel: number): string[] {
  const cap = skillCap(skillId, characterLevel);
  // The most any character can have, which is what "the most" is measured
  // against rather than this character's own ceiling: a level raises that.
  const top = combatSkillCap(MAX_CHARACTER_LEVEL);
  const about = [
    `Trained by ${COMBAT_SKILL_TRAINING[skillId]}.`,
    `It goes up to ${combatSkillCap(1)} for each character level: ${cap} for you now.`,
  ];

  if (skillId === 'block') {
    const at = (l: number) => {
      const bare = blockChance(l);
      const shielded = blockChance(l, true);
      return shielded > bare
        ? `${percent(bare)}, or ${percent(shielded)} with a shield`
        : `${percent(bare)}, shield or not`;
    };
    about.push(
      'Each level adds to the chance to block a hit outright, and a shield in the off hand ' +
        'makes it likelier.',
      atLevel(level, top, at(level), at(top)),
    );
    return about;
  }
  if (skillId === 'parry') {
    const at = (l: number) => percent(avoidanceChance(l));
    about.push(
      'Each level adds to the chance to parry a hit outright, with a weapon in hand. A parry is ' +
        'tried before a block.',
      atLevel(level, top, at(level), at(top)),
    );
    return about;
  }

  const at = (l: number) =>
    `+${percent(weaponSkillBonus(l) - 1)} damage and a ${percent(critChance(l))} critical chance`;
  about.push(
    skillId === 'destruction'
      ? 'Each level adds a little damage to a spell that deals it, and a chance to land it ' +
          `critically, for ${CRIT_MULTIPLIER}× damage.`
      : 'Each level adds a little damage and a chance to land a critical hit, for ' +
          `${CRIT_MULTIPLIER}× damage.`,
    atLevel(level, top, at(level), at(top)),
  );
  if (skillId === 'destruction') {
    about.push(
      `Each level also takes ${points(fizzleReduction(1))} off every spell's chance to fizzle, ` +
        `never below ${percent(MIN_FAILURE_CHANCE)}: ${points(fizzleReduction(level))} off at ` +
        `level ${level}.`,
    );
  }
  return about;
}

/**
 * What the skill buys now, and at the most it ever can — the pair that says
 * both where a player is and whether the climb is worth it. A level that buys
 * nothing yet says so rather than printing a row of noughts.
 */
function atLevel(
  level: number,
  top: number,
  now: string,
  best: string,
  nothingYet = false,
): string {
  if (level >= top) return `At level ${level}, the most: ${best}.`;
  const lead = nothingYet ? `At level ${level}: nothing yet.` : `At level ${level}: ${now}.`;
  return `${lead} At ${top}, the most: ${best}.`;
}

// Chances that are computed as sums of tenths and hundredths come back a hair
// off zero; anything under this is none.
const EPSILON = 1e-9;

function levelsUpTo(cap: number): number[] {
  return Array.from({ length: cap }, (_, index) => index + 1);
}

/**
 * A chance as the book prints it: whole percent from ten up, one decimal below
 * that, and two below one — a block's 0.3% a level is the number that says
 * training is slow, and rounding it to nothing would say it does nothing.
 */
function percent(ratio: number): string {
  return `${percentNumber(ratio)}%`;
}

/** A difference between two chances, which is points rather than a percent of either. */
function points(ratio: number): string {
  const value = percentNumber(ratio);
  return `${value} ${value === '1' ? 'point' : 'points'}`;
}

function percentNumber(ratio: number): string {
  const value = Math.round(ratio * 10000) / 100;
  if (value >= 10) return String(Math.round(value));
  if (value >= 1) return String(Math.round(value * 10) / 10);
  return String(value);
}
