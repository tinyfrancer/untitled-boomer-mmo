import { nextTip, type OfferedTip } from '../systems/TipSystem';
import type { TipId } from '../types/ids';
import { TIP_OFFERED_EVENT, TIPS_STATE_CHANGED_EVENT } from '../ui/uiEvents';
import type { WorldContext } from './WorldContext';

// Quiet for this long after a world opens, so a tip is not the first thing a
// load or a zone walk says, and for this long after one is heard, so a
// character from before tips existed hears them one at a time rather than as a
// queue to tap through (decision 98).
export const TIP_OPENING_MS = 8_000;
export const TIP_GAP_MS = 40_000;
// How often the rules are asked. A tip is news that keeps, so a second late is
// nothing, and the rules read the whole bag.
const TIP_CHECK_MS = 1_000;

/** What the desk needs from the rest of the zone, and the whole of it. */
export interface TipDeskDeps {
  isIdle: () => boolean;
}

/**
 * The spirit's tips: which one to offer, and hearing the answer.
 *
 * One at a time, and it stays offered until it is heard. What has been heard is
 * the character's (`CharacterState.tips`), so it rides the save; what is on
 * offer, and the clock between tips, is this zone's and starts again in the
 * next. A card offered in the last zone is still on screen in this one, which
 * is why being told a tip was heard is taken whichever tip it is.
 */
export class TipDesk {
  private readonly ctx: WorldContext;
  private readonly deps: TipDeskDeps;
  private offered: TipId | null = null;
  private quietUntil = TIP_OPENING_MS;
  private nextCheckAt = 0;
  private deathPaid: number | null = null;

  constructor(ctx: WorldContext, deps: TipDeskDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  update(): void {
    const { now } = this.ctx;
    if (this.offered !== null || now < this.quietUntil || now < this.nextCheckAt) return;
    this.nextCheckAt = now + TIP_CHECK_MS;
    const tip = this.next();
    if (!tip) return;
    this.offered = tip.tipId;
    this.ctx.events.emit(TIP_OFFERED_EVENT, tip);
  }

  /** A death is news the save keeps nothing of, so it is noted here until heard. */
  noteDeath(paid: number): void {
    this.deathPaid = paid;
  }

  heard(tipId: TipId): void {
    this.ctx.character.markTipHeard(tipId);
    if (tipId === 'first-death') this.deathPaid = null;
    if (tipId === this.offered) this.offered = null;
    this.quietUntil = this.ctx.now + TIP_GAP_MS;
    this.ctx.persistCharacter();
  }

  /** On or off for good, from the card's No more tips or from Options. */
  set(on: boolean): void {
    this.ctx.character.setTipsOff(!on);
    // Switched back on, the next one waits its turn rather than arriving with
    // the tap that asked for it.
    this.offered = null;
    this.quietUntil = this.ctx.now + TIP_GAP_MS;
    this.ctx.events.emit(TIPS_STATE_CHANGED_EVENT, on);
    this.ctx.persistCharacter();
  }

  private next(): OfferedTip | null {
    const { character, player } = this.ctx;
    return nextTip({
      character: character.state,
      hp: player.hp,
      maxHp: player.maxHp,
      capacity: character.carryCapacity(),
      idle: this.deps.isIdle(),
      deathPaid: this.deathPaid,
    });
  }
}
