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
 * The spirit's tips: which one is waiting, saying it, and hearing the answer.
 *
 * One at a time. Since D4 a tip waits in Wick rather than coming up on its own:
 * the desk keeps asking which applies, so one that stops applying stops
 * waiting, and Wick glows while one does and says it when tapped. Once said, it
 * stays said until heard, and nothing else waits meanwhile. What has been heard
 * is the character's (`CharacterState.tips`), so it rides the save; what is
 * waiting, and the clock between tips, is this zone's and starts again in the
 * next. A card said in the last zone is still on screen in this one, which is
 * why being told a tip was heard is taken whichever tip it is.
 */
export class TipDesk {
  private readonly ctx: WorldContext;
  private readonly deps: TipDeskDeps;
  private ready: OfferedTip | null = null;
  private said: OfferedTip | null = null;
  private quietUntil = TIP_OPENING_MS;
  private nextCheckAt = 0;
  private deathPaid: number | null = null;

  constructor(ctx: WorldContext, deps: TipDeskDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  update(): void {
    const { now } = this.ctx;
    if (this.said !== null || now < this.quietUntil || now < this.nextCheckAt) return;
    this.nextCheckAt = now + TIP_CHECK_MS;
    this.ready = this.next();
  }

  /** The tip waiting to be said, with its line as it reads now, or null. */
  get waiting(): OfferedTip | null {
    return this.ready;
  }

  /**
   * Says the tip waiting, or again the one said and not yet heard, and answers
   * whether there was one: a second tap on Wick is asking again, not asking for
   * something else while the first is unanswered.
   */
  say(): boolean {
    const tip = this.ready ?? this.said;
    if (!tip) return false;
    this.ready = null;
    this.said = tip;
    this.ctx.events.emit(TIP_OFFERED_EVENT, tip);
    return true;
  }

  /** A death is news the save keeps nothing of, so it is noted here until heard. */
  noteDeath(paid: number): void {
    this.deathPaid = paid;
  }

  heard(tipId: TipId): void {
    this.ctx.character.markTipHeard(tipId);
    if (tipId === 'first-death') this.deathPaid = null;
    if (tipId === this.said?.tipId) this.said = null;
    if (tipId === this.ready?.tipId) this.ready = null;
    this.quietUntil = this.ctx.now + TIP_GAP_MS;
    this.ctx.persistCharacter();
  }

  /** On or off for good, from the card's Go quiet or from Options. */
  set(on: boolean): void {
    this.ctx.character.setTipsOff(!on);
    // Switched back on, the next one waits its turn rather than arriving with
    // the tap that asked for it.
    this.ready = null;
    this.said = null;
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
