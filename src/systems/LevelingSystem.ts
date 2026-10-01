import { MAX_CHARACTER_LEVEL } from '../config/constants';
import { xpToReachLevel } from '../data/xpTable';

export interface LevelState {
  level: number;
  xp: number;
}

export interface AddXpResult {
  state: LevelState;
  leveledUp: boolean;
}

export function addXp(state: LevelState, amount: number): AddXpResult {
  if (state.level >= MAX_CHARACTER_LEVEL || amount <= 0) {
    return { state, leveledUp: false };
  }

  let level = state.level;
  let xp = state.xp + amount;
  let leveledUp = false;

  while (level < MAX_CHARACTER_LEVEL && xp >= xpToReachLevel(level + 1)) {
    xp -= xpToReachLevel(level + 1);
    level += 1;
    leveledUp = true;
  }

  if (level >= MAX_CHARACTER_LEVEL) {
    level = MAX_CHARACTER_LEVEL;
    xp = 0;
  }

  return { state: { level, xp }, leveledUp };
}

// XP needed to reach the next level, or 0 if already at the cap — the
// single source of truth for this so HUD init (on load) and HUD updates
// (on kill) can't drift apart.
export function xpToNextLevel(level: number): number {
  if (level >= MAX_CHARACTER_LEVEL) {
    return 0;
  }
  return xpToReachLevel(level + 1);
}

// The XP bar's detail line. xpToNext of 0 means the cap is reached. With a
// rested bank the percentage gives way to it, since the bar shows how far along
// it is and nothing but the line can say how much is banked.
export function formatXpProgress(xp: number, xpToNext: number, rested = 0): string {
  if (xpToNext <= 0) {
    return 'Max level';
  }
  const progress = `${xp.toLocaleString()} / ${xpToNext.toLocaleString()} XP`;
  const banked = Math.floor(rested);
  if (banked > 0) {
    return `${progress}, ${banked.toLocaleString()} rested`;
  }
  const pct = Math.floor((xp / xpToNext) * 100);
  return `${progress} (${pct}%)`;
}
