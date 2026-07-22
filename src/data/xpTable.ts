const XP_PER_LEVEL = 50;
const SKILL_XP_COEFFICIENT = 20;

// XP required to go from (level - 1) to level.
export function xpToReachLevel(level: number): number {
  return XP_PER_LEVEL * level;
}

// Skills grow on a quadratic curve while combat stays linear, on purpose: a kill
// is a whole fight, whereas a gather is a few seconds, so an equally-paced skill
// has to cost far more XP per level. At ~10 XP a gather this is roughly 770
// gathers to cap a skill.
export function skillXpToReachLevel(level: number): number {
  return SKILL_XP_COEFFICIENT * level * level;
}
