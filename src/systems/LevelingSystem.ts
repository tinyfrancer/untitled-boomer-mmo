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
