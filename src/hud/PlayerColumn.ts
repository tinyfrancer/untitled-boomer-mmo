import { el, place } from './dom';
import { titleName } from '../systems/AchievementSystem';
import { formatXpProgress } from '../systems/LevelingSystem';
import { MAX_CHARACTER_LEVEL } from '../config/constants';
import type { Rect } from '../ui/layout';
import type { TitleId } from '../types/ids';

/** Who you are and how far along: name, worn title, level, XP and mana. */
export class PlayerColumn {
  readonly root: HTMLElement;
  private readonly nameLine: HTMLElement;
  private readonly titleLine: HTMLElement;
  private readonly levelLine: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly xpText: HTMLElement;
  private readonly manaBlock: HTMLElement;
  private readonly manaFill: HTMLElement;
  private readonly manaText: HTMLElement;

  constructor(name: string) {
    this.root = el('div', 'hud-player');
    this.nameLine = el('div', 'hud-player__name', name);
    this.titleLine = el('div', 'hud-player__title hud-hidden');
    this.levelLine = el('div', 'hud-player__level', 'Level 1');

    const xpBar = el('div', 'hud-bar hud-player__xp');
    this.xpFill = el('div', 'hud-bar__fill');
    xpBar.append(this.xpFill);
    this.xpText = el('div', 'hud-player__xp-text');

    this.manaBlock = el('div', 'hud-player__mana hud-hidden');
    const manaBar = el('div', 'hud-bar');
    this.manaFill = el('div', 'hud-bar__fill hud-bar__fill--mana');
    this.manaText = el('div', 'hud-bar__label');
    manaBar.append(this.manaFill, this.manaText);
    this.manaBlock.append(manaBar);

    this.root.append(
      this.nameLine,
      this.titleLine,
      this.levelLine,
      xpBar,
      this.xpText,
      this.manaBlock,
    );
  }

  layout(rect: Rect): void {
    place(this.root, rect, 'width');
  }

  setName(name: string): void {
    this.nameLine.textContent = name;
  }

  setTitle(titleId: TitleId | null): void {
    this.titleLine.textContent = titleId ? titleName(titleId) : '';
    this.titleLine.classList.toggle('hud-hidden', titleId === null);
  }

  setXp(level: number, xp: number, xpToNext: number): void {
    this.levelLine.textContent =
      level >= MAX_CHARACTER_LEVEL ? `Level ${level} (Max)` : `Level ${level}`;
    const ratio = xpToNext > 0 ? Math.min(Math.max(xp / xpToNext, 0), 1) : 1;
    this.xpFill.style.width = `${ratio * 100}%`;
    this.xpText.textContent = formatXpProgress(xp, xpToNext);
  }

  /** A class with no pool shows no bar at all, which is what its absence means. */
  setMana(mana: number, maxMana: number): void {
    this.manaBlock.classList.toggle('hud-hidden', maxMana <= 0);
    if (maxMana <= 0) {
      return;
    }
    this.manaFill.style.width = `${Math.min(Math.max(mana / maxMana, 0), 1) * 100}%`;
    this.manaText.textContent = `${mana} / ${maxMana} mana`;
  }
}
