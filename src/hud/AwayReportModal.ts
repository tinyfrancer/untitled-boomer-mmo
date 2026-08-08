import { Overlay } from './Overlay';
import { el } from './dom';
import { describeItemName } from '../data/items';
import { SKILLS } from '../data/skills';
import { formatCurrency } from '../systems/CurrencySystem';
import { inventoryEntries } from '../systems/InventorySystem';
import { formatAwayDuration, type OfflineAfkReport } from '../systems/OfflineAfkSystem';

/**
 * What a camp earned while the tab was closed, shown once on the load that
 * resolved it. Modal-ish rather than a toast: it is the only time the player
 * ever sees this, and a line that faded after a second would be worse than not
 * reporting it at all.
 */
export class AwayReportModal extends Overlay {
  constructor(report: OfflineAfkReport, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through', onClosed);
    const lines: string[] = [`Away for ${formatAwayDuration(report.elapsedMs)}`];
    // A session is one or the other, never both — which is what the tool in the
    // character's hands decided when they settled in.
    if (report.skill) {
      lines.push(`${report.gathers} gathered, ${report.skillXp} ${SKILLS[report.skill].name} XP`);
    } else {
      lines.push(`${report.kills} kills, ${report.xp} XP`);
    }
    if (report.copper > 0) {
      lines.push(formatCurrency(report.copper));
    }
    for (const [itemId, quantity] of inventoryEntries(report.drops)) {
      lines.push(`${describeItemName(itemId)} x${quantity}`);
    }
    if (report.packFilled) {
      lines.push('Your pack filled up.');
    }

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
}
