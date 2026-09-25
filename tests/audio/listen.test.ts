import { describe, expect, it } from 'vitest';
import { MomentEar, PurseEar, hearHudChannel } from '../../src/audio/listen';
import type { CueId } from '../../src/audio/cues';
import { ACHIEVEMENT_UNLOCKED_EVENT, CURRENCY_CHANGED_EVENT } from '../../src/ui/uiEvents';
import type { Mob } from '../../src/world/Mob';
import type { WorldEvent } from '../../src/world/worldEvents';
import { recordingBus } from '../world/harness';

const AT = { x: 0, y: 0 };
const MOB = {} as Mob;

function hit(over: Partial<Extract<WorldEvent, { kind: 'hit' }>>): WorldEvent {
  return {
    kind: 'hit',
    on: 'mob',
    mob: MOB,
    via: 'weapon',
    crit: false,
    at: AT,
    damage: 5,
    absorbed: 0,
    ...over,
  };
}

function tick(progress: number, nodeId: 'tree' | 'tin-vein' | 'fishing-spot' = 'tree'): WorldEvent {
  return { kind: 'gather-tick', at: AT, nodeId, progress };
}

describe('MomentEar', () => {
  it('hears a blow by who took it and how hard it landed', () => {
    const ear = new MomentEar();
    expect(ear.hear(hit({}))).toEqual(['hit']);
    expect(ear.hear(hit({ crit: true }))).toEqual(['crit']);
    expect(ear.hear(hit({ on: 'player', mob: null }))).toEqual(['hurt']);
  });

  // The mana shield ate the whole blow: it rang off the ward rather than landing.
  it('hears a blow the shield ate whole as a block, and one that got through as a wound', () => {
    const ear = new MomentEar();
    expect(ear.hear(hit({ on: 'player', mob: null, damage: 6, absorbed: 6 }))).toEqual(['block']);
    expect(ear.hear(hit({ on: 'player', mob: null, damage: 6, absorbed: 2 }))).toEqual(['hurt']);
  });

  /**
   * Regen and a meal tick over in small pulses for as long as anyone stands
   * still; a chime on each would be a chime every few seconds forever.
   */
  it('leaves a trickle of healing silent and hears a spell', () => {
    const ear = new MomentEar();
    expect(ear.hear({ kind: 'heal', at: AT, amount: 3 })).toEqual([]);
    expect(ear.hear({ kind: 'heal', at: AT, amount: 30 })).toEqual(['heal']);
  });

  it('hears the start of a wind-up, which is the warning', () => {
    expect(new MomentEar().hear({ kind: 'wind-up', by: MOB })).toEqual(['wind-up']);
  });

  it('tells a death by whose it was', () => {
    const ear = new MomentEar();
    expect(ear.hear({ kind: 'death', on: 'mob', mob: MOB })).toEqual(['mob-death']);
    expect(ear.hear({ kind: 'death', on: 'player' })).toEqual(['player-death']);
  });

  /**
   * The world reports a gather's progress every tick and says nothing about
   * strokes; the ear hears the same two the view draws, so the axe is heard
   * where it is seen to land.
   */
  it('hears a gather twice a channel, on the strokes the view draws', () => {
    const ear = new MomentEar();
    const heard = [0.1, 0.2, 0.35, 0.5, 0.7, 0.85, 1].flatMap((p) => ear.hear(tick(p)));
    expect(heard).toEqual(['chop', 'chop']);
  });

  it('starts counting strokes again when the next channel begins', () => {
    const ear = new MomentEar();
    [0.4, 0.9].forEach((p) => ear.hear(tick(p)));
    expect(ear.hear(tick(0.35))).toEqual(['chop']);
  });

  it('hears what is being worked by what it is made of', () => {
    const cueFor = (nodeId: 'tree' | 'tin-vein' | 'fishing-spot'): CueId[] => {
      const ear = new MomentEar();
      return ear.hear(tick(0.4, nodeId));
    };
    expect(cueFor('tree')).toEqual(['chop']);
    expect(cueFor('tin-vein')).toEqual(['mine']);
    expect(cueFor('fishing-spot')).toEqual(['splash']);
  });

  it('is silent for the moments that have no sound of their own', () => {
    const ear = new MomentEar();
    expect(ear.hear({ kind: 'float', at: AT, text: 'x', tone: 'dim' })).toEqual([]);
    expect(ear.hear({ kind: 'spawn', mob: MOB })).toEqual([]);
  });
});

describe('PurseEar', () => {
  it('takes the first total it hears as where the purse stands, not as a gain', () => {
    expect(new PurseEar().hear(500)).toEqual([]);
  });

  /**
   * Money arriving is the moment worth a sound. Money leaving is a button the
   * player just pressed or the death fee, and a jingle over a corpse would be
   * the game cheering the player's own loss.
   */
  it('chimes when the purse grows and never when it shrinks', () => {
    const purse = new PurseEar();
    purse.hear(100);
    expect(purse.hear(130)).toEqual(['coin']);
    expect(purse.hear(90)).toEqual([]);
    expect(purse.hear(90)).toEqual([]);
  });

  it("takes a new character's purse as a baseline rather than a change", () => {
    const purse = new PurseEar();
    purse.hear(10);
    purse.reset();
    expect(purse.hear(9999)).toEqual([]);
  });
});

describe('hearHudChannel', () => {
  it('hears coin and achievements off the bus, and stops when told to', () => {
    const bus = recordingBus([]);
    const played: CueId[] = [];
    const stop = hearHudChannel(bus, (cue) => played.push(cue), new PurseEar());

    bus.emit(CURRENCY_CHANGED_EVENT, 10);
    bus.emit(CURRENCY_CHANGED_EVENT, 25);
    bus.emit(ACHIEVEMENT_UNLOCKED_EVENT, {
      achievementId: 'rat-slayer-25',
      name: 'Rat Catcher',
      titleWorn: false,
    });
    expect(played).toEqual(['coin', 'achievement']);

    stop();
    bus.emit(CURRENCY_CHANGED_EVENT, 50);
    expect(played).toEqual(['coin', 'achievement']);
  });
});
