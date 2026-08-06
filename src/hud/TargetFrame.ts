import { el, place } from './dom';
import type { Rect } from '../ui/layout';
import type { TargetInfo } from '../ui/uiEvents';

/** What is selected, top-left. Hidden outright when nothing is. */
export class TargetFrame {
  readonly root: HTMLElement;
  private readonly nameLine: HTMLElement;
  private readonly hpLine: HTMLElement;

  constructor() {
    this.root = el('div', 'hud-panel hud-target hud-hidden');
    this.nameLine = el('div', 'hud-target__name');
    this.hpLine = el('div', 'hud-target__hp');
    this.root.append(this.nameLine, this.hpLine);
  }

  layout(rect: Rect): void {
    place(this.root, rect, 'box');
  }

  show(target: TargetInfo): void {
    this.nameLine.textContent = `${target.name} (Lv ${target.level})`;
    this.nameLine.style.color = target.conColor;
    this.hpLine.textContent = `HP: ${target.hp} / ${target.maxHp}`;
    this.root.classList.remove('hud-hidden');
  }

  hide(): void {
    this.root.classList.add('hud-hidden');
  }
}
