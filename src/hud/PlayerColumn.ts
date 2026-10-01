import { EffectBar } from './EffectBar';
import { TrainingBar, type TrainingProgress } from './TrainingBar';
import { el, fillPercent, place } from './dom';
import { barFill } from '../systems/math';
import { titleName } from '../systems/AchievementSystem';
import { formatXpProgress } from '../systems/LevelingSystem';
import { restedReach } from '../systems/RestedSystem';
import { MAX_CHARACTER_LEVEL } from '../config/constants';
import type { ActiveEffect } from '../systems/EffectSystem';
import type { Rect } from '../ui/layout';
import type { SkillId, TitleId } from '../types/ids';

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

export interface PlayerColumnOptions {
  /** A tap on the training bar, which asks for that skill's page in the book. */
  onOpenSkill: (skillId: SkillId) => void;
  /** The training bar went on its own clock, and the column is a bar shorter. */
  onTrainingHidden: () => void;
}

/**
 * Who you are and how you are doing: name and level on one line, then health,
 * mana, arrows and XP as bars, the skill being trained under them, then
 * whatever buffs are up.
 *
 * Mana and arrows are each there only for somebody who has them: a pool, or a
 * quiver worn. A ranger has no mana, so the one it does have to watch sits
 * where a wizard's does. The training bar is there only while a skill is.
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
  private readonly quiver: Gauge;
  private readonly xp: Gauge;
  private readonly rested: HTMLElement;
  private readonly training: TrainingBar;
  private readonly effects = new EffectBar();

  constructor(name: string, options: PlayerColumnOptions) {
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
    this.quiver = gauge('hud-player__quiver hud-hidden', 'hud-bar__fill--quiver');
    this.xp = gauge('hud-player__xp', '');
    // Under the fill and the numbers, so the bar reads as it always did with a
    // paler stretch ahead of where it has got to.
    this.rested = el('div', 'hud-bar__rested');
    this.xp.root.prepend(this.rested);
    this.training = new TrainingBar(options.onOpenSkill, options.onTrainingHidden);

    this.root.append(
      head,
      this.titleLine,
      this.hp.root,
      this.mana.root,
      this.quiver.root,
      this.xp.root,
      this.training.root,
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

  setXp(level: number, xp: number, xpToNext: number, rested: number): void {
    this.levelText.textContent =
      level >= MAX_CHARACTER_LEVEL ? `Level ${level} (Max)` : `Level ${level}`;
    // At the level cap there is no next level to fill toward, and a full bar is
    // what that reads as.
    this.xp.fill.style.width = fillPercent(xpToNext > 0 ? barFill(xp, xpToNext) : 1);
    // The rested segment reaches as far as the bank will carry the bar, stopping
    // at its end: what is left over carries on into the next level.
    const reach = xpToNext > 0 ? restedReach(rested) : 0;
    this.rested.style.width = fillPercent(reach > 0 ? barFill(xp + reach, xpToNext) : 0);
    this.xp.label.textContent = formatXpProgress(xp, xpToNext, xpToNext > 0 ? rested : 0);
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

  /**
   * Arrows in the quiver against what it holds. No quiver worn is no bar, the
   * way no pool is no mana bar; a quiver run dry keeps its bar, empty, since an
   * empty quiver is the one thing about it worth seeing.
   */
  setQuiver(count: number, capacity: number): void {
    this.quiver.root.classList.toggle('hud-hidden', capacity <= 0);
    if (capacity <= 0) {
      return;
    }
    this.quiver.fill.style.width = fillPercent(barFill(count, capacity));
    this.quiver.label.textContent = count > 0 ? `${count} / ${capacity} arrows` : 'Out of arrows';
  }

  /** XP into a skill, which puts it on the training bar for another half minute. */
  train(progress: TrainingProgress): void {
    this.training.train(progress);
  }

  /** Redraws the skill on the training bar, if that is the one, without keeping it up. */
  redrawTraining(progress: TrainingProgress): void {
    this.training.redraw(progress);
  }

  /** The skill on the training bar, or null while there is none. */
  trainingSkill(): SkillId | null {
    return this.training.skillId;
  }

  /** Whether the training bar is taking any room, which `ui/layout.ts` reserves. */
  hasTraining(): boolean {
    return this.training.skillId !== null;
  }

  /** Stops the training bar's clock, for a HUD being taken down. */
  destroy(): void {
    this.training.stop();
  }

  setEffects(effects: ActiveEffect[]): void {
    this.effects.update(effects);
  }

  /** Whether the buff row is taking any room, which `ui/layout.ts` reserves. */
  hasEffects(): boolean {
    return !this.effects.isEmpty();
  }
}
