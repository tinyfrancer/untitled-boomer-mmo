import { el } from './dom';
import { describeItemName } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import { inventoryEntries } from '../systems/InventorySystem';
import { formatAwayDuration, type OfflineAfkReport } from '../systems/OfflineAfkSystem';

/**
 * What a camp earned while the tab was closed, shown once on the load that
 * resolved it. Modal-ish rather than a toast: it is the only time the player
 * ever sees this, and a line that faded after a second would be worse than not
 * reporting it at all.
 */
export class AwayReportModal {
  readonly root: HTMLElement;
  private readonly onClose: () => void;
  private closed = false;

  constructor(report: OfflineAfkReport, onClose: () => void) {
    this.onClose = onClose;
    const lines: string[] = [
      `Away for ${formatAwayDuration(report.elapsedMs)}`,
      `${report.kills} kills, ${report.xp} XP`,
    ];
    if (report.copper > 0) {
      lines.push(formatCurrency(report.copper));
    }
    for (const [itemId, quantity] of inventoryEntries(report.drops)) {
      lines.push(`${describeItemName(itemId)} x${quantity}`);
    }
    if (report.packFilled) {
      lines.push('Your pack filled up.');
    }

    this.root = el('div', 'hud-modal hud-modal--pass-through');
    const box = el('div', 'hud-modal__box');
    box.append(el('div', 'hud-modal__title', 'While you were away'));
    const body = el('div', 'hud-modal__body');
    body.append(...lines.map((line) => el('div', 'hud-modal__line', line)));

    const dismiss = el('button', 'hud-button', 'Welcome back');
    dismiss.type = 'button';
    dismiss.dataset.action = 'dismiss-away-report';
    dismiss.addEventListener('click', () => this.close());

    box.append(body, dismiss);
    this.root.append(box);
  }

  /** Idempotent: closing an already-closed report does nothing and calls nothing. */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.root.remove();
    this.onClose();
  }
}
