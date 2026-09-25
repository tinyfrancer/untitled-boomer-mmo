import { RESOURCE_NODES } from '../data/resourceNodes';
import { GatherBeat } from '../ui/gatherBeat';
import { ACHIEVEMENT_UNLOCKED_EVENT, CURRENCY_CHANGED_EVENT } from '../ui/uiEvents';
import type { EventBus, WorldEvent } from '../world/worldEvents';
import type { CueId } from './cues';

/**
 * A heal smaller than this is regen or a meal ticking over, batched into a pulse
 * for the number over the player's head. A chime on every pulse would be a
 * chime every few seconds for as long as anyone stands still; a spell heals
 * more than this and is worth hearing.
 */
const AUDIBLE_HEAL = 15;

/**
 * What the world's moments sound like: the view channel, heard.
 *
 * A pure translation from `WorldEvent` to `CueId`, with the one piece of memory
 * a gather's strokes need, so what a fight sounds like is testable with no audio
 * device at all. Whether and how loud it is played is `SoundBoard`'s business.
 */
export class MomentEar {
  private readonly gatherBeat = new GatherBeat();

  hear(event: WorldEvent): CueId[] {
    switch (event.kind) {
      case 'swing':
        return ['swing'];
      case 'hit':
        if (event.on === 'mob') return [event.crit ? 'crit' : 'hit'];
        // A blow the mana shield ate whole rings off it rather than landing.
        return [event.damage > event.absorbed ? 'hurt' : 'block'];
      case 'defend':
        return ['block'];
      case 'bolt-cast':
        return ['bolt'];
      case 'heal':
        return event.amount >= AUDIBLE_HEAL ? ['heal'] : [];
      case 'wind-up':
        return ['wind-up'];
      case 'death':
        return [event.on === 'player' ? 'player-death' : 'mob-death'];
      case 'level-up':
        return ['level-up'];
      case 'loot-left':
        return ['sack'];
      case 'gather-tick':
        if (!this.gatherBeat.beat(event.progress)) return [];
        return [gatherCue(event.nodeId)];
      default:
        return [];
    }
  }

  /** A new zone: whatever was being gathered in the last one is not a channel here. */
  reset(): void {
    this.gatherBeat.reset();
  }
}

/**
 * Coin, heard off the purse.
 *
 * Only a purse that grew is a coin: money arriving is the moment worth a sound,
 * and money leaving is either something the player just pressed a counter's
 * button for or the death fee — and a jingle over a corpse would be the game
 * cheering the player's own loss. The first total it hears is a baseline, since
 * a purse that has only just been reported has not changed.
 */
export class PurseEar {
  private last: number | null = null;

  hear(total: number): CueId[] {
    const grew = this.last !== null && total > this.last;
    this.last = total;
    return grew ? ['coin'] : [];
  }

  /** A new character's purse is not a change from the last one's. */
  reset(): void {
    this.last = null;
  }
}

/**
 * The HUD channel, heard: the two things on it that are moments with no
 * `WorldEvent` of their own. A level-up is not here, because it already has one.
 * Answers the unsubscribe, the way the keyboard binding does.
 */
export function hearHudChannel(
  events: EventBus,
  play: (cue: CueId) => void,
  purse: PurseEar,
): () => void {
  const onCurrency = (total: number): void => {
    for (const cue of purse.hear(total)) play(cue);
  };
  const onAchievement = (): void => play('achievement');
  events.on(CURRENCY_CHANGED_EVENT, onCurrency);
  events.on(ACHIEVEMENT_UNLOCKED_EVENT, onAchievement);
  return () => {
    events.off(CURRENCY_CHANGED_EVENT, onCurrency);
    events.off(ACHIEVEMENT_UNLOCKED_EVENT, onAchievement);
  };
}

function gatherCue(nodeId: keyof typeof RESOURCE_NODES): CueId {
  switch (RESOURCE_NODES[nodeId].shape) {
    case 'tree':
      return 'chop';
    case 'vein':
      return 'mine';
    case 'ripple':
      return 'splash';
  }
}
