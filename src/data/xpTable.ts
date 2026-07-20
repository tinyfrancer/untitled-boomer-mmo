const XP_PER_LEVEL = 50;

// XP required to go from (level - 1) to level.
export function xpToReachLevel(level: number): number {
  return XP_PER_LEVEL * level;
}
