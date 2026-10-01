import { TILE_SIZE } from '../config/constants';
import { SPIRIT_BEATS } from '../data/spiritBeats';
import { dueBeat, spiritAside } from '../systems/SpiritSystem';
import type { SpiritBeatId } from '../types/ids';
import { SPIRIT_SAID_EVENT } from '../ui/uiEvents';
import { TIP_OPENING_MS } from './TipDesk';
import type { WorldContext } from './WorldContext';

/**
 * Where Wick floats from the player's feet, in simulation units: off the left
 * shoulder, a hair behind, so it is drawn beside the figure rather than in it.
 */
export const SPIRIT_OFFSET = { x: -TILE_SIZE * 0.6, y: -TILE_SIZE * 0.15 } as const;
/** How far over the ground it floats: a figure's shoulder. */
export const SPIRIT_HEIGHT = TILE_SIZE * 0.9;
/**
 * How long it takes to close most of the way to where it should be. A lag, so
 * it trails a walk rather than being carried, and the same at any frame rate:
 * the share closed is worked out from the frame's length, not taken per frame.
 */
export const SPIRIT_FOLLOW_MS = 220;
/** Further off than this it is there at once: a zone walk, a respawn, a teleport. */
export const SPIRIT_SNAP = TILE_SIZE * 4;
/** How long it stays lit after it has spoken. */
export const SPIRIT_SPEAKING_MS = 1_500;
// How often the beats are asked about. A beat is news that keeps.
const CHECK_MS = 1_000;

/** What Wick needs from the rest of the zone, and the whole of it. */
export interface SpiritDeps {
  /** Whether a tip is waiting to be said. */
  tipWaiting: () => boolean;
  /** Says the tip waiting, or the one said and unheard, answering whether there was one. */
  sayTip: () => boolean;
}

/**
 * Wick, in the world (D4, `docs/lore/spirit.md`): a light that follows the
 * player, glows and chimes when it has something to say, and says it when
 * tapped.
 *
 * It follows on a lag and never routes and never blocks: it is a light, so
 * walls are nothing to it, and nothing can stand in its way or be stood in by
 * it. What it has to say is, in order, a beat of its story waiting here, a tip
 * waiting at the desk, or failing both a line of its own about where it is.
 * Only its waking comes without a tap, since that is how a player learns the
 * light can be tapped. Which beats it has told is the character's; what is
 * waiting, and the clock, are this zone's.
 */
export class Spirit {
  /** The ground under the light, which is what it is sorted by; it floats `height` over it. */
  x: number;
  y: number;
  readonly height = SPIRIT_HEIGHT;
  private readonly ctx: WorldContext;
  private readonly deps: SpiritDeps;
  private beat: SpiritBeatId | null = null;
  private beatSaid = false;
  private wasCalling = false;
  private speakingUntil = -Infinity;
  private turn = 0;
  private nextCheckAt = 0;

  constructor(ctx: WorldContext, deps: SpiritDeps) {
    this.ctx = ctx;
    this.deps = deps;
    const home = this.home();
    this.x = home.x;
    this.y = home.y;
  }

  update(deltaMs: number): void {
    this.follow(deltaMs);
    const { now } = this.ctx;
    if (now >= TIP_OPENING_MS && now >= this.nextCheckAt) {
      this.nextCheckAt = now + CHECK_MS;
      const due = dueBeat(this.ctx.character.state, this.ctx.zoneId);
      if (due !== this.beat) {
        this.beat = due;
        this.beatSaid = false;
      }
      if (due && !this.beatSaid && SPIRIT_BEATS[due].unbidden) this.tell(due);
    }
    // The chime is the moment it starts to glow, which a sound has to be told.
    const calling = this.calling;
    if (calling && !this.wasCalling) this.chime();
    this.wasCalling = calling;
  }

  /** Whether it has something to say that it has not said: it glows, and chimed when it started. */
  get calling(): boolean {
    return (this.beat !== null && !this.beatSaid) || this.deps.tipWaiting();
  }

  /** Whether it is lit: calling, or a moment after it has spoken. */
  get lit(): boolean {
    return this.calling || this.ctx.now < this.speakingUntil;
  }

  /**
   * Tapped. A beat is told again until it is heard, and a tip said again, so a
   * second tap is asking again rather than asking past what is on the card.
   */
  tap(): void {
    if (this.beat) {
      this.tell(this.beat);
      return;
    }
    if (this.deps.sayTip()) {
      this.spoke();
      return;
    }
    const text = spiritAside(this.ctx.zoneId, this.turn);
    this.turn += 1;
    this.ctx.events.emit(SPIRIT_SAID_EVENT, { beatId: null, text });
    this.spoke();
  }

  /** The card's Got it on a beat: heard for good, and the next asked about at once. */
  heard(beatId: SpiritBeatId): void {
    this.ctx.character.markBeatHeard(beatId);
    if (beatId === this.beat) {
      this.beat = null;
      this.beatSaid = false;
    }
    this.nextCheckAt = 0;
    this.ctx.persistCharacter();
  }

  /** It speaks unasked, a secret's line: chimed and lit as if it had been called. */
  voice(): void {
    this.chime();
    this.spoke();
  }

  private tell(beatId: SpiritBeatId): void {
    this.beatSaid = true;
    this.ctx.events.emit(SPIRIT_SAID_EVENT, { beatId, text: SPIRIT_BEATS[beatId].line });
    this.spoke();
  }

  private spoke(): void {
    this.speakingUntil = this.ctx.now + SPIRIT_SPEAKING_MS;
  }

  private chime(): void {
    this.ctx.push({ kind: 'spirit-calls', at: { x: this.x, y: this.y } });
  }

  private home(): { x: number; y: number } {
    const { player } = this.ctx;
    return { x: player.x + SPIRIT_OFFSET.x, y: player.y + SPIRIT_OFFSET.y };
  }

  private follow(deltaMs: number): void {
    const home = this.home();
    const dx = home.x - this.x;
    const dy = home.y - this.y;
    if (Math.hypot(dx, dy) > SPIRIT_SNAP) {
      this.x = home.x;
      this.y = home.y;
      return;
    }
    const share = 1 - Math.exp(-deltaMs / SPIRIT_FOLLOW_MS);
    this.x += dx * share;
    this.y += dy * share;
  }
}
