import { el, fillPercent, place } from './dom';
import { barFill } from '../systems/math';
import type { Rect } from '../ui/layout';
import type { TargetInfo } from '../ui/uiEvents';

/** What is selected, top-left. Hidden outright when nothing is. */
export class TargetFrame {
  readonly root: HTMLElement;
  private readonly nameLine: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly windUp: HTMLElement;

  constructor() {
    this.root = el('div', 'hud-panel hud-target hud-hidden');
    this.nameLine = el('div', 'hud-target__name');

    // A bar rather than a line of text, for the same reason the plate over the
    // creature's own head is one: how much of a fight is left is a proportion,
    // and reading it off two numbers is arithmetic done mid-swing.
    const hpBar = el('div', 'hud-bar hud-target__hp');
    this.hpFill = el('div', 'hud-bar__fill hud-bar__fill--target');
    this.hpText = el('div', 'hud-bar__label');
    hpBar.append(this.hpFill, this.hpText);

    // Under the bar, and empty most of the time: a line that is only ever there
    // when something is about to happen is read as the warning it is.
    this.windUp = el('div', 'hud-target__winding hud-hidden');

    this.root.append(this.nameLine, hpBar, this.windUp);
  }

  layout(rect: Rect): void {
    place(this.root, rect, 'box');
  }

  /** Whether the wind-up line is showing, which is a line of height to reserve. */
  isWinding(): boolean {
    return !this.windUp.classList.contains('hud-hidden');
  }

  show(target: TargetInfo): void {
    this.nameLine.textContent = `${target.name} (Lv ${target.level})`;
    this.nameLine.style.color = target.conColor;
    this.hpFill.style.width = fillPercent(barFill(target.hp, target.maxHp));
    this.hpText.textContent = `${target.hp} / ${target.maxHp} hp`;
    this.windUp.textContent = target.winding ?? '';
    this.windUp.classList.toggle('hud-hidden', target.winding === null);
    this.root.classList.remove('hud-hidden');
  }

  hide(): void {
    this.root.classList.add('hud-hidden');
  }
}
