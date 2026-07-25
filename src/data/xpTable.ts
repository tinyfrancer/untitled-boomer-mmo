const XP_PER_LEVEL = 80;
const SKILL_XP_COEFFICIENT = 24;

// XP required to go from (level - 1) to level. Quadratic, so each level costs
// visibly more than the last: the starter arc is tuned so that finishing both
// quests and gearing up lands a character on level 3 and no further — see
// tests/systems/progression.test.ts, which is what actually holds the pacing.
export function xpToReachLevel(level: number): number {
  return XP_PER_LEVEL * level * level;
}

// Skills grow on a quadratic curve while combat stays linear, on purpose: a kill
// is a whole fight, whereas a gather is a few seconds, so an equally-paced skill
// has to cost far more XP per level. At ~10 XP a gather this is roughly 770
// gathers to cap a skill.
export function skillXpToReachLevel(level: number): number {
  return SKILL_XP_COEFFICIENT * level * level;
}

// Combat skills tick up off single swings and single blocked hits, so their
// curve is shallow and linear: the brake on them is the character-level cap,
// not the grind. At 4 a level they moved every eight swings, which read as
// noise rather than progress.
const COMBAT_SKILL_XP_PER_LEVEL = 10;

export function combatSkillXpToReachLevel(level: number): number {
  return COMBAT_SKILL_XP_PER_LEVEL * level;
}
