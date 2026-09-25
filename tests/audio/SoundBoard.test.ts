import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundBoard } from '../../src/audio/SoundBoard';
import { CUES, type CueId } from '../../src/audio/cues';
import { CURRENCY_CHANGED_EVENT } from '../../src/ui/uiEvents';
import { recordingBus } from '../world/harness';

/**
 * Just enough of Web Audio to count what a cue builds. Every source that is
 * started is kept, which is the one thing a speaker can be asked about without
 * listening to it.
 */
class FakeParam {
  value = 1;
  lastTarget: number | null = null;
  setValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
  setTargetAtTime(target: number): this {
    this.lastTarget = target;
    return this;
  }
}

class FakeNode {
  connect<T>(to: T): T {
    return to;
  }
  disconnect(): void {}
}

class FakeSource extends FakeNode {
  readonly frequency = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  stopped = false;
  private readonly context: FakeContext;
  readonly kind: 'oscillator' | 'buffer';
  constructor(context: FakeContext, kind: 'oscillator' | 'buffer') {
    super();
    this.context = context;
    this.kind = kind;
  }
  start(): void {
    this.context.started.push(this);
  }
  stop(): void {
    this.stopped = true;
  }
}

class FakeContext {
  static made: FakeContext[] = [];
  currentTime = 0;
  state: 'running' | 'suspended' | 'closed' = 'running';
  readonly sampleRate = 8000;
  readonly destination = new FakeNode();
  readonly started: FakeSource[] = [];
  readonly gains: { gain: FakeParam }[] = [];
  closed = false;

  constructor() {
    FakeContext.made.push(this);
  }
  createGain() {
    const node = Object.assign(new FakeNode(), { gain: new FakeParam() });
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    return new FakeSource(this, 'oscillator');
  }
  createBufferSource() {
    return new FakeSource(this, 'buffer');
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam() });
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}

const scope = globalThis as unknown as { AudioContext?: unknown };
let saved: unknown;

beforeEach(() => {
  saved = scope.AudioContext;
  FakeContext.made = [];
  vi.useFakeTimers();
});

afterEach(() => {
  scope.AudioContext = saved;
  vi.useRealTimers();
});

function withAudio(): void {
  scope.AudioContext = FakeContext;
}

function context(): FakeContext {
  const made = FakeContext.made.at(-1);
  if (!made) throw new Error('no context was made');
  return made;
}

/** The voices a cue started, counted off the sources the fake saw begin. */
function startedBy(cue: CueId): number {
  return CUES[cue].voices.length;
}

describe('SoundBoard', () => {
  /**
   * jsdom, an old browser, a page that refused audio: the game still has to run.
   * Every call is quietly nothing rather than a throw in the middle of a frame.
   */
  it('is silent and harmless where there is no Web Audio at all', () => {
    delete scope.AudioContext;
    const sound = new SoundBoard();
    expect(() => {
      sound.unlock();
      sound.enter('open');
      sound.play('hit');
      sound.hear([{ kind: 'level-up', at: { x: 0, y: 0 } }]);
      sound.dispose();
    }).not.toThrow();
  });

  it('makes nothing until a gesture unlocks it, since a browser would refuse', () => {
    withAudio();
    const sound = new SoundBoard();
    sound.play('hit');
    sound.enter('open');
    expect(FakeContext.made).toHaveLength(0);

    sound.unlock();
    sound.play('hit');
    expect(context().started.filter((s) => s.kind === 'oscillator').length).toBeGreaterThan(0);
  });

  it('plays a cue as the voices its row names', () => {
    withAudio();
    const sound = new SoundBoard();
    sound.unlock();
    sound.play('level-up');
    expect(context().started).toHaveLength(startedBy('level-up'));
  });

  it('plays nothing while muted', () => {
    withAudio();
    const sound = new SoundBoard({ muted: true, volume: 0.5 });
    sound.unlock();
    sound.play('crit');
    expect(context().started).toHaveLength(0);
  });

  /** Six rats swinging in one frame is one swing's worth of sound. */
  it('spaces repeats of one cue, and lets the next through once the gap has passed', () => {
    withAudio();
    const sound = new SoundBoard();
    sound.unlock();
    sound.play('swing');
    sound.play('swing');
    expect(context().started).toHaveLength(startedBy('swing'));

    context().currentTime += CUES.swing.spacingMs / 1000 + 0.01;
    sound.play('swing');
    expect(context().started).toHaveLength(startedBy('swing') * 2);
  });

  it('hears the frame it is handed', () => {
    withAudio();
    const sound = new SoundBoard();
    sound.unlock();
    sound.hear([{ kind: 'death', on: 'player' }]);
    expect(context().started).toHaveLength(startedBy('player-death'));
  });

  it('sets the master level from the setting, and to nothing while muted', () => {
    withAudio();
    const sound = new SoundBoard({ muted: false, volume: 0.4 });
    sound.unlock();
    const master = context().gains[0];
    expect(master?.gain.lastTarget).toBe(0.4);
    sound.configure({ muted: true, volume: 0.4 });
    expect(master?.gain.lastTarget).toBe(0);
    sound.configure({ muted: false, volume: 7 });
    expect(master?.gain.lastTarget).toBe(1);
  });

  it('hears coin off the HUD channel once it is listening', () => {
    withAudio();
    const sound = new SoundBoard();
    sound.unlock();
    const bus = recordingBus([]);
    sound.listenTo(bus);
    bus.emit(CURRENCY_CHANGED_EVENT, 10);
    bus.emit(CURRENCY_CHANGED_EVENT, 20);
    expect(context().started).toHaveLength(startedBy('coin'));
  });

  /**
   * The bug this is for: a reset closes the context and the next gesture makes a
   * new one, whose clock starts again at zero. Kept across that, the spacing
   * memory — on the old clock — would hold every cue silent until the new clock
   * caught up with wherever the old one had got to.
   */
  it('sounds straight away in the session after a reset', () => {
    withAudio();
    const sound = new SoundBoard();
    sound.unlock();
    context().currentTime = 100;
    sound.play('hit');
    const first = context();

    sound.dispose();
    expect(first.closed).toBe(true);

    sound.unlock();
    expect(context()).not.toBe(first);
    sound.play('hit');
    expect(context().started).toHaveLength(startedBy('hit'));
  });

  it('stops hearing the bus when the session ends', () => {
    withAudio();
    const sound = new SoundBoard();
    sound.unlock();
    const bus = recordingBus([]);
    sound.listenTo(bus);
    bus.emit(CURRENCY_CHANGED_EVENT, 10);
    sound.dispose();
    sound.unlock();
    bus.emit(CURRENCY_CHANGED_EVENT, 50);
    expect(context().started).toHaveLength(0);
  });

  describe('the ambience', () => {
    it('lays a bed under the place, once, however often it is entered', () => {
      withAudio();
      const sound = new SoundBoard();
      sound.unlock();
      sound.enter('open');
      const bed = context().started.length;
      expect(bed).toBeGreaterThan(0);
      sound.enter('open');
      expect(context().started).toHaveLength(bed);
    });

    it('puts a drone under the ground and not under the sky', () => {
      withAudio();
      const open = new SoundBoard();
      open.unlock();
      open.enter('open');
      const sky = context().started.filter((s) => s.kind === 'oscillator').length;

      const under = new SoundBoard();
      under.unlock();
      under.enter('underground');
      const ground = context().started.filter((s) => s.kind === 'oscillator').length;
      expect(ground).toBe(sky + 1);
    });

    it('stops the last place when the player walks into a different one', () => {
      withAudio();
      const sound = new SoundBoard();
      sound.unlock();
      sound.enter('open');
      const before = [...context().started];
      sound.enter('marsh');
      expect(before.every((source) => source.stopped)).toBe(true);
      expect(context().started.length).toBeGreaterThan(before.length);
    });

    /** Entered before the first gesture — the first zone always is — and heard after it. */
    it('starts the bed for the place already entered once the sound unlocks', () => {
      withAudio();
      const sound = new SoundBoard();
      sound.enter('marsh');
      sound.unlock();
      expect(context().started.length).toBeGreaterThan(0);
    });

    it('stops its accents with the session, leaving no timer running', () => {
      withAudio();
      const sound = new SoundBoard();
      sound.unlock();
      sound.enter('marsh');
      sound.dispose();
      const settled = context().started.length;
      vi.advanceTimersByTime(60_000);
      expect(context().started).toHaveLength(settled);
    });
  });
});

/**
 * The table is hand-written, and Web Audio has one rule a row can break without
 * anything throwing: an exponential ramp cannot reach or cross zero, so a sweep
 * to 0Hz or a peak of 0 is a voice that silently never sounds.
 */
describe('CUES', () => {
  it('names only voices a ramp can draw, audible and brief', () => {
    for (const [id, cue] of Object.entries(CUES)) {
      expect(cue.voices.length, id).toBeGreaterThan(0);
      expect(cue.spacingMs, id).toBeGreaterThanOrEqual(0);
      for (const voice of cue.voices) {
        expect(voice.from, id).toBeGreaterThan(0);
        if (voice.to !== undefined) expect(voice.to, id).toBeGreaterThan(0);
        expect(voice.gain, id).toBeGreaterThan(0);
        expect(voice.gain, id).toBeLessThanOrEqual(1);
        expect(voice.ms, id).toBeGreaterThan(0);
        expect(voice.ms, id).toBeLessThanOrEqual(2000);
      }
    }
  });
});
