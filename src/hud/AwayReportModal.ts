import { Overlay } from './Overlay';
import { el } from './dom';
import { ENEMIES } from '../data/enemies';
import { describeItemName } from '../data/items';
import { SKILLS } from '../data/skills';
import { formatCurrency } from '../systems/CurrencySystem';
import { inventoryEntries } from '../systems/InventorySystem';
import { masteryTarget } from '../systems/MasterySystem';
import { awayCeilingReached } from '../systems/IdlePlanSystem';
import {
  OFFLINE_CAP_MS,
  formatAwayDuration,
  type OfflineAfkReport,
} from '../systems/OfflineAfkSystem';

/**
 * What idle earned while the game was closed, shown once on the load that
 * resolved it. Modal-ish rather than a toast: it is the only time the player
 * ever sees this, and a line that faded after a second would be worse than not
 * reporting it at all.
 *
 * It speaks in the idle panel's words, since the panel is where the player was
 * told what a closed game would pay: the creature it named, the hours that
 * count, and the ceiling, said here when the night reached it.
 */
export class AwayReportModal extends Overlay {
  constructor(report: OfflineAfkReport, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through', onClosed);
    const away = `Away for ${formatAwayDuration(report.elapsedMs)}`;
    const lines = [report.elapsedMs >= OFFLINE_CAP_MS ? `${away}, the most that counts` : away];
    // A session is one of the three, never two — which is what the station
    // underfoot and the tool in hand decided between them when they settled in.
    if (report.skill && report.crafts > 0) {
      lines.push(`${report.crafts} made, ${report.skillXp} ${SKILLS[report.skill].name} XP`);
    } else if (report.skill) {
      lines.push(`${report.gathers} gathered, ${report.skillXp} ${SKILLS[report.skill].name} XP`);
    } else {
      const quarry = report.enemyId ? `${ENEMIES[report.enemyId].name} ` : '';
      lines.push(`${report.kills} ${quarry}kills, ${report.xp} XP`);
    }
    if (report.capped) {
      lines.push(awayCeilingReached(report.skill));
    }
    // The other thing a night is for (phase E1): what the time banked for the
    // XP the player earns by hand, in the idle panel's word for it.
    if (report.rested > 0) {
      lines.push(`${report.rested} XP banked as rested`);
    }
    // Which pool the night filled, named because it is the one thing a session
    // earns that the sheet behind this report does not say out loud: a skill XP
    // total is on the character sheet either way, where a pool that moved is
    // invisible until somebody goes looking for it.
    if (report.masteryTargetId && report.skillXp > 0) {
      lines.push(`${masteryTarget(report.masteryTargetId).name} mastery +${report.skillXp}`);
    }
    if (report.arrowsSpent > 0) {
      lines.push(`${report.arrowsSpent} arrows shot`);
    }
    if (report.copper > 0) {
      lines.push(formatCurrency(report.copper));
    }
    for (const [itemId, quantity] of inventoryEntries(report.drops)) {
      lines.push(`${describeItemName(itemId)} x${quantity}`);
    }

    const box = el('div', 'hud-modal__box');
    box.append(el('div', 'hud-modal__title', 'While you were away'));
    const body = el('div', 'hud-modal__body');
    body.append(...lines.map((line) => el('div', 'hud-modal__line', line)));

    // What a making camp worked through, under its own heading for the same
    // reason the drops are listed at all: coming back to a pack forty ore
    // lighter with no line saying where it went reads as a bug, not a night's
    // smithing. Every other kind of session leaves this empty.
    const consumed = inventoryEntries(report.consumed);
    if (consumed.length > 0) {
      body.append(el('div', 'hud-modal__line', 'Used:'));
      body.append(
        ...consumed.map(([itemId, quantity]) =>
          el('div', 'hud-modal__line', `${describeItemName(itemId)} x${quantity}`),
        ),
      );
    }

    // The potions the night drank (phase E3), under their own heading for the
    // reason the used ore is: a bag lighter by three draughts with nothing
    // saying where they went reads as a bug.
    const drunk = inventoryEntries(report.drunk);
    if (drunk.length > 0) {
      body.append(el('div', 'hud-modal__line', 'Drank:'));
      body.append(
        ...drunk.map(([itemId, quantity]) =>
          el('div', 'hud-modal__line', `${describeItemName(itemId)} x${quantity}`),
        ),
      );
    }

    // What the pack had no room for, itemised under its own heading. A full
    // pack never stopped the session — it kept fighting or working and kept
    // earning — so this is the only place the cost of it is ever stated.
    const missed = inventoryEntries(report.missed);
    if (missed.length > 0) {
      body.append(el('div', 'hud-modal__line hud-modal__danger', 'Could not carry:'));
      body.append(
        ...missed.map(([itemId, quantity]) =>
          el(
            'div',
            'hud-modal__line hud-modal__missed',
            `${describeItemName(itemId)} x${quantity}`,
          ),
        ),
      );
    }

    // Said in the warning colour, since it is the one line here that is a
    // reason the night paid less than it could have and a thing to go and fix.
    if (report.outOfArrows) {
      body.append(
        el(
          'div',
          'hud-modal__line hud-modal__danger',
          'Your arrows ran out, and idle stopped fighting.',
        ),
      );
    }

    const dismiss = el('button', 'hud-button', 'Welcome back');
    dismiss.type = 'button';
    dismiss.dataset.action = 'dismiss-away-report';
    dismiss.addEventListener('click', () => this.close());

    box.append(body, dismiss);
    this.root.append(box);
  }
}
