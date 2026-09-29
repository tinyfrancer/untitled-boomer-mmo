import { el, fillPercent, row } from './dom';
import { barFill } from '../systems/math';

/** A skill's name, its level and XP, and a bar under them. */
export interface SkillRow {
  root: HTMLElement;
  value: HTMLElement;
  fill: HTMLElement;
}

/**
 * One skill's line, as the character sheet and the skills book's index both
 * draw it. A row with somewhere to go is a button, since a tappable row has to
 * be; the page's own header is the same shape with nowhere to go.
 */
export function skillRow(label: string, onClick?: () => void): SkillRow {
  let root: HTMLElement;
  if (onClick) {
    const button = el('button', 'hud-skill is-button');
    button.type = 'button';
    button.addEventListener('click', onClick);
    root = button;
  } else {
    root = el('div', 'hud-skill');
  }
  const line = row({ className: 'hud-skill__line', label });
  const bar = el('div', 'hud-bar hud-skill__bar');
  const fill = el('div', 'hud-bar__fill');
  bar.append(fill);
  root.append(line.root, bar);
  return { root, value: line.value, fill };
}

/** `Lv 3 · 40 / 96 XP`, or `Lv 10 (max)` for a skill with no next level to fill toward. */
export function formatSkillProgress(level: number, xp: number, xpToNext: number): string {
  return xpToNext > 0 ? `Lv ${level} · ${xp} / ${xpToNext} XP` : `Lv ${level} (max)`;
}

export function setSkillProgress(
  skillRow: SkillRow,
  level: number,
  xp: number,
  xpToNext: number,
): void {
  skillRow.value.textContent = formatSkillProgress(level, xp, xpToNext);
  // A capped skill has no next level to fill toward, and reads as full.
  skillRow.fill.style.width = fillPercent(xpToNext > 0 ? barFill(xp, xpToNext) : 1);
}
