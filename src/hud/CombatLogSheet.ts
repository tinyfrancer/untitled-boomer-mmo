import { Sheet } from './Sheet';
import { el } from './dom';
import { recentEntries, type CombatLogEntry } from '../systems/CombatLogSystem';
import { THEME } from '../ui/theme';

// How many lines are on screen. A log this size is a running commentary on the
// fight in progress, which is why it pins to the newest line rather than
// offering a scrollbar the way the bag does.
const VISIBLE_LINES = 8;

/** What just happened, newest at the bottom. */
export class CombatLogSheet extends Sheet {
  private readonly lines: HTMLElement[];

  constructor() {
    super('Combat Log', THEME.panelWidth.combatLog);
    this.lines = Array.from({ length: VISIBLE_LINES }, () => el('div', 'hud-log__line'));
    this.body.append(...this.lines);
  }

  update(log: CombatLogEntry[]): void {
    const visible = recentEntries(log, VISIBLE_LINES);
    // Bottom-aligned: with a part-full log the blank lines sit above the text,
    // so the newest line never moves.
    const offset = VISIBLE_LINES - visible.length;
    this.lines.forEach((line, index) => {
      const entry = index >= offset ? visible[index - offset] : null;
      line.textContent = entry?.text ?? ' ';
      line.style.color = entry?.color ?? THEME.color.muted;
    });
  }
}
