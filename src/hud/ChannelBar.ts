import { el, fillPercent } from './dom';
import { channelBarTop } from '../ui/layout';

/**
 * The bar for anything the player is in the middle of: a gather, a cast.
 *
 * One widget rather than one per kind, because they are the same shape and can
 * never both be running — casting stops a gather and being hit breaks either.
 * Screen-space rather than pinned over the player, who the camera keeps centred
 * anyway.
 */
export class ChannelBar {
  readonly root: HTMLElement;
  private readonly label: HTMLElement;
  private readonly fill: HTMLElement;

  constructor() {
    this.root = el('div', 'hud-channel hud-hidden');
    this.label = el('div', 'hud-channel__label');
    const bar = el('div', 'hud-bar hud-channel__bar');
    this.fill = el('div', 'hud-bar__fill');
    bar.append(this.fill);
    this.root.append(this.label, bar);
  }

  layout(viewportHeight: number): void {
    this.root.style.top = `${channelBarTop(viewportHeight)}px`;
  }

  show(label: string): void {
    this.label.textContent = label;
    this.fill.style.width = '0%';
    this.root.classList.remove('hud-hidden');
  }

  setProgress(progress: number): void {
    this.fill.style.width = fillPercent(progress);
  }

  hide(): void {
    this.root.classList.add('hud-hidden');
  }
}
