const XP_PER_LEVEL = 100;
const SKILL_XP_COEFFICIENT = 24;

// XP required to go from (level - 1) to level. Quadratic, so each level costs
// visibly more than the last, less a flat 200 so the first one is quick: level
// n to n + 1 is asked to take n + 4 minutes of play, which is what each zone's
// pay a minute put this at (decision 122). tests/world/pace.test.ts holds that
// in minutes and tests/systems/progression.test.ts the arcs in kills and XP.
export function xpToReachLevel(level: number): number {
  return XP_PER_LEVEL * level * level - 200;
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
