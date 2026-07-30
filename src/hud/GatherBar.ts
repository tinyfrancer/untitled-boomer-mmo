import { el } from './dom';

/**
 * The channel bar shown while gathering. Screen-space rather than pinned over
 * the player, who the camera keeps centred anyway.
 */
export class GatherBar {
  readonly root: HTMLElement;
  private readonly label: HTMLElement;
  private readonly fill: HTMLElement;

  constructor() {
    this.root = el('div', 'hud-gather hud-hidden');
    this.label = el('div', 'hud-gather__label');
    const bar = el('div', 'hud-bar hud-gather__bar');
    this.fill = el('div', 'hud-bar__fill');
    bar.append(this.fill);
    this.root.append(this.label, bar);
  }

  layout(viewportHeight: number): void {
    this.root.style.top = `${Math.round(viewportHeight / 2 + 60)}px`;
  }

  show(label: string): void {
    this.label.textContent = label;
    this.fill.style.width = '0%';
    this.root.classList.remove('hud-hidden');
  }

  setProgress(progress: number): void {
    this.fill.style.width = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  }

  hide(): void {
    this.root.classList.add('hud-hidden');
  }
}
