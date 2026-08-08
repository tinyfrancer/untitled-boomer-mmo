import { EffectBar } from './EffectBar';
import { el, fillPercent, place } from './dom';
import { barFill } from '../systems/math';
import { titleName } from '../systems/AchievementSystem';
import { formatXpProgress } from '../systems/LevelingSystem';
import { MAX_CHARACTER_LEVEL } from '../config/constants';
import type { ActiveEffect } from '../systems/EffectSystem';
import type { Rect } from '../ui/layout';
import type { TitleId } from '../types/ids';

/** One bar and the numbers printed inside it. */
interface Gauge {
  root: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
}

function gauge(className: string, fillClass: string): Gauge {
  const root = el('div', `hud-bar ${className}`);
  const fill = el('div', `hud-bar__fill ${fillClass}`);
  const label = el('div', 'hud-bar__label');
  root.append(fill, label);
  return { root, fill, label };
}

/**
 * Who you are and how you are doing: name and level on one line, then health,
 * mana and XP as three bars, then whatever buffs are up.
 *
 * Every number a bar carries is printed *inside* it rather than on a line
 * underneath. Three bars and three captions is six rows of eye travel for three
 * facts, and the top-left corner is read at a glance mid-fight or not at all.
 */
export class PlayerColumn {
  readonly root: HTMLElement;
  private readonly nameText: HTMLElement;
  private readonly levelText: HTMLElement;
  private readonly titleLine: HTMLElement;
  private readonly hp: Gauge;
  private readonly mana: Gauge;
  private readonly xp: Gauge;
  private readonly effects = new EffectBar();

  constructor(name: string) {
    this.root = el('div', 'hud-player');

    // Name and level share a line: the level is a short number and giving it a
    // whole row of its own pushed everything below it further from the eye.
    const head = el('div', 'hud-player__head');
    this.nameText = el('div', 'hud-player__name', name);
    this.levelText = el('div', 'hud-player__level', 'Level 1');
    head.append(this.nameText, this.levelText);

    this.titleLine = el('div', 'hud-player__title hud-hidden');
    this.hp = gauge('hud-player__hp', 'hud-bar__fill--hp');
    this.mana = gauge('hud-player__mana hud-hidden', 'hud-bar__fill--mana');
    this.xp = gauge('hud-player__xp', '');

    this.root.append(
      head,
      this.titleLine,
      this.hp.root,
      this.mana.root,
      this.xp.root,
      this.effects.root,
    );
  }

  layout(rect: Rect): void {
    place(this.root, rect, 'width');
  }

  setName(name: string): void {
    this.nameText.textContent = name;
  }

  setTitle(titleId: TitleId | null): void {
    this.titleLine.textContent = titleId ? titleName(titleId) : '';
    this.titleLine.classList.toggle('hud-hidden', titleId === null);
  }

  setHp(hp: number, maxHp: number): void {
    this.hp.fill.style.width = fillPercent(barFill(hp, maxHp));
    this.hp.label.textContent = `${hp} / ${maxHp} hp`;
  }

  setXp(level: number, xp: number, xpToNext: number): void {
    this.levelText.textContent =
      level >= MAX_CHARACTER_LEVEL ? `Level ${level} (Max)` : `Level ${level}`;
    // At the level cap there is no next level to fill toward, and a full bar is
    // what that reads as.
    this.xp.fill.style.width = fillPercent(xpToNext > 0 ? barFill(xp, xpToNext) : 1);
    this.xp.label.textContent = formatXpProgress(xp, xpToNext);
  }

  /** A class with no pool shows no bar at all, which is what its absence means. */
  setMana(mana: number, maxMana: number): void {
    this.mana.root.classList.toggle('hud-hidden', maxMana <= 0);
    if (maxMana <= 0) {
      return;
    }
    this.mana.fill.style.width = fillPercent(barFill(mana, maxMana));
    this.mana.label.textContent = `${mana} / ${maxMana} mana`;
  }

  setEffects(effects: ActiveEffect[]): void {
    this.effects.update(effects);
  }

  /** Whether the buff row is taking any room, which `ui/layout.ts` reserves. */
  hasEffects(): boolean {
    return !this.effects.isEmpty();
  }
}
